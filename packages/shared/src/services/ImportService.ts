/**
 * インポートサービス（共通）
 *
 * @description
 * 部分インポート（マージモード）のビジネスロジックを提供する共通サービス。
 * 既存データとの重複を検出し、IDマッピングを解決しながらデータを統合する。
 *
 * インポートフロー:
 * 1. カテゴリのインポート（重複名は既存を使用）
 * 2. 変数のインポート（重複名は既存を更新）
 * 3. プロファイルのインポート（重複名は既存を使用）
 * 4. 変数値のインポート（プロファイル×変数）
 * 5. スニペットのインポート（カテゴリ・プロファイルIDを解決）
 *
 * 表示順の扱い:
 * 新規に作成するカテゴリ・変数・プロファイルは自動採番で末尾に置き、既存と同名のものは
 * 表示順を据え置く。無料プランの有効判定は表示順で行うため、既存項目を末尾へ動かすと
 * それまで有効だった項目が上限超過分と入れ替わって無効になるためである。
 * これによりインポートで既存の有効な項目が無効になることはない。
 *
 * @module ImportService
 */

import { ImportMapper } from '../mappers/ImportMapper';
import type { ImportCandidates } from '../mappers/IImportMapper';
import { getTempDbAdapter, hasTempDbAdapter, getMainDbAdapter, hasMainDbAdapter } from '../adapters/DbAdapter';
import { getImportAdapter, hasImportAdapter } from '../adapters/ImportAdapter';
import { ImportParserService } from './ImportParserService';
import { Logger } from '../utils/logger';
import { generateUniqueId } from '../utils/dateHelpers';
import { uint8ArrayToBase64 } from '../utils/exportImportUtils';
import { PartialImportError } from '../errors';
import { CategoryService } from './CategoryService';
import { ProfileService } from './ProfileService';
import { VariableService } from './VariableService';
import { SnippetService } from './SnippetService';
import { SubscriptionService } from './SubscriptionService';
import { AuthService } from './AuthService';
import {
  CategoryMapper,
  ProfileVariableMapper,
  ProfileMapper,
  SnippetMapper,
  ShortcutMapper,
  SystemVariableFormatMapper,
  VariableMapper,
} from '../mappers';
import { migrateImportTempDb } from '../database/migrations';
import { SCHEMA_VERSION } from '../database/schema';

/* ======================================== */
/* 型定義（内部用） */
/* ======================================== */

/** カテゴリIDマッピング（旧ID → 新ID） */
type CategoryIdMap = Map<string, string>;

/** プロファイルIDマッピング（旧ID → 新ID） */
type ProfileIdMap = Map<string, string>;

/** 変数IDマッピング（旧ID → 新ID） */
type VariableIdMap = Map<string, string>;

/* ======================================== */
/* プライベートヘルパー関数 */
/* ======================================== */

/**
 * カテゴリをインポート
 *
 * @param importMapper - インポートマッパー
 * @param selectedCategoryIds - 選択されたカテゴリID
 * @param existingCategoryIdMap - 既存カテゴリとのマッピング（事前作成済み）
 * @returns カテゴリIDマッピング（旧ID → 新ID）
 */
function importCategories(
  importMapper: ImportMapper,
  selectedCategoryIds: string[],
  existingCategoryIdMap: CategoryIdMap = new Map()
): CategoryIdMap {
  /* 既存マッピングを引き継ぐことで、スニペットに紐づくカテゴリも正しくマッピングされる */
  const categoryIdMap: CategoryIdMap = new Map(existingCategoryIdMap);
  if (selectedCategoryIds.length === 0) return categoryIdMap;

  const categoriesToImport = importMapper.getCategories(selectedCategoryIds);

  for (const category of categoriesToImport) {
    /* 既存があれば更新、なければ新規作成（新規の表示順は自動採番で末尾） */
    const result = CategoryService.upsert({
      name: category.name,
      color: category.color || undefined,
    });
    categoryIdMap.set(category.id, result.id);
  }

  return categoryIdMap;
}

