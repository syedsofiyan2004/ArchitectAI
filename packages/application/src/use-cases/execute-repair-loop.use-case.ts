import {
  EngineeringContract,
  ImplementationPlan,
  RepositoryContext,
  VerificationPlan,
  VerificationRunResult,
  FailureDiagnosis,
  RepairPlan,
  RepairAttempt,
  RepairOutcome,
  RepairRunResult,
  RepairRunResultSchema,
} from '@architectai/domain';
import { CodingAgentGateway } from '@architectai/providers';
import { GitIsolationService, GitDiffReport, IsolatedWorktreeSession } from '../services/git-isolation.service.js';
import { ExecutionChecksService } from '../services/execution-checks.service.js';
import { VerifyImplementationUseCase } from './verify-implementation.use-case.js';
import { CompileRepairPlanUseCase } from './compile-repair-plan.use-case.js';
import { DiagnoseVerificationFailureUseCase } from './diagnose-failure.use-case.js';
import { RepairSessionService } from '../services/repair-session.service.js';
import { RepairPolicyValidator } from '../services/repair-policy-validator.js';

export interface ExecuteRepairLoopInput {
  contract: EngineeringContract;
  implementationPlan: ImplementationPlan;
  verificationPlan: VerificationPlan;
  initialVerificationRun: VerificationRunResult;
  context: RepositoryContext;
  worktreeSession?: IsolatedWorktreeSession;
  diagnoses?: FailureDiagnosis[];
  repairPlan?: RepairPlan;
  diffReport?: GitDiffReport;
  maxAttempts?: number;
  agentId?: string;
  cleanupWorktreeOnFinish?: boolean;
}

/**
 * ExecuteRepairLoopUseCase orchestrates evidence-grounded diagnosis, bounded repair planning,
 * coding agent execution, and re-verification in a strictly isolated worktree session.
 *
 * Constitutional Principles:
 * 1. Measured evidence is the immutable source of truth.
 * 2. Only implementation defects enter code repair. Architecture conflicts stop for human review.
 * 3. Never weakens the verification plan across repair attempts.
 * 4. Strictly protects tests, CI, and package scripts via anti-test-gaming policy.
 * 5. Bounded maximum attempts with progress tracking and early exit on success.
 */
export class ExecuteRepairLoopUseCase {
  constructor(
    private readonly agentGateway: CodingAgentGateway,
    private readonly repairSession: RepairSessionService = new RepairSessionService(),
    private readonly policyValidator: RepairPolicyValidator = new RepairPolicyValidator(),
    private readonly executionChecks: ExecutionChecksService = new ExecutionChecksService(),
    private readonly verifier: VerifyImplementationUseCase = new VerifyImplementationUseCase(),
    private readonly planCompiler: CompileRepairPlanUseCase = new CompileRepairPlanUseCase(),
    private readonly failureDiagnoser: DiagnoseVerificationFailureUseCase = new DiagnoseVerificationFailureUseCase(),
    private readonly gitIsolation: GitIsolationService = new GitIsolationService()
  ) {}

