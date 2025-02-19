import { basename, dirname, join } from "path";
import ini from "ini";
import { type FSModule } from "browserfs/dist/node/core/FS";
import type Stats from "browserfs/dist/node/core/node_fs_stats";
import { monacoExtensions } from "components/apps/MonacoEditor/extensions";
import extensions from "components/system/Files/FileEntry/extensions";
import { type FileInfo } from "components/system/Files/FileEntry/useFileInfo";
import { type FileStat } from "components/system/Files/FileManager/functions";
import { get9pModifiedTime } from "contexts/fileSystem/core";
import { isMountedFolder } from "contexts/fileSystem/functions";
import { type RootFileSystem } from "contexts/fileSystem/useAsyncFs";
import processDirectory from "contexts/process/directory";
import {
  AUDIO_FILE_EXTENSIONS,
  BASE_2D_CONTEXT_OPTIONS,
  DYNAMIC_EXTENSION,
  DYNAMIC_PREFIX,
  FOLDER_BACK_ICON,
  FOLDER_FRONT_ICON,
  FOLDER_ICON,
  HEIF_IMAGE_FORMATS,
  ICON_CACHE,
  ICON_CACHE_EXTENSION,
  ICON_GIF_FPS,
  ICON_GIF_SECONDS,
  IMAGE_FILE_EXTENSIONS,
  MAX_ICON_SIZE,
  MOUNTED_FOLDER_ICON,
  MP3_MIME_TYPE,
  NEW_FOLDER_ICON,
  ONE_TIME_PASSIVE_EVENT,
  PHOTO_ICON,
  SHORTCUT_EXTENSION,
  SHORTCUT_ICON,
  SMALLEST_PNG_SIZE,
  SYSTEM_FILES,
  SYSTEM_PATHS,
  TIFF_IMAGE_FORMATS,
  UNKNOWN_ICON_PATH,
  VIDEO_FALLBACK_MIME_TYPE,
  VIDEO_FILE_EXTENSIONS,
  YT_ICON_CACHE,
} from "utils/constants";
import shortcutCache from "public/.index/shortcutCache.json";
import {
  blobToBase64,
  bufferToUrl,
  cleanUpBufferUrl,
  decodeHeic,
  decodeJxl,
  getExtension,
  getGifJs,
  getHtmlToImage,
  imageToBufferUrl,
  isSafari,
  isYouTubeUrl,
} from "utils/functions";

type InternetShortcut = {
  BaseURL: string;
  Comment: string;
  IconFile: string;
  Type: string;
  URL: string;
};

type ShellClassInfo = {
  ShellClassInfo: {
    IconFile: string;
  };
};

type VideoElementWithSeek = HTMLVideoElement & {
  seekToNextFrame: () => Promise<void>;
};

export const isExistingFile = (
  { birthtimeMs, ctimeMs }: Stats = {} as Stats
): boolean => Boolean(birthtimeMs && birthtimeMs === ctimeMs);

export const getModifiedTime = (path: string, stats: FileStat): number => {
  const { mtimeMs } = stats;

  return isExistingFile(stats) ? get9pModifiedTime(path) || mtimeMs : mtimeMs;
};

export const getIconFromIni = (
  fs: FSModule,
  directory: string
): Promise<string> =>
  new Promise((resolve) => {
    const iniPath = join(directory, "desktop.ini");

    fs.lstat(iniPath, (statError, stats) => {
      if (statError) resolve("");
      else if (stats && isExistingFile(stats)) {
        import("public/.index/iniIcons.json").then(({ default: iniCache }) =>
          resolve(iniCache[directory as keyof typeof iniCache] || "")
        );
      } else {
        fs.readFile(iniPath, (readError, contents = Buffer.from("")) => {
          if (readError) resolve("");
          else {
            const {
              ShellClassInfo: { IconFile = "" },
            } = ini.parse(contents.toString()) as ShellClassInfo;

            resolve(IconFile);
          }
        });
      }
    });
  });

const getDefaultFileViewer = (extension: string): string => {
  if (AUDIO_FILE_EXTENSIONS.has(extension)) return "VideoPlayer";
  if (VIDEO_FILE_EXTENSIONS.has(extension)) return "VideoPlayer";
  if (IMAGE_FILE_EXTENSIONS.has(extension)) return "Photos";
  if (monacoExtensions.has(extension)) return "MonacoEditor";

  return "";
};

