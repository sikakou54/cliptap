import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CREATE_TABLES } from '../../src/database/schema';
import { REPOSITORY_ROOT } from '../helpers/sourceScan';
import {
  createMemoryDbAdapter,
  type MemoryDbAdapter,
} from '../helpers/memoryDbAdapter';

/**
 * ショートカットの表示条件（表示中のプロファイルに紐づくもの＋紐づけ0件のもの）の3実装一致
 *
 * @remarks
 * 一覧はTypeScript版、拡張キーボードはiOS版・Android版がそれぞれSQLを持つ。
 * 条件は文字列として3か所に同じものを置く決まりにしてあり、どれか1つだけが
 * 括弧を落としたり結合へ戻したりしても、ビルドは通り例外にもならず、表示が静かにずれる。
 * そこで、ソース上の文字列の一致を検査したうえで、その文字列の意味をメモリDBで実行して固定する。
 */

/** 3実装が1文字違わず持つ表示条件（`?` は表示中のプロファイルID 1個） */
const VISIBLE_IN_PROFILE_CONDITION =
  '(s.id IN (SELECT sp.shortcutId FROM shortcut_profiles sp WHERE sp.profileId = ?) OR NOT EXISTS (SELECT 1 FROM shortcut_profiles sp2 WHERE sp2.shortcutId = s.id))';

/** リポジトリルートからの各実装のパス */
const SOURCES = {
  typescript: 'packages/shared/src/mappers/ShortcutMapper.ts',
  swift: 'apps/mobile/ios/ClipTapKeyboard/Mappers/ShortcutMapper.swift',
  kotlin: 'apps/mobile/android/app/src/main/java/com/sikakou/cliptap/mappers/ShortcutMapper.kt',
} as const;

/** リポジトリルートからの相対パスでソースを読む */
const readSource = (path: string): string => readFileSync(resolve(REPOSITORY_ROOT, path), 'utf8');

/** 部分文字列の出現回数を数える（重なりは数えない） */
const countOccurrences = (source: string, fragment: string): number =>
  source.split(fragment).length - 1;

/** SQL中のプレースホルダーの数を数える */
const countPlaceholders = (sql: string): number => countOccurrences(sql, '?');

