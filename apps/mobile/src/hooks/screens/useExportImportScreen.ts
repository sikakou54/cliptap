/**
 * バックアップ・復元画面カスタムフック
 *
 * 全データのバックアップと、バックアップファイルによる復元（全件置換）のビジネスロジックを管理するフック。
 * UI層からバックアップ・復元処理を分離する。
 *
 * 主な責務:
 * - パスワードモーダルの状態管理
 * - バックアップ処理の実行
 * - 復元処理の実行（確認後に全件置換）
 * - 一時データベースと選択元キャッシュのクリーンアップ
 *
 * @see app/settings/export-import.tsx - バックアップ・復元画面UI
 */

import { useState, useCallback } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import {
  useTranslation,
  InvalidFileTypeError,
  PasswordRequiredError,
  ExportService,
  ImportService,
  translateError,
  useSnippets,
  useProfiles,
  useVariables,
  useCategories,
} from '@cliptap/shared';
import { showAlert, showConfirm, showErrorAlert } from '@utils/alerts';

/* ======================================== */
/* 型定義 */
/* ======================================== */

/** モーダルのモード */
export type ModalMode = 'export' | 'import';

/**
 * 復元の準備で作成・保持したファイルの組
 * 確認の取消・復元の成功・失敗のいずれでも両方を削除する
 */
interface PreparedRestore {
  /** 検証と移行を終えた一時データベースファイルのパス */
  tempDbPath: string;
  /** 選択したバックアップファイルのキャッシュURI */
  sourceFileUri: string;
}

/** useExportImportScreen フックの返却値 */
export interface UseExportImportScreenReturn {
  /* 状態 */
  /** パスワードモーダル表示状態 */
  showPasswordModal: boolean;
  /** モーダルモード */
  modalMode: ModalMode;
  /** パスワード入力値 */
  password: string;
  /** 処理中フラグ */
  isProcessing: boolean;

  /* セッター */
  /** パスワード更新 */
  setPassword: (password: string) => void;

  /* ハンドラ */
  /** バックアップボタン押下 */
  handleExportBackup: () => void;
  /** 復元ボタン押下 */
  handleImportBackup: () => Promise<void>;
  /** パスワード送信 */
  handlePasswordSubmit: () => Promise<void>;
  /** パスワードモーダルを閉じる */
  closePasswordModal: () => void;
}

/* ======================================== */
/* フック実装 */
/* ======================================== */

export function useExportImportScreen(): UseExportImportScreenReturn {
  const { t } = useTranslation();
  const router = useRouter();

  /* Provider refresh関数を取得 */
  const { refresh: refreshSnippets } = useSnippets();
  const { refresh: refreshProfiles } = useProfiles();
  const { refresh: refreshVariables } = useVariables();
  const { refresh: refreshCategories } = useCategories();

  /* ======================================== */
  /* 状態管理 */
  /* ======================================== */
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('export');
  const [password, setPassword] = useState('');
  const [selectedBackupFileUri, setSelectedBackupFileUri] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  /* ======================================== */
  /* イベントハンドラ */
  /* ======================================== */

  /** パスワード入力モーダルをバックアップ用に表示 */
  const handleExportBackup = useCallback(() => {
    setModalMode('export');
    setPassword('');
    setShowPasswordModal(true);
  }, []);

  /** ファイルピッカーでバックアップファイルを選択し、パスワード入力モーダルを表示 */
  const handleImportBackup = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const fileName = result.assets[0].name;
      if (!fileName.endsWith('.cliptap')) {
        throw new InvalidFileTypeError();
      }

      setSelectedBackupFileUri(result.assets[0].uri);
      setModalMode('import');
      setPassword('');
      setShowPasswordModal(true);
    } catch (error) {
      showErrorAlert(translateError(error));
    }
  }, []);

  /** 準備した一時DBと選択元キャッシュを削除し、選択状態を戻す */
  const discardPreparedRestore = useCallback((prepared: PreparedRestore) => {
    ImportService.cleanupTempDatabase(prepared.tempDbPath);
    ImportService.cleanupImportSourceFile(prepared.sourceFileUri);
    setSelectedBackupFileUri(null);
  }, []);

  /** 準備済みの一時DBの内容で、現在のデータを全件置き換える */
  const executeRestore = useCallback(async (prepared: PreparedRestore) => {
    setIsProcessing(true);
    try {
      await ImportService.importDatabaseFromTempDb(prepared.tempDbPath);

      /* 復元後にProvider refresh */
      refreshSnippets();
      refreshProfiles();
      refreshVariables();
      refreshCategories();

      showAlert(
        '',
        t('backup.import_success'),
        undefined,
        () => {
          /* 前の画面に戻る */
          router.back();
        }
      );
    } catch (error) {
      showErrorAlert(translateError(error));
    } finally {
      /* 再試行はファイル選択からやり直すため、成功・失敗のいずれでも準備したファイルを残さない */
      discardPreparedRestore(prepared);
      setIsProcessing(false);
    }
  }, [router, t, refreshSnippets, refreshProfiles, refreshVariables, refreshCategories, discardPreparedRestore]);

  /**
   * 選択したファイルを検証し、一時DBへ移行まで済ませる
   *
   * @returns 準備したファイルの組。検証・移行に失敗した場合はnull
   *
   * @remarks
   * 失敗時は選択元キャッシュを自動削除しない（パスワード誤りなどの再入力に備えた既存の扱い）。
   */
  const prepareRestore = useCallback(async (
    submittedPassword: string,
    sourceFileUri: string
  ): Promise<PreparedRestore | null> => {
    setIsProcessing(true);
    try {
      const tempDbPath = await ImportService.prepareImportDatabase(submittedPassword, sourceFileUri);
      return { tempDbPath, sourceFileUri };
    } catch (error) {
      showErrorAlert(translateError(error));
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  /** パスワードモーダルのOKボタン押下（バックアップ実行、または復元の準備と確認） */
  const handlePasswordSubmit = useCallback(async () => {
    if (!password.trim()) {
      showErrorAlert(translateError(new PasswordRequiredError()));
      return;
    }

    const submittedPassword = password;
    /* モーダルを閉じてから処理を始める（共有シートや確認ダイアログをモーダルと重ねない） */
    setShowPasswordModal(false);
    setPassword('');

    if (modalMode === 'export') {
      setIsProcessing(true);
      try {
        /* 共有シートで保存先を選ぶ。完了後はこの画面に留まる */
        await ExportService.exportAllData(submittedPassword);
      } catch (error) {
        showErrorAlert(translateError(error));
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    if (!selectedBackupFileUri) return;

    const prepared = await prepareRestore(submittedPassword, selectedBackupFileUri);
    if (!prepared) return;

    showConfirm(
      'backup.restore_confirm',
      async () => {
        await executeRestore(prepared);
      },
      () => {
        /* 取消時も一時DBと選択元キャッシュを残さない */
        discardPreparedRestore(prepared);
      },
      'danger'
    );
  }, [password, modalMode, selectedBackupFileUri, prepareRestore, executeRestore, discardPreparedRestore]);

  const closePasswordModal = useCallback(() => {
    /* キャッシュ内の選択ファイルを削除 */
    if (selectedBackupFileUri) {
      ImportService.cleanupImportSourceFile(selectedBackupFileUri);
    }
    setShowPasswordModal(false);
    setPassword('');
    setSelectedBackupFileUri(null);
  }, [selectedBackupFileUri]);

  return {
    showPasswordModal,
    modalMode,
    password,
    isProcessing,
    setPassword,
    handleExportBackup,
    handleImportBackup,
    handlePasswordSubmit,
    closePasswordModal,
  };
}
