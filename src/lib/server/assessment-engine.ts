import type {
  Asset,
  AssessmentRun,
  EvidenceRecord,
  Finding,
  ScannerResult,
  SecurityControl,
  PersistedAssessment as BasePersistedAssessment,
} from "../../data/appsecgate";

import { scannerAdapters } from "./scanners/adapters";
import {
  getRequiredScannerAdapters,
} from "./scanners/applicability";
import type {
  RawFinding,
  ScannerAdapter,
  ScannerExecution,
} from "./scanners/types";

import {
  normalizeAndCorrelate,
} from "./pipeline/normalizer";

import {
  mapControls,
} from "./pipeline/control-mapper";

import {
  scoreFindings,
} from "./pipeline/risk-engine";

import {
  buildEvidence,
} from "./pipeline/evidence-builder";

import {
  evaluatePolicy,
} from "./pipeline/policy-engine";

export type PersistedAssessment =
  BasePersistedAssessment & {
    rawFindings: RawFinding[];
  };

function createRunId(): string {
  const timestamp =
    Date.now().toString(36).toUpperCase();

  const random = Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase();

  return `ASG-RUN-${timestamp}-${random}`;
}

async function runScannerSafely(
  adapter: ScannerAdapter,
  asset: Asset
): Promise<ScannerExecution> {
  const started = Date.now();

  try {
    const result = await adapter.scan(asset);

    return {
      ...result,
      durationMs: Date.now() - started,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    console.error(
      `[AppSecGate] Scanner failed: ${adapter.name}`,
      message
    );

    return {
      category: adapter.category,
      tool: adapter.name,
      status: "Failed",
      findings: 0,
      rawFindings: [],
      durationMs: Date.now() - started,
      error: message,
    };
  }
}

export async function executeAssessment(
  asset: Asset
): Promise<PersistedAssessment> {
  const startedAt = new Date().toISOString();
  const id = createRunId();

  /*
   * Scanner stage
   */
  const requiredScannerAdapters =
    getRequiredScannerAdapters(
      asset,
      scannerAdapters
    );

  const executions = await Promise.all(
    requiredScannerAdapters.map(
      (adapter) =>
        runScannerSafely(adapter, asset)
    )
  );

  const rawFindings = executions.flatMap(
    (execution) => execution.rawFindings
  );

  /*
   * Keep public ScannerResult contract compatible
   * with the existing UI.
   */
  const scannerExecutions: ScannerResult[] =
    executions.map((execution) => ({
      category: execution.category,
      tool: execution.tool,
      status: execution.status,
      findings: execution.findings,
      durationMs: execution.durationMs,
      error: execution.error,
    }));

  const baseRun: AssessmentRun = {
    id,
    asset,
    status: "Completed",
    decision: "PENDING",
    startedAt,
    scanners: scannerExecutions,
  };

  /*
   * Security intelligence pipeline
   */
  const normalizedFindings =
    normalizeAndCorrelate(
      baseRun,
      rawFindings
    );

  const findings =
    scoreFindings(
      normalizedFindings,
      asset
    );

  const controls = mapControls(findings);

  const evidence = buildEvidence(
    findings,
    controls,
    rawFindings
  );

  const policy = evaluatePolicy(
    findings,
    asset
  );

  /*
   * Assessment integrity gate.
   *
   * A security verdict is only reliable when all
   * required scanners complete successfully.
   *
   * Scanner failures do not abort the assessment,
   * but they prevent a PASS/BLOCK release verdict
   * from being treated as complete.
   */
  const failedScanners =
    scannerExecutions.filter(
      (scanner) =>
        scanner.status === "Failed"
    );

  const assessmentDecision =
    failedScanners.length > 0
      ? "INCOMPLETE"
      : policy.decision;

  return {
    id,
    assetId: asset.id,
    asset,
    status: "Completed",
    decision: assessmentDecision,
    startedAt,
    completedAt: new Date().toISOString(),

    scannerExecutions,
    rawFindingCount: rawFindings.length,
    rawFindings,

    findings,
    controls,
    evidence,
    blockers: policy.blockers,
  };
}

export function toAssessmentRun(
  assessment: PersistedAssessment
): AssessmentRun {
  return {
    id: assessment.id,
    asset: assessment.asset,
    status: assessment.status,
    decision: assessment.decision,
    startedAt: assessment.startedAt,
    scanners: assessment.scannerExecutions,
  };
}
