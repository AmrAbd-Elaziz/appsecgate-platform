import type { Asset } from "../../../data/appsecgate";

import type {
  ScannerAdapter,
  ScannerExecution,
} from "./types";

import { realGitleaksAdapter } from "./gitleaks-adapter";

function execution(
  category: string,
  tool: string,
  rawFindings: ScannerExecution["rawFindings"]
): ScannerExecution {
  return {
    category,
    tool,
    status: "Completed",
    findings: rawFindings.length,
    rawFindings,
  };
}

export const semgrepAdapter: ScannerAdapter = {
  name: "Semgrep",
  category: "SAST",

  async scan(_asset: Asset): Promise<ScannerExecution> {
    return execution("SAST", "Semgrep", [
      {
        id: "SEM-001",
        scanner: "Semgrep",
        category: "SAST",
        title: "SQL injection on user search",
        severity: "CRITICAL",
        fingerprint: "sql-injection-user-search",
        description:
          "Static analysis identified user-controlled input reaching a dynamically constructed SQL query.",
        location: "application:user-search",
        cwe: "CWE-89",
      },
      {
        id: "SEM-002",
        scanner: "Semgrep",
        category: "SAST",
        title: "Hardcoded application secret",
        severity: "CRITICAL",
        fingerprint: "hardcoded-application-secret",
        description:
          "Static analysis identified a hardcoded application secret.",
        location: "application:configuration",
        cwe: "CWE-798",
      },
    ]);
  },
};

export const zapAdapter: ScannerAdapter = {
  name: "OWASP ZAP",
  category: "DAST",

  async scan(_asset: Asset): Promise<ScannerExecution> {
    return execution("DAST", "OWASP ZAP", [
      {
        id: "ZAP-001",
        scanner: "OWASP ZAP",
        category: "DAST",
        title: "SQL injection on user search",
        severity: "CRITICAL",
        fingerprint: "sql-injection-user-search",
        description:
          "Dynamic testing confirmed injectable behavior on the user search path.",
        location: "application:user-search",
        cwe: "CWE-89",
      },
    ]);
  },
};

export const gitleaksAdapter: ScannerAdapter = {
  name: "Gitleaks",
  category: "Secrets",

  async scan(_asset: Asset): Promise<ScannerExecution> {
    return execution("Secrets", "Gitleaks", [
      {
        id: "GIT-001",
        scanner: "Gitleaks",
        category: "Secrets",
        title: "Hardcoded application secret",
        severity: "CRITICAL",
        fingerprint: "hardcoded-application-secret",
        description:
          "Secret scanning identified a credential embedded in application source.",
        location: "application:configuration",
        cwe: "CWE-798",
      },
    ]);
  },
};

export const scaAdapter: ScannerAdapter = {
  name: "Trivy / pip-audit",
  category: "SCA",

  async scan(_asset: Asset): Promise<ScannerExecution> {
    return execution("SCA", "Trivy / pip-audit", [
      {
        id: "SCA-001",
        scanner: "Trivy / pip-audit",
        category: "SCA",
        title: "Vulnerable OpenSSL base image",
        severity: "HIGH",
        fingerprint: "vulnerable-openssl-base-image",
        description:
          "Dependency analysis identified a vulnerable OpenSSL package.",
        location: "container:openssl",
      },
    ]);
  },
};

export const checkovAdapter: ScannerAdapter = {
  name: "Checkov",
  category: "IaC",

  async scan(_asset: Asset): Promise<ScannerExecution> {
    return execution("IaC", "Checkov", [
      {
        id: "CKV-001",
        scanner: "Checkov",
        category: "IaC",
        title: "S3 public access block missing",
        severity: "MEDIUM",
        fingerprint: "s3-public-access-block-missing",
        description:
          "Infrastructure-as-code does not enforce S3 public access blocking.",
        location: "infrastructure:s3",
      },
    ]);
  },
};

export const containerAdapter: ScannerAdapter = {
  name: "Trivy",
  category: "Container",

  async scan(_asset: Asset): Promise<ScannerExecution> {
    return execution("Container", "Trivy", [
      {
        id: "TRI-001",
        scanner: "Trivy",
        category: "Container",
        title: "Vulnerable OpenSSL base image",
        severity: "HIGH",
        fingerprint: "vulnerable-openssl-base-image",
        description:
          "Container image analysis identified the affected OpenSSL package.",
        location: "container:openssl",
      },
    ]);
  },
};

export const scannerAdapters: ScannerAdapter[] = [
  semgrepAdapter,
  zapAdapter,
  realGitleaksAdapter,
  scaAdapter,
  checkovAdapter,
  containerAdapter,
];
