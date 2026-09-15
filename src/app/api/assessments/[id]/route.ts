import { NextResponse } from "next/server";

import { toAssessmentRun } from "../../../../lib/server/assessment-engine";
import { getAssessmentById } from "../../../../lib/server/store";

type Context = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  _request: Request,
  context: Context
) {
  const { id } = await context.params;

  const assessment = await getAssessmentById(id);

  if (!assessment) {
    return NextResponse.json(
      { error: "Assessment not found." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    data: assessment,
    run: toAssessmentRun(assessment),
  });
}
