import type {
  Finding,
  SecurityControl,
} from "../../../data/appsecgate";

type ControlTemplate = {
  name: string;
  domain: string;
  owner: string;
  remediation: string;
  requiredEvidence: string;
};

const templates: Record<
  string,
  ControlTemplate
> = {
  "CTRL-SECRETS": {
    name: "Secret Management",
    domain: "Application Security",
    owner: "Application Team",
    remediation:
      "Remove exposed credentials, rotate affected secrets, and retrieve credentials from an approved secrets manager at runtime.",
    requiredEvidence:
      "Secret rotation confirmation + clean Gitleaks retest",
  },

  "CTRL-INPUT": {
    name: "Secure Input & Query Handling",
    domain: "Application Security",
    owner: "Application Team",
    remediation:
      "Use parameterized queries and enforce server-side validation for untrusted input.",
    requiredEvidence:
      "Code remediation + clean SAST/DAST retest",
  },

  "CTRL-SAST": {
    name: "Secure Coding Remediation",
    domain: "Application Security",
    owner: "Application Team",
    remediation:
      "Remediate the identified source-code weakness and validate the fix through static analysis.",
    requiredEvidence:
      "Code change + clean Semgrep retest",
  },

  "CTRL-WEB": {
    name: "Web Security Hardening",
    domain: "Application Security",
    owner: "Application Team",
    remediation:
      "Apply the required web security control and validate the deployed application through DAST.",
    requiredEvidence:
      "Configuration or code change + clean OWASP ZAP retest",
  },

  "CTRL-DEPENDENCY": {
    name: "Dependency Vulnerability Management",
    domain: "Software Supply Chain",
    owner: "Platform Team",
    remediation:
      "Upgrade or replace the affected dependency with a supported patched version and rebuild the application.",
    requiredEvidence:
      "Updated dependency inventory + clean Trivy filesystem scan",
  },

  "CTRL-CONTAINER": {
    name: "Container Image Hardening",
    domain: "Container Security",
    owner: "Platform Team",
    remediation:
      "Rebuild the image from a supported patched base image and update vulnerable operating-system and application packages.",
    requiredEvidence:
      "New image digest + clean Trivy container scan",
  },

  "CTRL-IAC": {
    name: "Infrastructure-as-Code Hardening",
    domain: "Cloud Security",
    owner: "Cloud Team",
    remediation:
      "Correct the infrastructure-as-code policy violation and enforce the secure configuration through code.",
    requiredEvidence:
      "IaC change + clean Checkov retest",
  },

  "CTRL-GENERAL": {
    name: "Security Finding Remediation",
    domain: "Security Engineering",
    owner: "Security Team",
    remediation:
      "Investigate and remediate the validated security finding according to risk and asset criticality.",
    requiredEvidence:
      "Remediation proof + scanner retest",
  },
};

export function mapControls(
  findings: Finding[]
): SecurityControl[] {
  return findings.map(
    (finding, index) => {
      const template =
        templates[
          finding.controlId
        ] ??
        templates[
          "CTRL-GENERAL"
        ];

      return {
        /*
         * A control instance belongs to one
         * finding. Keep template identity in
         * the prefix while ensuring unique IDs.
         */
        id:
          `${finding.controlId}-${String(
            index + 1
          ).padStart(3, "0")}`,

        runId:
          finding.runId,

        assetId:
          finding.assetId,

        findingId:
          finding.id,

        name:
          template.name,

        domain:
          template.domain,

        severity:
          finding.severity,

        status:
          "Required",

        owner:
          template.owner,

        remediation:
          template.remediation,

        requiredEvidence:
          template.requiredEvidence,
      };
    }
  );
}
