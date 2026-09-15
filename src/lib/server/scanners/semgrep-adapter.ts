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

type SemgrepResult = {
  check_id?: string;
  path?: string;
  start?: {
    line?: number;
  };
  extra?: {
    message?: string;
    severity?: string;
    metadata?: {
      cwe?: string | string[];
      appsecgate?: {
        severity?: Severity;
      };
    };
  };
};

type SemgrepOutput = {
  results?: SemgrepResult[];
};

function normalizeCwe(
  value: string | string[] | undefined
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function mapSeverity(
  finding: SemgrepResult
): Severity {
  const configured =
    finding.extra?.metadata
      ?.appsecgate?.severity;

  if (configured) {
    return configured;
  }

  switch (
    finding.extra?.severity?.toUpperCase()
  ) {
    case "ERROR":
      return "HIGH";
    case "WARNING":
      return "MEDIUM";
    default:
      return "LOW";
  }
}

function mapFinding(
  finding: SemgrepResult,
  index: number
): RawFinding {
  const rule =
    finding.check_id ||
    "semgrep-finding";

  const file =
    finding.path ||
    "unknown";

  const line =
    finding.start?.line ?? 0;

  const cwe =
    normalizeCwe(
      finding.extra?.metadata?.cwe
    );

  return {
    id: `SEM-${String(index + 1).padStart(3, "0")}`,
    scanner: "Semgrep",
    category: "SAST",
    title:
      finding.extra?.message ||
      rule,
    severity:
      mapSeverity(finding),
    fingerprint:
      `${rule}:${file}:${line}`,
    description:
      finding.extra?.message ||
      `Semgrep detected rule ${rule}.`,
    location:
      line > 0
        ? `${file}:${line}`
        : file,
    cwe,
  };
}

export const realSemgrepAdapter: ScannerAdapter = {
  name: "Semgrep",
  category: "SAST",

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

    const rulePath =
      path.join(
        process.cwd(),
        "scanner-rules",
        "semgrep.yml"
      );

    await access(resolvedWorkspace);
    await access(rulePath);

    /*
     * Docker receives only fixed arguments.
     * Target and rule mounts are read-only.
     * shell:false is enforced by runCommand().
     */
    const result = await runCommand(
      "docker",
      [
        "run",
        "--rm",

        "-v",
        `${resolvedWorkspace}:/src:ro`,

        "-v",
        `${rulePath}:/rules.yml:ro`,

        "semgrep/semgrep:latest",

        "semgrep",
        "scan",

        "--config",
        "/rules.yml",

        "--json",

        "/src",
      ],
      {
        cwd: process.cwd(),
        timeoutMs: 120_000,
      }
    );

    /*
     * Semgrep can write progress information
     * to stderr while JSON remains on stdout.
     */
    if (
      result.exitCode !== 0 &&
      result.exitCode !== 1
    ) {
      throw new Error(
        `Semgrep failed with exit code ${result.exitCode}: ${result.stderr}`
      );
    }

    let parsed: SemgrepOutput;

    try {
      parsed =
        JSON.parse(
          result.stdout || "{}"
        );
    } catch {
      throw new Error(
        "Semgrep returned invalid JSON output."
      );
    }

    const rawFindings =
      (parsed.results || []).map(
        mapFinding
      );

    return {
      category: "SAST",
      tool: "Semgrep",
      status: "Completed",
      findings: rawFindings.length,
      rawFindings,
    };
  },
};
