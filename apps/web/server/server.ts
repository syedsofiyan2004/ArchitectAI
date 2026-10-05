import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  InMemoryKnowledgeRepository,
  prototypeKnowledgeFixtures,
} from '@architectai/knowledge';
import {
  OpenAICompatibleProviderAdapter,
  DeterministicDemoProviderAdapter,
  ProviderAdapter,
  CodingAgentGateway,
} from '@architectai/providers';
import {
  AnalyzeArchitectureUseCase,
  GitWorkspaceService,
  RepositoryContextBuilder,
  CompileImplementationPlanUseCase,
  ExecuteImplementationPlanUseCase,
  NonGitRepositoryError,
} from '@architectai/application';
import {
  EngineeringContractSchema,
  ImplementationPlanSchema,
} from '@architectai/domain';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function createServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Initialize Knowledge Repository with full prototype knowledge base
  const knowledgeRepo = new InMemoryKnowledgeRepository();
  await knowledgeRepo.load(prototypeKnowledgeFixtures);

  // Initialize Provider (Remote model if API key exists, otherwise Deterministic demo mode)
  const apiKey = process.env['ARCHITECTAI_API_KEY'];
  let provider: ProviderAdapter;

  if (apiKey && apiKey.trim().length > 0) {
    provider = new OpenAICompatibleProviderAdapter({
      apiKey,
      baseURL: process.env['ARCHITECTAI_BASE_URL'],
      modelName: process.env['ARCHITECTAI_MODEL'],
    });
  } else {
    provider = new DeterministicDemoProviderAdapter();
  }

  const useCase = new AnalyzeArchitectureUseCase(knowledgeRepo, provider);
  const agentGateway = new CodingAgentGateway();
  const gitWorkspaceService = new GitWorkspaceService();
  const contextBuilder = new RepositoryContextBuilder();
  const taskCompiler = new CompileImplementationPlanUseCase(provider);
  const planExecutor = new ExecuteImplementationPlanUseCase(agentGateway);

  // API Config
  app.get('/api/config', (_req: Request, res: Response) => {
    res.json({
      mode: provider.id === 'deterministic-demo' ? 'deterministic-demo' : 'remote-model',
      providerName: provider.name,
      modelName:
        provider.id === 'deterministic-demo'
          ? 'Deterministic Architecture Kernel'
          : process.env['ARCHITECTAI_MODEL'] || 'gpt-4o-mini',
      knowledgeItemsCount: prototypeKnowledgeFixtures.length,
    });
  });

  // Pre-configured Scenarios for one-click testing
  app.get('/api/scenarios', (_req: Request, res: Response) => {
    res.json([
      {
        id: 'demo-a',
        tag: 'DEMO A',
        title: 'API Rate Limiting',
        prompt: 'Limit each authenticated user to 100 API requests per minute.',
        context: {
          database: 'Redis',
          framework: 'Node.js',
          scale: '10,000 active users',
        },
      },
      {
        id: 'demo-b',
        tag: 'DEMO B',
        title: 'Token Refresh Race',
        prompt:
          'When my access token expires automatically refresh it and retry the failed request.',
        context: {
          language: 'TypeScript',
          framework: 'React / Axios',
        },
      },
      {
        id: 'demo-c',
        tag: 'DEMO C',
        title: 'Parallel Image Pipeline',
        prompt:
          'Process many large uploaded images in parallel as quickly as possible.',
        context: {
          framework: 'Node.js',
          scale: '500 images/minute, up to 25MB each',
        },
      },
      {
        id: 'scenario-db-pool',
        tag: 'SCENARIO 4',
        title: 'Database Connection Pool Exhaustion',
        prompt:
          'Query user order history across 5,000 concurrent web requests without failing.',
        context: {
          database: 'PostgreSQL',
          scale: '5,000 concurrent queries',
        },
      },
      {
        id: 'scenario-payment-idemp',
        tag: 'SCENARIO 5',
        title: 'Duplicate Payment Protection',
        prompt:
          'Charge the customer credit card and retry if the connection times out.',
        context: {
          database: 'PostgreSQL',
          additionalConstraints: 'Must strictly avoid duplicate charges',
        },
      },
      {
        id: 'scenario-retry-storm',
        tag: 'SCENARIO 6',
        title: 'Downstream Retry Storm',
        prompt:
          'Call downstream pricing API and aggressively retry up to 10 times on failure.',
        context: {
          cloud: 'AWS',
        },
      },
      {
        id: 'scenario-cache-stampede',
        tag: 'SCENARIO 7',
        title: 'Cache Stampede / Dogpiling',
        prompt:
          'Cache trending product catalog in Redis with 5 minute TTL for 100,000 concurrent readers.',
        context: {
          database: 'Redis + PostgreSQL',
        },
      },
      {
        id: 'scenario-queue-dedup',
        tag: 'SCENARIO 8',
        title: 'Kafka Queue Deduplication',
        prompt:
          'Consume user registration events from Kafka queue and send welcome emails.',
        context: {
          framework: 'Kafka Consumer',
        },
      },
      {
        id: 'scenario-timeout-hang',
        tag: 'SCENARIO 9',
        title: 'Third-Party Timeout Resiliency',
        prompt:
          'Fetch external partner catalog on every user search request without freezing.',
        context: {
          language: 'TypeScript',
        },
      },
      {
        id: 'scenario-lost-update',
        tag: 'SCENARIO 10',
        title: 'Concurrent Lost Update',
        prompt:
          'Read current inventory quantity, decrement by 1, and save updated count back.',
        context: {
          database: 'PostgreSQL',
          scale: 'Simultaneous flash sale checkouts',
        },
      },
    ]);
  });

  // Main Architecture Analysis Endpoint
  app.post('/api/analyze', async (req: Request, res: Response) => {
    try {
      const { rawIntent, explicitConstraints, declaredTechStack, context } = req.body;

      if (!rawIntent || typeof rawIntent !== 'string' || rawIntent.trim().length === 0) {
        return res.status(400).json({
          error: 'Please provide a non-empty requirement description.',
        });
      }

      const output = await useCase.execute({
        rawIntent: rawIntent.trim(),
        explicitConstraints: Array.isArray(explicitConstraints) ? explicitConstraints : [],
        declaredTechStack: Array.isArray(declaredTechStack) ? declaredTechStack : [],
        context: typeof context === 'object' && context !== null ? context : {},
      });

      return res.json({
        success: true,
        ...output,
      });
    } catch (err: unknown) {
      console.error('[ArchitectAI Server Error]', err);
      return res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : 'Internal analysis pipeline error.',
      });
    }
  });

  // Coding Agent detection
  app.get('/api/agents', async (_req: Request, res: Response) => {
    try {
      const agents = await agentGateway.listAvailableAgents();
      res.json({
        success: true,
        agents: agents.map((a) => ({
          id: a.adapter.id,
          name: a.adapter.name,
          available: a.availability.available,
          version: a.availability.version,
          reason: a.availability.reason,
        })),
      });
    } catch (err: unknown) {
      res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to query agents.',
      });
    }
  });

  // Repository Inspection
  app.post('/api/repo/inspect', async (req: Request, res: Response) => {
    try {
      const { repoPath } = req.body;
      if (!repoPath || typeof repoPath !== 'string') {
        return res.status(400).json({ error: 'Please provide a valid repository path.' });
      }
      const workspace = await gitWorkspaceService.inspectRepository(repoPath.trim());
      return res.json({ success: true, workspace });
    } catch (err: unknown) {
      if (err instanceof NonGitRepositoryError) {
        return res.status(400).json({ success: false, error: err.message, isNonGit: true });
      }
      return res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to inspect repository.',
      });
    }
  });

  // Compile Implementation Plan
  app.post('/api/plan/compile', async (req: Request, res: Response) => {
    try {
      const { contract, repoPath } = req.body;
      if (!contract) {
        return res.status(400).json({ error: 'EngineeringContract is required.' });
      }
      const validatedContract = EngineeringContractSchema.parse(contract);
      const targetPath =
        typeof repoPath === 'string' && repoPath.trim().length > 0
          ? repoPath.trim()
          : process.cwd();

      const workspace = await gitWorkspaceService.inspectRepository(targetPath);
      const context = await contextBuilder.buildContext(validatedContract, workspace);
      const plan = await taskCompiler.execute(validatedContract, context);

      return res.json({
        success: true,
        plan,
        context,
        workspace,
      });
    } catch (err: unknown) {
      return res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to compile implementation plan.',
      });
    }
  });

  // Execute Implementation Plan (requires explicit user approval)
  app.post('/api/plan/execute', async (req: Request, res: Response) => {
    try {
      const { plan, agentId, approved } = req.body;
      if (!approved) {
        return res.status(403).json({
          success: false,
          error:
            'Execution rejected: Explicit user approval is strictly required before modifying files.',
        });
      }
      if (!plan) {
        return res.status(400).json({ error: 'ImplementationPlan is required.' });
      }

      const validatedPlan = ImplementationPlanSchema.parse(plan);
      const output = await planExecutor.execute(validatedPlan, agentId);

      return res.json({
        success: true,
        execution: output,
      });
    } catch (err: unknown) {
      return res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : 'Execution failed.',
      });
    }
  });

  // Serve static assets in production build if dist folder exists
  const distPath = path.resolve(__dirname, '../dist');
  app.use(express.static(distPath));
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(distPath, 'index.html'), (err) => {
      if (err) {
        res.status(200).send('ArchitectAI Server is running. In dev mode, open the Vite client.');
      }
    });
  });

  return app;
}
