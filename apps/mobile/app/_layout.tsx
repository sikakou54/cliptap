/**
 * @module RootLayout
 * @description ルートレイアウト
 *
 * ClipTapアプリ全体のプロバイダー構成とナビゲーション設定を管理。
 * Expo Routerの_layout.tsxとして、アプリ起動時に最初に実行される。
 *
 * @responsibility
 * - アダプター初期化処理（useAdapterInitialization）
 * - アプリデータ初期化処理（useAppInitialization、AuthProvider内）
 * - プロバイダー階層: ThemeProvider → AuthProvider → SubscriptionProvider
 *   → DatabaseProvider → ProfileProvider → VariableProvider → CategoryProvider → SnippetProvider
 *   → ShortcutProvider
 * - 全画面のナビゲーション設定（Stack Navigator）
 * - スプラッシュスクリーンの表示制御
 * - 起動時App Open広告の表示判定の受け口（AppOpenAdGate）
 *
 * @see docs/機能仕様書.md §3.3 システム構成
 */

import { Stack } from 'expo-router';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { ThemeProvider } from '@lib/themeSystem';
import { SubscriptionProvider } from '@providers/SubscriptionProvider';
import { SplashScreen } from '@components/common/SplashScreen';
import { AppOpenAdGate } from '@components/ads/AppOpenAdGate';
import { AuthProvider, DatabaseProvider, ProfileProvider, VariableProvider, CategoryProvider, SnippetProvider, ShortcutProvider } from '@cliptap/shared';
import { useAdapterInitialization } from '@hooks/screens/useAdapterInitialization';
import { useAppInitialization } from '@hooks/screens/useAppInitialization';

const MODAL_SLIDE_OPTIONS = {
  presentation: 'modal',
  headerShown: false,
  animation: 'slide_from_bottom',
} as const;

const HEADER_HIDDEN_OPTIONS = {
  headerShown: false,
} as const;

/**
 * 初期化中の待機表示に使う固定色
 *
 * styles.rootContainer を適用する View は ThemeProvider を包む側にあるため useTheme() を呼べず、
 * テーマトークンを参照できない。
 * styles.loadingContainer と ActivityIndicator は ThemeProvider の内側だが、
 * colors.background / colors.primary はダークで別値（primary はダークで #60A5FA）になるため、
 * 現行の見た目を保つ目的でスプラッシュ（src/components/common/SplashScreen.tsx の #1F2937）と
 * 同じ値をリテラルのまま保持する。
 */
const SPLASH_BACKGROUND = '#1F2937';
const SPLASH_INDICATOR = '#3B82F6';

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: SPLASH_BACKGROUND,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: SPLASH_BACKGROUND,
  },
});

/**
 * アプリコンテンツ
 *
 * AuthProvider内で使用。アプリデータ初期化後にナビゲーションを表示。
 */
