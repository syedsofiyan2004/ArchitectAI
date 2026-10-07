import type { DatabaseSync } from 'node:sqlite';
import { WorkspaceSettings, WorkspaceSettingsSchema } from '@architectai/domain';

export class WorkspaceSettingsStore {
  constructor(private readonly db: DatabaseSync) {}

  public get(): WorkspaceSettings {
    const rows = this.db.prepare('SELECT key, value FROM workspace_settings').all() as Array<{ key: string; value: string }>;
    const raw: Record<string, unknown> = {};
    for (const r of rows) {
      try {
        raw[r.key] = JSON.parse(r.value);
      } catch {
        raw[r.key] = r.value;
      }
    }
    return WorkspaceSettingsSchema.parse(raw);
  }

  public update(updates: Partial<WorkspaceSettings>): WorkspaceSettings {
    const current = this.get();
    const merged = { ...current, ...updates };
    const validated = WorkspaceSettingsSchema.parse(merged);

    const stmt = this.db.prepare(`
      INSERT INTO workspace_settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);

    for (const [key, val] of Object.entries(validated)) {
      if (val !== undefined) {
        stmt.run(key, JSON.stringify(val));
      }
    }

    return validated;
  }
}
