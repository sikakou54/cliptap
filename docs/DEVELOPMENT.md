# ClipTap Development Setup Guide

**Version**: 1.2.1

**Last Updated**: 2026-08-03

このガイドは、新規開発者がClipTapプロジェクトをセットアップし、開発を開始するための完全なリファレンスです。

---

## 目次

1. [必要条件](#必要条件)
2. [初回セットアップ](#初回セットアップ)
3. [開発サーバーの起動](#開発サーバーの起動)
4. [コード構造の理解](#コード構造の理解)
5. [開発ワークフロー](#開発ワークフロー)
6. [テストとデバッグ](#テストとデバッグ)
7. [ビルドとデプロイ](#ビルドとデプロイ)
8. [トラブルシューティング](#トラブルシューティング)
9. [開発のベストプラクティス](#開発のベストプラクティス)
10. [参考リソース](#参考リソース)

---

## 必要条件

### 必須ツール

#### Node.js & npm
- **Node.js**: v22以上（ルート `package.json` の `engines` に合わせる）
- **npm**: 使用するNode.js同梱の現行版
- インストール: [https://nodejs.org/](https://nodejs.org/)

```bash
# バージョン確認
node --version  # v22以上
npm --version
```

#### Git
- **Git**: v2.x以上
- インストール: [https://git-scm.com/](https://git-scm.com/)

```bash
# バージョン確認
git --version
```

### iOS開発環境（macOS必須）

#### Xcode
- **Xcode**: v15.0以上
- **macOS**: Ventura (13.0) 以上
- App Storeからインストール

```bash
# Xcodeコマンドラインツールのインストール
xcode-select --install

# バージョン確認
xcodebuild -version
```

#### CocoaPods
- **CocoaPods**: v1.12.0以上

```bash
# インストール
sudo gem install cocoapods

# バージョン確認
pod --version
```

### Android開発環境

#### Android Studio
- **Android Studio**: Hedgehog (2023.1.1) 以上
- ダウンロード: [https://developer.android.com/studio](https://developer.android.com/studio)

#### Java Development Kit (JDK)
- **JDK**: 17以上
- Azul Zulu JDK 17推奨: [https://www.azul.com/downloads/](https://www.azul.com/downloads/)

```bash
# バージョン確認
java -version  # 17以上
```

#### Android SDK
Android Studioをインストール後、以下のコンポーネントをSDK Managerからインストール:

- Android SDK Platform 35
- Android SDK Build-Tools 35.x
- Android Emulator
- Android SDK Platform-Tools

#### 環境変数の設定

macOS/Linuxの場合（`~/.zshrc` または `~/.bash_profile`に追加）:

```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin
```

Windowsの場合:

```
ANDROID_HOME=C:\Users\YOUR_USERNAME\AppData\Local\Android\Sdk
```

### 推奨エディタ

#### Visual Studio Code
- **VS Code**: 最新版推奨
- ダウンロード: [https://code.visualstudio.com/](https://code.visualstudio.com/)

#### 推奨VS Code拡張機能

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",           // ESLint
    "esbenp.prettier-vscode",           // Prettier
    "ms-vscode.vscode-typescript-next", // TypeScript
    "expo.vscode-expo-tools",           // Expo Tools
    "bradlc.vscode-tailwindcss",        // Tailwind CSS (Web用)
    "ms-vscode.vscode-react-native",    // React Native Tools
    "formulahendry.auto-rename-tag",    // Auto Rename Tag
    "christian-kohler.path-intellisense" // Path Intellisense
  ]
}
```

これらの拡張機能をワークスペースに追加するには、`.vscode/extensions.json`に上記内容を保存してください。

---

## 初回セットアップ

### 1. リポジトリのクローン

```bash
# GitHubからクローン
git clone https://github.com/sikakou54/ClipTap.git
cd ClipTap

# または、Bitbucketのoriginからクローン
git clone git@bitbucket.org:sikakou-workspace/cliptap.git
cd cliptap
```

### 2. npm Workspacesの理解

ClipTapはモノレポ構造を採用しており、複数のパッケージを一つのリポジトリで管理しています。

```
clipTap/
├── apps/
│   ├── mobile/          # @cliptap/mobile (React Native/Expo)
│   └── web/             # @cliptap/web (React/Vite)
├── packages/
│   └── shared/          # @cliptap/shared (共通ロジック)
└── package.json         # ルートのpackage.json（workspaces定義）
```

### 3. 依存関係のインストール

**重要**: ルートディレクトリで`npm install`を一度実行するだけで、すべてのワークスペースの依存関係がインストールされます。

```bash
# ルートディレクトリで実行
npm install
```

これにより、以下がインストールされます:
- `apps/mobile/node_modules`
- `apps/web/node_modules`
- `packages/shared/node_modules`
- ルートの`node_modules`（共通の依存関係）

### 4. iOS固有のセットアップ（macOSのみ）

CocoaPodsの依存関係をインストール:

```bash
# ルートディレクトリから実行
npm run pod-install

# または、直接iOSディレクトリで実行
cd apps/mobile/ios
pod install
cd ../../..
```

### 5. 環境変数の設定

ClipTapは以下の外部サービスと連携しています。開発を開始するには、各サービスの認証情報を設定する必要があります。

#### Firebase設定

1. [Firebase Console](https://console.firebase.google.com/)でプロジェクトを作成
2. iOSアプリとAndroidアプリを追加
3. 設定ファイルを配置:

**iOS（Expo設定の入力）**: `apps/mobile/GoogleService-Info.plist`

```bash
# Firebase Consoleからダウンロードした GoogleService-Info.plist を配置
cp path/to/GoogleService-Info.plist apps/mobile/
```

**Android（Expo設定の入力）**: `apps/mobile/google-services.json`

```bash
# Firebase Consoleからダウンロードした google-services.json を配置
cp path/to/google-services.json apps/mobile/
```

ネイティブプロジェクト内のコピーはprebuildで生成・更新されるため、設定元として直接編集しません。

#### RevenueCat設定（サブスクリプション）

1. [RevenueCat Dashboard](https://app.revenuecat.com/)でプロジェクトを作成
2. 各プラットフォーム用の公開SDKキーを取得
3. モバイルのネイティブ設定と、下記Web環境変数へ設定
4. Restore Behaviorを「既存権利を維持し、同一App User IDへ統合する」製品方針に合わせて設定
5. リリース前に購入サンドボックスで Free→Free、Free→Pro、Pro→Free、Pro→Pro の4組合せを確認し、採用された有効期限を記録

秘密のREST APIキーやサービスアカウント資格情報はクライアントへ設定しないでください。

#### Web環境変数

Vite のモード別読み込みを使い、Firebase設定は全モード共通、ClipTap APIの向き先だけを環境ごとに切り替えます。

| ファイル | 読み込まれるタイミング | 内容 |
|---|---|---|
| `apps/web/.env` | 全モード共通 | Firebaseの6項目 |
| `apps/web/.env.development` | `npm run dev:web` | `VITE_API_BASE_URL`（既定はローカルの `wrangler dev`） |
| `apps/web/.env.production` | `npm run build:web` | `VITE_API_BASE_URL`（本番Worker） |
| `apps/web/.env.development.local` | 開発モード（任意・gitignore済み） | 上記の上書き用 |

```dotenv
# apps/web/.env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...

# apps/web/.env.development
VITE_API_BASE_URL=http://localhost:8787

# apps/web/.env.production
VITE_API_BASE_URL=https://<本番Workerのホスト>
```

Webは課金プロバイダのSDKキーを保持しません。Pro権利の判定はClipTap API（Cloudflare Worker）経由で行い、RevenueCatのSecret API KeyはWorkerのシークレットとしてのみ保持します。

デプロイ済みの開発用Worker（`cliptap-api-dev`）へ向けたい場合は、`apps/web/.env.development.local` を作成して `VITE_API_BASE_URL` を上書きしてください。

GitHub Pagesの本番ビルドはFirebaseの6項目をGitHub Actions Secretsから受け取ります。`VITE_API_BASE_URL` はワークフローから注入せず、`.env.production` を正とします（未設定のActions変数を渡すと空文字で上書きされ、全利用者がFree扱いになるため）。AdSense用環境変数は現行Webアプリでは使用していません。

#### Google Sign In設定

1. [Google Cloud Console](https://console.cloud.google.com/)でプロジェクトを作成
2. OAuth 2.0クライアントIDを作成（iOS用、Android用、Web用）

**iOS設定**:
- `apps/mobile/ios/ClipTap/Info.plist`に`GIDClientID`を追加
- URL Schemesを設定

**Android設定**:
- `apps/mobile/android/app/src/main/res/values/strings.xml`に設定を追加

#### Apple Sign In設定（iOS）

1. Apple Developer Accountで「Sign in with Apple」を有効化
2. Xcodeで「Sign in with Apple」Capabilityを追加
3. Firebaseと連携（Firebase Console > Authentication > Sign-in method）

### 6. 開発ビルドの準備（推奨）

Expo Development Client（expo-dev-client）を使用すると、ネイティブモジュールを含む開発が可能になります。

```bash
# iOS Development Buildのインストール
npm run ios

# Android Development Buildのインストール
npm run android
```

初回実行時、開発ビルドがデバイス/シミュレーターにインストールされます。

---

## 開発サーバーの起動

### Mobile（Expo）

#### 開発サーバー起動

```bash
# ルートディレクトリから起動
npm run dev:mobile

# または、apps/mobileディレクトリから起動
cd apps/mobile
npm start
```

起動後、ターミナルに以下のオプションが表示されます:

```
› Press a │ open Android
› Press i │ open iOS simulator
› Press w │ open web

› Press r │ reload app
› Press m │ toggle menu
› Press c │ clear cache and reload
```

#### iOSシミュレーターで起動

```bash
# ルートディレクトリから
npm run ios

# 特定のシミュレーターを指定
npm run ios -- --simulator="iPhone 15 Pro"
```

#### Androidエミュレーターで起動

```bash
# Androidエミュレーターを事前に起動しておく
# Android Studioから、または adb コマンドで起動

# ルートディレクトリから
npm run android
```

#### 実機でテスト

1. 開発ビルドを実機にインストール（`npm run verify:ios:device` または `npm run android`）
2. Expo Goアプリではなく、開発ビルドアプリを使用
3. 同じWi-Fiネットワークに接続
4. QRコードをスキャン、またはURLを直接入力

拡張キーボードを実機で確認する場合は `npm run verify:ios:device` を使ってください（[4. ネイティブビルドとインストール](#4-ネイティブビルドとインストール)を参照）。`npm run ios` は毎回シミュレータへ入ります。

リリース前の実機確認:

- [ ] OTA無効化後も開発メニューの再読込がiOS/Androidで動く
- [ ] 30文字を超える既存タイトルを編集画面で開いても、保存前に値が欠落しない
- [ ] キーボードをFree状態で起動し、件数制限なく入力できる
- [ ] iOSはフルアクセスのON/OFF両方、Androidは通常入力で使用回数が仕様どおり更新される（iOSはフルアクセスOFFでは加算されないこと、並べ替えは4種とも選択できることを確認）
- [ ] チェックサムなし旧 `.cliptap` の非対応をリリースノートへ記載した

#### ホットリロード

- ファイルを保存すると、自動的にアプリがリロードされます
- 手動リロード: シミュレーター/エミュレーターで `r` を押す
- キャッシュクリア: `c` を押す

#### デバッグツール

**React Native Debugger**:

```bash
# インストール
brew install --cask react-native-debugger

# 起動後、Expo開発メニューから "Debug remote JS" を選択
```

**Flipper**:
- Facebookが提供するモバイルアプリデバッグツール
- ダウンロード: [https://fbflipper.com/](https://fbflipper.com/)
- Networkリクエスト、データベース、ログの監視が可能

### Web

#### Vite開発サーバー起動

```bash
# ルートディレクトリから
npm run dev:web

# または、apps/webディレクトリから
cd apps/web
npm run dev
```

起動後、ブラウザで以下にアクセス:

```
http://localhost:5173
```

#### ブラウザでのデバッグ

- Chrome DevToolsを使用
- React Developer Toolsブラウザ拡張機能を推奨
- Network、Console、Sourcesタブを活用

### API（Cloudflare Workers）

Web版のPro判定を中継するWorkerです。RevenueCatのSecret API Keyをサーバー側に隔離するため、ブラウザから課金プロバイダへ直接アクセスしません。

#### 環境構成

`apps/api/wrangler.toml` で本番用と開発用の2つのWorkerを定義しています。設定値は環境ごとに独立しており、シークレットも個別に登録が必要です。

| 環境 | Worker名 | `--env` | `ENVIRONMENT` | 許可オリジン |
|---|---|---|---|---|
| 本番 | `cliptap-api` | `production` | `production` | `cliptap.net`、`www.cliptap.net` |
| 開発 | `cliptap-api-dev` | `dev` | `development` | 上記＋`localhost:5173`、`127.0.0.1:5173` |

デプロイ・起動時は**必ず `--env` を指定**してください。省略した場合はどちらにも影響しない `cliptap-api-local` が対象になります。

#### ローカル起動

```bash
# ルートディレクトリから（wrangler dev が http://localhost:8787 で待ち受ける）
npm run dev:api

# Web側は既定でこのURLを参照するため、別ターミナルで並行起動する
npm run dev:web
```

#### シークレットの設定

Secret API Keyは`wrangler secret`で登録します。環境ごとに個別登録が必要で、リポジトリには絶対にコミットしないでください。

```bash
cd apps/api

# 開発環境
npx wrangler secret put REVENUECAT_API_KEY --env dev

# 本番環境
npx wrangler secret put REVENUECAT_API_KEY --env production
```

`wrangler dev` でのローカル実行時は `apps/api/.dev.vars` に同じキーを記載します（`.gitignore` 済み）。

```dotenv
# apps/api/.dev.vars
REVENUECAT_API_KEY=sk_...
```

#### 動作確認

```bash
# ヘルスチェック（environmentの値で環境を判別できる）
curl https://<デプロイ先ホスト>/health

# Pro判定（Firebase IDトークンが必要）
curl -H "Authorization: Bearer <Firebase IDトークン>" \
  https://<デプロイ先ホスト>/subscription/status
```

---

## コード構造の理解

### モノレポ構造（npm Workspaces）

ClipTapは3つの主要パッケージで構成されています:

```
clipTap/
├── apps/
│   ├── mobile/              # @cliptap/mobile
│   │   ├── app/            # Expo Routerの画面（ファイルベースルーティング）
│   │   ├── src/            # コアロジック
│   │   │   ├── adapters/   # プラットフォーム固有アダプター
│   │   │   ├── components/ # UIコンポーネント
│   │   │   ├── hooks/      # カスタムフック
│   │   │   ├── services/   # サービス
│   │   │   └── utils/      # ユーティリティ
│   │   ├── assets/         # 画像、フォント等
│   │   ├── english.json    # Expoネイティブ向け英語ローカライズ
│   │   ├── japanese.json   # Expoネイティブ向け日本語ローカライズ
│   │   ├── ios/            # iOSネイティブコード
│   │   ├── android/        # Androidネイティブコード
│   │   └── package.json    # モバイルアプリの依存関係
│   │
│   └── web/                 # @cliptap/web
│       ├── src/            # Reactコンポーネント、ページ
│       ├── public/         # 静的ファイル
│       └── package.json    # Webアプリの依存関係
│
├── packages/
│   └── shared/              # @cliptap/shared
│       ├── src/            # 共通の型、業務ロジック、DB、i18n（ja/en）
│       └── package.json    # 共通パッケージの依存関係
│
└── package.json             # ルートのpackage.json（workspaces定義）
```

### 各パッケージの役割

#### apps/mobile（モバイルアプリ）

React Native + Expoで構築されたモバイルアプリ。iOS/Android両対応。

**主要技術**:
- Expo SDK 57
- React Native 0.86.2
- Expo Router（ファイルベースルーティング）
- SQLite（expo-sqlite）
- Firebase Authentication
- RevenueCat（サブスクリプション）

**データフロー**:
```
UI Layer (app/*.tsx, src/components/*.tsx)
    ↓ useSnippets(), useCategories()
Business Logic Layer (packages/shared/src/services/*.ts, src/hooks/*.ts)
    ↓ snippetMapper.getAll()
Data Access Layer (packages/shared/src/mappers/*.ts)
    ↓ SQL queries
Database (SQLite)
```

#### apps/web（Webアプリ）

React + Viteで構築されたWebアプリ。ランディングページとWebツール。

**主要技術**:
- React 19
- Vite 7
- React Router v7
- Tailwind CSS v4
- Firebase Authentication
- IndexedDB（ローカルストレージ）

#### packages/shared（共通パッケージ）

モバイルとWebで共有される型定義、バリデーション、ユーティリティ関数。

**主要技術**:
- TypeScript
- Zod（スキーマバリデーション）

**エクスポート内容**:
- 共通の型定義（Snippet, Category, Profile等）
- バリデーションスキーマ
- 定数定義
- ユーティリティ関数

### データフロー（3層アーキテクチャ）

ClipTapは以下の3層アーキテクチャを採用しています:

```
┌─────────────────────────────────────────────────┐
│  UI Layer (React Components)                    │
│  - app/*.tsx (screens)                          │
│  - src/components/*.tsx                         │
└─────────────────┬───────────────────────────────┘
                  │ useSnippets(), useCategories()
┌─────────────────▼───────────────────────────────┐
│  Business Logic Layer (Services + Hooks)        │
│  - packages/shared/src/services/*.ts            │
│  - src/hooks/*.ts                               │
└─────────────────┬───────────────────────────────┘
                  │ snippetMapper.getAll()
┌─────────────────▼───────────────────────────────┐
│  Data Access Layer (Mappers)                    │
│  - packages/shared/src/mappers/*.ts             │
└─────────────────┬───────────────────────────────┘
                  │ SQL queries
┌─────────────────▼───────────────────────────────┐
│  Database (SQLite)                              │
│  - src/database/database.ts                     │
│  - packages/shared/src/database/schema.ts (V6)  │
└─────────────────────────────────────────────────┘
```

#### 1. UI Layer（UIレイヤー）

- **責務**: ユーザーインターフェースの描画、ユーザー操作の受付
- **実装場所**: `app/*.tsx`、`src/components/*.tsx`
- **原則**: ビジネスロジックを含まない、プレゼンテーション専用

```typescript
// 例: app/index.tsx
export default function HomeScreen() {
  const { snippets, loading, copySnippet } = useSnippets();

  return (
    <SnippetList
      snippets={snippets}
      loading={loading}
      onCopy={copySnippet}
    />
  );
}
```

#### 2. Business Logic Layer（ビジネスロジックレイヤー）

- **責務**: アプリケーションのビジネスルール、状態管理、データ変換
- **実装場所**: `packages/shared/src/services/*.ts`、`packages/shared/src/hooks/*.ts`、各アプリの `src/hooks/*.ts`
- **原則**: UIとデータアクセスを橋渡し、複雑なロジックを集約

共有Serviceは既存実装に合わせて静的メソッドで業務検証を行い、Mapperへデータ操作を委譲します。クリップボード、認証、課金などのプラットフォーム機能はAdapter経由で扱います。

#### 3. Data Access Layer（データアクセスレイヤー）

- **責務**: データベースとの直接的なやり取り、CRUD操作
- **実装場所**: `packages/shared/src/mappers/*.ts`
- **原則**: SQLはMapper内に閉じ込め、共有DB Adapterを取得して静的メソッドから実行する。UI、Hook、Serviceから直接SQLを実行しない。

### ファイル配置のルール

#### 新しいコンポーネントを追加する場合

```
src/components/
├── common/           # 基本UIコンポーネント（Button, Input等）
├── layout/           # レイアウトコンポーネント（Container, Header等）
├── snippet/          # スニペット関連コンポーネント
├── category/         # カテゴリ関連コンポーネント
├── profile/          # 環境関連コンポーネント
├── variable/         # 変数関連コンポーネント
├── selection/        # 選択関連コンポーネント
└── settings/         # 設定関連コンポーネント
```

**命名規則**:
- PascalCase（例: `SnippetCard.tsx`）
- 1ファイル1コンポーネント
- Propsは`interface Props`で明示的に定義

#### 新しいサービスを追加する場合

```
packages/shared/src/services/
├── SnippetService.ts      # スニペット管理
├── CategoryService.ts     # カテゴリ管理
├── VariableService.ts     # 変数管理
├── ProfileService.ts      # プロファイル管理
├── SubscriptionService.ts # サブスクリプション管理
└── YourNewService.ts      # 新しいサービス
```

**命名規則**:
- PascalCase + `Service`サフィックス
- クラスベース設計
- 単一責任の原則を遵守

#### 新しいMapperを追加する場合

```
packages/shared/src/mappers/
├── SnippetMapper.ts
├── CategoryMapper.ts
├── ProfileMapper.ts
├── VariableMapper.ts
└── YourNewMapper.ts       # 新しいMapper
```

**必須**:
- 既存Mapperと同じ静的メソッド形式にする
- DB行からドメイン型への変換をMapper内に閉じ込める
- プレースホルダーを使用し、UI、Hook、ServiceへSQLを漏らさない

---

## 開発ワークフロー

### 新機能の追加（完全フロー）

新しい機能を追加する際は、以下のステップに従ってください。

#### ステップ1: スキーマ定義

データベースに新しいテーブルが必要な場合、共通マイグレーションへ次の連続バージョンを追加します。

```bash
# 現行の packages/shared/src/database/migrations.ts に V8 → V9 を追加
```

**例**: `packages/shared/src/database/migrations.ts`

```typescript
export async function migrateV8ToV9(db: DbAdapter): Promise<void> {
  // V8のfixtureからV9へ移行できる処理と回帰テストを追加する
}
```

**重要**:
- リリース済みの移行ステップは原則変更せず、新しいバージョンとして追加する
- 既存ステップの不具合修正が必要な場合は、対象旧版のfixtureと回帰テストを追加する
- `packages/shared/src/database/schema.ts`でバージョンをインクリメント
- `MIN_SUPPORTED_SCHEMA_VERSION` の据置可否と `migrateImportTempDb` の新しいcaseを確認

#### ステップ2: Mapper作成

既存Mapperと同じ静的クラスを作成します。共有DB Adapterを取得し、クエリ定数、プレースホルダー、DB行からドメイン型への変換をMapper内に閉じ込めます。作成・更新・削除の関連整合性と、必要な索引も合わせて設計してください。

#### ステップ3: Service作成

既存Serviceと同じ静的クラスに、入力の正規化、検証、重複・プラン制限などの業務ルールを実装し、データ操作をMapperへ委譲します。利用者向けエラーは共通エラー型と日英翻訳を追加します。

#### ステップ4: Hook作成

共有できる取得・更新状態は共有Hook、画面固有の遷移・モーダル・入力状態は各アプリのHookへ配置します。既存Providerの再読込契機、エラー変換、effect依存配列まで同種機能に合わせます。

#### ステップ5: UI実装

モバイル画面は `apps/mobile/app`、再利用コンポーネントは `apps/mobile/src/components`、Web画面は `apps/web/src/pages` と `apps/web/src/components` に配置します。既存のパスエイリアス、共通テーマ、翻訳、FlashList利用規則に従い、モバイルとWebの仕様差は機能仕様書へ記録します。

### コミット前のチェック

コードをコミットする前に、必ず以下のチェックを実行してください。

#### 1. TypeScript型チェック

```bash
# すべてのワークスペースの型チェック
npm run type-check

# 個別のワークスペース
npm run type-check:mobile
npm run type-check:web
npm run type-check:shared
```

**重要**: 型エラーが1件でもある場合、コミットしないでください。

#### 2. Linter実行

```bash
# ESLint実行（mobile → web → shared → api の順にワークスペースへ委譲し、最後に store/ を見る）
npm run lint

# ワークスペース単位で実行する場合
npm run lint --workspace=@cliptap/mobile
npm run lint --workspace=@cliptap/web
npm run lint --workspace=@cliptap/shared
npm run lint --workspace=@cliptap/api

# ワークスペース外（store/screen/build.mjs）はルートの flat config で見る
npx eslint store
```

自動修正可能なエラーがある場合:

```bash
npm run lint:fix
```

lint の本体は各ワークスペースの flat config です（web は型情報を使わない設定で、mobile / shared / api は型情報付き lint のため設定が大きく異なる）。4ワークスペースすべてを CI の `npm run lint` で強制しています。

ルートの `eslint.config.js` が受け持つのは `store/` だけです。`store/` は npm workspaces の定義（`apps/*` と `packages/*`）に含まれず、どのワークスペースの `eslint .` からも到達しないためです。**ワークスペース側（`apps/**`、`packages/**`）はルート設定で必ず ignore しています**。除外を外すと、ルートで `npx eslint` したときに型情報付きのルールが適用されないまま緑になります。

各ワークスペースの config には TypeScript 用（`**/*.{ts,tsx}`）とは別に JavaScript 用のブロックを置いています。files が `.ts/.tsx` だけだと、`apps/web/scripts/*.mjs` や `apps/mobile/plugins/*.js` は「読み込まれるがルールが1つも適用されない」状態になり、静かに検査対象から漏れるためです。

`packages/shared` の lint は `tsconfig.lint.json` を型情報のプロジェクトに使います。ビルド用の `tsconfig.json` が `src` のみを対象とするのに対し、こちらは `tests` も含めるためです。**`src` や `tests` の外に新しいディレクトリを追加する場合は `tsconfig.lint.json` の `include` も更新してください**（対象外のファイルは lint 時にパースエラーになります）。

#### 3. フォーマット確認

現行ルートには `format` スクリプトがありません。変更ファイルは既存の書式に合わせ、フォーマッターを導入する場合はルートスクリプトとCIを同じ変更で追加してください。

#### 4. ネイティブビルドとインストール

iOS拡張キーボード（Swift）とAndroid IME（Kotlin・レイアウト・リソース）は `npm run type-check` の対象外です。
これらを変更した場合は、実際にコンパイルして壊れていないことを確認してください。

```bash
# iOS + Android の両方をビルドし、シミュレータ/エミュレータへインストール
npm run build:native

# 片方だけ実行する場合
npm run build:native:ios          # iOS（ClipTapスキーム）→ シミュレータへインストール
npm run build:native:ios:device   # iOS（ClipTapスキーム）→ 接続中の実機へインストール
npm run build:native:android      # Android（:app:assembleDebug）→ adbが見ている端末へインストール

# ビルドだけ行い、端末を触らない場合
npm run build:native:ios -- --no-install

# 実機向けのnpm scriptを使いつつ、今回だけシミュレータへ入れたい場合
npm run build:native:ios:device -- --simulator
```

`--simulator` は既定値と同じですが、`build:native:ios:device` が `--device` を焼き込んでいるため、これを打ち消す唯一の手段です（npmは `--` 以降を末尾へ足すだけなので、後勝ちで上書きします）。

実体は [scripts/build-native.sh](../scripts/build-native.sh) です。ビルドログは `.build-logs/` に出力され（gitignore済み）、失敗時はエラー行を抜き出して表示します。

**インストールまで責務に含める理由**: ビルドしただけでは端末の中身は古いままです。拡張キーボードは別バンドル（`.appex`）で、アプリを起動しても更新されたように見えないため、「直したはずなのに直っていない」に陥りやすい。ビルドと端末への反映を一続きにして、この乖離を作らないようにしています。

**ビルド範囲**: どちらのプラットフォームもアプリ本体ごとビルドします。

| プラットフォーム | 生成物 | インストール先 | 備考 |
|---|---|---|---|
| iOS（既定） | `ClipTap.app` ＋ `PlugIns/ClipTapKeyboard.appex` | シミュレータ（`IOS_SIMULATOR` で指定可） | `ClipTap` スキームでビルドする。`ClipTapKeyboard` はターゲット依存として一緒にビルドされ、`Embed App Extensions` フェーズで `PlugIns/` へ埋め込まれる |
| iOS（`--device`） | 同上（`Debug-iphoneos`） | 接続中の実機（`IOS_DEVICE` で指定可） | 開発者証明書で署名し、`xcrun devicectl` でインストールする |
| Android | `app-debug.apk` | `adb devices` が見ている端末。無ければAVDを起動（`ANDROID_AVD` で指定可） | 拡張キーボード（IME）はアプリ本体と同じ `app` モジュールに含まれる |

**注意**:

- `ClipTapKeyboard` スキームは指定できません。Xcodeがローカルに自動生成するユーザースキーム（`xcuserdata/` 配下・gitignore対象）で、リポジトリには含まれないためです。
- ビルド成功後に `ClipTap.app/PlugIns/ClipTapKeyboard.appex` の存在を検査します。ClipTapKeyboardターゲットが `project.pbxproj` から失われても `ClipTap.app` のビルド自体は成功してしまい、実行時にだけキーボードが選べなくなる（静かに壊れる）ためです。
- iOSのシミュレータは上書きインストールの前に一度アンインストールします。`.appex` はアプリ本体と別バンドルのため、上書きだけでは古い拡張キーボードが残ることがあるためです。
- インストール後、iOSは端末上の `.appex` の存在とApp Groupの有効性を、Androidは `adb shell ime list` でIMEが入力方式として認識されているかを確認します。
- このスクリプトは `expo prebuild --clean` を実行しません。`ios/` が再生成されるとClipTapKeyboardターゲットの手動設定が失われるためです。
- CIのiOSジョブもこのスクリプト（`npm run build:native:ios -- --no-install`）を使います。CI側で `xcodebuild` を直接呼ぶと `.appex` の埋め込み検査が抜け、ターゲットが失われてもCIが緑のまま通るためです。ビルドログは失敗時に `ios-build-logs` アーティファクトとして残ります。空き容量の事前チェックはランナー向けに `REQUIRED_FREE_GB` で下げています。
- iOSビルドで `CODE_SIGNING_ALLOWED=NO` を使ってはいけません。エンタイトルメントが埋め込まれず、App Group（`group.com.sikakou.cliptap`）が無効になります。アプリと拡張キーボードは共有SQLiteをApp Group経由で読むため、署名を切るとDB初期化に失敗し（`App Group container not found`）、動作確認に使えないビルドになります。シミュレータ向けはアドホック署名（`CODE_SIGN_IDENTITY = -`）で足りるため、開発者アカウントは不要です。

##### iOS実機（`--device`）

拡張キーボードはシミュレータでは再現しない挙動があります（フルアクセスの許可ダイアログ、ハプティクス、実際のキーボード切り替え）。これらは実機で確認してください。

```bash
npm run build:native:ios:device            # ビルド → 実機へインストール
IOS_DEVICE="iPhone 15" npm run build:native:ios:device   # 端末を名前かUDIDで指定
DEVELOPMENT_TEAM=XXXXXXXXXX npm run build:native:ios:device  # 署名チームを明示
```

シミュレータとの違いは次のとおりです。

| 項目 | シミュレータ | 実機（`--device`） |
|---|---|---|
| 署名 | アドホック（開発者アカウント不要） | 開発者証明書とプロビジョニングプロファイルが必須 |
| 出力先 | `Debug-iphonesimulator` | `Debug-iphoneos` |
| インストール | `xcrun simctl install` | `xcrun devicectl device install app` |
| 事前アンインストール | する | **しない** |

**チームIDは `project.pbxproj` に書きません。** 個人のチームIDをリポジトリへ残さないため、ビルド時に `DEVELOPMENT_TEAM=` としてコマンドラインから渡します。未指定の場合は開発用証明書（`Apple Development`）のOUから自動で求めます。複数チームに所属している場合は決められないため、`DEVELOPMENT_TEAM` で明示してください。

**実機ではアンインストールしません。** アプリを消すと「設定 > 一般 > キーボード」の登録も外れ、毎回キーボードを追加し直すことになるためです。実機のインストールはバンドルごと置き換わるので、シミュレータのように古い `.appex` が残る問題は起きません。

**インストール前に署名のエンタイトルメントを検査します。** プロビジョニングプロファイルにApp Groupが含まれていないと、ビルドもインストールも成功したうえで共有SQLiteを開くところだけが壊れます。`ClipTap.app` と `ClipTapKeyboard.appex` の両方に `group.com.sikakou.cliptap` が入っているかを `codesign -d --entitlements` で確認してから端末へ入れます。

`devicectl device info apps` はApp Extensionを列挙しない（コンテナアプリしか出ない）ため、実機では拡張キーボードの存在をビルド成果物側（`PlugIns/ClipTapKeyboard.appex`）と署名で確認します。シミュレータのように端末上のバンドルを直接見ることはできません。

**端末の解決**: `xcrun devicectl` が挙げるペアリング済み端末のうち、iOSの実機だけに絞ります。複数ある場合は直近に接続したものを選びます。`IOS_DEVICE` に端末名またはUDIDを指定すれば固定できます。ビルド前に疎通を確認するため、端末が見つからない・通信できない場合は長いビルドを始める前に止まります。

**端末が無い場所で実機向けビルドだけ確認したい場合**は `--no-install` を付けます。`-destination generic/platform=iOS` に切り替わり、署名まで通ることだけを確かめます。

```bash
npm run build:native:ios:device -- --no-install
```

#### 5. 動作確認

チェックから端末へのインストールまでを1コマンドで通す場合は `npm run verify:ios` / `npm run verify:android` を使います。

```bash
# 型チェック → テスト → Lint → ネイティブビルド → シミュレータ起動 → インストール
npm run verify:ios
npm run verify:android

# 実機へインストールする場合（iOSのみ。Androidは verify:android がadbの端末へそのまま入る）
npm run verify:ios:device

# インストールせず検証だけ行う場合（コミット前の確認向け）
npm run verify:ios -- --no-install

# 検証を飛ばしてインストールだけしたい場合
npm run verify:ios -- --skip-checks --skip-build
npm run verify:ios:device -- --skip-checks --skip-build

# 実機向けのnpm scriptを使いつつ、今回だけシミュレータへ入れたい場合
npm run verify:ios:device -- --simulator
```

`--simulator` は既定値と同じですが、`verify:ios:device` が焼き込んでいる `--device` を打ち消す唯一の手段です（npmは `--` 以降を末尾へ足すだけなので、後勝ちで上書きします）。

**iOSとAndroidは必ず分けて実行します。** プラットフォーム引数は必須で、同時指定はエラーになります。片方の環境不備（エミュレータのディスク不足など）でもう片方の確認が止まらないようにするためです。

実体は [scripts/verify.sh](../scripts/verify.sh) です。処理の流れは次のとおりです。

1. `npm run type-check` / `npm test` / `npm run lint`
2. `scripts/build-native.sh`（指定したプラットフォームのみ）。ビルドと端末へのインストールはここで行われる
3. Metroの起動方法とアプリの起動コマンドを案内して終了

**インストール処理は `build-native.sh` が持ちます。** `verify.sh` は静的チェックと案内に専念し、ビルド・インストールは委譲します。同じ処理を二つのスクリプトに持たせると、片方だけ直したときに挙動がずれるためです。`--no-install` はそのまま `build-native.sh` へ渡ります。

**Metro（`expo start`）はスクリプトに含めません。** 対話的に操作したい場面が多いため、`npm run dev:mobile` は各自で実行します。

```bash
# 1. Metroを起動
npm run dev:mobile

# 2. アプリを起動（Metro起動後）
xcrun simctl launch booted com.sikakou.cliptap --initialUrl http://localhost:8081
```

iOSは `expo-dev-launcher` の `--initialUrl` 起動引数でMetroへ自動接続します。`xcrun simctl openurl` によるディープリンクは「"ClipTap" で開きますか？」の確認ダイアログが出てタップが必要になるため使いません。Androidは `adb reverse` でエミュレータ内の `localhost:8081` をホストへ転送済みなので、VIEWインテントでそのまま接続できます。

実機（`--device`）の場合は `localhost` がMac自身を指さないため、案内にはMacのIPアドレスを埋めて表示します。Macと同じネットワークに端末を繋いでください。

```bash
# 2. アプリを起動（実機。UDIDとIPは verify.sh が実際の値を埋めて案内します）
xcrun devicectl device process launch --device <UDID> -- com.sikakou.cliptap --initialUrl http://<MacのIP>:8081
```

環境変数で対象を切り替えられます。

| 変数 | 既定値 | 用途 |
|---|---|---|
| `IOS_SIMULATOR` | 起動中のもの、なければ利用可能な最初のiPhone | 使用するシミュレータ名 |
| `IOS_DEVICE` | 直近に接続した実機 | `--device` で使う実機の名前またはUDID |
| `DEVELOPMENT_TEAM` | 開発用証明書のOUから自動解決 | `--device` の署名チームID |
| `ANDROID_AVD` | `emulator -list-avds` の先頭 | 使用するAVD名 |
| `METRO_PORT` | `8081` | 案内に表示するMetroのポート |

エミュレータが起動できない場合（ディスク容量不足など）は、無限に待たずにエラーで停止し、`emulator.log` から `FATAL`/`ERROR` 行を抜き出して表示します。

そのうえで、以下を目視で確認してください。

- 追加した機能が正しく動作することを確認
- 既存の機能が壊れていないことを確認
- ダークモード、iOS/Android両方での表示崩れがないことを確認

### Gitコミットの規約

ClipTapでは以下のコミットメッセージ規約を推奨します:

```
<type>: <subject>

<body>

<footer>
```

**type（必須）**:
- `feat`: 新機能
- `fix`: バグ修正
- `docs`: ドキュメント変更
- `style`: コードフォーマット（機能変更なし）
- `refactor`: リファクタリング
- `test`: テスト追加・修正
- `chore`: ビルド、設定変更

**例**:

```bash
git commit -m "feat: add dark mode support"
git commit -m "fix: resolve crash on iOS when copying empty snippet"
git commit -m "docs: update DEVELOPMENT.md with new setup steps"
```

---

## テストとデバッグ

### 型チェックの実行方法

TypeScript型チェックは、コードの品質を保つために最も重要なステップです。

```bash
# すべてのワークスペースの型チェック
npm run type-check

# エラー例
apps/mobile/app/index.tsx:23:5 - error TS2322: Type 'string' is not assignable to type 'number'.
```

**型エラーの解決方法**:

1. エラーメッセージを読む
2. ファイルと行番号を確認
3. 型定義を確認（`packages/shared/src/types/*.ts` と `packages/shared/src/schema.ts`）
4. `any`型の使用は最小限に

### ユニットテストの実行

共有パッケージ（`packages/shared`）にVitestの回帰テストがあります。ルートから実行できます。

```bash
npm test                                             # ルート（内部で @cliptap/shared の vitest run を実行）
npm test --workspace=@cliptap/shared                 # 共有パッケージを直接実行
npx vitest run packages/shared/tests/parser.test.ts  # 単一ファイルだけ実行したいとき
```

新機能では同じテスト基盤へ回帰ケースを追加し、コミット前に `npm test` がすべて成功することを確認してください（CLAUDE.md「コミット前の必須チェック」およびCIと同じ）。

### デバッグのベストプラクティス

#### Console Logging

```typescript
// 基本的なログ
console.log('Debug info:', data);

// エラーログ
console.error('Error occurred:', error);

// 警告ログ
console.warn('Warning:', message);
```

#### React Native Debugger

1. React Native Debuggerを起動
2. Expo開発メニューから「Debug remote JS」を選択
3. ブレークポイントを設定してステップ実行

#### Flipperの使用

1. Flipperを起動
2. デバイス/シミュレーターを選択
3. プラグインを有効化:
   - **Logs**: アプリログの確認
   - **Network**: ネットワークリクエストの監視
   - **Databases**: SQLiteデータベースの確認

#### SQLiteデバッグ

```typescript
// データベースクエリをログに出力
const result = await db.getAllAsync('SELECT * FROM snippets');
console.log('Query result:', result);
```

Flipperの「Databases」プラグインを使用すると、SQLiteの内容をGUIで確認できます。

### よくあるエラーとその解決方法

#### エラー1: `Metro bundler has encountered an internal error`

**原因**: Metroのキャッシュが破損している

**解決方法**:

```bash
# Metroキャッシュをクリア
npm run dev:mobile -- --clear

```

#### エラー2: `Unable to resolve module`

**原因**: モジュールが見つからない、またはインポートパスが間違っている

**解決方法**:

```bash
# node_modulesを再インストール
rm -rf node_modules package-lock.json
npm install
```

#### エラー3: `CocoaPods could not find compatible versions for pod`

**原因**: CocoaPodsの依存関係の競合

**解決方法**:

```bash
cd apps/mobile/ios
rm -rf Pods Podfile.lock
pod install --repo-update
cd ../../..
```

#### エラー4: `JAVA_HOME is not set`

**原因**: Java Development Kitがインストールされていない、または環境変数が設定されていない

**解決方法**:

```bash
# JDKのインストール確認
java -version

# 環境変数の設定（~/.zshrcまたは~/.bash_profileに追加）
export JAVA_HOME=$(/usr/libexec/java_home)
```

#### エラー5: `Gradle build failed`

**原因**: Androidビルドの依存関係の問題

**解決方法**:

```bash
cd apps/mobile/android
./gradlew clean
cd ../../..
npm run android
```

#### エラー6: 型エラー `Property 'xxx' does not exist on type 'yyy'`

**原因**: 型定義が正しくない、または型の不一致

**解決方法**:

1. 型定義を確認（`packages/shared/src/types/*.ts`）
2. インポートパスを確認
3. 必要に応じて型アサーションを使用（最終手段）

```typescript
// 型アサーション（最終手段）
const data = result as MyType;
```

---

## ビルドとデプロイ

### Mobile

ClipTapのモバイルアプリは、EAS Build（Expo Application Services）を使用してビルドします。

#### Development Build

開発用ビルド。ネイティブモジュールのテストが可能。

```bash
# iOSシミュレーターにインストール
npm run ios

# Androidエミュレーターにインストール
npm run android
```

#### Preview Build

内部テスター向けビルド。TestFlightまたはInternal Testingで配布。

```bash
# プレビュービルド（iOS/Android）
npm run build:mobile:preview

# EAS Buildの進捗はWebで確認
# https://expo.dev/accounts/sikakou/projects/cliptap/builds
```

#### Production Build

本番ビルド。App Store/Google Playに提出。

```bash
# 本番ビルド（iOS/Android）
npm run build:mobile
```

**ビルド前の準備**:

1. アプリバージョンをインクリメント（`apps/mobile/app.json`）
2. 法的文書を同期（利用規約、プライバシーポリシー）

```bash
npm run sync-legal --workspace=@cliptap/mobile
```

3. 変更履歴を記録
4. Git tagを作成

```bash
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin vX.Y.Z
```

#### App Store提出（iOS）

1. EAS Buildが完了したら、`.ipa`ファイルをダウンロード
2. App Store Connectにアップロード（EASが自動的に行う）
3. App Store Connectでアプリ情報を入力
4. スクリーンショット、説明文、キーワードを更新
5. 審査に提出

#### Google Play提出（Android）

1. EAS Buildが完了したら、`.aab`ファイルをダウンロード
2. Google Play Consoleにアップロード（EASが自動的に行う）
3. Google Play Consoleでアプリ情報を入力
4. スクリーンショット、説明文を更新
5. 審査に提出

### Web

Webアプリは、Viteを使用してビルドします。

#### ビルド

```bash
# Webアプリのビルド
npm run build:web

# ビルド結果は apps/web/dist に出力される
```

#### プレビュー

```bash
# ビルドしたアプリをローカルでプレビュー
cd apps/web
npm run preview
```

#### デプロイ

本番WebはGitHub Pagesへデプロイします。

- `release/prod` ブランチへのpush、またはGitHub Actionsの手動実行で開始
- Node.js 22で依存関係をインストールし、`npm run build:web` を実行
- `apps/web/dist` をGitHub Pagesへアップロード
- `apps/web/public/CNAME` により `cliptap.net` を使用

事前にGitHubリポジトリのPagesをGitHub Actions配信に設定し、Web環境変数のFirebase 6項目をActions Secretsへ登録してください。`VITE_API_BASE_URL` はワークフローから注入せず `apps/web/.env.production` を正とします。Vercel向け設定は保持せず、GitHub Pagesのワークフローを配布設定の正本とします。

### API（Cloudflare Workers）

本番用（`cliptap-api`）と開発用（`cliptap-api-dev`）の2つを個別にデプロイします。

```bash
# 本番へデプロイ
npm run deploy:api

# 開発環境へデプロイ
npm run deploy:api:dev
```

初回は次の順序で実施してください。シークレットは環境ごとに個別登録が必要です。

1. `npx wrangler login` でCloudflareへログイン
2. `npm run deploy:api:dev` / `npm run deploy:api` でWorkerを作成
3. `npx wrangler secret put REVENUECAT_API_KEY --env <dev|production>` でSecret API Keyを登録
4. デプロイ出力で確定したホスト名を `apps/web/.env.production`（本番）に反映
5. `curl https://<ホスト>/health` で `environment` が期待どおりか確認

本番Workerの入れ替えは、開発用Workerで疎通と権利判定を確認してから行ってください。

---

## トラブルシューティング

### Metro bundlerのキャッシュクリア

Metroのキャッシュが原因で問題が発生する場合があります。

```bash
# Expoキャッシュをクリア
npm run dev:mobile -- --clear
```

### node_modulesの再インストール

依存関係が壊れている場合、再インストールが必要です。

```bash
# ルートディレクトリで実行
rm -rf node_modules package-lock.json
rm -rf apps/mobile/node_modules
rm -rf apps/web/node_modules
rm -rf packages/shared/node_modules

# 再インストール
npm install
```

### CocoaPodsの問題（iOS）

CocoaPodsの依存関係が壊れている場合の対処法:

```bash
# CocoaPodsキャッシュをクリア
cd apps/mobile/ios
rm -rf Pods Podfile.lock
pod cache clean --all
pod install --repo-update
cd ../../..
```

**エラー**: `[!] CocoaPods could not find compatible versions for pod "XXX"`

**解決方法**:

```bash
cd apps/mobile/ios
pod repo update
pod install
cd ../../..
```

### Gradleの問題（Android）

Gradleのビルドが失敗する場合の対処法:

```bash
# Gradleキャッシュをクリア
cd apps/mobile/android
./gradlew clean
./gradlew cleanBuildCache

# 依存関係を再ダウンロード
./gradlew build --refresh-dependencies

cd ../../..
```

**エラー**: `Execution failed for task ':app:mergeDebugResources'`

**解決方法**:

```bash
cd apps/mobile/android
./gradlew clean
cd ../../..
rm -rf apps/mobile/android/app/build
npm run android
```

### よくある型エラーの解決

#### エラー1: `Cannot find module '@cliptap/shared' or its corresponding type declarations`

**原因**: shared パッケージのビルドが必要

**解決方法**:

```bash
# sharedパッケージをビルド
npm run build --workspace=@cliptap/shared

# または、型チェック
npm run type-check:shared
```

#### エラー2: `Type 'XXX' is not assignable to type 'YYY'`

**原因**: 型の不一致

**解決方法**:

1. 型定義を確認（`packages/shared/src/types/*.ts`）
2. インポートパスを確認
3. 型を明示的にキャスト（最終手段）

```typescript
const data: CorrectType = result as CorrectType;
```

#### エラー3: `Property 'XXX' does not exist on type 'never'`

**原因**: 型推論が失敗している

**解決方法**:

型を明示的に指定する:

```typescript
// Before
const [data, setData] = useState([]);

// After
const [data, setData] = useState<MyType[]>([]);
```

### Expoの問題

#### エラー: `Unable to resolve "expo-router"`

**原因**: Expo Routerがインストールされていない、またはMetroの設定が間違っている

**解決方法**:

```bash
# 再インストール
npm install expo-router --workspace=@cliptap/mobile

# キャッシュクリア
npm run dev:mobile -- --clear
```

#### エラー: `Invariant Violation: "main" has not been registered`

**原因**: アプリのエントリーポイントが登録されていない

**解決方法**:

`apps/mobile/package.json`の`main`フィールドを確認:

```json
{
  "main": "expo-router/entry"
}
```

### Firebase認証の問題

#### エラー: `FirebaseError: Firebase: Error (auth/invalid-api-key)`

**原因**: Firebase APIキーが正しくない、または設定ファイルが配置されていない

**解決方法**:

1. `GoogleService-Info.plist`（iOS）を確認
2. `google-services.json`（Android）を確認
3. Firebase Consoleで設定を再確認

---

## 開発のベストプラクティス

### コーディング規約

ClipTapでは、以下のコーディング規約を推奨します。詳細は`CLAUDE.md`を参照してください。

#### コンポーネント設計

**1. 1コンポーネント1責務**

```typescript
// Good: 1つの責務に集中
export function SnippetCard({ snippet, onCopy }: Props) {
  return (
    <TouchableOpacity onPress={() => onCopy(snippet.id)}>
      <Text>{snippet.title}</Text>
    </TouchableOpacity>
  );
}

// Bad: 複数の責務を持つ
export function SnippetCardWithFormAndList() {
  // カード、フォーム、リストの処理が混在
}
```

**2. Propsは明示的な型定義**

```typescript
// Good: インターフェースで型定義
interface Props {
  snippet: Snippet;
  onCopy: (id: string) => void;
  disabled?: boolean;
}

export function SnippetCard({ snippet, onCopy, disabled = false }: Props) {
  // ...
}

// Bad: 型定義なし
export function SnippetCard(props: any) {
  // ...
}
```

**3. useEffect依存配列を正確に指定**

```typescript
// Good: 依存配列を正確に指定
useEffect(() => {
  loadSnippets();
}, [categoryId, profileId]); // 依存する値を明示

// Bad: 依存配列を省略（無限ループの危険）
useEffect(() => {
  loadSnippets();
}); // 依存配列がない
```

#### 命名規則

| 対象 | 命名規則 | 例 |
|------|---------|-----|
| ファイル名（コンポーネント） | PascalCase | `SnippetCard.tsx` |
| ファイル名（ユーティリティ） | camelCase | `dateHelpers.ts` |
| コンポーネント名 | PascalCase | `SnippetCard` |
| 関数名 | camelCase（動詞から始める） | `copySnippet()`, `loadData()` |
| 定数名 | UPPER_SNAKE_CASE | `MAX_SNIPPET_LENGTH` |
| 型名 | PascalCase | `Snippet`, `Category` |

#### パフォーマンス最適化

**1. リスト表示にはFlashListを使用**

```typescript
// Good: FlashListを使用
import { FlashList } from '@shopify/flash-list';

<FlashList
  data={snippets}
  renderItem={({ item }) => <SnippetCard snippet={item} />}
  estimatedItemSize={100}
/>

// Bad: FlatListを使用（ClipTapでは非推奨）
import { FlatList } from 'react-native';

<FlatList
  data={snippets}
  renderItem={({ item }) => <SnippetCard snippet={item} />}
/>
```

**2. useMemo/useCallbackの適切な使用**

```typescript
// Good: 高コストな計算をメモ化
const filteredSnippets = useMemo(() => {
  return snippets.filter(s => s.categoryId === selectedCategoryId);
}, [snippets, selectedCategoryId]);

// Good: コールバックをメモ化
const handleCopy = useCallback((id: string) => {
  copySnippet(id);
}, [copySnippet]);
```

**3. 検索にはデバウンス処理**

```typescript
import { useDebounce } from '../hooks/useDebounce';

export function SearchBar() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300); // 300ms固定

  useEffect(() => {
    search(debouncedQuery);
  }, [debouncedQuery]);

  return <TextInput value={query} onChangeText={setQuery} />;
}
```

### ドキュメンテーション

**コメントの書き方**:

```typescript
/**
 * スニペットをクリップボードにコピーし、変数を展開します。
 *
 * @param snippetId - コピーするスニペットのID
 * @param profileId - 使用する環境のID（省略時はアクティブな環境）
 * @returns Promise<void>
 * @throws エラーが発生した場合、Error をスロー
 */
async function copySnippet(snippetId: string, profileId?: string): Promise<void> {
  // 実装
}
```

**複雑なロジックには説明を追加**:

```typescript
// 変数展開の処理フロー:
// 1. スニペットのテキストをパース
// 2. システム変数（{{今日}}等）を展開
// 3. カスタム変数（{{名前}}等）をプロファイルから取得
// 4. 展開されたテキストをクリップボードにコピー
const expandedContent = variableParser.expand(snippet.content, profile);
```

### セキュリティ考慮事項

**1. ユーザー入力のバリデーション**

- 入力制約は [機能仕様書](./機能仕様書.md) を正とし、各画面へ同じ数値を重複定義しない
- 共有の定数・検証処理を再利用し、モバイル、Web、インポートで同じ結果にする
- タイトルは現行方針上必須・30文字、本文は必須、カテゴリは任意。実装との差を見つけた場合は機能仕様書§1.1に従い、ソースコードを正として仕様書側を合わせる

**2. SQLインジェクション対策**

```typescript
// Good: プレースホルダーを使用
await db.getAllAsync(
  'SELECT * FROM snippets WHERE category_id = ?',
  [categoryId]
);

// Bad: 文字列結合（SQLインジェクションのリスク）
await db.getAllAsync(
  `SELECT * FROM snippets WHERE category_id = '${categoryId}'`
);
```

**3. センシティブ情報の保護**

- 秘密のREST APIキー、サービスアカウント、秘密鍵、認証トークンはコードへ埋め込まず、CI Secretやローカル環境で管理する
- Firebaseクライアント設定とRevenueCat公開SDKキーは秘密鍵ではないが、用途・Bundle ID・API制限を設定する
- Webのローカル値や秘密ファイルは `.gitignore` に追加し、リポジトリへコミットしない

```bash
# .gitignore
.env
.env.local
*-service-account*.json
*.p8
```

---

## 参考リソース

### プロジェクト内ドキュメント

- **CLAUDE.md**: プロジェクト概要、アーキテクチャ、コーディング規約
- **docs/機能仕様書.md**: 機能、画面、外部IF、ファイル、DB、非機能の正本
- **docs/DEVELOPMENT.md**: 開発セットアップガイド（このファイル）

### 外部ドキュメント

#### React Native / Expo

- [Expo Documentation](https://docs.expo.dev/)
- [Expo Router Documentation](https://docs.expo.dev/router/introduction/)
- [React Native Documentation](https://reactnative.dev/docs/getting-started)
- [React Documentation](https://react.dev/)

#### データベース

- [expo-sqlite Documentation](https://docs.expo.dev/versions/latest/sdk/sqlite/)
- [SQLite Documentation](https://www.sqlite.org/docs.html)

#### 認証

- [Firebase Authentication Documentation](https://firebase.google.com/docs/auth)
- [Google Sign-In for React Native](https://github.com/react-native-google-signin/google-signin)
- [expo-apple-authentication](https://docs.expo.dev/versions/latest/sdk/apple-authentication/)

#### サブスクリプション

- [RevenueCat Documentation](https://www.revenuecat.com/docs)
- [react-native-purchases](https://github.com/RevenueCat/react-native-purchases)

#### UI/スタイリング

- [Tailwind CSS Documentation](https://tailwindcss.com/docs) (Web)
- [React Native StyleSheet](https://reactnative.dev/docs/stylesheet)

#### 多言語対応

- [i18next Documentation](https://www.i18next.com/)
- [react-i18next Documentation](https://react.i18next.com/)

### 便利なツールとライブラリ

#### 開発ツール

- **React Native Debugger**: [https://github.com/jhen0409/react-native-debugger](https://github.com/jhen0409/react-native-debugger)
- **Flipper**: [https://fbflipper.com/](https://fbflipper.com/)
- **Expo Go**: [https://expo.dev/client](https://expo.dev/client)

#### ライブラリ

- **FlashList**: [https://shopify.github.io/flash-list/](https://shopify.github.io/flash-list/)
- **React Query**: [https://tanstack.com/query/latest](https://tanstack.com/query/latest)
- **Zod**: [https://zod.dev/](https://zod.dev/)
- **Zustand**: [https://zustand-demo.pmnd.rs/](https://zustand-demo.pmnd.rs/)

#### CI/CD

- **EAS Build**: [https://docs.expo.dev/build/introduction/](https://docs.expo.dev/build/introduction/)
- **EAS Submit**: [https://docs.expo.dev/submit/introduction/](https://docs.expo.dev/submit/introduction/)
- **EAS Update**: [https://docs.expo.dev/eas-update/introduction/](https://docs.expo.dev/eas-update/introduction/)

### コミュニティとサポート

- **Expo Discord**: [https://chat.expo.dev/](https://chat.expo.dev/)
- **React Native Community**: [https://reactnative.dev/community/overview](https://reactnative.dev/community/overview)
- **Stack Overflow**: [https://stackoverflow.com/questions/tagged/expo](https://stackoverflow.com/questions/tagged/expo)

---

## まとめ

このガイドでは、ClipTapプロジェクトの開発環境セットアップから、日常的な開発ワークフロー、トラブルシューティングまでを網羅しました。

**開発を始める前の最終チェックリスト**:

- [ ] Node.js、npm、Git がインストール済み
- [ ] iOS開発環境（Xcode、CocoaPods）がセットアップ済み（macOSのみ）
- [ ] Android開発環境（Android Studio、JDK、Android SDK）がセットアップ済み
- [ ] リポジトリをクローン済み
- [ ] 依存関係をインストール済み（`npm install`）
- [ ] Firebase設定ファイルを配置済み
- [ ] 開発サーバーが起動できる（`npm run dev:mobile`）
- [ ] 型チェックが通る（`npm run type-check`）

**困ったときは**:

1. このガイドの「トラブルシューティング」セクションを確認
2. `CLAUDE.md`の「Claude Codeへの重要な指示」を確認
3. 既存のコードを参考にする（実装パターンを踏襲）
4. チームメンバーに質問する

**Happy coding!**
