/**
 * サブスクリプション管理サービス
 *
 * @module SubscriptionService
 * @remarks
 * プラットフォーム固有のSubscriptionAdapterを使用してサブスクリプション状態を管理。
 * Mobile/Webで共通のAPI経由で無料版とProプランの機能制限を一元管理する。
 *
 * 主な機能:
 * - サブスクリプション状態の管理・照会
 * - 機能制限チェック（変数数・プロファイル数・定型文数・ショートカット数・ショートカットの値の数）
 * - validフラグの更新（無料版での使用可能アイテム管理）
 * - 認証連携（Firebase UID ↔ RevenueCat）
 *
 * アーキテクチャ:
 * - Adapterパターンで依存を注入（Mobile: RevenueCat SDK, Web: ClipTap API経由のWebSubscriptionAdapter）
 * - ValidFlagsUpdaterでMapper操作を抽象化（shared→app依存を回避）
 * - アダプター本体と無料プラン上限の保持先はadapters/AdapterRegistry.tsで、
 *   本サービスはそこから読み出す（services→adaptersの一方向依存）
 */

import { Logger } from '../utils/logger';
import type { SubscriptionAdapter, SubscriptionListener } from '../adapters/SubscriptionAdapter';
import {
  setSubscriptionAdapter,
  getRegisteredSubscriptionAdapter,
  getRegisteredSubscriptionLimits,
} from '../adapters/AdapterRegistry';
import type { SubscriptionPlan, SubscriptionStatus, PurchaseResult } from '../types/Subscription';
import type { Profile } from '../schema';

/** 無料プランで使用可能なプロファイル数 */
export const FREE_PROFILES_LIMIT = 3;
/** 無料プランで使用可能な変数数 */
export const FREE_VARIABLES_LIMIT = 5;
/**
 * 無料プランで登録できる定型文数（全プロファイル合計）
 *
 * @remarks
 * プロファイル・変数と違い、上限を超えた分を無効化しない（定型文はvalidフラグを持たない）。
 * 既に上限以上ある利用者のデータは使えるまま残し、新規登録だけを止める。
 */
export const FREE_SNIPPETS_LIMIT = 50;
/**
 * 無料プランで登録できるショートカット数（全プロファイル合計）
 *
 * @remarks 超過分を無効化せず新規登録だけを止める点は FREE_SNIPPETS_LIMIT と同じ。
 */
export const FREE_SHORTCUTS_LIMIT = 50;
/**
 * 無料プランで1つのショートカットに登録できる値の数
 *
 * @remarks
 * 超過分を無効化せず新規登録だけを止める点は FREE_SNIPPETS_LIMIT と同じ。
 * 上限を超える値を既に持つショートカットも、値を増やさない限り編集して保存できる。
 */
export const FREE_SHORTCUT_VALUES_LIMIT = 5;

/**
 * 上限なしを表す番兵値。
 *
 * @remarks
 * Proプランでも updateValidFlags をスキップしてはならない。ProfileMapper.updateValidFlags /
 * VariableMapper.updateValidFlags は RESET_VALID で全件を valid=0 にしてから
 * SET_VALID_BY_LIMIT で上限件数だけ valid=1 に戻す実装のため、Pro加入・購入復元の直後に
 * 「無料プラン上限で無効化されていた項目」を全件有効へ戻すには、この巨大な上限で更新を実行する必要がある。
 */
const UNLIMITED_LIMIT = 999999;

/**
 * validフラグ更新用のコールバックインターフェース
 *
 * @interface ValidFlagsUpdater
 * @remarks
 * SubscriptionServiceからMapper操作を抽象化するためのコールバック。
 * shared→app間の依存を回避。
 */
export interface ValidFlagsUpdater {
  /** プロファイルのvalidフラグを更新 */
  updateProfileValidFlags: (limit: number) => void;
  /** 変数のvalidフラグを更新 */
  updateVariableValidFlags: (limit: number) => void;
  /** アクティブプロファイルを取得 */
  getActiveProfile: () => Profile | null;
  /** IDでプロファイルを取得 */
  getProfileById: (id: string) => Profile | null;
  /** デフォルトプロファイルを取得 */
  getDefaultProfile: () => Profile | null;
  /** アクティブプロファイルを設定 */
  setActiveProfile: (id: string) => void;
  /** DBアダプターが初期化済みか確認 */
  hasDbAdapter: () => boolean;
}

/**
 * サブスクリプション管理サービス
 *
 * @class SubscriptionService
 * @remarks
 * 静的メソッドのみで構成。シングルトンとして動作。
 * Adapterパターンでプラットフォーム固有の実装を注入。
 */
export class SubscriptionService {
  /** validフラグ更新用コールバック */
  private static validFlagsUpdater: ValidFlagsUpdater | null = null;

  /**
   * 無料プランのプロファイル上限
   *
   * @remarks 登録時に指定が無ければFREE_PROFILES_LIMITを使う。
   */
  private static get freeProfilesLimit(): number {
    return getRegisteredSubscriptionLimits().freeProfilesLimit ?? FREE_PROFILES_LIMIT;
  }

