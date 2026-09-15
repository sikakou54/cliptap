import { afterEach, describe, expect, it } from 'vitest';
import { setMainDbAdapter } from '../../src/adapters/DbAdapter';
import { CREATE_INDEXES, CREATE_TABLES } from '../../src/database/schema';
import {
  DuplicateNameError,
  EmptyContentError,
  ShortcutValueNameRequiredError,
  ShortcutValueRequiredError,
} from '../../src/errors';
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
    it('登録した値を入力順のまま保存する', async () => {
      await useDatabase();

      const shortcut = ShortcutService.create({
        profileIds: [PROFILE_ID],
        name: '電話番号',
        values: [
          { name: '母', value: '080-0000-0000' },
          { name: '父', value: '090-0000-0000' },
        ],
      });

      expect(shortcut.name).toBe('電話番号');
      expect(shortcut.values.map((value) => [value.name, value.value, value.sortOrder])).toEqual([
        ['母', '080-0000-0000', 0],
        ['父', '090-0000-0000', 1],
      ]);
      /* 使用回数は挿入時にだけ増える。作成直後は必ず0 */
      expect(shortcut.values.every((value) => value.useCount === 0)).toBe(true);
    });

    it('名前と値の前後空白を除去して保存する', async () => {
      await useDatabase();

      const shortcut = ShortcutService.create({
        profileIds: [PROFILE_ID],
        name: '  メールアドレス  ',
        values: [{ name: '  個人  ', value: '  sample@example.com  ' }],
      });

      expect(shortcut.name).toBe('メールアドレス');
      expect(shortcut.values[0]).toMatchObject({
        name: '個人',
        value: 'sample@example.com',
      });
    });

    it('新規ショートカットを末尾へ追加する', async () => {
      await useDatabase();

      ShortcutService.create({ profileIds: [PROFILE_ID], name: '電話番号', values: [{ name: '母', value: '080' }] });
      ShortcutService.create({ profileIds: [PROFILE_ID], name: '住所', values: [{ name: '自宅', value: '東京' }] });

      expect(ShortcutService.getByProfileId(PROFILE_ID).map((shortcut) => [shortcut.name, shortcut.sortOrder]))
        .toEqual([
          ['電話番号', 0],
          ['住所', 1],
        ]);
    });

    it('値が1件も無い場合は保存できない', async () => {
      await useDatabase();

      expect(() => ShortcutService.create({ profileIds: [PROFILE_ID], name: '電話番号', values: [] })).toThrow(
        ShortcutValueRequiredError
      );
      expect(ShortcutService.countByProfile(PROFILE_ID)).toBe(0);
    });

    it('値名が空の場合は保存できない', async () => {
      await useDatabase();

      expect(() =>
        ShortcutService.create({ profileIds: [PROFILE_ID], name: '電話番号', values: [{ name: '  ', value: '080' }] })
      ).toThrow(ShortcutValueNameRequiredError);
      expect(ShortcutService.countByProfile(PROFILE_ID)).toBe(0);
    });

    it('ショートカット名が空白だけの場合は保存できない', async () => {
      await useDatabase();

      expect(() =>
        ShortcutService.create({ profileIds: [PROFILE_ID], name: '   ', values: [{ name: '母', value: '080' }] })
      ).toThrow(EmptyContentError);
    });

    it('同名のショートカットは登録できない', async () => {
      await useDatabase();
      ShortcutService.create({ profileIds: [PROFILE_ID], name: '電話番号', values: [{ name: '母', value: '080' }] });

      expect(() =>
        ShortcutService.create({ profileIds: [PROFILE_ID], name: '電話番号', values: [{ name: '父', value: '090' }] })
      ).toThrow(DuplicateNameError);
    });

    it('値の挿入に失敗した場合はショートカット本体も残さない', async () => {
      const db = await useDatabase();
      /* 値名にNULLを渡せないため、NOT NULL制約に触れる形で値の挿入だけを失敗させる */
      await db.exec('DROP TABLE shortcut_values');

      expect(() =>
        ShortcutService.create({ profileIds: [PROFILE_ID], name: '電話番号', values: [{ name: '母', value: '080' }] })
      ).toThrow();
      expect(db.all('SELECT * FROM shortcuts')).toEqual([]);
    });
  });

  describe('update', () => {
    it('既存の値を残したまま名前を変更する', async () => {
      await useDatabase();
      const created = ShortcutService.create({
        profileIds: [PROFILE_ID],
        name: '電話番号',
        values: [{ name: '母', value: '080' }],
      });

      const updated = ShortcutService.update({ id: created.id, name: '電話' });

      expect(updated.name).toBe('電話');
      expect(updated.values.map((value) => value.id)).toEqual(
        created.values.map((value) => value.id)
      );
    });

    it('値を追加・更新・削除して並び順を入力どおりにする', async () => {
      await useDatabase();
      const created = ShortcutService.create({
        profileIds: [PROFILE_ID],
        name: '電話番号',
        values: [
          { name: '母', value: '080' },
          { name: '父', value: '090' },
        ],
      });
      const [mother, father] = created.values;

      const updated = ShortcutService.update({
        id: created.id,
        values: [
          { id: father.id, name: '父', value: '090-1111-1111' },
          { name: '祖母', value: '070' },
        ],
      });

      expect(updated.values.map((value) => [value.name, value.value, value.sortOrder])).toEqual([
        ['父', '090-1111-1111', 0],
        ['祖母', '070', 1],
      ]);
      /* 入力に現れなかった値は削除される */
      expect(updated.values.some((value) => value.id === mother.id)).toBe(false);
    });

    it('値を更新しても使用回数は保持する', async () => {
      await useDatabase();
      const created = ShortcutService.create({
        profileIds: [PROFILE_ID],
        name: '電話番号',
        values: [{ name: '母', value: '080' }],
      });
      const target = created.values[0];
      ShortcutService.recordUse(target.id, created.id);
      ShortcutService.recordUse(target.id, created.id);

      const updated = ShortcutService.update({
        id: created.id,
        values: [{ id: target.id, name: '母', value: '080-2222-2222' }],
      });

      expect(updated.values[0]).toMatchObject({ value: '080-2222-2222', useCount: 2 });
    });

    it('値をすべて削除する更新は拒否する', async () => {
      await useDatabase();
      const created = ShortcutService.create({
        profileIds: [PROFILE_ID],
        name: '電話番号',
        values: [{ name: '母', value: '080' }],
      });

      expect(() => ShortcutService.update({ id: created.id, values: [] })).toThrow(
        ShortcutValueRequiredError
      );
      expect(ShortcutService.getById(created.id)?.values).toHaveLength(1);
    });

    it('自分以外の同名ショートカットがある場合は拒否する', async () => {
      await useDatabase();
      ShortcutService.create({ profileIds: [PROFILE_ID], name: '電話番号', values: [{ name: '母', value: '080' }] });
      const address = ShortcutService.create({
        profileIds: [PROFILE_ID],
        name: '住所',
        values: [{ name: '自宅', value: '東京' }],
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
        values: [{ name: '母', value: '080' }],
      });

      expect(() => ShortcutService.update({ id: created.id, name: '電話番号' })).not.toThrow();
    });
  });

  describe('delete', () => {
    it('ショートカットと値をまとめて削除し、他のショートカットに影響しない', async () => {
      const db = await useDatabase();
      const phone = ShortcutService.create({
        profileIds: [PROFILE_ID],
        name: '電話番号',
        values: [{ name: '母', value: '080' }],
      });
      const mail = ShortcutService.create({
        profileIds: [PROFILE_ID],
        name: 'メールアドレス',
        values: [{ name: '個人', value: 'sample@example.com' }],
      });

      ShortcutService.delete(phone.id);

      expect(ShortcutService.getById(phone.id)).toBeNull();
      expect(
        db.all('SELECT id FROM shortcut_values WHERE shortcutId = ?', [phone.id])
      ).toEqual([]);
      expect(ShortcutService.getById(mail.id)?.values).toHaveLength(1);
    });
  });

  describe('recordUse', () => {
    it('使用回数を1加算する', async () => {
      await useDatabase();
      const created = ShortcutService.create({
        profileIds: [PROFILE_ID],
        name: '電話番号',
        values: [
          { name: '母', value: '080' },
          { name: '父', value: '090' },
        ],
      });

      ShortcutService.recordUse(created.values[1].id, created.id);

      expect(ShortcutService.getById(created.id)?.values.map((value) => value.useCount)).toEqual([
        0, 1,
      ]);
    });
  });

  describe('reorder', () => {
    it('渡された順序をそのまま表示順にする', async () => {
      await useDatabase();
      const phone = ShortcutService.create({
        profileIds: [PROFILE_ID],
        name: '電話番号',
        values: [{ name: '母', value: '080' }],
      });
      const mail = ShortcutService.create({
        profileIds: [PROFILE_ID],
        name: 'メールアドレス',
        values: [{ name: '個人', value: 'sample@example.com' }],
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
        values: [{ name: '母', value: '080' }],
      });

      expect(() =>
        ShortcutService.create({
          profileIds: [OTHER_PROFILE_ID],
          name: '電話番号',
          values: [{ name: '父', value: '090' }],
        })
      ).not.toThrow();
    });

    it('一覧は指定したプロファイルの分だけを返す', async () => {
      await useDatabase();
      ShortcutService.create({
        profileIds: [PROFILE_ID],
        name: '電話番号',
        values: [{ name: '母', value: '080' }],
      });
      ShortcutService.create({
        profileIds: [OTHER_PROFILE_ID],
        name: '住所',
        values: [{ name: '自宅', value: '東京' }],
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
        values: [{ name: '母', value: '080' }],
      });
      const other = ShortcutService.create({
        profileIds: [OTHER_PROFILE_ID],
        name: '住所',
        values: [{ name: '自宅', value: '東京' }],
      });

      expect(other.sortOrder).toBe(1);
    });

    it('紐づけを置き換えても値・使用回数・並び順を保持する', async () => {
      await useDatabase();
      const created = ShortcutService.create({
        profileIds: [PROFILE_ID],
        name: '電話番号',
        values: [{ name: '母', value: '080' }],
      });
      ShortcutService.recordUse(created.values[0].id, created.id);
      ShortcutService.create({
        profileIds: [OTHER_PROFILE_ID],
        name: '住所',
        values: [{ name: '自宅', value: '東京' }],
      });

      const moved = ShortcutService.update({
        id: created.id,
        profileIds: [OTHER_PROFILE_ID],
      });

      expect(moved.profileIds).toEqual([OTHER_PROFILE_ID]);
      /* 並び順はプロファイル横断の通し番号のため、紐づけを変えても採り直さない */
      expect(moved.sortOrder).toBe(created.sortOrder);
      expect(moved.values.map((value) => [value.id, value.useCount])).toEqual([
        [created.values[0].id, 1],
      ]);
      expect(ShortcutService.getByProfileId(PROFILE_ID)).toEqual([]);
    });

    it('置き換え先に同名のショートカットがある場合は保存できない', async () => {
      await useDatabase();
      const created = ShortcutService.create({
        profileIds: [PROFILE_ID],
        name: '電話番号',
        values: [{ name: '母', value: '080' }],
      });
      ShortcutService.create({
        profileIds: [OTHER_PROFILE_ID],
        name: '電話番号',
        values: [{ name: '父', value: '090' }],
      });

      /* 名前を変えなくても、置き換え先の同名と衝突する */
      expect(() =>
        ShortcutService.update({ id: created.id, profileIds: [OTHER_PROFILE_ID] })
      ).toThrow(DuplicateNameError);
    });
  });

  describe('getByProfileId', () => {
    it('値をショートカットごとに正しく振り分ける', async () => {
      await useDatabase();
      ShortcutService.create({
        profileIds: [PROFILE_ID],
        name: '電話番号',
        values: [
          { name: '母', value: '080' },
          { name: '父', value: '090' },
        ],
      });
      ShortcutService.create({
        profileIds: [PROFILE_ID],
        name: 'メールアドレス',
        values: [{ name: '個人', value: 'sample@example.com' }],
      });

      expect(
        ShortcutService.getByProfileId(PROFILE_ID).map((shortcut) => [
          shortcut.name,
          shortcut.values.map((value) => value.name),
        ])
      ).toEqual([
        ['電話番号', ['母', '父']],
        ['メールアドレス', ['個人']],
      ]);
    });
  });
});