/**
 * 変数をインポート
 *
 * @param importMapper - インポートマッパー
 * @param selectedVariableIds - 選択された変数ID
 * @returns 変数IDマッピング（旧ID → 新ID）
 */
function importVariables(
  importMapper: ImportMapper,
  selectedVariableIds: string[]
): VariableIdMap {
  const variableIdMap: VariableIdMap = new Map();
  if (selectedVariableIds.length === 0) return variableIdMap;

  const variablesToImport = importMapper.getVariables(selectedVariableIds);

  for (const v of variablesToImport) {
    /* 既存があれば更新、なければ新規作成（新規の表示順は自動採番で末尾） */
    const result = VariableService.upsert({
      name: v.name,
      type: 'custom',
      label: v.label ?? undefined,
      icon: v.icon ?? undefined,
    });
    variableIdMap.set(v.id, result.id);
  }

  return variableIdMap;
}

/**
 * プロファイルインポート結果
 */
interface ImportProfilesResult {
  /** プロファイルIDマッピング（旧ID → 新ID） */
  profileIdMap: ProfileIdMap;
  /** インポート元でデフォルトだったプロファイルの新ID（存在する場合） */
  defaultProfileId: string | null;
}

/**
 * プロファイルをインポート
 *
 * @param importMapper - インポートマッパー
 * @param selectedProfileIds - 選択されたプロファイルID
 * @param existingProfileIdMap - 既存プロファイルとのマッピング（事前作成済み）
 * @returns プロファイルIDマッピングとデフォルトプロファイルID
 */
function importProfiles(
  importMapper: ImportMapper,
  selectedProfileIds: string[],
  existingProfileIdMap: ProfileIdMap
): ImportProfilesResult {
  /* 既存マッピングを引き継ぐことで、スニペットに紐づくプロファイルも正しくマッピングされる */
  const profileIdMap: ProfileIdMap = new Map(existingProfileIdMap);
  let defaultProfileId: string | null = null;

  if (selectedProfileIds.length === 0) {
    return { profileIdMap, defaultProfileId };
  }

  const profilesToImport = importMapper.getProfiles(selectedProfileIds);

  for (const p of profilesToImport) {
    /* 既存があれば更新、なければ新規作成（新規の表示順は自動採番で末尾） */
    const result = ProfileService.upsert({
      name: p.name,
    });
    profileIdMap.set(p.id, result.id);

    /* インポート元でデフォルトだったプロファイルの新IDを記録 */
    if (p.isDefault) {
      defaultProfileId = result.id;
    }
  }

  return { profileIdMap, defaultProfileId };
}

/**
 * 変数値をインポート
 *
 * @param importMapper - インポートマッパー
 * @param variableIdMap - 変数IDマッピング
 * @param profileIdMap - プロファイルIDマッピング
 */
function importVariableValues(
  importMapper: ImportMapper,
  variableIdMap: VariableIdMap,
  profileIdMap: ProfileIdMap
): void {
  if (variableIdMap.size === 0 || profileIdMap.size === 0) return;

  const targetVarIds = Array.from(variableIdMap.keys());
  const targetProfileIds = Array.from(profileIdMap.keys());
  const profileVariables = importMapper.getProfileVariables(targetVarIds, targetProfileIds);

  for (const pv of profileVariables) {
    const newProfileId = profileIdMap.get(pv.profileId);
    const newVariableId = variableIdMap.get(pv.variableId);

    /* 両方のIDがマッピングされている場合のみインポート */
    if (newProfileId && newVariableId) {
      VariableService.upsertValueForProfile(newProfileId, newVariableId, pv.value);
    }
  }
}

/**
 * スニペットをインポート
 *
 * @param importMapper - インポートマッパー
 * @param selectedSnippetIds - 選択されたスニペットID
 * @param categoryIdMap - カテゴリIDマッピング
 * @param profileIdMap - プロファイルIDマッピング
 */
