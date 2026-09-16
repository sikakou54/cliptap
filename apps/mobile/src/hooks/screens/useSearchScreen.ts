/**
 * 検索画面のビジネスロジックフック
 *
 * 定型文またはショートカットの検索画面の全ての状態管理とロジックを提供。
 * UIコンポーネント（search.tsx）から完全に分離されたビジネスロジック層。
 *
 * 主な責務:
 * - 検索クエリの管理とデバウンス検索
 * - プロファイル（環境）の一時切替と、プロファイルごとの一致件数（定型文・ショートカット共通）
 * - 検索結果の定型文操作（コピー・編集・削除）
 * - Pull-to-refresh処理
 *
 * ショートカットの取得・絞り込みと操作は useSearchShortcuts が持つ。
 *
 * 【検索対象をホームの表示対象に合わせる理由】
 * 検索はホームの一覧を絞り込む延長の操作なので、ホームで見ていたものと
 * 別のものが出てくると、何を探しているのか分からなくなる。
 * 表示対象はホームが持つ正本をルートパラメータで受け取る。
 *
 * @see app/search.tsx - UIコンポーネント
 * @see src/hooks/screens/useHomeScreen.ts - 表示対象の正本
 * @see src/hooks/screens/useSearchShortcuts.ts - ショートカット検索
 * @see packages/shared/src/hooks/useSearch.ts - 検索デバウンス処理
 */

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from '@cliptap/shared';
import {
  useCategories,
  useProfiles,
  useSearch,
  getSnippetCountByProfile,
  useSnippets,
  useVariables,
  useFilteredSnippets,
  type Category,
  type Shortcut,
 
  type ShortcutWithDisplay,
  type SnippetWithDisplay,
  type Profile,
} from '@cliptap/shared';
import { Logger } from '@cliptap/shared';
import { showErrorAlert } from '@utils/alerts';
import { useSearchShortcuts } from '@hooks/screens/useSearchShortcuts';

/**
 * useSearchScreenの引数の型
 */
interface UseSearchScreenParams {
  /** ショートカットを検索対象にするならtrue（ホームの表示対象に従う） */
  isShowingShortcuts: boolean;
}

/**
 * useSearchScreenの戻り値の型
 */
export interface UseSearchScreenReturn {
  /* 検索状態 */
  query: string;
  setQuery: (query: string) => void;
  /** ショートカットを検索中か */
  isShowingShortcuts: boolean;

  /* フィルター状態 */
  selectedProfileId: string | null;
  /** 環境を明示選択する（nullを渡すとアクティブ環境への追従に戻る） */
  setSelectedProfileId: (id: string | null) => void;

  /* データ */
  displaySnippets: SnippetWithDisplay[];
  /** 選択中のプロファイルで検索語に一致したショートカット（ショートカット検索時のみ中身が入る。値は展開済みの表示用の文字列を持つ） */
  displayShortcuts: ShortcutWithDisplay[];
  profiles: Profile[];
  filteredProfiles: Profile[];
  categories: Category[];

  /* 派生関数 */
  /** 指定したプロファイルの一致件数を返す（表示中の対象が定型文かショートカットかで数える対象が変わる） */
  getProfileResultCount: (profileId: string) => number;
  hasSearchQuery: boolean;

  /* ハンドラ */
  handleRefresh: () => void;
  handleCopySnippet: (snippet: SnippetWithDisplay) => Promise<void>;
  handleCopySnippetTitle: (snippet: SnippetWithDisplay) => Promise<void>;
  handleEditSnippet: (snippet: SnippetWithDisplay) => void;
  handleDeleteSnippet: (snippet: SnippetWithDisplay) => void;
  handleCopyShortcut: (shortcut: Shortcut) => Promise<void>;
  handleEditShortcut: (shortcut: Shortcut) => void;
  handleDeleteShortcut: (shortcut: Shortcut) => void;
  handleClose: () => void;
}

