import { describe, it, expect } from 'vitest';
import * as os from 'node:os';
import {
  VerificationPlan,
  VerificationCase,
  VerificationCaseResult,
} from '@architectai/domain';
import {
  VerdictEvaluator,
  AssertionEvaluator,
  LocalProcessSandbox,
  VerificationExecutorRegistry,
} from './index.js';

describe('Independent Verification Engine', () => {
  describe('VerdictEvaluator', () => {
    const evaluator = new VerdictEvaluator();

    const basePlan: VerificationPlan = {
      id: 'plan-test-01',
      contractId: 'contract-01',
      implementationRunId: 'run-01',
      repositoryPath: '/mock/repo',
      baseHead: 'head-01',
      cases: [],
      createdAt: new Date().toISOString(),
    };

    it('declares VERIFIED only when all blocking invariants pass', () => {
      const caseResults: VerificationCaseResult[] = [
        {
          caseId: 'case-01',
          targetInvariantId: 'inv-01',
          verdict: 'PASS',
          isBlocking: true,
          passed: true,
          summary: 'Boundary burst limit held',
          assertions: [{ name: 'requests', expected: 5, observed: 5, passed: true }],
          evidence: [],
          durationMs: 50,
        },
        {
          caseId: 'case-02',
          targetInvariantId: 'inv-02',
          verdict: 'PASS',
          isBlocking: true,
          passed: true,
          summary: 'Idempotency key locked',
          assertions: [{ name: 'charges', expected: 1, observed: 1, passed: true }],
          evidence: [],
          durationMs: 40,
        },
      ];

      const result = evaluator.evaluateRun(basePlan, caseResults, 90);
      expect(result.overallStatus).toBe('VERIFIED');
      expect(result.isVerified).toBe(true);
      expect(result.passedCases).toBe(2);
      expect(result.failedCases).toBe(0);
    });

    it('strictly fails overall run when any blocking invariant fails', () => {
      const caseResults: VerificationCaseResult[] = [
        {
          caseId: 'case-01',
          targetInvariantId: 'inv-01',
          verdict: 'PASS',
          isBlocking: true,
          passed: true,
          summary: 'Native test passed',
          assertions: [],
          evidence: [],
          durationMs: 50,
        },
        {
          caseId: 'case-02',
          targetInvariantId: 'inv-02',
          verdict: 'FAIL',
          isBlocking: true,
          passed: false,
          summary: 'Rolling boundary burst allowed 10 requests',
          assertions: [{ name: 'requests', expected: 5, observed: 10, passed: false }],
          evidence: [],
          durationMs: 40,
        },
      ];

      const result = evaluator.evaluateRun(basePlan, caseResults, 90);
      expect(result.overallStatus).toBe('FAILED');
      expect(result.isVerified).toBe(false);
      expect(result.failedCases).toBe(1);
    });

    it('strictly guarantees INCONCLUSIVE is NEVER PASS', () => {
      const caseResults: VerificationCaseResult[] = [
        {
          caseId: 'case-01',
          targetInvariantId: 'inv-01',
          verdict: 'PASS',
          isBlocking: true,
          passed: true,
          summary: 'Invariant 1 held',
          assertions: [],
          evidence: [],
          durationMs: 50,
        },
        {
          caseId: 'case-02',
          targetInvariantId: 'inv-02',
          verdict: 'INCONCLUSIVE',
          isBlocking: true,
          passed: false,
          summary: 'Missing instrumentation',
          assertions: [],
          evidence: [],
          durationMs: 10,
        },
      ];

      const result = evaluator.evaluateRun(basePlan, caseResults, 60);
      expect(result.overallStatus).toBe('INCONCLUSIVE');
      expect(result.isVerified).toBe(false);
    });

    it('reports ERROR when verifier infrastructure crashes on blocking invariant', () => {
      const caseResults: VerificationCaseResult[] = [
        {
          caseId: 'case-01',
          targetInvariantId: 'inv-01',
          verdict: 'ERROR',
          isBlocking: true,
          passed: false,
          summary: 'Executor crash',
          assertions: [],
          evidence: [],
          durationMs: 10,
        },
      ];

      const result = evaluator.evaluateRun(basePlan, caseResults, 10);
      expect(result.overallStatus).toBe('ERROR');
      expect(result.isVerified).toBe(false);
    });
  });

  describe('AssertionEvaluator', () => {
    const evaluator = new AssertionEvaluator();

    it('evaluates lte, gte, eq, and contains operators deterministically', () => {
      expect(
        evaluator.evaluateAssertion(
          { id: '1', name: 'quota', description: 'desc', operator: 'lte', expected: 5 },
          5
        ).passed
      ).toBe(true);

      expect(
        evaluator.evaluateAssertion(
          { id: '2', name: 'quota', description: 'desc', operator: 'lte', expected: 5 },
          6
        ).passed
      ).toBe(false);

      expect(
        evaluator.evaluateAssertion(
          { id: '3', name: 'status', description: 'desc', operator: 'eq', expected: 'active' },
          'active'
        ).passed
      ).toBe(true);

      expect(
        evaluator.evaluateAssertion(
          { id: '4', name: 'log', description: 'desc', operator: 'contains', expected: 'idempotent' },
          'transaction was idempotent'
        ).passed
      ).toBe(true);
    });
  });

  describe('LocalProcessSandbox', () => {
    const sandbox = new LocalProcessSandbox();

    it('strips sensitive environment variables from child process', async () => {
      process.env['ARCHITECTAI_API_KEY'] = 'secret-ai-token';
      process.env['GITHUB_TOKEN'] = 'secret-gh-token';

      const script = `
        const found = [process.env.ARCHITECTAI_API_KEY, process.env.GITHUB_TOKEN].filter(Boolean);
        console.log(JSON.stringify({ leaked: found }));
      `;

      const result = await sandbox.executeCommand('node', ['-e', script], {
        cwd: os.tmpdir(),
        timeoutMs: 5000,
      });

      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout.trim());
      expect(parsed.leaked).toEqual([]);
    });

    it('enforces hard process timeouts', async () => {
      const script = `setTimeout(() => {}, 10000);`;
      const result = await sandbox.executeCommand('node', ['-e', script], {
        cwd: os.tmpdir(),
        timeoutMs: 500, // 500ms hard timeout
      });

      expect(result.timedOut).toBe(true);
    });
  });

  describe('ExecutorRegistry', () => {
    it('returns INCONCLUSIVE for unsupported strategies', async () => {
      const registry = new VerificationExecutorRegistry();
      const mockWorkspace = {
        repositoryPath: '/mock',
        worktreePath: '/mock/wt',
        tempVerificationDir: '/mock/tmp',
        baseHead: 'head',
        branch: 'branch',
      };

      const customCase: VerificationCase = {
        id: 'case-unsupported',
        title: 'Kubernetes Chaos Mesh Injection',
        objective: 'Inject packet loss via k8s daemon',
        failureTarget: 'network-partition',
        strategy: 'external_command', // Not in default Node registry
        targetInvariantId: 'inv-network',
        sourceConcernIds: [],
        sourceDecisionIds: [],
        preconditions: '',
        stimulus: '',
        expectedProperty: 'Packets dropped gracefully',
        assertions: [
          {
            id: 'a1',
            name: 'graceful_drop',
            description: 'Packets dropped',
            operator: 'eq',
            expected: true,
          },
        ],
        evidenceRequirements: [],
        timeoutMs: 5000,
        isAutomatable: true,
      };

      const result = await registry.executeCase(mockWorkspace, customCase);
      expect(result.verdict).toBe('INCONCLUSIVE');
      expect(result.passed).toBe(false);
    });
  });
});
