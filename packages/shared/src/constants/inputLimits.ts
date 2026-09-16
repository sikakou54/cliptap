/**
 * @module inputLimits
 * @description
 * ClipTap全体で使用する入力制限値の定数定義（Mobile/Web共通）
 *
 * 使用箇所:
 * - apps/mobile: フォームバリデーション、TextInput maxLength
 * - apps/web: input要素のmaxLength、バリデーション
 * - データベース保存前のバリデーション
 *
 * 設計思想: UX優先、UI制約、データベース効率のバランス
 */

/**
 * 入力制限定数
 */
export const INPUT_LIMITS = {
  PROFILE_NAME_MAX: 20,
  CATEGORY_NAME_MAX: 20,
  SNIPPET_TITLE_MAX: 30,
  VARIABLE_NAME_MAX: 30,
  VARIABLE_LABEL_MAX: 30,
  SHORTCUT_NAME_MAX: 20,
  PROFILE_DESCRIPTION_LINES: 3,
  VARIABLE_VALUE_LINES: 4,
  SHORTCUT_VALUE_LINES: 4,
} as const;

/**
 * 機能制限定数
 *
 * 無料プラン:
 * - カスタム変数: 5個まで
 * - プロファイル: 3個まで
 * - 広告表示: あり
 *
 * Proプラン（月額¥250 / 年間¥3,000）:
 * - カスタム変数: 無制限
 * - プロファイル: 無制限
 * - 広告表示: なし
 */
export const FEATURE_LIMITS = {
  FREE_TIER_VARIABLES: 5,
  FREE_TIER_PROFILES: 3,
} as const;
