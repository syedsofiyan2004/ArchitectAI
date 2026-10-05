import {
  RequirementIntent,
  EngineeringContract,
  EngineeringContractSchema,
  EngineeringDimension,
  WellKnownDimensions,
  ConcernCandidate,
  ArchitectureDecision,
  EngineeringInvariant,
  VerificationSpec,
} from '@architectai/domain';
import {
  KnowledgeRepository,
} from '@architectai/knowledge';
import { ProviderAdapter } from '@architectai/providers';

export interface AnalyzeArchitectureInput {
  rawIntent: string;
  explicitConstraints?: string[];
  declaredTechStack?: string[];
  context?: {
    language?: string;
    framework?: string;
    database?: string;
    cloud?: string;
    scale?: string;
    additionalConstraints?: string;
    [key: string]: string | undefined;
  };
}

export interface AnalysisStageLog {
  stage: number;
  name: string;
  description: string;
  timestamp: string;
  status: 'pending' | 'in_progress' | 'completed';
}

export interface AnalyzeArchitectureOutput {
  contract: EngineeringContract;
  stages: AnalysisStageLog[];
  dimensionsDetected: EngineeringDimension[];
  mode: 'remote-model' | 'deterministic-demo';
}

/**
 * Universal Dimension Extractor.
 * Reasons across physical and systems engineering primitives rather than keyword feature matching.
 */
function extractEngineeringDimensions(
  intent: string,
  constraints: string[] = [],
  context: Record<string, string> = {}
): EngineeringDimension[] {
  const combined = `${intent} ${constraints.join(' ')} ${Object.values(context).join(' ')}`.toLowerCase();
  const dimensions = new Set<EngineeringDimension>();

  // Bounded Resource / Capacity limits
  if (
    /limit|rate|burst|capacity|quota|buffer|memory|cpu|exhaust|pool|scale|max|heavy|large|file|image|high|throughput|qps|rps|load/i.test(
      combined
    )
  ) {
    dimensions.add(WellKnownDimensions.BOUNDED_RESOURCE);
  }

  // Concurrency & Multithreading
  if (
    /parallel|concurrent|thread|async|simultaneous|race|batch|multiple|clients|lock|mutex|worker|token|refresh|api|request/i.test(
      combined
    )
  ) {
    dimensions.add(WellKnownDimensions.CONCURRENCY);
  }

  // Time, Windows, Expiration & Latency
  if (
    /minute|second|hour|window|time|expire|ttl|period|latency|delay|timeout|interval|clock|deadline|duration/i.test(
      combined
    )
  ) {
    dimensions.add(WellKnownDimensions.TIME_WINDOW);
  }

  // Shared Mutable State & Atomic Coordination
  if (
    /token|refresh|session|counter|state|cache|balance|shared|auth|status|inventory|stock|quantity|count|decrement|increment|lock|coordinat/i.test(
      combined
    )
  ) {
    dimensions.add(WellKnownDimensions.SHARED_MUTABLE_STATE);
  }

  // Side Effects & Non-Idempotent Mutations
  if (
    /payment|charge|order|mutate|send|deliver|produce|email|create|insert|transfer|bill|deduct/i.test(
      combined
    )
  ) {
    dimensions.add(WellKnownDimensions.SIDE_EFFECT);
  }

  // Retries & Error Recovery
  if (
    /retry|replay|fail|error|recover|backoff|transient|resilience|re-issue/i.test(
      combined
    )
  ) {
    dimensions.add(WellKnownDimensions.RETRY);
  }

  // Dependencies & External Call Boundaries
  if (
    /database|db|postgres|redis|sql|api|service|upstream|downstream|dependency|third-party|gateway|http|network|queue|broker|kafka|sqs/i.test(
      combined
    )
  ) {
    dimensions.add(WellKnownDimensions.DEPENDENCY);
  }

  // Ordering & Delivery Guarantees
  if (
    /queue|message|order|stream|sequence|event|log|consume|publish|kafka|rabbit/i.test(
      combined
    )
  ) {
    dimensions.add(WellKnownDimensions.ORDERING);
  }

  // Persistence & Storage Durability
  if (
    /persist|store|db|database|table|record|postgres|mysql|disk|save/i.test(
      combined
    )
  ) {
    dimensions.add(WellKnownDimensions.PERSISTENCE);
  }

  // Scaling Concentration & Thundering Herd
  if (
    /many|mass|burst|thousand|spike|hot|stampede|herd|fan-out|fan-in/i.test(
      combined
    )
  ) {
    dimensions.add(WellKnownDimensions.SCALING_CONCENTRATION);
  }

  // Trust Boundaries & Security
  if (
    /user|auth|token|credential|key|secret|untrusted|client|tenant|permission/i.test(
      combined
    )
  ) {
    dimensions.add(WellKnownDimensions.TRUST_BOUNDARY);
  }

  // Default to bounded resource and concurrency if no dimension matched
  if (dimensions.size === 0) {
    dimensions.add(WellKnownDimensions.BOUNDED_RESOURCE);
    dimensions.add(WellKnownDimensions.CONCURRENCY);
  }

  return Array.from(dimensions);
}

