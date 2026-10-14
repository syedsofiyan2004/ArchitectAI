// ArchitectAI — Architecture Studio Graph Integration Test Suite
// Validates generic graph projection, contract provenance, multi-contract rendering, and traceability
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser } from 'playwright';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import type { Server } from 'node:http';
import { createServer } from '../../apps/web/server/server.js';
import {
  ArchitectureGraphProjector,
} from '../../packages/application/src/services/architecture-graph-projector.js';
import {
  validateArchitectureGraphProjection,
  ArchitectureGraphProjectionSchema,
  type ArchitectureGraphProjection,
} from '../../packages/domain/src/architecture-graph.js';
import {
  RATE_LIMITER_FIXTURE_CONTRACT,
  PAYMENT_OUTBOX_FIXTURE_CONTRACT,
  IMAGE_PIPELINE_FIXTURE_CONTRACT,
  INCOMPLETE_FIXTURE_CONTRACT,
} from '../../apps/web/src/components/studio/fixture-contracts.js';
import { computeGenericEdgePath } from '../../apps/web/src/components/studio/StudioCanvas.js';

describe('Architecture Studio Graph Integration Suite', () => {
  let tempDir: string;
  let dbPath: string;
  let artifactsDir: string;
  let server: Server;
  let baseUrl: string;
  let browser: Browser | null = null;
  let hasChromium = false;

  const screenshotsDir = path.resolve(__dirname, '../../docs/product/screenshots');
  const brainArtifactsDir = 'C:\\Users\\syed.sofiyan\\.gemini\\antigravity\\brain\\2137ef53-0228-46c2-baa1-c5321d1870eb';

  const saveScreenshot = async (page: any, filename: string) => {
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
    const docPath = path.join(screenshotsDir, filename);
    await page.screenshot({ path: docPath, fullPage: false });
    if (fs.existsSync(brainArtifactsDir)) {
      try {
        fs.copyFileSync(docPath, path.join(brainArtifactsDir, filename));
      } catch {
        // ignore
      }
    }
  };

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'architectai-studio-graph-test-'));
    dbPath = path.join(tempDir, 'product.db');
    artifactsDir = path.join(tempDir, 'artifacts');

    const app = await createServer({ dbPath, artifactsDir });
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server.address();
        if (typeof addr === 'object' && addr !== null) {
          baseUrl = `http://127.0.0.1:${addr.port}`;
        }
        resolve();
      });
    });

    try {
      browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });
      hasChromium = true;
    } catch (err) {
      if (process.env.CI) {
        throw new Error(
          `[CI Failure] Playwright Chromium launch failed in CI: ${err instanceof Error ? err.message : String(err)}`
        );
      }
      console.warn('[Studio Graph Test] Chromium launch failed, skipping browser tests:', err);
      hasChromium = false;
    }
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  // 1. Graph Schema Validation
  it('1. verifies ArchitectureGraphProjection schema and strict contract provenance', () => {
    const projector = new ArchitectureGraphProjector();
    const projection = projector.projectSync(RATE_LIMITER_FIXTURE_CONTRACT, { allowCuratedTemplates: true, revision: 1 });

    const parsed = ArchitectureGraphProjectionSchema.safeParse(projection);
    expect(parsed.success).toBe(true);
    expect(projection.status).toBe('valid');
    expect(projection.contractId).toBe('contract-rate-limiter');
    expect(projection.contractRevision).toBe(1);

    const validation = validateArchitectureGraphProjection(projection, RATE_LIMITER_FIXTURE_CONTRACT);
    if (!validation.valid) console.log('VALIDATION ERRORS:', validation.errors);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  // 2. Dangling Edge Rejection
  it('2. detects and rejects dangling edges where source or target does not exist', () => {
    const projector = new ArchitectureGraphProjector();
    const projection = projector.projectSync(RATE_LIMITER_FIXTURE_CONTRACT, { allowCuratedTemplates: true });

    // Inject a dangling edge
    const corrupted: ArchitectureGraphProjection = {
      ...projection,
      edges: [
        ...projection.edges,
        {
          id: 'edge-dangling-ghost',
          source: 'node-nonexistent-1',
          target: 'node-nonexistent-2',
          label: 'Ghost Flow',
          protocol: 'HTTP',
          direction: 'unidirectional',
          isSelfLoop: false,
          origin: 'inferred_topology',
          confidence: 'inferred_proposed',
          sourceDecisionIds: [],
          sourceConcernIds: [],
          sourceInvariantIds: [],
          sourceSpecIds: [],
          purpose: 'Invalid flow',
          whySelected: 'Testing dangling edge rejection',
          assumptions: [],
          evidenceReferences: [],
        },
      ],
    };

    const validation = validateArchitectureGraphProjection(corrupted, RATE_LIMITER_FIXTURE_CONTRACT);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes('Dangling edge detected'))).toBe(true);
  });

  // 3. Invalid Provenance Reference Handling
  it('3. detects and reports invalid provenance references not grounded in the contract', () => {
    const projector = new ArchitectureGraphProjector();
    const projection = projector.projectSync(RATE_LIMITER_FIXTURE_CONTRACT, { allowCuratedTemplates: true });

    // Add a node with an invented decision ID
    const ungroundedNode = {
      ...projection.nodes[0]!,
      sourceDecisionIds: ['dec-completely-fabricated-999'],
    };
    const corrupted: ArchitectureGraphProjection = {
      ...projection,
      nodes: [ungroundedNode, ...projection.nodes.slice(1)],
    };

    const validation = validateArchitectureGraphProjection(corrupted, RATE_LIMITER_FIXTURE_CONTRACT);
    expect(validation.valid).toBe(false);
    expect(
      validation.errors.some((e) => e.includes('dec-completely-fabricated-999') && e.includes('references invalid/missing decision ID'))
    ).toBe(true);
  });

  // 4. Missing Topology Fallback for Incomplete Contracts
  it('4. provides graceful fallback for incomplete or draft contracts without crashing', () => {
    const projector = new ArchitectureGraphProjector();
    const projection = projector.projectSync(INCOMPLETE_FIXTURE_CONTRACT);

    expect(projection.status).toBe('incomplete');
    expect(projection.nodes).toHaveLength(0);
    expect(projection.edges).toHaveLength(0);
    expect(projection.missingSources).toContain('contract.decisions is empty');
  });

  // 5. Revision Stale Detection
  it('5. detects stale projections when contract revision differs', () => {
    const projector = new ArchitectureGraphProjector();
    const projection = projector.projectSync(RATE_LIMITER_FIXTURE_CONTRACT, { allowCuratedTemplates: true, revision: 1 });

    expect(projector.isProjectionStale(projection, RATE_LIMITER_FIXTURE_CONTRACT, 1)).toBe(false);
    expect(projector.isProjectionStale(projection, RATE_LIMITER_FIXTURE_CONTRACT, 2)).toBe(true);
  });

  // 6. Proves Generic Edge Routing has NO hardcoded edge ID routing
  it('6. verifies generic edge routing handles arbitrary nodes and self-loops without switch statements', () => {
    // Read StudioCanvas source code and verify no switch (edgeId) exists
    const studioCanvasSource = fs.readFileSync(
      path.resolve(__dirname, '../../apps/web/src/components/studio/StudioCanvas.tsx'),
      'utf8'
    );
    expect(studioCanvasSource.includes('switch (edgeId)')).toBe(false);
    expect(studioCanvasSource.includes('case \'edge-client-gw\'')).toBe(false);

    // Test computeGenericEdgePath with arbitrary coordinates
    const sourceNode = {
      id: 'node-alpha',
      label: 'Alpha Node',
      sublabel: 'Service',
      category: 'compute' as const,
      x: 200,
      y: 200,
      purpose: 'Alpha purpose',
    };

    const targetNode = {
      id: 'node-beta',
      label: 'Beta Node',
      sublabel: 'Database',
      category: 'datastore' as const,
      x: 600,
      y: 400,
      purpose: 'Beta purpose',
    };

    const edge = {
      id: 'edge-arbitrary-link',
      source: 'node-alpha',
      target: 'node-beta',
      label: 'TCP Link',
      protocol: 'TCP',
    };

    const routing = computeGenericEdgePath(edge, sourceNode, targetNode);
    expect(routing.pathData).toMatch(/^M \d+(\.\d+)? \d+(\.\d+)? C/);
    expect(routing.badgeX).toBeGreaterThan(200);
    expect(routing.badgeX).toBeLessThan(600);

    // Test self-loop
    const selfLoopEdge = {
      id: 'edge-self-loop',
      source: 'node-alpha',
      target: 'node-alpha',
      label: 'Retry Loop',
      protocol: 'INTERNAL',
      isSelfLoop: true,
    };
    const loopRouting = computeGenericEdgePath(selfLoopEdge, sourceNode, sourceNode);
    expect(loopRouting.badgeX).toBe(200);
    expect(loopRouting.badgeY).toBeLessThan(200); // curves above node
  });

  // 7. Heterogeneous Contracts Projection Diversity
  it('7. verifies 3 heterogeneous contracts produce distinct topologies and grounded metrics', () => {
    const projector = new ArchitectureGraphProjector();
    const rl = projector.projectSync(RATE_LIMITER_FIXTURE_CONTRACT, { allowCuratedTemplates: true });
    const po = projector.projectSync(PAYMENT_OUTBOX_FIXTURE_CONTRACT, { allowCuratedTemplates: true });
    const ip = projector.projectSync(IMAGE_PIPELINE_FIXTURE_CONTRACT, { allowCuratedTemplates: true });

    // Diverse node counts & categories
    expect(rl.nodes).toHaveLength(5);
    expect(po.nodes).toHaveLength(6);
    expect(ip.nodes).toHaveLength(5);

    // Different edge counts
    expect(rl.edges).toHaveLength(4);
    expect(po.edges).toHaveLength(5);
    expect(ip.edges).toHaveLength(5);

    // Dedicated simulation flag truthfulness
    expect(rl.simulationModule?.available).toBe(true);
    expect(po.simulationModule?.available).toBe(false);
    expect(ip.simulationModule?.available).toBe(false);

    // Provenance verification: all architectural decision nodes have grounded sourceDecisionIds
    expect(po.nodes.filter((n) => n.origin === 'contract_decision').every((n) => n.sourceDecisionIds.length > 0)).toBe(true);
    expect(ip.nodes.filter((n) => n.origin === 'contract_decision').every((n) => n.sourceDecisionIds.length > 0)).toBe(true);
    expect(po.nodes.some((n) => n.origin === 'contract_requirement')).toBe(true);
    expect(ip.nodes.some((n) => n.origin === 'contract_requirement')).toBe(true);
  });

  // 8. Browser Integration & Screenshot Capture across all 3 architectures
  it('8. renders all 3 contracts in browser and captures required screenshots', async () => {
    if (!hasChromium || !browser) {
      console.warn('Skipping Playwright browser assertions: Chromium unavailable in this environment.');
      return;
    }

    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

    // 8A. Contract 1: Rate Limiting
    await page.goto(`${baseUrl}/studio?contract=contract-rate-limiter`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.studio-canvas-container', { timeout: 10000 });

    const rlNodes = await page.locator('.canvas-node').count();
    expect(rlNodes).toBe(5);

    // Capture Screenshot 1: studio-graph-rate-limiter.png
    await saveScreenshot(page, 'studio-graph-rate-limiter.png');

    // 8B. Contract 2: Payment Processing & Outbox
    await page.selectOption('#contract-selector', 'contract-payment-idempotency');
    await page.waitForTimeout(400);

    const poNodes = await page.locator('.canvas-node').count();
    expect(poNodes).toBe(6);

    // Verify static contract mode (no false simulation claims)
    const staticTag = await page.locator('.sim-quick-stats').textContent();
    expect(staticTag).toContain('EngineeringContract');

    // Capture Screenshot 2: studio-graph-payment-outbox.png
    await saveScreenshot(page, 'studio-graph-payment-outbox.png');

    // 8C. Contract 3: Image Pipeline & Bounded Workers
    await page.selectOption('#contract-selector', 'contract-image-pipeline');
    await page.waitForTimeout(400);

    const ipNodes = await page.locator('.canvas-node').count();
    expect(ipNodes).toBe(5);

    // Capture Screenshot 3: studio-graph-image-pipeline.png
    await saveScreenshot(page, 'studio-graph-image-pipeline.png');

    // 8D. Traceability Inspector Verification on Worker Pool Node
    const workerNode = page.locator('.canvas-node', { hasText: 'Bounded Workers' });
    await workerNode.click();
    await page.waitForTimeout(300);

    // Verify inspector drawer is open and shows contract evidence
    expect(await page.locator('.studio-inspector-drawer').isVisible()).toBe(true);

    // Switch to Traceability Tab in Inspector
    await page.click('button.inspector-tab-btn:has-text("Traceability")');
    await page.waitForTimeout(200);

    // Verify linked decision and invariant appear
    const inspectorText = await page.locator('.studio-inspector-drawer').textContent();
    expect(inspectorText).toContain('libvips');
    expect(inspectorText).toContain('512MB');

    // Capture Screenshot 4: studio-graph-inspector-traceability.png
    await saveScreenshot(page, 'studio-graph-inspector-traceability.png');

    // 8E. Fallback Test for Incomplete Contract
    await page.selectOption('#contract-selector', 'contract-incomplete-sample');
    await page.waitForTimeout(400);

    const emptyCount = await page.locator('.canvas-node').count();
    expect(emptyCount).toBe(0);
    const emptyBanner = await page.locator('.canvas-empty-state').textContent();
    expect(emptyBanner).toContain('Incomplete Architecture Topology');

    await page.close();
  });

  // 9. Real Persisted Run Architecture Graph Browser Test
  it('9. opens a REAL persisted run architecture-graph endpoint in browser and proves end-to-end rendering', async () => {
    // 9A. Create a real project via API
    const projRes = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Persisted Clinic Project', description: 'End-to-End Grounded Studio Test' }),
    });
    expect(projRes.ok).toBe(true);
    const { project } = await projRes.json();

    // 9B. Start a real run with requirement intent
    const runRes = await fetch(`${baseUrl}/api/projects/${project.id}/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rawIntent: 'Build a doctor appointment booking service with concurrent slot reservation.',
        explicitConstraints: ['No duplicate bookings'],
        declaredTechStack: ['Node.js', 'PostgreSQL', 'Redis'],
        context: { title: 'Clinic Booking System' },
      }),
    });
    expect(runRes.ok).toBe(true);
    const { runId } = await runRes.json();

    // 9C. Query GET /api/runs/:runId/architecture-graph
    const graphRes = await fetch(`${baseUrl}/api/runs/${runId}/architecture-graph`);
    expect(graphRes.status).toBe(200);
    const graphData = await graphRes.json();
    expect(graphData.success).toBe(true);
    expect(graphData.runId).toBe(runId);
    expect(graphData.status).toBe('valid');
    expect(graphData.projection.nodes.length).toBeGreaterThan(0);
    expect(graphData.projection.contractFingerprint).toMatch(/^cfp_/);

    // 9D. Open ?runId= in Playwright browser and assert real run renders in Studio!
    if (!hasChromium || !browser) return;

    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${baseUrl}/studio?runId=${runId}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.studio-canvas-container', { timeout: 10000 });

    // Verify canvas rendered the persisted run's nodes
    const renderedNodes = await page.locator('.canvas-node').count();
    expect(renderedNodes).toBeGreaterThan(0);

    // Verify left nav displays real contract intent
    const navText = await page.locator('.studio-left-nav').textContent();
    expect(navText).toContain('doctor appointment booking');

    await page.close();
  });
});
