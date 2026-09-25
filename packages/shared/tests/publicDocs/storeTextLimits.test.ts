import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPOSITORY_ROOT } from '../helpers/sourceScan';
import { PUBLIC_DOCUMENTS } from './publicDocuments';

/**
 * ストア掲載文の字数上限ガード
 *
 * @remarks
 * App Store と Google Play の各枠には字数上限があり、超えた原稿はコンソールへ
 * 貼った時点で切り捨てられるか拒否される。原稿は文章を足す方向に育つため、
 * 記述を正確にする修正そのものが上限を超える原因になる。
 *
 * 上限値は原稿の見出し自身が持っている（`【App Store｜タイトル】（30字以内）`）ため、
 * ここでは見出しから読み取って本文の長さと突き合わせるだけにする。
 * 上限の正本を別ファイルへ作らないので、二重管理が生まれない。
 */

/** 見出し行から枠の名前と上限を読み取る（上限は見出しの内側と外側の両方に現れる） */
const HEADING_PATTERN = /^【(.+?)】/u;
const LIMIT_PATTERN = /([\d,]+)\s*(?:字以内|chars max)/u;

/** 枠1つ分の原稿 */
interface StoreTextSection {
  /** 枠の名前（見出しの【】の中身） */
  readonly name: string;
  /** 見出しの1始まりの行番号 */
  readonly line: number;
  /** 見出しに書かれた上限（読み取れなければ null） */
  readonly limit: number | null;
  /** 本文の文字数（コードポイント数） */
  readonly length: number;
}

/** 原稿を枠ごとに切り出す */
function readSections(path: string): StoreTextSection[] {
  const lines = readFileSync(resolve(REPOSITORY_ROOT, path), 'utf8').split('\n');
  const sections: StoreTextSection[] = [];
  let current: { name: string; line: number; limit: number | null } | null = null;
  let body: string[] = [];

  const close = (): void => {
    if (!current) return;
    sections.push({ ...current, length: [...body.join('\n').trim()].length });
  };

  lines.forEach((text, index) => {
    const heading = HEADING_PATTERN.exec(text);
    if (!heading) {
      if (current) body.push(text);
      return;
    }

    close();
    const limit = LIMIT_PATTERN.exec(text);
    current = {
      name: heading[1],
      line: index + 1,
      limit: limit ? Number(limit[1].replace(/,/gu, '')) : null,
    };
    body = [];
  });
  close();

  return sections;
}

/** 台帳からストア掲載文の原稿だけを取り出す */
const STORE_TEXTS = PUBLIC_DOCUMENTS.filter((document) => document.kind === 'store').map((document) => document.path);

describe('ストア掲載文の字数上限', () => {
  it('すべての枠が見出しに書かれた上限に収まっている', () => {
    const overflows = STORE_TEXTS.flatMap((path) =>
      readSections(path)
        .filter((section) => section.limit !== null && section.length > section.limit)
        .map((section) => `${path}:${section.line} ${section.name} が ${section.length}字（上限 ${section.limit}字）`),
    );

    expect(overflows).toEqual([]);
  });

  it('すべての枠の見出しから上限を読み取れている', () => {
    /* 見出しの書式を変えて上限が読めなくなると、検査が黙って無効化されるため固定する */
    const unreadable = STORE_TEXTS.flatMap((path) =>
      readSections(path)
        .filter((section) => section.limit === null)
        .map((section) => `${path}:${section.line} ${section.name} の上限を読み取れない`),
    );

    expect(unreadable).toEqual([]);
  });

  it('枠の切り出しが実際に働いている', () => {
    /* 枠数と、上限ぎりぎりの枠が実在することを確認して空振りを防ぐ */
    const sections = STORE_TEXTS.map((path) => readSections(path));

    expect(sections.every((list) => list.length >= 8)).toBe(true);
    expect(sections.every((list) => list.every((section) => section.length > 0))).toBe(true);
    expect(readSections('store/store_en.txt').some((section) => section.limit !== null && section.length === section.limit)).toBe(true);
  });
});
