/* ==========================================
   AppSecGate V1 — Central Application Model
   Single source of truth
========================================== */

export type AssetType =
  | "Web Application"
  | "API"
  | "Container"
  | "Cloud Infrastructure"
  | "Repository";

export type Environment =
  | "Production"
  | "Staging"
  | "Development";

export type Criticality =
  | "Critical"
  | "High"
  | "Medium"
  | "Low";

export type Severity =
  | "CRITICAL"
  | "HIGH"
  | "MEDIUM"
  | "LOW";

export type AssetScanProfile = {
  sourcePath?: string;
  iacPath?: string;
  dastUrl?: string;
  dastOpenApiPath?: string;
  containerImage?: string;
  containerArchivePath?: string;
};

export type Asset = {
  id: number;
  name: string;
  type: AssetType;
  environment: Environment;
  criticality: Criticality;
  scanProfile?: AssetScanProfile;
};

export type ScannerResult = {
  category: string;
  tool: string;
  status: "Completed" | "Failed";
  findings: number;
  durationMs?: number;
  error?: string;
};

export type AssessmentRun = {
  id: string;
  asset: Asset;
  status: "Running" | "Completed";
  decision: "PENDING" | "BLOCK" | "PASS" | "INCOMPLETE";
  startedAt: string;
  scanners: ScannerResult[];
};

export type Finding = {
  id: string;
  runId: string;
  assetId: number;
  title: string;
  source: string;
  category: string;
  severity: Severity;
  status: "Confirmed" | "Validated";
  blocker: boolean;
  description: string;
  controlId: string;

  riskScore: number;
  riskLevel: "Critical" | "High" | "Medium" | "Low";
  confidence: "High" | "Medium" | "Low";
  scannerCount: number;

  riskFactors: {
    technicalSeverity: number;
    assetCriticality: number;
    environment: number;
    confidence: number;
    corroboration: number;
  };
};

export type SecurityControl = {
  id: string;
  runId: string;
  assetId: number;
  findingId: string;
  name: string;
  domain: string;
  severity: Severity;
  status: "Required" | "In Progress" | "Implemented";
  owner: string;
  remediation: string;
  requiredEvidence: string;
};

export type EvidenceRecord = {
  id: string;
  runId: string;
  assetId: number;
  findingId: string;
  controlId: string;
  title: string;
  type: "Scanner Output" | "Remediation Proof" | "Retest";
  source: string;
  status: "Verified" | "Pending Review";
  integrity: string;
};

/* ==========================================
   Managed Assets
========================================== */

export const initialAssets: Asset[] = [
  {
    id: 1,
    name: "Customer Portal",
    type: "Web Application",
    environment: "Production",
    criticality: "Critical",
  },
  {
    id: 2,
    name: "Platform API",
    type: "API",
    environment: "Production",
    criticality: "Critical",
  },
  {
    id: 3,
    name: "Retail API Container",
    type: "Container",
    environment: "Staging",
    criticality: "High",
  },
  {
    id: 4,
    name: "Retail Cloud Storage",
    type: "Cloud Infrastructure",
    environment: "Production",
    criticality: "High",
  },
];

/* ==========================================
   Scanner Coverage
========================================== */

export const scannerResults: ScannerResult[] = [
  {
    category: "SAST",
    tool: "Semgrep",
    status: "Completed",
    findings: 2,
  },
  {
    category: "DAST",
    tool: "OWASP ZAP",
    status: "Completed",
    findings: 1,
  },
  {
    category: "Secrets",
    tool: "Gitleaks",
    status: "Completed",
    findings: 1,
  },
  {
    category: "SCA",
    tool: "Trivy / pip-audit",
    status: "Completed",
    findings: 1,
  },
  {
    category: "IaC",
    tool: "Checkov",
    status: "Completed",
    findings: 1,
  },
  {
    category: "Container",
    tool: "Trivy",
    status: "Completed",
    findings: 1,
  },
];

/* ==========================================
   Assessment Factory
========================================== */

