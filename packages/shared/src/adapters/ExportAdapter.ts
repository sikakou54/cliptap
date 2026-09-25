/**
 * エクスポートアダプター
 *
 * @description
 * エクスポート処理で必要なプラットフォーム固有の機能を抽象化。
 * Adapterはファイルの保存・共有だけを担当し、
 * データベースの直列化とファイル内容の組み立てはService層で実行する。
 *
 * @module ExportAdapter
 */

/**
 * エクスポートアダプターインターフェース
 */
export interface ExportAdapter {
  /**
   * エクスポートデータをファイルとして保存
   *
   * @param fileName - 保存するファイル名
   * @param content - JSON文字列データ
   * @returns 保存したファイルのパス（またはURL）
   */
  saveExportFile(fileName: string, content: string): Promise<string>;
}

let exportAdapter: ExportAdapter | null = null;

/**
 * エクスポートアダプターを登録
 * @param adapter - プラットフォーム固有のExportAdapter実装
 */
export function setExportAdapter(adapter: ExportAdapter): void {
  exportAdapter = adapter;
}

/**
 * 登録済みのエクスポートアダプターを取得
 * @returns 登録済みアダプター
 * @throws {Error} アダプターが未登録の場合
 */
export function getExportAdapter(): ExportAdapter {
  if (!exportAdapter) {
    throw new Error('ExportAdapter is not set. Call setExportAdapter() first.');
  }
  return exportAdapter;
}

/**
 * エクスポートアダプターが登録済みか確認
 * @returns 登録済みの場合true
 */
export function hasExportAdapter(): boolean {
  return exportAdapter !== null;
}
