import { afterEach, describe, expect, it } from 'vitest';
import { setMainDbAdapter } from '../../src/adapters/DbAdapter';
import { CREATE_INDEXES, CREATE_TABLES } from '../../src/database/schema';
import { CategoryMapper } from '../../src/mappers/CategoryMapper';
import { ShortcutService } from '../../src/services/ShortcutService';
import {
  createMemoryDbAdapter,
  type MemoryDbAdapter,
} from '../helpers/memoryDbAdapter';

/**
 * ショートカットは定型文と同じcategoriesテーブルを共用する。
 * 実行時に外部キーを強制していないため、DDLの`ON DELETE SET NULL`は効かず、
 * カテゴリ削除時の未分類化はCategoryMapperの明示的なUPDATEだけが担う。
 * 落とすと、消えたカテゴリを指したままのショートカットが静かに残るためここで固定する。
 */
describe('ショートカットのカテゴリ', () => {
  const databases: MemoryDbAdapter[] = [];

  afterEach(() => databases.splice(0).forEach((db) => db.dispose()));

  /** 既定の紐づけプロファイルID */
  const PROFILE_ID = 'profile-main';

  /** 現行スキーマのDBを用意し、メインDBとして登録する */
  const useDatabase = async (): Promise<MemoryDbAdapter> => {
    const db = createMemoryDbAdapter();
    databases.push(db);
    for (const sql of Object.values(CREATE_TABLES)) await db.exec(sql);
    for (const sql of Object.values(CREATE_INDEXES)) await db.exec(sql);
    db.run(
      "INSERT INTO profiles VALUES (?, 'main', 1, 1, 0, 0, 'created', 'updated')",
      [PROFILE_ID]
    );
    setMainDbAdapter(db);
    return db;
  };

  /** 値を1件だけ持つ作成入力を組み立てる */
  const inputWith = (name: string, categoryId?: string | null) => ({
    profileIds: [PROFILE_ID],
    categoryId,
    name,
    values: [{ value: '090-0000-0000', isMasked: false }],
  });

  it('カテゴリを指定せずに作成すると未分類になる', async () => {
    await useDatabase();

    const created = ShortcutService.create(inputWith('電話番号'));

    expect(created.categoryId).toBeNull();
  });

  it('指定したカテゴリを保持して作成する', async () => {
    await useDatabase();
    const category = CategoryMapper.create({ name: '仕事', color: '#3B82F6' });

    const created = ShortcutService.create(inputWith('電話番号', category.id));

    expect(created.categoryId).toBe(category.id);
  });

  it('更新でカテゴリを付け替えられる', async () => {
    await useDatabase();
    const work = CategoryMapper.create({ name: '仕事', color: '#3B82F6' });
    const privateUse = CategoryMapper.create({ name: '私用', color: '#10B981' });
    const created = ShortcutService.create(inputWith('電話番号', work.id));

    const updated = ShortcutService.update({ id: created.id, categoryId: privateUse.id });

    expect(updated.categoryId).toBe(privateUse.id);
  });

  it('更新でnullを渡すと未分類へ戻す', async () => {
    await useDatabase();
    const category = CategoryMapper.create({ name: '仕事', color: '#3B82F6' });
    const created = ShortcutService.create(inputWith('電話番号', category.id));

    const updated = ShortcutService.update({ id: created.id, categoryId: null });

    expect(updated.categoryId).toBeNull();
  });

  /** 省略と明示的なnullを取り違えると、名前を変えただけでカテゴリが外れてしまう */
  it('更新でcategoryIdを省略すると現在のカテゴリを変えない', async () => {
    await useDatabase();
    const category = CategoryMapper.create({ name: '仕事', color: '#3B82F6' });
    const created = ShortcutService.create(inputWith('電話番号', category.id));

    const updated = ShortcutService.update({ id: created.id, name: '電話' });

    expect(updated.name).toBe('電話');
    expect(updated.categoryId).toBe(category.id);
  });

  /**
   * カテゴリ削除の事後条件（§8.3）。定型文と同じく、ショートカット自体は消さず未分類へ戻す。
   * 他のカテゴリを指すショートカットを巻き込まないことも同時に固定する。
   */
  it('カテゴリを削除するとショートカットは消えず未分類になる', async () => {
    await useDatabase();
    const work = CategoryMapper.create({ name: '仕事', color: '#3B82F6' });
    const privateUse = CategoryMapper.create({ name: '私用', color: '#10B981' });
    const target = ShortcutService.create(inputWith('請求先', work.id));
    const untouched = ShortcutService.create(inputWith('電話番号', privateUse.id));

    CategoryMapper.delete(work.id);

    expect(ShortcutService.getById(target.id)?.categoryId).toBeNull();
    expect(ShortcutService.getById(untouched.id)?.categoryId).toBe(privateUse.id);
    /* 値も巻き添えで消えていないこと */
    expect(ShortcutService.getById(target.id)?.values).toHaveLength(1);
  });
});
