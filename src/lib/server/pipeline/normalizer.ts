import { createHash } from "node:crypto";

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

function stableId(
  prefix: string,
  value: string
): string {
  const digest = createHash("sha256")
    .update(value)
    .digest("hex")
    .slice(0, 8)
    .toUpperCase();

  return `${prefix}-${digest}`;
}

function normalizeCwe(
  cwe?: string
): string | undefined {
  if (!cwe) {
    return undefined;
  }

  const match =
    cwe.toUpperCase().match(
      /CWE[-\s:]?(\d+)/
    );

  return match
    ? `CWE-${match[1]}`
    : undefined;
}

function extractCve(
  finding: RawFinding
): string | undefined {
  const text = [
    finding.title,
    finding.description,
    finding.fingerprint,
  ].join(" ");

  return text
    .toUpperCase()
    .match(
      /CVE-\d{4}-\d{4,}/
    )?.[0];
}

function normalizedLocation(
  location?: string
): string {
  if (!location) {
    return "unknown";
  }

  return location
    .toLowerCase()
    .replace(
      /^https?:\/\/[^/]+/i,
      ""
    )
    .replace(
      /:\d+(?=$|\s|\[)/g,
      ""
    )
    .trim();
}

function correlationKey(
  finding: RawFinding
): string {
  const cve = extractCve(finding);

  /*
   * CVE is the strongest correlation signal
   * for dependency/container vulnerabilities.
   */
  if (cve) {
    return `CVE:${cve}`;
  }

  const cwe =
    normalizeCwe(
      finding.cwe
    );

  /*
   * For application findings, correlate the
   * same weakness at the same logical location.
   */
  if (
    cwe &&
    (
      finding.category === "SAST" ||
      finding.category === "DAST"
    )
  ) {
    return [
      "CWE",
      cwe,
      normalizedLocation(
        finding.location
      ),
    ].join(":");
  }

  /*
   * Secrets should remain tied to their source
   * location to avoid merging unrelated secrets.
   */
  if (finding.category === "Secrets") {
    return [
      "SECRET",
      normalizedLocation(
        finding.location
      ),
    ].join(":");
  }

  /*
   * IaC findings are policy/resource specific.
   */
  if (finding.category === "IaC") {
    return [
      "IAC",
      finding.fingerprint,
    ].join(":");
  }

  return [
    "FP",
    finding.fingerprint,
  ].join(":");
}

function controlIdFor(
  finding: RawFinding
): string {
  const cwe =
    normalizeCwe(
      finding.cwe
    );

  if (finding.category === "Secrets") {
    return "CTRL-SECRETS";
  }

  /*
   * CWE-89 is an application SQL injection weakness.
   * Do not classify dependency/container CVEs as
   * input-validation findings merely because a
   * package or title contains the word "sql".
   */
  if (
    cwe === "CWE-89" &&
    (
      finding.category === "SAST" ||
      finding.category === "DAST"
    )
  ) {
    return "CTRL-INPUT";
  }

  if (finding.category === "SAST") {
    return "CTRL-SAST";
  }

  if (finding.category === "DAST") {
    return "CTRL-WEB";
  }

  if (finding.category === "SCA") {
    return "CTRL-DEPENDENCY";
  }

  if (finding.category === "Container") {
    return "CTRL-CONTAINER";
  }

  if (finding.category === "IaC") {
    return "CTRL-IAC";
  }

  return "CTRL-GENERAL";
}

function confirmedFinding(
  correlated: RawFinding[]
): boolean {
  const scanners = new Set(
    correlated.map(
      (finding) =>
        finding.scanner
    )
  );

  const primary =
    correlated[0];

  /*
   * Strong deterministic findings can be
   * confirmed from a single specialist scanner.
   */
  if (
    primary.category === "Secrets" ||
    primary.category === "SCA" ||
    primary.category === "Container" ||
    primary.category === "IaC"
  ) {
    return true;
  }

  /*
   * Application weaknesses gain confirmation
   * when independent scanners corroborate them.
   */
  return scanners.size > 1;
}

export function normalizeAndCorrelate(
  run: AssessmentRun,
  rawFindings: RawFinding[]
): Finding[] {
  const groups =
    new Map<
      string,
      RawFinding[]
    >();

  for (const finding of rawFindings) {
    const key =
      correlationKey(finding);

    const current =
      groups.get(key) ?? [];

    current.push(finding);

    groups.set(
      key,
      current
    );
  }

  return Array.from(
    groups.entries()
  )
    .map(
      ([key, correlated]) => {
        const primary =
          correlated[0];

        const severity =
          highestSeverity(
            correlated
          );

        const scanners =
          Array.from(
            new Set(
              correlated.map(
                (finding) =>
                  finding.scanner
              )
            )
          );

        const categories =
          Array.from(
            new Set(
              correlated.map(
                (finding) =>
                  finding.category
              )
            )
          );

        const confirmed =
          confirmedFinding(
            correlated
          );

        const cve =
          correlated
            .map(extractCve)
            .find(Boolean);

        const cwe =
          correlated
            .map(
              (finding) =>
                normalizeCwe(
                  finding.cwe
                )
            )
            .find(Boolean);

        const context = [
          cve,
          cwe,
          correlated.length > 1
            ? `${correlated.length} correlated scanner records`
            : undefined,
          scanners.length > 1
            ? `${scanners.length} independent scanners`
            : undefined,
        ]
          .filter(Boolean)
          .join(" · ");

        return {
          id: stableId(
            "ASG",
            key
          ),

          runId: run.id,
          assetId: run.asset.id,

          title:
            cve
              ? `${cve}: ${primary.title}`
              : primary.title,

          source:
            scanners.join(" + "),

          category:
            categories.join(" / "),

          severity,

          status:
            confirmed
              ? "Confirmed"
              : "Validated",

          blocker:
            severity === "CRITICAL" &&
            confirmed,

          description:
            context
              ? `${primary.description} Intelligence: ${context}.`
              : primary.description,

          controlId:
            controlIdFor(
              primary
            ),

          /*
           * Risk intelligence is calculated in the
           * dedicated scoring stage immediately after
           * correlation.
           */
          riskScore: 0,
          riskLevel: "Low",
          confidence: "Low",
          scannerCount: 1,

          riskFactors: {
            technicalSeverity: 0,
            assetCriticality: 0,
            environment: 0,
            confidence: 0,
            corroboration: 0,
          },
        } satisfies Finding;
      }
    )
    .sort(
      (a, b) =>
        severityRank[b.severity] -
        severityRank[a.severity]
    );
}