export function createAssessmentRun(
  asset: Asset
): AssessmentRun {
  return {
    id: `ASG-RUN-${String(Date.now()).slice(-6)}`,
    asset,
    status: "Completed",
    decision: "BLOCK",
    startedAt: new Date().toISOString(),
    scanners: scannerResults,
  };
}

/* ==========================================
   Findings
========================================== */

export function getFindingsForRun(
  run: AssessmentRun
): Finding[] {
  return [
    {
      id: "ASG-1042",
      runId: run.id,
      assetId: run.asset.id,
      title: "Hardcoded application secret",
      source: "Gitleaks",
      category: "Secrets",
      severity: "CRITICAL",
      status: "Confirmed",
      blocker: true,
      description:
        "A hardcoded application secret was identified in source code and validated as reachable by the application.",
      controlId: "CTRL-001",


      riskScore: 0,

      riskLevel: "Low",

      confidence: "Low",

      scannerCount: 1,

      riskFactors: {

        technicalSeverity: 0,

        assetCriticality: 0,

        environment: 0,

        confidence: 0,

        corroboration: 0,

      },
    },
    {
      id: "ASG-1038",
      runId: run.id,
      assetId: run.asset.id,
      title: "SQL injection on user search",
      source: "Semgrep + OWASP ZAP",
      category: "SAST / DAST",
      severity: "CRITICAL",
      status: "Confirmed",
      blocker: true,
      description:
        "Static and dynamic analysis signals were correlated to confirm an injectable user-controlled query path.",
      controlId: "CTRL-002",


      riskScore: 0,

      riskLevel: "Low",

      confidence: "Low",

      scannerCount: 1,

      riskFactors: {

        technicalSeverity: 0,

        assetCriticality: 0,

        environment: 0,

        confidence: 0,

        corroboration: 0,

      },
    },
    {
      id: "ASG-1029",
      runId: run.id,
      assetId: run.asset.id,
      title: "Vulnerable OpenSSL base image",
      source: "Trivy + pip-audit",
      category: "SCA / Container",
      severity: "HIGH",
      status: "Validated",
      blocker: false,
      description:
        "The deployed dependency set includes a vulnerable OpenSSL package requiring remediation.",
      controlId: "CTRL-003",


      riskScore: 0,

      riskLevel: "Low",

      confidence: "Low",

      scannerCount: 1,

      riskFactors: {

        technicalSeverity: 0,

        assetCriticality: 0,

        environment: 0,

        confidence: 0,

        corroboration: 0,

      },
    },
    {
      id: "ASG-1017",
      runId: run.id,
      assetId: run.asset.id,
      title: "S3 public access block missing",
      source: "Checkov",
      category: "IaC",
      severity: "MEDIUM",
      status: "Validated",
      blocker: false,
      description:
        "Infrastructure-as-code configuration does not enforce the expected public access block control.",
      controlId: "CTRL-004",


      riskScore: 0,

      riskLevel: "Low",

      confidence: "Low",

      scannerCount: 1,

      riskFactors: {

        technicalSeverity: 0,

        assetCriticality: 0,

        environment: 0,

        confidence: 0,

        corroboration: 0,

      },
    },
  ];
}

/* ==========================================
   Controls
========================================== */

export function getControlsForRun(
  run: AssessmentRun
): SecurityControl[] {
  return [
    {
      id: "CTRL-001",
      runId: run.id,
      assetId: run.asset.id,
      findingId: "ASG-1042",
      name: "Secret Management",
      domain: "Application Security",
      severity: "CRITICAL",
      status: "Required",
      owner: "Application Team",
      remediation:
        "Remove hardcoded secrets and retrieve credentials from an approved secrets manager at runtime.",
      requiredEvidence:
        "Secret rotation + clean Gitleaks scan",
    },
    {
      id: "CTRL-002",
      runId: run.id,
      assetId: run.asset.id,
      findingId: "ASG-1038",
      name: "Input Validation",
      domain: "Application Security",
      severity: "CRITICAL",
      status: "In Progress",
      owner: "Application Team",
      remediation:
        "Replace dynamic SQL construction with parameterized queries and validate untrusted input.",
      requiredEvidence:
        "Code fix + Semgrep/ZAP retest",
    },
    {
      id: "CTRL-003",
      runId: run.id,
      assetId: run.asset.id,
      findingId: "ASG-1029",
      name: "Dependency Security",
      domain: "Software Supply Chain",
      severity: "HIGH",
      status: "Required",
      owner: "Platform Team",
      remediation:
        "Upgrade the affected dependency and rebuild from an approved patched base image.",
      requiredEvidence:
        "Updated SBOM + clean Trivy scan",
    },
    {
      id: "CTRL-004",
      runId: run.id,
      assetId: run.asset.id,
      findingId: "ASG-1017",
      name: "Cloud Configuration",
      domain: "Cloud Security",
      severity: "MEDIUM",
      status: "Implemented",
      owner: "Cloud Team",
      remediation:
        "Enforce public access block configuration through infrastructure-as-code policy.",
      requiredEvidence:
        "IaC change + Checkov validation",
    },
  ];
}

