import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import type {
  RemediationProof,
} from "../../../../data/appsecgate";

import {
  listControlLifecycles,
  listRemediationProofs,
  saveRemediationProof,
} from "../../../../lib/server/store";

function proofId(
  findingId: string,
  createdAt: string
): string {
  const digest =
    createHash("sha256")
      .update(
        `${findingId}:${createdAt}`
      )
      .digest("hex")
      .slice(0, 8)
      .toUpperCase();

  return `REM-${digest}`;
}

export async function GET() {
  const proofs =
    await listRemediationProofs();

  return NextResponse.json({
    data: proofs,
    count: proofs.length,
    summary: {
      pending: proofs.filter(
        (proof) =>
          proof.status ===
          "Pending Review"
      ).length,

      verified: proofs.filter(
        (proof) =>
          proof.status ===
          "Verified"
      ).length,
    },
  });
}

export async function POST(
  request: Request
) {
  try {
    const body =
      (await request.json()) as {
        findingId?: unknown;
        description?: unknown;
      };

    const findingId =
      typeof body.findingId ===
      "string"
        ? body.findingId.trim()
        : "";

    const description =
      typeof body.description ===
      "string"
        ? body.description.trim()
        : "";

    if (!findingId) {
      return NextResponse.json(
        {
          error:
            "findingId is required.",
        },
        { status: 400 }
      );
    }

    if (
      description.length < 10 ||
      description.length > 2000
    ) {
      return NextResponse.json(
        {
          error:
            "description must be between 10 and 2000 characters.",
        },
        { status: 400 }
      );
    }

    const controls =
      await listControlLifecycles();

    const lifecycle =
      controls.find(
        (item) =>
          item.findingId === findingId
      );

    if (!lifecycle) {
      return NextResponse.json(
        {
          error:
            "No control lifecycle exists for this finding.",
        },
        { status: 404 }
      );
    }

    if (
      lifecycle.status !== "Required"
    ) {
      return NextResponse.json(
        {
          error:
            `Remediation proof can only be submitted for a Required control. Current status: ${lifecycle.status}.`,
        },
        { status: 409 }
      );
    }

    const existing =
      await listRemediationProofs(
        lifecycle.assetId
      );

    const activeProof =
      existing.find(
        (proof) =>
          proof.findingId ===
            lifecycle.findingId &&
          proof.controlId ===
            lifecycle.controlId &&
          proof.status ===
            "Pending Review"
      );

    if (activeProof) {
      return NextResponse.json(
        {
          error:
            "A remediation proof is already pending review for this finding.",
          data: activeProof,
        },
        { status: 409 }
      );
    }

    const createdAt =
      new Date().toISOString();

    const proof: RemediationProof = {
      id: proofId(
        findingId,
        createdAt
      ),

      assetId:
        lifecycle.assetId,

      findingId:
        lifecycle.findingId,

      controlId:
        lifecycle.controlId,

      type:
        "Remediation Proof",

      source:
        "Security Engineering",

      status:
        "Pending Review",

      title:
        "Remediation proof",

      description,

      integrity:
        "Remediation statement persisted for verification",

      createdAt,
    };

    await saveRemediationProof(
      proof
    );

    return NextResponse.json(
      {
        data: proof,
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Invalid remediation proof request.",
      },
      { status: 400 }
    );
  }
}
