import * as fs from 'node:fs';
import * as path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export interface ExecutionCheckResult {
  command: string;
  scriptName: string;
  passed: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export class ExecutionChecksService {
  async runDiscoveredChecks(targetDir: string): Promise<ExecutionCheckResult[]> {
    const pkgPath = path.join(targetDir, 'package.json');
    if (!fs.existsSync(pkgPath)) {
      return [];
    }

    let scripts: Record<string, string> = {};
    try {
      const parsed = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (typeof parsed.scripts === 'object' && parsed.scripts !== null) {
        scripts = parsed.scripts;
      }
    } catch {
      return [];
    }

    const checksToRun: Array<{ name: string; cmd: string }> = [];

    // Prioritized check names: typecheck, test, build, lint
    const checkNames = ['typecheck', 'test', 'build', 'lint'];
    for (const name of checkNames) {
      if (scripts[name]) {
        checksToRun.push({ name, cmd: `npm run ${name}` });
      }
    }

    const results: ExecutionCheckResult[] = [];

    for (const check of checksToRun) {
      const startTime = Date.now();
      try {
        const { stdout, stderr } = await execAsync(check.cmd, {
          cwd: targetDir,
          timeout: 60000,
        });
        const durationMs = Date.now() - startTime;
        results.push({
          command: check.cmd,
          scriptName: check.name,
          passed: true,
          exitCode: 0,
          stdout: stdout.toString(),
          stderr: stderr.toString(),
          durationMs,
        });
      } catch (err: any) {
        const durationMs = Date.now() - startTime;
        results.push({
          command: check.cmd,
          scriptName: check.name,
          passed: false,
          exitCode: typeof err.code === 'number' ? err.code : 1,
          stdout: err.stdout ? err.stdout.toString() : '',
          stderr: err.stderr ? err.stderr.toString() : (err.message || ''),
          durationMs,
        });
      }
    }

    return results;
  }
}
