import { afterEach, describe, expect, it } from 'vitest';
import { setMainDbAdapter } from '../../src/adapters/DbAdapter';
import { CREATE_INDEXES, CREATE_TABLES } from '../../src/database/schema';
import { ProfileVariableMapper } from '../../src/mappers/ProfileMapper';
import { ProfileService } from '../../src/services/ProfileService';
import { ShortcutService } from '../../src/services/ShortcutService';
import { VariableService } from '../../src/services/VariableService';
import { attachDisplayValues } from '../../src/shortcuts/display';
import { searchShortcuts } from '../../src/shortcuts/search';
import {
  createMemoryDbAdapter,
  type MemoryDbAdapter,
} from '../helpers/memoryDbAdapter';

/**
 * 検索画面のショートカット検索は、定型文と同じくプロファイルを跨ぐ（§8.7）。
 *
 * 画面（apps/mobile/src/hooks/screens/useSearchShortcuts.ts）は、有効な各プロファイルについて
 * getByProfileId で取得した一覧へ、そのプロファイルで変数を展開した表示用の値を持たせ、
 * searchShortcuts で絞り込んで一覧とチップの件数に使う。
 * 変数を含む値はプロファイルごとに展開結果が変わるため、
 * 同じショートカットでもプロファイルによって一致したりしなかったりする。
 * 取得・展開・絞り込みを組み合わせたときの一致の範囲をここで固定する。
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

  /** 指定プロファイルで検索語に一致したショートカット名を、表示順で取り出す（画面と同じく展開後の値で照合する） */
  const matchedNames = (profileId: string, query: string): string[] => {
    const profileVariablesMap = ProfileService.getProfileVariablesMap(profileId);
    const defaultProfileVariablesMap = ProfileService.getDefaultProfileVariablesMap();
    const displayed = attachDisplayValues(ShortcutService.getByProfileId(profileId), (text) =>
      VariableService.expandTextSync(text, {
        locale: 'ja',
        profileVariablesMap,
        defaultProfileVariablesMap,
      })
    );
    return searchShortcuts(displayed, query).map((shortcut) => shortcut.name);
  };

  /** カスタム変数 company を1件作り、プロファイル別の値を入れる */
  const createVariable = (values: Record<string, string>): void => {
    const variable = VariableService.create({
      name: 'company',
      label: '会社名',
      icon: 'business-outline',
      type: 'custom',
    });
    for (const [profileId, value] of Object.entries(values)) {
      ProfileVariableMapper.upsert({ profileId, variableId: variable.id, value });
    }
  };

  /** 変数を含む値を1件持つ、全プロファイル向けのショートカットを作る */
  const createWithToken = () =>
    ShortcutService.create({
      profileIds: [],
      name: '差出人',
      values: [{ value: '{{company}} 御中', isMasked: false }],
    });

  it('全プロファイル向けはどのプロファイルでも一致し、紐づけたものはそのプロファイルだけで一致する', async () => {
    await useDatabase();
    ShortcutService.create({
      profileIds: [],
      name: '電話番号（共通）',
      values: [{ value: '03-0000-0000', isMasked: false }],
    });
    ShortcutService.create({
      profileIds: [MAIN],
      name: '電話番号（Main）',
      values: [{ value: '090-0000-0000', isMasked: false }],
    });
    ShortcutService.create({
      profileIds: [OTHER],
      name: '電話番号（Other）',
      values: [{ value: '080-0000-0000', isMasked: false }],
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
      values: [{ value: 'CUST-001', isMasked: false }],
    });

    expect(matchedNames(MAIN, 'CUST')).toEqual([]);
    expect(matchedNames(OTHER, 'CUST')).toEqual(['取引先コード']);
  });

  it('変数を含む値は、プロファイルごとに展開した値で一致する', async () => {
    await useDatabase();
    createVariable({ [MAIN]: '株式会社Main', [OTHER]: '株式会社Other' });
    createWithToken();

    expect(matchedNames(MAIN, 'other')).toEqual([]);
    expect(matchedNames(OTHER, 'other')).toEqual(['差出人']);
  });

  /** 保存されたトークンの変数名は画面に出ないため、一致させると見えない文字列で結果に出てしまう */
  it('値を展開できる変数の名前では、どのプロファイルでも一致しない', async () => {
    await useDatabase();
    createVariable({ [MAIN]: '株式会社Main', [OTHER]: '株式会社Other' });
    createWithToken();

    expect(matchedNames(MAIN, 'company')).toEqual([]);
    expect(matchedNames(OTHER, 'company')).toEqual([]);
    expect(matchedNames(THIRD, 'company')).toEqual([]);
  });

  it('プロファイルに変数の値が無ければ、標準プロファイルの値で一致する', async () => {
    await useDatabase();
    createVariable({ [MAIN]: '株式会社Main' });
    createWithToken();

    expect(matchedNames(OTHER, '株式会社Main')).toEqual(['差出人']);
    expect(matchedNames(THIRD, '株式会社Main')).toEqual(['差出人']);
  });

  /** 展開できないトークンは画面にもトークンのまま出るため、表示どおりトークンの文字列で一致する */
  it('どこにも値の無い変数はトークンのまま表示され、その文字列で一致する', async () => {
    await useDatabase();
    createVariable({});
    createWithToken();

    expect(matchedNames(MAIN, '{{company}}')).toEqual(['差出人']);
  });
});
