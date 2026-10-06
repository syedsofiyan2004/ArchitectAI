import {
  EngineeringContract,
  ImplementationPlan,
  RepositoryContext,
  VerificationPlan,
  VerificationRunResult,
  VerificationCaseResult,
  FailureDiagnosis,
  FailureDiagnosisSchema,
  FailureClassification,
} from '@architectai/domain';
import {
  ProviderAdapter,
  DeterministicDemoProviderAdapter,
} from '@architectai/providers';
import { GitDiffReport } from '../services/git-isolation.service.js';

export interface DiagnoseFailureInput {
  contract: EngineeringContract;
  implementationPlan: ImplementationPlan;
  repositoryContext: RepositoryContext;
  verificationPlan: VerificationPlan;
  verificationRun: VerificationRunResult;
  diffReport?: GitDiffReport;
}

/**
 * DiagnoseVerificationFailureUseCase inspects failed verification results and derives
 * evidence-grounded FailureDiagnosis items.
 *
 * Constitutional Principles:
 * 1. Measured evidence is the immutable source of truth. The provider may infer WHY
 *    evidence occurred, but cannot alter WHAT the evidence says.
 * 2. Invented or hallucinated evidence references are strictly rejected.
 * 3. Failure classification governs repair eligibility. Only IMPLEMENTATION_DEFECT
 *    and INCOMPLETE_IMPLEMENTATION can enter automatic code repair.
 */
export class DiagnoseVerificationFailureUseCase {
  constructor(
    protected readonly provider: ProviderAdapter = new DeterministicDemoProviderAdapter()
  ) {}

  async execute(input: DiagnoseFailureInput): Promise<FailureDiagnosis[]> {
    const { contract, implementationPlan, repositoryContext, verificationRun, diffReport } = input;

    // Filter to failed cases only
    const failedCases = verificationRun.caseResults.filter((c) => c.verdict === 'FAIL');
    if (failedCases.length === 0) {
      return [];
    }

    const diagnoses: FailureDiagnosis[] = [];

    for (const failedCase of failedCases) {
      const diagnosis = await this.diagnoseCase(
        failedCase,
        contract,
        implementationPlan,
        repositoryContext,
        diffReport
      );
      diagnoses.push(diagnosis);
    }

    return diagnoses;
  }

