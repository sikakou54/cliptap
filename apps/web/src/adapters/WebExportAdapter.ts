/**
 * Web用ExportAdapter
 *
 * @description
 * エクスポート処理で必要なプラットフォーム固有の機能を提供。
 * shared層のExportServiceから呼び出される。
 *
 * Adapterはファイルの保存（ダウンロード）だけを担当し、
 * データベースの直列化とファイル内容の組み立てはService層で実行する。
 *
 * @module WebExportAdapter
 */

import {
  type ExportAdapter,
  type FileShareAdapter,
} from '@cliptap/shared';

/**
 * Web用ExportAdapter実装クラス
 */
export class WebExportAdapter implements ExportAdapter {
  private fileShare: FileShareAdapter;

  constructor(fileShare: FileShareAdapter) {
    this.fileShare = fileShare;
  }

  /**
   * エクスポートデータをファイルとして保存（ダウンロード）
   */
  async saveExportFile(fileName: string, content: string): Promise<string> {
    /* BlobとURLを作成 */
    const blob = new Blob([content], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);

    /* ダウンロード */
    await this.fileShare.shareFile(url, fileName);

    /* URLを解放 */
    URL.revokeObjectURL(url);

    return url;
  }
}
