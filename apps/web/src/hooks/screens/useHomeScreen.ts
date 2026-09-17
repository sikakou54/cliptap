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
  searchSnippetsAcrossProfiles,
  searchShortcutsAcrossProfiles,
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
import { useSideMenu } from '@hooks/useSideMenu';
import { useSnippetModal } from '@hooks/screens/useSnippetModal';
import { useExportScreen } from '@hooks/screens/useExportScreen';
import { useImportScreen } from '@hooks/screens/useImportScreen';
import type { ShortcutFormValues } from '@components/shortcut/ShortcutEditModal';
import type { WebListMode } from '@components/dashboard/ListModeToggle';
import type { SnippetGridItem } from '@components/dashboard/SnippetGrid';
import type { ShortcutGridItem } from '@components/shortcut/ShortcutGrid';
import { showConfirmMessage, showErrorAlert } from '@utils/alerts';

/** コピー完了表示を出しておく時間（ミリ秒） */
const COPY_SUCCESS_DURATION_MS = 2000;

/**
 * コピー対象として渡ってくる定型文
 *
 * @remarks
 * 横断検索の行はプロファイルと行のキーを持つが、ダッシュボードの一覧は持たないため任意項目にする。
 */
type SnippetCopyTarget = Snippet & {
  /** 行を一意にする値（横断検索のときだけ入る） */
  rowKey?: string;
  /** この展開結果になったプロファイル（横断検索のときだけ入る） */
  matchedProfileIds?: string[];
};

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
  isSearchOpen: boolean;
  /** 検索画面で選んでいるプロファイル（チップの選択） */
  searchProfileId: string | null;
  gridColumns: 1 | 2 | 3;
  listMode: WebListMode;
  copiedShortcutValueId: string | null;

  /* モバイルメニュー */
  isSideMenuOpen: boolean;
  isSideMenuOverlay: boolean;

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
  /** 検索画面に出す定型文（展開結果ごとの行） */
  searchSnippetRows: SnippetGridItem[];
  /** 検索画面に出すショートカット（展開結果ごとの行） */
  searchShortcutRows: ShortcutGridItem[];
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

  /* UI設定ハンドラ */
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (categoryId: string | null) => void;
  /** 検索画面で絞り込む環境を選び直す（nullを渡すと横断検索へ戻る） */
  setSearchProfileId: (profileId: string | null) => void;
  /** プロファイルごとの一致件数 */
  getSearchResultCount: (profileId: string) => number;
  /** 横断した全体の一致件数（「すべて」チップに添える） */
  allSearchResultCount: number;
  openSearch: () => void;
  closeSearch: () => void;
  setGridColumns: (columns: 1 | 2 | 3) => void;
  setShowProfileDropdown: (show: boolean) => void;
  setListMode: (mode: WebListMode) => void;

  /* ハンドラ */
  handleCopySnippet: (snippet: SnippetCopyTarget) => Promise<void>;
  handleCopySnippetTitle: (snippet: SnippetCopyTarget) => Promise<void>;
  handleDeleteSnippet: (id: string) => Promise<void>;
  handleSelectProfile: (profileId: string) => Promise<void>;
  handleToggleSnippet: (snippetId: string) => void;
  handleCopyShortcutValue: (value: ShortcutValueWithDisplay, profileId: string | null) => Promise<void>;
  handleDeleteShortcut: (shortcut: Shortcut) => void;
  handleToggleSideMenu: () => void;
  handleCloseSideMenu: () => void;
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
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  /* 検索画面のチップで選んだプロファイル（null = アクティブなプロファイルに従う） */
  const [searchProfileOverride, setSearchProfileOverride] = useState<string | null>(null);
  const [listMode, setListModeState] = useState<WebListMode>('snippet');
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
  const {
    isOpen: isSideMenuOpen,
    isOverlay: isSideMenuOverlay,
    toggle: toggleSideMenu,
    close: closeSideMenu,
  } = useSideMenu();

  /* モーダル表示時に背景スクロールを無効化 */
  const isModalOpen = exportScreen.showExportModal ||
    snippetModal.isCreating ||
    !!snippetModal.editingSnippet ||
    isCreatingShortcut ||
    !!editingShortcut ||
    importScreen.showFileModal;
  /* サイドメニューは本文へ覆いかぶさるときだけ背景を止める。
     押し出して並べているときに止めると、一覧をスクロールできなくなる */
  useBodyScrollLock(isModalOpen || (isSideMenuOverlay && isSideMenuOpen));

  /* ======================================== */
  /* 派生状態 */
  /* ======================================== */

  /* プロファイル情報 */
  const activeProfileId = activeProfile?.id || null;

  /**
   * ダッシュボードの一覧・変数展開・コピーの基準にするプロファイル
   *
   * @remarks
   * 検索画面は有効な全プロファイルを横断するため、この値を使わない（§8.7）。
   * 横断結果の各行は自分の基準プロファイルを持ち、コピーもその行の基準で展開する。
   */
  const effectiveProfileId = activeProfileId;
  const defaultProfileId = defaultProfile?.id || null;

  /**
   * 検索画面で絞り込んでいるプロファイル
   *
   * @remarks
   * nullは「すべて」＝横断検索で、これが既定になる。
   * 選択が現存するプロファイルを指しているかも確かめる。プロファイルを消した直後に
   * 死んだIDを指したままだと、一致が無い空の一覧になり続けるためである。
   */
  const searchProfileId =
    isSearchOpen && searchProfileOverride && validProfiles.some((profile) => profile.id === searchProfileOverride)
      ? searchProfileOverride
      : null;

  /**
   * 選んでいるカテゴリに合うかを判定する
   *
   * @param categoryId - 判定する項目のカテゴリID（未分類はnull）
   * @returns 合うならtrue（カテゴリ未選択・検索中は常にtrue）
   *
   * @remarks
   * 検索画面を開いている間はカテゴリで絞り込まない（§8.7）。モバイルの検索画面はカテゴリを持たず、
   * プロファイルの一時切替だけで探す作りのため、Webの検索範囲もそれに揃える。
   * 検索語の有無ではなく画面が開いているかで判定するのは、検索画面は入力前も
   * 選択中プロファイルの全件を出すためである。
   */
  const matchesSelectedCategory = useCallback(
    (categoryId: string | null) => {
      if (isSearchOpen || selectedCategory === null) return true;
      if (selectedCategory === 'uncategorized') return categoryId === null;
      return categoryId === selectedCategory;
    },
    [isSearchOpen, selectedCategory]
  );
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
    selectedCategory: isSearchOpen ? null : selectedCategory,
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

  /* 表示するショートカット。検索画面でチップを選んでいる間は、そのプロファイルのものを読む */
  const shortcutSource = useMemo(() => {
    if (!effectiveProfileId) return [];
    if (effectiveProfileId === activeProfileId) return activeShortcuts;
    return ShortcutService.getByProfileId(effectiveProfileId);
  }, [effectiveProfileId, activeProfileId, activeShortcuts]);

  const filteredShortcuts = useMemo(() => {
    const displayed = attachDisplayValues(shortcutSource, (text) =>
      expandVariables(text, effectiveProfileId, defaultProfileId)
    );
    const categoryFiltered = displayed.filter((shortcut) => matchesSelectedCategory(shortcut.categoryId));
    return sortShortcuts(searchShortcuts(categoryFiltered, searchQuery === '' ? '' : debouncedSearchQuery), shortcutSort);
  }, [shortcutSource, expandVariables, effectiveProfileId, defaultProfileId, matchesSelectedCategory, searchQuery, debouncedSearchQuery, shortcutSort]);

  const shortcutCategories = useMemo(
    () => filterCategoriesInUse(shortcutSource, categories),
    [shortcutSource, categories]
  );
  const snippetCategories = useMemo(
    () => filterCategoriesInUse(snippetsBeforeCategoryFilter, categories),
    [snippetsBeforeCategoryFilter, categories]
  );
  const displayCategories = listMode === 'shortcut' ? shortcutCategories : snippetCategories;

  /* 検索に使う検索語。空にしたときだけデバウンスを待たず全件へ戻す */
  const searchTerm = searchQuery === '' ? '' : debouncedSearchQuery;

  /**
   * 検索画面で読むプロファイルごとのショートカット
   *
   * @remarks
   * 検索画面を開いている間だけ読む。閉じている間も読むと、カテゴリを押すたびに
   * 非アクティブなプロファイルのショートカットをDBから読み直すことになる。
   */
  const searchShortcutsByProfile = useMemo(() => {
    const byProfile = new Map<string, Shortcut[]>();
    if (!isSearchOpen || listMode !== 'shortcut') return byProfile;
    validProfiles.forEach((profile) => {
      byProfile.set(
        profile.id,
        profile.id === activeProfileId ? activeShortcuts : ShortcutService.getByProfileId(profile.id)
      );
    });
    return byProfile;
  }, [isSearchOpen, listMode, validProfiles, activeProfileId, activeShortcuts]);

  /**
   * 有効な全プロファイルを横断した定型文の一致
   *
   * @remarks
   * 各プロファイルで変数を展開した文字列で照合し、展開結果ごとに行を作る（§8.7）。
   * 一覧も件数もこの結果から求めるため、チップの数字と一覧の行数が必ず一致する。
   */
  const allSearchSnippetRows = useMemo(() => {
    if (!isSearchOpen || listMode !== 'snippet') return [];
    return searchSnippetsAcrossProfiles({
      snippets: allSnippets,
      snippetProfiles,
      profiles: validProfiles,
      query: searchTerm,
      expand: (text, profileId) => expandVariables(text, profileId, defaultProfileId),
    });
  }, [isSearchOpen, listMode, allSnippets, snippetProfiles, validProfiles, searchTerm, expandVariables, defaultProfileId]);

  /** 有効な全プロファイルを横断したショートカットの一致 */
  const allSearchShortcutRows = useMemo(() => {
    if (!isSearchOpen || listMode !== 'shortcut') return [];
    return searchShortcutsAcrossProfiles({
      shortcutsByProfile: searchShortcutsByProfile,
      profiles: validProfiles,
      query: searchTerm,
      expand: (text, profileId) => expandVariables(text, profileId, defaultProfileId),
    });
  }, [isSearchOpen, listMode, searchShortcutsByProfile, validProfiles, searchTerm, expandVariables, defaultProfileId]);

  /* 表示中の対象（定型文かショートカット）の横断結果 */
  const allSearchRows: readonly { matchedProfileIds: string[] }[] =
    listMode === 'shortcut' ? allSearchShortcutRows : allSearchSnippetRows;

  /**
   * プロファイルごとの一致件数
   *
   * @remarks
   * 横断結果を数え直すのではなく、行が持つプロファイルから数える。
   * 「すべて」で見えている行と、その環境へ絞ったときに見える行が必ず一致する。
   */
  const searchResultCounts = useMemo(() => {
    const counts = new Map<string, number>();
    allSearchRows.forEach((row) => {
      row.matchedProfileIds.forEach((profileId) => {
        counts.set(profileId, (counts.get(profileId) ?? 0) + 1);
      });
    });
    return counts;
  }, [allSearchRows]);

  const getSearchResultCount = useCallback(
    (profileId: string) => searchResultCounts.get(profileId) ?? 0,
    [searchResultCounts]
  );

  /* 環境名の引き当て。行に添えるプロファイル名を作るために使う */
  const profileNameById = useMemo(
    () => new Map(validProfiles.map((profile) => [profile.id, profile.name])),
    [validProfiles]
  );

  /**
   * 行に添えるプロファイル名を作る
   *
   * @param matchedProfileIds - その行の展開結果になったプロファイル
   * @returns 添える文言。1つの環境へ絞っている間と、環境が1つしかないときはnull
   *
   * @remarks
   * 絞り込み中はチップが環境を示しているため、行にも出すと同じ情報が二重になる。
   */
  const buildProfileLabel = useCallback(
    (matchedProfileIds: string[]): string | null => {
      if (searchProfileId !== null || validProfiles.length <= 1) return null;
      const names = matchedProfileIds
        .map((profileId) => profileNameById.get(profileId))
        .filter((name): name is string => Boolean(name));
      return names.length > 0 ? names.join(' / ') : null;
    },
    [searchProfileId, validProfiles.length, profileNameById]
  );

  /* 検索画面に出す定型文。「すべて」なら横断結果そのまま、環境を選んでいればその環境の行だけ */
  const searchSnippetRows = useMemo<SnippetGridItem[]>(
    () =>
      allSearchSnippetRows
        .filter((row) => searchProfileId === null || row.matchedProfileIds.includes(searchProfileId))
        .map((row) => ({ ...row, profileLabel: buildProfileLabel(row.matchedProfileIds) })),
    [allSearchSnippetRows, searchProfileId, buildProfileLabel]
  );

  /* 検索画面に出すショートカット。コピーの基準は行が持つプロファイルにする。
     Webは検索結果にも選択中の並べ替えをそのまま適用する（§8.7。モバイルは表示順を保つ） */
  const searchShortcutRows = useMemo<ShortcutGridItem[]>(
    () =>
      sortShortcuts(
        allSearchShortcutRows
          .filter((row) => searchProfileId === null || row.matchedProfileIds.includes(searchProfileId))
          .map((row) => ({
            ...row,
            profileLabel: buildProfileLabel(row.matchedProfileIds),
            copyProfileId: row.matchedProfileIds[0],
          })),
        shortcutSort
      ),
    [allSearchShortcutRows, searchProfileId, buildProfileLabel, shortcutSort]
  );

  /* ======================================== */
  /* ハンドラ */
  /* ======================================== */

  /** スニペットをクリップボードにコピー */
  const handleCopySnippet = useCallback(async (snippet: SnippetCopyTarget) => {
    try {
      /* 横断検索では行ごとに展開の基準プロファイルが違うため、行が持つプロファイルで展開する。
         1行にまとまっている環境は展開結果が同じため、先頭を基準にしてよい（§8.7） */
      await copySnippet(snippet.id, snippet.matchedProfileIds?.[0] ?? effectiveProfileId ?? undefined);
      setCopiedId(snippet.rowKey ?? snippet.id);
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
  const handleCopySnippetTitle = useCallback(async (snippet: SnippetCopyTarget) => {
    try {
      await copySnippetTitle(snippet.id, snippet.matchedProfileIds?.[0] ?? effectiveProfileId ?? undefined);
      setCopiedTitleId(snippet.rowKey ?? snippet.id);
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

  /** 検索画面を開く */
  const openSearch = useCallback(() => setIsSearchOpen(true), []);

  /**
   * 検索画面を閉じる
   *
   * @remarks
   * 検索語とプロファイルの一時選択を同時に捨て、ダッシュボードをアクティブなプロファイルの
   * 表示へ戻す。3つを別々に更新すると、閉じた直後の1フレームだけ
   * 「ダッシュボードなのに他プロファイルの一覧」が見えてしまう。
   * 検索語を残したまま閉じると、一覧は絞り込まれたままなのに何で絞り込まれているのかが
   * 画面から読み取れなくなるため、ここで消す。
   */
  const closeSearch = useCallback(() => {
    setIsSearchOpen(false);
    setSearchQuery('');
    setSearchProfileOverride(null);
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

  const handleCopyShortcutValue = useCallback(async (value: ShortcutValueWithDisplay, profileId: string | null) => {
    try {
      await copyShortcutValue(value, profileId ?? effectiveProfileId ?? undefined);
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
    isSearchOpen,
    searchProfileId,
    getSearchResultCount,
    allSearchResultCount: allSearchRows.length,
    gridColumns,

    /* モバイルメニュー */
    isSideMenuOpen,
    isSideMenuOverlay,

    /* 分離されたフック */
    snippetModal,
    exportScreen,
    importScreen,

    /* モーダル表示状態 */
    isModalOpen,

    /* ソート */
    currentSort: listMode === 'shortcut' ? shortcutSort : sortBy,
    handleSortChange: listMode === 'shortcut' ? handleShortcutSortChange : setSortBy,

    /* データ */
    filteredSnippets,
    filteredShortcuts,
    searchSnippetRows,
    searchShortcutRows,
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
    setSearchQuery,
    setSelectedCategory,
    setSearchProfileId: setSearchProfileOverride,
    openSearch,
    closeSearch,
    setGridColumns,
    setShowProfileDropdown,
    setListMode,

    /* ハンドラ */
    handleCopySnippet,
    handleCopySnippetTitle,
    handleDeleteSnippet,
    handleSelectProfile,
    handleToggleSnippet,
    handleCopyShortcutValue,
    handleDeleteShortcut,
    handleToggleSideMenu: toggleSideMenu,
    handleCloseSideMenu: closeSideMenu,
    getCategoryColor,
    getCategoryName,
  };
}