/**
 * 検索画面のビジネスロジックフック
 *
 * @param params - 検索対象（ホームの表示対象）
 * @returns 画面に必要な全ての状態とハンドラ
 */
export function useSearchScreen(params: UseSearchScreenParams): UseSearchScreenReturn {
  const { isShowingShortcuts } = params;
  const { t, language } = useTranslation();
  const router = useRouter();

  /* ======================================== */
  /* データ取得 */
  /* ======================================== */
  /* 選択肢にはvalidProfilesを使う。profilesは無効なものも含む一覧として画面へそのまま返すためだけに受け取る（返却値の profiles）。 */
  const { profiles, validProfiles, profileVariables, activeProfile, defaultProfile } = useProfiles();
  const defaultProfileId = defaultProfile?.id;
  const { categories } = useCategories();
  const { variables } = useVariables();
  const { allSnippets, snippetProfiles, deleteSnippet, copySnippet, copySnippetTitle, refresh: refreshSnippets } = useSnippets();

  /* onErrorコールバックをメモ化（無限ループ防止） */
  const handleSearchError = useCallback((msg: string, err: unknown) => {
    Logger.error(msg, err);
  }, []);

  const { query, setQuery, debouncedQuery, results } = useSearch({
    onError: handleSearchError,
  });

  /* ======================================== */
  /* 状態管理 */
  /* ======================================== */
  /* ユーザーがチップで明示選択した環境ID（null = アクティブ環境に追従） */
  const [profileOverride, setProfileOverride] = useState<string | null>(null);

  /* ======================================== */
  /* 派生状態 */
  /* ======================================== */

  /**
   * フィルタに適用する環境ID
   *
   * 明示選択が現存する環境を指していればそれを使い、そうでなければアクティブ環境に追従する。
   * effectで書き潰さないため、Provider読込前に画面へ入っても1レンダ分の空表示が発生しない。
   */
  const selectedProfileId = useMemo(() => {
    if (profileOverride && validProfiles.some((p: Profile) => p.id === profileOverride)) {
      return profileOverride;
    }
    return activeProfile?.id ?? null;
  }, [profileOverride, validProfiles, activeProfile?.id]);

  /**
   * 検索ベースの定型文リスト（検索クエリがある場合は検索結果、ない場合は全スニペット）
   */
  const baseSnippets = useMemo(() => {
    return query.trim() ? results : allSnippets;
  }, [query, results, allSnippets]);

  /**
   * 検索クエリがあるかどうか
   */
  const hasSearchQuery = useMemo(() => query.trim().length > 0, [query]);

  /**
   * ショートカットの絞り込みに使う検索語
   *
   * 入力中は定型文検索と同じデバウンス値を使い、キー入力ごとに全件を評価しない。
   * 検索欄を空にしたときだけデバウンスを待たず、即座に全件表示へ戻す（§8.7）。
   * 生の query を絞り込みの依存に入れるとキー入力ごとに再評価されるため、ここで確定させる。
   */
  const shortcutQuery = query === '' ? '' : debouncedQuery;

  /* ショートカットの取得・絞り込みと操作。表示するプロファイルは定型文と同じ選択に従う */
  const {
    displayShortcuts,
    getProfileShortcutCount,
    handleRefreshShortcuts,
    handleCopyShortcut,
    handleEditShortcut,
    handleDeleteShortcut,
  } = useSearchShortcuts({
    enabled: isShowingShortcuts,
    query: shortcutQuery,
    selectedProfileId,
  });

  /**
   * 各環境の定型文件数を計算
   */
  const getProfileSnippetCountFn = useCallback(
    (profileId: string): number => getSnippetCountByProfile(baseSnippets, snippetProfiles, profileId),
    [baseSnippets, snippetProfiles]
  );

  /* チップの件数と絞り込みは、表示中の対象（定型文かショートカット）で数える */
  const getProfileResultCount = isShowingShortcuts ? getProfileShortcutCount : getProfileSnippetCountFn;

  /**
   * 表示する環境リスト
   * 検索時は検索結果を持つ環境のみフィルタリング
   */
  const filteredProfiles = useMemo(() => {
    if (hasSearchQuery) {
      return validProfiles.filter((p: Profile) => getProfileResultCount(p.id) > 0);
    }
    return validProfiles;
  }, [validProfiles, hasSearchQuery, getProfileResultCount]);

  /**
   * 画面表示用の定型文リスト（プロファイルフィルタリング適用、変数展開済み）
   */
  const { filteredSnippets: displaySnippets } = useFilteredSnippets({
    snippets: baseSnippets,
    snippetProfiles,
    searchQuery: '', /* 検索はbaseSnippetsで既にフィルタ済み */
    selectedCategory: null, /* カテゴリフィルタなし */
    activeProfileId: selectedProfileId ?? null,
    defaultProfileId: defaultProfileId ?? null,
    variables,
    profileVariables,
    locale: language,
  });

  /* ======================================== */
  /* イベントハンドラ */
  /* ======================================== */

  /**
   * Pull-to-refresh処理
   */
  const handleRefresh = useCallback(() => {
    if (isShowingShortcuts) {
      handleRefreshShortcuts();
      return;
    }
    refreshSnippets();
  }, [isShowingShortcuts, handleRefreshShortcuts, refreshSnippets]);

  /**
   * 定型文コピー
   * 一覧と同じ共通コピー経路を使用する
   */
  const handleCopySnippet = useCallback(
    async (snippet: SnippetWithDisplay) => {
      try {
        await copySnippet(snippet.id, selectedProfileId || undefined);
      } catch {
        showErrorAlert(t('error.generic'));
      }
    },
    [copySnippet, selectedProfileId, t]
  );

  /**
   * タイトルのみコピー
   * 一覧のタイトルタップ時に、件名と本文を別々に貼り付けられるようにする
   */
  const handleCopySnippetTitle = useCallback(
    async (snippet: SnippetWithDisplay) => {
      try {
        await copySnippetTitle(snippet.id, selectedProfileId || undefined);
      } catch (error) {
        showErrorAlert(t('error.generic'));
        /* カード側でコピー成功表示を出さないよう再スローする */
        throw error;
      }
    },
    [copySnippetTitle, selectedProfileId, t]
  );

  /**
   * 定型文編集画面へ遷移
   */
  const handleEditSnippet = useCallback(
    (snippet: SnippetWithDisplay) => {
      router.push({
        pathname: '/snippet/edit',
        params: { id: snippet.id },
      });
    },
    [router]
  );

  /**
   * 定型文削除
   */
  const handleDeleteSnippet = useCallback(
    (snippet: SnippetWithDisplay) => {
      try {
        deleteSnippet(snippet.id);
      } catch {
        showErrorAlert(t('error.generic'));
      }
    },
    [deleteSnippet, t]
  );

  /**
   * 検索画面を閉じる
   */
  const handleClose = useCallback(() => {
    router.back();
  }, [router]);

  /* ======================================== */
  /* 戻り値 */
  /* ======================================== */
  return {
    /* 検索状態 */
    query,
    setQuery,
    isShowingShortcuts,

    /* フィルター状態 */
    selectedProfileId,
    setSelectedProfileId: setProfileOverride,

    /* データ */
    displaySnippets,
    displayShortcuts,
    profiles,
    filteredProfiles,
    categories,

    /* 派生関数 */
    getProfileResultCount,
    hasSearchQuery,

    /* ハンドラ */
    handleRefresh,
    handleCopySnippet,
    handleCopySnippetTitle,
    handleEditSnippet,
    handleDeleteSnippet,
    handleCopyShortcut,
    handleEditShortcut,
    handleDeleteShortcut,
    handleClose,
  };
}
