import { afterEach, describe, expect, it } from 'vitest';
import { setMainDbAdapter } from '../../src/adapters/DbAdapter';
import { CREATE_INDEXES, CREATE_TABLES } from '../../src/database/schema';
import { DuplicateNameError, EmptyContentError } from '../../src/errors';
import { ShortcutService } from '../../src/services/ShortcutService';
import {
  createMemoryDbAdapter,
  type MemoryDbAdapter,
} from '../helpers/memoryDbAdapter';

describe('ShortcutService', () => {
  const databases: MemoryDbAdapter[] = [];

  afterEach(() => databases.splice(0).forEach((db) => db.dispose()));

  /** 既定の紐づけプロファイルID */
  const PROFILE_ID = 'profile-main';
  /** 紐づけの置き換え先の検証に使う別プロファイルID */
  const OTHER_PROFILE_ID = 'profile-other';

  /**
   * 現行スキーマのDBを用意し、メインDBとして登録する
   *
   * @remarks
   * プロファイル別の一覧と紐づけの置き換えを確かめるため、プロファイルを2件先に入れておく。
   */
  const useDatabase = async (): Promise<MemoryDbAdapter> => {
    const db = createMemoryDbAdapter();
    databases.push(db);
    for (const sql of Object.values(CREATE_TABLES)) await db.exec(sql);
    for (const sql of Object.values(CREATE_INDEXES)) await db.exec(sql);
    db.run(
      "INSERT INTO profiles VALUES (?, 'main', 1, 1, 0, 0, 'created', 'updated')",
      [PROFILE_ID]
    );
    db.run(
      "INSERT INTO profiles VALUES (?, 'other', 0, 1, 1, 0, 'created', 'updated')",
      [OTHER_PROFILE_ID]
    );
    setMainDbAdapter(db);
    return db;
  };

  describe('create', () => {
    it('登録した値をそのまま保存する', async () => {
      await useDatabase();

      const shortcut = ShortcutService.create({
        profileIds: [PROFILE_ID],
        name: '電話番号',
        value: '080-0000-0000',
      });

      expect(shortcut.name).toBe('電話番号');
      expect(shortcut.value).toBe('080-0000-0000');
      /* 使用回数は挿入・コピー時にだけ増える。作成直後は必ず0 */
      expect(shortcut.useCount).toBe(0);
    });

    it('名前と値の前後空白を除去して保存する', async () => {
      await useDatabase();

      const shortcut = ShortcutService.create({
        profileIds: [PROFILE_ID],
        name: '  メールアドレス  ',
        value: '  sample@example.com  ',
      });

      expect(shortcut).toMatchObject({
        name: 'メールアドレス',
        value: 'sample@example.com',
      });
    });

    /**
     * 1値構造で必須なのは名前だけとする。
     * 空文字を挿入する選択も利用者の意図として扱い、保存を拒否しない。
     */
    it('値が空文字でも保存できる', async () => {
      await useDatabase();

      const shortcut = ShortcutService.create({
        profileIds: [PROFILE_ID],
        name: '空欄',
        value: '   ',
      });

      expect(shortcut.value).toBe('');
      expect(ShortcutService.countByProfile(PROFILE_ID)).toBe(1);
    });

    it('新規ショートカットを末尾へ追加する', async () => {
      await useDatabase();

      ShortcutService.create({ profileIds: [PROFILE_ID], name: '電話番号', value: '080' });
      ShortcutService.create({ profileIds: [PROFILE_ID], name: '住所', value: '東京' });

      expect(ShortcutService.getByProfileId(PROFILE_ID).map((shortcut) => [shortcut.name, shortcut.sortOrder]))
        .toEqual([
          ['電話番号', 0],
          ['住所', 1],
        ]);
    });

    it('ショートカット名が空白だけの場合は保存できない', async () => {
      await useDatabase();

      expect(() =>
        ShortcutService.create({ profileIds: [PROFILE_ID], name: '   ', value: '080' })
      ).toThrow(EmptyContentError);
    });

    it('同名のショートカットは登録できない', async () => {
      await useDatabase();
      ShortcutService.create({ profileIds: [PROFILE_ID], name: '電話番号', value: '080' });

      expect(() =>
        ShortcutService.create({ profileIds: [PROFILE_ID], name: '電話番号', value: '090' })
      ).toThrow(DuplicateNameError);
    });

    it('紐づけの挿入に失敗した場合はショートカット本体も残さない', async () => {
      const db = await useDatabase();
      /* 本体と紐づけを同一トランザクションに入れているため、紐づけ側だけを失敗させる */
      await db.exec('DROP TABLE shortcut_profiles');

      expect(() =>
        ShortcutService.create({ profileIds: [PROFILE_ID], name: '電話番号', value: '080' })
      ).toThrow();
      expect(db.all('SELECT * FROM shortcuts')).toEqual([]);
    });
  });

  describe('update', () => {
    it('値を残したまま名前を変更する', async () => {
      await useDatabase();
      const created = ShortcutService.create({
        profileIds: [PROFILE_ID],
        name: '電話番号',
        value: '080',
      });

      const updated = ShortcutService.update({ id: created.id, name: '電話' });

      expect(updated.name).toBe('電話');
      expect(updated.value).toBe('080');
    });

    it('値を書き換えても使用回数は保持する', async () => {
      await useDatabase();
      const created = ShortcutService.create({
        profileIds: [PROFILE_ID],
        name: '電話番号',
        value: '080',
      });
      ShortcutService.recordUse(created.id);
      ShortcutService.recordUse(created.id);

      const updated = ShortcutService.update({ id: created.id, value: '080-2222-2222' });

      expect(updated).toMatchObject({ value: '080-2222-2222', useCount: 2 });
    });

    it('値を省略した更新は現在の値を変えない', async () => {
      await useDatabase();
      const created = ShortcutService.create({
        profileIds: [PROFILE_ID],
        name: '電話番号',
        value: '080',
      });

      expect(ShortcutService.update({ id: created.id, name: '電話' }).value).toBe('080');
    });

    it('自分以外の同名ショートカットがある場合は拒否する', async () => {
      await useDatabase();
      ShortcutService.create({ profileIds: [PROFILE_ID], name: '電話番号', value: '080' });
      const address = ShortcutService.create({
        profileIds: [PROFILE_ID],
        name: '住所',
        value: '東京',
      });

      expect(() => ShortcutService.update({ id: address.id, name: '電話番号' })).toThrow(
        DuplicateNameError
      );
    });

    it('自分自身と同じ名前での更新は許可する', async () => {
      await useDatabase();
      const created = ShortcutService.create({
        profileIds: [PROFILE_ID],
        name: '電話番号',
        value: '080',
      });

      expect(() => ShortcutService.update({ id: created.id, name: '電話番号' })).not.toThrow();
    });
  });

  describe('delete', () => {
    it('ショートカットと紐づけをまとめて削除し、他のショートカットに影響しない', async () => {
      const db = await useDatabase();
      const phone = ShortcutService.create({
        profileIds: [PROFILE_ID],
        name: '電話番号',
        value: '080',
      });
      const mail = ShortcutService.create({
        profileIds: [PROFILE_ID],
        name: 'メールアドレス',
        value: 'sample@example.com',
      });

      ShortcutService.delete(phone.id);

      expect(ShortcutService.getById(phone.id)).toBeNull();
      expect(
        db.all('SELECT shortcutId FROM shortcut_profiles WHERE shortcutId = ?', [phone.id])
      ).toEqual([]);
      expect(ShortcutService.getById(mail.id)?.value).toBe('sample@example.com');
    });
  });

  describe('recordUse', () => {
    it('使用回数を1加算する', async () => {
      await useDatabase();
      const phone = ShortcutService.create({
        profileIds: [PROFILE_ID],
        name: '電話番号',
        value: '080',
      });
      const mail = ShortcutService.create({
        profileIds: [PROFILE_ID],
        name: 'メールアドレス',
        value: 'sample@example.com',
      });

      ShortcutService.recordUse(mail.id);

      expect(ShortcutService.getById(phone.id)?.useCount).toBe(0);
      expect(ShortcutService.getById(mail.id)?.useCount).toBe(1);
    });
  });

  describe('reorder', () => {
    it('渡された順序をそのまま表示順にする', async () => {
      await useDatabase();
      const phone = ShortcutService.create({
        profileIds: [PROFILE_ID],
        name: '電話番号',
        value: '080',
      });
      const mail = ShortcutService.create({
        profileIds: [PROFILE_ID],
        name: 'メールアドレス',
        value: 'sample@example.com',
      });

      ShortcutService.reorder([mail.id, phone.id]);

      expect(ShortcutService.getByProfileId(PROFILE_ID).map((shortcut) => shortcut.name)).toEqual([
        'メールアドレス',
        '電話番号',
      ]);
    });
  });

  describe('プロファイル別の管理', () => {
    it('別のプロファイルであれば同名のショートカットを登録できる', async () => {
      await useDatabase();
      ShortcutService.create({
        profileIds: [PROFILE_ID],
        name: '電話番号',
        value: '080',
      });

      expect(() =>
        ShortcutService.create({
          profileIds: [OTHER_PROFILE_ID],
          name: '電話番号',
          value: '090',
        })
      ).not.toThrow();
    });

    it('一覧は指定したプロファイルの分だけを返す', async () => {
      await useDatabase();
      ShortcutService.create({
        profileIds: [PROFILE_ID],
        name: '電話番号',
        value: '080',
      });
      ShortcutService.create({
        profileIds: [OTHER_PROFILE_ID],
        name: '住所',
        value: '東京',
      });

      expect(
        ShortcutService.getByProfileId(PROFILE_ID).map((shortcut) => shortcut.name)
      ).toEqual(['電話番号']);
      expect(
        ShortcutService.getByProfileId(OTHER_PROFILE_ID).map((shortcut) => shortcut.name)
      ).toEqual(['住所']);
    });

    /**
     * 並び順はプロファイルを横断した通し番号にしてある。
     * 表示順は並べ替え（shortcuts/sort.ts）が決めるので、通しでも見た目は変わらず、
     * 他のマスタ（カテゴリ・プロファイル・変数）とも揃う。紐づけを置き換えても採り直さない。
     */
    it('並び順はプロファイルを横断した通し番号になる', async () => {
      await useDatabase();
      ShortcutService.create({
        profileIds: [PROFILE_ID],
        name: '電話番号',
        value: '080',
      });
      const other = ShortcutService.create({
        profileIds: [OTHER_PROFILE_ID],
        name: '住所',
        value: '東京',
      });

      expect(other.sortOrder).toBe(1);
    });

    it('紐づけを置き換えても値・使用回数・並び順を保持する', async () => {
      await useDatabase();
      const created = ShortcutService.create({
        profileIds: [PROFILE_ID],
        name: '電話番号',
        value: '080',
      });
      ShortcutService.recordUse(created.id);
      ShortcutService.create({
        profileIds: [OTHER_PROFILE_ID],
        name: '住所',
        value: '東京',
      });

      const moved = ShortcutService.update({
        id: created.id,
        profileIds: [OTHER_PROFILE_ID],
      });

      expect(moved.profileIds).toEqual([OTHER_PROFILE_ID]);
      /* 並び順はプロファイル横断の通し番号のため、紐づけを変えても採り直さない */
      expect(moved.sortOrder).toBe(created.sortOrder);
      expect(moved).toMatchObject({ value: '080', useCount: 1 });
      expect(ShortcutService.getByProfileId(PROFILE_ID)).toEqual([]);
    });

    it('置き換え先に同名のショートカットがある場合は保存できない', async () => {
      await useDatabase();
      const created = ShortcutService.create({
        profileIds: [PROFILE_ID],
        name: '電話番号',
        value: '080',
      });
      ShortcutService.create({
        profileIds: [OTHER_PROFILE_ID],
        name: '電話番号',
        value: '090',
      });

      /* 名前を変えなくても、置き換え先の同名と衝突する */
      expect(() =>
        ShortcutService.update({ id: created.id, profileIds: [OTHER_PROFILE_ID] })
      ).toThrow(DuplicateNameError);
    });
  });

  describe('getByProfileId', () => {
    it('値と紐づけを本体の行から返す', async () => {
      await useDatabase();
      ShortcutService.create({
        profileIds: [PROFILE_ID],
        name: '電話番号',
        value: '080',
      });
      ShortcutService.create({
        profileIds: [PROFILE_ID],
        name: 'メールアドレス',
        value: 'sample@example.com',
      });

      expect(
        ShortcutService.getByProfileId(PROFILE_ID).map((shortcut) => [
          shortcut.name,
          shortcut.value,
          shortcut.profileIds,
        ])
      ).toEqual([
        ['電話番号', '080', [PROFILE_ID]],
        ['メールアドレス', 'sample@example.com', [PROFILE_ID]],
      ]);
    });
  });
});
