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
});