export const getIconByFileExtension = (extension: string): string => {
  const { icon: extensionIcon = "", process: [defaultProcess = ""] = [] } =
    extension in extensions ? extensions[extension] : {};

  if (extensionIcon) return `/System/Icons/${extensionIcon}.webp`;

  return (
    processDirectory[defaultProcess || getDefaultFileViewer(extension)]?.icon ||
    UNKNOWN_ICON_PATH
  );
};

export const getProcessByFileExtension = (extension: string): string => {
  const [defaultProcess = ""] =
    extension in extensions
      ? extensions[extension].process
      : [getDefaultFileViewer(extension)];

  return defaultProcess;
};

export const getMimeType = (url: string): string => {
  switch (getExtension(url)) {
    case ".ani":
    case ".cur":
    case ".ico":
      return "image/vnd.microsoft.icon";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".json":
      return "application/json";
    case ".html":
    case ".htm":
    case ".whtml":
      return "text/html";
    case ".m3u":
    case ".m3u8":
      return "application/x-mpegURL";
    case ".m4v":
    case ".mkv":
    case ".mov":
    case ".mp4":
      return "video/mp4";
    case ".mp3":
      return "audio/mpeg";
    case ".oga":
      return "audio/ogg";
    case ".ogg":
    case ".ogm":
    case ".ogv":
      return "video/ogg";
    case ".pdf":
      return "application/pdf";
    case ".png":
      return "image/png";
    case ".md":
    case ".txt":
      return "text/plain";
    case ".wav":
      return "audio/wav";
    case ".webm":
      return "video/webm";
    case ".webp":
      return "image/webp";
    case ".xml":
      return "application/xml";
    case ".wsz":
    case ".jsdos":
    case ".zip":
      return "application/zip";
    default:
      return "";
  }
};

export const getShortcutInfo = (
  contents?: Buffer,
  shortcutData?: InternetShortcut
): FileInfo => {
  const {
    InternetShortcut: {
      BaseURL: pid = "",
      Comment: comment = "",
      IconFile: icon = "",
      Type: type = "",
      URL: url = "",
    } = {},
  } = shortcutData
    ? { InternetShortcut: shortcutData }
    : ((ini.parse(contents?.toString() || "") || {}) as {
        InternetShortcut: InternetShortcut;
      });

  return {
    comment,
    icon:
      !icon && pid && pid !== "FileExplorer"
        ? processDirectory[pid]?.icon
        : icon,
    pid,
    type,
    url,
  };
};

export const getCachedShortcut = (path: string): FileInfo =>
  getShortcutInfo(
    undefined,
    (
      shortcutCache as unknown as Record<
        string,
        Record<string, InternetShortcut>
      >
    )?.[dirname(path)]?.[basename(path)]
  );

