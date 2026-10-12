import { describe, it, expect, afterEach } from 'vitest';
import { ProcessSupervisor } from './process-supervisor.js';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';

describe('ProcessSupervisor: Process Tree Cleanup, Timeouts, Cancellation & Output Bounding', () => {
  const supervisor = new ProcessSupervisor();
  const tempFiles: string[] = [];

  afterEach(() => {
    supervisor.killAll();
    for (const file of tempFiles) {
      try {
        fs.unlinkSync(file);
      } catch {
        // ignore
      }
    }
    tempFiles.length = 0;
  });

  function isPidAlive(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  it('1. executes a standard command and captures stdout & stderr', async () => {
    const result = await supervisor.execute(process.execPath, [
      '-e',
      'console.log("hello stdout"); console.error("hello stderr");',
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('hello stdout');
    expect(result.stderr).toContain('hello stderr');
    expect(result.timedOut).toBe(false);
    expect(result.cancelled).toBe(false);
    expect(result.truncated).toBe(false);
  });

  it('2. terminates process on timeout and sets timedOut = true', async () => {
    const result = await supervisor.execute(
      process.execPath,
      ['-e', 'setInterval(() => {}, 1000);'], // hangs indefinitely
      { timeoutMs: 300 }
    );

    expect(result.timedOut).toBe(true);
    expect(result.durationMs).toBeGreaterThanOrEqual(250);
  });

  it('3. terminates process immediately on user cancellation (AbortSignal)', async () => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 200);

    const result = await supervisor.execute(
      process.execPath,
      ['-e', 'setInterval(() => {}, 1000);'],
      { timeoutMs: 10000, signal: controller.signal }
    );

    expect(result.cancelled).toBe(true);
    expect(result.durationMs).toBeLessThan(2000);
  });

  it('4. bounds stdout output and sets truncated flag without consuming unbounded memory', async () => {
    // Generate a script that outputs ~1 MB of repetitive text
    const result = await supervisor.execute(
      process.execPath,
      [
        '-e',
        'for (let i = 0; i < 5000; i++) console.log("line " + i + ": 0123456789012345678901234567890123456789");',
      ],
      { maxBufferBytes: 50 * 1024 } // 50 KB bound
    );

    expect(result.exitCode).toBe(0);
    expect(result.truncated).toBe(true);
    expect(result.totalStdoutBytes).toBeGreaterThan(100 * 1024);
    expect(result.stdout.length).toBeLessThanOrEqual(55 * 1024);
  });

  it('5. CRITICAL: terminates entire child process tree (parent and spawned grandchild)', async () => {
    // Write a grandchild tracker file path
    const grandchildPidFile = path.join(os.tmpdir(), `test-grandchild-pid-${Date.now()}.txt`);
    const parentPidFile = path.join(os.tmpdir(), `test-parent-pid-${Date.now()}.txt`);
    tempFiles.push(grandchildPidFile, parentPidFile);

    // Parent script spawns grandchild and both hang
    const parentScript = `
      const { spawn } = require('child_process');
      const fs = require('fs');
      fs.writeFileSync(${JSON.stringify(parentPidFile)}, String(process.pid));
      const grandchild = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000);'], {
        detached: false,
        stdio: 'ignore'
      });
      fs.writeFileSync(${JSON.stringify(grandchildPidFile)}, String(grandchild.pid));
      setInterval(() => {}, 1000);
    `;

    const runPromise = supervisor.execute(
      process.execPath,
      ['-e', parentScript],
      { timeoutMs: 600 }
    );

    const result = await runPromise;
    expect(result.timedOut).toBe(true);

    // Wait 300ms for OS to clean up processes
    await new Promise((r) => setTimeout(r, 400));

    expect(fs.existsSync(parentPidFile)).toBe(true);
    expect(fs.existsSync(grandchildPidFile)).toBe(true);

    const parentPid = parseInt(fs.readFileSync(parentPidFile, 'utf-8').trim(), 10);
    const grandchildPid = parseInt(fs.readFileSync(grandchildPidFile, 'utf-8').trim(), 10);

    expect(parentPid).toBeGreaterThan(0);
    expect(grandchildPid).toBeGreaterThan(0);

    expect(isPidAlive(parentPid)).toBe(false);
    expect(isPidAlive(grandchildPid)).toBe(false);
  });
});
