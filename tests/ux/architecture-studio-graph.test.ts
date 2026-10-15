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

  // 9. Real Persisted Run A: Doctor Appointment Booking with Concurrent Slot Hold
  it('9. Real Persisted Run A: Appointment Booking renders grounded topology, proposed edge styles, and captures studio-realrun-appointment-booking.png', async () => {
    // 9A. Create project
    const projRes = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Clinic Appointment Platform', description: 'Concurrent Slot Reservation' }),
    });
    expect(projRes.ok).toBe(true);
    const { project } = await projRes.json();

    // 9B. Booking Contract with Redis Mutex and PostgreSQL Ledger
    const bookingContract = {
      id: 'contract-appointment-booking',
      version: '1.0.0',
      requirement: {
        id: 'req-booking',
        rawIntent: 'Build a doctor appointment booking service with concurrent seat and time slot reservations.',
        explicitConstraints: ['No double booking permitted', 'Atomic slot hold with 10m TTL'],
        declaredTechStack: ['Node.js', 'PostgreSQL', 'Redis'],
        context: { title: 'Doctor Appointment Booking', clientType: 'Patient & Clinic Portals' },
      },
      discoveredConcerns: [
        {
          id: 'concern-double-booking',
          requirementId: 'req-booking',
          title: 'Concurrent Appointment Slot Race Condition',
          description: 'Two patients booking the same appointment slot simultaneously.',
          applicabilityReason: 'Shared calendar state without atomic slot acquisition.',
          dimensions: ['concurrency', 'shared_mutable_state'],
          supportingKnowledgeIds: [],
          confidence: 0.95,
          assumptions: [],
          unresolvedQuestions: [],
        },
      ],
      decisions: [
        {
          id: 'dec-slot-mutex',
          problemContext: 'Distributed Slot Hold Mutex',
          consideredOptions: [
            {
              id: 'opt-mutex',
              name: 'Redis Distributed Slot Lock (SETNX with 10m TTL)',
              description: 'Locks slot during patient checkout',
              tradeoffs: 'Locks must expire gracefully if checkout is abandoned',
            },
          ],
          selectedOptionId: 'opt-mutex',
          selectedOptionName: 'Redis Distributed Slot Lock (SETNX with 10m TTL)',
          rationale: 'Holds the appointment slot for 10 minutes to prevent double booking during checkout.',
          evidence: [],
          assumptions: ['Hold timeout releases slot if checkout abandoned.'],
          risksAndTradeoffs: ['Unused hold locks must expire gracefully.'],
          verificationRequirements: ['Assert second booking attempt on held slot receives 409 Conflict.'],
          reconsiderationTriggers: [],
        },
        {
          id: 'dec-booking-db',
          problemContext: 'PostgreSQL Relational Booking Ledger',
          consideredOptions: [
            {
              id: 'opt-pg',
              name: 'PostgreSQL Relational DB with Row-Level Locking',
              description: 'ACID appointment calendar ledger',
              tradeoffs: 'Row locks serialize simultaneous updates on doctor schedule',
            },
          ],
          selectedOptionId: 'opt-pg',
          selectedOptionName: 'PostgreSQL Relational DB with Row-Level Locking',
          rationale: 'Guarantees ACID persistence for confirmed patient appointments with unique calendar constraints.',
          evidence: [],
          assumptions: ['Database enforces unique calendar slot constraints.'],
          risksAndTradeoffs: [],
          verificationRequirements: [],
          reconsiderationTriggers: [],
        },
      ],
      invariants: [
        {
          id: 'inv-no-double-booking',
          property: 'No appointment slot can ever be confirmed for two distinct patients.',
          severity: 'critical',
          blocksCompletion: true,
          rationale: 'Patient booking calendar integrity.',
        },
      ],
      verificationSpecs: [],
      assumptions: ['Clinic hours are localized to doctor timezone.'],
      unresolvedQuestions: ['What failover strategy is needed for PostgreSQL primary?'],
      metadata: {
        status: 'accepted',
        createdAt: '2026-10-14T08:00:00.000Z',
        tags: [],
      },
    };

    // 9C. Persist run via POST /api/projects/:id/runs
    const runRes = await fetch(`${baseUrl}/api/projects/${project.id}/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rawIntent: bookingContract.requirement.rawIntent,
        explicitConstraints: bookingContract.requirement.explicitConstraints,
        declaredTechStack: bookingContract.requirement.declaredTechStack,
        context: bookingContract.requirement.context,
        contract: bookingContract,
      }),
    });
    expect(runRes.ok).toBe(true);
    const { runId } = await runRes.json();

    // 9D. Verify GET /api/runs/:runId/architecture-graph
    const graphRes = await fetch(`${baseUrl}/api/runs/${runId}/architecture-graph`);
    expect(graphRes.status).toBe(200);
    const graphData = await graphRes.json();
    expect(graphData.success).toBe(true);
    expect(graphData.runId).toBe(runId);
    expect(graphData.status).toBe('valid');
    expect(graphData.groundingStatus).toBe('proposed_design');
    expect(graphData.synthesisMode).toBe('deterministic_demo');

    // 9E. Assert candidate edges carry assumptions and questions, not invented protocols
    const candidateEdge = graphData.projection.edges.find((e: any) => e.origin === 'inferred_topology');
    expect(candidateEdge).toBeDefined();
    expect(candidateEdge.assumptions.length).toBeGreaterThan(0);
    expect(candidateEdge.unresolvedQuestions.length).toBeGreaterThan(0);

    // 9F. Browser render and screenshot
    if (!hasChromium || !browser) return;

    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${baseUrl}/studio?runId=${runId}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.studio-canvas-container', { timeout: 10000 });

    // Assert LIVE RUN and PROPOSED DESIGN pills in header
    expect(await page.locator('.studio-demo-pill:has-text("LIVE RUN")').isVisible()).toBe(true);
    expect(await page.locator('header:has-text("PROPOSED DESIGN")').isVisible()).toBe(true);

    // Assert proposed edge line has dashed class
    const dashedEdge = page.locator('.canvas-edge-line.edge-proposed');
    expect(await dashedEdge.count()).toBeGreaterThan(0);

    // Assert proposed node has PROPOSED pill
    expect(await page.locator('.node-proposed-pill:has-text("PROPOSED")').isVisible()).toBe(true);

    // Select slot mutex node to open inspector
    const mutexNode = page.locator('.canvas-node', { hasText: 'Redis Distributed Slot Lock' });
    await mutexNode.click();
    await page.waitForTimeout(300);

    // Assert inspector displays grounded rationale
    expect(await page.locator('.studio-inspector-drawer').isVisible()).toBe(true);
    const inspectorText = await page.locator('.studio-inspector-drawer').textContent();
    expect(inspectorText).toContain('10 minutes');

    // Capture Screenshot A: studio-realrun-appointment-booking.png
    await saveScreenshot(page, 'studio-realrun-appointment-booking.png');
    await page.close();
  });

  // 10. Real Persisted Run B: Collaborative Document Editing with CRDTs
  it('10. Real Persisted Run B: Collaborative Editing renders CRDT/WebSocket topology and captures studio-realrun-collaborative-editing.png', async () => {
    const projRes = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Collaborative Docs Project', description: 'CRDT Sync Engine' }),
    });
    const { project } = await projRes.json();

    const collabContract = {
      id: 'contract-collab-docs',
      version: '1.0.0',
      requirement: {
        id: 'req-collab',
        rawIntent: 'Real-time collaborative document editing with presence awareness and CRDT state synchronization.',
        explicitConstraints: ['Eventual state convergence', 'Sub-100ms keystroke broadcast'],
        declaredTechStack: ['Node.js', 'WebSockets', 'SQLite'],
        context: { title: 'Collaborative Notes', clientType: 'Collaborative Editors' },
      },
      discoveredConcerns: [
        {
          id: 'concern-crdt-convergence',
          requirementId: 'req-collab',
          title: 'Asynchronous State Divergence',
          description: 'Concurrent edits across mobile and desktop clients without deterministic merge.',
          applicabilityReason: 'Distributed peer editing.',
          dimensions: ['concurrency', 'shared_mutable_state', 'ordering'],
          supportingKnowledgeIds: [],
          confidence: 0.95,
          assumptions: [],
          unresolvedQuestions: [],
        },
      ],
      decisions: [
        {
          id: 'dec-ws-gateway',
          problemContext: 'WebSocket Real-Time Gateway Broker',
          consideredOptions: [
            {
              id: 'opt-ws',
              name: 'WebSocket Presence & Operation Gateway',
              description: 'Bi-directional text stream',
              tradeoffs: 'Socket connections require state tracking across restarts',
            },
          ],
          selectedOptionId: 'opt-ws',
          selectedOptionName: 'WebSocket Presence & Operation Gateway',
          rationale: 'Maintains persistent duplex WebSocket connections for real-time keystroke broadcasting.',
          evidence: [],
          assumptions: ['Clients connect via secure WebSocket.'],
          risksAndTradeoffs: ['Connection state must survive node restarts.'],
          verificationRequirements: [],
          reconsiderationTriggers: [],
        },
        {
          id: 'dec-crdt-store',
          problemContext: 'Conflict-Free Replicated Document Store',
          consideredOptions: [
            {
              id: 'opt-crdt',
              name: 'CRDT Append-Only Operation Ledger',
              description: 'Yjs / Automerge state store',
              tradeoffs: 'Append-only operation logs require periodic compaction',
            },
          ],
          selectedOptionId: 'opt-crdt',
          selectedOptionName: 'CRDT Append-Only Operation Ledger',
          rationale: 'Stores commutative document mutations guaranteeing identical convergence across peers.',
          evidence: [],
          assumptions: ['Operations commute deterministically.'],
          risksAndTradeoffs: [],
          verificationRequirements: [],
          reconsiderationTriggers: [],
        },
      ],
      invariants: [
        {
          id: 'inv-convergence',
          property: 'All peers must converge to identical document text after all delta operations arrive.',
          severity: 'critical',
          blocksCompletion: true,
          rationale: 'CRDT mathematical convergence property.',
        },
      ],
      verificationSpecs: [],
      assumptions: [],
      unresolvedQuestions: ['What compaction schedule is used for CRDT delta operation logs?'],
      metadata: {
        status: 'accepted',
        createdAt: '2026-10-14T08:00:00.000Z',
        tags: [],
      },
    };

    const runRes = await fetch(`${baseUrl}/api/projects/${project.id}/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rawIntent: collabContract.requirement.rawIntent,
        explicitConstraints: collabContract.requirement.explicitConstraints,
        declaredTechStack: collabContract.requirement.declaredTechStack,
        context: collabContract.requirement.context,
        contract: collabContract,
      }),
    });
    const { runId } = await runRes.json();

    const graphRes = await fetch(`${baseUrl}/api/runs/${runId}/architecture-graph`);
    expect(graphRes.status).toBe(200);
    const graphData = await graphRes.json();
    expect(graphData.projection.nodes.some((n: any) => n.label.includes('WebSocket'))).toBe(true);
    expect(graphData.projection.nodes.some((n: any) => n.label.includes('CRDT'))).toBe(true);

    if (!hasChromium || !browser) return;

    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${baseUrl}/studio?runId=${runId}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.studio-canvas-container', { timeout: 10000 });

    // Click on CRDT node to open inspector
    const crdtNode = page.locator('.canvas-node', { hasText: 'CRDT' });
    await crdtNode.click();
    await page.waitForTimeout(300);

    const inspectorContent = await page.locator('.studio-inspector-drawer').textContent();
    expect(inspectorContent).toContain('commutative document mutations');

    // Capture Screenshot B: studio-realrun-collaborative-editing.png
    await saveScreenshot(page, 'studio-realrun-collaborative-editing.png');
    await page.close();
  });

  // 11. Real Persisted Run C: Minimal CRUD Contact Book (Zero Queues, Zero Caches)
  it('11. Real Persisted Run C: Minimal CRUD renders service & DB only (no queues/caches) and captures studio-realrun-minimal-crud.png', async () => {
    const projRes = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Contact Book Project', description: 'Minimal CRUD REST' }),
    });
    const { project } = await projRes.json();

    const crudContract = {
      id: 'contract-minimal-crud',
      version: '1.0.0',
      requirement: {
        id: 'req-crud',
        rawIntent: 'A simple contact book CRUD REST API with embedded SQLite database.',
        explicitConstraints: ['Single process, low memory footprint'],
        declaredTechStack: ['Node.js', 'SQLite'],
        context: { title: 'Contact Book CRUD', clientType: 'REST API Clients' },
      },
      discoveredConcerns: [],
      decisions: [
        {
          id: 'dec-rest-api',
          problemContext: 'Express REST API Service',
          consideredOptions: [
            {
              id: 'opt-api',
              name: 'Stateless REST HTTP Service',
              description: 'Standard JSON endpoints',
              tradeoffs: 'Direct process execution without worker queues',
            },
          ],
          selectedOptionId: 'opt-api',
          selectedOptionName: 'Stateless REST HTTP Service',
          rationale: 'Serves standard GET/POST/PUT/DELETE contact endpoints.',
          evidence: [],
          assumptions: [],
          risksAndTradeoffs: [],
          verificationRequirements: [],
          reconsiderationTriggers: [],
        },
        {
          id: 'dec-sqlite-db',
          problemContext: 'Embedded SQLite Datastore',
          consideredOptions: [
            {
              id: 'opt-sqlite',
              name: 'Embedded SQLite Relational Database',
              description: 'Single-file ACID database',
              tradeoffs: 'Concurrent writes are serialized by file lock',
            },
          ],
          selectedOptionId: 'opt-sqlite',
          selectedOptionName: 'Embedded SQLite Relational Database',
          rationale: 'Persists contact entries in a local file-based SQLite database with zero network overhead.',
          evidence: [],
          assumptions: ['Single process access to SQLite file.'],
          risksAndTradeoffs: ['Concurrent writes are serialized.'],
          verificationRequirements: [],
          reconsiderationTriggers: [],
        },
      ],
      invariants: [
        {
          id: 'inv-crud-persistence',
          property: 'Created contacts must be durable and readable until explicitly deleted.',
          severity: 'critical',
          blocksCompletion: true,
          rationale: 'Basic persistence.',
        },
      ],
      verificationSpecs: [],
      assumptions: [],
      unresolvedQuestions: [],
      metadata: {
        status: 'accepted',
        createdAt: '2026-10-14T08:00:00.000Z',
        tags: [],
      },
    };

    const runRes = await fetch(`${baseUrl}/api/projects/${project.id}/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rawIntent: crudContract.requirement.rawIntent,
        explicitConstraints: crudContract.requirement.explicitConstraints,
        declaredTechStack: crudContract.requirement.declaredTechStack,
        context: crudContract.requirement.context,
        contract: crudContract,
      }),
    });
    const { runId } = await runRes.json();

    const graphRes = await fetch(`${baseUrl}/api/runs/${runId}/architecture-graph`);
    expect(graphRes.status).toBe(200);
    const graphData = await graphRes.json();
    const categories = graphData.projection.nodes.map((n: any) => n.category);
    expect(categories).not.toContain('queue');
    expect(categories).not.toContain('cache');
    expect(categories).not.toContain('worker');
    expect(categories).toContain('service');
    expect(categories).toContain('datastore');

    if (!hasChromium || !browser) return;

    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${baseUrl}/studio?runId=${runId}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.studio-canvas-container', { timeout: 10000 });

    // Assert only 3 nodes on canvas (Client, REST API, SQLite DB)
    const nodeCards = await page.locator('.canvas-node').count();
    expect(nodeCards).toBe(3);

    // Capture Screenshot C: studio-realrun-minimal-crud.png
    await saveScreenshot(page, 'studio-realrun-minimal-crud.png');
    await page.close();
  });

  // 12. Refresh Does Not Retain Stale Projection
  it('12. verifies that refreshing a persisted run after contract mutation does not retain a stale projection', async () => {
    const projRes = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Refresh Test Project', description: 'Stale detection test' }),
    });
    const { project } = await projRes.json();

    const initialContract = {
      id: 'contract-refresh-test',
      version: '1.0.0',
      requirement: {
        id: 'req-ref',
        rawIntent: 'Initial service requirement.',
        explicitConstraints: [],
        declaredTechStack: ['Node.js'],
        context: { title: 'Refresh Test' },
      },
      discoveredConcerns: [],
      decisions: [
        {
          id: 'dec-initial-svc',
          problemContext: 'Initial Stateless Service',
          consideredOptions: [{ id: 'opt-svc', name: 'Initial Stateless Service', description: 'Base service' }],
          selectedOptionId: 'opt-svc',
          selectedOptionName: 'Initial Stateless Service',
          rationale: 'Initial un-mutated rationale.',
          evidence: [],
          assumptions: [],
          risksAndTradeoffs: [],
          verificationRequirements: [],
          reconsiderationTriggers: [],
        },
      ],
      invariants: [],
      verificationSpecs: [],
      assumptions: [],
      unresolvedQuestions: [],
      metadata: { status: 'accepted', createdAt: new Date().toISOString(), tags: [] },
    };

    const runRes = await fetch(`${baseUrl}/api/projects/${project.id}/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rawIntent: initialContract.requirement.rawIntent,
        contract: initialContract,
      }),
    });
    const { runId } = await runRes.json();

    const g1Res = await fetch(`${baseUrl}/api/runs/${runId}/architecture-graph`);
    const g1 = await g1Res.json();
    const fp1 = g1.projection.contractFingerprint;

    // Mutate the contract (editorial change to decision without revision increment)
    const mutatedContract = structuredClone(initialContract);
    mutatedContract.decisions[0]!.selectedOptionName = 'Mutated Event Stream Service';
    mutatedContract.decisions[0]!.rationale = 'Radically mutated decision rationale: switched to event streaming.';

    // Update run in database via direct patch
    const patchRes = await fetch(`${baseUrl}/api/runs/${runId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contract: mutatedContract,
      }),
    });
    expect(patchRes.ok).toBe(true);

    // Query architecture-graph again: fingerprint MUST change!
    const g2Res = await fetch(`${baseUrl}/api/runs/${runId}/architecture-graph`);
    const g2 = await g2Res.json();
    const fp2 = g2.projection.contractFingerprint;

    expect(fp2).not.toBe(fp1);
    const mutatedNode = g2.projection.nodes.find((n: any) => n.sourceDecisionIds?.includes('dec-initial-svc') || n.id.includes('initial-svc'));
    const initialNode = g1.projection.nodes.find((n: any) => n.sourceDecisionIds?.includes('dec-initial-svc') || n.id.includes('initial-svc'));
    expect(mutatedNode).toBeDefined();
    expect(initialNode).toBeDefined();
    expect(mutatedNode.purpose).toBe('Radically mutated decision rationale: switched to event streaming.');
    expect(mutatedNode.purpose).not.toBe(initialNode.purpose);
    expect(mutatedNode.label).toBe('Mutated Event Stream Service');

    // In browser, verify Refresh button re-queries without retaining stale state
    if (!hasChromium || !browser) return;

    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${baseUrl}/studio?runId=${runId}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.studio-canvas-container', { timeout: 10000 });

    // Assert Refresh button is present in header for real run
    const refreshBtn = page.locator('button[aria-label="Refresh Architecture Graph"]');
    expect(await refreshBtn.isVisible()).toBe(true);
    await refreshBtn.click();
    await page.waitForTimeout(300);

    // Verify node text shows updated component
    const nodeTexts = await page.locator('.canvas-node').allTextContents();
    expect(nodeTexts.join(' ')).toContain('Mutated Event Stream Service');

    await page.close();
  });
});
