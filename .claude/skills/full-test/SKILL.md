---
name: full-test
description: ClipTapの全画面・全機能・全パターンを網羅するテスト仕様書をCSVで作り、iOSシミュレータ上で自動実行して不具合管理台帳まで作る。機能仕様書とソースコードの両方を解析してテストパターンを洗い出し、網羅率が100%になるまでレビューと修正を繰り返す。「全パターンテスト」「テスト仕様書を作って」「網羅テスト」「自動テストを流して」と言われたときに使う。リリース直前の目視巡回だけなら release-check を使う。
---

# 全パターン自動テスト

機能仕様書を基準に、ソースコードで補完してテストパターンを洗い出し、
CSVのテスト仕様書へ落として、iOSシミュレータ上で機械的に実行する。

**1機能1テストにしない。** 各機能に成立し得る条件・入力・状態・権限・分岐・遷移を
すべて展開する。件数の上限を先に決めない。1機能に100パターン必要なら100作る。

**アプリは修正しない。** このスキルの成果物はテスト仕様書・実行結果・不具合管理台帳。
不具合を見つけても直さず、台帳へ記録する。

---

## 成果物

| 場所 | 内容 |
|---|---|
| `docs/test/features.csv` | 機能台帳（F-01〜F-24） |
| `docs/test/screens.csv` | 画面台帳（`apps/mobile/app/**` の全ルート） |
| `docs/test/routes.csv` | ルート台帳（起点・条件別） |
| `docs/test/pattern-matrix.csv` | パターン網羅表 |
| `docs/test/testspec.csv` | テスト仕様書（1行1ステップ） |
| `docs/test/results/<runId>/` | 実行結果・証跡・レポート |
| `docs/test/issues.md` | 不具合管理台帳 |

保存先は `config.env` で変更できる。

---

## 手順

### ステップ0: 環境の確認

```bash
S=.claude/skills/full-test/scripts/sim.sh
$S boot        # シミュレータを起動
$S install     # アプリをビルドしてインストール（数分。2回目以降はJS変更だけなら不要）
$S device      # UDID・機種・OSバージョン
$S dump        # AXツリーが取れることを確認
```

`dump` が権限エラーになるときは、システム設定 > プライバシーとセキュリティ >
アクセシビリティ で、このセッションの親アプリ（Visual Studio Code など）を許可する。

### ステップ1〜9: テスト仕様書を作る

[reference/process.md](reference/process.md) の工程に従う。4つの役割を分けて進める。

1. 対象範囲の確定（統括）
2. 機能仕様書の解析（統括）→ `features.csv`
3. ソースコード解析（仕様書作成）→ `screens.csv` / `routes.csv` / 条件分岐
4. パターン展開（仕様書作成）→ `pattern-matrix.csv`
5. 前提条件の確定（前提条件確定）
6. テストケース化（仕様書作成）→ `testspec.csv`
7. 機械検証
8. 独立レビュー（レビュー）
9. 網羅性検証

書き方は [reference/csv-schema.md](reference/csv-schema.md)、
パターンの洗い出しは [reference/patterns.md](reference/patterns.md)、
前提条件は [reference/preconditions.md](reference/preconditions.md) を見る。

動く最小例が [sample/](sample/) にある。列の埋め方に迷ったらこれを見る。

```bash
cp .claude/skills/full-test/templates/*.csv docs/test/     # ヘッダだけの雛形
node .claude/skills/full-test/scripts/merge-parts.mjs      # 分担した部分ファイルを統合
node .claude/skills/full-test/scripts/validate.mjs         # 7. 機械検証
node .claude/skills/full-test/scripts/coverage.mjs         # 9. 網羅性検証
```

### 分担して作るとき

機能数が多いので、パターン展開は機能グループごとに分担する。
同じファイルへ同時に書くと壊れるため、担当ごとに部分ファイルへ書いて後で統合する。

```
docs/test/parts/
  BRIEF.md                     担当共通の指示（統括が書く）
  pattern-matrix-<GROUP>.csv
  testspec-<GROUP>.csv
  route-claims-<GROUP>.csv     列: RouteID,PatternID,TestID（通ったRouteを申告する）
  fixture-requests-<GROUP>.md  既存fixtureで作れない状態の要求
```

