/**
 * スニペットカードのビジネスロジックフック
 *
 * スニペットカードに必要な状態管理とロジックを提供。
 * UIコンポーネント（SnippetCard.tsx）から完全に分離されたビジネスロジック層。
 *
 * 主な責務:
 * - コピー状態管理
 * - 展開/折りたたみ状態管理
 * - カテゴリ情報の取得
 * - 各種イベントハンドラ
 *
 * @see components/snippet/SnippetCard.tsx - UIコンポーネント
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '@cliptap/shared';
import { SnippetWithDisplay, Category, useCategories } from '@cliptap/shared';
import { showConfirm } from '@utils/alerts';
import { UI_CONSTANTS } from '@constants/ui';

/**
 * useSnippetCardのProps
 * @property snippet - 表示するスニペットデータ
 * @property onPress - タップ時のコールバック
 * @property onEdit - メニューで「編集」が選ばれたときのコールバック
 * @property onDelete - メニューで「削除」が選ばれ、確認ダイアログでOKされたときのコールバック
 * @property categoryProp - 親から渡されるカテゴリ
 */
export interface UseSnippetCardProps {
  snippet: SnippetWithDisplay;
  /* コピー処理は非同期のため、完了を待てるようPromiseも受け取れる型にする */
  onPress: (snippet: SnippetWithDisplay) => void | Promise<void>;
  onEdit: (snippet: SnippetWithDisplay) => void;
  onDelete: (snippet: SnippetWithDisplay) => void;
  onPressTitle?: (snippet: SnippetWithDisplay) => void | Promise<void>;
  categoryProp?: Category | null;
}

/**
 * useSnippetCardの戻り値の型
 */
export interface UseSnippetCardReturn {
  /* 状態 */
  isCopying: boolean;
  isCopied: boolean;
  isCopyingTitle: boolean;
  isTitleCopied: boolean;
  canCopyTitle: boolean;
  isExpanded: boolean;
  category: Category | null;
  /* タイトルがない定型文は「(タイトルなし)」になるため、常に文字列 */
  displayTitle: string;
  displayContent: string | null;

  /* ハンドラ */
  handleCopy: () => Promise<void>;
  handleCopyTitle: () => Promise<void>;
  handleDelete: () => void;
  handleEdit: () => void;
  toggleExpanded: () => void;
}

/**
 * スニペットカードのビジネスロジックフック
 *
 * @param props - カードの表示データと各種コールバック
 * @returns カードに必要な全ての状態とハンドラ
 */
export function useSnippetCard({
  snippet,
  onPress,
  onEdit,
  onDelete,
  onPressTitle,
  categoryProp,
}: UseSnippetCardProps): UseSnippetCardReturn {
  const { t } = useTranslation();
  const { getById: getCategoryById } = useCategories();

  const [isCopying, setIsCopying] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isCopyingTitle, setIsCopyingTitle] = useState(false);
  const [isTitleCopied, setIsTitleCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [category, setCategory] = useState<Category | null>(null);

  const displayTitle = snippet.displayTitle || t('snippet.no_title');
  const displayContent = snippet.displayContent;

  /* タイトル未設定の定型文は（タイトルなし）を表示するだけでコピー対象がない */
  const canCopyTitle = Boolean(onPressTitle) && Boolean(snippet.title);

  /**
   * カテゴリ情報の取得
   */
  useEffect(() => {
    if (categoryProp !== undefined) {
      setCategory(categoryProp);
    } else if (snippet.categoryId) {
      const cat = getCategoryById(snippet.categoryId);
      setCategory(cat);
    } else {
      setCategory(null);
    }
  }, [snippet.categoryId, categoryProp, getCategoryById]);

  /**
   * コピー完了アイコンの自動リセット
   *
   * @remarks
   * コピー完了アイコンは UI_CONSTANTS.COPY_SUCCESS_DURATION_MS 後に自動で消す。
   * クリーンアップでタイマーを解除するのは、アンマウント後や次のコピーでフラグが立ち直した後に
   * 前回のタイマーが発火して表示を戻してしまわないようにするため。
   */
  useEffect(() => {
    if (!isCopied) return;

    const timeoutId = setTimeout(() => {
      setIsCopied(false);
    }, UI_CONSTANTS.COPY_SUCCESS_DURATION_MS);

    return () => clearTimeout(timeoutId);
  }, [isCopied]);

  /**
   * コピーボタン押下時の処理
   */
  const handleCopy = useCallback(async () => {
    if (isCopying) return;
    setIsCopying(true);

    try {
      await onPress(snippet);
      setIsCopied(true);
    } catch {
      setIsCopied(false);
    } finally {
      setIsCopying(false);
    }
  }, [isCopying, onPress, snippet]);

  /**
   * タイトルのコピー完了アイコンの自動リセット
   *
   * @remarks
   * コピー完了アイコンは UI_CONSTANTS.COPY_SUCCESS_DURATION_MS 後に自動で消す。
   * クリーンアップでタイマーを解除するのは、アンマウント後や次のコピーでフラグが立ち直した後に
   * 前回のタイマーが発火して表示を戻してしまわないようにするため。
   */
  useEffect(() => {
    if (!isTitleCopied) return;

    const timeoutId = setTimeout(() => {
      setIsTitleCopied(false);
    }, UI_CONSTANTS.COPY_SUCCESS_DURATION_MS);

    return () => clearTimeout(timeoutId);
  }, [isTitleCopied]);

  /**
   * タイトル押下時の処理（タイトルのみをコピー）
   */
  const handleCopyTitle = useCallback(async () => {
    /* タイトルコピーは呼び出し側がハンドラを渡し、かつタイトルのコピーが許可されている場合のみ実行する（本文コピーは常に可能なのでガードが1つ少ない）。 */
    if (!onPressTitle || !canCopyTitle || isCopyingTitle) return;
    setIsCopyingTitle(true);

    try {
      await onPressTitle(snippet);
      setIsTitleCopied(true);
    } catch {
      setIsTitleCopied(false);
    } finally {
      setIsCopyingTitle(false);
    }
  }, [onPressTitle, canCopyTitle, isCopyingTitle, snippet]);

  /**
   * メニューで削除が選ばれたときの処理（確認ダイアログを出し、OKなら削除する）
   */
  const handleDelete = useCallback(() => {
    showConfirm(
      t('snippet.delete_confirm'),
      () => onDelete(snippet),
      undefined,
      'danger'
    );
  }, [t, onDelete, snippet]);

  /**
   * メニューで編集が選ばれたときの処理
   */
  const handleEdit = useCallback(() => {
    onEdit(snippet);
  }, [onEdit, snippet]);

  /**
   * 展開/折りたたみ切り替え
   */
  const toggleExpanded = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  return {
    isCopying,
    isCopied,
    isCopyingTitle,
    isTitleCopied,
    canCopyTitle,
    isExpanded,
    category,
    displayTitle,
    displayContent,
    handleCopy,
    handleCopyTitle,
    handleDelete,
    handleEdit,
    toggleExpanded,
  };
}
