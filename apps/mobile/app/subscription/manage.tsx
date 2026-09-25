/**
 * @module ManageSubscriptionScreen
 * @description サブスクリプション管理画面
 *
 * 現在のサブスクリプション状態を表示し、プラン管理を行う画面。
 *
 * @features
 * - 現在のプラン状態表示（無料/月額/年間）
 * - 次回請求日の表示
 * - Proプランの機能一覧表示
 * - App Store/Google Playのサブスクリプション設定への誘導
 * - 購入復元機能
 *
 * @see src/hooks/screens/useManageSubscriptionScreen.ts - ビジネスロジック
 */

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { useTranslation } from '@cliptap/shared'
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@lib/themeSystem';
import { ScreenContainer } from '@components/common/ScreenContainer';
import { KeyboardGuideModal } from '@components/settings';
import { useManageSubscriptionScreen } from '@hooks/screens/useManageSubscriptionScreen';

/**
 * Proプランの機能カード定義
 *
 * 各カードはアイコンと翻訳キーだけが違う同一構造のため、差分をデータとして並べる。
 * 翻訳キーはリテラルで保持し、grep で参照箇所を追えるようにしている。
 */
const PRO_FEATURES = [
  { icon: 'close-circle-outline', titleKey: 'subscription.feature_no_ads', descKey: 'subscription.feature_no_ads_desc' },
  { icon: 'documents-outline', titleKey: 'subscription.feature_unlimited_items', descKey: 'subscription.feature_unlimited_items_desc' },
  { icon: 'options-outline', titleKey: 'subscription.feature_unlimited_profiles', descKey: 'subscription.feature_unlimited_profiles_desc' },
  { icon: 'code-slash-outline', titleKey: 'subscription.feature_custom_variables', descKey: 'subscription.feature_custom_variables_desc' },
] as const;

