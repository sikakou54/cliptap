/**
 * ClipTap 共通マイグレーション関数（Mobile/Web共通）
 *
 * 各バージョン間のマイグレーションロジックを提供します。
 * プラットフォーム固有の処理（バージョン保存先など）は呼び出し側で実装します。
 *
 * バージョン履歴:
 * - V1 → V2: タグ機能削除、プロファイル機能追加
 * - V2 → V3: copyWithTitleカラム追加
 * - V3 → V4: 共有コンテナへのDB移行（キーボード拡張対応）
 * - V4 → V5: variables, profilesテーブルにsortOrderカラム追加
 * - V5 → V6: snippetsテーブルにcopyCountカラム追加（使用頻度ソート用）
 * - V6 → V7: システム変数書式設定テーブル追加
 * - V7 → V8: ショートカット・ショートカットプロファイル・ショートカット値テーブル追加
 */

import type { DbAdapter } from '../adapters/DbAdapter';
import { DatabaseError, NewerVersionError, VersionMismatchError } from '../errors';
import { Logger } from '../utils/logger';
import { generateUniqueId, getCurrentTimestamp } from '../utils/dateHelpers';
import {
  CREATE_TABLES,
  CREATE_INDEXES,
  MIN_SUPPORTED_SCHEMA_VERSION,
  SCHEMA_VERSION,
} from './schema';

/* ======================================== */
/* スキーマバージョン管理関数（Mobile/Web共通） */
/* ======================================== */

/**
 * データベースからスキーマバージョンを取得
 *
 * SQLiteの PRAGMA user_version を使用してバージョンを取得します。
 * Mobile版・Web版共通で使用できます。
 *
 * @param db - データベースアダプター
 * @returns スキーマバージョン（未設定の場合は0）
 */
export function getSchemaVersionFromDb(db: DbAdapter): number {
  const result = db.get<{ user_version: number }>('PRAGMA user_version');
  return result?.user_version ?? 0;
}

/**
 * データベースにスキーマバージョンを設定
 *
 * SQLiteの PRAGMA user_version を使用してバージョンを保存します。
 * Mobile版・Web版共通で使用できます。
 *
 * @param db - データベースアダプター
 * @param version - 設定するスキーマバージョン
 */
export async function setSchemaVersionToDb(db: DbAdapter, version: number): Promise<void> {
  await db.exec(`PRAGMA user_version = ${version}`);
  Logger.info(`[Migration] Database version set to ${version}`);
}

/* ======================================== */
/* 共通ヘルパー関数 */
/* ======================================== */

/**
 * テーブルが存在するかチェック
 *
 * sqlite_masterシステムテーブルを使用して確認します。
 * DBアクセス自体の失敗は握りつぶさず送出します（テーブル不在と区別するため）。
 *
 * @param db - データベースアダプター
 * @param tableName - テーブル名
 * @returns テーブルが存在する場合true
 */
export function tableExists(db: DbAdapter, tableName: string): boolean {
  const result = db.get<{ count: number }>(
    `SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name=?`,
    [tableName]
  );
  return (result?.count ?? 0) > 0;
}

/**
 * マイグレーション開始バージョンが、呼び出し元のサポート範囲内か検証します。
 *
 * @param fromVersion - マイグレーション開始バージョン
 * @param minimumVersion - 呼び出し元がサポートする最古のバージョン
 */
function assertSupportedMigrationVersion(
  fromVersion: number,
  minimumVersion: number
): void {
  if (!Number.isInteger(fromVersion) || fromVersion < minimumVersion) {
    throw new VersionMismatchError(minimumVersion, fromVersion);
  }

  if (fromVersion > SCHEMA_VERSION) {
    throw new NewerVersionError(SCHEMA_VERSION, fromVersion);
  }
}

/** 導出済みの必須テーブル名（初回の検証時に一度だけ求める） */
let latestTableNames: readonly string[] | null = null;

/**
 * 最新スキーマで存在が必須となるテーブル名を`CREATE_TABLES`のDDLから導出します。
 *
 * @returns 必須テーブル名の一覧
 * @throws {DatabaseError} DDLからテーブル名を取り出せない場合
 *
 * @remarks
 * スキーマ定義との二重管理を避けるため、一覧を手書きせずDDLから求めます。
 * モジュール読込時ではなく検証時に評価し、DDLの記法変更でアプリ起動ごと落ちないようにしています。
 */
