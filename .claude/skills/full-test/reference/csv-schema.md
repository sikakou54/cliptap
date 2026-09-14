# 成果物CSVの仕様

すべて `docs/test/`（`config.env` の `TEST_DOC_DIR`）へ置く。
文字コードはUTF-8、改行はLF、RFC4180準拠（`,` `"` 改行を含む値は `"` で囲み `""` で埋め込む）。

| ファイル | 役割 |
|---|---|
| `features.csv` | 機能台帳。機能仕様書 §7 と1対1 |
| `screens.csv` | 画面台帳。`apps/mobile/app/**` の全ルートと1対1 |
| `routes.csv` | ルート台帳。同一Routeでも起点・条件が違えば別行 |
| `pattern-matrix.csv` | パターン網羅表。テスト設計の中心 |
| `testspec.csv` | テスト仕様書。1行1ステップ |

---

## features.csv

```
FeatureID,Name,SpecRef,Platform,Scope
F-02,定型文管理,§8.2,mobile;web,in-scope
```

| 列 | 内容 |
|---|---|
| `FeatureID` | `F-01`〜`F-23`。機能仕様書 §7 と一致させる |
| `Name` | 機能名 |
| `SpecRef` | 機能仕様書の節番号。**必須** |
| `Platform` | `mobile` / `web` / `keyboard` を `;` 区切り |
| `Scope` | `in-scope` / `manual-only` / `out-of-scope` |

---

## screens.csv

```
ScreenID,Name,Route,File,Presentation,Signature,SpecRef
SC-HOME,ホーム,/,apps/mobile/app/index.tsx,stack,label=すべて,§9.1
```

| 列 | 内容 |
|---|---|
| `ScreenID` | `SC-` 始まり |
| `Route` | Expo Routerのパス |
| `File` | 実装ファイル。`_layout.tsx` を除く `apps/mobile/app/**` の全画面ルートファイルが最低1行現れること。同じファイルが表示条件で別画面になる場合は複数行可 |
| `Presentation` | `stack` / `modal` / `transparentModal` / `fullScreenModal` / `card`。端末条件で変わる場合は `modal\|card` のように併記 |
| `Signature` | **その画面だけに存在する要素のロケータ**。`ASSERT_SCREEN` の判定に使う |
| `SpecRef` | 機能仕様書の節 |

### Signature の決め方

`sim.sh dump` でその画面を表示した状態のAXツリーを取り、
他の画面に無いラベルを選ぶ。見出しテキストが最も安定する。
アイコンだけのボタンはラベルを持たないので使えない。

複数の条件を組み合わせられる。

- `+` … これも在ること
- `+-` … これは無いこと（`+` の後に `-` を付ける）

例: カテゴリ管理の見出し「カテゴリ」は、そこから開くカテゴリ作成画面の項目ラベルにも現れる。
見出しだけを識別子にすると、子画面にいるのに親画面だと誤判定する。

```
role=AXStaticText&label=カテゴリ + -label=カテゴリ作成 + -label=カテゴリ編集
```

### RNの行は「, 」で連結される

React Nativeの行コンポーネントは、子要素のテキストを `, ` でつないだ1つの要素として
AXツリーへ出る。設定画面の「カテゴリ」行は `label=", カテゴリ, "` になり、
カテゴリ管理画面の見出しは `label="カテゴリ"` になる。
**完全一致（`label=`）を使えば両者は区別できる。**部分一致（`label~=`）では区別できない。

---

## routes.csv

```
RouteID,Route,ScreenID,EntryPoint,TransitionCondition,RequiredState,RequiredPermission,PatternID,TestID,Tested
```

| 列 | 内容 |
|---|---|
| `RouteID` | `R-` 始まりの連番 |
| `EntryPoint` | **どこから来たか**。同じRouteでも起点が違えば別行にする |
| `TransitionCondition` | 遷移が成立する条件 |
| `RequiredState` | その遷移に必要なデータ状態 |
| `RequiredPermission` | 必要なプラン・権限。無ければ `なし` |
| `PatternID` / `TestID` | `;` 区切りで複数可 |
| `Tested` | 実行後に埋める。`yes` / `no` |

「その画面へ1度遷移できた」だけでRouteテスト完了にしない。
起点・条件・ユーザー状態・権限・データ状態のどれかが違えば、それは別のRouteパターン。

---

## pattern-matrix.csv

```
FeatureID,ScreenID,ConditionID,Condition,PatternID,InputState,DataState,UserState,
PermissionState,SystemState,ExpectedBehavior,RelatedRoute,Source,TestID,Covered,
Reachability,UnreachableReason,SpecRef,CodeRef
```

