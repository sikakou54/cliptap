import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setTempDbAdapter } from '../../src/adapters/DbAdapter';
import { setCryptoAdapter } from '../../src/adapters/CryptoAdapter';
import { setImportAdapter } from '../../src/adapters/ImportAdapter';
import { ImportService } from '../../src/services/ImportService';
import { FileDbAdapter } from '../helpers/fileDbAdapter';

const PASSWORD = 'cliptap';

/** テスト位置を基準に解決する（実行時のcwdへ依存させない） */
const TESTS_ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');

/**
 * 実配布物と実旧版ファイルの両方を対象にする。
 * V6・V7はもう配布していないため、回帰用のfixtureとしてtests配下に保持している。
 */
const STARTER_FILES = [
  join(TESTS_ROOT, 'fixtures/starter/starter_v6_en.cliptap'),
  join(TESTS_ROOT, 'fixtures/starter/starter_v6_ja.cliptap'),
  join(TESTS_ROOT, 'fixtures/starter/starter_v7_en.cliptap'),
  join(TESTS_ROOT, 'fixtures/starter/starter_v7_ja.cliptap'),
  resolve(TESTS_ROOT, '../../../apps/web/public/starter_v8_en.cliptap'),
  resolve(TESTS_ROOT, '../../../apps/web/public/starter_v8_ja.cliptap'),
] as const;

/** node:sqliteで実ファイルを開く一時DBアダプター */
class FileDbAdapter implements DbAdapter {
  private database: DatabaseSync | null = null;

  async open(path: string): Promise<void> {
    this.close();
    this.database = new DatabaseSync(path);
  }

  close(): void {
    this.database?.close();
    this.database = null;
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
}

/** V6とV7で共通する業務データを順序付きで取得する */
function getBusinessData(database: DatabaseSync): Record<string, unknown[]> {
  return {
    categories: database.prepare('SELECT * FROM categories ORDER BY id').all(),
    variables: database.prepare('SELECT * FROM variables ORDER BY id').all(),
    profiles: database.prepare('SELECT * FROM profiles ORDER BY id').all(),
    profileVariables: database.prepare('SELECT * FROM profile_variables ORDER BY id').all(),
    snippets: database.prepare(`
      SELECT id, title, content, categoryId, copyWithTitle, createdAt, updatedAt
      FROM snippets
      ORDER BY id
    `).all(),
    snippetProfiles: database
      .prepare('SELECT * FROM snippet_profiles ORDER BY snippetId, profileId')
      .all(),
  };
}

describe('distributed starter database migration', () => {
  let tempDirectory = '';
  let sourcePath = '';

  beforeAll(() => {
    setCryptoAdapter({
      sha256: async (input: string) => createHash('sha256').update(input).digest('hex'),
    });
  });

  afterEach(() => {
    if (tempDirectory) rmSync(tempDirectory, { recursive: true, force: true });
    tempDirectory = '';
  });

  it.each(STARTER_FILES)('prepares %s without losing business data', async (starterPath) => {
    tempDirectory = mkdtempSync(join(tmpdir(), 'cliptap-starter-migration-'));
    sourcePath = starterPath;

    const exportData = JSON.parse(readFileSync(sourcePath, 'utf8')) as {
      d: string;
      s: number;
    };
    const sourceDbBytes = Buffer.from(
      Buffer.from(exportData.d, 'base64').toString('utf8'),
      'base64'
    );
    const sourceDbPath = join(tempDirectory, `source_${exportData.s}.db`);
    writeFileSync(sourceDbPath, sourceDbBytes);

    const sourceDatabase = new DatabaseSync(sourceDbPath);
    const businessDataBefore = getBusinessData(sourceDatabase);
    sourceDatabase.close();

    setImportAdapter({
      readImportFile: async (path: string) => readFileSync(path, 'utf8'),
      writeTempDatabase: async (tempFileName: string, base64Data: string) => {
        const path = join(tempDirectory, tempFileName);
        writeFileSync(path, Buffer.from(base64Data, 'base64'));
        return path;
      },
      deleteFile: async (path: string) => {
        rmSync(path, { force: true });
      },
    });
    setTempDbAdapter(new FileDbAdapter());

    const preparedDbPath = await ImportService.prepareImportDatabase(PASSWORD, sourcePath);
    expect(basename(preparedDbPath)).toMatch(/^import_temp_[\w-]+\.db$/);

    const preparedDatabase = new DatabaseSync(preparedDbPath);
    expect(getBusinessData(preparedDatabase)).toEqual(businessDataBefore);
    expect(
      preparedDatabase
        .prepare("SELECT name FROM pragma_table_info('snippets') WHERE name = 'copyCount'")
        .get()
    ).toEqual({ name: 'copyCount' });
    expect(
      preparedDatabase
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'system_variable_formats'")
        .get()
    ).toEqual({ name: 'system_variable_formats' });
    expect(
      preparedDatabase
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('shortcuts', 'shortcut_profiles') ORDER BY name")
        .all()
    ).toEqual([{ name: 'shortcut_profiles' }, { name: 'shortcuts' }]);
    preparedDatabase.close();
  });
});