function getLatestTableNames(): readonly string[] {
  if (latestTableNames) return latestTableNames;

  latestTableNames = Object.values(CREATE_TABLES).map((sql) => {
    const tableName = /CREATE TABLE IF NOT EXISTS\s+(\w+)/.exec(sql)?.[1];
    if (!tableName) {
      throw new DatabaseError(
        `Failed to derive table name from schema definition: ${sql.trim().slice(0, 40)}`
      );
    }
    return tableName;
  });

  return latestTableNames;
}

/**
 * 最新スキーマの必須テーブルが揃っているか検証します。
 *
 * @remarks
 * 移行段の選択は宣言バージョンだけで行うため、ここでは結果の形だけを確認します。
 * テーブルが欠けたDBを取り込むと以降の全操作が生SQLiteエラーになるため、その手前で明示的に失敗させます。
 * 列レベルの検証は行いません。派生indexが参照する列は `createIndexesWithDb` の作成時に検知されます。
 */
function assertLatestTables(db: DbAdapter): void {
  const missingTables = getLatestTableNames().filter((table) => !tableExists(db, table));

  if (missingTables.length > 0) {
    throw new DatabaseError(
      `Migration completed without required schema elements: ${missingTables.join(', ')}`
    );
  }
}

/**
 * 移行完了後のDBが最新スキーマの形になっているか確認し、派生indexを補完します。
 *
 * @remarks
 * 欠損テーブルを明示エラーにしてから、旧実装で作りそこねた派生indexだけを自己修復します。
 * indexは `CREATE INDEX IF NOT EXISTS` の失敗自体が例外になるため、作成後の存在確認は行いません。
 */
async function finalizeLatestSchema(db: DbAdapter): Promise<void> {
  assertLatestTables(db);
  await createIndexesWithDb(db);
}

/* ======================================== */
/* V1 → V2 マイグレーション */
/* ======================================== */

/**
 * V1 → V2 マイグレーション
 *
 * 変更内容:
 * - 削除: categories.icon, snippets.isPinned等, tags/snippet_tagsテーブル
 * - 追加: variables, profiles, profile_variables, snippet_profilesテーブル
 *
 * @param db - データベースアダプター
 */
export async function migrateV1ToV2(db: DbAdapter): Promise<void> {
  Logger.info('[Migration V1→V2] Starting migration...');

  try {
    await dropTagsTables(db);
    await cleanupCategories(db);
    await migrateSnippetsTableV1ToV2(db);
    await createNewTablesForV2(db);
    await createDefaultProfileIfNeeded(db);

    Logger.success('[Migration V1→V2] Migration completed successfully');
  } catch (error) {
    Logger.error('Failed to migrate from V1 to V2:', error);
    throw error;
  }
}

/* タグ関連テーブル（tags, snippet_tags）を削除 */
async function dropTagsTables(db: DbAdapter): Promise<void> {
  try {
    if (tableExists(db, 'snippet_tags')) {
      Logger.info('Dropping unused snippet_tags table...');
      await db.exec('DROP TABLE IF EXISTS snippet_tags;');
      Logger.success('snippet_tags table dropped');
    }

    if (tableExists(db, 'tags')) {
      Logger.info('Dropping unused tags table...');
      await db.exec('DROP TABLE IF EXISTS tags;');
      Logger.success('tags table dropped');
    }
  } catch (error) {
    Logger.error('Failed to drop tags tables:', error);
  }
}

/* categoriesテーブルからiconカラムを削除（V2ではアイコン機能廃止） */
async function cleanupCategories(db: DbAdapter): Promise<void> {
  Logger.info('[Migration V1→V2] Cleaning up categories table...');

  try {
    const columns = db.all<{ name: string }>(
      `SELECT name FROM pragma_table_info('categories')`
    );
    const hasIconColumn = columns.some((c) => c.name === 'icon');

    if (hasIconColumn) {
      Logger.info('Removing icon column from categories...');

      /* バックアップテーブル作成（iconカラムを除く） */
      await db.exec(`
        CREATE TABLE categories_backup AS
        SELECT id, name, color, sortOrder, createdAt
        FROM categories;
      `);

      await db.exec('DROP TABLE categories;');

      /* iconカラムなしで新しいテーブルを作成 */
      await db.exec(`
        CREATE TABLE categories (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          color TEXT,
          sortOrder INTEGER DEFAULT 0,
          createdAt TEXT NOT NULL
        );
      `);

      /* バックアップからデータを戻す */
      await db.exec(`
        INSERT INTO categories (id, name, color, sortOrder, createdAt)
        SELECT id, name, color, sortOrder, createdAt
        FROM categories_backup;
      `);

      await db.exec('DROP TABLE categories_backup;');
      Logger.success('icon column removed from categories');
    } else {
      Logger.info('categories table already has V2 schema');
    }
  } catch (error) {
    Logger.error('Failed to cleanup categories:', error);
    throw error;
  }
}

