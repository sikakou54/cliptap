/**
 * ショートカット関連の型定義
 *
 * @module types/shortcut
 */

import { z } from 'zod';

/* ==================== 行型 ==================== */

/**
 * ショートカットの行スキーマ（テーブル1行そのもの）
 *
 * @remarks
 * - name: ショートカット名。紐づくいずれかのプロファイル内で重複不可（0件のものは全プロファイルの中で数える）
 * - value: 挿入・コピーする文字列。変数トークン（{{name}}）は未展開のまま持つ
 * - useCount: モバイル・Webでのコピーと、拡張キーボードからの挿入の回数。使用頻度順の根拠
 * - categoryId: 定型文と共通のカテゴリID。nullは未分類
 * - sortOrder: 並び順（0始まり）。プロファイルを横断した通し番号
 *
 * 変数トークンの展開は、表示・コピー・キーボードからの挿入のそれぞれが、その時点のプロファイルと日時で行う
 * （表示は shortcuts/display、コピーは ShortcutService.prepareValueForClipboard、キーボードはネイティブ実装）。
 * 展開した結果をここに持たせないのは、プロファイルの切替や日付の変化で結果が変わるため。
 *
 * 全復元はバックアップの識別子と日時を逐語で書き戻すため、紐づけを持たないこの行型を扱う。
 * 紐づくプロファイルは`shortcut_profiles`の行として別に復元する（`ShortcutProfile`）。
 */
export const ShortcutRowSchema = z.object({
  id: z.string(),
  categoryId: z.string().nullable(),
  name: z.string(),
  value: z.string(),
  useCount: z.number(),
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
 * ショートカットスキーマ（行＋紐づくプロファイル）
 *
 * @remarks
 * - profileIds: 紐づくプロファイルIDの一覧。0件以上で、0件は全プロファイル向け（定型文の`snippet_profiles`と同じ）
 *
 * `profileIds`を必須にしているのは、編集画面が一覧の要素を初期値にするため。
 * 任意にすると詰め忘れが型を通り、保存時に`[]`（全プロファイル向け）へ静かに化けてしまう。
 *
 * 行型（`ShortcutRow`）と分けているのは、全復元が紐づけを持たない行をそのまま扱うため。
 * 列を足したときに片方だけ直す事故を避けるため、行型を広げる形で定義する。
 */
export const ShortcutSchema = ShortcutRowSchema.extend({
  profileIds: z.array(z.string()),
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
 * - value: 必須。前後空白を除いて保存するため、空白だけの値は空文字になる。空文字も保存できる
 * - useCountとsortOrderは保存時に決まるため入力には含めない
 */
export const CreateShortcutInputSchema = z.object({
  profileIds: z.array(z.string()).optional(),
  categoryId: z.string().nullable().optional(),
  name: z.string(),
  value: z.string(),
});

/**
 * ショートカット作成入力
 */
export type CreateShortcutInput = z.infer<typeof CreateShortcutInputSchema>;

/**
 * ショートカット更新入力スキーマ
 *
 * @remarks
 * - valueを省略した場合は現在の値を変えない。値を書き換えても使用回数は持ち越す
 * - profileIdsを指定すると紐づけをその一覧へ置き換える（`[]`で全プロファイル向け）。省略した場合は紐づけを変えない
 * - categoryIdにnullを渡すと未分類へ戻す。省略した場合は現在のカテゴリを変えない
 */
export const UpdateShortcutInputSchema = z.object({
  id: z.string(),
  profileIds: z.array(z.string()).optional(),
  categoryId: z.string().nullable().optional(),
  name: z.string().optional(),
  value: z.string().optional(),
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
