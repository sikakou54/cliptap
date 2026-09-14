/**
 * ホーム画面のショートカット表示のビジネスロジックフック
 *
 * ホーム画面で表示対象をショートカットへ切り替えたときの、一覧の取得と管理操作を提供。
 *
 * 主な責務:
 * - アクティブなプロファイルのショートカット一覧の取得（そのプロファイルに紐づくものと、全プロファイル向けのもの）
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

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  filterCategoriesInUse,
  sortShortcuts,
  useCategories,
  useSharedSubscription,
  useShortcuts,
  useTranslation,
  Logger,
  type Category,
  type Shortcut,
  type ShortcutValue,
  type SnippetSortBy,
} from '@cliptap/shared';
import { showConfirm, showErrorAlert } from '@utils/alerts';
import { useItemLimitGuard } from '@hooks/useItemLimitGuard';

/**
 * 並べ替え設定の保存キー
 *
 * @remarks
 * 定型文の並べ替えはSortPreferenceAdapter経由で保存しているが、あれはWebとも共有する仕組みで、
 * ショートカットはモバイルだけの機能。共有インターフェースへショートカット用の口を足すと
 * Webに使われないメソッドが増えるため、ここで直接保存する
 * （モバイル固有の保存をAsyncStorageへ直接行う例は src/utils/devAdsOverride.ts にもある）。
 */
const SORT_PREFERENCE_KEY = '@shortcut_sort_preference';

/** 並べ替えの既定値（定型文と同じ） */
const DEFAULT_SORT: SnippetSortBy = 'created';

/** 保存値として受け付ける並べ替え基準 */
const SORT_VALUES: readonly SnippetSortBy[] = ['created', 'updated', 'title', 'usage'];

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
  /** カテゴリで絞り込んだ後のショートカット一覧（sortOrder順） */
  shortcuts: Shortcut[];
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
  const { shortcuts: allShortcuts, refresh, deleteShortcut, copyShortcutValue } = useShortcuts();
  const { categories } = useCategories();
  const { isLoading: isSubscriptionLoading } = useSharedSubscription();
  const { ensureCanAddShortcut } = useItemLimitGuard();

  /* ======================================== */
  /* 状態管理 */
  /* ======================================== */

  const [currentSort, setCurrentSort] = useState<SnippetSortBy>(DEFAULT_SORT);

  /* 保存した並べ替え基準を1回だけ読み込む。読めない場合は既定のままにする */
  useEffect(() => {
    let isActive = true;

    void (async () => {
      try {
        const saved = await AsyncStorage.getItem(SORT_PREFERENCE_KEY);
        if (!isActive) return;
        if (saved !== null && SORT_VALUES.includes(saved as SnippetSortBy)) {
          setCurrentSort(saved as SnippetSortBy);
        }
      } catch (error) {
        Logger.error('[HomeShortcuts] Failed to load the sort preference:', error);
      }
    })();

    /* 読み込み中に画面を離れた場合、戻ってきたときの選択を上書きしない */
    return () => {
      isActive = false;
    };
  }, []);

  /* ======================================== */
  /* 派生状態 */
  /* ======================================== */

  /* 絞り込みと並べ替えはメモリ上で行う。Providerがアクティブなプロファイル分しか保持せず
     件数も小さいため、条件付きのクエリを足すより取得経路を1本に保つほうが読みやすい */
  const shortcuts = useMemo(() => {
    const filtered =
      selectedCategoryId === null
        ? allShortcuts
        : allShortcuts.filter((shortcut) => shortcut.categoryId === selectedCategoryId);
    return sortShortcuts(filtered, currentSort);
  }, [allShortcuts, selectedCategoryId, currentSort]);

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
  const handleSortChange = useCallback((sortBy: SnippetSortBy) => {
    setCurrentSort(sortBy);

    void AsyncStorage.setItem(SORT_PREFERENCE_KEY, sortBy).catch((error) => {
      Logger.error('[HomeShortcuts] Failed to save the sort preference:', error);
    });
  }, []);

  /**
   * ショートカット値をクリップボードへコピーする
   *
   * コピーと使用回数の加算はProviderが行う（定型文のコピーと同じ作り）。
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
