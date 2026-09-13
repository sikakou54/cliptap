# テスト実行結果 20260913-item-limit-v2

- 実行環境: iPhone 17 / iOS-26-5
- テスト仕様書: `/Users/sasakikouhei/trunk/project/cliptap/docs/test/testspec.csv`
- 証跡: `docs/test/results/20260913-item-limit-v2/evidence/`

## 1. 実行サマリ

| 項目 | 値 |
| --- | --- |
| 総テスト数 | 39 |
| PASS数 | 39 |
| FAIL数 | 0 |
| BLOCKED数 | 0 |
| 実行率 | 7.6% |
| 成功率 | 100% |
| 総ステップ数 | 451 |

## 2. 網羅率

| 対象 | 総数 | 設計網羅 | 実測（PASS到達） | 設計網羅率 |
| --- | --- | --- | --- | --- |
| 画面 | 24 | 24 | 6 | 100% |
| 機能 | 23 | 23 | 3 | 100% |
| Pattern | 551 | 551 | 39 | 100% |
| Route | 88 | 88 | 10 | 100% |
| 条件分岐 | 204 | 204 | ― | 100% |

### 機能ごとの到達可能率

全体の網羅率は「到達可能と判断したものを全部テストしたか」しか表さない。
機能ごとに、そもそも自動テストでどこまで見えているかを示す。

| 機能 | 到達可能 | 到達不能 | 率 | テスト数 |
| --- | --- | --- | --- | --- |
| F-14 復元（全件置換） | 8 | 40 | 16.7% | 8 |
| F-16 アカウント連携・解除 | 6 | 8 | 42.9% | 6 |
| F-13 バックアップ（全件エクスポート） | 18 | 15 | 54.5% | 18 |
| F-19 広告・トラッキング同意 | 4 | 3 | 57.1% | 4 |
| F-20 テーマ・言語 | 8 | 6 | 57.1% | 7 |
| F-21 法的文書・アプリ情報 | 7 | 5 | 58.3% | 5 |
| F-17 購入・復元・管理 | 24 | 16 | 60% | 19 |
| F-22 キーボード設定・状態案内 | 9 | 5 | 64.3% | 5 |
| F-11 コピー・キーボード入力 | 18 | 9 | 66.7% | 17 |
| F-24 ショートカット管理 | 21 | 9 | 70% | 21 |
| F-12 使用回数記録 | 8 | 3 | 72.7% | 8 |
| F-01 初期化・データ読込 | 16 | 4 | 80% | 16 |
| F-23 システム変数書式設定 | 21 | 4 | 84% | 18 |
| F-02 定型文CRUD | 64 | 12 | 84.2% | 64 |
| F-10 プレビュー | 16 | 3 | 84.2% | 11 |
| F-18 プラン上限再計算 | 77 | 13 | 85.6% | 77 |
| F-09 並べ替え | 21 | 3 | 87.5% | 21 |
| F-08 カテゴリ・プロファイル絞り込み | 16 | 2 | 88.9% | 15 |
| F-06 システム変数展開 | 29 | 3 | 90.6% | 16 |
| F-04 プロファイルCRUD・切替 | 40 | 4 | 90.9% | 40 |
| F-05 カスタム変数CRUD・値設定 | 56 | 4 | 93.3% | 56 |
| F-07 検索 | 33 | 2 | 94.3% | 32 |
| F-03 カテゴリCRUD | 31 | 1 | 96.9% | 31 |
| F-15 Webワークスペース・キャッシュ | 0 | 0 | ― | 0 |

> 到達不能なパターンは `manual-checklist.md` に手動確認の手順としてまとめてある。
> **自動テストが全部PASSしても、そちらが未確認ならリリース判定はできない。**

### 未テスト画面（0件）

なし

### 未テスト機能（0件）

なし

### 未テストPattern（0件）

なし

### 未テストRoute（0件）

なし

### UNREACHABLE（174件）

