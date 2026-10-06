import {
  EngineeringContract,
  ImplementationPlan,
  RepositoryContext,
  VerificationPlan,
  VerificationPlanSchema,
  VerificationCase,
  VerificationIntent,
  VerificationIntentSchema,
  VerificationRecipe,
} from '@architectai/domain';
import {
  ProviderAdapter,
  DeterministicDemoProviderAdapter,
} from '@architectai/providers';
import {
  VerificationRecipeRepository,
  InMemoryVerificationRecipeRepository,
} from '@architectai/knowledge';
import {
  VerificationExecutorRegistry,
  ExecutorCapabilities,
} from '@architectai/verification';
import { GitDiffReport } from '../services/git-isolation.service.js';

/**
 * CompileVerificationPlanUseCase compiles executable adversarial verification plans
 * for an EngineeringContract and target workspace.
 *
 * Architecture Flow:
 * EngineeringContract + RepositoryContext + Available Recipes + Executor Capabilities
 *   → Provider Semantic Verification Reasoning (ProviderAdapter)
 *   → Structured VerificationIntent (Zod Validated)
 *   → Executor Capability Matching & Recipe Instantiation
 *   → Executable VerificationCase / VerificationPlan
 *
 * NOTE: The compiler contains ZERO domain-keyword branches (rate, payment, worker, etc.).
 * Invariant verification is driven entirely by data-driven recipes, provider intent synthesis,
 * and deterministic assertion evaluation.
 */
export class CompileVerificationPlanUseCase {
  constructor(
    protected readonly provider: ProviderAdapter = new DeterministicDemoProviderAdapter(),
    protected readonly recipes: VerificationRecipeRepository = new InMemoryVerificationRecipeRepository(),
    protected readonly executors: VerificationExecutorRegistry = new VerificationExecutorRegistry()
  ) {}

