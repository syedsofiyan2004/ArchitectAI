import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { RepairTask } from '@architectai/domain';
import { RepairPolicyValidator } from './services/repair-policy-validator.js';

const execFileAsync = promisify(execFile);

describe('RepairPolicyValidator (Anti-Test-Gaming Rules)', () => {
  let tempRepo: string;
  let validator: RepairPolicyValidator;
  let baseTask: RepairTask;

  beforeEach(async () => {
    tempRepo = path.join(os.tmpdir(), `test-repair-policy-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
    fs.mkdirSync(tempRepo, { recursive: true });

    // Initialize git repo
    await execFileAsync('git', ['-C', tempRepo, 'init', '-b', 'main']);
    await execFileAsync('git', ['-C', tempRepo, 'config', 'user.name', 'Test']);
    await execFileAsync('git', ['-C', tempRepo, 'config', 'user.email', 'test@example.com']);

    // Create baseline files
    fs.mkdirSync(path.join(tempRepo, 'src'), { recursive: true });
    fs.mkdirSync(path.join(tempRepo, 'tests'), { recursive: true });

    fs.writeFileSync(
      path.join(tempRepo, 'package.json'),
      JSON.stringify(
        {
          name: 'sample-project',
          scripts: { test: 'vitest run' },
        },
        null,
        2
      )
    );

    fs.writeFileSync(path.join(tempRepo, 'src', 'rate-limiter.ts'), 'export const limit = 5;\n');
    fs.writeFileSync(
      path.join(tempRepo, 'tests', 'limiter.test.ts'),
      'import { limit } from "../src/rate-limiter";\n' +
      'describe("Limiter", () => {\n' +
      '  it("checks limit", () => {\n' +
      '    expect(limit).toBe(5);\n' +
      '  });\n' +
      '});\n'
    );

    await execFileAsync('git', ['-C', tempRepo, 'add', '-A']);
    await execFileAsync('git', ['-C', tempRepo, 'commit', '-m', 'Initial baseline']);

    validator = new RepairPolicyValidator();
    baseTask = {
      id: 'repair-task-1',
      objective: 'Fix rate limiter rolling window',
      targetInvariantIds: ['inv-rate-5'],
      targetVerificationCaseIds: ['case-1'],
      evidenceReferences: ['ev-1'],
      likelyFiles: ['src/rate-limiter.ts'],
      allowedFiles: ['src/**'],
      excludedFiles: ['tests/**', 'package.json', '.github/**'],
      repairRequirements: ['Preserve rolling window limit'],
      acceptanceCriteria: ['Limit holds'],
      dependencies: [],
      riskLevel: 'medium',
      maxScope: 'Fix src without touching tests or CI',
      status: 'in_progress',
    };
  });

  afterEach(() => {
    try {
      fs.rmSync(tempRepo, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  });

  it('approves legitimate production code changes within allowed scope', async () => {
    const { stdout: headOut } = await execFileAsync('git', ['-C', tempRepo, 'rev-parse', 'HEAD']);
    const checkpointRef = headOut.trim();

    // Modify allowed production file
    fs.writeFileSync(
      path.join(tempRepo, 'src', 'rate-limiter.ts'),
      'export const limit = 5;\nexport const windowMs = 60000;\n'
    );

    const result = await validator.validateAttempt(tempRepo, baseTask, checkpointRef);
    expect(result.passed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('rejects attempt that deletes existing test files', async () => {
    const { stdout: headOut } = await execFileAsync('git', ['-C', tempRepo, 'rev-parse', 'HEAD']);
    const checkpointRef = headOut.trim();

    // Delete existing test file
    fs.unlinkSync(path.join(tempRepo, 'tests', 'limiter.test.ts'));

    const result = await validator.validateAttempt(tempRepo, baseTask, checkpointRef);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.includes('deleted existing test file'))).toBe(true);
  });

  it('rejects attempt that weakens package.json test scripts with exit 0', async () => {
    const { stdout: headOut } = await execFileAsync('git', ['-C', tempRepo, 'rev-parse', 'HEAD']);
    const checkpointRef = headOut.trim();

    // Tamper with package.json
    fs.writeFileSync(
      path.join(tempRepo, 'package.json'),
      JSON.stringify(
        {
          name: 'sample-project',
          scripts: { test: 'exit 0' },
        },
        null,
        2
      )
    );

    const result = await validator.validateAttempt(tempRepo, baseTask, checkpointRef);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.includes('package.json test scripts'))).toBe(true);
  });

  it('rejects attempt that comments out or weakens test assertions', async () => {
    const { stdout: headOut } = await execFileAsync('git', ['-C', tempRepo, 'rev-parse', 'HEAD']);
    const checkpointRef = headOut.trim();

    // Comment out expect in test file
    fs.writeFileSync(
      path.join(tempRepo, 'tests', 'limiter.test.ts'),
      'import { limit } from "../src/rate-limiter";\n' +
      'describe("Limiter", () => {\n' +
      '  it("checks limit", () => {\n' +
      '    // expect(limit).toBe(5);\n' +
      '  });\n' +
      '});\n'
    );

    const result = await validator.validateAttempt(tempRepo, baseTask, checkpointRef);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.includes('weakened test assertions') || v.includes('excluded file'))).toBe(true);
  });

  it('rejects attempt that modifies protected CI configuration', async () => {
    const { stdout: headOut } = await execFileAsync('git', ['-C', tempRepo, 'rev-parse', 'HEAD']);
    const checkpointRef = headOut.trim();

    // Create unauthorized CI file
    const ciDir = path.join(tempRepo, '.github', 'workflows');
    fs.mkdirSync(ciDir, { recursive: true });
    fs.writeFileSync(path.join(ciDir, 'ci.yml'), '# hacked ci\n');

    const result = await validator.validateAttempt(tempRepo, baseTask, checkpointRef);
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.includes('protected system/CI file'))).toBe(true);
  });
});
