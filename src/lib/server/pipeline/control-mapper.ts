import type {
  Finding,
  SecurityControl,
} from "../../../data/appsecgate";

type ControlTemplate = {
  name: string;
  domain: string;
  status:
    | "Required"
    | "In Progress"
    | "Implemented";
  owner: string;
  remediation: string;
  requiredEvidence: string;
};

const templates: Record<string, ControlTemplate> = {
  "CTRL-001": {
    name: "Secret Management",
    domain: "Application Security",
    status: "Required",
    owner: "Application Team",
    remediation:
      "Remove hardcoded secrets and retrieve credentials from an approved secrets manager at runtime.",
    requiredEvidence:
      "Secret rotation + clean Gitleaks scan",
  },

  "CTRL-002": {
    name: "Input Validation",
    domain: "Application Security",
    status: "In Progress",
    owner: "Application Team",
    remediation:
      "Replace dynamic SQL construction with parameterized queries and validate untrusted input.",
    requiredEvidence:
      "Code fix + Semgrep/ZAP retest",
  },

  "CTRL-003": {
    name: "Dependency Security",
    domain: "Software Supply Chain",
    status: "Required",
    owner: "Platform Team",
    remediation:
      "Upgrade the affected dependency and rebuild from an approved patched base image.",
    requiredEvidence:
      "Updated SBOM + clean Trivy scan",
  },

  "CTRL-004": {
    name: "Cloud Configuration",
    domain: "Cloud Security",
    status: "Implemented",
    owner: "Cloud Team",
    remediation:
      "Enforce public access block configuration through infrastructure-as-code policy.",
    requiredEvidence:
      "IaC change + Checkov validation",
  },
};

export function mapControls(
  findings: Finding[]
): SecurityControl[] {
  return findings.flatMap((finding) => {
    const template = templates[finding.controlId];

    if (!template) {
      return [];
    }

    return [
      {
        id: finding.controlId,
        runId: finding.runId,
        assetId: finding.assetId,
        findingId: finding.id,
        name: template.name,
        domain: template.domain,
        severity: finding.severity,
        status: template.status,
        owner: template.owner,
        remediation: template.remediation,
        requiredEvidence:
          template.requiredEvidence,
      },
    ];
  });
}
