# ClipTap

ClipTapは、定型文をローカルで管理し、変数を展開してクリップボードまたは拡張キーボードからすばやく入力するモバイル・Webアプリです。

業務データは端末・ブラウザ内に保存します。モバイルとWebのデータ交換には `.cliptap` ファイルを使い、FirebaseアカウントはPro権利の共有にだけ使用します。

## 主な機能

- 定型文、カテゴリ、プロファイル、カスタム変数の管理
- 日付・時刻などのシステム変数とプロファイル別変数値の展開
- 検索、絞り込み、4種類の並べ替え、プレビュー、コピー
- iOS / Android拡張キーボードからの直接入力
- `.cliptap` による全データのバックアップと、全件置換による復元
- Free / Pro、広告、Google / Appleアカウント連携
- 日本語・英語、ライト・ダーク表示

> `.cliptap` の内容は二重Base64であり暗号化されません。機密性が必要な場合は、保存先や送信経路を別途保護してください。

## 構成

| ワークスペース | 技術 | 役割 |
|---|---|---|
| `apps/mobile` | Expo SDK 57、React Native 0.86、SQLite | iOS / Androidアプリとネイティブキーボード |
| `apps/web` | React 19、Vite 7、SQLite WASM | Webアプリとランディングページ |
| `packages/shared` | TypeScript、Zod | 型、業務ロジック、DBスキーマ、日英翻訳の共有 |

現行はアプリ版1.4.0、DBスキーマV8です。最低対応OSはiOS / iPadOS 17.0、Android 7.0（API 24）です。

## セットアップ

必要環境はNode.js 22以上（`package.json` の `engines` と同じ。CI・Web配信ジョブも22で動く）とnpmです。iOS開発にはXcode、Android開発にはAndroid StudioとJDK 17も必要です。

```bash
npm install
npm run dev:mobile   # Expo開発サーバー
npm run dev:web      # Vite開発サーバー
```

確認コマンド:

```bash
npm run type-check
npm run lint
npm run build:web
```

ネイティブ設定、環境変数、ビルド、トラブルシューティングは開発ガイドを参照してください。

## ドキュメント

- [機能仕様書](docs/機能仕様書.md) — 機能、画面、外部IF、ファイル、DB、非機能の正本
- [開発ガイド](docs/DEVELOPMENT.md) — セットアップ、開発、テスト、ビルド、配布
- [マーケティング戦略](docs/MARKETING_STRATEGY.md) — ASO、広告、グロース施策
- [開発ルール](CLAUDE.md) — リポジトリで守る実装・運用ルール