describe('ショートカットの表示条件（3実装の一致）', () => {
  describe('ソース上の表示条件', () => {
    it.each(Object.entries(SOURCES))('%s は表示条件の文字列をちょうど1回だけ持つ', (_name, path) => {
      expect(countOccurrences(readSource(path), VISIBLE_IN_PROFILE_CONDITION)).toBe(1);
    });

    /* 本体と値の2本のクエリが、定数を参照して同じ条件を掛けていること。
       片方だけ直書きに戻すと、上の「ちょうど1回」では検出できない */
    it('iOS版は表示条件の定数を本体と値のクエリで1回ずつ参照する', () => {
      expect(countOccurrences(readSource(SOURCES.swift), '\\(visibleInProfileCondition)')).toBe(2);
    });

    it('Android版は表示条件の定数を本体と値のクエリで1回ずつ参照する', () => {
      expect(countOccurrences(readSource(SOURCES.kotlin), '$VISIBLE_IN_PROFILE_CONDITION')).toBe(2);
    });

    /* 紐づけテーブルとの結合は、0件のものを落とし、複数件のものを重複させる */
    it.each(Object.entries(SOURCES))('%s は紐づけテーブルと結合しない', (_name, path) => {
      const source = readSource(path);
      expect(source).not.toMatch(/INNER\s+JOIN\s+shortcut_profiles/i);
      expect(source).not.toContain('profileTableName) sp');
    });

    /* ショートカット値は変数トークンを未展開のまま保存し、展開は表示と挿入の時点で行う（§8.24）。
       値を丸ごとカスタム変数へ紐づけていた旧仕様の列を、どの実装も読み書きしないこと */
    it.each(Object.entries(SOURCES))('%s はショートカット値の variableId を扱わない', (_name, path) => {
      expect(readSource(path)).not.toContain('variableId');
    });
  });

  describe('表示条件の実行結果', () => {
    let db: MemoryDbAdapter | null = null;

    afterEach(() => {
      db?.dispose();
      db = null;
    });

    /** 標準プロファイル */
    const MAIN = 'profile-main';
    /** 表示中として使うプロファイル */
    const OTHER = 'profile-other';
    /** 絞り込むカテゴリ */
    const CATEGORY = 'c1';

    /** ネイティブと同じ形の本体クエリ */
    const shortcutQuery = (condition: string, categoryCondition: string): string =>
      `SELECT s.id FROM shortcuts s WHERE ${condition} ${categoryCondition} ORDER BY s.sortOrder ASC`;

    /** ネイティブと同じ形の値クエリ（本体とだけ結合し、表示条件とカテゴリで絞る） */
    const valueQuery = (condition: string, categoryCondition: string): string =>
      `SELECT v.shortcutId, v.value
       FROM shortcut_values v
       INNER JOIN shortcuts s ON s.id = v.shortcutId
       WHERE ${condition} ${categoryCondition}
       ORDER BY v.shortcutId ASC, v.sortOrder ASC`;

    /**
     * 表示条件の違いが結果に出るデータを用意する
     *
     * @remarks
     * 表示中（OTHER）から見て、紐づく・0件・紐づかないの各パターンをカテゴリの有無と掛け合わせる。
     */
    const setup = (): MemoryDbAdapter => {
      const adapter = createMemoryDbAdapter();
      db = adapter;
      for (const sql of Object.values(CREATE_TABLES)) void adapter.exec(sql);

      adapter.run("INSERT INTO profiles VALUES (?, 'main', 0, 1, 1, 0, 'now', 'now')", [MAIN]);
      adapter.run("INSERT INTO profiles VALUES (?, 'other', 1, 0, 1, 1, 'now', 'now')", [OTHER]);
      adapter.run("INSERT INTO categories VALUES ('c1', 'work', NULL, 0, 'now')");
      adapter.run("INSERT INTO categories VALUES ('c2', 'home', NULL, 1, 'now')");

      const shortcuts: Array<[id: string, categoryId: string | null, profileIds: string[]]> = [
        /* 表示中に紐づく・c1 */
        ['sc1', 'c1', [OTHER]],
        /* 0件・c1 */
        ['sc2', 'c1', []],
        /* 0件・c2 */
        ['sc3', 'c2', []],
        /* 表示中に紐づく・未分類 */
        ['sc4', null, [OTHER]],
        /* 表示中に紐づく・c2 */
        ['sc5', 'c2', [OTHER, MAIN]],
        /* 表示中に紐づかない・c1 */
        ['sc6', 'c1', [MAIN]],
      ];
      shortcuts.forEach(([id, categoryId, profileIds], index) => {
        adapter.run("INSERT INTO shortcuts VALUES (?, ?, ?, ?, 'now', 'now')", [id, categoryId, id, index]);
        for (const profileId of profileIds) {
          adapter.run('INSERT INTO shortcut_profiles VALUES (?, ?)', [id, profileId]);
        }
        adapter.run(
          "INSERT INTO shortcut_values VALUES (?, ?, ?, 0, 0, 0, 'now', 'now')",
          [`sv-${id}`, id, `stored-${id}`]
        );
      });
      return adapter;
    };

    /** 本体クエリを実行してIDを並び順で返す */
    const selectShortcutIds = (
      adapter: MemoryDbAdapter,
      condition: string,
      categoryId: string | null
    ): string[] => {
      const categoryCondition = categoryId !== null ? 'AND s.categoryId = ?' : '';
      const parameters = categoryId !== null ? [OTHER, categoryId] : [OTHER];
      return adapter
        .all<{ id: string }>(shortcutQuery(condition, categoryCondition), parameters)
        .map((row) => row.id);
    };

    it('表示条件は `?` を1個だけ持ち、外側を括弧で閉じている', () => {
      expect(countPlaceholders(VISIBLE_IN_PROFILE_CONDITION)).toBe(1);
      expect(VISIBLE_IN_PROFILE_CONDITION.startsWith('(')).toBe(true);
      expect(VISIBLE_IN_PROFILE_CONDITION.endsWith(')')).toBe(true);
    });

    it('カテゴリで絞らないと、表示中に紐づくものと0件のものをすべて返す', () => {
      const adapter = setup();

      expect(selectShortcutIds(adapter, VISIBLE_IN_PROFILE_CONDITION, null)).toEqual([
        'sc1',
        'sc2',
        'sc3',
        'sc4',
        'sc5',
      ]);
    });

    it('カテゴリで絞ると、表示中に紐づくものと0件のもののうち、そのカテゴリの2件だけを返す', () => {
      const adapter = setup();

      expect(selectShortcutIds(adapter, VISIBLE_IN_PROFILE_CONDITION, CATEGORY)).toEqual([
        'sc1',
        'sc2',
      ]);
    });

    /**
     * 外側の括弧を外すと、AND が OR より強く結びつき「紐づく OR (0件 AND カテゴリ)」になる。
     * 表示中に紐づくものがカテゴリの絞り込みをすり抜け、別カテゴリや未分類のものまで出る。
     */
    it('外側の括弧を外すとカテゴリの絞り込みが崩れ、結果が変わる', () => {
      const adapter = setup();
      const withoutParentheses = VISIBLE_IN_PROFILE_CONDITION.slice(1, -1);

      const broken = selectShortcutIds(adapter, withoutParentheses, CATEGORY);

      expect(broken).not.toEqual(['sc1', 'sc2']);
      expect(broken).toEqual(['sc1', 'sc2', 'sc4', 'sc5']);
    });

    /**
     * ネイティブの値のクエリは、本体と同じく表示条件とカテゴリだけを束縛する。
     * 値は保存されている文字列のまま返し、変数トークンの展開は取得後にネイティブ側で行う。
     * `?` の数と束縛する配列の長さが一致しないと、SQLiteは足りない分をNULLとして黙って実行する。
     */
    it.each([
      ['カテゴリなし', null, [['sc1', 'stored-sc1'], ['sc2', 'stored-sc2'], ['sc3', 'stored-sc3'], ['sc4', 'stored-sc4'], ['sc5', 'stored-sc5']]],
      ['カテゴリあり', CATEGORY, [['sc1', 'stored-sc1'], ['sc2', 'stored-sc2']]],
    ] as const)('値のクエリ（%s）は `?` の数と束縛の長さが一致し、本体と同じ絞り込みで保存値を返す', (_name, categoryId, expected) => {
      const adapter = setup();
      const categoryCondition = categoryId !== null ? 'AND s.categoryId = ?' : '';
      const parameters = categoryId !== null ? [OTHER, categoryId] : [OTHER];
      const sql = valueQuery(VISIBLE_IN_PROFILE_CONDITION, categoryCondition);
      const valueParameters = [...parameters];

      expect(countPlaceholders(sql)).toBe(valueParameters.length);
      expect(countPlaceholders(shortcutQuery(VISIBLE_IN_PROFILE_CONDITION, categoryCondition))).toBe(
        parameters.length
      );

      const rows = adapter.all<{ shortcutId: string; value: string }>(sql, valueParameters);
      expect(rows.map((row) => [row.shortcutId, row.value])).toEqual(expected);
      /* 値は本体と同じ絞り込みになり、複数に紐づくものも1件だけ返る */
      expect(rows.map((row) => row.shortcutId)).toEqual(
        selectShortcutIds(adapter, VISIBLE_IN_PROFILE_CONDITION, categoryId)
      );
    });
  });
});
