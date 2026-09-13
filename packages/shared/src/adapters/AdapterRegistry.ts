/**
 * アダプター一括登録
 *
 * @description
 * Adapterパターンを採用し、プラットフォーム固有の実装（Mobile/Web）をshared層から分離。
 * アプリ起動時にsetAllAdapters()を1回呼び出すことで、
 * shared層のService/Mapperがプラットフォーム固有機能（DB、暗号化、ファイルI/O等）を利用可能にする。
 *
 * @module AdapterRegistry
 */

import type { SubscriptionAdapter } from './SubscriptionAdapter';
import type { CryptoAdapter } from './CryptoAdapter';
import type { DbAdapter } from './DbAdapter';
import type { ClipboardAdapter } from './ClipboardAdapter';
import type { FileIOAdapter } from './FileIOAdapter';
import type { LocaleAdapter } from './LocaleAdapter';
import type { I18nAdapter } from './I18nAdapter';
import type { AuthAdapter } from './AuthAdapter';
import type { ExportAdapter } from './ExportAdapter';
import type { ImportAdapter } from './ImportAdapter';
import type { SortPreferenceAdapter } from './SortPreferenceAdapter';

import { setCryptoAdapter } from './CryptoAdapter';
import {
  setMainDbAdapter,
  setSystemDbAdapter,
  setTempDbAdapter,
} from './DbAdapter';
import { setClipboardAdapter } from './ClipboardAdapter';
import { setFileIOAdapter } from './FileIOAdapter';
import { setLocaleAdapter } from './LocaleAdapter';
import { setI18nAdapter } from './I18nAdapter';
import { setAuthAdapter } from './AuthAdapter';
import { setExportAdapter } from './ExportAdapter';
import { setImportAdapter } from './ImportAdapter';
import { setSortPreferenceAdapter } from './SortPreferenceAdapter';

/**
 * サブスクリプション設定オプション
 *
 * @description
 * サブスクリプションアダプター登録時に指定する追加設定。
 * 無料プランとProプランの機能制限を定義する。
 *
 * 同じ上限値が constants/inputLimits.ts の FEATURE_LIMITS にも別名で存在し、用途が分かれている。
 * FEATURE_LIMITS.FREE_TIER_VARIABLES は無料プランで有効化するカスタム変数の切り出しに使われる
 * （providers/SnippetProvider.tsx、apps/mobile/src/utils/variableLoader.ts）。
 * ここで設定する freeVariablesLimit / freeProfilesLimit は
 * services/SubscriptionService.ts の追加可否判定（canAddVariable / canAddProfile）に使われる。
 * 片方だけ変えると追加可否と実際に有効化される変数数が食い違うため、値は揃えて変更する。
 * FEATURE_LIMITS.FREE_TIER_PROFILES は現在どこからも参照されていない。
 */
export interface SubscriptionAdapterOptions {
  /**
   * 無料プランでの環境（プロファイル）上限数
   *
   * @description
   * 無料プランで作成できる環境の最大数。
   * この上限を超える環境を作成する場合はProプラン契約が必要。
   * 未指定時は services/SubscriptionService.ts の FREE_PROFILES_LIMIT（現在3）が使われる。
   */
  freeProfilesLimit?: number;

  /**
   * 無料プランでのカスタム変数上限数
   *
   * @description
   * 無料プランで作成できるカスタム変数の最大数。
   * この上限を超える変数を作成する場合はProプラン契約が必要。
   * 未指定時は services/SubscriptionService.ts の FREE_VARIABLES_LIMIT（現在5）が使われる。
   */
  freeVariablesLimit?: number;
}

/**
 * 登録済みのSubscriptionAdapter（未登録時はnull）
 *
 * @description
 * 他のアダプターは自ファイル内に保持先を持つが、SubscriptionAdapterだけは
 * 登録時に無料プラン上限（SubscriptionAdapterOptions）も同時に受け取るため、
 * その型を定義しているこのファイルに保持先を置いている。
 */
let subscriptionAdapter: SubscriptionAdapter | null = null;

/**
 * 登録時に指定された無料プランの上限設定
 *
 * @description
 * 未指定の項目はここに入らず、services/SubscriptionService.ts の既定値
 * （FREE_PROFILES_LIMIT / FREE_VARIABLES_LIMIT）が使われる。
 * 上限は業務ルールのためadapters層では解釈せず、値の保持だけを行う。
 */
const subscriptionLimits: SubscriptionAdapterOptions = {};

/**
 * SubscriptionAdapterを設定
 *
 * @param adapter - プラットフォーム固有のSubscriptionAdapter実装
 * @param options - オプション設定（無料プランの上限数等）
 */
export function setSubscriptionAdapter(
  adapter: SubscriptionAdapter,
  options?: SubscriptionAdapterOptions
): void {
  subscriptionAdapter = adapter;

  /* 指定された項目だけを上書きし、未指定の項目は既存の設定を保つ */
  if (options?.freeProfilesLimit !== undefined) {
    subscriptionLimits.freeProfilesLimit = options.freeProfilesLimit;
  }
  if (options?.freeVariablesLimit !== undefined) {
    subscriptionLimits.freeVariablesLimit = options.freeVariablesLimit;
  }
}

