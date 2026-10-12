/**
 * Codex Safe-Mode Product Orchestrator Smoke Runner
 * Re-exports the full product orchestrator runner from @architectai/application.
 */
export * from '../../../application/src/codex-smoke.js';

if (process.argv[1]?.endsWith('codex-smoke.ts')) {
  import('../../../application/src/codex-smoke.js').then((m) => {
    m.runCodexSmoke()
      .then((report) => {
        console.log(`[Codex Smoke] Finished with status: ${report.executionStatus}`);
        process.exit(report.executionStatus === 'FAILED' ? 1 : 0);
      })
      .catch((err) => {
        console.error('[Codex Smoke] Unhandled error:', err);
        process.exit(1);
      });
  });
}
