import * as path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { RepairTask } from '@architectai/domain';

const execFileAsync = promisify(execFile);

export interface RepairPolicyValidationResult {
  passed: boolean;
  violations: string[];
}

/**
 * RepairPolicyValidator enforces the anti-test-gaming constitution:
 * 1. Modifications outside allowed scope or in protected/excluded files are rejected.
 * 2. Deleting existing tests is strictly forbidden.
 * 3. Weakening or bypassing package.json test scripts is rejected.
 * 4. Disabling test assertions or commenting out assertions is rejected.
 * 5. Tampering with verification harnesses or configurations is rejected.
 */
export class RepairPolicyValidator {
  private readonly defaultProtectedPatterns = [
    /^\.github[\\/]/i,
    /^\.gitlab-ci\.yml$/i,
    /^\.architectai[\\/]/i,
    /node_modules[\\/]/i,
  ];

  async validateAttempt(
    worktreePath: string,
    task: RepairTask,
    checkpointRef: string
  ): Promise<RepairPolicyValidationResult> {
    const violations: string[] = [];

    // 1. Gather all changed and untracked files
    const changedFiles = await this.getChangedFiles(worktreePath, checkpointRef);
    const deletedFiles = await this.getDeletedFiles(worktreePath, checkpointRef);

    // 2. Check for deleted test files
    for (const deleted of deletedFiles) {
      if (this.isTestFile(deleted)) {
        violations.push(`Attempt deleted existing test file: ${deleted}`);
      }
    }

    // 3. Check changed files against excluded/protected files
    const allModifiedFiles = new Set([...changedFiles, ...deletedFiles]);
    for (const file of allModifiedFiles) {
      // Check default protected files
      if (this.defaultProtectedPatterns.some((pattern) => pattern.test(file))) {
        violations.push(`Attempt modified protected system/CI file: ${file}`);
      }

      // Check task-specific excluded files
      if (this.isExplicitlyExcluded(file, task.excludedFiles)) {
        violations.push(`Attempt modified excluded file: ${file}`);
      }

      // Check if file is within allowedFiles
      if (task.allowedFiles && task.allowedFiles.length > 0 && !task.allowedFiles.includes('*')) {
        const isAllowed = task.allowedFiles.some((allowedPattern) =>
          this.matchesPattern(file, allowedPattern)
        );
        if (!isAllowed) {
          violations.push(`Attempt modified file outside allowed scope: ${file}`);
        }
      }
    }

    // 4. Check for modified package.json test scripts
    if (changedFiles.includes('package.json')) {
      const packageJsonTampered = await this.checkPackageJsonTampering(
        worktreePath,
        checkpointRef
      );
      if (packageJsonTampered) {
        violations.push(`Attempt modified package.json test scripts to bypass checks`);
      }
    }

    // 5. Check diff for disabled assertions or deleted test cases
    const diff = await this.getDiff(worktreePath, checkpointRef);
    if (this.hasDisabledAssertions(diff)) {
      violations.push(`Attempt disabled or weakened test assertions`);
    }

    return {
      passed: violations.length === 0,
      violations,
    };
  }

