import type { DatabaseSync } from 'node:sqlite';
import { ProjectRepository, ProjectRepositorySchema } from '@architectai/domain';

export class ProjectRegisteredRepositoryStore {
  constructor(private readonly db: DatabaseSync) {}

  public register(repo: ProjectRepository): void {
    const validated = ProjectRepositorySchema.parse(repo);
    // Replace any existing registration for this project or insert new
    const stmt = this.db.prepare(`
      INSERT INTO project_repositories (
        id, project_id, canonical_local_path, repository_name, git_root,
        default_branch, detected_languages, detected_frameworks, package_manifests,
        last_inspected_head, last_inspected_timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        canonical_local_path = excluded.canonical_local_path,
        repository_name = excluded.repository_name,
        git_root = excluded.git_root,
        default_branch = excluded.default_branch,
        detected_languages = excluded.detected_languages,
        detected_frameworks = excluded.detected_frameworks,
        package_manifests = excluded.package_manifests,
        last_inspected_head = excluded.last_inspected_head,
        last_inspected_timestamp = excluded.last_inspected_timestamp
    `);

    stmt.run(
      validated.id,
      validated.projectId,
      validated.canonicalLocalPath,
      validated.repositoryName,
      validated.gitRoot,
      validated.defaultBranch,
      JSON.stringify(validated.detectedLanguages),
      JSON.stringify(validated.detectedFrameworks),
      JSON.stringify(validated.packageManifests),
      validated.lastInspectedHead,
      validated.lastInspectedTimestamp
    );

    // Also link to project
    this.db.prepare('UPDATE projects SET repository_id = ? WHERE id = ?').run(validated.id, validated.projectId);
  }

  public findById(id: string): ProjectRepository | null {
    const stmt = this.db.prepare('SELECT * FROM project_repositories WHERE id = ?');
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.mapRow(row);
  }

  public findByProjectId(projectId: string): ProjectRepository | null {
    const stmt = this.db.prepare('SELECT * FROM project_repositories WHERE project_id = ?');
    const row = stmt.get(projectId) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.mapRow(row);
  }

  public findByCanonicalPath(canonicalPath: string): ProjectRepository | null {
    const stmt = this.db.prepare('SELECT * FROM project_repositories WHERE canonical_local_path = ?');
    const row = stmt.get(canonicalPath) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.mapRow(row);
  }

  public update(id: string, updates: Partial<ProjectRepository>): ProjectRepository | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const merged: ProjectRepository = {
      ...existing,
      ...updates,
      id: existing.id,
      projectId: existing.projectId,
    };
    const validated = ProjectRepositorySchema.parse(merged);

    const stmt = this.db.prepare(`
      UPDATE project_repositories SET
        canonical_local_path = ?,
        repository_name = ?,
        git_root = ?,
        default_branch = ?,
        detected_languages = ?,
        detected_frameworks = ?,
        package_manifests = ?,
        last_inspected_head = ?,
        last_inspected_timestamp = ?
      WHERE id = ?
    `);

    stmt.run(
      validated.canonicalLocalPath,
      validated.repositoryName,
      validated.gitRoot,
      validated.defaultBranch,
      JSON.stringify(validated.detectedLanguages),
      JSON.stringify(validated.detectedFrameworks),
      JSON.stringify(validated.packageManifests),
      validated.lastInspectedHead,
      validated.lastInspectedTimestamp,
      validated.id
    );

    return validated;
  }

  public delete(id: string): void {
    const existing = this.findById(id);
    if (existing) {
      this.db.prepare('UPDATE projects SET repository_id = NULL WHERE repository_id = ?').run(id);
      this.db.prepare('DELETE FROM project_repositories WHERE id = ?').run(id);
    }
  }

  private mapRow(row: Record<string, unknown>): ProjectRepository {
    return ProjectRepositorySchema.parse({
      id: String(row['id']),
      projectId: String(row['project_id']),
      canonicalLocalPath: String(row['canonical_local_path']),
      repositoryName: String(row['repository_name']),
      gitRoot: String(row['git_root']),
      defaultBranch: String(row['default_branch'] || 'main'),
      detectedLanguages: row['detected_languages'] ? JSON.parse(String(row['detected_languages'])) : [],
      detectedFrameworks: row['detected_frameworks'] ? JSON.parse(String(row['detected_frameworks'])) : [],
      packageManifests: row['package_manifests'] ? JSON.parse(String(row['package_manifests'])) : [],
      lastInspectedHead: String(row['last_inspected_head'] || 'HEAD'),
      lastInspectedTimestamp: String(row['last_inspected_timestamp']),
    });
  }
}
