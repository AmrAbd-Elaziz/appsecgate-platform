import { NextResponse } from "next/server";

import type {
  Finding,
  FindingIntelligenceRecord,
  PersistedAssessment,
} from "../../../data/appsecgate";

import {
  listAssessments,
  listFindingLifecycles,
} from "../../../lib/server/store";

export async function GET() {
  const assessments = await listAssessments();
  const lifecycles =
    await listFindingLifecycles();

  /*
   * Build an index containing the newest known
   * representation of every finding for every asset.
   *
   * Lifecycle identity is:
   *   assetId + findingId
   */
  const latestFindingByKey = new Map<
    string,
    {
      finding: Finding;
      asset: PersistedAssessment["asset"];
      assessmentId: string;
      completedAt: string;
    }
  >();

  const orderedAssessments = [
    ...assessments,
  ].sort((a, b) =>
    (a.completedAt ?? a.startedAt).localeCompare(
      b.completedAt ?? b.startedAt
    )
  );

  for (const assessment of orderedAssessments) {
    for (const finding of assessment.findings) {
      const key =
        `${assessment.assetId}:${finding.id}`;

      latestFindingByKey.set(key, {
        finding,
        asset: assessment.asset,
        assessmentId: assessment.id,
        completedAt:
          assessment.completedAt ??
          assessment.startedAt,
      });
    }
  }

  const data: FindingIntelligenceRecord[] =
    lifecycles
      .map((lifecycle) => {
        const key =
          `${lifecycle.assetId}:${lifecycle.findingId}`;

        const latest =
          latestFindingByKey.get(key);

        if (!latest) {
          return null;
        }

        return {
          finding: latest.finding,
          lifecycle,
          asset: latest.asset,
          assessmentId: latest.assessmentId,
          completedAt: latest.completedAt,
        };
      })
      .filter(
        (
          record
        ): record is FindingIntelligenceRecord =>
          record !== null
      )
      .sort((a, b) => {
        /*
         * Open findings first, then newest activity.
         */
        if (
          a.lifecycle.status !==
          b.lifecycle.status
        ) {
          return a.lifecycle.status === "Open"
            ? -1
            : 1;
        }

        return b.lifecycle.lastSeenAt.localeCompare(
          a.lifecycle.lastSeenAt
        );
      });

  return NextResponse.json({
    data,
    count: data.length,

    summary: {
      open: data.filter(
        (record) =>
          record.lifecycle.status === "Open"
      ).length,

      closed: data.filter(
        (record) =>
          record.lifecycle.status === "Closed"
      ).length,

      critical: data.filter(
        (record) =>
          record.finding.severity === "CRITICAL"
      ).length,

      assets: new Set(
        data.map(
          (record) => record.asset.id
        )
      ).size,
    },
  });
}
