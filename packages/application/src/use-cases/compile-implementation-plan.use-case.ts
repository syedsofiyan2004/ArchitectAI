import {
  EngineeringContract,
  RepositoryContext,
  ImplementationPlan,
  ImplementationPlanSchema,
} from '@architectai/domain';
import { ProviderAdapter } from '@architectai/providers';

export class CompileImplementationPlanUseCase {
  constructor(private readonly provider: ProviderAdapter) {}

  async execute(
    contract: EngineeringContract,
    context: RepositoryContext
  ): Promise<ImplementationPlan> {
    const systemPrompt = [
      'You are ArchitectAI Task Compiler.',
      'Your task is to compile an approved EngineeringContract and structured RepositoryContext into an executable ImplementationPlan composed of bounded ImplementationTask items.',
      'CRITICAL RULES:',
      '1. NEVER output generic tasks such as "Implement the architecture".',
      '2. Every task MUST be strictly traceable back to source concern IDs, architecture decision IDs, or invariant IDs.',
      '3. Clearly specify allowedFiles and excludedFiles for every task.',
      '4. Specify explicit, testable requirements and acceptanceCriteria for every task.',
      '5. Order tasks logically with dependencies if necessary.',
      '6. Return valid JSON matching the ImplementationPlanSchema.',
    ].join('\n');

    const userPrompt = [
      `Contract ID: ${contract.id}`,
      `Requirement: ${contract.requirement.rawIntent}`,
      `Tech Stack: ${contract.requirement.declaredTechStack.join(', ')}`,
      '',
      '--- DISCOVERED CONCERNS ---',
      ...contract.discoveredConcerns.map(
        (c) => `- ID: ${c.id} | Title: ${c.title} | Applicability: ${c.applicabilityReason}`
      ),
      '',
      '--- ARCHITECTURE DECISIONS ---',
      ...contract.decisions.map(
        (d) => `- ID: ${d.id} | Decision: ${d.selectedOptionName} | Rationale: ${d.rationale}`
      ),
      '',
      '--- INVARIANTS ---',
      ...contract.invariants.map(
        (i) => `- ID: ${i.id} | Invariant: ${i.property} | Severity: ${i.severity}`
      ),
      '',
      '--- REPOSITORY CONTEXT ---',
      `Repository Path: ${context.repositoryPath}`,
      `Probable Entry Points: ${context.probableEntryPoints.join(', ') || 'None found'}`,
      `Relevant Code Files: ${context.relevantFiles.join(', ') || 'None found'}`,
      `Existing Tests: ${context.existingTests.join(', ') || 'None found'}`,
      `Implementation Observations: ${context.implementationObservations.join('; ')}`,
    ].join('\n');

    const response = await this.provider.generateStructured<ImplementationPlan>({
      schema: ImplementationPlanSchema,
      schemaName: 'ImplementationPlan',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
    });

    const plan = ImplementationPlanSchema.parse(response.data);

    // Validate architectural traceability
    for (const task of plan.tasks) {
      const hasTrace =
        task.sourceConcernIds.length > 0 ||
        task.sourceDecisionIds.length > 0 ||
        task.sourceInvariantIds.length > 0;

      if (!hasTrace) {
        throw new Error(
          `Task ${task.id} violates architectural discipline: must trace to at least one concern, decision, or invariant.`
        );
      }
    }

    return plan;
  }
}
