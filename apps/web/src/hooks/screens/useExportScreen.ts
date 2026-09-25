/**
 * バックアップ画面のビジネスロジックフック
 *
 * @description
 * バックアップ（全データのエクスポート）処理の状態管理とロジックを提供。
 * Dashboard画面と共通ページレイアウトで使用する専用フック。
 *
 * @see pages/Dashboard.tsx - 使用元
 * @see components/layout/PageLayout.tsx - 使用元
 */

import { useState, useCallback } from 'react';
import { Logger, translateError } from '@cliptap/shared';
import { showErrorAlert } from '@utils/alerts';

export interface UseExportScreenReturn {
  /* 状態 */
  /** バックアップ用パスワードモーダル表示中か */
  showExportModal: boolean;
  /** バックアップ処理中か */
  isExporting: boolean;

  /* ハンドラ */
  /** バックアップ用パスワードモーダルを開く */
  openExportModal: () => void;
  /** バックアップ用パスワードモーダルを閉じる */
  closeExportModal: () => void;
  /** 全データをバックアップファイルとして出力する */
  handleExport: (password: string) => Promise<void>;
}

/**
 * バックアップ画面のビジネスロジックフック
 */
export function useExportScreen(): UseExportScreenReturn {
  /* ======================================== */
  /* 状態管理 */
  /* ======================================== */
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  /* ======================================== */
  /* ハンドラ */
  /* ======================================== */

  /** バックアップ用パスワードモーダルを開く */
  const openExportModal = useCallback(() => {
    setShowExportModal(true);
  }, []);

  /** バックアップ用パスワードモーダルを閉じる */
  const closeExportModal = useCallback(() => {
    setShowExportModal(false);
  }, []);

  /**
   * 全データをバックアップファイルとして出力する
   *
   * @remarks
   * 成功時だけモーダルを閉じる。失敗時はエラーを表示し、同じモーダルから再試行できるよう開いたままにする。
   */
  const handleExport = useCallback(async (password: string) => {
    setIsExporting(true);
    try {
      const { ExportService } = await import('@cliptap/shared');
      await ExportService.exportAllData(password);
      setShowExportModal(false);
    } catch (err) {
      Logger.error('Failed to back up:', err);
      const translatedMessage = translateError(err);
      showErrorAlert(translatedMessage);
    } finally {
      setIsExporting(false);
    }
  }, []);

  return {
    /* 状態 */
    showExportModal,
    isExporting,

    /* ハンドラ */
    openExportModal,
    closeExportModal,
    handleExport,
  };
}

