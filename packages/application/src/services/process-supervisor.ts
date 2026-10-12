import { spawn, ChildProcess, execSync } from 'node:child_process';
import * as os from 'node:os';
import * as fs from 'node:fs';

export interface SupervisedExecutionOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
  maxBufferBytes?: number; // default 512 KB limit on memory retention
  signal?: AbortSignal;
  onStdoutChunk?: (chunk: string) => void;
  onStderrChunk?: (chunk: string) => void;
}

export interface SupervisedExecutionResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  totalStdoutBytes: number;
  totalStderrBytes: number;
  truncated: boolean;
  durationMs: number;
  timedOut: boolean;
  cancelled: boolean;
}

/**
 * Cross-platform process tree killer.
 * Guarantees that grandchildren and all spawned child processes in the process tree
 * are completely terminated on timeout or cancellation.
 */
export function killProcessTree(pid: number, child?: ChildProcess): void {
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
      // On Unix, try killing the process group if detached, or find child PIDs
      try {
        process.kill(-pid, 'SIGKILL');
      } catch {
        // Fallback: kill child processes via pkill if available
        try {
          execSync(`pkill -KILL -P ${pid}`, { stdio: 'ignore' });
        } catch {
          // ignore
        }
        process.kill(pid, 'SIGKILL');
      }
    } catch {
      // Process may have already exited
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
 * ProcessSupervisor manages child process execution with:
 * - Hard timeout enforcement with process tree termination
 * - AbortSignal / user cancellation with process tree termination
 * - Memory-bounded stdout/stderr capture (preventing unbounded log memory consumption)
 */
export class ProcessSupervisor {
  private activeProcesses = new Set<{ pid: number; child: ChildProcess }>();

  public getActiveCount(): number {
    return this.activeProcesses.size;
  }

  public killAll(): void {
    for (const item of Array.from(this.activeProcesses)) {
      killProcessTree(item.pid, item.child);
      this.activeProcesses.delete(item);
    }
  }

  public async execute(
    command: string,
    args: string[],
    options: SupervisedExecutionOptions = {}
  ): Promise<SupervisedExecutionResult> {
    const startTime = Date.now();
    const timeoutMs = options.timeoutMs ?? 60000;
    const maxBufferBytes = options.maxBufferBytes ?? 512 * 1024; // 512 KB

    let stdoutPreview = '';
    let stderrPreview = '';
    let totalStdoutBytes = 0;
    let totalStderrBytes = 0;
    let truncated = false;
    let timedOut = false;
    let cancelled = false;

    return new Promise<SupervisedExecutionResult>((resolve) => {
      // Spawn detached on unix so process group can be killed together
      const child = spawn(command, args, {
        cwd: options.cwd,
        env: options.env ?? process.env,
        detached: os.platform() !== 'win32',
        shell: false,
      });

      const entry = { pid: child.pid ?? 0, child };
      if (child.pid) {
        this.activeProcesses.add(entry);
      }

      let timeoutTimer: NodeJS.Timeout | undefined;
      if (timeoutMs > 0 && timeoutMs !== Infinity) {
        timeoutTimer = setTimeout(() => {
          timedOut = true;
          if (child.pid) {
            killProcessTree(child.pid, child);
          }
        }, timeoutMs);
      }

      const onAbort = () => {
        cancelled = true;
        if (child.pid) {
          killProcessTree(child.pid, child);
        }
      };

      if (options.signal) {
        if (options.signal.aborted) {
          onAbort();
        } else {
          options.signal.addEventListener('abort', onAbort, { once: true });
        }
      }

      // Stream stdout with bounded accumulation
      child.stdout?.on('data', (chunk: Buffer) => {
        const len = chunk.length;
        totalStdoutBytes += len;

        if (totalStdoutBytes <= maxBufferBytes) {
          stdoutPreview += chunk.toString('utf-8');
        } else {
          truncated = true;
          if (stdoutPreview.length < maxBufferBytes) {
            const remaining = maxBufferBytes - stdoutPreview.length;
            stdoutPreview += chunk.subarray(0, remaining).toString('utf-8');
          }
        }

        if (options.onStdoutChunk) {
          options.onStdoutChunk(chunk.toString('utf-8'));
        }
      });

      // Stream stderr with bounded accumulation
      child.stderr?.on('data', (chunk: Buffer) => {
        const len = chunk.length;
        totalStderrBytes += len;

        if (totalStderrBytes <= maxBufferBytes) {
          stderrPreview += chunk.toString('utf-8');
        } else {
          truncated = true;
          if (stderrPreview.length < maxBufferBytes) {
            const remaining = maxBufferBytes - stderrPreview.length;
            stderrPreview += chunk.subarray(0, remaining).toString('utf-8');
          }
        }

        if (options.onStderrChunk) {
          options.onStderrChunk(chunk.toString('utf-8'));
        }
      });

      child.on('close', (code) => {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        if (options.signal) {
          options.signal.removeEventListener('abort', onAbort);
        }
        this.activeProcesses.delete(entry);

        const durationMs = Date.now() - startTime;
        resolve({
          exitCode: code ?? (timedOut || cancelled ? 1 : 0),
          stdout: stdoutPreview,
          stderr: stderrPreview,
          totalStdoutBytes,
          totalStderrBytes,
          truncated,
          durationMs,
          timedOut,
          cancelled,
        });
      });

      child.on('error', (err) => {
        if (timeoutTimer) clearTimeout(timeoutTimer);
        if (options.signal) {
          options.signal.removeEventListener('abort', onAbort);
        }
        this.activeProcesses.delete(entry);

        const durationMs = Date.now() - startTime;
        stderrPreview += `\nSpawn error: ${err.message}`;
        resolve({
          exitCode: 1,
          stdout: stdoutPreview,
          stderr: stderrPreview,
          totalStdoutBytes,
          totalStderrBytes,
          truncated,
          durationMs,
          timedOut,
          cancelled,
        });
      });
    });
  }
}
