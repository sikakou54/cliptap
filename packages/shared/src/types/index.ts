/**
 * 共有型定義
 *
 * @remarks
 * - Mobile/Webで共有する型定義の中央エクスポート
 * - 型はカテゴリ別のファイルに分離
 *
 * @module types
 */

/*
 * Zodスキーマの公開方針:
 * 他のスキーマの部品としてのみ使われるものは定義ファイル内に閉じ、ここへは出さない。
 * z.infer で型を導出するだけのスキーマは ESLint の no-unused-vars が
 * 「値なのに型としてしか使われていない」と判定するため export のまま残している。
 * 実行時に safeParse しているのは ClipTapExportDataSchema の1つだけ
 * （services/ImportParserService.ts）。
 */

/* ==================== Snippet ==================== */
export {
  SnippetSortBySchema,
  SnippetSchema,
  CreateSnippetInputSchema,
  UpdateSnippetInputSchema,
  SnippetProfileSchema,
  type SnippetSortBy,
  type Snippet,
  type CreateSnippetInput,
  type UpdateSnippetInput,
  type SnippetProfile,
} from './snippet';

/* ==================== Category ==================== */
export {
  CategorySchema,
  CreateCategoryInputSchema,
  UpdateCategoryInputSchema,
  type Category,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from './category';

/* ==================== Profile ==================== */
export {
  ProfileSchema,
  CreateProfileInputSchema,
  UpdateProfileInputSchema,
  ProfileVariableSchema,
  CreateProfileVariableInputSchema,
  type Profile,
  type CreateProfileInput,
  type UpdateProfileInput,
  type ProfileVariable,
  type CreateProfileVariableInput,
} from './profile';

/* ==================== Variable ==================== */
export {
  VariableSchema,
  CreateVariableInputSchema,
  UpdateVariableInputSchema,
  type Variable,
  type CreateVariableInput,
  type UpdateVariableInput,
} from './variableSchema';

export {
  type UISystemVariableDefinition,
  type VariableOption,
  type VariableReplacement,
  UI_SYSTEM_VARIABLES,
} from './variable';

/* ==================== Shortcut ==================== */
export {
  ShortcutSchema,
  ShortcutValueSchema,
  ShortcutValueInputSchema,
  ShortcutValueRowSchema,
  ShortcutRowSchema,
  ShortcutProfileSchema,
  CreateShortcutInputSchema,
  UpdateShortcutInputSchema,
  type Shortcut,
  type ShortcutValue,
  type ShortcutValueInput,
  type ShortcutValueRow,
  type ShortcutRow,
  type ShortcutProfile,
  type CreateShortcutInput,
  type UpdateShortcutInput,
} from './shortcut';

/* ==================== Export/Import ==================== */
export {
  ClipTapExportDataSchema,
  type ClipTapExportData,
} from './export';

/* ==================== Subscription ==================== */
export type {
  SubscriptionInterval,
  SubscriptionPlan,
  SubscriptionStatus,
  PurchaseResult,
} from './Subscription';

/* ==================== Auth ==================== */
export type {
  SharedUser,
} from './Auth';

/* ==================== Alert ==================== */
export type {
  AlertType,
  BaseAlertOptions,
  ConfirmOptions,
} from './alert';
