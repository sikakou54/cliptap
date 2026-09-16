import { createHash } from 'node:crypto';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { setCryptoAdapter } from '../../src/adapters/CryptoAdapter';
import { setImportAdapter } from '../../src/adapters/ImportAdapter';
import { setTempDbAdapter } from '../../src/adapters/DbAdapter';
import type { DbAdapter } from '../../src/adapters/DbAdapter';
import { ImportService } from '../../src/services/ImportService';
import { SCHEMA_VERSION } from '../../src/database/schema';
import { tableExists } from '../../src/database/migrations';
import { DatabaseError } from '../../src/errors';
import { buildChecksumPayload, buildPasswordHashInput } from '../../src/utils/exportImportUtils';
import {
  createMemoryDbAdapter,
  type MemoryDbAdapter,
} from '../helpers/memoryDbAdapter';

const PASSWORD = 'test';
const lifecycleCalls: string[] = [];

const sha256 = async (input: string): Promise<string> =>
  createHash('sha256').update(input).digest('hex');

/** parseAndValidateのヘッダー検証を通過する最小のSQLiteバイナリを作る */
const createSqliteBytes = (): Uint8Array => {
  const bytes = new Uint8Array(32);
  bytes.set(Buffer.from('SQLite format 3\0', 'binary'));
  return bytes;
};

const encodeDoubleBase64 = (bytes: Uint8Array): string => {
  const base64 = Buffer.from(bytes).toString('base64');
  return Buffer.from(base64, 'utf8').toString('base64');
};

/** 指定スキーマ版のエクスポートファイル（.cliptap）相当のJSONを組み立てる */
async function buildExportJson(schemaVersion: number): Promise<string> {
  const data = {
    s: schemaVersion,
    t: '2026-08-05T00:00:00.000Z',
    h: await sha256(buildPasswordHashInput(PASSWORD, schemaVersion)),
    d: encodeDoubleBase64(createSqliteBytes()),
  };
  return JSON.stringify({ ...data, c: await sha256(buildChecksumPayload(data)) });
}

/**
 * 一時DBアダプターの呼び出し順を記録するラッパー
 *
 * Web（sql.js）はopen()でファイルをメモリへ複製するため、
 * close()より前にpersist()を呼ばないとマイグレーション結果が失われる。
 */
function createRecordingTempDbAdapter(base: MemoryDbAdapter): {
  adapter: DbAdapter;
  calls: string[];
} {
  const calls: string[] = [];

  return {
    calls,
    adapter: {
      ...base,
      async open(path: string): Promise<void> {
        calls.push('open');
        lifecycleCalls.push('open');
        await base.open(path);
      },
      async persist(): Promise<void> {
        calls.push('persist');
        lifecycleCalls.push('persist');
      },
      close(): void {
        calls.push('close');
        lifecycleCalls.push('close');
      },
    },
  };
}

/** V5相当（sortOrderあり・copyCountなし・書式テーブルなし）のスキーマを作る */
async function seedV5Schema(db: MemoryDbAdapter): Promise<void> {
  await db.exec(`
    CREATE TABLE categories (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, color TEXT, sortOrder INTEGER DEFAULT 0, createdAt TEXT NOT NULL);
    CREATE TABLE variables (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, type TEXT NOT NULL, label TEXT, icon TEXT, valid INTEGER DEFAULT 1, sortOrder INTEGER DEFAULT 0, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);
    CREATE TABLE profiles (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, isActive INTEGER DEFAULT 0, isDefault INTEGER DEFAULT 0, valid INTEGER DEFAULT 1, sortOrder INTEGER DEFAULT 0, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);
    CREATE TABLE snippets (id TEXT PRIMARY KEY, title TEXT, content TEXT NOT NULL, categoryId TEXT, copyWithTitle INTEGER DEFAULT 0, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);
    CREATE TABLE profile_variables (id TEXT PRIMARY KEY, profileId TEXT NOT NULL, variableId TEXT NOT NULL, value TEXT NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, UNIQUE(profileId, variableId));
    CREATE TABLE snippet_profiles (snippetId TEXT NOT NULL, profileId TEXT NOT NULL, PRIMARY KEY (snippetId, profileId));
  `);
}

