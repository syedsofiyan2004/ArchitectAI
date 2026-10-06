import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  KnowledgeSource,
  SourceTrustTier
} from '@architectai/domain';
import { AcquireKnowledgeFromSourceUseCase } from './use-cases/acquire-knowledge.use-case.js';
import { KnowledgeAcquisitionRegistry } from '@architectai/knowledge';
import { LocalFixtureConnector } from './services/knowledge-connectors.js';
import { ProviderAdapter } from '@architectai/providers';

class MockKnowledgeProvider implements ProviderAdapter {
  readonly id = 'mock-knowledge-provider';
  readonly maxContextTokens = 100000;

  async generateText(): Promise<any> {
    return { content: '' };
  }

  getCapabilities() {
    return { supportsStructuredOutput: true, supportsStreaming: false, maxContextTokens: 100000 };
  }

  async generateStructured<T>(request: any): Promise<any> {
    const prompt = request.messages.find((m: any) => m.role === 'user')?.content || '';
    if (request.schemaName === 'ExtractClaims') {
      if (prompt.includes('PostgreSQL Transaction Isolation')) {
        return {
          content: '',
          data: {
            claims: [
              {
                evidenceLocator: 'Read Committed is the default',
                normalizedClaim: 'PostgreSQL default isolation level is Read Committed',
                claimType: 'DIRECT_SOURCE_CLAIM',
                entities: ['PostgreSQL'],
              }
            ]
          }
        };
      }
      if (prompt.includes('IGNORE PREVIOUS INSTRUCTIONS')) {
        return { content: '', data: { claims: [] } };
      }
      if (prompt.includes('Rate Limiter Example')) {
        return {
          content: '',
          data: {
            claims: [
              {
                evidenceLocator: 'Example setting',
                normalizedClaim: 'Example rate limiter is configured with 10 requests',
                claimType: 'DIRECT_SOURCE_CLAIM',
                entities: ['RateLimiter'],
              }
            ]
          }
        };
      }
      return { content: '', data: { claims: [] } };
    }

    if (request.schemaName === 'ExtractKnowledgeCandidates') {
      if (prompt.includes('PostgreSQL default isolation level is Read Committed')) {
        return {
          content: '',
          data: {
            candidates: [
              {
                title: 'PostgreSQL Default Isolation',
                normalizedConcept: 'postgres_default_isolation',
                proposedLevel: 'technology_specific',
                engineeringDimensions: ['concurrency'],
                applicabilityTriggers: ['postgres'],
                mechanism: 'Defaults to Read Committed',
                failureConsequences: ['non-repeatable reads'],
                mitigations: ['use serializable'],
                assumptions: [],
                sourceClaimIds: [prompt.match(/\[ID: (claim-.*?)\]/)?.[1] || ''],
                confidence: 0.9,
                exactTechnology: 'PostgreSQL',
              },
              {
                title: 'Non-repeatable Read',
                normalizedConcept: 'non_repeatable_read',
                proposedLevel: 'failure_pattern',
                engineeringDimensions: ['concurrency'],
                applicabilityTriggers: ['db'],
                mechanism: 'Reading different values in one tx',
                failureConsequences: ['inconsistency'],
                mitigations: ['higher isolation'],
                assumptions: [],
                sourceClaimIds: [prompt.match(/\[ID: (claim-.*?)\]/)?.[1] || ''],
                confidence: 0.9,
              },
              {
                title: 'Concurrency',
                normalizedConcept: 'concurrency',
                proposedLevel: 'fundamental',
                engineeringDimensions: ['concurrency'],
                applicabilityTriggers: [],
                mechanism: 'multiple things happening',
                failureConsequences: [],
                mitigations: [],
                assumptions: [],
                sourceClaimIds: [prompt.match(/\[ID: (claim-.*?)\]/)?.[1] || ''],
                confidence: 0.9,
              },
              {
                title: 'Fake Claim',
                normalizedConcept: 'fake',
                proposedLevel: 'technology_specific',
                engineeringDimensions: ['concurrency'],
                applicabilityTriggers: [],
                mechanism: 'fake',
                failureConsequences: [],
                mitigations: [],
                assumptions: [],
                sourceClaimIds: ['non-existent-claim'],
                confidence: 0.9,
              }
            ]
          }
        };
      }
      return { content: '', data: { candidates: [] } };
    }

    throw new Error('Unknown prompt schema: ' + request.schemaName);
  }
}

