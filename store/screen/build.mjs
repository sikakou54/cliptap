/**
 * ClipTap ストア掲載画像 — ビルドスクリプト。
 *
 * store/screen/NN-<slug>.html の <template id="slide"> を取り出し、
 * _wrapper.html のシェルに流し込んで (スライド x canvas x 言語) 分の
 * 単体HTMLを store/screen/dist/ に書き出す。あわせて html-to-png 用の
 * jobs.json を生成する。
 *
 * 依存なし。node 22 以上。
 *
 *   node store/screen/build.mjs
 *   node ~/.claude/skills/html-to-png/scripts/html_to_png.js store/screen/jobs.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const DIST = path.join(HERE, 'dist');
const IMAGE_DIR = path.join(REPO, 'apps', 'web', 'public', 'image');

/** スライド定義。order がそのままストアでの並び順になる。 */
const SLIDES = [
  { slug: '00-hero', tone: 'light' },
  { slug: '01-keyboard', tone: 'light' },
  { slug: '02-scenes', tone: 'light' },
  { slug: '03-variables', tone: 'light' },
  { slug: '04-profiles', tone: 'light' },
  { slug: '05-shortcuts', tone: 'light' },
  { slug: '06-pricing', tone: 'poster' },
];

/**
 * 出力面の定義。
 * width は実デバイスpxのリテラルで、scale は常に 1。
 * canvas 側も実px指定なので、App Store Connect の寸法チェックが丸め誤差で落ちない。
 */
const CANVASES = [
  {
    id: 'ios69',
    width: 1290,
    height: 2796,
    /** App Store iPhone 6.9" */
    out: (slide, lang) => path.join(REPO, 'store', 'out', 'ios69', lang, `${slide.slug}.png`),
  },
  {
    id: 'ipad13',
    width: 2064,
    height: 2752,
    /** App Store iPad 13"（apps/mobile/app.json の supportsTablet: true により提出必須） */
    out: (slide, lang) => path.join(REPO, 'store', 'out', 'ipad13', lang, `${slide.slug}.png`),
  },
  {
    id: 'og',
    width: 1200,
    height: 630,
    /** OGP。LP が <meta property="og:image"> から参照している実体を直接置き換える。
        LP のヒーローをそのまま持つ 00-hero から作るので、シェアカードと
        リンク先ページの第一声が一致する。 */
    only: '00-hero',
    out: (slide, lang) => path.join(REPO, 'apps', 'web', 'public', 'ogp', `og-${lang}.png`),
  },
];

const LANGS = ['ja', 'en'];

/** <template id="slide"> の中身を取り出す。 */
function readSlideMarkup(slug) {
  const file = path.join(HERE, `${slug}.html`);
  const raw = fs.readFileSync(file, 'utf8');
  const m = raw.match(/<template id="slide">([\s\S]*?)<\/template>/);
  if (!m) throw new Error(`<template id="slide"> が見つからない: ${file}`);
  return m[1].trim();
}

/**
 * 参照している画像が実在するか確認する（レンダリング後に気付くと手戻りが大きい）。
 *
 * ファイル名に {{LANG}} を含む参照は言語ごとに別ファイルなので、LANGS のぶんへ
 * 展開してから見る。片方の言語だけ撮り忘れてもここで止まる。
 */
function assertImagesExist(slug, markup) {
  const missing = [...markup.matchAll(/\{\{IMG\}\}\/([\w.{}-]+)/g)]
    .map((m) => m[1])
    .flatMap((name) =>
      name.includes('{{LANG}}') ? LANGS.map((lang) => name.replaceAll('{{LANG}}', lang)) : [name]
    )
    .filter((name) => !fs.existsSync(path.join(IMAGE_DIR, name)));
  if (missing.length) {
    throw new Error(`${slug}.html が参照する画像が存在しない: ${missing.join(', ')}`);
  }
}

const wrapper = fs.readFileSync(path.join(HERE, '_wrapper.html'), 'utf8');

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

/* dist/ から画像ディレクトリへの相対パス。file:// で解決される。 */
const imgRel = path.relative(DIST, IMAGE_DIR).split(path.sep).join('/');

const jobs = [];

for (const slide of SLIDES) {
  const markup = readSlideMarkup(slide.slug);
  assertImagesExist(slide.slug, markup);

  for (const canvas of CANVASES) {
    if (canvas.only && canvas.only !== slide.slug) continue;

    for (const lang of LANGS) {
      const html = wrapper
        .replaceAll('{{SLIDE_MARKUP}}', markup)
        .replaceAll('{{CANVAS}}', canvas.id)
        .replaceAll('{{SLIDE}}', slide.slug)
        .replaceAll('{{TONE}}', slide.tone)
        .replaceAll('{{LANG}}', lang)
        .replaceAll('{{IMG}}', imgRel);

      const distFile = path.join(DIST, `${slide.slug}--${canvas.id}-${lang}.html`);
      fs.writeFileSync(distFile, html, 'utf8');

      jobs.push({
        html: distFile,
        png: canvas.out(slide, lang),
        /* .canvas は body の原点に整数寸法で置いてあるので、要素キャプチャで
           寸法が1pxもずれない。fullPage は canvas がビューポート(900)より
           低いとビューポート高さで出力されてしまうため使わない。 */
        selector: '.canvas',
        width: canvas.width,
        scale: 1,
        wait: 2500,
        bg: 'white',
      });
    }
  }
}

fs.writeFileSync(path.join(HERE, 'jobs.json'), `${JSON.stringify(jobs, null, 2)}\n`, 'utf8');

const perCanvas = CANVASES.map((c) => `${c.id} ${jobs.filter((j) => j.html.includes(`--${c.id}-`)).length}`).join(' / ');
console.log(`built ${jobs.length} pages -> ${path.relative(REPO, DIST)}  (${perCanvas})`);
console.log(`jobs   ${path.relative(REPO, path.join(HERE, 'jobs.json'))}`);
