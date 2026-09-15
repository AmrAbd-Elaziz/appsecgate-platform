import type {
  Finding,
} from "../../../data/appsecgate";

export type PolicyDecision = {
  decision: "PASS" | "BLOCK";
  blockers: string[];
};

export function evaluatePolicy(
  findings: Finding[]
): PolicyDecision {
  const blockers =
    findings.filter(
      (finding) =>
        finding.blocker &&
        finding.status ===
          "Confirmed"
    );

  return {
    decision:
      blockers.length > 0
        ? "BLOCK"
        : "PASS",

    blockers:
      blockers.map(
        (finding) =>
          finding.id
      ),
  };
}