| 列 | 内容 |
|---|---|
| `ConditionID` | 条件の識別子（`C-F02-01`）。何を変える軸かを表す |
| `Condition` | その条件の説明。**組み合わせ数の根拠もここに書く** |
| `PatternID` | `P-F02-001` |
| `InputState` | 入力の状態。無ければ `なし` |
| `DataState` | データ件数・内容の状態 |
| `UserState` | `Free` / `Pro` / `未連携` など |
| `PermissionState` | OS権限・有効無効。無ければ `なし` |
| `SystemState` | ネットワーク・言語・外観・処理中など。既定なら `通常` |
| `ExpectedBehavior` | **観察可能な結果**を書く。曖昧語は `validate.mjs` が弾く |
| `Source` | `FunctionalSpec` / `SourceCode` / `RouteDefinition` / `Validation` / `StateManagement` / `API` / `Database` / `Constant` / `Review` を `;` 区切り |
| `TestID` | 割り当てたテスト。`;` 区切りで複数可 |
| `Covered` | `yes` / `no` |
| `Reachability` | `REACHABLE` / `UNREACHABLE` |
| `UnreachableReason` | `UNREACHABLE` のとき**必須**。「面倒だから」は理由にならない |
| `SpecRef` / `CodeRef` | 根拠の位置 |

`REACHABLE` なのに `TestID` が空の行があると `validate.mjs` がエラーにする。

---

## testspec.csv

**1行1ステップ**。同じ `TestID` の行が複数並ぶ。
テスト単位の列（`PatternID` 〜 `TestData`、`Priority`、`Source`）は全行に同じ値を書く。

```
TestID,PatternID,Category,FeatureID,ScreenID,TestPurpose,Precondition,InitialRoute,
InitialState,TestData,StepNo,Action,Target,Input,ExpectedResult,ExpectedRoute,
PostCondition,Evidence,Cleanup,Priority,Source
```

| 列 | 内容 |
|---|---|
| `TestID` | `TC-0001` 形式 |
| `Category` | `正常系` / `異常系` / `境界値` / `状態遷移` / `権限` / `表示` / `性能` / `並行操作` / `互換性` |
| `TestPurpose` | 何を確かめるか。1文 |
| `Precondition` | [preconditions.md](preconditions.md) の語彙。空欄不可 |
| `InitialRoute` | 開始時のScreenID |
| `InitialState` | 前提の説明（人間向け。機械判定は `Precondition` が持つ） |
| `TestData` | 使ったfixture名やデータの説明 |
| `StepNo` | 1からの連番。飛びも重複も不可 |
| `Action` | 下の語彙表のいずれか |
| `Target` | Actionごとの対象（ロケータ / ScreenID / SQL / 設定キー / fixture名） |
| `Input` | Actionごとの入力値 |
| `ExpectedResult` | そのステップの期待。**曖昧語禁止** |
| `ExpectedRoute` | そのステップ後にいるべきScreenID |
| `PostCondition` | ステップ後に成立している状態 |
| `Evidence` | 証跡名。`none` なら撮らない。失敗時は指定に関わらず必ず撮る |
| `Cleanup` | 後始末。`none` 可 |
| `Priority` | `P1` / `P2` / `P3` |
| `Source` | このテストの根拠 |

各テストには **`ASSERT_*` を1つ以上**含める。含まないとPASS/FAILを判定できない。

---

## Action語彙

`kind=assert` のActionだけがPASS/FAILを決める。
それ以外のActionの失敗は「実行できなかった」であり、原因分類は後段で確定する。

### 前提・ライフサイクル

| Action | Target | Input |
|---|---|---|
| `SET_STATE` | fixture名 | ― |
| `SET_PLAN` | ― | `free` / `pro` |
| `SET_SORT` | ― | `created` / `updated` / `title` / `usage` |
| `SET_LOCALE` | ― | `ja` / `en` |
| `SET_APPEARANCE` | ― | `light` / `dark` |
| `SET_NETWORK` | ― | `on` / `off` |
| `SET_CLIPBOARD` | ― | 文字列 |
| `LAUNCH` / `RELAUNCH` / `TERMINATE` / `WIPE_INSTALL` | ― | ― |

### 操作

| Action | Target | Input |
|---|---|---|
| `TAP` | ロケータ | ― |
| `LONG_PRESS` | ロケータ | ミリ秒（既定600） |
| `DOUBLE_TAP` | ロケータ | ― |
| `TAP_REPEAT` | ロケータ | 回数 |
| `TAP_NEAR` | 基準のロケータ | 対象のロケータ |
| `TAP_IN` | ロケータ | `fx,fy`（0〜1の相対位置） |
| `DRAG` | ロケータ or `x,y` | ロケータ or `x,y` |
| `SCROLL` | ― | `up` / `down` |
| `SCROLL_TO` | ロケータ | ― |
| `PULL_REFRESH` | ― | ― |
| `SWIPE` | ― | `left` / `right` / `up` / `down` |
| `TYPE` | ロケータ（入力欄） | 文字列 |
| `TYPE_RAW` | ― | 文字列 |
| `TYPE_PASTE` | ロケータ（入力欄） | 文字列 |
| `PASTE_RAW` | ― | 文字列 |
| `CLEAR_TEXT` | ロケータ | 回数（既定60） |
| `PRESS_KEY` | ― | `return` / `delete` / `escape` / `tab` |
| `HOME` | ― | ― |
| `WAIT` | ― | ミリ秒 |
| `WAIT_FOR` / `WAIT_GONE` | ロケータ | タイムアウトms |

