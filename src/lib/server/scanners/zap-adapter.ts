import {
  readFile,
  rm,
} from "node:fs/promises";

import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

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

type ZapInstance = {
  uri?: string;
  method?: string;
  param?: string;
  evidence?: string;
};

type ZapAlert = {
  pluginid?: string;
  alert?: string;
  name?: string;
  riskdesc?: string;
  desc?: string;
  cweid?: string;
  instances?: ZapInstance[];
};

type ZapSite = {
  "@name"?: string;
  alerts?: ZapAlert[];
};

type ZapReport = {
  site?: ZapSite[];
};

function mapSeverity(
  risk?: string
): Severity {
  const normalized =
    (risk || "")
      .split(" ")[0]
      .toUpperCase();

  switch (normalized) {
    case "HIGH":
      return "HIGH";

    case "MEDIUM":
      return "MEDIUM";

    case "LOW":
    case "INFORMATIONAL":
    default:
      return "LOW";
  }
}

function cleanText(
  value?: string
): string {
  if (!value) {
    return "";
  }

  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mapAlert(
  alert: ZapAlert,
  instance: ZapInstance,
  index: number
): RawFinding {
  const pluginId =
    alert.pluginid ||
    "ZAP-UNKNOWN";

  const uri =
    instance.uri ||
    "unknown-uri";

  const parameter =
    instance.param ||
    "none";

  const cwe =
    alert.cweid
      ? `CWE-${alert.cweid}`
      : undefined;

  return {
    id: `ZAP-${String(index + 1).padStart(3, "0")}`,

    scanner: "OWASP ZAP",

    category: "DAST",

    title:
      alert.alert ||
      alert.name ||
      `ZAP Alert ${pluginId}`,

    severity:
      mapSeverity(
        alert.riskdesc
      ),

    fingerprint:
      `${pluginId}:${uri}:${parameter}`,

    description:
      cleanText(alert.desc) ||
      `OWASP ZAP detected plugin ${pluginId}.`,

    location:
      parameter === "none"
        ? uri
        : `${uri} [${parameter}]`,

    cwe,
  };
}

export const realZapAdapter: ScannerAdapter = {
  name: "OWASP ZAP",
  category: "DAST",

  async scan(
    _asset: Asset
  ): Promise<ScannerExecution> {
    /*
     * Server-controlled target.
     * Never accept the DAST URL directly
     * from the browser request.
     */
    const target =
      process.env.APPSECGATE_DAST_TARGET ||
      "http://appsecgate-zap-target:5000";

    const network =
      process.env.APPSECGATE_SCANNER_NETWORK ||
      "appsecgate-scanner-net";

    const reportName =
      `appsecgate-zap-${randomUUID()}.json`;

    const hostReport =
      path.join(
        os.tmpdir(),
        reportName
      );

    try {
      const result = await runCommand(
        "docker",
        [
          "run",
          "--rm",

          "--network",
          network,

          "-v",
          `${os.tmpdir()}:/zap/wrk/:rw`,

          "ghcr.io/zaproxy/zaproxy:stable",

          "zap-baseline.py",

          "-t",
          target,

          "-J",
          reportName,

          "-m",
          "1",

          "-I",
        ],
        {
          cwd: process.cwd(),
          timeoutMs: 240_000,
        }
      );

      let reportText: string;

      try {
        reportText =
          await readFile(
            hostReport,
            "utf8"
          );
      } catch {
        throw new Error(
          `ZAP report was not created. Exit code: ${result.exitCode}. ${result.stderr}`
        );
      }

      let parsed: ZapReport;

      try {
        parsed =
          JSON.parse(
            reportText
          );
      } catch {
        throw new Error(
          "OWASP ZAP returned an invalid JSON report."
        );
      }

      const rawFindings: RawFinding[] = [];

      for (
        const site
        of parsed.site || []
      ) {
        for (
          const alert
          of site.alerts || []
        ) {
          const instances =
            alert.instances?.length
              ? alert.instances
              : [{}];

          for (
            const instance
            of instances
          ) {
            rawFindings.push(
              mapAlert(
                alert,
                instance,
                rawFindings.length
              )
            );
          }
        }
      }

      return {
        category: "DAST",
        tool: "OWASP ZAP",
        status: "Completed",
        findings: rawFindings.length,
        rawFindings,
      };
    } finally {
      await rm(
        hostReport,
        {
          force: true,
        }
      );
    }
  },
};
