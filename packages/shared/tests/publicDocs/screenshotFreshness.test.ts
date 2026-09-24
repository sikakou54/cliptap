import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
/* store/screen 側のスクリプトと同じ計算を使う（ハッシュの求め方を二重に持たないため） */
import { computeSourceHashes, listSources, readManifest } from '../../../../store/screen/builtFrom.mjs';

/**
 * ストア提出画像の焼き漏れガード
 *
 * @remarks
 * store/out/**.png はストア提出物であり、文言はPNGへ焼き込まれる。
 * 生成元のHTMLやCSSを直してもPNGを焼き直さなければ古い文言のまま残るが、
 * PNGの中身は型チェックもテストも読めず、mtime は git checkout で保たれない。
 * 公開文書のなかで、これが唯一「静かに壊れる」経路である。
 *
 * store/out/BUILT_FROM.json は `scripts/store-screens.sh` の最終段でのみ書かれ、
 * PNGを焼いたあとの生成元のsha256を持つ。ここでは現在の生成元と記録を突き合わせ、
 * 食い違っていれば焼き直しを促す。
 */

describe('ストア提出画像の鮮度', () => {
  const manifest = readManifest();

  it('生成元の記録が存在する', () => {
    expect(manifest).not.toBeNull();
  });

  it('生成元と焼かれた画像の記録が一致する', () => {
    const current = computeSourceHashes();
    const recorded: Record<string, string> = manifest ?? {};

    const drifted = [
      ...Object.keys(current)
        .filter((path) => current[path] !== recorded[path])
        .map((path) => `${path} が変更されている（記録: ${recorded[path] ? '古い' : 'なし'}）`),
      ...Object.keys(recorded)
        .filter((path) => !(path in current))
        .map((path) => `${path} が記録に残っているが生成元に存在しない`),
    ];

    expect(drifted, 'npm run store:screens を実行して store/out を作り直し、コミットする').toEqual([]);
  });

  it('生成元の列挙が実際に働いている', () => {
    /* 列挙が空や過少になると検査が黙って無効化されるため固定する */
    const sources = listSources();

    expect(sources).toContain('store/screen/06-pricing.html');
    expect(sources).toContain('store/screen/_shared.css');
    expect(sources).toContain('store/screen/build.mjs');
    /* 記録の書き方を直してもPNGは変わらないため、このファイル自身は対象外 */
    expect(sources).not.toContain('store/screen/builtFrom.mjs');
    expect(sources.length).toBeGreaterThan(20);
  });

  it('ストア提出用PNGが指定寸法である', () => {
    for (const { canvas, size } of [
      { canvas: 'ios65', size: [1242, 2688] },
      { canvas: 'ipad13', size: [2064, 2752] },
    ]) {
      for (const lang of ['ja', 'en']) {
        const directory = new URL(`../../../../store/out/${canvas}/${lang}/`, import.meta.url);
        const files = readdirSync(directory).filter((name) => name.endsWith('.png'));
        expect(files).toHaveLength(7);

        for (const file of files) {
          const header = readFileSync(new URL(file, directory)).subarray(0, 24);
          expect(header.toString('ascii', 12, 16), file).toBe('IHDR');
          expect([header.readUInt32BE(16), header.readUInt32BE(20)], file).toEqual(size);
        }
      }
    }
  });
});
