import { NextResponse } from "next/server";

import type {
  ControlIntelligenceRecord,
  PersistedAssessment,
} from "../../../data/appsecgate";

import {
  listAssessments,
  listControlLifecycles,
  listFindingLifecycles,
} from "../../../lib/server/store";

export async function GET(request: Request) {
  const { searchParams } =
    new URL(request.url);

  const assessmentId =
    searchParams.get("assessmentId");
  const [
    assessments,
    controlLifecycles,
    findingLifecycles,
  ] = await Promise.all([
    listAssessments(),
    listControlLifecycles(),
    listFindingLifecycles(),
  ]);

  if (assessmentId) {
    const assessment = assessments.find(
      (item) => item.id === assessmentId
    );

    if (!assessment) {
      return NextResponse.json(
        { error: "Assessment not found." },
        { status: 404 }
      );
    }

    const records: ControlIntelligenceRecord[] =
      [];

    for (const control of assessment.controls) {
      const finding =
        assessment.findings.find(
          (item) =>
            item.id === control.findingId
        );

      const lifecycle =
        controlLifecycles.find(
          (item) =>
            item.assetId ===
              assessment.assetId &&
            item.findingId ===
              control.findingId
        );

      const findingLifecycle =
        findingLifecycles.find(
          (item) =>
            item.assetId ===
              assessment.assetId &&
            item.findingId ===
              control.findingId
        );

      if (
        !finding ||
        !lifecycle ||
        !findingLifecycle
      ) {
        continue;
      }

      records.push({
        control,
        lifecycle,
        finding,
        findingLifecycle,
        asset: assessment.asset,
        assessmentId: assessment.id,
        completedAt: assessment.completedAt,
      });
    }

    records.sort(
      (a, b) =>
        b.lifecycle.lastUpdatedAt.localeCompare(
          a.lifecycle.lastUpdatedAt
        )
    );

    return NextResponse.json({
      data: records,
      count: records.length,

      summary: {
        required: records.filter(
          (record) =>
            record.lifecycle.status ===
            "Required"
        ).length,

        implemented: records.filter(
          (record) =>
            record.lifecycle.status ===
            "Implemented"
        ).length,

        verified: records.filter(
          (record) =>
            record.lifecycle.status ===
            "Verified"
        ).length,

        critical: records.filter(
          (record) =>
            record.control.severity ===
            "CRITICAL"
        ).length,

        assets: new Set(
          records.map(
            (record) => record.asset.id
          )
        ).size,
      },
    });
  }

  /*
   * Keep the newest known representation of each
   * control/finding pair while lifecycle state remains
   * persistent across assessment runs.
   */
  const latestByFinding = new Map<
    string,
    {
      assessment: PersistedAssessment;
      controlIndex: number;
    }
  >();

  for (const assessment of assessments) {
    assessment.controls.forEach(
      (control, controlIndex) => {
        const key =
          `${assessment.assetId}:${control.findingId}`;

        if (!latestByFinding.has(key)) {
          latestByFinding.set(key, {
            assessment,
            controlIndex,
          });
        }
      }
    );
  }

  const records: ControlIntelligenceRecord[] = [];

  for (const lifecycle of controlLifecycles) {
    const key =
      `${lifecycle.assetId}:${lifecycle.findingId}`;

    const latest =
      latestByFinding.get(key);

    if (!latest) {
      continue;
    }

    const control =
      latest.assessment.controls[
        latest.controlIndex
      ];

    if (!control) {
      continue;
    }

    const finding =
      latest.assessment.findings.find(
        (item) =>
          item.id === lifecycle.findingId
      );

    if (!finding) {
      /*
       * A closed finding may be absent from the newest
       * assessment. Find its newest historical occurrence.
       */
      const historicalAssessment =
        assessments.find(
          (assessment) =>
            assessment.assetId ===
              lifecycle.assetId &&
            assessment.findings.some(
              (item) =>
                item.id ===
                lifecycle.findingId
            )
        );

      const historicalFinding =
        historicalAssessment?.findings.find(
          (item) =>
            item.id === lifecycle.findingId
        );

      if (!historicalFinding) {
        continue;
      }

      const findingLifecycle =
        findingLifecycles.find(
          (item) =>
            item.assetId ===
              lifecycle.assetId &&
            item.findingId ===
              lifecycle.findingId
        );

      if (!findingLifecycle) {
        continue;
      }

      records.push({
        control,
        lifecycle,
        finding: historicalFinding,
        findingLifecycle,
        asset: latest.assessment.asset,
        assessmentId:
          latest.assessment.id,
        completedAt:
          latest.assessment.completedAt,
      });

      continue;
    }

    const findingLifecycle =
      findingLifecycles.find(
        (item) =>
          item.assetId ===
            lifecycle.assetId &&
          item.findingId ===
            lifecycle.findingId
      );

    if (!findingLifecycle) {
      continue;
    }

    records.push({
      control,
      lifecycle,
      finding,
      findingLifecycle,
      asset: latest.assessment.asset,
      assessmentId:
        latest.assessment.id,
      completedAt:
        latest.assessment.completedAt,
    });
  }

  records.sort(
    (a, b) =>
      b.lifecycle.lastUpdatedAt.localeCompare(
        a.lifecycle.lastUpdatedAt
      )
  );

  return NextResponse.json({
    data: records,
    count: records.length,
    summary: {
      required: records.filter(
        (record) =>
          record.lifecycle.status ===
          "Required"
      ).length,

      implemented: records.filter(
        (record) =>
          record.lifecycle.status ===
          "Implemented"
      ).length,

      verified: records.filter(
        (record) =>
          record.lifecycle.status ===
          "Verified"
      ).length,

      critical: records.filter(
        (record) =>
          record.control.severity ===
          "CRITICAL"
      ).length,

      assets: new Set(
        records.map(
          (record) =>
            record.asset.id
        )
      ).size,
    },
  });
}
