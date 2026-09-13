/* 初期化モジュール */
export {
  init,
  isInitialized,
  type SharedInitOptions,
} from './init';

/* データベース */
export * from './database/schema';
export * from './database/migrations';

/* 型定義 */
export * from './schema';
export * from './types';

/* サブスク応答の形状検証スキーマ（types/index.ts は型のみを再輸出するため、値としてはここから公開する） */
export { SubscriptionStatusSchema } from './types/Subscription';

/* エラー */
export * from './errors';

/*
 * Mappers（データアクセス層）
 *
 * データアクセス層は公開APIから一括再エクスポートしない。
 * 一括公開していると画面・コンポーネント（UI層）がMapperをそのまま呼べてしまい、
 * CLAUDE.mdのアーキテクチャ（UI層 → Service層 → Mapper層）が崩れるため。
 * ここで公開するのは、アプリのDB初期化・初期データ投入
 * （apps/mobile/src/database/、apps/web/src/database/）が使う分だけに限定する。
 * 画面・コンポーネントからはService層（SystemVariableFormatService等）を使うこと。
 */
export {
  SnippetMapper,
  CategoryMapper,
  VariableMapper,
  ProfileMapper,
  ProfileVariableMapper,
  SystemVariableFormatMapper,
} from './mappers';

/* Adapters */
export type { SubscriptionAdapter, SubscriptionListener } from './adapters';
export type { I18nAdapter, LanguageChangeListener } from './adapters';
export type { AuthAdapter, AuthStateListener } from './adapters';

export {
  /* 一括登録（全アダプターを一度に設定） */
  setAllAdapters,
  type AllAdapters,
  type SetAllAdaptersOptions,

  /* SubscriptionAdapter関連（課金管理） */
  setSubscriptionAdapter,
  type SubscriptionAdapterOptions,

  /* CryptoAdapter関連（暗号化・ハッシュ生成） */
  type CryptoAdapter,
  setCryptoAdapter,
  getCryptoAdapter,

  /* DbAdapter関連（データベースアクセス） */
  type DbAdapter,
  type DbRunResult,
  /* メインDB用（共有コンテナDB） */
  setMainDbAdapter,
  getMainDbAdapter,
  hasMainDbAdapter,
  /* システムDB用（user_version管理・マイグレーション用） */
  setSystemDbAdapter,
  getSystemDbAdapter,
  /* 一時DB用（エクスポート・インポート処理用） */
  setTempDbAdapter,
  getTempDbAdapter,
  hasTempDbAdapter,

  /* ClipboardAdapter関連（クリップボード操作） */
  type ClipboardAdapter,
  setClipboardAdapter,
  getClipboardAdapter,
  hasClipboardAdapter,

  /* FileIOAdapter関連（ファイル読み書き） */
  type FileIOAdapter,
  type FileInfo,
  setFileIOAdapter,
  getFileIOAdapter,

  /* FileShareAdapter関連（ファイル共有/ダウンロード） */
  type FileShareAdapter,

  /* LocaleAdapter関連（ロケール取得） */
  type LocaleAdapter,
  setLocaleAdapter,
  getLocaleAdapter,
  hasLocaleAdapter,

  /* I18nAdapter関連（i18n翻訳機能） */
  setI18nAdapter,
  getI18nAdapter,
  hasI18nAdapter,

  /* AuthAdapter関連（認証） */
  setAuthAdapter,
  getAuthAdapter,
  hasAuthAdapter,

  /* ExportAdapter関連（エクスポート処理） */
  type ExportAdapter,
  setExportAdapter,
  getExportAdapter,
  hasExportAdapter,

  /* ImportAdapter関連（インポート処理） */
  type ImportAdapter,
  setImportAdapter,
  getImportAdapter,
  hasImportAdapter,

  /* SortPreferenceAdapter関連（ソート設定） */
  type SortPreferenceAdapter,
  setSortPreferenceAdapter,
  getSortPreferenceAdapter,
  hasSortPreferenceAdapter,
} from './adapters';

/* ======================================== */
/* Services */
/* ======================================== */
/* ビジネスロジック層のServiceクラスと関連型をエクスポート */

/* コアサービス（カテゴリ、プロファイル、スニペット、変数、課金） */
export {
  CategoryService,        /* カテゴリ管理サービス */
  ProfileService,         /* プロファイル管理サービス */
  SnippetService,         /* スニペット管理サービス */
  VariableService,        /* 変数管理サービス */
  ShortcutService,        /* ショートカット管理サービス */
  SubscriptionService,    /* 課金管理サービス */
  FREE_PROFILES_LIMIT,    /* 無料プランのプロファイル上限 */
  FREE_VARIABLES_LIMIT,   /* 無料プランの変数上限 */
  type VariableResolverContext,       /* 変数解決コンテキスト */
  type ValidFlagsUpdater,             /* 有効フラグ更新関数型 */
  createValidFlagsUpdater,            /* ValidFlagsUpdater共通実装ファクトリ */
  ImportService,                      /* インポートサービスクラス（静的メソッドでDB操作も提供） */
  AuthService,                        /* 認証サービス */
  SystemVariableFormatRegistry,
  SystemVariableFormatService,        /* システム変数書式サービス（UI層からの入口） */
} from './services';