export const createShortcut = (shortcut: Partial<InternetShortcut>): string =>
  ini
    .encode(shortcut, {
      section: "InternetShortcut",
      whitespace: false,
    })
    .replace(/"/g, "");

export const makeExternalShortcut = (contents: Buffer): Buffer => {
  const { pid, url } = getShortcutInfo(contents);

  return Buffer.from(
    createShortcut({
      URL: encodeURI(
        `${window.location.origin}${pid ? `/?app=${pid}` : ""}${
          url ? `${pid ? "&" : "/?"}url=${url}` : ""
        }`
      ),
    })
  );
};

export const getCachedIconUrl = async (
  fs: FSModule,
  cachedIconPath: string
): Promise<string> =>
  new Promise((resolve) => {
    fs.lstat(cachedIconPath, (statError, cachedIconStats) => {
      if (!statError && cachedIconStats) {
        if (isExistingFile(cachedIconStats)) {
          resolve(cachedIconPath);
        } else {
          fs.readFile(
            cachedIconPath,
            (readError, cachedIconData = Buffer.from("")) => {
              if (cachedIconData.length >= SMALLEST_PNG_SIZE) {
                resolve(bufferToUrl(cachedIconData));
              } else if (!readError) fs.unlink(cachedIconPath);
            }
          );
        }
      } else resolve("");
    });
  });

const getIconsFromCache = (fs: FSModule, path: string): Promise<string[]> =>
  new Promise((resolve) => {
    const iconCacheDirectory = join(ICON_CACHE, path);

    fs?.readdir(
      iconCacheDirectory,
      async (dirError, [firstIcon, ...otherIcons] = []) => {
        if (dirError) resolve([]);
        else {
          resolve(
            (
              await Promise.all(
                [firstIcon, otherIcons[otherIcons.length - 1]]
                  .filter((icon) => icon?.endsWith(ICON_CACHE_EXTENSION))
                  .map(
                    (cachedIcon): Promise<string> =>
                      // eslint-disable-next-line promise/param-names
                      new Promise((resolveIcon) => {
                        getCachedIconUrl(
                          fs,
                          join(iconCacheDirectory, cachedIcon)
                        ).then(resolveIcon);
                      })
                  )
              )
            ).filter(Boolean)
          );
        }
      }
    );
  });

export const getInfoWithoutExtension = (
  fs: FSModule,
  rootFs: RootFileSystem,
  path: string,
  isDirectory: boolean,
  hasNewFolderIcon: boolean,
  callback: (value: FileInfo) => void,
  lazy = true
): void => {
  if (isDirectory) {
    const setFolderInfo = (
      icon: string,
      subIcons?: string[],
      getIcon?: () => Promise<void>
    ): void =>
      callback({ getIcon, icon, pid: "FileExplorer", subIcons, url: path });
    const getFolderIcon = (): string => {
      if (isMountedFolder(rootFs?.mntMap[path])) {
        return MOUNTED_FOLDER_ICON;
      }
      if (hasNewFolderIcon) return NEW_FOLDER_ICON;
      return FOLDER_ICON;
    };
    const folderIcon = getFolderIcon();
    const getDynamicIcon = async (): Promise<void> => {
      const iconFromIni = await getIconFromIni(fs, path);

      if (iconFromIni) setFolderInfo(iconFromIni);
      else if (folderIcon === FOLDER_ICON) {
        const iconsFromCache = await getIconsFromCache(fs, path);

        if (iconsFromCache.length > 0) {
          setFolderInfo(FOLDER_BACK_ICON, [
            ...iconsFromCache,
            FOLDER_FRONT_ICON,
          ]);
        } else if (!lazy) {
          setFolderInfo(folderIcon, []);
        }
      }
    };

    if (lazy) {
      setFolderInfo(folderIcon, [], getDynamicIcon);
    } else {
      getDynamicIcon();
    }
  } else {
    callback({ icon: UNKNOWN_ICON_PATH, pid: "", url: path });
  }
};

export const getFirstAniImage = async (
  imageBuffer: Buffer
): Promise<Buffer | undefined> => {
  const { parseAni } = await import("ani-cursor/dist/parser");
  let firstImage: Uint8Array;

  try {
    ({
      images: [firstImage],
    } = parseAni(imageBuffer));

    return Buffer.from(firstImage);
  } catch {
    // Can't parse ani
  }

  return undefined;
};

export const aniToGif = async (aniBuffer: Buffer): Promise<Buffer> => {
  const gif = await getGifJs();
  const { parseAni } = await import("ani-cursor/dist/parser");
  let images: Uint8Array[] = [];

  try {
    ({ images } = parseAni(aniBuffer));
  } catch {
    return aniBuffer;
  }

  await Promise.all(
    images.map(
      (image) =>
        new Promise<void>((resolve) => {
          const imageIcon = new Image();
          const bufferUrl = bufferToUrl(Buffer.from(image));
          gif.setOptions({ transparent: "" });
          imageIcon.addEventListener(
            "load",
            () => {
              gif.addFrame(imageIcon);
              cleanUpBufferUrl(bufferUrl);
              resolve();
            },
            ONE_TIME_PASSIVE_EVENT
          );
          imageIcon.src = bufferUrl;
        })
    )
  );

  return new Promise((resolve) => {
    gif
      .on("finished", (blob) =>
        blob
          .arrayBuffer()
          .then((arrayBuffer) => resolve(Buffer.from(arrayBuffer)))
      )
      .render();
  });
};

export const getLargestIcon = async (
  imageBuffer: Buffer,
  maxSize: number
): Promise<string> => {
  try {
    const { default: icoData } = await import("decode-ico");
    const [icon] = icoData(imageBuffer)
      .filter(({ width }) => width <= maxSize)
      .sort((a, b) => b.width - a.width);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", {
      desynchronized: true,
    });

    canvas.width = icon.width;
    canvas.height = icon.height;
    context?.putImageData(icon as unknown as ImageData, 0, 0);

    return canvas.toDataURL();
  } catch {
    return "";
  }
};