  async execute(input: ExecuteRepairLoopInput): Promise<RepairRunResult> {
    const startTime = Date.now();
    const maxAttempts = input.maxAttempts ?? 3;

    // Gate 1: Check Eligibility based on initial verification verdict
    if (input.initialVerificationRun.overallStatus === 'ERROR') {
      return RepairRunResultSchema.parse({
        repairPlanId: `unassigned-${Date.now()}`,
        contractId: input.contract.id,
        outcome: 'VERIFICATION_BLOCKED',
        attempts: [],
        totalAttempts: 0,
        maxAttempts,
        isRepaired: false,
        finalVerificationResult: input.initialVerificationRun,
        escalationReason: 'Verification infrastructure error encountered. Automatic code repair is not permitted.',
        durationMs: Date.now() - startTime,
        completedAt: new Date().toISOString(),
      });
    }

    if (input.initialVerificationRun.overallStatus === 'INCONCLUSIVE') {
      return RepairRunResultSchema.parse({
        repairPlanId: `unassigned-${Date.now()}`,
        contractId: input.contract.id,
        outcome: 'VERIFICATION_BLOCKED',
        attempts: [],
        totalAttempts: 0,
        maxAttempts,
        isRepaired: false,
        finalVerificationResult: input.initialVerificationRun,
        escalationReason: 'Inconclusive verification verdict. Automatic code repair is not permitted without decisive verification.',
        durationMs: Date.now() - startTime,
        completedAt: new Date().toISOString(),
      });
    }

    if (input.initialVerificationRun.isVerified) {
      return RepairRunResultSchema.parse({
        repairPlanId: `plan-verified-${Date.now()}`,
        contractId: input.contract.id,
        outcome: 'REPAIRED',
        attempts: [],
        totalAttempts: 0,
        maxAttempts,
        isRepaired: true,
        finalVerificationResult: input.initialVerificationRun,
        repairedInvariants: input.contract.invariants.map((i) => i.id),
        unresolvedInvariants: [],
        durationMs: Date.now() - startTime,
        completedAt: new Date().toISOString(),
      });
    }

    // Gate 2: Extract or compute FailureDiagnosis
    const diagnoses =
      input.diagnoses && input.diagnoses.length > 0
        ? input.diagnoses
        : await this.failureDiagnoser.execute({
            contract: input.contract,
            implementationPlan: input.implementationPlan,
            repositoryContext: input.context,
            verificationPlan: input.verificationPlan,
            verificationRun: input.initialVerificationRun,
            diffReport: input.diffReport,
          });

    // Gate 3: Check for Architecture Invalidation
    const archConflictDiag = diagnoses.find(
      (d) =>
        d.classification === 'ARCHITECTURE_DECISION_INVALID' ||
        d.requiresArchitectureReview
    );

    if (archConflictDiag) {
      if (input.worktreeSession && input.cleanupWorktreeOnFinish) {
        await this.gitIsolation.cleanupWorktree(
          input.implementationPlan.repositoryPath || input.context.repositoryPath,
          input.worktreeSession.worktreePath
        );
      }

      return RepairRunResultSchema.parse({
        repairPlanId: `repair-arch-review-${Date.now()}`,
        contractId: input.contract.id,
        outcome: 'ARCHITECTURE_REVIEW_REQUIRED',
        attempts: [],
        totalAttempts: 0,
        maxAttempts,
        isRepaired: false,
        finalVerificationResult: input.initialVerificationRun,
        unresolvedInvariants: [archConflictDiag.targetInvariantId],
        escalationReason:
          'Verification failure indicates an invalid architectural decision that requires human architectural review.',
        architectureReviewContext: {
          affectedDecisionIds: archConflictDiag.sourceDecisionIds || [],
          rationale: archConflictDiag.likelyFailureMechanism,
          evidenceSummary: `Expected: ${archConflictDiag.expectedBehavior}, Observed: ${archConflictDiag.observedBehavior}`,
        },
        durationMs: Date.now() - startTime,
        completedAt: new Date().toISOString(),
      });
    }

    // Gate 4: Filter to repairable diagnoses
    const repairableDiagnoses = diagnoses.filter((d) => d.isRepairable);
    if (repairableDiagnoses.length === 0) {
      if (input.worktreeSession && input.cleanupWorktreeOnFinish) {
        await this.gitIsolation.cleanupWorktree(
          input.implementationPlan.repositoryPath || input.context.repositoryPath,
          input.worktreeSession.worktreePath
        );
      }

      return RepairRunResultSchema.parse({
        repairPlanId: `repair-unrepairable-${Date.now()}`,
        contractId: input.contract.id,
        outcome: 'NEEDS_HUMAN_REVIEW',
        attempts: [],
        totalAttempts: 0,
        maxAttempts,
        isRepaired: false,
        finalVerificationResult: input.initialVerificationRun,
        escalationReason: 'Failure classification is not eligible for autonomous code repair.',
        durationMs: Date.now() - startTime,
        completedAt: new Date().toISOString(),
      });
    }

    // Gate 5: Compile RepairPlan
    const repairPlan =
      input.repairPlan ??
      (await this.planCompiler.execute({
        diagnoses: repairableDiagnoses,
        contract: input.contract,
        context: input.context,
        implementationPlan: input.implementationPlan,
        diffReport: input.diffReport,
      }));

    // Setup isolated worktree session
    const repoPath = input.implementationPlan.repositoryPath || input.context.repositoryPath;
    const createdSession = !input.worktreeSession;
    const worktreeSession =
      input.worktreeSession ??
      (await this.gitIsolation.createIsolatedWorktree(repoPath, `repair-${Date.now()}`));

    // Gate 6: Select Coding Agent
    const availableAgents = await this.agentGateway.listAvailableAgents();
    let agentEntry = input.agentId
      ? availableAgents.find((a) => a.adapter.id === input.agentId)
      : availableAgents.find((a) => a.availability.available);

    if (!agentEntry) {
      agentEntry = availableAgents[0];
    }
    if (!agentEntry) {
      throw new Error('No coding agent available for repair.');
    }
    const adapter = agentEntry.adapter;

    // Baseline native checks before any repair attempts
    const initialNativeChecks = await this.executionChecks.runDiscoveredChecks(worktreeSession.worktreePath);
    const initiallyPassingNativeChecks = initialNativeChecks.filter(c => c.passed).map(c => c.scriptName);

    // Bounded Repair Loop
    let previousVerificationRun = input.initialVerificationRun;
    let finalVerificationRun = input.initialVerificationRun;
    const attempts: RepairAttempt[] = [];
    let isRepaired = false;

    for (let attemptNumber = 1; attemptNumber <= maxAttempts; attemptNumber++) {
      const attemptStartTime = Date.now();

      // Step A: Create checkpoint in isolated worktree before attempt
      const attemptCheckpointRef = await this.repairSession.createCheckpoint(
        worktreeSession.worktreePath,
        attemptNumber
      );

      // Step B & C: Agent executes repair tasks and we validate per-task scope
      const agentExecutionResults = [];
      let taskExecutionFailed = false;
      let policyViolationReason: string | undefined;
      let currentCheckpointRef = attemptCheckpointRef;

      for (let i = 0; i < repairPlan.tasks.length; i++) {
        const task = repairPlan.tasks[i]!;
        task.status = 'in_progress';
        
        const taskResult = await adapter.executeTask(
          {
            repositoryPath: worktreeSession.worktreePath,
            worktreePath: worktreeSession.worktreePath,
            branch: worktreeSession.branch,
            headCommit: currentCheckpointRef,
          },
          task as any
        );

        agentExecutionResults.push(taskResult);
        task.status = taskResult.status === 'completed' ? 'completed' : 'failed';

        if (taskResult.status !== 'completed') {
          taskExecutionFailed = true;
          break;
        }

        // Validate anti-test-gaming policy strictly against THIS TASK'S scope
        const policyResult = await this.policyValidator.validateAttempt(
          worktreeSession.worktreePath,
          task,
          currentCheckpointRef
        );

        if (!policyResult.passed) {
          policyViolationReason = `Task ${task.id} violated policy: ${policyResult.violations.join('; ')}`;
          break;
        }

        // Create sub-checkpoint so the next task's diff is evaluated cleanly
        currentCheckpointRef = await this.repairSession.createCheckpoint(
          worktreeSession.worktreePath,
          attemptNumber * 1000 + i
        );
      }

      if (policyViolationReason) {
        // Rollback invalid patch completely
        await this.repairSession.rollbackToCheckpoint(
          worktreeSession.worktreePath,
          attemptCheckpointRef
        );

        attempts.push({
          attemptNumber,
          diagnosisIds: repairPlan.diagnoses.map((d) => d.id),
          repairTaskIds: repairPlan.tasks.map((t) => t.id),
          agentExecutionResults,
          changedFiles: [],
          diffSummary: `REPAIR ATTEMPT REJECTED: ${policyViolationReason}`,
          nativeChecks: [],
          verificationResult: previousVerificationRun,
          progress: 'UNCHANGED',
          durationMs: Date.now() - attemptStartTime,
          checkpointRef: attemptCheckpointRef,
          policyPassed: false,
          policyViolationReason,
          executedAt: new Date().toISOString(),
        });
        continue;
      }

      if (taskExecutionFailed) {
        // Rollback failed task
        await this.repairSession.rollbackToCheckpoint(
          worktreeSession.worktreePath,
          attemptCheckpointRef
        );

        attempts.push({
          attemptNumber,
          diagnosisIds: repairPlan.diagnoses.map((d) => d.id),
          repairTaskIds: repairPlan.tasks.map((t) => t.id),
          agentExecutionResults,
          changedFiles: [],
          diffSummary: 'Agent task execution failed',
          nativeChecks: [],
          verificationResult: previousVerificationRun,
          progress: 'UNCHANGED',
          durationMs: Date.now() - attemptStartTime,
          checkpointRef: attemptCheckpointRef,
          policyPassed: true,
          executedAt: new Date().toISOString(),
        });
        continue;
      }

      // Step D: Run repository-native checks
      const nativeChecks = await this.executionChecks.runDiscoveredChecks(
        worktreeSession.worktreePath
      );

      // Verify native checks haven't regressed
      const nativeCheckRegressed = initiallyPassingNativeChecks.some(scriptName => {
        const check = nativeChecks.find(c => c.scriptName === scriptName);
        return check && !check.passed;
      });

      if (nativeCheckRegressed) {
        await this.repairSession.rollbackToCheckpoint(
          worktreeSession.worktreePath,
          attemptCheckpointRef
        );
        
        attempts.push({
          attemptNumber,
          diagnosisIds: repairPlan.diagnoses.map((d) => d.id),
          repairTaskIds: repairPlan.tasks.map((t) => t.id),
          agentExecutionResults,
          changedFiles: [],
          diffSummary: 'REPAIR ATTEMPT REJECTED: Native checks regressed',
          nativeChecks,
          verificationResult: previousVerificationRun,
          progress: 'REGRESSED',
          durationMs: Date.now() - attemptStartTime,
          checkpointRef: attemptCheckpointRef,
          policyPassed: true,
          executedAt: new Date().toISOString(),
        });
        continue;
      }

      // Step E: Re-verify using the EXACT SAME VerificationPlan
      const currentVerificationRun = await this.verifier.execute(input.verificationPlan, {
        repositoryPath: input.implementationPlan.repositoryPath || input.context.repositoryPath,
        worktreePath: worktreeSession.worktreePath,
        baseHead: worktreeSession.originalHead,
        branch: worktreeSession.branch,
      });

      // Step F: Evaluate progress
      const progress = this.repairSession.evaluateProgress(
        previousVerificationRun,
        currentVerificationRun
      );

      // Step G: Capture diff against checkpoint
      const { diff, changedFiles } = await this.repairSession.captureAttemptDiff(
        worktreeSession.worktreePath,
        attemptCheckpointRef
      );

      attempts.push({
        attemptNumber,
        diagnosisIds: repairPlan.diagnoses.map((d) => d.id),
        repairTaskIds: repairPlan.tasks.map((t) => t.id),
        agentExecutionResults,
        changedFiles,
        diffSummary: diff.slice(0, 1000),
        nativeChecks,
        verificationResult: currentVerificationRun,
        progress,
        durationMs: Date.now() - attemptStartTime,
        checkpointRef: attemptCheckpointRef,
        policyPassed: true,
        executedAt: new Date().toISOString(),
      });

      previousVerificationRun = currentVerificationRun;
      finalVerificationRun = currentVerificationRun;

      // Step H: Early exit on success
      if (currentVerificationRun.isVerified) {
        isRepaired = true;
        break;
      }
    }

    // Determine final outcome
    let outcome: RepairOutcome;
    let escalationReason: string | undefined;

    if (isRepaired) {
      outcome = 'REPAIRED';
    } else if (attempts.length >= maxAttempts) {
      outcome = 'MAX_ATTEMPTS_REACHED';
      escalationReason = 'Maximum repair attempts reached without satisfying all engineering invariants.';
    } else if (attempts.some((a) => a.progress === 'IMPROVED')) {
      outcome = 'PARTIALLY_REPAIRED';
      escalationReason = 'Partial progress made but not all invariants verified.';
    } else {
      outcome = 'NEEDS_HUMAN_REVIEW';
      escalationReason = 'Unable to resolve verification failure within attempt budget.';
    }

    if (createdSession || input.cleanupWorktreeOnFinish) {
      await this.gitIsolation.cleanupWorktree(
        repoPath,
        worktreeSession.worktreePath
      );
      await this.gitIsolation.verifyOriginalBranchUntouched(
        repoPath,
        worktreeSession.originalBranch,
        worktreeSession.originalHead
      );
    }

    const passedCases = finalVerificationRun.caseResults.filter((c) => c.verdict === 'PASS');
    const failedCases = finalVerificationRun.caseResults.filter((c) => c.verdict !== 'PASS');

    return RepairRunResultSchema.parse({
      repairPlanId: repairPlan.id,
      contractId: input.contract.id,
      outcome,
      attempts,
      totalAttempts: attempts.length,
      maxAttempts,
      isRepaired,
      finalVerificationResult: finalVerificationRun,
      repairedInvariants: Array.from(new Set(passedCases.map((c) => c.targetInvariantId))),
      unresolvedInvariants: Array.from(new Set(failedCases.map((c) => c.targetInvariantId))),
      escalationReason,
      durationMs: Date.now() - startTime,
      completedAt: new Date().toISOString(),
    });
  }
}
