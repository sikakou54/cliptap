# パターン展開の共通ブリーフ（統括より）

## 立場
あなたはベテランSEです。担当機能について、成立し得るテストパターンを**すべて**洗い出し、
機械実行できるテストケースへ落とします。1機能1テストにしないこと。件数の上限を先に決めないこと。

## 必ず読むもの
1. `.claude/skills/full-test/reference/patterns.md` … パターン展開の観点表
2. `.claude/skills/full-test/reference/csv-schema.md` … 列定義・Action語彙・ロケータ構文
3. `.claude/skills/full-test/reference/preconditions.md` … 前提条件の語彙とfixture一覧
4. `.claude/skills/full-test/sample/` … 動く最小例（列の埋め方の見本）
5. `docs/機能仕様書.md` の担当節 … **テスト要求の正本**
6. `docs/test/features.csv` / `screens.csv` / `routes.csv` … ID台帳。ここにあるIDだけを使う
7. 担当機能の実装コード（`apps/mobile/app/`, `apps/mobile/src/`, `packages/shared/src/`）
8. `packages/shared/src/i18n/ja.json` … **期待値の文言はここから取る**（画面を見て書き写さない）

## 守ること
- 機能仕様書に書かれていないことを推測で補完しない。判断できないものは報告に書く。
- 仕様と実装が食い違ったら、どちらかへ寄せず両方をパターンとして残し、報告に挙げる。
- 期待値に曖昧語を使わない（「正しく」「適切に」「問題なく」「期待通り」「など」は機械検証で弾かれる）。
- 前提条件は `preconditions.md` の語彙だけで書く。空欄は不可、無条件なら `none`。
- **存在しないfixtureを参照しない。** 必要な状態が今のfixtureで作れない場合は
  `docs/test/parts/fixture-requests-<GROUP>.md` に「必要な状態・理由・使うテスト」を書いて統括へ回す。
- 各テストに `ASSERT_*` を1つ以上入れる。入っていないとPASS/FAILを判定できない。
- StepNoは1からの連番。飛びも重複も不可。
- Actionは `csv-schema.md` の語彙のみ。
- 絵文字などBMP外の文字は `TYPE` では入力できない（AppleScriptのkeystrokeが送れない）。`TYPE_PASTE` を使う。
- `locale=en` のテストで `ASSERT_SCREEN` は使えない（Signatureが日本語ラベル前提）。英語ラベルの `ASSERT_VISIBLE` で代替する。
- ロケータには `visible=true` の要否を意識する（ランナーが自動付与するので明示は不要）。

## 自動実行できないこと（実測で確認済み。該当パターンは REACHABLE にしない）
| 事象 | 扱い |
|---|---|
| DocumentPicker（インポートのファイル選択）と共有シート | AXツリーに現れない。`UNREACHABLE` |
| WebViewの本文 | AXツリーに現れない。ヘッダまでは検証可。本文表示は `UNREACHABLE` |
| 定型文0件かつカスタム変数0件の完全な空DB | `__DEV__`ビルドが再投入する。`UNREACHABLE` |
| 拡張キーボード・触覚フィードバック・実購入・Android・Web | `UNREACHABLE` |
| ディープリンク | iOSの確認ダイアログに阻まれる。`UNREACHABLE` |

`UNREACHABLE` にするときは `UnreachableReason` に**根拠**を書く。「面倒だから」は理由にならない。

## アイコンボタンの指定（実機で確認済み・重要）

アイコンだけのボタンも**ラベルを持つ**。中身はIoniconsの私用領域グリフで、ダンプ上は空に見える。

```
[AXGenericElement] label="" @1498,187   ← 実体は U+F56C（settings-outline）
```

したがって

- `label=`（空文字との完全一致）はアイコンに**一致しない**
- `has=label` はアイコンを**除外しない**

ロケータの値では `\uXXXX` がコードポイントとして解釈される。**順序指定ではなくこれを使う。**

```
TAP  label=\uF56C     設定      TAP  label=\uF127     戻る
TAP  label=\uF563     検索      TAP  label=\uF24A     閉じる
TAP  label=\uF5B1     入出力    TAP  label=\uF5F6     削除
TAP  label=\uF105     追加      TAP  label=\uF293     編集
```

対応表は `.claude/skills/full-test/reference/icons.md`（アプリで使う33個）。
同じアイコンが複数あるときだけ順序指定を足す（例 `label=\uF293&visible=true[0]`）。

定型文・ショートカットの一覧カードの編集・削除はアイコンではない。
カード右上の「・・・」（ラベル「<項目名>のその他の操作」）でメニューを開き、`label=編集` / `label=削除` を押す。

```
TAP  label=<名前>のその他の操作                  名前でカードを指定（画面外なら先に SCROLL_TO）
TAP  label~=のその他の操作&visible=true[0]      画面内で先頭のカード
TAP  label=編集
```

**書いたロケータは実機で一致件数を確認すること。**

```bash
.claude/skills/full-test/scripts/state.sh fixture baseline
.claude/skills/full-test/scripts/sim.sh relaunch
.claude/skills/full-test/scripts/sim.sh count 'label=\uF56C'
```

## 出力先（自分のグループのファイルだけに書く。他グループのファイルに触らない）
- `docs/test/parts/pattern-matrix-<GROUP>.csv`
- `docs/test/parts/testspec-<GROUP>.csv`
- `docs/test/parts/route-claims-<GROUP>.csv`（列: `RouteID,PatternID,TestID`。自分のテストが通る routes.csv の行を申告する）
- `docs/test/parts/fixture-requests-<GROUP>.md`（必要なときだけ）

ヘッダ行を含めること。UTF-8 / LF / RFC4180準拠（`,` `"` 改行を含む値は `"` で囲み `""` でエスケープ）。

## ID規約
- `PatternID` … `P-<FeatureID>-<3桁連番>`（例 `P-F02-001`）。機能ごとに独立しているので衝突しない
- `ConditionID` … `C-<FeatureID>-<2桁連番>`（例 `C-F02-01`）。「何を変える軸か」を表す
- `TestID` … 指定された範囲の `TC-<4桁>` を使う。**範囲外を使わないこと**

## 最終報告に必ず含めること
1. 機能ごとの ConditionID 数 / PatternID 数 / TestID 数
2. `UNREACHABLE` にしたパターンと根拠
3. 仕様と実装の食い違い（あれば具体的に）
4. 追加を要求した fixture
5. 担当機能に関係するのに自分のテストで通らなかった routes.csv の RouteID と理由
6. 判断に迷った点
