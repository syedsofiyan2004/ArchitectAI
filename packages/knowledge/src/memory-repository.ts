import {
  EngineeringKnowledgeItem,
  KnowledgeLevel,
  EngineeringDimension,
  EngineeringKnowledgeItemSchema,
} from '@architectai/domain';
import { KnowledgeRepository, KnowledgeQueryFilter } from './repository.js';

/**
 * InMemoryKnowledgeRepository provides a deterministic, in-memory implementation
 * of the generic KnowledgeRepository interface.
 */
export class InMemoryKnowledgeRepository implements KnowledgeRepository {
  private readonly items = new Map<string, EngineeringKnowledgeItem>();

  async add(item: EngineeringKnowledgeItem): Promise<void> {
    const validated = EngineeringKnowledgeItemSchema.parse(item);
    this.items.set(validated.id, validated);
  }

  async load(items: EngineeringKnowledgeItem[]): Promise<void> {
    for (const item of items) {
      await this.add(item);
    }
  }

  async getById(id: string): Promise<EngineeringKnowledgeItem | undefined> {
    return this.items.get(id);
  }

  async queryByLevel(level: KnowledgeLevel): Promise<EngineeringKnowledgeItem[]> {
    return Array.from(this.items.values()).filter((item) =>
      item.levels.includes(level)
    );
  }

  async queryByDimensions(dimensions: EngineeringDimension[]): Promise<EngineeringKnowledgeItem[]> {
    if (dimensions.length === 0) return [];
    return Array.from(this.items.values()).filter((item) =>
      dimensions.some((d) => item.dimensions.includes(d))
    );
  }

  async queryByTechnology(technology: string): Promise<EngineeringKnowledgeItem[]> {
    const targetTech = technology.toLowerCase().trim();
    return Array.from(this.items.values()).filter((item) => {
      const itemTech = item.technologyMetadata?.technology?.toLowerCase().trim();
      if (itemTech && itemTech.includes(targetTech)) {
        return true;
      }
      return item.evidence.some(
        (ev) => ev.technology?.toLowerCase().trim().includes(targetTech)
      );
    });
  }

  async query(filter: KnowledgeQueryFilter): Promise<EngineeringKnowledgeItem[]> {
    return Array.from(this.items.values()).filter((item) => {
      if (filter.levels && filter.levels.length > 0) {
        const matchesLevel = filter.levels.some((lvl) => item.levels.includes(lvl));
        if (!matchesLevel) return false;
      }

      if (filter.dimensions && filter.dimensions.length > 0) {
        const matchesDimension = filter.dimensions.some((dim) =>
          item.dimensions.includes(dim)
        );
        if (!matchesDimension) return false;
      }

      if (filter.technology) {
        const targetTech = filter.technology.toLowerCase().trim();
        const itemTech = item.technologyMetadata?.technology?.toLowerCase().trim();
        const matchesDirectTech = itemTech ? itemTech.includes(targetTech) : false;
        const matchesEvidenceTech = item.evidence.some(
          (ev) => ev.technology?.toLowerCase().trim().includes(targetTech)
        );
        if (!matchesDirectTech && !matchesEvidenceTech) return false;
      }

      return true;
    });
  }

  async getAll(): Promise<EngineeringKnowledgeItem[]> {
    return Array.from(this.items.values());
  }

  async count(): Promise<number> {
    return this.items.size;
  }
}