function importSnippets(
  importMapper: ImportMapper,
  selectedSnippetIds: string[],
  categoryIdMap: CategoryIdMap,
  profileIdMap: ProfileIdMap
): void {
  if (selectedSnippetIds.length === 0) return;

  const snippetsToImport = importMapper.getSnippets(selectedSnippetIds);
  const snippetProfileRows = importMapper.getSnippetProfiles(selectedSnippetIds);

  /* スニペットIDごとのプロファイルID配列を構築して効率的に参照 */
  const snippetProfileMap = new Map<string, string[]>();
  for (const row of snippetProfileRows) {
    if (!snippetProfileMap.has(row.snippetId)) {
      snippetProfileMap.set(row.snippetId, []);
    }
    snippetProfileMap.get(row.snippetId)?.push(row.profileId);
  }

  for (const snippet of snippetsToImport) {
    /* カテゴリIDを解決（選択されていない場合は未分類） */
    let categoryId: string | null = null;
    if (snippet.categoryId) {
      const mapped = categoryIdMap.get(snippet.categoryId);
      if (mapped) categoryId = mapped;
    }

    /* プロファイルIDを解決（選択されているもののみ） */
    const oldProfileIds = snippetProfileMap.get(snippet.id) ?? [];
    const targetProfileIds: string[] = [];
    for (const oldPid of oldProfileIds) {
      const newPid = profileIdMap.get(oldPid);
      if (newPid) targetProfileIds.push(newPid);
    }

    /* 通常の作成処理（新しいタイムスタンプ） */
    SnippetService.create({
      title: snippet.title ?? undefined,
      content: snippet.content,
      categoryId: categoryId || undefined,
      profileIds: targetProfileIds.length > 0 ? Array.from(new Set(targetProfileIds)) : undefined,
      copyWithTitle: !!snippet.copyWithTitle,
    });
  }
}

/**
 * 既存プロファイルとのマッピングを事前作成
 *
 * @param importMapper - インポートマッパー
 * @returns プロファイルIDマッピング（旧ID → 新ID）
 *
 * @remarks
 * スニペットに紐づくプロファイル（選択されていないものも含む）を正しくマッピングするため。
 *
 * このマッピングは、取込元スニペットが参照する「選択されていない既存プロファイル」の
 * ローカルIDを引くためのもの。失敗して空マップになっても、選択項目は upsert が名前で
 * 再解決するため取込自体は完了する（未選択プロファイルへの紐付けだけが落ちる。
 * カテゴリの分類は prepareExistingCategoryMapping が別に解決するため影響しない）。
 * ここで例外を上げると取込全体が失敗するため再スローはせず、原因追跡のため警告だけ残す。
 */
function prepareExistingProfileMapping(
  importMapper: ImportMapper
): ProfileIdMap {
  const profileIdMap: ProfileIdMap = new Map();

  try {
    const allImportProfiles = importMapper.getAllProfiles();
    for (const p of allImportProfiles) {
      const existing = ProfileService.getByName(p.name);
      if (existing) {
        profileIdMap.set(p.id, existing.id);
      }
    }
  } catch (error) {
    /* 上記のとおり縮退して続行する。中断させないが、無音にすると原因追跡ができないため警告を残す */
    Logger.warn(
      '[ImportService] Failed to prepare existing profile mapping. Continuing with an empty map.',
      error
    );
  }

  return profileIdMap;
}

/**
 * 既存カテゴリとのマッピングを事前作成
 *
 * @param importMapper - インポートマッパー
 * @returns カテゴリIDマッピング（旧ID → 新ID）
 *
 * @remarks
 * スニペットに紐づくカテゴリ（選択されていない既存重複カテゴリも含む）を正しくマッピングするため。
 *
 * このマッピングは、取込元スニペットが参照する「選択されていない既存カテゴリ」の
 * ローカルIDを引くためのもの。失敗して空マップになっても、選択項目は upsert が名前で
 * 再解決するため取込自体は完了する（未選択カテゴリを参照するスニペットが未分類になるだけ）。
 * ここで例外を上げると取込全体が失敗するため再スローはせず、原因追跡のため警告だけ残す。
 */
