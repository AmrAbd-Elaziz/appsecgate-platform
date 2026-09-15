import {
  mkdtemp,
  rm,
} from "node:fs/promises";

import os from "node:os";
import path from "node:path";

import type {
  Severity,
} from "../../../data/appsecgate";

import {
  runCommand,
} from "./command-runner";

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
  Severity?: string;
  Title?: string;
  Description?: string;
};

type TrivyResult = {
  Target?: string;
  Type?: string;
  Vulnerabilities?: TrivyVulnerability[];
};

type TrivyReport = {
  Results?: TrivyResult[];
};


function mapSeverity(
  severity?: string
): Severity {
  switch (
    severity?.toUpperCase()
  ) {
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


function parseReport(
  stdout: string
): TrivyReport {
  try {
    return JSON.parse(
      stdout
    ) as TrivyReport;
  } catch {
    throw new Error(
      "Trivy container scanner returned invalid JSON."
    );
  }
}


function mapFindings(
  report: TrivyReport
): RawFinding[] {
  const findings: RawFinding[] = [];

  let index = 0;

  for (
    const result
    of report.Results ?? []
  ) {
    for (
      const vulnerability
      of result.Vulnerabilities ?? []
    ) {
      index += 1;

      const cve =
        vulnerability.VulnerabilityID ??
        `UNKNOWN-${index}`;

      const pkg =
        vulnerability.PkgName ??
        "unknown-package";

      const installed =
        vulnerability.InstalledVersion ??
        "unknown";

      const fixed =
        vulnerability.FixedVersion;

      const target =
        result.Target ??
        "container-image";

      const targetType =
        result.Type ??
        "container";

      findings.push({
        id:
          `CTR-${String(index).padStart(3, "0")}`,

        scanner:
          "Trivy Container",

        category:
          "Container",

        title:
          vulnerability.Title
            ? `${cve}: ${vulnerability.Title}`
            : `${cve}: ${pkg}`,

        severity:
          mapSeverity(
            vulnerability.Severity
          ),

        fingerprint:
          [
            cve,
            pkg,
            installed,
            targetType,
          ].join(":"),

        description:
          vulnerability.Description ??
          (
            fixed
              ? `${pkg} ${installed} is affected. Upgrade to ${fixed}.`
              : `${pkg} ${installed} is affected and no fixed version was reported.`
          ),

        location:
          `${target}:${pkg}@${installed}`,

        cwe:
          undefined,
      });
    }
  }

  return findings;
}


export const realTrivyImageAdapter:
ScannerAdapter = {
  name:
    "Trivy Container",

  category:
    "Container",

  async scan():
  Promise<ScannerExecution> {
    /*
     * The image name is server-controlled configuration.
     * It is never interpolated into a shell command.
     */
    const image =
      process.env
        .APPSECGATE_CONTAINER_IMAGE ??
      "appsecgate-vulnerable-test:latest";

    /*
     * Export the image on the host first.
     *
     * This avoids mounting /var/run/docker.sock into
     * the Trivy container. The scanner receives only
     * a read-only image archive.
     */
    const tempDir =
      await mkdtemp(
        path.join(
          os.tmpdir(),
          "appsecgate-trivy-image-"
        )
      );

    const imageTar =
      path.join(
        tempDir,
        "image.tar"
      );

    try {
      const exported =
        await runCommand(
          "docker",
          [
            "save",
            "-o",
            imageTar,
            image,
          ],
          {
            cwd:
              process.cwd(),

            timeoutMs:
              240_000,
          }
        );

      if (
        exported.exitCode !== 0
      ) {
        throw new Error(
          [
            `Unable to export container image: ${image}`,
            exported.stderr ||
              exported.stdout,
          ]
            .filter(Boolean)
            .join("\n")
        );
      }

      const scanned =
        await runCommand(
          "docker",
          [
            "run",
            "--rm",

            "-v",
            `${imageTar}:/scan/image.tar:ro`,

            "aquasec/trivy:latest",

            "image",

            "--input",
            "/scan/image.tar",

            "--scanners",
            "vuln",

            "--format",
            "json",

            "--severity",
            "CRITICAL,HIGH,MEDIUM,LOW",

            "--quiet",
          ],
          {
            cwd:
              process.cwd(),

            timeoutMs:
              240_000,
          }
        );

      /*
       * Trivy image vulnerability scans normally
       * return 0 unless an explicit exit-code policy
       * is configured. Treat any non-zero result here
       * as scanner execution failure.
       */
      if (
        scanned.exitCode !== 0
      ) {
        throw new Error(
          [
            "Trivy container scan failed.",
            scanned.stderr ||
              scanned.stdout,
          ]
            .filter(Boolean)
            .join("\n")
        );
      }

      const report =
        parseReport(
          scanned.stdout
        );

      const rawFindings =
        mapFindings(
          report
        );

      return {
        category:
          "Container",

        tool:
          "Trivy Container",

        status:
          "Completed",

        findings:
          rawFindings.length,

        rawFindings,
      };
    } finally {
      /*
       * Remove the exported image even if export,
       * scan, or parsing fails.
       */
      await rm(
        tempDir,
        {
          recursive: true,
          force: true,
        }
      );
    }
  },
};
