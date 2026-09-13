/**
 * 開発者メニューの広告非表示スイッチ
 *
 * @description
 * 開発ビルド（__DEV__）でだけ、バナー広告と起動時App Open広告をまとめて非表示にする。
 * スクリーンショットの撮影や、広告に邪魔されずに動作確認したいときに使う。
 * 本番ビルドでは保存値を読まず、常に「非表示にしない」として扱う。
 *
 * @see src/hooks/screens/useDevMenu.ts - 切り替え操作
 * @see src/components/ads/AdBanner.tsx - バナー広告
 * @see src/hooks/useAppOpenAd.ts - 起動時App Open広告
 * @module devAdsOverride
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Logger } from '@cliptap/shared';

/** 広告を非表示にしているかの保存キー */
const DEV_ADS_DISABLED_KEY = '@dev_ads_disabled';

/** 広告を非表示にしていることを表す値 */
const DEV_ADS_DISABLED_VALUE = '1';

/**
 * 開発者メニューで広告を非表示にしているか
 *
 * 本番ビルドと、読み出しに失敗した場合は false を返す（広告を出す側へ倒す）。
 */
export async function isDevAdsDisabled(): Promise<boolean> {
  if (!__DEV__) return false;

  try {
    return (await AsyncStorage.getItem(DEV_ADS_DISABLED_KEY)) === DEV_ADS_DISABLED_VALUE;
  } catch (error) {
    Logger.error('[devAdsOverride] Failed to read the ads switch:', error);
    return false;
  }
}

/**
 * 広告の非表示を保存する（開発ビルドのみ）
 *
 * @param disabled - true で広告を非表示にする
 */
export async function setDevAdsDisabled(disabled: boolean): Promise<void> {
  if (!__DEV__) return;

  if (disabled) {
    await AsyncStorage.setItem(DEV_ADS_DISABLED_KEY, DEV_ADS_DISABLED_VALUE);
  } else {
    await AsyncStorage.removeItem(DEV_ADS_DISABLED_KEY);
  }
}
