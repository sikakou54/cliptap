/**
 * 設定画面レイアウト
 *
 * 設定セクション内のネストされたナビゲーションを管理するレイアウトコンポーネント。
 * Expo Routerのファイルベースルーティングにより、settings/配下の画面遷移を制御。
 *
 * 管理する画面:
 * - index: 設定メインメニュー
 * - categories: カテゴリ管理
 * - profiles: プロファイル（環境）管理
 * - variables: カスタム変数管理
 * - system-variable-formats: システム変数書式管理
 * - export-import: バックアップ・復元
 *
 * @see docs/機能仕様書.md §9.1 モバイル画面
 */
import { Stack } from 'expo-router';

export default function SettingsLayout() {
  /* 設定画面のナビゲーションスタック */
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* 設定メインメニュー */}
      <Stack.Screen name="index" />
      {/* カテゴリ管理画面 */}
      <Stack.Screen name="categories" />
      {/* プロファイル管理画面 */}
      <Stack.Screen name="profiles" />
      {/* 変数管理画面 */}
      <Stack.Screen name="variables" />
      {/* システム変数書式管理画面 */}
      <Stack.Screen name="system-variable-formats" />
      {/* バックアップ・復元画面 */}
      <Stack.Screen name="export-import" />
    </Stack>
  );
}
