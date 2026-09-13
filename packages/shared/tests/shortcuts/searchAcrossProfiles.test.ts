import { afterEach, describe, expect, it } from 'vitest';
import { setMainDbAdapter } from '../../src/adapters/DbAdapter';
import { CREATE_INDEXES, CREATE_TABLES } from '../../src/database/schema';
import { ProfileVariableMapper } from '../../src/mappers/ProfileMapper';
import { ShortcutService } from '../../src/services/ShortcutService';
import { VariableService } from '../../src/services/VariableService';
import { searchShortcuts } from '../../src/shortcuts/search';
import {
  createMemoryDbAdapter,
  type MemoryDbAdapter,
} from '../helpers/memoryDbAdapter';

/**
 * 検索画面のショートカット検索は、定型文と同じくプロファイルを跨ぐ（§8.7）。
 *
 * 画面（apps/mobile/src/hooks/screens/useSearchShortcuts.ts）は、有効な各プロファイルについて
 * getByProfileId で取得した一覧を searchShortcuts で絞り込み、一覧とチップの件数に使う。
 * カスタム変数を参照する値はプロファイルごとに解決結果が変わるため、
 * 同じショートカットでもプロファイルによって一致したりしなかったりする。
 * 取得と絞り込みを組み合わせたときの一致の範囲をここで固定する。
 *
 * @remarks
 * このディレクトリのテストは型チェックの対象外。紐づけは必ずIDの配列で渡す
 * （単一IDのキーで渡すと例外にならず、0件＝全プロファイル向けとして作られてしまう）。
 */
describe('プロファイルを跨ぐショートカット検索', () => {
  const databases: MemoryDbAdapter[] = [];

  afterEach(() => databases.splice(0).forEach((db) => db.dispose()));

  /** 標準かつアクティブなプロファイル */
  const MAIN = 'profile-main';
  /** 2件目のプロファイル */
  const OTHER = 'profile-other';
  /** 3件目のプロファイル（どれにも紐づけない側の確認に使う） */
  const THIRD = 'profile-third';

  /** 現行スキーマのDBに3件のプロファイルを入れ、メインDBとして登録する */
  const useDatabase = async (): Promise<MemoryDbAdapter> => {
    const db = createMemoryDbAdapter();
    databases.push(db);
    for (const sql of Object.values(CREATE_TABLES)) await db.exec(sql);
    for (const sql of Object.values(CREATE_INDEXES)) await db.exec(sql);
    db.run("INSERT INTO profiles VALUES (?, 'main', 1, 1, 1, 0, 'created', 'updated')", [MAIN]);
    db.run("INSERT INTO profiles VALUES (?, 'other', 0, 0, 1, 1, 'created', 'updated')", [OTHER]);
    db.run("INSERT INTO profiles VALUES (?, 'third', 0, 0, 1, 2, 'created', 'updated')", [THIRD]);
    setMainDbAdapter(db);
    return db;
  };

  /** 指定プロファイルで検索語に一致したショートカット名を、表示順で取り出す */
  const matchedNames = (profileId: string, query: string): string[] =>
    searchShortcuts(ShortcutService.getByProfileId(profileId), query).map(
      (shortcut) => shortcut.name
    );

  /** 参照用のカスタム変数を1件作り、プロファイル別の値を入れる */
  const createVariable = (values: Record<string, string>): string => {
    const variable = VariableService.create({
      name: 'company',
      label: '会社名',
      icon: 'business-outline',
      type: 'custom',
    });
    for (const [profileId, value] of Object.entries(values)) {
      ProfileVariableMapper.upsert({ profileId, variableId: variable.id, value });
    }
    return variable.id;
  };

  /** カスタム変数を参照する値を1件持つ、全プロファイル向けのショートカットを作る */
  const createReferencing = (variableId: string, storedValue = '') =>
    ShortcutService.create({
      profileIds: [],
      name: '差出人',
      values: [{ name: '会社名', value: storedValue, variableId }],
    });

  it('全プロファイル向けはどのプロファイルでも一致し、紐づけたものはそのプロファイルだけで一致する', async () => {
    await useDatabase();
    ShortcutService.create({
      profileIds: [],
      name: '電話番号（共通）',
      values: [{ name: '代表', value: '03-0000-0000' }],
    });
    ShortcutService.create({
      profileIds: [MAIN],
      name: '電話番号（Main）',
      values: [{ name: '自分', value: '090-0000-0000' }],
    });
    ShortcutService.create({
      profileIds: [OTHER],
      name: '電話番号（Other）',
      values: [{ name: '自分', value: '080-0000-0000' }],
    });

    expect(matchedNames(MAIN, '電話番号')).toEqual(['電話番号（共通）', '電話番号（Main）']);
    expect(matchedNames(OTHER, '電話番号')).toEqual(['電話番号（共通）', '電話番号（Other）']);
    expect(matchedNames(THIRD, '電話番号')).toEqual(['電話番号（共通）']);
  });

  /** アクティブなプロファイルに一致が無くても、他のプロファイルでは見つかる（検索範囲を広げた理由そのもの） */
  it('他のプロファイルだけに紐づけたショートカットも、そのプロファイルで一致する', async () => {
    await useDatabase();
    ShortcutService.create({
      profileIds: [OTHER],
      name: '取引先コード',
      values: [{ name: 'A社', value: 'CUST-001' }],
    });

    expect(matchedNames(MAIN, 'CUST')).toEqual([]);
    expect(matchedNames(OTHER, 'CUST')).toEqual(['取引先コード']);
  });

  it('変数を参照する値は、プロファイルごとに解決した値で一致する', async () => {
    await useDatabase();
    const variableId = createVariable({ [MAIN]: '株式会社Main', [OTHER]: '株式会社Other' });
    createReferencing(variableId);

    expect(matchedNames(MAIN, 'other')).toEqual([]);
    expect(matchedNames(OTHER, 'other')).toEqual(['差出人']);
  });

  /** 参照中の保存文字列は画面に出ないため、一致させると見えない文字列で結果に出てしまう */
  it('参照中の保存文字列は、どのプロファイルでも一致しない', async () => {
    await useDatabase();
    const variableId = createVariable({ [MAIN]: '株式会社Main', [OTHER]: '株式会社Other' });
    createReferencing(variableId, '自前の値');

    expect(matchedNames(MAIN, '自前')).toEqual([]);
    expect(matchedNames(OTHER, '自前')).toEqual([]);
  });

  it('プロファイルに変数の値が無ければ、標準プロファイルの値で一致する', async () => {
    await useDatabase();
    const variableId = createVariable({ [MAIN]: '株式会社Main' });
    createReferencing(variableId);

    expect(matchedNames(OTHER, '株式会社Main')).toEqual(['差出人']);
    expect(matchedNames(THIRD, '株式会社Main')).toEqual(['差出人']);
  });
});
