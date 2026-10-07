import * as fs from 'node:fs';
import { ImplementationSessionStore } from './repositories/implementation-session.repository.js';
import { ArchitectureRunStore } from './repositories/architecture-run.repository.js';
import { ProjectRegisteredRepositoryStore } from './repositories/project-repository.repository.js';
import { GitIsolationService } from '../services/git-isolation.service.js';

export interface RecoveryReport {
  reconciledSessionsCount: number;
  recoverableCount: number;
  orphanedCount: number;
  details: Array<{
    sessionId: string;
    runId: string;
    previousStatus: string;
    newStatus: string;
    worktreePath?: string;
    worktreeExists: boolean;
  }>;
}

export class CrashRecoveryService {
  constructor(
    private readonly sessionStore: ImplementationSessionStore,
    private readonly runStore: ArchitectureRunStore,
    private readonly repoStore: ProjectRegisteredRepositoryStore,
    private readonly gitIsolationService: GitIsolationService = new GitIsolationService()
  ) {}

  public reconcileInterruptedSessions(): RecoveryReport {
    const activeSessions = this.sessionStore.findActiveSessions();
    const details: RecoveryReport['details'] = [];
    let recoverableCount = 0;
    let orphanedCount = 0;

    for (const session of activeSessions) {
      const worktreeExists = session.worktreePath ? fs.existsSync(session.worktreePath) : false;
      let newStatus: 'RECOVERABLE' | 'INTERRUPTED' | 'ORPHANED' | 'CLEANUP_REQUIRED';

      if (worktreeExists) {
        newStatus = 'RECOVERABLE';
        recoverableCount++;
      } else {
        newStatus = 'ORPHANED';
        orphanedCount++;
      }

      this.sessionStore.update(session.id, {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });

      // Update associated run state if it was in an active state
      const run = this.runStore.findById(session.runId);
      if (run && (run.state === 'IMPLEMENTING' || run.state === 'REPAIRING')) {
        this.runStore.update(run.id, {
          state: 'FAILED',
          error: `Execution interrupted by server termination. Session '${session.id}' status is now ${newStatus}.`,
          updatedAt: new Date().toISOString(),
        });
      }

      details.push({
        sessionId: session.id,
        runId: session.runId,
        previousStatus: session.status,
        newStatus,
        worktreePath: session.worktreePath,
        worktreeExists,
      });
    }

    return {
      reconciledSessionsCount: activeSessions.length,
      recoverableCount,
      orphanedCount,
      details,
    };
  }

  public async cleanupRecordedWorktree(sessionId: string): Promise<{ success: boolean; message: string }> {
    const session = this.sessionStore.findById(sessionId);
    if (!session) {
      throw new Error(`Session '${sessionId}' not found.`);
    }

    if (!session.worktreePath) {
      return { success: true, message: 'No worktree associated with session.' };
    }

    // Safety rules:
    // 1. Branch must start with 'architectai/'
    if (!session.isolatedBranch.startsWith('architectai/')) {
      throw new Error(`Safety violation: Refusing to clean branch '${session.isolatedBranch}' which does not start with 'architectai/'.`);
    }

    // 2. Worktree must not be the original repository git root
    if (session.worktreePath.includes('.git') && !session.worktreePath.includes('architectai-worktrees')) {
      throw new Error(`Safety violation: Worktree path appears to target repository core: '${session.worktreePath}'.`);
    }

    const registeredRepo = this.repoStore.findById(session.repositoryId);
    const repoPath = registeredRepo ? registeredRepo.canonicalLocalPath : process.cwd();

    if (fs.existsSync(session.worktreePath)) {
      try {
        await this.gitIsolationService.cleanupWorktree(repoPath, session.worktreePath);
      } catch {
        // Fallback remove if git command already detached
        try {
          fs.rmSync(session.worktreePath, { recursive: true, force: true });
        } catch {
          // ignore
        }
      }
    }

    this.sessionStore.update(sessionId, {
      status: 'COMPLETED',
      updatedAt: new Date().toISOString(),
    });

    return { success: true, message: `Successfully cleaned worktree at '${session.worktreePath}'.` };
  }
}
