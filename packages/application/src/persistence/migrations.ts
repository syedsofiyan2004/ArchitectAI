import type { DatabaseSync } from 'node:sqlite';

export interface Migration {
  version: number;
  name: string;
  up: (db: DatabaseSync) => void;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: '001_initial_product_schema',
    up: (db: DatabaseSync) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS workspace_settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          repository_id TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          archived_at TEXT,
          last_opened_at TEXT,
          default_provider_config_id TEXT,
          preferred_agent_id TEXT,
          metadata TEXT NOT NULL DEFAULT '{}'
        );

        CREATE TABLE IF NOT EXISTS project_repositories (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          canonical_local_path TEXT NOT NULL,
          repository_name TEXT NOT NULL,
          git_root TEXT NOT NULL,
          default_branch TEXT NOT NULL DEFAULT 'main',
          detected_languages TEXT NOT NULL DEFAULT '[]',
          detected_frameworks TEXT NOT NULL DEFAULT '[]',
          package_manifests TEXT NOT NULL DEFAULT '[]',
          last_inspected_head TEXT NOT NULL DEFAULT 'HEAD',
          last_inspected_timestamp TEXT NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS architecture_runs (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          title TEXT NOT NULL,
          state TEXT NOT NULL,
          raw_intent TEXT NOT NULL,
          explicit_constraints TEXT NOT NULL DEFAULT '[]',
          declared_tech_stack TEXT NOT NULL DEFAULT '[]',
          context TEXT NOT NULL DEFAULT '{}',
          decomposition TEXT,
          contract TEXT,
          contract_revision INTEGER NOT NULL DEFAULT 1,
          dimensions_detected TEXT NOT NULL DEFAULT '[]',
          analysis_mode TEXT NOT NULL DEFAULT 'heuristic',
          error TEXT,
          user_answers TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          completed_at TEXT,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS contract_revisions (
          id TEXT PRIMARY KEY,
          run_id TEXT NOT NULL,
          revision_number INTEGER NOT NULL,
          contract TEXT NOT NULL,
          reason TEXT,
          parent_revision_id TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (run_id) REFERENCES architecture_runs(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS user_answers (
          id TEXT PRIMARY KEY,
          run_id TEXT NOT NULL,
          question TEXT NOT NULL,
          answer TEXT NOT NULL,
          answered_at TEXT NOT NULL,
          FOREIGN KEY (run_id) REFERENCES architecture_runs(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS implementation_sessions (
          id TEXT PRIMARY KEY,
          run_id TEXT NOT NULL,
          project_id TEXT NOT NULL,
          repository_id TEXT NOT NULL,
          implementation_plan_id TEXT,
          coding_agent TEXT NOT NULL,
          original_head TEXT NOT NULL,
          original_branch TEXT NOT NULL,
          isolated_branch TEXT NOT NULL,
          worktree_path TEXT,
          changed_files TEXT NOT NULL DEFAULT '[]',
          native_check_summaries TEXT NOT NULL DEFAULT '[]',
          verification_run_result TEXT,
          repair_run_result TEXT,
          status TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          completed_at TEXT,
          FOREIGN KEY (run_id) REFERENCES architecture_runs(id) ON DELETE CASCADE,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS run_artifacts (
          id TEXT PRIMARY KEY,
          run_id TEXT NOT NULL,
          session_id TEXT,
          type TEXT NOT NULL,
          relative_path TEXT NOT NULL,
          content_hash TEXT NOT NULL,
          size_bytes INTEGER NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (run_id) REFERENCES architecture_runs(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS provider_configurations (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          display_name TEXT NOT NULL,
          base_url TEXT,
          model_name TEXT NOT NULL,
          credential_reference TEXT,
          enabled INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS agent_configurations (
          id TEXT PRIMARY KEY,
          adapter_id TEXT NOT NULL,
          display_name TEXT NOT NULL,
          preferred INTEGER NOT NULL DEFAULT 0,
          last_detected_version TEXT,
          last_detection_timestamp TEXT,
          is_available INTEGER NOT NULL DEFAULT 1
        );

        CREATE INDEX IF NOT EXISTS idx_runs_project ON architecture_runs(project_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_run ON implementation_sessions(run_id);
        CREATE INDEX IF NOT EXISTS idx_artifacts_run ON run_artifacts(run_id);
      `);
    },
  },
];

export function runMigrations(db: DatabaseSync): void {
  // Ensure schema_migrations table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedRows = db.prepare('SELECT version FROM schema_migrations ORDER BY version ASC').all() as Array<{ version: number }>;
  const appliedVersions = new Set(appliedRows.map((r) => r.version));

  for (const migration of MIGRATIONS) {
    if (!appliedVersions.has(migration.version)) {
      migration.up(db);
      const stmt = db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)');
      stmt.run(migration.version, migration.name, new Date().toISOString());
    }
  }
}
