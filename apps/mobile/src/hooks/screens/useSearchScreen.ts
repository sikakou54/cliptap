/**
 * 検索画面のビジネスロジックフック
 *
 * 定型文またはショートカットの検索画面の全ての状態管理とロジックを提供。
 * UIコンポーネント（search.tsx）から完全に分離されたビジネスロジック層。
 *
 * 主な責務:
 * - 検索クエリの管理とデバウンス検索
 * - 有効な全プロファイルを横断した検索と、プロファイルごとの絞り込み・一致件数
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
 * @see packages/shared/src/utils/crossProfileSnippetSearch.ts - 定型文の横断検索と行のまとめ方
 */

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from '@cliptap/shared';
import {
  useCategories,
  useProfiles,
  useDebounce,
  searchSnippetsAcrossProfiles,
  useVariableExpansion,
  DEFAULT_DEBOUNCE_DELAY,
  useSnippets,
  useVariables,
  type Category,
  type CrossProfileShortcut,
  type CrossProfileSnippet,
  type Profile,
  type Shortcut,
  type ShortcutValue,
  type SnippetWithDisplay,
} from '@cliptap/shared';
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
 * 検索結果の定型文1行
 *
 * @remarks
 * 横断検索では同じ定型文がプロファイルごとの展開結果に分かれるため、行はプロファイルを持つ。
 */
export type SearchSnippetRow = CrossProfileSnippet;

/**
 * 検索結果のショートカット1行
 */
export type SearchShortcutRow = CrossProfileShortcut & {
  /** 値をコピーするときに展開の基準にするプロファイル */
  copyProfileId: string;
};

/**
 * 一覧から渡ってくる定型文
 *
 * @remarks
 * 横断検索の行はプロファイルを持つが、一覧コンポーネントは通常の一覧とも共用するため
 * 任意項目として受け取る。
 */
