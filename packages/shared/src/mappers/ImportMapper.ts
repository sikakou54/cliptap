/**
 * ImportMapper
 *
 * @description
 * 一時データベースからインポート候補を取得する共通ロジック。
 * DbAdapterを使用してプラットフォーム差異を吸収する。
 *
 * @module ImportMapper
 */

import type {
  ImportCandidates,
  ImportCandidateSnippet,
  ImportCandidateSnippetProfile,
  ImportCandidateProfile,
  ImportCandidateVariable,
  ImportCandidateCategory,
  ImportCandidateVariableProfileValue,
} from '../schema';
import type {
  ProfileVariableRow,
  SnippetProfileRow,
  SnippetImportRow,
  ProfileImportRow,
  VariableImportRow,
} from './IImportMapper';
import type { DbAdapter } from '../adapters/DbAdapter';
import { tableExists } from '../database/migrations';
import type {
  Category,
  Profile,
  ProfileVariable,
  ShortcutProfile,
  ShortcutRow,
  ShortcutValueRow,
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
  shortcutValues: ShortcutValueRow[];
}

/**
 * SQLプレースホルダーを生成
 * @param count - プレースホルダーの数
 * @returns プレースホルダー文字列 (例: "?,?,?")
 */
const placeholders = (count: number): string =>
  Array.from({ length: count }, () => '?').join(',');

/**
 * ImportMapperクラス
 *
 * @description
 * DbAdapterを使用してインポート候補データを取得する。
 * 一時データベースからインポート候補を取得する共通ロジック。
 * アダプターは呼び出し元でopen()済みであることを前提とする。
 */
export class ImportMapper {
  private adapter: DbAdapter;

  constructor(adapter: DbAdapter) {
    this.adapter = adapter;
  }

