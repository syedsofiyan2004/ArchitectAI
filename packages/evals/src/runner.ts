import {
  EvaluationCase,
  EvaluationResult,
  EngineeringContract,
  EngineeringContractSchema,
  EngineeringDimension,
} from '@architectai/domain';

/**
 * Deterministic evaluation runner that verifies architectural discovery outputs against an EvaluationCase.
 * Asserts:
 * 1. Output conforms to EngineeringContractSchema (runtime contract validity).
 * 2. All expectedDimensions are discovered.
 * 3. No forbiddenDimensions are hallucinated.
 */
export class DeterministicEvalRunner {
  evaluateContract(
    evalCase: EvaluationCase,
    contract: EngineeringContract
  ): EvaluationResult {
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
    for (const concern of contract.discoveredConcerns) {
      for (const dim of concern.dimensions) {
        discoveredDimensionsSet.add(dim);
      }
    }
    const discoveredDimensions = Array.from(discoveredDimensionsSet);

    // 3. Check expected dimensions (MUST be discovered)
    const missingExpectedDimensions: EngineeringDimension[] = [];
    for (const expected of evalCase.expectedDimensions) {
      if (!discoveredDimensionsSet.has(expected)) {
        missingExpectedDimensions.push(expected);
        failureReasons.push(`Missing expected dimension: ${expected}`);
      }
    }

    // 4. Check forbidden dimensions (MUST NOT be invented)
    const hallucinatedForbiddenDimensions: EngineeringDimension[] = [];
    for (const forbidden of evalCase.forbiddenDimensions) {
      if (discoveredDimensionsSet.has(forbidden)) {
        hallucinatedForbiddenDimensions.push(forbidden);
        failureReasons.push(`Hallucinated forbidden dimension: ${forbidden}`);
      }
    }

    const passed =
      contractConformsToSchema &&
      missingExpectedDimensions.length === 0 &&
      hallucinatedForbiddenDimensions.length === 0;

    return {
      evalCaseId: evalCase.id,
      passed,
      discoveredDimensions,
      missingExpectedDimensions,
      hallucinatedForbiddenDimensions,
      contractConformsToSchema,
      failureReasons,
      evaluatedAt: new Date().toISOString(),
    };
  }
}
