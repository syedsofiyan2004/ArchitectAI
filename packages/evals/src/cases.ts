import { EvaluationCase, WellKnownDimensions } from '@architectai/domain';

/**
 * Architectural Principle:
 * Negative eval assertions require sufficient context to establish that a concern is genuinely inapplicable.
 *
 * Incomplete builder intents must NOT categorically forbid security or resilience dimensions
 * (such as attacker_controlled_input) simply because the builder omitted trust/network context.
 * ArchitectAI is designed to discover unknown-unknowns; penalizing discovery of legitimate risks
 * when context is absent would harm real-world safety.
 */

/**
 * Neutral evaluation case for high-frequency sensor ingestion.
 * Focuses on discovering bounded resource constraints without falsely penalizing trust/security concerns.
 */
export const sampleNeutralEvalCase: EvaluationCase = {
  id: 'eval-bounded-ingestion-001',
  name: 'Sensor Stream Ingestion Bounded Resources',
  description:
    'Evaluates that high-volume sensor ingestion triggers bounded resource discovery. Unjustified negative assertions (such as forbidding attacker-controlled input on a network socket) are omitted per the architectural negative-assertion principle.',
  requirementIntent: {
    id: 'req-sensor-01',
    rawIntent: 'Ingest high frequency sensor telemetry streams over network sockets.',
    explicitConstraints: ['Do not crash during sudden traffic bursts'],
    declaredTechStack: ['Node.js'],
    context: {},
  },
  expectedDimensions: [
    WellKnownDimensions.BOUNDED_RESOURCE,
    WellKnownDimensions.CONCURRENCY,
  ],
  // Principle: Negative eval assertions require sufficient context to establish that a concern is genuinely inapplicable.
  // Because network-sensor requirements lack explicit air-gapping/trust constraints,
  // we do NOT forbid attacker_controlled_input or persistence here.
  forbiddenDimensions: [],
  requiredKnowledgeLevels: ['fundamental', 'failure_pattern'],
  tags: ['streaming', 'bounded_resource', 'eval'],
};

/**
 * Dedicated evaluation case verifying negative-assertion (MUST NOT invent) behavior.
 * This fixture provides explicit, unambiguous context ruling out network, persistence, and external dependencies.
 */
export const strictlyIsolatedComputationEvalCase: EvaluationCase = {
  id: 'eval-isolated-compute-001',
  name: 'Strictly Isolated In-Memory Numeric Calculation',
  description:
    'Evaluates in-memory matrix computation. Because the requirement and context explicitly guarantee an isolated, air-gapped, non-persisted single-threaded execution, negative assertions against attacker input, persistence, and external dependencies are genuinely justified.',
  requirementIntent: {
    id: 'req-isolated-math-01',
    rawIntent:
      'Perform deterministic mathematical matrix multiplication on pre-allocated local buffers in memory.',
    explicitConstraints: [
      'Strictly offline and air-gapped calculation',
      'Zero external network listeners or socket bindings',
      'No disk persistence or file system I/O',
      'Single-threaded synchronous computation',
    ],
    declaredTechStack: ['TypeScript'],
    context: {
      network: 'none',
      persistence: 'none',
      concurrency: 'synchronous_single_thread',
      trust_domain: 'local_verified_sandbox',
    },
  },
  expectedDimensions: [WellKnownDimensions.BOUNDED_RESOURCE],
  // Negative assertions are justified here because the requirement and context unambiguously establish inapplicability.
  forbiddenDimensions: [
    WellKnownDimensions.ATTACKER_CONTROLLED_INPUT,
    WellKnownDimensions.PERSISTENCE,
    WellKnownDimensions.DEPENDENCY,
  ],
  requiredKnowledgeLevels: ['fundamental'],
  tags: ['compute', 'isolated', 'negative_eval'],
};
