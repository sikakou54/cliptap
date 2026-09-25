import { afterEach, describe, expect, it } from 'vitest';
import {
  getSchemaVersionFromDb,
  runMigrations,
  tableExists,
} from '../../src/database/migrations';
import { CREATE_INDEXES, CREATE_TABLES, SCHEMA_VERSION } from '../../src/database/schema';
import { DatabaseError, NewerVersionError, VersionMismatchError } from '../../src/errors';
import {
  createMemoryDbAdapter,
  type MemoryDbAdapter,
} from '../helpers/memoryDbAdapter';

describe('runMigrations', () => {
  const databases: MemoryDbAdapter[] = [];

  afterEach(() => databases.splice(0).forEach((db) => db.dispose()));

  const createDatabase = (): MemoryDbAdapter => {
    const db = createMemoryDbAdapter();
    databases.push(db);
    return db;
  };

  const createLegacySystemDb = async (version: 1 | 2): Promise<MemoryDbAdapter> => {
    const db = createDatabase();
    await db.exec(`
      CREATE TABLE categories (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, color TEXT, sortOrder INTEGER DEFAULT 0, createdAt TEXT NOT NULL);
      CREATE TABLE snippets (id TEXT PRIMARY KEY, title TEXT, content TEXT NOT NULL, categoryId TEXT, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);
    `);

    if (version === 2) {
      await db.exec(`
        CREATE TABLE variables (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, type TEXT NOT NULL, label TEXT, icon TEXT, valid INTEGER DEFAULT 1, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);
        CREATE TABLE profiles (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, isActive INTEGER DEFAULT 0, isDefault INTEGER DEFAULT 0, valid INTEGER DEFAULT 1, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);
        CREATE TABLE profile_variables (id TEXT PRIMARY KEY, profileId TEXT NOT NULL, variableId TEXT NOT NULL, value TEXT NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, UNIQUE(profileId, variableId));
        CREATE TABLE snippet_profiles (snippetId TEXT NOT NULL, profileId TEXT NOT NULL, PRIMARY KEY (snippetId, profileId));
      `);
    }

    db.run(
      "INSERT INTO categories VALUES ('c1', 'Category', '#123456', 0, 'created')"
    );
    db.run(
      "INSERT INTO snippets (id, title, content, categoryId, createdAt, updatedAt) VALUES ('s1', 'Title', 'Content', 'c1', 'created', 'updated')"
    );

    await db.exec(`PRAGMA user_version = ${version}`);
    return db;
  };

  it.each([1, 2] as const)('keeps normal startup migration support for V%i', async (version) => {
    const mainDb = createDatabase();
    const systemDb = await createLegacySystemDb(version);

    await runMigrations(mainDb, systemDb, version);

    expect(getSchemaVersionFromDb(systemDb)).toBe(SCHEMA_VERSION);
    expect(tableExists(mainDb, 'system_variable_formats')).toBe(true);
    expect(tableExists(mainDb, 'shortcuts')).toBe(true);
    expect(tableExists(mainDb, 'shortcut_values')).toBe(true);
    expect(
      mainDb
        .all<{ name: string }>("SELECT name FROM pragma_table_info('snippets')")
        .map((column) => column.name)
    ).toContain('copyCount');
    expect(mainDb.get('SELECT * FROM snippets WHERE id = ?', ['s1'])).toMatchObject({
      title: 'Title',
      content: 'Content',
      categoryId: 'c1',
      createdAt: 'created',
      updatedAt: 'updated',
    });
  });

  it('rejects a future database before migration and preserves its user_version', async () => {
    const mainDb = createDatabase();
    const systemDb = createDatabase();
    const futureVersion = SCHEMA_VERSION + 1;
    await systemDb.exec(`PRAGMA user_version = ${futureVersion}`);

    await expect(runMigrations(mainDb, systemDb, futureVersion)).rejects.toBeInstanceOf(
      NewerVersionError
    );

    expect(getSchemaVersionFromDb(systemDb)).toBe(futureVersion);
    expect(
      mainDb.get<{ count: number }>(
        "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table'"
      )?.count
    ).toBe(0);
  });

  it('validates a current-version database without changing its business data', async () => {
    const mainDb = createDatabase();
    const systemDb = createDatabase();
    for (const sql of Object.values(CREATE_TABLES)) await mainDb.exec(sql);
    for (const sql of Object.values(CREATE_INDEXES)) await mainDb.exec(sql);
    mainDb.run(
      "INSERT INTO snippets (id, title, content, categoryId, copyWithTitle, copyCount, createdAt, updatedAt) VALUES ('s1', 'Title', 'Content', NULL, 1, 9, 'created', 'updated')"
    );
    await systemDb.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);

    const rowBefore = mainDb.get('SELECT * FROM snippets WHERE id = ?', ['s1']);
    await runMigrations(mainDb, systemDb, SCHEMA_VERSION);

    expect(mainDb.get('SELECT * FROM snippets WHERE id = ?', ['s1'])).toEqual(rowBefore);
    expect(getSchemaVersionFromDb(systemDb)).toBe(SCHEMA_VERSION);
  });

  it('repairs a derived index missing from a historical current-version workspace', async () => {
    const mainDb = createDatabase();
    const systemDb = createDatabase();
    for (const sql of Object.values(CREATE_TABLES)) await mainDb.exec(sql);
    for (const sql of Object.values(CREATE_INDEXES)) await mainDb.exec(sql);
    await mainDb.exec('DROP INDEX idx_profile_variables_variable');
    mainDb.run(
      "INSERT INTO variables (id, name, type, valid, sortOrder, createdAt, updatedAt) VALUES ('v1', 'variable', 'custom', 1, 0, 'created', 'updated')"
    );
    mainDb.run(
      "INSERT INTO profiles (id, name, isActive, isDefault, valid, sortOrder, createdAt, updatedAt) VALUES ('p1', 'Profile', 1, 1, 1, 0, 'created', 'updated')"
    );
    mainDb.run(
      "INSERT INTO profile_variables VALUES ('pv1', 'p1', 'v1', 'Value', 'created', 'updated')"
    );
    await systemDb.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
    const rowBefore = mainDb.get('SELECT * FROM profile_variables WHERE id = ?', ['pv1']);

    await runMigrations(mainDb, systemDb, SCHEMA_VERSION);

    expect(
      mainDb.get<{ count: number }>(
        "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'index' AND name = 'idx_profile_variables_variable'"
      )?.count
    ).toBe(1);
    expect(mainDb.get('SELECT * FROM profile_variables WHERE id = ?', ['pv1'])).toEqual(
      rowBefore
    );
    expect(getSchemaVersionFromDb(systemDb)).toBe(SCHEMA_VERSION);
  });

  it('does not certify a declared current-version database that lacks the current shape', async () => {
    const mainDb = createDatabase();
    const systemDb = createDatabase();
    await systemDb.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);

    await expect(runMigrations(mainDb, systemDb, SCHEMA_VERSION)).rejects.toBeInstanceOf(
      DatabaseError
    );

    expect(getSchemaVersionFromDb(systemDb)).toBe(SCHEMA_VERSION);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid startup version %s without rewriting user_version',
    async (version) => {
      const mainDb = createDatabase();
      const systemDb = createDatabase();
      await systemDb.exec('PRAGMA user_version = 6');

      await expect(runMigrations(mainDb, systemDb, version)).rejects.toBeInstanceOf(
        VersionMismatchError
      );

      expect(getSchemaVersionFromDb(systemDb)).toBe(6);
    }
  );
});
