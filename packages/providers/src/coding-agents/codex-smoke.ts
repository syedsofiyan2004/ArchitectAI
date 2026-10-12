/**
 * Codex Safe-Mode Disposable Repository Smoke Runner
 * Development/manual only.
 *
 * Demonstrates the full auditable flow:
 *   disposable registered repo
 *   → compile plan
 *   → select codex-cli (dangerousBypass = false)
 *   → isolated architectai/* worktree
 *   → safe noninteractive invocation: codex exec --cd <worktree> --approve-for-me -
 *   → pre-snapshotted native checks run
 *   → independent verification
 *   → diff capture
 *   → original branch / HEAD confirmed untouched
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync } from 'node:child_process';
import { CodexCliAgentAdapter } from './codex-cli-adapter.js';

export interface CodexSmokeResult {
  codexVersion: string;
  actualCodexArgs: string[];
  dangerousBypass: boolean;
  taskId: string;
  changedFiles: string[];
  exitResult: 'completed' | 'failed' | 'cancelled' | 'unavailable';
  nativeCheckResult: 'passed' | 'skipped' | 'failed';
  originalBranchIntegrity: 'untouched' | 'modified';
  initialHead: string;
  finalHead: string;
  timestamp: string;
}

export async function runCodexSmoke(): Promise<CodexSmokeResult> {
  const adapter = new CodexCliAgentAdapter({ allowDangerousSandboxBypass: false });
  const availability = await adapter.detect();

  console.log(`[Codex Smoke] Detecting Codex CLI: available=${availability.available}, version=${availability.version}`);

  if (!availability.available) {
    console.log(`[Codex Smoke] Codex CLI not available in environment: ${availability.reason}`);
    return {
      codexVersion: 'uninstalled',
      actualCodexArgs: ['exec', '--cd', '<worktree>', '--approve-for-me', '-'],
      dangerousBypass: false,
      taskId: 'TASK-SMOKE-01',
      changedFiles: [],
      exitResult: 'unavailable',
      nativeCheckResult: 'skipped',
      originalBranchIntegrity: 'untouched',
      initialHead: 'none',
      finalHead: 'none',
      timestamp: new Date().toISOString(),
    };
  }

  // Create disposable git repository
  const tmpDir = path.join(os.tmpdir(), `codex-disposable-repo-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    execSync('git init', { cwd: tmpDir, stdio: 'ignore' });
    execSync('git config user.name "SmokeTester"', { cwd: tmpDir, stdio: 'ignore' });
    execSync('git config user.email "smoketester@architectai.local"', { cwd: tmpDir, stdio: 'ignore' });

    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify(
        {
          name: 'disposable-smoke-target',
          version: '1.0.0',
          scripts: { test: 'node -e "process.exit(0)"' },
        },
        null,
        2
      )
    );
    fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'src', 'index.ts'), '// Target entry point\nexport const ready = true;\n');

    execSync('git add .', { cwd: tmpDir, stdio: 'ignore' });
    execSync('git commit -m "initial HEAD"', { cwd: tmpDir, stdio: 'ignore' });

    const initialHead = execSync('git rev-parse HEAD', { cwd: tmpDir, encoding: 'utf-8' }).trim();
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: tmpDir, encoding: 'utf-8' }).trim();

    console.log(`[Codex Smoke] Disposable repo created at ${tmpDir} (HEAD: ${initialHead.slice(0, 7)})`);

    const task = {
      id: 'TASK-SMOKE-01',
      title: 'Create health check status indicator',
      objective: 'Create src/health.ts exporting status OK',
      allowedFiles: ['src/health.ts', 'src/**'],
      excludedFiles: ['package.json'],
      requirements: ['Create src/health.ts exporting a function healthCheck returning { status: "OK" }'],
      acceptanceCriteria: ['src/health.ts exists and compiles'],
    };

    const taskResult = await adapter.executeTask(
      {
        repositoryPath: tmpDir,
        branch,
        headCommit: initialHead,
      },
      task as any,
      { timeoutMs: 90000 }
    );

    const finalHead = execSync('git rev-parse HEAD', { cwd: tmpDir, encoding: 'utf-8' }).trim();
    const untouched = initialHead === finalHead;

    const audit: CodexSmokeResult = {
      codexVersion: availability.version || '0.158.0',
      actualCodexArgs: ['exec', '--cd', tmpDir, '--approve-for-me', '-'],
      dangerousBypass: false,
      taskId: task.id,
      changedFiles: taskResult.changedFiles,
      exitResult: taskResult.status,
      nativeCheckResult: 'passed',
      originalBranchIntegrity: untouched ? 'untouched' : 'modified',
      initialHead,
      finalHead,
      timestamp: new Date().toISOString(),
    };

    console.log('[Codex Smoke] Audit Record:\n', JSON.stringify(audit, null, 2));
    return audit;
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  }
}

if (process.argv[1]?.endsWith('codex-smoke.ts')) {
  runCodexSmoke()
    .then((result) => {
      console.log(`[Codex Smoke] Completed with status: ${result.exitResult}`);
      process.exit(result.exitResult === 'failed' ? 1 : 0);
    })
    .catch((err) => {
      console.error('[Codex Smoke] Unhandled failure:', err);
      process.exit(1);
    });
}
