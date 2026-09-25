/**
 * エクスポートサービス
 *
 * @description
 * バックアップ（全データの.cliptapファイル出力）のプラットフォーム共通ロジックを提供する。
 * プラットフォーム固有の処理はExportAdapter経由で注入。
 *
 * @module ExportService
 */

import { getExportAdapter, hasExportAdapter } from '../adapters/ExportAdapter';
import { getCryptoAdapter, type CryptoAdapter } from '../adapters/CryptoAdapter';
import { getMainDbAdapter, hasMainDbAdapter } from '../adapters/DbAdapter';
import {
  buildPasswordHashInput,
  buildChecksumPayload,
  base64ToDoubleBase64,
} from '../utils/exportImportUtils';
import { SCHEMA_VERSION } from '../database/schema';
import { Logger } from '../utils/logger';
import { ExportFailedError } from '../errors';

/**
 * エクスポート実行結果（内部型）
 */
interface ExportExecutionResult {
  filePath: string;
}

/**
 * エクスポートデータ形式（内部型）
 */
interface ExportData {
  /** スキーマバージョン */
  s: number;
  /** エクスポート日時（ISO 8601） */
  t: string;
  /** パスワードハッシュ（SHA-256） */
  h: string;
  /** データ（二重Base64エンコード） */
  d: string;
  /** チェックサム（SHA-256） */
  c: string;
}

/**
 * エクスポートサービスクラス
 *
 * @description
 * プラットフォーム共通のエクスポートロジックを提供。
 * ExportAdapterを使用してプラットフォーム固有の処理を実行。
 * すべて静的メソッドで提供。
 */
export class ExportService {
  private static get crypto(): CryptoAdapter {
    return getCryptoAdapter();
  }

  /**
   * 共通のエクスポートデータ構築ロジック
   *
   * @param doubleBase64 - 二重Base64エンコード済みのデータベースバイナリ
   * @param password - エクスポートに使用するパスワード
   * @returns エクスポートファイルへ書き出すJSON文字列
   */
  private static async buildExportData(doubleBase64: string, password: string): Promise<string> {
    const exportDate = new Date().toISOString();

    const passwordHash = await ExportService.crypto.sha256(
      buildPasswordHashInput(password, SCHEMA_VERSION)
    );

    const dataToHash = buildChecksumPayload({
      s: SCHEMA_VERSION,
      t: exportDate,
      h: passwordHash,
      d: doubleBase64,
    });

    const checksum = await ExportService.crypto.sha256(dataToHash);

    const data: ExportData = {
      s: SCHEMA_VERSION,
      t: exportDate,
      h: passwordHash,
      d: doubleBase64,
      c: checksum,
    };

    return JSON.stringify(data);
  }

  /**
   * Base64文字列形式のデータベースからエクスポートデータを作成（内部メソッド）
   *
   * @param dbBase64 - SQLiteデータベースのBase64文字列
   * @param password - エクスポートに使用するパスワード
   * @returns エクスポートファイルへ書き出すJSON文字列
   */
  private static async createExportDataFromBase64(dbBase64: string, password: string): Promise<string> {
    const doubleBase64 = base64ToDoubleBase64(dbBase64);
    return ExportService.buildExportData(doubleBase64, password);
  }

  /**
   * タイムスタンプ付きのバックアップファイル名を生成
   *
   * @returns ファイル名（例: ClipTap_backup_20251210143025.cliptap）
   */
  static generateFilename(): string {
    const now = new Date();
    const timestamp = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
      String(now.getSeconds()).padStart(2, '0'),
    ].join('');

    return `ClipTap_backup_${timestamp}.cliptap`;
  }

  /**
   * 全データをバックアップファイルとして出力
   *
   * @param password - 復元時の同一ファイル確認に使うパスワード
   * @returns エクスポート結果（ファイルパス）
   * @throws ExportFailedError 出力に失敗した場合
   *
   * @remarks
   * メインDBをそのまま直列化するため、一時DBは作らない。
   * 復元は行を逐語で戻すため、端末のDBと同じ内容がそのまま復元される。
   */
  static async exportAllData(password: string): Promise<ExportExecutionResult> {
    if (!hasExportAdapter()) {
      throw new Error('ExportAdapter is required for exportAllData. Call setExportAdapter() first.');
    }
    if (!hasMainDbAdapter()) {
      throw new Error('MainDbAdapter is required for exportAllData. Call setMainDbAdapter() first.');
    }

    const adapter = getExportAdapter();
    const mainDbAdapter = getMainDbAdapter();

    try {
      Logger.info('[ExportService] Starting backup');

      if (!mainDbAdapter.exportAsBase64) {
        throw new Error('MainDbAdapter.exportAsBase64 is required for exportAllData.');
      }
      const dbBase64 = await mainDbAdapter.exportAsBase64();
      Logger.info(`[ExportService] Main DB serialized (${dbBase64.length} chars)`);

      const json = await this.createExportDataFromBase64(dbBase64, password);
      const exportFileName = this.generateFilename();

      const exportFileUri = await adapter.saveExportFile(exportFileName, json);

      Logger.info(`[ExportService] Backup file created: ${exportFileUri}`);

      return { filePath: exportFileUri };
    } catch (error) {
      Logger.error('[ExportService] Backup failed:', error);
      throw new ExportFailedError(
        error instanceof Error ? error.message : 'Unknown error',
        error
      );
    }
  }
}