function prepareExistingCategoryMapping(
  importMapper: ImportMapper
): CategoryIdMap {
  const categoryIdMap: CategoryIdMap = new Map();

  try {
    const allImportCategories = importMapper.getAllCategories();
    for (const c of allImportCategories) {
      const existing = CategoryService.getByName(c.name);
      if (existing) {
        categoryIdMap.set(c.id, existing.id);
      }
    }
  } catch (error) {
    /* 上記のとおり縮退して続行する。中断させないが、無音にすると原因追跡ができないため警告を残す */
    Logger.warn(
      '[ImportService] Failed to prepare existing category mapping. Continuing with an empty map.',
      error
    );
  }

  return categoryIdMap;
}

/**
 * インポートサービスクラス
 *
 * @description
 * ImportAdapterを使用してプラットフォーム固有の処理を実行。
 * すべて静的メソッドで提供。
 *
 * importPartial＝選択項目のマージ取込、importDatabaseFromTempDb＝全データの逐語復元。
 * どちらも prepareImportDatabase が作った一時DBのパスを受け取る。
 */
export class ImportService {
  /* ======================================== */
  /* 静的メソッド（ファイル操作・DB準備） */
  /* ======================================== */

  /**
   * インポート前にサブスクリプション状態を同期する
   *
   * @remarks
   * 有効フラグの再計算に最新の権利状態を使うための事前同期。
   * 権利確認は外部通信のため失敗しうるが、失敗しても取込は中断せず、
   * 既知の最後の権利状態で有効フラグを計算する。
   * 取込はローカル業務機能であり、外部サービスの障害で壊さない。
   */
  private static async refreshSubscriptionForImport(): Promise<void> {
    try {
      if (!AuthService.getCurrentUser()) return;
      await SubscriptionService.refreshCustomerInfo();
    } catch (error) {
      Logger.warn(
        '[ImportService] Failed to refresh subscription state. Continuing with the last known state.',
        error
      );
    }
  }

  /**
   * インポート用の一時データベースファイルを作成
   *
   * @param password - インポートファイルのパスワード
   * @param fileUri - インポートファイルのURI
   * @returns 一時データベースファイルのパス
   */
  static async prepareImportDatabase(password: string, fileUri: string): Promise<string> {
    if (!hasImportAdapter()) {
      throw new Error('ImportAdapter is required for prepareImportDatabase. Call setImportAdapter() first.');
    }

    if (!hasTempDbAdapter()) {
      throw new Error('TempDbAdapter is required for prepareImportDatabase. Call setTempDbAdapter() first.');
    }

    Logger.info('[ImportService] Preparing import database...');

    const adapter = getImportAdapter();
    const importParserService = new ImportParserService();

    const jsonContent = await adapter.readImportFile(fileUri);
    const { dbBytes, exportData } = await importParserService.parseAndValidate(jsonContent, password);

    /** 同一ミリ秒の多重操作でも一時DBを共有しない */
    const tempDbName = `import_temp_${generateUniqueId()}.db`;
    const dbBase64 = uint8ArrayToBase64(dbBytes);

    const tempDbPath = await adapter.writeTempDatabase(tempDbName, dbBase64);

    try {
      /** 一時DB上で、必要な移行と最新スキーマの後条件検証を完了する */
      const tempDbAdapter = getTempDbAdapter();
      try {
        await tempDbAdapter.open?.(tempDbPath);

        if (exportData.s < SCHEMA_VERSION) {
          Logger.info(`[ImportService] Migrating temp DB from V${exportData.s} to V${SCHEMA_VERSION}...`);
        }

        await migrateImportTempDb(tempDbAdapter, exportData.s);

        /** WebではV7の派生index補完も、close前に一時ファイルへ書き戻す必要がある */
        await tempDbAdapter.persist?.();
        if (exportData.s < SCHEMA_VERSION) {
          Logger.info('[ImportService] Temp DB migration completed');
        }
      } finally {
        tempDbAdapter.close?.();
      }

      return tempDbPath;
    } catch (error) {
      try {
        await adapter.deleteFile(tempDbPath);
      } catch (cleanupError) {
        Logger.warn('[ImportService] Failed to cleanup invalid temp db:', cleanupError);
      }
      throw error;
    }
  }

