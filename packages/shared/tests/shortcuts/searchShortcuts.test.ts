import { describe, expect, it } from 'vitest';
import { searchShortcuts } from '../../src/shortcuts/search';

/**
 * ショートカット検索は、ショートカット名・値名・値の3つを対象にする。
 * どれか1つでも落とすと「見えているのに探せない」状態になるため、対象をここで固定する。
 * 値は一覧に表示される展開後の文字列（displayValue）で照合する。
 */
describe('searchShortcuts', () => {
  /** 検索対象を1件ずつ持たせたテストデータ（displayValue は表示中のプロファイルで展開した値） */
  const shortcuts = [
    {
      name: '電話番号',
      values: [
        { name: '自分', value: '090-1234-5678', displayValue: '090-1234-5678' },
        { name: '会社', value: '{{company_phone}}', displayValue: '03-9876-5432' },
      ],
    },
    {
      name: 'メールアドレス',
      values: [{ name: '個人', value: 'taro@example.com', displayValue: 'taro@example.com' }],
    },
    {
      name: 'Address',
      values: [{ name: 'Home', value: 'Tokyo', displayValue: 'Tokyo' }],
    },
  ];

  /** 一致したショートカット名だけを取り出す */
  const namesOf = (query: string): string[] =>
    searchShortcuts(shortcuts, query).map((shortcut) => shortcut.name);

  it('ショートカット名で一致する', () => {
    expect(namesOf('電話')).toEqual(['電話番号']);
  });

  it('値名で一致する', () => {
    expect(namesOf('個人')).toEqual(['メールアドレス']);
  });

  it('値で一致する', () => {
    expect(namesOf('taro@')).toEqual(['メールアドレス']);
  });

  /** 画面に見えている展開後の値で探す。保存されたトークンの変数名は画面に出ないため一致させない */
  it('変数を含む値は展開後の値で一致し、変数名では一致しない', () => {
    expect(namesOf('9876')).toEqual(['電話番号']);
    expect(namesOf('company_phone')).toEqual([]);
  });

  /** 英字は大小を区別せずに突き合わせる（候補推測と同じ方針） */
  it('英字の大文字・小文字を区別しない', () => {
    expect(namesOf('address')).toEqual(['Address']);
    expect(namesOf('TOKYO')).toEqual(['Address']);
  });

  /** 空文字はどんな文字列にも含まれるため、条件として扱うと意味を持たない */
  it('検索語が空なら全件を返す', () => {
    expect(namesOf('')).toEqual(['電話番号', 'メールアドレス', 'Address']);
    expect(namesOf('   ')).toEqual(['電話番号', 'メールアドレス', 'Address']);
  });

  it('前後の空白は無視する', () => {
    expect(namesOf('  電話  ')).toEqual(['電話番号']);
  });

  it('一致しなければ0件になる', () => {
    expect(namesOf('該当なし')).toEqual([]);
  });

  /** 並べ替えは行わず、渡された表示順のまま返す */
  it('元の並び順を保つ', () => {
    expect(namesOf('o')).toEqual(['メールアドレス', 'Address']);
  });

  /** 呼び出し元の配列を書き換えない（一覧の状態を壊さない） */
  it('渡された配列を変更しない', () => {
    const original = [...shortcuts];
    searchShortcuts(shortcuts, '電話');
    expect(shortcuts).toEqual(original);
  });
});
