/**
 * プロファイル選択の文言
 *
 * @module utils/profileSelectLabels
 *
 * @remarks
 * プロファイル選択画面は定型文とショートカットの両方から開く共有の画面で、
 * 選び方（複数選択・0件は全プロファイル向け）は同じだが、何を選んでいるかの説明と
 * 未選択時の表示だけが対象によって変わる。対象は遷移パラメータ `target` で受け取る。
 *
 * 翻訳キーは文字列リテラルで書く。対象名からキーを組み立てると、
 * キーの追加漏れを未定義キー検出テストも全文検索も捕まえられず、
 * 画面にキー名がそのまま出るまで気付けない。対象は2種の閉じたunionなので、ここで1対1に対応づける。
 */

import type { TranslationFunction } from '../hooks/useTranslation';

/**
 * プロファイル選択の対象
 *
 * @remarks
 * - snippet: 定型文を表示するプロファイル
 * - shortcut: ショートカットを表示するプロファイル
 */
export type ProfileSelectTarget = 'snippet' | 'shortcut';

/**
 * 遷移パラメータからプロファイル選択の対象を読み取る
 *
 * @param value - 遷移パラメータ `target` の値（未指定・配列・想定外の文字列もありうる）
 * @returns `'shortcut'` のときだけ `'shortcut'`、それ以外は `'snippet'`
 *
 * @remarks
 * 既定を定型文にするのは、この画面がもともと定型文の選択画面で、
 * 対象を渡さない呼び出しでも従来と同じ説明文を出すため。
 */
export function parseProfileSelectTarget(value: unknown): ProfileSelectTarget {
  return value === 'shortcut' ? 'shortcut' : 'snippet';
}

/**
 * プロファイル選択画面の説明文を取得する
 *
 * @param target - プロファイル選択の対象
 * @param t - 翻訳関数
 * @returns 選択画面の上部に表示する説明文
 */
export function getProfileSelectDescription(
  target: ProfileSelectTarget,
  t: TranslationFunction
): string {
  switch (target) {
    case 'snippet':
      return t('snippet.select_profiles_description');
    case 'shortcut':
      return t('shortcut.select_profiles_description');
  }
}

/**
 * フォームのプロファイル欄が未選択（0件＝全プロファイル向け）のときの表示を取得する
 *
 * @param target - プロファイル選択の対象
 * @param t - 翻訳関数
 * @returns 選択を促しつつ全プロファイル向けであることを示す文言
 */
export function getProfileSelectPlaceholder(
  target: ProfileSelectTarget,
  t: TranslationFunction
): string {
  switch (target) {
    case 'snippet':
      return t('snippet.select_profile');
    case 'shortcut':
      return t('shortcut.select_profile');
  }
}
