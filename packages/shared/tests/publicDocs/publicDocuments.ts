import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { REPOSITORY_ROOT } from '../helpers/sourceScan';

/**
 * 公開文書の台帳と、文書を行単位で比較するための正規化
 *
 * @remarks
 * 公開文書は利用者が読む唯一の説明であり、実装から乖離しても型チェックもLintも通る。
 * 同じ事実が複数の文書へ刷られているため、1箇所だけ直すと残りが古いまま残る。
 * ここでは「どれが公開文書か」を1箇所に集め、文書間の同一性を機械的に比較できる形へ
 * 揃えることだけを担う。文面の正しさを判定する処理はこのファイルに置かない。
 */

/** 公開文書の形式 */
export type PublicDocumentKind = 'legal' | 'store' | 'slide' | 'lp' | 'i18n';

/** 公開文書1件 */
export interface PublicDocument {
  /** リポジトリルートからの相対パス */
  readonly path: string;
  /** 記載言語（`both` は同一ファイル内に日英を持つもの） */
  readonly lang: 'ja' | 'en' | 'both';
  /** 形式 */
  readonly kind: PublicDocumentKind;
}

/**
 * 公開文書の台帳
 *
 * @remarks
 * `documentInventory.test.ts` が実ファイルの集合とこの台帳の完全一致を検査するため、
 * 公開文書を1枚増やすとテストが落ちて登録を促す。登録から漏れた文書が
 * 静かに検査対象外へ落ちることを防ぐのがこの台帳の役目である。
 */
export const PUBLIC_DOCUMENTS: readonly PublicDocument[] = [
  /* 法的文書（日本語のみ。英語版は存在しない） */
  { path: 'apps/web/public/terms.html', lang: 'ja', kind: 'legal' },
  { path: 'apps/web/public/privacy.html', lang: 'ja', kind: 'legal' },
  /* 上2件をモバイルへ同梱したコピー（apps/mobile の sync-legal が複製する） */
  { path: 'apps/mobile/assets/web/terms.html', lang: 'ja', kind: 'legal' },
  { path: 'apps/mobile/assets/web/privacy.html', lang: 'ja', kind: 'legal' },
  { path: 'store/EULA_License_Agreement.txt', lang: 'ja', kind: 'legal' },
  /* ストア掲載文の原稿 */
  { path: 'store/store_ja.txt', lang: 'ja', kind: 'store' },
  { path: 'store/store_en.txt', lang: 'en', kind: 'store' },
  /* ストア提出画像の文言（1ファイルに日英を持ち、PNGへ焼かれる） */
  { path: 'store/screen/_wrapper.html', lang: 'both', kind: 'slide' },
  { path: 'store/screen/00-hero.html', lang: 'both', kind: 'slide' },
  { path: 'store/screen/01-keyboard.html', lang: 'both', kind: 'slide' },
  { path: 'store/screen/02-scenes.html', lang: 'both', kind: 'slide' },
  { path: 'store/screen/03-variables.html', lang: 'both', kind: 'slide' },
  { path: 'store/screen/04-profiles.html', lang: 'both', kind: 'slide' },
  { path: 'store/screen/05-shortcuts.html', lang: 'both', kind: 'slide' },
  { path: 'store/screen/06-pricing.html', lang: 'both', kind: 'slide' },
  /*
   * スクリーンショットの背面に写すホストアプリのモックアップ。
   * ClipTapの機能主張は持たないが、画像に写る文言であるため台帳へ登録する。
   */
  { path: 'store/screen/host/index.html', lang: 'both', kind: 'slide' },
  { path: 'store/screen/host/compose-chat.html', lang: 'both', kind: 'slide' },
  { path: 'store/screen/host/compose-form.html', lang: 'both', kind: 'slide' },
  { path: 'store/screen/host/compose-mail.html', lang: 'both', kind: 'slide' },
  { path: 'store/screen/host/compose-message.html', lang: 'both', kind: 'slide' },
  { path: 'store/screen/host/compose-post.html', lang: 'both', kind: 'slide' },
  /* 公式サイト */
  { path: 'apps/web/index.html', lang: 'ja', kind: 'lp' },
  { path: 'apps/web/en/index.html', lang: 'en', kind: 'lp' },
  { path: 'apps/web/app.html', lang: 'ja', kind: 'lp' },
  /* アプリ内文言 */
  { path: 'packages/shared/src/i18n/ja.json', lang: 'ja', kind: 'i18n' },
  { path: 'packages/shared/src/i18n/en.json', lang: 'en', kind: 'i18n' },
];

/**
 * 行内の装飾だけを落として比較できる形へ揃える
 *
 * @remarks
 * 同じ文が文書によって字下げ・箇条書き記号・条番号の付き方だけ違うため、
 * 空白と行頭の記号を落として比較する。句読点と強調範囲の差は落とさない。
 *
 * @param text - 1行のテキスト
 * @returns 比較用に正規化した文字列
 */
export function normalizeLine(text: string): string {
  return text
    .replace(/\s+/gu, '')
    .replace(/^(?:・|※|\d+\.)/u, '');
}

/** 比較の対象にしない短すぎる行を弾く閾値 */
const MINIMUM_LINE_LENGTH = 4;

/** HTMLの実体参照を文字へ戻す（数値参照を含む） */
function decodeEntities(html: string): string {
  return html
    .replace(/&#(\d+);/gu, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/giu, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gu, ' ')
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>')
    .replace(/&quot;/gu, '"')
    .replace(/&apos;/gu, "'")
    .replace(/&amp;/gu, '&');
}

/**
 * 行を割らずにタグだけ落とすインライン要素
 *
 * @remarks
 * これらを改行にすると `<strong>UID</strong>、メールアドレス` のような
 * 強調をまたいだ1文が複数行に割れて、文書間の同一性が比較できなくなる。
 */
const INLINE_TAGS = /<\/?(?:strong|em|b|i|u|a|span|br|code|small|sup|sub)\b[^>]*>/giu;

/**
 * HTMLから利用者が読む本文行を取り出す
 *
 * @remarks
 * `head` / `style` / `script` は画面に出ないため除く。`script` を除くことで
 * JSON-LD もここには含まれない（構造化データは専用のテストで本文と突き合わせる）。
 *
 * @param path - リポジトリルートからの相対パス
 * @returns 正規化済みの本文行（重複を含む。行番号は保持しない）
 */
export function htmlTextLines(path: string): string[] {
  const raw = readFileSync(resolve(REPOSITORY_ROOT, path), 'utf8');

  return decodeEntities(
    raw
      .replace(/<head\b[\s\S]*?<\/head>/giu, '')
      .replace(/<style\b[\s\S]*?<\/style>/giu, '')
      .replace(/<script\b[\s\S]*?<\/script>/giu, '')
      .replace(/<!--[\s\S]*?-->/gu, '')
      .replace(INLINE_TAGS, '')
      .replace(/<[^>]+>/gu, '\n'),
  )
    .split('\n')
    .map(normalizeLine)
    .filter((line) => line.length >= MINIMUM_LINE_LENGTH);
}

/**
 * プレーンテキストから本文行を取り出す
 *
 * @param path - リポジトリルートからの相対パス
 * @returns 正規化済みの本文行と、元の1始まりの行番号
 */
export function plainTextLines(path: string): { readonly line: number; readonly text: string; readonly normalized: string }[] {
  return readFileSync(resolve(REPOSITORY_ROOT, path), 'utf8')
    .split('\n')
    .map((text, index) => ({ line: index + 1, text, normalized: normalizeLine(text) }))
    .filter((entry) => entry.normalized.length >= MINIMUM_LINE_LENGTH);
}
