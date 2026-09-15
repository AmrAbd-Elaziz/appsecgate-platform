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
  status: "Completed" | "Failed";
  findings: number;
  rawFindings: RawFinding[];
  durationMs?: number;
  error?: string;
};

export interface ScannerAdapter {
  name: string;
  category: string;

  scan(asset: Asset): Promise<ScannerExecution>;
}
