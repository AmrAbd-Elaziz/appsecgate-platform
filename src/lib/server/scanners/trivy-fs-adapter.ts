import { access } from "node:fs/promises";
import path from "node:path";

import type {
  Asset,
  Severity,
} from "../../../data/appsecgate";

import { runCommand } from "./command-runner";
import type {
  RawFinding,
  ScannerAdapter,
  ScannerExecution,
} from "./types";

type TrivyVulnerability = {
  VulnerabilityID?: string;
  PkgName?: string;
  InstalledVersion?: string;
  FixedVersion?: string;
  Title?: string;
  Description?: string;
  Severity?: string;
};

type TrivyResult = {
  Target?: string;
  Class?: string;
  Type?: string;
  Vulnerabilities?: TrivyVulnerability[];
};

type TrivyOutput = {
  Results?: TrivyResult[];
};

function mapSeverity(
  severity?: string
): Severity {
  switch (severity?.toUpperCase()) {
    case "CRITICAL":
      return "CRITICAL";
    case "HIGH":
      return "HIGH";
    case "MEDIUM":
      return "MEDIUM";
    default:
      return "LOW";
  }
}

function mapFinding(
  target: string,
  vulnerability: TrivyVulnerability,
  index: number
): RawFinding {
  const cve =
    vulnerability.VulnerabilityID ||
    "UNKNOWN";

  const pkg =
    vulnerability.PkgName ||
    "unknown-package";

  const installed =
    vulnerability.InstalledVersion ||
    "unknown";

  const fixed =
    vulnerability.FixedVersion ||
    "not-fixed";

  return {
    id: `SCA-${String(index + 1).padStart(3, "0")}`,
    scanner: "Trivy FS",
    category: "SCA",

    title:
      vulnerability.Title ||
      `${cve} in ${pkg}`,

    severity:
      mapSeverity(
        vulnerability.Severity
      ),

    fingerprint:
      `${cve}:${pkg}:${target}`,

    description:
      vulnerability.Description ||
      `${pkg} ${installed} is affected by ${cve}. Fixed version: ${fixed}.`,

    location:
      `${target}:${pkg}@${installed}`,
  };
}

export const realTrivyFsAdapter: ScannerAdapter = {
  name: "Trivy FS",
  category: "SCA",

  async scan(
    _asset: Asset
  ): Promise<ScannerExecution> {
    const workspace =
      process.env.APPSECGATE_SCAN_TARGET ||
      process.cwd();

    const resolvedWorkspace =
      path.resolve(
        /*turbopackIgnore: true*/
        workspace
      );

    await access(resolvedWorkspace);

    /*
     * The source target is mounted read-only.
     * Trivy JSON is returned on stdout.
     */
    const result = await runCommand(
      "docker",
      [
        "run",
        "--rm",

        "-v",
        `${resolvedWorkspace}:/src:ro`,

        "aquasec/trivy:latest",

        "fs",

        "--scanners",
        "vuln",

        "--format",
        "json",

        "--severity",
        "CRITICAL,HIGH,MEDIUM,LOW",

        "--quiet",

        "/src",
      ],
      {
        cwd: process.cwd(),
        timeoutMs: 180_000,
      }
    );

    if (result.exitCode !== 0) {
      throw new Error(
        `Trivy FS failed with exit code ${result.exitCode}: ${result.stderr}`
      );
    }

    let parsed: TrivyOutput;

    try {
      parsed =
        JSON.parse(
          result.stdout || "{}"
        );
    } catch {
      throw new Error(
        "Trivy FS returned invalid JSON output."
      );
    }

    const rawFindings: RawFinding[] = [];

    for (
      const scanResult
      of parsed.Results || []
    ) {
      const target =
        scanResult.Target ||
        "unknown-target";

      for (
        const vulnerability
        of scanResult.Vulnerabilities || []
      ) {
        rawFindings.push(
          mapFinding(
            target,
            vulnerability,
            rawFindings.length
          )
        );
      }
    }

    return {
      category: "SCA",
      tool: "Trivy FS",
      status: "Completed",
      findings: rawFindings.length,
      rawFindings,
    };
  },
};
