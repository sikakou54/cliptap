/**
 * サブスクリプションプロバイダー（共通実装）
 *
 * @description
 * プラットフォーム非依存のサブスクリプション状態管理Provider。
 * プラットフォーム固有の実装はアダプター経由で提供される。
 *
 * 主な機能:
 * - Reactの描画状態としての加入状態の保持
 * - 権利確認に失敗したときのFree表示へのフォールバック制御
 * - 機能制限チェック（変数数・プロファイル数・定型文数・ショートカット数・ショートカットの値の数）の窓口
 *
 * @remarks
 * 課金抽象の責務境界:
 * - SubscriptionAdapter / SubscriptionService = React非依存の権利判定とvalidフラグ更新。
 *   SnippetProvider・AuthService・ImportService などReact外からも呼ばれるため、購入・復元・
 *   プラン取得といった課金操作はすべてこちらに置く。
 * - SubscriptionPlatformAdapter / SubscriptionProvider = Reactの描画状態と権利確認失敗の制御。
 *   購入・復元・プラン取得・有効期限の取得をこちら側へ再追加しないこと。画面が課金操作を要する
 *   場合は useSubscriptionService（SubscriptionService経由）を使う。
 *
 * @module SubscriptionProvider
 */

import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { SubscriptionService } from '../services/SubscriptionService';
import { Logger } from '../utils/logger';

/* ======================================== */
/* 型定義 */
/* ======================================== */

/**
 * サブスクリプションコンテキストの型定義
 */
export interface SubscriptionContextValue {
  /** Pro版加入状態 */
  isSubscribed: boolean;
  /** 初期化中フラグ */
  isLoading: boolean;
  /** 権利確認に失敗し、Free表示へフォールバックしているか */
  verificationFailed: boolean;
  /** 広告を表示すべきか判定 */
  shouldShowAds: () => boolean;
  /** カスタム変数を追加可能か判定 */
  canAddCustomVariable: (currentCount: number) => boolean;
  /** プロファイルを追加可能か判定 */
  canAddProfile: (currentCount: number) => boolean;
  /**
   * 定型文を追加可能か判定
   *
   * @remarks
   * 権利確認中も保留せず、その時点の権利状態（未確定はFree）で判定する。
   * 起動直後の追加ボタンで判定を保留するかは呼出側が決め、保存時はこのまま判定する。
   */
  canAddSnippet: (currentCount: number) => boolean;
  /** ショートカットを追加可能か判定（権利確認中の扱いは canAddSnippet と同じ） */
  canAddShortcut: (currentCount: number) => boolean;
  /** ショートカットに値を追加可能か判定（引数は追加前の値の件数。権利確認中の扱いは canAddSnippet と同じ） */
  /** サブスク状態を最新化 */
  refresh: () => Promise<void>;
  /** 開発者オーバーライドを設定（DEVのみ） */
  setDevSubscriptionOverride: (value: boolean | null) => Promise<void>;
}

/**
 * サブスクリプションプラットフォームアダプター
 *
 * @remarks
 * Reactの描画状態を組み立てるために必要な最小限の操作だけを抽象化する。
 * 購入・復元・プラン取得・有効期限の取得は SubscriptionAdapter 側の責務であり、
 * ここへ追加してはならない（同じ機能が2つのインターフェースへ重複して生えるため）。
 */
export interface SubscriptionPlatformAdapter {
  /** 初期化処理 */
  initialize: () => Promise<void>;
  /**
   * 現在の加入状態を解決する
   *
   * @remarks
   * 検証の有無はプラットフォーム実装に委ねる。
   * mobileはRevenueCatのキャッシュを読み出すだけ、webはClipTap APIへ通信して検証し、
   * 失敗した場合は例外を投げてProviderにFree表示へフォールバックさせる。
   * SubscriptionAdapter.checkSubscription（サーバーから検証・更新）とは別契約のため名前を分けている。
   */
  resolveSubscribed: () => Promise<boolean>;
  /** サブスク状態を最新化 */
  refresh: () => Promise<void>;
  /** サブスク状態変更時のコールバックを登録 */
  onSubscriptionChange?: (callback: (isSubscribed: boolean) => void) => () => void;
  /** DEVオーバーライドを設定（開発環境用） */
  setDevSubscriptionOverride?: (value: boolean | null) => Promise<void>;
}

