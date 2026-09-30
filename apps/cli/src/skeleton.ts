import {
  EngineeringKnowledgeItemSchema,
  EngineeringContractSchema,
  EngineeringContract,
  WellKnownDimensions,
} from '@architectai/domain';
import {
  InMemoryKnowledgeRepository,
  neutralKnowledgeFixtures,
} from '@architectai/knowledge';

export interface SkeletonExecutionResult {
  success: boolean;
  contract: EngineeringContract;
  contractJson: string;
  logMessages: string[];
}

/**
 * Executes the walking skeleton procedure:
 * 1. loads a small fixture containing one L1 fundamental, one L2 failure pattern, and one L3 technology-specific knowledge item;
 * 2. validates all three through the schemas;
 * 3. queries them through the generic knowledge repository;
 * 4. assembles a sample EngineeringContract;
 * 5. serializes it to JSON;
 * 6. validates the serialized result by parsing it back through the schema.
 */
export async function runWalkingSkeleton(): Promise<SkeletonExecutionResult> {
  const logMessages: string[] = [];
  const log = (msg: string) => logMessages.push(msg);

  log('Starting ArchitectAI Walking Skeleton...');

  // Step 1: Load small neutral fixture (L1, L2, L3)
  log(`Step 1: Loaded ${neutralKnowledgeFixtures.length} neutral knowledge fixtures.`);

  // Step 2: Validate all three through schemas
  for (const item of neutralKnowledgeFixtures) {
    const validated = EngineeringKnowledgeItemSchema.parse(item);
    log(`Step 2: Validated knowledge item '${validated.id}' (${validated.levels.join(', ')}).`);
  }

  // Step 3: Query through generic knowledge repository
  const repo = new InMemoryKnowledgeRepository();
  await repo.load(neutralKnowledgeFixtures);

  const fundamentals = await repo.queryByLevel('fundamental');
  const failurePatterns = await repo.queryByLevel('failure_pattern');
  const techSpecific = await repo.queryByLevel('technology_specific');
  const boundedResourceItems = await repo.queryByDimensions([
    WellKnownDimensions.BOUNDED_RESOURCE,
  ]);

  log(
    `Step 3: Queried knowledge repository -> L1: ${fundamentals.length}, L2: ${failurePatterns.length}, L3: ${techSpecific.length}, Bounded Resource dimension: ${boundedResourceItems.length}`
  );

  // Step 4: Assemble sample EngineeringContract
  const sampleContract: EngineeringContract = {
    id: 'contract-skeleton-001',
    version: '1.0.0',
    requirement: {
      id: 'req-socket-stream',
      rawIntent:
        'Stream binary telemetry metrics from 10,000 edge sensors to an ingestion pipeline.',
      explicitConstraints: [
        'Memory footprint must not expand indefinitely if downstream stalls',
      ],
      declaredTechStack: ['Node.js'],
      context: { environment: 'edge-gateway' },
    },
    discoveredConcerns: [
      {
        id: 'concern-memory-saturation',
        requirementId: 'req-socket-stream',
        title: 'Buffer Saturation from Ingress/Egress Throughput Imbalance',
        description:
          'Ingress rate from 10,000 sensors can outpace downstream processing, causing unbounded buffer accumulation.',
        applicabilityReason:
          'High fan-in asynchronous producer-consumer architecture over network boundaries.',
        dimensions: [
          WellKnownDimensions.BOUNDED_RESOURCE,
          WellKnownDimensions.CONCURRENCY,
          WellKnownDimensions.TIME_WINDOW,
        ],
        supportingKnowledgeIds: [
          fundamentals[0]!.id,
          failurePatterns[0]!.id,
          techSpecific[0]!.id,
        ],
        assumptions: [
          'Edge sensors communicate via standard TCP stream connections',
        ],
        confidence: 0.96,
        unresolvedQuestions: [
          'Can edge sensors tolerate TCP socket backpressure pauses?',
        ],
      },
    ],
    decisions: [
      {
        id: 'decision-bounded-stream-pipeline',
        problemContext:
          'Mitigate unbounded in-memory accumulation during downstream ingestion degradation.',
        consideredOptions: [
          {
            id: 'opt-unbounded-queue',
            name: 'Unbounded In-Memory Queue',
            description: 'Queue all incoming buffers in a JavaScript array.',
            tradeoffs: 'High risk of V8 heap exhaustion and process crash under load spikes.',
          },
          {
            id: 'opt-bounded-stream-pipeline',
            name: 'Bounded Stream Pipeline with highWaterMark Flow Control',
            description:
              'Wire ingestion via Node.js stream.pipeline() respecting highWaterMark backpressure.',
            tradeoffs:
              'Upstream sockets are paused when downstream fills, exerting network backpressure.',
          },
        ],
        selectedOptionId: 'opt-bounded-stream-pipeline',
        selectedOptionName:
          'Bounded Stream Pipeline with highWaterMark Flow Control',
        rationale:
          'Grounds memory allocation in finite physical capacity by pausing TCP socket reads when internal buffers reach highWaterMark.',
        evidence: [techSpecific[0]!.evidence[0]!],
        assumptions: [
          'Node.js runtime manages socket flow control through OS TCP windowing',
        ],
        risksAndTradeoffs: [
          'Sensor connections may time out if downstream outage persists indefinitely',
        ],
        verificationRequirements: [
          'Simulate slow downstream consumer; verify heap allocation reaches steady state <= 128MB',
        ],
        reconsiderationTriggers: [
          'Telemetry protocol shifts from TCP streaming to UDP datagrams without flow control',
        ],
      },
    ],
    invariants: [
      {
        id: 'inv-bounded-heap',
        property:
          'Ingestion process RSS heap must not exceed 128MB regardless of upstream ingress rate.',
        severity: 'critical',
        blocksCompletion: true,
        rationale:
          'Protects container from host OOM killer termination.',
      },
    ],
    verificationSpecs: [
      {
        id: 'verif-stream-backpressure',
        target: 'inv-bounded-heap',
        description:
          'Verify stream backpressure engagement and bounded memory consumption.',
        setup:
          'Spin up local ingestion listener with highWaterMark=64KB and mock consumer paused for 30s.',
        action:
          'Flood socket with 50MB of raw bytes at 10MB/sec.',
        expectedProperty:
          'Socket pauses receiving after 64KB; process memory remains flat; drain event resumes consumption.',
        evidenceToCollect: [
          'stream.writableLength metrics',
          'process.memoryUsage().heapUsed timeline',
        ],
        isAutomatable: true,
      },
    ],
    assumptions: [
      'Downstream storage consumer will eventually drain pending records',
    ],
    unresolvedQuestions: [],
    metadata: {
      createdAt: '2026-09-30T00:00:00.000Z',
      status: 'accepted',
      tags: ['telemetry', 'backpressure', 'stream'],
    },
  };

  log(`Step 4: Assembled sample EngineeringContract '${sampleContract.id}'.`);

  // Step 5: Serialize to JSON
  const contractJson = JSON.stringify(sampleContract, null, 2);
  log(`Step 5: Serialized EngineeringContract to JSON (${contractJson.length} bytes).`);

  // Step 6: Validate serialized result by parsing it back through the schema
  const parsedObject = JSON.parse(contractJson);
  const validatedContract = EngineeringContractSchema.parse(parsedObject);

  log(
    `Step 6: Successfully parsed serialized JSON back through EngineeringContractSchema (Contract ID: '${validatedContract.id}').`
  );

  return {
    success: true,
    contract: validatedContract,
    contractJson,
    logMessages,
  };
}
