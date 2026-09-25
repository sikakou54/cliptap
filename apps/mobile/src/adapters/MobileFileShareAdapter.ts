/**
 * Mobile用ファイル共有アダプター
 *
 * @description
 * expo-sharingをラップして、共通FileShareAdapterインターフェースを実装。
 *
 * @module MobileFileShareAdapter
 */

import * as Sharing from 'expo-sharing';
import type { FileShareAdapter } from '@cliptap/shared';
import { Logger } from '@cliptap/shared';

/*
 * 共有シートのタイトルは仕様（docs/機能仕様書.md §8.13）でUI言語にかかわらず
 * 日本語固定と定められているため、意図的に i18next を経由しない。
 */
const SHARE_DIALOG_TITLE = 'バックアップファイルを保存';

export class MobileFileShareAdapter implements FileShareAdapter {
  /**
   * ファイルを共有する
   *
   * @param uri - 共有するファイルのURI
   * @param _filename - 共有時のファイル名。expo-sharing はファイル名を指定できず、
   *                    URIのファイル名がそのまま使われるためMobileでは参照しない
   */
  async shareFile(uri: string, _filename?: string): Promise<void> {
    try {
      if (!(await Sharing.isAvailableAsync())) {
        throw new Error('Sharing is not available');
      }
      /* iOS/Androidのシステム共有シート（Share Sheet）を表示 */
      await Sharing.shareAsync(uri, {
        mimeType: 'application/octet-stream',
        dialogTitle: SHARE_DIALOG_TITLE,
      });
    } catch (error) {
      Logger.error('[MobileFileShareAdapter] Share failed:', error);
      throw error;
    }
  }
}

