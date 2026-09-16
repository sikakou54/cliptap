/**
 * 定型文・ショートカットの登録上限ガードフック
 *
 * 無料プランの登録上限（定型文50件・ショートカット10件）に
 * 達しているかを判定し、達していればProプランへの案内ダイアログを出す。
 *
 * @remarks
 * 定型文とショートカットの件数は呼んだ時点でDBから数える。ホームやショートカットの一覧はアクティブな
 * プロファイルで絞り込まれており、その件数では他のプロファイルの分を取りこぼして上限をすり抜けるためである。
 * DB操作は同期のため、保存ボタンを二度押ししても2回目は増えた後の件数で判定される。
 *
 * このフックは常にその時点の権利状態（未確定はFree）で判定する。起動直後の権利確認中に
 * 判定を保留するかは呼出側が決める（追加ボタンだけが保留し、保存時は保留しない）。
 *
 * 上限以上ある既存データは無効化しない。新規登録の前にだけ使い、編集・削除・コピーには使わない。
 *
 * @see src/hooks/useUpgradePrompt.ts - 案内ダイアログとpaywall遷移
 * @see packages/shared/src/services/SubscriptionService.ts - 上限値と判定式
 */

import { useCallback } from 'react';
import {
  FREE_SHORTCUTS_LIMIT,
  FREE_SNIPPETS_LIMIT,
  Logger,
  ShortcutService,
  SnippetService,
  useSharedSubscription,
  useTranslation,
} from '@cliptap/shared';
import { useUpgradePrompt } from '@hooks/useUpgradePrompt';

/**
 * 保存済みの件数をDBから数える
 *
 * @param countItems - 件数を返す関数
 * @returns 件数。DBを開けず数えられなかった場合はnull
 * @remarks
 * 起動時にDBの初期化が失敗していると、件数の取得が例外になる。押下ハンドラから例外が抜けると
 * アプリが落ちるため、ここで捕まえて判定を見送り、登録処理側の既存のエラー表示に任せる。
 */
function countSavedItems(countItems: () => number): number | null {
  try {
    return countItems();
  } catch (error) {
    Logger.error('[ItemLimitGuard] Failed to count saved items:', error);
    return null;
  }
}

/**
 * useItemLimitGuardの戻り値の型
 */
export interface UseItemLimitGuardReturn {
  /** 定型文を1件追加できるか判定し、できなければ案内を出してfalseを返す */
  ensureCanAddSnippet: () => boolean;
  /** ショートカットを1件追加できるか判定し、できなければ案内を出してfalseを返す */
  ensureCanAddShortcut: () => boolean;
}

/**
 * 定型文・ショートカットの登録上限ガードフック
 *
 * @returns 登録前に呼ぶ判定関数
 */
export function useItemLimitGuard(): UseItemLimitGuardReturn {
  const { t } = useTranslation();
  const confirmUpgrade = useUpgradePrompt();
  const { canAddSnippet, canAddShortcut } = useSharedSubscription();

  const ensureCanAddSnippet = useCallback((): boolean => {
    const count = countSavedItems(() => SnippetService.count());
    if (count === null || canAddSnippet(count)) {
      return true;
    }
    confirmUpgrade(t('snippet.limit_message', { limit: FREE_SNIPPETS_LIMIT }));
    return false;
  }, [canAddSnippet, confirmUpgrade, t]);

  const ensureCanAddShortcut = useCallback((): boolean => {
    const count = countSavedItems(() => ShortcutService.count());
    if (count === null || canAddShortcut(count)) {
      return true;
    }
    confirmUpgrade(t('shortcut.limit_message', { limit: FREE_SHORTCUTS_LIMIT }));
    return false;
  }, [canAddShortcut, confirmUpgrade, t]);

  return { ensureCanAddSnippet, ensureCanAddShortcut };
}