export const getInfoWithExtension = (
  fs: FSModule,
  path: string,
  extension: string,
  callback: (value: FileInfo) => void
): void => {
  const subIcons: string[] = [];
  const getInfoByFileExtension = (
    icon?: string,
    getIcon?: true | ((signal: AbortSignal) => void | Promise<void>)
  ): void =>
    callback({
      getIcon,
      icon: icon || getIconByFileExtension(extension),
      pid: getProcessByFileExtension(extension),
      subIcons,
      url: path,
    });

  switch (extension) {
    case SHORTCUT_EXTENSION:
      {
        const handleShortcut = ({
          comment,
          icon,
          pid,
          url,
        }: FileInfo): void => {
          const urlExt = getExtension(url);

          if (pid !== "ExternalURL") subIcons.push(SHORTCUT_ICON);

          if (pid === "FileExplorer" && !icon) {
            const getIcon = (): void => {
              getIconFromIni(fs, url).then(
                (iniIcon) =>
                  iniIcon &&
                  callback({
                    comment,
                    icon: iniIcon,
                    pid,
                    subIcons,
                    url,
                  })
              );
            };

            callback({
              comment,
              getIcon,
              icon: processDirectory[pid]?.icon,
              pid,
              subIcons,
              url,
            });
          } else if (
            DYNAMIC_EXTENSION.has(urlExt) ||
            DYNAMIC_PREFIX.some((prefix) => url.startsWith(prefix))
          ) {
            const isCachedUrl = DYNAMIC_EXTENSION.has(urlExt);
            const cachedIconPath = join(
              ICON_CACHE,
              `${isCachedUrl ? url : path}${ICON_CACHE_EXTENSION}`
            );

            fs.lstat(cachedIconPath, (statError, cachedIconStats) => {
              if (!statError && cachedIconStats) {
                if (isExistingFile(cachedIconStats)) {
                  callback({
                    comment,
                    icon: cachedIconPath,
                    pid,
                    subIcons,
                    url,
                  });
                } else {
                  fs.readFile(cachedIconPath, (_readError, cachedIconData) =>
                    callback({
                      comment,
                      icon: bufferToUrl(cachedIconData as Buffer),
                      pid,
                      subIcons,
                      url,
                    })
                  );
                }
              } else {
                getInfoWithExtension(fs, url, urlExt, (fileInfo) => {
                  const {
                    icon: urlIcon = icon,
                    getIcon,
                    subIcons: fileSubIcons = [],
                  } = fileInfo;

                  if (fileSubIcons.length > 0) {
                    subIcons.push(
                      ...fileSubIcons.filter(
                        (subIcon) => !subIcons.includes(subIcon)
                      )
                    );
                  }

                  callback({
                    comment,
                    getIcon,
                    icon: urlIcon,
                    pid,
                    subIcons,
                    url,
                  });
                });
              }
            });
          } else if (isYouTubeUrl(url)) {
            const ytId = new URL(url).pathname.replace("/", "");
            const cachedIconPath = join(
              YT_ICON_CACHE,
              `${ytId}${ICON_CACHE_EXTENSION}`
            );
            const baseFileInfo = {
              comment,
              pid,
              url,
            };
            const isDefaultIcon = icon === processDirectory.VideoPlayer.icon;
            const videoSubIcons = [processDirectory.VideoPlayer.icon];

            callback({
              ...baseFileInfo,
              getIcon: isDefaultIcon
                ? () =>
                    fs.exists(cachedIconPath, (cachedIconExists) =>
                      callback({
                        ...baseFileInfo,
                        icon: cachedIconExists
                          ? cachedIconPath
                          : `https://i.ytimg.com/vi/${ytId}/mqdefault.jpg`,
                        subIcons: videoSubIcons,
                      })
                    )
                : undefined,
              icon: icon || processDirectory.VideoPlayer.icon,
              subIcons: icon && !isDefaultIcon ? videoSubIcons : undefined,
            });
          } else {
            callback({
              comment,
              icon: icon || UNKNOWN_ICON_PATH,
              pid,
              subIcons,
              url,
            });
          }
        };

        fs.lstat(path, (statError, stats) => {
          if (statError) getInfoByFileExtension();
          else if (isExistingFile(stats)) {
            handleShortcut(getCachedShortcut(path));
          } else {
            fs.readFile(path, (readError, contents): void => {
              if (readError || !contents) getInfoByFileExtension();
              else handleShortcut(getShortcutInfo(contents));
            });
          }
        });
      }
      break;
    case ".ani":
      getInfoByFileExtension(PHOTO_ICON, (signal) =>
        fs.readFile(path, async (error, contents = Buffer.from("")) => {
          if (!error && contents.length > 0 && !signal.aborted) {
            let icon = "";

            try {
              const animatedIcon = await aniToGif(contents);

              if (animatedIcon && !signal.aborted) {
                icon = imageToBufferUrl(path, animatedIcon);
              }
            } catch {
              // Ignore failure to convert
            }

            if (!icon && !signal.aborted) {
              const firstImage = await getFirstAniImage(contents);

              if (firstImage && !signal.aborted) {
                icon = imageToBufferUrl(path, firstImage);
              }
            }

            if (icon) getInfoByFileExtension(icon);
          }
        })
      );
      break;
    case ".exe":
      getInfoByFileExtension("/System/Icons/executable.webp", (signal) =>
        fs.readFile(path, async (error, contents = Buffer.from("")) => {
          if (!error && contents.length > 0 && !signal.aborted) {
            const { extractExeIcon } = await import(
              "components/system/Files/FileEntry/exeIcons"
            );
            const exeIcon = await extractExeIcon(contents);

            if (exeIcon && !signal.aborted) {
              getInfoByFileExtension(bufferToUrl(exeIcon));
            }
          }
        })
      );
      break;
    case ".mp3":
      getInfoByFileExtension(
        `/System/Icons/${extensions[".mp3"].icon as string}.webp`,
        (signal) =>
          fs.readFile(path, (error, contents = Buffer.from("")) => {
            if (!error && !signal.aborted) {
              import("music-metadata-browser").then(
                ({ parseBuffer, selectCover }) => {
                  if (signal.aborted) return;

                  parseBuffer(
                    contents,
                    {
                      mimeType: MP3_MIME_TYPE,
                      size: contents.length,
                    },
                    { skipPostHeaders: true }
                  ).then(({ common: { picture } = {} }) => {
                    if (signal.aborted) return;

                    const { data: coverPicture } = selectCover(picture) || {};

                    if (coverPicture) {
                      getInfoByFileExtension(bufferToUrl(coverPicture));
                    }
                  });
                }
              );
            }
          })
      );
      break;
    case ".sav":
      getInfoByFileExtension(UNKNOWN_ICON_PATH, true);
      break;
    case ".jxl":
      getInfoByFileExtension(PHOTO_ICON, (signal) =>
        fs.readFile(path, async (error, contents = Buffer.from("")) => {
          if (!error && contents.length > 0 && !signal.aborted) {
            getInfoByFileExtension(
              imageToBufferUrl(path, await decodeJxl(contents))
            );
          }
        })
      );
      break;
    case ".qoi":
      getInfoByFileExtension(PHOTO_ICON, (signal) =>
        fs.readFile(path, async (error, contents = Buffer.from("")) => {
          if (!error && contents.length > 0 && !signal.aborted) {
            const { decodeQoi } = await import("components/apps/Photos/qoi");
            const icon = decodeQoi(contents);

            if (icon && !signal.aborted) {
              getInfoByFileExtension(imageToBufferUrl(path, icon));
            }
          }
        })
      );
      break;
    case ".whtml":
      getInfoByFileExtension("/System/Icons/tinymce.webp", (signal) =>
        fs.readFile(path, async (error, contents = Buffer.from("")) => {
          if (!error && contents.length > 0 && !signal.aborted) {
            const htmlToImage = await getHtmlToImage();
            const containerElement = document.createElement("div");

            containerElement.style.height = "600px";
            containerElement.style.width = "600px";
            containerElement.style.padding = "32px";
            containerElement.style.backgroundColor = "#fff";
            containerElement.style.zIndex = "-1";
            containerElement.style.overflow = "hidden";
            containerElement.style.opacity = "0";
            containerElement.style.userSelect = "none";
            // eslint-disable-next-line deprecation/deprecation
            containerElement.style.webkitUserSelect = "none";

            containerElement.innerHTML = contents.toString();

            document.body.append(containerElement);

            let documentImage: string | undefined;

            try {
              documentImage = await htmlToImage?.toPng(containerElement, {
                skipAutoScale: true,
                style: {
                  opacity: "1",
                },
              });
            } catch {
              // Ignore failure to captrure
            }

            containerElement.remove();

            if (documentImage && documentImage.length > SMALLEST_PNG_SIZE) {
              getInfoByFileExtension(documentImage);
            }
          }
        })
      );
      break;
    default:
      if (TIFF_IMAGE_FORMATS.has(extension)) {
        getInfoByFileExtension(PHOTO_ICON, (signal) =>
          fs.readFile(path, async (error, contents = Buffer.from("")) => {
            if (!error && contents.length > 0 && !signal.aborted) {
              const firstImage = (await import("utif")).bufferToURI(contents);

              if (firstImage && !signal.aborted) {
                getInfoByFileExtension(firstImage);
              }
            }
          })
        );
      } else if (HEIF_IMAGE_FORMATS.has(extension)) {
        getInfoByFileExtension(PHOTO_ICON, (signal) =>
          fs.readFile(path, async (error, contents = Buffer.from("")) => {
            if (!error && contents.length > 0 && !signal.aborted) {
              const icon = await decodeHeic(contents);

              if (icon && !signal.aborted) {
                getInfoByFileExtension(imageToBufferUrl(path, icon));
              }
            }
          })
        );
      } else if (IMAGE_FILE_EXTENSIONS.has(extension)) {
        getInfoByFileExtension(PHOTO_ICON, (signal) =>
          fs.readFile(path, (error, contents = Buffer.from("")) => {
            if (!error && contents.length > 0 && !signal.aborted) {
              const imageIcon = new Image();

              imageIcon.addEventListener(
                "load",
                () => getInfoByFileExtension(imageIcon.src),
                { signal, ...ONE_TIME_PASSIVE_EVENT }
              );
              imageIcon.addEventListener(
                "error",
                async () => {
                  if (extension === ".cur") {
                    const firstImage = await getFirstAniImage(contents);

                    if (firstImage && !signal.aborted) {
                      getInfoByFileExtension(
                        imageToBufferUrl(path, firstImage)
                      );
                    }
                  }
                },
                { signal, ...ONE_TIME_PASSIVE_EVENT }
              );
              imageIcon.src = imageToBufferUrl(path, contents);
            }
          })
        );
      } else if (AUDIO_FILE_EXTENSIONS.has(extension)) {
        getInfoByFileExtension(processDirectory.VideoPlayer.icon);
      } else if (VIDEO_FILE_EXTENSIONS.has(extension)) {
        subIcons.push(processDirectory.VideoPlayer.icon);
        getInfoByFileExtension(processDirectory.VideoPlayer.icon, (signal) =>
          fs.readFile(path, async (error, contents = Buffer.from("")) => {
            if (!error) {
              const video = document.createElement("video");
              const canvas = document.createElement("canvas");
              const context = canvas.getContext("2d", {
                ...BASE_2D_CONTEXT_OPTIONS,
                willReadFrequently: true,
              });
              const gif = await getGifJs();
              let framesRemaining = ICON_GIF_FPS * ICON_GIF_SECONDS;
              const getFrame = (
                second: number,
                firstFrame: boolean
              ): Promise<void> =>
                new Promise((resolve) => {
                  video.currentTime = second;

                  if ("seekToNextFrame" in video) {
                    (video as VideoElementWithSeek)
                      .seekToNextFrame?.()
                      .catch(() => {
                        // Ignore error during seekToNextFrame
                      });
                  } else if (firstFrame) {
                    video.load();
                  }

                  const processFrame = (): void => {
                    if (!context || !canvas.width || !canvas.height) return;

                    context.drawImage(video, 0, 0, canvas.width, canvas.height);
                    gif.addFrame(
                      context.getImageData(0, 0, canvas.width, canvas.height),
                      { copy: true, delay: 100 }
                    );
                    framesRemaining -= 1;

                    if (framesRemaining === 0) {
                      gif
                        .on("finished", (blob) =>
                          blobToBase64(blob).then(getInfoByFileExtension)
                        )
                        .render();
                    }

                    resolve();
                  };

                  if ("requestVideoFrameCallback" in video) {
                    video.requestVideoFrameCallback(processFrame);
                  } else {
                    (video as HTMLVideoElement).addEventListener(
                      "canplaythrough",
                      processFrame,
                      { signal, ...ONE_TIME_PASSIVE_EVENT }
                    );
                  }
                });

              video.addEventListener(
                "loadeddata",
                () => {
                  canvas.height =
                    video.videoHeight > video.videoWidth
                      ? MAX_ICON_SIZE
                      : (MAX_ICON_SIZE * video.videoHeight) / video.videoWidth;
                  canvas.width =
                    video.videoWidth > video.videoHeight
                      ? MAX_ICON_SIZE
                      : (MAX_ICON_SIZE * video.videoWidth) / video.videoHeight;

                  const capturePoints = [
                    video.duration / 4,
                    video.duration / 2,
                  ];
                  const frameStep = 4 / ICON_GIF_FPS;
                  const frameCount = framesRemaining / capturePoints.length;

                  capturePoints.forEach(async (capturePoint, index) => {
                    if (signal.aborted) return;

                    for (
                      let frame = capturePoint;
                      frame < capturePoint + frameCount * frameStep;
                      frame += frameStep
                    ) {
                      if (signal.aborted) return;

                      const firstFrame = index === 0;

                      // eslint-disable-next-line no-await-in-loop
                      await getFrame(frame, firstFrame);

                      if (firstFrame && frame === capturePoint) {
                        getInfoByFileExtension(canvas.toDataURL("image/jpeg"));
                      }
                    }
                  });
                },
                { signal, ...ONE_TIME_PASSIVE_EVENT }
              );

              video.src = bufferToUrl(
                contents,
                isSafari()
                  ? getMimeType(path) || VIDEO_FALLBACK_MIME_TYPE
                  : undefined
              );
            }
          })
        );
      } else {
        getInfoByFileExtension();
      }
  }
};

