import { afterEach, describe, expect, it } from 'vitest';
import { setMainDbAdapter } from '../../src/adapters/DbAdapter';
import { CREATE_INDEXES, CREATE_TABLES } from '../../src/database/schema';
import { ProfileVariableMapper } from '../../src/mappers/ProfileMapper';
import { createCustomResolver } from '../../src/providers/variableCopyContext';
import { ProfileService } from '../../src/services/ProfileService';
import { ShortcutService } from '../../src/services/ShortcutService';
import { VariableService } from '../../src/services/VariableService';
import { attachDisplayValues } from '../../src/shortcuts/display';
import {
  createMemoryDbAdapter,
  type MemoryDbAdapter,
} from '../helpers/memoryDbAdapter';

/**
 * ショートカット値の変数展開（§8.24）
 *
 * 値は変数トークンを未展開のまま保存し、一覧の表示（attachDisplayValues + expandTextSync）と
 * コピー（ShortcutService.prepareValueForClipboard + createCustomResolver）がそれぞれ展開する。
 * 両経路が食い違うと「一覧に見えている文字列と、コピーされる文字列が違う」不具合になるため、
 * 同じ入力で同じ結果になることを実DBで固定する。
 */
describe('ショートカット値の変数展開', () => {
  const databases: MemoryDbAdapter[] = [];

  afterEach(() => databases.splice(0).forEach((db) => db.dispose()));

  /** 標準かつアクティブなプロファイル */
  const MAIN = 'profile-main';
  /** 変数の値を別に持つプロファイル */
  const OTHER = 'profile-other';
  /** 変数の値を持たないプロファイル（標準プロファイルへフォールバックする） */
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

  /** カスタム変数 company を作り、プロファイル別の値を入れる */
  const createCompany = (values: Record<string, string>): string => {
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

  /** 全プロファイル向けのショートカットを作り、そのIDを返す */
  const createShortcut = (value: string): string =>
    ShortcutService.create({
      profileIds: [],
      name: '差出人',
      value,
    }).id;

  /** 一覧の表示経路で、指定プロファイルの表示用の値を取り出す */
  const displayed = (profileId: string): string => {
    const profileVariablesMap = ProfileService.getProfileVariablesMap(profileId);
    const defaultProfileVariablesMap = ProfileService.getDefaultProfileVariablesMap();
    const [shortcut] = attachDisplayValues(ShortcutService.getByProfileId(profileId), (text) =>
      VariableService.expandTextSync(text, {
        locale: 'ja',
        profileVariablesMap,
        defaultProfileVariablesMap,
      })
    );
    return shortcut?.displayValue ?? '';
  };

  /** コピー経路で、指定プロファイルを基準に展開した文字列を取り出す */
  const copied = async (profileId: string): Promise<string> => {
    const [shortcut] = ShortcutService.getByProfileId(profileId);
    return ShortcutService.prepareValueForClipboard(shortcut?.value ?? '', {
      locale: 'ja',
      customResolver: createCustomResolver(profileId),
    });
  };

  it('取得した値は変数トークンを展開せず、保存した文字列のまま持つ', async () => {
    await useDatabase();
    createCompany({ [MAIN]: '株式会社Main' });
    const id = createShortcut('{{company}} 御中');

    expect(ShortcutService.getByProfileId(MAIN)[0]?.value).toBe('{{company}} 御中');
    expect(ShortcutService.getById(id)?.value).toBe('{{company}} 御中');
  });

  it.each([
    ['アクティブなプロファイルの値', MAIN, '株式会社Main 御中'],
    ['別のプロファイルの値', OTHER, '株式会社Other 御中'],
    ['値の無いプロファイルは標準プロファイルの値', THIRD, '株式会社Main 御中'],
  ])('表示とコピーが同じく%sで展開する', async (_name, profileId, expected) => {
    await useDatabase();
    createCompany({ [MAIN]: '株式会社Main', [OTHER]: '株式会社Other' });
    createShortcut('{{company}} 御中');

    expect(displayed(profileId)).toBe(expected);
    expect(await copied(profileId)).toBe(expected);
  });

  it('定義の無い変数と無効な変数は、表示でもコピーでもトークンのまま残る', async () => {
    const db = await useDatabase();
    const variableId = createCompany({ [MAIN]: '株式会社Main' });
    db.run('UPDATE variables SET valid = 0 WHERE id = ?', [variableId]);
    createShortcut('{{unknown}} / {{company}}');

    expect(displayed(MAIN)).toBe('{{unknown}} / {{company}}');
    expect(await copied(MAIN)).toBe('{{unknown}} / {{company}}');
  });

  it('システム変数を展開する', async () => {
    await useDatabase();
    createShortcut('{{year}}年度');

    const shown = displayed(MAIN);
    expect(shown).toMatch(/^\d{4}年度$/);
    expect(await copied(MAIN)).toBe(shown);
  });

  /* 変数の値に置換パターンの記号があっても、表示とコピーが同じ文字列になる */
  it('変数の値に含まれる $ の記号をそのまま出す', async () => {
    await useDatabase();
    createCompany({ [MAIN]: 'A$&B $$ C' });
    createShortcut('{{company}} 御中');

    expect(displayed(MAIN)).toBe('A$&B $$ C 御中');
    expect(await copied(MAIN)).toBe('A$&B $$ C 御中');
  });

  /* 定型文と同じく、変数を削除しても保存した文字列は書き換えず、未解決のトークンとして残す（§8.5） */
  it('変数を削除しても値の文字列は変わらず、トークンのまま表示する', async () => {
    await useDatabase();
    const variableId = createCompany({ [MAIN]: '株式会社Main' });
    const id = createShortcut('{{company}} 御中');

    VariableService.delete(variableId);

    expect(ShortcutService.getById(id)?.value).toBe('{{company}} 御中');
    expect(displayed(MAIN)).toBe('{{company}} 御中');
    expect(await copied(MAIN)).toBe('{{company}} 御中');
  });
});