type SnippetRowArg = SnippetWithDisplay & { matchedProfileIds?: string[] };

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
  /** 絞り込んでいる環境（nullは「すべて」＝横断検索。既定はnull） */
  selectedProfileId: string | null;
  /** 絞り込む環境を選ぶ（nullを渡すと横断検索へ戻る） */
  setSelectedProfileId: (id: string | null) => void;

  /* データ */
  /** 検索結果の定型文（展開結果ごとの行） */
  displaySnippets: SearchSnippetRow[];
  /** 有効な環境（チップ行そのものを出すかの判定に使う） */
  validProfiles: Profile[];
  /** チップへ並べる環境（検索中は一致がある環境だけ） */
  filteredProfiles: Profile[];
  /** 検索結果のショートカット（ショートカット検索時のみ中身が入る） */
  displayShortcuts: SearchShortcutRow[];
  categories: Category[];

  /* 派生関数 */
  /** 指定したプロファイルの一致件数を返す（表示中の対象が定型文かショートカットかで数える対象が変わる） */
  getProfileResultCount: (profileId: string) => number;
  /** 横断した全体の一致件数（「すべて」チップに添える） */
  allResultCount: number;
  /** 検索語が入力されているか */
  hasSearchQuery: boolean;

  /* ハンドラ */
  handleRefresh: () => void;
  handleCopySnippet: (snippet: SnippetRowArg) => Promise<void>;
  handleCopySnippetTitle: (snippet: SnippetRowArg) => Promise<void>;
  handleEditSnippet: (snippet: SnippetWithDisplay) => void;
  handleDeleteSnippet: (snippet: SnippetWithDisplay) => void;
  handleCopyShortcutValue: (value: ShortcutValue, profileId: string | null) => Promise<void>;
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
  /* 選択肢にはvalidProfilesを使う。プラン上限で無効になった環境は切替先にできないため、チップにも出さない。 */
  const { validProfiles, profileVariables, defaultProfile } = useProfiles();
  const defaultProfileId = defaultProfile?.id;
  const { categories } = useCategories();
  const { variables } = useVariables();
  const { allSnippets, snippetProfiles, deleteSnippet, copySnippet, copySnippetTitle, refresh: refreshSnippets } = useSnippets();

  /* 検索語。絞り込みは展開後の文字列で行うため、DBの検索（SQL）は使わない（§8.7） */
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, DEFAULT_DEBOUNCE_DELAY);

  /* ======================================== */
  /* 状態管理 */
  /* ======================================== */
  /* チップで絞り込んでいる環境ID（null =「すべて」＝横断検索。既定はこちら） */
  const [profileOverride, setProfileOverride] = useState<string | null>(null);

  /* ======================================== */
  /* 派生状態 */
  /* ======================================== */

  /**
   * 絞り込んでいる環境ID
   *
   * 選択が現存する環境を指していなければ「すべて」（横断検索）へ戻す。
   * 環境を消した直後に死んだIDを指したままだと、一覧が空になり続けるためである。
   */
  const selectedProfileId = useMemo(() => {
    if (profileOverride && validProfiles.some((p: Profile) => p.id === profileOverride)) {
      return profileOverride;
    }
    return null;
  }, [profileOverride, validProfiles]);

  /**
   * 絞り込みに使う検索語
   *
   * @remarks
   * 検索欄を空にしたときだけデバウンスを待たず、即座に全件表示へ戻す（§8.7）。
   */
  const snippetQuery = query === '' ? '' : debouncedQuery;

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

  /* ショートカットの取得と横断検索、および操作。絞り込みと件数はこのフックで求める */
  const {
    allShortcutRows,
    handleRefreshShortcuts,
    handleCopyShortcutValue,
    handleEditShortcut,
    handleDeleteShortcut,
  } = useSearchShortcuts({
    enabled: isShowingShortcuts,
    query: shortcutQuery,
  });

  /* 件数を数えるときの変数展開。一覧の展開（useFilteredSnippets）と同じ値を使う */
  const { expandVariables } = useVariableExpansion({
    variables,
    profileVariables,
    locale: language,
  });

  /**
   * 有効な全プロファイルを横断した定型文の一致
   *
   * @remarks
   * 各プロファイルで変数を展開した文字列で照合し、展開結果ごとに行を作る（§8.7）。
   * 絞り込みと件数はすべてこの結果から求めるため、一覧とチップの数字が必ず一致する。
   */
  const allSnippetRows = useMemo(() => {
    /* ショートカットを検索している間は定型文を数えない（Webと同じ） */
    if (isShowingShortcuts) return [];
    return searchSnippetsAcrossProfiles({
      snippets: allSnippets,
      snippetProfiles,
      profiles: validProfiles,
      query: snippetQuery,
      expand: (text, profileId) => expandVariables(text, profileId, defaultProfileId ?? null),
    });
  }, [isShowingShortcuts, allSnippets, snippetProfiles, validProfiles, snippetQuery, expandVariables, defaultProfileId]);

  /* 表示中の対象（定型文かショートカット）の横断結果 */
  const allRows: readonly { matchedProfileIds: string[] }[] = isShowingShortcuts
    ? allShortcutRows
    : allSnippetRows;

  /**
   * 環境ごとの一致件数
   *
   * @remarks
   * 横断結果を数え直すのではなく、行が持つプロファイルから数える。
   * 「すべて」で見えている行と、その環境へ絞ったときに見える行が必ず一致する。
   */
  const resultCountByProfile = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of allRows) {
      for (const id of row.matchedProfileIds) {
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
    return counts;
  }, [allRows]);

  const getProfileResultCount = useCallback(
    (profileId: string): number => resultCountByProfile.get(profileId) ?? 0,
    [resultCountByProfile]
  );

  /**
   * 表示する環境リスト
   *
   * 検索時は一致がある環境だけを出す。入力前は候補をすべて出す。
   */
  const filteredProfiles = useMemo(() => {
    if (hasSearchQuery) {
      return validProfiles.filter((p: Profile) => getProfileResultCount(p.id) > 0);
    }
    return validProfiles;
  }, [validProfiles, hasSearchQuery, getProfileResultCount]);

  /* 画面に出す定型文。「すべて」なら横断結果そのまま、環境を選んでいればその環境の行だけ */
  const displaySnippets = useMemo<SearchSnippetRow[]>(
    () =>
      allSnippetRows.filter(
        (row) => selectedProfileId === null || row.matchedProfileIds.includes(selectedProfileId)
      ),
    [allSnippetRows, selectedProfileId]
  );

  /* 画面に出すショートカット。コピーの基準は行が持つプロファイルにする */
  const displayShortcuts = useMemo<SearchShortcutRow[]>(
    () =>
      allShortcutRows
        .filter((row) => selectedProfileId === null || row.matchedProfileIds.includes(selectedProfileId))
        .map((row) => ({ ...row, copyProfileId: row.matchedProfileIds[0] })),
    [allShortcutRows, selectedProfileId]
  );

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
    async (snippet: SnippetRowArg) => {
      try {
        /* 横断検索では行ごとに展開の基準プロファイルが違うため、行が持つプロファイルで展開する。
           1行にまとまっている環境は展開結果が同じため、先頭を基準にしてよい（§8.7） */
        await copySnippet(snippet.id, snippet.matchedProfileIds?.[0] ?? selectedProfileId ?? undefined);
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
    async (snippet: SnippetRowArg) => {
      try {
        await copySnippetTitle(snippet.id, snippet.matchedProfileIds?.[0] ?? selectedProfileId ?? undefined);
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
   *
   * @remarks
   * 検索画面を編集画面で置き換え、検索へは戻さない（Webと同じ・§8.7）。
   * 直した項目が検索語に合わなくなって一覧から消えると、作業の続きが見失われるためである。
   * pushではなくreplaceを使うのは、閉じると開くを2回に分けると順序が navigator 任せになるためである。
   */
  const handleEditSnippet = useCallback(
    (snippet: SnippetWithDisplay) => {
      router.replace({
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
    validProfiles,
    filteredProfiles,
    categories,

    /* 派生関数 */
    getProfileResultCount,
    allResultCount: allRows.length,
    hasSearchQuery,

    /* ハンドラ */
    handleRefresh,
    handleCopySnippet,
    handleCopySnippetTitle,
    handleEditSnippet,
    handleDeleteSnippet,
    handleCopyShortcutValue,
    handleEditShortcut,
    handleDeleteShortcut,
    handleClose,
  };
}
