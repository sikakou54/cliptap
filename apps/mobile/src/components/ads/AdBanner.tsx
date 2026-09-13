/**
 * AdMobバナー広告コンポーネント
 *
 * 画面下部に表示されるAdMobバナー広告。
 * iOS/Android両対応、ATT（App Tracking Transparency）対応。
 *
 * 主な機能:
 * - iOS: ATTステータスに基づくパーソナライズ広告の制御
 * - Android: 非パーソナライズ広告のみ
 * - 開発時: テスト広告IDを使用
 * - Proプラン: 広告非表示
 * - SafeArea対応（下部余白）
 *
 * 表示条件:
 * - 無料プランのユーザーのみ
 * - トラッキングステータス取得完了後
 *
 * @see useSharedSubscription - サブスクリプション状態管理
 * @see useTracking - ATTトラッキング管理
 */

import { useEffect, useState } from 'react';
import { View, StyleSheet, Platform, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { useTheme } from '@lib/themeSystem';
import { useTracking } from '@hooks/useTracking';
import { Logger, useSharedSubscription } from '@cliptap/shared';
import { isDevAdsDisabled } from '@utils/devAdsOverride';

/* ========================================
   Props定義
   ======================================== */

/**
 * AdBannerのProps
 * @property style - カスタムスタイル（オプション）
 */
interface AdBannerProps {
  style?: StyleProp<ViewStyle>;
}

/* ========================================
   定数定義
   ======================================== */

/**
 * AdMob広告ユニットID（プラットフォーム別）
 * 本番環境でのみ使用される
 */
const AD_UNIT_IDS = {
  ios: 'ca-app-pub-5616727577619398/2326888854',
  android: 'ca-app-pub-5616727577619398/1768536958',
};

export function AdBanner({ style }: AdBannerProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { shouldShowAds } = useSharedSubscription();
  const { getTrackingStatus } = useTracking();

  /**
   * ATT権限ステータス
   * iOSのみ非同期取得が必要なため初期値をnullにする。
   * AndroidにはATTが無いため初期化時点で'unknown'で確定する。
   */
  const [trackingStatus, setTrackingStatus] = useState<string | null>(() =>
    Platform.OS === 'ios' ? null : 'unknown'
  );

  /**
   * ATT権限ステータスの取得（iOSのみ）
   * ATTダイアログの結果を取得し、パーソナライズ広告の可否を決定する
   */
  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    async function checkTrackingStatus() {
      const status = await getTrackingStatus();
      setTrackingStatus(status);
    }

    checkTrackingStatus().catch((error) =>
      Logger.error('Check tracking status failed:', error)
    );
  }, [getTrackingStatus]);

  /**
   * 開発者メニューで広告を非表示にしているか
   * 開発ビルドでは保存値を読むまでnullにし、一瞬バナーを出してから消すちらつきを避ける。
   * 本番ビルドは保存値を読まないため初期化時点でfalseに確定する。
   */
  const [isAdsDisabledByDev, setIsAdsDisabledByDev] = useState<boolean | null>(() =>
    __DEV__ ? null : false
  );

  /**
   * 開発者メニューの広告非表示スイッチの読み込み（開発ビルドのみ）
   */
  useEffect(() => {
    if (!__DEV__) return;

    void isDevAdsDisabled().then(setIsAdsDisabledByDev);
  }, []);

  /**
   * 広告ユニットID
   * 開発時: テストID、本番時: プラットフォーム別の本番ID
   */
  const adUnitId = __DEV__
    ? TestIds.ADAPTIVE_BANNER
    : Platform.select({
        ios: AD_UNIT_IDS.ios,
        android: AD_UNIT_IDS.android,
      })!;

  if (isAdsDisabledByDev !== false) {
    return null;
  }

  if (!shouldShowAds()) {
    return null;
  }

  if (Platform.OS === 'ios' && !trackingStatus) {
    return null;
  }

  /* AdMobバナー広告コンテナ（画面下部に表示） */
  return (
    <View style={[
      styles.container,
      {
        backgroundColor: colors.background,
        borderTopColor: colors.border,
        paddingBottom: insets.bottom,
      },
      style
    ]}>
      {/* AdMobバナー広告 */}
      <BannerAd
        unitId={adUnitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{
          /*
           * AndroidにはATTのgranted状態がないため、常に非パーソナライズ広告を要求する。
           * EEA/UK向けCMP・UMP要件は配信地域に応じて法務確認する。
           */
          requestNonPersonalizedAdsOnly: trackingStatus !== 'granted',
        }}
        onAdLoaded={() => {
          Logger.debug('Ad loaded successfully');
        }}
        onAdFailedToLoad={(error) => {
          Logger.error('Ad failed to load:', error);
        }}
      />
    </View>
  );
}

/* ========================================
   スタイル定義
   ======================================== */
const styles = StyleSheet.create({
  /** 広告コンテナ（背景色と上境界線の色は使用箇所でテーマから重ねる） */
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    borderTopWidth: 1,
  },
});