`TestID` は担当ごとに範囲を割り当てる（例 A=TC-0001〜0999、B=TC-1000〜1999）。
`PatternID` は `P-<FeatureID>-NNN` なので機能ごとに独立し、衝突しない。

`merge-parts.mjs` がIDの衝突と、どの担当も申告しなかったRouteを検出する。

**7・8・9のいずれかが未達のまま実行へ進まない。**
`validate.mjs` がエラー0件、レビュー指摘0件、
`coverage.mjs` が画面・機能・パターン・Route 100%。この3つが揃って初めて実行できる。

### ステップ10: 実行

```bash
R=.claude/skills/full-test/scripts/run.mjs
node $R --run-id 20260812-1800                    # 全件
node $R --tests TC-0001,TC-0002                   # 一部
node $R --filter FeatureID=F-02                   # 機能単位
node $R --dry-run                                 # 解釈だけ検証（操作しない）
node $R --run-id 20260812-1800 --resume            # 既存結果を保持して中断位置から再開
node $R --run-id 20260812-1800 --resume --retry-nonpass # FAIL/BLOCKEDだけ再実行
```

ランナーが前提条件の構築・操作・検証・証跡取得・後始末まで行う。
Claudeがステップごとに画面を見て判断する必要はない。

初回は `--dry-run` で前提条件とActionの解釈を検証してから流す。
`--dry-run` はシミュレータへ接続しない。実行中にシミュレータが失われた場合は
後続を大量のBLOCKEDにせず即時中断するため、環境を復旧して
`--resume --retry-nonpass` で再開する。

### ステップ11: 結果の検証と原因分類

FAILは自動では分類しきれない。ランナーは仮の分類を置くだけなので、
[reference/failure-classification.md](reference/failure-classification.md) の順で確定し、
`results-tests.csv` の `FailureClass` を書き換える。

### ステップ12: 不具合登録

[reference/defects.md](reference/defects.md) に従う。**登録前に必ず重複を調べる。**

```bash
B=.claude/skills/full-test/scripts/bug.mjs
node $B search "キーワード" "キーワード"    # 重複確認（必須）
node $B recur BUG-0007 '{...}'              # 既存へ追記
node $B add '{...}'                         # 新規登録
node $B check --run 20260812-1800           # 登録漏れ・分類漏れの検出
```

### ステップ13: レポート

```bash
node .claude/skills/full-test/scripts/report.mjs --run 20260812-1800
```

`docs/test/results/<runId>/report.md` に、実行サマリ・網羅率・未テスト一覧・
FAIL/BLOCKED一覧・原因分類の内訳・不具合の相互追跡が出る。

---

## シミュレータの操作

要素はラベルで指定する。スクリーンショットを読んで座標を推測しない。

```bash
S=.claude/skills/full-test/scripts/sim.sh
$S dump                          # 画面のAXツリー（ラベルと座標）
$S texts                         # 表示テキストだけ
$S tap 'label=すべて'            # ラベルでタップ
$S find 'text~=進捗報告'         # 座標を得る
$S count 'role=AXButton&has=label&visible=true'
$S clipboard                     # コピー結果の実値
$S logs 5                        # JSエラー
```

### 知っておくこと

- **画面外へスクロールした要素もAXツリーに残る。** `visible=true` を付けないと
  見えていないものを「ある」と判定する。
- **画面内でも下端は広告バナーに覆われる。** そこをタップしても届かない。
  `sim.sh tap` は対象が安全域の外なら自動でスクロールしてから押す。
  ただし画面外の要素が1つも無い（スクロールできる一覧が無い）ときは、スクロールせずにそのまま押す。
  画面下端に固定したボトムシートの項目でスクロールすると、スワイプがシートの外側のタップになりシートが閉じるため。
  安全域の比率は `config.env` の `SAFE_TOP_RATIO` / `SAFE_BOTTOM_RATIO`。
- **アイコンだけのボタンはラベルを持たない。** ClipTapは `accessibilityLabel` が
  5箇所しか無いため、ヘッダーのアイコンなどは位置と順序で特定する。