  /**
   * 無料プランの変数上限
   *
   * @remarks 登録時に指定が無ければFREE_VARIABLES_LIMITを使う。
   */
  private static get freeVariablesLimit(): number {
    return getRegisteredSubscriptionLimits().freeVariablesLimit ?? FREE_VARIABLES_LIMIT;
  }

  /**
   * サブスクリプションアダプターを設定
   *
   * @param adapter - プラットフォーム固有のアダプター
   * @param options - オプション（制限値のオーバーライド）
   * @remarks
   * 本番の登録経路はこのメソッドではない。Mobile/Webとも起動時に init()（shared/init.ts）へ
   * アダプター群を渡し、init() が setAllAdapters() 経由で setSubscriptionAdapter() を呼ぶ。
   * 注入される実装は Mobile: MobileSubscriptionAdapter、Web: WebSubscriptionAdapter。
   * このメソッドは同じ setSubscriptionAdapter() への単体差し替え口で、
   * 現在の呼び出し元は packages/shared/tests 配下のみ。
   * いずれの経路でも実体の保持はadapters/AdapterRegistry.tsが行う。
   */
  static setAdapter(
    adapter: SubscriptionAdapter,
    options?: { freeProfilesLimit?: number; freeVariablesLimit?: number }
  ): void {
    setSubscriptionAdapter(adapter, options);
  }

  /**
   * validフラグ更新用のコールバックを設定
   *
   * @param updater - Mapper操作を行うコールバック
   */
  static setValidFlagsUpdater(updater: ValidFlagsUpdater): void {
    this.validFlagsUpdater = updater;
  }

  /**
   * アダプターが設定済みか確認
   *
   * @returns SubscriptionAdapter
   * @throws {Error} アダプター未設定の場合
   */
  private static ensureAdapter(): SubscriptionAdapter {
    const adapter = getRegisteredSubscriptionAdapter();
    if (!adapter) {
      throw new Error('SubscriptionAdapter not set. Call setAdapter() first.');
    }
    return adapter;
  }

  /**
   * 登録済みのアダプターを取得
   *
   * @returns 登録済みのSubscriptionAdapter、または未設定の場合はnull
   * @remarks
   * Mobile: プラットフォーム固有のコールバック設定などに使用
   */
  static getAdapter(): SubscriptionAdapter | null {
    return getRegisteredSubscriptionAdapter();
  }

  /**
   * Pro版加入状態を取得
   *
   * @returns Pro版に加入している場合true
   */
  static isSubscribed(): boolean {
    return getRegisteredSubscriptionAdapter()?.isSubscribed() ?? false;
  }

  /**
   * 読み込み中状態を取得
   *
   * @returns 初期化中の場合true
   */
  static isLoading(): boolean {
    return getRegisteredSubscriptionAdapter()?.isLoading() ?? false;
  }

  /**
   * サブスクリプション状態を確認
   *
   * @param userId - ユーザーID（オプション）
   * @returns Pro版に加入している場合true
   */
  static async checkSubscription(userId?: string | null): Promise<boolean> {
    return this.ensureAdapter().checkSubscription(userId);
  }

  /**
   * サブスクリプション状態変更を購読
   *
   * @param listener - 状態変更時に呼び出されるコールバック
   * @returns 購読解除関数
   */
  static subscribe(listener: SubscriptionListener): () => void {
    return this.ensureAdapter().subscribe(listener);
  }

  /**
   * 変数を追加可能か判定
   *
   * @param currentCount - 現在の変数数
   * @returns 追加可能な場合true
   * @remarks Pro版は無制限、無料版は上限まで。
   */
  static canAddVariable(currentCount: number): boolean {
    return this.isSubscribed() || currentCount < this.freeVariablesLimit;
  }

  /**
   * プロファイルを追加可能か判定
   *
   * @param currentCount - 現在のプロファイル数
   * @returns 追加可能な場合true
   * @remarks Pro版は無制限、無料版は上限まで。
   */
  static canAddProfile(currentCount: number): boolean {
    return this.isSubscribed() || currentCount < this.freeProfilesLimit;
  }

  /**
   * 定型文を追加可能か判定
   *
   * @param currentCount - 保存済みの定型文総数（全プロファイル合計）
   * @returns 追加可能な場合true
   * @remarks
   * Pro版は無制限、無料版は上限まで。上限以上を保持していても既存の定型文は無効化せず、
   * 新規登録だけを止める（validフラグの再計算の対象外）。
   */
  static canAddSnippet(currentCount: number): boolean {
    return this.isSubscribed() || currentCount < FREE_SNIPPETS_LIMIT;
  }

  /**
   * ショートカットを追加可能か判定
   *
   * @param currentCount - 保存済みのショートカット総数（全プロファイル合計）
   * @returns 追加可能な場合true
   * @remarks Pro版は無制限、無料版は上限まで。既存分を無効化しない点は canAddSnippet と同じ。
   */
  static canAddShortcut(currentCount: number): boolean {
    return this.isSubscribed() || currentCount < FREE_SHORTCUTS_LIMIT;
  }

