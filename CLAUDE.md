# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## 📚 最初に読むべきドキュメント

**作業開始前に必ず [docs/機能仕様書.md](docs/機能仕様書.md) を確認してください。**

### ドキュメント構造

| ドキュメント | 内容 | いつ読むか |
|-------------|------|-----------|
| [docs/機能仕様書.md](docs/機能仕様書.md) | 機能、画面、外部IF、DB、非機能の正本 | 最初に必ず。仕様変更前 |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | 環境構築・トラブルシューティング | セットアップ時・エラー時 |
| [docs/MARKETING_STRATEGY.md](docs/MARKETING_STRATEGY.md) | グロース・マーケティング戦略 | マーケティング施策の検討時 |

### このファイル（CLAUDE.md）の役割

このファイルには **日々の開発で絶対に守るべきルール** のみを記載しています。
機能仕様は `docs/機能仕様書.md`、環境構築・実装上の手順は `docs/DEVELOPMENT.md` を参照してください。

### 仕様書の運用ルール

- 利用者向け動作、プラン、画面、入出力、外部IF、DB、最低OSを変更するときは、実装と同じ変更で `docs/機能仕様書.md` を更新する。
- 機能別の重複仕様書を新設しない。詳細が必要な場合も正本から参照できる形にする。
- 実装と仕様書の差を発見したら、`docs/機能仕様書.md` §1.1のとおりソースコードと設定を正とし、仕様書を現行実装へ合わせる同じ変更で解消する。
- 現行実装がどちらとも判断できない差は、勝手にどちらかへ寄せず、根拠と影響を示してユーザーへ確認する。
- アプリ版は `apps/mobile/app.json`、DB版は共通スキーマ定義を正として確認する。

---

## プロジェクト概要

**ClipTap** - 定型文・コードスニペットをワンタップでコピーできる超シンプルなモバイル・Webアプリ。

### コアコンセプト
- **ワンタップコピー**: 登録したテキストを即座にクリップボードへコピー
- **ローカルファースト**: オフラインで完全動作、プライバシー重視
- **超軽量UI**: 最小の操作で最大の生産性を実現
- **クロスプラットフォーム**: iOS、Android、Webで統一されたUX
- **ショートカット**: 使い分ける値をプロファイル（環境）ごとに登録し、拡張キーボードから値だけをワンタップ挿入（管理はモバイルアプリのみ）
- **Proプラン**: 広告なし・環境管理無制限・カスタム変数無制限・定型文・ショートカット無制限（月額¥250/年間¥3,000）

### 技術スタック

**モノレポ構成**: npm workspaces

**Mobile App (apps/mobile)**:
- **フレームワーク**: Expo SDK 57 + React Native 0.86.2
- **React**: 19.2.3
- **TypeScript**: 5.9.2
- **スタイリング**: 統合テーマシステム（`src/themeSystem.tsx`）+ StyleSheet
- **データベース**: SQLite (expo-sqlite 57.0.1) + Repository Pattern
- **ナビゲーション**: Expo Router 57.0.10
- **多言語**: i18next 25.5.2
- **状態管理**: React Context + Custom Hooks
- **広告**: react-native-google-mobile-ads 16.4.0 (AdMob)
- **課金**: react-native-purchases 10.6.0 (RevenueCat)
- **認証**: Firebase Authentication (@react-native-firebase 26.1.0)

**Web App (apps/web)**:
- **フレームワーク**: React 19.2 + Vite 7.2.4
- **TypeScript**: 5.9.3
- **データベース**: sql.js (WASM)
- **スタイリング**: Tailwind CSS 4.1.17

**Shared Package (packages/shared)**:
- **TypeScript**: 5.3.3
- **バリデーション**: Zod 4.1.13
- **テスト**: Vitest 4.0.14

