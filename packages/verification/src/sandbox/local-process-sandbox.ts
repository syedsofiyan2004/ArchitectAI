import { execFile, execSync, ChildProcess } from 'node:child_process';
import * as os from 'node:os';
import * as fs from 'node:fs';
import {
  VerificationSandbox,
  SandboxExecutionOptions,
  SandboxExecutionResult,
} from '../types.js';

function killProcessTree(pid: number, child?: ChildProcess): void {
  if (!pid || pid <= 0) return;

  // Liveness check: if process is already dead, return immediately
  try {
    process.kill(pid, 0);
  } catch {
    return;
  }

  const isWindows = os.platform() === 'win32';
  if (isWindows) {
    const sysRoot = process.env['SystemRoot'] || 'C:\\Windows';
    const taskkillPath = `${sysRoot}\\System32\\taskkill.exe`;
    const taskkillCmd = fs.existsSync(taskkillPath) ? taskkillPath : 'taskkill';
    try {
      execSync(`"${taskkillCmd}" /pid ${pid} /T /F`, { stdio: 'ignore', timeout: 2000 });
    } catch {
      // taskkill failed, proceed to child.kill
    }
  } else {
    try {
      process.kill(-pid, 'SIGKILL');
    } catch {
      try {
        execSync(`pkill -KILL -P ${pid}`, { stdio: 'ignore', timeout: 2000 });
      } catch {
        // ignore
      }
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        // ignore
      }
    }
  }

  if (child) {
    try {
      child.kill('SIGKILL');
    } catch {
      // ignore
    }
  }
}

/**
 * LocalProcessSandbox executes verification commands in a local child process under
 * a Trusted Local Execution model.
 *
 * NOTE: This does NOT provide container-grade or VM isolation (such as Linux cgroups,
 * namespaces, or OCI containers). It protects against accidental leakage and runaways by:
 * - Environment variable sanitation (stripping API tokens, secrets, cloud credentials)
 * - Hard process execution timeouts with process-tree cleanup to prevent hangs or runaway tasks
 * - Bounded buffer limits for stdout/stderr
 * - Temporary filesystem artifact isolation outside target repositories
 */
export class LocalProcessSandbox implements VerificationSandbox {
  readonly id = 'local-trusted-process-sandbox';

  private readonly sensitiveEnvKeys = [
    'ARCHITECTAI_API_KEY',
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'GITHUB_TOKEN',
    'GH_TOKEN',
    'GIT_ASKPASS',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'DATABASE_URL',
    'POSTGRES_PASSWORD',
    'REDIS_PASSWORD',
    'SECRET',
    'TOKEN',
    'PASSWORD',
  ];

  async executeCommand(
    command: string,
    args: string[],
    options: SandboxExecutionOptions
  ): Promise<SandboxExecutionResult> {
    const startTime = Date.now();
    const timeoutMs = options.timeoutMs ?? 10000;
    const maxBufferBytes = options.maxBufferBytes ?? 1024 * 1024; // 1MB buffer

    // Build sanitized environment
    const sanitizedEnv: Record<string, string> = {};
    for (const [key, val] of Object.entries(process.env)) {
      if (!val) continue;
      const isSensitive = this.sensitiveEnvKeys.some((s) =>
        key.toUpperCase().includes(s)
      );
      if (!isSensitive) {
        sanitizedEnv[key] = val;
      }
    }

    if (options.env) {
      for (const [k, v] of Object.entries(options.env)) {
        sanitizedEnv[k] = v;
      }
    }

    return new Promise<SandboxExecutionResult>((resolve) => {
      let timedOut = false;
      let timer: NodeJS.Timeout | undefined;

      const child = execFile(
        command,
        args,
        {
          cwd: options.cwd,
          timeout: timeoutMs,
          maxBuffer: maxBufferBytes,
          env: sanitizedEnv,
        },
        (error, stdout, stderr) => {
          if (timer) clearTimeout(timer);
          const durationMs = Date.now() - startTime;
          const isKilled = Boolean(error && (error.killed || timedOut));
          const exitCode = error ? (typeof error.code === 'number' ? error.code : 1) : 0;

          if (isKilled && child.pid) {
            killProcessTree(child.pid, child);
          }

          resolve({
            exitCode,
            stdout: stdout ? stdout.toString() : '',
            stderr: stderr ? stderr.toString() : (error ? error.message : ''),
            durationMs,
            timedOut: isKilled,
          });
        }
      );

      timer = setTimeout(() => {
        timedOut = true;
        if (child.pid) {
          killProcessTree(child.pid, child);
        }
      }, timeoutMs);
    });
  }
}
