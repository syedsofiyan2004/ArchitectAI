import {
  VerificationCase,
  VerificationCaseResult,
  VerificationPlan,
  VerificationRunResult,
  VerificationEvidence,
  VerificationAssertion,
  VerificationCaseAssertionResult,
  VerificationVerdict,
  VerificationOverallStatus,
  VerificationStrategy,
} from '@architectai/domain';

export type {
  VerificationCase,
  VerificationCaseResult,
  VerificationPlan,
  VerificationRunResult,
  VerificationEvidence,
  VerificationAssertion,
  VerificationCaseAssertionResult,
  VerificationVerdict,
  VerificationOverallStatus,
  VerificationStrategy,
};

export interface VerificationWorkspace {
  readonly repositoryPath: string;
  readonly worktreePath: string;
  readonly tempVerificationDir: string;
  readonly baseHead: string;
  readonly branch: string;
}

export interface SandboxExecutionOptions {
  cwd: string;
  timeoutMs?: number;
  maxBufferBytes?: number;
  env?: Record<string, string>;
}

export interface SandboxExecutionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
}

/**
 * Execution sandbox abstraction for running verification tasks safely.
 */
export interface VerificationSandbox {
  readonly id: string;
  executeCommand(
    command: string,
    args: string[],
    options: SandboxExecutionOptions
  ): Promise<SandboxExecutionResult>;
}

/**
 * Verification executor port for executing verification cases.
 */
export interface VerificationExecutor {
  readonly id: string;
  canExecute(testCase: VerificationCase): boolean;
  execute(
    workspace: VerificationWorkspace,
    testCase: VerificationCase,
    harnessContent?: string
  ): Promise<VerificationCaseResult>;
}

/**
 * Verification runner interface for executing verification plans.
 */
export interface VerificationRunner {
  executePlan(
    plan: VerificationPlan,
    workspace: VerificationWorkspace
  ): Promise<VerificationRunResult>;
}
