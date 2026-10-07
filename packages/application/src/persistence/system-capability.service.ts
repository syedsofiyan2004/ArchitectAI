import { SystemCapabilities, SystemCapabilitiesSchema } from '@architectai/domain';
import { ProviderAdapter, CodingAgentGateway } from '@architectai/providers';
import { KnowledgeRepository } from '@architectai/knowledge';
import { ProjectRegisteredRepositoryStore } from './repositories/project-repository.repository.js';
import { execSync } from 'node:child_process';

export class SystemCapabilityService {
  constructor(
    private readonly provider: ProviderAdapter,
    private readonly knowledgeRepo: KnowledgeRepository,
    private readonly agentGateway: CodingAgentGateway,
    private readonly repoStore: ProjectRegisteredRepositoryStore
  ) {}

  public async getCapabilities(projectId?: string): Promise<SystemCapabilities> {
    // 1. Analysis Provider
    let analysisProvider: SystemCapabilities['analysisProvider'] = 'READY';
    const providerDetails: Record<string, unknown> = {
      id: this.provider.id,
      name: this.provider.name,
    };

    if (this.provider.id === 'openai-compatible') {
      const apiKey = process.env['ARCHITECTAI_API_KEY'];
      if (!apiKey || apiKey.trim().length === 0) {
        analysisProvider = 'NOT_CONFIGURED';
        providerDetails['reason'] = 'ARCHITECTAI_API_KEY environment variable is not configured.';
      }
    }

    // 2. Knowledge Registry
    const allKnowledge = await this.knowledgeRepo.getAll();
    const knowledgeRegistry: SystemCapabilities['knowledgeRegistry'] = allKnowledge.length > 0 ? 'READY' : 'DEGRADED';

    // 3. Coding Agent
    const availableAgents = await this.agentGateway.listAvailableAgents();
    const hasAnyAgent = availableAgents.some((a) => a.availability.available);
    const codingAgent: SystemCapabilities['codingAgent'] = hasAnyAgent ? 'READY' : 'UNAVAILABLE';

    // 4. Git
    let git: SystemCapabilities['git'] = 'READY';
    let gitVersion = 'unknown';
    try {
      gitVersion = execSync('git --version', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    } catch {
      git = 'UNAVAILABLE';
    }

    // 5. Verification Runtime
    const verificationRuntime: SystemCapabilities['verificationRuntime'] = 'READY';

    // 6. Repository Access
    let repositoryAccess: SystemCapabilities['repositoryAccess'] = 'READY';
    if (projectId) {
      const registeredRepo = this.repoStore.findByProjectId(projectId);
      if (!registeredRepo) {
        repositoryAccess = 'UNAVAILABLE';
      }
    }

    const result: SystemCapabilities = {
      analysisProvider,
      knowledgeRegistry,
      codingAgent,
      git,
      verificationRuntime,
      repositoryAccess,
      details: {
        provider: providerDetails,
        knowledgeItemsCount: allKnowledge.length,
        gitVersion,
        availableAgents: availableAgents.map((a) => ({
          id: a.adapter.id,
          name: a.adapter.name,
          available: a.availability.available,
          version: a.availability.version,
        })),
      },
    };

    return SystemCapabilitiesSchema.parse(result);
  }
}
