import type { DatabaseSync } from 'node:sqlite';
import {
  ImplementationSession,
  ImplementationSessionSchema,
} from '@architectai/domain';

export class ImplementationSessionStore {
  constructor(private readonly db: DatabaseSync) {}

  public create(session: ImplementationSession): void {
    const validated = ImplementationSessionSchema.parse(session);
    const stmt = this.db.prepare(`
      INSERT INTO implementation_sessions (
        id, run_id, project_id, repository_id, implementation_plan_id,
        coding_agent, original_head, original_branch, isolated_branch,
        worktree_path, changed_files, native_check_summaries,
        verification_run_result, repair_run_result, status,
        created_at, updated_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      validated.id,
      validated.runId,
      validated.projectId,
      validated.repositoryId,
      validated.implementationPlanId ?? null,
      validated.codingAgent,
      validated.originalHead,
      validated.originalBranch,
      validated.isolatedBranch,
      validated.worktreePath ?? null,
      JSON.stringify(validated.changedFiles),
      JSON.stringify(validated.nativeCheckSummaries),
      validated.verificationRunResult ? JSON.stringify(validated.verificationRunResult) : null,
      validated.repairRunResult ? JSON.stringify(validated.repairRunResult) : null,
      validated.status,
      validated.createdAt,
      validated.updatedAt,
      validated.completedAt ?? null
    );
  }

  public findById(id: string): ImplementationSession | null {
    const stmt = this.db.prepare('SELECT * FROM implementation_sessions WHERE id = ?');
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.mapRow(row);
  }

  public findByRunId(runId: string): ImplementationSession[] {
    const stmt = this.db.prepare('SELECT * FROM implementation_sessions WHERE run_id = ? ORDER BY created_at DESC');
    const rows = stmt.all(runId) as Array<Record<string, unknown>>;
    return rows.map((r) => this.mapRow(r));
  }

  public findActiveSessions(): ImplementationSession[] {
    const stmt = this.db.prepare(`
      SELECT * FROM implementation_sessions
      WHERE status IN ('IMPLEMENTING', 'VERIFYING', 'REPAIRING')
      ORDER BY created_at ASC
    `);
    const rows = stmt.all() as Array<Record<string, unknown>>;
    return rows.map((r) => this.mapRow(r));
  }

  public update(id: string, updates: Partial<ImplementationSession>): ImplementationSession | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const merged: ImplementationSession = {
      ...existing,
      ...updates,
      id: existing.id,
      runId: existing.runId,
      projectId: existing.projectId,
      repositoryId: existing.repositoryId,
      updatedAt: updates.updatedAt || new Date().toISOString(),
    };
    const validated = ImplementationSessionSchema.parse(merged);

    const stmt = this.db.prepare(`
      UPDATE implementation_sessions SET
        implementation_plan_id = ?,
        coding_agent = ?,
        original_head = ?,
        original_branch = ?,
        isolated_branch = ?,
        worktree_path = ?,
        changed_files = ?,
        native_check_summaries = ?,
        verification_run_result = ?,
        repair_run_result = ?,
        status = ?,
        updated_at = ?,
        completed_at = ?
      WHERE id = ?
    `);

    stmt.run(
      validated.implementationPlanId ?? null,
      validated.codingAgent,
      validated.originalHead,
      validated.originalBranch,
      validated.isolatedBranch,
      validated.worktreePath ?? null,
      JSON.stringify(validated.changedFiles),
      JSON.stringify(validated.nativeCheckSummaries),
      validated.verificationRunResult ? JSON.stringify(validated.verificationRunResult) : null,
      validated.repairRunResult ? JSON.stringify(validated.repairRunResult) : null,
      validated.status,
      validated.updatedAt,
      validated.completedAt ?? null,
      validated.id
    );

    return validated;
  }

  public delete(id: string): void {
    this.db.prepare('DELETE FROM implementation_sessions WHERE id = ?').run(id);
  }

  private mapRow(row: Record<string, unknown>): ImplementationSession {
    return ImplementationSessionSchema.parse({
      id: String(row['id']),
      runId: String(row['run_id']),
      projectId: String(row['project_id']),
      repositoryId: String(row['repository_id']),
      implementationPlanId: row['implementation_plan_id'] ? String(row['implementation_plan_id']) : undefined,
      codingAgent: String(row['coding_agent']),
      originalHead: String(row['original_head']),
      originalBranch: String(row['original_branch']),
      isolatedBranch: String(row['isolated_branch']),
      worktreePath: row['worktree_path'] ? String(row['worktree_path']) : undefined,
      changedFiles: row['changed_files'] ? JSON.parse(String(row['changed_files'])) : [],
      nativeCheckSummaries: row['native_check_summaries'] ? JSON.parse(String(row['native_check_summaries'])) : [],
      verificationRunResult: row['verification_run_result'] ? JSON.parse(String(row['verification_run_result'])) : undefined,
      repairRunResult: row['repair_run_result'] ? JSON.parse(String(row['repair_run_result'])) : undefined,
      status: row['status'],
      createdAt: String(row['created_at']),
      updatedAt: String(row['updated_at']),
      completedAt: row['completed_at'] ? String(row['completed_at']) : undefined,
    });
  }
}
