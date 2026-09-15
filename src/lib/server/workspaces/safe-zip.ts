import path from "node:path";
import fs from "node:fs/promises";
import yauzl from "yauzl";

const MAX_FILES = 5000;

const MAX_EXTRACTED_BYTES =
  250 * 1024 * 1024;

export class UnsafeArchiveError
  extends Error {
  constructor(message: string) {
    super(message);
    this.name =
      "UnsafeArchiveError";
  }
}

function normalizeEntryName(
  entryName: string
): string {
  const normalized =
    entryName.replaceAll(
      "\\",
      "/"
    );

  if (
    normalized.includes("\0")
  ) {
    throw new UnsafeArchiveError(
      "Archive contains an invalid filename."
    );
  }

  if (
    normalized.startsWith("/") ||
    /^[A-Za-z]:\//.test(
      normalized
    )
  ) {
    throw new UnsafeArchiveError(
      "Archive contains an absolute path."
    );
  }

  const clean =
    path.posix.normalize(
      normalized
    );

  if (
    clean === ".." ||
    clean.startsWith("../")
  ) {
    throw new UnsafeArchiveError(
      "Archive path traversal detected."
    );
  }

  return clean;
}

function openZip(
  zipPath: string
): Promise<yauzl.ZipFile> {
  return new Promise(
    (resolve, reject) => {
      yauzl.open(
        zipPath,
        {
          lazyEntries: true,
          decodeStrings: true,
        },
        (error, zipFile) => {
          if (
            error ||
            !zipFile
          ) {
            reject(
              error ??
                new Error(
                  "Unable to open ZIP archive."
                )
            );

            return;
          }

          resolve(zipFile);
        }
      );
    }
  );
}

export async function extractZipSafely(
  zipPath: string,
  destination: string
): Promise<void> {
  await fs.mkdir(
    destination,
    {
      recursive: true,
    }
  );

  const zip =
    await openZip(zipPath);

  let fileCount = 0;
  let extractedBytes = 0;

  await new Promise<void>(
    (resolve, reject) => {
      let settled = false;

      const fail = (
        error: unknown
      ) => {
        if (settled) {
          return;
        }

        settled = true;

        try {
          zip.close();
        } catch {}

        reject(error);
      };

      zip.on(
        "error",
        fail
      );

      zip.on(
        "end",
        () => {
          if (settled) {
            return;
          }

          settled = true;
          resolve();
        }
      );

      zip.on(
        "entry",
        async (entry) => {
          try {
            const entryName =
              normalizeEntryName(
                entry.fileName
              );

            /*
             * UNIX mode is stored in the high
             * 16 bits of externalFileAttributes.
             *
             * Reject symbolic links.
             */
            const mode =
              (
                entry.externalFileAttributes >>
                16
              ) & 0xffff;

            const fileType =
              mode & 0xf000;

            if (
              fileType === 0xa000
            ) {
              throw new UnsafeArchiveError(
                "Symbolic links are not allowed in source archives."
              );
            }

            const isDirectory =
              entryName.endsWith("/");

            const target =
              path.resolve(
                destination,
                entryName
              );

            const root =
              path.resolve(
                destination
              );

            if (
              target !== root &&
              !target.startsWith(
                root +
                  path.sep
              )
            ) {
              throw new UnsafeArchiveError(
                "Archive path traversal detected."
              );
            }

            if (isDirectory) {
              await fs.mkdir(
                target,
                {
                  recursive: true,
                }
              );

              zip.readEntry();
              return;
            }

            fileCount += 1;

            if (
              fileCount >
              MAX_FILES
            ) {
              throw new UnsafeArchiveError(
                `Archive exceeds the ${MAX_FILES} file limit.`
              );
            }

            extractedBytes +=
              entry.uncompressedSize;

            if (
              extractedBytes >
              MAX_EXTRACTED_BYTES
            ) {
              throw new UnsafeArchiveError(
                "Archive exceeds the 250 MB extracted-size limit."
              );
            }

            await fs.mkdir(
              path.dirname(
                target
              ),
              {
                recursive: true,
              }
            );

            zip.openReadStream(
              entry,
              async (
                error,
                stream
              ) => {
                if (
                  error ||
                  !stream
                ) {
                  fail(
                    error ??
                      new Error(
                        "Unable to read ZIP entry."
                      )
                  );

                  return;
                }

                try {
                  const handle =
                    await fs.open(
                      target,
                      "wx"
                    );

                  const output =
                    handle.createWriteStream();

                  stream.on(
                    "error",
                    fail
                  );

                  output.on(
                    "error",
                    fail
                  );

                  output.on(
                    "close",
                    () => {
                      zip.readEntry();
                    }
                  );

                  stream.pipe(
                    output
                  );
                } catch (writeError) {
                  fail(
                    writeError
                  );
                }
              }
            );
          } catch (error) {
            fail(error);
          }
        }
      );

      zip.readEntry();
    }
  );
}
