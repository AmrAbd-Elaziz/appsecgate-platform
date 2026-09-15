import {
  NextResponse,
} from "next/server";

import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";

import {
  ensureWorkspaceRoot,
  getAssetWorkspace,
  removeWorkspace,
} from "../../../../lib/server/workspaces/workspace";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES =
  5 * 1024 * 1024;

class OpenApiValidationError
  extends Error {
  constructor(message: string) {
    super(message);
    this.name =
      "OpenApiValidationError";
  }
}

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

function detectOpenApiDocument(
  text: string
): {
  specification:
    | "OpenAPI"
    | "Swagger";
  version: string;
} {
  const trimmed =
    text.trim();

  if (!trimmed) {
    throw new OpenApiValidationError(
      "OpenAPI definition is empty."
    );
  }

  /*
   * JSON gets structural validation.
   */
  if (
    trimmed.startsWith("{")
  ) {
    let parsed: unknown;

    try {
      parsed =
        JSON.parse(trimmed);
    } catch {
      throw new OpenApiValidationError(
        "OpenAPI JSON is invalid."
      );
    }

    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      throw new OpenApiValidationError(
        "OpenAPI JSON must contain an object document."
      );
    }

    const document =
      parsed as Record<
        string,
        unknown
      >;

    if (
      typeof document.openapi ===
        "string"
    ) {
      return {
        specification:
          "OpenAPI",
        version:
          document.openapi,
      };
    }

    if (
      typeof document.swagger ===
        "string"
    ) {
      return {
        specification:
          "Swagger",
        version:
          document.swagger,
      };
    }

    throw new OpenApiValidationError(
      "JSON document is not an OpenAPI or Swagger definition."
    );
  }

  /*
   * YAML validation is intentionally conservative
   * for V1 and does not execute YAML tags or load
   * arbitrary objects.
   *
   * We only accept a top-level OpenAPI/Swagger
   * version declaration.
   */
  const lines =
    text.split(/\r?\n/);

  for (const line of lines) {
    const normalized =
      line.trim();

    if (
      !normalized ||
      normalized.startsWith("#")
    ) {
      continue;
    }

    const openApiMatch =
      normalized.match(
        /^openapi\s*:\s*["']?([^"'#\s]+)["']?/i
      );

    if (openApiMatch) {
      return {
        specification:
          "OpenAPI",
        version:
          openApiMatch[1],
      };
    }

    const swaggerMatch =
      normalized.match(
        /^swagger\s*:\s*["']?([^"'#\s]+)["']?/i
      );

    if (swaggerMatch) {
      return {
        specification:
          "Swagger",
        version:
          swaggerMatch[1],
      };
    }

    /*
     * Version declaration should be a
     * top-level document key, not buried
     * inside another YAML object.
     */
    if (
      line.length > 0 &&
      /^\s/.test(line)
    ) {
      continue;
    }

    /*
     * Allow common YAML document marker.
     */
    if (
      normalized === "---"
    ) {
      continue;
    }

    break;
  }

  throw new OpenApiValidationError(
    "YAML document is not an OpenAPI or Swagger definition."
  );
}

export async function POST(
  request: Request
) {
  let workspaceId:
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
            "An OpenAPI JSON or YAML file is required.",
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
            "Uploaded OpenAPI definition is empty.",
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
            "OpenAPI definition exceeds the 5 MB upload limit.",
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
      ![
        ".json",
        ".yaml",
        ".yml",
      ].includes(extension)
    ) {
      return NextResponse.json(
        {
          error:
            "Only OpenAPI JSON, YAML, and YML files are supported.",
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

    /*
     * Reject binary/null-byte content.
     */
    if (
      buffer.includes(0)
    ) {
      throw new OpenApiValidationError(
        "OpenAPI definition must be a text document."
      );
    }

    const text =
      buffer.toString("utf8");

    const metadata =
      detectOpenApiDocument(
        text
      );

    await ensureWorkspaceRoot();

    workspaceId =
      createWorkspaceId();

    const workspace =
      getAssetWorkspace(
        workspaceId
      );

    const openApiDirectory =
      path.join(
        workspace,
        "openapi"
      );

    await fs.mkdir(
      openApiDirectory,
      {
        recursive: true,
      }
    );

    /*
     * Use a controlled server-side filename.
     * The client filename is metadata only.
     */
    const storedExtension =
      extension === ".json"
        ? ".json"
        : ".yaml";

    const dastOpenApiPath =
      path.join(
        openApiDirectory,
        `openapi${storedExtension}`
      );

    await fs.writeFile(
      dastOpenApiPath,
      buffer,
      {
        flag: "wx",
      }
    );

    return NextResponse.json(
      {
        data: {
          workspaceId,
          originalName:
            uploaded.name,
          uploadSize:
            uploaded.size,
          dastOpenApiPath,
          specification:
            metadata.specification,
          version:
            metadata.version,
          format:
            storedExtension ===
            ".json"
              ? "json"
              : "yaml",
          scanner:
            "OWASP ZAP API",
        },
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    if (workspaceId) {
      await removeWorkspace(
        workspaceId
      ).catch(() => {});
    }

    if (
      error instanceof
      OpenApiValidationError
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

    console.error(
      "[AppSecGate] OpenAPI upload failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to process OpenAPI definition.",
      },
      {
        status: 500,
      }
    );
  }
}
