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
});
