import { existsSync, readdirSync } from 'node:fs';
import { posix, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPOSITORY_ROOT } from '../helpers/sourceScan';
import { PUBLIC_DOCUMENTS } from './publicDocuments';

/**
 * 公開文書の台帳の閉鎖性ガード
 *
 * @remarks
 * 公開文書に対する検査はすべて台帳を回す。台帳へ登録し忘れた文書は
 * 検査から静かに漏れ、誰も見ないまま古い説明を配信し続けることになる。
 * ここでは実ファイルの集合と台帳の完全一致を確認し、公開文書を1枚増やしたら
 * 登録するまでテストが通らない状態を作る。
 *
 * 言語を1つ増やす（apps/web/fr/index.html）、スライドを1枚足す（07-*.html）、
 * といった変更でこのテストが落ちるのは意図した摩擦である。
 */

/**
 * 走査対象のディレクトリ
 *
 * @remarks
 * いずれも直下のみを見る。再帰しないのは store/screen/dist（Git管理外の生成物）や
 * apps/web/dist を拾わないためで、サブディレクトリは個別に列挙する。
 */
const SCAN_TARGETS: readonly { readonly directory: string; readonly extensions: readonly string[] }[] = [
  { directory: 'store', extensions: ['.txt'] },
  { directory: 'store/screen', extensions: ['.html'] },
  { directory: 'store/screen/host', extensions: ['.html'] },
  { directory: 'apps/web', extensions: ['.html'] },
  { directory: 'apps/web/en', extensions: ['.html'] },
  { directory: 'apps/web/public', extensions: ['.html'] },
  { directory: 'apps/mobile/assets/web', extensions: ['.html'] },
  { directory: 'packages/shared/src/i18n', extensions: ['.json'] },
];

/** 走査対象ディレクトリの直下から、対象拡張子のファイルを列挙する */
function listDocuments(directory: string, extensions: readonly string[]): string[] {
  return readdirSync(resolve(REPOSITORY_ROOT, directory), { withFileTypes: true })
    .filter((entry) => entry.isFile() && extensions.some((extension) => entry.name.endsWith(extension)))
    .map((entry) => posix.join(directory, entry.name));
}

describe('公開文書の台帳', () => {
  const found = SCAN_TARGETS.flatMap(({ directory, extensions }) => listDocuments(directory, extensions)).sort();
  const registered = PUBLIC_DOCUMENTS.map((document) => document.path).sort();

  it('台帳に未登録の公開文書がない', () => {
    const missing = found.filter((path) => !registered.includes(path));

    expect(missing).toEqual([]);
  });

  it('台帳に実在しない文書が残っていない', () => {
    const stale = registered.filter((path) => !existsSync(resolve(REPOSITORY_ROOT, path)));

    expect(stale).toEqual([]);
  });

  it('台帳と走査結果に取りこぼしがない', () => {
    /* 走査対象から外れた登録（サブディレクトリの追加など）を検出する */
    const unscanned = registered.filter((path) => !found.includes(path));

    expect(unscanned).toEqual([]);
  });

  it('台帳の走査が実際に働いている', () => {
    /* 対象を読めていること、および重複登録がないことを確認して空振りを防ぐ */
    expect(found.length).toBeGreaterThan(20);
    expect(registered.length).toBe(new Set(registered).size);
    expect(found).toContain('apps/web/public/terms.html');
    expect(found).toContain('store/screen/06-pricing.html');
    expect(found).not.toContain('store/screen/dist/00-hero--ios65-ja.html');
  });
});