  async execute(
    contract: EngineeringContract,
    context: RepositoryContext,
    plan: ImplementationPlan,
    diffReport?: GitDiffReport
  ): Promise<VerificationPlan> {
    const planId = `vplan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const implementationRunId = plan.id;
    const baseHead = 'HEAD';

    const cases: VerificationCase[] = [];

    // Query supported executor capabilities generically from the executor registry
    const executorCapabilities = this.executors.getAllCapabilities();

    // For each engineering invariant, compile an adversarial verification case
    for (const invariant of contract.invariants) {
      const spec = contract.verificationSpecs.find((s) => s.target === invariant.id);
      const testCase = await this.compileInvariantCase(
        invariant,
        spec,
        contract,
        context,
        executorCapabilities,
        diffReport
      );
      cases.push(testCase);
    }

    // If no invariants exist, create an honest baseline verification case
    if (cases.length === 0) {
      cases.push({
        id: `case-baseline-01`,
        title: 'Baseline Architectural Invariant Verification',
        objective: 'Verify implementation integrity against architectural constraints',
        failureTarget: 'unhandled-architectural-fault',
        strategy: 'node_test_harness',
        targetInvariantId: 'inv-baseline',
        sourceConcernIds: [],
        sourceDecisionIds: [],
        preconditions: '',
        stimulus: '',
        expectedProperty: 'Target implementation loads and exports required contracts',
        assertions: [
          {
            id: 'assert-baseline',
            name: 'implementation_loaded',
            description: 'Target component successfully loads without uncaught exceptions',
            operator: 'eq',
            expected: true,
          },
        ],
        evidenceRequirements: ['implementation_loaded'],
        timeoutMs: 5000,
        isAutomatable: true,
      });
    }

    const verificationPlan: VerificationPlan = {
      id: planId,
      contractId: contract.id,
      implementationRunId,
      repositoryPath: plan.repositoryPath,
      baseHead,
      cases,
      createdAt: new Date().toISOString(),
    };

    return VerificationPlanSchema.parse(verificationPlan);
  }

  private async compileInvariantCase(
    invariant: EngineeringContract['invariants'][number],
    spec: EngineeringContract['verificationSpecs'][number] | undefined,
    contract: EngineeringContract,
    context: RepositoryContext,
    executorCapabilities: ExecutorCapabilities[],
    diffReport?: GitDiffReport
  ): Promise<VerificationCase> {
    const caseId = `case-${invariant.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

    // 1. Gather relevant concerns and decisions for this invariant
    const relevantConcerns = contract.discoveredConcerns.filter((c) =>
      invariant.id.includes(c.id) || true
    );
    const relevantDecisions = contract.decisions;

    // 2. Retrieve applicable candidate verification recipes from knowledge repository
    const patternIds = relevantConcerns.flatMap((c) => c.supportingKnowledgeIds);
    const dimensions = relevantConcerns.flatMap((c) => c.dimensions);

    const candidateRecipes: VerificationRecipe[] = await this.recipes.findApplicable({
      patternIds,
      dimensions,
    });

    // 3. Formulate structured prompt for provider verification reasoning
    const promptMessage = `
Invariant:
- ID: ${invariant.id}
- Property: ${invariant.property}
- Severity: ${invariant.severity}

Verification Spec:
- Setup: ${spec?.setup || ''}
- Stimulus: ${spec?.action || ''}
- Expected Property: ${spec?.expectedProperty || ''}

Discovered Concerns:
${relevantConcerns.map((c) => `- ${c.id}: ${c.title} (${c.dimensions.join(', ')})`).join('\n')}

Decisions:
${relevantDecisions.map((d) => `- ${d.id}: ${d.selectedOptionName} - ${d.rationale}`).join('\n')}

Candidate Verification Recipes:
${candidateRecipes.map((r) => `- Recipe: ${r.id} (${r.name}): patterns=[${r.applicableFailurePatterns.join(', ')}] dimensions=[${r.applicableDimensions.join(', ')}]`).join('\n')}

Repository Context Files:
${context.relevantFiles.join('\n')}

Changed Files (Diff):
${diffReport?.changedFiles.join('\n') || 'None yet'}

Supported Executor Capabilities:
${executorCapabilities.map((c) => `- Executor ${c.executorId}: strategies=[${c.supportedStrategies.join(', ')}] features=[${c.features.join(', ')}]`).join('\n')}
`;

    // 4. Provider semantic verification reasoning: emit schema-valid VerificationIntent
    let intent: VerificationIntent;
    try {
      const providerResponse = await this.provider.generateStructured<VerificationIntent>({
        schema: VerificationIntentSchema,
        schemaName: 'VerificationIntent',
        messages: [
          {
            role: 'system',
            content:
              'You are ArchitectAI Semantic Verification Planner. Reason about the invariant, failure hypothesis, adversarial stimulus, observations, and assertions to create a schema-valid VerificationIntent. You describe WHAT to test; software deterministically assigns verdicts.',
          },
          {
            role: 'user',
            content: promptMessage,
          },
        ],
      });

      intent = VerificationIntentSchema.parse(providerResponse.data);
    } catch {
      // If provider fails or emits invalid schema, fall back honestly to inconclusive intent
      intent = {
        id: `intent-err-${caseId}`,
        invariantId: invariant.id,
        specId: spec?.id,
        failureHypothesis: `Unable to derive valid verification intent for invariant ${invariant.id}`,
        systemOperationUnderTest: 'Unknown',
        requiredSetup: '',
        adversarialStimulus: '',
        observations: ['unverifiable_property'],
        assertions: [
          {
            id: `assert-err-${caseId}`,
            name: 'unverifiable_property',
            description: 'Verification intent derivation failed',
            operator: 'eq',
            expected: true,
          },
        ],
        targetFiles: [],
        targetSymbols: [],
        requiredCapabilities: [],
        confidence: 0,
        assumptions: [],
        unresolvedQuestions: ['Provider output could not be validated against VerificationIntentSchema'],
        isExecutable: false,
        inconclusiveReason: 'Could not identify executable interface for invariant.',
      };
    }

    // 5. Honest inability to verify: if intent is not executable, do not fabricate fake tests
    if (!intent.isExecutable) {
      return {
        id: caseId,
        title: `Independent Verification for ${invariant.id}`,
        objective: intent.failureHypothesis,
        failureTarget: 'uninstrumented-invariant',
        strategy: 'node_test_harness',
        targetInvariantId: invariant.id,
        targetSpecId: spec?.id,
        sourceConcernIds: contract.discoveredConcerns.map((c) => c.id),
        sourceDecisionIds: contract.decisions.map((d) => d.id),
        preconditions: intent.requiredSetup,
        stimulus: intent.adversarialStimulus,
        expectedProperty: invariant.property,
        assertions: intent.assertions,
        evidenceRequirements: intent.observations,
        timeoutMs: 5000,
        isAutomatable: false,
        // No harnessTemplate: execution will cleanly and honestly return INCONCLUSIVE
      };
    }

    // 6. Locate matching recipe for executable harness template
    let matchedRecipe: VerificationRecipe | undefined;
    if (intent.selectedRecipeId) {
      matchedRecipe = candidateRecipes.find((r) => r.id === intent.selectedRecipeId);
    }
    if (!matchedRecipe && candidateRecipes.length > 0) {
      matchedRecipe = candidateRecipes[0];
    }

    const failureTarget =
      matchedRecipe?.applicableFailurePatterns[0] || 'adversarial-invariant-fault';

    return {
      id: caseId,
      title: matchedRecipe?.name || `Adversarial Verification for ${invariant.id}`,
      objective: intent.failureHypothesis,
      failureTarget,
      strategy: (matchedRecipe?.strategy as import('@architectai/domain').VerificationStrategy) || 'node_test_harness',
      targetInvariantId: invariant.id,
      targetSpecId: spec?.id,
      sourceConcernIds: contract.discoveredConcerns.map((c) => c.id),
      sourceDecisionIds: contract.decisions.map((d) => d.id),
      preconditions: intent.requiredSetup,
      stimulus: intent.adversarialStimulus,
      expectedProperty: invariant.property,
      assertions: intent.assertions,
      evidenceRequirements: intent.observations,
      timeoutMs: 8000,
      isAutomatable: true,
      harnessTemplate: matchedRecipe?.harnessTemplate,
    };
  }
}
