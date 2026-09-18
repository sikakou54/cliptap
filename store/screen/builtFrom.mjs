/**
 * ClipTap ストア掲載画像 — 生成元の記録（BUILT_FROM.json）。
 *
 * 【目的】
 * store/out/**.png はストア提出物だが、生成元のHTMLやCSSを直しても
 * PNGを焼き直さなければ古い文言のまま残る。PNGの中身は型チェックもテストも読めず、
 * mtime は git checkout で保たれないため、焼き漏れは静かに起きる唯一の経路になる。
 *
 * ここでは生成元ファイルのsha256を store/out/BUILT_FROM.json に記録する。
 * 記録を書くのは**PNGを焼いたあと**（scripts/store-screens.sh の最終段）に限る。
 * そうすることで、build.mjs だけを実行した状態では記録が古いままになり、
 * packages/shared/tests/publicDocs/screenshotFreshness.test.ts が落ちて焼き直しを促す。
 *
 * 【生成元に含めるもの】
 * スライド本体・シェル・スタイル・生成スクリプトに加え、スライドが貼り込む端末キャプチャ
 * （apps/web/public/image）も含める。キャプチャを差し替えたらPNGも作り直す必要があるため。
 *
 * 依存なし。node 22 以上。
 *
 *   node store/screen/builtFrom.mjs
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');

/** 記録の置き場（store/out はPNGとともにGit管理下にある） */
export const MANIFEST_PATH = path.join(REPO, 'store', 'out', 'BUILT_FROM.json');

/**
 * 生成元ファイルを列挙する。
 *
 * リポジトリルートからの相対パスを昇順で返す。dist/ と host/ は含めない
 * （dist は生成物、host は撮影時に別プロセスで配信するページで、PNGへ直接焼かれない）。
 */
export function listSources() {
  const screen = fs
    .readdirSync(HERE, { withFileTypes: true })
    /* builtFrom.mjs（このファイル）は含めない。記録の書き方を直してもPNGは変わらないため */
    .filter((entry) => entry.isFile() && (/\.(?:html|css)$/.test(entry.name) || entry.name === 'build.mjs'))
    .map((entry) => `store/screen/${entry.name}`);

  const imageDir = path.join(REPO, 'apps', 'web', 'public', 'image');
  const images = fs
    .readdirSync(imageDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && !entry.name.startsWith('.'))
    .map((entry) => `apps/web/public/image/${entry.name}`);

  return [...screen, ...images].sort();
}

/**
 * 生成元ファイルのsha256を求める。
 *
 * @returns リポジトリルートからの相対パスをキー、sha256を値に持つオブジェクト
 */
export function computeSourceHashes() {
  return Object.fromEntries(
    listSources().map((relative) => [
      relative,
      crypto.createHash('sha256').update(fs.readFileSync(path.join(REPO, relative))).digest('hex'),
    ])
  );
}

/** 記録を読む。まだ無ければ null。 */
export function readManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) return null;
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
}

/* 直接実行されたときだけ記録を書く（テストからは上の関数だけを使う） */
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  /* jobs.json が指すPNGがすべて揃っていることを確かめてから記録する。
     焼く前に記録してしまうと、この仕組み自体が嘘をつくことになる。 */
  const jobsPath = path.join(HERE, 'jobs.json');
  if (!fs.existsSync(jobsPath)) {
    throw new Error('store/screen/jobs.json が無い。先に node store/screen/build.mjs を実行する');
  }

  const missing = JSON.parse(fs.readFileSync(jobsPath, 'utf8'))
    .map((job) => job.png)
    .filter((png) => !fs.existsSync(png));
  if (missing.length) {
    throw new Error(`焼かれていないPNGがある: ${missing.map((p) => path.relative(REPO, p)).join(', ')}`);
  }

  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(computeSourceHashes(), null, 2)}\n`);
  console.log(`built-from ${path.relative(REPO, MANIFEST_PATH)}  (${listSources().length} sources)`);
}
