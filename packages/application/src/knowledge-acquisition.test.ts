import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  KnowledgeSource,
  SourceTrustTier,
  ExtractedClaim,
  KnowledgeCandidate,
  parseVersionApplicability,
  isVersionOverlapping
} from '@architectai/domain';
import { AcquireKnowledgeFromSourceUseCase } from './use-cases/acquire-knowledge.use-case.js';
import { GroundingValidator } from './use-cases/grounding-validator.js';
import { KnowledgeAcquisitionRegistry } from '@architectai/knowledge';
import { LocalFixtureConnector, HttpDocumentationConnector } from './services/knowledge-connectors.js';
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
                evidenceLocator: 'Read Committed is the default',
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
                evidenceLocator: 'Serializable is the default',
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
                evidenceLocator: 'Example setting',
                normalizedClaim: 'Example rate limiter is configured with 10 requests',
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
                evidenceLocator: 'Standard queues may deliver a message more than once.',
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
                evidenceLocator: 'Pub/sub messages are lost if client is disconnected',
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

      // Public IPs are NOT blocked
      expect(isBlockedIp('93.184.216.34')).toBe(false); // example.com
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
        dnsResolver: async () => ['93.184.216.34'], // Valid public IP
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

  describe('4. Claim-Level Field Grounding', () => {
    it('strips invented operational constraint not supported by direct source claims', async () => {
      const validator = new GroundingValidator();
      const claims: ExtractedClaim[] = [
        {
          id: 'claim-sqs-1',
          sourceSnapshotId: 'snap-1',
          sectionId: 'sec-1',
          evidenceLocator: 'Standard queues may deliver a message more than once.',
          normalizedClaim: 'SQS standard queues may deliver a message more than once.',
          claimType: 'DIRECT_SOURCE_CLAIM',
          entities: ['AWS SQS'],
          versionApplicability: 'CURRENT_DOCS',
          confidence: 0.95,
          extractionModel: 'mock',
          extractedAt: new Date().toISOString(),
        }
      ];

      const candidateWithInventedConstraint: KnowledgeCandidate = {
        id: 'cand-sqs-test',
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
        sourceClaimIds: ['claim-sqs-1'],
        confidence: 0.9,
        // Invented constraint with numbers not present in claim
        operationalConstraints: ['SQS guarantees maximum 5000 messages/second'],
        fieldStatements: [
          {
            field: 'mechanism',
            normalizedStatement: 'At-least-once delivery',
            supportingClaimIds: ['claim-sqs-1'],
            supportType: 'DIRECT_SOURCE',
          },
          {
            field: 'operationalConstraints',
            normalizedStatement: 'SQS guarantees maximum 5000 messages/second',
            supportingClaimIds: ['claim-sqs-1'],
            supportType: 'DIRECT_SOURCE',
          }
        ],
      };

      const source: KnowledgeSource = {
        id: 'src-sqs',
        publisher: 'AWS',
        sourceType: 'official_documentation',
        canonicalUrl: 'fixture://sqs-docs.md',
        trustTier: 'TIER_1_STANDARD',
        discoveredAt: new Date().toISOString(),
      };

      const result = await validator.validateCandidate(candidateWithInventedConstraint, source, claims);
      expect(result.state).toBe('GROUNDED');
      // Invented constraint must be stripped from operationalConstraints!
      expect(result.operationalConstraints).not.toContain('SQS guarantees maximum 5000 messages/second');
      expect(result.operationalConstraints?.length).toBe(0);
    });
  });

  describe('5. Provenance Type Preservation', () => {
    it('preserves exact source type, snapshot ID, claim ID, locator, and trust tier in evidence', async () => {
      const source: KnowledgeSource = {
        id: 'src-spec-1',
        publisher: 'IETF',
        sourceType: 'rfc',
        canonicalUrl: 'fixture://postgres-docs.md',
        technology: 'HTTP',
        trustTier: 'TIER_1_STANDARD',
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
      expect(ev.sourceId).toBe('src-spec-1');
      expect(ev.snapshotId).toBeDefined();
      expect(ev.claimId).toBeDefined();
      expect(ev.sourceType).toBe('rfc'); // Mapped correctly from RFC, not hardcoded official_documentation
      expect(ev.trustTier).toBe('TIER_1_STANDARD');
      expect(ev.publisher).toBe('IETF');
      expect(ev.locator).toBe('Read Committed is the default');
    });
  });

  describe('6. Actual Conflict Detection & Version Applicability', () => {
    it('creates KnowledgeConflict and sets candidate to CONFLICTED when claims contradict', async () => {
      // 1. Source A: PostgreSQL defaults to Read Committed
      const sourceA: KnowledgeSource = {
        id: 'src-pg-a',
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

      const acceptedBefore = registry.getAllAcceptedKnowledge();
      expect(acceptedBefore.length).toBe(1);

      // 2. Source B: Contradicting source asserting default is Serializable for same version
      const contradictionDoc = 'packages/knowledge/src/fixtures/postgres-contradiction.md';
      fs.writeFileSync(contradictionDoc, '# PostgreSQL Serializable Default\nSerializable is the default isolation level.');

      const sourceB: KnowledgeSource = {
        id: 'src-pg-b',
        publisher: 'Alternative Postgres Spec',
        sourceType: 'official_documentation',
        canonicalUrl: 'fixture://postgres-contradiction.md',
        technology: 'PostgreSQL',
        trustTier: 'TIER_2_OFFICIAL',
        versionApplicability: 'CURRENT_DOCS',
        discoveredAt: new Date().toISOString(),
      };
      registry.registerSource(sourceB);

      const runB = await useCase.execute(sourceB);
      expect(runB.status).toBe('COMPLETED');
      expect(runB.metrics.conflictsCount).toBe(1);

      // Candidate must be CONFLICTED, NOT silently accepted or superseded!
      const candidates = registry.getAllCandidates();
      const conflictedCandidate = candidates.find(c => c.state === 'CONFLICTED');
      expect(conflictedCandidate).toBeDefined();
      expect(conflictedCandidate?.normalizedConcept).toBe('postgres_default_isolation');

      // Conflict must exist in registry
      const conflicts = registry.getAllConflicts();
      expect(conflicts.length).toBe(1);
      expect(conflicts[0].concept).toBe('postgres_default_isolation');
      expect(conflicts[0].unresolvedStatus).toBe(true);

      // Clean up
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

  describe('7. Source Update Semantics & Review Required State', () => {
    it('flags dependent knowledge as REVIEW_REQUIRED when underlying claims are removed in a new snapshot', async () => {
      // 1. Initial snapshot
      const dynamicDoc = 'packages/knowledge/src/fixtures/dynamic-pg.md';
      fs.writeFileSync(dynamicDoc, '# PostgreSQL Transaction Isolation\nRead Committed is the default.');

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

      // 2. Updated snapshot with changed hash where the default isolation claim is removed
      fs.writeFileSync(dynamicDoc, '# Rewritten Architecture\nThis section has been rewritten with no default statements.');

      const run2 = await useCase.execute(source);
      expect(run2.status).toBe('COMPLETED');

      // The previous accepted knowledge item that depended on the removed claim must be REVIEW_REQUIRED!
      const acceptedItems = registry.getAllAcceptedKnowledge();
      const affectedItem = acceptedItems.find(i => i.title === 'PostgreSQL Default Isolation');
      expect(affectedItem?.status).toBe('REVIEW_REQUIRED');

      // Clean up
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
                      normalizedStatement: 'At-least-once delivery',
                      supportingClaimIds: [claimId],
                      supportType: 'DIRECT_SOURCE',
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