export default function ManageSubscriptionScreen() {
  const { t, language } = useTranslation();
  const { colors, responsiveFontSizes, responsiveLineHeights } = useTheme();

  /* 次回更新日の書式ロケール。判定式は systemVariables.ts の normalizeLocale と揃えている */
  const dateLocale = language.startsWith('ja') ? 'ja-JP' : 'en-US';

  const {
    isSubscribed,
    expirationDate,
    currentPlan,
    restoring,
    showKeyboardGuide,
    setShowKeyboardGuide,
    handleOpenSubscriptionSettings,
    handleRestore,
    handleOpenKeyboardSettings,
    navigateToPaywall,
  } = useManageSubscriptionScreen();

  return (
    <ScreenContainer title={t('subscription.manage')} backIcon="arrow-back">
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.statusCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.statusHeader}>
            <Ionicons
              name={isSubscribed ? 'checkmark-circle' : 'information-circle-outline'}
              size={48}
              color={isSubscribed ? colors.success : colors.textSecondary}
            />
            <Text style={[styles.statusTitle, { color: colors.text, fontSize: responsiveFontSizes.base, lineHeight: responsiveLineHeights.base }]}>
              {isSubscribed ? t('subscription.subscribed') : t('subscription.not_subscribed')}
            </Text>
          </View>

          {isSubscribed && currentPlan && (
            <View style={styles.statusInfo}>
              <View style={[styles.currentPlanBadge, { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}>
                <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                <Text style={[styles.currentPlanText, { color: colors.primary, fontSize: responsiveFontSizes.base, lineHeight: responsiveLineHeights.base }]}>
                  {currentPlan === 'monthly' ? t('subscription.monthly') : t('subscription.yearly')} - {t('subscription.subscribed')}
                </Text>
              </View>
              {expirationDate && (
                <View style={styles.dateInfo}>
                  <Text style={[styles.statusLabel, { color: colors.textSecondary, fontSize: responsiveFontSizes.sm, lineHeight: responsiveLineHeights.sm }]}>
                    {t('subscription.next_billing_date')}
                  </Text>
                  <Text style={[styles.statusValue, { color: colors.text, fontSize: responsiveFontSizes.base, lineHeight: responsiveLineHeights.base }]}>
                    {expirationDate.toLocaleDateString(dateLocale, {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text, fontSize: responsiveFontSizes.base, lineHeight: responsiveLineHeights.base }]}>
            {t('subscription.features_title')}
          </Text>

          {/* Proプランの機能カード */}
          {PRO_FEATURES.map((feature) => (
            <View key={feature.icon} style={[styles.featureCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name={feature.icon} size={24} color={colors.primary} />
              <View style={styles.featureText}>
                <Text style={[styles.featureTitle, { color: colors.text, fontSize: responsiveFontSizes.base, lineHeight: responsiveLineHeights.base }]}>
                  {t(feature.titleKey)}
                </Text>
                <Text style={[styles.featureDescription, { color: colors.textSecondary, fontSize: responsiveFontSizes.sm, lineHeight: responsiveLineHeights.sm }]}>
                  {t(feature.descKey)}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text, fontSize: responsiveFontSizes.base, lineHeight: responsiveLineHeights.base }]}>
            {t('subscription.manage_subscription')}
          </Text>

          {isSubscribed && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={handleOpenSubscriptionSettings}
            >
              <Ionicons name="settings-outline" size={24} color={colors.text} />
              <Text style={[styles.actionButtonText, { color: colors.text, fontSize: responsiveFontSizes.base, lineHeight: responsiveLineHeights.base }]}>
                {t('subscription.open_settings')}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={handleRestore}
            disabled={restoring}
          >
            <Ionicons name="refresh-outline" size={24} color={colors.text} />
            <Text style={[styles.actionButtonText, { color: colors.text, fontSize: responsiveFontSizes.base, lineHeight: responsiveLineHeights.base }]}>
              {t('subscription.restore')}
            </Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={handleOpenKeyboardSettings}
          >
            <Ionicons name="keypad-outline" size={24} color={colors.text} />
            <Text style={[styles.actionButtonText, { color: colors.text, fontSize: responsiveFontSizes.base, lineHeight: responsiveLineHeights.base }]}>
              {t('subscription.enable_keyboard')}
            </Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          {!isSubscribed && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.primary }]}
              onPress={navigateToPaywall}
            >
              <Ionicons name="star" size={24} color={colors.onPrimary} />
              <Text style={[styles.actionButtonText, { color: colors.onPrimary, fontSize: responsiveFontSizes.base, lineHeight: responsiveLineHeights.base }]}>
                {t('subscription.subscribe')}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={colors.onPrimary} />
            </TouchableOpacity>
          )}
        </View>

        {isSubscribed && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text, fontSize: responsiveFontSizes.base, lineHeight: responsiveLineHeights.base }]}>
              {t('subscription.how_to_cancel')}
            </Text>
            <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[{ color: colors.textSecondary, fontSize: responsiveFontSizes.sm, lineHeight: responsiveLineHeights.sm }]}>
                {Platform.OS === 'ios' ? t('subscription.cancel_steps_ios') : t('subscription.cancel_steps_android')}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* キーボード設定ガイドモーダル（設定画面と同一の正本コンポーネントを再利用する） */}
      <KeyboardGuideModal
        visible={showKeyboardGuide}
        onClose={() => setShowKeyboardGuide(false)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
  },
  statusCard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
    alignItems: 'center',
  },
  statusHeader: {
    alignItems: 'center',
    gap: 12,
  },
  statusTitle: {
    fontWeight: '600',
  },
  statusInfo: {
    marginTop: 16,
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  currentPlanBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  currentPlanText: {
    fontWeight: '600',
  },
  dateInfo: {
    alignItems: 'center',
    gap: 4,
  },
  statusLabel: {
  },
  statusValue: {
    fontWeight: '600',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: 16,
  },
  featureCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    gap: 12,
  },
  featureText: {
    flex: 1,
    gap: 4,
  },
  featureTitle: {
    fontWeight: '600',
  },
  featureDescription: {
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    gap: 12,
  },
  actionButtonText: {
    flex: 1,
    fontWeight: '500',
  },
  infoCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
});
