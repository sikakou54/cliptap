/**
 * ClipTap SQLiteスキーマ定義（Mobile/Web共通）
 *
 * テーブル作成SQL、インデックス作成SQL、テーブル削除SQLを提供。
 */

/**
 * データベーススキーマバージョン
 */
export const SCHEMA_VERSION = 8;

/** インポートで受け付ける最古のスキーマバージョン */
export const MIN_SUPPORTED_SCHEMA_VERSION = 3;

/**
 * テーブル作成SQL定義
 */
export const CREATE_TABLES = {
  /**
   * カテゴリテーブル
   */
  categories: `
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      color TEXT,
      sortOrder INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL
    );
  `,

  /**
   * スニペットテーブル
   */
  snippets: `
    CREATE TABLE IF NOT EXISTS snippets (
      id TEXT PRIMARY KEY,
      title TEXT,
      content TEXT NOT NULL,
      categoryId TEXT,
      copyWithTitle INTEGER DEFAULT 0,
      copyCount INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE SET NULL
    );
  `,

  /**
   * カスタム変数テーブル
   */
  variables: `
    CREATE TABLE IF NOT EXISTS variables (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL,
      label TEXT,
      icon TEXT,
      valid INTEGER DEFAULT 1,
      sortOrder INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `,

  /**
   * プロファイルテーブル
   */
  profiles: `
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      isActive INTEGER DEFAULT 0,
      isDefault INTEGER DEFAULT 0,
      valid INTEGER DEFAULT 1,
      sortOrder INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `,

  /**
   * プロファイル変数値テーブル
   */
  profileVariables: `
    CREATE TABLE IF NOT EXISTS profile_variables (
      id TEXT PRIMARY KEY,
      profileId TEXT NOT NULL,
      variableId TEXT NOT NULL,
      value TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (profileId) REFERENCES profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (variableId) REFERENCES variables(id) ON DELETE CASCADE,
      UNIQUE(profileId, variableId)
    );
  `,

  /**
   * スニペット-プロファイル関連テーブル（多対多）
   */
  snippetProfiles: `
    CREATE TABLE IF NOT EXISTS snippet_profiles (
      snippetId TEXT NOT NULL,
      profileId TEXT NOT NULL,
      PRIMARY KEY (snippetId, profileId),
      FOREIGN KEY (snippetId) REFERENCES snippets(id) ON DELETE CASCADE,
      FOREIGN KEY (profileId) REFERENCES profiles(id) ON DELETE CASCADE
    );
  `,

  /**
   * システム変数の書式設定テーブル
   */
  systemVariableFormats: `
    CREATE TABLE IF NOT EXISTS system_variable_formats (
      variableKey TEXT PRIMARY KEY,
      pattern TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `,

  /**
   * ショートカットテーブル
   *
   * @remarks
   * 紐づくプロファイルは shortcut_profiles で表す。定型文と同じ中間テーブルの形にしてある。
   * 1件のショートカットにつき紐づけは0件以上。0件は全プロファイル向け（snippet_profiles と同じ）。
   *
   * 名前の一意性は紐づくプロファイル内に限るが、紐づけがこのテーブルに無いため複合UNIQUEでは表せない。
   * 重複の判定は ShortcutService が、保存先のいずれかのプロファイルで同名が見えるか
   * （0件のものは全プロファイルから見える）で行う。
   *
   * カテゴリは定型文と同じcategoriesテーブルを共用し、未選択（未分類）を許すためNULL可とする。
   * カテゴリ削除時のNULL化は外部キー宣言では効かないため、CategoryMapperが明示的に行う。
   */
  shortcuts: `
    CREATE TABLE IF NOT EXISTS shortcuts (
      id TEXT PRIMARY KEY,
      categoryId TEXT,
      name TEXT NOT NULL,
      sortOrder INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE SET NULL
    );
  `,

  /**
   * ショートカットとプロファイルの関連テーブル
   *
   * @remarks
   * 定型文の snippet_profiles と同じ形にしている。
   * 1件のショートカットにつき0件以上。0件は全プロファイル向け（snippet_profiles と同じ）。
   * 実行時に外部キーを強制していないため、削除時のカスケードは各Mapperが明示的に行う。
   */
  shortcutProfiles: `
    CREATE TABLE IF NOT EXISTS shortcut_profiles (
      shortcutId TEXT NOT NULL,
      profileId TEXT NOT NULL,
      PRIMARY KEY (shortcutId, profileId),
      FOREIGN KEY (shortcutId) REFERENCES shortcuts(id) ON DELETE CASCADE,
      FOREIGN KEY (profileId) REFERENCES profiles(id) ON DELETE CASCADE
    );
  `,

  /**
   * ショートカット値テーブル
   *
   * @remarks
   * valueは挿入する文字列で、変数トークン（{{name}}）を未展開のまま持つ。
   * 展開は表示・コピー・キーボードからの挿入のそれぞれが、その時点のプロファイルと日時で行う（定型文の本文と同じ）。
   */
  shortcutValues: `
    CREATE TABLE IF NOT EXISTS shortcut_values (
      id TEXT PRIMARY KEY,
      shortcutId TEXT NOT NULL,
      name TEXT NOT NULL,
      value TEXT NOT NULL,
      useCount INTEGER DEFAULT 0,
      sortOrder INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (shortcutId) REFERENCES shortcuts(id) ON DELETE CASCADE
    );
  `,
};

