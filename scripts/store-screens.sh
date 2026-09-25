#!/usr/bin/env bash
#
# ストア掲載画像の生成スクリプト
#
# 【目的】
# store/screen/ の文言を直してから store/out/ のPNGを焼き直すまでを1コマンドで通す。
# 以前は「build.mjs を実行する」「html-to-png を実行する」の2段を手で叩く手順だったため、
# 片方だけ実行して古い文言のPNGをストアへ提出できる状態だった。
# PNGの中身は型チェックもテストも読めないため、これは静かに壊れる唯一の経路である。
#
# 【3段構成の理由】
# 最後の builtFrom.mjs は、焼かれたPNGが揃っていることを確かめてから
# 生成元のsha256を store/out/BUILT_FROM.json へ記録する。記録を書くのは必ずこの順で最後にする。
# build.mjs だけを実行した状態では記録が古いままになり、
# packages/shared/tests/publicDocs/screenshotFreshness.test.ts が落ちて焼き直しを促す。
#
# 【実行する内容】
#   1. store/screen/build.mjs     スライドHTMLと jobs.json を生成（store/screen/dist へ）
#   2. html-to-png                jobs.json に従いPNGを焼く（store/out へ）
#   3. store/screen/builtFrom.mjs 生成元のsha256を記録（store/out/BUILT_FROM.json）
#
# 【使い方】
#   npm run store:screens
#
# html-to-png の場所は HTML_TO_PNG で上書きできる。
#
# 【PNGの差分について】
# Chromeのレンダリングはバイト単位では再現しないため、文言を変えていないスライドの
# PNGも数バイトだけ変わることがある。コミットするのは文言を変えたスライドの差分だけにし、
# 中身が変わっていないものは git checkout で戻してよい。
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

HTML_TO_PNG="${HTML_TO_PNG:-$HOME/.claude/skills/html-to-png/scripts/html_to_png.js}"

if [ ! -f "$HTML_TO_PNG" ]; then
  echo "html-to-png が見つかりません: $HTML_TO_PNG" >&2
  echo "場所が違う場合は HTML_TO_PNG=<パス> npm run store:screens で指定してください。" >&2
  exit 1
fi

echo "==> 1/3 スライドHTMLを生成"
node store/screen/build.mjs

echo "==> 2/3 PNGを焼く"
node "$HTML_TO_PNG" store/screen/jobs.json

echo "==> 3/3 生成元を記録"
node store/screen/builtFrom.mjs

echo
echo "完了しました。store/out の差分をコミットしてください。"
