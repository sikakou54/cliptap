# 前提条件の確定

前提条件を「〜な状態にしておく」と散文で書くと、実行のたびに解釈が変わる。
このスキルでは前提条件を**閉じた語彙のキー＝値**で書き、`validate.mjs` が値の存在まで検査する。

## 書き方

`Precondition` 列と `Cleanup` 列に、`;` 区切りで書く。

```
fixture=baseline; plan=free; sort=created; locale=ja; appearance=dark
```

無条件なら `none` と書く。**空欄は許されない**（書き忘れと区別できないため）。

## 使えるキー

| キー | 値 | 効果 |
|---|---|---|
| `fixture` | fixture名 | 共有DBをその内容へ置き換える |
| `plan` | `free` / `pro` / `clear` | `@dev_subscription_override` を設定する（Developer MenuのSubscription Override相当） |
| `sort` | `created` / `updated` / `title` / `usage` / `clear` | `@snippet_sort_preference` を設定する |
| `locale` | `ja` / `en` | 端末の言語を切り替える |
| `appearance` | `light` / `dark` | 端末の外観を切り替える |
| `network` | `on` / `off` | ホストのWi-Fiを切り替える。`config.env` の `ALLOW_NETWORK_TOGGLE=1` が必要 |
| `clipboard` | 任意の文字列 | クリップボードへ初期値を入れる（コピー検証の前後比較に使う） |
| `install` | `fresh` | DB・設定を消してから1度起動し、新規インストール直後の状態にする |
| `launch` | `yes` / `no` | 既定は `yes`。前提を適用したあとアプリを起動し直す |

適用順は `network → install → fixture → plan → sort → locale → appearance → clipboard → 起動`。
DBと設定はアプリを終了してから書き換える（各スクリプトが自動で終了させる）。

## fixture 一覧

`state.sh list-fixtures` で最新を確認できる。

| fixture | 状態 |
|---|---|
| `baseline` | カテゴリ3・定型文5・プロファイル3・カスタム変数3。Free上限ちょうど。ID・日時が固定 |
| `single` | 各マスタ1件 |
| `empty-snippets` | 定型文0件（カスタム変数1件を残す） |
| `empty-categories` | カテゴリ0件 |
| `empty-variables` | カスタム変数0件 |
| `no-profile` | プロファイル0件 |
| `free-limit` | プロファイル3・カスタム変数5、すべて有効 |
| `over-limit` | プロファイル5（2件無効）・カスタム変数8（3件無効） |
| `boundary` | 文字数上限ちょうど／超過、NULL、空文字、絵文字、複数行 |
| `sortable` | 4種の並べ替えで順序が全て変わるデータ |
| `many` | 定型文200件・カテゴリ10件 |
| `formats` | システム変数書式を既定以外へ設定（不正値1件を含む） |
| `shortcut-preview` | 全プロファイル向けショートカット1件。変数・日付・空値・無効変数の値と、有効3件・無効1件のプロファイル |

### fixtureを足すとき

`scripts/fixtures/<name>.sql` を作る。決まりは3つ。

1. 2行目に `-- <一行説明>` を書く（`list-fixtures` が読む）
2. 全テーブルを `DELETE` してから `INSERT` する（前のテストの残骸を引きずらない）
3. **IDと日時は固定値にする**。実行のたびに変わる値を入れると期待値が書けない

### システムUIはAXツリーに現れない

実測で確認した事実（iPhone 17 / iOS 26.5）。

- `DocumentPicker`（インポートのファイル選択）と共有シートは別プロセスで動くため、
  `sim.sh dump` が空になる。ラベルによる操作ができない。
- 一方、ファイルを選んだ後のパスワード入力ダイアログはアプリ内なのでAXツリーに現れる。

`sim.sh tappt <x> <y>`（デバイスのポイント座標）で押すことはできる。
座標はSimulatorウィンドウの表示倍率が変わっても影響を受けないが、
**機種が変わるとレイアウトが変わる**ため、これを使うテストは機種を固定する。

