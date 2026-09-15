import {
  access,
  readFile,
  rm,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

import type { Asset } from "../../../data/appsecgate";

import { runCommand } from "./command-runner";
import type {
  RawFinding,
  ScannerAdapter,
  ScannerExecution,
} from "./types";

type GitleaksFinding = {
  RuleID?: string;
  Description?: string;
  File?: string;
  StartLine?: number;
  Commit?: string;
  Fingerprint?: string;
};

function mapFinding(
  finding: GitleaksFinding,
  index: number
): RawFinding {
  const rule =
    finding.RuleID || "secret-detection";

  const file =
    finding.File || "unknown";

  const line =
    finding.StartLine ?? 0;

  return {
    id: `GIT-${String(index + 1).padStart(3, "0")}`,
    scanner: "Gitleaks",
    category: "Secrets",
    title:
      finding.Description ||
      "Secret detected",
    severity: "CRITICAL",
    fingerprint:
      finding.Fingerprint ||
      `${rule}:${file}:${line}`,
    description:
      `Gitleaks detected a potential secret using rule ${rule}.`,
    location:
      line > 0
        ? `${file}:${line}`
        : file,
    cwe: "CWE-798",
  };
}

export const realGitleaksAdapter: ScannerAdapter = {
  name: "Gitleaks",
  category: "Secrets",

  async scan(
    asset: Asset
  ): Promise<ScannerExecution> {
    const workspace =
      asset.scanProfile?.sourcePath ||
      process.env.APPSECGATE_SCAN_TARGET ||
      process.cwd();

    const resolvedWorkspace =
      path.resolve(
        /*turbopackIgnore: true*/
        workspace
      );

    await access(resolvedWorkspace);

    /*
     * Use a temporary report file instead of /dev/stdout.
     * This keeps the integration compatible with the
     * installed Gitleaks CLI version.
     */
    const reportPath = path.join(
      os.tmpdir(),
      `appsecgate-gitleaks-${randomUUID()}.json`
    );

    try {
      const result = await runCommand(
        "gitleaks",
        [
          "detect",
          "--source",
          resolvedWorkspace,
          "--report-format",
          "json",
          "--report-path",
          reportPath,
          "--no-banner",
          "--exit-code",
          "1",
        ],
        {
          cwd: resolvedWorkspace,
          timeoutMs: 60_000,
        }
      );

      /*
       * Gitleaks:
       * 0 = completed, no leaks
       * 1 = completed, leaks found
       */
      if (
        result.exitCode !== 0 &&
        result.exitCode !== 1
      ) {
        throw new Error(
          `Gitleaks failed with exit code ${result.exitCode}: ${result.stderr}`
        );
      }

      let parsed: GitleaksFinding[] = [];

      try {
        const report =
          await readFile(
            reportPath,
            "utf8"
          );

        if (report.trim()) {
          const value =
            JSON.parse(report);

          if (!Array.isArray(value)) {
            throw new Error(
              "Gitleaks report is not an array."
            );
          }

          parsed = value;
        }
      } catch (error) {
        /*
         * Exit 0 can legitimately produce no report
         * on some Gitleaks versions.
         */
        if (result.exitCode === 1) {
          throw new Error(
            `Gitleaks reported leaks but its JSON report could not be read: ${
              error instanceof Error
                ? error.message
                : String(error)
            }`
          );
        }
      }

      const rawFindings =
        parsed.map(mapFinding);

      return {
        category: "Secrets",
        tool: "Gitleaks",
        status: "Completed",
        findings: rawFindings.length,
        rawFindings,
      };
    } finally {
      await rm(
        reportPath,
        { force: true }
      ).catch(() => undefined);
    }
  },
};
