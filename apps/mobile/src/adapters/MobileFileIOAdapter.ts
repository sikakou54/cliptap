/**
 * Mobile用ファイルI/Oアダプター
 *
 * @description
 * expo-file-systemをラップして、共通FileIOAdapterインターフェースを実装。
 * 純粋なファイル操作のみを提供し、UI関連機能（共有/選択）は別Adapterに分離。
 *
 * @module MobileFileIOAdapter
 */

import { Paths, File, Directory } from 'expo-file-system';
import { Platform } from 'react-native';
import type { FileIOAdapter, FileInfo } from '@cliptap/shared';
import { Logger } from '@cliptap/shared';

export class MobileFileIOAdapter implements FileIOAdapter {
  /**
   * パスをfile:// URI形式に正規化
   * expo-file-systemはfile://形式を要求するため、様々な形式に対応
   */
  private normalizeUri(pathOrUri: string): string {
    if (pathOrUri.startsWith('file://')) {
      return pathOrUri;
    }
    if (pathOrUri.startsWith('file:/')) {
      return pathOrUri.replace(/^file:\/+/, 'file:///');
    }
    if (pathOrUri.includes('://')) {
      return pathOrUri;
    }
    return `file://${pathOrUri}`;
  }

  async readFile(uri: string): Promise<string> {
    try {
      const file = new File(this.normalizeUri(uri));
      return await file.text();
    } catch (error) {
      Logger.error('[MobileFileIOAdapter] Read failed:', error);
      throw error;
    }
  }

  async readBinary(uri: string): Promise<string> {
    try {
      const file = new File(this.normalizeUri(uri));
      return await file.base64();
    } catch (error) {
      Logger.error('[MobileFileIOAdapter] Read binary failed:', error);
      throw error;
    }
  }

  async writeFile(
    filename: string,
    content: string,
    options?: { encoding?: 'utf8' | 'base64' }
  ): Promise<string> {
    try {
      const file = new File(Paths.cache, filename);
      /* expo-file-systemのwrite/deleteは同期API */
      file.write(content, { encoding: options?.encoding === 'base64' ? 'base64' : 'utf8' });
      return file.uri;
    } catch (error) {
      Logger.error('[MobileFileIOAdapter] Write failed:', error);
      throw error;
    }
  }

  async deleteFile(uri: string): Promise<void> {
    try {
      const file = new File(this.normalizeUri(uri));
      if (file.exists) {
        file.delete();
      }
    } catch (error) {
      Logger.error('[MobileFileIOAdapter] Delete failed:', error);
      throw error;
    }
  }

  async exists(uri: string): Promise<boolean> {
    try {
      const file = new File(this.normalizeUri(uri));
      return file.exists;
    } catch (error) {
      Logger.error('[MobileFileIOAdapter] Exists check failed:', error);
      return false;
    }
  }

  async getInfo(uri: string): Promise<FileInfo> {
    try {
      const file = new File(this.normalizeUri(uri));
      return {
        exists: file.exists,
        isDirectory: (file as any).isDirectory ?? false,
        size: file.size ?? undefined,
        uri: file.uri,
        modificationTime: file.modificationTime ?? undefined,
      };
    } catch (error) {
      Logger.error('[MobileFileIOAdapter] Get info failed:', error);
      throw error;
    }
  }

  async makeDirectory(uri: string): Promise<void> {
    try {
      const dir = new Directory(this.normalizeUri(uri));
      Logger.info('[MobileFileIOAdapter] Make directory:', dir.uri);
      if (!dir.exists) {
        dir.create();
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        return;
      }
      Logger.error('[MobileFileIOAdapter] Make directory failed:', error);
      throw error;
    }
  }

  /* ======================================== */
  /* ディレクトリパス取得 */
  /* ======================================== */

  getDocumentDirectory(): string {
    return Paths.document.uri.replace('file://', '');
  }

  /**
   * App Group共有コンテナディレクトリのパスを取得
   * iOS: Widgets/App ExtensionsとのDB共有に使用
   * Android: 同等のディレクトリ構造を構築
   */
  async getAppGroupDirectory(identifier: string): Promise<string | null> {
    try {
      if (Platform.OS === 'android') {
        const sharedDir = new Directory(
          Paths.document.parentDirectory,
          'files',
          identifier,
          'databases'
        );
        return sharedDir.uri.replace('file://', '');
      }

      const sharedContainer = Paths.appleSharedContainers[identifier];
      if (!sharedContainer) {
        return null;
      }
      const databasesDir = new Directory(sharedContainer, 'databases');
      return databasesDir.uri.replace('file://', '');
    } catch (error) {
      Logger.error('[MobileFileIOAdapter] Get App Group dir failed:', error);
      return null;
    }
  }
}

