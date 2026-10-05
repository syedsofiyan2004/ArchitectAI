import { chromium } from 'playwright';
import * as path from 'node:path';
import * as fs from 'node:fs';

const BASE_URL = 'http://localhost:3001';
const BEFORE_DIR = path.resolve('artifacts/ui-review/before');

async function main() {
  fs.mkdirSync(BEFORE_DIR, { recursive: true });
  const browser = await chromium.launch();
  const consoleErrors = [];
  const overflowIssues = [];

  const viewports = [
    { name: '1920x1080', width: 1920, height: 1080 },
    { name: '1440x900', width: 1440, height: 900 },
    { name: '1280x800', width: 1280, height: 800 },
    { name: '1024x768', width: 1024, height: 768 },
    { name: '390x844', width: 390, height: 844 },
  ];

  console.log('[Audit] Starting Baseline UI Inspection across 5 viewports...');

  // 1. Inspect Viewports & Responsive Overflow
  for (const vp of viewports) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ viewport: vp.name, text: msg.text() });
      }
    });

    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const overflow = await page.evaluate(() => {
      const el = document.documentElement;
      return {
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        hasOverflow: el.scrollWidth > el.clientWidth,
      };
    });

    if (overflow.hasOverflow) {
      overflowIssues.push({
        viewport: vp.name,
        scrollWidth: overflow.scrollWidth,
        clientWidth: overflow.clientWidth,
      });
      console.log(`[Audit] ⚠️ Horizontal overflow detected at ${vp.name}: scrollWidth=${overflow.scrollWidth} > clientWidth=${overflow.clientWidth}`);
    } else {
      console.log(`[Audit] ✓ No horizontal overflow at ${vp.name}`);
    }

    await page.screenshot({ path: path.join(BEFORE_DIR, `01-initial-viewport-${vp.name}.png`), fullPage: false });
    await page.close();
  }

  // 2. Deep View-by-View Inspection at 1920x1080 Desktop
  console.log('[Audit] Deep View-by-View Inspection at 1920x1080...');
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push({ view: 'deep-inspection', text: msg.text() });
    }
  });

  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Initial Overview screen
  await page.screenshot({ path: path.join(BEFORE_DIR, `02-initial-overview.png`), fullPage: false });

  // Test Analyze Interaction (Demo B)
  console.log('[Audit] Testing Analyze Architecture interaction with Demo B...');
  const demoBBtn = await page.$('text="DEMO B"');
  if (demoBBtn) {
    await demoBBtn.click();
    await page.waitForTimeout(500);
  }

  const analyzeBtn = await page.$('text="Analyze Architecture"');
  if (analyzeBtn) {
    await analyzeBtn.click();
    // Wait for analyze response and render
    await page.waitForTimeout(2000);
  }

  await page.screenshot({ path: path.join(BEFORE_DIR, `03-analyzed-overview.png`), fullPage: false });

  // Inspect each tab:
  const tabs = [
    { name: 'unknowns', label: 'Unknown-Unknowns', file: '04-view-unknown-unknowns.png' },
    { name: 'knowledge', label: '3-Level Knowledge', file: '05-view-3level-knowledge.png' },
    { name: 'decisions', label: 'Architecture Decisions', file: '06-view-architecture-decisions.png' },
    { name: 'verification', label: 'Verification Plan', file: '07-view-verification-plan.png' },
    { name: 'implementation', label: 'Implementation', file: '08-view-implementation.png' },
    { name: 'contract', label: 'Engineering Contract (JSON)', file: '09-view-contract-json.png' },
  ];

  for (const tab of tabs) {
    const tabEl = await page.$(`button:has-text("${tab.label}")`);
    if (tabEl) {
      await tabEl.click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(BEFORE_DIR, tab.file), fullPage: false });
      console.log(`[Audit] Captured view: ${tab.label}`);
    } else {
      console.log(`[Audit] ⚠️ Could not find tab for ${tab.label}`);
    }
  }

  // Also capture mobile layout of findings and implementation at 390x844
  console.log('[Audit] Capturing Mobile views at 390x844...');
  const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobilePage.goto(BASE_URL, { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(1500);
  await mobilePage.screenshot({ path: path.join(BEFORE_DIR, '10-mobile-overview-390x844.png') });

  const mobileUnknowns = await mobilePage.$('button:has-text("Unknown-Unknowns")');
  if (mobileUnknowns) {
    await mobileUnknowns.click();
    await mobilePage.waitForTimeout(600);
    await mobilePage.screenshot({ path: path.join(BEFORE_DIR, '11-mobile-unknowns-390x844.png') });
  }

  const mobileImpl = await mobilePage.$('button:has-text("Implementation")');
  if (mobileImpl) {
    await mobileImpl.click();
    await mobilePage.waitForTimeout(600);
    await mobilePage.screenshot({ path: path.join(BEFORE_DIR, '12-mobile-implementation-390x844.png') });
  }

  await mobilePage.close();
  await page.close();
  await browser.close();

  console.log('\n================ AUDIT SUMMARY ================');
  console.log(`Console Errors detected: ${consoleErrors.length}`);
  for (const err of consoleErrors) {
    console.log(`  - [${err.viewport || err.view}] ${err.text}`);
  }
  console.log(`Horizontal Overflow Issues: ${overflowIssues.length}`);
  for (const o of overflowIssues) {
    console.log(`  - ${o.viewport}: scrollWidth=${o.scrollWidth} > clientWidth=${o.clientWidth}`);
  }
  console.log(`Screenshots saved to: ${BEFORE_DIR}`);
  console.log('================================================\n');
}

main().catch((err) => {
  console.error('[Audit Error]', err);
  process.exit(1);
});
