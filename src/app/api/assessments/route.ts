import { NextResponse } from "next/server";

import {
  executeAssessment,
  toAssessmentRun,
} from "../../../lib/server/assessment-engine";

import {
  getAssetById,
  listAssessments,
  saveAssessment,
} from "../../../lib/server/store";

export async function GET() {
  const assessments = await listAssessments();

  return NextResponse.json({
    data: assessments,
    count: assessments.length,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const assetId = Number(body.assetId);

    if (
      !Number.isInteger(assetId) ||
      assetId <= 0
    ) {
      return NextResponse.json(
        { error: "A valid assetId is required." },
        { status: 400 }
      );
    }

    const asset = await getAssetById(assetId);

    if (!asset) {
      return NextResponse.json(
        { error: "Asset not found." },
        { status: 404 }
      );
    }

    const assessment = executeAssessment(asset);

    await saveAssessment(assessment);

    return NextResponse.json(
      {
        data: assessment,
        run: toAssessmentRun(assessment),
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }
}
