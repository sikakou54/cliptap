import { useCallback, useMemo } from 'react';
import { getSelectionTabLabel, useTranslation } from '@cliptap/shared';
import { Dialog } from '@headlessui/react';
import {
  useProfiles,
  useVariables,
  useCategories,
  useImportSelection,
  type ImportCandidates,
  type ImportTabType,
  type Profile,
  type Variable,
  type Category,
} from '@cliptap/shared';
import { showConfirm } from '@utils/alerts';
import { CATEGORY_FALLBACK_COLOR } from '@utils/categoryColor';

/**
 * インポート選択モーダルのProps型定義
 */
interface ImportSelectionModalProps {
  /** モーダルの表示/非表示状態 */
  isOpen: boolean;
  /** モーダルを閉じる時のコールバック */
  onClose: () => void;
  /** インポート候補データ（ファイルから読み込んだデータ） */
  candidates: ImportCandidates;
  /** インポート実行時のコールバック（選択されたアイテムのID配列を渡す） */
  onImport: (
    selectedSnippetIds: string[],
    selectedProfileIds: string[],
    selectedVariableIds: string[],
    selectedCategoryIds: string[]
  ) => Promise<void>;
  /** 処理中フラグ（親コンポーネントで管理） */
  isProcessing: boolean;
}

/**
 * インポート選択モーダルコンポーネント
 *
 * マージモードで使用され、インポート候補データから
 * 実際にインポートするアイテムを選択する
 */
