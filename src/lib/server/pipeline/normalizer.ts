import type {
  AssessmentRun,
  Finding,
  Severity,
} from "../../../data/appsecgate";

import type {
  RawFinding,
} from "../scanners/types";

const severityRank: Record<Severity, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

function highestSeverity(
  findings: RawFinding[]
): Severity {
  return findings.reduce<Severity>(
    (highest, finding) =>
      severityRank[finding.severity] >
      severityRank[highest]
        ? finding.severity
        : highest,
    "LOW"
  );
}

function findingIdForFingerprint(
  fingerprint: string
): string {
  const ids: Record<string, string> = {
    "hardcoded-application-secret": "ASG-1042",
    "sql-injection-user-search": "ASG-1038",
    "vulnerable-openssl-base-image": "ASG-1029",
    "s3-public-access-block-missing": "ASG-1017",
  };

  return ids[fingerprint] ?? `ASG-${fingerprint}`;
}

function controlIdForFingerprint(
  fingerprint: string
): string {
  const ids: Record<string, string> = {
    "hardcoded-application-secret": "CTRL-001",
    "sql-injection-user-search": "CTRL-002",
    "vulnerable-openssl-base-image": "CTRL-003",
    "s3-public-access-block-missing": "CTRL-004",
  };

  return ids[fingerprint] ?? "CTRL-UNMAPPED";
}

function canonicalDescription(
  fingerprint: string,
  fallback: string
): string {
  const descriptions: Record<string, string> = {
    "hardcoded-application-secret":
      "A hardcoded application secret was identified in source code and validated as reachable by the application.",

    "sql-injection-user-search":
      "Static and dynamic analysis signals were correlated to confirm an injectable user-controlled query path.",

    "vulnerable-openssl-base-image":
      "The deployed dependency set includes a vulnerable OpenSSL package requiring remediation.",

    "s3-public-access-block-missing":
      "Infrastructure-as-code configuration does not enforce the expected public access block control.",
  };

  return descriptions[fingerprint] ?? fallback;
}

export function normalizeAndCorrelate(
  run: AssessmentRun,
  rawFindings: RawFinding[]
): Finding[] {
  const groups = new Map<string, RawFinding[]>();

  for (const finding of rawFindings) {
    const current =
      groups.get(finding.fingerprint) ?? [];

    current.push(finding);
    groups.set(finding.fingerprint, current);
  }

  return Array.from(groups.entries()).map(
    ([fingerprint, correlated]) => {
      const primary = correlated[0];
      const severity = highestSeverity(correlated);

      const scanners = Array.from(
        new Set(
          correlated.map((finding) => finding.scanner)
        )
      );

      const categories = Array.from(
        new Set(
          correlated.map((finding) => finding.category)
        )
      );

      const confirmed =
        correlated.length > 1 ||
        primary.category === "Secrets";

      return {
        id: findingIdForFingerprint(fingerprint),
        runId: run.id,
        assetId: run.asset.id,
        title: primary.title,
        source: scanners.join(" + "),
        category: categories.join(" / "),
        severity,
        status: confirmed
          ? "Confirmed"
          : "Validated",
        blocker:
          severity === "CRITICAL" && confirmed,
        description: canonicalDescription(
          fingerprint,
          primary.description
        ),
        controlId:
          controlIdForFingerprint(fingerprint),
      };
    }
  );
}