/**
 * インデックス作成SQL定義（検索・ソート性能向上用）
 */
export const CREATE_INDEXES = {
  snippetsCategory: `
    CREATE INDEX IF NOT EXISTS idx_snippets_category
    ON snippets(categoryId);
  `,
  snippetsUpdated: `
    CREATE INDEX IF NOT EXISTS idx_snippets_updated
    ON snippets(updatedAt DESC);
  `,
  snippetsCopyCount: `
    CREATE INDEX IF NOT EXISTS idx_snippets_copy_count
    ON snippets(copyCount DESC);
  `,
  profilesActive: `
    CREATE INDEX IF NOT EXISTS idx_profiles_active
    ON profiles(isActive DESC);
  `,
  profileVariablesProfile: `
    CREATE INDEX IF NOT EXISTS idx_profile_variables_profile
    ON profile_variables(profileId);
  `,
  profileVariablesVariable: `
    CREATE INDEX IF NOT EXISTS idx_profile_variables_variable
    ON profile_variables(variableId);
  `,
  snippetProfilesSnippet: `
    CREATE INDEX IF NOT EXISTS idx_snippet_profiles_snippet
    ON snippet_profiles(snippetId);
  `,
  snippetProfilesProfile: `
    CREATE INDEX IF NOT EXISTS idx_snippet_profiles_profile
    ON snippet_profiles(profileId);
  `,
  /**
   * ショートカットに紐づくプロファイルのindex
   *
   * @remarks
   * 一覧はプロファイルで絞って取得するため実際に使われる。
   * 併せて、移行・取込の後に `shortcut_profiles` の列が存在することを確かめる経路でもある。
   * `finalizeLatestSchema` はテーブル名しか確認しないため、列が欠けたまま
   * 最新スキーマとして通ってしまうのを防いでいる。参照するクエリが無いと誤解して消さないこと。
   */
  shortcutProfilesProfile: `
    CREATE INDEX IF NOT EXISTS idx_shortcut_profiles_profile
    ON shortcut_profiles(profileId);
  `,
  shortcutProfilesShortcut: `
    CREATE INDEX IF NOT EXISTS idx_shortcut_profiles_shortcut
    ON shortcut_profiles(shortcutId);
  `,
  /**
   * ショートカットの所属カテゴリのindex
   *
   * @remarks
   * 一覧はカテゴリで絞り込めるため実際に使われる。
   * shortcutProfilesProfileと同じく、移行・取込の後に `categoryId` 列が存在することを
   * 確かめる経路でもある。参照するクエリが無いと誤解して消さないこと。
   */
  shortcutsCategory: `
    CREATE INDEX IF NOT EXISTS idx_shortcuts_category
    ON shortcuts(categoryId);
  `,
  shortcutValuesShortcut: `
    CREATE INDEX IF NOT EXISTS idx_shortcut_values_shortcut
    ON shortcut_values(shortcutId);
  `,
  /**
   * 使用回数のindex
   *
   * @remarks
   * useCount順の並べ替えは取得後のメモリ上で行うため、このindexで速くなるクエリは無い。
   * それでも置いているのは、移行・取込の後に `useCount` 列が存在することを確かめる唯一の経路だから。
   * `finalizeLatestSchema` はテーブル名しか確認せず、Mapperは `useCount ?? 0` で読むため、
   * 列が欠けても例外にならず全件0として静かに壊れる（migrations.tsの「派生indexが参照する列は
   * createIndexesWithDbの作成時に検知される」に対応）。参照するクエリが無いことを理由に消さないこと。
   */
  shortcutValuesUseCount: `
    CREATE INDEX IF NOT EXISTS idx_shortcut_values_use_count
    ON shortcut_values(useCount DESC);
  `,
};

/**
 * テーブル削除SQL定義（外部キー制約のため削除順序重要）
 */
export const DROP_TABLES = {
  shortcutValues: 'DROP TABLE IF EXISTS shortcut_values;',
  shortcutProfiles: 'DROP TABLE IF EXISTS shortcut_profiles;',
  shortcuts: 'DROP TABLE IF EXISTS shortcuts;',
  systemVariableFormats: 'DROP TABLE IF EXISTS system_variable_formats;',
  snippetProfiles: 'DROP TABLE IF EXISTS snippet_profiles;',
  profileVariables: 'DROP TABLE IF EXISTS profile_variables;',
  profiles: 'DROP TABLE IF EXISTS profiles;',
  variables: 'DROP TABLE IF EXISTS variables;',
  snippets: 'DROP TABLE IF EXISTS snippets;',
  categories: 'DROP TABLE IF EXISTS categories;',
};
