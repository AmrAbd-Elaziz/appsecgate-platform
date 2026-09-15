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

type CheckovFinding = {
  check_id?: string;
  check_name?: string;
  file_path?: string;
  resource?: string;
  guideline?: string;
};

type CheckovReport = {
  results?: {
    failed_checks?: CheckovFinding[];
  };
};

function severityForCheck(
  checkId?: string
): Severity {
  /*
   * Local deterministic policy until severity
   * enrichment is added to the intelligence layer.
   */
  if (checkId === "CKV2_AWS_6") {
    return "HIGH";
  }

  return "MEDIUM";
}

function mapFinding(
  finding: CheckovFinding,
  index: number
): RawFinding {
  const checkId =
    finding.check_id ||
    "CHECKOV-UNKNOWN";

  const file =
    finding.file_path ||
    "unknown";

  const resource =
    finding.resource ||
    "unknown-resource";

  return {
    id: `CKV-${String(index + 1).padStart(3, "0")}`,
    scanner: "Checkov",
    category: "IaC",

    title:
      finding.check_name ||
      checkId,

    severity:
      severityForCheck(checkId),

    fingerprint:
      `${checkId}:${resource}:${file}`,

    description:
      finding.check_name
        ? `${finding.check_name}. Check: ${checkId}.`
        : `Checkov policy ${checkId} failed.`,

    location:
      `${file}:${resource}`,
  };
}

export const realCheckovAdapter: ScannerAdapter = {
  name: "Checkov",
  category: "IaC",

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

    const result = await runCommand(
      "docker",
      [
        "run",
        "--rm",

        "-v",
        `${resolvedWorkspace}:/src:ro`,

        "bridgecrew/checkov:latest",

        "-d",
        "/src",

        "--framework",
        "terraform",

        "--output",
        "json",

        "--compact",
      ],
      {
        cwd: process.cwd(),
        timeoutMs: 180_000,
      }
    );

    /*
     * Checkov exits non-zero when policies fail.
     * A JSON report containing failed_checks is
     * therefore still a successful scanner execution.
     */
    let parsed: CheckovReport | CheckovReport[];

    try {
      parsed =
        JSON.parse(
          result.stdout || "{}"
        );
    } catch {
      throw new Error(
        `Checkov returned invalid JSON. Exit code: ${result.exitCode}. ${result.stderr}`
      );
    }

    const reports =
      Array.isArray(parsed)
        ? parsed
        : [parsed];

    const failedChecks =
      reports.flatMap(
        (report) =>
          report.results
            ?.failed_checks || []
      );

    /*
     * If Checkov exits unexpectedly and there is
     * no usable report, treat it as execution failure.
     */
    if (
      result.exitCode !== 0 &&
      failedChecks.length === 0
    ) {
      throw new Error(
        `Checkov failed with exit code ${result.exitCode}: ${result.stderr}`
      );
    }

    const rawFindings =
      failedChecks.map(
        mapFinding
      );

    return {
      category: "IaC",
      tool: "Checkov",
      status: "Completed",
      findings: rawFindings.length,
      rawFindings,
    };
  },
};
