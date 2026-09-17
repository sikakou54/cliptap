/**
 * 開発者メニューフック
 *
 * DEVモードでのみ使用される開発者向け機能を提供。
 * データベース操作、サブスクリプション状態のテスト等。
 *
 * @remarks
 * このフックは__DEV__モードでのみ有効な機能を提供します。
 * 本番ビルドでは使用しないでください。
 *
 * @see useSettingsScreen - 設定画面から呼び出される
 */

import { useCallback } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { Logger, useSharedSubscription } from '@cliptap/shared';
import { database } from '@database/database';
import { showConfirm, showAlert, showErrorAlert } from '@utils/alerts';
import { setDevAdsDisabled } from '@utils/devAdsOverride';
import * as Updates from 'expo-updates';

/** useDevMenu フックの返却値 */
export interface UseDevMenuReturn {
  /** サブスクリプション状態切り替え */
  handleDevSubscriptionToggle: () => Promise<void>;
  /** 広告の表示・非表示切り替え */
  handleDevAdsToggle: () => void;
  /** データベースリセット */
  handleResetDatabase: () => Promise<void>;
  /** 撮影用ホストを開く */
  handleOpenCaptureHost: () => void;
}

/**
 * 開発者メニュー用フック
 * DEVモードでのデバッグ・テスト機能を提供
 */
export function useDevMenu(): UseDevMenuReturn {
  const { setDevSubscriptionOverride } = useSharedSubscription();

  /* ======================================== */
  /* イベントハンドラ */
  /* ======================================== */

  const handleDevSubscriptionToggle = useCallback(async () => {
    Alert.alert(
      'Subscription Override',
      'Choose subscription status for keyboard extension',
      [
        {
          text: 'Free',
          onPress: async () => {
            await setDevSubscriptionOverride(false);
            Alert.alert(
              'Dev Mode - Free',
              '🆓 無料版に設定しました\n\n画面が自動的に更新されます'
            );
          },
        },
        {
          text: 'Pro (期限内)',
          onPress: async () => {
            await setDevSubscriptionOverride(true);
            Alert.alert(
              'Dev Mode - Pro',
              '✅ Pro版（期限内）に設定しました\n\n画面が自動的に更新されます'
            );
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  }, [setDevSubscriptionOverride]);

  const handleDevAdsToggle = useCallback(() => {
    /* 起動時App Open広告は起動時にしか判定しないため、保存後にアプリを再読み込みして起動からやり直す */
    const apply = async (disabled: boolean) => {
      try {
        await setDevAdsDisabled(disabled);
        await Updates.reloadAsync();
      } catch (error) {
        Logger.error('[Dev] Failed to switch ads:', error);
        showErrorAlert('Failed to switch ads: ' + String(error));
      }
    };

    Alert.alert(
      'Ads Override',
      'Show or hide banner and App Open ads. App will reload.',
      [
        { text: 'Show Ads', onPress: () => void apply(false) },
        { text: 'Hide Ads', onPress: () => void apply(true) },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }, []);

  const handleResetDatabase = useCallback(async () => {
    showConfirm(
      'This will delete ALL data and seed test data. App will reload. Continue?',
      async () => {
        try {
          Logger.debug('[Dev] Resetting database...');
          await database.reset();
          Logger.debug('[Dev] Seeding test data...');
          /* シード処理はリセット実行時にだけ読み込む（本番バンドルからの除外は metro.config.js の解決差し替えで行う） */
          const { runSeed } = await import('@database/seed');
          await runSeed();
          Logger.debug('[Dev] Database reset complete!');

          showAlert(
            'Success',
            'Database reset complete! App will reload now.',
            undefined,
            async () => {
              if (__DEV__) {
                await Updates.reloadAsync();
              }
            }
          );
        } catch (error) {
          Logger.error('[Dev] Failed to reset database:', error);
          showErrorAlert('Failed to reset database: ' + String(error));
        }
      },
      undefined,
      'danger'
    );
  }, []);

  /* ストア掲載画像の撮影に使うホストを開く（app/capture-host.tsx を参照） */
  const handleOpenCaptureHost = useCallback(() => {
    router.push('/capture-host');
  }, []);

  return {
    handleDevSubscriptionToggle,
    handleDevAdsToggle,
    handleResetDatabase,
    handleOpenCaptureHost,
  };
}
