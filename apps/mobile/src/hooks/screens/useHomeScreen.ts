/**
 * ホーム画面のビジネスロジックフック
 *
 * メイン画面の全ての状態管理とロジックを提供。
 * UIコンポーネント（index.tsx）から完全に分離されたビジネスロジック層。
 *
 * 主な責務:
 * - 一覧の表示対象（定型文／ショートカット）の切り替え
 * - 定型文一覧の取得とフィルタリング
 * - カテゴリフィルターの管理
 * - Pull-to-refresh処理
 * - 定型文のコピー・編集・削除操作
 * - 画面フォーカス時のデータ更新
 *
 * 【表示対象をこのフックが持つ理由】
 * 表示対象は「一覧の中身」だけでなく「追加ボタンの行き先」「カテゴリチップの集合」
 * 「並べ替えを出すかどうか」も同時に決める。別のフックへ切り出すと、
 * 結局その値を引数で受け取り直すことになり経路が増えるだけになる。
 *
 * @see app/index.tsx - UIコンポーネント
 * @see src/hooks/screens/useHomeShortcuts.ts - ショートカット表示側のロジック
 * @see packages/shared/src/providers/SnippetProvider.tsx - 定型文CRUD操作（useSnippets）
 * @see packages/shared/src/providers/CategoryProvider.tsx - カテゴリCRUD操作（useCategories）
 */

import { useState, useCallback, useMemo } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from '@cliptap/shared';
import i18next from '@i18n/config';
import { useSnippets, useCategories, useProfiles, useVariables, useFilteredSnippets, useSharedSubscription, filterCategoriesInUse, type Category, type Shortcut, type ShortcutValue, type SnippetWithDisplay, type SnippetSortBy } from '@cliptap/shared';
import { showErrorAlert } from '@utils/alerts';
import { useHomeShortcuts } from '@hooks/screens/useHomeShortcuts';
import { useItemLimitGuard } from '@hooks/useItemLimitGuard';

/**
 * 一覧に出す対象
 *
 * 定型文とショートカットは同じ位置の一覧を入れ替えて使う。
 * 切り替えはフィルター行のトグルが担う（拡張キーボードと同じ操作に揃えている）。
 */
export type ListMode = 'snippet' | 'shortcut';

/**
 * useHomeScreenの戻り値の型
 */
export interface UseHomeScreenReturn {
  /* 状態 */
  listMode: ListMode;
  selectedCategoryId: string | null;
  activeProfileId: string | undefined;
  currentSort: SnippetSortBy;

  /* データ */
  snippets: SnippetWithDisplay[];
  shortcuts: Shortcut[];
  categories: Category[];
  filteredCategories: Category[];

  /* ハンドラ */
  handleToggleListMode: () => void;
  handleCategorySelect: (categoryId: string | null) => void;
  handleRefresh: () => void;
  handleCopySnippet: (snippet: SnippetWithDisplay) => Promise<void>;
  handleCopySnippetTitle: (snippet: SnippetWithDisplay) => Promise<void>;
  handleEditSnippet: (snippet: SnippetWithDisplay) => void;
  handleDeleteSnippet: (snippet: SnippetWithDisplay) => void;
  handleCopyShortcutValue: (value: ShortcutValue) => Promise<void>;
  handleEditShortcut: (shortcut: Shortcut) => void;
  handleDeleteShortcut: (shortcut: Shortcut) => void;
  handleNavigateToSettings: () => void;
  handleNavigateToSearch: () => void;
  handleNavigateToCreate: () => void;
  handleProfileChange: () => void;
  handleSortChange: (sortBy: SnippetSortBy) => void;
}

/**
 * ホーム画面のビジネスロジックフック
 *
 * @returns 画面に必要な全ての状態とハンドラ
 */