  private async getChangedFiles(worktreePath: string, checkpointRef: string): Promise<string[]> {
    try {
      const { stdout: diffNames } = await execFileAsync('git', [
        '-C',
        worktreePath,
        'diff',
        '--name-only',
        checkpointRef,
      ]);
      const { stdout: status } = await execFileAsync('git', [
        '-C',
        worktreePath,
        'status',
        '--porcelain',
      ]);

      const diffFiles = diffNames
        .split(/\r?\n/)
        .map((f) => f.trim().replace(/\\/g, '/'))
        .filter((f) => f.length > 0);

      const untrackedFiles = status
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.startsWith('??'))
        .map((l) => l.slice(3).trim().replace(/\\/g, '/'))
        .filter((f) => f.length > 0);

      return Array.from(new Set([...diffFiles, ...untrackedFiles]));
    } catch {
      return [];
    }
  }

  private async getDeletedFiles(worktreePath: string, checkpointRef: string): Promise<string[]> {
    try {
      const { stdout } = await execFileAsync('git', [
        '-C',
        worktreePath,
        'diff',
        '--diff-filter=D',
        '--name-only',
        checkpointRef,
      ]);
      return stdout
        .split(/\r?\n/)
        .map((f) => f.trim().replace(/\\/g, '/'))
        .filter((f) => f.length > 0);
    } catch {
      return [];
    }
  }

  private async getDiff(worktreePath: string, checkpointRef: string): Promise<string> {
    try {
      const { stdout } = await execFileAsync('git', ['-C', worktreePath, 'diff', checkpointRef]);
      return stdout;
    } catch {
      return '';
    }
  }

  private isTestFile(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, '/');
    return (
      /(^|[\\/])tests?[\\/]/.test(normalized) ||
      /\.(test|spec)\.[a-zA-Z0-9]+$/.test(normalized)
    );
  }

  private isExplicitlyExcluded(filePath: string, excludedPatterns: string[]): boolean {
    return excludedPatterns.some((pattern) => this.matchesPattern(filePath, pattern));
  }

  private matchesPattern(filePath: string, pattern: string): boolean {
    const normalizedFile = filePath.replace(/\\/g, '/').toLowerCase();
    const normalizedPattern = pattern.replace(/\\/g, '/').toLowerCase();

    if (normalizedPattern === '*' || normalizedPattern === '**') return true;

    if (normalizedPattern.endsWith('/**')) {
      const prefix = normalizedPattern.slice(0, -3);
      return normalizedFile === prefix || normalizedFile.startsWith(`${prefix}/`);
    }

    if (normalizedPattern.startsWith('**/')) {
      const suffix = normalizedPattern.slice(3);
      return normalizedFile.endsWith(suffix) || normalizedFile === suffix;
    }

    if (normalizedPattern.includes('*')) {
      const regexStr = normalizedPattern
        .replace(/\./g, '\\.')
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*');
      return new RegExp(`^${regexStr}$`).test(normalizedFile);
    }

    return normalizedFile === normalizedPattern || normalizedFile.startsWith(`${normalizedPattern}/`);
  }

  private async checkPackageJsonTampering(
    worktreePath: string,
    checkpointRef: string
  ): Promise<boolean> {
    try {
      const { stdout: oldPackageStr } = await execFileAsync('git', [
        '-C',
        worktreePath,
        'show',
        `${checkpointRef}:package.json`,
      ]);
      const oldPkg = JSON.parse(oldPackageStr);
      const fs = await import('node:fs');
      const currentPkgPath = path.join(worktreePath, 'package.json');
      if (!fs.existsSync(currentPkgPath)) return true; // deleted package.json is a tampering violation
      const currentPkg = JSON.parse(fs.readFileSync(currentPkgPath, 'utf8'));

      const oldTestScript = oldPkg.scripts?.test;
      const currentTestScript = currentPkg.scripts?.test;

      if (oldTestScript) {
        if (!currentTestScript) return true; // test script removed
        const cleanCurrent = currentTestScript.trim().toLowerCase();
        if (
          cleanCurrent === 'exit 0' ||
          cleanCurrent === 'echo 0' ||
          cleanCurrent === 'true' ||
          cleanCurrent === '' ||
          !cleanCurrent.includes('test') && !cleanCurrent.includes('vitest') && !cleanCurrent.includes('jest') && !cleanCurrent.includes('node')
        ) {
          return true; // replaced with no-op or trivial exit 0
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  private hasDisabledAssertions(diff: string): boolean {
    const lines = diff.split(/\r?\n/);
    let inTestChunk = false;

    for (const line of lines) {
      if (line.startsWith('diff --git')) {
        inTestChunk = this.isTestFile(line);
        continue;
      }

      if (inTestChunk) {
        // Line removed from test file
        if (line.startsWith('-') && !line.startsWith('---')) {
          const removedCode = line.slice(1).trim();
          if (
            removedCode.includes('expect(') ||
            removedCode.includes('assert(') ||
            removedCode.includes('assert.') ||
            removedCode.includes('.toBe(') ||
            removedCode.includes('.toEqual(') ||
            removedCode.includes('.toThrow(')
          ) {
            return true;
          }
        }
        // Line added commenting out assertion
        if (line.startsWith('+') && !line.startsWith('+++')) {
          const addedCode = line.slice(1).trim();
          if (
            (addedCode.startsWith('//') || addedCode.startsWith('/*')) &&
            (addedCode.includes('expect(') || addedCode.includes('assert('))
          ) {
            return true;
          }
        }
      }
    }

    return false;
  }
}
