import type { DatabaseSync } from 'node:sqlite';
import { Project, ProjectSchema } from '@architectai/domain';

export class ProjectRepositoryStore {
  constructor(private readonly db: DatabaseSync) {}

  public create(project: Project): void {
    const validated = ProjectSchema.parse(project);
    const stmt = this.db.prepare(`
      INSERT INTO projects (
        id, name, description, repository_id, created_at, updated_at,
        archived_at, last_opened_at, default_provider_config_id, preferred_agent_id, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      validated.id,
      validated.name,
      validated.description ?? null,
      validated.repositoryId ?? null,
      validated.createdAt,
      validated.updatedAt,
      validated.archivedAt ?? null,
      validated.lastOpenedAt ?? null,
      validated.defaultProviderConfigId ?? null,
      validated.preferredAgentId ?? null,
      JSON.stringify(validated.metadata ?? {})
    );
  }

  public findById(id: string): Project | null {
    const stmt = this.db.prepare('SELECT * FROM projects WHERE id = ?');
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.mapRow(row);
  }

  public list(includeArchived = false): Project[] {
    const query = includeArchived
      ? 'SELECT * FROM projects ORDER BY updated_at DESC'
      : 'SELECT * FROM projects WHERE archived_at IS NULL ORDER BY updated_at DESC';
    const rows = this.db.prepare(query).all() as Array<Record<string, unknown>>;
    return rows.map((r) => this.mapRow(r));
  }

  public update(id: string, updates: Partial<Project>): Project | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const merged: Project = {
      ...existing,
      ...updates,
      id: existing.id,
      updatedAt: updates.updatedAt || new Date().toISOString(),
    };
    const validated = ProjectSchema.parse(merged);

    const stmt = this.db.prepare(`
      UPDATE projects SET
        name = ?,
        description = ?,
        repository_id = ?,
        updated_at = ?,
        archived_at = ?,
        last_opened_at = ?,
        default_provider_config_id = ?,
        preferred_agent_id = ?,
        metadata = ?
      WHERE id = ?
    `);

    stmt.run(
      validated.name,
      validated.description ?? null,
      validated.repositoryId ?? null,
      validated.updatedAt,
      validated.archivedAt ?? null,
      validated.lastOpenedAt ?? null,
      validated.defaultProviderConfigId ?? null,
      validated.preferredAgentId ?? null,
      JSON.stringify(validated.metadata ?? {}),
      validated.id
    );

    return validated;
  }

  public archive(id: string): void {
    const now = new Date().toISOString();
    this.update(id, { archivedAt: now });
  }

  public delete(id: string): void {
    // Only deletes product database records; never deletes git repositories.
    this.db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  }

  private mapRow(row: Record<string, unknown>): Project {
    return ProjectSchema.parse({
      id: String(row['id']),
      name: String(row['name']),
      description: row['description'] ? String(row['description']) : undefined,
      repositoryId: row['repository_id'] ? String(row['repository_id']) : undefined,
      createdAt: String(row['created_at']),
      updatedAt: String(row['updated_at']),
      archivedAt: row['archived_at'] ? String(row['archived_at']) : undefined,
      lastOpenedAt: row['last_opened_at'] ? String(row['last_opened_at']) : undefined,
      defaultProviderConfigId: row['default_provider_config_id'] ? String(row['default_provider_config_id']) : undefined,
      preferredAgentId: row['preferred_agent_id'] ? String(row['preferred_agent_id']) : undefined,
      metadata: row['metadata'] ? JSON.parse(String(row['metadata'])) : {},
    });
  }
}
