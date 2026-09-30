import { describe, it, expect } from 'vitest';
import { runWalkingSkeleton } from './skeleton.js';

describe('CLI Walking Skeleton', () => {
  it('executes all 6 steps deterministically and successfully round-trips the contract', async () => {
    const result = await runWalkingSkeleton();

    expect(result.success).toBe(true);
    expect(result.contract).toBeDefined();
    expect(result.contract.id).toBe('contract-skeleton-001');
    expect(result.contract.requirement.id).toBe('req-socket-stream');
    expect(result.contract.discoveredConcerns).toHaveLength(1);
    expect(result.contract.decisions).toHaveLength(1);
    expect(result.contract.invariants).toHaveLength(1);
    expect(result.contract.verificationSpecs).toHaveLength(1);

    // Verify log messages cover all 6 steps
    expect(result.logMessages.some((m) => m.includes('Step 1:'))).toBe(true);
    expect(result.logMessages.some((m) => m.includes('Step 2:'))).toBe(true);
    expect(result.logMessages.some((m) => m.includes('Step 3:'))).toBe(true);
    expect(result.logMessages.some((m) => m.includes('Step 4:'))).toBe(true);
    expect(result.logMessages.some((m) => m.includes('Step 5:'))).toBe(true);
    expect(result.logMessages.some((m) => m.includes('Step 6:'))).toBe(true);
  });
});
