/**
 * @module PaywallScreen
 * @description サブスクリプション購入画面（Paywall）
 *
 * Proプランへのアップグレードを促す画面。
 *
 * @features
 * - Proプランの機能説明
 * - 月額/年間プランの選択
 * - 購入処理（RevenueCat経由）
 * - 購入復元機能
 * - 利用規約/プライバシーポリシーへのリンク
 *
 * @see src/hooks/screens/usePaywallScreen.ts - ビジネスロジック
 */

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useTranslation } from '@cliptap/shared'
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@lib/themeSystem';
import { ScreenContainer } from '@components/common/ScreenContainer';
import { usePaywallScreen } from '@hooks/screens/usePaywallScreen';

export default function PaywallScreen() {
  const { t } = useTranslation();
  const { colors, responsiveFontSizes, responsiveLineHeights } = useTheme();

  const {
    loading,
    purchasing,
    monthlyPackage,
    yearlyPackage,
    selectedPlan,
    currentPlan,
    selectPlan,
    handlePurchase,
    handleRestore,
    navigateToTerms,
    navigateToPrivacy,
  } = usePaywallScreen();

  /* 契約中プランの判定。ストア商品由来の currentPlan は年額を 'annual'、画面の選択状態 selectedPlan は 'yearly' と表すため、名称の食い違いをここで1度だけ吸収する */
  const isCurrentYearlyPlan = currentPlan === 'annual';
  const isCurrentMonthlyPlan = currentPlan === 'monthly';

  if (loading) {
    return (
      <ScreenContainer title="" backgroundColor={colors.background} fullScreenModal>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer title="" backgroundColor={colors.background} fullScreenModal>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleSection}>
          <Ionicons name="diamond" size={48} color={colors.primary} />
          <Text style={[styles.title, { color: colors.text, fontSize: responsiveFontSizes.xxl, lineHeight: responsiveLineHeights.xxl }]}>
            {t('subscription.title')}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary, fontSize: responsiveFontSizes.base, lineHeight: responsiveLineHeights.base }]}>
            {t('subscription.features_title')}
          </Text>
        </View>

        <View style={styles.featuresSection}>
          <FeatureItem
            icon="close-circle-outline"
            title={t('subscription.feature_no_ads')}
            description={t('subscription.feature_no_ads_desc')}
          />
          <FeatureItem
            icon="documents-outline"
            title={t('subscription.feature_unlimited_items')}
            description={t('subscription.feature_unlimited_items_desc')}
          />
          <FeatureItem
            icon="options-outline"
            title={t('subscription.feature_unlimited_profiles')}
            description={t('subscription.feature_unlimited_profiles_desc')}
          />
          <FeatureItem
            icon="code-slash-outline"
            title={t('subscription.feature_custom_variables')}
            description={t('subscription.feature_custom_variables_desc')}
          />
        </View>

        <View style={styles.plansSection}>
          {yearlyPackage && (
            <View
              style={[
                styles.planCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: selectedPlan === 'yearly' ? colors.primary : colors.border,
                  borderWidth: selectedPlan === 'yearly' ? 2 : 1,
                },
                isCurrentYearlyPlan && styles.disabledPlan,
              ]}
            >
              {isCurrentYearlyPlan && (
                <View style={[styles.disabledOverlay, { backgroundColor: colors.background }]} />
              )}
              <TouchableOpacity
                onPress={() => selectPlan('yearly')}
                activeOpacity={isCurrentYearlyPlan ? 1 : 0.7}
                disabled={isCurrentYearlyPlan}
                style={styles.planCardInner}
              >
                <View style={styles.planHeader}>
                  <View style={styles.planTitleRow}>
                    <Ionicons
                      name={selectedPlan === 'yearly' ? 'radio-button-on' : 'radio-button-off'}
                      size={24}
                      color={isCurrentYearlyPlan ? colors.textSecondary : (selectedPlan === 'yearly' ? colors.primary : colors.textSecondary)}
                    />
                    <Text style={[styles.planTitle, { color: isCurrentYearlyPlan ? colors.textSecondary : colors.text, fontSize: responsiveFontSizes.md, lineHeight: responsiveLineHeights.md }]}>
                      {t('subscription.yearly')}
                    </Text>
                    {isCurrentYearlyPlan && (
                      <View style={[styles.activeBadge, { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}>
                        <Text style={[styles.activeBadgeText, { color: colors.primary, fontSize: responsiveFontSizes.xs, lineHeight: responsiveLineHeights.xs }]}>
                          {t('subscription.subscribed')}
                        </Text>
                      </View>
                    )}
                  </View>
                  {!isCurrentYearlyPlan && (
                    <View style={[styles.badge, { backgroundColor: colors.success }]}>
                      <Text style={[styles.badgeText, { color: colors.onPrimary, fontSize: responsiveFontSizes.xs, lineHeight: responsiveLineHeights.xs }]}>{t('subscription.yearly_discount')}</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.planPrice, { color: isCurrentYearlyPlan ? colors.textSecondary : colors.text, fontSize: responsiveFontSizes.base, lineHeight: responsiveLineHeights.base }]}>
                  {yearlyPackage.priceString}{t('subscription.per_year')}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {monthlyPackage && (
            <View
              style={[
                styles.planCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: selectedPlan === 'monthly' ? colors.primary : colors.border,
                  borderWidth: selectedPlan === 'monthly' ? 2 : 1,
                },
                isCurrentMonthlyPlan && styles.disabledPlan,
              ]}
            >
              {isCurrentMonthlyPlan && (
                <View style={[styles.disabledOverlay, { backgroundColor: colors.background }]} />
              )}
              <TouchableOpacity
                onPress={() => selectPlan('monthly')}
                activeOpacity={isCurrentMonthlyPlan ? 1 : 0.7}
                disabled={isCurrentMonthlyPlan}
                style={styles.planCardInner}
              >
                <View style={styles.planHeader}>
                  <View style={styles.planTitleRow}>
                    <Ionicons
                      name={selectedPlan === 'monthly' ? 'radio-button-on' : 'radio-button-off'}
                      size={24}
                      color={isCurrentMonthlyPlan ? colors.textSecondary : (selectedPlan === 'monthly' ? colors.primary : colors.textSecondary)}
                    />
                    <Text style={[styles.planTitle, { color: isCurrentMonthlyPlan ? colors.textSecondary : colors.text, fontSize: responsiveFontSizes.md, lineHeight: responsiveLineHeights.md }]}>
                      {t('subscription.monthly')}
                    </Text>
                    {isCurrentMonthlyPlan && (
                      <View style={[styles.activeBadge, { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}>
                        <Text style={[styles.activeBadgeText, { color: colors.primary, fontSize: responsiveFontSizes.xs, lineHeight: responsiveLineHeights.xs }]}>
                          {t('subscription.subscribed')}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                <Text style={[styles.planPrice, { color: isCurrentMonthlyPlan ? colors.textSecondary : colors.text, fontSize: responsiveFontSizes.base, lineHeight: responsiveLineHeights.base }]}>
                  {monthlyPackage.priceString}{t('subscription.per_month')}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.purchaseButton, { backgroundColor: colors.primary }]}
          onPress={handlePurchase}
          disabled={purchasing}
        >
          {purchasing ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={[styles.purchaseButtonText, { color: colors.onPrimary, fontSize: responsiveFontSizes.md, lineHeight: responsiveLineHeights.md }]}>
              {t('subscription.subscribe')}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.restoreButton}
          onPress={handleRestore}
          disabled={purchasing}
        >
          <Text style={[styles.restoreButtonText, { color: colors.primary, fontSize: responsiveFontSizes.md, lineHeight: responsiveLineHeights.md }]}>
            {t('subscription.restore')}
          </Text>
        </TouchableOpacity>

        <View style={styles.legalLinksContainer}>
          <TouchableOpacity
            onPress={navigateToTerms}
            disabled={purchasing}
          >
            <Text style={[styles.legalLinkText, { color: colors.textSecondary, fontSize: responsiveFontSizes.sm, lineHeight: responsiveLineHeights.sm }]}>
              {t('settings.terms')}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.legalSeparator, { color: colors.textSecondary, fontSize: responsiveFontSizes.sm, lineHeight: responsiveLineHeights.sm }]}>
            {' • '}
          </Text>
          <TouchableOpacity
            onPress={navigateToPrivacy}
            disabled={purchasing}
          >
            <Text style={[styles.legalLinkText, { color: colors.textSecondary, fontSize: responsiveFontSizes.sm, lineHeight: responsiveLineHeights.sm }]}>
              {t('settings.privacy')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={purchasing}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <View style={[styles.loadingOverlay, { backgroundColor: colors.overlay }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Modal>
    </ScreenContainer>
  );
}

interface FeatureItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
}

function FeatureItem({ icon, title, description }: FeatureItemProps) {
  const { colors, responsiveFontSizes, responsiveLineHeights } = useTheme();

  return (
    <View style={styles.featureItem}>
      <View style={[styles.featureIcon, { backgroundColor: colors.primary + '20' }]}>
        <Ionicons name={icon} size={24} color={colors.primary} />
      </View>
      <View style={styles.featureContent}>
        <Text style={[styles.featureTitle, { color: colors.text, fontSize: responsiveFontSizes.md, lineHeight: responsiveLineHeights.md }]}>{title}</Text>
        <Text style={[{ color: colors.textSecondary, fontSize: responsiveFontSizes.sm, lineHeight: responsiveLineHeights.sm }]}>
          {description}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 24,
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
  },
  featuresSection: {
    marginBottom: 32,
    gap: 20,
  },
  featureItem: {
    flexDirection: 'row',
    gap: 16,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureContent: {
    flex: 1,
    gap: 4,
  },
  featureTitle: {
    fontWeight: '600',
  },
  plansSection: {
    marginBottom: 24,
    gap: 12,
  },
  planCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  planCardInner: {
    padding: 20,
    gap: 12,
  },
  /* 契約中プランのカードは、カード自体を opacity 0.4 にしたうえで背景色のオーバーレイを opacity 0.7 で重ねる2層構成でトーンダウンさせている */
  disabledPlan: {
    opacity: 0.4,
  },
  disabledOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.7,
    zIndex: 1,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  planTitle: {
    fontWeight: '600',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  /** バッジのテキスト（文字色は使用箇所でテーマの onPrimary を重ねる） */
  badgeText: {
    fontWeight: '600',
  },
  activeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  activeBadgeText: {
    fontWeight: '600',
  },
  planPrice: {
    fontWeight: '700',
    marginLeft: 36,
  },
  purchaseButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  /** 購入ボタンのテキスト（文字色は使用箇所でテーマの onPrimary を重ねる） */
  purchaseButtonText: {
    fontWeight: '600',
  },
  restoreButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  restoreButtonText: {
    fontWeight: '600',
  },
  legalLinksContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 24,
  },
  legalLinkText: {
    textDecorationLine: 'underline',
  },
  legalSeparator: {
    marginHorizontal: 4,
  },
  /** 購入処理中の遮蔽（背景色は使用箇所でテーマの overlay を重ねる） */
  loadingOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
