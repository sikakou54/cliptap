/**
 * ショートカット関連の型定義
 *
 * @module types/shortcut
 */

import { z } from 'zod';

/* ==================== ShortcutValue ==================== */

/**
 * ショートカット値スキーマ
 *
 * @remarks
 * - name: 値を識別する名称（例: 母, 父）。挿入対象ではない
 * - value: 保存されている文字列。変数トークン（{{name}}）は未展開のまま持つ
 * - useCount: 拡張キーボードから挿入した回数。使用頻度順の根拠
 * - sortOrder: 同一ショートカット内での並び順（0始まり）
 *
 * 変数トークンの展開は、表示・コピー・キーボードからの挿入のそれぞれが、その時点のプロファイルと日時で行う
 * （表示は shortcuts/display、コピーは ShortcutService.prepareValueForClipboard、キーボードはネイティブ実装）。
 * 展開した結果をここに持たせないのは、プロファイルの切替や日付の変化で結果が変わるため。
 */
export const ShortcutValueSchema = z.object({
  id: z.string(),
  shortcutId: z.string(),
  name: z.string(),
  value: z.string(),
  useCount: z.number(),
  sortOrder: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/**
 * ショートカット値型
 */
export type ShortcutValue = z.infer<typeof ShortcutValueSchema>;

/**
 * ショートカット値の入力スキーマ（作成・更新共通）
 *
 * @remarks
 * - idを持つ場合は既存値の更新、持たない場合は新規追加として扱う
 * - useCountとsortOrderは保存時に決まるため入力には含めない
 * - valueは変数トークンを含んだまま保存する
 */
export const ShortcutValueInputSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  value: z.string(),
});

/**
 * ショートカット値の入力型
 */
export type ShortcutValueInput = z.infer<typeof ShortcutValueInputSchema>;

/* ==================== Shortcut ==================== */

/**
 * ショートカットスキーマ
 *
 * @remarks
 * - profileIds: 紐づくプロファイルIDの一覧。0件以上で、0件は全プロファイル向け（定型文の`snippet_profiles`と同じ）
 * - categoryId: 定型文と共通のカテゴリID。nullは未分類
 * - name: ショートカット名。紐づくいずれかのプロファイル内で重複不可（0件のものは全プロファイルの中で数える）。複数の値をまとめるグループ名
 * - values: 1件以上のショートカット値（sortOrder順）
 * - sortOrder: 並び順（0始まり）。プロファイルを横断した通し番号
 *
 * `profileIds`を必須にしているのは、編集画面が一覧の要素を初期値にするため。
 * 任意にすると詰め忘れが型を通り、保存時に`[]`（全プロファイル向け）へ静かに化けてしまう。
 */
export const ShortcutSchema = z.object({
  id: z.string(),
  profileIds: z.array(z.string()),
  categoryId: z.string().nullable(),
  name: z.string(),
  values: z.array(ShortcutValueSchema),
  sortOrder: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/**
 * ショートカット型
 */
export type Shortcut = z.infer<typeof ShortcutSchema>;

/**
 * ショートカット作成入力スキーマ
 *
 * @remarks
 * - profileIds: 省略可（省略時は`[]`＝全プロファイル向け）。重複と空文字は保存前に除かれる
 * - categoryId: 省略可（省略時は未分類）
 * - name: 必須（紐づけるいずれかのプロファイルに同名があると拒否される。0件で保存するときは全ショートカットと比べる）
 * - values: 1件以上必須。0件では保存できない
 * - sortOrderは自動設定される
 */
export const CreateShortcutInputSchema = z.object({
  profileIds: z.array(z.string()).optional(),
  categoryId: z.string().nullable().optional(),
  name: z.string(),
  values: z.array(ShortcutValueInputSchema),
});

/**
 * ショートカット作成入力
 */
export type CreateShortcutInput = z.infer<typeof CreateShortcutInputSchema>;

/**
 * ショートカット更新入力スキーマ
 *
 * @remarks
 * - valuesは差し替え方式。入力に含まれない既存値は削除される
 * - valuesを省略した場合は既存の値をそのまま残す
 * - profileIdsを指定すると紐づけをその一覧へ置き換える（`[]`で全プロファイル向け）。省略した場合は紐づけを変えない。
 *   値と使用回数はそのまま持ち越す
 * - categoryIdにnullを渡すと未分類へ戻す。省略した場合は現在のカテゴリを変えない
 */
export const UpdateShortcutInputSchema = z.object({
  id: z.string(),
  profileIds: z.array(z.string()).optional(),
  categoryId: z.string().nullable().optional(),
  name: z.string().optional(),
  values: z.array(ShortcutValueInputSchema).optional(),
});

/**
 * ショートカット更新入力
 */
export type UpdateShortcutInput = z.infer<typeof UpdateShortcutInputSchema>;

/* ==================== 復元用の行型 ==================== */

/**
 * ショートカットの行スキーマ（値を含まないテーブル1行）
 *
 * @remarks
 * 全復元はバックアップの識別子と日時を逐語で書き戻すため、
 * 値をぶら下げた`Shortcut`ではなくテーブルの行そのものを扱う。
 * 紐づくプロファイルは`shortcut_profiles`の行として別に復元する（`ShortcutProfile`）。
 */
export const ShortcutRowSchema = z.object({
  id: z.string(),
  categoryId: z.string().nullable(),
  name: z.string(),
  sortOrder: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/**
 * ショートカットの行型
 */
export type ShortcutRow = z.infer<typeof ShortcutRowSchema>;

/* ==================== ShortcutProfile ==================== */

/**
 * ショートカット-プロファイル関連スキーマ
 *
 * @remarks
 * - ショートカットと、それを使うプロファイルの紐づけを管理する中間テーブル
 * - 形も意味も定型文の`SnippetProfile`と同じ。1件のショートカットにつき0件以上。0件は全プロファイル向け
 */
export const ShortcutProfileSchema = z.object({
  shortcutId: z.string(),
  profileId: z.string(),
});

/**
 * ショートカット-プロファイル関連型
 */
export type ShortcutProfile = z.infer<typeof ShortcutProfileSchema>;
