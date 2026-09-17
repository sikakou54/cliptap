/**
 * 撮影用ホストのローカル配信サーバー。
 *
 * シミュレータはMacのネットワークをそのまま使うため、シミュレータのSafariから
 * http://localhost:<port> がそのまま開ける。実機から開くときだけMacのLAN IPを使う。
 *
 * 依存なし。node 22 以上。
 *
 *   node store/screen/host/serve.mjs
 *   node store/screen/host/serve.mjs --port 5000
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/* --port の次の引数をポートとして読む。指定が無ければ既定値。 */
const portIndex = process.argv.indexOf('--port');
const PORT = portIndex >= 0 ? Number(process.argv[portIndex + 1]) : 4599;
if (!Number.isInteger(PORT) || PORT <= 0) {
  console.error('--port には正の整数を指定してください');
  process.exit(1);
}

/** 拡張子 → Content-Type。ここにある形式だけを配る。 */
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

/**
 * MacのLAN IPを1つ返す（実機から開くとき用）。
 * 見つからなければnull。
 */
function lanAddress() {
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const a of addrs ?? []) {
      if (a.family === 'IPv4' && !a.internal) return a.address;
    }
  }
  return null;
}

const server = http.createServer((req, res) => {
  /* クエリを落として、配信ディレクトリの外へ出られないように正規化する */
  const requested = decodeURIComponent((req.url ?? '/').split('?')[0]);
  const relative = requested === '/' ? 'index.html' : requested.replace(/^\/+/, '');
  const file = path.join(HERE, relative);
  if (!file.startsWith(HERE + path.sep)) {
    res.writeHead(403).end('forbidden');
    return;
  }

  const type = TYPES[path.extname(file)];
  if (!type || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('not found');
    return;
  }

  /* 撮り直しのたびに古い画面が出ると気付けないので、キャッシュさせない */
  res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, '0.0.0.0', () => {
  const lan = lanAddress();
  console.log(`撮影用ホストを配信中`);
  console.log(`  シミュレータ: http://localhost:${PORT}`);
  if (lan) console.log(`  実機:         http://${lan}:${PORT}（同じWi-Fi）`);
  console.log(`  停止: Ctrl+C`);
});
