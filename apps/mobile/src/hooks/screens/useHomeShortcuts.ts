/**
 * ホーム画面のショートカット表示のビジネスロジックフック
 *
 * ホーム画面で表示対象をショートカットへ切り替えたときの、一覧の取得と管理操作を提供。
 *
 * 主な責務:
 * - アクティブなプロファイルのショートカット一覧の取得（そのプロファイルに紐づくものと、全プロファイル向けのもの）
 * - 値の変数トークンを、アクティブなプロファイルで展開した表示用の文字列の付与
 * - カテゴリによる絞り込みと、絞り込みチップに出すカテゴリの算出
 * - 並べ替えとその設定の保持
 * - 新規作成・編集・削除処理
 *
 * 【プロファイルの切り替えを持たない理由】
 * ホームのヘッダーにあるProfileSelectorがアクティブなプロファイルそのものを切り替えるため、
 * ここでも同じ操作を持つと入口が2つになる。表示対象はアクティブなプロファイルを見て、
 * 新規作成でもアクティブなプロファイルが既定でチェックされるため、既定のまま保存すれば今の一覧に出る
 * （所属は作成画面で複数選べ、全部外すと全プロファイル向けになる）。
 *
 * 【フォーカス時の再読込を持たない理由】
 * 読み直しはuseHomeScreenが定型文・カテゴリ・プロファイルとまとめて行う。
 * ここにも置くと同じフォーカスで二重に走る。
 *
 * @see src/hooks/screens/useHomeScreen.ts - 表示対象の切り替えとフォーカス時の再読込
 * @see packages/shared/src/providers/ShortcutProvider.tsx - ショートカットCRUD操作（useShortcuts）
 */

import { useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';
import i18next from '@i18n/config';
import {
  attachDisplayValues,
  filterCategoriesInUse,
  sortShortcuts,
  useCategories,
  useProfiles,
  useSharedSubscription,
  useShortcuts,
  useTranslation,
  useVariableExpansion,
  useVariables,
  Logger,
  type Category,
  type Shortcut,
  type ShortcutValue,
  type ShortcutWithDisplay,
  type SnippetSortBy,
} from '@cliptap/shared';
import { showConfirm, showErrorAlert } from '@utils/alerts';
import { useItemLimitGuard } from '@hooks/useItemLimitGuard';
import { useShortcutSortPreference } from '@hooks/useShortcutSortPreference';

/**
 * useHomeShortcutsの引数の型
 */
interface UseHomeShortcutsParams {
  /** 適用中のカテゴリID（nullは「すべて」） */
  selectedCategoryId: string | null;
}

/**
 * useHomeShortcutsの戻り値の型
 */
export interface UseHomeShortcutsReturn {
  /* データ */
  /** カテゴリで絞り込み並べ替えた後のショートカット一覧（値はアクティブなプロファイルで展開した表示用の文字列を持つ） */
  shortcuts: ShortcutWithDisplay[];
  /** 絞り込みチップに出すカテゴリ（ショートカットが1件以上あるもの） */
  filteredCategories: Category[];

  /** 現在の並べ替え基準 */
  currentSort: SnippetSortBy;

  /* ハンドラ */
  /** 並べ替え基準を変更する */
  handleSortChange: (sortBy: SnippetSortBy) => void;
  /** 値をクリップボードへコピーする */
  handleCopyShortcutValue: (value: ShortcutValue) => Promise<void>;
  /** 一覧を再読み込みする */
  handleRefreshShortcuts: () => void;
  /** 新規作成画面を開く */
  handleCreateShortcut: () => void;
  /** 編集画面を開く */
  handleEditShortcut: (shortcut: Shortcut) => void;
  /** 確認のうえ削除する */
  handleDeleteShortcut: (shortcut: Shortcut) => void;
}

/**
 * ホーム画面のショートカット表示のビジネスロジックフック
 *
 * @param params - 適用中のカテゴリ
 * @returns 画面に必要な状態とハンドラ
 */
export function useHomeShortcuts(params: UseHomeShortcutsParams): UseHomeShortcutsReturn {
  const { selectedCategoryId } = params;

  const { t } = useTranslation();
  const router = useRouter();
  const { shortcuts: allShortcuts, activeProfileId, refresh, deleteShortcut, copyShortcutValue } = useShortcuts();
  const { categories } = useCategories();
  const { profileVariables, defaultProfile } = useProfiles();
  const { variables } = useVariables();
  const { isLoading: isSubscriptionLoading } = useSharedSubscription();
  const { ensureCanAddShortcut } = useItemLimitGuard();

  /* 値の変数トークンは定型文の一覧と同じ規則で展開する（言語の取得元も useHomeScreen と同じ） */
  const { expandVariables } = useVariableExpansion({
    variables,
    profileVariables,
    locale: i18next.language,
  });

  /* ======================================== */
  /* 状態管理 */
  /* ======================================== */

  /* 並べ替えは検索結果とも同じ設定に従うため、共通フックが保存と読み込みを持つ */
  const { currentSort, handleSortChange } = useShortcutSortPreference();

  /* ======================================== */
  /* 派生状態 */
  /* ======================================== */

  /* 絞り込みと並べ替えはメモリ上で行う。Providerがアクティブなプロファイル分しか保持せず
     件数も小さいため、条件付きのクエリを足すより取得経路を1本に保つほうが読みやすい。
     最後に、値をアクティブなプロファイルで展開した表示用の文字列を持たせる。
     保存値は編集画面の初期値とコピー時の展開に使うため置き換えない */
  const shortcuts = useMemo(() => {
    const filtered =
      selectedCategoryId === null
        ? allShortcuts
        : allShortcuts.filter((shortcut) => shortcut.categoryId === selectedCategoryId);
    const defaultProfileId = defaultProfile?.id ?? null;
    return attachDisplayValues(sortShortcuts(filtered, currentSort), (text) =>
      expandVariables(text, activeProfileId, defaultProfileId)
    );
  }, [allShortcuts, selectedCategoryId, currentSort, defaultProfile, expandVariables, activeProfileId]);

  /* チップは絞り込み前の全件から作る。絞り込み後から作ると、選んだカテゴリ以外のチップが
     消えてしまい、他のカテゴリへ移れなくなる */
  const filteredCategories = useMemo(
    () => filterCategoriesInUse(allShortcuts, categories),
    [allShortcuts, categories]
  );

  /* ======================================== */
  /* イベントハンドラ */
  /* ======================================== */

  /**
   * 並べ替え基準を変更する
   *
   * 保存に失敗しても画面の並びは変わるため、次回の起動で既定へ戻るだけに留める。
   */
  /**
   * ショートカット値をクリップボードへコピーする
   *
   * コピーと使用回数の加算はProviderが行う（定型文のコピーと同じ作り）。
   * 変数はProviderがコピーする時点で、アクティブなプロファイルを基準に展開する。
   * 振動フィードバックはクリップボードアダプター側で行う。
   */
  const handleCopyShortcutValue = useCallback(
    async (value: ShortcutValue) => {
      try {
        await copyShortcutValue(value);
      } catch (error) {
        Logger.error('[HomeShortcuts] Failed to copy the shortcut value:', error);
        showErrorAlert(t('error.generic'));
        /* 行側でコピー完了表示を出さないよう再スローする */
        throw error;
      }
    },
    [copyShortcutValue, t]
  );

  const handleCreateShortcut = useCallback(() => {
    /* 権利確認中は登録上限の判定を保留する（理由は useHomeScreen の定型文と同じ）。
       上限は作成画面の保存時に必ず判定する */
    if (!isSubscriptionLoading && !ensureCanAddShortcut()) {
      return;
    }
    router.push('/shortcut/edit');
  }, [isSubscriptionLoading, ensureCanAddShortcut, router]);

  const handleEditShortcut = useCallback(
    (shortcut: Shortcut) => {
      router.push({
        pathname: '/shortcut/edit',
        params: { id: shortcut.id },
      });
    },
    [router]
  );

  const handleDeleteShortcut = useCallback(
    (shortcut: Shortcut) => {
      /* 「ショートカット○○を削除しますか？」確認（値もまとめて削除される） */
      showConfirm(
        t('shortcut.delete_confirm', { name: shortcut.name }),
        () => {
          try {
            deleteShortcut(shortcut.id);
          } catch (error) {
            Logger.error('[HomeShortcuts] Failed to delete shortcut:', error);
          }
        },
        undefined,
        'danger'
      );
    },
    [deleteShortcut, t]
  );

  return {
    shortcuts,
    filteredCategories,
    currentSort,
    handleSortChange,
    handleCopyShortcutValue,
    handleRefreshShortcuts: refresh,
    handleCreateShortcut,
    handleEditShortcut,
    handleDeleteShortcut,
  };
}
