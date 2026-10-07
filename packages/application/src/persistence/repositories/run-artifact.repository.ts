import type { DatabaseSync } from 'node:sqlite';
import { RunArtifactReference, RunArtifactReferenceSchema } from '@architectai/domain';

export class RunArtifactStore {
  constructor(private readonly db: DatabaseSync) {}

  public create(artifact: RunArtifactReference): void {
    const validated = RunArtifactReferenceSchema.parse(artifact);
    const stmt = this.db.prepare(`
      INSERT INTO run_artifacts (
        id, run_id, session_id, type, relative_path, content_hash, size_bytes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      validated.id,
      validated.runId,
      validated.sessionId ?? null,
      validated.type,
      validated.relativePath,
      validated.contentHash,
      validated.sizeBytes,
      validated.createdAt
    );
  }

  public findById(id: string): RunArtifactReference | null {
    const stmt = this.db.prepare('SELECT * FROM run_artifacts WHERE id = ?');
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.mapRow(row);
  }

  public findByRunId(runId: string): RunArtifactReference[] {
    const stmt = this.db.prepare('SELECT * FROM run_artifacts WHERE run_id = ? ORDER BY created_at DESC');
    const rows = stmt.all(runId) as Array<Record<string, unknown>>;
    return rows.map((r) => this.mapRow(r));
  }

  public delete(id: string): void {
    this.db.prepare('DELETE FROM run_artifacts WHERE id = ?').run(id);
  }

  private mapRow(row: Record<string, unknown>): RunArtifactReference {
    return RunArtifactReferenceSchema.parse({
      id: String(row['id']),
      runId: String(row['run_id']),
      sessionId: row['session_id'] ? String(row['session_id']) : undefined,
      type: row['type'],
      relativePath: String(row['relative_path']),
      contentHash: String(row['content_hash']),
      sizeBytes: Number(row['size_bytes']),
      createdAt: String(row['created_at']),
    });
  }
}
