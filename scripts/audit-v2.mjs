import { chromium } from 'playwright';
import * as path from 'node:path';
import * as fs from 'node:fs';

const BASE_URL = 'http://localhost:3001';
const V2_DIR = path.resolve('artifacts/ui-review/v2');

async function main() {
  fs.mkdirSync(V2_DIR, { recursive: true });
  const browser = await chromium.launch();
  const consoleErrors = [];

  console.log('[Audit V2] Starting End-to-End User Journey Audit...');

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push({ text: msg.text() });
    }
  });

  // 1. Home
  console.log('[Audit V2] 1. Visiting Home (/)...\n');
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Assert home elements
  const heroTitle = await page.textContent('.hero-title');
  console.log('[Audit V2] Hero Title:', heroTitle);
  await page.screenshot({ path: path.join(V2_DIR, '01-home.png') });

  // 2. New Analysis
  console.log('[Audit V2] 2. Navigating to New Analysis (/new)...');
  await page.click('text="New Architecture Analysis"');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(V2_DIR, '02-new-analysis.png') });

  // Fill in requirement
  const textarea = await page.$('#intent-input');
  if (!textarea) throw new Error('Textarea not found on /new');
  await textarea.fill('When my access token expires automatically refresh it and retry the failed request.');

  // 3. Analysis Running State
  console.log('[Audit V2] 3. Submitting Analysis & Capturing Running State...');
  // Click analyze
  await page.click('button:has-text("Analyze Architecture")');
  // Wait a brief tick to capture the analyzing state
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(V2_DIR, '03-analysis-running.png') });

  // Wait for results to land on Review screen
  console.log('[Audit V2] Waiting for analysis results to render on review screen...');
  await page.waitForSelector('.review-hero', { timeout: 15000 });
  await page.waitForTimeout(800);

  // 4. Architecture Review
  console.log('[Audit V2] 4. Capturing Architecture Review screen...');
  await page.screenshot({ path: path.join(V2_DIR, '04-architecture-review.png') });

  // 5. Evidence Inspector
  console.log('[Audit V2] 5. Opening Evidence Inspector Drawer...');
  await page.click('button:has-text("[Why ArchitectAI found this]")');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(V2_DIR, '05-evidence-inspector.png') });

  // Close drawer
  console.log('[Audit V2] Closing Evidence Inspector Drawer...');
  await page.click('button[aria-label="Close drawer"]');
  await page.waitForTimeout(400);

  // 6. Architecture Decisions
  console.log('[Audit V2] 6. Continuing to Architecture Decisions...');
  await page.click('button:has-text("Continue to Architecture")');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(V2_DIR, '06-architecture-decision.png') });

  // 7. Verification Plan
  console.log('[Audit V2] 7. Continuing to Verification Plan...');
  await page.click('button:has-text("Continue to Verification")');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(V2_DIR, '07-verification.png') });

  // 8. Implementation Workspace
  console.log('[Audit V2] 8. Continuing to Implementation Workspace...');
  await page.click('button:has-text("Prepare Implementation")');
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(V2_DIR, '08-implementation.png') });

  // 9. Mobile Architecture Review
  console.log('[Audit V2] 9. Capturing Mobile Review at 390x844...');
  const currentUrl = page.url();
  const runReviewUrl = currentUrl.replace(/\/implementation$/, '');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(runReviewUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  const overflow = await page.evaluate(() => {
    const el = document.documentElement;
    return {
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      hasOverflow: el.scrollWidth > el.clientWidth,
    };
  });
  console.log(`[Audit V2] Mobile 390x844 overflow: scrollWidth=${overflow.scrollWidth}, clientWidth=${overflow.clientWidth}`);

  await page.screenshot({ path: path.join(V2_DIR, '09-mobile-architecture-review.png') });
  await page.close();
  await browser.close();

  console.log('\n================ AUDIT V2 SUMMARY ================');
  console.log(`Console Errors detected: ${consoleErrors.length}`);
  for (const err of consoleErrors) {
    console.log(`  - ${err.text}`);
  }
  console.log(`Mobile Horizontal Overflow: ${overflow.hasOverflow ? 'FAILED' : 'PASSED (0 overflow)'}`);
  console.log(`Screenshots saved to: ${V2_DIR}`);
  console.log('===================================================\n');

  if (consoleErrors.length > 0 || overflow.hasOverflow) {
    throw new Error('Audit V2 encountered issues!');
  }
}

main().catch((err) => {
  console.error('[Audit V2 Error]', err);
  process.exit(1);
});
