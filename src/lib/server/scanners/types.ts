import type {
  Asset,
  Severity,
} from "../../../data/appsecgate";

export type RawFinding = {
  id: string;
  scanner: string;
  category: string;
  title: string;
  severity: Severity;
  fingerprint: string;
  description: string;
  location?: string;
  cwe?: string;
};

export type ScannerExecution = {
  category: string;
  tool: string;
  status: "Completed";
  findings: number;
  rawFindings: RawFinding[];
};

export interface ScannerAdapter {
  name: string;
  category: string;

  scan(asset: Asset): ScannerExecution;
}