### 検証

| Action | Target | Input | 判定 |
|---|---|---|---|
| `ASSERT_VISIBLE` | ロケータ | ― | 画面内に現れる |
| `ASSERT_NOT_VISIBLE` | ロケータ | ― | 画面内から消える |
| `ASSERT_TEXT` | ロケータ | 文字列 | ラベルが完全一致 |
| `ASSERT_TEXT_CONTAINS` | ロケータ | 文字列 | ラベルが部分一致 |
| `ASSERT_SCREEN_HAS` | ― | 文字列 | 画面内のどこかに存在 |
| `ASSERT_SCREEN_LACKS` | ― | 文字列 | 画面内のどこにも無い |
| `ASSERT_COUNT` | ロケータ | 数値 | 一致件数 |
| `ASSERT_ORDER` | ロケータ | `a,b,c` または `a|b|c` | 上から順に並ぶ。期待値がカンマを含む場合は `|` 区切りにする |
| `ASSERT_ENABLED` / `ASSERT_DISABLED` | ロケータ | ― | 操作可否 |
| `ASSERT_CLIPBOARD` | ― | 文字列 | クリップボードが完全一致 |
| `ASSERT_CLIPBOARD_CONTAINS` | ― | 文字列 | 部分一致 |
| `ASSERT_DB` | SQL | 期待値 | SQL結果と完全一致 |
| `ASSERT_PREF` | 設定キー | 期待値 | 永続設定の値 |
| `ASSERT_SCREEN` | ScreenID | ― | `screens.csv` のSignatureが現れる |
| `ASSERT_NO_JS_ERROR` | ― | 分 | ログにRedBox等が無い |

### 証跡

| Action | Target |
|---|---|
| `SHOT` | ファイル名 |
| `DUMP_UI` | ファイル名 |

---

## ロケータ構文

要素は座標ではなくラベルで指定する。詳細は `scripts/ui.swift` の先頭コメント。

| 項 | 意味 |
|---|---|
| `label=文字列` | 完全一致 |
| `label~=文字列` | 部分一致 |
| `value=` / `value~=` | 値 |
| `text~=文字列` | ラベルか値のどちらかに部分一致 |
| `role=AXButton` | 役割 |
| `has=label` | ラベルが空でないものだけ |
| `enabled=true` / `false` | 操作可否 |
| `visible=true` / `false` | デバイス画面内にあるか |
| `safe=true` | 広告バナー・ステータスバーに覆われない領域にあるか |
| `below=<y>` / `above=<y>` / `rightof=<x>` / `leftof=<x>` | 位置による絞り込み |
| `[n]` | 0起点の順序指定。末尾に付ける |

`&` で連結するとAND。`&` を含む文字列は `~=` で短い断片を指定して回避する。

### 覚えておくこと

- **スクロールで画面外へ出た要素もAXツリーには残る。**
  `visible=true` を付けないと、見えていない要素を「ある」と判定してしまう。
  ランナーは `TAP` / `ASSERT_*` のロケータへ自動で `visible=true` を足す。
- **画面内でも下端は広告バナーに覆われる。**
  ランナーの `TAP` は対象が安全域の外にあるとき自動でスクロールしてから押す（画面外の要素が1つも無い画面では、スクロールせずにそのまま押す）。
- **アイコンだけのボタンもラベルを持つ。**ただし中身はIoniconsの私用領域グリフで、
  CSVへ書ける文字ではない。`has=label` はアイコンを除外しないので、順序指定で特定する。
- **文字入力はすべてクリップボード経由で行われる。**
  `osascript` の `keystroke` はホストの入力ソースを通るため、かな入力状態だと
  `abc` が `あbc` に、日本語は全滅する（実測）。そこで `TYPE` / `TYPE_RAW` /
  `TYPE_PASTE` / `PASTE_RAW` はすべて貼り付けで実装してある。絵文字も正確に入る。
  **副作用としてクリップボードの中身が変わる**ので、同じテストで `ASSERT_CLIPBOARD`
  を使うときは順序に注意する（`SET_CLIPBOARD` で入れ直してから検証する）。
  キーイベントそのものを送りたいときだけ `sim.sh keystroke` を使う。

---

## 実行時に決まる値

期待値へ直接書けない値はプレースホルダで書く。

| 記法 | 展開結果 |
|---|---|
| `${TODAY:yyyy/MM/dd}` | 実行日を日本語ロケールで整形 |
| `${TODAY_EN:EEE}` | 英語ロケールで整形（曜日は言語で変わる） |
| `${NOW:HH:mm}` | 同上（意図を読みやすくするための別名） |
| `${TODAY}` | `${TODAY:yyyy/MM/dd}` と同じ |
| `${NL}` | 改行 |
| `${TAB}` | タブ |

トークンは機能仕様書 §8.23 の許可トークンに合わせてある
（`yyyy` `yy` `MM` `M` `dd` `d` `HH` `H` `mm` `ss` `EEE` `EEEE`）。
