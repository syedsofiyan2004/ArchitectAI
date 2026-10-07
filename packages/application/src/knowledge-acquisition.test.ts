import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  KnowledgeSource,
  SourceTrustTier,
  ExtractedClaim,
  KnowledgeCandidate,
  parseVersionApplicability,
  isVersionOverlapping,
  SourceSnapshot,
  CandidateStatement
} from '@architectai/domain';
import { AcquireKnowledgeFromSourceUseCase } from './use-cases/acquire-knowledge.use-case.js';
import { GroundingValidator } from './use-cases/grounding-validator.js';
import { ClaimProvenanceValidator } from './services/claim-provenance-validator.js';
import { KnowledgeAcquisitionRegistry } from '@architectai/knowledge';
import { LocalFixtureConnector } from './services/knowledge-connectors.js';
import { SafeDocumentationFetcher, isBlockedIp } from './services/safe-documentation-fetcher.js';
import { ProviderAdapter } from '@architectai/providers';
import { AnalyzeArchitectureUseCase } from './use-cases/analyze-architecture.use-case.js';
import { InMemoryKnowledgeRepository, prototypeKnowledgeFixtures } from '@architectai/knowledge';

class DeterministicMockKnowledgeProvider implements ProviderAdapter {
  readonly id = 'deterministic-mock-knowledge-provider';
  readonly name = 'Deterministic Mock Knowledge Provider';

  getCapabilities() {
    return { supportsStructuredOutput: true, supportsStreaming: false, maxContextTokens: 100000 };
  }