/**
 * SubscriptionProviderのProps
 */
export interface SubscriptionProviderProps {
  /** 子コンポーネント */
  children: ReactNode;
  /** プラットフォームアダプター */
  platformAdapter: SubscriptionPlatformAdapter;
}

/* ======================================== */
/* Context */
/* ======================================== */

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

/* ======================================== */
/* Provider */
/* ======================================== */

/**
 * サブスクリプション状態管理Provider
 *
 * @param props - SubscriptionProviderProps
 */
export function SubscriptionProvider({
  children,
  platformAdapter,
}: SubscriptionProviderProps) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [verificationFailed, setVerificationFailed] = useState(false);

  /**
   * サブスク状態変更時の内部処理
   * 1. ローカル状態の更新
   * 2. validFlags更新
   */
  const handleSubscriptionChange = useCallback((subscribed: boolean, updateValidity = true) => {
    setIsSubscribed(subscribed);
    setVerificationFailed(false);

    if (updateValidity) SubscriptionService.updateValidFlags();
  }, []);

  useEffect(() => {
    const initialize = async () => {
      setIsLoading(true);
      try {
        /* ValidFlagsUpdaterと無料上限は init() が起動時に設定済みのため、ここではアダプターの初期化と加入状態の取得だけを行う */
        await platformAdapter.initialize();
        const subscribed = await platformAdapter.resolveSubscribed();
        handleSubscriptionChange(subscribed);
      } catch (error) {
        Logger.error('[SubscriptionProvider] Init failed:', error);
        setIsSubscribed(false);
        setVerificationFailed(true);
      } finally {
        setIsLoading(false);
      }
    };

    void initialize();
  }, [platformAdapter, handleSubscriptionChange]);

  useEffect(() => {
    if (!platformAdapter.onSubscriptionChange) return;

    const unsubscribe = platformAdapter.onSubscriptionChange(handleSubscriptionChange);

    return unsubscribe;
  }, [platformAdapter, handleSubscriptionChange]);

  const refresh = useCallback(async () => {
    try {
      await platformAdapter.refresh();
      const subscribed = await platformAdapter.resolveSubscribed();
      handleSubscriptionChange(subscribed);
    } catch (error) {
      Logger.error('[SubscriptionProvider] Refresh failed:', error);
      setIsSubscribed(false);
      setVerificationFailed(true);
    }
  }, [platformAdapter, handleSubscriptionChange]);

  const setDevSubscriptionOverride = useCallback(async (value: boolean | null) => {
    if (platformAdapter.setDevSubscriptionOverride) {
      await platformAdapter.setDevSubscriptionOverride(value);
      await refresh();
    }
  }, [platformAdapter, refresh]);

  const value = useMemo<SubscriptionContextValue>(() => ({
    isSubscribed,
    isLoading,
    verificationFailed,
    shouldShowAds: () => !SubscriptionService.isSubscribed(),
    canAddCustomVariable: (count) => SubscriptionService.canAddVariable(count),
    canAddProfile: (count) => SubscriptionService.canAddProfile(count),
    canAddSnippet: (count) => SubscriptionService.canAddSnippet(count),
    canAddShortcut: (count) => SubscriptionService.canAddShortcut(count),
    refresh,
    setDevSubscriptionOverride,
  }), [isSubscribed, isLoading, verificationFailed, refresh, setDevSubscriptionOverride]);

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

/* ======================================== */
/* Hook */
/* ======================================== */

/**
 * サブスクリプションコンテキストを取得するカスタムフック
 *
 * @returns SubscriptionContextValue
 * @throws Provider外で使用された場合にエラー
 */
export function useSubscription(): SubscriptionContextValue {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}