  /**
   * インポート候補のデータを取得
   *
   * @param tempDbPath - 一時データベースのパス
   * @returns インポート候補データ
   */
  static async getImportCandidates(tempDbPath: string): Promise<ImportCandidates> {
    if (!hasTempDbAdapter()) {
      throw new Error('TempDbAdapter is required for getImportCandidates. Call setTempDbAdapter() first.');
    }

    const tempDbAdapter = getTempDbAdapter();
    await tempDbAdapter.open?.(tempDbPath);

    try {
      const mapper = new ImportMapper(tempDbAdapter);
      return mapper.getAllCandidates();
    } catch (error) {
      Logger.error('[ImportService] Failed to get candidates:', error);
      throw error;
    } finally {
      tempDbAdapter.close?.();
    }
  }

  /**
   * 選択されたデータを部分的にインポート（静的メソッド版）
   *
   * @param tempDbPath - 一時データベースのパス
   * @param selectedSnippetIds - インポートするスニペットID
   * @param selectedProfileIds - インポートするプロファイルID
   * @param selectedVariableIds - インポートする変数ID
   * @param selectedCategoryIds - インポートするカテゴリID
   */
  static async importPartial(
    tempDbPath: string,
    selectedSnippetIds: string[],
    selectedProfileIds: string[],
    selectedVariableIds: string[],
    selectedCategoryIds: string[]
  ): Promise<void> {
    if (!hasTempDbAdapter()) {
      throw new Error('TempDbAdapter is required for importPartial. Call setTempDbAdapter() first.');
    }

    const tempDbAdapter = getTempDbAdapter();
    await tempDbAdapter.open?.(tempDbPath);

    try {
      Logger.info('[ImportService] Starting partial import...');

      /* インポート前にサブスクリプション状態を更新（updateValidFlagsで使用されるため） */
      await this.refreshSubscriptionForImport();

      const mapper = new ImportMapper(tempDbAdapter);
      getMainDbAdapter().transaction(() => {
        const importedDefaultProfileId = this.runPartialImport(
          mapper,
          selectedSnippetIds,
          selectedProfileIds,
          selectedVariableIds,
          selectedCategoryIds
        );

        /* インポート後にデフォルト/アクティブプロファイルを設定（必要な場合のみ） */
        ProfileService.ensureDefaultAndActive(importedDefaultProfileId);

        /* インポート後に有効フラグを更新 */
        SubscriptionService.updateValidFlags();
      });

      Logger.info('[ImportService] Partial import completed');
    } catch (error) {
      Logger.error('[ImportService] Partial import failed:', error);
      /* Error以外がthrowされたときの文言は現行の日本語リテラルをそのまま維持する。
         PartialImportError の既定値へ委ねると message が 'Partial import failed' に変わり、
         ログと翻訳失敗時のフォールバック表示が変化するため。i18n化は別途判断すること */
      throw new PartialImportError(
        error instanceof Error ? error.message : 'インポート中にエラーが発生しました',
        error
      );
    } finally {
      tempDbAdapter.close?.();
    }
  }

