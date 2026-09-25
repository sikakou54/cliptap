import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { DbAdapter, DbRunResult } from '../../src/adapters/DbAdapter';

/**
 * node:sqliteで実ファイルを開くDbAdapter
 *
 * @remarks
 * インポートの一時DBや、バックアップ元のメインDBとして実ファイルを扱うテストで使う。
 */
export class FileDbAdapter implements DbAdapter {
  private database: DatabaseSync | null = null;
  private currentPath: string | null = null;

  async open(path: string): Promise<void> {
    this.close();
    this.database = new DatabaseSync(path);
    this.currentPath = path;
  }

  close(): void {
    this.database?.close();
    this.database = null;
    this.currentPath = null;
  }

  private getDatabase(): DatabaseSync {
    if (!this.database) throw new Error('Database is not open');
    return this.database;
  }

  get<T>(sql: string, params: unknown[] = []): T | null {
    return (this.getDatabase().prepare(sql).get(...params as SQLInputValue[]) as T | undefined) ?? null;
  }

  all<T>(sql: string, params: unknown[] = []): T[] {
    return this.getDatabase().prepare(sql).all(...params as SQLInputValue[]) as T[];
  }

  run(sql: string, params: unknown[] = []): DbRunResult {
    const result = this.getDatabase().prepare(sql).run(...params as SQLInputValue[]);
    return {
      lastInsertRowId: Number(result.lastInsertRowid),
      changes: Number(result.changes),
    };
  }

  transaction<T>(fn: () => T): T {
    const database = this.getDatabase();
    database.exec('BEGIN TRANSACTION');
    try {
      const result = fn();
      database.exec('COMMIT');
      return result;
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }

  async exec(sql: string): Promise<void> {
    this.getDatabase().exec(sql);
  }

  /**
   * 開いているDBファイルをBase64で返す
   *
   * @remarks
   * node:sqliteは既定のロールバックジャーナルで動くため、コミット済みの内容はファイルへ反映済みである。
   */
  async exportAsBase64(): Promise<string> {
    if (!this.currentPath) throw new Error('Database is not open');
    return readFileSync(this.currentPath).toString('base64');
  }
}
