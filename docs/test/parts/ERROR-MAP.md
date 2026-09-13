# §10.4 利用者向けエラーとパターンの対応表

レビュー指摘3の修正2番目（「§10.4 の33件を一覧化し、各行に対応する PatternID を必ず1つ割り当てる。割り当てのない行を残さない」）への回答。

- 対象は `docs/機能仕様書.md` §10.4「主な利用者向けエラー」の表。**行数は33件**である。作成時点では34件だったが、`変数の値を入力してください` の行は、発火元だった `app/profile/variable-edit.tsx` の削除にあわせて機能仕様書から削除した。
- 割り当てのない行は無い。到達不能な行にも `UNREACHABLE` のパターンを新設して割り当ててある。
- 内訳: **REACHABLE 9件 / UNREACHABLE 24件**。
- `REACHABLE` の行は割り当て先のテストIDを併記した。`UNREACHABLE` の行の根拠は `pattern-matrix.csv` の `UnreachableReason` に同じ内容がある。
- 日本語表示の欄は機能仕様書の記載をそのまま引いた。`{name}` `{limit}` `{message}` は補間前の形。

| # | 条件 | 日本語表示 | PatternID | 到達性 | 根拠 |
|---:|---|---|---|---|---|
| 1 | タイトル未入力 | `タイトルを入力してください` | P-F02-902 | UNREACHABLE | `useSnippetFormScreen.ts:98` の `canSave` がタイトルと本文の両方の非空を要求して保存ボタンを無効化する。タイトル入力サブ画面（`TextInputScreen.tsx`）に `handleSave` を呼ぶ `onSubmitEditing` が無く、`showInfo('error.empty_title')` へ入る導線が無い |
| 2 | 本文未入力 | `内容を入力してください` | P-F02-903 | UNREACHABLE | 同上。`showInfo('error.empty_content')`（`useSnippetFormScreen.ts:219`）は防御コードで、内容入力サブ画面にも `onSubmitEditing` が無い |
| 3 | 変数名未入力 | `変数名を入力してください` | P-F05-029 | REACHABLE（TC-0328） | 変数編集画面で変数名を入れずに値セルをタップすると表示される |
| 4 | Web・変数値未入力 | `値を入力してください` | P-F05-905 | UNREACHABLE | Web版は自動実行の対象外（`config.env` の `TARGET_PLATFORM=ios`）。`apps/web/src/components/variable/VariableEditModal.tsx:168` |
| 5 | カテゴリ名重複 | `このカテゴリ名は既に登録されています` | P-F03-008 | REACHABLE（TC-0107） | 既存名でカテゴリを保存すると表示される |
| 6 | プロファイル名重複 | `このプロファイル名は既に登録されています` | P-F04-008 | REACHABLE（TC-0207） | 既存名でプロファイルを保存すると表示される |
| 7 | 変数名重複 | `「{name}」は既に存在します` | P-F05-011 | REACHABLE（TC-0310） | 既存名の変数を入力すると表示される |
| 8 | 変数名形式不正（先頭が英字または `_` でない、または2文字目以降に英数字・`_` 以外を含む） | `変数名は英数字とアンダースコアのみ使用可能です` | P-F05-003 | REACHABLE（TC-0302） | 変数名を `1abc` にすると表示される |
| 9 | システム変数名の使用 | `「{name}」はシステム変数のため使用できません` | P-F05-008 | REACHABLE（TC-0307） | 変数名を `today` にすると表示される |
| 10 | Web初回読込・ファイル未選択 | `ファイルを選択してください` | P-F14-090 | UNREACHABLE | Web版は自動実行の対象外。加えて読込ボタンの無効化とEnterキーのガードにより通常操作でも到達しない。`apps/web/src/pages/Home.tsx:93` |
| 11 | Web・拡張子不正 | `.cliptapファイルを選択してください` | P-F14-091 | UNREACHABLE | Web版は自動実行の対象外。通常の不正ファイルのドロップはDropzoneが拒否して画面メッセージを出さない。`apps/web/src/pages/Home.tsx:78` |
| 12 | モバイル・拡張子不正 | `無効なファイル形式です` | P-F14-012 | UNREACHABLE | インポートの入口が `expo-document-picker` の DocumentPicker で、別プロセスのシステムUIのためAXツリーに現れない。取込対象の `.cliptap` を外部から決定的に配置できない |
| 13 | パスワード未入力 | `パスワードを入力してください` | P-F14-020 | UNREACHABLE | 同上（ファイル選択を経た後にしか到達しない） |
| 14 | パスワード不一致 | `パスワードが正しくありません` | P-F14-021 | UNREACHABLE | 同上 |
| 15 | Web初回読込・チェックサム不一致 | `ファイルが破損しているか改竄されています` | P-F14-092 | UNREACHABLE | Web版は自動実行の対象外。`apps/web/src/pages/Home.tsx:154` |
| 16 | モバイル／読込済みWeb・チェックサム不一致 | `データの整合性チェックに失敗しました。ファイルが破損している可能性があります` | P-F14-030 | UNREACHABLE | DocumentPickerに阻まれ、改変済み `.cliptap` を投入できない |
| 17 | Web初回読込・ファイル形式不正 | `無効なファイル形式です` | P-F14-093 | UNREACHABLE | Web版は自動実行の対象外。`apps/web/src/pages/Home.tsx:160` |
| 18 | モバイル／読込済みWeb・ファイル形式不正 | `ファイル形式が正しくありません` | P-F14-032 | UNREACHABLE | DocumentPickerに阻まれ、`s` フィールド欠落のファイルを投入できない |
| 19 | モバイル／読込済みWeb・V3未満 | `ファイルのバージョンが一致しません` | P-F14-034 | UNREACHABLE | DocumentPickerに阻まれ、`s=2` のファイルを投入できない |
| 20 | Web初回読込・新しいスキーマ | `アプリバージョンが異なります。最新版に更新してください` | P-F14-094 | UNREACHABLE | Web版は自動実行の対象外。`apps/web/src/pages/Home.tsx:157` |
| 21 | モバイル／読込済みWeb・新しいスキーマ | `現在の端末では対応していないバージョンです。アプリを最新バージョンに更新してから再度お試しください。` | P-F14-035 | UNREACHABLE | DocumentPickerに阻まれ、`s=8` のファイルを投入できない |
| 22 | Web初回読込・その他の読込失敗 | `読み込みに失敗しました: {message}` | P-F14-095 | UNREACHABLE | Web版は自動実行の対象外。`apps/web/src/pages/Home.tsx:164` |
| 25 | 規約未同意 | `利用規約に同意してください` | P-F14-096 | UNREACHABLE | Web版は自動実行の対象外。`apps/web/src/pages/Home.tsx:103` |
| 26 | プライバシー未同意 | `プライバシーポリシーに同意してください` | P-F14-097 | UNREACHABLE | Web版は自動実行の対象外。`apps/web/src/pages/Home.tsx:108` |
| 27 | Web・RGB範囲外 | `RGB値が無効です（0-255の範囲で入力してください）` | P-F03-901 | UNREACHABLE | Web版は自動実行の対象外。`apps/web/src/hooks/screens/useCategoriesScreen.ts:317` |
| 28 | モバイル・RGB範囲外 | `RGB値は0から255の範囲で入力してください` | P-F03-030 | REACHABLE（TC-0129） | カスタムRGBを範囲外にしたままカテゴリ名欄で `PRESS_KEY return` すると `onSubmitEditing`（`category/edit.tsx:122`）から `handleSave` が呼ばれ、`InvalidRgbValueError`（`useCategoryEditScreen.ts:197`）が `showErrorAlert` される |
| 29 | 標準プロファイル削除 | `標準のプロファイルは削除できません` | P-F04-901 | UNREACHABLE | 一覧が `isDefault` の行に削除ボタンを描画しないため `handleDeleteProfile` の標準判定へ到達できない。※仕様書の文言と `ja.json` の `error.cannot_delete_default_profile`（`標準プロファイルは削除できません`）が「の」1文字ずれている（FINDINGS.md 14） |
| 30 | 無効プロファイルの標準化 | `無効なプロファイルは標準にできません` | P-F04-903 | UNREACHABLE | 一覧が `valid=0` の行に「標準にする」操作を描画しないため `ProfileService.setDefault` の `InvalidProfileDefaultError` へ到達できない。仕様書も通常操作では到達しないと明記している |
| 31 | プロファイル上限 | `無料版では{limit}個までプロファイルを登録できます。無制限に登録するにはProプランにアップグレードしてください。` | P-F04-011 | REACHABLE（TC-0210） | Freeでプロファイル3件のときに追加ボタンを押すと表示される |
| 32 | 変数上限 | `無料版では{limit}個までカスタム変数を登録できます。無制限に登録するにはProプランにアップグレードしてください。` | P-F05-034 | REACHABLE（TC-0333） | Freeでカスタム変数5件のときに追加ボタンを押すと表示される |
| 33 | 購入失敗 | `購入に失敗しました` | P-F17-014 | UNREACHABLE | StoreKitの決済シートは別プロセスのシステムUIで操作できず、失敗を決定的に起こせない |

## この表の使い方

- `UNREACHABLE` の24件は自動実行では1件も検証されない。実行レポートで網羅率を出すときは、この24件が母数から外れていることを併記する（レビュー指摘4と同じ趣旨）。
- 24件の内訳は次のとおり。Web由来とDocumentPicker由来の18件は手動検証へ回せる。防御コードの5件は原理的に外部操作では到達しない。

| 分類 | 件数 | 該当 |
|---|---:|---|
| Web版が自動実行の対象外 | 10 | #4 #10 #11 #15 #17 #20 #22 #25 #26 #27 |
| DocumentPickerに阻まれる | 8 | #12 #13 #14 #16 #18 #19 #21 #23 |
| ボタン無効化・導線なしの防御コード | 5 | #1 #2 #24 #29 #30 |
| StoreKitの決済シート | 1 | #33 |
| **合計** | **24** | |
