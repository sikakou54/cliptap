import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setAuthAdapter } from '../../src/adapters/AuthAdapter';
import { setMainDbAdapter, setTempDbAdapter } from '../../src/adapters/DbAdapter';
import type { SubscriptionAdapter } from '../../src/adapters/SubscriptionAdapter';
import { CREATE_TABLES } from '../../src/database/schema';
import { ImportService } from '../../src/services/ImportService';
import { SubscriptionService } from '../../src/services/SubscriptionService';
import { createValidFlagsUpdater } from '../../src/services/validFlagsUpdater';
import type { SharedUser } from '../../src/types/Auth';
import {
  createMemoryDbAdapter,
  type MemoryDbAdapter,
} from '../helpers/memoryDbAdapter';

/**
 * 権利確認は外部通信のため失敗しうる。インポートはローカル業務機能であり、
 * 権利確認の失敗で中断させない。既知の最後の権利状態で有効フラグを計算する。
 */
describe('ImportService subscription refresh failure', () => {
  const databases: MemoryDbAdapter[] = [];
  let refreshCalls = 0;

  const signedInUser: SharedUser = {
    uid: 'test-uid',
    email: null,
    displayName: null,
    photoURL: null,
    isAnonymous: false,
    emailVerified: false,
  };

  /** 権利確認が必ず失敗するサブスクリプションアダプター */
  const failingAdapter: SubscriptionAdapter = {
    isSubscribed: () => false,
    isLoading: () => false,
    checkSubscription: async () => false,
    subscribe: () => () => {},
    notifyListeners: () => {},
    refreshCustomerInfo: async () => {
      refreshCalls += 1;
      throw new Error('network unreachable');
    },
  };

  beforeEach(() => {
    refreshCalls = 0;
    setAuthAdapter({
      signInWithGoogle: async () => {},
      signInWithApple: async () => {},
      signOut: async () => {},
      getCurrentUser: () => signedInUser,
      onAuthStateChanged: () => () => {},
    });
    SubscriptionService.setAdapter(failingAdapter);
    SubscriptionService.setValidFlagsUpdater(createValidFlagsUpdater());
  });

  afterEach(() => {
    databases.splice(0).forEach((db) => db.dispose());
  });

  const setupDatabases = (): { main: MemoryDbAdapter; backup: MemoryDbAdapter } => {
    const main = createMemoryDbAdapter();
    const backup = createMemoryDbAdapter();
    databases.push(main, backup);
    for (const db of [main, backup]) {
      for (const sql of Object.values(CREATE_TABLES)) void db.exec(sql);
    }
    setMainDbAdapter(main);
    setTempDbAdapter(backup);
    return { main, backup };
  };

  it('completes a full restore even if refreshing the entitlement fails', async () => {
    const { main, backup } = setupDatabases();

    main.run("INSERT INTO categories VALUES ('old', 'Old', NULL, 0, 'old-time')");
    backup.run("INSERT INTO categories VALUES ('new', 'Mail', NULL, 0, 'new-time')");
    backup.run(
      "INSERT INTO profiles VALUES ('main', 'Main', 1, 1, 1, 0, 'new-time', 'new-time')"
    );

    await expect(
      ImportService.importDatabaseFromTempDb('memory')
    ).resolves.toBeUndefined();

    expect(refreshCalls).toBe(1);
    expect(
      main.all<{ name: string }>('SELECT name FROM categories')
    ).toEqual([{ name: 'Mail' }]);
  });
});
