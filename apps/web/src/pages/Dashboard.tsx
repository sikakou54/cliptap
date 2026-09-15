/**
 * Dashboard - 定型文一覧画面（メイン）
 *
 * アプリケーションのメイン画面。定型文の一覧表示、検索、フィルタリング、
 * CRUD操作、バックアップ・復元機能を提供する。
 *
 * ビジネスロジックはuseHomeScreenに集約し、UIはシンプルに保つ。
 * Mobile版と同様の構成パターンを採用。
 *
 * @see hooks/screens/useHomeScreen.ts - ビジネスロジック
 */
import { useState, useCallback, useMemo } from 'react';
import { useAuth, useTranslation, useSharedSubscription } from '@cliptap/shared';
import { useHomeScreen } from '@hooks/screens/useHomeScreen';
import { SnippetEditModal } from '@components/snippet/SnippetEditModal';
import { DashboardHeader } from '@components/dashboard/DashboardHeader';
import { SnippetGrid } from '@components/dashboard/SnippetGrid';
import { ShortcutGrid } from '@components/shortcut/ShortcutGrid';
import { ShortcutEditModal } from '@components/shortcut/ShortcutEditModal';
import { AccountLinkModal } from '@components/auth/AccountLinkModal';
import { SideMenu } from '@components/settings/SideMenu';
import { ImportFileModal } from '@components/import';
import { ExportPasswordModal } from '@components/export';
import { shouldShowSubscriptionVerificationWarning } from '@services/SubscriptionVerificationService';


