/**
 * バックアップファイル（.cliptap）の型定義
 *
 * @module types/export
 */

import { z } from 'zod';

/* ==================== Export Data ==================== */

/**
 * ClipTapエクスポートデータスキーマ
 *
 * @remarks
 * - .cliptapファイルの内部構造
 * - セキュリティのためフィールド名を短縮
 * - s: スキーマバージョン（互換性チェック）
 * - t: タイムスタンプ（ISO 8601）
 * - h: パスワードハッシュ（SHA-256）
 * - d: 二重Base64で符号化されたSQLiteデータ（暗号化ではない）
 * - c: チェックサム（SHA-256、改竄検知）
 */
export const ClipTapExportDataSchema = z.object({
  s: z.number().int(),
  t: z.string(),
  h: z.string(),
  d: z.string(),
  c: z.string(),
});

/**
 * ClipTapエクスポートデータ型
 */
export type ClipTapExportData = z.infer<typeof ClipTapExportDataSchema>;
