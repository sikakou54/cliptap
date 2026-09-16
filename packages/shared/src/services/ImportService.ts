/**
 * インポートサービス（共通）
 *
 * @description
 * バックアップファイル（.cliptap）による復元のビジネスロジックを提供する共通サービス。
 * 復元は現在の業務データを削除し、バックアップの行を識別子・日時・使用回数・関連ごと逐語で戻す（全件置換）。
 *
 * 復元フロー:
 * 1. prepareImportDatabase: ファイルを検証し、一時DBへ書き出して最新スキーマへ移行する
 * 2. importDatabaseFromTempDb: 単一トランザクションで全件置換し、有効状態を再計算する
 * 3. cleanupTempDatabase / cleanupImportSourceFile: 一時DBと選択元キャッシュを削除する
 *
 * @module ImportService
 */

import { ImportMapper } from '../mappers/ImportMapper';
import { getTempDbAdapter, hasTempDbAdapter, getMainDbAdapter, hasMainDbAdapter } from '../adapters/DbAdapter';
import { getImportAdapter, hasImportAdapter } from '../adapters/ImportAdapter';
import { ImportParserService } from './ImportParserService';
import { Logger } from '../utils/logger';
import { generateUniqueId } from '../utils/dateHelpers';
import { uint8ArrayToBase64 } from '../utils/exportImportUtils';
import { RestoreFailedError } from '../errors';
import { ProfileService } from './ProfileService';
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

/**
 * インポートサービスクラス
 *
 * @description
 * ImportAdapterを使用してプラットフォーム固有の処理を実行。
 * すべて静的メソッドで提供。
 *
 * importDatabaseFromTempDb は prepareImportDatabase が作った一時DBのパスを受け取り、全データを逐語で復元する。
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
         RestoreFailedError の既定値へ委ねると message が 'Restore failed' に変わり、
         ログと翻訳失敗時のフォールバック表示が変化するため。i18n化は別途判断すること */
      throw new RestoreFailedError(
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

      /* ショートカットは紐づけ（shortcut_profiles）・本体の2表をすべて全件削除する。
         どちらかを消し忘れると、復元後に旧データの行が残り、同じIDの紐づけが混ざってしまう。
         いずれも条件なしの全件削除で、実行時に外部キーも強制していないため順序は結果に影響しない。
         宣言上の依存（子→親）に合わせて、紐づけを本体より先に書いている */
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