/* snippetsテーブルをV2スキーマに移行（V1カラム削除） */
async function migrateSnippetsTableV1ToV2(db: DbAdapter): Promise<void> {
  Logger.info('[Migration V1→V2] Migrating snippets table...');

  try {
    const columns = db.all<{ name: string }>(
      `SELECT name FROM pragma_table_info('snippets')`
    );
    const columnNames = columns.map((c) => c.name);

    const columnsToRemove = ['isPinned', 'usageCount', 'lastUsedAt', 'profileId'];
    const hasV1Columns = columnsToRemove.some(col => columnNames.includes(col));

    if (hasV1Columns) {
      Logger.info('Removing V1 columns from snippets table...');

      /* V1インデックスを削除 */
      const v1Indexes = ['idx_snippets_pinned', 'idx_snippets_usage'];
      for (const indexName of v1Indexes) {
        try {
          await db.exec(`DROP INDEX IF EXISTS ${indexName};`);
          Logger.info(`Dropped index: ${indexName}`);
        } catch (error) {
          Logger.warn(`Failed to drop index ${indexName}:`, error);
        }
      }

      /* 各カラムを削除 */
      for (const columnName of columnsToRemove) {
        if (columnNames.includes(columnName)) {
          try {
            await db.exec(`ALTER TABLE snippets DROP COLUMN ${columnName};`);
            Logger.info(`Dropped column: ${columnName}`);
          } catch (error) {
            Logger.warn(`Failed to drop column ${columnName}, it may not exist:`, error);
          }
        }
      }

      Logger.success('snippets table migrated to V2 schema');
    } else {
      Logger.info('snippets table already has V2 schema');
    }

    /* V2で使用するインデックスを作成 */
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_snippets_category ON snippets(categoryId);
    `);
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_snippets_updated ON snippets(updatedAt DESC);
    `);
  } catch (error) {
    Logger.error('Failed to migrate snippets table:', error);
    throw error;
  }
}

/* V2で追加された新しいテーブルを作成 */
async function createNewTablesForV2(db: DbAdapter): Promise<void> {
  Logger.info('[Migration V1→V2] Creating new tables...');

  /* variablesテーブルの作成 */
  if (!tableExists(db, 'variables')) {
    await db.exec(CREATE_TABLES.variables);
    Logger.info('Created variables table');
  }

  /* profilesテーブルの作成 */
  if (!tableExists(db, 'profiles')) {
    await db.exec(CREATE_TABLES.profiles);
    Logger.info('Created profiles table');

    await db.exec(CREATE_TABLES.profileVariables);
    Logger.info('Created profile_variables table');

    await db.exec(CREATE_INDEXES.profilesActive);
    await db.exec(CREATE_INDEXES.profileVariablesProfile);
    Logger.info('Created profile indexes');
  } else {
    /* profilesテーブルが既に存在する場合、isDefaultカラムの確認・追加 */
    const columns = db.all<{ name: string }>(
      `SELECT name FROM pragma_table_info('profiles')`
    );
    if (!columns.some((c) => c.name === 'isDefault')) {
      await db.exec(`
        ALTER TABLE profiles ADD COLUMN isDefault INTEGER DEFAULT 0;
      `);
      Logger.info('Added isDefault column to profiles table');

      await db.exec(`
        UPDATE profiles
        SET isDefault = 1
        WHERE id = (SELECT id FROM profiles ORDER BY createdAt ASC LIMIT 1);
      `);
      Logger.info('Set first profile as default');
    }
  }

  /* snippet_profilesテーブルの作成 */
  try {
    await db.exec(CREATE_TABLES.snippetProfiles);
    Logger.info('Created snippet_profiles table');

    await db.exec(CREATE_INDEXES.snippetProfilesSnippet);
    await db.exec(CREATE_INDEXES.snippetProfilesProfile);
    Logger.info('Created snippet_profiles indexes');
  } catch (error) {
    Logger.error('Failed to migrate snippet_profiles:', error);
    throw error;
  }

  Logger.success('New tables created successfully');
}