export function ImportSelectionModal({
  isOpen,
  onClose,
  candidates,
  onImport,
  isProcessing,
}: ImportSelectionModalProps) {
  const { t } = useTranslation();
  const { profiles } = useProfiles();
  const { variables: existingVariables } = useVariables();
  const { categories: existingCategories } = useCategories();

  /**
   * 重複チェック用データ（高速化のためSet化してメモ化）
   */
  const existingProfileNames = useMemo(() => new Set(profiles.map((p: Profile) => p.name.trim())), [profiles]);
  const existingVariableNames = useMemo(() => new Set(existingVariables.filter((v: Variable) => v.type === 'custom').map((v: Variable) => v.name.trim())), [existingVariables]);
  const existingCategoryNames = useMemo(() => new Set(existingCategories.map((c: Category) => c.name.trim())), [existingCategories]);

  /**
   * インポート選択管理（選択状態、タブ、展開状態を一元管理）
   */
  const {
    selectedSnippetIds,
    selectedProfileIds,
    selectedVariableIds,
    selectedCategoryIds,
    activeTab,
    setActiveTab,
    expandedSnippetIds,
    expandedVariableIds,
    isProfileDisabled,
    isVariableDuplicate,
    isCategoryDisabled,
    toggleSelection,
    toggleSelectAll,
    isAllSelected,
    totalSelected,
    toggleExpandSnippet,
    toggleExpandVariable,
  } = useImportSelection({
    candidates,
    existingProfileNames,
    existingVariableNames,
    existingCategoryNames,
    isOpen,
  });

  const selectedCounts = useMemo<Record<ImportTabType, number>>(
    () => ({
      snippets: selectedSnippetIds.size,
      profiles: selectedProfileIds.size,
      variables: selectedVariableIds.size,
      categories: selectedCategoryIds.size,
    }),
    [selectedSnippetIds, selectedProfileIds, selectedVariableIds, selectedCategoryIds]
  );

  const activeSelectedCount = selectedCounts[activeTab];

  /**
   * モーダルを閉じる
   *
   * @remarks
   * 取込処理中は閉じない。閉じると呼び出し側が実行中の一時DBを破棄してしまうため。
   */
  const handleClose = useCallback(() => {
    if (isProcessing) return;
    onClose();
  }, [isProcessing, onClose]);

  /**
   * インポート実行前に確認ダイアログを表示
   */
  const handleImport = async () => {
    showConfirm('backup.import_confirm', async () => {
      await onImport(
        Array.from(selectedSnippetIds),
        Array.from(selectedProfileIds),
        Array.from(selectedVariableIds),
        Array.from(selectedCategoryIds)
      );
    });
  };

  /* インポート選択モーダル（マージモード用、アイテム選択） */
  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      {/* オーバーレイ（背景暗転） */}
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      {/* モーダルコンテナ */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-3xl h-[80vh] bg-white dark:bg-[#1A1A1A] rounded-2xl shadow-xl flex flex-col">
          {/* ヘッダー（閉じるボタン、タイトル、全選択ボタン） */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-[#2A2A2A]">
            {/* 閉じるボタン（取込処理中は無効） */}
            <button
              onClick={handleClose}
              disabled={isProcessing}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {/* モーダルタイトル */}
            <Dialog.Title className="text-xl font-bold text-gray-900 dark:text-white">
              {t('export_import.select_import_data')}
            </Dialog.Title>
            {/* 全選択/全解除ボタン */}
            <button
              onClick={() => toggleSelectAll()}
              className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
              title={isAllSelected() ? t('common.deselect_all') : t('common.select_all')}
            >
              {/* 全選択済み時はチェックマーク付き、未選択時は空のチェックボックス */}
              {isAllSelected() ? (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={2} />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={2} />
                </svg>
              )}
            </button>
          </div>

          {/* タブナビゲーション（定型文/プロファイル/変数/カテゴリ） */}
          <div className="flex border-b border-gray-200 dark:border-[#2A2A2A]">
            {(['snippets', 'profiles', 'variables', 'categories'] as ImportTabType[]).map((tab) => (
              /* タブボタン（選択数表示付き） */
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {getSelectionTabLabel(tab, t)} ({selectedCounts[tab]})
              </button>
            ))}
          </div>

          {/* コンテンツエリア（スクロール可能、タブに応じて表示内容を切り替え） */}
          <div className="flex-1 overflow-y-auto p-0">
            {/* 定型文タブ */}
            {activeTab === 'snippets' && (
              <div className="divide-y divide-gray-100 dark:divide-[#2A2A2A]">
                {candidates.snippets.map((item) => {
                  /**
                   * プロファイル表示フィルタリング
                   * 選択中 or 既存で無効（インポート不可）のプロファイルのみ表示
                   */
                  const displayProfiles = item.profiles.filter((p) => {
                    const profile = candidates.profiles.find((cp) => cp.id === p.profileId);
                    if (!profile) return false;
                    return selectedProfileIds.has(p.profileId) || isProfileDisabled(profile.name);
                  });
                  const filteredProfileNames = displayProfiles.map((p) => p.profileName).filter(Boolean) as string[];
                  const profileNames = item.profiles.length === 0 || filteredProfileNames.length === 0
                    ? [t('profile.all_profiles')]
                    : filteredProfileNames;

                  /**
                   * カテゴリ表示判定
                   * 選択中 or 既存で無効の場合のみ表示、それ以外は未分類扱い
                   */
                  const category = candidates.categories.find((c) => c.name === item.categoryName);
                  const isCategorySelectedOrDisabled = category
                    ? selectedCategoryIds.has(category.id) || isCategoryDisabled(category.name)
                    : false;
                  const displayCategoryName = isCategorySelectedOrDisabled ? (item.categoryName || t('common.uncategorized')) : t('common.uncategorized');
                  /* カテゴリ未選択時・色未設定時はどちらも未設定フォールバック色で表示する */
                  const displayCategoryColor = isCategorySelectedOrDisabled && category
                    ? (category.color || CATEGORY_FALLBACK_COLOR)
                    : CATEGORY_FALLBACK_COLOR;

                  /* 定型文アイテム（チェックボックス、タイトル、本文、カテゴリ・プロファイルバッジ、展開/折りたたみ） */
                  return (
                    <div key={item.id} className="p-4 flex items-start hover:bg-gray-50 dark:hover:bg-[#222] transition-colors">
                      {/* チェックボックス */}
                      <div className="flex items-center h-6 mr-4">
                        <input
                          type="checkbox"
                          checked={selectedSnippetIds.has(item.id)}
                          onChange={() => toggleSelection(item.id, 'snippets')}
                          className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600 dark:bg-[#333]"
                        />
                      </div>
                      {/* 定型文コンテンツ（クリックで展開/折りたたみ） */}
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleExpandSnippet(item.id)}>
                        <div className="flex justify-between items-center mb-1">
                          {/* 定型文タイトル */}
                          <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {item.title || t('common.no_title')}
                          </h3>
                          {/* 展開/折りたたみアイコン */}
                          <svg
                            className={`w-4 h-4 text-gray-400 transition-transform duration-200 flex-shrink-0 ml-2 ${
                              expandedSnippetIds.has(item.id) ? 'rotate-180' : ''
                            }`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                        {/* 定型文本文（折りたたみ時は2行まで表示） */}
                        <p className={`text-sm text-gray-500 dark:text-gray-400 whitespace-pre-wrap ${expandedSnippetIds.has(item.id) ? '' : 'line-clamp-2'}`}>
                          {item.content}
                        </p>
                        {/* カテゴリ・プロファイルバッジ */}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {/* カテゴリバッジ */}
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                            style={{
                              backgroundColor: `${displayCategoryColor}20`,
                              color: displayCategoryColor,
                            }}
                          >
                            {displayCategoryName}
                          </span>
                          {/* プロファイルバッジ */}
                          {profileNames.map((name, index) => (
                            <span
                              key={`profile-${index}`}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500 dark:bg-[#333] dark:text-gray-400"
                            >
                              {name}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* プロファイルタブ */}
            {activeTab === 'profiles' && (
              <div className="divide-y divide-gray-100 dark:divide-[#2A2A2A]">
                {candidates.profiles.map(item => {
                  const disabled = isProfileDisabled(item.name);
                  /* プロファイルアイテム（チェックボックス、名前、重複警告） */
                  return (
                    <div key={item.id} className={`p-4 flex items-center ${disabled ? 'opacity-50 bg-gray-50 dark:bg-[#222]' : 'hover:bg-gray-50 dark:hover:bg-[#222]'} transition-colors`}>
                      {/* チェックボックス（無効化されている場合は選択不可） */}
                      <div className="flex items-center h-6 mr-4">
                        <input
                          type="checkbox"
                          checked={selectedProfileIds.has(item.id)}
                          onChange={() => !disabled && toggleSelection(item.id, 'profiles')}
                          disabled={disabled}
                          className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600 dark:bg-[#333]"
                        />
                      </div>
                      <div className="flex-1">
                        {/* プロファイル名 */}
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white">{item.name}</h3>
                        {/* 重複警告メッセージ（無効化されている場合のみ表示） */}
                        {disabled && (
                          <p className="text-xs text-red-500 mt-1">{t('backup.already_registered_profile')}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 変数タブ */}
            {activeTab === 'variables' && (
              <div className="divide-y divide-gray-100 dark:divide-[#2A2A2A]">
                {candidates.variables.map((item) => {
                  const isDuplicate = isVariableDuplicate(item.name);
                  /**
                   * プロファイル値フィルタリング
                   * 選択中 or 既存で無効のプロファイルのみ表示
                   */
                  const filteredProfileValues = item.profileValues.filter((pv) => {
                    const profile = candidates.profiles.find((p) => p.id === pv.profileId);
                    if (!profile) return false;
                    return selectedProfileIds.has(pv.profileId) || isProfileDisabled(profile.name);
                  });
                  /* 変数アイテム（チェックボックス、名前、ラベル、重複警告、プロファイル値一覧、展開/折りたたみ） */
                  return (
                    <div key={item.id} className={`p-4 flex items-start ${isDuplicate ? 'border-l-4 border-yellow-400 bg-yellow-50/30 dark:bg-yellow-900/10' : 'hover:bg-gray-50 dark:hover:bg-[#222]'} transition-colors`}>
                      {/* チェックボックス */}
                      <div className="flex items-center h-6 mr-4">
                        <input
                          type="checkbox"
                          checked={selectedVariableIds.has(item.id)}
                          onChange={() => toggleSelection(item.id, 'variables')}
                          className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600 dark:bg-[#333]"
                        />
                      </div>
                      {/* 変数コンテンツ（クリックで展開/折りたたみ） */}
                      <div className="flex-1 cursor-pointer" onClick={() => toggleExpandVariable(item.id)}>
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            {/* 変数名 */}
                            <h3 className="text-sm font-medium text-gray-900 dark:text-white">{item.name}</h3>
                          </div>
                          {/* 展開/折りたたみアイコン */}
                          <svg
                            className={`w-4 h-4 text-gray-400 transition-transform duration-200 flex-shrink-0 ${
                              expandedVariableIds.has(item.id) ? 'rotate-180' : ''
                            }`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                        {/* 変数ラベル（オプション） */}
                        {item.label && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{item.label}</p>}
                        {/* 重複警告メッセージ（重複している場合のみ表示） */}
                        {isDuplicate && (
                          <p className="text-xs text-yellow-600 dark:text-yellow-400 font-medium mt-1">
                            {t('backup.variable_merge_warning')}
                          </p>
                        )}
                        {/* プロファイル値一覧（展開時のみ表示） */}
                        {expandedVariableIds.has(item.id) && filteredProfileValues.length > 0 && (
                          <div className="mt-3 pl-4 border-l-2 border-gray-200 dark:border-[#333]">
                            {filteredProfileValues.map((pv, idx) => (
                              /* プロファイル値行 */
                              <div key={`${pv.profileId}-${idx}`} className="flex justify-between text-xs py-1">
                                {/* プロファイル名 */}
                                <span className="text-gray-500 dark:text-gray-400">{pv.profileName || t('profile.default_badge')}</span>
                                {/* プロファイル値 */}
                                <span className="text-gray-900 dark:text-gray-300 font-mono">{pv.value}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* カテゴリタブ */}
            {activeTab === 'categories' && (
              <div className="divide-y divide-gray-100 dark:divide-[#2A2A2A]">
                {candidates.categories.map(item => {
                  const disabled = isCategoryDisabled(item.name);
                  /* カテゴリアイテム（チェックボックス、カラーインジケーター、名前、重複警告） */
                  return (
                    <div key={item.id} className={`p-4 flex items-center ${disabled ? 'opacity-50 bg-gray-50 dark:bg-[#222]' : 'hover:bg-gray-50 dark:hover:bg-[#222]'} transition-colors`}>
                      {/* チェックボックス（無効化されている場合は選択不可） */}
                      <div className="flex items-center h-6 mr-4">
                        <input
                          type="checkbox"
                          checked={selectedCategoryIds.has(item.id)}
                          onChange={() => !disabled && toggleSelection(item.id, 'categories')}
                          disabled={disabled}
                          className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600 dark:bg-[#333]"
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center">
                          {/* カテゴリカラーインジケーター */}
                          <span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: item.color || CATEGORY_FALLBACK_COLOR }}></span>
                          {/* カテゴリ名 */}
                          <h3 className="text-sm font-medium text-gray-900 dark:text-white">{item.name}</h3>
                        </div>
                        {/* 重複警告メッセージ（無効化されている場合のみ表示） */}
                        {disabled && (
                          <p className="text-xs text-red-500 mt-1">{t('backup.already_registered_category')}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* フッター（選択数表示、キャンセル・インポートボタン） */}
          <div className="p-6 border-t border-gray-200 dark:border-[#2A2A2A] bg-gray-50 dark:bg-[#222] flex justify-between items-center">
            {/* 選択数表示 */}
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {t('backup.selected_count_total', { count: activeSelectedCount })}
            </span>
            <div className="flex gap-3">
              {/* キャンセルボタン（取込処理中は無効） */}
              <button
                onClick={handleClose}
                disabled={isProcessing}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-[#333] border border-gray-300 dark:border-[#444] rounded-lg hover:bg-gray-50 dark:hover:bg-[#444] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('common.cancel')}
              </button>
              {/* インポートボタン（選択数が0または処理中の場合のみ無効化） */}
              <button
                onClick={handleImport}
                disabled={totalSelected === 0 || isProcessing}
                className={`px-6 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                  totalSelected === 0 || isProcessing
                    ? 'bg-blue-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 shadow-sm'
                }`}
              >
                {/* 処理中はスピナーとテキスト、それ以外は通常テキスト */}
                {isProcessing ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {t('common.processing')}
                  </span>
                ) : (
                  t('export_import.import')
                )}
              </button>
            </div>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