  /**
   * ショートカットに値を追加可能か判定
   *
   * @param currentCount - 追加前の値の件数（1つのショートカット内）
   * @returns 追加可能な場合true
   * @remarks Pro版は無制限、無料版は上限まで。既存の値を無効化しない点は canAddSnippet と同じ。
   */
  static canAddShortcutValue(currentCount: number): boolean {
    return this.isSubscribed() || currentCount < FREE_SHORTCUT_VALUES_LIMIT;
  }


  /**
   * validフラグを更新
   *
   * @remarks
   * サブスク状態に応じてProfile/Variableのvalidフラグを更新。
   * 無料版では上限を超えたアイテムをinvalidにする。
   * アクティブプロファイルが無効になった場合、デフォルトに自動切り替え。
   *
   * @returns 更新を実行できたか。現在の呼び出し元8箇所はいずれも戻り値を見ていないが、
   *          共有パッケージの公開APIのため型は変えずに維持している。
   *          失敗は警告としてログに残す。
   */
  static updateValidFlags(): boolean {
    if (!this.validFlagsUpdater?.hasDbAdapter()) {
      return false;
    }

    try {
      const activeProfile = this.validFlagsUpdater.getActiveProfile();
      const subscribed = this.isSubscribed();

      const limit = subscribed ? UNLIMITED_LIMIT : this.freeProfilesLimit;
      const varLimit = subscribed ? UNLIMITED_LIMIT : this.freeVariablesLimit;

      /* created_at順でソート後、limit番目以降のアイテムのvalidフラグをfalseに設定 */
      this.validFlagsUpdater.updateProfileValidFlags(limit);
      this.validFlagsUpdater.updateVariableValidFlags(varLimit);

      /* アクティブ環境が無効化された場合、強制的にデフォルトに切り替え */
      if (activeProfile) {
        const updated = this.validFlagsUpdater.getProfileById(activeProfile.id);
        if (updated && !updated.valid) {
          const defaultProfile = this.validFlagsUpdater.getDefaultProfile();
          if (defaultProfile) {
            this.validFlagsUpdater.setActiveProfile(defaultProfile.id);
          }
        }
      }
      return true;
    } catch (error) {
      /* 有効フラグの再計算に失敗してもローカル業務機能は続行させる。
         ここで例外を上げると、プロファイル削除・標準切替・インポートのトランザクションを
         巻き込んで中断してしまうため再スローしない。原因追跡のため警告だけ残す。 */
      Logger.warn('[SubscriptionService] Failed to update valid flags. Continuing without recalculation.', error);
      return false;
    }
  }

  /**
   * Firebase UIDとRevenueCatアカウントを紐付け
   *
   * @param userId - Firebase UID
   */
  static async linkAccount(userId: string): Promise<void> {
    await getRegisteredSubscriptionAdapter()?.linkAccount?.(userId);
  }

  /**
   * RevenueCatからログアウト
   */
  static async logout(): Promise<void> {
    await getRegisteredSubscriptionAdapter()?.logout?.();
  }

  /**
   * CustomerInfo（顧客情報）を最新化
   */
  static async refreshCustomerInfo(): Promise<void> {
    await getRegisteredSubscriptionAdapter()?.refreshCustomerInfo?.();
  }

  /**
   * サービスをリセット
   *
   * @remarks テスト用。状態を初期化する。
   */
  static reset(): void {
    getRegisteredSubscriptionAdapter()?.reset?.();
  }

  /* ======================================== */
  /* Adapter拡張メソッド */
  /* ======================================== */

  /**
   * 詳細なサブスクリプションステータスを取得
   *
   * @returns サブスクリプションステータス、未実装時はnull
   */
  static async getStatus(): Promise<SubscriptionStatus | null> {
    return getRegisteredSubscriptionAdapter()?.getStatus?.() ?? null;
  }

  /**
   * 利用可能なプラン一覧を取得
   *
   * @returns プラン一覧、未実装時は空配列
   */
  static async getPlans(): Promise<SubscriptionPlan[]> {
    return getRegisteredSubscriptionAdapter()?.getPlans?.() ?? [];
  }

  /**
   * プランを購入
   *
   * @param planId - 購入するプランID
   * @returns 購入結果
   * @throws {Error} アダプター未設定または機能未実装時
   */
  static async purchase(planId: string): Promise<PurchaseResult> {
    const adapter = this.ensureAdapter();
    if (!adapter.purchase) {
      throw new Error('Purchase not supported on this platform');
    }
    return adapter.purchase(planId);
  }

  /**
   * 購入を復元
   *
   * @returns 復元後のステータス
   * @throws {Error} アダプター未設定または機能未実装時
   */
  static async restore(): Promise<SubscriptionStatus> {
    const adapter = this.ensureAdapter();
    if (!adapter.restore) {
      throw new Error('Restore not supported on this platform');
    }
    return adapter.restore();
  }
}