/**
 * 登録済みのSubscriptionAdapterを取得
 *
 * @description
 * shared内部（services/SubscriptionService.ts）専用。
 * アプリ側の取得口は従来どおり SubscriptionService.getAdapter() のみで、
 * この関数は adapters/index.ts からは公開しない。
 *
 * @returns 登録済みのSubscriptionAdapter、未登録の場合はnull
 */
export function getRegisteredSubscriptionAdapter(): SubscriptionAdapter | null {
  return subscriptionAdapter;
}

/**
 * 登録時に指定された無料プランの上限設定を取得
 *
 * @description
 * shared内部（services/SubscriptionService.ts）専用。既定値の適用はservices層が行う。
 *
 * @returns 指定された上限設定（未指定の項目はundefined）
 */
export function getRegisteredSubscriptionLimits(): Readonly<SubscriptionAdapterOptions> {
  return subscriptionLimits;
}

/**
 * 一括登録用のアダプター設定
 *
 * @description
 * setAllAdapters()で一括登録する際に渡すアダプター群。
 * すべてオプショナルだが、通常はすべてのアダプターを登録する。
 */
export interface AllAdapters {
  /** メインDB用アダプター（共有コンテナDB - アプリ・キーボード拡張で共有） */
  mainDB?: DbAdapter;
  /** システムDB用アダプター（user_version管理・マイグレーション用） */
  systemDB?: DbAdapter;
  /** 一時DB用アダプター（インポート（復元）処理用） */
  tempDb?: DbAdapter;
  /** 暗号化アダプター（SHA-256ハッシュ計算を抽象化） */
  crypto?: CryptoAdapter;
  /** サブスクリプションアダプター（RevenueCat操作を抽象化） */
  subscription?: SubscriptionAdapter;
  /** クリップボードアダプター（クリップボード操作を抽象化） */
  clipboard?: ClipboardAdapter;
  /** ファイルI/Oアダプター（ファイル読み書きを抽象化） */
  fileIO?: FileIOAdapter;
  /** ロケールアダプター（言語設定を抽象化） */
  locale?: LocaleAdapter;
  /** i18nアダプター（翻訳機能を抽象化） */
  i18n?: I18nAdapter;
  /** 認証アダプター（Firebase Auth操作を抽象化） */
  auth?: AuthAdapter;
  /** エクスポートアダプター（エクスポート処理を抽象化） */
  export?: ExportAdapter;
  /** インポートアダプター（インポート処理を抽象化） */
  import?: ImportAdapter;
  /** ソート設定アダプター（ソート設定の保存・取得を抽象化） */
  sortPreference?: SortPreferenceAdapter;
}

/**
 * 一括登録用のオプション
 *
 * @description
 * setAllAdapters()で一括登録する際に渡す追加設定。
 * 現在はサブスクリプション関連の設定のみ。
 */
export interface SetAllAdaptersOptions {
  /** サブスクリプション設定（無料プランの上限数等） */
  subscription?: SubscriptionAdapterOptions;
}

/**
 * 全てのアダプターを一括で設定
 *
 * @description
 * プラットフォーム固有のアダプター実装をまとめて登録。
 * 呼び出し元はinit()（init.ts）のみで、init()はMobile/Web双方のuseAdapterInitializationが
 * アプリ起動時に1回だけ実行する。
 * これにより、sharedパッケージ内のビジネスロジックがプラットフォーム固有の機能（DB、暗号化等）を利用可能になる。
 *
 * @param adapters - 登録するアダプター群（すべてオプショナル）
 * @param options - オプション設定（サブスクリプション上限数等）
 */
export function setAllAdapters(
  adapters: AllAdapters,
  options?: SetAllAdaptersOptions
): void {
  if (adapters.mainDB) {
    setMainDbAdapter(adapters.mainDB);
  }
  if (adapters.systemDB) {
    setSystemDbAdapter(adapters.systemDB);
  }
  if (adapters.tempDb) {
    setTempDbAdapter(adapters.tempDb);
  }
  if (adapters.crypto) {
    setCryptoAdapter(adapters.crypto);
  }
  if (adapters.subscription) {
    setSubscriptionAdapter(adapters.subscription, options?.subscription);
  }
  if (adapters.clipboard) {
    setClipboardAdapter(adapters.clipboard);
  }
  if (adapters.fileIO) {
    setFileIOAdapter(adapters.fileIO);
  }
  if (adapters.locale) {
    setLocaleAdapter(adapters.locale);
  }
  if (adapters.i18n) {
    setI18nAdapter(adapters.i18n);
  }
  if (adapters.auth) {
    setAuthAdapter(adapters.auth);
  }
  if (adapters.export) {
    setExportAdapter(adapters.export);
  }
  if (adapters.import) {
    setImportAdapter(adapters.import);
  }
  if (adapters.sortPreference) {
    setSortPreferenceAdapter(adapters.sortPreference);
  }
}