| PatternID | 根拠 |
| --- | --- |
| P-F02-900 | Web版の挙動であり、自動実行対象はiOSシミュレータのモバイルアプリに限定されている。モバイルは仕様上そもそも未保存離脱を確認しない |
| P-F02-901 | Web版の挙動であり、自動実行対象はiOSシミュレータのモバイルアプリに限定されている。モバイルは本文が空だと保存ボタンが操作不能になる |
| P-F02-902 | useSnippetFormScreen.ts:98 の canSave がタイトルと本文の両方の非空を要求し保存ボタンを操作不能にする。タイトル入力サブ画面（TextInputScreen.tsx）にも handleSave を呼ぶ onSubmitEditing が無いため showInfo('error.empty_title') の分岐へ入る導線が無い |
| P-F02-903 | useSnippetFormScreen.ts:98 の canSave がタイトルと本文の両方の非空を要求し保存ボタンを操作不能にする。内容入力サブ画面（TextInputScreen.tsx）にも handleSave を呼ぶ onSubmitEditing が無いため showInfo('error.empty_content') の分岐へ入る導線が無い |
| P-F02-055 | 権利確認中の時間幅は起動時の権利確認の応答で決まり、ランナーは起動完了を待ってから操作するため、確認中に操作する状態を決定的に作れない。実機で起動直後に操作して確認する |
| P-F02-056 | ディープリンク（cliptap://snippet/create）はsimctl openurlの後に出るiOSの確認ダイアログに阻まれランナーから開けない（BRIEFの自動実行できないこと一覧）。ホームの追加ボタンが同じ総数で事前判定するため、ボタン経由では上限到達の状態で作成画面へ到達できない。人が確認ダイアログで開けば実機で確認できる |
| P-F02-057 | ディープリンク（cliptap://snippet/create）はsimctl openurlの後に出るiOSの確認ダイアログに阻まれランナーから開けない（BRIEFの自動実行できないこと一覧）。ホームの追加ボタンが同じ総数で事前判定するため、ボタン経由では上限到達の状態で作成画面へ到達できない。人が確認ダイアログで開けば実機で確認できる |
| P-F02-058 | 権利確認中の時間幅は起動時の権利確認の応答で決まり、ランナーは起動完了を待ってから操作するため、確認中に操作する状態を決定的に作れない。実機で起動直後に操作して確認する |
| P-F02-064 | 拡張キーボードは別バンドル（.appex）でホストアプリのAXツリーに現れず、自動実行の対象外 |
| P-F02-065 | Web版は実行基盤が別（Vite + sql.js）。iOSシミュレータのランナーから操作できない |
| P-F02-066 | Web版は実行基盤が別（Vite + sql.js）。iOSシミュレータのランナーから操作できない |
| P-F02-067 | Web版は実行基盤が別（Vite + sql.js）。iOSシミュレータのランナーから操作できない |
| P-F03-901 | Web版の挙動であり、自動実行対象はiOSシミュレータのモバイルアプリに限定されている（config.env の TARGET_PLATFORM=ios） |
| P-F04-901 | apps/mobile/app/settings/profiles.tsx は isDefault の行に削除ボタンを描画しないため、UI操作では handleDeleteProfile の標準判定へ到達できない。エラーメッセージは防御的実装であり通常操作では表示されない |
| P-F04-902 | /profile/edit の新規作成モードへ到達する導線はプロファイル管理の＋ボタンだけで、そこで同じ総数による上限判定を先に通過する必要がある。画面滞在中に総数は変化しないため useProfileEditScreen.handleSave の上限分岐（routes.csv R-031）へ到達できない |
| P-F04-903 | 一覧は valid=0 の行に 標準にする 操作を描画しないため、UI操作では ProfileService.setDefault の InvalidProfileDefaultError へ到達できない。仕様書も通常操作では到達しないと明記している |
| P-F05-900 | useVariableEditScreen.handleSave には上限判定が実装されておらず、上限判定は変数管理の＋ボタン（useVariablesScreen.handleAdd）だけが行う。＋ボタンで拒否されるため保存時の判定へ到達する導線が無い。仕様書§8.5の「新規保存を拒否」と実装の判定位置が異なる点は報告対象 |
| P-F05-901 | 変数名入力欄に maxLength=30 が設定されており31文字目を入力できないため、nameValidation の長さ超過分岐（error.variable_name_too_long）へ到達できない。取込データで31文字の変数名を持つ状態も既存fixtureに無い |
| P-F05-903 | Web版の挙動であり、自動実行対象はiOSシミュレータのモバイルアプリに限定されている。モバイルの変数編集は未保存離脱を確認しない |
| P-F05-905 | Web版の挙動であり、自動実行対象はiOSシミュレータのモバイルアプリに限定されている（config.env の TARGET_PLATFORM=ios） |
| P-F24-009 | 権利確認中の時間幅は起動時の権利確認の応答で決まり、ランナーは起動完了を待ってから操作するため、確認中に操作する状態を決定的に作れない。実機で起動直後に操作して確認する |
| P-F24-010 | ディープリンク（cliptap://shortcut/edit）はsimctl openurlの後に出るiOSの確認ダイアログに阻まれランナーから開けない（BRIEFの自動実行できないこと一覧）。ホームの追加ボタンが同じ総数で事前判定するため、ボタン経由では上限到達の状態で作成画面へ到達できない。人が確認ダイアログで開けば実機で確認できる |
| P-F24-011 | ディープリンク（cliptap://shortcut/edit）はsimctl openurlの後に出るiOSの確認ダイアログに阻まれランナーから開けない（BRIEFの自動実行できないこと一覧）。ホームの追加ボタンが同じ総数で事前判定するため、ボタン経由では上限到達の状態で作成画面へ到達できない。人が確認ダイアログで開けば実機で確認できる |
| P-F24-012 | ディープリンク（cliptap://shortcut/edit）はsimctl openurlの後に出るiOSの確認ダイアログに阻まれランナーから開けない（BRIEFの自動実行できないこと一覧）。ホームの追加ボタンが同じ総数で事前判定するため、ボタン経由では上限到達の状態で作成画面へ到達できない。人が確認ダイアログで開けば実機で確認できる |
| P-F24-013 | 権利確認中の時間幅は起動時の権利確認の応答で決まり、ランナーは起動完了を待ってから操作するため、確認中に操作する状態を決定的に作れない。実機で起動直後に操作して確認する |
| P-F24-019 | 拡張キーボードは別バンドル（.appex）でホストアプリのAXツリーに現れず、自動実行の対象外 |
| P-F24-028 | 権利確認中の時間幅は起動時の権利確認の応答で決まり、ランナーは起動完了を待ってから操作するため、確認中に操作する状態を決定的に作れない。実機で起動直後に操作して確認する |
| P-F24-029 | 権利確認中の時間幅は起動時の権利確認の応答で決まり、ランナーは起動完了を待ってから操作するため、確認中に操作する状態を決定的に作れない。実機で起動直後に操作して確認する |
| P-F24-030 | 拡張キーボードは別バンドル（.appex）でホストアプリのAXツリーに現れず、自動実行の対象外 |
| P-F06-029 | Web版は実行基盤が別（Vite + sql.js）。iOSシミュレータのランナーから操作できない |
| P-F06-030 | iOS拡張キーボードは別バンドル（.appex）でAXツリーに現れず、フルアクセス許可も実機でしか与えられない |
| P-F06-031 | Android IMEは実行基盤が別。ランナーの対象はiOSシミュレータのみ（config.env TARGET_PLATFORM=ios） |
| P-F10-017 | Web版は実行基盤が別（Vite + sql.js）。iOSシミュレータのランナーから操作できない |
| P-F10-018 | iOS拡張キーボードは別バンドル（.appex）でAXツリーに現れない。フルアクセス許可も実機でしか与えられない |
| P-F10-019 | iOS拡張キーボードは別バンドル（.appex）でAXツリーに現れない。フルアクセス許可も実機でしか与えられない |
| P-F11-019 | シミュレータに振動が無く、expo-hapticsの発火をAXツリーからも観測できない |
| P-F11-026 | クリップボード書込みの失敗を外部から決定的に起こせない。Clipboard.setStringAsync を失敗させる手段がシミュレータにも config.env にも無く、失敗を注入するデバッグ経路も実装に無い |
| P-F11-027 | クリップボード書込みの失敗を外部から決定的に起こせない。Clipboard.setStringAsync を失敗させる手段がシミュレータにも config.env にも無く、失敗を注入するデバッグ経路も実装に無い |
| P-F11-020 | Web版は実行基盤が別（Vite + sql.js）。iOSシミュレータのランナーから操作できない |
| P-F11-021 | Web版は実行基盤が別（Vite + sql.js）。iOSシミュレータのランナーから操作できない |
| P-F11-022 | iOS拡張キーボードは別バンドル（.appex）でAXツリーに現れない。フルアクセス許可も実機でしか与えられない |
| P-F11-023 | iOS拡張キーボードは別バンドル（.appex）でAXツリーに現れない。フルアクセス許可も実機でしか与えられない |
| P-F11-024 | iOS拡張キーボードは別バンドル（.appex）でAXツリーに現れない。フルアクセス許可も実機でしか与えられない |
| P-F11-025 | 展開処理の例外を外部から決定的に起こす手段が無い。DB・設定の操作では replaceVariables を失敗させられず、コード改変が必要になる |
| P-F12-009 | Web版は実行基盤が別（Vite + sql.js）。iOSシミュレータのランナーから操作できない |
| P-F12-010 | iOS拡張キーボードは別バンドル（.appex）でAXツリーに現れない。フルアクセス許可は実機でしか与えられない |
| P-F12-011 | Android IMEは実行基盤が別。ランナーの対象はiOSシミュレータのみ（config.env TARGET_PLATFORM=ios） |
| P-F23-016 | ラジオはIonicons（radio-button-on / radio-button-off）だけで表され、行の集約ラベルにも値にも差が出ないためAXツリーから選択状態を判別できない |
| P-F23-023 | Androidは実行基盤が別。ランナーの対象はiOSシミュレータのみ（config.env TARGET_PLATFORM=ios）。iOSではToastAndroid分岐に入らない |
| P-F23-024 | Web版は実行基盤が別（Vite + sql.js）。iOSシミュレータのランナーから操作できない |
| P-F23-025 | iOS拡張キーボードは別バンドル（.appex）でAXツリーに現れない。フルアクセス許可も実機でしか与えられない |
| P-F01-013 | __DEV__ビルドはDB初期化のたびに定型文とカスタム変数が両方0件のときテストデータを再投入するため、この状態をDebugビルドで維持できない。Releaseビルドでのみ検証可能 |
| P-F01-018 | 前提条件の語彙（fixture / install）にDBファイルを破壊する手段が無く、破損DBの状態を決定的に作れないため |
| P-F01-019 | 拡張キーボードは別バンドルで動作しAXツリーから操作できないため（BRIEFの自動実行できないこと一覧） |
| P-F01-020 | Web版はiOSシミュレータの自動実行対象外（config.envのTARGET_PLATFORMがios） |
| P-F07-020 | ランナーはステップ間に config.env の STEP_INTERVAL_MS=600 の待ちを必ず入れるため、300ミリ秒未満の観測窓を作れない |
| P-F07-035 | 拡張キーボードは別バンドルで動作しAXツリーから操作できないため（BRIEFの自動実行できないこと一覧） |
| P-F08-017 | 拡張キーボードは別バンドルで動作しAXツリーから操作できないため（BRIEFの自動実行できないこと一覧） |
| P-F08-018 | Web版はiOSシミュレータの自動実行対象外（config.envのTARGET_PLATFORMがios） |
| P-F09-019 | バッジはラベルを持たない装飾Viewで、AXツリーに識別可能な要素として現れないため |
| P-F09-020 | チェックマークはIoniconsのグリフで、行のTouchableOpacityのラベルへ私用領域文字として統合されるためCSVの期待値として記述できない |
| P-F09-028 | 拡張キーボードは別バンドルで動作しAXツリーから操作できないため（BRIEFの自動実行できないこと一覧） |
| P-F13-014 | エクスポート実行はOS共有シートを表示する。共有シートは別プロセスで動きAXツリーに現れないため、完了操作も戻りの検証もできない |
| P-F13-072 | エクスポート実行はOS共有シートを表示する。共有シートは別プロセスでAXツリーに現れず、開いたまま次のテストへ進めないため自動実行できない |
| P-F13-073 | 出力ファイルの中身は共有シートの先にあり読み取れない。インポート側の検証もDocumentPickerを経由するため到達しない |
| P-F13-080 | エクスポートの成否はOS共有シートの先で決まる。共有シートは別プロセスで動きAXツリーへ現れないため、表示も操作も検証できない（preconditions.md「システムUIはAXツリーに現れない」） |
| P-F13-081 | エクスポートの成否はOS共有シートの先で決まる。共有シートは別プロセスで動きAXツリーへ現れないため、表示も操作も検証できない（preconditions.md「システムUIはAXツリーに現れない」） |
| P-F13-082 | エクスポートの成否はOS共有シートの先で決まる。共有シートは別プロセスで動きAXツリーへ現れないため、表示も操作も検証できない（preconditions.md「システムUIはAXツリーに現れない」） |
| P-F13-083 | エクスポートの成否はOS共有シートの先で決まる。共有シートは別プロセスで動きAXツリーへ現れないため、表示も操作も検証できない（preconditions.md「システムUIはAXツリーに現れない」） |
| P-F13-084 | エクスポートの成否はOS共有シートの先で決まる。共有シートは別プロセスで動きAXツリーへ現れないため、表示も操作も検証できない（preconditions.md「システムUIはAXツリーに現れない」） |
| P-F13-085 | エクスポートの成否はOS共有シートの先で決まる。共有シートは別プロセスで動きAXツリーへ現れないため、表示も操作も検証できない（preconditions.md「システムUIはAXツリーに現れない」） |
| P-F13-086 | エクスポートの成否はOS共有シートの先で決まる。共有シートは別プロセスで動きAXツリーへ現れないため、表示も操作も検証できない（preconditions.md「システムUIはAXツリーに現れない」） |
| P-F13-087 | エクスポートの成否はOS共有シートの先で決まる。共有シートは別プロセスで動きAXツリーへ現れないため、表示も操作も検証できない（preconditions.md「システムUIはAXツリーに現れない」） |
| P-F13-088 | エクスポートの成否はOS共有シートの先で決まる。共有シートは別プロセスで動きAXツリーへ現れないため、表示も操作も検証できない（preconditions.md「システムUIはAXツリーに現れない」） |
| P-F13-092 | 出力ファイルは共有シート経由でしか取り出せず、内容を検証できない。加えて再取込の検証はDocumentPickerを経由するため到達しない |
| P-F13-093 | 出力ファイルは共有シート経由でしか取り出せず、内容を検証できない。加えて再取込の検証はDocumentPickerを経由するため到達しない |
| P-F13-111 | isProcessingがtrueになるのはバックアップ出力中と復元の準備・反映中だけで、前者はOS共有シート、後者はDocumentPickerを経由する。どちらも別プロセスのシステムUIでAXツリーに現れないため、処理中の状態を自動実行で保持・観測できない |
| P-F14-010 | インポートの入口はexpo-document-pickerのDocumentPickerで、別プロセスのシステムUIのためAXツリーに現れない。加えて「最近使った項目」の中身はアプリのコンテナ外にあり、アプリがUIFileSharingEnabledを持たないためFilesアプリの「このiPhone内」にも現れず、取込対象の .cliptap を外部から決定的に配置できない |
| P-F14-011 | インポートの入口はexpo-document-pickerのDocumentPickerで、別プロセスのシステムUIのためAXツリーに現れない。加えて「最近使った項目」の中身はアプリのコンテナ外にあり、アプリがUIFileSharingEnabledを持たないためFilesアプリの「このiPhone内」にも現れず、取込対象の .cliptap を外部から決定的に配置できない |
| P-F14-012 | インポートの入口はexpo-document-pickerのDocumentPickerで、別プロセスのシステムUIのためAXツリーに現れない。加えて「最近使った項目」の中身はアプリのコンテナ外にあり、アプリがUIFileSharingEnabledを持たないためFilesアプリの「このiPhone内」にも現れず、取込対象の .cliptap を外部から決定的に配置できない |
| P-F14-013 | インポートの入口はexpo-document-pickerのDocumentPickerで、別プロセスのシステムUIのためAXツリーに現れない。加えて「最近使った項目」の中身はアプリのコンテナ外にあり、アプリがUIFileSharingEnabledを持たないためFilesアプリの「このiPhone内」にも現れず、取込対象の .cliptap を外部から決定的に配置できない |
| P-F14-020 | インポートの入口はexpo-document-pickerのDocumentPickerで、別プロセスのシステムUIのためAXツリーに現れない。加えて「最近使った項目」の中身はアプリのコンテナ外にあり、アプリがUIFileSharingEnabledを持たないためFilesアプリの「このiPhone内」にも現れず、取込対象の .cliptap を外部から決定的に配置できない |
| P-F14-021 | インポートの入口はexpo-document-pickerのDocumentPickerで、別プロセスのシステムUIのためAXツリーに現れない。加えて「最近使った項目」の中身はアプリのコンテナ外にあり、アプリがUIFileSharingEnabledを持たないためFilesアプリの「このiPhone内」にも現れず、取込対象の .cliptap を外部から決定的に配置できない |
| P-F14-022 | インポートの入口はexpo-document-pickerのDocumentPickerで、別プロセスのシステムUIのためAXツリーに現れない。加えて「最近使った項目」の中身はアプリのコンテナ外にあり、アプリがUIFileSharingEnabledを持たないためFilesアプリの「このiPhone内」にも現れず、取込対象の .cliptap を外部から決定的に配置できない |
| P-F14-030 | インポートの入口はexpo-document-pickerのDocumentPickerで、別プロセスのシステムUIのためAXツリーに現れない。加えて「最近使った項目」の中身はアプリのコンテナ外にあり、アプリがUIFileSharingEnabledを持たないためFilesアプリの「このiPhone内」にも現れず、取込対象の .cliptap を外部から決定的に配置できない |
| P-F14-031 | インポートの入口はexpo-document-pickerのDocumentPickerで、別プロセスのシステムUIのためAXツリーに現れない。加えて「最近使った項目」の中身はアプリのコンテナ外にあり、アプリがUIFileSharingEnabledを持たないためFilesアプリの「このiPhone内」にも現れず、取込対象の .cliptap を外部から決定的に配置できない |
| P-F14-032 | インポートの入口はexpo-document-pickerのDocumentPickerで、別プロセスのシステムUIのためAXツリーに現れない。加えて「最近使った項目」の中身はアプリのコンテナ外にあり、アプリがUIFileSharingEnabledを持たないためFilesアプリの「このiPhone内」にも現れず、取込対象の .cliptap を外部から決定的に配置できない |
| P-F14-033 | インポートの入口はexpo-document-pickerのDocumentPickerで、別プロセスのシステムUIのためAXツリーに現れない。加えて「最近使った項目」の中身はアプリのコンテナ外にあり、アプリがUIFileSharingEnabledを持たないためFilesアプリの「このiPhone内」にも現れず、取込対象の .cliptap を外部から決定的に配置できない |
| P-F14-034 | インポートの入口はexpo-document-pickerのDocumentPickerで、別プロセスのシステムUIのためAXツリーに現れない。加えて「最近使った項目」の中身はアプリのコンテナ外にあり、アプリがUIFileSharingEnabledを持たないためFilesアプリの「このiPhone内」にも現れず、取込対象の .cliptap を外部から決定的に配置できない |
| P-F14-035 | インポートの入口はexpo-document-pickerのDocumentPickerで、別プロセスのシステムUIのためAXツリーに現れない。加えて「最近使った項目」の中身はアプリのコンテナ外にあり、アプリがUIFileSharingEnabledを持たないためFilesアプリの「このiPhone内」にも現れず、取込対象の .cliptap を外部から決定的に配置できない |
| P-F14-036 | インポートの入口はexpo-document-pickerのDocumentPickerで、別プロセスのシステムUIのためAXツリーに現れない。加えて「最近使った項目」の中身はアプリのコンテナ外にあり、アプリがUIFileSharingEnabledを持たないためFilesアプリの「このiPhone内」にも現れず、取込対象の .cliptap を外部から決定的に配置できない |
| P-F14-037 | インポートの入口はexpo-document-pickerのDocumentPickerで、別プロセスのシステムUIのためAXツリーに現れない。加えて「最近使った項目」の中身はアプリのコンテナ外にあり、アプリがUIFileSharingEnabledを持たないためFilesアプリの「このiPhone内」にも現れず、取込対象の .cliptap を外部から決定的に配置できない |
| P-F14-040 | インポートの入口はexpo-document-pickerのDocumentPickerで、別プロセスのシステムUIのためAXツリーに現れない。加えて「最近使った項目」の中身はアプリのコンテナ外にあり、アプリがUIFileSharingEnabledを持たないためFilesアプリの「このiPhone内」にも現れず、取込対象の .cliptap を外部から決定的に配置できない |
| P-F14-041 | インポートの入口はexpo-document-pickerのDocumentPickerで、別プロセスのシステムUIのためAXツリーに現れない。加えて「最近使った項目」の中身はアプリのコンテナ外にあり、アプリがUIFileSharingEnabledを持たないためFilesアプリの「このiPhone内」にも現れず、取込対象の .cliptap を外部から決定的に配置できない |
| P-F14-042 | インポートの入口はexpo-document-pickerのDocumentPickerで、別プロセスのシステムUIのためAXツリーに現れない。加えて「最近使った項目」の中身はアプリのコンテナ外にあり、アプリがUIFileSharingEnabledを持たないためFilesアプリの「このiPhone内」にも現れず、取込対象の .cliptap を外部から決定的に配置できない |
| P-F14-050 | インポートの入口はexpo-document-pickerのDocumentPickerで、別プロセスのシステムUIのためAXツリーに現れない。加えて「最近使った項目」の中身はアプリのコンテナ外にあり、アプリがUIFileSharingEnabledを持たないためFilesアプリの「このiPhone内」にも現れず、取込対象の .cliptap を外部から決定的に配置できない |
| P-F14-051 | インポートの入口はexpo-document-pickerのDocumentPickerで、別プロセスのシステムUIのためAXツリーに現れない。加えて「最近使った項目」の中身はアプリのコンテナ外にあり、アプリがUIFileSharingEnabledを持たないためFilesアプリの「このiPhone内」にも現れず、取込対象の .cliptap を外部から決定的に配置できない |
| P-F14-052 | インポートの入口はexpo-document-pickerのDocumentPickerで、別プロセスのシステムUIのためAXツリーに現れない。加えて「最近使った項目」の中身はアプリのコンテナ外にあり、アプリがUIFileSharingEnabledを持たないためFilesアプリの「このiPhone内」にも現れず、取込対象の .cliptap を外部から決定的に配置できない |
| P-F14-053 | インポートの入口はexpo-document-pickerのDocumentPickerで、別プロセスのシステムUIのためAXツリーに現れない。加えて「最近使った項目」の中身はアプリのコンテナ外にあり、アプリがUIFileSharingEnabledを持たないためFilesアプリの「このiPhone内」にも現れず、取込対象の .cliptap を外部から決定的に配置できない |
| P-F14-054 | インポートの入口はexpo-document-pickerのDocumentPickerで、別プロセスのシステムUIのためAXツリーに現れない。加えて「最近使った項目」の中身はアプリのコンテナ外にあり、アプリがUIFileSharingEnabledを持たないためFilesアプリの「このiPhone内」にも現れず、取込対象の .cliptap を外部から決定的に配置できない |
| P-F14-055 | インポートの入口はexpo-document-pickerのDocumentPickerで、別プロセスのシステムUIのためAXツリーに現れない。加えて「最近使った項目」の中身はアプリのコンテナ外にあり、アプリがUIFileSharingEnabledを持たないためFilesアプリの「このiPhone内」にも現れず、取込対象の .cliptap を外部から決定的に配置できない |
| P-F14-056 | インポートの入口はexpo-document-pickerのDocumentPickerで、別プロセスのシステムUIのためAXツリーに現れない。加えて「最近使った項目」の中身はアプリのコンテナ外にあり、アプリがUIFileSharingEnabledを持たないためFilesアプリの「このiPhone内」にも現れず、取込対象の .cliptap を外部から決定的に配置できない |
| P-F14-057 | インポートの入口はexpo-document-pickerのDocumentPickerで、別プロセスのシステムUIのためAXツリーに現れない。加えて「最近使った項目」の中身はアプリのコンテナ外にあり、アプリがUIFileSharingEnabledを持たないためFilesアプリの「このiPhone内」にも現れず、取込対象の .cliptap を外部から決定的に配置できない |
| P-F14-058 | インポートの入口はexpo-document-pickerのDocumentPickerで、別プロセスのシステムUIのためAXツリーに現れない。加えて「最近使った項目」の中身はアプリのコンテナ外にあり、アプリがUIFileSharingEnabledを持たないためFilesアプリの「このiPhone内」にも現れず、取込対象の .cliptap を外部から決定的に配置できない |
| P-F14-059 | インポートの入口はexpo-document-pickerのDocumentPickerで、別プロセスのシステムUIのためAXツリーに現れない。加えて「最近使った項目」の中身はアプリのコンテナ外にあり、アプリがUIFileSharingEnabledを持たないためFilesアプリの「このiPhone内」にも現れず、取込対象の .cliptap を外部から決定的に配置できない |
| P-F14-060 | インポートの入口はexpo-document-pickerのDocumentPickerで、別プロセスのシステムUIのためAXツリーに現れない。加えて「最近使った項目」の中身はアプリのコンテナ外にあり、アプリがUIFileSharingEnabledを持たないためFilesアプリの「このiPhone内」にも現れず、取込対象の .cliptap を外部から決定的に配置できない |
| P-F14-061 | インポートの入口はexpo-document-pickerのDocumentPickerで、別プロセスのシステムUIのためAXツリーに現れない。加えて「最近使った項目」の中身はアプリのコンテナ外にあり、アプリがUIFileSharingEnabledを持たないためFilesアプリの「このiPhone内」にも現れず、取込対象の .cliptap を外部から決定的に配置できない |
| P-F14-062 | インポートの入口はexpo-document-pickerのDocumentPickerで、別プロセスのシステムUIのためAXツリーに現れない。加えて「最近使った項目」の中身はアプリのコンテナ外にあり、アプリがUIFileSharingEnabledを持たないためFilesアプリの「このiPhone内」にも現れず、取込対象の .cliptap を外部から決定的に配置できない |
| P-F14-090 | Web版は自動実行の対象外（config.env の TARGET_PLATFORM=ios）。Web初回読込画面はVite + sql.jsの別実行基盤にあり、iOSシミュレータのAXツリーからは操作も検証もできない。加えて読込ボタンの無効化とEnterキーのガードにより通常操作でも到達しない |
| P-F14-091 | Web版は自動実行の対象外（config.env の TARGET_PLATFORM=ios）。Web初回読込画面はVite + sql.jsの別実行基盤にあり、iOSシミュレータのAXツリーからは操作も検証もできない。加えて通常の不正ファイルのドロップはDropzoneが拒否し画面メッセージを表示しない |
| P-F14-092 | Web版は自動実行の対象外（config.env の TARGET_PLATFORM=ios）。Web初回読込画面はVite + sql.jsの別実行基盤にあり、iOSシミュレータのAXツリーからは操作も検証もできない |
| P-F14-093 | Web版は自動実行の対象外（config.env の TARGET_PLATFORM=ios）。Web初回読込画面はVite + sql.jsの別実行基盤にあり、iOSシミュレータのAXツリーからは操作も検証もできない |
| P-F14-094 | Web版は自動実行の対象外（config.env の TARGET_PLATFORM=ios）。Web初回読込画面はVite + sql.jsの別実行基盤にあり、iOSシミュレータのAXツリーからは操作も検証もできない |
| P-F14-095 | Web版は自動実行の対象外（config.env の TARGET_PLATFORM=ios）。Web初回読込画面はVite + sql.jsの別実行基盤にあり、iOSシミュレータのAXツリーからは操作も検証もできない |
| P-F14-096 | Web版は自動実行の対象外（config.env の TARGET_PLATFORM=ios）。Web初回読込画面はVite + sql.jsの別実行基盤にあり、iOSシミュレータのAXツリーからは操作も検証もできない |
| P-F14-097 | Web版は自動実行の対象外（config.env の TARGET_PLATFORM=ios）。Web初回読込画面はVite + sql.jsの別実行基盤にあり、iOSシミュレータのAXツリーからは操作も検証もできない |
| P-F18-007 | インポートの入口はDocumentPickerで、別プロセスのシステムUIのためAXツリーに現れず取込対象ファイルも決定的に配置できない（§8.14と同じ制約） |
| P-F18-035 | 上限値999,999そのものを観測するには境界となる999,999件と1,000,000件のデータが要る。fixtureで作れる件数を大きく超え、SQLiteへの投入と起動時再計算が現実的な時間で終わらない |
| P-F18-065 | 無効なプロファイルの行には「標準にする」バッジ自体が描画されない（profiles.tsx:105 の !item.isDefault && enabled）ため、UIからこのService層のガードへ到達できない |
| P-F18-120 | RevenueCatの検証失敗を決定的に起こせない。ネットワーク遮断はconfig.envのALLOW_NETWORK_TOGGLEが0で許可されておらず、プラン上書きを消しただけでは検証が失敗するとは限らない |
| P-F18-121 | Web版は自動実行の対象外（TARGET_PLATFORM=ios） |
| P-F18-122 | インポートの入口がDocumentPickerで到達できない。加えて権利更新の失敗を決定的に起こせない |
| P-F18-123 | Web版は自動実行の対象外（TARGET_PLATFORM=ios） |
| P-F18-150 | 拡張キーボードは別バンドルの独立プロセスで、シミュレータのAXツリーからは操作も検証もできない（BRIEFの自動実行できないこと一覧） |
| P-F18-151 | Androidは自動実行の対象外（config.env の TARGET_PLATFORM=ios） |
| P-F18-152 | Web版は自動実行の対象外（config.env の TARGET_PLATFORM=ios） |
| P-F18-159 | インポートの入口はDocumentPickerで別プロセスのシステムUIとして開き、取込対象の .cliptap を外部から決定的に配置できない（§8.14と同じ制約） |
| P-F18-160 | Web版は実行基盤が別（Vite + sql.js）。iOSシミュレータのランナーから操作できない |
| P-F18-161 | Web版は実行基盤が別（Vite + sql.js）。iOSシミュレータのランナーから操作できない |
| P-F16-006 | Firebase認証はApple ID／Googleのシステム・外部ブラウザUIを通るためAXツリーから操作できず、連携済み状態を自動で作れない |
| P-F16-004 | Sign in with AppleのシートはOSプロセスが描画するためAXツリーに現れず、シミュレータではApple IDサインインを完了できない |
| P-F16-005 | Googleサインインは外部ブラウザ（ASWebAuthenticationSession）へ遷移し、別プロセスのためAXツリーから操作できない |
| P-F16-007 | 連携済み状態を自動で作れないため解除操作を開始できない（P-F16-006と同じ理由） |
| P-F16-008 | 連携済み状態を自動で作れないため解除操作を開始できない |
| P-F16-009 | 認証失敗は外部認証UIの結果に依存し、シミュレータから決定的に起こせない |
| P-F16-014 | isLinkingAccountがtrueの期間は外部認証UIの表示中だけで、AXツリーから観測できる時間に固定できない |
| P-F16-012 | 連携済みかつメールアドレス欠落という状態を外部認証なしに作れない |
| P-F17-007 | 選択状態はラベルを持たないラジオアイコン（Ionicons）だけで表現されるため、AXツリーから選択／未選択を判定できない |
| P-F17-008 | 選択状態がAXツリーに現れないうえ、シミュレータではプランカード自体が描画されない（P-F17-009と同じ理由） |
| P-F17-009 | iOSシミュレータはStoreKit構成ファイルを持たずApp Storeへ接続できないため、RevenueCat OfferingのavailablePackagesが空になり価格カードが描画されない。実機のSandbox環境でのみ検証できる |
| P-F17-012 | 購入はApp StoreのStoreKit決済シート（システムUI）を経由し、シミュレータでは購入を完了できない。実機・Sandbox・手動でのみ検証できる |
| P-F17-013 | StoreKit決済シートを操作できないためキャンセルを発生させられない |
| P-F17-014 | StoreKit決済シートを操作できないため失敗を発生させられない |
| P-F17-015 | 復元結果はApp Store／RevenueCatの応答に依存して非決定であり、シミュレータではApp Storeサインインのシステムダイアログが出る場合がある。docs/test/revenuecat-restore-behavior.md のとおり手動・Sandboxで検証する |
| P-F17-016 | 同上。復元の成否がストア接続に依存し決定的に作れない |
| P-F17-020 | 管理画面からPaywallへ入る導線はFreeのときだけ表示されるが、管理画面へはProのときしか遷移できず、管理画面上にプランをFreeへ変える操作が無いため起点を作れない |
| P-F17-021 | PaywallへはFreeのときしか遷移できず、開発者オーバーライドのProはRevenueCat entitlementを持たないためcurrentPlanが常にnullになる。実購入が要る |
| P-F17-022 | purchasing=trueの期間はStoreKitシステムUIの表示中だけで、自動操作から観測・維持できない |
| P-F17-026 | RevenueCat entitlementのexpirationDateとproductIdentifierが必要で、開発者オーバーライドでは供給されない。実購入・Sandboxでのみ検証できる |
| P-F17-029 | Linking.openURLでApp Store／Safariという別アプリへ遷移するため、遷移先はAXツリーに現れず検証できない |
| P-F17-030 | 管理画面へは設定のカードからProのときだけ遷移でき、管理画面上でプランをFreeへ変える操作が無いためFreeの管理画面を作れない |
| P-F17-036 | RevenueCatの障害応答を再現するにはネットワーク遮断か外部モックが要るが、config.envのALLOW_NETWORK_TOGGLEが0でオフラインを作れない |
| P-F17-037 | 外部認証を完了できないため連携直後の状態を作れない（P-F16-006と同じ理由） |
| P-F19-003 | ATTの許可ダイアログはOSが描画しAXツリーに現れない。またrequestNonPersonalizedAdsOnlyの値は画面表示に現れないため観測できない |
| P-F19-004 | 広告の取得失敗を起こすにはネットワーク遮断が要るが、config.envのALLOW_NETWORK_TOGGLEが0のため実行できない |
| P-F19-007 | 自動実行の対象はiOSモバイルのみ（config.envのTARGET_PLATFORM=ios）でWebを操作できない |
| P-F20-005 | 前提条件のlocaleキーはja／enしか受け付けず（preconditions.md）、第三言語の端末設定を作れない |
| P-F20-009 | AXツリーは要素の色情報を持たないため、配色の変化を機械判定できない。スクリーンショットの目視確認へ回す |
| P-F20-011 | 翻訳ファイルはビルドへ同梱されるため、実行時に未定義キーを注入できない |
| P-F20-012 | 拡張キーボードは別バンドル（.appex）でホストアプリのAXツリーに現れず、自動実行の対象外 |
| P-F20-013 | WebViewの本文はAXツリーに現れないため本文の言語を判定できない |
| P-F20-014 | 共有シートは別プロセスが描画するためAXツリーが空になる（preconditions.md の実測結果） |
| P-F21-003 | WebViewの本文はAXツリーに現れない（BRIEF.mdの実測結果）。白紙かどうかはスクリーンショットの目視確認へ回す |
| P-F21-004 | WebViewの本文はAXツリーに現れないため本文の言語を判定できない |
| P-F21-009 | モバイルUIにアプリバージョンの表示が実装されておらず、機能仕様書§8.21もアプリ情報としてDBスキーマバージョンだけを規定しているため検証対象が存在しない |
| P-F21-011 | 自動実行の対象はiOSモバイルのみ（config.envのTARGET_PLATFORM=ios）でWebを操作できない |
| P-F21-012 | 拡張キーボードは別バンドル（.appex）でホストアプリのAXツリーに現れず、自動実行の対象外 |
| P-F22-004 | 自動実行の対象はiOSのみ（config.envのTARGET_PLATFORM=ios）でAndroidは手動チェック扱い |
| P-F22-008 | Simulator（iPhone 17 / iOS 26.5）では2回目のモーダルが視覚的に表示されてもiOSContentGroupの子要素が0件になり、AXツリーから文言確認もOK操作もできないため実機で手動確認する |
| P-F22-011 | 拡張キーボードは別バンドル（.appex）で動き、ホストアプリのAXツリーに現れないため自動実行できない |
| P-F22-012 | 拡張キーボードは別バンドルで自動実行の対象外。実機の手動チェックへ回す |
| P-F22-013 | 自動実行の対象はiOSのみ（config.envのTARGET_PLATFORM=ios） |
| P-F04-E02 | 一覧画面の＋ボタンが同じ保存済み総数で事前判定するため、上限に達した状態では作成画面へ到達できない。作成画面を開いてから保存するまでに総数が増える経路が単一利用者のモバイルには無く、useProfileEditScreen.ts:109 の上限チェックはUIから到達できない防御的コードである |
| P-F14-E01 | DocumentPickerと共有シートは別プロセスで動きAXツリーに現れない。加えて「最近使った項目」の中身はアプリのコンテナ外にあり外部から決定的に用意できず、アプリは UIFileSharingEnabled を持たないためFilesアプリの「このiPhone内」にもコンテナが出ない。そのためファイル選択を伴う経路の前提を自動実行で作れない |

## 3. FAIL一覧

なし

## 4. BLOCKED一覧

なし

## 5. 原因分類の内訳

| 分類 | 件数 |
| --- | --- |
| TEST_SPEC_ERROR | 0 |
| PRECONDITION_ERROR | 0 |
| AUTOMATION_ERROR | 0 |
| APPLICATION_DEFECT | 0 |
| SPEC_IMPLEMENTATION_MISMATCH | 0 |
| ENVIRONMENT_ERROR | 0 |
| REQUIRES_TRIAGE | 0 |

## 6. 不具合

| 項目 | 件数 |
| --- | --- |
| 台帳の総件数 | 0 |
| 今回の実行に紐づく不具合 | 0 |
| Critical | 0 |
| Major | 0 |
| Minor | 0 |
| Trivial | 0 |

### BUG-ID別の関連TestID

なし

### APPLICATION_DEFECT 一覧

なし

### SPEC_IMPLEMENTATION_MISMATCH 一覧

なし

