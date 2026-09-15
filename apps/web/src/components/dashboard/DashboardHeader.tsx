/**
 * ダッシュボードヘッダー
 *
 * @description
 * ダッシュボード画面の最上部に固定表示されるヘッダー。
 * 環境切り替え、検索、カテゴリフィルター、列数変更、新規作成等の機能を提供。
 */
import { useTranslation, type SnippetSortBy } from '@cliptap/shared';
import type { Profile, Category } from '@cliptap/shared';
import { CategoryFilterBar } from '@components/common/CategoryFilterBar';
import { ProfileDropdown } from './ProfileDropdown';
import { SearchBar } from './SearchBar';
import { GridColumnsSelector } from './GridColumnsSelector';
import { SortMenu } from './SortMenu';
import { ListModeToggle, type WebListMode } from './ListModeToggle';
import { SearchProfileBar } from './SearchProfileBar';

interface DashboardHeaderProps {
  validProfiles: Profile[];
  activeProfile: Profile | null;
  showProfileDropdown: boolean;
  setShowProfileDropdown: (show: boolean) => void;
  handleProfileSelect: (id: string) => Promise<void>;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  showSearchBar: boolean;
  setShowSearchBar: (show: boolean) => void;
  categories: Category[];
  selectedCategory: string | null;
  setSelectedCategory: (id: string | null) => void;
  onToggleMobileMenu: () => void;
  onCreate: () => void;
  gridColumns: 1 | 2 | 3;
  setGridColumns: (cols: 1 | 2 | 3) => void;
  currentSort: SnippetSortBy;
  onSortChange: (sort: SnippetSortBy) => void;
  listMode: WebListMode;
  onListModeChange: (mode: WebListMode) => void;
  searchProfileId: string | null;
  getSearchResultCount: (profileId: string) => number;
  onSearchProfileSelect: (profileId: string) => void;
}

export function DashboardHeader({
  validProfiles,
  activeProfile,
  showProfileDropdown,
  setShowProfileDropdown,
  handleProfileSelect,
  searchQuery,
  setSearchQuery,
  showSearchBar,
  setShowSearchBar,
  categories,
  selectedCategory,
  setSelectedCategory,
  onToggleMobileMenu,
  onCreate,
  gridColumns,
  setGridColumns,
  currentSort,
  onSortChange,
  listMode,
  onListModeChange,
  searchProfileId,
  getSearchResultCount,
  onSearchProfileSelect,
}: DashboardHeaderProps) {
  const { t } = useTranslation();

  /* ダッシュボードヘッダー（固定表示、環境切り替え・検索・新規作成・カテゴリフィルター）
      固定ヘッダー（fixed）で、スクロール時も常に上部に表示される。
      デスクトップではサイドメニュー分の左マージン（md:left-72）を確保。 */
  return (
    <header className="bg-white dark:bg-[#1A1A1A] shadow-sm fixed top-0 left-0 md:left-72 right-0 z-10 transition-all duration-300">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          {/* 左側：ハンバーガーメニュー + 環境切り替え
              モバイルではハンバーガーメニューを表示、デスクトップでは非表示。 */}
          <div className="flex items-center gap-4">
            {/* ハンバーガーメニューボタン（モバイル表示時のみ）
                クリックでサイドメニューを開閉。モバイルではオーバーレイ表示。 */}
            <button
              onClick={onToggleMobileMenu}
              className="md:hidden p-2 -ml-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#2A2A2A] rounded-lg"
              aria-label={t('common.open_menu')}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* 環境切り替えドロップダウン
                現在の環境を表示し、クリックで他の環境に切り替え可能。
                環境ごとに変数の値が異なるため、スニペットの表示内容も変わる。 */}
            <div className={showSearchBar ? 'hidden sm:block' : 'block'}>
              <ProfileDropdown
                validProfiles={validProfiles}
                activeProfile={activeProfile}
                showProfileDropdown={showProfileDropdown}
                setShowProfileDropdown={setShowProfileDropdown}
                handleProfileSelect={handleProfileSelect}
              />
            </div>
          </div>

          {/* 中央：検索バー（表示時のみ）
              showSearchBarがtrueの時のみ表示。検索クエリの入力とクリアが可能。 */}
          {showSearchBar && (
            <SearchBar
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              onClose={() => {
                /* 検索バーを閉じる際に、検索クエリもクリア */
                setShowSearchBar(false);
                setSearchQuery('');
              }}
              placeholderKey={listMode === 'shortcut' ? 'shortcut.search_placeholder' : 'snippet.search_placeholder'}
            />
          )}

          {/* 右側：ソート + 列数選択 + 検索ボタン + 新規作成ボタン
              ソートメニュー、グリッドの列数（1〜3列）を切り替え、検索バーを開く、新規スニペットを作成。 */}
          <div className="flex items-center gap-1">
            {/* 定型文／ショートカットの表示切替スイッチ
                モバイルのホームと同じく、アクションボタン群の先頭に置く。 */}
            <ListModeToggle mode={listMode} onChange={onListModeChange} />
            {/* ソートメニュー（ドロップダウン形式）
                作成日時/更新日時/タイトル/使用頻度でソート可能。 */}
            <SortMenu currentSort={currentSort} onSortChange={onSortChange} />
            {/* グリッド列数選択（デスクトップのみ表示）
                1列・2列・3列のいずれかを選択可能。モバイルでは常に1列表示。 */}
            <GridColumnsSelector gridColumns={gridColumns} setGridColumns={setGridColumns} />
            {/* 検索ボタン（検索バー非表示時のみ表示）
                クリックで検索バーを表示。検索クエリがある場合はアクティブ状態（青色）で表示。 */}
            {!showSearchBar && (
              <button
                onClick={() => setShowSearchBar(true)}
                className={`p-2 rounded-lg transition-colors ${searchQuery
                  ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                aria-label={t('common.search')}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            )}
            {/* 新規作成ボタン
                クリックで新規スニペット作成モーダルを開く。 */}
            <button
              onClick={onCreate}
              className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
              aria-label={t(listMode === 'shortcut' ? 'shortcut.create' : 'snippet.create')}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>

        {/* カテゴリフィルターバー（全カテゴリ・未分類・各カテゴリのボタン）
            選択したカテゴリに応じてスニペットをフィルタリング。
            「すべて」で全カテゴリ表示、「未分類」でカテゴリ未設定のスニペットのみ表示。 */}
        {showSearchBar && searchQuery.trim() !== '' ? (
          <SearchProfileBar
            profiles={validProfiles}
            selectedProfileId={searchProfileId}
            getResultCount={getSearchResultCount}
            onSelect={onSearchProfileSelect}
          />
        ) : (
          <CategoryFilterBar
            categories={categories}
            selectedCategory={selectedCategory}
            allLabel={t('category.all')}
            uncategorizedLabel={t('category.uncategorized')}
            showUncategorized={false}
            onSelectCategory={setSelectedCategory}
          />
        )}
      </div>
    </header>
  );
}
