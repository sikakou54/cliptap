/**
 * バックアップ用パスワード入力モーダル
 *
 * @description
 * バックアップ（全データのエクスポート）前にパスワードを入力させるモーダル。
 * 入力値はこのコンポーネントが保持し、表示状態と処理中フラグは呼び出し元が保持する。
 * 出力処理中は閉じられない。処理中に閉じると画面状態だけが先に戻り、二重に操作できてしまうため。
 */

import { useEffect, useState } from 'react';
import { Dialog } from '@headlessui/react';
import { useTranslation } from '@cliptap/shared';

/**
 * バックアップ用パスワード入力モーダルのProps型定義
 */
interface ExportPasswordModalProps {
  /** モーダルの表示/非表示状態 */
  isOpen: boolean;
  /** キャンセル・背景クリック・Escキーで閉じる時のコールバック（処理中は呼ばない） */
  onClose: () => void;
  /** OKボタン押下・Enterキー送信時のコールバック */
  onSubmit: (password: string) => Promise<void>;
  /** 出力処理中かどうか（閉じる操作とOKボタンの無効化、ラベル切り替えに使う） */
  isProcessing: boolean;
}

export function ExportPasswordModal({
  isOpen,
  onClose,
  onSubmit,
  isProcessing,
}: ExportPasswordModalProps) {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');

  /**
   * モーダル表示時に前回の入力内容をクリア
   */
  useEffect(() => {
    if (isOpen) {
      setPassword('');
    }
  }, [isOpen]);

  const canSubmit = password.trim().length > 0 && !isProcessing;

  /**
   * 入力したパスワードで出力を開始する
   */
  const handleSubmit = async () => {
    if (!canSubmit) return;
    await onSubmit(password);
  };

  /**
   * 処理中は閉じられないように制御
   */
  const handleClose = () => {
    if (isProcessing) return;
    onClose();
  };

  /* バックアップ用パスワード入力モーダル */
  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      {/* 背景オーバーレイ */}
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      {/* モーダルコンテナ（中央配置） */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        {/* モーダルパネル */}
        <Dialog.Panel className="w-full max-w-md bg-white dark:bg-[#1A1A1A] rounded-2xl shadow-xl p-6">
          {/* タイトル */}
          <Dialog.Title className="text-lg font-bold text-gray-900 dark:text-white mb-2 text-center">
            {t('export_import.export_title')}
          </Dialog.Title>
          {/* 説明文 */}
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 text-center">
            {t('export_import.export_password_hint')}
          </p>
          {/* パスワード入力欄（Enterキーでも送信可能） */}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('export_import.password_placeholder')}
            autoFocus
            className="w-full px-4 py-3 border border-gray-300 dark:border-[#2A2A2A] rounded-xl focus:outline-none mb-4 bg-white dark:bg-[#1A1A1A] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-[#707070]"
            onKeyDown={(e) => {
              /* Enterキーが押されたら送信（未入力・処理中はhandleSubmit側で無視） */
              if (e.key === 'Enter') {
                void handleSubmit();
              }
            }}
          />
          {/* ボタン群（キャンセル・OK） */}
          <div className="flex gap-3">
            {/* キャンセルボタン（処理中は無効化） */}
            <button
              onClick={handleClose}
              disabled={isProcessing}
              className={`flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-[#333] border border-gray-300 dark:border-[#444] rounded-lg ${
                isProcessing ? 'cursor-not-allowed opacity-50' : 'hover:bg-gray-50 dark:hover:bg-[#444]'
              }`}
            >
              {t('common.cancel')}
            </button>
            {/* OKボタン（パスワード未入力または処理中は無効化） */}
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={`flex-1 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                !canSubmit
                  ? 'bg-blue-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {/* 処理中は「処理中」、それ以外は「OK」 */}
              {isProcessing ? t('common.processing') : t('common.ok')}
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