describe('Engineering Knowledge Acquisition & Discovery Engine', () => {
  let registry: KnowledgeAcquisitionRegistry;
  let useCase: AcquireKnowledgeFromSourceUseCase;
  const testDbPath = 'data/test-registry.json';

  beforeEach(() => {
    registry = new KnowledgeAcquisitionRegistry(testDbPath);
    registry.clearAllForTest();
    useCase = new AcquireKnowledgeFromSourceUseCase(
      new MockKnowledgeProvider(),
      [new LocalFixtureConnector()],
      registry
    );
  });

  afterEach(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  it('A, G, H, I, J: Extracts claims, generates candidates, applies strict acceptance policy and grounding', async () => {
    const source: KnowledgeSource = {
      id: 'src-postgres-1',
      publisher: 'PostgreSQL Global Development Group',
      sourceType: 'official_documentation',
      canonicalUrl: 'fixture://postgres-docs.md',
      technology: 'PostgreSQL',
      trustTier: 'TIER_2_OFFICIAL',
      discoveredAt: new Date().toISOString(),
    };

    const run = await useCase.execute(source);
    expect(run.status).toBe('COMPLETED');
    expect(run.metrics.extractedClaimsCount).toBe(1);
    expect(run.metrics.proposedItemsCount).toBe(3);

    const candidates = registry.getAllCandidates();
    expect(candidates.length).toBe(3);

    const l3 = candidates.find(c => c.proposedLevel === 'technology_specific' && c.title === 'PostgreSQL Default Isolation');
    expect(l3?.state).toBe('ACCEPTED'); // H. L3 official-source candidate -> accepted

    const l2 = candidates.find(c => c.proposedLevel === 'failure_pattern');
    expect(l2?.state).toBe('GROUNDED'); // I. Novel L2 failure pattern -> proposed/grounded but NOT auto-promoted

    const l1 = candidates.find(c => c.proposedLevel === 'fundamental');
    expect(l1?.state).toBe('REJECTED'); // J. Attempted automatic L1 creation -> rejected

    const acceptedItems = registry.getAllAcceptedKnowledge();
    expect(acceptedItems.length).toBe(1);
    expect(acceptedItems[0].title).toBe('PostgreSQL Default Isolation');
  });

  it('C: Source text contains prompt injection -> ignored', async () => {
    const source: KnowledgeSource = {
      id: 'src-inject-1',
      publisher: 'Attacker',
      sourceType: 'other',
      canonicalUrl: 'fixture://prompt-injection.md',
      trustTier: 'TIER_7_SECONDARY',
      discoveredAt: new Date().toISOString(),
    };

    const run = await useCase.execute(source);
    expect(run.status).toBe('COMPLETED');
    expect(run.metrics.extractedClaimsCount).toBe(0); // Ignored by the prompt rules
  });

  it('D: Same snapshot ingested twice -> no duplicates', async () => {
    const source: KnowledgeSource = {
      id: 'src-postgres-1',
      publisher: 'PostgreSQL Global Development Group',
      sourceType: 'official_documentation',
      canonicalUrl: 'fixture://postgres-docs.md',
      trustTier: 'TIER_2_OFFICIAL',
      discoveredAt: new Date().toISOString(),
    };

    await useCase.execute(source);
    const run2 = await useCase.execute(source);

    expect(run2.errors).toContain('Idempotency check: Snapshot with this content hash already exists. Skipping ingestion.');
    expect(run2.metrics.extractedClaimsCount).toBe(0);
  });
});

import { AnalyzeArchitectureUseCase } from './use-cases/analyze-architecture.use-case.js';
import { InMemoryKnowledgeRepository, prototypeKnowledgeFixtures } from '@architectai/knowledge';

class UnknownUnknownMockProvider implements ProviderAdapter {
  readonly id = 'uu-mock-provider';
  readonly maxContextTokens = 100000;

  async generateText(): Promise<any> { return { content: '' }; }

  getCapabilities() {
    return { supportsStructuredOutput: true, supportsStreaming: false, maxContextTokens: 100000 };
  }

  async generateStructured<T>(request: any): Promise<any> {
    const prompt = request.messages.find((m: any) => m.role === 'user')?.content || '';
    if (request.schemaName === 'RequirementDecomposition') {
      return { content: '', data: { explicitConstraints: [], intents: [], operations: ['Send email'], inferredEngineeringDimensions: ['side_effects', 'retries'] } };
    }
    if (request.schemaName === 'UnknownEngineeringDimensions') {
      return { content: '', data: { unknownDimensions: ['side_effects', 'retries'] } };
    }
    if (request.schemaName === 'ConcernRelevanceEvaluation') {
      if (prompt.includes('SQS Duplicate Delivery')) {
        // Extract the actual UUID assigned to this candidate in the prompt
        const match = prompt.match(/ID: (know-[\w-]+)\nTitle: SQS Duplicate Delivery/);
        const candId = match ? match[1] : 'duplicate_delivery';
        return { content: '', data: { evaluations: [{ candidateId: candId, relevance: 'applicable', applicabilityReason: 'SQS can deliver duplicates', assumptions: [], confidence: 1.0 }], ungroundedConcerns: [] } };
      }
      return { content: '', data: { evaluations: [], ungroundedConcerns: [] } };
    }
    if (request.schemaName === 'ArchitectureDecisions') {
      return { content: '', data: { decisions: [] } };
    }
    if (request.schemaName === 'ExtractClaims') {
      return {
        content: '',
        data: {
          claims: [
            {
              evidenceLocator: 'SQS standard queues delivery',
              normalizedClaim: 'SQS standard queues may deliver a message more than once.',
              claimType: 'DIRECT_SOURCE_CLAIM',
              entities: ['SQS'],
            }
          ]
        }
      };
    }
    if (request.schemaName === 'ExtractKnowledgeCandidates') {
      return {
        content: '',
        data: {
          candidates: [
            {
              title: 'SQS Duplicate Delivery',
              normalizedConcept: 'duplicate_delivery',
              proposedLevel: 'technology_specific',
              engineeringDimensions: ['side_effects', 'retries'],
              applicabilityTriggers: ['sqs'],
              mechanism: 'At-least-once delivery',
              failureConsequences: ['duplicate side effects'],
              mitigations: ['idempotency'],
              assumptions: [],
              sourceClaimIds: [prompt.match(/\[ID: (claim-.*?)\]/)?.[1] || ''],
              confidence: 0.95,
              exactTechnology: 'AWS SQS',
            }
          ]
        }
      };
    }
    throw new Error('Unknown prompt schema: ' + request.schemaName);
  }
}

describe('Unknown-Unknown Discovery Demonstration', () => {
  let registry: KnowledgeAcquisitionRegistry;
  let useCase: AcquireKnowledgeFromSourceUseCase;
  let analysisUseCase: AnalyzeArchitectureUseCase;
  let repo: InMemoryKnowledgeRepository;
  const testDbPath = 'data/test-uu-registry.json';

  beforeEach(async () => {
    registry = new KnowledgeAcquisitionRegistry(testDbPath);
    registry.clearAllForTest();
    
    const provider = new UnknownUnknownMockProvider();
    
    useCase = new AcquireKnowledgeFromSourceUseCase(
      provider,
      [new LocalFixtureConnector()],
      registry
    );

    repo = new InMemoryKnowledgeRepository();
    await repo.load(prototypeKnowledgeFixtures); // curated only initially

    analysisUseCase = new AnalyzeArchitectureUseCase(repo, provider);
  });

  afterEach(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  it('Proves ArchitectAI discovers a new concern only AFTER knowledge acquisition', async () => {
    // 1. BEFORE ACQUISITION
    // Analyze requirement
    const req = "We use AWS SQS standard queues to send welcome emails.";
    const beforeResult = await analysisUseCase.execute({ rawIntent: req });
    
    // Check that duplicate_delivery is NOT found (it doesn't exist in fixtures)
    const beforeConcern = beforeResult.contract.discoveredConcerns.find(c => c.title === 'SQS Duplicate Delivery');
    expect(beforeConcern).toBeUndefined(); // Concern is unknown!

    // 2. KNOWLEDGE ACQUISITION
    // Write dummy SQS doc fixture
    const sqsDocPath = 'packages/knowledge/src/fixtures/sqs-docs.md';
    fs.writeFileSync(sqsDocPath, '# SQS Delivery\nStandard queues may deliver a message more than once.');
    
    const source: KnowledgeSource = {
      id: 'src-sqs-1',
      publisher: 'AWS',
      sourceType: 'official_documentation',
      canonicalUrl: 'fixture://sqs-docs.md',
      technology: 'AWS SQS',
      trustTier: 'TIER_1_STANDARD',
      discoveredAt: new Date().toISOString(),
    };

    const run = await useCase.execute(source);
    expect(run.metrics.acceptedItemsCount).toBe(1);

    // 3. LOAD ACQUIRED KNOWLEDGE
    const acquiredItems = registry.getAllAcceptedKnowledge();
    await repo.load(acquiredItems);

    // 4. AFTER ACQUISITION
    const afterResult = await analysisUseCase.execute({ rawIntent: req });
    
    // Check that duplicate_delivery IS found
    const afterConcern = afterResult.contract.discoveredConcerns.find(c => c.title === 'SQS Duplicate Delivery');
    if (!afterConcern) {
      console.log('Discovered Concerns:', JSON.stringify(afterResult.contract.discoveredConcerns, null, 2));
    }
    expect(afterConcern).toBeDefined();
    expect(afterConcern?.supportingKnowledgeIds.length).toBeGreaterThan(0);

    // Clean up
    fs.unlinkSync(sqsDocPath);
  });
});
