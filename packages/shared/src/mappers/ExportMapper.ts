/**
 * ExportMapper
 *
 * @description
 * 部分エクスポート用の一時データベース操作を担当するMapper。
 * 選択されていないデータの削除処理を行う。
 *
 * @module ExportMapper
 */

import type { DbAdapter } from '../adapters/DbAdapter';

/**
 * 部分エクスポート用の選択ID
 */
export interface ExportSelection {
  snippetIds: string[];
  profileIds: string[];
  variableIds: string[];
  categoryIds: string[];
}

/**
 * SQLプレースホルダーを生成
 * @param count - プレースホルダーの数
 * @returns プレースホルダー文字列 (例: "?,?,?")
 */
const placeholders = (count: number): string =>
  Array.from({ length: count }, () => '?').join(',');

/**
 * ExportMapperクラス
 *
 * @description
 * 部分エクスポート用の一時DB操作を担当する。
 * DbAdapterを使用してプラットフォーム差異を吸収する。
 */
export class ExportMapper {
  private adapter: DbAdapter;

  constructor(adapter: DbAdapter) {
    this.adapter = adapter;
  }

  /**
   * 選択されていないスニペットを削除
   *
   * @param selectedIds - 残すスニペットのID
   * @remarks snippet_profilesも同時に削除（関連データの整合性維持）
   */
  deleteUnselectedSnippets(selectedIds: string[]): void {
    if (selectedIds.length > 0) {
      const ph = placeholders(selectedIds.length);
      this.adapter.run(
        `DELETE FROM snippets WHERE id NOT IN (${ph})`,
        selectedIds
      );
      this.adapter.run(
        `DELETE FROM snippet_profiles WHERE snippetId NOT IN (${ph})`,
        selectedIds
      );
    } else {
      this.adapter.run('DELETE FROM snippets');
      this.adapter.run('DELETE FROM snippet_profiles');
    }
  }

  /**
   * 選択されていないプロファイルを削除
   *
   * @param selectedIds - 残すプロファイルのID
   * @remarks profile_variables, snippet_profilesも同時に削除（関連データの整合性維持）
   */
  deleteUnselectedProfiles(selectedIds: string[]): void {
    if (selectedIds.length > 0) {
      const ph = placeholders(selectedIds.length);
      this.adapter.run(
        `DELETE FROM profiles WHERE id NOT IN (${ph})`,
        selectedIds
      );
      this.adapter.run(
        `DELETE FROM profile_variables WHERE profileId NOT IN (${ph})`,
        selectedIds
      );
      this.adapter.run(
        `DELETE FROM snippet_profiles WHERE profileId NOT IN (${ph})`,
        selectedIds
      );
    } else {
      this.adapter.run('DELETE FROM profiles');
      this.adapter.run('DELETE FROM profile_variables');
      this.adapter.run('DELETE FROM snippet_profiles');
    }
  }

  /**
   * 選択されていないカスタム変数を削除
   *
   * @param selectedIds - 残す変数のID
   * @remarks システム変数は削除対象外。profile_variablesも同時に削除
   */
  deleteUnselectedVariables(selectedIds: string[]): void {
    if (selectedIds.length > 0) {
      const ph = placeholders(selectedIds.length);
      this.adapter.run(
        `DELETE FROM variables WHERE type = 'custom' AND id NOT IN (${ph})`,
        selectedIds
      );
      this.adapter.run(
        `DELETE FROM profile_variables WHERE variableId NOT IN (${ph})`,
        selectedIds
      );
    } else {
      this.adapter.run("DELETE FROM variables WHERE type = 'custom'");
    }
  }

  /**
   * 選択されていないカテゴリを削除
   *
   * @param selectedIds - 残すカテゴリのID
   * @remarks
   * カテゴリ削除時、紐づくスニペットとショートカットのcategoryIdはnullに設定（未分類化）。
   * 未分類化しないと、出力したファイルの中に存在しないカテゴリを指す参照が残る。
   */
  deleteUnselectedCategories(selectedIds: string[]): void {
    if (selectedIds.length > 0) {
      const ph = placeholders(selectedIds.length);
      /* 削除されるカテゴリを参照しているスニペットを未分類化 */
      this.adapter.run(
        `UPDATE snippets SET categoryId = NULL WHERE categoryId IS NOT NULL AND categoryId NOT IN (${ph})`,
        selectedIds
      );
      /* ショートカットも同じカテゴリを共用するため、同じ条件で未分類化する */
      this.adapter.run(
        `UPDATE shortcuts SET categoryId = NULL WHERE categoryId IS NOT NULL AND categoryId NOT IN (${ph})`,
        selectedIds
      );
      this.adapter.run(
        `DELETE FROM categories WHERE id NOT IN (${ph})`,
        selectedIds
      );
    } else {
      this.adapter.run('UPDATE snippets SET categoryId = NULL');
      this.adapter.run('UPDATE shortcuts SET categoryId = NULL');
      this.adapter.run('DELETE FROM categories');
    }
  }

