import { VerificationSpec } from '@architectai/domain';

export type VerificationExecutionStatus = 'passed' | 'failed' | 'skipped' | 'error';

export interface VerificationEvidenceCollected {
  specId: string;
  name: string;
  payload: string;
  timestamp: string;
}

export interface SingleVerificationResult {
  specId: string;
  status: VerificationExecutionStatus;
  evidence: VerificationEvidenceCollected[];
  durationMs: number;
  errorMessage?: string;
}

export interface VerificationPlan {
  id: string;
  contractId: string;
  specs: VerificationSpec[];
  createdAt: string;
}

export interface VerificationReport {
  planId: string;
  contractId: string;
  allPassed: boolean;
  totalSpecs: number;
  passedCount: number;
  failedCount: number;
  skippedCount: number;
  results: SingleVerificationResult[];
  executedAt: string;
}

/**
 * VerificationRunner interface.
 * Independent verification executor port for executing verification specifications
 * against concrete implementations.
 */
export interface VerificationRunner {
  createPlan(contractId: string, specs: VerificationSpec[]): Promise<VerificationPlan>;
  executePlan(plan: VerificationPlan): Promise<VerificationReport>;
}
