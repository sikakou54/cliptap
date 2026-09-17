/**
 * ショートカットの並べ替え
 *
 * @module shortcuts/sort
 *
 * @remarks
 * 定型文の並べ替え（SnippetMapper.getSorted）はSQLで行うが、ショートカットは
 * 表示対象がアクティブなプロファイルの分だけで件数も小さいため、
 * 取得済みの一覧をメモリ上で並べ替える。取得経路を1本に保つためでもある。
 *
 * 並べ替えの基準は定型文と同じ4種を使う（SnippetSortBy）。
 * `title` はショートカット名を指す。
 */

import type { SnippetSortBy } from '../types/snippet';

/**
 * 並べ替えの対象になるショートカット値
 */
export interface SortableShortcutValue {
  /** 拡張キーボードから挿入した回数 */
  readonly useCount: number;
}

/**
 * 並べ替えの対象になるショートカット
 */
export interface SortableShortcut {
  /** ショートカット名 */
  readonly name: string;
  /** 作成日時 */
  readonly createdAt: string;
  /** 更新日時 */
  readonly updatedAt: string;
  /** ショートカットが持つ値 */
  readonly values: readonly SortableShortcutValue[];
}

/**
 * ショートカットの使用回数
 *
 * @param shortcut - 対象のショートカット
 * @returns 値ごとの使用回数の合計
 *
 * @remarks
 * 使用回数は値ごとに持つため、ショートカット単位の使用頻度は合計で表す。
 * 最大値ではなく合計にするのは、「よく使う値が1つあるショートカット」と
 * 「満遍なく使うショートカット」のどちらも上位に来るようにするため。
 */
function totalUseCount(shortcut: SortableShortcut): number {
  return shortcut.values.reduce((total, value) => total + value.useCount, 0);
}

/**
 * ショートカットを並べ替える
 *
 * @param shortcuts - 並べ替える前のショートカット一覧
 * @param sortBy - 並べ替えの基準
 * @returns 並べ替えたショートカット（引数の配列は変更しない）
 *
 * @remarks
 * 同順位の決着は定型文（SnippetMapper.getSorted）と同じ考え方に揃える。
 * - 日時順は同日時のときに名前順
 * - 名前順は同名のときに作成日時の新しい順
 * - 使用頻度順は同数のときに作成日時の新しい順
 */
export function sortShortcuts<T extends SortableShortcut>(
  shortcuts: readonly T[],
  sortBy: SnippetSortBy
): T[] {
  /**
   * 文字列の昇順比較
   *
   * localeCompareを使わないのは、同じ並べ替えを3実装で一致させるため。
   * 定型文はSQLの `ORDER BY title ASC`（SQLite既定のBINARY照合＝コード順）で並び、
   * 拡張キーボードのSwift・Kotlinも同じコード順で比べる。
   * ここだけロケール照合にすると、同じ設定なのにアプリとキーボードで並びが変わる。
   */
  const compareAsc = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

  /* 日時の新しい順。文字列はISO8601で桁揃えされているため辞書順の比較で足りる */
  const byCreatedDesc = (a: T, b: T): number => compareAsc(b.createdAt, a.createdAt);
  const byNameAsc = (a: T, b: T): number => compareAsc(a.name, b.name);

  const comparators: Record<SnippetSortBy, (a: T, b: T) => number> = {
    created: (a, b) => byCreatedDesc(a, b) || byNameAsc(a, b),
    updated: (a, b) => compareAsc(b.updatedAt, a.updatedAt) || byNameAsc(a, b),
    title: (a, b) => byNameAsc(a, b) || byCreatedDesc(a, b),
    usage: (a, b) => totalUseCount(b) - totalUseCount(a) || byCreatedDesc(a, b),
  };

  /* 呼び出し元の配列を書き換えないよう複製してから並べ替える */
  return [...shortcuts].sort(comparators[sortBy]);
}
