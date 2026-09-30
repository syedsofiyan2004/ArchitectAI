import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  EngineeringDimensionSchema,
  EngineeringContractSchema,
  EngineeringContract,
  WellKnownDimensions,
  EngineeringKnowledgeItem,
} from '@architectai/domain';
import {
  InMemoryKnowledgeRepository,
  neutralKnowledgeFixtures,
} from '@architectai/knowledge';

describe('Architecture Boundary & Constitution Tests', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const domainPackageJsonPath = path.join(rootDir, 'packages/domain/package.json');
  const domainSrcDir = path.join(rootDir, 'packages/domain/src');

  it('protects boundary: packages/domain has no forbidden dependencies in package.json', () => {
    const raw = fs.readFileSync(domainPackageJsonPath, 'utf-8');
    const pkg = JSON.parse(raw);
    const deps = Object.keys(pkg.dependencies || {});
    const devDeps = Object.keys(pkg.devDependencies || {});
    const allDeps = [...deps, ...devDeps];

    const forbiddenPatterns = [
      'providers',
      'apps',
      'express',
      'fastify',
      'koa',
      'openai',
      'anthropic',
      'google',
      'react',
      'vue',
      'next',
      'prisma',
      'typeorm',
      'pg',
      'redis',
    ];

    for (const dep of allDeps) {
      for (const forbidden of forbiddenPatterns) {
        expect(
          dep.toLowerCase(),
          `Domain package must not depend on forbidden package: ${dep}`
        ).not.toContain(forbidden);
      }
    }
  });

  it('protects boundary: packages/domain source files contain no forbidden imports or provider leaks', () => {
    const files = fs.readdirSync(domainSrcDir).filter((f) => f.endsWith('.ts'));
    const forbiddenImportRegex = /from\s+['"]([^'"]+)['"]/g;

    const forbiddenTargets = [
      'packages/providers',
      '../providers',
      'apps/',
      'express',
      'fastify',
      'openai',
      '@anthropic-ai',
      '@google/genai',
    ];

    for (const file of files) {
      const content = fs.readFileSync(path.join(domainSrcDir, file), 'utf-8');
      let match: RegExpExecArray | null;
      while ((match = forbiddenImportRegex.exec(content)) !== null) {
        const importTarget = match[1];
        if (importTarget) {
          for (const forbidden of forbiddenTargets) {
            expect(
              importTarget,
              `Forbidden import '${importTarget}' detected in packages/domain/src/${file}`
            ).not.toContain(forbidden);
          }
        }
      }
    }
  });

  it('protects boundary: knowledge items represent all three knowledge levels through the same generic repository', async () => {
    const repo = new InMemoryKnowledgeRepository();
    await repo.load(neutralKnowledgeFixtures);

    const levels = ['fundamental', 'failure_pattern', 'technology_specific'] as const;
    for (const level of levels) {
      const items = await repo.queryByLevel(level);
      expect(
        items.length,
        `Repository must support querying level '${level}'`
      ).toBeGreaterThanOrEqual(1);

      // Verify each returned item conforms to the domain schema
      for (const item of items) {
        expect(item.levels).toContain(level);
        expect(item.dimensions.length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('protects boundary: EngineeringContract round-trips through JSON serialization and schema validation', () => {
    const contract: EngineeringContract = {
      id: 'contract-roundtrip-test',
      version: '1.0.0',
      requirement: {
        id: 'req-01',
        rawIntent: 'Build a durable message ingress pipeline.',
        explicitConstraints: ['zero data loss under burst'],
        declaredTechStack: ['TypeScript', 'Node.js'],
        context: {},
      },
      discoveredConcerns: [
        {
          id: 'concern-01',
          requirementId: 'req-01',
          title: 'Memory saturation',
          description: 'High throughput risks memory exhaustion.',
          applicabilityReason: 'Asymmetric ingress rates.',
          dimensions: [WellKnownDimensions.BOUNDED_RESOURCE],
          supportingKnowledgeIds: ['fundamental-bounded-memory-buffers'],
          assumptions: [],
          confidence: 0.99,
          unresolvedQuestions: [],
        },
      ],
      decisions: [
        {
          id: 'dec-01',
          problemContext: 'Handling burst memory allocation.',
          consideredOptions: [
            { id: 'opt-1', name: 'Buffer in memory', description: 'Store in JS array' },
            { id: 'opt-2', name: 'Backpressure', description: 'Signal upstream flow control' },
          ],
          selectedOptionId: 'opt-2',
          selectedOptionName: 'Backpressure',
          rationale: 'Bounds memory usage.',
          evidence: [],
          assumptions: [],
          risksAndTradeoffs: [],
          verificationRequirements: ['Heap limit verification'],
          reconsiderationTriggers: [],
        },
      ],
      invariants: [
        {
          id: 'inv-01',
          property: 'Process RSS memory must not exceed 256MB.',
          severity: 'critical',
          blocksCompletion: true,
        },
      ],
      verificationSpecs: [
        {
          id: 'verif-01',
          target: 'inv-01',
          description: 'Memory ceiling test under synthetic burst load.',
          setup: 'Run worker with max 256MB memory.',
          action: 'Send 100,000 synthetic messages.',
          expectedProperty: 'Heap remains under 256MB.',
          evidenceToCollect: ['process memory log'],
          isAutomatable: true,
        },
      ],
      assumptions: ['OS delivers TCP flow control signals'],
      unresolvedQuestions: [],
      metadata: {
        createdAt: '2026-09-30T00:00:00.000Z',
        status: 'accepted',
        tags: ['reliability'],
      },
    };

    // Serialize
    const json = JSON.stringify(contract);
    // Parse back
    const roundTripped = EngineeringContractSchema.parse(JSON.parse(json));
    expect(roundTripped).toEqual(contract);
  });

  it('protects open taxonomy: adding unseen EngineeringDimension does not require editing a central switch statement', () => {
    // Unseen novel dimension
    const novelDimension = 'speculative_execution_side_channel';

    // Must parse successfully through schema without breaking
    const validated = EngineeringDimensionSchema.parse(novelDimension);
    expect(validated).toBe(novelDimension);

    // Can be used in a knowledge item without compilation or runtime errors
    const dynamicItem: EngineeringKnowledgeItem = {
      id: 'dynamic-item-01',
      levels: ['fundamental'],
      title: 'Transient Execution Leakage',
      description: 'Microarchitectural state leaking across trust boundaries.',
      dimensions: [validated],
      triggers: [],
      failureMechanisms: [],
      mitigations: [],
      verificationIdeas: [],
      evidence: [],
      relationships: [],
    };

    expect(dynamicItem.dimensions).toContain('speculative_execution_side_channel');
  });
});
