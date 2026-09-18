import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPOSITORY_ROOT } from '../helpers/sourceScan';
import { htmlTextLines, normalizeLine, plainTextLines } from './publicDocuments';

/**
 * 公開文書どうしの複製関係のガード
 *
 * @remarks
 * 同じ事実が複数の公開文書へ刷られており、1箇所だけ直すと残りが古いまま残る。
 * 監査では「無効化されたデータの復帰条件」の記述が最大11箇所に複製され、
 * そのうち利用規約・プライバシーポリシー・同梱コピー・EULA・LPの構造化データが
 * すべて同じ誤りを抱えていた。
 *
 * ここでは文面の正しさを判定せず、すでに機械的な同一関係になっている3経路だけを
 * 恒等検査で固定する。語句を知らなくても効くため、将来どんな文面になっても働く。
 */

/** モバイルへ同梱される法的文書（apps/mobile の sync-legal が複製する） */
const BUNDLED_LEGAL_COPIES: readonly { readonly source: string; readonly bundled: string }[] = [
  { source: 'apps/web/public/terms.html', bundled: 'apps/mobile/assets/web/terms.html' },
  { source: 'apps/web/public/privacy.html', bundled: 'apps/mobile/assets/web/privacy.html' },
];

/** EULAの射影元（EULAの本文はこの2文書の本文と同一の文で構成される） */
const EULA_PATH = 'store/EULA_License_Agreement.txt';
const EULA_PROJECTION_SOURCES = ['apps/web/public/terms.html', 'apps/web/public/privacy.html'];

/**
 * EULAにだけ存在してよい行
 *
 * @remarks
 * EULAは利用規約とプライバシーポリシーを1つのテキストへまとめた文書のため、
 * 本文の97%以上が両HTMLと同一の文になっている。ここに列挙するのは
 * 「HTML側に対応する文を持たないことに理由がある行」だけである。
 *
 * このリストが黙って育つと射影検査は無言で無力化するため、
 * 件数の上限を同じテストで固定している（増やす行為自体をテスト失敗にする）。
 */
const EULA_ONLY_LINES: readonly string[] = [
  /* 文書の表題。HTMLは `<title>` と `<h1>` に持つため本文行にならない */
  'ClipTap 使用許諾契約書（EULA）',
  /* EULA固有の前文（契約への同意の成立を述べる。HTML側に対応する条項がない） */
  '本使用許諾契約書（以下「本契約」）は、アプリケーション「ClipTap」（以下「本アプリ」）の利用に関する条件を定めるものです。本アプリをダウンロード、インストール、または使用することにより、お客様は本契約の条件に同意したものとみなされます。',
  /* アカウント連携が任意である旨。利用規約は同じ内容を別の言い回しで書いている */
  'この機能の利用は完全に任意です。モバイルアプリ版では、利用しない場合でも、本サービスのすべての機能（定型文管理、サブスクリプション購入等）を制限なくご利用いただけます。',
  /*
   * 認証方法の対応環境2行。利用規約は同じ内容を3列の表（サービス名 / 対応環境 / 備考）で
   * 持っており、EULAはそれを1行へ連結している。内容は一致しているが行の割り方が違うため
   * 射影では一致しない。表を1行へ連結する処理を入れると正規化が複雑になるので許容する。
   */
  '・Apple Sign-In（iOSアプリ・Web版）：Androidアプリでは利用できません（Web版はブラウザから利用できます）',
  '・Google Sign-In（iOS・Androidアプリ・Web版）：複数端末をお持ちの方に推奨',
];

/** 許可リストの上限（超える変更は、逃げ道を増やしていないか考える機会にする） */
const EULA_ONLY_LINES_LIMIT = 8;

/** FAQの構造化データを持つ公式サイト */
const FAQ_PAGES = ['apps/web/index.html', 'apps/web/en/index.html'];

/** 設問と回答の組 */
interface FaqEntry {
  readonly question: string;
  readonly answer: string;
}

/** HTMLのタグを落として本文だけにする */
function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/gu, '')
    .replace(/&#(\d+);/gu, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&nbsp;/gu, ' ')
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>')
    .replace(/&quot;/gu, '"')
    .replace(/&apos;/gu, "'")
    .replace(/&amp;/gu, '&')
    .trim();
}