export const filterSystemFiles =
  (directory: string) =>
  (file: string): boolean =>
    !SYSTEM_PATHS.has(join(directory, file)) && !SYSTEM_FILES.has(file);

type WrapData = {
  lines: string[];
  width: number;
};

const canvasContexts = Object.create(null) as Record<
  string,
  CanvasRenderingContext2D
>;

export const measureText = (
  text: string,
  fontSize: string,
  fontFamily: string
): number => {
  const font = `${fontSize} ${fontFamily}`;

  if (!canvasContexts[font]) {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext(
      "2d",
      BASE_2D_CONTEXT_OPTIONS
    ) as CanvasRenderingContext2D;

    context.font = font;
    canvasContexts[font] = context;
  }
  const { actualBoundingBoxLeft, actualBoundingBoxRight } =
    canvasContexts[font].measureText(text);

  return Math.abs(actualBoundingBoxLeft) + Math.abs(actualBoundingBoxRight);
};

export const getTextWrapData = (
  text: string,
  fontSize: string,
  fontFamily: string,
  maxWidth?: number
): WrapData => {
  const lines = [""];

  const totalWidth = measureText(text, fontSize, fontFamily);

  if (!maxWidth) return { lines: [text], width: totalWidth };

  if (totalWidth > maxWidth) {
    const words = text.split(" ");

    [...text].forEach((character) => {
      const lineIndex = lines.length - 1;
      const lineText = `${lines[lineIndex]}${character}`;
      const lineWidth = measureText(lineText, fontSize, fontFamily);

      if (lineWidth > maxWidth) {
        const spacesInLine = lineText.split(" ").length - 1;
        const lineWithWords = words.splice(0, spacesInLine).join(" ");

        if (
          lines.length === 1 &&
          spacesInLine > 0 &&
          lines[0] !== lineWithWords
        ) {
          lines[0] = lineText.slice(0, lineWithWords.length);
          lines.push(lineText.slice(lineWithWords.length));
        } else {
          lines.push(character);
        }
      } else {
        lines[lineIndex] = lineText;
      }
    });
  }

  return {
    lines,
    width: Math.min(maxWidth, totalWidth),
  };
};
