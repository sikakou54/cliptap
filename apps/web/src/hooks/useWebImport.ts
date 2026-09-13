/**
 * Web用復元フック
 *
 * @description
 * Dashboard.tsxやPageLayout.tsxで使用する復元（バックアップファイルによる全件置換）の状態管理フック。
 * ファイルの検証と一時DBの準備、確認後の全件置換、準備した一時DBの破棄を分けて提供する。
 *
 * @module useWebImport
 */

import { useState, useCallback, useRef } from 'react';
import { ImportService, getFileIOAdapter, toOpfsPath } from '@cliptap/shared';
import { SQLiteWasm } from '@src/mappers/sqliteWasm';
import { webDbCacheManager } from '@adapters/WebDbCacheManager';
import type { WebFileIOAdapter } from '@adapters/WebFileIOAdapter';

/**
 * フックのオプション
 */
export interface UseWebImportOptions {
  /** 現在のユーザー */
  user: { uid: string } | null;
  /** ローディング状態更新関数（インポート後のキャッシュ保存完了時に呼ぶ） */
  setLoaded: (loaded: boolean) => void;
  /** エラーハンドラー */
  onError?: (error: Error) => void;
  /** インポート完了時のコールバック（Provider refresh用） */
  onImportComplete?: () => void;
}

/**
 * フックの戻り値
 */
export interface UseWebImportResult {
  /* 状態 */
  /** 処理中フラグ（全件置換の実行中） */
  isProcessing: boolean;
  /** ローディング中フラグ（ファイルの検証・一時DBの準備中） */
  isLoading: boolean;
  /** ファイル選択モーダル表示 */
  showFileSelect: boolean;

  /* Actions */
  /** ファイル選択モーダルを表示 */
  setShowFileSelect: (show: boolean) => void;
  /** ファイルを検証し、復元用の一時DBを準備する（準備できた場合true） */
  handleFileSelected: (fileData: unknown, password: string) => Promise<boolean>;
  /** 準備済みの一時DBで全データを置き換える */
  handleRestoreBackup: () => Promise<void>;
  /** 準備済みの一時DBを破棄する（確認の取消・モーダルを閉じたとき） */
  discardPreparedRestore: () => void;
}

/**
 * Web用復元フック
 */
export function useWebImport(options: UseWebImportOptions): UseWebImportResult {
  const { onError, onImportComplete } = options;

  /* 状態 */
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showFileSelect, setShowFileSelect] = useState(false);

  /* 一時DBパス（キー）をrefで保持 */
  const tempDbPathRef = useRef<string | null>(null);

  /**
   * 保持中の復元用一時DBをOPFSから削除する
   *
   * @remarks
   * OPFSは永続領域のため、削除しないと `import_temp_*.db` が取込のたびに溜まり続ける。
   * cleanupTempDatabase は内部で削除失敗をログに落とすだけなので、取込結果には影響しない。
   */
  const discardTempDb = useCallback(() => {
    const path = tempDbPathRef.current;
    if (!path) return;
    tempDbPathRef.current = null;
    ImportService.cleanupTempDatabase(path);
  }, []);

  /**
   * インポート後の共通後処理
   */
  const postImportProcess = useCallback(async () => {
    /* 現在のSQLiteデータベースをキャッシュに即座に保存（ゲストモードでも保存） */
    await webDbCacheManager.flush();
  }, []);

  /**
   * ファイルを検証し、復元用の一時DBを準備する
   *
   * @returns 一時DBを準備できた場合true
   */
  const handleFileSelected = useCallback(async (fileData: unknown, password: string): Promise<boolean> => {
    setIsLoading(true);
    /* 連続して読み込んだときに前回の一時DBが孤児として残らないよう先に破棄する */
    discardTempDb();
    /* FileオブジェクトをOPFSに一時保存してから処理 */
    const file = fileData as File;
    const tempImportPath = toOpfsPath(`temp_import_${Date.now()}.json`);
    const fileIO = getFileIOAdapter() as WebFileIOAdapter;

    try {
      /* ファイル内容を読み込んでOPFSに保存 */
      const fileContent = await file.text();
      await fileIO.writeFile(tempImportPath, fileContent);

      /* SQLiteWasmを初期化 */
      await SQLiteWasm.init();

      /* shared層のImportServiceを使ってファイル検証・一時DB作成（失敗時の一時DBはService側で削除される） */
      tempDbPathRef.current = await ImportService.prepareImportDatabase(password, tempImportPath);
      return true;
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error(String(error)));
      return false;
    } finally {
      /* 一時ファイルを削除 */
      try {
        await fileIO.deleteFile(tempImportPath);
      } catch {
        /* 削除失敗は無視 */
      }
      setIsLoading(false);
    }
  }, [onError, discardTempDb]);

  /**
   * 準備済みの一時DBで全データを置き換える
   *
   * @remarks
   * 再試行はファイルの読み込みからやり直すため、成功・失敗のいずれでも一時DBを残さない。
   */
  const handleRestoreBackup = useCallback(async () => {
    const tempDbPath = tempDbPathRef.current;
    if (!tempDbPath) return;

    setIsProcessing(true);
    try {
      /* ImportServiceを使用して既存データを削除してからインポート */
      await ImportService.importDatabaseFromTempDb(tempDbPath);
      /* 注意: サブスクリプション状態の更新とupdateValidFlagsはImportService内で実行される */

      /* 後処理 */
      await postImportProcess();

      /* Provider refresh */
      onImportComplete?.();

      setShowFileSelect(false);
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error(String(error)));
    } finally {
      discardTempDb();
      setIsProcessing(false);
    }
  }, [onError, onImportComplete, postImportProcess, discardTempDb]);

  return {
    /* 状態 */
    isProcessing,
    isLoading,
    showFileSelect,

    /* Actions */
    setShowFileSelect,
    handleFileSelected,
    handleRestoreBackup,
    discardPreparedRestore: discardTempDb,
  };
}
