/**
 * ImportMapper
 *
 * @description
 * 全復元のために、一時データベースから業務データを加工せず読み出す共通ロジック。
 * DbAdapterを使用してプラットフォーム差異を吸収する。
 *
 * @module ImportMapper
 */

import type { DbAdapter } from '../adapters/DbAdapter';
import { tableExists } from '../database/migrations';
import type {
  Category,
  Profile,
  ProfileVariable,
  ShortcutProfile,
  ShortcutRow,
  ShortcutValue,
  Snippet,
  SnippetProfile,
  Variable,
} from '../schema';
import type { SystemVariableFormatRow } from './SystemVariableFormatMapper';

export interface FullRestoreData {
  categories: Category[];
  variables: Variable[];
  profiles: Profile[];
  profileVariables: ProfileVariable[];
  snippets: Snippet[];
  snippetProfiles: SnippetProfile[];
  systemVariableFormats: SystemVariableFormatRow[];
  shortcuts: ShortcutRow[];
  shortcutProfiles: ShortcutProfile[];
  shortcutValues: ShortcutValue[];
}

/**
 * ImportMapperクラス
 *
 * @description
 * DbAdapterを使用して、一時データベースから全復元用の業務データを取得する。
 * アダプターは呼び出し元でopen()済みであることを前提とする。
 */
export class ImportMapper {
  private adapter: DbAdapter;

  constructor(adapter: DbAdapter) {
    this.adapter = adapter;
  }

  /**
   * 全復元用に、業務データを加工せず取得する。
   * @returns 一時DBの全業務データ（system_variable_formatsテーブルが無い場合、書式は空配列）
   */
  getFullRestoreData(): FullRestoreData {
    const hasFormats = tableExists(this.adapter, 'system_variable_formats');
    /* 一時DBはprepareImportDatabaseでmigrateImportTempDbの移行と必須テーブル検証を
       通過済みのため、通常は下の3テーブルとも存在する。
       有無の確認は、その経路を通さず直接呼ばれた場合の保険として残している */
    const hasShortcuts = tableExists(this.adapter, 'shortcuts');
    const hasShortcutProfiles = tableExists(this.adapter, 'shortcut_profiles');
    const hasShortcutValues = tableExists(this.adapter, 'shortcut_values');
    /* 本体・紐づけ・値は、本体と紐づけの両テーブルがそろっているときだけ読む（理由は下の読み込み箇所） */
    const canRestoreShortcuts = hasShortcuts && hasShortcutProfiles;

    return {
      categories: this.adapter.all<Category>('SELECT * FROM categories'),
      variables: this.adapter.all<Variable>("SELECT * FROM variables WHERE type = 'custom'"),
      profiles: this.adapter.all<Profile>('SELECT * FROM profiles'),
      profileVariables: this.adapter.all<ProfileVariable>('SELECT * FROM profile_variables'),
      snippets: this.adapter.all<Snippet>('SELECT * FROM snippets'),
      snippetProfiles: this.adapter.all<SnippetProfile>('SELECT * FROM snippet_profiles'),
      systemVariableFormats: hasFormats
        ? this.adapter.all<SystemVariableFormatRow>('SELECT * FROM system_variable_formats')
        : [],
      /* 本体と紐づけは別々の行として逐語で読む（定型文のsnippets / snippet_profilesと同じ分け方）。
         保険のガードに掛かって本体か紐づけのテーブルが無い場合は、本体・紐づけ・値のいずれも読まない。
         紐づけテーブルが無いと限定の区別が失われ、本体だけ戻すと全件が全プロファイル向けに広がるため。
         本体が無いのに紐づけや値だけ戻しても、参照先の無い行になるだけなので同じ条件で揃える */
      shortcuts: canRestoreShortcuts
        ? this.adapter.all<ShortcutRow>('SELECT * FROM shortcuts')
        : [],
      shortcutProfiles: canRestoreShortcuts
        ? this.adapter.all<ShortcutProfile>('SELECT * FROM shortcut_profiles')
        : [],
      shortcutValues:
        canRestoreShortcuts && hasShortcutValues
          ? this.adapter.all<ShortcutValue>('SELECT * FROM shortcut_values')
          : [],
    };
  }
}
