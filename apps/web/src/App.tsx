/**
 * ルートアプリケーションコンポーネント
 *
 * プロバイダー階層:
 * WebThemeProvider → AuthProvider → SubscriptionProvider
 *
 * ルーティング:
 * - / (Home): 初回セットアップ画面（.cliptapファイル読み込み）
 * - /dashboard: メイン画面（DB読み込み後のみアクセス可）
 * - /settings/*: 設定画面（DB読み込み後のみアクセス可）
 *
 * @see useAdapterInitialization - プラットフォームアダプター初期化
 * @see useAppInitialization - アプリ初期化（認証・DB復元）
 */
import React from 'react';
import { useTranslation } from '@cliptap/shared';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth, ProfileProvider, VariableProvider, CategoryProvider, SnippetProvider, ShortcutProvider } from '@cliptap/shared';
import { Home } from '@pages/Home';
import { Dashboard } from '@pages/Dashboard';
import { CategoryManage } from '@pages/CategoryManage';
import { ProfileManage } from '@pages/ProfileManage';
import { VariableManage } from '@pages/VariableManage';
import { getThemeColors } from '@cliptap/shared';
import { webThemeStorageAdapter } from '@providers/themeStorageAdapter';
import { WebThemeProvider } from '@providers/WebThemeProvider';
import { SubscriptionProvider } from '@providers/SubscriptionProvider';
import { DatabaseProvider, useDatabase } from '@cliptap/shared';
import { useAdapterInitialization } from '@hooks/useAdapterInitialization';
import { useAppInitialization } from '@hooks/useAppInitialization';
import { LoadingSpinner } from '@components/common/LoadingSpinner';

/**
 * ローディング画面コンポーネント
 *
 * アプリ初期化中（認証チェック、DB復元処理中）に表示されるフルスクリーンのローディング画面。
 * ユーザーに処理中であることを視覚的に示す。
 */
function LoadingScreen() {
  const { t } = useTranslation();
  /* ローディング画面（アプリ初期化中に表示、フルスクリーン） */
  return (
    <LoadingSpinner
      message={t('settings.web_specific.loading')}
      size="large"
      fullScreen
    />
  );
}

/**
 * ルーティング定義コンポーネント
 *
 * DB未読み込み時は/のみアクセス可能、読み込み後は全画面アクセス可能。
 * protectedRoute関数でDB読み込み状態に応じたアクセス制御を実装。
 */
function AppRoutes() {
  const { isLoaded } = useDatabase();

  /* DB読み込み済みなら指定の要素を表示、未読み込みならnullを返す */
  /* Homeへのリダイレクトを避けることで、リロード時のチラつきを防止 */
  const protectedRoute = (element: React.ReactElement) => (isLoaded ? element : null);

  /* ルーティング定義（DB読み込み状態に応じてアクセス制御） */
  return (
    <Routes>
      {/* ルートパス: DB読み込み済みならDashboardへ、未読み込みならHome画面を表示 */}
      <Route path="/" element={isLoaded ? <Navigate to="/dashboard" replace /> : <Home />} />
      {/* ダッシュボード: 定型文一覧画面（DB読み込み必須） */}
      <Route path="/dashboard" element={protectedRoute(<Dashboard />)} />
      {/* カテゴリ管理画面（DB読み込み必須） */}
      <Route path="/settings/categories" element={protectedRoute(<CategoryManage />)} />
      {/* プロファイル管理画面（DB読み込み必須） */}
      <Route path="/settings/profiles" element={protectedRoute(<ProfileManage />)} />
      {/* 変数管理画面（DB読み込み必須） */}
      <Route path="/settings/variables" element={protectedRoute(<VariableManage />)} />
      {/* 404: 存在しないパスへのアクセス時、DB読み込み状態に応じて適切な画面へリダイレクト */}
      <Route path="*" element={isLoaded ? <Navigate to="/dashboard" replace /> : null} />
    </Routes>
  );
}

/**
 * メインコンテンツコンポーネント
 *
 * ログインなしでもHome画面（.cliptapファイル読み込み）を表示し、
 * DBロード後はDashboardへ遷移可能。
 * 認証とアプリ初期化の完了を待ってから、プロバイダー階層とルーターをレンダリング。
 */
function Main() {
  const { loading } = useAuth();
  const { isAppReady, isLoaded, setLoaded } = useAppInitialization();

  /* 認証チェック中はローディング画面を表示 */
  if (loading) return <LoadingScreen />;
  /* アプリ初期化未完了時はローディング画面を表示 */
  if (!isAppReady) return <LoadingScreen />;

  /* データベースプロバイダーとルーター（DB状態管理とルーティング） */
  /* Provider階層: Database → Profile → Variable → Category → Snippet → Router */
  return (
    <DatabaseProvider value={{ isLoaded, setLoaded }}>
      {/* プロファイル（環境）管理のコンテキスト */}
      <ProfileProvider>
        {/* 変数管理のコンテキスト */}
        <VariableProvider>
          {/* カテゴリ管理のコンテキスト */}
          <CategoryProvider>
            {/* スニペット管理のコンテキスト */}
            <SnippetProvider>
              <ShortcutProvider>
                {/* ルーター（HashRouter: ブラウザの履歴APIを使用せず、ハッシュベースのルーティング） */}
                <Router>
                  <AppRoutes />
                </Router>
              </ShortcutProvider>
            </SnippetProvider>
          </CategoryProvider>
        </VariableProvider>
      </ProfileProvider>
    </DatabaseProvider>
  );
}

/**
 * ルートアプリケーションコンポーネント
 *
 * アダプター初期化後、プロバイダー階層をセットアップ。
 * 最外側からテーマ、アラート、認証、サブスクリプションの順にプロバイダーを配置。
 */
export default function App() {
  const { isAdaptersReady } = useAdapterInitialization();

  /* アダプター初期化未完了時は何も表示しない（nullを返す） */
  if (!isAdaptersReady) return null;

  /* Webプラットフォーム用のダークモードアダプター（システム設定の検出・適用・監視） */
  const webPlatformAdapter = {
    /* システムのダークモード設定を取得（SSR対応: window未定義時はfalseを返す） */
    getSystemDarkMode: () => {
      if (typeof window === 'undefined') return false;
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    },
    /* HTML要素にdarkクラスを適用/削除してダークモードを切り替え（SSR対応） */
    applyDarkClass: (isDark: boolean) => {
      if (typeof document === 'undefined') return;
      const html = document.documentElement;
      html.classList.remove('dark');
      if (isDark) {
        html.classList.add('dark');
      }
    },
    /* システムのダークモード設定変更を監視（変更時にコールバックを実行、クリーンアップ関数を返す） */
    watchSystemDarkMode: (callback: (isDark: boolean) => void) => {
      if (typeof window === 'undefined') return () => {};

      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e: MediaQueryListEvent) => callback(e.matches);

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    },
  };

  /* プロバイダー階層（テーマ → 認証 → サブスクリプション → Main） */
  return (
    <WebThemeProvider
      storageAdapter={webThemeStorageAdapter}
      platformAdapter={webPlatformAdapter}
      getThemeColors={getThemeColors}
    >
      {/* 認証管理（Google/Appleログイン、ユーザー状態管理） */}
      <AuthProvider>
        {/* サブスクリプション管理（Free/Proプランの状態管理） */}
        <SubscriptionProvider>
          {/* メインコンテンツ（Database → Profile → Variable → Category → Snippet → Router） */}
          <Main />
        </SubscriptionProvider>
      </AuthProvider>
    </WebThemeProvider>
  );
}
