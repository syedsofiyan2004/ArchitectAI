import { describe, it, expect } from 'vitest';
import {
  EngineeringContract,
  WellKnownDimensions,
  VerificationPlanSchema,
} from '@architectai/domain';
import { DeterministicDemoProviderAdapter } from '@architectai/providers';
import { CompileVerificationPlanUseCase } from './use-cases/compile-verification-plan.use-case.js';

describe('Milestone 3 Finalization: Generic Verification Planning (Novel Cases)', () => {
  const dummyPlan = {
    id: 'plan-planning-test',
    contractId: 'contract-test',
    repositoryPath: '/mock/repo',
    summary: 'Verification planning test plan',
    tasks: [],
    createdAt: new Date().toISOString(),
  };

  const dummyContext = {
    repositoryPath: '/mock/repo',
    relevantFiles: [
      'src/index.ts',
      'src/token-manager.ts',
      'src/inventory.ts',
      'src/supplier-client.ts',
      'src/cache.ts',
      'src/mailer.ts',
    ],
    relevantDirectories: ['src'],
    relevantManifests: [],
    probableEntryPoints: ['src/index.ts'],
    existingTestDirectories: ['tests'],
    availableScripts: { test: 'node test.cjs' },
    summary: 'Mock repository context for verification planning',
  };

  const compiler = new CompileVerificationPlanUseCase(new DeterministicDemoProviderAdapter());

  // NOVEL CASE A: Token Refresh Exchange Concurrency (Single-Flight)
  it('A. Devises concurrency single-flight verification for session token refresh', async () => {
    const contract: EngineeringContract = {
      id: 'contract-token-refresh',
      version: '1.0.0',
      requirement: {
        id: 'req-token',
        rawIntent: 'Refresh expired OAuth token when parallel client requests fail 401.',
        explicitConstraints: ['At most 1 upstream refresh exchange per session expiration'],
        declaredTechStack: ['TypeScript', 'Axios'],
        context: {},
      },
      discoveredConcerns: [
        {
          id: 'concern-token-race',
          requirementId: 'req-token',
          title: 'Concurrent Token Refresh Race',
          description: 'Parallel 401 responses race to exchange refresh token, causing revocation.',
          applicabilityReason: 'Multiple in-flight API requests expiring at same timestamp.',
          dimensions: [WellKnownDimensions.CONCURRENCY, WellKnownDimensions.SHARED_MUTABLE_STATE, WellKnownDimensions.RETRY],
          supportingKnowledgeIds: ['pattern-token-refresh-race'],
          assumptions: [],
          confidence: 0.95,
          unresolvedQuestions: [],
        },
      ],
      decisions: [
        {
          id: 'decision-single-flight',
          problemContext: 'Coalesce concurrent token refresh requests.',
          consideredOptions: [],
          selectedOptionId: 'opt-mutex',
          selectedOptionName: 'Single-flight token refresh promise memoization',
          rationale: 'Shares the in-flight exchange Promise among all concurrent callers.',
          evidence: [],
          assumptions: [],
          risksAndTradeoffs: [],
          verificationRequirements: ['Verify upstream auth exchange executes at most once'],
          reconsiderationTriggers: [],
        },
      ],
      invariants: [
        {
          id: 'inv-single-flight-exchange',
          property: 'Only one refresh-token exchange may be active per session expiration',
          severity: 'critical',
          blocksCompletion: true,
        },
      ],
      verificationSpecs: [
        {
          id: 'spec-token-race',
          target: 'inv-single-flight-exchange',
          description: 'Trigger concurrent refresh requests and count upstream calls',
          setup: 'Mock authorization endpoint with 50ms simulated network latency',
          action: 'Simultaneously invoke refreshToken() from 5 concurrent callers',
          expectedProperty: 'upstream_refresh_calls <= 1',
          evidenceToCollect: ['upstream_refresh_calls'],
          isAutomatable: true,
        },
      ],
      assumptions: [],
      unresolvedQuestions: [],
      metadata: { createdAt: new Date().toISOString(), status: 'accepted', tags: ['auth', 'concurrency'] },
    };

    const vPlan = await compiler.execute(contract, dummyContext, dummyPlan);
    expect(VerificationPlanSchema.safeParse(vPlan).success).toBe(true);
    expect(vPlan.cases).toHaveLength(1);

    const tc = vPlan.cases[0]!;
    expect(tc.targetInvariantId).toBe('inv-single-flight-exchange');
    expect(tc.assertions[0]!.name).toBe('upstream_refresh_calls');
    expect(tc.assertions[0]!.operator).toBe('lte');
    expect(tc.assertions[0]!.expected).toBe(1);
    expect(tc.evidenceRequirements).toContain('upstream_refresh_calls');
  });

  // NOVEL CASE B: Concurrent Inventory Decrement (Lost Update Prevention)
  it('B. Devises simultaneous mutation verification for inventory updates', async () => {
    const contract: EngineeringContract = {
      id: 'contract-inventory-lost-update',
      version: '1.0.0',
      requirement: {
        id: 'req-inventory',
        rawIntent: 'Decrement warehouse stock quantity when orders are submitted.',
        explicitConstraints: ['No lost updates under concurrent purchases'],
        declaredTechStack: ['PostgreSQL'],
        context: {},
      },
      discoveredConcerns: [
        {
          id: 'concern-lost-update',
          requirementId: 'req-inventory',
          title: 'Lost Update on Concurrent Read-Modify-Write',
          description: 'Simultaneous inventory adjustments overwrite each other without row locking.',
          applicabilityReason: 'High flash-sale concurrency on hot SKU items.',
          dimensions: [WellKnownDimensions.CONCURRENCY, WellKnownDimensions.SHARED_MUTABLE_STATE],
          supportingKnowledgeIds: ['pattern-lost-update-concurrency'],
          assumptions: [],
          confidence: 0.95,
          unresolvedQuestions: [],
        },
      ],
      decisions: [
        {
          id: 'decision-atomic-decrement',
          problemContext: 'Prevent lost updates on inventory decrement.',
          consideredOptions: [],
          selectedOptionId: 'opt-atomic-update',
          selectedOptionName: 'Atomic database decrement with row lock',
          rationale: 'Applies updates atomically without client-side race.',
          evidence: [],
          assumptions: [],
          risksAndTradeoffs: [],
          verificationRequirements: ['Verify zero lost updates under concurrent decrements'],
          reconsiderationTriggers: [],
        },
      ],
      invariants: [
        {
          id: 'inv-zero-lost-updates',
          property: 'Concurrent inventory decrements may not lose updates',
          severity: 'critical',
          blocksCompletion: true,
        },
      ],
      verificationSpecs: [
        {
          id: 'spec-lost-update',
          target: 'inv-zero-lost-updates',
          description: 'Dispatch 20 concurrent decrements and verify final quantity',
          setup: 'Store initialized with 100 stock units',
          action: 'Fire 20 simultaneous decrement operations',
          expectedProperty: 'lost_updates == 0',
          evidenceToCollect: ['lost_updates', 'final_inventory'],
          isAutomatable: true,
        },
      ],
      assumptions: [],
      unresolvedQuestions: [],
      metadata: { createdAt: new Date().toISOString(), status: 'accepted', tags: ['inventory', 'concurrency'] },
    };

    const vPlan = await compiler.execute(contract, dummyContext, dummyPlan);
    expect(VerificationPlanSchema.safeParse(vPlan).success).toBe(true);
    expect(vPlan.cases).toHaveLength(1);

    const tc = vPlan.cases[0]!;
    expect(tc.targetInvariantId).toBe('inv-zero-lost-updates');
    expect(tc.assertions[0]!.name).toBe('lost_updates');
    expect(tc.assertions[0]!.operator).toBe('eq');
    expect(tc.assertions[0]!.expected).toBe(0);
  });

  // NOVEL CASE C: Downstream Network Timeout Enforcement
  it('C. Devises latency/failure observation for downstream network timeout', async () => {
    const contract: EngineeringContract = {
      id: 'contract-supplier-timeout',
      version: '1.0.0',
      requirement: {
        id: 'req-supplier-timeout',
        rawIntent: 'Query external supplier inventory before presenting options to user.',
        explicitConstraints: ['Do not hang indefinitely if supplier is unresponsive'],
        declaredTechStack: ['HTTP Client'],
        context: {},
      },
      discoveredConcerns: [
        {
          id: 'concern-unbounded-hang',
          requirementId: 'req-supplier-timeout',
          title: 'Unbounded Network Hang on External Supplier Call',
          description: 'Hanging supplier connection ties up worker threads and causes cascading failure.',
          applicabilityReason: 'Remote internet dependency without connection/socket timeout.',
          dimensions: [WellKnownDimensions.DEPENDENCY, WellKnownDimensions.TIME_WINDOW, WellKnownDimensions.BOUNDED_RESOURCE],
          supportingKnowledgeIds: ['pattern-missing-network-timeout-hang'],
          assumptions: [],
          confidence: 0.95,
          unresolvedQuestions: [],
        },
      ],
      decisions: [
        {
          id: 'decision-timeout-circuit-breaker',
          problemContext: 'Bound wait time on supplier requests.',
          consideredOptions: [],
          selectedOptionId: 'opt-timeout',
          selectedOptionName: 'Strict 2000ms socket and request timeout with circuit breaker',
          rationale: 'Ensures client aborts hung calls promptly.',
          evidence: [],
          assumptions: [],
          risksAndTradeoffs: [],
          verificationRequirements: ['Verify client aborts within configured timeout limit'],
          reconsiderationTriggers: [],
        },
      ],
      invariants: [
        {
          id: 'inv-supplier-timeout-bound',
          property: 'A downstream request may not wait beyond the configured timeout',
          severity: 'critical',
          blocksCompletion: true,
        },
      ],
      verificationSpecs: [
        {
          id: 'spec-timeout-bound',
          target: 'inv-supplier-timeout-bound',
          description: 'Simulate non-responsive supplier endpoint and measure abort time',
          setup: 'Downstream supplier stub configured to never reply',
          action: 'Invoke supplier search client with 2000ms timeout',
          expectedProperty: 'hung_requests == 0',
          evidenceToCollect: ['elapsed_duration_ms', 'hung_requests'],
          isAutomatable: true,
        },
      ],
      assumptions: [],
      unresolvedQuestions: [],
      metadata: { createdAt: new Date().toISOString(), status: 'accepted', tags: ['network', 'timeout'] },
    };

    const vPlan = await compiler.execute(contract, dummyContext, dummyPlan);
    expect(VerificationPlanSchema.safeParse(vPlan).success).toBe(true);
    expect(vPlan.cases).toHaveLength(1);

    const tc = vPlan.cases[0]!;
    expect(tc.targetInvariantId).toBe('inv-supplier-timeout-bound');
    expect(tc.assertions[0]!.name).toBe('hung_requests');
    expect(tc.assertions[0]!.operator).toBe('eq');
    expect(tc.assertions[0]!.expected).toBe(0);
  });

  // NOVEL CASE D: Queue Redelivery Duplicate Email Side Effect
  it('D. Devises repeated-message side-effect verification for queue delivery', async () => {
    const contract: EngineeringContract = {
      id: 'contract-queue-email-dedup',
      version: '1.0.0',
      requirement: {
        id: 'req-queue-email',
        rawIntent: 'Send order confirmation email when message is pulled from message queue.',
        explicitConstraints: ['No duplicate emails sent if message is redelivered'],
        declaredTechStack: ['RabbitMQ', 'SendGrid'],
        context: {},
      },
      discoveredConcerns: [
        {
          id: 'concern-queue-duplicate',
          requirementId: 'req-queue-email',
          title: 'Duplicate Side Effects on Message Redelivery',
          description: 'Network partition during ACK causes queue broker to redeliver message to another worker.',
          applicabilityReason: 'At-least-once message delivery semantics.',
          dimensions: [WellKnownDimensions.SIDE_EFFECT, WellKnownDimensions.RETRY, WellKnownDimensions.CONCURRENCY],
          supportingKnowledgeIds: ['pattern-duplicate-queue-message-delivery'],
          assumptions: [],
          confidence: 0.95,
          unresolvedQuestions: [],
        },
      ],
      decisions: [
        {
          id: 'decision-email-dedup-ledger',
          problemContext: 'Deduplicate email delivery side effects.',
          consideredOptions: [],
          selectedOptionId: 'opt-dedup-table',
          selectedOptionName: 'Processed message deduplication store',
          rationale: 'Tracks message ID atomically before invoking email transport.',
          evidence: [],
          assumptions: [],
          risksAndTradeoffs: [],
          verificationRequirements: ['Verify email transport called at most once on duplicate delivery'],
          reconsiderationTriggers: [],
        },
      ],
      invariants: [
        {
          id: 'inv-email-dedup-side-effect',
          property: 'Duplicate queue delivery must not produce duplicate email side effects',
          severity: 'critical',
          blocksCompletion: true,
        },
      ],
      verificationSpecs: [
        {
          id: 'spec-email-dedup',
          target: 'inv-email-dedup-side-effect',
          description: 'Deliver identical message twice and count outbound email transmissions',
          setup: 'Mock email gateway tracking transmit calls',
          action: 'Send 2 duplicate queue messages with identical messageId',
          expectedProperty: 'downstream_charge_calls <= 1',
          evidenceToCollect: ['downstream_charge_calls'],
          isAutomatable: true,
        },
      ],
      assumptions: [],
      unresolvedQuestions: [],
      metadata: { createdAt: new Date().toISOString(), status: 'accepted', tags: ['queue', 'idempotency'] },
    };

    const vPlan = await compiler.execute(contract, dummyContext, dummyPlan);
    expect(VerificationPlanSchema.safeParse(vPlan).success).toBe(true);
    expect(vPlan.cases).toHaveLength(1);

    const tc = vPlan.cases[0]!;
    expect(tc.targetInvariantId).toBe('inv-email-dedup-side-effect');
    expect(tc.assertions[0]!.name).toBe('downstream_charge_calls');
    expect(tc.assertions[0]!.operator).toBe('lte');
    expect(tc.assertions[0]!.expected).toBe(1);
  });

  // NOVEL CASE E: Cache Stampede Dogpiling Origin Query Coalescing
  it('E. Devises origin-call coalescing verification for cache miss bursts', async () => {
    const contract: EngineeringContract = {
      id: 'contract-cache-stampede-burst',
      version: '1.0.0',
      requirement: {
        id: 'req-cache-stampede',
        rawIntent: 'Cache popular product details for 5 minutes.',
        explicitConstraints: ['Do not flood database when cache expires under high load'],
        declaredTechStack: ['Redis', 'PostgreSQL'],
        context: {},
      },
      discoveredConcerns: [
        {
          id: 'concern-cache-stampede',
          requirementId: 'req-cache-stampede',
          title: 'Cache Stampede Dogpiling on TTL Expiry',
          description: 'Synchronized cache expiration causes hundreds of parallel requests to hammer database.',
          applicabilityReason: 'High traffic volume on hot cache keys.',
          dimensions: [WellKnownDimensions.SCALING_CONCENTRATION, WellKnownDimensions.TIME_WINDOW, WellKnownDimensions.DEPENDENCY],
          supportingKnowledgeIds: ['pattern-cache-stampede-dogpiling'],
          assumptions: [],
          confidence: 0.95,
          unresolvedQuestions: [],
        },
      ],
      decisions: [
        {
          id: 'decision-single-flight-origin',
          problemContext: 'Prevent database flood on cache miss burst.',
          consideredOptions: [],
          selectedOptionId: 'opt-single-flight-cache',
          selectedOptionName: 'Single-flight mutex origin fetch with early recompute',
          rationale: 'Coalesces parallel requests for same key into single database query.',
          evidence: [],
          assumptions: [],
          risksAndTradeoffs: [],
          verificationRequirements: ['Verify origin database queried at most 1 time during burst cache miss'],
          reconsiderationTriggers: [],
        },
      ],
      invariants: [
        {
          id: 'inv-cache-miss-burst-coalescing',
          property: 'Cache miss bursts must not trigger one database query per requester',
          severity: 'critical',
          blocksCompletion: true,
        },
      ],
      verificationSpecs: [
        {
          id: 'spec-cache-stampede',
          target: 'inv-cache-miss-burst-coalescing',
          description: 'Simulate 10 simultaneous requests for expired cache key',
          setup: 'Mock database measuring query count',
          action: 'Transmit 10 parallel queries for expired cache item',
          expectedProperty: 'database_queries <= 1',
          evidenceToCollect: ['database_queries'],
          isAutomatable: true,
        },
      ],
      assumptions: [],
      unresolvedQuestions: [],
      metadata: { createdAt: new Date().toISOString(), status: 'accepted', tags: ['cache', 'stampede'] },
    };

    const vPlan = await compiler.execute(contract, dummyContext, dummyPlan);
    expect(VerificationPlanSchema.safeParse(vPlan).success).toBe(true);
    expect(vPlan.cases).toHaveLength(1);

    const tc = vPlan.cases[0]!;
    expect(tc.targetInvariantId).toBe('inv-cache-miss-burst-coalescing');
    expect(tc.assertions[0]!.name).toBe('database_queries');
    expect(tc.assertions[0]!.operator).toBe('lte');
    expect(tc.assertions[0]!.expected).toBe(1);
  });
});