### 現在のバージョン情報
- **アプリバージョン**: 1.4.0
- **データベーススキーマ**: V8
- **対応OS**: iOS 17.0以上、Android 7.0 (API 24) 以上
- **新アーキテクチャ**: 対応済み（React Native）
- **JSエンジン**: Hermes

---

## 開発コマンド（クイックリファレンス）

```bash
npm run type-check             # 型チェック（コミット前に必須）
```

**詳細**: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) を参照

---

## アーキテクチャ概要

### 3層アーキテクチャ

```
UI Layer (app/, src/components/)
    ↓ useSnippets(), useCategories()
Service Layer (packages/shared/src/services/, src/hooks/)
    ↓ snippetMapper.getAll()
Data Access Layer (packages/shared/src/mappers/)
    ↓ SQL queries
Database (SQLite)
```

**機能・データ設計の詳細**: [docs/機能仕様書.md](docs/機能仕様書.md) を参照

---

## 主要なディレクトリ

```
clipTap/
├── apps/
│   ├── mobile/          # React Native (Expo) モバイルアプリ
│   │   ├── app/        # 画面（Expo Router）
│   │   └── src/        # コアロジック
│   │       ├── components/ # 再利用可能なコンポーネント
│   │       ├── adapters/   # プラットフォーム固有アダプター
│   │       ├── database/   # SQLite管理
│   │       ├── hooks/      # カスタムフック
│   │       └── types/      # TypeScript型定義
│   └── web/            # React + Vite Webアプリ
└── packages/
    └── shared/         # mobile/webで共有するロジック・型定義
        └── src/
            ├── mappers/    # データアクセス層
            ├── services/   # ビジネスロジック層
            ├── providers/  # 共有Context Provider
            ├── hooks/      # 共有カスタムフック
            ├── adapters/   # プラットフォーム抽象化インターフェース
            ├── database/   # スキーマ定義
            ├── utils/      # 共通ユーティリティ
            └── types/      # 型定義・Zodスキーマ
```

**機能上の責務とデータ設計**: [docs/機能仕様書.md](docs/機能仕様書.md) を参照

---

## Claude Codeへの重要な指示

### 🚨 絶対に守るべきルール

#### 1. **データベースアクセス**
- **Mapper経由必須**: 直接SQLを書くことは絶対に禁止
- 既存のMapper（SnippetMapper, CategoryMapper等）を必ず使用
- 新しいテーブルを追加する場合は、既存のMapperパターンに従って新しいMapperを作成（静的メソッドで実装）

#### 2. **型安全性**
- すべてのコードはTypeScript型チェックに合格すること
- `npm run type-check`で全ワークスペースのエラー0件を保証
- `any`型の使用は最小限に（やむを得ない場合のみ）

#### 3. **オフライン動作**
- ネットワーク接続を前提としないこと
- すべての機能はオフラインで完全動作必須
- サブスクリプション確認以外は外部通信禁止
- 定型文、カテゴリ、プロファイル、変数、ショートカットの業務データはネットワーク接続を前提としないこと
- 認証、サブスクリプション、広告、ストア遷移は外部通信を行うため、失敗してもローカル業務機能を壊さないこと
- 業務データをFirebaseやRevenueCatへ同期しないこと

上記の既存オフラインルールはコア業務機能の目標として維持する。現行の外部通信例外と障害時挙動は `docs/機能仕様書.md` を正とする。

#### 4. **UIレスポンス速度**
- タップ操作は即座に反応（100ms以内）
- コピー操作は遅延なし
- 検索デバウンスは300ms固定

#### 5. **多言語対応**
- すべてのユーザー向けテキストは i18next 経由
- ハードコードされた日本語・英語文字列は禁止
- 新しい共有テキストを追加する際は、`packages/shared/src/i18n/ja.json` と `packages/shared/src/i18n/en.json` の両方に追加

#### 6. **テーマシステム**
- すべてのカラーは `src/themeSystem.tsx` から取得
- ハードコードされた色コードは禁止
- ダークモード対応を常に意識

