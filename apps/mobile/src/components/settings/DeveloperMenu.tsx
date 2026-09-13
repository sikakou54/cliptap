/**
 * 開発者メニュー
 *
 * 開発モード（__DEV__）でのみ表示されるデバッグ機能メニュー。
 * サブスクリプション状態の上書き・広告の非表示・DBリセットの3機能を提供。
 *
 * 開発者専用メニューのため、表示文言は英語固定とし i18n キーを持たない。
 * app/settings/index.tsx の __DEV__ 判定配下でのみ描画されるため、
 * リリースビルドの利用者には表示されない。
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@lib/themeSystem';
import { UI_CONSTANTS } from '@constants/ui';

interface DeveloperMenuProps {
  onSubscriptionToggle: () => void;
  onAdsToggle: () => void;
  onResetDatabase: () => void;
}

interface MenuItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  description: string;
  onPress: () => void;
}

function DevMenuItem({ icon, iconColor, title, description, onPress }: MenuItemProps) {
  const { colors, responsiveFontSizes, responsiveLineHeights } = useTheme();

  return (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* 左側: アイコン+テキスト */}
      <View style={styles.menuLeft}>
        {/* メニューアイコン */}
        <Ionicons name={icon} size={24} color={iconColor} />
        {/* テキストエリア */}
        <View style={styles.devMenuText}>
          {/* タイトル */}
          <Text style={[styles.devMenuTitle, { color: iconColor, fontSize: responsiveFontSizes.base, lineHeight: responsiveLineHeights.base }]}>
            {title}
          </Text>
          {/* 説明文 */}
          <Text style={{ color: colors.textSecondary, fontSize: responsiveFontSizes.sm, lineHeight: responsiveLineHeights.sm }}>
            {description}
          </Text>
        </View>
      </View>
      {/* 右側: 矢印アイコン */}
      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
    </TouchableOpacity>
  );
}

export function DeveloperMenu({
  onSubscriptionToggle,
  onAdsToggle,
  onResetDatabase,
}: DeveloperMenuProps) {
  const { colors, responsiveFontSizes, responsiveLineHeights } = useTheme();

  const menuItems = [
    {
      id: 'subscription',
      icon: 'bug-outline' as const,
      iconColor: colors.text,
      title: 'Subscription Override',
      description: 'Test keyboard extension states',
      onPress: onSubscriptionToggle,
    },
    {
      id: 'ads',
      icon: 'eye-off-outline' as const,
      iconColor: colors.text,
      title: 'Ads Override',
      description: 'Show or hide banner and App Open ads',
      onPress: onAdsToggle,
    },
    {
      id: 'reset',
      icon: 'refresh-outline' as const,
      iconColor: colors.error,
      title: 'Reset Database',
      description: 'Delete all data and seed test data',
      onPress: onResetDatabase,
    },
  ];

  /* 開発者メニューセクション */
  return (
    <View style={styles.menuSection}>
      {/* セクションタイトル */}
      <Text style={[styles.sectionTitle, { color: colors.textSecondary, fontSize: responsiveFontSizes.xs, lineHeight: responsiveLineHeights.xs }]}>
        Developer Menu
      </Text>
      {/* メニューグループ（カード形式） */}
      <View style={[styles.menuGroup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {menuItems.map((item, index) => (
          <React.Fragment key={item.id}>
            {/* 開発者メニューアイテム */}
            <DevMenuItem
              icon={item.icon}
              iconColor={item.iconColor}
              title={item.title}
              description={item.description}
              onPress={item.onPress}
            />
            {/* セパレーター（最後のアイテム以外） */}
            {index < menuItems.length - 1 && (
              <View style={[styles.separator, { backgroundColor: colors.border }]} />
            )}
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

/* ========================================
   スタイル定義
   ======================================== */
const styles = StyleSheet.create({
  /** メニューセクション全体 */
  menuSection: {
    padding: UI_CONSTANTS.GAP.LG,
  },
  /** セクションタイトル */
  sectionTitle: {
    fontWeight: UI_CONSTANTS.FONT_WEIGHT.SEMIBOLD,
    marginBottom: UI_CONSTANTS.GAP.MD,
    marginLeft: UI_CONSTANTS.GAP.XS,
    textTransform: 'uppercase',
  },
  /** メニューグループ（カード） */
  menuGroup: {
    borderRadius: UI_CONSTANTS.BORDER_RADIUS.LG,
    borderWidth: UI_CONSTANTS.BORDER_WIDTH.THIN,
    overflow: 'hidden',
  },
  /** メニュー項目1行 */
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: UI_CONSTANTS.GAP.LG,
  },
  /** 左側エリア（アイコン+テキスト） */
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: UI_CONSTANTS.GAP.BASE,
    flex: 1,
  },
  /** 区切り線 */
  separator: {
    height: UI_CONSTANTS.BORDER_WIDTH.THIN,
    marginLeft: 56,
  },
  /** テキストエリア（タイトル+説明） */
  devMenuText: {
    gap: UI_CONSTANTS.GAP.XS,
  },
  /** メニュータイトル */
  devMenuTitle: {
    fontWeight: UI_CONSTANTS.FONT_WEIGHT.SEMIBOLD,
  },
});
