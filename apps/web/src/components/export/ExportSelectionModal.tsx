/**
 * エクスポートデータ選択モーダル
 *
 * @description
 * エクスポートするデータを選択するためのモーダル。
 * タブ形式でデータ種別（定型文/プロファイル/変数/カテゴリ）を切り替え、
 * 個別選択・全選択が可能。
 * パスワード入力モーダルも含む。
 *
 * @see components/import/ImportSelectionModal.tsx - インポート版の参考実装
 */

import { useState, useMemo, useCallback } from 'react';
import { getSelectionTabLabel, useTranslation } from '@cliptap/shared';
import { Dialog } from '@headlessui/react';
import {
  useProfiles,        /* プロファイル一覧取得フック */
  useVariables,       /* 変数一覧取得フック */
  useCategories,      /* カテゴリ一覧取得フック */
  useSnippets,        /* 定型文一覧取得フック */
  useSelection,       /* 選択・タブ・展開状態の共通管理フック */
  type ImportTabType, /* タブの種類（snippets/profiles/variables/categories） */
} from '@cliptap/shared';
import { showAlert } from '@utils/alerts';
import { CATEGORY_FALLBACK_COLOR } from '@utils/categoryColor';
import { ExportPasswordModal } from './ExportPasswordModal';

/** タブオプションの定義（固定値） */
const TAB_OPTIONS: ImportTabType[] = ['snippets', 'profiles', 'variables', 'categories'];

/**
 * エクスポート選択モーダルのProps型定義
 */
interface ExportSelectionModalProps {
  /** モーダルの表示/非表示状態 */
  isOpen: boolean;
  /** モーダルを閉じる時のコールバック */
  onClose: () => void;
  /** エクスポート実行時のコールバック（パスワードと選択されたアイテムのID配列を渡す） */
  onExport: (
    password: string,
    selectedSnippetIds: string[],
    selectedProfileIds: string[],
    selectedVariableIds: string[],
    selectedCategoryIds: string[]
  ) => Promise<void>;
  /** 処理中フラグ（親コンポーネントで管理） */
  isProcessing: boolean;
}

/**
 * エクスポート選択モーダルコンポーネント
 *
 * 既存データから選択してエクスポートファイルを生成する
 */