さらに、ファイル選択の「最近使った項目」の中身は
アプリのコンテナ外にあり、外部から決定的に用意できない。
アプリは `UIFileSharingEnabled` を持たないため、Filesアプリの
「このiPhone内」にもコンテナが現れない。

このため、**ファイル選択を伴うインポート経路は自動実行の前提を決定的に作れない**。
該当パターンは `UNREACHABLE` とし、理由に上記を記録して手動チェックへ回す。

### 完全な空DBが作れない理由

`__DEV__` ビルドはDB初期化のたびにテストデータ投入を試み、
**定型文とカスタム変数が両方0件のときだけ**投入する（`apps/mobile/src/database/seed.ts`）。
そのため「定型文0件かつカスタム変数0件」の状態はDebugビルドでは維持できない。
`empty-snippets` などがカスタム変数を1件残しているのはこのため。

この制約に当たるパターンは削除せず、次のように記録する。

```
Reachability = UNREACHABLE
UnreachableReason = __DEV__ビルドは定型文とカスタム変数が両方0件のときテストデータを再投入するため。Releaseビルドでのみ検証可能
```

Releaseビルドで検証する場合はDeveloper Menu（プラン上書き・DBリセット）も消えるため、
`plan` 指定を含むテストは同時に実行できない。分けて実行する。

---

## 確定すべき項目のチェックリスト

前提条件確定の担当は、全テストについて次がすべて埋まっていることを確認する。
1つでも「不明」が残っていたら仕様書作成を完了にしてはいけない。

| 項目 | 決め方 |
|---|---|
| OS・機種 | `sim.sh device` の出力を実行結果へ記録する。特定機種に依存するテストは `TestPurpose` に明記する |
| ビルド種別 | 既定はDebug（`npm run ios`）。Releaseが要るテストは `Priority` を分けて別実行にする |
| アプリの起動方法 | `Precondition` の `launch`。既定は毎テスト再起動 |
| 認証状態 | 未連携が既定。連携が要るテストは実機・手動へ回す（Firebase認証はUIが外部に出る） |
| プラン | `plan=free` または `plan=pro`。**省略しない**（既定値に依存すると結果が揺れる） |
| OS権限 | クリップボード貼り付け許可はシミュレータでは出ない。拡張キーボードのフルアクセスは実機のみ |
| 初期データ | `fixture` |
| DB状態 | `fixture` と `ASSERT_DB` |
| ネットワーク | 既定はオン。`network=off` は明示的な許可が要る |
| 言語 | `locale`。省略時は端末の現在値のため、文言を検証するテストでは必ず指定する |
| 外観 | `appearance`。色を検証するテストでは必ず指定する |
| タイムゾーン | ホストのローカルタイムゾーン。日付は `${TODAY:...}` で実行時に決める |
| 外部サービス | AdMobはテスト広告、RevenueCatはSandbox。実購入は実機・手動 |
| 初期Route | `InitialRoute` にScreenIDを書く。起動直後はホーム |
| 初期化方法 | `Precondition` |
| Cleanup | `Cleanup` 列。破壊的な操作をしたテストは必ず書く |

---

## Cleanup の考え方

各テストは自分の `Precondition` で状態を作るので、原則としてCleanupは不要。
それでも次の場合は書く。

- ホストの状態を変えた（`network=off` → `Cleanup: network=on`）
- 端末の設定を変えた（`locale=en` → `Cleanup: locale=ja`）
- 次のテストが同じ前提を再構築しない（同一fixtureを共有して連続実行する設計にした場合）

**ホストのWi-Fiを切ったまま終わらせない。** 実行が途中で止まると復旧されないため、
`network=off` を使うテストは連続させず、直後に `network=on` のCleanupを置く。
ランナーも各テスト終了時と異常終了時にWi-Fiの復旧を試みるが、Cleanupは省略しない。
