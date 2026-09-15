/**
 * 検索バー
 *
 * @description
 * スニペット検索用の検索バー。
 * 虫眼鏡アイコンと閉じるボタンを配置。
 */
import { useTranslation } from '@cliptap/shared';

interface SearchBarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onClose: () => void;
  placeholderKey?: string;
}

export function SearchBar({ searchQuery, setSearchQuery, onClose, placeholderKey = 'snippet.search_placeholder' }: SearchBarProps) {
  const { t } = useTranslation();

  /* 検索バー（スニペット検索用、虫眼鏡アイコンと閉じるボタン付き） */
  return (
    <div className="flex-1 mx-4">
      <div className="relative">
        {/* 虫眼鏡アイコン（左側） */}
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-[#707070]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        {/* 検索入力フィールド */}
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t(placeholderKey)}
          autoFocus
          className="w-full pl-10 pr-10 py-1.5 text-sm border border-gray-300 dark:border-[#2A2A2A] rounded-lg focus:outline-none bg-white dark:bg-[#1A1A1A] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-[#707070]"
        />
        {/* 閉じるボタン（右側） */}
        <button
          onClick={onClose}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#707070] hover:text-gray-600 dark:hover:text-gray-300"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