  private async diagnoseCase(
    failedCase: VerificationCaseResult,
    contract: EngineeringContract,
    _plan: ImplementationPlan,
    context: RepositoryContext,
    diffReport?: GitDiffReport
  ): Promise<FailureDiagnosis> {
    const invariant = contract.invariants.find((i) => i.id === failedCase.targetInvariantId);
    const spec = contract.verificationSpecs.find(
      (s) => s.target === failedCase.targetInvariantId
    );
    const decisions = contract.decisions;
    const concerns = contract.discoveredConcerns;

    // Extract ground truth failed assertions and evidence
    const failedAssertions = failedCase.assertions.filter((a) => !a.passed);
    const primaryFailedAssertion = failedAssertions[0];
    const availableEvidenceIds = new Set(failedCase.evidence.map((e) => e.id));

    // Expected & observed from actual measured software evidence
    const expectedMetric = primaryFailedAssertion?.expected ?? 'N/A';
    const observedMetric = primaryFailedAssertion?.observed ?? 'N/A';
    const assertionMessages = failedAssertions.map(
      (a) => a.message || `${a.name}: expected ${String(a.expected)}, observed ${String(a.observed)}`
    );

    // Prompt provider for root-cause diagnosis
    const prompt = `
Failed Invariant:
- ID: ${invariant?.id || failedCase.targetInvariantId}
- Property: ${invariant?.property || 'Unknown'}

Failed Verification Case:
- Case ID: ${failedCase.caseId}
- Summary: ${failedCase.summary}
- Failed Assertions:
${assertionMessages.map((m) => `  * ${m}`).join('\n')}

Measured Evidence:
${failedCase.evidence.map((e) => `- ID: ${e.id} [${e.kind}] name=${e.name} expected=${String(e.expected)} observed=${String(e.observed)}`).join('\n')}

Architecture Decisions:
${decisions.map((d) => `- ${d.id}: ${d.selectedOptionName} (${d.rationale})`).join('\n')}

Discovered Concerns:
${concerns.map((c) => `- ${c.id}: ${c.title}`).join('\n')}

Relevant Repository Context Files:
${context.relevantFiles.join('\n')}

Changed Files in Diff:
${diffReport?.changedFiles.join('\n') || 'None'}
`;

    let providerDiagnosis: FailureDiagnosis;

    try {
      const response = await this.provider.generateStructured<FailureDiagnosis>({
        schema: FailureDiagnosisSchema,
        schemaName: 'FailureDiagnosis',
        messages: [
          {
            role: 'system',
            content:
              'You are ArchitectAI Evidence Diagnosis Engine. Analyze the failed verification case and identify the root cause failure mechanism. Preserve measured evidence exactly. Do not alter expected or observed values.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      providerDiagnosis = FailureDiagnosisSchema.parse(response.data);
    } catch {
      // Fallback deterministic diagnosis if provider fails to emit valid schema
      providerDiagnosis = {
        id: `diag-${Date.now()}-${failedCase.caseId}`,
        verificationCaseId: failedCase.caseId,
        targetInvariantId: failedCase.targetInvariantId,
        targetSpecId: spec?.id,
        sourceConcernIds: concerns.map((c) => c.id),
        sourceDecisionIds: decisions.map((d) => d.id),
        classification: 'IMPLEMENTATION_DEFECT',
        expectedBehavior: `Expected: ${String(expectedMetric)}`,
        observedBehavior: `Observed: ${String(observedMetric)}`,
        expectedMetricValue: expectedMetric,
        observedMetricValue: observedMetric,
        assertionFailureMessages: assertionMessages,
        evidenceReferences: Array.from(availableEvidenceIds),
        likelyFailureMechanism: `Implementation did not enforce property: ${invariant?.property}`,
        likelyAffectedFiles: diffReport?.changedFiles || context.relevantFiles.slice(0, 3),
        likelyAffectedSymbols: [],
        confidence: 0.85,
        assumptions: ['Implementation contains boundary or synchronization defect'],
        unresolvedQuestions: [],
        isRepairable: true,
        requiresArchitectureReview: false,
        createdAt: new Date().toISOString(),
      };
    }

    // STRICT GROUNDING ENFORCEMENT:
    // 1. Filter out invented evidence references
    const validatedEvidenceRefs = (providerDiagnosis.evidenceReferences || []).filter((refId) =>
      availableEvidenceIds.has(refId)
    );
    if (validatedEvidenceRefs.length === 0 && availableEvidenceIds.size > 0) {
      // Ensure real evidence references are preserved
      validatedEvidenceRefs.push(...Array.from(availableEvidenceIds));
    }

    // 2. Preserve exact measured expected and observed values
    const groundedDiagnosis: FailureDiagnosis = {
      ...providerDiagnosis,
      id: providerDiagnosis.id || `diag-${Date.now()}-${failedCase.caseId}`,
      verificationCaseId: failedCase.caseId,
      targetInvariantId: failedCase.targetInvariantId,
      targetSpecId: spec?.id,
      expectedMetricValue: expectedMetric,
      observedMetricValue: observedMetric,
      expectedBehavior: providerDiagnosis.expectedBehavior || `Expected: ${String(expectedMetric)}`,
      observedBehavior: providerDiagnosis.observedBehavior || `Observed: ${String(observedMetric)}`,
      assertionFailureMessages: assertionMessages,
      evidenceReferences: validatedEvidenceRefs,
      isRepairable: this.isClassificationRepairable(providerDiagnosis.classification),
      requiresArchitectureReview: this.requiresArchitectureReview(providerDiagnosis.classification),
      createdAt: providerDiagnosis.createdAt || new Date().toISOString(),
    };

    return FailureDiagnosisSchema.parse(groundedDiagnosis);
  }

  private isClassificationRepairable(classification: FailureClassification): boolean {
    return (
      classification === 'IMPLEMENTATION_DEFECT' ||
      classification === 'INCOMPLETE_IMPLEMENTATION'
    );
  }

  private requiresArchitectureReview(classification: FailureClassification): boolean {
    return (
      classification === 'ARCHITECTURE_DECISION_INVALID' ||
      classification === 'WRONG_ASSUMPTION'
    );
  }
}
