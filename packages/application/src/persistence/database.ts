import { DatabaseSync } from 'node:sqlite';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { runMigrations } from './migrations.js';

export interface DatabaseOptions {
  dbPath?: string;
}

export class ProductDatabase {
  private db: DatabaseSync;
  private readonly dbPath: string;

  constructor(options: DatabaseOptions = {}) {
    this.dbPath = options.dbPath || process.env['ARCHITECTAI_DB_PATH'] || path.resolve(process.cwd(), 'data/architectai.db');

    if (this.dbPath !== ':memory:') {
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    this.db = new DatabaseSync(this.dbPath);
    // Initialize schema and run migrations
    this.initialize();
  }

  private initialize(): void {
    // Enable foreign keys, WAL mode, and busy timeout for concurrent robustness
    if (this.dbPath !== ':memory:') {
      this.db.exec('PRAGMA journal_mode = WAL;');
    }
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec('PRAGMA busy_timeout = 5000;');
    runMigrations(this.db);
  }

  public getRawDb(): DatabaseSync {
    return this.db;
  }

  public getDbPath(): string {
    return this.dbPath;
  }

  public exec(sql: string): void {
    this.db.exec(sql);
  }

  public prepare(sql: string) {
    return this.db.prepare(sql);
  }

  public transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN TRANSACTION;');
    try {
      const result = fn();
      this.db.exec('COMMIT;');
      return result;
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }
  }

  public close(): void {
    this.db.close();
  }
}
