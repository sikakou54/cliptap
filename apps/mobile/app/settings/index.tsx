/**
 * 設定画面
 *
 * アプリ全体の設定を管理するメイン設定画面。
 * メイン画面の設定アイコンから遷移する。
 *
 * 主なメニュー項目:
 * - カテゴリ管理（→ /settings/categories）
 * - 環境管理（→ /settings/profiles）
 * - カスタム変数（→ /settings/variables）
 * - バックアップ・復元（→ /settings/export-import）
 * - サブスクリプション管理（→ /subscription/manage）
 * - 利用規約/プライバシーポリシー（→ /webview）
 *
 * 認証機能:
 * - Apple/Googleサインイン
 * - アカウント連携状態の表示
 *
 * 開発者機能（__DEV__モードのみ）:
 * - サブスクリプション状態の切り替え
 * - データベースリセット
 * - テストデータの再生成
 *
 * @see src/hooks/screens/useSettingsScreen.ts - ビジネスロジック
 * @see docs/機能仕様書.md §9.1 モバイル画面
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useTranslation } from '@cliptap/shared'
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@lib/themeSystem';
import { ScreenContainer } from '@components/common/ScreenContainer';
import { UI_CONSTANTS } from '@constants/ui';
import { useSettingsScreen } from '@hooks/screens/useSettingsScreen';
import {
  KeyboardGuideModal,
  SubscriptionCard,
  AccountAuthSection,
  DeveloperMenu,
} from '@components/settings';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { colors, responsiveFontSizes, responsiveLineHeights } = useTheme();

  const {
    showKeyboardGuide,
    isLinkingAccount,
    authLoading,
    isSubscribed,
    user,
    accountAuthStatus,
    menuItems,

    closeKeyboardGuide,
    handleAppleSignIn,
    handleGoogleSignIn,
    handleLogout,
    handleSubscriptionPress,

    handleDevSubscriptionToggle,
    handleDevAdsToggle,
    handleResetDatabase,
  } = useSettingsScreen();

  /* 設定画面 */
  return (
    <ScreenContainer title={t('settings.title')} backIcon="arrow-back">
      {/* スクロール可能なコンテンツエリア */}
      <ScrollView style={styles.content}>
        {/* メニューセクション */}
        <View style={styles.menuSection}>
          <View style={[styles.menuGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {menuItems.map((item, index) => (
              <React.Fragment key={item.id}>
                {/* メニューアイテム */}
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={item.onPress}
                  activeOpacity={0.7}
                >
                  <View style={styles.menuLeft}>
                    <Ionicons name={item.icon} size={24} color={colors.text} />
                    <Text style={[styles.menuLabel, { color: colors.text, fontSize: responsiveFontSizes.base, lineHeight: responsiveLineHeights.base }]}>{item.label}</Text>
                    {/* Proバッジ（Pro機能で未購読の場合） */}
                    {item.isPro && !isSubscribed && (
                      <View style={[styles.proBadge, { backgroundColor: colors.primary }]}>
                        <Text style={[styles.proBadgeText, { color: colors.onPrimary, fontSize: responsiveFontSizes.xs, lineHeight: responsiveLineHeights.xs }]}>Pro</Text>
                      </View>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
                {/* セパレーター（最後のアイテム以外） */}
                {index < menuItems.length - 1 && (
                  <View style={[styles.separator, { backgroundColor: colors.border }]} />
                )}
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* サブスクリプションカードセクション */}
        <View style={styles.menuSection}>
          <SubscriptionCard
            isSubscribed={isSubscribed}
            isLoading={authLoading || isLinkingAccount}
            onPress={handleSubscriptionPress}
          />
        </View>

        {/* アカウント認証セクション */}
        <View style={styles.menuSection}>
          <AccountAuthSection
            user={user}
            accountAuthStatus={accountAuthStatus}
            authLoading={authLoading}
            isLinkingAccount={isLinkingAccount}
            onAppleSignIn={handleAppleSignIn}
            onGoogleSignIn={handleGoogleSignIn}
            onLogout={handleLogout}
          />
        </View>

        {/* 開発者メニュー（開発モードのみ） */}
        {__DEV__ && (
          <DeveloperMenu
            onSubscriptionToggle={handleDevSubscriptionToggle}
            onAdsToggle={handleDevAdsToggle}
            onResetDatabase={handleResetDatabase}
          />
        )}
      </ScrollView>

      {/* キーボードガイドモーダル */}
      <KeyboardGuideModal
        visible={showKeyboardGuide}
        onClose={closeKeyboardGuide}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  menuSection: {
    padding: UI_CONSTANTS.GAP.LG,
  },
  menuGroup: {
    borderRadius: UI_CONSTANTS.BORDER_RADIUS.LG,
    borderWidth: UI_CONSTANTS.BORDER_WIDTH.THIN,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: UI_CONSTANTS.GAP.LG,
  },
  separator: {
    height: UI_CONSTANTS.BORDER_WIDTH.THIN,
    marginLeft: 56,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: UI_CONSTANTS.GAP.BASE,
    flex: 1,
  },
  menuLabel: {
    fontWeight: UI_CONSTANTS.FONT_WEIGHT.MEDIUM,
  },
  proBadge: {
    paddingHorizontal: UI_CONSTANTS.GAP.MD,
    paddingVertical: UI_CONSTANTS.GAP.XXS,
    borderRadius: UI_CONSTANTS.BORDER_RADIUS.SM,
    marginLeft: UI_CONSTANTS.GAP.MD,
  },
  /** Proバッジのテキスト（文字色は使用箇所でテーマの onPrimary を重ねる） */
  proBadgeText: {
    fontWeight: UI_CONSTANTS.FONT_WEIGHT.SEMIBOLD,
  },
});