#### 7. **画面ルートとセーフエリア**
- 画面のルート要素は `ScreenContainer`（`src/components/common/ScreenContainer.tsx`）を使用
- `SafeAreaView` を画面に直接書くこと、`Header` を直接置くことは禁止
- 画面で `useSafeAreaInsets()` を使ってヘッダーの上部余白を計算しないこと
- 理由: `useSafeAreaInsets()` はナビゲータ全体で1つの `SafeAreaProvider` の値（＝ウィンドウのインセット）を返すため、iOSのモーダル内では誤った値になる。画面ごとの実インセットを参照できるのはネイティブの `SafeAreaView` のみで、その責務者は `ScreenContainer` に一元化している
- **例外**: 画面全体を覆うモーダル提示（`presentation: 'fullScreenModal'` と `'transparentModal'`）の画面は `SafeAreaView` のインセットが0になるため、`ScreenContainer` に `fullScreenModal` を渡すこと（内部でウィンドウのインセットへ切り替える）。渡し忘れるとヘッダーがステータスバーに重なる。`'modal'`（iOSのページシート）と `'card'` はステータスバーより下に出るため対象外
- 画面ルート以外（RNの `Modal` 内など）で `useSafeAreaInsets()` を使うのは可

---

### 📋 コーディング規約

#### コンポーネント設計
- **1コンポーネント1責務**: 機能ごとに分割
- **Propsは明示的な型定義**: `interface Props` を必ず定義
- **useEffect依存配列**: 必ず正確に指定（ESLintの警告を無視しない）
- **コメント**: JSXコメントを必ず付与

#### 命名規則
- **ファイル名**: PascalCase（コンポーネント）、camelCase（ユーティリティ）
- **コンポーネント名**: PascalCase
- **関数名**: camelCase（動詞から始める）
- **定数名**: UPPER_SNAKE_CASE
- **型名**: PascalCase

#### パフォーマンス
- **リスト表示**: 主要な一覧は FlashList を使用（件数が利用者データに比例して増えるもの）。選択モーダルなど件数が限定的な短いリストは FlatList を許容する
- **メモ化**: useMemo/useCallback を適切に使用
- **検索**: デバウンス処理必須（300ms）
- **画像**: 最適化されたサイズで配信

#### ESLint
- **eslint-disable禁止**: `eslint-disable`、`eslint-disable-next-line`、`eslint-disable-line` のコメントは使用禁止
- ESLintエラーは根本的に解決すること（例: 循環参照はアーキテクチャで回避）
- どうしても必要な場合は、事前にユーザーに確認し承認を得ること

