/**
 * 定型文一覧画面のビジネスロジックフック
 *
 * @description
 * 定型文一覧の状態管理とロジックを提供。
 * webではルート `/` をファイル読み込み画面（pages/Home.tsx）が占めるため、
 * 定型文一覧は `/dashboard`（pages/Dashboard.tsx）が担う。
 * このフックは Dashboard.tsx からのみ使われ、
 * apps/mobile/src/hooks/screens/useHomeScreen.ts と対応する。
 *
 * Mobile版と同様のシンプルな構成で、モーダル/エクスポート/インポートは
 * 専用フック（useSnippetModal, useExportScreen, useImportScreen）に分離。
 *
 * @see pages/Dashboard.tsx - UIコンポーネント
 * @see useSnippetModal.ts - スニペット作成/編集モーダル
 * @see useExportScreen.ts - エクスポート処理
 * @see useImportScreen.ts - インポート処理
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from '@cliptap/shared';
import {
  Logger,
  useSnippets,
  useCategories,
  useProfiles,
  useVariables,
  useAuth,
  useFilteredSnippets,
  useDebounce,
  useShortcuts,
  useVariableExpansion,
  useSharedSubscription,
  ShortcutService,
  FREE_SHORTCUTS_LIMIT,
  attachDisplayValues,
  filterCategoriesInUse,
  searchShortcuts,
  sortShortcuts,
  type Snippet,
  type Category,
  type Profile,
  type Variable,
  type ProfileVariable,
  type SnippetWithDisplay,
  type SnippetSortBy,
  type Shortcut,
  type ShortcutValueWithDisplay,
  type ShortcutWithDisplay,
} from '@cliptap/shared';
import { useDatabase } from '@cliptap/shared';
import { useTheme } from '@hooks/useTheme';
import { useBodyScrollLock } from '@hooks/useBodyScrollLock';
import { useMobileMenu } from '@hooks/useMobileMenu';
import { useSnippetModal } from '@hooks/screens/useSnippetModal';
import { useExportScreen } from '@hooks/screens/useExportScreen';
import { useImportScreen } from '@hooks/screens/useImportScreen';
import type { ShortcutFormValues } from '@components/shortcut/ShortcutEditModal';
import type { WebListMode } from '@components/dashboard/ListModeToggle';
import { showConfirmMessage, showErrorAlert } from '@utils/alerts';

/** コピー完了表示を出しておく時間（ミリ秒） */
const COPY_SUCCESS_DURATION_MS = 2000;

/**
 * useHomeScreenの戻り値の型
 */
export interface UseHomeScreenReturn {
  /* ローディング状態 */
  isLoaded: boolean;

  /* UI状態 */
  searchQuery: string;
  selectedCategory: string | null;
  copiedId: string | null;
  copiedTitleId: string | null;
  expandedSnippetId: string | null;
  showProfileDropdown: boolean;
  showSearchBar: boolean;
  gridColumns: 1 | 2 | 3;
  listMode: WebListMode;
  searchProfileId: string | null;
  copiedShortcutValueId: string | null;

  /* モバイルメニュー */
  isMobileMenuOpen: boolean;

  /* スニペットモーダル（useSnippetModalから） */
  snippetModal: ReturnType<typeof useSnippetModal>;
  shortcutModal: {
    isOpen: boolean;
    shortcut: Shortcut | null;
    handleCreate: () => void;
    handleEdit: (shortcut: Shortcut) => void;
    handleClose: () => void;
    handleSave: (values: ShortcutFormValues) => void;
  };

  /* エクスポート画面（useExportScreenから） */
  exportScreen: ReturnType<typeof useExportScreen>;

  /* インポート画面（useImportScreenから） */
  importScreen: ReturnType<typeof useImportScreen>;

  /* モーダル表示状態（スクロールロック用） */
  isModalOpen: boolean;

  /* データ */
  filteredSnippets: SnippetWithDisplay[];
  filteredShortcuts: ShortcutWithDisplay[];
  categories: Category[];
  filterCategories: Category[];
  profiles: Profile[];
  validProfiles: Profile[];
  variables: Variable[];
  profileVariables: ProfileVariable[];
  activeProfile: Profile | null;
  activeProfileId: string | null;
  defaultProfileId: string | null;

  /* ソート */
  currentSort: SnippetSortBy;
  handleSortChange: (sort: SnippetSortBy) => void;
  getSearchResultCount: (profileId: string) => number;

