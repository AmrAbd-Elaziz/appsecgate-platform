import {
  getControlsForRun,
  getEvidenceForRun,
  getFindingsForRun,
  scannerResults,
  type Asset,
  type AssessmentRun,
  type EvidenceRecord,
  type Finding,
  type ScannerResult,
  type SecurityControl,
} from "../../data/appsecgate";

export type PersistedAssessment = {
  id: string;
  assetId: number;
  asset: Asset;
  status: "Completed";
  decision: "BLOCK" | "PASS";
  startedAt: string;
  completedAt: string;
  scannerExecutions: ScannerResult[];
  rawFindingCount: number;
  findings: Finding[];
  controls: SecurityControl[];
  evidence: EvidenceRecord[];
  blockers: string[];
};

function createRunId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase();

  return `ASG-RUN-${timestamp}-${random}`;
}

function executeScannerAdapters(): ScannerResult[] {
  /*
   * V2 engine boundary.
   *
   * These are deterministic adapters for now.
   * Real Semgrep / ZAP / Gitleaks / Trivy / Checkov execution
   * will replace these adapters later without changing the API contract.
   */
  return scannerResults.map((scanner) => ({
    ...scanner,
  }));
}

export function executeAssessment(
  asset: Asset
): PersistedAssessment {
  const startedAt = new Date().toISOString();
  const id = createRunId();

  const scannerExecutions = executeScannerAdapters();

  const baseRun: AssessmentRun = {
    id,
    asset,
    status: "Completed",
    decision: "PENDING",
    startedAt,
    scanners: scannerExecutions,
  };

  const findings = getFindingsForRun(baseRun);
  const controls = getControlsForRun(baseRun);
  const evidence = getEvidenceForRun(baseRun);

  const blockingFindings = findings.filter(
    (finding) =>
      finding.blocker &&
      finding.status === "Confirmed"
  );

  const decision: "BLOCK" | "PASS" =
    blockingFindings.length > 0 ? "BLOCK" : "PASS";

  const rawFindingCount = scannerExecutions.reduce(
    (total, scanner) => total + scanner.findings,
    0
  );

  return {
    id,
    assetId: asset.id,
    asset,
    status: "Completed",
    decision,
    startedAt,
    completedAt: new Date().toISOString(),
    scannerExecutions,
    rawFindingCount,
    findings,
    controls,
    evidence,
    blockers: blockingFindings.map(
      (finding) => finding.id
    ),
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
