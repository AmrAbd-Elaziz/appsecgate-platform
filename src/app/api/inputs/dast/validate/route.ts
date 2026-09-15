import {
  NextResponse,
} from "next/server";

import {
  DastTargetPolicyError,
  validateDastTarget,
} from "../../../../../lib/server/dast-target-policy";

export const runtime = "nodejs";

export async function POST(
  request: Request
) {
  try {
    const body =
      await request.json();

    if (
      !body ||
      typeof body.dastUrl !==
        "string"
    ) {
      return NextResponse.json(
        {
          error:
            "dastUrl is required.",
        },
        {
          status: 400,
        }
      );
    }

    const validated =
      await validateDastTarget(
        body.dastUrl
      );

    return NextResponse.json({
      data: {
        ...validated,
        scanner:
          "OWASP ZAP",
        validated: true,
      },
    });
  } catch (error) {
    if (
      error instanceof
      DastTargetPolicyError
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
      "[AppSecGate] DAST target validation failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to validate DAST target.",
      },
      {
        status: 500,
      }
    );
  }
}
