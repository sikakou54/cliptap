import { describe, it, expect } from 'vitest';
import type { Shortcut } from '../../src/schema';
import { searchShortcutsAcrossProfiles } from '../../src/shortcuts/crossProfileSearch';

/**
 * ショートカットを組み立てる
 *
 * @param id - ショートカットID
 * @param name - ショートカット名
 * @param values - 保存されている値（変数トークンを含んだまま）
 * @returns 検索に必要な項目を埋めたショートカット
 */
function makeShortcut(id: string, name: string, values: string[]): Shortcut {
  return {
    id,
    categoryId: null,
    name,
    sortOrder: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    profileIds: [],
    values: values.map((value, index) => ({
      id: `${id}-v${index}`,
      shortcutId: id,
      value,
      isMasked: false,
      useCount: 0,
      sortOrder: index,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })),
  };
}

/* プロファイルごとに値が違う変数をひとつだけ持つ展開関数 */
const PROFILE_MAIL: Record<string, string> = {
  main: 'yamada@sample.co.jp',
  work: 'yamada@abc.co.jp',
  private: 'yamada@sample.co.jp',
};

/**
 * `{{mail}}` だけを展開する
 *
 * @param text - 展開前の文字列
 * @param profileId - 展開に使うプロファイル
 * @returns 展開後の文字列
 */
function expand(text: string, profileId: string): string {
  return text.split('{{mail}}').join(PROFILE_MAIL[profileId] ?? '{{mail}}');
}

const PROFILES = [{ id: 'main' }, { id: 'work' }, { id: 'private' }];

describe('searchShortcutsAcrossProfiles', () => {
  it('展開結果が違うプロファイルは別の行になる', () => {
    const shortcut = makeShortcut('c1', 'メールアドレス', ['{{mail}}']);
    const shortcutsByProfile = new Map([
      ['main', [shortcut]],
      ['work', [shortcut]],
      ['private', [shortcut]],
    ]);

    const rows = searchShortcutsAcrossProfiles({
      shortcutsByProfile,
      profiles: PROFILES,
      query: 'メール',
      expand,
    });

    expect(rows).toHaveLength(2);
    expect(rows[0].values[0].displayValue).toBe('yamada@sample.co.jp');
    expect(rows[0].matchedProfileIds).toEqual(['main', 'private']);
    expect(rows[1].values[0].displayValue).toBe('yamada@abc.co.jp');
    expect(rows[1].matchedProfileIds).toEqual(['work']);
  });

  it('変数を含まないショートカットはプロファイルの数だけ重複しない', () => {
    const shortcut = makeShortcut('c1', '電話番号', ['090-0000-0000']);
    const shortcutsByProfile = new Map([
      ['main', [shortcut]],
      ['work', [shortcut]],
      ['private', [shortcut]],
    ]);

    const rows = searchShortcutsAcrossProfiles({
      shortcutsByProfile,
      profiles: PROFILES,
      query: '090',
      expand,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].matchedProfileIds).toEqual(['main', 'work', 'private']);
  });

  it('展開後の値で照合し、変数トークンでは一致しない', () => {
    const shortcut = makeShortcut('c1', '連絡先', ['{{mail}}']);
    const shortcutsByProfile = new Map([['work', [shortcut]]]);

    expect(
      searchShortcutsAcrossProfiles({ shortcutsByProfile, profiles: PROFILES, query: 'mail', expand })
    ).toHaveLength(0);

    expect(
      searchShortcutsAcrossProfiles({ shortcutsByProfile, profiles: PROFILES, query: 'abc.co.jp', expand })
    ).toHaveLength(1);
  });

  it('プロファイルごとに見えるショートカットが違っても、それぞれの一覧から拾う', () => {
    const shared = makeShortcut('c1', '電話番号', ['090-0000-0000']);
    const workOnly = makeShortcut('c2', '内線番号', ['1234']);
    const shortcutsByProfile = new Map([
      ['main', [shared]],
      ['work', [shared, workOnly]],
    ]);

    const rows = searchShortcutsAcrossProfiles({
      shortcutsByProfile,
      profiles: PROFILES,
      query: '',
      expand,
    });

    expect(rows.map((row) => row.id)).toEqual(['c1', 'c2']);
    expect(rows[0].matchedProfileIds).toEqual(['main', 'work']);
    expect(rows[1].matchedProfileIds).toEqual(['work']);
  });

  it('行のキーは同じショートカットが複数行に分かれても重複しない', () => {
    const shortcut = makeShortcut('c1', '連絡先', ['{{mail}}']);
    const shortcutsByProfile = new Map([
      ['main', [shortcut]],
      ['work', [shortcut]],
    ]);

    const rows = searchShortcutsAcrossProfiles({
      shortcutsByProfile,
      profiles: PROFILES,
      query: '',
      expand,
    });

    expect(new Set(rows.map((row) => row.rowKey)).size).toBe(rows.length);
  });

  it('対象プロファイルを1件に絞ると、そのプロファイルの展開結果だけを返す', () => {
    const shortcut = makeShortcut('c1', '連絡先', ['{{mail}}']);
    const shortcutsByProfile = new Map([
      ['main', [shortcut]],
      ['work', [shortcut]],
    ]);

    const rows = searchShortcutsAcrossProfiles({
      shortcutsByProfile,
      profiles: [{ id: 'work' }],
      query: '',
      expand,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].values[0].displayValue).toBe('yamada@abc.co.jp');
    expect(rows[0].matchedProfileIds).toEqual(['work']);
  });
});