  /**
   * インポート選択画面に表示する候補を一時DBから組み立てる
   * @returns スニペット・プロファイル・変数・カテゴリの候補一覧
   */
  getAllCandidates(): ImportCandidates {
    /* 1. スニペットの取得（プロファイル紐付き情報は後で追加） */
    /* LEFT JOINで未分類スニペットも含む */
    const snippetsRaw = this.adapter.all<Omit<ImportCandidateSnippet, 'profiles'>>(`
      SELECT
        s.id, s.title, s.content, s.updatedAt,
        c.name as categoryName
      FROM snippets s
      LEFT JOIN categories c ON s.categoryId = c.id
      ORDER BY s.updatedAt DESC
    `);

    /* 各スニペットに紐づくプロファイルを1回のクエリでまとめて取得する */
    /* LEFT JOINでプロファイルが削除されている場合も対応 */
    /* ORDER BYはスニペット単位で引いていた頃の並び（snippet_profilesの主キー順）を保つため */
    const snippetProfileRows = this.adapter.all<
      ImportCandidateSnippetProfile & { snippetId: string }
    >(`
      SELECT
        sp.snippetId,
        sp.profileId,
        p.name as profileName
      FROM snippet_profiles sp
      LEFT JOIN profiles p ON sp.profileId = p.id
      ORDER BY sp.snippetId, sp.profileId
    `);

    const profilesBySnippet = new Map<string, ImportCandidateSnippetProfile[]>();
    for (const row of snippetProfileRows) {
      const entries = profilesBySnippet.get(row.snippetId) ?? [];
      entries.push({ profileId: row.profileId, profileName: row.profileName });
      profilesBySnippet.set(row.snippetId, entries);
    }

    const snippets: ImportCandidateSnippet[] = snippetsRaw.map((s) => ({
      ...s,
      profiles: profilesBySnippet.get(s.id) ?? [],
    }));

    /* 2. プロファイルの取得 */
    /* sortOrder順で表示 */
    const profiles = this.adapter.all<ImportCandidateProfile>(`
      SELECT id, name, isDefault, sortOrder, updatedAt
      FROM profiles
      ORDER BY sortOrder ASC
    `);

    /* 3. 変数の取得（プロファイル値含む） */
    /* カスタム変数のみ取得（システム変数は除外） */
    const variablesRaw = this.adapter.all<Omit<ImportCandidateVariable, 'profileValues'>>(`
      SELECT id, name, label, icon, sortOrder, updatedAt
      FROM variables
      WHERE type = 'custom'
      ORDER BY sortOrder ASC
    `);

    /* 各変数のプロファイルごとの値を取得 */
    const variables = this.attachProfileValues(variablesRaw);

    /* 4. カテゴリの取得 */
    /* sortOrderが設定されている場合はそれで、なければ名前順 */
    const categories = this.adapter.all<ImportCandidateCategory>(`
      SELECT id, name, color, sortOrder, createdAt
      FROM categories
      ORDER BY sortOrder ASC
    `);

    return {
      snippets,
      profiles,
      variables,
      categories,
    };
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
          ? this.adapter.all<ShortcutValueRow>('SELECT * FROM shortcut_values')
          : [],
    };
  }

  /**
   * 選択されたIDのカテゴリだけを取り込み対象として取得する
   * @param ids - 取り込むカテゴリID（空配列なら空配列を返す）
   * @returns 該当するカテゴリ行
   */
  getCategories(ids: string[]): ImportCandidateCategory[] {
    if (ids.length === 0) return [];

    /* createdAtを含めて取得 */
    return this.adapter.all(
      `SELECT id, name, color, sortOrder, createdAt FROM categories WHERE id IN (${placeholders(ids.length)})`,
      ids
    );
  }

  /**
   * 選択されたIDの変数だけを取り込み対象として取得する
   * @param ids - 取り込む変数ID（空配列なら空配列を返す）
   * @returns 該当する変数行
   * @description
   * プロファイルごとの値は取り込み時にgetProfileVariables()でまとめて取得するため、ここでは添えない。
   */
  getVariables(ids: string[]): VariableImportRow[] {
    if (ids.length === 0) return [];

    /* createdAt/updatedAt/sortOrderを含めて取得 */
    return this.adapter.all(
      `SELECT id, name, label, icon, type, valid, sortOrder, createdAt, updatedAt FROM variables WHERE id IN (${placeholders(ids.length)})`,
      ids
    );
  }

  /**
   * 選択されたIDのプロファイルだけを取り込み対象として取得する
   * @param ids - 取り込むプロファイルID（空配列なら空配列を返す）
   * @returns 該当するプロファイル行
   */
  getProfiles(ids: string[]): ProfileImportRow[] {
    if (ids.length === 0) return [];

    /* createdAt/updatedAt/sortOrderを含めて取得 */
    return this.adapter.all(
      `SELECT id, name, isDefault, isActive, valid, sortOrder, createdAt, updatedAt FROM profiles WHERE id IN (${placeholders(ids.length)})`,
      ids
    );
  }

  /**
   * 一時DBのプロファイルを選択有無に関わらず全件取得する
   * @returns 一時DBの全プロファイル行
   * @description
   * ImportServiceのprepareExistingProfileMappingが、既存プロファイルと同名のものを
   * 突き合わせるために使う。選択されたものだけを取り込むgetProfiles()とは用途が異なる。
   */
  getAllProfiles(): ProfileImportRow[] {
    return this.adapter.all('SELECT * FROM profiles');
  }

  /**
   * 一時DBのカテゴリを選択有無に関わらず全件取得する
   * @returns 一時DBの全カテゴリ行
   * @description
   * ImportServiceのprepareExistingCategoryMappingが、既存カテゴリと同名のものを
   * 突き合わせるために使う。選択されたものだけを取り込むgetCategories()とは用途が異なる。
   */
  getAllCategories(): ImportCandidateCategory[] {
    return this.adapter.all('SELECT * FROM categories');
  }

  /**
   * 選択された変数とプロファイルの組み合わせに対応する値を取得する
   * @param variableIds - 取り込む変数ID（空配列なら空配列を返す）
   * @param profileIds - 取り込むプロファイルID（空配列なら空配列を返す）
   * @returns 該当するプロファイル変数行
   */
  getProfileVariables(
    variableIds: string[],
    profileIds: string[]
  ): ProfileVariableRow[] {
    if (variableIds.length === 0 || profileIds.length === 0) return [];

    /* 指定された変数IDとプロファイルIDの組み合わせで変数値を取得 */
    /* 例: variableId IN (1,2) AND profileId IN (A,B) → 4つの組み合わせのうち存在するものを返す */
    return this.adapter.all(
      `SELECT * FROM profile_variables WHERE variableId IN (${placeholders(variableIds.length)}) AND profileId IN (${placeholders(profileIds.length)})`,
      [...variableIds, ...profileIds]
    );
  }

  /**
   * 選択されたIDのスニペットだけを取り込み対象として取得する
   * @param ids - 取り込むスニペットID（空配列なら空配列を返す）
   * @returns 該当するスニペット行（カテゴリ名を含む）
   */
  getSnippets(ids: string[]): SnippetImportRow[] {
    if (ids.length === 0) return [];

    /* LEFT JOINで未分類スニペットも含む */
    return this.adapter.all(
      `
      SELECT
        s.id, s.title, s.content, s.copyWithTitle, s.copyCount, s.categoryId,
        s.createdAt, s.updatedAt,
        c.name as categoryName
      FROM snippets s
      LEFT JOIN categories c ON s.categoryId = c.id
      WHERE s.id IN (${placeholders(ids.length)})
    `,
      ids
    );
  }

  /**
   * 選択されたスニペットに紐づくプロファイル関連を取得する
   * @param snippetIds - 取り込むスニペットID（空配列なら空配列を返す）
   * @returns 該当するスニペット・プロファイル関連行
   */
  getSnippetProfiles(snippetIds: string[]): SnippetProfileRow[] {
    if (snippetIds.length === 0) return [];

    return this.adapter.all(
      `SELECT snippetId, profileId FROM snippet_profiles WHERE snippetId IN (${placeholders(snippetIds.length)})`,
      snippetIds
    );
  }

  /**
   * 変数行に、各プロファイルでの値をぶら下げてインポート候補の形にする
   * @param rows - profileValuesを持たない変数行
   * @returns profileValuesを付与したインポート候補の変数一覧
   * @description
   * 値は変数の件数によらず1回のクエリでまとめて取得する。
   * ORDER BYは変数単位で引いていた頃の並び（変数ごとに挿入順）を保つため。
   */
  private attachProfileValues(
    rows: Array<Omit<ImportCandidateVariable, 'profileValues'>>
  ): ImportCandidateVariable[] {
    /* LEFT JOINでプロファイルが削除されている場合も対応 */
    const valueRows = this.adapter.all<
      ImportCandidateVariableProfileValue & { variableId: string }
    >(`
      SELECT
        pv.variableId,
        pv.profileId,
        pv.value,
        p.name as profileName
      FROM profile_variables pv
      LEFT JOIN profiles p ON pv.profileId = p.id
      ORDER BY pv.variableId, pv.rowid
    `);

    const valuesByVariable = new Map<string, ImportCandidateVariableProfileValue[]>();
    for (const row of valueRows) {
      const entries = valuesByVariable.get(row.variableId) ?? [];
      entries.push({
        profileId: row.profileId,
        profileName: row.profileName,
        value: row.value,
      });
      valuesByVariable.set(row.variableId, entries);
    }

    return rows.map((v) => ({
      ...v,
      profileValues: valuesByVariable.get(v.id) ?? [],
    }));
  }
}
