import {
  EngineeringKnowledgeItem,
  WellKnownDimensions,
} from '@architectai/domain';

export const neutralFundamentalKnowledge: EngineeringKnowledgeItem = {
  id: 'fundamental-bounded-memory-buffers',
  levels: ['fundamental'],
  title: 'Analytical Primitive: Physical Buffer Finiteness and Flow Equilibrium',
  description:
    'Physical computational systems have finite, bounded random-access memory. Unbounded ingestion rates when producer throughput exceeds consumer throughput will inevitably deplete available memory capacity without backpressure signaling.',
  dimensions: [
    WellKnownDimensions.BOUNDED_RESOURCE,
    WellKnownDimensions.CONCURRENCY,
  ],
  triggers: [
    'asymmetric throughput between producer and consumer',
    'unbounded queue accumulation',
  ],
  failureMechanisms: [
    'Process termination under resource exhaustion',
    'Abrupt process death from memory exhaustion',
  ],
  mitigations: [
    'Establish explicit upper bound on buffer size',
    'Apply backpressure signaling to upstream producers',
    'Introduce load shedding when capacity is exhausted',
  ],
  verificationIdeas: [
    'Inject sustained load above consumer processing threshold and measure heap growth',
  ],
  evidence: [
    {
      id: 'ev-fund-analysis-01',
      sourceType: 'manual_analysis',
      title: 'Theoretical Buffer Model: Capacity Bounds and Queue Growth',
      excerptOrClaim:
        'In any finite computational system, when the arrival rate exceeds the service rate without feedback, queue length grows without bound until physical resources are exhausted.',
      qualityNotes:
        'Synthetic analytical model demonstrating fundamental physical capacity constraints; not an empirical measurement.',
      confidenceScore: 0.9,
    },
  ],
  relationships: [],
};

export const neutralFailurePatternKnowledge: EngineeringKnowledgeItem = {
  id: 'pattern-unbounded-consumer-overflow',
  levels: ['failure_pattern'],
  title: 'Synthetic Failure Pattern: Unbounded In-Process Buffer Accumulation Under Downstream Lag',
  description:
    'When an asynchronous consumer suffers a latency degradation or downstream dependency stall, an unbounded in-process buffer absorbs the incoming stream until the runtime exhausts memory.',
  dimensions: [
    WellKnownDimensions.BOUNDED_RESOURCE,
    WellKnownDimensions.SIDE_EFFECT,
    WellKnownDimensions.DEPENDENCY,
  ],
  triggers: [
    'Downstream service latency spike',
    'Sudden burst of ingress messages while consumer operates at fixed rate',
  ],
  failureMechanisms: [
    'Heap allocation exhaustion',
    'Garbage collection thrashing leading to application unresponsiveness',
  ],
  mitigations: [
    'Bound in-memory channel capacity',
    'Temporarily stop reading from transport layer (TCP socket pause)',
  ],
  verificationIdeas: [
    'Pause consumer worker loop during high traffic ingress and verify transport flow control engages',
  ],
  evidence: [
    {
      id: 'ev-pattern-analysis-01',
      sourceType: 'manual_analysis',
      title: 'Demonstration Pattern: In-Memory Queue Accumulation Under Backpressure Absence',
      excerptOrClaim:
        'Lack of backpressure flow control across asynchronous producer-consumer boundaries leads to memory buffer saturation during consumer slowdowns.',
      qualityNotes:
        'Synthetic evaluation fixture illustrating consumer-lag failure patterns; not derived from an empirical production incident postmortem.',
      confidenceScore: 0.85,
    },
  ],
  relationships: [
    {
      targetKnowledgeId: 'fundamental-bounded-memory-buffers',
      relationshipType: 'specializes',
      description: 'Concrete failure pattern manifesting the fundamental bounded memory constraint.',
    },
  ],
};

export const neutralTechnologySpecificKnowledge: EngineeringKnowledgeItem = {
  id: 'tech-nodejs-stream-backpressure',
  levels: ['technology_specific'],
  title: 'Node.js Stream Backpressure and highWaterMark Flow Control',
  description:
    'In Node.js, stream.Writable instances buffer chunks up to highWaterMark bytes. When write() returns false, the caller must suspend writing until the drain event fires to prevent memory bloat.',
  dimensions: [
    WellKnownDimensions.BOUNDED_RESOURCE,
    WellKnownDimensions.TIME_WINDOW,
  ],
  triggers: [
    'stream.write() returns false',
    'writableBuffer size exceeds highWaterMark',
  ],
  failureMechanisms: [
    'Ignoring write() return value and continuing to push buffers causes V8 heap exhaustion',
  ],
  mitigations: [
    'Use stream.pipeline() to wire backpressure automatically',
    'Respect write() boolean return and await drain event',
  ],
  verificationIdeas: [
    'Instrument stream writableLength and write return value under artificial stream choke',
  ],
  evidence: [
    {
      id: 'ev-tech-nodejs-docs-01',
      sourceType: 'official_documentation',
      title: 'Node.js Stream API Documentation: writable.write(chunk[, encoding][, callback])',
      technology: 'Node.js',
      versionApplicability: '>=0.10.0',
      sourceUrlOrIdentifier: 'https://nodejs.org/api/stream.html#writablewritechunk-encoding-callback',
      excerptOrClaim:
        'The return value is true if the internal buffer is less than the highWaterMark configured when the stream was created. If false, further writes should stop until the drain event is emitted.',
      qualityNotes:
        'Authoritative official Node.js API documentation describing stream.Writable write/drain flow control semantics.',
      confidenceScore: 0.95,
    },
  ],
  relationships: [
    {
      targetKnowledgeId: 'pattern-unbounded-consumer-overflow',
      relationshipType: 'mitigates',
      description: 'Provides language-level flow control to prevent unbounded accumulation.',
    },
  ],
  technologyMetadata: {
    technology: 'Node.js',
    runtimeEnvironment: 'V8 Engine',
    versionRange: '>=0.10.0',
  },
};

export const neutralKnowledgeFixtures: EngineeringKnowledgeItem[] = [
  neutralFundamentalKnowledge,
  neutralFailurePatternKnowledge,
  neutralTechnologySpecificKnowledge,
];
