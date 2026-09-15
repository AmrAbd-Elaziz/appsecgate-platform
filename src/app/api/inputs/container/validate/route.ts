import {
  NextResponse,
} from "next/server";

import {
  runCommand,
} from "../../../../../lib/server/scanners/command-runner";

import {
  ScanProfileValidationError,
  validateScanProfile,
} from "../../../../../lib/server/scan-profile-validator";

export const runtime = "nodejs";

export async function POST(
  request: Request
) {
  try {
    const body =
      await request.json();

    const rawImage =
      typeof body?.containerImage ===
      "string"
        ? body.containerImage.trim()
        : "";

    if (!rawImage) {
      return NextResponse.json(
        {
          error:
            "Container image reference is required.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Reuse the exact validation policy used
     * when an asset is persisted.
     */
    const validated =
      validateScanProfile({
        containerImage:
          rawImage,
      });

    const image =
      validated.containerImage;

    if (!image) {
      return NextResponse.json(
        {
          error:
            "Container image reference is required.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Validation V1 deliberately checks the
     * local Docker image inventory only.
     *
     * It does not pull remote images as a
     * side effect of validation.
     */
    const inspected =
      await runCommand(
        "docker",
        [
          "image",
          "inspect",
          image,
          "--format",
          "{{.Id}}",
        ],
        {
          cwd:
            process.cwd(),

          timeoutMs:
            15_000,
        }
      );

    if (
      inspected.exitCode !== 0
    ) {
      return NextResponse.json(
        {
          error:
            "Container image is not available in the local Docker image inventory.",
          data: {
            containerImage:
              image,
            available:
              false,
          },
        },
        {
          status: 404,
        }
      );
    }

    const imageId =
      inspected.stdout.trim();

    return NextResponse.json(
      {
        data: {
          containerImage:
            image,
          available:
            true,
          imageId,
          scanner:
            "Trivy Container",
        },
      },
      {
        status: 200,
      }
    );
  } catch (error) {
    if (
      error instanceof
      ScanProfileValidationError
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
      "[AppSecGate] Container input validation failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to validate container image.",
      },
      {
        status: 500,
      }
    );
  }
}