  /**
   * Mapperを使用して部分インポートを実行（内部静的メソッド）
   * @returns インポート元でデフォルトだったプロファイルの新ID（存在する場合）
   */
  private static runPartialImport(
    importMapper: ImportMapper,
    selectedSnippetIds: string[],
    selectedProfileIds: string[],
    selectedVariableIds: string[],
    selectedCategoryIds: string[]
  ): string | null {
    /* スニペットに紐づくプロファイル（選択されていないものも含む）を正しくマッピングするため事前準備 */
    const existingProfileIdMap = prepareExistingProfileMapping(importMapper);
    /* スニペットに紐づくカテゴリ（選択されていない既存重複カテゴリも含む）を正しくマッピングするため事前準備 */
    const existingCategoryIdMap = prepareExistingCategoryMapping(importMapper);

    /* インポート順序が重要: カテゴリ → 変数 → プロファイル → 変数値 → スニペット */
    /* スニペットがカテゴリIDとプロファイルIDを参照するため、依存関係を解決してからインポート */
    const categoryIdMap = importCategories(importMapper, selectedCategoryIds, existingCategoryIdMap);
    const variableIdMap = importVariables(importMapper, selectedVariableIds);
    const { profileIdMap, defaultProfileId } = importProfiles(importMapper, selectedProfileIds, existingProfileIdMap);
    importVariableValues(importMapper, variableIdMap, profileIdMap);
    importSnippets(importMapper, selectedSnippetIds, categoryIdMap, profileIdMap);

    return defaultProfileId;
  }


  /**
   * 既存の一時データベースからデータベース全体をインポート（既存データ削除→挿入方式）
   *
   * @param tempDbPath - 既に作成済みの一時データベースのパス
   */
  static async importDatabaseFromTempDb(tempDbPath: string): Promise<void> {
    if (!hasTempDbAdapter()) {
      throw new Error('TempDbAdapter is required for importDatabaseFromTempDb. Call setTempDbAdapter() first.');
    }

    if (!hasMainDbAdapter()) {
      throw new Error('MainDbAdapter is required for importDatabaseFromTempDb. Call setMainDbAdapter() first.');
    }

    Logger.info('[ImportService] Starting database import from temp DB...');
    const tempDbAdapter = getTempDbAdapter();
    await tempDbAdapter.open?.(tempDbPath);

    try {
      /* インポート前にサブスクリプション状態を更新（updateValidFlagsで使用されるため） */
      await this.refreshSubscriptionForImport();

      const mapper = new ImportMapper(tempDbAdapter);
      this.runFullRestore(mapper);

      Logger.info('[ImportService] Import completed successfully');
    } catch (error) {
      Logger.error('[ImportService] Import failed:', error);
      /* Error以外がthrowされたときの文言は現行の日本語リテラルをそのまま維持する。
         PartialImportError の既定値へ委ねると message が 'Partial import failed' に変わり、
         ログと翻訳失敗時のフォールバック表示が変化するため。i18n化は別途判断すること */
      throw new PartialImportError(
        error instanceof Error ? error.message : 'インポート中にエラーが発生しました',
        error
      );
    } finally {
      tempDbAdapter.close?.();
    }
  }

  /**
   * 全復元を単一トランザクションで実行する。
   * 通常のupsert経路を通さず、バックアップの識別子とメタデータを保持する。
   */
  private static runFullRestore(importMapper: ImportMapper): void {
    const restoreData = importMapper.getFullRestoreData();
    const mainDbAdapter = getMainDbAdapter();

    mainDbAdapter.transaction(() => {
      this.clearAllDataForFullRestore();

      restoreData.categories.forEach((row) => CategoryMapper.restore(row));
      restoreData.variables.forEach((row) => VariableMapper.restore(row));
      restoreData.profiles.forEach((row) => ProfileMapper.restore(row));
      restoreData.snippets.forEach((row) => SnippetMapper.restore(row));
      restoreData.profileVariables.forEach((row) =>
        ProfileVariableMapper.restore(row)
      );
      restoreData.snippetProfiles.forEach((row) =>
        SnippetMapper.restoreProfileLink(row)
      );
      SystemVariableFormatMapper.restoreAllWithinTransaction(
        restoreData.systemVariableFormats
      );
      restoreData.shortcuts.forEach((row) => ShortcutMapper.restore(row));
      /* 紐づけは本体の後に復元する（定型文のsnippetProfilesと同じ理由）。
         紐づけが0件のショートカットは行を持たないため、そのまま全プロファイル向けとして戻る */
      restoreData.shortcutProfiles.forEach((row) =>
        ShortcutMapper.restoreProfileLink(row)
      );
      restoreData.shortcutValues.forEach((row) => ShortcutMapper.restoreValue(row));

      /* 壊れたバックアップに標準・アクティブが無い場合だけ補完する。 */
      ProfileService.ensureDefaultAndActive();
      SubscriptionService.updateValidFlags();
    });

    SystemVariableFormatMapper.loadRegistry();
  }

