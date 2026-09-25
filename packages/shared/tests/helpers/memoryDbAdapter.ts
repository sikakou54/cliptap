import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { DbAdapter, DbRunResult } from '../../src/adapters/DbAdapter';

export interface MemoryDbAdapter extends DbAdapter {
  dispose(): void;
}

/** node:sqliteを使う同期インメモリDbAdapter */
export function createMemoryDbAdapter(): MemoryDbAdapter {
  const database = new DatabaseSync(':memory:');

  /* node:sqliteは既定で外部キーを強制するが、実行時のexpo-sqlite / sql.jsは強制しない。
     揃えないと、宣言したON DELETE CASCADEにテストだけが助けられ、
     明示的な連鎖削除の実装漏れを検出できなくなる。
     PRAGMAはトランザクション内では無視されるため、生成直後のここで実行する */
  database.exec('PRAGMA foreign_keys = OFF');

  const bind = (params: unknown[]): SQLInputValue[] => params as SQLInputValue[];

  return {
    async open(): Promise<void> {},
    close(): void {},
    get<T>(sql: string, params: unknown[] = []): T | null {
      return (database.prepare(sql).get(...bind(params)) as T | undefined) ?? null;
    },
    all<T>(sql: string, params: unknown[] = []): T[] {
      return database.prepare(sql).all(...bind(params)) as T[];
    },
    run(sql: string, params: unknown[] = []): DbRunResult {
      const result = database.prepare(sql).run(...bind(params));
      return {
        lastInsertRowId: Number(result.lastInsertRowid),
        changes: Number(result.changes),
      };
    },
    transaction<T>(fn: () => T): T {
      database.exec('BEGIN TRANSACTION');
      try {
        const result = fn();
        database.exec('COMMIT');
        return result;
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    },
    async exec(sql: string): Promise<void> {
      database.exec(sql);
    },
    dispose(): void {
      database.close();
    },
  };
}
