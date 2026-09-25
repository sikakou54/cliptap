import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setMainDbAdapter } from '../../src/adapters/DbAdapter';
import { CREATE_TABLES } from '../../src/database/schema';
import { ProfileVariableMapper } from '../../src/mappers/ProfileMapper';
import { ProfileService } from '../../src/services/ProfileService';
import { VariableService } from '../../src/services/VariableService';
import { replaceVariables } from '../../src/variables/parser';
import {
  createMemoryDbAdapter,
  type MemoryDbAdapter,
} from '../helpers/memoryDbAdapter';

/**
 * 変数値の前後空白は書き込み境界のService層で除去する。
 *
 * 必須判定は全経路が前後空白を除去して行うため、空白だけの値を保存できると
 * 「必須判定では空なのに解決時は非空」という矛盾が起き、
 * 標準値へのフォールバックが効かなくなる。
 */
describe('variable value normalization', () => {
  let db: MemoryDbAdapter | null = null;

  beforeEach(() => {
    db = createMemoryDbAdapter();
    setMainDbAdapter(db);
    for (const sql of Object.values(CREATE_TABLES)) void db.exec(sql);
    /* 標準環境と作業環境、およびカスタム変数を1件ずつ用意する */
    db.run(
      "INSERT INTO profiles VALUES ('standard', 'standard', 0, 1, 1, 0, 'created', 'updated')"
    );
    db.run(
      "INSERT INTO profiles VALUES ('work', 'work', 1, 0, 1, 1, 'created', 'updated')"
    );
    db.run(
      "INSERT INTO variables VALUES ('v1', 'token', 'custom', NULL, NULL, 1, 0, 'created', 'updated')"
    );
  });

  afterEach(() => {
    db?.dispose();
    db = null;
  });

  /** 標準値・環境値のどちらも同じ規則で正規化する（画面内で規則が割れない） */
  it('normalizes the standard value and the profile value alike', () => {
    ProfileService.setVariableValuesForVariable('v1', [
      { profileId: 'standard', variableId: 'v1', value: ' standard ' },
      { profileId: 'work', variableId: 'v1', value: ' work ' },
    ]);

    expect(ProfileVariableMapper.get('standard', 'v1')?.value).toBe('standard');
    expect(ProfileVariableMapper.get('work', 'v1')?.value).toBe('work');
  });

  /** 空白だけの環境値は空文字になり、解決は標準値へフォールバックする */
  it('falls back to the standard value when the profile value is whitespace only', async () => {
    ProfileService.setVariableValuesForVariable('v1', [
      { profileId: 'standard', variableId: 'v1', value: 'standard-value' },
      { profileId: 'work', variableId: 'v1', value: '   ' },
    ]);

    const profileVariablesMap = ProfileService.getProfileVariablesMap('work');
    const defaultProfileVariablesMap = ProfileService.getDefaultProfileVariablesMap();

    /* 一覧の見た目（同期展開）とコピー経路（リゾルバー）の両方で同じ結果になること */
    expect(
      VariableService.expandTextSync('{{token}}', {
        locale: 'ja',
        profileVariablesMap,
        defaultProfileVariablesMap,
      })
    ).toBe('standard-value');

    const resolver = VariableService.createCustomVariableResolver({
      isSubscribed: true,
      profileVariablesMap,
      defaultProfileVariablesMap,
    });
    await expect(
      replaceVariables('{{token}}', { customResolver: resolver })
    ).resolves.toBe('standard-value');
  });
});