  /* UI設定ハンドラ */
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (categoryId: string | null) => void;
  setShowSearchBar: (show: boolean) => void;
  setGridColumns: (columns: 1 | 2 | 3) => void;
  setShowProfileDropdown: (show: boolean) => void;
  setListMode: (mode: WebListMode) => void;
  setSearchProfileId: (profileId: string) => void;

  /* ハンドラ */
  handleCopySnippet: (snippet: Snippet) => Promise<void>;
  handleCopySnippetTitle: (snippet: Snippet) => Promise<void>;
  handleDeleteSnippet: (id: string) => Promise<void>;
  handleSelectProfile: (profileId: string) => Promise<void>;
  handleToggleSnippet: (snippetId: string) => void;
  handleCopyShortcutValue: (value: ShortcutValueWithDisplay) => Promise<void>;
  handleDeleteShortcut: (shortcut: Shortcut) => void;
  handleToggleMobileMenu: () => void;
  handleCloseMobileMenu: () => void;
  getCategoryColor: (categoryId: string | null) => string | null;
  getCategoryName: (categoryId: string | null) => string;
}

/**
 * ホーム画面のビジネスロジックフック
 *
 * @returns 画面に必要な全ての状態とハンドラ
 */
export function useHomeScreen(): UseHomeScreenReturn {
  const { t, language } = useTranslation();
  const { isLoaded, setLoaded } = useDatabase();
  const { allSnippets, snippetProfiles, copySnippet, copySnippetTitle, deleteSnippet, refresh: refreshSnippets, sortBy, setSortBy } = useSnippets();
  const { categories, getById: getCategoryById } = useCategories();
  const { profiles, validProfiles, profileVariables, activeProfile, defaultProfile, setActiveProfile } = useProfiles();
  const { variables } = useVariables();
  const {
    shortcuts: activeShortcuts,
    createShortcut,
    updateShortcut,
    deleteShortcut,
    copyShortcutValue,
  } = useShortcuts();
  const {
    canAddShortcut,
    isLoading: isSubscriptionLoading,
  } = useSharedSubscription();
  const { gridColumns, setGridColumns } = useTheme();
  const { user } = useAuth();

  /* ======================================== */
  /* 分離されたフック */
  /* ======================================== */

  /* スニペットモーダル */
  const snippetModal = useSnippetModal({ 
    snippetProfiles,
    onSnippetsChange: refreshSnippets,
  });

  /* エクスポート画面 */
  const exportScreen = useExportScreen();

  /* インポート画面 */
  const importScreen = useImportScreen({ user, setLoaded });

  /* ======================================== */
  /* UI状態 */
  /* ======================================== */
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedTitleId, setCopiedTitleId] = useState<string | null>(null);
  const [expandedSnippetId, setExpandedSnippetId] = useState<string | null>(null);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [listMode, setListModeState] = useState<WebListMode>('snippet');
  const [searchProfileOverride, setSearchProfileOverride] = useState<string | null>(null);
  const [copiedShortcutValueId, setCopiedShortcutValueId] = useState<string | null>(null);
  const [editingShortcut, setEditingShortcut] = useState<Shortcut | null>(null);
  const [isCreatingShortcut, setIsCreatingShortcut] = useState(false);
  const [shortcutSort, setShortcutSort] = useState<SnippetSortBy>(() => {
    const stored = localStorage.getItem('@shortcut_sort_preference');
    return stored === 'created' || stored === 'updated' || stored === 'title' || stored === 'usage'
      ? stored
      : 'created';
  });

  /* モバイルメニュー */
  const { isOpen: isMobileMenuOpen, toggle: toggleMobileMenu, close: closeMobileMenu } = useMobileMenu();

  /* モーダル表示時に背景スクロールを無効化 */
  const isModalOpen = exportScreen.showExportModal ||
    snippetModal.isCreating ||
    !!snippetModal.editingSnippet ||
    isCreatingShortcut ||
    !!editingShortcut ||
    isMobileMenuOpen ||
    importScreen.showFileModal;
  useBodyScrollLock(isModalOpen);

  /* ======================================== */
  /* 派生状態 */
  /* ======================================== */

  /* プロファイル情報 */
  const activeProfileId = activeProfile?.id || null;
  const defaultProfileId = defaultProfile?.id || null;
  const hasSearchQuery = searchQuery.trim() !== '';
  const searchProfileId = hasSearchQuery && searchProfileOverride
    ? searchProfileOverride
    : activeProfileId;
  const effectiveProfileId = hasSearchQuery ? searchProfileId : activeProfileId;

  const { expandVariables } = useVariableExpansion({
    variables,
    profileVariables,
    locale: language,
  });

  /* 共通フィルタリングフックを使用 */
  const { filteredSnippets } = useFilteredSnippets({
    snippets: allSnippets,
    snippetProfiles,
    /*
     * 検索欄を空にしたときだけデバウンスを待たず、即座に全件表示へ戻す。
     * 入力中は300msのデバウンス値（debouncedSearchQuery）を使う
     */
    searchQuery: searchQuery === '' ? '' : debouncedSearchQuery,
    selectedCategory: hasSearchQuery ? null : selectedCategory,
    activeProfileId: effectiveProfileId,
    defaultProfileId,
    variables,
    profileVariables,
    locale: language,
  });

  const { filteredSnippets: snippetsBeforeCategoryFilter } = useFilteredSnippets({
    snippets: allSnippets,
    snippetProfiles,
    searchQuery: '',
    selectedCategory: null,
    activeProfileId,
    defaultProfileId,
    variables,
    profileVariables,
    locale: language,
  });

  const shortcutSource = useMemo(() => {
    if (!effectiveProfileId) return [];
    if (effectiveProfileId === activeProfileId) return activeShortcuts;
    return ShortcutService.getByProfileId(effectiveProfileId);
  }, [effectiveProfileId, activeProfileId, activeShortcuts]);

  const filteredShortcuts = useMemo(() => {
    const displayed = attachDisplayValues(shortcutSource, (text) =>
      expandVariables(text, effectiveProfileId, defaultProfileId)
    );
    const categoryFiltered = hasSearchQuery || selectedCategory === null
      ? displayed
      : displayed.filter((shortcut) => selectedCategory === 'uncategorized'
        ? shortcut.categoryId === null
        : shortcut.categoryId === selectedCategory);
    return sortShortcuts(searchShortcuts(categoryFiltered, searchQuery === '' ? '' : debouncedSearchQuery), shortcutSort);
  }, [shortcutSource, expandVariables, effectiveProfileId, defaultProfileId, hasSearchQuery, selectedCategory, searchQuery, debouncedSearchQuery, shortcutSort]);

  const shortcutCategories = useMemo(
    () => filterCategoriesInUse(shortcutSource, categories),
    [shortcutSource, categories]
  );
  const snippetCategories = useMemo(
    () => filterCategoriesInUse(snippetsBeforeCategoryFilter, categories),
    [snippetsBeforeCategoryFilter, categories]
  );
  const displayCategories = listMode === 'shortcut' ? shortcutCategories : snippetCategories;

  const searchResultCounts = useMemo(() => {
    const result = new Map<string, number>();
    const normalizedQuery = debouncedSearchQuery.trim().toLocaleLowerCase();
    const profileLinks = new Map<string, string[]>();
    snippetProfiles.forEach((link) => {
      const ids = profileLinks.get(link.snippetId) ?? [];
      ids.push(link.profileId);
      profileLinks.set(link.snippetId, ids);
    });

    validProfiles.forEach((profile) => {
      if (listMode === 'shortcut') {
        const displayed = attachDisplayValues(
          profile.id === activeProfileId ? activeShortcuts : ShortcutService.getByProfileId(profile.id),
          (text) => expandVariables(text, profile.id, defaultProfileId)
        );
        result.set(profile.id, searchShortcuts(displayed, normalizedQuery).length);
        return;
      }

      const count = allSnippets.filter((snippet) => {
        const linkedProfiles = profileLinks.get(snippet.id) ?? [];
        if (linkedProfiles.length > 0 && !linkedProfiles.includes(profile.id)) return false;
        if (!normalizedQuery) return true;
        return Boolean(
          snippet.title?.toLocaleLowerCase().includes(normalizedQuery)
          || snippet.content.toLocaleLowerCase().includes(normalizedQuery)
        );
      }).length;
      result.set(profile.id, count);
    });
    return result;
  }, [validProfiles, listMode, debouncedSearchQuery, snippetProfiles, allSnippets, expandVariables, defaultProfileId, activeProfileId, activeShortcuts]);

  const getSearchResultCount = useCallback(
    (profileId: string) => searchResultCounts.get(profileId) ?? 0,
    [searchResultCounts]
  );

  /* ======================================== */
  /* ハンドラ */
  /* ======================================== */

  /** スニペットをクリップボードにコピー */
  const handleCopySnippet = useCallback(async (snippet: Snippet) => {
    try {
      await copySnippet(snippet.id, effectiveProfileId ?? undefined);
      setCopiedId(snippet.id);
    } catch (err) {
      Logger.error('Failed to copy:', err);
    }
  }, [copySnippet, effectiveProfileId]);

  /**
   * コピー完了表示の自動リセット
   *
   * @remarks
   * クリーンアップでタイマーを解除するのは、アンマウント後や別の定型文をコピーして
   * IDが入れ替わった後に、前回のタイマーが発火して表示を消してしまわないようにするため。
   */
  useEffect(() => {
    if (!copiedId) return;

    const timeoutId = setTimeout(() => setCopiedId(null), COPY_SUCCESS_DURATION_MS);

    return () => clearTimeout(timeoutId);
  }, [copiedId]);

  /**
   * スニペットのタイトルだけをクリップボードにコピー
   *
   * 【使用回数を加算しない理由】
   * タイトルをコピーしたあと本文もコピーすると、1回の利用が2回分として数えられてしまいます。
   * 加算はcopySnippet側に集約しており、こちらでは行いません。
   */
  const handleCopySnippetTitle = useCallback(async (snippet: Snippet) => {
    try {
      await copySnippetTitle(snippet.id, effectiveProfileId ?? undefined);
      setCopiedTitleId(snippet.id);
    } catch (err) {
      Logger.error('Failed to copy title:', err);
    }
  }, [copySnippetTitle, effectiveProfileId]);

  /**
   * タイトルのコピー完了表示の自動リセット
   *
   * @remarks
   * 本文側と同じ理由でクリーンアップを置く。タイマーを解除しないと、
   * 続けて別のタイトルをコピーしたときに前回のタイマーが表示を消してしまう。
   */
  useEffect(() => {
    if (!copiedTitleId) return;

    const timeoutId = setTimeout(() => setCopiedTitleId(null), COPY_SUCCESS_DURATION_MS);

    return () => clearTimeout(timeoutId);
  }, [copiedTitleId]);

  useEffect(() => {
    if (!copiedShortcutValueId) return;
    const timeoutId = setTimeout(() => setCopiedShortcutValueId(null), COPY_SUCCESS_DURATION_MS);
    return () => clearTimeout(timeoutId);
  }, [copiedShortcutValueId]);

  const setListMode = useCallback((mode: WebListMode) => {
    setListModeState(mode);
    setSelectedCategory(null);
    setSearchProfileOverride(null);
  }, []);

  const handleSearchQueryChange = useCallback((query: string) => {
    setSearchQuery(query);
    if (query.trim() === '') setSearchProfileOverride(null);
  }, []);

  const handleShortcutSortChange = useCallback((sort: SnippetSortBy) => {
    setShortcutSort(sort);
    localStorage.setItem('@shortcut_sort_preference', sort);
  }, []);

  const ensureCanAddShortcut = useCallback(() => {
    if (canAddShortcut(ShortcutService.count())) return true;
    showErrorAlert(t('shortcut.limit_message', { limit: FREE_SHORTCUTS_LIMIT }));
    return false;
  }, [canAddShortcut, t]);

  const handleCreateShortcut = useCallback(() => {
    if (!isSubscriptionLoading && !ensureCanAddShortcut()) return;
    setEditingShortcut(null);
    setIsCreatingShortcut(true);
  }, [isSubscriptionLoading, ensureCanAddShortcut]);

  const handleEditShortcut = useCallback((shortcut: Shortcut) => {
    setIsCreatingShortcut(false);
    setEditingShortcut(ShortcutService.getById(shortcut.id) ?? shortcut);
  }, []);

  const handleCloseShortcutModal = useCallback(() => {
    setIsCreatingShortcut(false);
    setEditingShortcut(null);
  }, []);

  const handleSaveShortcut = useCallback((values: ShortcutFormValues) => {
    if (editingShortcut) {
      updateShortcut({ id: editingShortcut.id, ...values });
    } else {
      if (!ensureCanAddShortcut()) return;
      createShortcut(values);
    }
    handleCloseShortcutModal();
  }, [editingShortcut, updateShortcut, ensureCanAddShortcut, createShortcut, handleCloseShortcutModal]);

  const handleDeleteShortcut = useCallback((shortcut: Shortcut) => {
    showConfirmMessage(t('shortcut.delete_confirm', { name: shortcut.name }), () => {
      try {
        deleteShortcut(shortcut.id);
      } catch (error) {
        Logger.error('Failed to delete shortcut:', error);
        showErrorAlert(t('error.generic'));
      }
    });
  }, [deleteShortcut, t]);

  const handleCopyShortcutValue = useCallback(async (value: ShortcutValueWithDisplay) => {
    try {
      await copyShortcutValue(value, effectiveProfileId ?? undefined);
      setCopiedShortcutValueId(value.id);
    } catch (error) {
      Logger.error('Failed to copy shortcut value:', error);
      showErrorAlert(t('error.generic'));
    }
  }, [copyShortcutValue, effectiveProfileId, t]);

  /** スニペットを削除（確認ダイアログ付き） */
  const handleDeleteSnippet = useCallback(async (id: string) => {
    /*
     * ここは動的importのままにしている。静的importに変えるとReact Compilerが
     * このフックの解析へ進み、handleCopySnippet / handleCopySnippetTitle の
     * useCallback依存（activeProfile?.id）でlintエラーになるため
     */
    const { showConfirm } = await import('@utils/alerts');
    showConfirm('snippet.delete_confirm', async () => {
      try {
        await deleteSnippet(id);
      } catch (err) {
        Logger.error('Failed to delete:', err);
      }
    });
  }, [deleteSnippet]);

  /** プロファイル選択 */
  const handleSelectProfile = useCallback(async (profileId: string) => {
    if (profileId !== activeProfile?.id) {
      await setActiveProfile(profileId);
    }
    setShowProfileDropdown(false);
    setSearchProfileOverride(null);
  }, [activeProfile?.id, setActiveProfile]);

  /** カテゴリIDから色を取得 */
  const getCategoryColor = useCallback((categoryId: string | null): string | null => {
    if (!categoryId) return null;
    const category = getCategoryById(categoryId);
    return category?.color || null;
  }, [getCategoryById]);

  /** カテゴリIDから名前を取得 */
  const getCategoryName = useCallback((categoryId: string | null): string => {
    if (!categoryId) return t('category.uncategorized');
    const category = getCategoryById(categoryId);
    return category?.name || t('category.uncategorized');
  }, [getCategoryById, t]);

  /** アコーディオンの開閉をトグル */
  const handleToggleSnippet = useCallback((snippetId: string) => {
    setExpandedSnippetId((prev) => (prev === snippetId ? null : snippetId));
  }, []);

  /* ======================================== */
  /* 戻り値 */
  /* ======================================== */
  return {
    /* ローディング状態 */
    isLoaded,

    /* UI状態 */
    searchQuery,
    selectedCategory,
    copiedId,
    copiedTitleId,
    expandedSnippetId,
    showProfileDropdown,
    showSearchBar,
    gridColumns,

    /* モバイルメニュー */
    isMobileMenuOpen,

    /* 分離されたフック */
    snippetModal,
    exportScreen,
    importScreen,

    /* モーダル表示状態 */
    isModalOpen,

    /* ソート */
    currentSort: listMode === 'shortcut' ? shortcutSort : sortBy,
    handleSortChange: listMode === 'shortcut' ? handleShortcutSortChange : setSortBy,
    getSearchResultCount,

    /* データ */
    filteredSnippets,
    filteredShortcuts,
    categories,
    filterCategories: displayCategories,
    profiles,
    validProfiles,
    variables,
    profileVariables,
    activeProfile: activeProfile || null,
    activeProfileId,
    defaultProfileId,
    listMode,
    searchProfileId,
    copiedShortcutValueId,

    shortcutModal: {
      isOpen: isCreatingShortcut || editingShortcut !== null,
      shortcut: editingShortcut,
      handleCreate: handleCreateShortcut,
      handleEdit: handleEditShortcut,
      handleClose: handleCloseShortcutModal,
      handleSave: handleSaveShortcut,
    },

    /* UI設定ハンドラ */
    setSearchQuery: handleSearchQueryChange,
    setSelectedCategory,
    setShowSearchBar,
    setGridColumns,
    setShowProfileDropdown,
    setListMode,
    setSearchProfileId: setSearchProfileOverride,

    /* ハンドラ */
    handleCopySnippet,
    handleCopySnippetTitle,
    handleDeleteSnippet,
    handleSelectProfile,
    handleToggleSnippet,
    handleCopyShortcutValue,
    handleDeleteShortcut,
    handleToggleMobileMenu: toggleMobileMenu,
    handleCloseMobileMenu: closeMobileMenu,
    getCategoryColor,
    getCategoryName,
  };
}