/** JSON-LDのFAQPageから設問と回答を取り出す */
function readFaqStructuredData(path: string): FaqEntry[] {
  const raw = readFileSync(resolve(REPOSITORY_ROOT, path), 'utf8');
  const entries: FaqEntry[] = [];

  for (const match of raw.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gu)) {
    const parsed: unknown = JSON.parse(match[1]);
    if (typeof parsed !== 'object' || parsed === null) continue;

    const document = parsed as { '@type'?: string; mainEntity?: { name?: string; acceptedAnswer?: { text?: string } }[] };
    if (document['@type'] !== 'FAQPage' || !Array.isArray(document.mainEntity)) continue;

    for (const question of document.mainEntity) {
      entries.push({ question: question.name ?? '', answer: question.acceptedAnswer?.text ?? '' });
    }
  }

  return entries;
}

/** 本文の `details` 要素から設問と回答を取り出す */
function readFaqBody(path: string): FaqEntry[] {
  const raw = readFileSync(resolve(REPOSITORY_ROOT, path), 'utf8');

  return [...raw.matchAll(/<details><summary>([\s\S]*?)<\/summary><p>([\s\S]*?)<\/p><\/details>/gu)]
    .map((match) => ({ question: stripTags(match[1]), answer: stripTags(match[2]) }));
}

describe('公開文書の複製関係', () => {
  it('モバイルへ同梱した法的文書は配信元とバイト単位で一致する', () => {
    /*
     * 複製は apps/mobile の sync-legal が行うが、手で実行し忘れても
     * 型チェック・Lint・ビルドのいずれも通り、古い規約を同梱したアプリが出てしまう。
     */
    const stale = BUNDLED_LEGAL_COPIES.filter(({ source, bundled }) => {
      const left = readFileSync(resolve(REPOSITORY_ROOT, source));
      const right = readFileSync(resolve(REPOSITORY_ROOT, bundled));
      return !left.equals(right);
    }).map(({ source, bundled }) => `${bundled} が ${source} と一致しない（npm run sync-legal --workspace=@cliptap/mobile を実行してコミットする）`);

    expect(stale).toEqual([]);
  });

  it('EULAの本文は利用規約とプライバシーポリシーの本文に含まれる', () => {
    const pool = new Set(EULA_PROJECTION_SOURCES.flatMap(htmlTextLines));
    const allowed = new Set(EULA_ONLY_LINES.map(normalizeLine));

    const orphans = plainTextLines(EULA_PATH)
      .filter((entry) => !pool.has(entry.normalized) && !allowed.has(entry.normalized))
      .map((entry) => `${EULA_PATH}:${entry.line} ${entry.text.trim()}`);

    expect(orphans).toEqual([]);
  });

  it('EULAだけに存在してよい行の許可リストが増えていない', () => {
    /* 許可リストで逃げられる限り射影検査は無力化するため、件数自体を固定する */
    expect(EULA_ONLY_LINES.length).toBeLessThanOrEqual(EULA_ONLY_LINES_LIMIT);
  });

  it('FAQの構造化データは本文と一致する', () => {
    /*
     * FAQPageのJSON-LDは検索結果のリッチリザルトとして配信されるため、
     * 本文だけを直すと検索結果に古い説明が残り続ける。
     */
    const mismatches = FAQ_PAGES.flatMap((path) => {
      const structured = readFaqStructuredData(path);
      const body = readFaqBody(path);

      if (structured.length !== body.length) {
        return [`${path} の設問数が一致しない（構造化データ ${structured.length} 件 / 本文 ${body.length} 件）`];
      }

      return structured
        .map((entry, index) => ({ entry, body: body[index], index }))
        .filter(({ entry, body: bodyEntry }) => entry.question !== bodyEntry.question || entry.answer !== bodyEntry.answer)
        .map(({ entry, index }) => `${path} のFAQ ${index + 1}件目「${entry.question}」が本文と一致しない`);
    });

    expect(mismatches).toEqual([]);
  });

  it('射影の検査が実際に働いている', () => {
    /* 対象を読めていること、および一致しない文が本当に検出されることを確認して空振りを防ぐ */
    const pool = new Set(EULA_PROJECTION_SOURCES.flatMap(htmlTextLines));

    expect(pool.size).toBeGreaterThan(100);
    expect(plainTextLines(EULA_PATH).length).toBeGreaterThan(100);
    expect(pool.has(normalizeLine('本サービスは、以下のProプランを提供します：'))).toBe(true);
    expect(pool.has(normalizeLine('この文はどの公開文書にも存在しない'))).toBe(false);
    expect(FAQ_PAGES.every((path) => readFaqStructuredData(path).length > 0)).toBe(true);
  });
});
