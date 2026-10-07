import type { DatabaseSync } from 'node:sqlite';
import { AgentConfiguration, AgentConfigurationSchema } from '@architectai/domain';

export class AgentConfigurationStore {
  constructor(private readonly db: DatabaseSync) {}

  public save(config: AgentConfiguration): void {
    const validated = AgentConfigurationSchema.parse(config);
    const stmt = this.db.prepare(`
      INSERT INTO agent_configurations (
        id, adapter_id, display_name, preferred, last_detected_version,
        last_detection_timestamp, is_available
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        adapter_id = excluded.adapter_id,
        display_name = excluded.display_name,
        preferred = excluded.preferred,
        last_detected_version = excluded.last_detected_version,
        last_detection_timestamp = excluded.last_detection_timestamp,
        is_available = excluded.is_available
    `);
    stmt.run(
      validated.id,
      validated.adapterId,
      validated.displayName,
      validated.preferred ? 1 : 0,
      validated.lastDetectedVersion ?? null,
      validated.lastDetectionTimestamp ?? null,
      validated.isAvailable ? 1 : 0
    );
  }

  public list(): AgentConfiguration[] {
    const rows = this.db.prepare('SELECT * FROM agent_configurations ORDER BY display_name ASC').all() as Array<Record<string, unknown>>;
    return rows.map((r) => this.mapRow(r));
  }

  public setPreferred(adapterId: string): void {
    // Unset current preferred
    this.db.prepare('UPDATE agent_configurations SET preferred = 0').run();
    this.db.prepare('UPDATE agent_configurations SET preferred = 1 WHERE adapter_id = ?').run(adapterId);
  }

  private mapRow(row: Record<string, unknown>): AgentConfiguration {
    return AgentConfigurationSchema.parse({
      id: String(row['id']),
      adapterId: String(row['adapter_id']),
      displayName: String(row['display_name']),
      preferred: Boolean(row['preferred']),
      lastDetectedVersion: row['last_detected_version'] ? String(row['last_detected_version']) : undefined,
      lastDetectionTimestamp: row['last_detection_timestamp'] ? String(row['last_detection_timestamp']) : undefined,
      isAvailable: Boolean(row['is_available']),
    });
  }
}
