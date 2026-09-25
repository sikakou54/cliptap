import { describe, it, expect } from 'vitest';
import type { Snippet, SnippetProfile } from '../../src/schema';
import { searchSnippetsAcrossProfiles } from '../../src/utils/crossProfileSnippetSearch';

/**
 * 定型文を組み立てる
 *
 * @param id - 定型文ID
 * @param title - タイトル（nullなら無し）
 * @param content - 本文
 * @returns 検索に必要な項目を埋めた定型文
 */
function makeSnippet(id: string, title: string | null, content: string): Snippet {
  return {
    id,
    title,
    content,
    categoryId: null,
    copyWithTitle: false,
    copyCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

/* プロファイルごとに値が違う変数をひとつだけ持つ展開関数 */
const PROFILE_COMPANY: Record<string, string> = {
  main: '株式会社サンプル',
  work: '株式会社ABC',
  private: '株式会社サンプル',
};

/**
 * `{{company}}` だけを展開する
 *
 * @param text - 展開前の文字列
 * @param profileId - 展開に使うプロファイル
 * @returns 展開後の文字列
 */
function expand(text: string, profileId: string): string {
  return text.split('{{company}}').join(PROFILE_COMPANY[profileId] ?? '{{company}}');
}

const PROFILES = [{ id: 'main' }, { id: 'work' }, { id: 'private' }];

describe('searchSnippetsAcrossProfiles', () => {
  it('展開結果が違うプロファイルは別の行になる', () => {
    const snippets = [makeSnippet('s1', '商談お礼', '{{company}}の山田です')];

    const rows = searchSnippetsAcrossProfiles({
      snippets,
      snippetProfiles: [],
      profiles: PROFILES,
      query: 'お礼',
      expand,
    });

    /* mainとprivateは同じ会社名のためまとまり、workだけ別の行になる */
    expect(rows).toHaveLength(2);
    expect(rows[0].displayContent).toBe('株式会社サンプルの山田です');
    expect(rows[0].matchedProfileIds).toEqual(['main', 'private']);
    expect(rows[1].displayContent).toBe('株式会社ABCの山田です');
    expect(rows[1].matchedProfileIds).toEqual(['work']);
  });

  it('変数を含まない定型文はプロファイルの数だけ重複しない', () => {
    const snippets = [makeSnippet('s1', '日報テンプレ', '本日の報告です')];

    const rows = searchSnippetsAcrossProfiles({
      snippets,
      snippetProfiles: [],
      profiles: PROFILES,
      query: '日報',
      expand,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].matchedProfileIds).toEqual(['main', 'work', 'private']);
  });

  it('展開後の文字列だけで照合し、変数トークンでは一致しない', () => {
    const snippets = [makeSnippet('s1', null, '{{company}}の山田です')];

    const byToken = searchSnippetsAcrossProfiles({
      snippets,
      snippetProfiles: [],
      profiles: PROFILES,
      query: 'company',
      expand,
    });
    expect(byToken).toHaveLength(0);

    const byExpanded = searchSnippetsAcrossProfiles({
      snippets,
      snippetProfiles: [],
      profiles: PROFILES,
      query: 'ABC',
      expand,
    });
    /* 「ABC」を含むのはworkの展開結果だけ */
    expect(byExpanded).toHaveLength(1);
    expect(byExpanded[0].matchedProfileIds).toEqual(['work']);
  });

  it('紐づけがある定型文は紐づけ先のプロファイルでだけ対象になる', () => {
    const snippets = [makeSnippet('s1', '社外秘', '{{company}}の資料')];
    const snippetProfiles: SnippetProfile[] = [{ snippetId: 's1', profileId: 'work' }];

    const rows = searchSnippetsAcrossProfiles({
      snippets,
      snippetProfiles,
      profiles: PROFILES,
      query: '',
      expand,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].matchedProfileIds).toEqual(['work']);
    expect(rows[0].displayContent).toBe('株式会社ABCの資料');
  });

  it('検索語が空なら表示対象をすべて返す', () => {
    const snippets = [
      makeSnippet('s1', 'あいさつ', 'おはようございます'),
      makeSnippet('s2', null, '{{company}}の山田です'),
    ];

    const rows = searchSnippetsAcrossProfiles({
      snippets,
      snippetProfiles: [],
      profiles: PROFILES,
      query: '   ',
      expand,
    });

    /* s1は1行、s2は展開結果が2種類あるため2行 */
    expect(rows.map((row) => row.id)).toEqual(['s1', 's2', 's2']);
  });

  it('行のキーは同じ定型文が複数行に分かれても重複しない', () => {
    const snippets = [makeSnippet('s1', null, '{{company}}')];

    const rows = searchSnippetsAcrossProfiles({
      snippets,
      snippetProfiles: [],
      profiles: PROFILES,
      query: '',
      expand,
    });

    expect(new Set(rows.map((row) => row.rowKey)).size).toBe(rows.length);
  });

  it('対象プロファイルを1件に絞ると、そのプロファイルの展開結果だけを返す', () => {
    const snippets = [makeSnippet('s1', null, '{{company}}の山田です')];

    const rows = searchSnippetsAcrossProfiles({
      snippets,
      snippetProfiles: [],
      profiles: [{ id: 'work' }],
      query: '',
      expand,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].displayContent).toBe('株式会社ABCの山田です');
    expect(rows[0].matchedProfileIds).toEqual(['work']);
  });

  it('対象プロファイルが無ければ空を返す', () => {
    const rows = searchSnippetsAcrossProfiles({
      snippets: [makeSnippet('s1', null, 'あいさつ')],
      snippetProfiles: [],
      profiles: [],
      query: '',
      expand,
    });

    expect(rows).toEqual([]);
  });
});
