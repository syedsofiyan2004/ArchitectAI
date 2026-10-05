import { describe, it, expect, beforeEach } from 'vitest';
import { WellKnownDimensions } from '@architectai/domain';
import {
  InMemoryKnowledgeRepository,
  neutralFundamentalKnowledge,
  neutralFailurePatternKnowledge,
  neutralTechnologySpecificKnowledge,
  neutralKnowledgeFixtures,
} from './index.js';

describe('InMemoryKnowledgeRepository', () => {
  let repo: InMemoryKnowledgeRepository;

  beforeEach(async () => {
    repo = new InMemoryKnowledgeRepository();
    await repo.load(neutralKnowledgeFixtures);
  });

  it('stores and retrieves items across all three knowledge levels', async () => {
    expect(await repo.count()).toBe(3);

    const fundamentals = await repo.queryByLevel('fundamental');
    expect(fundamentals).toHaveLength(1);
    expect(fundamentals[0]?.id).toBe(neutralFundamentalKnowledge.id);

    const patterns = await repo.queryByLevel('failure_pattern');
    expect(patterns).toHaveLength(1);
    expect(patterns[0]?.id).toBe(neutralFailurePatternKnowledge.id);

    const techSpecific = await repo.queryByLevel('technology_specific');
    expect(techSpecific).toHaveLength(1);
    expect(techSpecific[0]?.id).toBe(neutralTechnologySpecificKnowledge.id);
  });

  it('retrieves items by engineering dimension', async () => {
    const boundedResourceItems = await repo.queryByDimensions([
      WellKnownDimensions.BOUNDED_RESOURCE,
    ]);
    expect(boundedResourceItems).toHaveLength(3);

    const timeWindowItems = await repo.queryByDimensions([
      WellKnownDimensions.TIME_WINDOW,
    ]);
    expect(timeWindowItems).toHaveLength(1);
    expect(timeWindowItems[0]?.id).toBe(neutralTechnologySpecificKnowledge.id);

    const concurrencyItems = await repo.queryByDimensions([
      WellKnownDimensions.CONCURRENCY,
    ]);
    expect(concurrencyItems).toHaveLength(1);
    expect(concurrencyItems[0]?.id).toBe(neutralFundamentalKnowledge.id);
  });

  it('queries items by technology metadata or evidence', async () => {
    const nodeItems = await repo.queryByTechnology('Node.js');
    expect(nodeItems).toHaveLength(1);
    expect(nodeItems[0]?.id).toBe(neutralTechnologySpecificKnowledge.id);

    const nonExistent = await repo.queryByTechnology('NonExistentTech');
    expect(nonExistent).toHaveLength(0);
  });

  it('retrieves an individual item by ID', async () => {
    const item = await repo.getById(neutralFundamentalKnowledge.id);
    expect(item).toBeDefined();
    expect(item?.title).toBe(neutralFundamentalKnowledge.title);

    const missing = await repo.getById('missing-id');
    expect(missing).toBeUndefined();
  });

  describe('Honest Evidence Provenance (Task 001A)', () => {
    it('ensures synthetic fixtures do not masquerade as empirical postmortems or benchmarks', () => {
      const syntheticItems = [neutralFundamentalKnowledge, neutralFailurePatternKnowledge];
      for (const item of syntheticItems) {
        for (const ev of item.evidence) {
          expect(ev.sourceType).toBe('manual_analysis');
          expect(ev.qualityNotes).toBeDefined();
          expect(ev.qualityNotes?.toLowerCase()).toContain('synthetic');
          // No unjustified 1.0 or inflated confidence
          if (ev.confidenceScore !== undefined) {
            expect(ev.confidenceScore).toBeLessThan(1.0);
          }
        }
      }
    });

    it('ensures official documentation fixtures have real URLs, specific technology, and quality notes', () => {
      for (const ev of neutralTechnologySpecificKnowledge.evidence) {
        expect(ev.sourceType).toBe('official_documentation');
        expect(ev.sourceUrlOrIdentifier).toMatch(/^https?:\/\//);
        expect(ev.technology).toBe('Node.js');
        expect(ev.qualityNotes).toBeDefined();
        expect(ev.versionApplicability).toBeDefined();
      }
    });
  });

  describe('Prototype Knowledge Coverage (Milestone 1)', () => {
    let protoRepo: InMemoryKnowledgeRepository;

    beforeEach(async () => {
      protoRepo = new InMemoryKnowledgeRepository();
      const { prototypeKnowledgeFixtures } = await import('./prototype-fixtures.js');
      await protoRepo.load(prototypeKnowledgeFixtures);
    });

    it('loads all prototype fixtures covering 10 engineering scenarios', async () => {
      const count = await protoRepo.count();
      expect(count).toBeGreaterThanOrEqual(20);

      const fundamentals = await protoRepo.queryByLevel('fundamental');
      expect(fundamentals.length).toBeGreaterThanOrEqual(7);

      const patterns = await protoRepo.queryByLevel('failure_pattern');
      expect(patterns.length).toBeGreaterThanOrEqual(10);

      const techItems = await protoRepo.queryByLevel('technology_specific');
      expect(techItems.length).toBeGreaterThanOrEqual(10);
    });

    it('queries across diverse technologies (Redis, PostgreSQL, Node.js)', async () => {
      const redisItems = await protoRepo.queryByTechnology('Redis');
      expect(redisItems.length).toBeGreaterThanOrEqual(2);

      const pgItems = await protoRepo.queryByTechnology('PostgreSQL');
      expect(pgItems.length).toBeGreaterThanOrEqual(3);

      const nodeItems = await protoRepo.queryByTechnology('Node.js');
      expect(nodeItems.length).toBeGreaterThanOrEqual(3);
    });
  });
});
