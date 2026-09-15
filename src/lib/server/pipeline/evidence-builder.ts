import { createHash } from "node:crypto";

import type {
  EvidenceRecord,
  Finding,
  SecurityControl,
} from "../../../data/appsecgate";

function evidenceId(
  findingId: string
): string {
  const digest =
    createHash("sha256")
      .update(findingId)
      .digest("hex")
      .slice(0, 8)
      .toUpperCase();

  return `EVD-${digest}`;
}

export function buildEvidence(
  findings: Finding[],
  controls: SecurityControl[]
): EvidenceRecord[] {
  const controlByFinding =
    new Map(
      controls.map(
        (control) => [
          control.findingId,
          control,
        ]
      )
    );

  return findings.map(
    (finding) => {
      const control =
        controlByFinding.get(
          finding.id
        );

      if (!control) {
        throw new Error(
          `Missing control for finding ${finding.id}`
        );
      }

      return {
        id:
          evidenceId(
            finding.id
          ),

        runId:
          finding.runId,

        assetId:
          finding.assetId,

        findingId:
          finding.id,

        controlId:
          control.id,

        title:
          `${finding.source} scanner evidence`,

        type:
          "Scanner Output",

        source:
          finding.source,

        status:
          "Verified",

        integrity:
          "Scanner result persisted with assessment",
      };
    }
  );
}
