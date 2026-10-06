import { describe, it, expect } from 'vitest';
import {
  EngineeringContract,
  ImplementationPlan,
  RepositoryContext,
  VerificationPlan,
  VerificationRunResult,
  FailureDiagnosisSchema,
} from '@architectai/domain';
import { DeterministicDemoProviderAdapter } from '@architectai/providers';
import { DiagnoseVerificationFailureUseCase } from './use-cases/diagnose-failure.use-case.js';

describe('DiagnoseVerificationFailureUseCase (Evidence Grounding & Eligibility)', () => {
  const dummyContract: EngineeringContract = {
    id: 'contract-demo-a',
    requirement: {
      id: 'req-1',
      rawIntent: 'Limit each authenticated user to 5 requests per minute.',
      explicitConstraints: [],
      declaredTechStack: ['Node.js'],
      context: {},
    },
    discoveredConcerns: [
      {
        id: 'concern-rate-limit',
        title: 'Boundary burst vulnerability',
        description: 'Fixed windows permit 2x traffic bursts at boundary',
        category: 'RELIABILITY',
        severity: 'CRITICAL',
        knowledgeItemIds: [],
        engineeringDimensions: ['bounded_resource', 'time_window'],
      },
    ],
    decisions: [
      {
        id: 'dec-sliding-window',
        title: 'Use Sliding Window Rate Limiting',
        status: 'ACCEPTED',
        engineeringConcernIds: ['concern-rate-limit'],
        selectedOptionName: 'Sliding Window Counter',
        rationale: 'Smooths boundary bursts and prevents 2x capacity violations',
        assumptions: [],
        tradeoffs: [],
      },
    ],
    invariants: [
      {
        id: 'inv-rate-limit-5',
        property: 'At most 5 requests allowed in any rolling 60000ms window',
        enforcementTier: 'BLOCKING',
        verificationMethod: 'ADVERSARIAL_HARNESS',
      },
    ],
    verificationSpecs: [
      {
        id: 'spec-1',
        title: 'Boundary burst test',
        target: 'inv-rate-limit-5',
        level: 'ADVERSARIAL',
        automatedCheck: 'node_test_harness',
      },
    ],
    implementationConstraints: [],
    metadata: {
      generatedAt: new Date().toISOString(),
      providerId: 'deterministic-demo',
      providerModel: 'kernel',
      confidence: 0.95,
      version: '1.0.0',
    },
    version: '1.0.0',
    assumptions: [],
    unresolvedQuestions: [],
  };

  const dummyPlan: ImplementationPlan = {
    id: 'plan-1',
    contractId: 'contract-demo-a',
    repositoryPath: '/mock/repo',
    tasks: [],
    summary: 'Mock Plan',
    createdAt: new Date().toISOString(),
  };

  const dummyContext: RepositoryContext = {
    repositoryPath: '/mock/repo',
    relevantFiles: ['src/rate-limiter.ts'],
    relevantDirectories: ['src'],
    relevantManifests: [],
    probableEntryPoints: [],
    existingTests: [],
    implementationObservations: [],
    unresolvedQuestions: [],
  };

  const dummyVerificationPlan: VerificationPlan = {
    id: 'vplan-1',
    contractId: 'contract-demo-a',
    repositoryPath: '/mock/repo',
    cases: [],
    summary: 'Verification Plan',
    createdAt: new Date().toISOString(),
  };

  it('preserves exact measured evidence values without model hallucination', async () => {
    const failedRun: VerificationRunResult = {
      runId: 'vrun-1',
      planId: 'vplan-1',
      contractId: 'contract-demo-a',
      executedAt: new Date().toISOString(),
      durationMs: 120,
      overallStatus: 'FAILED',
      isVerified: false,
      caseResults: [
        {
          caseId: 'case-burst-test',
          targetInvariantId: 'inv-rate-limit-5',
          strategy: 'node_test_harness',
          verdict: 'FAIL',
          summary: 'Rolling limit violated across boundary',
          durationMs: 120,
          assertions: [
            {
              name: 'max_requests_in_window',
              expected: 5,
              observed: 10,
              passed: false,
              message: 'Expected at most 5 requests, observed 10 across boundary',
            },
          ],
          evidence: [
            {
              id: 'ev-measured-10',
              kind: 'numeric_metric',
              name: 'rolling_request_count',
              expected: 5,
              observed: 10,
              unit: 'requests',
            },
          ],
        },
      ],
      nativeCheckResults: [],
      summary: '1 case failed',
    };

    const useCase = new DiagnoseVerificationFailureUseCase(new DeterministicDemoProviderAdapter());
    const diagnoses = await useCase.execute({
      contract: dummyContract,
      implementationPlan: dummyPlan,
      repositoryContext: dummyContext,
      verificationPlan: dummyVerificationPlan,
      verificationRun: failedRun,
    });

    expect(diagnoses).toHaveLength(1);
    const diag = diagnoses[0]!;

    // Validate schema
    expect(FailureDiagnosisSchema.safeParse(diag).success).toBe(true);

    // Strict evidence preservation
    expect(diag.targetInvariantId).toBe('inv-rate-limit-5');
    expect(diag.expectedMetricValue).toBe(5);
    expect(diag.observedMetricValue).toBe(10);
    expect(diag.evidenceReferences).toContain('ev-measured-10');
    expect(diag.isRepairable).toBe(true);
    expect(diag.classification).toBe('IMPLEMENTATION_DEFECT');
    expect(diag.requiresArchitectureReview).toBe(false);
  });

  it('filters out hallucinated or invented evidence references', async () => {
    // Provider returning hallucinated evidence ID
    const mockProvider = {
      id: 'mock-hallucinating-provider',
      name: 'Hallucinating Provider',
      getCapabilities: () => ({
        supportsStructuredOutput: true,
        supportsStreaming: false,
        maxContextTokens: 4096,
      }),
      generateText: async () => ({ content: '' }),
      generateStructured: async () => ({
        content: '',
        data: {
          id: 'diag-hallucinated',
          verificationCaseId: 'case-burst-test',
          targetInvariantId: 'inv-rate-limit-5',
          classification: 'IMPLEMENTATION_DEFECT',
          expectedBehavior: 'Expected 5',
          observedBehavior: 'Observed 10',
          evidenceReferences: ['ev-nonexistent-invented-id'], // invented
          likelyFailureMechanism: 'Flawed boundary handling',
          likelyAffectedFiles: ['src/rate-limiter.ts'],
          confidence: 0.9,
          isRepairable: true,
          requiresArchitectureReview: false,
          createdAt: new Date().toISOString(),
        },
      }),
    };

    const failedRun: VerificationRunResult = {
      runId: 'vrun-1',
      planId: 'vplan-1',
      contractId: 'contract-demo-a',
      executedAt: new Date().toISOString(),
      durationMs: 120,
      overallStatus: 'FAILED',
      isVerified: false,
      caseResults: [
        {
          caseId: 'case-burst-test',
          targetInvariantId: 'inv-rate-limit-5',
          strategy: 'node_test_harness',
          verdict: 'FAIL',
          summary: 'Rolling limit violated',
          durationMs: 120,
          assertions: [
            {
              name: 'max_requests',
              expected: 5,
              observed: 10,
              passed: false,
            },
          ],
          evidence: [
            {
              id: 'ev-real-measured-1',
              kind: 'numeric_metric',
              name: 'real_metric',
              expected: 5,
              observed: 10,
            },
          ],
        },
      ],
      nativeCheckResults: [],
      summary: '1 case failed',
    };

    const useCase = new DiagnoseVerificationFailureUseCase(mockProvider as any);
    const diagnoses = await useCase.execute({
      contract: dummyContract,
      implementationPlan: dummyPlan,
      repositoryContext: dummyContext,
      verificationPlan: dummyVerificationPlan,
      verificationRun: failedRun,
    });

    expect(diagnoses).toHaveLength(1);
    const diag = diagnoses[0]!;
    // Invented ref must be filtered out; real ref must be preserved
    expect(diag.evidenceReferences).not.toContain('ev-nonexistent-invented-id');
    expect(diag.evidenceReferences).toContain('ev-real-measured-1');
  });

  it('marks ARCHITECTURE_DECISION_INVALID as requiring architecture review and not repairable', async () => {
    const mockArchProvider = {
      id: 'mock-arch-provider',
      name: 'Arch Provider',
      getCapabilities: () => ({
        supportsStructuredOutput: true,
        supportsStreaming: false,
        maxContextTokens: 4096,
      }),
      generateText: async () => ({ content: '' }),
      generateStructured: async () => ({
        content: '',
        data: {
          id: 'diag-arch-invalid',
          verificationCaseId: 'case-burst-test',
          targetInvariantId: 'inv-rate-limit-5',
          classification: 'ARCHITECTURE_DECISION_INVALID',
          expectedBehavior: 'Sub-millisecond hardware atomic guarantee',
          observedBehavior: 'Network partition prevents consensus without physical clock synchronization',
          evidenceReferences: ['ev-real-1'],
          likelyFailureMechanism: 'Accepted architecture decision conflicts with distributed consensus limits',
          likelyAffectedFiles: [],
          confidence: 0.95,
          isRepairable: false,
          requiresArchitectureReview: true,
          reconsiderationRationale: 'Architecture must adopt relaxed consistency model',
          createdAt: new Date().toISOString(),
        },
      }),
    };

    const failedRun: VerificationRunResult = {
      runId: 'vrun-1',
      planId: 'vplan-1',
      contractId: 'contract-demo-a',
      executedAt: new Date().toISOString(),
      durationMs: 120,
      overallStatus: 'FAILED',
      isVerified: false,
      caseResults: [
        {
          caseId: 'case-burst-test',
          targetInvariantId: 'inv-rate-limit-5',
          strategy: 'node_test_harness',
          verdict: 'FAIL',
          summary: 'Partition tolerance failure',
          durationMs: 120,
          assertions: [
            {
              name: 'sync_latency',
              expected: 1,
              observed: 500,
              passed: false,
            },
          ],
          evidence: [
            {
              id: 'ev-real-1',
              kind: 'numeric_metric',
              name: 'sync_ms',
              expected: 1,
              observed: 500,
            },
          ],
        },
      ],
      nativeCheckResults: [],
      summary: '1 case failed',
    };

    const useCase = new DiagnoseVerificationFailureUseCase(mockArchProvider as any);
    const diagnoses = await useCase.execute({
      contract: dummyContract,
      implementationPlan: dummyPlan,
      repositoryContext: dummyContext,
      verificationPlan: dummyVerificationPlan,
      verificationRun: failedRun,
    });

    expect(diagnoses).toHaveLength(1);
    const diag = diagnoses[0]!;
    expect(diag.classification).toBe('ARCHITECTURE_DECISION_INVALID');
    expect(diag.isRepairable).toBe(false);
    expect(diag.requiresArchitectureReview).toBe(true);
  });
  it('falls back to DIAGNOSIS_UNAVAILABLE when provider diagnosis generation fails', async () => {
    const mockFailingProvider = {
      id: 'mock-fail-provider',
      name: 'Fail Provider',
      getCapabilities: () => ({
        supportsStructuredOutput: true,
        supportsStreaming: false,
        maxContextTokens: 4096,
      }),
      generateText: async () => ({ content: '' }),
      generateStructured: async () => {
        throw new Error('Provider structured output failed completely');
      },
    };

    const failedRun: VerificationRunResult = {
      runId: 'vrun-1',
      planId: 'vplan-1',
      contractId: 'contract-demo-a',
      executedAt: new Date().toISOString(),
      durationMs: 120,
      overallStatus: 'FAILED',
      isVerified: false,
      caseResults: [
        {
          caseId: 'case-burst-test',
          targetInvariantId: 'inv-rate-limit-5',
          strategy: 'node_test_harness',
          verdict: 'FAIL',
          summary: 'Rolling limit violated across boundary',
          durationMs: 120,
          assertions: [
            {
              name: 'max_requests',
              expected: 5,
              observed: 10,
              passed: false,
              message: 'Expected 5, got 10',
            },
          ],
          evidence: [
            {
              id: 'ev-1',
              kind: 'numeric_metric',
              name: 'rolling_request_count',
              expected: 5,
              observed: 10,
            },
          ],
        },
      ],
      nativeCheckResults: [],
      summary: '1 case failed',
    };

    const useCase = new DiagnoseVerificationFailureUseCase(mockFailingProvider as any);
    const diagnoses = await useCase.execute({
      contract: dummyContract,
      implementationPlan: dummyPlan,
      repositoryContext: dummyContext,
      verificationPlan: dummyVerificationPlan,
      verificationRun: failedRun,
    });

    expect(diagnoses).toHaveLength(1);
    const diag = diagnoses[0]!;
    expect(diag.classification).toBe('DIAGNOSIS_UNAVAILABLE');
    expect(diag.isRepairable).toBe(false);
    expect(diag.expectedMetricValue).toBe(5);
    expect(diag.observedMetricValue).toBe(10);
    expect(diag.evidenceReferences).toContain('ev-1');
  });
});
