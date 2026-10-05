import {
  RequirementIntent,
  EngineeringContract,
  EngineeringContractSchema,
  EngineeringDimension,
  ConcernCandidate,
  ArchitectureDecision,
  EngineeringInvariant,
  VerificationSpec,
  RequirementDecomposition,
  RequirementDecompositionSchema,
  ConcernRelevanceEvaluation,
  ConcernRelevanceEvaluationSchema,
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
  decomposition: RequirementDecomposition;
}

/**
 * Core Use Case: AnalyzeArchitectureUseCase
 * Implements the 7-stage architectural discovery pipeline driven by real semantic reasoning:
 * 1. Semantic Requirement Decomposition (Phase A via ProviderAdapter)
 * 2. Mapping Inferred Engineering Dimensions
 * 3. Broad Candidate Knowledge Retrieval (L1, L2, L3)
 * 4. Semantic Concern Relevance Evaluation (Phase B via ProviderAdapter)
 * 5. Grounded Architecture Decisions Synthesis
 * 6. Verification Plan Formulation
 * 7. Canonical Engineering Contract Schema Validation
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

    // Stage 1: Semantic Requirement Decomposition (Phase A)
    logStage(1, 'Understanding requirement', 'Decomposing natural-language intent into semantic entities.');
    const normalizedContext: Record<string, string> = {};
    if (input.context) {
      for (const [key, val] of Object.entries(input.context)) {
        if (val) normalizedContext[key] = val;
      }
    }

    const declaredTech: string[] = [
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
      declaredTechStack: Array.from(new Set(declaredTech)),
      context: normalizedContext,
      createdAt: new Date().toISOString(),
    };

    // Invoke ProviderAdapter for Phase A: Semantic Decomposition
    const decompositionResponse = await this.provider.generateStructured<RequirementDecomposition>({
      messages: [
        {
          role: 'system',
          content: `You are the ArchitectAI Systems Engineering Reasoner.
Perform structured semantic decomposition of the user's software requirement.
Analyze operations, actors, state, resources, concurrency potential, timing semantics, ordering, persistence, trust boundaries, failure-sensitive operations, and scale signals.
Infer all applicable physical systems engineering dimensions (such as bounded_resource, concurrency, time_window, shared_mutable_state, side_effect, retry, dependency, ordering, persistence, scaling_concentration, trust_boundary, attacker_controlled_input).
DO NOT rely on keyword matching. Reason from physical and systems engineering principles.`,
        },
        {
          role: 'user',
          content: `Requirement Intent: ${requirement.rawIntent}
Explicit Constraints: ${requirement.explicitConstraints.join('; ') || 'None'}
Declared Tech Stack: ${requirement.declaredTechStack.join(', ') || 'None'}
Context: ${JSON.stringify(requirement.context)}`,
        },
      ],
      schema: RequirementDecompositionSchema,
      schemaName: 'RequirementDecomposition',
    });

    // Validate with Zod schema before accepting
    const decomposition = RequirementDecompositionSchema.parse(decompositionResponse.data);

    // Stage 2: Mapping engineering dimensions
    logStage(2, 'Mapping engineering dimensions', 'Extracting dimensions directly from semantic decomposition.');
    const dimensions = decomposition.inferredEngineeringDimensions;

    // Stage 3: Searching candidate engineering knowledge
    logStage(3, 'Searching engineering knowledge', 'Querying three-level knowledge repository with inferred dimensions.');
    const retrievedByDimensions = await this.knowledgeRepo.queryByDimensions(dimensions);

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

    const l2CandidatePatterns = allRetrieved.filter((item) =>
      item.levels.includes('failure_pattern')
    );
    const l1Fundamentals = allRetrieved.filter((item) =>
      item.levels.includes('fundamental')
    );
    const l3Tech = allRetrieved.filter((item) =>
      item.levels.includes('technology_specific')
    );

    // Stage 4: Semantic Concern Relevance Evaluation (Phase B via ProviderAdapter)
    logStage(4, 'Evaluating concern relevance', 'Evaluating candidate failure modes against decomposed operations.');

    const candidateDescriptions = l2CandidatePatterns
      .map(
        (c) =>
          `ID: ${c.id}\nTitle: ${c.title}\nDescription: ${c.description}\nTriggers: ${c.triggers.join(
            '; '
          )}\nFailure Mechanisms: ${c.failureMechanisms.join('; ')}`
      )
      .join('\n---\n');

    const relevanceResponse = await this.provider.generateStructured<ConcernRelevanceEvaluation>({
      messages: [
        {
          role: 'system',
          content: `You are the ArchitectAI Concern Relevance Evaluator.
Given the decomposed requirement and candidate failure patterns from the knowledge base:
Determine for EACH candidate whether it is:
- "applicable": genuinely applies to this workload/architecture
- "possibly_applicable": plausible or risk under burst/stress conditions
- "not_applicable": does NOT apply (e.g. offline local CLI does not suffer from network rate limiting or OAuth token race conditions)

Explain why for each, and include confidence (0.0 to 1.0).
Only include ungroundedConcerns if you identify a critical engineering failure mode NOT represented in the candidates.`,
        },
        {
          role: 'user',
          content: `Requirement Intent: ${requirement.rawIntent}
Decomposition Summary:
- Actors: ${decomposition.actors.join(', ')}
- Operations: ${decomposition.operations.join(', ')}
- Concurrency: ${decomposition.concurrencyPotential || 'None'}
- State: ${decomposition.state.join(', ')}
- Resources: ${decomposition.resources.join(', ')}
- External Dependencies: ${decomposition.externalDependencies.join(', ') || 'None'}
- Trust Boundaries: ${decomposition.trustBoundaries.join(', ')}

Candidate Knowledge Patterns to Evaluate:
${candidateDescriptions || 'None'}`,
        },
      ],
      schema: ConcernRelevanceEvaluationSchema,
      schemaName: 'ConcernRelevanceEvaluation',
    });

    // Validate relevance evaluation with Zod schema
    const relevanceResult = ConcernRelevanceEvaluationSchema.parse(relevanceResponse.data);

    // Build grounded concerns from applicable candidates
    const discoveredConcerns: ConcernCandidate[] = [];
    const candidateMap = new Map(l2CandidatePatterns.map((c) => [c.id, c]));

    for (const item of relevanceResult.evaluations) {
      if (item.relevance === 'not_applicable') {
        continue; // Discard non-applicable candidate to prevent false positives
      }

      const pattern = candidateMap.get(item.candidateId);
      if (!pattern) {
        // Enforce Grounding: Provider CANNOT invent unsupported knowledge IDs
        continue;
      }

      // Find related L1 and L3 items strictly from retrieved items
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
        applicabilityReason: item.applicabilityReason,
        dimensions: concernDims,
        supportingKnowledgeIds: supportingIds,
        groundingStatus: 'grounded',
        assumptions: item.assumptions.length > 0 ? item.assumptions : [
          'High load or edge timing conditions will be experienced in production',
          'Client behaviors may not follow ideal sequential request patterns',
        ],
        confidence: item.confidence,
        unresolvedQuestions: item.unresolvedQuestions.length > 0 ? item.unresolvedQuestions : [
          'What are the peak arrival rates or concurrency limits expected?',
          'Are distributed nodes or multiple workers processing requests simultaneously?',
        ],
      });
    }

    // Include any ungrounded concerns discovered by the model
    if (relevanceResult.ungroundedConcerns && relevanceResult.ungroundedConcerns.length > 0) {
      for (let i = 0; i < relevanceResult.ungroundedConcerns.length; i++) {
        const ungrounded = relevanceResult.ungroundedConcerns[i]!;
        discoveredConcerns.push({
          id: `concern-ungrounded-${i + 1}`,
          requirementId: requirement.id,
          title: ungrounded.title,
          description: ungrounded.description,
          applicabilityReason: ungrounded.applicabilityReason,
          dimensions: ungrounded.dimensions,
          supportingKnowledgeIds: [], // Strictly empty: do NOT fabricate knowledge IDs!
          groundingStatus: 'ungrounded_model_discovery',
          assumptions: ungrounded.assumptions,
          confidence: ungrounded.confidence,
          unresolvedQuestions: ungrounded.unresolvedQuestions,
        });
      }
    }

    // Stage 5: Evaluating architecture choices
    logStage(5, 'Evaluating architecture choices', 'Synthesizing grounded architecture decisions.');
    const decisions: ArchitectureDecision[] = [];

    // Synthesize decisions for up to 3 relevant grounded concerns
    const groundedConcerns = discoveredConcerns.filter((c) => c.groundingStatus === 'grounded');
    for (const concern of groundedConcerns.slice(0, 3)) {
      const patternId = concern.supportingKnowledgeIds[0];
      const pattern = patternId ? candidateMap.get(patternId) : undefined;
      const relatedL3 = l3Tech.find((tech) =>
        pattern && tech.relationships.some((rel) => rel.targetKnowledgeId === pattern.id)
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
          name: relatedL3
            ? relatedL3.title
            : `Coordinated ${pattern?.mitigations[0] || 'Mitigation'}`,
          description: relatedL3
            ? relatedL3.description
            : (pattern?.mitigations[0] || 'Enforce bounds and synchronization.'),
          tradeoffs: 'Introduces coordinated state or small latency overhead.',
        },
      ];

      decisions.push({
        id: `decision-${concern.id}`,
        problemContext: `Mitigating ${concern.title} in production runtime.`,
        consideredOptions: options,
        selectedOptionId: 'opt-coordinated',
        selectedOptionName: options[1]!.name,
        rationale: `Selected ${options[1]!.name} to prevent ${pattern?.failureMechanisms[0] || 'system failure'} while satisfying throughput and correctness requirements.`,
        evidence: pattern ? pattern.evidence : [],
        assumptions: ['Infrastructure supports coordinated state or bounded queueing'],
        risksAndTradeoffs: [
          'Requires proper configuration of timeouts, window sizes, or bounds',
        ],
        verificationRequirements: [
          'Must verify behavior under simulated burst and concurrent edge conditions',
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

    for (const concern of groundedConcerns.slice(0, 3)) {
      const patternId = concern.supportingKnowledgeIds[0];
      const pattern = patternId ? candidateMap.get(patternId) : undefined;

      const invId = `inv-${concern.id}`;
      invariants.push({
        id: invId,
        property: `The system must maintain safe operation under concurrent edge load and prevent ${concern.title}.`,
        severity: 'critical',
        blocksCompletion: true,
        rationale: `Unchecked ${concern.title} causes service degradation or data corruption.`,
      });

      verificationSpecs.push({
        id: `verif-${concern.id}`,
        target: invId,
        description: `Stress and boundary verification for ${concern.title}`,
        setup: 'Deploy instance in isolated test harness with active monitoring enabled.',
        action: `Execute synthetic load: ${pattern?.verificationIdeas[0] || 'Inject concurrent stimulus matching edge pattern'}.`,
        expectedProperty: 'System handles load gracefully; invariants hold; zero unhandled errors or data corruption.',
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
        ...decomposition.assumptions,
        'Production network connections may experience arbitrary packet latency',
        'Clients can send requests at concurrent peak rates exceeding average throughput',
      ],
      unresolvedQuestions: [
        ...decomposition.unresolvedQuestions,
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
      decomposition,
    };
  }
}