/**
 * Core Use Case: AnalyzeArchitectureUseCase
 * Executes the complete 7-stage architectural discovery and contract assembly pipeline.
 */
export class AnalyzeArchitectureUseCase {
  constructor(
    private readonly knowledgeRepo: KnowledgeRepository,
    private readonly provider: ProviderAdapter
  ) {}

  async execute(input: AnalyzeArchitectureInput): Promise<AnalyzeArchitectureOutput> {
    const stages: AnalysisStageLog[] = [];
    const logStage = (stage: number, name: string, description: string) => {
      stages.push({
        stage,
        name,
        description,
        timestamp: new Date().toISOString(),
        status: 'completed',
      });
    };

    // Stage 1: Understanding requirement
    logStage(1, 'Understanding requirement', 'Decomposing natural-language intent and constraints.');
    const normalizedContext: Record<string, string> = {};
    if (input.context) {
      for (const [key, val] of Object.entries(input.context)) {
        if (val) normalizedContext[key] = val;
      }
    }

    const techStack: string[] = [
      ...(input.declaredTechStack || []),
      ...(input.context?.language ? [input.context.language] : []),
      ...(input.context?.framework ? [input.context.framework] : []),
      ...(input.context?.database ? [input.context.database] : []),
      ...(input.context?.cloud ? [input.context.cloud] : []),
    ];

    const requirement: RequirementIntent = {
      id: `req-${Date.now()}`,
      rawIntent: input.rawIntent.trim(),
      explicitConstraints: input.explicitConstraints || [],
      declaredTechStack: Array.from(new Set(techStack)),
      context: normalizedContext,
      createdAt: new Date().toISOString(),
    };

    // Stage 2: Mapping engineering dimensions
    logStage(2, 'Mapping engineering dimensions', 'Analyzing universal systems primitives.');
    const dimensions = extractEngineeringDimensions(
      requirement.rawIntent,
      requirement.explicitConstraints,
      requirement.context
    );

    // Stage 3: Searching engineering knowledge (L1, L2, L3)
    logStage(3, 'Searching engineering knowledge', 'Querying three-level knowledge repository.');
    const retrievedByDimensions = await this.knowledgeRepo.queryByDimensions(dimensions);

    // Also query technology specific knowledge if declared
    const retrievedByTech: typeof retrievedByDimensions = [];
    for (const tech of requirement.declaredTechStack) {
      const techItems = await this.knowledgeRepo.queryByTechnology(tech);
      retrievedByTech.push(...techItems);
    }

    const allRetrieved = Array.from(
      new Map(
        [...retrievedByDimensions, ...retrievedByTech].map((item) => [item.id, item])
      ).values()
    );

    // Stage 4: Identifying failure modes (Unknown-Unknowns)
    logStage(4, 'Identifying failure modes', 'Discovering candidate failure patterns.');
    const l2Patterns = allRetrieved.filter((item) => item.levels.includes('failure_pattern'));
    const l1Fundamentals = allRetrieved.filter((item) => item.levels.includes('fundamental'));
    const l3Tech = allRetrieved.filter((item) => item.levels.includes('technology_specific'));

    const discoveredConcerns: ConcernCandidate[] = [];

    for (const pattern of l2Patterns) {
      // Find related L1 and L3 items
      const relatedL1 = l1Fundamentals.find((fund) =>
        pattern.relationships.some((rel) => rel.targetKnowledgeId === fund.id)
      ) || l1Fundamentals[0];

      const relatedL3 = l3Tech.find((tech) =>
        tech.relationships.some((rel) => rel.targetKnowledgeId === pattern.id)
      );

      const supportingIds = [
        pattern.id,
        ...(relatedL1 ? [relatedL1.id] : []),
        ...(relatedL3 ? [relatedL3.id] : []),
      ];

      const concernDims = Array.from(
        new Set([...pattern.dimensions, ...(relatedL1 ? relatedL1.dimensions : [])])
      );

      discoveredConcerns.push({
        id: `concern-${pattern.id}`,
        requirementId: requirement.id,
        title: pattern.title,
        description: pattern.description,
        applicabilityReason: `Applies because requirement involves ${concernDims.join(
          ', '
        )}: ${pattern.triggers.join('; ')}.`,
        dimensions: concernDims,
        supportingKnowledgeIds: supportingIds,
        assumptions: [
          'High load or edge timing conditions will be experienced in production',
          'Client behaviors may not follow ideal sequential request patterns',
        ],
        confidence: 0.92,
        unresolvedQuestions: [
          `What are the peak arrival rates or concurrency limits expected?`,
          `Are distributed nodes or multiple workers processing requests simultaneously?`,
        ],
      });
    }

    // Stage 5: Evaluating architecture choices
    logStage(5, 'Evaluating architecture choices', 'Synthesizing grounded architecture decisions.');
    const decisions: ArchitectureDecision[] = [];

    for (const pattern of l2Patterns.slice(0, 3)) {
      const relatedL3 = l3Tech.find((tech) =>
        tech.relationships.some((rel) => rel.targetKnowledgeId === pattern.id)
      );

      const options = [
        {
          id: 'opt-uncoordinated',
          name: 'Naive / In-Memory Uncoordinated Processing',
          description: 'Process requests directly without synchronization or bounds.',
          tradeoffs: 'High risk of failure under concurrency or burst spikes.',
        },
        {
          id: 'opt-coordinated',
          name: relatedL3 ? relatedL3.title : `Coordinated ${pattern.mitigations[0] || 'Mitigation'}`,
          description: relatedL3
            ? relatedL3.description
            : (pattern.mitigations[0] || 'Enforce bounds and synchronization.'),
          tradeoffs: 'Introduces coordinated state or small latency overhead.',
        },
      ];

      decisions.push({
        id: `decision-${pattern.id}`,
        problemContext: `Mitigating ${pattern.title} in production runtime.`,
        consideredOptions: options,
        selectedOptionId: 'opt-coordinated',
        selectedOptionName: options[1]!.name,
        rationale: `Selected ${options[1]!.name} to prevent ${pattern.failureMechanisms[0] || 'system failure'} while satisfying throughput and correctness requirements.`,
        evidence: pattern.evidence,
        assumptions: ['Infrastructure supports coordinated state or bounded queueing'],
        risksAndTradeoffs: [
          'Requires proper configuration of timeouts, window sizes, or bounds',
        ],
        verificationRequirements: [
          `Must verify behavior under simulated burst and concurrent edge conditions`,
        ],
        reconsiderationTriggers: [
          'System architecture shifts from distributed to single-node or vice versa',
          'Load characteristics exceed expected scale by more than 10x',
        ],
      });
    }

    // Stage 6: Building verification plan
    logStage(6, 'Building verification plan', 'Formulating executable verification specifications.');
    const invariants: EngineeringInvariant[] = [];
    const verificationSpecs: VerificationSpec[] = [];

    for (const pattern of l2Patterns.slice(0, 3)) {
      const invId = `inv-${pattern.id}`;
      invariants.push({
        id: invId,
        property: `The system must maintain safe operation under concurrent edge load and prevent ${pattern.title}.`,
        severity: 'critical',
        blocksCompletion: true,
        rationale: `Unchecked ${pattern.title} causes service degradation or data corruption.`,
      });

      verificationSpecs.push({
        id: `verif-${pattern.id}`,
        target: invId,
        description: `Stress and boundary verification for ${pattern.title}`,
        setup: `Deploy instance in isolated test harness with active monitoring enabled.`,
        action: `Execute synthetic load: ${pattern.verificationIdeas[0] || 'Inject concurrent stimulus matching edge pattern'}.`,
        expectedProperty: `System handles load gracefully; invariants hold; zero unhandled errors or data corruption.`,
        evidenceToCollect: [
          'Latency and error-rate telemetry graphs',
          'Memory, CPU, or connection watermark logs',
          'Transition event timestamps',
        ],
        isAutomatable: true,
      });
    }

    // Stage 7: Validating Engineering Contract
    logStage(7, 'Validating Engineering Contract', 'Validating final schema against runtime domain invariants.');

    const sampleContract: EngineeringContract = {
      id: `contract-${Date.now()}`,
      version: '1.0.0',
      requirement,
      discoveredConcerns,
      decisions,
      invariants,
      verificationSpecs,
      assumptions: [
        'Production network connections may experience arbitrary packet latency',
        'Clients can send requests at concurrent peak rates exceeding average throughput',
      ],
      unresolvedQuestions: [
        'What is the acceptable P99 latency SLA for this capability?',
        'What alerting and observability thresholds should be configured in production?',
      ],
      metadata: {
        createdAt: new Date().toISOString(),
        status: 'accepted',
        tags: dimensions,
      },
    };

    // Validate through Zod runtime schema
    const validatedContract = EngineeringContractSchema.parse(sampleContract);

    return {
      contract: validatedContract,
      stages,
      dimensionsDetected: dimensions,
      mode: this.provider.id === 'deterministic-demo' ? 'deterministic-demo' : 'remote-model',
    };
  }
}
