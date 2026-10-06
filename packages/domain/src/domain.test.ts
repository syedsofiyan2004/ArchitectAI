import { describe, it, expect } from 'vitest';
import {
  EngineeringDimensionSchema,
  WellKnownDimensions,
  EngineeringKnowledgeItemSchema,
  EngineeringContractSchema,
  VerificationPlanSchema,
  VerificationRunResultSchema,
} from './index.js';

describe('Domain Schemas', () => {
  it('validates well-known engineering dimensions', () => {
    const valid = EngineeringDimensionSchema.parse(WellKnownDimensions.BOUNDED_RESOURCE);
    expect(valid).toBe('bounded_resource');
  });

  it('permits arbitrary new engineering dimensions (open taxonomy)', () => {
    const customDim = 'quantum_coherence_loss';
    const parsed = EngineeringDimensionSchema.parse(customDim);
    expect(parsed).toBe(customDim);
  });

  it('rejects invalid dimension identifiers', () => {
    expect(() => EngineeringDimensionSchema.parse('')).toThrow();
    expect(() => EngineeringDimensionSchema.parse('invalid dim with spaces!')).toThrow();
  });

  it('validates a complete three-level knowledge item', () => {
    const item = {
      id: 'know-mem-01',
      levels: ['fundamental'],
      title: 'Bounded Buffer and Backpressure',
      description: 'Physical systems have finite memory buffers.',
      dimensions: [WellKnownDimensions.BOUNDED_RESOURCE, WellKnownDimensions.CONCURRENCY],
      triggers: ['High producer throughput', 'Slow consumer'],
      failureMechanisms: ['Buffer accumulation leading to process termination'],
      mitigations: ['Apply backpressure signaling', 'Bound queue capacity'],
      verificationIdeas: ['Saturate producer while halting consumer and observe memory watermark'],
      evidence: [
        {
          id: 'ev-01',
          sourceType: 'specification',
          title: 'Reactive Streams Specification',
          excerptOrClaim: 'Backpressure is a mandatory component to avoid unbounded buffering.',
        },
      ],
      relationships: [],
    };

    const parsed = EngineeringKnowledgeItemSchema.parse(item);
    expect(parsed.id).toBe('know-mem-01');
    expect(parsed.levels).toContain('fundamental');
  });

  it('validates and round-trips an EngineeringContract', () => {
    const contract = {
      id: 'contract-001',
      version: '1.0.0',
      requirement: {
        id: 'req-01',
        rawIntent: 'Ingest events from sensors and forward them reliably.',
        explicitConstraints: ['Max latency 500ms'],
        declaredTechStack: ['Node.js'],
        context: { environment: 'production' },
      },
      discoveredConcerns: [
        {
          id: 'concern-01',
          requirementId: 'req-01',
          title: 'Memory exhaustion under sensor burst',
          description: 'Sensors can send bursts exceeding consumer throughput.',
          applicabilityReason: 'Event ingestion has asymmetric producer/consumer rates.',
          dimensions: [WellKnownDimensions.BOUNDED_RESOURCE, WellKnownDimensions.TIME_WINDOW],
          supportingKnowledgeIds: ['know-mem-01'],
          assumptions: ['Network bandwidth is sufficient'],
          confidence: 0.9,
          unresolvedQuestions: ['What is the peak burst multiplier?'],
        },
      ],
      decisions: [
        {
          id: 'dec-01',
          problemContext: 'Handling burst sensor ingestion without unbounded memory growth.',
          consideredOptions: [
            { id: 'opt-1', name: 'Unbounded in-memory queue', description: 'Store all events in memory' },
            { id: 'opt-2', name: 'Bounded queue with TCP backpressure', description: 'Bound queue and pause stream' },
          ],
          selectedOptionId: 'opt-2',
          selectedOptionName: 'Bounded queue with TCP backpressure',
          rationale: 'Protects process from OOM while preserving event durability.',
          evidence: [],
          assumptions: ['Sensors can pause transmission on TCP window exhaustion'],
          risksAndTradeoffs: ['Sensors with zero buffer capacity might drop messages if network pauses'],
          verificationRequirements: ['Load test producer at 200% capacity and monitor heap usage'],
          reconsiderationTriggers: ['Sensors cannot support backpressure'],
        },
      ],
      invariants: [
        {
          id: 'inv-01',
          property: 'Heap memory usage must not exceed 256MB under any ingestion rate.',
          severity: 'critical',
          blocksCompletion: true,
        },
      ],
      verificationSpecs: [
        {
          id: 'vspec-01',
          target: 'inv-01',
          description: 'Sustained load backpressure test',
          setup: 'Deploy ingestion service with 256MB heap limit; start mock slow downstream consumer.',
          action: 'Send 50,000 events/sec for 60 seconds.',
          expectedProperty: 'Process remains alive; heap usage stabilizes below 200MB; backpressure pauses socket.',
          evidenceToCollect: ['process heap snapshot', 'TCP socket pause logs'],
          isAutomatable: true,
        },
      ],
      assumptions: ['Downstream consumer recovers within 5 seconds'],
      unresolvedQuestions: [],
      metadata: {
        createdAt: '2026-09-30T00:00:00.000Z',
        status: 'proposed',
        tags: ['ingestion', 'reliability'],
      },
    };

    const parsed = EngineeringContractSchema.parse(contract);
    expect(parsed.id).toBe('contract-001');

    const serialized = JSON.stringify(parsed);
    const roundTripped = EngineeringContractSchema.parse(JSON.parse(serialized));
    expect(roundTripped).toEqual(parsed);
  });

  it('validates executable VerificationPlan, VerificationCase, and VerificationRunResult schemas', () => {
    const verificationPlan = {
      id: 'plan-v3-01',
      contractId: 'contract-001',
      implementationRunId: 'run-12345',
      repositoryPath: '/mock/repo',
      baseHead: 'abcdef0123456789',
      cases: [
        {
          id: 'case-01',
          title: 'Adversarial Window Boundary Burst',
          objective: 'Expose 2x quota burst across rolling minute window boundary',
          failureTarget: 'pattern-fixed-window-burst',
          strategy: 'node_test_harness' as const,
          targetInvariantId: 'inv-01',
          targetSpecId: 'vspec-01',
          sourceConcernIds: ['concern-01'],
          sourceDecisionIds: ['decision-01'],
          preconditions: 'Limiter configured with limit 5 per 60000ms',
          stimulus: 'Send 5 requests at t=59s and 5 requests at t=61s',
          expectedProperty: 'Total accepted requests within any 60-second window <= 5',
          assertions: [
            {
              id: 'assert-burst-ceiling',
              name: 'max_accepted_in_rolling_window',
              description: 'Accepted requests across boundary must not exceed limit',
              operator: 'lte' as const,
              expected: 5,
              unit: 'requests',
            },
          ],
          evidenceRequirements: ['accepted_count', 'rejected_count', 'timestamps'],
          timeoutMs: 5000,
          isAutomatable: true,
        },
      ],
      createdAt: new Date().toISOString(),
    };

    const parsedPlan = VerificationPlanSchema.parse(verificationPlan);
    expect(parsedPlan.cases).toHaveLength(1);
    expect(parsedPlan.cases[0].failureTarget).toBe('pattern-fixed-window-burst');

    const runResult = {
      runId: 'run-res-01',
      planId: parsedPlan.id,
      contractId: parsedPlan.contractId,
      overallStatus: 'FAILED' as const,
      isVerified: false,
      summary: 'Adversarial test exposed window boundary burst violation.',
      caseResults: [
        {
          caseId: 'case-01',
          targetInvariantId: 'inv-01',
          verdict: 'FAIL' as const,
          isBlocking: true,
          passed: false,
          summary: 'Accepted 10 requests across window boundary; expected <= 5.',
          assertions: [
            {
              name: 'max_accepted_in_rolling_window',
              expected: 5,
              observed: 10,
              passed: false,
              message: 'Boundary burst allowed 10 requests, exceeding 5.',
            },
          ],
          evidence: [
            {
              id: 'ev-burst-01',
              caseId: 'case-01',
              kind: 'counter',
              name: 'observed_accepted',
              expected: 5,
              observed: 10,
              unit: 'requests',
              capturedAt: new Date().toISOString(),
            },
          ],
          durationMs: 124,
          errorDetails: 'Boundary burst invariant violated.',
        },
      ],
      totalCases: 1,
      passedCases: 0,
      failedCases: 1,
      inconclusiveCases: 0,
      errorCases: 0,
      skippedCases: 0,
      executedAt: new Date().toISOString(),
      durationMs: 140,
    };

    const parsedRunResult = VerificationRunResultSchema.parse(runResult);
    expect(parsedRunResult.overallStatus).toBe('FAILED');
    expect(parsedRunResult.isVerified).toBe(false);
    expect(parsedRunResult.caseResults[0].verdict).toBe('FAIL');
  });
});

