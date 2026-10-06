import {
  ImplementationPlan,
  ImplementationTask,
  AgentExecutionResult,
  EngineeringContract,
  RepositoryContext,
  VerificationPlan,
  VerificationRunResult,
} from '@architectai/domain';
import { CodingAgentGateway } from '@architectai/providers';
import { GitIsolationService, GitDiffReport } from '../services/git-isolation.service.js';
import { ExecutionChecksService, ExecutionCheckResult } from '../services/execution-checks.service.js';
import { CompileVerificationPlanUseCase } from './compile-verification-plan.use-case.js';
import { VerifyImplementationUseCase } from './verify-implementation.use-case.js';

export interface PlanExecutionOutput {
  plan: ImplementationPlan;
  contract?: EngineeringContract;
  runId: string;
  agentId: string;
  agentName: string;
  isolatedBranch: string;
  originalBranch: string;
  originalHead: string;
  originalBranchUntouched: boolean;
  taskResults: AgentExecutionResult[];
  executionChecks: ExecutionCheckResult[];
  verificationPlan?: VerificationPlan;
  verificationRun?: VerificationRunResult;
  diffReport: GitDiffReport;
  allTasksCompleted: boolean;
  isVerified: boolean;
  executedAt: string;
}

export class ExecuteImplementationPlanUseCase {
  constructor(
    private readonly agentGateway: CodingAgentGateway,
    private readonly gitIsolation: GitIsolationService = new GitIsolationService(),
    private readonly executionChecks: ExecutionChecksService = new ExecutionChecksService(),
    private readonly planCompiler: CompileVerificationPlanUseCase = new CompileVerificationPlanUseCase(),
    private readonly verifier: VerifyImplementationUseCase = new VerifyImplementationUseCase()
  ) {}

  async execute(
    plan: ImplementationPlan,
    requestedAgentId?: string,
    contract?: EngineeringContract,
    context?: RepositoryContext
  ): Promise<PlanExecutionOutput> {
    const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    // Select coding agent
    const availableAgents = await this.agentGateway.listAvailableAgents();
    let agentEntry = requestedAgentId
      ? availableAgents.find((a) => a.adapter.id === requestedAgentId)
      : availableAgents.find((a) => a.availability.available);

    if (!agentEntry) {
      // Fallback to first registered adapter
      agentEntry = availableAgents[0];
    }

    if (!agentEntry) {
      throw new Error('No coding agent adapters registered in gateway.');
    }

    if (!agentEntry.availability.available) {
      throw new Error(
        `Selected coding agent '${agentEntry.adapter.name}' is unavailable: ${agentEntry.availability.reason || 'Not detected'}`
      );
    }

    const adapter = agentEntry.adapter;

    // Step 1: Create isolated Git worktree
    const worktreeSession = await this.gitIsolation.createIsolatedWorktree(
      plan.repositoryPath,
      runId
    );

    const taskResults: AgentExecutionResult[] = [];
    const orderedTasks = this.sortTasksByDependencies(plan.tasks);

    try {
      // Step 2: Execute tasks in dependency order
      for (const task of orderedTasks) {
        task.status = 'in_progress';

        const result = await adapter.executeTask(
          {
            repositoryPath: plan.repositoryPath,
            worktreePath: worktreeSession.worktreePath,
            branch: worktreeSession.branch,
            headCommit: worktreeSession.originalHead,
          },
          task
        );

        taskResults.push(result);
        task.status = result.status === 'completed' ? 'completed' : 'failed';

        if (result.status !== 'completed') {
          // If task failed, stop remaining dependent tasks
          break;
        }
      }

      // Step 3: Run repository-native build/test checks inside worktree
      const executionChecks = await this.executionChecks.runDiscoveredChecks(
        worktreeSession.worktreePath
      );

      // Step 4: Run independent ArchitectAI verification against the EXACT modified worktree
      let verificationPlan: VerificationPlan | undefined;
      let verificationRun: VerificationRunResult | undefined;

      if (contract) {
        // Compile adversarial verification plan post-implementation
        const emptyContext: RepositoryContext = context || {
          repositoryPath: plan.repositoryPath,
          relevantFiles: [],
          relevantDirectories: [],
          relevantManifests: [],
          probableEntryPoints: [],
          existingTests: [],
          implementationObservations: [],
          unresolvedQuestions: [],
        };

        verificationPlan = await this.planCompiler.execute(
          contract,
          emptyContext,
          plan
        );

        verificationRun = await this.verifier.execute(verificationPlan, {
          repositoryPath: plan.repositoryPath,
          worktreePath: worktreeSession.worktreePath,
          baseHead: worktreeSession.originalHead,
          branch: worktreeSession.branch,
        });
      }

      // Step 5: Capture Git diff and status against original HEAD
      const diffReport = await this.gitIsolation.captureDiffAndStatus(
        worktreeSession.worktreePath,
        worktreeSession.originalHead
      );

      // Step 6: Clean up worktree directory
      await this.gitIsolation.cleanupWorktree(
        plan.repositoryPath,
        worktreeSession.worktreePath
      );

      // Step 7: Verify original branch and HEAD are untouched
      const verification = await this.gitIsolation.verifyOriginalBranchUntouched(
        plan.repositoryPath,
        worktreeSession.originalBranch,
        worktreeSession.originalHead
      );

      const allTasksCompleted = taskResults.every((r) => r.status === 'completed');
      const isVerified = verificationRun ? verificationRun.isVerified : false;

      return {
        plan,
        contract,
        runId,
        agentId: adapter.id,
        agentName: adapter.name,
        isolatedBranch: worktreeSession.branch,
        originalBranch: worktreeSession.originalBranch,
        originalHead: worktreeSession.originalHead,
        originalBranchUntouched: verification.untouched,
        taskResults,
        executionChecks,
        verificationPlan,
        verificationRun,
        diffReport,
        allTasksCompleted,
        isVerified,
        executedAt: new Date().toISOString(),
      };
    } catch (err) {
      // Always cleanup worktree even on error
      await this.gitIsolation.cleanupWorktree(
        plan.repositoryPath,
        worktreeSession.worktreePath
      );
      throw err;
    }
  }

  private sortTasksByDependencies(tasks: ImplementationTask[]): ImplementationTask[] {
    const taskMap = new Map<string, ImplementationTask>(tasks.map((t) => [t.id, t]));
    const visited = new Set<string>();
    const ordered: ImplementationTask[] = [];

    const visit = (task: ImplementationTask) => {
      if (visited.has(task.id)) return;
      visited.add(task.id);
      for (const depId of task.dependencies) {
        const dep = taskMap.get(depId);
        if (dep) {
          visit(dep);
        }
      }
      ordered.push(task);
    };

    for (const task of tasks) {
      visit(task);
    }

    return ordered;
  }
}