export function Dashboard() {
  const { signInWithGoogle, signInWithApple, loading: authLoading, error: authError, user } = useAuth();
  const { t } = useTranslation();
  const { verificationFailed, refresh } = useSharedSubscription();

  const [showAccountLinkModal, setShowAccountLinkModal] = useState(false);

  const openAccountLinkModal = useCallback(() => {
    setShowAccountLinkModal(true);
  }, []);

  const closeAccountLinkModal = useCallback(() => {
    setShowAccountLinkModal(false);
  }, []);

  const {
    isLoaded,

    searchQuery,
    selectedCategory,
    copiedId,
    copiedTitleId,
    copiedShortcutValueId,
    showProfileDropdown,
    showSearchBar,
    gridColumns,
    listMode,
    searchProfileId,

    isMobileMenuOpen,

    snippetModal,
    shortcutModal,
    exportScreen,
    importScreen,

    currentSort,
    handleSortChange,

    filteredSnippets,
    filteredShortcuts,
    categories,
    filterCategories,
    validProfiles,
    variables,
    profileVariables,
    activeProfile,
    activeProfileId,
    defaultProfileId,

    setSearchQuery,
    setSelectedCategory,
    setShowSearchBar,
    setGridColumns,
    setShowProfileDropdown,
    setListMode,
    setSearchProfileId,

    handleCopySnippet,
    handleCopySnippetTitle,
    handleDeleteSnippet,
    handleCopyShortcutValue,
    handleDeleteShortcut,
    handleSelectProfile,
    handleToggleMobileMenu,
    handleCloseMobileMenu,
    getCategoryColor,
    getCategoryName,
    getSearchResultCount,
  } = useHomeScreen();

  /**
   * 新規作成時に既定でチェックしておくプロファイル
   *
   * @remarks
   * アクティブなプロファイルを1件だけ初期選択にする。無効なプロファイル（Free上限超過分）は
   * 選択肢に出ないため既定にも入れない。出ない項目を選択済みにすると、画面上は0件に見えるのに
   * 保存すると1件入る食い違いになる。
   *
   * useMemoで参照を固定するのは、SnippetEditModalがinitialProfileIdsを状態の初期化と
   * 未保存判定の比較に使っているため。毎レンダリングで新しい配列を渡すと
   * 変更していないのに「未保存の変更あり」と判定され、フォームも初期化し直される。
   */
  const initialProfileIds = useMemo(
    () =>
      validProfiles.some((profile) => profile.id === activeProfile?.id) && activeProfile
        ? [activeProfile.id]
        : [],
    [validProfiles, activeProfile]
  );

  /* DB未読み込み時は何も表示しない（nullを返す） */
  if (!isLoaded) {
    return null;
  }

  /* ダッシュボード画面（定型文一覧・メイン画面） */
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      {/* サイドメニュー（レスポンシブ対応、モバイルではオーバーレイ表示）
          バックアップ・復元・アカウント連携などの機能へのアクセスを提供。
          デスクトップでは常時表示、モバイルではハンバーガーメニューで開閉。 */}
      <SideMenu
        onExport={exportScreen.openExportModal}
        onImport={importScreen.openFileModal}
        isOpen={isMobileMenuOpen}
        onClose={handleCloseMobileMenu}
        onAccountLink={openAccountLinkModal}
      />

      {/* メインコンテンツエリア（デスクトップではサイドメニュー分の左マージンを確保）
          サイドメニューの幅（72 = 18rem = 288px）分のマージンを左側に設定。 */}
      <div className="md:ml-72 transition-all duration-300">
        {shouldShowSubscriptionVerificationWarning(Boolean(user), verificationFailed) && (
          <div className="fixed left-0 right-0 top-0 z-50 flex items-center justify-center gap-3 bg-amber-100 px-4 py-2 text-sm text-amber-900 md:left-72 dark:bg-amber-900/60 dark:text-amber-100">
            <span>{t('settings.web_specific.subscription_check_failed')}</span>
            <button className="font-semibold underline" onClick={() => void refresh()}>
              {t('settings.web_specific.retry_subscription')}
            </button>
          </div>
        )}
        {/* ヘッダー（環境切り替え・検索・新規作成・カテゴリフィルター）
            固定表示で、スクロール時も常に上部に表示される。
            環境切り替え、検索バー、グリッド列数選択、新規作成ボタン、カテゴリフィルターを含む。 */}
        <DashboardHeader
          validProfiles={validProfiles}
          activeProfile={activeProfile}
          showProfileDropdown={showProfileDropdown}
          setShowProfileDropdown={setShowProfileDropdown}
          handleProfileSelect={handleSelectProfile}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          showSearchBar={showSearchBar}
          setShowSearchBar={setShowSearchBar}
          categories={filterCategories}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          onToggleMobileMenu={handleToggleMobileMenu}
          onCreate={listMode === 'shortcut' ? shortcutModal.handleCreate : snippetModal.handleCreate}
          gridColumns={gridColumns}
          setGridColumns={setGridColumns}
          currentSort={currentSort}
          onSortChange={handleSortChange}
          listMode={listMode}
          onListModeChange={setListMode}
          searchProfileId={searchProfileId}
          getSearchResultCount={getSearchResultCount}
          onSearchProfileSelect={setSearchProfileId}
        />

        {/* メインコンテンツ（定型文グリッド）
            pt-36でヘッダー分の上部マージンを確保（固定ヘッダーの下にコンテンツが表示されるように）。 */}
        <main className="px-6 py-6 pt-44 md:pt-36">
          {listMode === 'snippet' ? (
            <SnippetGrid
              filteredSnippets={filteredSnippets}
              gridColumns={gridColumns}
              copiedId={copiedId}
              copiedTitleId={copiedTitleId}
              categories={categories}
              getCategoryColor={getCategoryColor}
              getCategoryName={getCategoryName}
              onCopy={handleCopySnippet}
              onCopyTitle={handleCopySnippetTitle}
              onEdit={snippetModal.handleEdit}
              onDelete={handleDeleteSnippet}
            />
          ) : (
            <ShortcutGrid
              shortcuts={filteredShortcuts}
              gridColumns={gridColumns}
              copiedValueId={copiedShortcutValueId}
              categories={categories}
              onCopyValue={handleCopyShortcutValue}
              onEdit={shortcutModal.handleEdit}
              onDelete={handleDeleteShortcut}
            />
          )}
        </main>
      </div>

      {/* バックアップ用パスワード入力モーダル
          全データを.cliptapファイルとして出力する。出力中は閉じられず、成功時に閉じる。 */}
      <ExportPasswordModal
        isOpen={exportScreen.showExportModal}
        onClose={exportScreen.closeExportModal}
        onSubmit={exportScreen.handleExport}
        isProcessing={exportScreen.isExporting}
      />

      {/* 作成モーダル（新規定型文作成）
          snippetModal.isCreatingがtrueの時のみ表示。
          空の初期値でモーダルを開き、ユーザーが入力した内容で新規スニペットを作成。 */}
      {snippetModal.isCreating && (
        <SnippetEditModal
          isOpen={snippetModal.isCreating}
          mode="create"
          initialTitle=""
          initialContent=""
          initialCategoryId={null}
          initialProfileIds={initialProfileIds}
          initialCopyWithTitle={false}
          categories={categories}
          profiles={validProfiles}
          profileVariables={profileVariables}
          variables={variables}
          onSave={snippetModal.handleSaveCreate}
          onClose={snippetModal.closeCreateModal}
        />
      )}

      {/* 編集モーダル（既存定型文編集）
          snippetModal.editingSnippetが存在する時のみ表示。
          既存のスニペット情報を初期値として表示し、編集後に保存。 */}
      {snippetModal.editingSnippet && (
        <SnippetEditModal
          isOpen={!!snippetModal.editingSnippet}
          mode="edit"
          initialTitle={snippetModal.editingSnippet.title || ''}
          initialContent={snippetModal.editingSnippet.content}
          initialCategoryId={snippetModal.editingSnippet.categoryId}
          initialProfileIds={snippetModal.editingSnippetProfileIds}
          initialCopyWithTitle={!!snippetModal.editingSnippet.copyWithTitle}
          categories={categories}
          profiles={validProfiles}
          profileVariables={profileVariables}
          variables={variables}
          onSave={snippetModal.handleSaveEdit}
          onClose={snippetModal.closeEditModal}
        />
      )}

      <ShortcutEditModal
        isOpen={shortcutModal.isOpen}
        shortcut={shortcutModal.shortcut}
        categories={categories}
        profiles={validProfiles}
        profileVariables={profileVariables}
        variables={variables}
        activeProfileId={activeProfileId}
        defaultProfileId={defaultProfileId}
        onSave={shortcutModal.handleSave}
        onClose={shortcutModal.handleClose}
      />

      {/* 復元ファイル選択モーダル（.cliptapファイル選択とパスワード入力）
          ファイルの検証後に全削除の確認を出し、同意すると全データを置き換える。
          読込・復元の処理中は閉じられない。 */}
      <ImportFileModal
        isOpen={importScreen.showFileModal}
        onClose={importScreen.closeFileModal}
        onFileSelected={importScreen.handleFileSelected}
        isLoading={importScreen.isBusy}
      />

      {/* アカウント連携モーダル（Google/Apple認証）
          サブスクリプション機能を使用するために、GoogleまたはAppleアカウントと連携するためのモーダル。
          認証後、サブスクリプション状態を同期。 */}
      <AccountLinkModal
        isOpen={showAccountLinkModal}
        onClose={closeAccountLinkModal}
        onSignInWithGoogle={signInWithGoogle}
        onSignInWithApple={signInWithApple}
        isLoading={authLoading}
        error={authError}
      />
    </div>
  );
}
