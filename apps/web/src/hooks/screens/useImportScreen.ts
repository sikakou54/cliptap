/**
 * 復元画面のビジネスロジックフック
 *
 * @description
 * 復元（バックアップファイルによる全件置換）処理の状態管理とロジックを提供。
 * useWebImportをラップし、Dashboard画面と共通ページレイアウト向けの統一インターフェースを提供。
 *
 * @see pages/Dashboard.tsx - 使用元
 * @see components/layout/PageLayout.tsx - 使用元
 * @see hooks/useWebImport.ts - 実装詳細
 */

import { useCallback } from 'react';
import {
  Logger,
  translateError,
  useSnippets,
  useProfiles,
  useVariables,
  useCategories,
} from '@cliptap/shared';
import { useWebImport } from '@hooks/useWebImport';
import { showErrorAlert, showConfirm } from '@utils/alerts';

export interface UseImportScreenParams {
  /** 現在のユーザー */
  user: { uid: string } | null;
  /** ローディング状態更新関数 */
  setLoaded: (loaded: boolean) => void;
}

export interface UseImportScreenReturn {
  /* 状態 */
  /** ファイル選択モーダル表示中か */
  showFileModal: boolean;
  /** ファイルの検証または復元の処理中か（ファイル選択モーダルを閉じられないようにする） */
  isBusy: boolean;

  /* ハンドラ */
  /** ファイル選択モーダルを開く */
  openFileModal: () => void;
  /** ファイル選択モーダルを閉じる（準備済みの一時DBの破棄を伴う） */
  closeFileModal: () => void;
  /** ファイル選択時のハンドラ（検証後に全削除の確認を出し、同意すれば全件置換する） */
  handleFileSelected: (fileData: unknown, password: string) => Promise<void>;
}

/**
 * 復元画面のビジネスロジックフック
 */
export function useImportScreen({
  user,
  setLoaded,
}: UseImportScreenParams): UseImportScreenReturn {
  /* Provider refresh関数を取得 */
  const { refresh: refreshSnippets } = useSnippets();
  const { refresh: refreshProfiles } = useProfiles();
  const { refresh: refreshVariables } = useVariables();
  const { refresh: refreshCategories } = useCategories();

  /* エラーハンドラ */
  const handleError = useCallback((error: Error) => {
    Logger.error('Import error:', error);
    const translatedMessage = translateError(error);
    showErrorAlert(translatedMessage);
  }, []);

  /* 復元完了時にすべてのProviderをリフレッシュ */
  const handleImportComplete = useCallback(() => {
    refreshSnippets();
    refreshProfiles();
    refreshVariables();
    refreshCategories();
  }, [refreshSnippets, refreshProfiles, refreshVariables, refreshCategories]);

  /* 内部のWebインポートフック */
  const webImport = useWebImport({
    user,
    setLoaded,
    onError: handleError,
    onImportComplete: handleImportComplete,
  });

  /* ファイル選択モーダルを開く */
  const openFileModal = useCallback(() => {
    webImport.setShowFileSelect(true);
  }, [webImport]);

  /* ファイル選択モーダルを閉じる（復元せずに閉じるため、準備済みの一時DBを残さない） */
  const closeFileModal = useCallback(() => {
    webImport.discardPreparedRestore();
    webImport.setShowFileSelect(false);
  }, [webImport]);

  /* ファイルを検証し、全削除の確認に同意した場合だけ全件置換する */
  const handleFileSelected = useCallback(async (fileData: unknown, password: string) => {
    const prepared = await webImport.handleFileSelected(fileData, password);
    if (!prepared) return;

    showConfirm(
      'backup.restore_confirm',
      () => {
        void webImport.handleRestoreBackup();
      },
      () => {
        /* 取消時はファイル選択モーダルを開いたまま、準備した一時DBだけを破棄する */
        webImport.discardPreparedRestore();
      }
    );
  }, [webImport]);

  return {
    /* 状態 */
    showFileModal: webImport.showFileSelect,
    isBusy: webImport.isLoading || webImport.isProcessing,

    /* ハンドラ */
    openFileModal,
    closeFileModal,
    handleFileSelected,
  };
}

