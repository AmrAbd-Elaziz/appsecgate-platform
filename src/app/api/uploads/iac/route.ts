import {
  NextResponse,
} from "next/server";

import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";

import {
  discoverWorkspace,
  ensureWorkspaceRoot,
  getAssetWorkspace,
  removeWorkspace,
} from "../../../../lib/server/workspaces/workspace";

import {
  extractZipSafely,
  UnsafeArchiveError,
} from "../../../../lib/server/workspaces/safe-zip";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES =
  25 * 1024 * 1024;

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

function isZip(
  buffer: Buffer
) {
  return (
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
    )
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
            "An IaC ZIP archive is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (uploaded.size <= 0) {
      return NextResponse.json(
        {
          error:
            "Uploaded IaC archive is empty.",
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
            "IaC archive exceeds the 25 MB upload limit.",
        },
        {
          status: 413,
        }
      );
    }

    if (
      path
        .extname(uploaded.name)
        .toLowerCase() !== ".zip"
    ) {
      return NextResponse.json(
        {
          error:
            "Only ZIP IaC archives are supported.",
        },
        {
          status: 415,
        }
      );
    }

    const buffer =
      Buffer.from(
        await uploaded.arrayBuffer()
      );

    if (!isZip(buffer)) {
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

    const workspace =
      getAssetWorkspace(
        workspaceId
      );

    const iacPath =
      path.join(
        workspace,
        "iac"
      );

    const uploadDirectory =
      path.join(
        workspace,
        "uploads"
      );

    await fs.mkdir(
      iacPath,
      {
        recursive: true,
      }
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
        "iac.zip"
      );

    await fs.writeFile(
      temporaryFile,
      buffer
    );

    await extractZipSafely(
      temporaryFile,
      iacPath
    );

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
        iacPath
      );

    /*
     * A dedicated IaC upload must actually
     * contain IaC material. This prevents
     * arbitrary ZIPs from being accepted as
     * infrastructure assessment input.
     */
    if (!discovery.iacDetected) {
      throw new UnsafeArchiveError(
        "No supported IaC files were detected in the archive."
      );
    }

    return NextResponse.json(
      {
        data: {
          workspaceId,
          originalName:
            uploaded.name,
          uploadSize:
            uploaded.size,
          iacPath,
          discovery,
        },
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    if (temporaryFile) {
      await fs.rm(
        temporaryFile,
        {
          force: true,
        }
      ).catch(() => {});
    }

    if (workspaceId) {
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
      "[AppSecGate] IaC upload failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to process IaC archive.",
      },
      {
        status: 500,
      }
    );
  }
}
