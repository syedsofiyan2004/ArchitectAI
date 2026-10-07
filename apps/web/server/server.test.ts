import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from './server.js';
import type { Server } from 'node:http';

describe('ArchitectAI Web Server & Endpoints', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = await createServer();
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        if (typeof addr === 'object' && addr !== null) {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('GET /api/config returns configuration and knowledge count', async () => {
    const res = await fetch(`${baseUrl}/api/config`);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.mode).toBe('deterministic-demo');
    expect(json.knowledgeItemsCount).toBeGreaterThanOrEqual(16);
  });

  it('GET /api/scenarios returns all 10 prototype demonstration scenarios', async () => {
    const res = await fetch(`${baseUrl}/api/scenarios`);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(Array.isArray(json)).toBe(true);
    expect(json.length).toBe(10);

    const tags = json.map((s: any) => s.tag);
    expect(tags).toContain('DEMO A');
    expect(tags).toContain('DEMO B');
    expect(tags).toContain('DEMO C');
  });

  it('POST /api/analyze successfully analyzes Demo A (Rate Limiter)', async () => {
    const res = await fetch(`${baseUrl}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rawIntent: 'Limit each authenticated user to 100 API requests per minute.',
        explicitConstraints: [],
        declaredTechStack: ['Redis', 'Node.js'],
        context: { database: 'Redis', scale: '10,000 active users' },
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.stages.length).toBe(7);
    expect(json.contract).toBeDefined();
    expect(json.contract.discoveredConcerns.length).toBeGreaterThanOrEqual(1);

    const titles = json.contract.discoveredConcerns.map((c: any) => c.title);
    expect(titles.some((t: string) => /burst|window|rate/i.test(t))).toBe(true);
  });

  it('POST /api/analyze successfully analyzes Demo B (Token Refresh Race)', async () => {
    const res = await fetch(`${baseUrl}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rawIntent: 'When my access token expires automatically refresh it and retry the failed request.',
        explicitConstraints: [],
        declaredTechStack: ['TypeScript'],
        context: { framework: 'React / Axios' },
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    const titles = json.contract.discoveredConcerns.map((c: any) => c.title);
    expect(titles.some((t: string) => /refresh|token|race/i.test(t))).toBe(true);
  });

  it('POST /api/analyze successfully analyzes Demo C (Parallel Image Pipeline)', async () => {
    const res = await fetch(`${baseUrl}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rawIntent: 'Process many large uploaded images in parallel as quickly as possible.',
        explicitConstraints: [],
        declaredTechStack: ['Node.js'],
        context: { scale: '500 images/minute, up to 25MB each' },
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    const titles = json.contract.discoveredConcerns.map((c: any) => c.title);
    expect(titles.some((t: string) => /memory|buffer|exhaustion/i.test(t))).toBe(true);
  });

  it('POST /api/analyze rejects empty intent with 400 Bad Request', async () => {
    const res = await fetch(`${baseUrl}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rawIntent: '   ',
      }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  it('GET /api/agents returns list of registered coding agent adapters', async () => {
    const res = await fetch(`${baseUrl}/api/agents`);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(Array.isArray(json.agents)).toBe(true);
    expect(json.agents.length).toBeGreaterThanOrEqual(1);

    const agentIds = json.agents.map((a: any) => a.id);
    expect(agentIds).toContain('codex-cli');
  });

  it('POST /api/plan/execute rejects execution without explicit user approval with 403', async () => {
    const res = await fetch(`${baseUrl}/api/plan/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan: { id: 'plan-test' },
        approved: false,
      }),
    });

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain('Explicit user approval is strictly required');
  });

  it('POST /api/plan/execute rejects missing plan with 400', async () => {
    const res = await fetch(`${baseUrl}/api/plan/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        approved: true,
      }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('ImplementationPlan is required');
  });

  it('POST /api/repair/execute rejects execution without explicit approval with 403', async () => {
    const res = await fetch(`${baseUrl}/api/repair/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        approved: false,
      }),
    });

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain('Explicit user approval is strictly required');
  });

  it('POST /api/repair/diagnose rejects missing parameters with 400', async () => {
    const res = await fetch(`${baseUrl}/api/repair/diagnose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  // --- Milestone 6 Productization & Persistence Tests ---
  it('Milestone 6: Project lifecycle APIs create and list persistent projects', async () => {
    const createRes = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Billing Service',
        description: 'Subscription billing & invoicing engine',
      }),
    });

    expect(createRes.status).toBe(201);
    const createJson = await createRes.json();
    expect(createJson.success).toBe(true);
    expect(createJson.project.name).toBe('Billing Service');

    const projectId = createJson.project.id;

    // Fetch project
    const getRes = await fetch(`${baseUrl}/api/projects/${projectId}`);
    expect(getRes.status).toBe(200);
    const getJson = await getRes.json();
    expect(getJson.project.id).toBe(projectId);

    // List projects
    const listRes = await fetch(`${baseUrl}/api/projects`);
    expect(listRes.status).toBe(200);
    const listJson = await listRes.json();
    expect(listJson.projects.some((p: any) => p.id === projectId)).toBe(true);
  });

  it('Milestone 6: Repository registration connects git repo to project', async () => {
    // Create project
    const pRes = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Repo Test Project' }),
    });
    const { project } = await pRes.json();

    // Register current workspace root
    const regRes = await fetch(`${baseUrl}/api/projects/${project.id}/repository`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoPath: process.cwd() }),
    });

    expect(regRes.status).toBe(200);
    const regJson = await regRes.json();
    expect(regJson.success).toBe(true);
    expect(regJson.repository.projectId).toBe(project.id);
    expect(regJson.repository.canonicalLocalPath).toBeDefined();
  });

  it('Milestone 6: Asynchronous project run creation persists run before and after analysis', async () => {
    // Create project
    const pRes = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Async Run Project' }),
    });
    const { project } = await pRes.json();

    // Trigger run creation
    const runRes = await fetch(`${baseUrl}/api/projects/${project.id}/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rawIntent: 'Limit each authenticated user to 100 API requests per minute.',
        declaredTechStack: ['Redis', 'Node.js'],
        context: { database: 'Redis' },
      }),
    });

    expect(runRes.status).toBe(201);
    const runJson = await runRes.json();
    expect(runJson.success).toBe(true);
    expect(runJson.runId).toBeDefined();
    expect(runJson.state).toBe('ANALYSIS_COMPLETE');

    // Query run by ID
    const getRunRes = await fetch(`${baseUrl}/api/runs/${runJson.runId}`);
    expect(getRunRes.status).toBe(200);
    const getRunJson = await getRunRes.json();
    expect(getRunJson.run.id).toBe(runJson.runId);
    expect(getRunJson.run.contract).toBeDefined();
    expect(getRunJson.revisions.length).toBeGreaterThanOrEqual(1);
  });

  it('Milestone 6: Security - Untrusted external Origin is rejected by anti-CSRF check', async () => {
    const res = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://malicious-attacker-website.com',
      },
      body: JSON.stringify({ name: 'Attacker Project' }),
    });

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain('Forbidden');
  });

  it('Milestone 6: GET /api/system/capabilities exposes complete system readiness breakdown', async () => {
    const res = await fetch(`${baseUrl}/api/system/capabilities`);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.capabilities.analysisProvider).toBeDefined();
    expect(json.capabilities.knowledgeRegistry).toBe('READY');
    expect(json.capabilities.git).toBe('READY');
    expect(json.capabilities.verificationRuntime).toBe('READY');
  });

  it('Milestone 6: Provider connection test returns health status without exposing secrets', async () => {
    const res = await fetch(`${baseUrl}/api/providers/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.healthy).toBe(true);
    expect(JSON.stringify(json)).not.toContain('sk-');
  });
});

