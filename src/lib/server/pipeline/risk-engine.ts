import type {
  Asset,
  Finding,
  Severity,
} from "../../../data/appsecgate";

type RiskFactors = Finding["riskFactors"];

const severityScore: Record<Severity, number> = {
  CRITICAL: 40,
  HIGH: 30,
  MEDIUM: 20,
  LOW: 10,
};

const criticalityScore: Record<
  Asset["criticality"],
  number
> = {
  Critical: 20,
  High: 16,
  Medium: 10,
  Low: 5,
};

const environmentScore: Record<
  Asset["environment"],
  number
> = {
  Production: 15,
  Staging: 10,
  Development: 5,
};

function scannerCount(
  finding: Finding
): number {
  return new Set(
    finding.source
      .split(" + ")
      .map((value) => value.trim())
      .filter(Boolean)
  ).size;
}

function confidenceFor(
  finding: Finding,
  scanners: number
): Finding["confidence"] {
  if (
    scanners > 1 ||
    (
      finding.status === "Confirmed" &&
      (
        finding.category.includes("Secrets") ||
        finding.category.includes("SCA") ||
        finding.category.includes("Container") ||
        finding.category.includes("IaC")
      )
    )
  ) {
    return "High";
  }

  if (finding.status === "Confirmed") {
    return "Medium";
  }

  return "Low";
}

function confidenceScore(
  confidence: Finding["confidence"]
): number {
  switch (confidence) {
    case "High":
      return 15;

    case "Medium":
      return 10;

    default:
      return 5;
  }
}

function corroborationScore(
  scanners: number
): number {
  /*
   * Corroboration means independent scanner
   * agreement. A single scanner receives no
   * corroboration bonus.
   */
  if (scanners >= 3) {
    return 10;
  }

  if (scanners === 2) {
    return 8;
  }

  return 0;
}

function levelFor(
  score: number
): Finding["riskLevel"] {
  if (score >= 85) {
    return "Critical";
  }

  if (score >= 70) {
    return "High";
  }

  if (score >= 45) {
    return "Medium";
  }

  return "Low";
}

export function scoreFinding(
  finding: Finding,
  asset: Asset
): Finding {
  const scanners =
    scannerCount(finding);

  const confidence =
    confidenceFor(
      finding,
      scanners
    );

  const factors: RiskFactors = {
    technicalSeverity:
      severityScore[
        finding.severity
      ],

    assetCriticality:
      criticalityScore[
        asset.criticality
      ],

    environment:
      environmentScore[
        asset.environment
      ],

    confidence:
      confidenceScore(
        confidence
      ),

    corroboration:
      corroborationScore(
        scanners
      ),
  };

  const riskScore = Math.min(
    100,
    Object.values(
      factors
    ).reduce(
      (sum, value) =>
        sum + value,
      0
    )
  );

  return {
    ...finding,

    riskScore,

    riskLevel:
      levelFor(riskScore),

    confidence,

    scannerCount:
      scanners,

    riskFactors:
      factors,

    blocker: false,
  };
}

export function scoreFindings(
  findings: Finding[],
  asset: Asset
): Finding[] {
  return findings
    .map(
      (finding) =>
        scoreFinding(
          finding,
          asset
        )
    )
    .sort(
      (a, b) =>
        b.riskScore -
        a.riskScore
    );
}
