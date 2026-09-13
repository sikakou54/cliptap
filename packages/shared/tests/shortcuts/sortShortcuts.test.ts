import { describe, expect, it } from 'vitest';
import { sortShortcuts } from '../../src/shortcuts/sort';

/**
 * ショートカットの並べ替えは定型文（SnippetMapper.getSorted）と同じ4種を使う。
 * 同順位の決着まで合わせているため、基準ごとの並びと同点時の扱いをここで固定する。
 */
describe('sortShortcuts', () => {
  /** 使用回数だけを持つ値を組み立てる */
  const value = (useCount: number) => ({ useCount });

  const shortcuts = [
    {
      name: 'B電話',
      createdAt: '2026-01-02T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
      values: [value(1), value(2)],
    },
    {
      name: 'A住所',
      createdAt: '2026-01-03T00:00:00.000Z',
      updatedAt: '2026-02-01T00:00:00.000Z',
      values: [value(10)],
    },
    {
      name: 'Cメール',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z',
      values: [],
    },
  ];

  /** 並べ替え後の名前だけを取り出す */
  const namesOf = (sortBy: Parameters<typeof sortShortcuts>[1]): string[] =>
    sortShortcuts(shortcuts, sortBy).map((shortcut) => shortcut.name);

  it('作成日時順は新しいものが先頭に来る', () => {
    expect(namesOf('created')).toEqual(['A住所', 'B電話', 'Cメール']);
  });

  it('更新日時順は新しいものが先頭に来る', () => {
    expect(namesOf('updated')).toEqual(['Cメール', 'B電話', 'A住所']);
  });

  it('名前順は昇順で並ぶ', () => {
    expect(namesOf('title')).toEqual(['A住所', 'B電話', 'Cメール']);
  });

  /** 使用回数は値ごとに持つため、ショートカット単位では合計で比べる */
  it('使用頻度順は値の使用回数の合計が多いものが先頭に来る', () => {
    expect(namesOf('usage')).toEqual(['A住所', 'B電話', 'Cメール']);
  });

  /** 値を持たないショートカットも合計0として扱い、取りこぼさない */
  it('値が0件でも並びから欠落しない', () => {
    expect(sortShortcuts(shortcuts, 'usage')).toHaveLength(shortcuts.length);
  });

  it('同じ作成日時なら名前順で決着する', () => {
    const sameCreated = [
      { name: 'Z', createdAt: 'same', updatedAt: 'x', values: [] },
      { name: 'A', createdAt: 'same', updatedAt: 'x', values: [] },
    ];
    expect(sortShortcuts(sameCreated, 'created').map((s) => s.name)).toEqual(['A', 'Z']);
  });

  it('使用頻度が同数なら作成日時の新しい順で決着する', () => {
    const sameUsage = [
      { name: '古い', createdAt: '2026-01-01', updatedAt: 'x', values: [value(3)] },
      { name: '新しい', createdAt: '2026-01-02', updatedAt: 'x', values: [value(3)] },
    ];
    expect(sortShortcuts(sameUsage, 'usage').map((s) => s.name)).toEqual(['新しい', '古い']);
  });

  /**
   * 名前の比較はコード順で行う（ロケール照合ではない）。
   * 定型文のSQL（BINARY照合）と拡張キーボードのSwift・Kotlinに合わせているため、
   * ここをlocaleCompareへ戻すとアプリとキーボードで並びが食い違う。
   */
  it('名前順は大文字を小文字より先に並べる（コード順）', () => {
    const mixedCase = [
      { name: 'apple', createdAt: 'x', updatedAt: 'x', values: [] },
      { name: 'Banana', createdAt: 'x', updatedAt: 'x', values: [] },
    ];
    expect(sortShortcuts(mixedCase, 'title').map((s) => s.name)).toEqual(['Banana', 'apple']);
  });

  /** 呼び出し元の一覧を書き換えない（Providerの保持する配列を壊さない） */
  it('渡された配列を変更しない', () => {
    const original = shortcuts.map((s) => s.name);
    sortShortcuts(shortcuts, 'title');
    expect(shortcuts.map((s) => s.name)).toEqual(original);
  });
});