/** V5を起点に、指定した版までのスキーマを作る */
async function seedSchema(db: MemoryDbAdapter, schemaVersion: number): Promise<void> {
  await seedV5Schema(db);
  await db.exec(`
    CREATE INDEX idx_snippets_category ON snippets(categoryId);
    CREATE INDEX idx_snippets_updated ON snippets(updatedAt DESC);
    CREATE INDEX idx_profiles_active ON profiles(isActive DESC);
    CREATE INDEX idx_profile_variables_profile ON profile_variables(profileId);
    CREATE INDEX idx_profile_variables_variable ON profile_variables(variableId);
    CREATE INDEX idx_snippet_profiles_snippet ON snippet_profiles(snippetId);
    CREATE INDEX idx_snippet_profiles_profile ON snippet_profiles(profileId);
  `);

  if (schemaVersion >= 6) {
    await db.exec('ALTER TABLE snippets ADD COLUMN copyCount INTEGER DEFAULT 0');
    await db.exec('CREATE INDEX idx_snippets_copy_count ON snippets(copyCount DESC)');
  }

  if (schemaVersion >= 7) {
    await db.exec(
      'CREATE TABLE system_variable_formats (variableKey TEXT PRIMARY KEY, pattern TEXT NOT NULL, updatedAt TEXT NOT NULL)'
    );
  }

  if (schemaVersion >= 8) {
    await db.exec(`
      CREATE TABLE shortcuts (id TEXT PRIMARY KEY, categoryId TEXT, name TEXT NOT NULL, value TEXT NOT NULL, useCount INTEGER DEFAULT 0, sortOrder INTEGER DEFAULT 0, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE SET NULL);
      CREATE TABLE shortcut_profiles (shortcutId TEXT NOT NULL, profileId TEXT NOT NULL, PRIMARY KEY (shortcutId, profileId), FOREIGN KEY (shortcutId) REFERENCES shortcuts(id) ON DELETE CASCADE, FOREIGN KEY (profileId) REFERENCES profiles(id) ON DELETE CASCADE);
      CREATE INDEX idx_shortcut_profiles_profile ON shortcut_profiles(profileId);
      CREATE INDEX idx_shortcuts_use_count ON shortcuts(useCount DESC);
    `);
  }
}

describe('ImportService.prepareImportDatabase', () => {
  const databases: MemoryDbAdapter[] = [];
  const deletedPaths: string[] = [];
  let currentExportJson = '';

  beforeAll(() => {
    setCryptoAdapter({ sha256 });
    setImportAdapter({
      readImportFile: async () => currentExportJson,
      writeTempDatabase: async (fileName: string) => `/tmp/${fileName}`,
      deleteFile: async (path: string) => {
        lifecycleCalls.push('delete');
        deletedPaths.push(path);
      },
    });
  });

  afterEach(() => {
    databases.splice(0).forEach((db) => db.dispose());
    deletedPaths.splice(0);
    lifecycleCalls.splice(0);
  });

  const prepare = async (
    schemaVersion: number,
    actualSchemaVersion = schemaVersion,
    mutate?: (db: MemoryDbAdapter) => Promise<void>
  ) => {
    currentExportJson = await buildExportJson(schemaVersion);

    const base = createMemoryDbAdapter();
    databases.push(base);
    await seedSchema(base, actualSchemaVersion);
    await mutate?.(base);

    const { adapter, calls } = createRecordingTempDbAdapter(base);
    setTempDbAdapter(adapter);

    await ImportService.prepareImportDatabase(PASSWORD, 'file://backup.cliptap');

    return { base, calls };
  };

  it('persists the migrated temp database before closing it', async () => {
    const { base, calls } = await prepare(5);

    /** 書き戻しをclose()より前に行わないと、開き直した時点で移行結果が失われる */
    expect(calls).toEqual(['open', 'persist', 'close']);

    const snippetColumns = base
      .all<{ name: string }>("SELECT name FROM pragma_table_info('snippets')")
      .map((column) => column.name);
    expect(snippetColumns).toContain('copyCount');
    expect(tableExists(base, 'system_variable_formats')).toBe(true);
    expect(tableExists(base, 'shortcuts')).toBe(true);
    expect(tableExists(base, 'shortcut_profiles')).toBe(true);
  });

  it('persists after validating a file that already matches the current schema version', async () => {
    const { calls } = await prepare(SCHEMA_VERSION);

    expect(calls).toEqual(['open', 'persist', 'close']);
  });

  it('persists a repaired index for a historical current-version export', async () => {
    const { base, calls } = await prepare(SCHEMA_VERSION, SCHEMA_VERSION, async (db) => {
      await db.exec('DROP INDEX idx_profile_variables_variable');
    });

    expect(calls).toEqual(['open', 'persist', 'close']);
    expect(
      base.get<{ count: number }>(
        "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'index' AND name = 'idx_profile_variables_variable'"
      )?.count
    ).toBe(1);
  });

  it('rejects a current-version declaration whose database still has an older shape', async () => {
    await expect(prepare(SCHEMA_VERSION, 5)).rejects.toBeInstanceOf(DatabaseError);
    expect(lifecycleCalls).toEqual(['open', 'close', 'delete']);
    expect(deletedPaths).toHaveLength(1);
    expect(deletedPaths[0]).toMatch(/^\/tmp\/import_temp_[\w-]+\.db$/);
  });
});
