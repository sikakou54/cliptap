# 画面識別子の検証状況（統括）

## screens.csv の但し書き

- `apps/mobile/app/**` の `.tsx` は26ファイルあるが、`_layout.tsx` と `settings/_layout.tsx` の
  2件は画面ではなくナビゲーション定義のため、意図的に除外している（画面台帳は24→`webview.tsx` を
  利用規約とプライバシーポリシーの2行へ分割して25行）。
- `Presentation` の `modal|card` は `_layout.tsx` の `tabletAwareModalOptions`
  （`isTabletDevice ? 'card' : 'modal'`）に対応する。iPhoneでは `modal`、iPadでは `card` になる。
  自動実行の対象はiPhoneシミュレータなので、実行時は `modal` として扱う。


`screens.csv` の `Signature` を実機（iPhone 17 / iOS 26.5）で確認した結果。

## 実機で確認済み（10件）

| ScreenID | Signature | 備考 |
|---|---|---|
| SC-HOME | `label=すべて` | カテゴリチップ |
| SC-SETTINGS | `label=設定` | 見出し |
| SC-SETTINGS-CATEGORIES | `role=AXStaticText&label=カテゴリ + -label=カテゴリ作成 + -label=カテゴリ編集` | 見出しだけでは子画面の項目ラベルと衝突するため否定条件を追加 |
| SC-SETTINGS-PROFILES | `role=AXStaticText&label=プロファイル + -label=変数を編集 + -label=変数を追加` | 変数編集の表ヘッダと衝突するため否定条件を追加 |
| SC-SETTINGS-VARIABLES | `role=AXStaticText&label=カスタム変数` | 衝突なし |
| SC-SETTINGS-SYSTEM-VARIABLE-FORMATS | `label=すべて既定に戻す` | 右上ボタン |
| SC-WEBVIEW-TERMS / SC-WEBVIEW-PRIVACY | `role=AXStaticText&label=利用規約` / `…プライバシーポリシー` | 元は1画面だったが、識別のため2つへ分割 |
| SC-SNIPPET-EDIT | `label=定型文編集` | 見出し |
| SC-CATEGORY-SELECT | `label=カテゴリを選択` | 定型文編集のプレースホルダは `カテゴリを選択, ` なので完全一致で区別できる |
| SC-CATEGORY-EDIT | `label=カスタムRGB` | 色指定欄 |

## 修正済み（実機で不一致を確認）

| ScreenID | 旧 | 新 |
|---|---|---|
| SC-VARIABLE-FORMAT-EDIT | `label=既定` | `label~=既定 + -label=すべて既定に戻す` … 「既定」はプリセット行の複合ラベル内にあり、完全一致では取れない |

## 未検証（初回実行で確定させる）

SC-SEARCH / SC-SNIPPET-CREATE / SC-SNIPPET-TITLE-INPUT / SC-SNIPPET-CONTENT-INPUT /
SC-SNIPPET-PROFILE-SELECT / SC-PROFILE-EDIT / SC-VARIABLE-EDIT /
SC-VARIABLE-PROFILE-VALUE-EDIT / SC-SETTINGS-EXPORT-IMPORT /
SC-SUBSCRIPTION-MANAGE / SC-SUBSCRIPTION-PAYWALL

（`SC-PROFILE-VARIABLE-EDIT` は画面ごと削除したため対象外。`screens.csv` からも削除済み）

`ASSERT_SCREEN` が落ちた場合は `AUTOMATION_ERROR` として一括で直す。
アプリの不具合として登録しないこと。

## 分かった原則

1. **React Nativeの行は子要素のテキストを `, ` でつないだ1要素になる。**
   設定画面の「カテゴリ」行は `, カテゴリ, `、カテゴリ管理の見出しは `カテゴリ`。
   **完全一致（`label=`）を使えば区別できる。**部分一致では区別できない。
2. 見出しだけでは、そこから開く子画面の項目ラベルと衝突することがある。
   `+ -label=…` で否定条件を足す。
3. **アイコンだけのボタンもラベルを持つ。** ただし中身はIoniconsの私用領域グリフ
   （例: 検索 ``、設定 ``）で、CSVへ書ける文字ではない。
   したがって `has=label` はアイコンボタンを**除外しない**。
   アイコンは順序指定で特定する。ホームのヘッダは
   `role=AXGenericElement&has=label` の `[0]`=プロファイル選択 / `[1]`=設定 / `[2]`=入出力 /
   `[3]`=検索 / `[4]`=追加 / `[5]`=並べ替え（プロファイル0件のときは1つずれる）。
   （当初「ラベルを持たない」と書いていたが、グループCの実測で誤りと判明したため訂正）
4. 検索画面は `transparentModal` だが、開くと背後のホームはAXツリーから消える。
   検索画面で `ASSERT_SCREEN_LACKS` を安全に使える。
