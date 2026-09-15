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
  targetType: string,
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
    id: `CTR-${String(index + 1).padStart(3, "0")}`,

    scanner: "Trivy Container",

    category: "Container",

    title:
      vulnerability.Title ||
      `${cve} in ${pkg}`,

    severity:
      mapSeverity(
        vulnerability.Severity
      ),

    fingerprint:
      `${cve}:${pkg}:${installed}:${targetType}`,

    description:
      vulnerability.Description ||
      `${pkg} ${installed} is affected by ${cve}. Fixed version: ${fixed}.`,

    location:
      `${target}:${pkg}@${installed}`,
  };
}

export const realTrivyImageAdapter: ScannerAdapter = {
  name: "Trivy Container",
  category: "Container",

  async scan(
    _asset: Asset
  ): Promise<ScannerExecution> {
    /*
     * Server-controlled configuration only.
     * The browser/API request never supplies the
     * Docker image name directly.
     */
    const image =
      process.env.APPSECGATE_CONTAINER_IMAGE ||
      "appsecgate-vulnerable-test:latest";

    const result = await runCommand(
      "docker",
      [
        "run",
        "--rm",

        "-v",
        "/var/run/docker.sock:/var/run/docker.sock",

        "aquasec/trivy:latest",

        "image",

        "--scanners",
        "vuln",

        "--format",
        "json",

        "--severity",
        "CRITICAL,HIGH,MEDIUM,LOW",

        "--quiet",

        image,
      ],
      {
        cwd: process.cwd(),
        timeoutMs: 240_000,
      }
    );

    if (result.exitCode !== 0) {
      throw new Error(
        `Trivy Container failed with exit code ${result.exitCode}: ${result.stderr}`
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
        "Trivy Container returned invalid JSON output."
      );
    }

    const rawFindings: RawFinding[] = [];

    for (
      const scanResult
      of parsed.Results || []
    ) {
      const target =
        scanResult.Target ||
        image;

      const targetType =
        scanResult.Type ||
        scanResult.Class ||
        "container";

      for (
        const vulnerability
        of scanResult.Vulnerabilities || []
      ) {
        rawFindings.push(
          mapFinding(
            target,
            targetType,
            vulnerability,
            rawFindings.length
          )
        );
      }
    }

    return {
      category: "Container",
      tool: "Trivy Container",
      status: "Completed",
      findings: rawFindings.length,
      rawFindings,
    };
  },
};