  async generateText(): Promise<any> {
    return { content: '' };
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
                sourceQuote: 'Read Committed is the default isolation level in PostgreSQL.',
                evidenceLocator: 'Section 13.2: Transaction Isolation',
                normalizedClaim: 'PostgreSQL default isolation level is Read Committed',
                claimType: 'DIRECT_SOURCE_CLAIM',
                entities: ['PostgreSQL'],
              }
            ]
          }
        };
      }
      if (prompt.includes('PostgreSQL Serializable Default')) {
        return {
          content: '',
          data: {
            claims: [
              {
                sourceQuote: 'Serializable is the default isolation level.',
                evidenceLocator: 'Section 13.2: Alternative Spec',
                normalizedClaim: 'PostgreSQL default isolation level is Serializable',
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
                sourceQuote: 'To configure the rate limiter, set a limit on the number of requests.',
                evidenceLocator: 'Example Configuration',
                normalizedClaim: 'Rate limiter requires configuring a limit on the number of requests',
                claimType: 'DIRECT_SOURCE_CLAIM',
                entities: ['RateLimiter'],
              }
            ]
          }
        };
      }
      if (prompt.includes('SQS Delivery')) {
        return {
          content: '',
          data: {
            claims: [
              {
                sourceQuote: 'Standard queues may deliver a message more than once.',
                evidenceLocator: 'SQS standard queues delivery',
                normalizedClaim: 'SQS standard queues may deliver a message more than once.',
                claimType: 'DIRECT_SOURCE_CLAIM',
                entities: ['AWS SQS'],
              }
            ]
          }
        };
      }
      if (prompt.includes('Redis Pub/Sub')) {
        return {
          content: '',
          data: {
            claims: [
              {
                sourceQuote: 'Pub/sub messages are lost if client is disconnected.',
                evidenceLocator: 'Redis Pub/Sub disconnect',
                normalizedClaim: 'Redis pub/sub delivers at-most-once; messages published while a subscriber is disconnected are permanently lost.',
                claimType: 'DIRECT_SOURCE_CLAIM',
                entities: ['Redis'],
              }
            ]
          }
        };
      }
      return { content: '', data: { claims: [] } };
    }

    if (request.schemaName === 'ExtractKnowledgeCandidates') {
      if (prompt.includes('PostgreSQL default isolation level is Read Committed')) {
        const claimId = prompt.match(/\[ID: (claim-.*?)\]/)?.[1] || '';
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
                sourceClaimIds: [claimId],
                confidence: 0.9,
                exactTechnology: 'PostgreSQL',
                operationalConstraints: [],
                fieldStatements: [
                  {
                    field: 'mechanism',
                    normalizedStatement: 'Defaults to Read Committed',
                    supportingClaimIds: [claimId],
                    supportType: 'DIRECT_SOURCE',
                  }
                ],
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
                sourceClaimIds: [claimId],
                confidence: 0.9,
                fieldStatements: [
                  {
                    field: 'mechanism',
                    normalizedStatement: 'Reading different values in one tx',
                    supportingClaimIds: [claimId],
                    supportType: 'DIRECT_SOURCE',
                  }
                ],
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
                sourceClaimIds: [claimId],
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

      if (prompt.includes('PostgreSQL default isolation level is Serializable')) {
        const claimId = prompt.match(/\[ID: (claim-.*?)\]/)?.[1] || '';
        return {
          content: '',
          data: {
            candidates: [
              {
                title: 'PostgreSQL Default Isolation Contradiction',
                normalizedConcept: 'postgres_default_isolation',
                proposedLevel: 'technology_specific',
                engineeringDimensions: ['concurrency'],
                applicabilityTriggers: ['postgres'],
                mechanism: 'Defaults to Serializable',
                failureConsequences: ['serialization failures'],
                mitigations: ['retry transactions'],
                assumptions: [],
                sourceClaimIds: [claimId],
                confidence: 0.9,
                exactTechnology: 'PostgreSQL',
                operationalConstraints: [],
                fieldStatements: [
                  {
                    field: 'mechanism',
                    normalizedStatement: 'Defaults to Serializable',
                    supportingClaimIds: [claimId],
                    supportType: 'DIRECT_SOURCE',
                  }
                ],
              }
            ]
          }
        };
      }

      if (prompt.includes('SQS standard queues may deliver a message more than once')) {
        const claimId = prompt.match(/\[ID: (claim-.*?)\]/)?.[1] || '';
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
                sourceClaimIds: [claimId],
                confidence: 0.95,
                exactTechnology: 'AWS SQS',
                operationalConstraints: ['SQS guarantees maximum 5000 messages/second'], // Invented constraint!
                fieldStatements: [
                  {
                    field: 'mechanism',
                    normalizedStatement: 'At-least-once delivery',
                    supportingClaimIds: [claimId],
                    supportType: 'DIRECT_SOURCE',
                  },
                  {
                    field: 'operationalConstraints',
                    normalizedStatement: 'SQS guarantees maximum 5000 messages/second',
                    supportingClaimIds: [claimId], // Claim doesn't mention 5000 messages/sec!
                    supportType: 'DIRECT_SOURCE',
                  }
                ]
              }
            ]
          }
        };
      }

      if (prompt.includes('Redis pub/sub delivers at-most-once')) {
        const claimId = prompt.match(/\[ID: (claim-.*?)\]/)?.[1] || '';
        return {
          content: '',
          data: {
            candidates: [
              {
                title: 'Redis PubSub Message Loss on Disconnect',
                normalizedConcept: 'redis_pubsub_disconnect_loss',
                proposedLevel: 'technology_specific',
                engineeringDimensions: ['persistence', 'dependency_failure'],
                applicabilityTriggers: ['redis', 'pubsub'],
                mechanism: 'Redis Pub/Sub does not buffer or persist messages for disconnected subscribers.',
                failureConsequences: ['silent message loss on subscriber restart'],
                mitigations: ['use Redis Streams with consumer groups'],
                assumptions: [],
                sourceClaimIds: [claimId],
                confidence: 0.95,
                exactTechnology: 'Redis',
                operationalConstraints: [],
                fieldStatements: [
                  {
                    field: 'mechanism',
                    normalizedStatement: 'Redis Pub/Sub does not buffer or persist messages for disconnected subscribers.',
                    supportingClaimIds: [claimId],
                    supportType: 'DIRECT_SOURCE',
                  }
                ]
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
  const testDbPath = 'data/test-registry-m5.json';

  beforeEach(() => {
    registry = new KnowledgeAcquisitionRegistry(testDbPath);
    registry.clearAllForTest();
    useCase = new AcquireKnowledgeFromSourceUseCase(
      new DeterministicMockKnowledgeProvider(),
      [new LocalFixtureConnector()],
      registry
    );
  });

  afterEach(() => {
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch {}
    }
  });

  describe('1. Approved Source Registry Enforcement', () => {
    it('rejects acquisition from unregistered HTTP source', async () => {
      const unregisteredSource: KnowledgeSource = {
        id: 'src-unregistered-http',
        publisher: 'Random Blog',
        sourceType: 'other',
        canonicalUrl: 'https://example.com/unregistered/docs',
        trustTier: 'TIER_7_SECONDARY',
        discoveredAt: new Date().toISOString(),
      };

      await expect(useCase.execute(unregisteredSource)).rejects.toThrow(
        /Unregistered HTTP source/
      );
    });

    it('allows acquisition from registered source via source ID', async () => {
      const registeredSource: KnowledgeSource = {
        id: 'src-postgres-reg',
        publisher: 'PostgreSQL Global Development Group',
        sourceType: 'official_documentation',
        canonicalUrl: 'fixture://postgres-docs.md',
        technology: 'PostgreSQL',
        trustTier: 'TIER_2_OFFICIAL',
        discoveredAt: new Date().toISOString(),
      };
      registry.registerSource(registeredSource);

      const run = await useCase.execute('src-postgres-reg');
      expect(run.status).toBe('COMPLETED');
      expect(run.sourceId).toBe('src-postgres-reg');
    });

    it('rejects acquisition when registered source ID is called with tampered URL', async () => {
      const legitSource: KnowledgeSource = {
        id: 'src-registered-1',
        publisher: 'Postgres',
        sourceType: 'official_documentation',
        canonicalUrl: 'https://postgres.org/official-docs',
        trustTier: 'TIER_2_OFFICIAL',
        discoveredAt: new Date().toISOString(),
      };
      registry.registerSource(legitSource);

      const tamperedSource: KnowledgeSource = {
        ...legitSource,
        canonicalUrl: 'https://attacker.org/fake-docs',
      };

      await expect(useCase.execute(tamperedSource)).rejects.toThrow(
        /Tampered source URL/
      );
    });
  });

  describe('2. HTTP SSRF Boundary & SafeDocumentationFetcher', () => {
    const fetcher = new SafeDocumentationFetcher();

    it('isBlockedIp accurately classifies private, loopback, link-local, and multicast ranges', () => {
      // Loopback
      expect(isBlockedIp('127.0.0.1')).toBe(true);
      expect(isBlockedIp('127.255.255.255')).toBe(true);
      expect(isBlockedIp('::1')).toBe(true);

      // RFC1918
      expect(isBlockedIp('10.0.0.1')).toBe(true);
      expect(isBlockedIp('172.16.0.1')).toBe(true);
      expect(isBlockedIp('172.31.255.255')).toBe(true);
      expect(isBlockedIp('192.168.1.100')).toBe(true);

      // Link-local / Cloud metadata
      expect(isBlockedIp('169.254.169.254')).toBe(true);
      expect(isBlockedIp('169.254.0.1')).toBe(true);
      expect(isBlockedIp('fe80::1')).toBe(true);

      // Private IPv6 unique local
      expect(isBlockedIp('fc00::1')).toBe(true);
      expect(isBlockedIp('fd12:3456:789a::1')).toBe(true);

      // IPv4-mapped private IPv6
      expect(isBlockedIp('::ffff:127.0.0.1')).toBe(true);
      expect(isBlockedIp('::ffff:10.0.0.1')).toBe(true);
      expect(isBlockedIp('::ffff:7f00:1')).toBe(true);

      // Public IPs are NOT blocked
      expect(isBlockedIp('93.184.216.34')).toBe(false);
      expect(isBlockedIp('8.8.8.8')).toBe(false);
      expect(isBlockedIp('1.1.1.1')).toBe(false);
    });

    it('rejects localhost, loopback, and private IPs in URL validation', async () => {
      await expect(fetcher.validateUrl('https://localhost/api')).rejects.toThrow(/SSRF Blocked/);
      await expect(fetcher.validateUrl('https://127.0.0.1/doc')).rejects.toThrow(/SSRF Blocked/);
      await expect(fetcher.validateUrl('https://10.0.0.5/doc')).rejects.toThrow(/SSRF Blocked/);
      await expect(fetcher.validateUrl('https://192.168.1.1/doc')).rejects.toThrow(/SSRF Blocked/);
      await expect(fetcher.validateUrl('https://172.16.5.5/doc')).rejects.toThrow(/SSRF Blocked/);
      await expect(fetcher.validateUrl('https://169.254.169.254/latest')).rejects.toThrow(/SSRF Blocked/);
      await expect(fetcher.validateUrl('https://[::1]/doc')).rejects.toThrow(/SSRF Blocked/);
      await expect(fetcher.validateUrl('https://[fc00::1]/doc')).rejects.toThrow(/SSRF Blocked/);
      await expect(fetcher.validateUrl('https://[::ffff:127.0.0.1]/doc')).rejects.toThrow(/SSRF Blocked/);
    });

    it('rejects embedded credentials in URL', async () => {
      await expect(fetcher.validateUrl('https://admin:secret@example.com/docs')).rejects.toThrow(
        /embedded credentials/
      );
    });

    it('rejects hostname resolving to private IP via DNS', async () => {
      const mockResolverFetcher = new SafeDocumentationFetcher({
        dnsResolver: async (_host) => ['10.50.100.1'], // Resolves to private IP
      });

      await expect(mockResolverFetcher.validateUrl('https://internal.company.corp/docs')).rejects.toThrow(
        /resolved to private\/restricted IP/
      );
    });

    it('enforces streaming body size limit before buffering full content', async () => {
      const streamLimitedFetcher = new SafeDocumentationFetcher({
        maxSizeBytes: 50,
        dnsResolver: async () => ['93.184.216.34'],
      });

      const originalFetch = globalThis.fetch;
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(30));
          controller.enqueue(new Uint8Array(30)); // 60 bytes > 50 bytes limit
          controller.close();
        }
      });

      globalThis.fetch = async () => new Response(stream, {
        headers: { 'content-type': 'text/plain' }
      });

      try {
        await expect(
          streamLimitedFetcher.fetch('https://example.com/stream-test')
        ).rejects.toThrow(/exceeded maximum limit of 50 bytes during streaming/);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('3. Local Fixture Connector Path Traversal Hardening', () => {
    it('blocks path traversal escaping fixture root (fixture://../../secret)', async () => {
      const connector = new LocalFixtureConnector();
      const maliciousSource: KnowledgeSource = {
        id: 'src-traversal-attack',
        publisher: 'Attacker',
        sourceType: 'other',
        canonicalUrl: 'fixture://../../package.json',
        trustTier: 'TIER_7_SECONDARY',
        discoveredAt: new Date().toISOString(),
      };

      await expect(connector.retrieve(maliciousSource)).rejects.toThrow(
        /Path traversal blocked/
      );
    });
  });

  describe('4. Claim Provenance Validator & Source Text Anchoring', () => {
    const claimValidator = new ClaimProvenanceValidator();
    const sampleSnapshot: SourceSnapshot = {
      id: 'snap-anchoring-test',
      sourceId: 'src-pg',
      url: 'fixture://postgres-docs.md',
      retrievedAt: new Date().toISOString(),
      contentHash: 'hash123',
      normalizedTextContent: 'Read Committed is the default isolation level in PostgreSQL.',
      sections: [
        {
          id: 'sec-1',
          heading: 'Transaction Isolation',
          content: 'Read Committed is the default isolation level in PostgreSQL.',
          path: ['H1'],
        },
        {
          id: 'sec-2',
          heading: 'Other Section',
          content: 'Some other unrelated section content.',
          path: ['H2'],
        }
      ],
      documentMetadata: {},
    };

    it('anchors DIRECT_SOURCE_CLAIM when sourceQuote matches section text', () => {
      const claim: ExtractedClaim = {
        id: 'claim-valid-anchor',
        sourceSnapshotId: 'snap-anchoring-test',
        sectionId: 'sec-1',
        evidenceLocator: 'Section 13.2',
        sourceQuote: 'Read Committed is the default isolation level in PostgreSQL.',
        normalizedClaim: 'PostgreSQL defaults to Read Committed',
        claimType: 'DIRECT_SOURCE_CLAIM',
        entities: ['PostgreSQL'],
        extractionModel: 'mock',
        extractedAt: new Date().toISOString(),
        versionApplicability: 'CURRENT_DOCS',
        confidence: 0.95,
      };

      const result = claimValidator.validateClaim(claim, sampleSnapshot);
      expect(result.isValid).toBe(true);
      expect(result.action).toBe('ACCEPTED');
      expect(result.validatedClaim.claimType).toBe('DIRECT_SOURCE_CLAIM');
      expect(result.validatedClaim.sourceStartOffset).toBe(0);
      expect(result.validatedClaim.sourceEndOffset).toBe(claim.sourceQuote?.length);
    });

    it('rejects/downgrades fabricated direct quote that does not exist in section', () => {
      const fabricatedClaim: ExtractedClaim = {
        id: 'claim-fabricated',
        sourceSnapshotId: 'snap-anchoring-test',
        sectionId: 'sec-1',
        evidenceLocator: 'Section 13.2',
        sourceQuote: 'Standard queues guarantee exactly-once delivery.', // Does NOT exist in sec-1
        normalizedClaim: 'PostgreSQL guarantees exactly-once delivery',
        claimType: 'DIRECT_SOURCE_CLAIM',
        entities: ['PostgreSQL'],
        extractionModel: 'mock',
        extractedAt: new Date().toISOString(),
        versionApplicability: 'CURRENT_DOCS',
        confidence: 0.9,
      };

      const result = claimValidator.validateClaim(fabricatedClaim, sampleSnapshot);
      expect(result.isValid).toBe(true);
      expect(result.action).toBe('DOWNGRADED_TO_INFERENCE');
      expect(result.validatedClaim.claimType).toBe('MODEL_INFERENCE');
      expect(result.validatedClaim.sourceQuote).toBeUndefined();
    });

    it('rejects quote that comes from a different section in the same document', () => {
      const crossSectionClaim: ExtractedClaim = {
        id: 'claim-cross-section',
        sourceSnapshotId: 'snap-anchoring-test',
        sectionId: 'sec-2', // Quotes sec-1 text while referencing sec-2
        evidenceLocator: 'Section 13.2',
        sourceQuote: 'Read Committed is the default isolation level in PostgreSQL.',
        normalizedClaim: 'PostgreSQL defaults to Read Committed',
        claimType: 'DIRECT_SOURCE_CLAIM',
        entities: ['PostgreSQL'],
        extractionModel: 'mock',
        extractedAt: new Date().toISOString(),
        versionApplicability: 'CURRENT_DOCS',
        confidence: 0.9,
      };

      const result = claimValidator.validateClaim(crossSectionClaim, sampleSnapshot);
      expect(result.action).toBe('DOWNGRADED_TO_INFERENCE');
      expect(result.validatedClaim.claimType).toBe('MODEL_INFERENCE');
    });
  });

  describe('5. Semantic Field-Level Grounding & Inference Separation', () => {
    const validator = new GroundingValidator();
    const sqsClaim: ExtractedClaim = {
      id: 'claim-sqs-anchor',
      sourceSnapshotId: 'snap-sqs',
      sectionId: 'sec-sqs-1',
      evidenceLocator: 'Section 1',
      sourceQuote: 'Standard queues may deliver a message more than once.',
      normalizedClaim: 'SQS standard queues may deliver a message more than once.',
      claimType: 'DIRECT_SOURCE_CLAIM',
      entities: ['AWS SQS'],
      versionApplicability: 'CURRENT_DOCS',
      confidence: 0.95,
      extractionModel: 'mock',
      extractedAt: new Date().toISOString(),
    };

    it('downgrades unsupported non-numeric statement that contradicts source semantics', () => {
      // Source: SQS standard queues may deliver a message more than once.
      // Candidate statement: SQS automatically guarantees exactly-once delivery.
      const candidateStmt: CandidateStatement = {
        field: 'mechanism',
        normalizedStatement: 'SQS automatically guarantees exactly-once delivery.',
        supportingClaimIds: ['claim-sqs-anchor'],
        supportType: 'DIRECT_SOURCE',
      };

      const assessment = validator.assessStatementGrounding(candidateStmt, [sqsClaim]);
      expect(assessment.isSupported).toBe(false);
      expect(assessment.supportType).toBe('MODEL_INFERENCE');
      expect(assessment.statementType).toBe('ENGINEERING_INFERENCE');
      expect(assessment.reason).toContain('contradicts authoritative source claims');
    });

    it('preserves clear distinction between SOURCE_FACT and ENGINEERING_INFERENCE', () => {
      // Direct source fact
      const factStmt: CandidateStatement = {
        field: 'mechanism',
        normalizedStatement: 'Standard queues may deliver a message more than once.',
        supportingClaimIds: ['claim-sqs-anchor'],
        supportType: 'DIRECT_SOURCE',
      };
      const factAssessment = validator.assessStatementGrounding(factStmt, [sqsClaim]);
      expect(factAssessment.supportType).toBe('DIRECT_SOURCE');
      expect(factAssessment.statementType).toBe('SOURCE_FACT');

      // Model-derived engineering consequence
      const inferenceStmt: CandidateStatement = {
        field: 'failureConsequences',
        normalizedStatement: 'This may cause duplicate payment or email side effects if consumers are not idempotent.',
        supportingClaimIds: ['claim-sqs-anchor'],
        supportType: 'MODEL_INFERENCE',
      };
      const inferenceAssessment = validator.assessStatementGrounding(inferenceStmt, [sqsClaim]);
      expect(inferenceAssessment.statementType).toBe('ENGINEERING_INFERENCE');
      expect(inferenceAssessment.supportType).toBe('MODEL_INFERENCE');
    });

    it('strips invented quantitative operational constraint not supported by direct claims', async () => {
      const candidate: KnowledgeCandidate = {
        id: 'cand-sqs-invented',
        state: 'PROPOSED',
        title: 'SQS Duplicate Delivery',
        normalizedConcept: 'duplicate_delivery',
        proposedLevel: 'technology_specific',
        engineeringDimensions: ['side_effects'],
        applicabilityTriggers: ['sqs'],
        mechanism: 'At-least-once delivery',
        failureConsequences: ['duplicate side effects'],
        mitigations: ['idempotent receiver'],
        assumptions: [],
        sourceClaimIds: ['claim-sqs-anchor'],
        confidence: 0.9,
        operationalConstraints: ['SQS guarantees maximum 5000 messages/second'],
        fieldStatements: [
          {
            field: 'mechanism',
            normalizedStatement: 'Standard queues may deliver a message more than once.',
            supportingClaimIds: ['claim-sqs-anchor'],
            supportType: 'DIRECT_SOURCE',
          },
          {
            field: 'operationalConstraints',
            normalizedStatement: 'SQS guarantees maximum 5000 messages/second',
            supportingClaimIds: ['claim-sqs-anchor'],
            supportType: 'DIRECT_SOURCE',
          }
        ],
      };

      const source: KnowledgeSource = {
        id: 'src-sqs-test',
        publisher: 'AWS',
        sourceType: 'official_documentation',
        canonicalUrl: 'fixture://sqs-docs.md',
        trustTier: 'TIER_1_STANDARD',
        discoveredAt: new Date().toISOString(),
      };

      const result = await validator.validateCandidate(candidate, source, [sqsClaim]);
      expect(result.state).toBe('GROUNDED');
      expect(result.operationalConstraints).not.toContain('SQS guarantees maximum 5000 messages/second');
    });
  });

  describe('6. Complete 6-Link Provenance Chain', () => {
    it('preserves unbroken provenance: Item -> Statement -> Claim -> Section -> Snapshot -> Source', async () => {
      const source: KnowledgeSource = {
        id: 'src-provenance-test',
        publisher: 'PostgreSQL Global Development Group',
        sourceType: 'official_documentation',
        canonicalUrl: 'fixture://postgres-docs.md',
        technology: 'PostgreSQL',
        trustTier: 'TIER_2_OFFICIAL',
        versionApplicability: 'CURRENT_DOCS',
        discoveredAt: new Date().toISOString(),
      };
      registry.registerSource(source);

      const run = await useCase.execute(source);
      expect(run.status).toBe('COMPLETED');

      const accepted = registry.getAllAcceptedKnowledge();
      expect(accepted.length).toBeGreaterThan(0);

      const item = accepted[0];
      expect(item.evidence.length).toBeGreaterThan(0);

      const ev = item.evidence[0];
      // 1. Registered Knowledge Source
      expect(ev.sourceId).toBe('src-provenance-test');
      expect(ev.publisher).toBe('PostgreSQL Global Development Group');
      expect(ev.trustTier).toBe('TIER_2_OFFICIAL');
      expect(ev.sourceUrlOrIdentifier).toBe('fixture://postgres-docs.md');

      // 2. Source Snapshot
      expect(ev.snapshotId).toBeDefined();
      const snapshot = registry.getSnapshot(ev.snapshotId!);
      expect(snapshot).toBeDefined();
      expect(snapshot?.sourceId).toBe('src-provenance-test');

      // 3. Source Section
      expect(ev.sectionId).toBeDefined();
      const section = snapshot?.sections.find(s => s.id === ev.sectionId);
      expect(section).toBeDefined();

      // 4. Extracted Claim & Anchored Quote
      expect(ev.claimId).toBeDefined();
      const claim = registry.getClaim(ev.claimId!);
      expect(claim).toBeDefined();
      expect(ev.sourceQuote).toBe('Read Committed is the default isolation level in PostgreSQL.');
      expect(claim?.sourceQuote).toBe(ev.sourceQuote);

      // 5. Section text actually contains the quote
      expect(section?.content).toContain(ev.sourceQuote!);
      expect(ev.evidenceType).toBe('SOURCE_FACT');
    });
  });

  describe('7. Conflict Detection with Correct Multi-Source Provenance Chain', () => {
    it('correctly resolves Source A and Source B IDs and authority tiers through snapshots', async () => {
      // 1. Source A
      const sourceA: KnowledgeSource = {
        id: 'src-conflict-a',
        publisher: 'Official Postgres Documentation',
        sourceType: 'official_documentation',
        canonicalUrl: 'fixture://postgres-docs.md',
        technology: 'PostgreSQL',
        trustTier: 'TIER_2_OFFICIAL',
        versionApplicability: 'CURRENT_DOCS',
        discoveredAt: new Date().toISOString(),
      };
      registry.registerSource(sourceA);
      await useCase.execute(sourceA);

      // 2. Source B
      const contradictionDoc = 'packages/knowledge/src/fixtures/postgres-contradiction.md';
      fs.writeFileSync(contradictionDoc, '# PostgreSQL Serializable Default\nSerializable is the default isolation level.');

      const sourceB: KnowledgeSource = {
        id: 'src-conflict-b',
        publisher: 'Alternative Postgres Spec',
        sourceType: 'official_documentation',
        canonicalUrl: 'fixture://postgres-contradiction.md',
        technology: 'PostgreSQL',
        trustTier: 'TIER_3_GUIDANCE',
        versionApplicability: 'CURRENT_DOCS',
        discoveredAt: new Date().toISOString(),
      };
      registry.registerSource(sourceB);

      const runB = await useCase.execute(sourceB);
      expect(runB.status).toBe('COMPLETED');
      expect(runB.metrics.conflictsCount).toBe(1);

      const conflicts = registry.getAllConflicts();
      expect(conflicts.length).toBe(1);
      const conflict = conflicts[0];

      // Verify correct multi-source provenance resolution
      expect(conflict.sourceIds).toContain('src-conflict-a');
      expect(conflict.sourceIds).toContain('src-conflict-b');
      expect(conflict.sourceAuthorityLevels).toContain('TIER_2_OFFICIAL');
      expect(conflict.sourceAuthorityLevels).toContain('TIER_3_GUIDANCE');
      expect(conflict.snapshotIds.length).toBeGreaterThanOrEqual(1);
      expect(conflict.unresolvedStatus).toBe(true);

      try { fs.unlinkSync(contradictionDoc); } catch {}
    });

    it('distinguishes version applicability: non-overlapping versions do not create conflict', () => {
      const v1 = parseVersionApplicability('v14.0');
      const v2 = parseVersionApplicability('v16.0');
      expect(isVersionOverlapping(v1, v2)).toBe(false);

      const vCurrent = parseVersionApplicability('CURRENT_DOCS');
      expect(isVersionOverlapping(v1, vCurrent)).toBe(true);
    });
  });

  describe('8. Source Update Semantics & Review Required State', () => {
    it('flags dependent knowledge as REVIEW_REQUIRED when underlying claims are removed in a new snapshot', async () => {
      const dynamicDoc = 'packages/knowledge/src/fixtures/dynamic-pg.md';
      fs.writeFileSync(dynamicDoc, '# PostgreSQL Transaction Isolation\nRead Committed is the default isolation level in PostgreSQL.');

      const source: KnowledgeSource = {
        id: 'src-dynamic-1',
        publisher: 'Postgres',
        sourceType: 'official_documentation',
        canonicalUrl: 'fixture://dynamic-pg.md',
        technology: 'PostgreSQL',
        trustTier: 'TIER_2_OFFICIAL',
        discoveredAt: new Date().toISOString(),
      };
      registry.registerSource(source);

      const run1 = await useCase.execute(source);
      expect(run1.status).toBe('COMPLETED');
      expect(registry.getAllAcceptedKnowledge().length).toBe(1);
      expect(registry.getAllAcceptedKnowledge()[0].status).toBe('ACCEPTED');

      // Updated snapshot with changed hash where the default isolation claim is removed
      fs.writeFileSync(dynamicDoc, '# Rewritten Architecture\nThis section has been rewritten with no default statements.');

      const run2 = await useCase.execute(source);
      expect(run2.status).toBe('COMPLETED');

      const acceptedItems = registry.getAllAcceptedKnowledge();
      const affectedItem = acceptedItems.find(i => i.title === 'PostgreSQL Default Isolation');
      expect(affectedItem?.status).toBe('REVIEW_REQUIRED');

      try { fs.unlinkSync(dynamicDoc); } catch {}
    });
  });
});

describe('Generic Unknown-Unknown Discovery Demonstrations', () => {
  let registry: KnowledgeAcquisitionRegistry;
  let useCase: AcquireKnowledgeFromSourceUseCase;
  let repo: InMemoryKnowledgeRepository;
  const testDbPath = 'data/test-generic-uu.json';

  class GenericDiscoveryMockProvider implements ProviderAdapter {
    readonly id = 'generic-uu-provider';
    readonly name = 'Generic UU Provider';

    getCapabilities() {
      return { supportsStructuredOutput: true, supportsStreaming: false, maxContextTokens: 100000 };
    }

    async generateText(): Promise<any> { return { content: '' }; }

    async generateStructured<T>(request: any): Promise<any> {
      const prompt = request.messages.find((m: any) => m.role === 'user')?.content || '';

      if (request.schemaName === 'RequirementDecomposition') {
        const isSqs = prompt.includes('SQS') || prompt.includes('sqs');
        return {
          content: '',
          data: {
            explicitConstraints: [],
            intents: [],
            operations: [isSqs ? 'Deliver messages' : 'Distribute transaction events'],
            inferredEngineeringDimensions: isSqs ? ['side_effects', 'retries'] : ['persistence', 'dependency_failure'],
          }
        };
      }

      if (request.schemaName === 'UnknownEngineeringDimensions') {
        const isSqs = prompt.includes('SQS') || prompt.includes('sqs');
        return {
          content: '',
          data: {
            unknownDimensions: isSqs ? ['side_effects', 'retries'] : ['persistence', 'dependency_failure'],
          }
        };
      }

      if (request.schemaName === 'ConcernRelevanceEvaluation') {
        if (prompt.includes('SQS Duplicate Delivery')) {
          const match = prompt.match(/ID: (know-[\w-]+)\nTitle: SQS Duplicate Delivery/);
          const candId = match ? match[1] : 'duplicate_delivery';
          return { content: '', data: { evaluations: [{ candidateId: candId, relevance: 'applicable', applicabilityReason: 'SQS can deliver duplicates', assumptions: [], confidence: 1.0 }], ungroundedConcerns: [] } };
        }
        if (prompt.includes('Redis PubSub Message Loss on Disconnect')) {
          const match = prompt.match(/ID: (know-[\w-]+)\nTitle: Redis PubSub Message Loss on Disconnect/);
          const candId = match ? match[1] : 'redis_pubsub_disconnect_loss';
          return { content: '', data: { evaluations: [{ candidateId: candId, relevance: 'applicable', applicabilityReason: 'Redis Pub/Sub has at-most-once delivery without buffering', assumptions: [], confidence: 0.95 }], ungroundedConcerns: [] } };
        }
        return { content: '', data: { evaluations: [], ungroundedConcerns: [] } };
      }

      if (request.schemaName === 'ArchitectureDecisions') {
        return { content: '', data: { decisions: [] } };
      }

      if (request.schemaName === 'ExtractClaims') {
        if (prompt.includes('SQS Delivery')) {
          return {
            content: '',
            data: {
              claims: [
                {
                  sourceQuote: 'Standard queues may deliver a message more than once.',
                  evidenceLocator: 'Standard queues delivery',
                  normalizedClaim: 'SQS standard queues may deliver a message more than once.',
                  claimType: 'DIRECT_SOURCE_CLAIM',
                  entities: ['AWS SQS'],
                }
              ]
            }
          };
        }
        if (prompt.includes('Redis Pub/Sub')) {
          return {
            content: '',
            data: {
              claims: [
                {
                  sourceQuote: 'Pub/sub messages are lost if client is disconnected.',
                  evidenceLocator: 'Redis Pub/Sub disconnect',
                  normalizedClaim: 'Redis pub/sub delivers at-most-once; messages published while a subscriber is disconnected are permanently lost.',
                  claimType: 'DIRECT_SOURCE_CLAIM',
                  entities: ['Redis'],
                }
              ]
            }
          };
        }
        return { content: '', data: { claims: [] } };
      }

      if (request.schemaName === 'ExtractKnowledgeCandidates') {
        const claimId = prompt.match(/\[ID: (claim-.*?)\]/)?.[1] || '';
        if (prompt.includes('SQS standard queues may deliver a message more than once')) {
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
                  sourceClaimIds: [claimId],
                  confidence: 0.95,
                  exactTechnology: 'AWS SQS',
                  operationalConstraints: [],
                  fieldStatements: [
                    {
                      field: 'mechanism',
                      normalizedStatement: 'Standard queues may deliver a message more than once.',
                      supportingClaimIds: [claimId],
                      supportType: 'DIRECT_SOURCE',
                      statementType: 'SOURCE_FACT',
                    }
                  ]
                }
              ]
            }
          };
        }

        if (prompt.includes('Redis pub/sub delivers at-most-once')) {
          return {
            content: '',
            data: {
              candidates: [
                {
                  title: 'Redis PubSub Message Loss on Disconnect',
                  normalizedConcept: 'redis_pubsub_disconnect_loss',
                  proposedLevel: 'technology_specific',
                  engineeringDimensions: ['persistence', 'dependency_failure'],
                  applicabilityTriggers: ['redis', 'pubsub'],
                  mechanism: 'Redis Pub/Sub does not buffer or persist messages for disconnected subscribers.',
                  failureConsequences: ['silent message loss on subscriber restart'],
                  mitigations: ['use Redis Streams with consumer groups'],
                  assumptions: [],
                  sourceClaimIds: [claimId],
                  confidence: 0.95,
                  exactTechnology: 'Redis',
                  operationalConstraints: [],
                  fieldStatements: [
                    {
                      field: 'mechanism',
                      normalizedStatement: 'Pub/sub messages are lost if client is disconnected.',
                      supportingClaimIds: [claimId],
                      supportType: 'DIRECT_SOURCE',
                      statementType: 'SOURCE_FACT',
                    }
                  ]
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

  beforeEach(async () => {
    registry = new KnowledgeAcquisitionRegistry(testDbPath);
    registry.clearAllForTest();
    const provider = new GenericDiscoveryMockProvider();
    useCase = new AcquireKnowledgeFromSourceUseCase(
      provider,
      [new LocalFixtureConnector()],
      registry
    );
    repo = new InMemoryKnowledgeRepository();
    await repo.load(prototypeKnowledgeFixtures);
  });

  afterEach(() => {
    if (fs.existsSync(testDbPath)) {
      try { fs.unlinkSync(testDbPath); } catch {}
    }
  });

  it('Example 1 (AWS SQS): Discovers duplicate delivery concern ONLY after knowledge acquisition', async () => {
    const provider = new GenericDiscoveryMockProvider();
    const analysisUseCase = new AnalyzeArchitectureUseCase(repo, provider);
    const req = "We use AWS SQS standard queues to send welcome emails.";

    // 1. BEFORE ACQUISITION: Concern is unknown
    const beforeResult = await analysisUseCase.execute({ rawIntent: req });
    const beforeConcern = beforeResult.contract.discoveredConcerns.find(c => c.title === 'SQS Duplicate Delivery');
    expect(beforeConcern).toBeUndefined();

    // 2. KNOWLEDGE ACQUISITION
    const sqsDocPath = 'packages/knowledge/src/fixtures/sqs-docs.md';
    fs.writeFileSync(sqsDocPath, '# SQS Delivery\nStandard queues may deliver a message more than once.');
    const source: KnowledgeSource = {
      id: 'src-sqs-uu',
      publisher: 'AWS',
      sourceType: 'official_documentation',
      canonicalUrl: 'fixture://sqs-docs.md',
      technology: 'AWS SQS',
      trustTier: 'TIER_1_STANDARD',
      discoveredAt: new Date().toISOString(),
    };
    registry.registerSource(source);

    const run = await useCase.execute(source);
    expect(run.metrics.acceptedItemsCount).toBe(1);

    // 3. LOAD ACQUIRED KNOWLEDGE INTO REPO
    await repo.load(registry.getAllAcceptedKnowledge());

    // 4. AFTER ACQUISITION: Concern is autonomously discovered
    const afterResult = await analysisUseCase.execute({ rawIntent: req });
    const afterConcern = afterResult.contract.discoveredConcerns.find(c => c.title === 'SQS Duplicate Delivery');
    expect(afterConcern).toBeDefined();
    expect(afterConcern?.supportingKnowledgeIds.length).toBeGreaterThan(0);

    try { fs.unlinkSync(sqsDocPath); } catch {}
  });

  it('Example 2 (Redis Pub/Sub): Discovers disconnect message loss concern ONLY after knowledge acquisition', async () => {
    const provider = new GenericDiscoveryMockProvider();
    const analysisUseCase = new AnalyzeArchitectureUseCase(repo, provider);
    const req = "We use Redis pub/sub channels to distribute transaction receipt notifications between services.";

    // 1. BEFORE ACQUISITION: Concern is unknown
    const beforeResult = await analysisUseCase.execute({ rawIntent: req });
    const beforeConcern = beforeResult.contract.discoveredConcerns.find(c => c.title === 'Redis PubSub Message Loss on Disconnect');
    expect(beforeConcern).toBeUndefined();

    // 2. KNOWLEDGE ACQUISITION
    const redisDocPath = 'packages/knowledge/src/fixtures/redis-docs.md';
    fs.writeFileSync(redisDocPath, '# Redis Pub/Sub\nPub/sub messages are lost if client is disconnected.');
    const source: KnowledgeSource = {
      id: 'src-redis-uu',
      publisher: 'Redis Labs',
      sourceType: 'official_documentation',
      canonicalUrl: 'fixture://redis-docs.md',
      technology: 'Redis',
      trustTier: 'TIER_2_OFFICIAL',
      discoveredAt: new Date().toISOString(),
    };
    registry.registerSource(source);

    const run = await useCase.execute(source);
    expect(run.metrics.acceptedItemsCount).toBe(1);

    // 3. LOAD ACQUIRED KNOWLEDGE INTO REPO
    await repo.load(registry.getAllAcceptedKnowledge());

    // 4. AFTER ACQUISITION: Redis Pub/Sub disconnect loss is discovered
    const afterResult = await analysisUseCase.execute({ rawIntent: req });
    const afterConcern = afterResult.contract.discoveredConcerns.find(c => c.title === 'Redis PubSub Message Loss on Disconnect');
    expect(afterConcern).toBeDefined();
    expect(afterConcern?.supportingKnowledgeIds.length).toBeGreaterThan(0);

    try { fs.unlinkSync(redisDocPath); } catch {}
  });
});
