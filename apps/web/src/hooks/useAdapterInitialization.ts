import { useMemo } from 'react';
import { useAdapterInitialization as useSharedAdapterInitialization, FREE_PROFILES_LIMIT, FREE_VARIABLES_LIMIT } from '@cliptap/shared';
import { WebSubscriptionAdapter } from '@adapters/WebSubscriptionAdapter';
import { WebDatabaseAdapter } from '@adapters/WebDatabaseAdapter';
import { WebCryptoAdapter } from '@adapters/WebCryptoAdapter';
import { WebClipboardAdapter } from '@adapters/WebClipboardAdapter';
import { WebLocaleAdapter } from '@adapters/WebLocaleAdapter';
import { WebI18nAdapter } from '@adapters/WebI18nAdapter';
import { WebFileIOAdapter } from '@adapters/WebFileIOAdapter';
import { WebFileShareAdapter } from '@adapters/WebFileShareAdapter';
import { WebAuthAdapter } from '@adapters/WebAuthAdapter';
import { WebExportAdapter } from '@adapters/WebExportAdapter';
import { WebImportAdapter } from '@adapters/WebImportAdapter';
import { WebSortPreferenceAdapter } from '@adapters/WebSortPreferenceAdapter';
import { webDbCacheManager } from '@adapters/WebDbCacheManager';

/**
 * アダプター初期化フック
 *
 * アダプターの初期化のみを担当するシンプルなフック。
 * AuthProviderの外側で使用し、アダプター初期化完了後にAuthProviderをマウントする。
 *
 * 共通の初期化ロジックはsharedパッケージのuseAdapterInitializationを使用。
 */
export function useAdapterInitialization() {
  /* アダプター設定をメモ化（初回のみ作成） */
  const adapterOptions = useMemo(() => {
    /* 依存関係のあるアダプターのためのインスタンスを先に作成 */
    const fileIOAdapter = new WebFileIOAdapter();
    const fileShareAdapter = new WebFileShareAdapter();

    /* mainDBアダプターを作成（書き込み時にキャッシュ保存をスケジュール） */
    const mainDbAdapter = new WebDatabaseAdapter({
      fileIO: fileIOAdapter,
      onWrite: () => webDbCacheManager.scheduleSave(),
    });

    /* systemDBアダプターを作成（PRAGMA user_versionの更新もキャッシュへ反映させる） */
    const systemDbAdapter = new WebDatabaseAdapter({
      fileIO: fileIOAdapter,
      onWrite: () => webDbCacheManager.scheduleSave(),
    });

    return {
      adapters: {
        mainDB: mainDbAdapter,
        systemDB: systemDbAdapter,
        tempDb: new WebDatabaseAdapter({ fileIO: fileIOAdapter }),
        crypto: new WebCryptoAdapter(),
        subscription: new WebSubscriptionAdapter(),
        clipboard: new WebClipboardAdapter(),
        locale: new WebLocaleAdapter(),
        i18n: new WebI18nAdapter(),
        fileIO: fileIOAdapter,
        auth: new WebAuthAdapter(),
        export: new WebExportAdapter(fileShareAdapter),
        import: new WebImportAdapter(fileIOAdapter),
        sortPreference: new WebSortPreferenceAdapter(),
      },
      adapterOptions: {
        subscription: {
          freeProfilesLimit: FREE_PROFILES_LIMIT,
          freeVariablesLimit: FREE_VARIABLES_LIMIT,
        },
      },
    };
  }, []);

  /* 共通フックを使用 */
  return useSharedAdapterInitialization(adapterOptions);
}
