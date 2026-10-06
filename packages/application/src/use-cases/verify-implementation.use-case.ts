import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import {
  VerificationPlan,
  VerificationRunResult,
} from '@architectai/domain';
import {
  VerificationEngine,
  VerificationWorkspace,
} from '@architectai/verification';

export interface VerifyWorkspaceContext {
  repositoryPath: string;
  worktreePath: string;
  baseHead: string;
  branch: string;
}

export class VerifyImplementationUseCase {
  constructor(
    private readonly verificationEngine: VerificationEngine = new VerificationEngine()
  ) {}

  async execute(
    plan: VerificationPlan,
    context: VerifyWorkspaceContext
  ): Promise<VerificationRunResult> {
    const tempVerificationDir = path.join(
      os.tmpdir(),
      'architectai-verification',
      `${plan.implementationRunId}-${Date.now()}`
    );

    fs.mkdirSync(tempVerificationDir, { recursive: true });

    const workspace: VerificationWorkspace = {
      repositoryPath: context.repositoryPath,
      worktreePath: context.worktreePath,
      tempVerificationDir,
      baseHead: context.baseHead,
      branch: context.branch,
    };

    try {
      const result = await this.verificationEngine.executePlan(plan, workspace);
      return result;
    } finally {
      try {
        if (fs.existsSync(tempVerificationDir)) {
          fs.rmSync(tempVerificationDir, { recursive: true, force: true });
        }
      } catch {
        // Best-effort cleanup
      }
    }
  }
}
