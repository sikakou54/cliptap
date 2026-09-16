import { afterEach, describe, expect, it } from 'vitest';
import {
  getSchemaVersionFromDb,
  migrateV4ToV5,
  migrateV5ToV6,
  migrateV6ToV7,
  migrateV7ToV8,
  migrateImportTempDb,
  tableExists,
} from '../../src/database/migrations';
import { SCHEMA_VERSION } from '../../src/database/schema';
import {
  DatabaseError,
  NewerVersionError,
  VersionMismatchError,
} from '../../src/errors';
import {
  createMemoryDbAdapter,
  type MemoryDbAdapter,
} from '../helpers/memoryDbAdapter';

describe('migrateImportTempDb', () => {
  const databases: MemoryDbAdapter[] = [];

  afterEach(() => databases.splice(0).forEach((db) => db.dispose()));

  const createVersion = async (version: number): Promise<MemoryDbAdapter> => {
    const db = createMemoryDbAdapter();
    databases.push(db);
    const sortOrder = version >= 5 ? ', sortOrder INTEGER DEFAULT 0' : '';
    const copyCount = version >= 6 ? ', copyCount INTEGER DEFAULT 0' : '';
    await db.exec(`
      CREATE TABLE categories (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, color TEXT, sortOrder INTEGER DEFAULT 0, createdAt TEXT NOT NULL);
      CREATE TABLE variables (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, type TEXT NOT NULL, label TEXT, icon TEXT, valid INTEGER DEFAULT 1${sortOrder}, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);
      CREATE TABLE profiles (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, isActive INTEGER DEFAULT 0, isDefault INTEGER DEFAULT 0, valid INTEGER DEFAULT 1${sortOrder}, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);
      CREATE TABLE snippets (id TEXT PRIMARY KEY, title TEXT, content TEXT NOT NULL, categoryId TEXT, copyWithTitle INTEGER DEFAULT 0${copyCount}, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);
      CREATE TABLE profile_variables (id TEXT PRIMARY KEY, profileId TEXT NOT NULL, variableId TEXT NOT NULL, value TEXT NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, UNIQUE(profileId, variableId));
      CREATE TABLE snippet_profiles (snippetId TEXT NOT NULL, profileId TEXT NOT NULL, PRIMARY KEY (snippetId, profileId));
    `);
    if (version >= 7) {
      await db.exec(
        'CREATE TABLE system_variable_formats (variableKey TEXT PRIMARY KEY, pattern TEXT NOT NULL, updatedAt TEXT NOT NULL)'
      );
    }
    if (version >= 8) {
      await db.exec(`
        CREATE TABLE shortcuts (id TEXT PRIMARY KEY, categoryId TEXT, name TEXT NOT NULL, value TEXT NOT NULL, useCount INTEGER DEFAULT 0, sortOrder INTEGER DEFAULT 0, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE SET NULL);
        CREATE TABLE shortcut_profiles (shortcutId TEXT NOT NULL, profileId TEXT NOT NULL, PRIMARY KEY (shortcutId, profileId), FOREIGN KEY (shortcutId) REFERENCES shortcuts(id) ON DELETE CASCADE, FOREIGN KEY (profileId) REFERENCES profiles(id) ON DELETE CASCADE);
      `);
    }
    await db.exec(`
      CREATE INDEX idx_snippets_category ON snippets(categoryId);
      CREATE INDEX idx_snippets_updated ON snippets(updatedAt DESC);
      CREATE INDEX idx_profiles_active ON profiles(isActive DESC);
      CREATE INDEX idx_profile_variables_profile ON profile_variables(profileId);
      CREATE INDEX idx_snippet_profiles_snippet ON snippet_profiles(snippetId);
      CREATE INDEX idx_snippet_profiles_profile ON snippet_profiles(profileId);
    `);
    /** V1→V2実装由来のV3/V4はvariableId側indexを持たなかった */
    if (version >= 5) {
      await db.exec('CREATE INDEX idx_profile_variables_variable ON profile_variables(variableId)');
    }
    if (version >= 6) {
      await db.exec('CREATE INDEX idx_snippets_copy_count ON snippets(copyCount DESC)');
    }
    db.run(
      "INSERT INTO categories (id, name, color, sortOrder, createdAt) VALUES ('c1', 'Category', '#123456', 4, 'created')"
    );
    db.run(
      "INSERT INTO variables (id, name, type, label, icon, valid, createdAt, updatedAt) VALUES ('v1', 'variable', 'custom', 'Variable', NULL, 1, 'created', 'updated')"
    );
    db.run(
      "INSERT INTO profiles (id, name, isActive, isDefault, valid, createdAt, updatedAt) VALUES ('p1', 'Profile', 1, 1, 1, 'created', 'updated')"
    );
    db.run(
      "INSERT INTO snippets (id, title, content, categoryId, copyWithTitle, createdAt, updatedAt) VALUES ('s1', 'Title', 'Content', 'c1', 1, 'created', 'updated')"
    );
    db.run(
      "INSERT INTO profile_variables VALUES ('pv1', 'p1', 'v1', 'Value', 'created', 'updated')"
    );
    db.run("INSERT INTO snippet_profiles VALUES ('s1', 'p1')");
    return db;
  };

  it.each([3, 4, 5, 6, 7, 8])('accepts V%i and produces the current shape', async (version) => {
    const db = await createVersion(version);

    await migrateImportTempDb(db, version);

    expect(db.all<{ name: string }>("SELECT name FROM pragma_table_info('variables')").map((c) => c.name)).toContain(
      'sortOrder'
    );
    expect(db.all<{ name: string }>("SELECT name FROM pragma_table_info('profiles')").map((c) => c.name)).toContain(
      'sortOrder'
    );
    expect(db.all<{ name: string }>("SELECT name FROM pragma_table_info('snippets')").map((c) => c.name)).toContain(
      'copyCount'
    );
    expect(tableExists(db, 'system_variable_formats')).toBe(true);
    expect(tableExists(db, 'shortcuts')).toBe(true);
    expect(tableExists(db, 'shortcut_profiles')).toBe(true);
    expect(
      db.get<{ count: number }>(
        "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'index' AND name = 'idx_profile_variables_variable'"
      )?.count
    ).toBe(1);
    expect(db.get('SELECT * FROM snippets WHERE id = ?', ['s1'])).toMatchObject({
      title: 'Title',
      content: 'Content',
      categoryId: 'c1',
      copyWithTitle: 1,
      copyCount: 0,
      createdAt: 'created',
      updatedAt: 'updated',
    });
    expect(db.get('SELECT * FROM profile_variables WHERE id = ?', ['pv1'])).toEqual({
      id: 'pv1',
      profileId: 'p1',
      variableId: 'v1',
      value: 'Value',
      createdAt: 'created',
      updatedAt: 'updated',
    });
    expect(db.get('SELECT * FROM snippet_profiles WHERE snippetId = ?', ['s1'])).toEqual({
      snippetId: 's1',
      profileId: 'p1',
    });
  });

  it('repairs the variableId index omitted by the historical V1 to V3 path', async () => {
    const db = await createVersion(3);
    expect(
      db.get<{ count: number }>(
        "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'index' AND name = 'idx_profile_variables_variable'"
      )?.count
    ).toBe(0);

    await migrateImportTempDb(db, 3);

    expect(
      db.get<{ count: number }>(
        "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'index' AND name = 'idx_profile_variables_variable'"
      )?.count
    ).toBe(1);
  });

  it('treats an already-current database as a no-op', async () => {
    const db = await createVersion(SCHEMA_VERSION);
    /* 派生indexは移行完了時の後処理が作るため、比較前に一度通しておく */
    await migrateImportTempDb(db, SCHEMA_VERSION);
    const schemaBefore = db.all<{ name: string; sql: string }>(
      "SELECT name, sql FROM sqlite_master WHERE type IN ('table', 'index') ORDER BY name"
    );

    await migrateImportTempDb(db, SCHEMA_VERSION);

    expect(db.all(
      "SELECT name, sql FROM sqlite_master WHERE type IN ('table', 'index') ORDER BY name"
    )).toEqual(schemaBefore);
  });

  it.each([2, 0, -1, 3.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects unsupported import version %s before migration',
    async (version) => {
      const db = await createVersion(3);

      await expect(migrateImportTempDb(db, version)).rejects.toBeInstanceOf(
        VersionMismatchError
      );

      expect(tableExists(db, 'system_variable_formats')).toBe(false);
    }
  );

  it.each([SCHEMA_VERSION + 1, 99])(
    'rejects future import version V%i without rewriting user_version',
    async (version) => {
      const db = await createVersion(SCHEMA_VERSION);
      await db.exec(`PRAGMA user_version = ${version}`);

      await expect(migrateImportTempDb(db, version)).rejects.toBeInstanceOf(
        NewerVersionError
      );

      expect(getSchemaVersionFromDb(db)).toBe(version);
    }
  );

  it('rejects a declared current database with an older shape instead of guessing a migration', async () => {
    const db = await createVersion(SCHEMA_VERSION - 1);

    await expect(migrateImportTempDb(db, SCHEMA_VERSION)).rejects.toBeInstanceOf(DatabaseError);

    expect(tableExists(db, 'shortcuts')).toBe(false);
  });

  /**
   * 移行段の選択は宣言バージョンだけで行うため、V7を名乗るファイルには移行が1段も走らない。
   * その結果テーブルが欠けたままなら、取り込んだ後の全操作が壊れるので手前で明示的に失敗させる。
   */
  it('rejects a declared current database missing a required table', async () => {
    const db = await createVersion(SCHEMA_VERSION);
    await db.exec('DROP TABLE system_variable_formats');

    await expect(migrateImportTempDb(db, SCHEMA_VERSION)).rejects.toBeInstanceOf(DatabaseError);
  });

  it('repairs a derived index missing from a historical current-version export', async () => {
    const db = await createVersion(SCHEMA_VERSION);
    await db.exec('DROP INDEX idx_profile_variables_variable');
    const rowBefore = db.get('SELECT * FROM profile_variables WHERE id = ?', ['pv1']);

    await migrateImportTempDb(db, SCHEMA_VERSION);

    expect(
      db.get<{ count: number }>(
        "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'index' AND name = 'idx_profile_variables_variable'"
      )?.count
    ).toBe(1);
    expect(db.get('SELECT * FROM profile_variables WHERE id = ?', ['pv1'])).toEqual(
      rowBefore
    );
  });

  /**
   * リリース済みのV4→V5は、sortOrder列が既にある場合に並び順へ触れてはならない。
   * 列がある＝利用者が並べ替えた後なので、再計算すると利用者の表示順を失う。
   */
  it('keeps the existing display order when the V5 columns are already present', async () => {
    const db = await createVersion(5);
    db.run("UPDATE variables SET sortOrder = 5 WHERE id = 'v1'");
    db.run("UPDATE profiles SET sortOrder = 9 WHERE id = 'p1'");
    db.run(
      "INSERT INTO variables (id, name, type, valid, sortOrder, createdAt, updatedAt) VALUES ('v2', 'later', 'custom', 1, 2, 'later', 'later')"
    );
    db.run(
      "INSERT INTO profiles (id, name, isActive, isDefault, valid, sortOrder, createdAt, updatedAt) VALUES ('p2', 'Later', 0, 0, 1, 3, 'later', 'later')"
    );

    await migrateV4ToV5(db);

    expect(db.all('SELECT id, sortOrder FROM variables ORDER BY id')).toEqual([
      { id: 'v1', sortOrder: 5 },
      { id: 'v2', sortOrder: 2 },
    ]);
    expect(db.all('SELECT id, sortOrder FROM profiles ORDER BY id')).toEqual([
      { id: 'p1', sortOrder: 9 },
      { id: 'p2', sortOrder: 3 },
    ]);
  });

  /** V5→V6も列が既にある場合は何も変更しない。indexは移行完了時の後処理が補完する */
  it('leaves an existing copyCount column untouched', async () => {
    const db = await createVersion(6);
    db.run("UPDATE snippets SET copyCount = 4 WHERE id = 's1'");

    await migrateV5ToV6(db);

    expect(db.get('SELECT copyCount FROM snippets WHERE id = ?', ['s1'])).toEqual({
      copyCount: 4,
    });
  });

  /** V6→V7は書式設定テーブルを追加する。列構成は現行スキーマ定義と一致していなければならない */
  it('creates the system variable format table on a V6 database', async () => {
    const db = await createVersion(6);

    await migrateV6ToV7(db);

    expect(
      db
        .all<{ name: string }>("SELECT name FROM pragma_table_info('system_variable_formats')")
        .map((c) => c.name)
    ).toEqual(['variableKey', 'pattern', 'updatedAt']);
  });

  /** V7→V8はショートカットと紐づけのテーブルを追加する。列構成は現行スキーマ定義と一致していなければならない */
  it('creates the shortcut tables on a V7 database', async () => {
    const db = await createVersion(7);

    await migrateV7ToV8(db);

    /* 挿入する値と使用回数は本体の行が持つ（1ショートカット1値） */
    expect(
      db
        .all<{ name: string }>("SELECT name FROM pragma_table_info('shortcuts')")
        .map((c) => c.name)
    ).toEqual([
      'id',
      'categoryId',
      'name',
      'value',
      'useCount',
      'sortOrder',
      'createdAt',
      'updatedAt',
    ]);
    /* 所属プロファイルは中間テーブルが持つ */
    expect(
      db
        .all<{ name: string }>("SELECT name FROM pragma_table_info('shortcut_profiles')")
        .map((c) => c.name)
    ).toEqual(['shortcutId', 'profileId']);
    /* 値を別テーブルへ分ける旧構造には戻さない */
    expect(tableExists(db, 'shortcut_values')).toBe(false);
  });

  /** 既にテーブルがあるDBへ再実行しても、保存済みのショートカットを作り直してはならない */
  it('keeps existing rows when the shortcut tables already exist', async () => {
    const db = await createVersion(8);
    db.run(
      "INSERT INTO shortcuts VALUES ('sc1', NULL, 'Phone', '080-0000-0000', 3, 0, 'created', 'updated')"
    );
    db.run("INSERT INTO shortcut_profiles VALUES ('sc1', 'p1')");

    await migrateV7ToV8(db);

    expect(db.all('SELECT * FROM shortcuts')).toEqual([
      {
        id: 'sc1',
        categoryId: null,
        name: 'Phone',
        value: '080-0000-0000',
        useCount: 3,
        sortOrder: 0,
        createdAt: 'created',
        updatedAt: 'updated',
      },
    ]);
    expect(db.all('SELECT * FROM shortcut_profiles')).toEqual([
      { shortcutId: 'sc1', profileId: 'p1' },
    ]);
  });

  /** 既にテーブルがあるDBへ再実行しても、保存済みの書式を作り直してはならない */
  it('keeps existing rows when the format table already exists', async () => {
    const db = await createVersion(7);
    db.run(
      "INSERT INTO system_variable_formats VALUES ('date', 'YYYY/MM/DD', 'updated')"
    );

    await migrateV6ToV7(db);

    expect(db.all('SELECT * FROM system_variable_formats')).toEqual([
      { variableKey: 'date', pattern: 'YYYY/MM/DD', updatedAt: 'updated' },
    ]);
  });

  /** 旧実装で作りそこねた派生indexは、移行完了時の後処理で補完される */
  it('creates the V6 index while migrating a database that already has copyCount', async () => {
    const db = await createVersion(6);
    await db.exec('DROP INDEX IF EXISTS idx_snippets_copy_count');

    await migrateImportTempDb(db, 6);

    expect(
      db.get<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_snippets_copy_count'"
      )
    ).toEqual({ name: 'idx_snippets_copy_count' });
  });
});
