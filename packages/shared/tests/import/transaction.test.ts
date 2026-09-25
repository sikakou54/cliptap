import { afterEach, describe, expect, it } from 'vitest';
import { setMainDbAdapter, setTempDbAdapter } from '../../src/adapters/DbAdapter';
import { CREATE_TABLES } from '../../src/database/schema';
import { ImportService } from '../../src/services/ImportService';
import {
  createMemoryDbAdapter,
  type MemoryDbAdapter,
} from '../helpers/memoryDbAdapter';

describe('ImportService transactions', () => {
  const databases: MemoryDbAdapter[] = [];

  afterEach(() => {
    databases.splice(0).forEach((db) => db.dispose());
  });

  const createDatabase = (): MemoryDbAdapter => {
    const db = createMemoryDbAdapter();
    databases.push(db);
    for (const sql of Object.values(CREATE_TABLES)) void db.exec(sql);
    return db;
  };

  it('rolls back a full restore when a later insert fails', async () => {
    const main = createDatabase();
    const backup = createDatabase();
    setMainDbAdapter(main);
    setTempDbAdapter(backup);

    main.run("INSERT INTO categories VALUES ('old', 'old', NULL, 0, 'old-time')");
    await main.exec(`
      CREATE TRIGGER reject_bad_snippet
      BEFORE INSERT ON snippets
      WHEN NEW.id = 'bad'
      BEGIN
        SELECT RAISE(ABORT, 'forced restore failure');
      END;
    `);
    backup.run("INSERT INTO categories VALUES ('new', 'new', NULL, 0, 'new-time')");
    backup.run(
      "INSERT INTO snippets VALUES ('bad', 'bad', 'body', 'new', 0, 0, 'new-time', 'new-time')"
    );

    await expect(ImportService.importDatabaseFromTempDb('memory')).rejects.toThrow();

    expect(main.all('SELECT id FROM categories ORDER BY id')).toEqual([{ id: 'old' }]);
    expect(main.all('SELECT id FROM snippets')).toEqual([]);
  });
});
