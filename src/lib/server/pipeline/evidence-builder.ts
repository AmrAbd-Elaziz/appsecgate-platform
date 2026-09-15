import type {
  EvidenceRecord,
  Finding,
} from "../../../data/appsecgate";

export function buildEvidence(
  findings: Finding[]
): EvidenceRecord[] {
  const evidence: EvidenceRecord[] = [];

  for (const finding of findings) {
    if (finding.id === "ASG-1042") {
      evidence.push(
        {
          id: "EVD-001",
          runId: finding.runId,
          assetId: finding.assetId,
          findingId: finding.id,
          controlId: finding.controlId,
          title: "Gitleaks secret detection result",
          type: "Scanner Output",
          source: "Gitleaks",
          status: "Verified",
          integrity: "SHA-256 recorded",
        },
        {
          id: "EVD-005",
          runId: finding.runId,
          assetId: finding.assetId,
          findingId: finding.id,
          controlId: finding.controlId,
          title: "Secret rotation confirmation",
          type: "Remediation Proof",
          source: "Application Team",
          status: "Pending Review",
          integrity: "Awaiting validation",
        }
      );
    }

    if (finding.id === "ASG-1038") {
      evidence.push({
        id: "EVD-002",
        runId: finding.runId,
        assetId: finding.assetId,
        findingId: finding.id,
        controlId: finding.controlId,
        title: "SQL injection validation evidence",
        type: "Scanner Output",
        source: "Semgrep + OWASP ZAP",
        status: "Verified",
        integrity: "Correlated evidence",
      });
    }

    if (finding.id === "ASG-1029") {
      evidence.push({
        id: "EVD-003",
        runId: finding.runId,
        assetId: finding.assetId,
        findingId: finding.id,
        controlId: finding.controlId,
        title: "Container dependency scan",
        type: "Scanner Output",
        source: "Trivy",
        status: "Verified",
        integrity: "SHA-256 recorded",
      });
    }

    if (finding.id === "ASG-1017") {
      evidence.push({
        id: "EVD-004",
        runId: finding.runId,
        assetId: finding.assetId,
        findingId: finding.id,
        controlId: finding.controlId,
        title: "S3 public access remediation",
        type: "Retest",
        source: "Checkov",
        status: "Verified",
        integrity: "Retest validated",
      });
    }
  }

  return evidence;
}
