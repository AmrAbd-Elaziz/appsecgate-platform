import { NextResponse } from "next/server";

import {
  listRemediationProofs,
  saveRemediationProof,
} from "../../../../../../lib/server/store";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(
  _request: Request,
  context: RouteContext
) {
  const { id } =
    await context.params;

  const proofs =
    await listRemediationProofs();

  const proof =
    proofs.find(
      (item) => item.id === id
    );

  if (!proof) {
    return NextResponse.json(
      {
        error:
          "Remediation proof not found.",
      },
      { status: 404 }
    );
  }

  if (
    proof.status === "Verified"
  ) {
    return NextResponse.json({
      data: proof,
    });
  }

  const verifiedAt =
    new Date().toISOString();

  const verified = {
    ...proof,
    status:
      "Verified" as const,
    verifiedAt,
    integrity:
      "Remediation proof reviewed and verified",
  };

  await saveRemediationProof(
    verified
  );

  return NextResponse.json({
    data: verified,
  });
}