#### その他注意事項
- 後方互換性の処理は原則実装禁止。Webの旧IndexedDB `schemaVersion` からsystemDB `user_version` への一方向移行だけは、次回スキーマ更新までの期限付き例外とする
- コメントはJSDocスタイル(ただし@exampleは禁止)
- コメントは必ずブロックコメント(/**/)で実装すること
- 文言のハードコーディングは禁止(packages/shared/src/i18n/*jsonで管理すること)
- **翻訳キーの動的生成は禁止**。`t(`snippet.${type}_input`)` のように組み立てないこと。組み立てると対応するキーが未定義でも型チェック・Lint・未使用キー検出のいずれも素通りし、画面にキー名がそのまま出るまで気付けない。選択肢が閉じているならswitchか対応表で静的キーへ振り分ける（`packages/shared/src/utils/profileSelectLabels.ts` が実例）

---

### 🎨 UI/UX ガイドライン

#### インタラクション
- **最小タップ数**: すべての操作を3タップ以内で完結
- **タップ可能領域**: 最小44x44dp（iOS HIG準拠）
- **長押し時間**: 500ms固定
- **振動フィードバック**: コピー時は必ず Haptics.Light

#### アニメーション
- **アニメーション速度**: 100ms以内（軽快さ重視）
- **useNativeDriver**: 必ず true に設定
- **過度なアニメーションは禁止**: シンプル維持

#### フィードバック
- **コピー成功表示**: 2秒固定
- **エラーメッセージ**: 具体的で分かりやすく
- **ローディング**: 500ms以上かかる処理のみ表示

#### 広告配置（無料プランのみ）
- **バナー広告**: 画面下部に固定表示（アダプティブバナー）
- **App Open広告（起動時全画面）**: コールドスタート時のみ全画面表示
  - Googleがアプリの起動画面を収益化するために用意した正規フォーマットであり、**起動時に表示してよい全画面広告はこれだけ**
  - Freeと確定できないとき（加入状態が未確定・権利確認に失敗）は表示しない。バナーと違い誤表示の被害が大きいため、出さない側へ倒す
  - 初回起動でも表示する（iOSはATT許可ダイアログのあとに続けて出る）。Googleのベストプラクティスは数回使ってからの表示を推奨しており、これに沿わないことを承知で利用者が選んだもの
  - スプラッシュは広告のロード完了か、表示しないと決まるまで閉じず、表示はスプラッシュが閉じ終わった直後に行う。Googleのガイドは読み込み画面の上での表示を推奨しており、この出し方は配信停止のリスクを承知で利用者が選んだもの
  - 上限時間で必ず打ち切ってスプラッシュを閉じ、打ち切り後にロードが完了しても表示しない（スプラッシュが閉じなくなるのと、ホーム操作中に遅れて割り込むのを防ぐ）。アプリが前面にないときも表示しない
  - **本番の広告ユニットIDは `apps/mobile/src/hooks/useAppOpenAd.ts` の `AD_UNIT_IDS`**。AdMob管理画面で広告フォーマット「アプリ起動」として作成したものを設定する。バナー用IDは流用不可
  - 表示間隔・上限時間・クールダウンは `docs/機能仕様書.md` §8.19 を正とする
- **禁止**: インタースティシャル広告・リワード広告。特に**インタースティシャルの起動時表示はAdMobが許可していない実装**であり、App Open広告の代用として実装してはならない（両者は別フォーマットとして区別する）
- **Proプラン**: 広告完全非表示（バナー・App Open広告のいずれも表示しない）
- **共通**: 広告の初期化・取得・表示に失敗しても業務機能と起動を妨げない

---

### 🔒 セキュリティとプライバシー

#### データ保護
- すべてのデータは端末内ローカル保存
- クラウド同期なし（ユーザーのプライバシー重視）
- エクスポートデータはパスワード一致確認 + チェックサム検証（暗号化・機密性保護ではない）

#### サブスクリプション管理
- App Store/Google Play の領収書検証必須
- 不正な課金回避を検知
- テスト環境と本番環境を明確に分離

#### エクスポート・インポート
- パスワード + スキーマバージョンのSHA-256ハッシュ化
- チェックサムは必須項目とし、欠落・不一致はどちらも拒否する（改竄検知）
- `.cliptap` の二重Base64を暗号化と表現しない
- 現行より新しいDBスキーマは拒否し、対応する旧スキーマは移行して読み込む

判定の詳細と対応バージョンの範囲は [docs/機能仕様書.md](docs/機能仕様書.md) を正とする。

---

### 🛠️ 開発時の注意事項

#### データベースマイグレーション
- 新しいテーブル・カラムを追加する際は、共通マイグレーションに新しい連続した版の処理を追加する
- リリース済みの移行処理は原則変更せず、修正が必要な場合は旧版fixtureの回帰テストを伴わせる
- **未リリース版**（`origin/release/prod` がまだその版に達していない）の移行段は、新しい段を作らずその段の定義を直接更新する。使われない移行を永久に抱えないため
- マイグレーションは順次実行される前提で設計

現行は共通の単一マイグレーションファイルで管理しているため、新規変更は既存の**リリース済み**ステップを書き換えず、同ファイルへ新しい連続ステップとして追加する。まだリリースしていない版のステップは、新しい版を積まずそのステップを直接更新する。

#### Web版ベースファイル（`.cliptap`）の再生成
- Web版のファイル読込画面は、モバイルアプリ未所持でも開始できるよう `apps/web/public/starter_v{SCHEMA_VERSION}_{ja,en}.cliptap` を配布している
- **`SCHEMA_VERSION` を更新したら、必ず再生成してコミットすること**
- **未リリース版のDDLを変更した場合も再生成すること**。版が据え置きだとファイル名が変わらないため、下記の404による検知が働かず、中身が古いファイルを配り続ける（静かに壊れる唯一のケース）
- `SCHEMA_VERSION` 更新時は `MIN_SUPPORTED_SCHEMA_VERSION` の据置可否と `migrateImportTempDb` の次バージョンcaseも確認すること
  ```bash
  npm run generate:starter --workspace=@cliptap/web
  ```
- サンプルデータの定義は `apps/web/scripts/starterData.json`、生成処理は `apps/web/scripts/generateStarterFile.mjs`
- スキーマ定義・エクスポート形式・パスワードは実装から読み込むため、生成スクリプト側に再定義しないこと
- ファイル名に `SCHEMA_VERSION` を含めているため、再生成漏れ時は古いファイルが配信されずダウンロードが404になる（静かに壊れない設計）
- **旧版のベースファイルは `apps/web/public/` から `packages/shared/tests/fixtures/starter/` へ移すこと**。配信物に残すと参照されないファイルを配り続けることになり、消すと実データでの移行回帰テストを失う
- 移動したら `packages/shared/tests/import/realStarterMigration.test.ts` の対象一覧へ追加する。同テストは旧版・現行版の両方を実際に最新スキーマへ移行し、業務データが失われないことを確認している

#### iOS ネイティブファイルの追加
- **ClipTap（メインアプリ）またはClipTapKeyboard（拡張キーボード）にSwift/Objective-Cファイルを追加する際は、必ず`project.pbxproj`を更新すること**
- 更新が必要なセクション:
  1. `PBXFileReference` - ファイル参照を追加
  2. `PBXGroup` - 対象グループ（ClipTapまたはClipTapKeyboard）のchildrenに追加
  3. `PBXBuildFile` - ビルドファイルエントリを追加
  4. `PBXSourcesBuildPhase` - 対象ターゲットのソースビルドフェーズに追加
- 既存の類似ファイル（例: SubscriptionBridge.swift/m）のパターンを参考にすること
- UUIDは24文字の16進数で一意に生成すること

#### iOS リソースファイルの追加（.strings / .plist / 画像など）
- **ソースファイルと同様に`project.pbxproj`への登録が必須**。登録漏れはビルドエラーにならず、実行時に静かに機能が壊れるため特に注意すること
- 更新が必要なセクション（4番目がソースファイルと異なる）:
  1. `PBXFileReference` - ファイル参照を追加
  2. `PBXGroup` - 対象グループのchildrenに追加
  3. `PBXBuildFile` - ビルドファイルエントリを追加
  4. `PBXResourcesBuildPhase` - 対象ターゲットの**リソース**ビルドフェーズに追加
- ローカライズファイル（`xx.lproj/`配下）を追加する場合は、加えて`knownRegions`に言語コードを登録すること
- **ローカライズが1つも同梱されていないターゲットでは`Locale.current`が開発言語（en）を返す**ため、日付・曜日などの言語判定が壊れる。言語判定には`Locale.preferredLanguages`を使用すること
- 登録後は `plutil -lint ios/ClipTap.xcodeproj/project.pbxproj` で構文を検証すること

#### ⚠️ `expo prebuild --clean` の実行禁止
- `ios/`はBare Workflowのためコミット済み。`--clean`付きprebuildは`ios/`を再生成し、**ClipTapKeyboardターゲットごと手動設定が全て失われる**
- npm scriptからは実行されない構成になっている。`apps/mobile`の`clean`は`rm -rf node_modules && npm install`（依存関係のリセットのみ）で、prebuildを含まない。この構成を崩して`--clean`付きprebuildをscriptへ戻さないこと
- リポジトリルートの`npm run prebuild`は`--clean`なしのため`ios/`は再生成されないが、不要な実行は避けること
- ビルドは成功してしまい実行時に静かに壊れるため、失われたことに気付きにくい
- EASビルドは`eas.json`の`prebuildCommand`でprebuildをスキップするため影響を受けない

#### テストとデバッグ
- 型チェック: `npm run type-check`
- iOS実行: `npm run ios`
- Android実行: `npm run android`
- キャッシュクリア: `npm run dev:mobile -- -- --clear`（`--`が2つ必要。1つだとnpmの二重run時に`--clear`が転送されず効かない）

#### サブスクリプションテスト
- **Android**: テスト環境では期間が短縮される（1ヶ月→5分、1年→30分）
- **iOS**: Sandbox環境では期間が短縮される（1ヶ月→5分、1年→1時間）
- これは正常な動作（Google/Appleの仕様）

---

### 🚀 リリース前チェックリスト

#### 必須確認事項
- [ ] TypeScript型エラー0件（`npm run type-check`）
- [ ] すべての文字列が i18next 経由
- [ ] オフライン動作確認
- [ ] iOS/Android両方で動作確認
- [ ] ダークモード対応確認
- [ ] 広告表示確認（無料プランのみ。バナーと起動時全画面広告の両方。本番ビルドで広告ユニットIDが設定済みであること）
- [ ] サブスクリプション動作確認（Pro機能制限）
- [ ] バックアップ・復元動作確認

#### App Store/Google Play 提出前
- プライバシーポリシー最新版（クリップボード使用、AdMob広告、サブスクリプション）
- スクリーンショット最新版（`store/screen/` を編集 → `node store/screen/build.mjs` → html-to-png で `store/out/` を再生成）
  - App Store: iPhone 6.9" `1290×2796` と iPad 13" `2064×2752`（`app.json` の `supportsTablet: true` によりiPad用が必須）
  - Google Play: 縦横比9:16が上限のため App Store 用は流用できない（未対応。canvas定義の追加が必要）
  - OGP `apps/web/public/ogp/og-{ja,en}.png` も同じパイプラインで再生成される
- アプリ説明文のキーワード最適化

---

### 📝 コード変更時のお約束

#### 新機能追加時
1. 既存の機能を壊さないことを最優先
2. 既存のアーキテクチャ（Mapper/Service/Hooks）に従う
3. 必ずテストして動作確認
4. 翻訳ファイル（ja/en）を忘れずに更新

#### バグ修正時
1. 根本原因を理解してから修正
2. 同じバグが他の場所にないか確認
3. 修正後は必ず動作確認

#### リファクタリング時
1. 小さな変更に分割
2. 1つずつテストしながら進める
3. 過度な最適化は避ける（シンプルさを優先）

---

### 🛠️ コミット・マイグレーション確認

#### コミット前の必須チェック
```bash
npm run type-check                        # 型エラー0件を確認
npm test                                  # 回帰テストがすべて成功することを確認
npm run build:native:ios -- --no-install  # ネイティブ（iOS拡張キーボード/Android IME）を変更した場合のみ
```

ネイティブのSwift/Kotlin/レイアウト/リソースは `type-check` の対象外のため、変更時は `npm run build:native` で実際にコンパイルして確認する。

**`npm run build:native` はビルドに加えてシミュレータ/エミュレータへのインストールまで行う。** ビルドしただけでは端末の中身が古いままになり、拡張キーボードは別バンドル（`.appex`）のため「直したはずなのに直っていない」に陥りやすいため。端末を触らずコンパイルだけ確認したいときは `--no-install` を付ける。

上記をまとめて実行する場合は次を使う。iOSとAndroidは必ず分けて実行する（プラットフォーム引数は必須）。

```bash
npm run verify:ios                  # 型チェック→テスト→Lint→ネイティブビルド→シミュレータへインストール
npm run verify:ios:device           # 同上。インストール先を接続中の実機にする
npm run verify:android
npm run verify:ios -- --no-install  # インストールせず検証だけ（コミット前の確認向け）
```

Metro（`expo start`）はスクリプトに含めない。`npm run dev:mobile` で別途起動する。

**実機で確かめるべきものは実機で確かめる。** 拡張キーボードのフルアクセス許可ダイアログ、ハプティクス、実際のキーボード切り替えはシミュレータでは再現しない。`npm run verify:ios:device` を使う（Androidは `verify:android` が `adb devices` の端末へそのまま入るため、実機を繋いでいればそれで足りる）。実機の署名チームIDは `project.pbxproj` へ書かず、ビルド時にコマンドラインから渡す。

**iOSビルドで `CODE_SIGNING_ALLOWED=NO` を使わないこと。** エンタイトルメントが付かずApp Group（`group.com.sikakou.cliptap`）が無効になり、アプリと拡張キーボードの共有SQLiteを開けなくなる（動作確認に使えないビルドになる）。

詳細: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)

#### データベースマイグレーション
- リリース済みの移行処理は原則変更しない。データ消失等の修正は旧版fixtureの回帰テストを必須とする
- 共通マイグレーションへ新しい連続版を追加する
- 未リリース版（`origin/release/prod` がその版に達していない）の段は、新しい版を積まずその段を直接更新する。その場合はstarterの再生成も同じ変更に含める（版据置ではファイル名が変わらず404で検知できない）
- リリース済み移行の修正には旧版fixtureの回帰テストを追加する

**詳細**: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) を参照

---

### ❌ 絶対にやってはいけないこと

1. **直接SQL実行** - Mapper経由必須
2. **ハードコードされたテキスト** - i18next経由必須
3. **ハードコードされた色** - themeSystem経由必須
4. **主要一覧でのFlatList使用** - FlashList使用必須（短い選択リストは除く）
5. **回帰テストなしの既存マイグレーション編集** - 原則は共通マイグレーションへ新しい連続版を追加
6. **eslint-disableコメント** - ESLintエラーは根本的に解決すること
7. **画面での `SafeAreaView` / `Header` の直接使用** - `ScreenContainer` 経由必須

---

### 💡 困ったときは

- **機能仕様・DB設計**: [docs/機能仕様書.md](docs/機能仕様書.md) を確認
- **実装パターン**: リポジトリ内の同種機能と型定義を検索して確認
- **エラー解決**: [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) のトラブルシューティング

---

## 開発の基本方針

### 優先順位

1. **ユーザー体験** - 速度、シンプルさ、直感性
2. **データ安全性** - ローカルストレージの信頼性
3. **型安全性** - TypeScriptの恩恵を最大限に
4. **保守性** - 読みやすく、理解しやすいコード
5. **パフォーマンス** - 必要な場合のみ最適化

### コード変更時の原則

**新機能追加時**:
1. 既存の機能を壊さない
2. 既存のアーキテクチャ（Mapper/Service/Hooks）に従う
3. 翻訳ファイル（ja/en）を忘れずに更新

**バグ修正時**:
1. 根本原因を理解してから修正
2. 同じバグが他の場所にないか確認

**リファクタリング時**:
1. 小さな変更に分割
2. 過度な最適化は避ける（シンプルさを優先）

---

## 最後に

このプロジェクトは**シンプルさ**を最優先に設計されています。

**ユーザーが求めているのは、高速で、シンプルで、確実に動作するアプリです。**

機能仕様は [docs/機能仕様書.md](docs/機能仕様書.md)、開発手順は [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) から確認してください。
