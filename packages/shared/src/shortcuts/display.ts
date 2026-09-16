/**
 * ショートカットの値の表示用の展開
 *
 * @module shortcuts/display
 *
 * @remarks
 * ショートカットの値は変数トークン（{{name}}）を未展開のまま保存する。
 * 一覧に出す文字列は、表示中のプロファイルで展開したものを別の項目（displayValue）として持たせる。
 * 保存値（value）を展開結果で置き換えないのは、編集画面の初期値とコピー時の展開に保存値が必要なため。
 *
 * 展開の規則そのものは呼び出し側から受け取る。定型文の一覧と同じ useVariableExpansion を渡し、
 * 定型文とショートカットで同じトークンが違う表示にならないようにする。
 */

import type { Shortcut } from '../schema';

/**
 * 表示用の文字列を持つショートカット
 */
export interface ShortcutWithDisplay extends Shortcut {
  /** 表示中のプロファイルで変数トークンを展開した文字列 */
  displayValue: string;
}

/**
 * ショートカットの値に、表示用に展開した文字列を持たせる
 *
 * @param shortcuts - ショートカット一覧（表示順）
 * @param expand - 保存値を表示中のプロファイルで展開する関数
 * @returns displayValue を持たせた一覧（元の並び順を保つ）
 */
export function attachDisplayValues(
  shortcuts: readonly Shortcut[],
  expand: (text: string) => string
): ShortcutWithDisplay[] {
  return shortcuts.map((shortcut) => ({
    ...shortcut,
    displayValue: expand(shortcut.value),
  }));
}
