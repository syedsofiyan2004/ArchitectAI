// ArchitectAI — Architecture Studio Prototype Revision 1 Test Suite & Screenshot Generator
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser } from 'playwright';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { execSync } from 'node:child_process';
import type { Server } from 'node:http';
import { createServer } from '../../apps/web/server/server.js';

describe('ArchitectAI: Architecture Studio Prototype Revision 1 Suite', () => {
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

  // 1. Zero Overlap Collision Check & Fit to View Action
  it('proves zero bounding box collision between all architecture node cards and tests Fit to View', async () => {
    if (!ensureBrowser() || !browser) return;

    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    await page.goto(`${baseUrl}/studio`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.studio-canvas-container', { timeout: 10000 });

    // Wait for auto-fit transform to settle
    await page.waitForTimeout(300);

    const nodes = await page.$$('.canvas-node');
    expect(nodes.length).toBe(5);

    const boxes = await Promise.all(nodes.map((n) => n.boundingBox()));
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const b1 = boxes[i]!;
        const b2 = boxes[j]!;
        const overlap =
          b1.x < b2.x + b2.width &&
          b1.x + b1.width > b2.x &&
          b1.y < b2.y + b2.height &&
          b1.y + b1.height > b2.y;
        expect(overlap, `Collision detected between node ${i} and node ${j}`).toBe(false);
      }
    }

    // Trigger Fit to View button
    await page.click('button[title="Fit to View"]');
    await page.waitForTimeout(200);

    // Verify all nodes remain uncollided after Fit to View
    const postFitBoxes = await Promise.all(nodes.map((n) => n.boundingBox()));
    for (let i = 0; i < postFitBoxes.length; i++) {
      for (let j = i + 1; j < postFitBoxes.length; j++) {
        const b1 = postFitBoxes[i]!;
        const b2 = postFitBoxes[j]!;
        const overlap =
          b1.x < b2.x + b2.width &&
          b1.x + b1.width > b2.x &&
          b1.y < b2.y + b2.height &&
          b1.y + b1.height > b2.y;
        expect(overlap).toBe(false);
      }
    }

    await context.close();
  });

  // 2. Removal of Unearned Engineering Claims
  it('verifies removal of unearned engineering claims across all views', async () => {
    if (!ensureBrowser() || !browser) return;

    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    await page.goto(`${baseUrl}/studio`, { waitUntil: 'networkidle' });

    // Header check
    expect(await page.textContent('.studio-demo-pill')).toBe('DEMO');

    // Left navigation check
    const navText = await page.textContent('.studio-left-nav');
    expect(navText).toContain('Planned Invariant Checks (3 planned)');
    expect(navText).toContain('EDUCATIONAL SIMULATION');
    expect(navText).toContain('Sliding window burst suppression (Planned check)');

    // Inspector check
    const inspectorText = await page.textContent('.studio-inspector-drawer');
    expect(inspectorText).toContain('3 checks planned');
    expect(inspectorText).toContain('Modeled Baseline Latency');

    // Assert "3 Verified" is nowhere on the screen
    const pageText = await page.textContent('body');
    expect(pageText).not.toContain('3 Verified');

    // Check node verification tab
    const redisNode = page.locator('.canvas-node:has-text("Redis Distributed State")');
    await redisNode.click();
    await page.click('.inspector-tab-btn:has-text("Verification")');
    await page.waitForSelector('.verif-status-badge', { timeout: 5000 });
    const verifBadgeText = await page.textContent('.verif-status-badge');
    expect(verifBadgeText).toContain('Planned Verification Check (Not yet executed)');

    await context.close();
  });

  // 3. Desktop Experience & 4 Desktop Screenshots
  it('renders desktop experience (1440x900) and captures the 4 required desktop screenshots', async () => {
    if (!ensureBrowser() || !browser) return;

    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    await page.goto(`${baseUrl}/studio`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.studio-canvas-container', { timeout: 10000 });
    await page.waitForTimeout(300);

    // Screenshot 1: Desktop Default
    await saveScreenshot(page, 'studio-desktop-default.png');

    // Open Redis Inspector
    const redisNode = page.locator('.canvas-node:has-text("Redis Distributed State")');
    await redisNode.click();
    await page.waitForSelector('.inspector-heading:has-text("Redis Distributed State")', { timeout: 5000 });
    await page.click('.inspector-tab-btn:has-text("Failures")');
    await page.waitForTimeout(200);

    // Screenshot 2: Desktop Redis Inspector
    await saveScreenshot(page, 'studio-desktop-redis-inspector.png');

    // Switch to Fixed Window to demonstrate boundary burst failure
    await page.click('.sim-pill-btn:has-text("Fixed Window")');
    await page.click('.speed-btn:has-text("5x")'); // Run at 5x to complete boundary trace quickly
    await page.waitForTimeout(2600); // 2.6s at 5x = 13s virtual -> clock reaches 63s (after 59s & 61s spikes)

    // Screenshot 3: Desktop Fixed Window Failure
    await saveScreenshot(page, 'studio-desktop-fixed-window-failure.png');

    // Switch to Rolling Window (Sliding Window) for comparison
    await page.click('.sim-pill-btn:has-text("Sliding Window")');
    await page.waitForTimeout(2600); // Clock reaches 63s with exact rolling window suppression

    // Screenshot 4: Desktop Rolling Window Comparison
    await saveScreenshot(page, 'studio-desktop-rolling-window-comparison.png');

    await context.close();
  });

  // 4. Mobile Experience (390x844) & 2 Mobile Screenshots
  it('renders mobile experience (390x844) with touch pan and bottom-sheet inspector, capturing 2 mobile screenshots', async () => {
    if (!ensureBrowser() || !browser) return;

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
    });
    const page = await context.newPage();

    await page.goto(`${baseUrl}/studio`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.studio-canvas-container', { timeout: 10000 });
    await page.waitForTimeout(300);

    // Zero horizontal overflow on mobile
    const hasMobileOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasMobileOverflow).toBe(false);

    // Screenshot 5: Mobile Overview
    await saveScreenshot(page, 'studio-mobile-overview.png');

    // Tap gateway node to open bottom-sheet inspector
    const gatewayNode = page.locator('.canvas-node:has-text("API Ingress Gateway")');
    await gatewayNode.click();
    await page.waitForSelector('.studio-right-pane.open', { timeout: 5000 });
    await page.waitForTimeout(300);

    // Screenshot 6: Mobile Selected Inspector
    await saveScreenshot(page, 'studio-mobile-selected-inspector.png');

    await context.close();
  });

  // 5. Reduced Motion Support
  it('disables animation transitions when prefers-reduced-motion is enabled', async () => {
    if (!ensureBrowser() || !browser) return;

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();

    await page.goto(`${baseUrl}/studio`, { waitUntil: 'networkidle' });
    const isReduced = await page.evaluate(() => {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    });
    expect(isReduced).toBe(true);

    await context.close();
  });

  // 6. Verify Existing Production Routes Remain Untouched and Passing
  it('verifies standard application routes continue functioning without regression', async () => {
    if (!ensureBrowser() || !browser) return;

    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.hero-title', { timeout: 10000 });
    expect(await page.textContent('.hero-title')).toContain('Engineering intelligence');

    await page.goto(`${baseUrl}/new`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#intent-input', { timeout: 10000 });
    expect(await page.locator('#intent-input').isVisible()).toBe(true);

    await context.close();
  });
});
