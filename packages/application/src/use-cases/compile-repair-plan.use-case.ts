import {
  EngineeringContract,
  ImplementationPlan,
  RepositoryContext,
  FailureDiagnosis,
  RepairPlan,
  RepairPlanSchema,
  RepairTask,
} from '@architectai/domain';
import { GitDiffReport } from '../services/git-isolation.service.js';

export interface CompileRepairPlanInput {
  diagnoses: FailureDiagnosis[];
  contract: EngineeringContract;
  context: RepositoryContext;
  implementationPlan: ImplementationPlan;
  diffReport?: GitDiffReport;
}

/**
 * CompileRepairPlanUseCase transforms evidence-grounded failure diagnoses into
 * bounded, schema-valid repair tasks.
 *
 * Constitutional Principles:
 * 1. The task explains WHAT property is broken without prescribing arbitrary code
 *    or disclosing raw hidden test harnesses.
 * 2. Scope is bounded: allowed files are limited to production source files,
 *    and tests/CI/verification files are explicitly protected in excludedFiles.
 * 3. Does not permit weakening verification criteria or assertions.
 */
export class CompileRepairPlanUseCase {
  async execute(input: CompileRepairPlanInput): Promise<RepairPlan> {
    const { diagnoses, contract, context, implementationPlan, diffReport } = input;

    // Filter to repairable diagnoses
    const eligibleDiagnoses = diagnoses.filter(
      (d) => d.isRepairable && !d.requiresArchitectureReview
    );

    if (eligibleDiagnoses.length === 0) {
      throw new Error(
        'Cannot compile repair plan: No repairable diagnoses found. Some failures may require architecture review.'
      );
    }

    const tasks: RepairTask[] = [];
    const protectedExclusions = [
      'test/**',
      'tests/**',
      '**/*.test.*',
      '**/*.spec.*',
      '.github/**',
      '.gitlab-ci.yml',
      'package.json',
      '.architectai/**',
    ];

    for (let i = 0; i < eligibleDiagnoses.length; i++) {
      const diag = eligibleDiagnoses[i]!;
      const invariant = contract.invariants.find((inv) => inv.id === diag.targetInvariantId);

      // Determine likely files
      let candidateFiles = diag.likelyAffectedFiles.filter(
        (f) => !this.isProtectedPattern(f)
      );

      if (candidateFiles.length === 0 && diffReport?.changedFiles) {
        candidateFiles = diffReport.changedFiles.filter(
          (f) => !this.isProtectedPattern(f)
        );
      }

      if (candidateFiles.length === 0 && context.relevantFiles) {
        candidateFiles = context.relevantFiles.filter(
          (f) => !this.isProtectedPattern(f)
        );
      }

      const likelyFiles = candidateFiles.length > 0 ? candidateFiles : ['src/**'];
      const allowedFiles = likelyFiles.map((f) => f.replace(/\\/g, '/'));

      // Construct clear evidence-grounded repair requirements
      const repairRequirements: string[] = [
        `Preserve engineering invariant '${invariant?.property || diag.targetInvariantId}' under concurrent, boundary, and failure conditions.`,
        `Fix root cause failure mechanism: ${diag.likelyFailureMechanism}`,
        `Observed behavior in failed verification: ${diag.observedBehavior}. Required behavior: ${diag.expectedBehavior}.`,
      ];

      if (diag.expectedMetricValue !== undefined && diag.observedMetricValue !== undefined) {
        repairRequirements.push(
          `Measured software evidence: expected ${String(diag.expectedMetricValue)}, but observed ${String(diag.observedMetricValue)}.`
        );
      }

      const acceptanceCriteria: string[] = [
        `Invariant '${invariant?.property || diag.targetInvariantId}' holds without violation.`,
        `Verification case '${diag.verificationCaseId}' passes with measured software evidence.`,
        `All existing repository tests and native build checks pass cleanly.`,
        `No modifications made to test files, CI configurations, or package scripts.`,
      ];

      const repairTask: RepairTask = {
        id: `repair-task-${i + 1}-${diag.targetInvariantId.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        objective: `Enforce invariant '${invariant?.property || diag.targetInvariantId}': fix ${diag.likelyFailureMechanism.toLowerCase()}`,
        targetInvariantIds: [diag.targetInvariantId],
        targetVerificationCaseIds: [diag.verificationCaseId],
        evidenceReferences: diag.evidenceReferences,
        likelyFiles,
        allowedFiles,
        excludedFiles: protectedExclusions,
        repairRequirements,
        acceptanceCriteria,
        dependencies: [],
        riskLevel: diag.confidence < 0.7 ? 'high' : 'medium',
        maxScope: 'Fix implementation defect without modifying existing test suite, package scripts, or CI',
        status: 'pending',
      };

      tasks.push(repairTask);
    }

    const planId = `repair-plan-${Date.now()}`;
    const summary = `Evidence-grounded repair plan addressing ${tasks.length} defects across ${eligibleDiagnoses.length} verified failures.`;

    const plan: RepairPlan = {
      id: planId,
      contractId: contract.id,
      repositoryPath: implementationPlan.repositoryPath || context.repositoryPath,
      diagnoses: eligibleDiagnoses,
      tasks,
      summary,
      createdAt: new Date().toISOString(),
    };

    return RepairPlanSchema.parse(plan);
  }

  private isProtectedPattern(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, '/').toLowerCase();
    return (
      normalized.startsWith('.github/') ||
      normalized.includes('/test/') ||
      normalized.includes('/tests/') ||
      normalized.endsWith('.test.ts') ||
      normalized.endsWith('.spec.ts') ||
      normalized.endsWith('package.json') ||
      normalized.startsWith('.architectai/')
    );
  }
}