export function ExportSelectionModal({
  isOpen,
  onClose,
  onExport,
  isProcessing,
}: ExportSelectionModalProps) {
  /* 翻訳関数を取得 */
  const { t } = useTranslation();

  /**
   * データ取得
   * 既存のすべてのデータを取得してエクスポート候補として使用
   * disableProfileFilter: true で全定型文を取得（プロファイルフィルタなし）
   */
  const { allSnippets, snippetProfiles } = useSnippets();
  /* エクスポート用：全スニペット（プロファイルフィルタなし） */
  const snippets = allSnippets;
  const { profiles, profileVariables } = useProfiles();  /* プロファイルとプロファイル変数値 */
  const { variables } = useVariables();                  /* 変数一覧 */
  const { categories } = useCategories();                /* カテゴリ一覧 */

  /**
   * パスワード入力モーダルの状態管理
   */
  const [showPasswordModal, setShowPasswordModal] = useState(false); /* パスワードモーダルの表示/非表示 */
  const [password, setPassword] = useState('');                      /* 入力されたパスワード */

  /**
   * カテゴリIDからカテゴリ情報を取得するヘルパー関数
   * メモ化してレンダリング毎の再生成を防ぐ
   */
  const getCategory = useCallback(
    (categoryId: string | null): { name: string | null; color: string | null } => {
      if (!categoryId) return { name: null, color: null };
      const category = categories.find((c) => c.id === categoryId);
      return { name: category?.name ?? null, color: category?.color ?? null };
    },
    [categories]
  );

  /**
   * プロファイルIDからプロファイル名を取得するヘルパー関数
   * メモ化してレンダリング毎の再生成を防ぐ
   */
  const getProfileName = useCallback(
    (profileId: string): string | null => {
      const profile = profiles.find((p) => p.id === profileId);
      return profile?.name ?? null;
    },
    [profiles]
  );

  /**
   * エクスポート候補データの生成
   * 既存データを表示用の形式に変換してメモ化
   */
  const candidates = useMemo(() => {
    /* 定型文候補データの生成 */
    const snippetCandidates = snippets.map((s) => {
      /* この定型文に紐付いているプロファイルIDを取得 */
      const snippetProfileIds = snippetProfiles
        .filter((sp) => sp.snippetId === s.id)
        .map((sp) => sp.profileId);
      /* プロファイルIDからプロファイル名を取得 */
      const snippetProfilesData = snippetProfileIds.map((profileId) => ({
        profileId,
        profileName: getProfileName(profileId),
      }));

      /* カテゴリ情報を取得 */
      const category = getCategory(s.categoryId);

      return {
        id: s.id,
        title: s.title,
        content: s.content,
        categoryId: s.categoryId,
        categoryName: category.name,
        categoryColor: category.color,
        profiles: snippetProfilesData,
      };
    });

    /* プロファイル候補データの生成 */
    const profileCandidates = profiles.map((p) => ({
      id: p.id,
      name: p.name,
    }));

    /* 変数候補データの生成（カスタム変数のみ、システム変数は除外） */
    const customVariables = variables.filter((v) => v.type === 'custom');
    const variableCandidates = customVariables.map((v) => {
      /* この変数のプロファイル別の値を取得 */
      const variableProfileValues = profileVariables
        .filter((pv) => pv.variableId === v.id)
        .map((pv) => ({
          profileId: pv.profileId,
          profileName: getProfileName(pv.profileId),
          value: pv.value,
        }));

      return {
        id: v.id,
        name: v.name,
        label: v.label,
        icon: v.icon,
        profileValues: variableProfileValues,
      };
    });

    /* カテゴリ候補データの生成 */
    const categoryCandidates = categories.map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
    }));

    /* すべての候補データをまとめて返す */
    return {
      snippets: snippetCandidates,
      profiles: profileCandidates,
      variables: variableCandidates,
      categories: categoryCandidates,
    };
  }, [snippets, snippetProfiles, profiles, variables, categories, profileVariables, getCategory, getProfileName]);

  /**
   * 選択・タブ・展開状態の管理
   *
   * 共有フックへ委譲することで、モーダルを開いたまま候補データが再計算されても
   * 初期化し直さない（isOpen の立ち上がりで1回だけ全選択する）。
   * エクスポートは既存データとの重複判定が不要なため enableDuplicateCheck は false。
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
    toggleSelection,
    toggleSelectAll,
    isAllSelected,
    toggleExpandSnippet,
    toggleExpandVariable,
    totalSelected,
  } = useSelection({ candidates, isOpen, enableDuplicateCheck: false });

  /**
   * エクスポートボタン押下時の処理
   * パスワード入力モーダルを表示
   */
  const handleExportPress = useCallback(async () => {
    /* 何も選択されていない場合はエラー */
    if (totalSelected === 0) {
      showAlert('', t('backup.no_selection'));
      return;
    }
    /* パスワードをクリアしてモーダルを表示 */
    setPassword('');
    setShowPasswordModal(true);
  }, [totalSelected, t]);

  /**
   * パスワード入力後のエクスポート実行処理
   */
  const handlePasswordSubmit = useCallback(async () => {
    /* パスワードが未入力の場合はエラー */
    if (!password.trim()) {
      showAlert('', t('error.password_required'));
      return;
    }

    /* パスワードモーダルを閉じる */
    setShowPasswordModal(false);
    /* 親コンポーネントにエクスポート処理を委譲（SetをArrayに変換） */
    await onExport(
      password,
      Array.from(selectedSnippetIds),
      Array.from(selectedProfileIds),
      Array.from(selectedVariableIds),
      Array.from(selectedCategoryIds)
    );
    /* パスワードをクリア */
    setPassword('');
    /* モーダルを閉じる */
    onClose();
  }, [password, selectedSnippetIds, selectedProfileIds, selectedVariableIds, selectedCategoryIds, onExport, onClose, t]);

  /**
   * モーダルを閉じる処理
   * パスワードモーダルも含めて全て閉じる
   *
   * @remarks
   * 出力処理中は閉じない。処理中に閉じられると一時DBを使った出力の途中で
   * 画面状態だけが先に戻り、利用者が二重に操作できてしまうため。
   */
  const handleClose = useCallback(() => {
    if (isProcessing) return;
    setShowPasswordModal(false);
    setPassword('');
    onClose();
  }, [isProcessing, onClose]);

  /* メイン選択モーダル（z-50） */
  return (
    <>
      <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
        {/* 背景オーバーレイ */}
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

        {/* モーダルコンテナ（中央配置） */}
        <div className="fixed inset-0 flex items-center justify-center p-4">
          {/* モーダルパネル（高さ80vh、flex列レイアウト） */}
          <Dialog.Panel className="w-full max-w-3xl h-[80vh] bg-white dark:bg-[#1A1A1A] rounded-2xl shadow-xl flex flex-col">
            {/* ヘッダー（タイトル、閉じるボタン、全選択ボタン） */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-[#2A2A2A]">
              {/* 閉じるボタン（出力処理中は無効） */}
              <button
                onClick={handleClose}
                disabled={isProcessing}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <Dialog.Title className="text-xl font-bold text-gray-900 dark:text-white">
                {t('export_import.select_export_data')}
              </Dialog.Title>
              <button
                onClick={() => toggleSelectAll()}
                className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                title={isAllSelected() ? t('common.deselect_all') : t('common.select_all')}
              >
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

            {/* タブナビゲーション（定型文/プロファイル/変数/カテゴリ、選択数表示付き） */}
            <div className="flex border-b border-gray-200 dark:border-[#2A2A2A]">
              {TAB_OPTIONS.map((tab) => (
                /* タブボタン（選択数表示付き） */
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex flex-col items-center ${
                    activeTab === tab
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  <span>{getSelectionTabLabel(tab, t)}</span>
                  <span className="text-xs mt-0.5">
                    ({tab === 'snippets'
                      ? selectedSnippetIds.size
                      : tab === 'profiles'
                      ? selectedProfileIds.size
                      : tab === 'variables'
                      ? selectedVariableIds.size
                      : selectedCategoryIds.size})
                  </span>
                </button>
              ))}
            </div>

            {/* コンテンツエリア（スクロール可能、タブに応じて表示内容を切り替え） */}
            <div className="flex-1 overflow-y-auto p-0">
              {activeTab === 'snippets' && (
                <div className="divide-y divide-gray-100 dark:divide-[#2A2A2A]">
                  {candidates.snippets.map((item) => {
                    /* 選択されているプロファイルのみフィルタリング */
                    const selectedProfiles = item.profiles.filter((p) => selectedProfileIds.has(p.profileId));
                    /* プロファイル名の配列（空の場合は「全てのプロファイル」） */
                    const filteredProfileNames = selectedProfiles.map((p) => p.profileName).filter(Boolean) as string[];
                    const profileNames = item.profiles.length === 0 || filteredProfileNames.length === 0
                      ? [t('profile.all_profiles')]
                      : filteredProfileNames;

                    /* カテゴリが選択されているかチェック（選択されていない場合は未分類として表示） */
                    const isCategorySelected = item.categoryId ? selectedCategoryIds.has(item.categoryId) : false;
                    const displayCategoryName = isCategorySelected ? (item.categoryName || t('common.uncategorized')) : t('common.uncategorized');
                    /* カテゴリ未選択時・色未設定時はどちらも未設定フォールバック色で表示する */
                    const displayCategoryColor = isCategorySelected
                      ? (item.categoryColor || CATEGORY_FALLBACK_COLOR)
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
                          {/* タイトル行 */}
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
                          {/* バッジ行（カテゴリ + プロファイル） */}
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
                  {candidates.profiles.map((item) => (
                    /* プロファイルアイテム（チェックボックス、名前） */
                    <div key={item.id} className="p-4 flex items-center hover:bg-gray-50 dark:hover:bg-[#222] transition-colors">
                      {/* チェックボックス */}
                      <div className="flex items-center h-6 mr-4">
                        <input
                          type="checkbox"
                          checked={selectedProfileIds.has(item.id)}
                          onChange={() => toggleSelection(item.id, 'profiles')}
                          className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 border-gray-300 dark:border-gray-600 dark:bg-[#333]"
                        />
                      </div>
                      <div className="flex-1">
                        {/* プロファイル名 */}
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white">{item.name}</h3>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 変数タブ */}
              {activeTab === 'variables' && (
                <div className="divide-y divide-gray-100 dark:divide-[#2A2A2A]">
                  {candidates.variables.map((item) => {
                    /* 選択されたプロファイルのみのprofileValuesをフィルタリング */
                    const filteredProfileValues = item.profileValues.filter((pv) =>
                      selectedProfileIds.has(pv.profileId)
                    );
                    /* 変数アイテム（チェックボックス、名前、ラベル、プロファイル値一覧、展開/折りたたみ） */
                    return (
                      <div key={item.id} className="p-4 flex items-start hover:bg-gray-50 dark:hover:bg-[#222] transition-colors">
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
                              {/* 変数名 */}
                              <h3 className="text-sm font-medium text-gray-900 dark:text-white">{item.name}</h3>
                            </div>
                          </div>
                          <div className="ml-6">
                            {/* 変数ラベル（オプション） */}
                            {item.label && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{item.label}</p>}

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
                      </div>
                    );
                  })}
                </div>
              )}

              {/* カテゴリタブ */}
              {activeTab === 'categories' && (
                <div className="divide-y divide-gray-100 dark:divide-[#2A2A2A]">
                  {candidates.categories.map((item) => (
                    /* カテゴリアイテム（チェックボックス、カラーインジケーター、名前） */
                    <div key={item.id} className="p-4 flex items-center hover:bg-gray-50 dark:hover:bg-[#222] transition-colors">
                      {/* チェックボックス */}
                      <div className="flex items-center h-6 mr-4">
                        <input
                          type="checkbox"
                          checked={selectedCategoryIds.has(item.id)}
                          onChange={() => toggleSelection(item.id, 'categories')}
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
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* フッター（キャンセル・エクスポートボタン） */}
            <div className="p-6 border-t border-gray-200 dark:border-[#2A2A2A] bg-gray-50 dark:bg-[#222] flex justify-end items-center">
              <div className="flex gap-3">
                {/* キャンセルボタン（出力処理中は無効） */}
                <button
                  onClick={handleClose}
                  disabled={isProcessing}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-[#333] border border-gray-300 dark:border-[#444] rounded-lg hover:bg-gray-50 dark:hover:bg-[#444] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('common.cancel')}
                </button>
                {/* エクスポートボタン（選択数が0または処理中の場合のみ無効化、押下でパスワードモーダル表示） */}
                <button
                  onClick={handleExportPress}
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
                    t('export_import.export')
                  )}
                </button>
              </div>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* パスワード入力モーダル（z-60で選択モーダルより前面に表示） */}
      <ExportPasswordModal
        isOpen={showPasswordModal}
        password={password}
        onPasswordChange={setPassword}
        onSubmit={handlePasswordSubmit}
        onCancel={() => setShowPasswordModal(false)}
        isProcessing={isProcessing}
      />
    </>
  );
}
