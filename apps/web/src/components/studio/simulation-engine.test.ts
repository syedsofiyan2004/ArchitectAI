// Unit tests proving exact mathematical correctness of SimulationEngine
import { describe, it, expect } from 'vitest';
import { SimulationEngine } from './simulation-engine';

describe('SimulationEngine: Deterministic Rate Limiting Mathematics', () => {
  it('proves canonical boundary test: Fixed Window admits 160 / rejects 0 (160% overload)', () => {
    const engine = new SimulationEngine('FIXED_WINDOW', 'BOUNDARY_SPIKE');
    expect(engine.getVirtualTimeMs()).toBe(50_000);

    // Fast-forward past both spikes (through t = 62.0s = 62,000ms)
    engine.advanceTo(62_000);

    const metrics = engine.getMetrics();
    expect(metrics.totalRequests).toBe(160);
    expect(metrics.allowedRequests).toBe(160);
    expect(metrics.throttledRequests).toBe(0);
    expect(metrics.acceptedInLast60s).toBe(160);
    expect(metrics.downstreamLoadPct).toBe(160);
    expect(metrics.isOverloaded).toBe(true);
    expect(metrics.explanation).toContain('CRITICAL BOUNDARY DEFECT');
  });

  it('proves canonical boundary test: Exact Rolling Window admits 100 / rejects 60 (100% load, protected)', () => {
    const engine = new SimulationEngine('ROLLING_WINDOW', 'BOUNDARY_SPIKE');
    expect(engine.getVirtualTimeMs()).toBe(50_000);

    // Advance to t = 60s (after first spike of 80 requests)
    engine.advanceTo(60_000);
    let metrics = engine.getMetrics();
    expect(metrics.totalRequests).toBe(80);
    expect(metrics.allowedRequests).toBe(80);
    expect(metrics.throttledRequests).toBe(0);
    expect(metrics.downstreamLoadPct).toBe(80);
    expect(metrics.isOverloaded).toBe(false);

    // Advance to t = 62s (after second spike of 80 requests at t = 61s)
    engine.advanceTo(62_000);
    metrics = engine.getMetrics();
    expect(metrics.totalRequests).toBe(160);
    expect(metrics.allowedRequests).toBe(100); // 80 from spike 1 + 20 from spike 2
    expect(metrics.throttledRequests).toBe(60); // 60 rejected with 429
    expect(metrics.acceptedInLast60s).toBe(100);
    expect(metrics.downstreamLoadPct).toBe(100); // strictly capped at 100%
    expect(metrics.isOverloaded).toBe(false);
    expect(metrics.explanation).toContain('SLIDING WINDOW ENFORCED');
  });

  it('proves reset behavior restores initial clock and re-runs identical trace', () => {
    const engine = new SimulationEngine('ROLLING_WINDOW', 'BOUNDARY_SPIKE');
    engine.advanceTo(62_000);
    expect(engine.getMetrics().totalRequests).toBe(160);

    // Reset
    engine.reset();
    expect(engine.getVirtualTimeMs()).toBe(50_000);
    expect(engine.getMetrics().totalRequests).toBe(0);
    expect(engine.getMetrics().allowedRequests).toBe(0);
    expect(engine.getMetrics().throttledRequests).toBe(0);

    // Replay gives identical numbers
    engine.advanceTo(62_000);
    expect(engine.getMetrics().allowedRequests).toBe(100);
    expect(engine.getMetrics().throttledRequests).toBe(60);
  });

  it('proves clock consistency: granular step ticks equal single macro jump', () => {
    const engineStepped = new SimulationEngine('FIXED_WINDOW', 'BOUNDARY_SPIKE');
    const engineJump = new SimulationEngine('FIXED_WINDOW', 'BOUNDARY_SPIKE');

    // Stepped by 100ms ticks (120 ticks from 50s to 62s)
    for (let i = 0; i < 120; i++) {
      engineStepped.advanceBy(100);
    }

    // Macro jump from 50s to 62s
    engineJump.advanceTo(62_000);

    const m1 = engineStepped.getMetrics();
    const m2 = engineJump.getMetrics();

    expect(m1.virtualTimeMs).toBe(m2.virtualTimeMs);
    expect(m1.totalRequests).toBe(m2.totalRequests);
    expect(m1.allowedRequests).toBe(m2.allowedRequests);
    expect(m1.throttledRequests).toBe(m2.throttledRequests);
    expect(m1.downstreamLoadPct).toBe(m2.downstreamLoadPct);
  });

  it('proves burst attack scenario: rolling window caps 150 requests to 100 admitted / 50 rejected', () => {
    const engine = new SimulationEngine('ROLLING_WINDOW', 'BURST_ATTACK');
    engine.advanceTo(15_000);

    const metrics = engine.getMetrics();
    expect(metrics.totalRequests).toBe(150);
    expect(metrics.allowedRequests).toBe(100);
    expect(metrics.throttledRequests).toBe(50);
    expect(metrics.downstreamLoadPct).toBe(100);
  });
});
