import * as path from 'node:path';
import {
  ImplementationPlan,
  ImplementationTask,
  AgentExecutionResult,
  EngineeringContract,
  RepositoryContext,
  VerificationPlan,
  VerificationRunResult,
  ProductFailureCode,
  DEFAULT_EXECUTION_TIME_BUDGETS,
  ExecutionTimeBudgets,
} from '@architectai/domain';
import { CodingAgentGateway } from '@architectai/providers';
import { GitIsolationService, GitDiffReport, IsolatedWorktreeSession } from '../services/git-isolation.service.js';
import { ExecutionChecksService, ExecutionCheckResult, NativeCheckSpec } from '../services/execution-checks.service.js';
import { CompileVerificationPlanUseCase } from './compile-verification-plan.use-case.js';
import { VerifyImplementationUseCase } from './verify-implementation.use-case.js';
import { GitWorkspaceService } from '../services/git-workspace.service.js';

export interface PlanExecutionOptions {
  preserveWorktreeOnFailure?: boolean;
  allowDirtyRepo?: boolean;
  signal?: AbortSignal;
  budgets?: Partial<ExecutionTimeBudgets>;
}

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
  nativeChecksPassed: boolean;
  verificationPlan?: VerificationPlan;
  verificationRun?: VerificationRunResult;
  diffReport: GitDiffReport;
  allTasksCompleted: boolean;
  isVerified: boolean;
  worktreeSession?: IsolatedWorktreeSession;
  executedAt: string;
  status: 'COMPLETED' | 'FAILED' | 'CANCELLED';
  failureCode?: ProductFailureCode;
}

export class ExecuteImplementationPlanUseCase {
  constructor(
    private readonly agentGateway: CodingAgentGateway,
    private readonly gitIsolation: GitIsolationService = new GitIsolationService(),
    private readonly executionChecks: ExecutionChecksService = new ExecutionChecksService(),
    private readonly planCompiler: CompileVerificationPlanUseCase = new CompileVerificationPlanUseCase(),
    private readonly verifier: VerifyImplementationUseCase = new VerifyImplementationUseCase(),
    private readonly gitWorkspace: GitWorkspaceService = new GitWorkspaceService()
  ) {}

