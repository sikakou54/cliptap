import { afterEach, describe, expect, it } from 'vitest';
import { setMainDbAdapter } from '../../src/adapters/DbAdapter';
import type { SubscriptionAdapter } from '../../src/adapters/SubscriptionAdapter';
import { CREATE_INDEXES, CREATE_TABLES } from '../../src/database/schema';
import { ShortcutService } from '../../src/services/ShortcutService';
import { SnippetService } from '../../src/services/SnippetService';
import {
  FREE_SHORTCUTS_LIMIT,
  FREE_SNIPPETS_LIMIT,
  SubscriptionService,
} from '../../src/services/SubscriptionService';
import { createValidFlagsUpdater } from '../../src/services/validFlagsUpdater';
import {
  createMemoryDbAdapter,
  type MemoryDbAdapter,
} from '../helpers/memoryDbAdapter';

/**
 * 定型文・ショートカットの登録上限は、保存済み総数（全プロファイル合計）で判定する。
 *
 * 画面の一覧はアクティブなプロファイルで絞り込まれているため、件数はDBから数える。
 * また上限を超えて保持しているデータ（復元・Proからの切替）は無効化せず、使えるまま残す。
 * 無効化すると、既に上限以上を登録している無料プランの利用者がデータを使えなくなるためである。
 */
describe('定型文・ショートカットの登録上限と保存済みデータ', () => {
  const databases: MemoryDbAdapter[] = [];

  afterEach(() => databases.splice(0).forEach((db) => db.dispose()));

  /** 標準かつアクティブなプロファイル */
  const MAIN = 'profile-main';
  /** 2件目のプロファイル */
  const OTHER = 'profile-other';

  /** 指定した権利状態のサブスクリプションアダプターを作る */
  const adapterFor = (subscribed: boolean): SubscriptionAdapter => ({
    isSubscribed: () => subscribed,
    isLoading: () => false,
    checkSubscription: async () => subscribed,
    subscribe: () => () => {},
    notifyListeners: () => {},
    refreshCustomerInfo: async () => {},
  });

  /** 現行スキーマのDBに2件のプロファイルを入れ、メインDBとして登録する */
  const useDatabase = async (): Promise<MemoryDbAdapter> => {
    const db = createMemoryDbAdapter();
    databases.push(db);
    for (const sql of Object.values(CREATE_TABLES)) await db.exec(sql);
    for (const sql of Object.values(CREATE_INDEXES)) await db.exec(sql);
    db.run("INSERT INTO profiles VALUES (?, 'main', 1, 1, 1, 0, 'created', 'updated')", [MAIN]);
    db.run("INSERT INTO profiles VALUES (?, 'other', 0, 0, 1, 1, 'created', 'updated')", [OTHER]);
    setMainDbAdapter(db);
    return db;
  };

  it('定型文の総数は、他のプロファイルに紐づくものと全プロファイル向けのものを含む', async () => {
    await useDatabase();
    SnippetService.create({ title: 'MAINだけ', content: 'a', profileIds: [MAIN] });
    SnippetService.create({ title: 'OTHERだけ', content: 'b', profileIds: [OTHER] });
    SnippetService.create({ title: '全プロファイル', content: 'c', profileIds: [] });
    SnippetService.create({ title: '両方', content: 'd', profileIds: [MAIN, OTHER] });

    expect(SnippetService.count()).toBe(4);
  });

  it('ショートカットの総数は紐づけの数によらず1件ずつ数え、プロファイル別の件数と区別される', async () => {
    await useDatabase();
    const values = [{ name: '自分', value: '090-0000-0000' }];
    ShortcutService.create({ profileIds: [MAIN], name: 'MAINだけ', values });
    ShortcutService.create({ profileIds: [OTHER], name: 'OTHERだけ', values });
    ShortcutService.create({ profileIds: [], name: '全プロファイル', values });
    ShortcutService.create({ profileIds: [MAIN, OTHER], name: '両方', values });

    expect(ShortcutService.count()).toBe(4);
    /* MAINから見えるのは「OTHERだけ」以外の3件。総数と取り違えると上限をすり抜ける */
    expect(ShortcutService.countByProfile(MAIN)).toBe(3);
  });

  it('無料プランで上限を超えて保持する定型文・ショートカットは、有効フラグの再計算後もすべて使える', async () => {
    await useDatabase();
    const overLimit = 10;
    for (let i = 0; i < FREE_SNIPPETS_LIMIT + overLimit; i++) {
      SnippetService.create({ title: `snippet-${i}`, content: `content-${i}`, profileIds: [] });
    }
    for (let i = 0; i < FREE_SHORTCUTS_LIMIT + overLimit; i++) {
      ShortcutService.create({
        profileIds: [],
        name: `shortcut-${i}`,
        values: [{ name: '値', value: `value-${i}` }],
      });
    }

    SubscriptionService.setAdapter(adapterFor(false));
    SubscriptionService.setValidFlagsUpdater(createValidFlagsUpdater());
    expect(SubscriptionService.updateValidFlags()).toBe(true);

    expect(SnippetService.getSorted('created')).toHaveLength(FREE_SNIPPETS_LIMIT + overLimit);
    expect(ShortcutService.getByProfileId(MAIN)).toHaveLength(FREE_SHORTCUTS_LIMIT + overLimit);

    /* 使えるまま残しつつ、新規登録だけは止める */
    expect(SubscriptionService.canAddSnippet(SnippetService.count())).toBe(false);
    expect(SubscriptionService.canAddShortcut(ShortcutService.count())).toBe(false);
  });
});