/* ======================================== */
/* V2 → V3 マイグレーション */
/* ======================================== */

/**
 * V2 → V3 マイグレーション
 *
 * 変更内容:
 * - 追加: snippets.copyWithTitleカラム
 *
 * @param db - データベースアダプター
 */
export async function migrateV2ToV3(db: DbAdapter): Promise<void> {
  Logger.info('[Migration V2→V3] Starting migration...');

  try {
    const columns = db.all<{ name: string }>(
      `SELECT name FROM pragma_table_info('snippets')`
    );
    const columnNames = columns.map((c) => c.name);

    if (!columnNames.includes('copyWithTitle')) {
      Logger.info('Adding copyWithTitle column to snippets table...');
      await db.exec(`
        ALTER TABLE snippets ADD COLUMN copyWithTitle INTEGER DEFAULT 0;
      `);
      Logger.success('copyWithTitle column added successfully');
    }

    Logger.success('[Migration V2→V3] Migration completed successfully');
  } catch (error) {
    Logger.error('Failed to migrate from V2 to V3:', error);
    throw error;
  }
}

/* ======================================== */
/* V3 → V4 マイグレーション */
/* ======================================== */

/**
 * V3 → V4 マイグレーション
 *
 * 変更内容:
 * - DBファイルを共有コンテナへ移行（キーボード拡張との共有のため）
 *
 * 処理フロー:
 * 1. 共有コンテナDBにテーブル・インデックス作成
 * 2. SystemDBから共有コンテナDBへ全データをコピー
 *
 * @param mainDB - メインデータベース（共有コンテナ側）
 * @param systemDB - システムデータベース（旧DB）
 */
export async function migrateV3ToV4(mainDB: DbAdapter, systemDB: DbAdapter): Promise<void> {
  Logger.info('[Migration V3→V4] Starting migration to shared container...');

  try {
    Logger.info('[Migration V3→V4] Creating tables in shared container DB...');
    await createTablesWithDb(mainDB);
    await createIndexesWithDb(mainDB);
    Logger.success('[Migration V3→V4] Tables created in shared container DB');

    await copyDataFromSystemDatabase(mainDB, systemDB);

    Logger.success('[Migration V3→V4] Migration completed successfully');
  } catch (error) {
    Logger.error('Failed to migrate from V3 to V4:', error);
    throw error;
  }
}

/**
 * SystemDatabaseから共有コンテナDBへ全データをコピーする
 *
 * @remarks
 * snippet_profiles / variables / profile_variables はV2以降にしか無いため、旧DBに
 * テーブルが存在しない場合だけ警告を残して読み飛ばす。
 * コピー中の失敗は握りつぶさず呼び出し元へ送出し、移行そのものを停止させる。
 * user_versionは移行完了時にしか保存しないため、停止した場合は旧バージョンのまま残り、
 * 次回起動時に INSERT OR IGNORE で冪等に再試行される。
 */
