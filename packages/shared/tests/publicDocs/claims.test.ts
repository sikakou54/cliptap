import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPOSITORY_ROOT } from '../helpers/sourceScan';
import { PUBLIC_CLAIMS } from './claims';
import { PUBLIC_DOCUMENTS } from './publicDocuments';

/**
 * 公開文書の主張のガード
 *
 * @remarks
 * `claims.ts` に登録した主張について、一度直した誤りの言い回しが復活しないこと、
 * 正しい説明が主張を載せているすべての文書に入っていることを確認する。
 *
 * 禁止語句の走査は登録済みの文書に限らず**公開文書の全件**に掛ける。
 * 主張を載せた文書が1つ増えたときにも効かせるためで、
 * `sites` に列挙した範囲だけを見ると12箇所目の複製を拾えない。
 */

/** 文書の中身を読む（比較は原文のまま行い、正規化しない） */
function readDocument(path: string): string {
  return readFileSync(resolve(REPOSITORY_ROOT, path), 'utf8');
}

/** 語句の初出位置を1始まりの行番号で返す（見つからなければ null） */
function findLine(content: string, phrase: string): number | null {
  const index = content.indexOf(phrase);
  if (index < 0) return null;

  return content.slice(0, index).split('\n').length;
}

describe('公開文書の主張', () => {
  const contents = new Map(PUBLIC_DOCUMENTS.map((document) => [document.path, readDocument(document.path)]));

  it('一度直した誤りの言い回しがどの公開文書にも復活していない', () => {
    const revived = PUBLIC_CLAIMS.flatMap((claim) =>
      claim.forbiddenAnywhere.flatMap((phrase) =>
        [...contents].flatMap(([path, content]) => {
          const line = findLine(content, phrase);
          return line === null ? [] : [`${claim.id}: ${path}:${line} に禁止語句「${phrase}」`];
        }),
      ),
    );

    expect(revived).toEqual([]);
  });

  it('主張を載せている文書に正しい説明が入っている', () => {
    const missing = PUBLIC_CLAIMS.flatMap((claim) =>
      claim.sites.flatMap((site) => {
        const content = contents.get(site.path);
        if (content === undefined) {
          return [`${claim.id}: ${site.path} が publicDocuments.ts の台帳に登録されていない`];
        }

        return site.mustContain
          .filter((phrase) => !content.includes(phrase))
          .map((phrase) => `${claim.id}: ${site.path} に必須語句「${phrase}」が無い（正本: packages/shared/tests/publicDocs/claims.ts）`);
      }),
    );

    expect(missing).toEqual([]);
  });

  it('主張が指す仕様書の節と実装が実在する', () => {
    /* 参照先を移動・改名しても台帳は静かに古くなるため、パス部分の実在だけ確認する */
    const broken = PUBLIC_CLAIMS.flatMap((claim) =>
      [claim.spec.split(/\s+/u)[0], ...claim.evidence]
        .filter((path) => !existsSync(resolve(REPOSITORY_ROOT, path)))
        .map((path) => `${claim.id}: 参照先 ${path} が実在しない`),
    );

    expect(broken).toEqual([]);
  });

  it('台帳の照合が実際に働いている', () => {
    /* 登録の取り違えと、照合そのものの空振りを防ぐ */
    expect(PUBLIC_CLAIMS.length).toBeGreaterThan(0);
    expect(PUBLIC_CLAIMS.every((claim) => claim.forbiddenAnywhere.length > 0)).toBe(true);
    expect(PUBLIC_CLAIMS.every((claim) => claim.sites.length > 0)).toBe(true);
    expect(PUBLIC_CLAIMS.map((claim) => claim.id).length).toBe(new Set(PUBLIC_CLAIMS.map((claim) => claim.id)).size);

    /* 存在する語句と存在しない語句を取り違えていないことを確認する */
    const terms = contents.get('apps/web/public/terms.html') ?? '';
    expect(findLine(terms, '他のプロファイルを削除して有効な3つの枠に空きが出た場合')).toBeGreaterThan(0);
    expect(findLine(terms, '再度Proプランに加入するまで利用できません')).toBeNull();
  });
});