  /**
   * 既存の全データを削除（外部キー制約を考慮した順序）
   *
   * @remarks
   * 宣言上の外部キーに合わせて関連テーブルから先に削除する。
   * 実行時には外部キーを強制していないため、条件なしの全件削除では順序が結果を変えない
   */
  private static clearAllDataForFullRestore(): void {
    const mainDbAdapter = getMainDbAdapter();

    try {
      mainDbAdapter.run('DELETE FROM system_variable_formats');

      /* ショートカットは値・紐づけ（shortcut_profiles）・本体の3表をすべて全件削除する。
         どれかを消し忘れると、復元後に旧データの行が残り、同じIDの値や紐づけが混ざってしまう。
         いずれも条件なしの全件削除で、実行時に外部キーも強制していないため順序は結果に影響しない。
         宣言上の依存（子→親）に合わせて、値・紐づけを本体より先に書いている */
      mainDbAdapter.run('DELETE FROM shortcut_values');
      mainDbAdapter.run('DELETE FROM shortcut_profiles');
      mainDbAdapter.run('DELETE FROM shortcuts');

      /* 外部キー制約を考慮した削除順序 */
      /* 1. 中間テーブル（外部キー参照） */
      mainDbAdapter.run('DELETE FROM snippet_profiles');
      mainDbAdapter.run('DELETE FROM profile_variables');

      /* 2. エンティティテーブル（外部キーを参照） */
      mainDbAdapter.run('DELETE FROM snippets');
      mainDbAdapter.run('DELETE FROM profiles');

      /* 3. エンティティテーブル（他から参照される） */
      /* カスタム変数のみ削除（システム変数は保持） */
      mainDbAdapter.run("DELETE FROM variables WHERE type = 'custom'");

      /* 4. カテゴリテーブル */
      mainDbAdapter.run('DELETE FROM categories');

      Logger.info('[ImportService] All existing data deleted');
    } catch (error) {
      Logger.error('[ImportService] Failed to delete existing data:', error);
      throw error;
    }
  }

  /**
   * 一時データベースファイルを削除
   *
   * @param tempDbPath - 一時データベースのパス
   */
  static cleanupTempDatabase(tempDbPath: string): void {
    if (!hasImportAdapter()) {
      Logger.warn('[ImportService] ImportAdapter not available for cleanup');
      return;
    }

    const adapter = getImportAdapter();
    adapter.deleteFile(tempDbPath).catch((error) => {
      Logger.warn('[ImportService] Failed to cleanup temp db:', error);
    });
  }

  /**
   * インポート元ファイル（キャッシュ内）を削除
   *
   * @param fileUri - インポート元ファイルのURI
   *
   * @remarks
   * Mobile専用: DocumentPickerでコピーされたキャッシュファイルを削除する。
   * Web版ではアダプターにこのメソッドがないため、何も実行されない。
   */
  static cleanupImportSourceFile(fileUri: string): void {
    if (!hasImportAdapter()) {
      return;
    }

    const adapter = getImportAdapter();

    /* キャッシュの後始末はベストエフォート。
       完了を待たず、失敗してもインポート結果には影響させない */
    adapter.deleteImportSourceFile?.(fileUri).catch((err) => {
      Logger.warn('[ImportService] Failed to delete import source file:', err);
    });
  }
}
