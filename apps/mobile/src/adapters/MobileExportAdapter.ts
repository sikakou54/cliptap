/**
 * Mobile用ExportAdapter
 *
 * @description
 * エクスポート処理で必要なプラットフォーム固有の機能を提供。
 * shared層のExportServiceから呼び出される。
 *
 * @module MobileExportAdapter
 */

import {
  type ExportAdapter,
  type FileIOAdapter,
  type FileShareAdapter,
} from '@cliptap/shared';

export class MobileExportAdapter implements ExportAdapter {
  private fileIO: FileIOAdapter;
  private fileShare: FileShareAdapter;

  constructor(fileIO: FileIOAdapter, fileShare: FileShareAdapter) {
    this.fileIO = fileIO;
    this.fileShare = fileShare;
  }

  async saveExportFile(fileName: string, content: string): Promise<string> {
    const exportFileUri = await this.fileIO.writeFile(fileName, content);

    /* Mobile: システム共有シートで保存先選択（iOS/Android標準UI） */
    await this.fileShare.shareFile(exportFileUri, fileName);

    await this.fileIO.deleteFile(exportFileUri).catch(() => { });

    return exportFileUri;
  }
}
