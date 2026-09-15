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
import type {
  RawFinding,
} from "./scanners/types";

import {
  normalizeAndCorrelate,
} from "./pipeline/normalizer";

import {
  mapControls,
} from "./pipeline/control-mapper";

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

export async function executeAssessment(
  asset: Asset
): Promise<PersistedAssessment> {
  const startedAt = new Date().toISOString();
  const id = createRunId();

  /*
   * Scanner stage
   */
  const executions = await Promise.all(
    scannerAdapters.map(
      (adapter) => adapter.scan(asset)
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
  const findings = normalizeAndCorrelate(
    baseRun,
    rawFindings
  );

  const controls = mapControls(findings);

  const evidence = buildEvidence(findings);

  const policy = evaluatePolicy(findings);

  return {
    id,
    assetId: asset.id,
    asset,
    status: "Completed",
    decision: policy.decision,
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