  async execute(
    plan: ImplementationPlan,
    requestedAgentId?: string,
    contract?: EngineeringContract,
    context?: RepositoryContext,
    options?: PlanExecutionOptions
  ): Promise<PlanExecutionOutput> {
    const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const budgets: ExecutionTimeBudgets = {
      ...DEFAULT_EXECUTION_TIME_BUDGETS,
      ...(options?.budgets || {}),
    };

    // Gate 0: Immediate cancellation check
    if (options?.signal?.aborted) {
      const err = new Error('Execution was cancelled by user prior to starting.');
      (err as any).code = 'USER_CANCELLED';
      throw err;
    }

    // Gate 1: Revalidate repository existence and identity (Section 10 & 11)
    const identityCheck = await this.gitWorkspace.verifyRepositoryIdentity(
      plan.repositoryPath,
      plan.repositoryFingerprint?.initialCommit,
      plan.repositoryFingerprint?.gitRoot
    );

    if (!identityCheck.valid) {
      const err = new Error(identityCheck.reason || 'Repository unavailable or identity mismatch');
      (err as any).code = identityCheck.failureCode || 'REPOSITORY_UNAVAILABLE';
      throw err;
    }

    // Gate 2: Repository Fingerprint & Dirty State Verification (Section 7, 8, 9)
    if (plan.repositoryFingerprint) {
      const currentFp = await this.gitWorkspace.computeFingerprint(plan.repositoryPath);

      // Check for HEAD divergence
      if (currentFp.headCommit !== plan.repositoryFingerprint.headCommit) {
        const err = new Error(
          `Repository HEAD has changed (plan compiled at commit ${plan.repositoryFingerprint.headCommit.slice(0, 8)}, current HEAD is ${currentFp.headCommit.slice(0, 8)}). Please recompile implementation plan.`
        );
        (err as any).code = 'REPOSITORY_CHANGED';
        throw err;
      }

      // Check for dirty working tree policy
      if (!currentFp.isClean && !options?.allowDirtyRepo) {
        const err = new Error(
          `Your working tree contains local uncommitted changes (${currentFp.dirtyFilesCount} modified files). ArchitectAI executes strictly from HEAD and these uncommitted changes are not included. Please commit or stash, or acknowledge dirty execution.`
        );
        (err as any).code = 'REPOSITORY_DIRTY';
        throw err;
      }
    }

    // Gate 3: Select coding agent
    const availableAgents = await this.agentGateway.listAvailableAgents();
    let agentEntry = requestedAgentId
      ? availableAgents.find((a) => a.adapter.id === requestedAgentId)
      : availableAgents.find((a) => a.adapter.id === 'deterministic-agent' && a.availability.available)
        || availableAgents.find((a) => a.availability.available);

    if (!agentEntry) {
      agentEntry = availableAgents[0];
    }

    if (!agentEntry) {
      const err = new Error('No coding agent adapters registered in gateway.');
      (err as any).code = 'AGENT_UNAVAILABLE';
      throw err;
    }

    if (!agentEntry.availability.available) {
      const err = new Error(
        `Selected coding agent '${agentEntry.adapter.name}' is unavailable: ${agentEntry.availability.reason || 'Not detected'}`
      );
      (err as any).code = 'AGENT_UNAVAILABLE';
      throw err;
    }

    const adapter = agentEntry.adapter;

    // Step 1: Create isolated Git worktree
    const worktreeSession = await this.gitIsolation.createIsolatedWorktree(
      plan.repositoryPath,
      runId
    );

    // Step 1b: Snapshot native check specs from the ORIGINAL repository BEFORE agent modification.
    // This prevents a malicious/modified package.json from injecting new commands.
    const preAgentCheckSpecs: NativeCheckSpec[] = await this.executionChecks.snapshotNativeCheckSpecs(
      plan.repositoryPath
    );

    const taskResults: AgentExecutionResult[] = [];
    const orderedTasks = this.sortTasksByDependencies(plan.tasks);

    try {
      // Step 2: Execute tasks in dependency order
      for (const task of orderedTasks) {
        if (options?.signal?.aborted) {
          const err = new Error('Execution was cancelled by user during task execution.');
          (err as any).code = 'USER_CANCELLED';
          throw err;
        }

        task.status = 'in_progress';

        const result = await adapter.executeTask(
          {
            repositoryPath: plan.repositoryPath,
            worktreePath: worktreeSession.worktreePath,
            branch: worktreeSession.branch,
            headCommit: worktreeSession.originalHead,
          },
          task,
          { signal: options?.signal, timeoutMs: budgets.codingTaskMs }  // Forward AbortSignal & task budget so cancellation and timeout reach the real process
        );

        // Scope verification: agent must never modify files outside worktree or outside allowedFiles (Section 22)
        for (const modifiedFile of result.changedFiles) {
          const resolvedModified = path.resolve(worktreeSession.worktreePath, modifiedFile);
          if (!resolvedModified.startsWith(path.resolve(worktreeSession.worktreePath))) {
            const err = new Error(`Task ${task.id} modified file outside worktree boundary: ${modifiedFile}`);
            (err as any).code = 'SCOPE_VIOLATION';
            throw err;
          }

          if (task.allowedFiles && task.allowedFiles.length > 0) {
            const normalized = modifiedFile.replace(/\\/g, '/').toLowerCase();
            const isAllowed = task.allowedFiles.some((pat) => {
              const normPat = pat.replace(/\\/g, '/').toLowerCase();
              if (normPat === '*' || normPat === '**') return true;
              if (normPat.endsWith('/**')) {
                const dirPrefix = normPat.slice(0, -3);
                return normalized.startsWith(dirPrefix + '/') || normalized === dirPrefix;
              }
              if (normPat.startsWith('*.')) {
                return normalized.endsWith(normPat.slice(1));
              }
              if (normPat.endsWith('/*')) {
                const dir = normPat.slice(0, -2);
                return path.dirname(normalized).replace(/\\/g, '/') === dir;
              }
              return normalized === normPat || normalized.startsWith(normPat + '/');
            });
            if (!isAllowed) {
              const err = new Error(`Task ${task.id} modified file '${modifiedFile}' which is not in allowedFiles.`);
              (err as any).code = 'SCOPE_VIOLATION';
              throw err;
            }
          }
        }

        taskResults.push(result);
        task.status = result.status === 'completed' ? 'completed' : 'failed';

        if (result.status !== 'completed') {
          break;
        }
      }

      // Step 3: Run PRE-SNAPSHOTTED repository-native checks inside the worktree.
      // Uses the check specs captured from the ORIGINAL repo BEFORE agent modification.
      // This prevents agent-modified package.json from introducing new or malicious commands.
      const executionChecks = await this.executionChecks.runSnapshotChecks(
        worktreeSession.worktreePath,
        preAgentCheckSpecs.map((s) => ({ ...s, timeoutMs: budgets.nativeCheckMs })),
        options?.signal
      );
      const nativeChecksPassed = executionChecks.every((c) => c.passed);

      // Step 4: Run independent ArchitectAI verification against the EXACT modified worktree
      let verificationPlan: VerificationPlan | undefined;
      let verificationRun: VerificationRunResult | undefined;

      if (contract) {
        const emptyContext: RepositoryContext = context || {
          repositoryPath: plan.repositoryPath,
          relevantFiles: [],
          relevantDirectories: [],
          relevantManifests: [],
          probableEntryPoints: [],
          existingTests: [],
          implementationObservations: [],
          unresolvedQuestions: [],
          filesInspected: 0,
          filesOmitted: 0,
          contextBytes: 0,
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

      const shouldPreserve = Boolean(
        options?.preserveWorktreeOnFailure && verificationRun && !verificationRun.isVerified
      );

      if (!shouldPreserve) {
        // Step 6: Clean up worktree directory
        await this.gitIsolation.cleanupWorktree(
          plan.repositoryPath,
          worktreeSession.worktreePath
        );
      }

      // Step 7: Verify original branch and HEAD are untouched
      const verification = await this.gitIsolation.verifyOriginalBranchUntouched(
        plan.repositoryPath,
        worktreeSession.originalBranch,
        worktreeSession.originalHead
      );

      const allTasksCompleted = taskResults.every((r) => r.status === 'completed');
      const isVerified = verificationRun ? verificationRun.isVerified : false;

      let status: 'COMPLETED' | 'FAILED' | 'CANCELLED' = 'COMPLETED';
      let failureCode: ProductFailureCode | undefined;

      if (!allTasksCompleted) {
        status = 'FAILED';
        const timedOutTask = taskResults.find((r) => r.failureReason?.includes('timed out') || r.failureReason?.includes('TIMED_OUT'));
        failureCode = timedOutTask ? 'TIMED_OUT' : 'AGENT_FAILED';
      } else if (!nativeChecksPassed) {
        status = 'FAILED';
        failureCode = 'NATIVE_CHECK_FAILED';
      } else if (verificationRun && !verificationRun.isVerified) {
        status = 'FAILED';
        failureCode = verificationRun.overallStatus === 'INCONCLUSIVE'
          ? 'VERIFICATION_INCONCLUSIVE'
          : verificationRun.overallStatus === 'ERROR'
          ? 'VERIFICATION_ERROR'
          : 'VERIFICATION_FAILED';
      }

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
        nativeChecksPassed,
        verificationPlan,
        verificationRun,
        diffReport,
        allTasksCompleted,
        isVerified,
        worktreeSession: shouldPreserve ? worktreeSession : undefined,
        executedAt: new Date().toISOString(),
        status,
        failureCode,
      };
    } catch (err: unknown) {
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
