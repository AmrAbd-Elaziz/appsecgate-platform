import {
  NextResponse,
} from "next/server";

import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";

import {
  createSourceWorkspace,
  discoverWorkspace,
  ensureWorkspaceRoot,
  removeWorkspace,
} from "../../../../lib/server/workspaces/workspace";

import {
  extractZipSafely,
  UnsafeArchiveError,
} from "../../../../lib/server/workspaces/safe-zip";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES =
  50 * 1024 * 1024;

function createWorkspaceId() {
  return (
    "WS-" +
    Date.now()
      .toString(36)
      .toUpperCase() +
    "-" +
    crypto
      .randomBytes(4)
      .toString("hex")
      .toUpperCase()
  );
}

export async function POST(
  request: Request
) {
  let workspaceId:
    | string
    | undefined;

  let temporaryFile:
    | string
    | undefined;

  try {
    const formData =
      await request.formData();

    const uploaded =
      formData.get("file");

    if (
      !(uploaded instanceof File)
    ) {
      return NextResponse.json(
        {
          error:
            "A source ZIP file is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      uploaded.size <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Uploaded file is empty.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      uploaded.size >
      MAX_UPLOAD_BYTES
    ) {
      return NextResponse.json(
        {
          error:
            "Source archive exceeds the 50 MB upload limit.",
        },
        {
          status: 413,
        }
      );
    }

    const extension =
      path
        .extname(uploaded.name)
        .toLowerCase();

    if (
      extension !== ".zip"
    ) {
      return NextResponse.json(
        {
          error:
            "Only ZIP source archives are supported in this version.",
        },
        {
          status: 415,
        }
      );
    }

    /*
     * Basic magic-byte validation.
     *
     * Extension alone must not decide
     * whether the upload is treated as ZIP.
     */
    const buffer =
      Buffer.from(
        await uploaded.arrayBuffer()
      );

    const zipSignature =
      buffer.length >= 4 &&
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      (
        (
          buffer[2] === 0x03 &&
          buffer[3] === 0x04
        ) ||
        (
          buffer[2] === 0x05 &&
          buffer[3] === 0x06
        ) ||
        (
          buffer[2] === 0x07 &&
          buffer[3] === 0x08
        )
      );

    if (!zipSignature) {
      return NextResponse.json(
        {
          error:
            "Uploaded file is not a valid ZIP archive.",
        },
        {
          status: 415,
        }
      );
    }

    await ensureWorkspaceRoot();

    workspaceId =
      createWorkspaceId();

    const sourcePath =
      await createSourceWorkspace(
        workspaceId
      );

    const uploadDirectory =
      path.join(
        path.dirname(
          sourcePath
        ),
        "uploads"
      );

    await fs.mkdir(
      uploadDirectory,
      {
        recursive: true,
      }
    );

    temporaryFile =
      path.join(
        uploadDirectory,
        "source.zip"
      );

    await fs.writeFile(
      temporaryFile,
      buffer
    );

    await extractZipSafely(
      temporaryFile,
      sourcePath
    );

    /*
     * The archive is no longer needed after
     * extraction. Scanners operate on source/.
     */
    await fs.rm(
      temporaryFile,
      {
        force: true,
      }
    );

    temporaryFile =
      undefined;

    const discovery =
      await discoverWorkspace(
        sourcePath
      );

    return NextResponse.json(
      {
        data: {
          workspaceId,
          originalName:
            uploaded.name,
          uploadSize:
            uploaded.size,
          sourcePath,
          discovery,
        },
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    if (
      temporaryFile
    ) {
      await fs.rm(
        temporaryFile,
        {
          force: true,
        }
      ).catch(() => {});
    }

    if (
      workspaceId
    ) {
      await removeWorkspace(
        workspaceId
      ).catch(() => {});
    }

    if (
      error instanceof
      UnsafeArchiveError
    ) {
      return NextResponse.json(
        {
          error:
            error.message,
        },
        {
          status: 400,
        }
      );
    }

    /*
     * yauzl performs its own filename validation
     * before some entries reach our extractor.
     *
     * Treat rejected unsafe archive paths as a
     * client-side archive validation error rather
     * than an internal server failure.
     */
    if (
      error instanceof Error &&
      (
        error.message.includes(
          "invalid relative path"
        ) ||
        error.message.includes(
          "absolute path"
        )
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Archive contains an unsafe path.",
        },
        {
          status: 400,
        }
      );
    }

    console.error(
      "[AppSecGate] Source upload failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to process source archive.",
      },
      {
        status: 500,
      }
    );
  }
}
