// ArchitectAI — Architecture Studio Prototype Verification & Screenshot Capture
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser } from 'playwright';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { execSync } from 'node:child_process';
import type { Server } from 'node:http';
import { createServer } from '../../apps/web/server/server.js';

describe('ArchitectAI: Architecture Studio Prototype Test Suite', () => {
  let tempDir: string;
  let dbPath: string;
  let artifactsDir: string;
  let server: Server;
  let baseUrl: string;
  let browser: Browser | null = null;
  let hasChromium = false;
  const screenshotsDir = path.resolve(__dirname, '../../docs/product/screenshots');

  beforeAll(async () => {
    // Ensure screenshot directory exists
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    const distIndex = path.resolve(__dirname, '../../apps/web/dist/index.html');
    if (!fs.existsSync(distIndex)) {
      execSync('pnpm run web:build', { cwd: path.resolve(__dirname, '../..'), stdio: 'inherit' });
    }

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'architectai-studio-test-'));
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
      console.warn('[Studio Test] Chromium launch failed, skipping:', err);
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

  function ensureBrowser(): boolean {
    if (!hasChromium || !browser) {
      if (process.env.CI) {
        throw new Error('[CI Failure] Chromium is required in CI.');
      }
      return false;
    }
    return true;
  }

  // 1. Desktop Experience (1440x900)
  it('renders Architecture Studio on desktop (1440x900) with zero overflow, interactive canvas, and captures screenshots', async () => {
    if (!ensureBrowser() || !browser) return;

    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    await page.goto(`${baseUrl}/studio`, { waitUntil: 'networkidle' });

    // 1. Header Bar Verification
    await page.waitForSelector('.studio-header', { timeout: 10000 });
    expect(await page.textContent('.studio-brand-name')).toBe('ArchitectAI');
    expect(await page.textContent('.studio-sub-badge')).toBe('STUDIO');
    expect(await page.textContent('.studio-demo-pill')).toBe('DEMO');

    // 2. Zero Horizontal Document Overflow
    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasOverflow).toBe(false);

    // 3. Central Canvas & Trust Boundaries Verification
    await page.waitForSelector('.studio-canvas-container', { timeout: 10000 });
    const boundaryElements = await page.locator('.trust-boundary-box').count();
    expect(boundaryElements).toBe(4);

    const nodeElements = await page.locator('.canvas-node').count();
    expect(nodeElements).toBe(5);

    // Capture Screenshot 1: Desktop Main Canvas
    const screenshot1Path = path.join(screenshotsDir, 'studio-desktop-1440-canvas.png');
    await page.screenshot({ path: screenshot1Path, fullPage: false });
    expect(fs.existsSync(screenshot1Path)).toBe(true);

    // 4. Click a Node and Verify Contextual Right Inspector
    const redisNode = page.locator('.canvas-node:has-text("Redis Distributed State")');
    await redisNode.click();

    await page.waitForSelector('.studio-inspector-drawer', { timeout: 10000 });
    const inspectorHeading = await page.textContent('.inspector-heading');
    expect(inspectorHeading).toContain('Redis Distributed State');

    // Tab through Trade-offs
    await page.click('.inspector-tab-btn:has-text("Trade-offs")');
    await page.waitForSelector('.tradeoffs-list', { timeout: 5000 });
    const tradeoffsContent = await page.textContent('.tradeoffs-list');
    expect(tradeoffsContent).toContain('Memory footprint scales with active concurrent tenants');

    // Tab through Failure Modes
    await page.click('.inspector-tab-btn:has-text("Failures")');
    await page.waitForSelector('.failure-mode-card', { timeout: 5000 });
    const failuresContent = await page.textContent('.failure-modes-stack');
    expect(failuresContent).toContain('Out of Memory (OOM)');
    expect(failuresContent).toContain('Concurrent Read-Modify-Write Race Condition');

    // Tab through Verification Invariant
    await page.click('.inspector-tab-btn:has-text("Verification")');
    await page.waitForSelector('.verification-spec-card', { timeout: 5000 });
    const verifContent = await page.textContent('.verification-spec-card');
    expect(verifContent).toContain('inv-sliding-window-boundary-burst');
    expect(verifContent).toContain('Sliding-Window Boundary Burst Suppression');

    // Capture Screenshot 2: Desktop with Inspector Open
    const screenshot2Path = path.join(screenshotsDir, 'studio-desktop-1440-inspector.png');
    await page.screenshot({ path: screenshot2Path, fullPage: false });
    expect(fs.existsSync(screenshot2Path)).toBe(true);

    // 5. Test Simulation Mode Switch
    // Switch to Fixed Window to witness boundary defect
    await page.click('.sim-pill-btn:has-text("Fixed Window")');
    await page.waitForSelector('.sim-pill-btn.vulnerable.active', { timeout: 5000 });

    // Wait 2 seconds for simulation ticks
    await page.waitForTimeout(2000);

    // Capture Screenshot 3: Simulation Active
    const screenshot3Path = path.join(screenshotsDir, 'studio-desktop-1440-simulation.png');
    await page.screenshot({ path: screenshot3Path, fullPage: false });
    expect(fs.existsSync(screenshot3Path)).toBe(true);

    await context.close();
  });

  // 2. Mobile Experience (390x844)
  it('renders Architecture Studio on mobile (390x844) with zero overflow, collapsible drawers, and captures screenshots', async () => {
    if (!ensureBrowser() || !browser) return;

    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();

    await page.goto(`${baseUrl}/studio`, { waitUntil: 'networkidle' });

    // 1. Zero Horizontal Overflow on Mobile
    const hasMobileOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasMobileOverflow).toBe(false);

    // 2. Mobile Quick Bar exists
    await page.waitForSelector('.studio-mobile-bar', { timeout: 10000 });

    // Capture Screenshot 4: Mobile Canvas
    const screenshot4Path = path.join(screenshotsDir, 'studio-mobile-390-canvas.png');
    await page.screenshot({ path: screenshot4Path, fullPage: false });
    expect(fs.existsSync(screenshot4Path)).toBe(true);

    // 3. Open Inspector Bottom Sheet on Mobile
    await page.click('.mobile-inspector-toggle');
    await page.waitForSelector('.studio-right-pane.open', { timeout: 5000 });

    // Capture Screenshot 5: Mobile Inspector Drawer Open
    const screenshot5Path = path.join(screenshotsDir, 'studio-mobile-390-inspector.png');
    await page.screenshot({ path: screenshot5Path, fullPage: false });
    expect(fs.existsSync(screenshot5Path)).toBe(true);

    await context.close();
  });

  // 3. Verify Existing Main Application Remains Completely Unaffected
  it('verifies existing main application routes (/ and /new) continue functioning normally without interference', async () => {
    if (!ensureBrowser() || !browser) return;

    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    // Home route
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.hero-title', { timeout: 10000 });
    const homeTitle = await page.textContent('.hero-title');
    expect(homeTitle).toContain('Engineering intelligence');

    // Sidebar and TopBar present on standard routes
    const hasSidebar = await page.locator('.workspace-sidebar').count();
    expect(hasSidebar).toBe(1);

    // New analysis route
    await page.goto(`${baseUrl}/new`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#intent-input', { timeout: 10000 });
    expect(await page.locator('#intent-input').isVisible()).toBe(true);

    await context.close();
  });
});