export function useHomeScreen(): UseHomeScreenReturn {
  const { t } = useTranslation();
  const router = useRouter();

  /* ======================================== */
  /* 状態管理 */
  /* ======================================== */
  /* 一覧に出す対象（既定は定型文） */
  const [listMode, setListMode] = useState<ListMode>('snippet');
  /* ユーザーが明示的に選択したカテゴリID（null = すべて） */
  const [categoryOverride, setCategoryOverride] = useState<string | null>(null);

  /* ======================================== */
  /* データ取得 */
  /* ======================================== */
  const { categories, refresh: refreshCategories } = useCategories();
  const { activeProfile, profileVariables, defaultProfile, refresh: refreshProfiles } = useProfiles();
  const { variables } = useVariables();
  const { isLoading: isSubscriptionLoading } = useSharedSubscription();
  const { ensureCanAddSnippet } = useItemLimitGuard();

  /* アクティブなプロファイル（現在選択中の環境）はProviderの値を使う。
     検索画面・環境選択・Web版も同じ入口を使っており、ここだけ配列から導出すると
     Provider側の自動有効化を取りこぼす */
  const activeProfileId = activeProfile?.id;
  const defaultProfileId = defaultProfile?.id;

  /* スニペットデータを取得（Providerから全データを取得） */
  const {
    allSnippets: allSnippetsData,
    snippetProfiles,
    refresh,
    copySnippet,
    copySnippetTitle,
    deleteSnippet,
    sortBy: snippetSort,
    setSortBy: setSnippetSort,
  } = useSnippets();

  /**
   * 実際に適用するカテゴリID
   *
   * 選択中のカテゴリが削除された場合は自動的に「すべて」へフォールバックする。
   * effectで書き潰さないため、カテゴリ一覧が一時的に空になっても選択は失われない。
   */
  const selectedCategoryId = useMemo(
    () => (categoryOverride && categories.some((c) => c.id === categoryOverride) ? categoryOverride : null),
    [categoryOverride, categories]
  );

  /* 共通フィルタリングフックを使用（カテゴリフィルタ適用） */
  const { filteredSnippets: snippets } = useFilteredSnippets({
    snippets: allSnippetsData,
    snippetProfiles,
    searchQuery: '', /* ホーム画面では検索なし */
    selectedCategory: selectedCategoryId,
    activeProfileId: activeProfileId ?? null,
    defaultProfileId: defaultProfileId ?? null,
    variables,
    profileVariables,
    locale: i18next.language,
  });

  /* 全スニペットを取得（カテゴリフィルタなし、カテゴリ一覧の表示用） */
  const { filteredSnippets: allSnippets } = useFilteredSnippets({
    snippets: allSnippetsData,
    snippetProfiles,
    searchQuery: '',
    selectedCategory: null, /* 全カテゴリ */
    activeProfileId: activeProfileId ?? null,
    defaultProfileId: defaultProfileId ?? null,
    variables,
    profileVariables,
    locale: i18next.language,
  });

  /* ======================================== */
  /* 派生状態 */
  /* ======================================== */

  /* 定型文が1件以上あるカテゴリだけをチップに出す */
  const snippetCategories = useMemo(
    () => filterCategoriesInUse(allSnippets, categories),
    [allSnippets, categories]
  );

  /* ショートカット表示側の一覧・チップ・管理操作。
     適用中のカテゴリを渡し、絞り込みは向こうで行う */
  const {
    shortcuts,
    filteredCategories: shortcutCategories,
    currentSort: shortcutSort,
    handleSortChange: handleShortcutSortChange,
    handleCopyShortcutValue,
    handleRefreshShortcuts: refreshShortcuts,
    handleCreateShortcut,
    handleEditShortcut,
    handleDeleteShortcut,
  } = useHomeShortcuts({ selectedCategoryId });

  /* チップの集合は表示対象ごとに変わる（定型文が無いカテゴリはショートカット表示では出したい） */
  const filteredCategories = listMode === 'shortcut' ? shortcutCategories : snippetCategories;

  /* 並べ替えは表示対象ごとに別の設定として持つ。基準は同じ4種だが、
     「使用頻度」が指すもの（コピー回数／値の挿入回数）が対象ごとに違うため、
     切り替えるたびに並びが引きずられないようにする */
  const currentSort = listMode === 'shortcut' ? shortcutSort : snippetSort;
  const handleSortChange = listMode === 'shortcut' ? handleShortcutSortChange : setSnippetSort;

  /* ======================================== */
  /* 画面フォーカス時のデータ更新 */
  /* ======================================== */
  /* 作成・編集画面から戻ったときに一覧へ即座に反映するため、フォーカスのたびに読み直す。
     ショートカットもここでまとめて読み直し、フォーカスごとの再取得を1箇所に集約する */
  useFocusEffect(
    useCallback(() => {
      refresh();
      refreshCategories();
      refreshProfiles();
      refreshShortcuts();
    }, [refresh, refreshCategories, refreshProfiles, refreshShortcuts])
  );

  /* ======================================== */
  /* イベントハンドラ */
  /* ======================================== */

  /**
   * 一覧に出す対象を入れ替える
   *
   * 【カテゴリ選択を「すべて」へ戻す理由】
   * カテゴリは表示対象ごとに中身が違う。切り替え先にそのカテゴリのデータが1件も無いと、
   * チップ行に出ていないカテゴリで絞り込まれたまま一覧だけが空になり、
   * 何が起きているのか分からなくなる。
   */
  const handleToggleListMode = useCallback(() => {
    setListMode((current) => (current === 'snippet' ? 'shortcut' : 'snippet'));
    setCategoryOverride(null);
  }, []);

  const handleCategorySelect = useCallback((categoryId: string | null) => {
    setCategoryOverride(categoryId);
  }, []);

  /* 引き下げ更新は今見ている一覧を読み直す */
  const handleRefresh = useCallback(() => {
    if (listMode === 'shortcut') {
      refreshShortcuts();
      return;
    }
    refresh();
  }, [listMode, refreshShortcuts, refresh]);

  const handleCopySnippet = useCallback(async (snippet: SnippetWithDisplay) => {
    try {
      await copySnippet(snippet.id);
    } catch {
      showErrorAlert(t('error.generic'));
    }
  }, [copySnippet, t]);

  /* 一覧のタイトルタップ時はタイトルだけをコピーする（件名と本文を別々に貼り付ける用途） */
  const handleCopySnippetTitle = useCallback(async (snippet: SnippetWithDisplay) => {
    try {
      await copySnippetTitle(snippet.id);
    } catch (error) {
      showErrorAlert(t('error.generic'));
      /* カード側でコピー成功表示を出さないよう再スローする */
      throw error;
    }
  }, [copySnippetTitle, t]);

  const handleEditSnippet = useCallback((snippet: SnippetWithDisplay) => {
    router.push({
      pathname: '/snippet/edit',
      params: { id: snippet.id },
    });
  }, [router]);

  /* deleteSnippetは内部で一覧を再読込するため、追加のrefreshは不要 */
  const handleDeleteSnippet = useCallback((snippet: SnippetWithDisplay) => {
    try {
      deleteSnippet(snippet.id);
    } catch {
      showErrorAlert(t('error.generic'));
    }
  }, [deleteSnippet, t]);

  const handleNavigateToSettings = useCallback(() => {
    router.push('/settings');
  }, [router]);

  /* 検索はホームの一覧を絞り込む延長の操作なので、表示対象を引き継ぐ。
     ホームでショートカットを見ていたのに定型文が出てくる、という食い違いを避ける */
  const handleNavigateToSearch = useCallback(() => {
    router.push({
      pathname: '/search',
      params: { mode: listMode },
    });
  }, [listMode, router]);

  /* 追加ボタンは今見ている一覧に足す。表示対象と登録先がずれないようにモードで分ける */
  const handleNavigateToCreate = useCallback(() => {
    if (listMode === 'shortcut') {
      handleCreateShortcut();
      return;
    }
    /* 権利確認中は登録上限の判定を保留して作成画面を開く。起動直後はPro利用者もまだFree扱いのため、
       ここで判定すると誤ってPro案内を出してしまう。上限は作成画面の保存時に必ず判定する */
    if (!isSubscriptionLoading && !ensureCanAddSnippet()) {
      return;
    }
    router.push('/snippet/create');
  }, [listMode, handleCreateShortcut, isSubscriptionLoading, ensureCanAddSnippet, router]);

  const handleProfileChange = useCallback(() => {
    refreshProfiles();
    refresh();
  }, [refreshProfiles, refresh]);

  return {
    listMode,
    selectedCategoryId,
    activeProfileId,
    currentSort,
    snippets,
    shortcuts,
    categories,
    filteredCategories,
    handleToggleListMode,
    handleCategorySelect,
    handleRefresh,
    handleCopySnippet,
    handleCopySnippetTitle,
    handleEditSnippet,
    handleDeleteSnippet,
    handleCopyShortcutValue,
    handleEditShortcut,
    handleDeleteShortcut,
    handleNavigateToSettings,
    handleNavigateToSearch,
    handleNavigateToCreate,
    handleProfileChange,
    handleSortChange,
  };
}
