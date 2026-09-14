# アイコンボタンの指定方法

ClipTapのアイコンボタンの多くは `accessibilityLabel` を持たない。
しかし**ラベルが空なわけではない**。Ioniconsのグリフ文字がそのままAXラベルになる。
（`accessibilityLabel` を持つボタンはグリフがAXラベルに出ないため、下の「ラベルを持つボタン」のとおりラベルで指定する）

```
[AXGenericElement] label="" @1498,187   ← 実体は U+F56C（settings-outline）
```

端末で見ると空に見えるが、コードポイントを持つ1文字である。したがって

- `has=label` はアイコンボタンを**除外しない**
- `label=`（空文字との完全一致）はアイコンボタンに**一致しない**

## 書き方

ロケータの値では `\uXXXX` がUnicodeのコードポイントとして解釈される。

```
TAP  label=\\uF56C          設定アイコン
TAP  label=\\uF563          検索アイコン
TAP  label=\\uF127          戻る（arrow-back）
```

順序指定（`[n]`）よりこちらを使う。順序は画面の状態で変わるが、グリフは変わらない。

同じアイコンが画面に複数あるときは、順序指定や位置で絞る。

```
label=\\uF5F6&visible=true[0]     画面内で1件目の削除アイコン（カテゴリ管理など）
```

## ラベルを持つボタン

定型文・ショートカットの一覧カード右上の「・・・」（`ellipsis-horizontal`）は、
読み上げラベル「<項目名>のその他の操作」を持つ。編集・削除はこのボタンで画面下のボトムシートを開いてから選ぶ。

```
TAP  label=値3件ショートカットのその他の操作     名前でカードを指定して開く
TAP  label~=のその他の操作&visible=true[0]      画面内で先頭のカードを開く
TAP  label=編集                                  開いたシートの項目（削除は label=削除、閉じるのは label=キャンセル）
```

- ボタンはタイトルと同じ行にあるため、`TAP_NEAR`（基準より下にある対象）では拾えない。ラベルで直接指定する。
- 役割（role）は付けていないため、`role=AXButton&has=label`（定型文タイトルの並び）には含まれない。

## アプリで使われているアイコン（33件）

出典は `node_modules/@expo/vector-icons` のIoniconsグリフマップ。
アイコン名は `apps/mobile` のソースから抽出した。

| アイコン名 | コードポイント |
|---|---|
| `add` | `\\uF103` |
| `add-circle` | `\\uF104` |
| `add-circle-outline` | `\\uF105` |
| `calendar-outline` | `\\uF1D6` |
| `checkmark` | `\\uF21D` |
| `checkmark-circle` | `\\uF21E` |
| `chevron-down` | `\\uF232` |
| `chevron-forward` | `\\uF23B` |
| `close` | `\\uF24A` |
| `close-circle` | `\\uF24B` |
| `close-circle-outline` | `\\uF24C` |
| `code-slash-outline` | `\\uF26F` |
| `create-outline` | `\\uF293` |
| `diamond` | `\\uF2A1` |
| `ellipsis-horizontal` | `\\uF2CE` |
| `information-circle-outline` | `\\uF399` |
| `keypad` | `\\uF3A6` |
| `keypad-outline` | `\\uF3A7` |
| `logo-apple` | `\\uF3D8` |
| `logo-google` | `\\uF3F5` |
| `options-outline` | `\\uF48B` |
| `person-circle-outline` | `\\uF4AA` |
| `refresh-circle` | `\\uF515` |
| `refresh-outline` | `\\uF518` |
| `search` | `\\uF55F` |
| `search-outline` | `\\uF563` |
| `settings` | `\\uF56B` |
| `settings-outline` | `\\uF56C` |
| `star` | `\\uF595` |
| `swap-horizontal-outline` | `\\uF5B1` |
| `swap-vertical-outline` | `\\uF5B4` |
| `trash-outline` | `\\uF5F6` |
| `warning-outline` | `\\uF629` |

## 表に無いアイコンを調べる

```bash
node -e 'const g=require("./node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json");console.log("\\u"+g["アイコン名"].toString(16).toUpperCase())'
```

画面から逆引きするなら次で確認できる。

```bash
sim.sh json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{for(const n of JSON.parse(s))if(n.label&&n.visible)console.log([...n.label].map(c=>c.codePointAt(0).toString(16)).join(" "),n.cx,n.cy)})'
```
