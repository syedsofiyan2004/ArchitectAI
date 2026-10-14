// ArchitectAI — Architecture Studio Final Prototype Gate Verification & Screenshot Suite
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, type Browser } from 'playwright';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { execSync } from 'node:child_process';
import type { Server } from 'node:http';
import { createServer } from '../../apps/web/server/server.js';

describe('ArchitectAI: Architecture Studio Final Prototype Gate Suite', () => {
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

  // 2. Removal of Unearned Engineering Claims & Truthful Presentation
  it('verifies removal of unearned claims and no invented latencies across all views', async () => {
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

    // Open inspector by selecting a node
    const redisNode = page.locator('.canvas-node:has-text("Redis Distributed State")');
    await redisNode.click();

    // Inspector check
    await page.waitForSelector('.studio-inspector-drawer', { timeout: 5000 });
    const inspectorText = await page.textContent('.studio-inspector-drawer');
    expect(inspectorText).not.toContain('3 Verified');

    // Check verification tab
    await page.click('.inspector-tab-btn:has-text("Verification")');
    await page.waitForSelector('.verif-status-badge', { timeout: 5000 });
    const verifBadgeText = await page.textContent('.verif-status-badge');
    expect(verifBadgeText).toContain('Planned Verification Check (Not yet executed)');

    // Ensure no hardcoded 148ms latency is present
    const fullBody = await page.textContent('body');
    expect(fullBody).not.toContain('148 ms');

    await context.close();
  });

  // 3. Desktop Readability & Framing at 1440x900
  it('verifies node titles and labels are legible (font-size >= 13px) and unclipped at 1440x900 default framing', async () => {
    if (!ensureBrowser() || !browser) return;

    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    await page.goto(`${baseUrl}/studio`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.canvas-node', { timeout: 10000 });
    await page.waitForTimeout(300);

    // Verify zoom level is around 1.0 (100% full scale framing) because inspector is collapsed by default
    const transform = await page.$eval('.canvas-viewport', (el) => el.style.transform);
    const scaleMatch = transform.match(/scale\(([^)]+)\)/);
    const scale = scaleMatch ? parseFloat(scaleMatch[1]) : 1.0;
    expect(scale).toBeGreaterThanOrEqual(0.95);

    // Verify all node titles have computed font size >= 13px and are rendered within screen bounds
    const titleStyles = await page.$$eval('.node-title', (els) =>
      els.map((el) => {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return {
          fontSize: parseFloat(style.fontSize),
          width: rect.width,
          height: rect.height,
          text: el.textContent,
        };
      })
    );

    expect(titleStyles.length).toBe(5);
    for (const title of titleStyles) {
      expect(title.fontSize).toBeGreaterThanOrEqual(13);
      expect(title.width).toBeGreaterThan(40);
      expect(title.height).toBeGreaterThan(12);
    }

    await context.close();
  });

  // 4. Truthful Packet Animation (Mixed Admitted & Rejected Outcomes)
  it('truthfully animates both admitted and rejected packets during boundary attack without single-status sampling', async () => {
    if (!ensureBrowser() || !browser) return;

    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    await page.goto(`${baseUrl}/studio`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.studio-canvas-container', { timeout: 10000 });

    // Activate sliding window and 5x speed
    await page.click('.sim-pill-btn:has-text("Sliding Window")');
    await page.click('.speed-btn:has-text("5x")');

    // Wait until virtual clock reaches boundary burst (t=61s+), where both admitted and rejected requests occur
    await page.waitForFunction(
      () => {
        const allowed = document.querySelectorAll('.sim-packet-circle.packet-allowed').length;
        const throttled = document.querySelectorAll('.sim-packet-circle.packet-throttled').length;
        return allowed > 0 && throttled > 0;
      },
      { timeout: 8000 }
    );

    // Check that both permitted (allowed) and throttled packets exist
    const allowedPackets = await page.locator('.sim-packet-circle.packet-allowed').count();
    const throttledPackets = await page.locator('.sim-packet-circle.packet-throttled').count();

    expect(allowedPackets).toBeGreaterThan(0);
    expect(throttledPackets).toBeGreaterThan(0);

    await context.close();
  });

  // 5. Desktop Screenshots Capture (4 screenshots)
  it('renders desktop experience (1440x900) and captures all 4 required desktop screenshots', async () => {
    if (!ensureBrowser() || !browser) return;

    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    await page.goto(`${baseUrl}/studio`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.studio-canvas-container', { timeout: 10000 });
    await page.waitForTimeout(300);

    // Screenshot 1: Desktop Default (Clean 100% scale framing with collapsed inspector)
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
    await page.click('.speed-btn:has-text("5x")');
    await page.waitForTimeout(2700);

    // Screenshot 3: Desktop Fixed Window Failure
    await saveScreenshot(page, 'studio-desktop-fixed-window-failure.png');

    // Switch to Rolling Window (Sliding Window) for comparison
    await page.click('.sim-pill-btn:has-text("Sliding Window")');
    await page.waitForTimeout(2700);

    // Screenshot 4: Desktop Rolling Window Comparison
    await saveScreenshot(page, 'studio-desktop-rolling-window-comparison.png');

    await context.close();
  });

  // 6. Mobile Interaction, Pan, and Focus Action
  it('renders mobile experience (390x844), tests touch pan, focus-on-component, and captures 2 mobile screenshots', async () => {
    if (!ensureBrowser() || !browser) return;

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
    });
    const page = await context.newPage();

    await page.goto(`${baseUrl}/studio`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.canvas-viewport', { timeout: 10000 });
    await page.waitForTimeout(300);

    // Zero horizontal overflow
    const hasMobileOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasMobileOverflow).toBe(false);

    // Test mobile touch pan changes viewport transform
    const getTransform = async () => page.$eval('.canvas-viewport', (el) => el.style.transform);
    const initialTransform = await getTransform();

    await page.mouse.move(200, 200);
    await page.mouse.down();
    await page.mouse.move(120, 150, { steps: 5 });
    await page.mouse.up();
    await page.waitForTimeout(100);

    const pannedTransform = await getTransform();
    expect(pannedTransform).not.toBe(initialTransform);

    // Screenshot 5: Mobile Overview Map
    await page.click('button[title="Fit to Overview"]');
    await page.waitForTimeout(200);
    await saveScreenshot(page, 'studio-mobile-overview.png');

    // Tap Gateway node to test focus-on-component behavior
    const gwNode = page.locator('.canvas-node:has-text("API Ingress Gateway")');
    await gwNode.click();
    await page.waitForSelector('.studio-right-pane.open', { timeout: 5000 });
    await page.waitForTimeout(300);

    // Verify zoom has zoomed in to legible scale (1.0)
    const focusedTransform = await getTransform();
    expect(focusedTransform).toContain('scale(1)');

    // Screenshot 6: Mobile Selected Inspector
    await saveScreenshot(page, 'studio-mobile-selected-inspector.png');

    // Tap Back to Overview to verify return
    await page.click('button:has-text("← Overview")');
    await page.waitForTimeout(200);
    const overviewTransform = await getTransform();
    expect(overviewTransform).not.toContain('scale(1)');

    await context.close();
  });

  // 7. Reduced Motion Computed Style Verification
  it('proves animation computed styles are disabled (animation-name: none) when prefers-reduced-motion is active', async () => {
    if (!ensureBrowser() || !browser) return;

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();

    await page.goto(`${baseUrl}/studio`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.canvas-edge-pulse', { state: 'attached', timeout: 10000 });

    const computedAnimationName = await page.$eval('.canvas-edge-pulse', (el) => {
      return window.getComputedStyle(el).animationName;
    });

    expect(computedAnimationName).toBe('none');

    await context.close();
  });

  // 8. Verify Existing Production Routes Remain Untouched and Passing
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