- **連続タップを避ける。** 間隔が短いとDevToolsのインスペクタが起動して画面を覆う。
  ランナーは `config.env` の `STEP_INTERVAL_MS` だけ間を空ける。
- **ディープリンクは使えない。** `simctl openurl` はiOSの確認ダイアログに阻まれる。
  画面遷移は必ずタップで行う。

## 前提条件の組み立て

DBと永続設定を直接組み立てる。画面操作で前提を作ると、
前提を作る過程の不具合でテスト自体が倒れる。

```bash
T=.claude/skills/full-test/scripts/state.sh
$T list-fixtures                 # 使えるfixture
$T fixture baseline              # DBを基準データへ置き換え
$T plan pro                      # プラン上書き
$T sort title                    # 並べ替え設定
$T schema                        # スキーマ版と各テーブル件数
$T sql "select count(*) from snippets"
$T snapshot before / restore before
```

アプリ本体のデータアクセスは常にMapper経由であり、ここでの直接操作はテスト治具に限る。

---

## 自動実行できないもの

シミュレータでは再現しない。テスト仕様書には載せ、手動チェックとして残す。

| 対象 | 理由 |
|---|---|
| 拡張キーボード | 別バンドル。AXツリーからも操作できない。フルアクセス許可は実機のみ |
| 触覚フィードバック | シミュレータに振動が無い |
| 実購入フロー | Sandboxでも購入UIはシステム提供 |
| Android | 実行基盤が別（`RefreshControl` などiOSと実装が違う） |
| Web | 実行基盤が別 |
| 完全な空DB | `__DEV__` ビルドは定型文とカスタム変数が両方0件のとき再投入する |
| ディープリンク | iOSの確認ダイアログに阻まれる |

これらは `pattern-matrix.csv` から削除せず、
`Reachability=UNREACHABLE` と `UnreachableReason` を書いて残す。

---

## 完了条件

すべて満たしたときだけ完了とする。1つでも未達なら完了ではない。

**テスト仕様書**

- [ ] `validate.mjs` がエラー0件
- [ ] `_layout.tsx` を除く `apps/mobile/app/**` の全画面ルートファイルが `screens.csv` にある
- [ ] `features.csv` が F-01〜F-24 を持つ
- [ ] 全REACHABLEパターンに TestID が割り当たっている
- [ ] 各機能に正常系・異常系・境界値がある
- [ ] Free / Pro の差がある機能で両方のパターンがある
- [ ] データ0件・1件・複数件・上限到達の差がある画面で各状態のパターンがある
- [ ] 同一Routeでも起点・条件・状態が違えば別パターンになっている
- [ ] レビュー指摘が0件
- [ ] `coverage.mjs` で画面・機能・パターン・Routeが100%
- [ ] UNREACHABLE に根拠が書かれている

**実行**

- [ ] 未テスト画面・機能・Pattern・Routeが0件
- [ ] `REQUIRES_TRIAGE` が0件（全FAILの原因分類が確定）
- [ ] `bug.mjs check` が問題なし
- [ ] `APPLICATION_DEFECT` と `SPEC_IMPLEMENTATION_MISMATCH` がすべて台帳に登録済み
- [ ] TestID と BUG-ID を相互に辿れる

---

## 仕様の正本

判断に迷ったら [docs/機能仕様書.md](../../../docs/機能仕様書.md) を正とする。
機能仕様書に書かれていないことを推測で補完しない。
仕様書とソースコードが食い違ったら、どちらかを正として勝手に補正せず、
`SPEC_IMPLEMENTATION_MISMATCH` として両方を確認できる形で記録する。

## release-check との違い

| | full-test | release-check |
|---|---|---|
| 目的 | 全パターンの網羅と回帰の検出 | リリース直前の目視確認 |
| 手段 | CSVのテスト仕様書を機械実行 | チェックリストを人が巡回 |
| 成果物 | 仕様書・結果CSV・不具合台帳 | OK/NG/未確認の報告 |
| 所要 | 仕様書作成に時間がかかる。実行は自動 | 短い |

日常の確認は `release-check`、網羅性を保証したいときは `full-test`。
