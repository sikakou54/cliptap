import { afterEach, describe, expect, it } from 'vitest';
import { setMainDbAdapter, setTempDbAdapter } from '../../src/adapters/DbAdapter';
import { CREATE_TABLES } from '../../src/database/schema';
import { ImportService } from '../../src/services/ImportService';
import {
  createMemoryDbAdapter,
  type MemoryDbAdapter,
} from '../helpers/memoryDbAdapter';

describe('ImportService full restore', () => {
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

  it('preserves identifiers, timestamps, counts, state and relations', async () => {
    const main = createDatabase();
    const backup = createDatabase();
    setMainDbAdapter(main);
    setTempDbAdapter(backup);

    main.run("INSERT INTO categories VALUES ('old', 'old', NULL, 0, 'old-time')");
    /* 消される側にも、プロファイルへ紐づくショートカットを置く */
    main.run(
      "INSERT INTO profiles VALUES ('old-p', 'old', 1, 1, 0, 0, 'old-time', 'old-time')"
    );
    backup.run("INSERT INTO categories VALUES ('c1', 'category', '#123456', 7, 'c-created')");
    backup.run(
      "INSERT INTO variables VALUES ('v1', 'token', 'custom', 'Token', NULL, 0, 8, 'v-created', 'v-updated')"
    );
    backup.run(
      "INSERT INTO profiles VALUES ('p1', 'profile', 1, 1, 0, 9, 'p-created', 'p-updated')"
    );
    backup.run(
      "INSERT INTO snippets VALUES ('s1', 'title', 'body', 'c1', 1, 42, 's-created', 's-updated')"
    );
    backup.run(
      "INSERT INTO profile_variables VALUES ('pv1', 'p1', 'v1', 'secret', 'pv-created', 'pv-updated')"
    );
    backup.run("INSERT INTO snippet_profiles VALUES ('s1', 'p1')");
    backup.run(
      "INSERT INTO system_variable_formats VALUES ('today', 'yyyy-MM-dd', 'format-updated')"
    );
    main.run(
      "INSERT INTO shortcuts VALUES ('old-sc', NULL, 'old', 0, 'old-time', 'old-time')"
    );
    main.run("INSERT INTO shortcut_profiles VALUES ('old-sc', 'old-p')");
    main.run(
      "INSERT INTO shortcut_values VALUES ('old-sv', 'old-sc', 'old', 'old', 0, 0, 'old-time', 'old-time')"
    );
    backup.run(
      "INSERT INTO shortcuts VALUES ('sc1', 'c1', 'phone', 3, 'sc-created', 'sc-updated')"
    );
    backup.run("INSERT INTO shortcut_profiles VALUES ('sc1', 'p1')");
    backup.run(
      "INSERT INTO shortcut_values VALUES ('sv1', 'sc1', 'mother', '{{token}} 080-0000-0000', 12, 1, 'sv-created', 'sv-updated')"
    );

    await ImportService.importDatabaseFromTempDb('memory');

    expect(main.get('SELECT * FROM categories WHERE id = ?', ['c1'])).toMatchObject({
      sortOrder: 7,
      createdAt: 'c-created',
    });
    expect(main.get('SELECT * FROM variables WHERE id = ?', ['v1'])).toMatchObject({
      valid: 0,
      sortOrder: 8,
      createdAt: 'v-created',
      updatedAt: 'v-updated',
    });
    expect(main.get('SELECT * FROM profiles WHERE id = ?', ['p1'])).toMatchObject({
      isDefault: 1,
      isActive: 1,
      valid: 0,
      sortOrder: 9,
      createdAt: 'p-created',
      updatedAt: 'p-updated',
    });
    expect(main.get('SELECT * FROM snippets WHERE id = ?', ['s1'])).toMatchObject({
      copyWithTitle: 1,
      copyCount: 42,
      createdAt: 's-created',
      updatedAt: 's-updated',
    });
    expect(main.get('SELECT * FROM profile_variables WHERE id = ?', ['pv1'])).toMatchObject({
      value: 'secret',
      createdAt: 'pv-created',
      updatedAt: 'pv-updated',
    });
    expect(main.get('SELECT * FROM snippet_profiles')).toEqual({
      snippetId: 's1',
      profileId: 'p1',
    });
    expect(main.get('SELECT * FROM system_variable_formats')).toEqual({
      variableKey: 'today',
      pattern: 'yyyy-MM-dd',
      updatedAt: 'format-updated',
    });
    expect(main.get('SELECT * FROM shortcuts WHERE id = ?', ['sc1'])).toEqual({
      id: 'sc1',
      /* カテゴリも逐語復元される（カテゴリはショートカットより先に復元されるため参照先が揃う） */
      categoryId: 'c1',
      name: 'phone',
      sortOrder: 3,
      createdAt: 'sc-created',
      updatedAt: 'sc-updated',
    });
    expect(main.get('SELECT * FROM shortcut_values WHERE id = ?', ['sv1'])).toEqual({
      id: 'sv1',
      shortcutId: 'sc1',
      name: 'mother',
      /* 保存した文字列は変数トークンを展開せず逐語で戻る */
      value: '{{token}} 080-0000-0000',
      useCount: 12,
      sortOrder: 1,
      createdAt: 'sv-created',
      updatedAt: 'sv-updated',
    });
    expect(main.get('SELECT id FROM categories WHERE id = ?', ['old'])).toBeNull();
    /* 全復元は既存のショートカットも入れ替える（値だけが取り残されない） */
    /* 紐づけプロファイルは中間テーブルへ復元される */
    expect(main.all('SELECT * FROM shortcut_profiles')).toEqual([
      { shortcutId: 'sc1', profileId: 'p1' },
    ]);
    expect(main.get('SELECT id FROM shortcuts WHERE id = ?', ['old-sc'])).toBeNull();
    expect(main.get('SELECT id FROM shortcut_values WHERE id = ?', ['old-sv'])).toBeNull();
  });

  /**
   * 紐づけ0件（全プロファイル向け）のショートカットも本体と値が戻り、紐づけは元の行だけになる。
   *
   * 紐づけの無い本体を「迷子」として読み飛ばすと、全プロファイル向けのショートカットが復元で消える。
   * 逆に復元時に紐づけを補うと、全プロファイル向けだったものが特定のプロファイル専用に狭まる。
   */
  it('restores shortcuts without profile links and keeps links exactly as backed up', async () => {
    const main = createDatabase();
    const backup = createDatabase();
    setMainDbAdapter(main);
    setTempDbAdapter(backup);

    backup.run(
      "INSERT INTO profiles VALUES ('p1', 'profile', 1, 1, 1, 0, 'p-created', 'p-updated')"
    );
    backup.run(
      "INSERT INTO profiles VALUES ('p2', 'other', 0, 0, 1, 1, 'p-created', 'p-updated')"
    );
    backup.run(
      "INSERT INTO shortcuts VALUES ('sc-linked', NULL, 'linked', 0, 'sc-created', 'sc-updated')"
    );
    backup.run("INSERT INTO shortcut_profiles VALUES ('sc-linked', 'p1')");
    backup.run("INSERT INTO shortcut_profiles VALUES ('sc-linked', 'p2')");
    backup.run(
      "INSERT INTO shortcut_values VALUES ('sv-linked', 'sc-linked', 'value', 'linked-value', 0, 0, 'sv-created', 'sv-updated')"
    );
    backup.run(
      "INSERT INTO shortcuts VALUES ('sc-all', NULL, 'all', 1, 'sc0-created', 'sc0-updated')"
    );
    backup.run(
      "INSERT INTO shortcut_values VALUES ('sv-all', 'sc-all', 'value', 'shared-value', 5, 0, 'sv0-created', 'sv0-updated')"
    );

    await ImportService.importDatabaseFromTempDb('memory');

    expect(main.get('SELECT * FROM shortcuts WHERE id = ?', ['sc-all'])).toEqual({
      id: 'sc-all',
      categoryId: null,
      name: 'all',
      sortOrder: 1,
      createdAt: 'sc0-created',
      updatedAt: 'sc0-updated',
    });
    expect(main.get('SELECT * FROM shortcut_values WHERE id = ?', ['sv-all'])).toMatchObject({
      shortcutId: 'sc-all',
      value: 'shared-value',
      useCount: 5,
    });
    expect(main.all('SELECT id FROM shortcuts ORDER BY id')).toEqual([
      { id: 'sc-all' },
      { id: 'sc-linked' },
    ]);
    expect(main.all('SELECT * FROM shortcut_profiles ORDER BY shortcutId, profileId')).toEqual([
      { shortcutId: 'sc-linked', profileId: 'p1' },
      { shortcutId: 'sc-linked', profileId: 'p2' },
    ]);
  });
});
