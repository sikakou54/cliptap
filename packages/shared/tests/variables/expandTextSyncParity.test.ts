import { afterEach, describe, expect, it } from 'vitest';
import { setMainDbAdapter } from '../../src/adapters/DbAdapter';
import { CREATE_TABLES } from '../../src/database/schema';
import { VariableService } from '../../src/services/VariableService';
import { replaceVariables } from '../../src/variables/parser';
import {
  createMemoryDbAdapter,
  type MemoryDbAdapter,
} from '../helpers/memoryDbAdapter';

/**
 * 一覧表示経路（expandTextSync）とコピー／プレビュー経路
 * （createCustomVariableResolver）が同一入力に対して同一結果を返すことを保証する。
 *
 * 機能仕様書の定める解決順序は「アクティブプロファイルの非空値 →
 * 標準プロファイルの非空値 → 元トークン」であり、空文字は未設定として扱う。
 * 両経路が食い違うと「一覧に見えている文字列と、コピーされる文字列が違う」
 * というユーザーに直接露出する不具合になるため、回帰テストで固定する。
 */
describe('expandTextSync / customResolver parity', () => {
  let db: MemoryDbAdapter | null = null;

  afterEach(() => {
    db?.dispose();
    db = null;
  });

  const setup = (): void => {
    db = createMemoryDbAdapter();
    setMainDbAdapter(db);
    for (const sql of Object.values(CREATE_TABLES)) void db.exec(sql);
    db.run(
      "INSERT INTO variables VALUES ('v1', 'token', 'custom', NULL, NULL, 1, 0, 'created', 'updated')"
    );
  };

  /* resolution.test.ts がリゾルバ側の正解として固定している3ケースと同一入力 */
  it.each([
    ['アクティブの非空値を採用する', 'active', 'default', 'active'],
    ['アクティブが空文字なら標準の非空値へフォールバックする', '', 'default', 'default'],
    ['両方が空文字ならトークンを保持する', '', '', '{{token}}'],
  ])('%s', async (_name, active, standard, expected) => {
    setup();

    const resolver = VariableService.createCustomVariableResolver({
      isSubscribed: true,
      profileVariablesMap: { token: active },
      defaultProfileVariablesMap: { token: standard },
    });
    const copied = await replaceVariables('{{token}}', { customResolver: resolver });

    const displayed = VariableService.expandTextSync('{{token}}', {
      locale: 'ja',
      profileVariablesMap: { token: active },
      defaultProfileVariablesMap: { token: standard },
    });

    expect(copied).toBe(expected);
    expect(displayed).toBe(expected);
  });

  it('未設定キー（undefined）と空文字を同じ扱いにする', async () => {
    setup();

    const resolver = VariableService.createCustomVariableResolver({
      isSubscribed: true,
      profileVariablesMap: {},
      defaultProfileVariablesMap: { token: 'ABC' },
    });

    /* キー自体が無い場合 */
    const missingKeyCopied = await replaceVariables('{{token}}', { customResolver: resolver });
    const missingKeyDisplayed = VariableService.expandTextSync('{{token}}', {
      locale: 'ja',
      profileVariablesMap: {},
      defaultProfileVariablesMap: { token: 'ABC' },
    });

    /* 値を入力せずに保存したことで空文字行がDBに残っている場合 */
    const emptyRowDisplayed = VariableService.expandTextSync('{{token}}', {
      locale: 'ja',
      profileVariablesMap: { token: '' },
      defaultProfileVariablesMap: { token: 'ABC' },
    });

    expect(missingKeyCopied).toBe('ABC');
    expect(missingKeyDisplayed).toBe('ABC');
    expect(emptyRowDisplayed).toBe('ABC');
  });

  it('未入力のプロファイルへ切り替えても表示とコピーが一致する（再現ケース）', async () => {
    setup();

    /* 標準プロファイルに ABC、プロファイル Work は未入力（空文字行）で保存された状態 */
    const profileVariablesMap = { token: '' };
    const defaultProfileVariablesMap = { token: 'ABC' };
    const text = 'Bearer {{token}}';

    const resolver = VariableService.createCustomVariableResolver({
      isSubscribed: true,
      profileVariablesMap,
      defaultProfileVariablesMap,
    });

    const copied = await replaceVariables(text, { customResolver: resolver });
    const displayed = VariableService.expandTextSync(text, {
      locale: 'ja',
      profileVariablesMap,
      defaultProfileVariablesMap,
    });

    expect(displayed).toBe('Bearer ABC');
    expect(copied).toBe(displayed);
  });

  /* 値に置換パターンの記号や別のトークンが含まれていても、表示とコピーが一致する。
     コピー経路が文字列で置換していた頃は `$&` がトークンに戻り、`{{...}}` が再展開されていた */
  it.each([
    ['置換パターンの記号をそのまま出す', 'A$&B $$ C', 'Price: A$&B $$ C'],
    ['値に含まれるトークンを再展開しない', '{{token}}', 'Price: {{token}}'],
  ])('%s', async (_name, value, expected) => {
    setup();

    const text = 'Price: {{token}}';
    const resolver = VariableService.createCustomVariableResolver({
      isSubscribed: true,
      profileVariablesMap: { token: value },
      defaultProfileVariablesMap: {},
    });

    const copied = await replaceVariables(text, { customResolver: resolver });
    const displayed = VariableService.expandTextSync(text, {
      locale: 'ja',
      profileVariablesMap: { token: value },
      defaultProfileVariablesMap: {},
    });

    expect(displayed).toBe(expected);
    expect(copied).toBe(expected);
  });
});
