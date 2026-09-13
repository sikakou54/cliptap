import { afterEach, describe, expect, it } from 'vitest';
import { CREATE_TABLES } from '../../src/database/schema';
import { ExportMapper, type ExportSelection } from '../../src/mappers/ExportMapper';
import {
  createMemoryDbAdapter,
  type MemoryDbAdapter,
} from '../helpers/memoryDbAdapter';

describe('ExportMapper.deleteUnselectedData', () => {
  let db: MemoryDbAdapter | null = null;

  afterEach(() => {
    db?.dispose();
    db = null;
  });

  const setup = (): MemoryDbAdapter => {
    db = createMemoryDbAdapter();
    for (const sql of Object.values(CREATE_TABLES)) void db.exec(sql);

    db.run("INSERT INTO categories VALUES ('c1', 'category', NULL, 0, 'now')");
    db.run(
      "INSERT INTO snippets VALUES ('s1', 'title', 'body', 'c1', 0, 0, 'now', 'now')"
    );
    db.run(
      "INSERT INTO variables VALUES ('v1', 'custom', 'custom', NULL, NULL, 1, 0, 'now', 'now')"
    );
    db.run(
      "INSERT INTO profiles VALUES ('p1', 'profile', 1, 1, 1, 0, 'now', 'now')"
    );
    db.run("INSERT INTO profile_variables VALUES ('pv1', 'p1', 'v1', 'value', 'now', 'now')");
    db.run("INSERT INTO snippet_profiles VALUES ('s1', 'p1')");
    return db;
  };

  const cases: Array<[string, ExportSelection, number, number]> = [
    [
      'keeps all relations when every owner is selected',
      { snippetIds: ['s1'], profileIds: ['p1'], variableIds: ['v1'], categoryIds: ['c1'] },
      1,
      1,
    ],
    [
      'removes profile-variable relation when no variable is selected',
      { snippetIds: ['s1'], profileIds: ['p1'], variableIds: [], categoryIds: ['c1'] },
      0,
      1,
    ],
    [
      'removes both relations when no profile is selected',
      { snippetIds: ['s1'], profileIds: [], variableIds: ['v1'], categoryIds: ['c1'] },
      0,
      0,
    ],
    [
      'removes snippet-profile relation when no snippet is selected',
      { snippetIds: [], profileIds: ['p1'], variableIds: ['v1'], categoryIds: ['c1'] },
      1,
      0,
    ],
  ];

  it.each(cases)('%s', (_name, selection, profileVariableCount, snippetProfileCount) => {
    const adapter = setup();
    new ExportMapper(adapter).deleteUnselectedData(selection);

    expect(adapter.get<{ count: number }>('SELECT COUNT(*) AS count FROM profile_variables')?.count).toBe(
      profileVariableCount
    );
    expect(adapter.get<{ count: number }>('SELECT COUNT(*) AS count FROM snippet_profiles')?.count).toBe(
      snippetProfileCount
    );
  });

  /**
   * ショートカットを値1件付きで入れ、指定したプロファイルへ紐づける
   *
   * @remarks
   * 値のIDは `sv-` にショートカットIDを続けた形にする。紐づけを渡さなければ0件（全プロファイル向け）。
   */
  const insertShortcut = (
    adapter: MemoryDbAdapter,
    id: string,
    profileIds: readonly string[]
  ): void => {
    adapter.run("INSERT INTO shortcuts VALUES (?, NULL, ?, 0, 'now', 'now')", [id, id]);
    for (const profileId of profileIds) {
      adapter.run('INSERT INTO shortcut_profiles VALUES (?, ?)', [id, profileId]);
    }
    adapter.run(
      "INSERT INTO shortcut_values VALUES (?, ?, 'value', '080', NULL, 0, 0, 'now', 'now')",
      [`sv-${id}`, id]
    );
  };

  /**
   * 選択外プロファイルだけに紐づくショートカットを出力へ残さない。
   *
   * ショートカットは選択軸に含めないが、紐づけ先を1件も選ばなかったものは
   * 紐づけではなく本体ごと落とす必要がある。紐づけだけ外すと0件（全プロファイル向け）に化け、
   * 選択したつもりのないプロファイルのショートカット名と値が出力ファイルへ入る。
   */
  it('removes the shortcuts of unselected profiles', () => {
    const adapter = setup();
    adapter.run("INSERT INTO profiles VALUES ('p2', 'other', 0, 0, 1, 1, 'now', 'now')");
    adapter.run("INSERT INTO shortcuts VALUES ('sc1', NULL, 'phone', 0, 'now', 'now')");
    adapter.run("INSERT INTO shortcut_profiles VALUES ('sc1', 'p1')");
    adapter.run(
      "INSERT INTO shortcut_values VALUES ('sv1', 'sc1', 'mother', '080', NULL, 0, 0, 'now', 'now')"
    );
    adapter.run("INSERT INTO shortcuts VALUES ('sc2', NULL, 'bank', 0, 'now', 'now')");
    adapter.run("INSERT INTO shortcut_profiles VALUES ('sc2', 'p2')");
    adapter.run(
      "INSERT INTO shortcut_values VALUES ('sv2', 'sc2', 'main', '1234567', NULL, 0, 0, 'now', 'now')"
    );

    new ExportMapper(adapter).deleteUnselectedData({
      snippetIds: ['s1'],
      profileIds: ['p1'],
      variableIds: ['v1'],
      categoryIds: ['c1'],
    });

    expect(adapter.all<{ id: string }>('SELECT id FROM shortcuts')).toEqual([{ id: 'sc1' }]);
    expect(adapter.all<{ id: string }>('SELECT id FROM shortcut_values')).toEqual([
      { id: 'sv1' },
    ]);
    expect(adapter.all('SELECT * FROM shortcut_profiles')).toEqual([
      { shortcutId: 'sc1', profileId: 'p1' },
    ]);
  });

  /**
   * 紐づけ0件（全プロファイル向け）のショートカットは、プロファイルの選択によらず残す。
   *
   * 紐づけを先に掃除してから「紐づけの無い本体」を落とす順にすると、
   * 選択外の紐づけを外されたものと元から0件のものが区別できず、0件のものまで出力から消える。
   */
  it.each([
    ['with a profile selected', ['p1']],
    ['with no profile selected', []],
  ])('keeps shortcuts without profile links %s', (_name, profileIds) => {
    const adapter = setup();
    insertShortcut(adapter, 'sc-all', []);

    new ExportMapper(adapter).deleteUnselectedData({
      snippetIds: ['s1'],
      profileIds,
      variableIds: ['v1'],
      categoryIds: ['c1'],
    });

    expect(adapter.all('SELECT id FROM shortcuts')).toEqual([{ id: 'sc-all' }]);
    expect(adapter.all('SELECT id FROM shortcut_values')).toEqual([{ id: 'sv-sc-all' }]);
    expect(adapter.all('SELECT * FROM shortcut_profiles')).toEqual([]);
  });

  /**
   * 紐づけ先の一部だけを選んだショートカットは、本体と値を残し、選ばれた紐づけだけを残す。
   * 選択外の紐づけを残すと、存在しないプロファイルを指す行が出力へ入る。
   */
  it('keeps only the selected links of shortcuts linked to several profiles', () => {
    const adapter = setup();
    adapter.run("INSERT INTO profiles VALUES ('p2', 'other', 0, 0, 1, 1, 'now', 'now')");
    adapter.run("INSERT INTO profiles VALUES ('p3', 'third', 0, 0, 1, 2, 'now', 'now')");
    insertShortcut(adapter, 'sc-multi', ['p1', 'p2', 'p3']);

    new ExportMapper(adapter).deleteUnselectedData({
      snippetIds: ['s1'],
      profileIds: ['p1', 'p3'],
      variableIds: ['v1'],
      categoryIds: ['c1'],
    });

    expect(adapter.all('SELECT id FROM shortcuts')).toEqual([{ id: 'sc-multi' }]);
    expect(adapter.all('SELECT id FROM shortcut_values')).toEqual([{ id: 'sv-sc-multi' }]);
    expect(
      adapter.all('SELECT * FROM shortcut_profiles ORDER BY profileId')
    ).toEqual([
      { shortcutId: 'sc-multi', profileId: 'p1' },
      { shortcutId: 'sc-multi', profileId: 'p3' },
    ]);
  });

  /** 複数に紐づいていても、紐づけ先を1件も選ばなければ本体・値ごと落とす */
  it('removes shortcuts linked to several profiles when none of them is selected', () => {
    const adapter = setup();
    adapter.run("INSERT INTO profiles VALUES ('p2', 'other', 0, 0, 1, 1, 'now', 'now')");
    adapter.run("INSERT INTO profiles VALUES ('p3', 'third', 0, 0, 1, 2, 'now', 'now')");
    insertShortcut(adapter, 'sc-multi', ['p2', 'p3']);

    new ExportMapper(adapter).deleteUnselectedData({
      snippetIds: ['s1'],
      profileIds: ['p1'],
      variableIds: ['v1'],
      categoryIds: ['c1'],
    });

    expect(adapter.all('SELECT id FROM shortcuts')).toEqual([]);
    expect(adapter.all('SELECT id FROM shortcut_values')).toEqual([]);
    expect(adapter.all('SELECT * FROM shortcut_profiles')).toEqual([]);
  });

  /** プロファイルを1件も選ばなかった場合はショートカットも残らない */
  it('removes every shortcut when no profile is selected', () => {
    const adapter = setup();
    adapter.run("INSERT INTO shortcuts VALUES ('sc1', NULL, 'phone', 0, 'now', 'now')");
    adapter.run("INSERT INTO shortcut_profiles VALUES ('sc1', 'p1')");
    adapter.run(
      "INSERT INTO shortcut_values VALUES ('sv1', 'sc1', 'mother', '080', NULL, 0, 0, 'now', 'now')"
    );

    new ExportMapper(adapter).deleteUnselectedData({
      snippetIds: ['s1'],
      profileIds: [],
      variableIds: ['v1'],
      categoryIds: ['c1'],
    });

    expect(adapter.all('SELECT id FROM shortcuts')).toEqual([]);
    expect(adapter.all('SELECT id FROM shortcut_values')).toEqual([]);
  });

  /**
   * 選択外になったカスタム変数への参照を出力へ残さない。
   *
   * 残すと出力ファイルに存在しない変数を指す参照が入り、全復元した値が
   * 例外にならず空文字として解決されてしまう。
   * 参照を外しても保存文字列は残り、解除後の値として使われる。
   * エクスポートは現在データのスナップショットなのでupdatedAtは変えない。
   */
  it('clears references to unselected variables and keeps the stored value', () => {
    const adapter = setup();
    adapter.run("INSERT INTO shortcuts VALUES ('sc1', NULL, 'phone', 0, 'now', 'now')");
    adapter.run("INSERT INTO shortcut_profiles VALUES ('sc1', 'p1')");
    adapter.run(
      "INSERT INTO shortcut_values VALUES ('sv1', 'sc1', 'mother', 'stored-080', 'v1', 0, 0, 'now', 'now')"
    );

    new ExportMapper(adapter).deleteUnselectedData({
      snippetIds: ['s1'],
      profileIds: ['p1'],
      variableIds: [],
      categoryIds: ['c1'],
    });

    expect(
      adapter.all<{ id: string; value: string; variableId: string | null; updatedAt: string }>(
        'SELECT id, value, variableId, updatedAt FROM shortcut_values'
      )
    ).toEqual([{ id: 'sv1', value: 'stored-080', variableId: null, updatedAt: 'now' }]);
  });
});
