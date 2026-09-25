/**
 * ソートメニューのビジネスロジックフック
 *
 * ソートメニューに必要な状態管理とロジックを提供。
 * UIコンポーネント（SortMenu.tsx）から完全に分離されたビジネスロジック層。
 *
 * 主な責務:
 * - モーダル表示状態管理
 * - ソートオプションの生成
 * - ソート選択処理
 *
 * @see components/snippet/SortMenu.tsx - UIコンポーネント
 */

import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from '@cliptap/shared';
import { SnippetSortBy } from '@cliptap/shared';
import { type VariableIconName } from '@constants/ui';

/**
 * ソートオプションの型
 */
export interface SortOption {
  value: SnippetSortBy;
  label: string;
  icon: VariableIconName;
}

/**
 * useSortMenuのProps
 * @property currentSort - 現在のソート順
 * @property onSortChange - ソート順変更時のコールバック
 * @property nameSortLabel - 名前で並べ替える選択肢のラベル（省略時は定型文の「タイトル」）
 */
export interface UseSortMenuProps {
  currentSort: SnippetSortBy;
  onSortChange: (sort: SnippetSortBy) => void;
  nameSortLabel?: string;
}

/**
 * useSortMenuの戻り値の型
 */
export interface UseSortMenuReturn {
  /* 状態 */
  visible: boolean;
  sortOptions: SortOption[];
  isDefaultSort: boolean;

  /* ハンドラ */
  handlePress: () => void;
  handleSelect: (value: SnippetSortBy) => void;
  handleClose: () => void;
}

/**
 * デフォルトのソート順
 */
const DEFAULT_SORT: SnippetSortBy = 'created';

/**
 * ソートメニューのビジネスロジックフック
 *
 * @param props - 現在のソート順とコールバック
 * @returns メニューに必要な全ての状態とハンドラ
 */
export function useSortMenu({
  currentSort,
  onSortChange,
  nameSortLabel,
}: UseSortMenuProps): UseSortMenuReturn {
  const { t } = useTranslation();

  const [visible, setVisible] = useState(false);
  /** ソートオプション一覧 */
  const sortOptions: SortOption[] = useMemo(
    () => [
      { value: 'created', label: t('sort.created'), icon: 'create-outline' },
      { value: 'updated', label: t('sort.updated'), icon: 'time-outline' },
      /* 並べ替えの基準は定型文とショートカットで共通だが、名前の呼び方だけが違う
         （定型文はタイトル、ショートカットは名前）。呼び出し側が差し替えられるようにする */
      { value: 'title', label: nameSortLabel ?? t('sort.title_sort'), icon: 'text-outline' },
      {
        value: 'usage',
        label: t('sort.usage'),
        icon: 'stats-chart-outline',
      },
    ],
    [t, nameSortLabel],
  );

  /**
   * デフォルトソートかどうか
   */
  const isDefaultSort = currentSort === DEFAULT_SORT;

  /**
   * メニューを開く
   */
  const handlePress = useCallback(() => {
    setVisible(true);
  }, []);

  /**
   * ソートを選択して閉じる
   */
  const handleSelect = useCallback((value: SnippetSortBy) => {
    onSortChange(value);
    setVisible(false);
  }, [onSortChange]);

  /**
   * メニューを閉じる
   */
  const handleClose = useCallback(() => {
    setVisible(false);
  }, []);

  return {
    visible,
    sortOptions,
    isDefaultSort,
    handlePress,
    handleSelect,
    handleClose,
  };
}