/* エクスポートサービス */
export {
  ExportService,                      /* エクスポートサービスクラス */
} from './services/ExportService';

/* インポートパーサーサービス */
export {
  ImportParserService,                /* インポートパーサーサービスクラス */
} from './services/ImportParserService';

/* ======================================== */
/* Variables */
/* ======================================== */
/* 変数解析とシステム変数関連の関数・型をエクスポート */
export * from './variables/parser';           /* 変数パース・展開エンジン */
export * from './variables/systemVariables';  /* システム変数定義と解決関数 */

/* ======================================== */
/* Export/Import utilities */
/* ======================================== */
/* エクスポート/インポート処理のユーティリティ関数をエクスポート */
export * from './utils/exportImportUtils';

/* ======================================== */
/* Constants */
/* ======================================== */
/* 定数定義をエクスポート */
export * from './constants/inputLimits';      /* 入力値の制限（最大文字数等） */
export * from './constants/variables';        /* 変数関連の定数 */
export * from './constants/designTokens';     /* デザイントークン（色、サイズ等） */
export * from './constants/themeTokens';      /* テーマトークン（スペーシング、フォント、タイポグラフィ） */
export * from './constants/subscription';     /* サブスクリプション定数（PRO_ENTITLEMENT_ID） */
export * from './constants/variableIcons';    /* 変数アイコン定数 */
export * from './constants/systemVariableFormats';

/* ======================================== */
/* Utils */
/* ======================================== */
/* ユーティリティ関数をエクスポート */
export * from './utils/dateHelpers';      /* 日付フォーマット関数 */
export * from './utils/dateFormatter';
export * from './utils/snippetUtils';     /* スニペット関連ユーティリティ */
export * from './utils/logger';           /* ロガー */
export * from './utils/pathUtils';        /* パス操作ユーティリティ */
export * from './utils/categoryUtils';    /* カテゴリ関連ユーティリティ */
export * from './utils/snippetFilterUtils'; /* スニペットフィルタリングユーティリティ */
export * from './utils/profileSelectLabels'; /* プロファイル選択の説明文・未選択時の表示 */
export * from './shortcuts/search';       /* ショートカット検索ユーティリティ */
export * from './shortcuts/sort';         /* ショートカット並べ替えユーティリティ */
export * from './shortcuts/resolveValue';  /* ショートカット値の解決規則 */
export * from './utils/errorUtils';      /* エラーメッセージ翻訳ユーティリティ */

/* 認証エラー関連のユーティリティ */
export {
  AUTH_ERROR_CODES,          /* 認証エラーコード定数 */
  isAuthCancelledError,      /* キャンセルエラー判定関数 */
} from './utils/authErrors';

/* ======================================== */
/* Hooks */
/* ======================================== */
/* Reactカスタムフックをエクスポート */

export {
  /* デバウンスフック */
  useDebounce,
  DEFAULT_DEBOUNCE_DELAY,

  /* Search（検索フック） */
  useSearch,

  /* Subscription Service（Service層直接アクセス版） */
  useSubscriptionService,
  type UseSubscriptionServiceResult,

  /* Variable Expansion（変数展開） */
  useVariableExpansion,

  /* Filtered Snippets（フィルタリング済みスニペット） */
  useFilteredSnippets,
  type SnippetWithDisplay,

  /* Adapter Initialization（アダプター初期化） */
  useAdapterInitialization,
  type UseAdapterInitializationReturn,

  /* App Initialization（アプリ初期化） */
  type UseAppInitializationReturn,

  /* Translation（翻訳） */
  useTranslation,
  type TranslationFunction,
} from './hooks';

/* ======================================== */
/* Providers */
/* ======================================== */
/* React Contextプロバイダーと共通型定義をエクスポート */
export {
  /* 認証プロバイダー */
  AuthProvider,
  useAuth,
  type AuthContextType,
  type AuthProviderProps,

  /* テーマ関連の型定義 */
  type ThemeMode,
  type BaseThemeContextType,
  type SemanticColors,
  LIGHT_THEME_COLORS,
  DARK_THEME_COLORS,
  getThemeColors,

  /* データベースプロバイダー */
  DatabaseProvider,
  useDatabase,
  type DatabaseContextValue,

  /* テーマプロバイダー */
  ThemeProvider,
  useTheme,
  type ThemeProviderProps,
  type ThemeContextValue,
  type ThemeStorageAdapter,
  type ThemePlatformAdapter,

  /* サブスクリプションプロバイダー */
  SubscriptionProvider,
  useSubscription as useSharedSubscription,
  type SubscriptionContextValue,
  type SubscriptionPlatformAdapter,
  type SubscriptionProviderProps,

  /* プロファイル管理Provider */
  ProfileProvider,
  useProfiles,
  type ProfileContextValue,

  /* 変数管理Provider */
  VariableProvider,
  useVariables,
  type VariableContextValue,

  /* カテゴリ管理Provider */
  CategoryProvider,
  useCategories,
  type CategoryContextValue,

  /* スニペット管理Provider */
  SnippetProvider,
  useSnippets,
  type SnippetContextValue,

  /* ショートカット管理Provider */
  ShortcutProvider,
  useShortcuts,
  type ShortcutContextValue,
} from './providers';
