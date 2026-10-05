import {
  EvaluationCase,
  EvaluationResult,
  EngineeringContract,
  EngineeringContractSchema,
  EngineeringDimension,
  KnowledgeLevel,
} from '@architectai/domain';

/**
 * KnowledgeLevelResolver input abstraction:
 * Can be a lookup function, a Map/Record, an object with `getById`, or an object with `resolveLevels`.
 * This preserves package boundaries and avoids coupling the eval runner to any concrete repository implementation.
 */
export type KnowledgeLevelResolver =
  | ((knowledgeId: string) => Promise<KnowledgeLevel[] | undefined> | KnowledgeLevel[] | undefined)
  | { getById(id: string): Promise<{ levels: KnowledgeLevel[] } | undefined> | { levels: KnowledgeLevel[] } | undefined }
  | { resolveLevels(knowledgeId: string): Promise<KnowledgeLevel[] | undefined> | KnowledgeLevel[] | undefined }
  | Map<string, KnowledgeLevel[]>
  | Record<string, KnowledgeLevel[]>;

async function resolveLevelsForId(
  resolver: KnowledgeLevelResolver,
  knowledgeId: string
): Promise<KnowledgeLevel[]> {
  if (typeof resolver === 'function') {
    const res = await resolver(knowledgeId);
    return res ?? [];
  }
  if (resolver instanceof Map) {
    return resolver.get(knowledgeId) ?? [];
  }
  if ('resolveLevels' in resolver && typeof resolver.resolveLevels === 'function') {
    const res = await resolver.resolveLevels(knowledgeId);
    return res ?? [];
  }
  if ('getById' in resolver && typeof resolver.getById === 'function') {
    const item = await resolver.getById(knowledgeId);
    return item?.levels ?? [];
  }
  if (typeof resolver === 'object' && resolver !== null) {
    return (resolver as Record<string, KnowledgeLevel[]>)[knowledgeId] ?? [];
  }
  return [];
}

/**
 * Deterministic evaluation runner that verifies architectural discovery outputs against an EvaluationCase.
 * Asserts:
 * 1. Output conforms to EngineeringContractSchema (runtime contract validity).
 * 2. All expectedDimensions are discovered.
 * 3. No forbiddenDimensions are hallucinated.
 * 4. All requiredKnowledgeLevels are represented in supporting knowledge items.
 */
export class DeterministicEvalRunner {
  async evaluateContract(
    evalCase: EvaluationCase,
    contract: EngineeringContract,
    knowledgeResolver?: KnowledgeLevelResolver
  ): Promise<EvaluationResult> {
    const failureReasons: string[] = [];

    // 1. Validate contract schema conformance
    let contractConformsToSchema = false;
    const schemaValidation = EngineeringContractSchema.safeParse(contract);
    if (schemaValidation.success) {
      contractConformsToSchema = true;
    } else {
      failureReasons.push(
        `Contract validation failed: ${schemaValidation.error.message}`
      );
    }

    // 2. Extract discovered dimensions from concerns
    const discoveredDimensionsSet = new Set<EngineeringDimension>();
    const supportingKnowledgeIdSet = new Set<string>();

    for (const concern of contract.discoveredConcerns) {
      for (const dim of concern.dimensions) {
        discoveredDimensionsSet.add(dim);
      }
      for (const kid of concern.supportingKnowledgeIds) {
        supportingKnowledgeIdSet.add(kid);
      }
    }
    const discoveredDimensions = Array.from(discoveredDimensionsSet);

    // 3. Resolve discovered knowledge levels from supporting knowledge items
    const discoveredKnowledgeLevelsSet = new Set<KnowledgeLevel>();
    if (knowledgeResolver) {
      for (const kid of supportingKnowledgeIdSet) {
        const levels = await resolveLevelsForId(knowledgeResolver, kid);
        for (const level of levels) {
          discoveredKnowledgeLevelsSet.add(level);
        }
      }
    }
    const discoveredKnowledgeLevels = Array.from(discoveredKnowledgeLevelsSet);

    // 4. Check expected dimensions (MUST be discovered)
    const missingExpectedDimensions: EngineeringDimension[] = [];
    for (const expected of evalCase.expectedDimensions) {
      if (!discoveredDimensionsSet.has(expected)) {
        missingExpectedDimensions.push(expected);
        failureReasons.push(`Missing expected dimension: ${expected}`);
      }
    }

    // 5. Check forbidden dimensions (MUST NOT be invented)
    const hallucinatedForbiddenDimensions: EngineeringDimension[] = [];
    for (const forbidden of evalCase.forbiddenDimensions) {
      if (discoveredDimensionsSet.has(forbidden)) {
        hallucinatedForbiddenDimensions.push(forbidden);
        failureReasons.push(`Hallucinated forbidden dimension: ${forbidden}`);
      }
    }

    // 6. Check required knowledge levels (MUST be represented)
    const missingRequiredKnowledgeLevels: KnowledgeLevel[] = [];
    for (const requiredLevel of evalCase.requiredKnowledgeLevels) {
      if (!discoveredKnowledgeLevelsSet.has(requiredLevel)) {
        missingRequiredKnowledgeLevels.push(requiredLevel);
        failureReasons.push(
          `Missing required knowledge level: ${requiredLevel}`
        );
      }
    }

    const passed =
      contractConformsToSchema &&
      missingExpectedDimensions.length === 0 &&
      hallucinatedForbiddenDimensions.length === 0 &&
      missingRequiredKnowledgeLevels.length === 0;

    return {
      evalCaseId: evalCase.id,
      passed,
      discoveredDimensions,
      missingExpectedDimensions,
      hallucinatedForbiddenDimensions,
      discoveredKnowledgeLevels,
      missingRequiredKnowledgeLevels,
      contractConformsToSchema,
      failureReasons,
      evaluatedAt: new Date().toISOString(),
    };
  }
}
