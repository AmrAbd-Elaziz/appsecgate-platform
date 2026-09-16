import { createHash } from "node:crypto";

import type {
  EvidenceLocation,
  EvidenceRecord,
  Finding,
  SecurityControl,
} from "../../../data/appsecgate";

import type {
  RawFinding,
} from "../scanners/types";

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

function normalizePath(
  value: string
): string {
  return value
    .replace(/^\/src\//, "")
    .replace(/^\/workspace\//, "");
}

function parseLocation(
  rawFinding: RawFinding | undefined
): EvidenceLocation | undefined {
  if (
    !rawFinding ||
    !rawFinding.location
  ) {
    return undefined;
  }

  const raw = rawFinding.location.trim();
  const scanner = rawFinding.scanner;

  if (
    scanner === "Gitleaks" ||
    scanner === "Semgrep"
  ) {
    const match =
      raw.match(/^(.*):(\d+)$/);

    if (match) {
      return {
        raw,
        kind: "Source Code",
        file: normalizePath(match[1]),
        line: Number(match[2]),
      };
    }

    return {
      raw,
      kind: "Source Code",
      file: normalizePath(raw),
    };
  }

  if (scanner === "Trivy FS") {
    const match =
      raw.match(
        /^(.*):([^:@]+)@(.+)$/
      );

    if (match) {
      return {
        raw,
        kind: "Dependency",
        file: normalizePath(match[1]),
        package: match[2],
        version: match[3],
      };
    }

    return {
      raw,
      kind: "Dependency",
    };
  }

  if (
    scanner === "Trivy Image" ||
    scanner === "Trivy Container"
  ) {
    /*
     * Preserve the package identity reported by Trivy.
     *
     * Example:
     * /scan/image.tar (debian 12.7):libssl3@3.0.14-1~deb12u2
     */
    const match =
      raw.match(
        /^(.*):([^:@]+)@(.+)$/
      );

    if (match) {
      return {
        raw,
        kind: "Container",
        file: normalizePath(match[1]),
        package: match[2],
        version: match[3],
      };
    }

    return {
      raw,
      kind: "Container",
    };
  }

  if (scanner === "Checkov") {
    const separator =
      raw.lastIndexOf(":");

    if (separator > 0) {
      return {
        raw,
        kind: "Infrastructure as Code",
        file: normalizePath(
          raw.slice(0, separator)
        ),
        resource:
          raw.slice(separator + 1),
      };
    }

    return {
      raw,
      kind: "Infrastructure as Code",
      file: normalizePath(raw),
    };
  }

  if (scanner === "OWASP ZAP") {
    const parameterMatch =
      raw.match(
        /^(https?:\/\/.+?)\s+\[(.+)\]$/
      );

    if (parameterMatch) {
      return {
        raw,
        kind: "Web Endpoint",
        url: parameterMatch[1],
        parameter: parameterMatch[2],
      };
    }

    return {
      raw,
      kind: "Web Endpoint",
      url: raw,
    };
  }

  return {
    raw,
    kind: "Unknown",
  };
}

function rawFindingFor(
  finding: Finding,
  rawFindings: RawFinding[]
): RawFinding | undefined {
  const sources =
    finding.source
      .split("+")
      .map((value) => value.trim());

  const candidates =
    rawFindings.filter(
      (rawFinding) =>
        sources.includes(
          rawFinding.scanner
        )
    );

  if (candidates.length === 0) {
    return undefined;
  }

  /*
   * CVE findings are normalized using:
   *
   *   CVE:<CVE>:<component>
   *
   * Reconstruct that identity from each raw scanner
   * fingerprint so evidence provenance stays attached
   * to the exact package/component that produced the
   * normalized finding.
   */
  for (const rawFinding of candidates) {
    const parts =
      rawFinding.fingerprint
        .split(":")
        .map((part) => part.trim());

    const cveIndex =
      parts.findIndex(
        (part) =>
          /^CVE-\d{4}-\d+$/i.test(part)
      );

    if (cveIndex < 0) {
      continue;
    }

    const cve =
      parts[cveIndex]
        .toUpperCase();

    const component =
      parts[cveIndex + 1]
        ?.toLowerCase();

    if (!component) {
      continue;
    }

    const correlationKey =
      [
        "CVE",
        cve,
        component,
      ].join(":");

    const digest =
      createHash("sha256")
        .update(correlationKey)
        .digest("hex")
        .slice(0, 8)
        .toUpperCase();

    if (
      `ASG-${digest}` ===
      finding.id
    ) {
      return rawFinding;
    }
  }

  /*
   * Non-CVE findings retain the existing
   * CWE/title fallback.
   */
  return (
    candidates.find(
      (rawFinding) =>
        Boolean(rawFinding.cwe) &&
        finding.description.includes(
          rawFinding.cwe as string
        )
    ) ??
    candidates.find(
      (rawFinding) =>
        finding.title.includes(
          rawFinding.title
        ) ||
        rawFinding.title.includes(
          finding.title
        )
    ) ??
    candidates[0]
  );
}

export function buildEvidence(
  findings: Finding[],
  controls: SecurityControl[],
  rawFindings: RawFinding[] = []
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

      const rawFinding =
        rawFindingFor(
          finding,
          rawFindings
        );

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

        /*
         * Verified here means evidence integrity/provenance,
         * not remediation or control verification.
         */
        status:
          "Verified",

        integrity:
          "Scanner result persisted with assessment",

        location:
          parseLocation(
            rawFinding
          ),

        cwe:
          rawFinding?.cwe,
      };
    }
  );
}
