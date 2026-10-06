import { CodingAgentAdapter, AgentAvailability } from '../types.js';
import { CodexCliAgentAdapter } from './codex-cli-adapter.js';
import { DeterministicCodingAgentAdapter } from './deterministic-agent-adapter.js';
import { VulnerableCodingAgentAdapter } from './vulnerable-agent-adapter.js';

export interface AgentRegistryEntry {
  adapter: CodingAgentAdapter;
  availability: AgentAvailability;
}

export class CodingAgentGateway {
  private adapters = new Map<string, CodingAgentAdapter>();

  constructor(customAdapters?: CodingAgentAdapter[]) {
    if (customAdapters) {
      for (const adapter of customAdapters) {
        this.register(adapter);
      }
    } else {
      // Default built-in adapters
      this.register(new CodexCliAgentAdapter());
      this.register(new DeterministicCodingAgentAdapter());
      this.register(new VulnerableCodingAgentAdapter());
    }
  }

  register(adapter: CodingAgentAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  getAdapter(id: string): CodingAgentAdapter | undefined {
    return this.adapters.get(id);
  }

  async listAvailableAgents(): Promise<AgentRegistryEntry[]> {
    const results: AgentRegistryEntry[] = [];
    for (const adapter of this.adapters.values()) {
      const availability = await adapter.detect();
      results.push({ adapter, availability });
    }
    return results;
  }
}
