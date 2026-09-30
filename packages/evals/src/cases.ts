import { EvaluationCase, WellKnownDimensions } from '@architectai/domain';

export const sampleNeutralEvalCase: EvaluationCase = {
  id: 'eval-bounded-ingestion-001',
  name: 'Sensor Stream Ingestion Bounded Resources',
  description:
    'Evaluates that high-volume sensor ingestion triggers bounded resource discovery without inventing unrelated concepts like persistence or token refresh.',
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
  forbiddenDimensions: [
    WellKnownDimensions.PERSISTENCE,
    WellKnownDimensions.ATTACKER_CONTROLLED_INPUT,
  ],
  requiredKnowledgeLevels: ['fundamental', 'failure_pattern'],
  tags: ['streaming', 'bounded_resource', 'eval'],
};