function AppContent({ isTabletDevice }: { isTabletDevice: boolean }) {
  const { isAppReady, isLoaded, setLoaded } = useAppInitialization();

  const tabletAwareModalOptions = {
    presentation: isTabletDevice ? 'card' : 'modal',
    headerShown: false,
    animation: !isTabletDevice ? 'slide_from_bottom' : undefined,
  } as const;

  if (!isAppReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={SPLASH_INDICATOR} />
      </View>
    );
  }

  /* データベースプロバイダーとナビゲーションスタック */
  /* Provider階層: Database → Profile → Variable → Category → Snippet → Shortcut（各Providerが useDatabase() を前提にするため Database を最外に置く） */
  return (
    <DatabaseProvider value={{ isLoaded, setLoaded }}>
      <ProfileProvider>
        <VariableProvider>
          <CategoryProvider>
            <SnippetProvider>
              <ShortcutProvider>
                <Stack screenOptions={HEADER_HIDDEN_OPTIONS}>
                  {/* ホーム画面 */}
                  <Stack.Screen name="index" />
                  {/* 検索画面（透明モーダル） */}
                  <Stack.Screen
                    name="search"
                    options={{ presentation: 'transparentModal', headerShown: false, animation: 'fade' }}
                  />
                  {/* スニペット作成画面 */}
                  <Stack.Screen name="snippet/create" options={tabletAwareModalOptions} />
                  {/* スニペット編集画面 */}
                  <Stack.Screen name="snippet/edit" options={tabletAwareModalOptions} />
                  {/* スニペット内容入力画面 */}
                  <Stack.Screen name="snippet/content-input" options={tabletAwareModalOptions} />
                  {/* スニペットタイトル入力画面 */}
                  <Stack.Screen name="snippet/title-input" options={tabletAwareModalOptions} />
                  {/* スニペットプロファイル選択画面 */}
                  <Stack.Screen name="profile/select" options={MODAL_SLIDE_OPTIONS} />
                  {/* カテゴリ編集画面 */}
                  <Stack.Screen name="category/edit" options={MODAL_SLIDE_OPTIONS} />
                  {/* カテゴリ選択画面 */}
                  <Stack.Screen name="category/select" options={MODAL_SLIDE_OPTIONS} />
                  {/* 変数編集画面 */}
                  <Stack.Screen name="variable/edit" options={MODAL_SLIDE_OPTIONS} />
                  <Stack.Screen name="variable/select" options={MODAL_SLIDE_OPTIONS} />
                  {/* 変数プロファイル値編集画面 */}
                  <Stack.Screen name="variable/profile-value-edit" options={MODAL_SLIDE_OPTIONS} />
                  {/* システム変数書式選択画面 */}
                  <Stack.Screen name="variable/format-edit" options={MODAL_SLIDE_OPTIONS} />
                  {/* プロファイル編集画面 */}
                  <Stack.Screen name="profile/edit" options={MODAL_SLIDE_OPTIONS} />
                  {/* ショートカット作成・編集画面 */}
                  <Stack.Screen name="shortcut/edit" options={MODAL_SLIDE_OPTIONS} />
                  {/* ショートカット値編集画面 */}
                  <Stack.Screen name="shortcut/value-edit" options={MODAL_SLIDE_OPTIONS} />
                  {/* ショートカットの値入力画面 */}
                  <Stack.Screen name="shortcut/value-text-edit" options={MODAL_SLIDE_OPTIONS} />
                  {/* 設定画面 */}
                  <Stack.Screen name="settings" />
                  {/* サブスクリプション課金画面（フルスクリーンモーダル） */}
                  <Stack.Screen
                    name="subscription/paywall"
                    options={{ presentation: 'fullScreenModal', headerShown: false }}
                  />
                  {/* サブスクリプション管理画面 */}
                  <Stack.Screen name="subscription/manage" />
                  {/* WebView画面 */}
                  <Stack.Screen name="webview" />
                </Stack>
              </ShortcutProvider>
            </SnippetProvider>
          </CategoryProvider>
        </VariableProvider>
      </ProfileProvider>
    </DatabaseProvider>
  );
}

export default function RootLayout() {
  const { isAdaptersReady, showSplash, isTabletDevice, hideSplash } = useAdapterInitialization();

  return (
    <>
      {/* アダプター初期化完了後のメインアプリコンテンツ */}
      {isAdaptersReady && (
        <View style={styles.rootContainer}>
          {/* プロバイダー階層（テーマ → 認証 → サブスクリプション → Database → Profile → Variable → Category → Snippet → Shortcut） */}
          <ThemeProvider>
            <AuthProvider>
              <SubscriptionProvider>
                {/* 起動時App Open広告の表示判定（加入状態を見るためSubscriptionProviderの内側に置く。描画はしない。
                    広告はスプラッシュの表示が完全に終わってから出す） */}
                <AppOpenAdGate isSplashFinished={!showSplash} />
                <AppContent isTabletDevice={isTabletDevice} />
              </SubscriptionProvider>
            </AuthProvider>
          </ThemeProvider>
        </View>
      )}

      {/* スプラッシュスクリーン（初期化中に表示。起動時広告は待たない） */}
      {showSplash && (
        <SplashScreen
          onFinish={hideSplash}
          isLoading={!isAdaptersReady}
        />
      )}
    </>
  );
}
