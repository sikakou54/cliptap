import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { SubscriptionAdapter } from '../../src/adapters/SubscriptionAdapter';
import {
  FREE_PROFILES_LIMIT,
  FREE_SHORTCUT_VALUES_LIMIT,
  FREE_SHORTCUTS_LIMIT,
  FREE_SNIPPETS_LIMIT,
  FREE_VARIABLES_LIMIT,
  SubscriptionService,
} from '../../src/services/SubscriptionService';

/**
 * 追加可否の判定は「無効なものも含む保存済み総数」で行う。
 *
 * 有効数で判定すると、上限超過で無効になった項目を抱えたまま追加を許してしまい、
 * 保存時に総数で拒否されて入力が無駄になる。判定基準は共通のSubscriptionServiceに
 * 一本化し、各画面が上限値の比較を書き直さないようにする。
 */
describe('add limit judgement', () => {
  /** 指定した権利状態のサブスクリプションアダプターを作る */
  const adapterFor = (subscribed: boolean): SubscriptionAdapter => ({
    isSubscribed: () => subscribed,
    isLoading: () => false,
    checkSubscription: async () => subscribed,
    subscribe: () => () => {},
    notifyListeners: () => {},
    refreshCustomerInfo: async () => {},
  });

  describe('SubscriptionService', () => {
    it('blocks a free user at the limit and allows a subscriber past it', () => {
      SubscriptionService.setAdapter(adapterFor(false));
      expect(SubscriptionService.canAddProfile(FREE_PROFILES_LIMIT - 1)).toBe(true);
      expect(SubscriptionService.canAddProfile(FREE_PROFILES_LIMIT)).toBe(false);
      expect(SubscriptionService.canAddVariable(FREE_VARIABLES_LIMIT - 1)).toBe(true);
      expect(SubscriptionService.canAddVariable(FREE_VARIABLES_LIMIT)).toBe(false);

      SubscriptionService.setAdapter(adapterFor(true));
      expect(SubscriptionService.canAddProfile(FREE_PROFILES_LIMIT)).toBe(true);
      expect(SubscriptionService.canAddVariable(FREE_VARIABLES_LIMIT)).toBe(true);
    });

    it('stops new snippets from 50 and shortcuts from 10 for a free user, including totals kept beyond them', () => {
      expect(FREE_SNIPPETS_LIMIT).toBe(50);
      expect(FREE_SHORTCUTS_LIMIT).toBe(10);

      SubscriptionService.setAdapter(adapterFor(false));
      expect(SubscriptionService.canAddSnippet(FREE_SNIPPETS_LIMIT - 1)).toBe(true);
      expect(SubscriptionService.canAddSnippet(FREE_SNIPPETS_LIMIT)).toBe(false);
      expect(SubscriptionService.canAddShortcut(FREE_SHORTCUTS_LIMIT - 1)).toBe(true);
      expect(SubscriptionService.canAddShortcut(FREE_SHORTCUTS_LIMIT)).toBe(false);
      /* 復元やProからの切替で上限を超えて保持している場合も、追加だけを止める */
      expect(SubscriptionService.canAddSnippet(FREE_SNIPPETS_LIMIT + 10)).toBe(false);
      expect(SubscriptionService.canAddShortcut(FREE_SHORTCUTS_LIMIT + 10)).toBe(false);

      SubscriptionService.setAdapter(adapterFor(true));
      expect(SubscriptionService.canAddSnippet(FREE_SNIPPETS_LIMIT + 10)).toBe(true);
      expect(SubscriptionService.canAddShortcut(FREE_SHORTCUTS_LIMIT + 10)).toBe(true);
    });

    it('stops adding a value to a shortcut from 2 values for a free user, including shortcuts that already hold more', () => {
      expect(FREE_SHORTCUT_VALUES_LIMIT).toBe(2);

      SubscriptionService.setAdapter(adapterFor(false));
      expect(SubscriptionService.canAddShortcutValue(FREE_SHORTCUT_VALUES_LIMIT - 1)).toBe(true);
      expect(SubscriptionService.canAddShortcutValue(FREE_SHORTCUT_VALUES_LIMIT)).toBe(false);
      expect(SubscriptionService.canAddShortcutValue(FREE_SHORTCUT_VALUES_LIMIT + 3)).toBe(false);

      SubscriptionService.setAdapter(adapterFor(true));
      expect(SubscriptionService.canAddShortcutValue(FREE_SHORTCUT_VALUES_LIMIT + 3)).toBe(true);
    });
  });

  /**
   * 判定基準は画面ごとに書けてしまうため、実装のソースで固定する。
   * フックのため実DBテストから直接呼べず、食い違いは実機でしか現れないためである。
   */
  describe('screen implementations', () => {
    const root = resolve(import.meta.dirname, '../../../..');
    const read = (path: string): string => readFileSync(resolve(root, path), 'utf8');

    let mobileProfiles = '';
    let mobileProfileEdit = '';
    let mobileVariables = '';
    let webProfiles = '';
    let webVariables = '';
    let mobileItemLimitGuard = '';
    let mobileHome = '';
    let mobileHomeShortcuts = '';
    let mobileSnippetForm = '';
    let mobileShortcutEdit = '';
    let webSnippetModal = '';

    beforeEach(() => {
      mobileProfiles = read('apps/mobile/src/hooks/screens/useProfilesScreen.ts');
      mobileProfileEdit = read('apps/mobile/src/hooks/screens/useProfileEditScreen.ts');
      mobileVariables = read('apps/mobile/src/hooks/screens/useVariablesScreen.ts');
      webProfiles = read('apps/web/src/hooks/screens/useProfilesScreen.ts');
      webVariables = read('apps/web/src/hooks/screens/useVariablesScreen.ts');
      mobileItemLimitGuard = read('apps/mobile/src/hooks/useItemLimitGuard.ts');
      mobileHome = read('apps/mobile/src/hooks/screens/useHomeScreen.ts');
      mobileHomeShortcuts = read('apps/mobile/src/hooks/screens/useHomeShortcuts.ts');
      mobileSnippetForm = read('apps/mobile/src/hooks/screens/useSnippetFormScreen.ts');
      mobileShortcutEdit = read('apps/mobile/src/hooks/screens/useShortcutEditScreen.ts');
      webSnippetModal = read('apps/web/src/hooks/screens/useSnippetModal.ts');
    });

    it('counts every saved profile, including disabled ones', () => {
      /* 一覧の追加ボタンと編集画面の保存で同じ総数を使う */
      expect(mobileProfiles).toContain('canAddProfile(allProfiles.length)');
      expect(mobileProfileEdit).toContain('canAddProfile(profiles.length)');
      expect(webProfiles).toContain('canAddProfileForCount(profiles.length)');

      /* 有効数だけで判定する形に戻していないこと */
      expect(mobileProfiles).not.toContain('validProfilesCount');
    });

    it('counts every saved custom variable, including disabled ones', () => {
      expect(mobileVariables).toContain('canAddCustomVariable(variables.length)');
      expect(webVariables).toContain('canAddCustomVariable(customVariables.length)');
    });

    /**
     * 定型文・ショートカットの一覧はアクティブなプロファイルで絞り込まれているため、
     * 件数はDBの総数から取る。一覧の件数で数えると他のプロファイルの分を取りこぼす。
     */
    it('counts every saved snippet and shortcut from the database, not from the filtered lists', () => {
      expect(mobileItemLimitGuard).toContain('countSavedItems(() => SnippetService.count())');
      expect(mobileItemLimitGuard).toContain('countSavedItems(() => ShortcutService.count())');
      expect(webSnippetModal).toContain('canAddSnippet(SnippetService.count())');

      for (const source of [mobileItemLimitGuard, mobileHome, mobileHomeShortcuts, webSnippetModal]) {
        expect(source).not.toContain('allSnippets.length');
        expect(source).not.toContain('snippets.length');
        expect(source).not.toContain('Shortcuts.length');
        expect(source).not.toContain('shortcuts.length');
      }
    });

    /**
     * 追加ボタンは権利確認中に判定を保留する（起動直後にPro利用者へ誤って案内しないため）。
     * 保存は保留せず必ず判定する。ディープリンクなど追加ボタンを経由しない開き方があり、
     * 確認が終わらない間に何件でも保存できてしまうのを防ぐためである。
     */
    it('checks the limit on every create path and defers only the add buttons while the entitlement loads', () => {
      expect(mobileHome).toContain('!isSubscriptionLoading && !ensureCanAddSnippet()');
      expect(mobileHomeShortcuts).toContain('!isSubscriptionLoading && !ensureCanAddShortcut()');
      expect(webSnippetModal).toContain('!isSubscriptionLoading && !ensureCanAddSnippet()');

      /* 保存時の判定は作成の分岐と同じ条件で行う */
      expect(mobileSnippetForm).toContain('!(isEditMode && snippetId) && !ensureCanAddSnippet()');
      expect(mobileShortcutEdit).toContain('!(isEdit && editingShortcut) && !ensureCanAddShortcut()');
      expect(webSnippetModal).toContain('if (!ensureCanAddSnippet()) {');

      /* ショートカット作成・編集画面は値の追加ボタンで保留に使うため対象外。保存時の判定式は上で固定している */
      for (const source of [mobileItemLimitGuard, mobileSnippetForm]) {
        expect(source).not.toContain('isLoading');
      }
    });

    /**
     * ショートカットの値の上限は、値の追加ボタンでは権利確認中だけ保留し、保存時は常に判定する。
     * 保存時は保存済みの件数を超えない保存を許可し、上限を超える値を既に持つショートカットの編集を妨げない。
     */
    it('checks the shortcut value limit on the add button and on save without blocking shortcuts that already hold more', () => {
      expect(mobileItemLimitGuard).toContain('canAddShortcutValue(currentCount)');
      expect(mobileShortcutEdit).toContain('!isSubscriptionLoading && !ensureCanAddShortcutValue(values.length)');
      expect(mobileShortcutEdit).toContain('const savedValueCount = isEdit && editingShortcut ? editingShortcut.values.length : 0;');
      expect(mobileShortcutEdit).toContain('values.length > savedValueCount && !ensureCanAddShortcutValue(values.length - 1)');
    });

    it('delegates the limit comparison instead of restating it per screen', () => {
      for (const source of [webProfiles, mobileProfiles, mobileProfileEdit]) {
        expect(source).not.toContain('< FREE_PROFILES_LIMIT');
      }
      for (const source of [webVariables, mobileVariables]) {
        expect(source).not.toContain('< FREE_VARIABLES_LIMIT');
      }
      for (const source of [mobileItemLimitGuard, mobileHome, mobileSnippetForm, webSnippetModal]) {
        expect(source).not.toContain('< FREE_SNIPPETS_LIMIT');
      }
      for (const source of [mobileItemLimitGuard, mobileHomeShortcuts, mobileShortcutEdit]) {
        expect(source).not.toContain('< FREE_SHORTCUTS_LIMIT');
      }
      for (const source of [mobileItemLimitGuard, mobileShortcutEdit]) {
        expect(source).not.toContain('< FREE_SHORTCUT_VALUES_LIMIT');
      }
    });
  });
});
