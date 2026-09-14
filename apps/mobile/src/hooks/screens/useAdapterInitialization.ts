/**
 * アダプター初期化カスタムフック
 *
 * アプリ起動時のアダプター初期化とシステム設定を管理するフック。
 * アプリデータ初期化は別フック（useAppInitialization）で行う。
 *
 * 主な責務:
 * - StatusBar設定（Android edge-to-edge対応）
 * - 画面回転制御（タブレット/携帯で異なる設定）
 * - ATT権限リクエスト（iOS）
 * - アダプター初期化（init()）
 * - 多言語システム初期化
 * - スプラッシュスクリーン表示制御（起動時App Open広告の準備の決着を待って閉じる）
 *
 * @see app/_layout.tsx - ルートレイアウトUI
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Platform, StatusBar } from 'react-native';
import * as SystemUI from 'expo-system-ui';
import * as ScreenOrientation from 'expo-screen-orientation';
import {
  useAdapterInitialization as useSharedAdapterInitialization,
  FREE_PROFILES_LIMIT,
  FREE_VARIABLES_LIMIT,
  Logger,
} from '@cliptap/shared';
import { useTracking } from '@hooks/useTracking';
import { initI18n } from '@i18n/config';
import { isTablet } from '@utils/responsive';
import { MobileDatabaseAdapter } from '@adapters/MobileDatabaseAdapter';
import { MobileCryptoAdapter } from '@adapters/MobileCryptoAdapter';
import { MobileSubscriptionAdapter } from '@adapters/MobileSubscriptionAdapter';
import { MobileClipboardAdapter } from '@adapters/MobileClipboardAdapter';
import { MobileLocaleAdapter } from '@adapters/MobileLocaleAdapter';
import { MobileI18nAdapter } from '@adapters/MobileI18nAdapter';
import { MobileFileIOAdapter } from '@adapters/MobileFileIOAdapter';
import { MobileFileShareAdapter } from '@adapters/MobileFileShareAdapter';
import { MobileAuthAdapter } from '@adapters/MobileAuthAdapter';
import { MobileExportAdapter } from '@adapters/MobileExportAdapter';
import { MobileImportAdapter } from '@adapters/MobileImportAdapter';
import { MobileSortPreferenceAdapter } from '@adapters/MobileSortPreferenceAdapter';

/* ======================================== */
/* 型定義 */
/* ======================================== */

/** useAdapterInitialization フックの返却値 */
export interface UseAdapterInitializationReturn {
  /** アダプター初期化完了フラグ */
  isAdaptersReady: boolean;
  /** スプラッシュスクリーン表示フラグ */
  showSplash: boolean;
  /** タブレット判定 */
  isTabletDevice: boolean;
  /** スプラッシュスクリーン非表示ハンドラ */
  hideSplash: () => void;
  /** 起動時App Open広告の準備が決着したか（スプラッシュはこれを待って閉じる） */
  isAppOpenAdSettled: boolean;
  /** 起動時App Open広告の準備の決着を受け取るハンドラ */
  handleAppOpenAdSettled: () => void;
}


/* ======================================== */
/* フック実装 */
/* ======================================== */

export function useAdapterInitialization(): UseAdapterInitializationReturn {
  /* ======================================== */
  /* 状態管理 */
  /* ======================================== */
  const [isAdaptersReady, setIsAdaptersReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  /** 起動時App Open広告の準備が決着したか（ロード完了、または表示しないと決まった） */
  const [isAppOpenAdSettled, setIsAppOpenAdSettled] = useState(false);

  /* ======================================== */
  /* Hooks */
  /* ======================================== */
  const { requestTrackingPermission } = useTracking();
  const isTabletDevice = isTablet();

  /* ======================================== */
  /* アダプター設定（初回のみ作成） */
  /* ======================================== */
  const adapterOptions = useMemo(() => {
    /* 依存関係のあるアダプターのインスタンスを先に作成 */
    const fileIOAdapter = new MobileFileIOAdapter();
    const fileShareAdapter = new MobileFileShareAdapter();

    return {
      adapters: {
        mainDB: new MobileDatabaseAdapter({ fileIO: fileIOAdapter }),
        systemDB: new MobileDatabaseAdapter({ fileIO: fileIOAdapter }),
        tempDb: new MobileDatabaseAdapter({ fileIO: fileIOAdapter }),
        crypto: new MobileCryptoAdapter(),
        subscription: new MobileSubscriptionAdapter(),
        clipboard: new MobileClipboardAdapter(),
        locale: new MobileLocaleAdapter(),
        i18n: new MobileI18nAdapter(),
        fileIO: fileIOAdapter,
        auth: new MobileAuthAdapter(),
        export: new MobileExportAdapter(fileIOAdapter, fileShareAdapter),
        import: new MobileImportAdapter(fileIOAdapter),
        sortPreference: new MobileSortPreferenceAdapter(),
      },
      adapterOptions: {
        subscription: {
          freeProfilesLimit: FREE_PROFILES_LIMIT,
          freeVariablesLimit: FREE_VARIABLES_LIMIT,
        },
      },
    };
  }, []);

  const { isAdaptersReady: sharedReady } = useSharedAdapterInitialization(adapterOptions);

  /* ======================================== */
  /* プラットフォーム固有の初期化 */
  /* ======================================== */
  useEffect(() => {
    async function initializePlatformSpecific() {
      if (!sharedReady) return;

      try {
        /* StatusBar設定（Androidのedge-to-edge対応） */
        if (Platform.OS === 'android') {
          await SystemUI.setBackgroundColorAsync('transparent');
          StatusBar.setTranslucent(true);
          StatusBar.setBarStyle('dark-content');
        }

        /* 画面回転制御（タブレット: 全方向、携帯: ポートレートのみ） */
        if (isTabletDevice) {
          await ScreenOrientation.lockAsync(
            ScreenOrientation.OrientationLock.PORTRAIT_UP
          );
          setTimeout(async () => {
            await ScreenOrientation.unlockAsync();
          }, 100);
        } else {
          await ScreenOrientation.lockAsync(
            ScreenOrientation.OrientationLock.PORTRAIT_UP
          );
        }

        /* ATT権限リクエスト（iOS専用、広告表示前に必須） */
        await requestTrackingPermission();

        await initI18n();

        setIsAdaptersReady(true);
      } catch (error) {
        Logger.error('Platform-specific initialization error:', error);
        setIsAdaptersReady(true);
      }
    }

    void initializePlatformSpecific();
  }, [sharedReady, isTabletDevice, requestTrackingPermission]);

  /* ======================================== */
  /* ハンドラ */
  /* ======================================== */

  const hideSplash = useCallback(() => {
    setShowSplash(false);
  }, []);

  /* 起動時App Open広告の準備が決着したら、スプラッシュを閉じてよい */
  const handleAppOpenAdSettled = useCallback(() => {
    setIsAppOpenAdSettled(true);
  }, []);

  return {
    isAdaptersReady,
    showSplash,
    isTabletDevice,
    hideSplash,
    isAppOpenAdSettled,
    handleAppOpenAdSettled,
  };
}
