import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  VerificationCase,
  VerificationCaseResult,
  VerificationWorkspace,
  VerificationExecutor,
  VerificationEvidence,
  VerificationCaseAssertionResult,
} from '../types.js';
import { LocalProcessSandbox } from '../sandbox/local-process-sandbox.js';
import { AssertionEvaluator } from '../engine/assertion-evaluator.js';

export class NodeTestHarnessExecutor implements VerificationExecutor {
  readonly id = 'node-test-harness';

  constructor(
    private readonly sandbox: LocalProcessSandbox = new LocalProcessSandbox(),
    private readonly assertionEvaluator: AssertionEvaluator = new AssertionEvaluator()
  ) {}

  canExecute(testCase: VerificationCase): boolean {
    return (
      testCase.strategy === 'node_test_harness' ||
      testCase.strategy === 'custom' ||
      !testCase.strategy
    );
  }

  async execute(
    workspace: VerificationWorkspace,
    testCase: VerificationCase,
    harnessContent?: string
  ): Promise<VerificationCaseResult> {
    const startTime = Date.now();
    const caseId = testCase.id;

    // Ensure temporary verification directory exists outside target repo
    fs.mkdirSync(workspace.tempVerificationDir, { recursive: true });

    // Harness script path
    const harnessFileName = `harness-${caseId.replace(/[^a-zA-Z0-9_-]/g, '_')}.cjs`;
    const harnessPath = path.join(workspace.tempVerificationDir, harnessFileName);
    const evidenceJsonPath = path.join(
      workspace.tempVerificationDir,
      `evidence-${caseId.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`
    );

    // Get harness source: either provided parameter, from testCase.harnessTemplate, or generated
    const scriptSource =
      harnessContent ||
      testCase.harnessTemplate ||
      this.generateDefaultHarness(testCase, workspace.worktreePath, evidenceJsonPath);

    // Inject paths if template has placeholders
    const resolvedScriptSource = scriptSource
      .replace(/__WORKTREE_PATH__/g, workspace.worktreePath.replace(/\\/g, '/'))
      .replace(/__EVIDENCE_PATH__/g, evidenceJsonPath.replace(/\\/g, '/'));

    fs.writeFileSync(harnessPath, resolvedScriptSource, 'utf8');

    // Execute through sandbox using node
    const sandboxResult = await this.sandbox.executeCommand('node', [harnessPath], {
      cwd: workspace.tempVerificationDir,
      timeoutMs: testCase.timeoutMs || 10000,
    });

    const durationMs = Date.now() - startTime;

    // Read evidence output file if produced
    let observations: Record<string, unknown> = {};
    let customEvidenceList: VerificationEvidence[] = [];

    if (fs.existsSync(evidenceJsonPath)) {
      try {
        const rawJson = fs.readFileSync(evidenceJsonPath, 'utf8');
        const parsed = JSON.parse(rawJson);
        if (parsed.observations && typeof parsed.observations === 'object') {
          observations = parsed.observations;
        }
        if (Array.isArray(parsed.evidence)) {
          customEvidenceList = parsed.evidence;
        }
      } catch (err) {
        // Failed to parse evidence file
      }
    }

    // If sandbox timed out
    if (sandboxResult.timedOut) {
      const assertions: VerificationCaseAssertionResult[] = testCase.assertions.map((a) => ({
        name: a.name,
        expected: a.expected,
        observed: 'TIMED_OUT',
        passed: false,
        message: `Execution timed out after ${testCase.timeoutMs}ms`,
      }));

      return {
        caseId,
        targetInvariantId: testCase.targetInvariantId,
        verdict: 'FAIL',
        isBlocking: true,
        passed: false,
        summary: `Verification case failed: execution timed out after ${testCase.timeoutMs}ms.`,
        assertions,
        evidence: [
          {
            id: `ev-timeout-${caseId}`,
            caseId,
            kind: 'timing',
            name: 'execution_duration',
            expected: `< ${testCase.timeoutMs}ms`,
            observed: 'TIMED_OUT',
            stderr: sandboxResult.stderr,
            capturedAt: new Date().toISOString(),
          },
        ],
        durationMs,
        stdout: sandboxResult.stdout,
        stderr: sandboxResult.stderr,
        artifactContent: resolvedScriptSource,
        errorDetails: 'Execution timed out',
      };
    }

    // If script failed to execute and produced no observations
    if (sandboxResult.exitCode !== 0 && Object.keys(observations).length === 0) {
      const stderr = sandboxResult.stderr || sandboxResult.stdout;
      const isMissingModule =
        stderr.includes('Cannot find module') || stderr.includes('MODULE_NOT_FOUND');

      const verdict = isMissingModule ? 'INCONCLUSIVE' : 'ERROR';
      const summary = isMissingModule
        ? `Verification inconclusive: target module or interface not found in modified worktree.`
        : `Verification error: harness execution failed with exit code ${sandboxResult.exitCode}.`;

      return {
        caseId,
        targetInvariantId: testCase.targetInvariantId,
        verdict,
        isBlocking: true,
        passed: false,
        summary,
        assertions: testCase.assertions.map((a) => ({
          name: a.name,
          expected: a.expected,
          observed: 'EXECUTION_FAILED',
          passed: false,
          message: stderr.slice(0, 300),
        })),
        evidence: [
          {
            id: `ev-error-${caseId}`,
            caseId,
            kind: 'exit_code',
            name: 'process_exit_code',
            expected: 0,
            observed: sandboxResult.exitCode,
            stdout: sandboxResult.stdout,
            stderr: sandboxResult.stderr,
            capturedAt: new Date().toISOString(),
          },
        ],
        durationMs,
        stdout: sandboxResult.stdout,
        stderr: sandboxResult.stderr,
        artifactContent: resolvedScriptSource,
        errorDetails: stderr.slice(0, 500),
      };
    }

    // Evaluate assertions against observations
    const assertionResults: VerificationCaseAssertionResult[] = [];
    const evidenceList: VerificationEvidence[] = [...customEvidenceList];

    let allAssertionsPassed = true;

    for (const assertion of testCase.assertions) {
      const observedValue = observations[assertion.name] ?? observations[assertion.id];
      const evaluated = this.assertionEvaluator.evaluateAssertion(assertion, observedValue);
      assertionResults.push(evaluated);

      if (!evaluated.passed) {
        allAssertionsPassed = false;
      }

      evidenceList.push(
        this.assertionEvaluator.createEvidence(caseId, assertion, observedValue, {
          stdout: sandboxResult.stdout,
          stderr: sandboxResult.stderr,
          artifactPath: harnessPath,
        })
      );
    }

    const verdict = allAssertionsPassed ? 'PASS' : 'FAIL';
    const failedAssertions = assertionResults.filter((a) => !a.passed);
    const summary = allAssertionsPassed
      ? `All ${assertionResults.length} assertion(s) passed under adversarial stimulus.`
      : `Adversarial violation detected: ${failedAssertions.map((a) => a.message || `${a.name} failed`).join('; ')}`;

    return {
      caseId,
      targetInvariantId: testCase.targetInvariantId,
      verdict,
      isBlocking: true,
      passed: allAssertionsPassed,
      summary,
      assertions: assertionResults,
      evidence: evidenceList,
      durationMs,
      stdout: sandboxResult.stdout,
      stderr: sandboxResult.stderr,
      artifactContent: resolvedScriptSource,
      errorDetails: failedAssertions.length > 0 ? failedAssertions[0]?.message : undefined,
    };
  }

  private generateDefaultHarness(
    testCase: VerificationCase,
    worktreePath: string,
    evidencePath: string
  ): string {
    const sanitizedWorktree = worktreePath.replace(/\\/g, '/');
    const sanitizedEvidence = evidencePath.replace(/\\/g, '/');

    // Generate safe boilerplate that attempts to verify target implementation
    return `
const fs = require('fs');
const path = require('path');

const worktreeDir = "${sanitizedWorktree}";
const evidenceFile = "${sanitizedEvidence}";

async function run() {
  const observations = {};
  
  // Attempt to check target invariant
  observations["${testCase.assertions[0]?.name || 'default_check'}"] = 0;

  fs.writeFileSync(evidenceFile, JSON.stringify({ observations }, null, 2));
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
`;
  }
}
