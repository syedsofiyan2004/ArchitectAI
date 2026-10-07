import type { DatabaseSync } from 'node:sqlite';
import { ProviderConfiguration, ProviderConfigurationSchema } from '@architectai/domain';

export class ProviderConfigurationStore {
  constructor(private readonly db: DatabaseSync) {}

  public save(config: ProviderConfiguration): void {
    const validated = ProviderConfigurationSchema.parse(config);
    const stmt = this.db.prepare(`
      INSERT INTO provider_configurations (
        id, type, display_name, base_url, model_name, credential_reference,
        enabled, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        type = excluded.type,
        display_name = excluded.display_name,
        base_url = excluded.base_url,
        model_name = excluded.model_name,
        credential_reference = excluded.credential_reference,
        enabled = excluded.enabled,
        updated_at = excluded.updated_at
    `);
    stmt.run(
      validated.id,
      validated.type,
      validated.displayName,
      validated.baseUrl ?? null,
      validated.modelName,
      validated.credentialReference ?? null,
      validated.enabled ? 1 : 0,
      validated.createdAt,
      validated.updatedAt
    );
  }

  public findById(id: string): ProviderConfiguration | null {
    const stmt = this.db.prepare('SELECT * FROM provider_configurations WHERE id = ?');
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.mapRow(row);
  }

  public list(): ProviderConfiguration[] {
    const rows = this.db.prepare('SELECT * FROM provider_configurations ORDER BY created_at ASC').all() as Array<Record<string, unknown>>;
    return rows.map((r) => this.mapRow(r));
  }

  public delete(id: string): void {
    this.db.prepare('DELETE FROM provider_configurations WHERE id = ?').run(id);
  }

  private mapRow(row: Record<string, unknown>): ProviderConfiguration {
    return ProviderConfigurationSchema.parse({
      id: String(row['id']),
      type: row['type'],
      displayName: String(row['display_name']),
      baseUrl: row['base_url'] ? String(row['base_url']) : undefined,
      modelName: String(row['model_name']),
      credentialReference: row['credential_reference'] ? String(row['credential_reference']) : undefined,
      enabled: Boolean(row['enabled']),
      createdAt: String(row['created_at']),
      updatedAt: String(row['updated_at']),
    });
  }
}
