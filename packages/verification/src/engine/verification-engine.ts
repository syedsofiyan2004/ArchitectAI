import {
  VerificationPlan,
  VerificationRunResult,
  VerificationWorkspace,
  VerificationRunner,
  VerificationCaseResult,
} from '../types.js';
import { VerificationExecutorRegistry } from '../registry/executor-registry.js';
import { VerdictEvaluator } from './verdict-evaluator.js';

export class VerificationEngine implements VerificationRunner {
  constructor(
    private readonly registry: VerificationExecutorRegistry = new VerificationExecutorRegistry(),
    private readonly verdictEvaluator: VerdictEvaluator = new VerdictEvaluator()
  ) {}

  async executePlan(
    plan: VerificationPlan,
    workspace: VerificationWorkspace
  ): Promise<VerificationRunResult> {
    const startTime = Date.now();
    const caseResults: VerificationCaseResult[] = [];

    for (const testCase of plan.cases) {
      const result = await this.registry.executeCase(workspace, testCase);
      caseResults.push(result);
    }

    const durationMs = Date.now() - startTime;
    return this.verdictEvaluator.evaluateRun(plan, caseResults, durationMs);
  }
}
