/**
 * ソートメニューコンポーネント（Web版）
 *
 * @description
 * スニペット一覧のソート順を変更するドロップダウンメニュー。
 * デフォルト以外のソートが選択されている時はバッジを表示。
 *
 * ソートオプション:
 * - created: 作成日時順（デフォルト）
 * - updated: 更新日時順
 * - title: タイトル順（アルファベット/あいうえお順）
 * - usage: 使用頻度順（コピー回数が多い順）
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation, type SnippetSortBy } from '@cliptap/shared';

/**
 * デフォルトのソート順
 */
const DEFAULT_SORT: SnippetSortBy = 'created';

/**
 * ソートオプションの型
 */
interface SortOption {
  value: SnippetSortBy;
  label: string;
}

/**
 * SortMenuのProps
 */
interface SortMenuProps {
  currentSort: SnippetSortBy;
  onSortChange: (sort: SnippetSortBy) => void;
}

export function SortMenu({ currentSort, onSortChange }: SortMenuProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isDefaultSort = currentSort === DEFAULT_SORT;

  const sortOptions: SortOption[] = useMemo(() => [
    { value: 'created', label: t('sort.created') },
    { value: 'updated', label: t('sort.updated') },
    { value: 'title', label: t('sort.title_sort') },
    { value: 'usage', label: t('sort.usage') },
  ], [t]);

  /* 外部クリックで閉じる */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (value: SnippetSortBy) => {
    onSortChange(value);
    setIsOpen(false);
  };

  /* ソートメニュー（ドロップダウン形式） */
  return (
    <div className="relative" ref={menuRef}>
      {/* ソートボタン */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        aria-label={t('sort.title')}
      >
        {/* ソートアイコン（上下矢印） */}
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
        {/* バッジ（デフォルト以外のソートが選択されている時） */}
        {!isDefaultSort && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-blue-600 rounded-full" />
        )}
      </button>

      {/* ドロップダウンメニュー。
          上下に余白を置かず角丸で切り取るのは「・・・」メニュー（ItemActionMenu）と同じ理由で、
          先頭と末尾の項目を指したときに枠線との間へ背景の付かない帯を残さないため */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#2A2A2A] rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-20">
          {sortOptions.map((option) => (
            /* ソートオプションボタン */
            <button
              key={option.value}
              onClick={() => handleSelect(option.value)}
              className={`w-full px-4 py-2 text-left text-sm flex items-center justify-between ${
                currentSort === option.value
                  ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
              }`}
            >
              {option.label}
              {/* 選択中のチェックマーク */}
              {currentSort === option.value && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
