/**
 * サブスクリプションサービス操作用カスタムフック
 *
 * @module useSubscriptionService
 * @description
 * SubscriptionService経由でサブスクリプションの状態確認、購入、復元、プラン一覧取得などの機能を提供する。
 * Provider版のuseSubscription（SubscriptionContextValue）とは異なり、Service層に直接アクセスする。
 *
 * 公開範囲の違い:
 * - Provider版（providers/SubscriptionProvider.tsx の useSubscription）が公開するのは
 *   isSubscribed / isLoading / verificationFailed / shouldShowAds / canAddCustomVariable /
 *   canAddProfile / canAddSnippet / canAddShortcut / canAddShortcutValue / refresh /
 *   setDevSubscriptionOverride のみ。
 *   購入・復元・プラン一覧・SubscriptionStatus（プラン種別・有効期限）は公開しない。
 * - このフックは status（SubscriptionStatus）・getPlans・purchase（planId指定）・restore を公開する。
 *   一方で広告表示や追加可否の判定（shouldShowAds / canAddCustomVariable / canAddProfile /
 *   canAddSnippet / canAddShortcut / canAddShortcutValue）は持たない。
 *
 * 使い分け:
 * - 加入状態と機能制限（広告表示・変数/プロファイル/定型文/ショートカット/ショートカットの値の追加可否）の参照は
 *   Provider版の useSubscription を使う。
 * - プラン一覧の取得・planId指定の購入・復元・プラン種別/有効期限の表示が必要な画面
 *   （ペイウォール／サブスク管理）はこのフックを使う。
 */

import { useState, useEffect, useCallback } from 'react';
import { SubscriptionService } from '../services/SubscriptionService';
import type { SubscriptionPlan, SubscriptionStatus, PurchaseResult } from '../types/Subscription';
import { Logger } from '../utils/logger';

export interface UseSubscriptionServiceResult {
  /** サブスクリプション状態 */
  isSubscribed: boolean;
  /** ローディング中かどうか */
  isLoading: boolean;
  /** 詳細なステータス情報 */
  status: SubscriptionStatus | null;
  /** エラーオブジェクト */
  error: Error | null;

  /**
   * 状態を最新に更新
   */
  refresh: () => Promise<void>;

  /**
   * プラン一覧を取得
   */
  getPlans: () => Promise<SubscriptionPlan[]>;

  /**
   * プランを購入
   */
  purchase: (planId: string) => Promise<PurchaseResult>;

  /**
   * 購入を復元
   */
  restore: () => Promise<SubscriptionStatus>;
}

/**
 * サブスクリプションサービス操作用フック
 * Service層に直接アクセスする。Provider版のuseSubscriptionとは異なる。
 */
export function useSubscriptionService(): UseSubscriptionServiceResult {
  const [isSubscribed, setIsSubscribed] = useState(SubscriptionService.isSubscribed());
  const [isLoading, setIsLoading] = useState(SubscriptionService.isLoading());
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const updateState = useCallback(async () => {
    setIsSubscribed(SubscriptionService.isSubscribed());
    setIsLoading(SubscriptionService.isLoading());
    try {
      const currentStatus = await SubscriptionService.getStatus();
      setStatus(currentStatus);
    } catch (e) {
      /* ステータス取得失敗は致命的ではないのでエラーセットしない */
      Logger.error('[useSubscriptionService] Failed to get status:', e);
    }
  }, []);

  /* 初期化時にリスナー登録と初期状態取得 */
  useEffect(() => {
    const unsubscribe = SubscriptionService.subscribe((subscribed) => {
      setIsSubscribed(subscribed);
      void updateState();
    });

    void updateState();

    return () => {
      unsubscribe();
    };
  }, [updateState]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await SubscriptionService.checkSubscription();
      await SubscriptionService.refreshCustomerInfo();
      await updateState();
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, [updateState]);

  const getPlans = useCallback(async () => {
    try {
      return await SubscriptionService.getPlans();
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      throw e;
    }
  }, []);

  const purchase = useCallback(async (planId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await SubscriptionService.purchase(planId);
      if (result.success) {
        await updateState();
      } else if (result.error) {
        setError(new Error(result.error));
      }
      return result;
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [updateState]);

  const restore = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const newStatus = await SubscriptionService.restore();
      await updateState();
      return newStatus;
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [updateState]);

  return {
    isSubscribed,
    isLoading,
    status,
    error,
    refresh,
    getPlans,
    purchase,
    restore,
  };
}