  /**
   * 参照先が部分エクスポート対象外になった関連行を削除し、残る行の参照を外す。
   *
   * 個別削除メソッドの呼び出し順や空配列分岐に依存させず、最後に必ず
   * 関連テーブルの整合性を回復する。
   */
  pruneOrphans(): void {
    this.adapter.run(`
      DELETE FROM profile_variables
      WHERE profileId NOT IN (SELECT id FROM profiles)
         OR variableId NOT IN (SELECT id FROM variables)
    `);
    this.adapter.run(`
      DELETE FROM snippet_profiles
      WHERE snippetId NOT IN (SELECT id FROM snippets)
         OR profileId NOT IN (SELECT id FROM profiles)
    `);
    /* 紐づけがあり、そのすべてが選択外のプロファイルを指すショートカットは本体ごと落とす。
       紐づけだけを落とすと0件になり、全プロファイル向けとして、選択したつもりのない
       プロファイルのショートカット名と値が出力ファイルへ入ってしまう（ProfileMapper.deleteと同じ扱い）。
       はじめから0件（全プロファイル向け）のものは、どのプロファイルを選んでも見えるため残す。
       紐づけを落とした後では「はじめから0件」と「選択外で0件になった」を区別できないため、
       必ず紐づけの削除より前に判定すること */
    this.adapter.run(`
      DELETE FROM shortcuts
      WHERE EXISTS (SELECT 1 FROM shortcut_profiles sp WHERE sp.shortcutId = shortcuts.id)
        AND NOT EXISTS (
          SELECT 1 FROM shortcut_profiles sp
          WHERE sp.shortcutId = shortcuts.id
            AND sp.profileId IN (SELECT id FROM profiles)
        )
    `);
    /* 選択外のプロファイルへの紐づけと、直前で本体を落としたショートカットの紐づけを落とす。
       一部のプロファイルだけ選ばれたショートカットは、選ばれた紐づけだけが残る */
    this.adapter.run(`
      DELETE FROM shortcut_profiles
      WHERE profileId NOT IN (SELECT id FROM profiles)
         OR shortcutId NOT IN (SELECT id FROM shortcuts)
    `);
    /* 親を失った値も掃除する。本体を先に消しているのでこの条件で漏れなく拾える */
    this.adapter.run(`
      DELETE FROM shortcut_values
      WHERE shortcutId NOT IN (SELECT id FROM shortcuts)
    `);
    /* 選択外になったカスタム変数への参照を外し、保存文字列へ戻す
       （deleteUnselectedCategoriesがcategoryIdを未分類化するのと同じ扱い）。
       deleteUnselectedVariablesはvariablesとprofile_variablesしか消さないため、
       残すと出力ファイルに存在しない変数を指す参照が入り、全復元後にその値が
       アプリ・拡張キーボードの両方で例外にならず空文字として解決されてしまう。
       本体ごと落とした値は直前の削除で消えているので、残った値だけを直せばよい。
       エクスポートは現在データのスナップショットであり利用者による編集ではないため、
       メインDBのShortcutMapper.clearVariableReferencesと異なりupdatedAtは更新しない */
    this.adapter.run(`
      UPDATE shortcut_values SET variableId = NULL
      WHERE variableId IS NOT NULL
        AND variableId NOT IN (SELECT id FROM variables)
    `);
  }

  /**
   * 選択されていないデータを一括削除
   *
   * @param selection - 残すデータのID
   */
  deleteUnselectedData(selection: ExportSelection): void {
    this.deleteUnselectedSnippets(selection.snippetIds);
    this.deleteUnselectedProfiles(selection.profileIds);
    this.deleteUnselectedVariables(selection.variableIds);
    this.deleteUnselectedCategories(selection.categoryIds);
    this.pruneOrphans();
  }
}
