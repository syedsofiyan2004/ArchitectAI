import {
  EngineeringKnowledgeItem,
  WellKnownDimensions,
} from '@architectai/domain';

export const neutralFundamentalKnowledge: EngineeringKnowledgeItem = {
  id: 'fundamental-bounded-memory-buffers',
  levels: ['fundamental'],
  title: 'Bounded Memory Buffering and Finite Capacity',
  description:
    'Physical computational systems have finite, bounded random-access memory. Unbounded ingestion rates when producer throughput exceeds consumer throughput will inevitably deplete available memory capacity.',
  dimensions: [
    WellKnownDimensions.BOUNDED_RESOURCE,
    WellKnownDimensions.CONCURRENCY,
  ],
  triggers: [
    'asymmetric throughput between producer and consumer',
    'unbounded queue accumulation',
  ],
  failureMechanisms: [
    'Process out-of-memory termination',
    'Abrupt process death from resource starvation',
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
      id: 'ev-fund-01',
      sourceType: 'specification',
      title: 'Reactive Streams: Backpressure Specification',
      excerptOrClaim:
        'The main goal is to govern the exchange of stream data across an asynchronous boundary without buffer overflows.',
      confidenceScore: 0.98,
    },
  ],
  relationships: [],
};

export const neutralFailurePatternKnowledge: EngineeringKnowledgeItem = {
  id: 'pattern-unbounded-consumer-overflow',
  levels: ['failure_pattern'],
  title: 'Unbounded In-Memory Accumulation under Downstream Slowdown',
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
    'Garbage collection thrashing leading to total application unresponsiveness',
  ],
  mitigations: [
    'Bound in-memory channel capacity',
    'Temporarily stop reading from transport layer (TCP pause)',
  ],
  verificationIdeas: [
    'Pause consumer worker loop during high traffic ingress and verify transport flow control engages',
  ],
  evidence: [
    {
      id: 'ev-pattern-01',
      sourceType: 'postmortem',
      title: 'Distributed System Incident: In-Process Buffer Starvation',
      excerptOrClaim:
        'Lack of backpressure caused event ingestion nodes to buffer 4GB of messages within 30 seconds, triggering an unrecoverable SIGKILL from the kernel.',
      confidenceScore: 0.95,
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
    'Instrument stream writableBuffer length and write return value under artificial stream choke',
  ],
  evidence: [
    {
      id: 'ev-tech-01',
      sourceType: 'official_documentation',
      title: 'Node.js Official Documentation: Stream Backpressure Explained',
      technology: 'Node.js',
      versionApplicability: '>=14.0.0',
      sourceUrlOrIdentifier: 'https://nodejs.org/en/docs/guides/backpressuring-in-streams/',
      excerptOrClaim: 'If write() returns false, do not write additional data until drain is emitted.',
      confidenceScore: 1.0,
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
    versionRange: '>=14.0.0',
  },
};

export const neutralKnowledgeFixtures: EngineeringKnowledgeItem[] = [
  neutralFundamentalKnowledge,
  neutralFailurePatternKnowledge,
  neutralTechnologySpecificKnowledge,
];
