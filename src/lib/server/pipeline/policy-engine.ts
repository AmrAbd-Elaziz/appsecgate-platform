import type {
  Asset,
  Finding,
} from "../../../data/appsecgate";

export type PolicyDecision = {
  decision: "PASS" | "BLOCK";
  blockers: string[];
};

function isReleaseBlocker(
  finding: Finding,
  asset: Asset
): boolean {
  /*
   * Extremely high contextual risk always blocks.
   */
  if (
    finding.riskScore >= 90 &&
    finding.status === "Confirmed"
  ) {
    return true;
  }

  /*
   * Critical production assets receive a stricter
   * release threshold.
   */
  if (
    asset.environment === "Production" &&
    asset.criticality === "Critical" &&
    finding.riskScore >= 80 &&
    finding.status === "Confirmed"
  ) {
    return true;
  }

  /*
   * Exposed secrets remain explicit release gates
   * on production systems.
   */
  if (
    asset.environment === "Production" &&
    finding.category.includes("Secrets") &&
    finding.status === "Confirmed"
  ) {
    return true;
  }

  return false;
}

export function evaluatePolicy(
  findings: Finding[],
  asset: Asset
): PolicyDecision {
  const blockers =
    findings.filter(
      (finding) =>
        isReleaseBlocker(
          finding,
          asset
        )
    );

  /*
   * Keep Finding.blocker synchronized with the
   * policy decision consumed by the UI.
   */
  for (const finding of findings) {
    finding.blocker =
      blockers.some(
        (blocker) =>
          blocker.id ===
          finding.id
      );
  }

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
