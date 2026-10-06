import {
  VerificationCase,
  VerificationCaseResult,
  VerificationExecutor,
  VerificationWorkspace,
} from '../types.js';
import { NodeTestHarnessExecutor } from '../executors/node-test-harness.executor.js';

export class VerificationExecutorRegistry {
  private readonly executors: Map<string, VerificationExecutor> = new Map();

  constructor() {
    // Register default Node.js test harness executor
    this.register(new NodeTestHarnessExecutor());
  }

  register(executor: VerificationExecutor): void {
    this.executors.set(executor.id, executor);
  }

  getExecutor(testCase: VerificationCase): VerificationExecutor | undefined {
    for (const executor of this.executors.values()) {
      if (executor.canExecute(testCase)) {
        return executor;
      }
    }
    return undefined;
  }

  async executeCase(
    workspace: VerificationWorkspace,
    testCase: VerificationCase
  ): Promise<VerificationCaseResult> {
    const executor = this.getExecutor(testCase);

    if (!executor) {
      // Inconclusive: no executor registered for this strategy/platform
      return {
        caseId: testCase.id,
        targetInvariantId: testCase.targetInvariantId,
        verdict: 'INCONCLUSIVE',
        isBlocking: true,
        passed: false,
        summary: `Verification inconclusive: no registered executor for strategy '${testCase.strategy}'.`,
        assertions: testCase.assertions.map((a) => ({
          name: a.name,
          expected: a.expected,
          observed: 'NO_EXECUTOR',
          passed: false,
          message: `Executor unavailable for strategy ${testCase.strategy}`,
        })),
        evidence: [],
        durationMs: 0,
        errorDetails: `Unsupported verification strategy: ${testCase.strategy}`,
      };
    }

    try {
      return await executor.execute(workspace, testCase);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return {
        caseId: testCase.id,
        targetInvariantId: testCase.targetInvariantId,
        verdict: 'ERROR',
        isBlocking: true,
        passed: false,
        summary: `Verification error: executor crashed during case execution.`,
        assertions: testCase.assertions.map((a) => ({
          name: a.name,
          expected: a.expected,
          observed: 'CRASH',
          passed: false,
          message: errorMessage,
        })),
        evidence: [],
        durationMs: 0,
        errorDetails: errorMessage,
      };
    }
  }
}