/* ==========================================
   Evidence
========================================== */

export function getEvidenceForRun(
  run: AssessmentRun
): EvidenceRecord[] {
  return [
    {
      id: "EVD-001",
      runId: run.id,
      assetId: run.asset.id,
      findingId: "ASG-1042",
      controlId: "CTRL-001",
      title: "Gitleaks secret detection result",
      type: "Scanner Output",
      source: "Gitleaks",
      status: "Verified",
      integrity: "SHA-256 recorded",
    },
    {
      id: "EVD-002",
      runId: run.id,
      assetId: run.asset.id,
      findingId: "ASG-1038",
      controlId: "CTRL-002",
      title: "SQL injection validation evidence",
      type: "Scanner Output",
      source: "Semgrep + OWASP ZAP",
      status: "Verified",
      integrity: "Correlated evidence",
    },
    {
      id: "EVD-003",
      runId: run.id,
      assetId: run.asset.id,
      findingId: "ASG-1029",
      controlId: "CTRL-003",
      title: "Container dependency scan",
      type: "Scanner Output",
      source: "Trivy",
      status: "Verified",
      integrity: "SHA-256 recorded",
    },
    {
      id: "EVD-004",
      runId: run.id,
      assetId: run.asset.id,
      findingId: "ASG-1017",
      controlId: "CTRL-004",
      title: "S3 public access remediation",
      type: "Retest",
      source: "Checkov",
      status: "Verified",
      integrity: "Retest validated",
    },
    {
      id: "EVD-005",
      runId: run.id,
      assetId: run.asset.id,
      findingId: "ASG-1042",
      controlId: "CTRL-001",
      title: "Secret rotation confirmation",
      type: "Remediation Proof",
      source: "Application Team",
      status: "Pending Review",
      integrity: "Awaiting validation",
    },
  ];
}

/* ==========================================
   Derived Assessment Metrics
========================================== */

export function getAssessmentMetrics(
  run: AssessmentRun
) {
  const findings = getFindingsForRun(run);
  const controls = getControlsForRun(run);
  const evidence = getEvidenceForRun(run);

  return {
    rawFindings: run.scanners.reduce(
      (total, scanner) => total + scanner.findings,
      0
    ),

    normalizedFindings: findings.length,

    criticalFindings: findings.filter(
      (finding) => finding.severity === "CRITICAL"
    ).length,

    blockers: findings.filter(
      (finding) => finding.blocker
    ).length,

    mappedControls: controls.length,

    implementedControls: controls.filter(
      (control) => control.status === "Implemented"
    ).length,

    evidenceRecords: evidence.length,

    verifiedEvidence: evidence.filter(
      (record) => record.status === "Verified"
    ).length,

    scannerCoverage: run.scanners.length,
  };
}

/* ==========================================
   V2 Persisted Assessment Aggregate
========================================== */

export type PersistedAssessment = {
  id: string;
  assetId: number;
  asset: Asset;
  status: "Completed";
  decision: "BLOCK" | "PASS" | "INCOMPLETE";
  startedAt: string;
  completedAt: string;

  scannerExecutions: ScannerResult[];
  rawFindingCount: number;

  findings: Finding[];
  controls: SecurityControl[];
  evidence: EvidenceRecord[];
  blockers: string[];
};
