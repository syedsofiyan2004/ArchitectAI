import { execFile } from 'node:child_process';
import {
  VerificationSandbox,
  SandboxExecutionOptions,
  SandboxExecutionResult,
} from '../types.js';

/**
 * LocalProcessSandbox executes commands in a local child process with:
 * - Environment variable sanitation (stripping tokens, secrets, cloud credentials)
 * - Hard timeouts to prevent hangs or runaway tasks
 * - Bounded buffer limits for stdout/stderr
 * - Explicit trusted/local mode identifier
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
      execFile(
        command,
        args,
        {
          cwd: options.cwd,
          timeout: timeoutMs,
          maxBuffer: maxBufferBytes,
          env: sanitizedEnv,
        },
        (error, stdout, stderr) => {
          const durationMs = Date.now() - startTime;
          const timedOut = Boolean(error && error.killed && error.signal === 'SIGTERM');
          const exitCode = error ? (typeof error.code === 'number' ? error.code : 1) : 0;

          resolve({
            exitCode,
            stdout: stdout ? stdout.toString() : '',
            stderr: stderr ? stderr.toString() : (error ? error.message : ''),
            durationMs,
            timedOut,
          });
        }
      );
    });
  }
}