async function copyDataFromSystemDatabase(
  sharedDb: DbAdapter,
  systemDb: DbAdapter
): Promise<void> {
  Logger.info('[Migration V3→V4] Copying data from system database...');

  /* カテゴリデータのコピー */
  const categories = systemDb.all<Record<string, unknown>>('SELECT * FROM categories');
  Logger.info(`[Migration V3→V4] Found ${categories.length} categories`);
  for (const category of categories) {
    sharedDb.run(
      `INSERT OR IGNORE INTO categories (id, name, color, sortOrder, createdAt) VALUES (?, ?, ?, ?, ?)`,
      [category.id, category.name, category.color, category.sortOrder, category.createdAt] as unknown[]
    );
  }

  /* プロファイルデータのコピー */
  const profiles = systemDb.all<Record<string, unknown>>('SELECT * FROM profiles');
  Logger.info(`[Migration V3→V4] Found ${profiles.length} profiles`);
  for (const profile of profiles) {
    sharedDb.run(
      `INSERT OR IGNORE INTO profiles (id, name, isActive, isDefault, createdAt, updatedAt, valid) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [profile.id, profile.name, profile.isActive, profile.isDefault, profile.createdAt, profile.updatedAt, (profile.valid as number | undefined) ?? 1] as unknown[]
    );
  }

  /* スニペットデータのコピー */
  const snippets = systemDb.all<Record<string, unknown>>('SELECT * FROM snippets');
  Logger.info(`[Migration V3→V4] Found ${snippets.length} snippets`);
  for (const snippet of snippets) {
    sharedDb.run(
      `INSERT OR IGNORE INTO snippets (id, title, content, categoryId, copyWithTitle, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [snippet.id, snippet.title, snippet.content, snippet.categoryId, (snippet.copyWithTitle as number | undefined) ?? 0, snippet.createdAt, snippet.updatedAt] as unknown[]
    );
  }

  /* snippet_profilesデータのコピー（V2以降のみ存在） */
  if (!tableExists(systemDb, 'snippet_profiles')) {
    Logger.warn('[Migration V3→V4] snippet_profiles table does not exist in old DB, skipping');
  } else {
    const snippetProfiles = systemDb.all<Record<string, unknown>>('SELECT * FROM snippet_profiles');
    Logger.info(`[Migration V3→V4] Found ${snippetProfiles.length} snippet-profile relations`);
    for (const sp of snippetProfiles) {
      sharedDb.run(
        `INSERT OR IGNORE INTO snippet_profiles (snippetId, profileId) VALUES (?, ?)`,
        [sp.snippetId, sp.profileId] as unknown[]
      );
    }
  }

  /* variablesデータのコピー（V2以降のみ存在） */
  if (!tableExists(systemDb, 'variables')) {
    Logger.warn('[Migration V3→V4] variables table does not exist in old DB, skipping');
  } else {
    const variables = systemDb.all<Record<string, unknown>>('SELECT * FROM variables');
    Logger.info(`[Migration V3→V4] Found ${variables.length} variables`);
    for (const variable of variables) {
      const createdAt = (variable.createdAt as string | undefined) ?? getCurrentTimestamp();
      const updatedAt = (variable.updatedAt as string | undefined) ?? createdAt;
      sharedDb.run(
        `INSERT OR IGNORE INTO variables (id, name, label, icon, type, createdAt, updatedAt, valid) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [variable.id, variable.name, variable.label, variable.icon, variable.type, createdAt, updatedAt, (variable.valid as number | undefined) ?? 1] as unknown[]
      );
    }
  }

  /* profile_variablesデータのコピー（V2以降のみ存在） */
  if (!tableExists(systemDb, 'profile_variables')) {
    Logger.warn('[Migration V3→V4] profile_variables table does not exist in old DB, skipping');
  } else {
    const profileVariables = systemDb.all<Record<string, unknown>>('SELECT * FROM profile_variables');
    Logger.info(`[Migration V3→V4] Found ${profileVariables.length} profile variables`);
    for (const pv of profileVariables) {
      const createdAt = (pv.createdAt as string | undefined) ?? getCurrentTimestamp();
      const updatedAt = (pv.updatedAt as string | undefined) ?? createdAt;
      sharedDb.run(
        `INSERT OR IGNORE INTO profile_variables (id, profileId, variableId, value, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)`,
        [(pv.id as string | undefined) ?? generateUniqueId(), pv.profileId, pv.variableId, pv.value, createdAt, updatedAt] as unknown[]
      );
    }
  }

  Logger.success('[Migration V3→V4] All data copied successfully');
}

/* ======================================== */
/* V4 → V5 マイグレーション */
/* ======================================== */

/**
 * V4 → V5 マイグレーション
 *
 * 変更内容:
 * - variablesテーブルにsortOrderカラムを追加
 * - profilesテーブルにsortOrderカラムを追加
 * - 既存データに対してcreatedAt, name順にsortOrderを最適化
 *
 * @param db - mainDBアダプター（データが格納されているDB）
 */
export async function migrateV4ToV5(db: DbAdapter): Promise<void> {
  Logger.info('[Migration V4→V5] Starting migration...');

  try {
    /* variablesテーブルにsortOrderカラムを追加 */
    const variableColumns = db.all<{ name: string }>(
      `SELECT name FROM pragma_table_info('variables')`
    );
    const hasVariableSortOrder = variableColumns.some((c) => c.name === 'sortOrder');

    if (!hasVariableSortOrder) {
      Logger.info('[Migration V4→V5] Adding sortOrder column to variables table...');
      await db.exec(`ALTER TABLE variables ADD COLUMN sortOrder INTEGER DEFAULT 0;`);

      /* 既存データにsortOrderを設定 */
      const variables = db.all<{ id: string }>(
        `SELECT id FROM variables ORDER BY createdAt ASC, name ASC`
      );
      variables.forEach((v, index) => {
        db.run('UPDATE variables SET sortOrder = ? WHERE id = ?', [index, v.id]);
      });
      Logger.success(`[Migration V4→V5] sortOrder added to variables (${variables.length} rows)`);
    }

    /* profilesテーブルにsortOrderカラムを追加 */
    const profileColumns = db.all<{ name: string }>(
      `SELECT name FROM pragma_table_info('profiles')`
    );
    const hasProfileSortOrder = profileColumns.some((c) => c.name === 'sortOrder');

    if (!hasProfileSortOrder) {
      Logger.info('[Migration V4→V5] Adding sortOrder column to profiles table...');
      await db.exec(`ALTER TABLE profiles ADD COLUMN sortOrder INTEGER DEFAULT 0;`);

      /* 既存データにsortOrderを設定（デフォルトプロファイル優先） */
      const profiles = db.all<{ id: string }>(
        `SELECT id FROM profiles ORDER BY isDefault DESC, createdAt ASC, name ASC`
      );
      profiles.forEach((p, index) => {
        db.run('UPDATE profiles SET sortOrder = ? WHERE id = ?', [index, p.id]);
      });
      Logger.success(`[Migration V4→V5] sortOrder added to profiles (${profiles.length} rows)`);
    }

    Logger.success('[Migration V4→V5] Migration completed successfully');
  } catch (error) {
    Logger.error('[Migration V4→V5] Failed to migrate:', error);
    throw error;
  }
}

/* ======================================== */
/* V5 → V6 マイグレーション */
/* ======================================== */

/**
 * V5 → V6 マイグレーション
 *
 * 変更内容:
 * - snippetsテーブルにcopyCountカラムを追加（使用頻度ソート用）
 *
 * @param db - mainDBアダプター（データが格納されているDB）
 */
export async function migrateV5ToV6(db: DbAdapter): Promise<void> {
  Logger.info('[Migration V5→V6] Starting migration...');

  try {
    /* snippetsテーブルにcopyCountカラムを追加 */
    const snippetColumns = db.all<{ name: string }>(
      `SELECT name FROM pragma_table_info('snippets')`
    );
    const hasCopyCount = snippetColumns.some((c) => c.name === 'copyCount');

    if (!hasCopyCount) {
      Logger.info('[Migration V5→V6] Adding copyCount column to snippets table...');
      await db.exec(`ALTER TABLE snippets ADD COLUMN copyCount INTEGER DEFAULT 0;`);

      /* インデックスを作成 */
      await db.exec(CREATE_INDEXES.snippetsCopyCount);

      Logger.success('[Migration V5→V6] copyCount column and index added successfully');
    }

    Logger.success('[Migration V5→V6] Migration completed successfully');
  } catch (error) {
    Logger.error('[Migration V5→V6] Failed to migrate:', error);
    throw error;
  }
}

/* ======================================== */
/* V6 → V7 マイグレーション */
/* ======================================== */

/**
 * システム変数の書式設定を疎に保存するテーブルを追加します。
 */
export async function migrateV6ToV7(db: DbAdapter): Promise<void> {
  Logger.info('[Migration V6→V7] Starting migration...');

  try {
    await db.exec(CREATE_TABLES.systemVariableFormats);
    Logger.success('[Migration V6→V7] Migration completed successfully');
  } catch (error) {
    Logger.error('[Migration V6→V7] Failed to migrate:', error);
    throw error;
  }
}

/* ======================================== */
/* V7 → V8 マイグレーション */
/* ======================================== */

/**
 * ショートカットと、その値を保持するテーブルを追加します。
 *
 * @param db - データベースアダプター
 *
 * @remarks
 * 既存データは持たないため、初期行は挿入しません。
 * 派生indexは移行後の`finalizeLatestSchema`が作成するため、ここでは作成しません。
 *
 * ショートカットは定型文と共通のカテゴリID（`categoryId`）を持ち、紐づくプロファイルは
 * `shortcut_profiles`（定型文の`snippet_profiles`と同じ形の中間テーブル）で表します。
 * 1件のショートカットにつき紐づけは0件以上で、0件は全プロファイル向けです（`snippet_profiles`と同じ）。
 * 名前は紐づくプロファイル内で一意ですが、紐づけが別テーブルにあるためDB制約では表せず、
 * 判定もShortcutServiceが行います。
 *
 * 値は`shortcut_values.value`に文字列で持ち、`variableId`を設定した値は
 * カスタム変数を参照して解決します。
 * V8はまだリリースしていないため（`release/prod`はV5）、新しい段を作らずこの段の定義を更新しています。
 * 同じ理由で、配布中の`apps/web/public/starter_v8_*.cliptap`はファイル名が変わりません。
 * 版据置でDDLを変えたときは404で検知できないため、必ず再生成すること。
 */
export async function migrateV7ToV8(db: DbAdapter): Promise<void> {
  Logger.info('[Migration V7→V8] Starting migration...');

  try {
    await db.exec(CREATE_TABLES.shortcuts);
    await db.exec(CREATE_TABLES.shortcutProfiles);
    await db.exec(CREATE_TABLES.shortcutValues);
    Logger.success('[Migration V7→V8] Migration completed successfully');
  } catch (error) {
    Logger.error('[Migration V7→V8] Failed to migrate:', error);
    throw error;
  }
}

/**
 * 全テーブルを作成
 *
 * 指定されたデータベースインスタンスに全テーブルを作成します。
 *
 * @param db - データベースアダプター
 */
export async function createTablesWithDb(db: DbAdapter): Promise<void> {
  try {
    await db.exec(CREATE_TABLES.categories);
    await db.exec(CREATE_TABLES.snippets);
    await db.exec(CREATE_TABLES.variables);
    await db.exec(CREATE_TABLES.profiles);
    await db.exec(CREATE_TABLES.profileVariables);
    await db.exec(CREATE_TABLES.snippetProfiles);
    await db.exec(CREATE_TABLES.systemVariableFormats);
    await db.exec(CREATE_TABLES.shortcuts);
    await db.exec(CREATE_TABLES.shortcutProfiles);
    await db.exec(CREATE_TABLES.shortcutValues);
    Logger.info('[Migration] Tables created successfully');
  } catch (error) {
    Logger.error('[Migration] Failed to create tables:', error);
    throw error;
  }
}

/**
 * 全インデックスを作成
 *
 * 指定されたデータベースインスタンスに全インデックスを作成します。
 *
 * @param db - データベースアダプター
 */
export async function createIndexesWithDb(db: DbAdapter): Promise<void> {
  try {
    for (const indexSQL of Object.values(CREATE_INDEXES)) {
      await db.exec(indexSQL);
    }
    Logger.info('[Migration] Indexes created successfully');
  } catch (error) {
    Logger.error('[Migration] Failed to create indexes:', error);
    throw error;
  }
}

/**
 * デフォルトプロファイルを作成（存在しない場合のみ）
 *
 * プロファイルが1つも存在しない場合に「Main」という名前のデフォルトプロファイルを作成します。
 *
 * @param db - データベースアダプター
 */
export async function createDefaultProfileIfNeeded(db: DbAdapter): Promise<void> {
  Logger.info('[Migration] Checking for default profile...');

  try {
    const result = db.get<{ count: number }>('SELECT COUNT(*) as count FROM profiles');
    const profileCount = result?.count || 0;

    if (profileCount === 0) {
      Logger.info('[Migration] No profiles found, creating default profile...');

      const id = generateUniqueId();
      const now = getCurrentTimestamp();

      db.run(
        `INSERT INTO profiles (id, name, isActive, isDefault, valid, sortOrder, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, 'Main', 1, 1, 1, 0, now, now]
      );

      Logger.success(`[Migration] Created default profile: ${id}`);
    } else {
      Logger.info(`[Migration] Profiles already exist (count: ${profileCount})`);
    }
  } catch (error) {
    Logger.error('[Migration] Failed to create default profile:', error);
    throw error;
  }
}

/* ======================================== */
/* 共通マイグレーション実行関数（Mobile/Web共通） */
/* ======================================== */

/**
 * マイグレーション実行（Mobile/Web共通）
 *
 * 指定されたバージョンから最新バージョンまでマイグレーションを実行します。
 *
 * @param mainDB - メインデータベースアダプター
 * @param systemDB - システムデータベースアダプター（バージョン管理用）
 * @param fromVersion - 開始バージョン
 */
export async function runMigrations(
  mainDB: DbAdapter,
  systemDB: DbAdapter,
  fromVersion: number
): Promise<void> {
  /** Mobileの既存DBはV1以降をサポートするため、インポート用の下限は適用しない */
  assertSupportedMigrationVersion(fromVersion, 1);

  let currentVersion = fromVersion;

  Logger.info(`[Migration] from: ${currentVersion}, to: ${SCHEMA_VERSION}`);

  while (currentVersion < SCHEMA_VERSION) {
    const nextVersion = currentVersion + 1;
    Logger.info(`[Migration] Running migration: Version ${currentVersion} → ${nextVersion}`);

    switch (nextVersion) {
      case 2:
        await migrateV1ToV2(systemDB);
        break;
      case 3:
        await migrateV2ToV3(systemDB);
        break;
      case 4:
        await migrateV3ToV4(mainDB, systemDB);
        break;
      case 5:
        await migrateV4ToV5(mainDB);
        break;
      case 6:
        await migrateV5ToV6(mainDB);
        break;
      case 7:
        await migrateV6ToV7(mainDB);
        break;
      case 8:
        await migrateV7ToV8(mainDB);
        break;
      /* 冒頭のassertSupportedMigrationVersion(fromVersion, 1)によりfromVersionは1〜SCHEMA_VERSION(8)に
         制限されるため、nextVersionは2〜8となり上のcaseが全て存在する＝現行の版範囲では到達しない。
         なお版番号を確定する前にfinalizeLatestSchemaが必須テーブルの欠落をDatabaseErrorにする */
      default:
        Logger.warn(`[Migration] No migration defined for version ${nextVersion}`);
        break;
    }

    currentVersion = nextVersion;
    Logger.info(`[Migration] Migrated to version ${nextVersion}`);
  }

  /** 版番号を確定する前に、宣言どおりの形になっているかを必ず確認する */
  await finalizeLatestSchema(mainDB);

  /* マイグレーション完了後にバージョンをsystemDBに保存 */
  await setSchemaVersionToDb(systemDB, SCHEMA_VERSION);
}

/**
 * インポート一時DBのマイグレーション
 *
 * V3以降のエクスポートファイルを現在のスキーマバージョンにマイグレーションします。
 * Mobile/Web共通で使用できる汎用関数です。
 *
 * @param db - 一時DBアダプター
 * @param fromVersion - エクスポートファイルのスキーマバージョン
 */
export async function migrateImportTempDb(db: DbAdapter, fromVersion: number): Promise<void> {
  assertSupportedMigrationVersion(fromVersion, MIN_SUPPORTED_SCHEMA_VERSION);

  let currentVersion = fromVersion;

  Logger.info(`[Import Migration] from: ${currentVersion}, to: ${SCHEMA_VERSION}`);

  while (currentVersion < SCHEMA_VERSION) {
    const nextVersion = currentVersion + 1;
    Logger.info(`[Import Migration] Running migration: V${currentVersion} → V${nextVersion}`);

    switch (nextVersion) {
      case 4:
        /* V3→V4は保存場所だけの変更で、一時DBのテーブル定義は同一 */
        break;
      case 5:
        await migrateV4ToV5(db);
        break;
      case 6:
        await migrateV5ToV6(db);
        break;
      case 7:
        await migrateV6ToV7(db);
        break;
      case 8:
        await migrateV7ToV8(db);
        break;
      /* 冒頭のassertSupportedMigrationVersion(fromVersion, MIN_SUPPORTED_SCHEMA_VERSION)により
         fromVersionは3〜SCHEMA_VERSION(8)に制限されるため、nextVersionは4〜8となり
         上のcaseが全て存在する＝現行の版範囲では到達しない */
      default:
        throw new VersionMismatchError(SCHEMA_VERSION, currentVersion);
    }

    currentVersion = nextVersion;
  }

  /** 取込前に形の不整合を明示エラーへ変えるため、宣言版が最新でも必ず確認する */
  await finalizeLatestSchema(db);
  Logger.success(`[Import Migration] Migration completed to V${SCHEMA_VERSION}`);
}
