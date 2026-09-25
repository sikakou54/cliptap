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
 * - value: 挿入・コピーする文字列。変数トークン（{{name}}）は未展開のまま持つ
 * - isMasked: 表示を伏せるか。trueでも挿入・コピーは`value`をそのまま使う
 * - useCount: モバイル・Webでのコピーと、拡張キーボードからの挿入の回数。使用頻度順の根拠
 * - sortOrder: 同一ショートカット内での並び順（0始まり）
 *
 * 値に名前は持たせない。ショートカット名が何の値かを表し、値はその中で登録順に並ぶだけとする。
 *
 * 変数トークンの展開は、表示・コピー・キーボードからの挿入のそれぞれが、その時点のプロファイルと日時で行う
 * （表示は shortcuts/display、コピーは ShortcutService.prepareValueForClipboard、キーボードはネイティブ実装）。
 * 展開した結果をここに持たせないのは、プロファイルの切替や日付の変化で結果が変わるため。
 */
export const ShortcutValueSchema = z.object({
  id: z.string(),
  shortcutId: z.string(),
  value: z.string(),
  isMasked: z.boolean(),
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
  value: z.string(),
  isMasked: z.boolean(),
});

/**
 * ショートカット値の入力型
 */
export type ShortcutValueInput = z.infer<typeof ShortcutValueInputSchema>;

/* ==================== 行型 ==================== */

/**
 * ショートカットの行スキーマ（テーブル1行そのもの）
 *
 * @remarks
 * - name: ショートカット名。紐づくいずれかのプロファイル内で重複不可（0件のものは全プロファイルの中で数える）
 * - categoryId: 定型文と共通のカテゴリID。nullは未分類
 * - sortOrder: 並び順（0始まり）。プロファイルを横断した通し番号
 *
 * 挿入する値は`shortcut_values`が持つため、この行型には含まれない。
 *
 * 全復元はバックアップの識別子と日時を逐語で書き戻すため、紐づけも値も持たないこの行型を扱う。
 * 紐づくプロファイルは`shortcut_profiles`の行（`ShortcutProfile`）、値は`shortcut_values`の行
 * （`ShortcutValue`）として別に復元する。
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

/* ==================== Shortcut ==================== */

/**
 * ショートカットスキーマ（行＋紐づくプロファイル＋値）
 *
 * @remarks
 * - profileIds: 紐づくプロファイルIDの一覧。0件以上で、0件は全プロファイル向け（定型文の`snippet_profiles`と同じ）
 * - values: 1件以上のショートカット値（sortOrder順）
 *
 * `profileIds`を必須にしているのは、編集画面が一覧の要素を初期値にするため。
 * 任意にすると詰め忘れが型を通り、保存時に`[]`（全プロファイル向け）へ静かに化けてしまう。
 *
 * 行型（`ShortcutRow`）と分けているのは、全復元が紐づけを持たない行をそのまま扱うため。
 * 列を足したときに片方だけ直す事故を避けるため、行型を広げる形で定義する。
 */
export const ShortcutSchema = ShortcutRowSchema.extend({
  profileIds: z.array(z.string()),
  values: z.array(ShortcutValueSchema),
});

/**
 * ショートカット型
 */
export type Shortcut = z.infer<typeof ShortcutSchema>;

/* ==================== 入力 ==================== */

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
 * - valuesを省略した場合は既存の値をそのまま残す。値を書き換えても使用回数は持ち越す
 * - profileIdsを指定すると紐づけをその一覧へ置き換える（`[]`で全プロファイル向け）。省略した場合は紐づけを変えない
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
