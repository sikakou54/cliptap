/**
 * ベース`.cliptap`ファイル生成スクリプト
 *
 * @description
 * モバイルアプリを持たない利用者がWebだけで利用を開始できるように、
 * サンプルデータ入りのベースファイルを`apps/web/public/`へ生成する。
 *
 * 生成物:
 * - `public/starter_v{SCHEMA_VERSION}_ja.cliptap`
 * - `public/starter_v{SCHEMA_VERSION}_en.cliptap`
 *
 * 実行方法:
 * ```
 * npm run generate:starter --workspace=@cliptap/web
 * ```
 *
 * スキーマのCREATE文・エクスポート形式・パスワードは実装から読み込むため、
 * このスクリプト内にそれらを再定義しないこと。
 * ただしサンプル投入時のカラム列挙（buildDatabase）と、件数検証のテーブル一覧
 * （verifyExportJson の expected）はこのスクリプトが手書きで持っているため、
 * SCHEMA_VERSION を更新するときは両方の見直しが必要。
 *
 * @module scripts/generateStarterFile
 */

import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import initSqlJs from 'sql.js';
import { createServer } from 'vite';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const WEB_DIR = resolve(SCRIPT_DIR, '..');
const REPO_ROOT = resolve(WEB_DIR, '../..');
const PUBLIC_DIR = join(WEB_DIR, 'public');

/**
 * デフォルトプロファイル名
 *
 * @remarks
 * `createDefaultProfileIfNeeded()`が作成する名前と一致させる。
 */
const DEFAULT_PROFILE_NAME = 'Main';

/**
 * 生成物を再現可能にするための固定日時（ISO 8601）
 *
 * @remarks
 * 実行のたびに内容が変わるとGitの差分がノイズになるため、日時は固定する。
 */
const FIXED_TIMESTAMP = '2026-01-01T00:00:00.000Z';

/**
 * 定型文の作成日時をずらす間隔（ミリ秒）
 *
 * @remarks
 * 一覧は`createdAt ASC`で並ぶため、定義順で表示されるよう1件ずつずらす。
 */
const SNIPPET_TIMESTAMP_STEP_MS = 1000;

/**
 * Viteのモジュールランナーを起動する
 *
 * @description
 * スキーマ定義・エクスポート形式・定数はいずれもTypeScriptの実装ファイルにある。
 * Node単体では`index`解決やパスエイリアスを扱えないため、Vite経由で読み込む。
 *
 * @returns Viteの開発サーバー
 */
async function createModuleLoader() {
  return createServer({
    configFile: false,
    root: REPO_ROOT,
    logLevel: 'error',
    appType: 'custom',
    server: { middlewareMode: true, hmr: false },
  });
}

/**
 * SHA-256ハッシュを16進数文字列で計算する
 *
 * @param input - ハッシュ対象の文字列
 * @returns 16進数のハッシュ値
 */
function sha256(input) {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * サンプルデータを投入した空のSQLiteデータベースを構築する
 *
 * @param SQL - 初期化済みのsql.jsモジュール
 * @param schema - `packages/shared/src/database/schema.ts`のエクスポート
 * @param dataset - 対象言語のサンプルデータ定義
 * @returns SQLiteのバイナリ
 */
function buildDatabase(SQL, schema, dataset) {
  const db = new SQL.Database();

  try {
    /* 1. スキーマ（テーブル・インデックス）を作成 */
    for (const createTableSql of Object.values(schema.CREATE_TABLES)) {
      db.run(createTableSql);
    }
    for (const createIndexSql of Object.values(schema.CREATE_INDEXES)) {
      db.run(createIndexSql);
    }
    db.run(`PRAGMA user_version = ${schema.SCHEMA_VERSION}`);

    /* 2. デフォルトプロファイルを作成（アプリ初期化時と同じ「Main」） */
    const profileId = 'starter-profile-main';
    db.run(
      `INSERT INTO profiles (id, name, isDefault, isActive, valid, sortOrder, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [profileId, DEFAULT_PROFILE_NAME, 1, 1, 1, 0, FIXED_TIMESTAMP, FIXED_TIMESTAMP]
    );

    /* 3. カテゴリを作成し、キーからIDを引けるようにする */
    const categoryIds = new Map();
    dataset.categories.forEach((category, index) => {
      const id = `starter-category-${category.key}`;
      db.run(
        `INSERT INTO categories (id, name, color, sortOrder, createdAt) VALUES (?, ?, ?, ?, ?)`,
        [id, category.name, category.color, index, FIXED_TIMESTAMP]
      );
      categoryIds.set(category.key, id);
    });

    /* 4. カスタム変数と、デフォルトプロファイルにおける値を作成 */
    dataset.variables.forEach((variable, index) => {
      const id = `starter-variable-${variable.name}`;
      db.run(
        `INSERT INTO variables (id, name, type, label, icon, valid, sortOrder, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, variable.name, 'custom', variable.label, variable.icon, 1, index, FIXED_TIMESTAMP, FIXED_TIMESTAMP]
      );
      db.run(
        `INSERT INTO profile_variables (id, profileId, variableId, value, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          `starter-profile-variable-${variable.name}`,
          profileId,
          id,
          variable.value,
          FIXED_TIMESTAMP,
          FIXED_TIMESTAMP,
        ]
      );
    });

    /* 5. 定型文を作成（snippet_profilesへ登録しないことで全プロファイルに表示） */
    /* copyWithTitleは定義側の任意項目。省略時はタイトルを結合しない（0）とする */
    const baseTime = new Date(FIXED_TIMESTAMP).getTime();
    dataset.snippets.forEach((snippet, index) => {
      const createdAt = new Date(baseTime + index * SNIPPET_TIMESTAMP_STEP_MS).toISOString();
      db.run(
        `INSERT INTO snippets (id, title, content, categoryId, copyWithTitle, copyCount, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `starter-snippet-${snippet.key}`,
          snippet.title,
          snippet.content,
          categoryIds.get(snippet.categoryKey) ?? null,
          snippet.copyWithTitle ? 1 : 0,
          0,
          createdAt,
          createdAt,
        ]
      );
    });

    return db.export();
  } finally {
    db.close();
  }
}

/**
 * SQLiteバイナリを`.cliptap`のJSON文字列へ変換する
 *
 * @param dbBytes - SQLiteのバイナリ
 * @param schemaVersion - データベーススキーマバージョン
 * @param password - 読み込み用パスワード
 * @param exportUtils - `exportImportUtils`のエクスポート
 * @returns `.cliptap`ファイルの内容（JSON文字列）
 */
function buildExportJson(dbBytes, schemaVersion, password, exportUtils) {
  const doubleBase64 = exportUtils.base64ToDoubleBase64(exportUtils.uint8ArrayToBase64(dbBytes));
  const passwordHash = sha256(exportUtils.buildPasswordHashInput(password, schemaVersion));
  const checksum = sha256(
    exportUtils.buildChecksumPayload({
      s: schemaVersion,
      t: FIXED_TIMESTAMP,
      h: passwordHash,
      d: doubleBase64,
    })
  );

  return JSON.stringify({
    s: schemaVersion,
    t: FIXED_TIMESTAMP,
    h: passwordHash,
    d: doubleBase64,
    c: checksum,
  });
}

/**
 * 生成したファイルがアプリの検証ロジックを通過することを確認する
 *
 * @description
 * パスワードハッシュ・チェックサム・スキーマバージョンの検証は
 * `ImportParserService`と同じ手順で行い、投入した件数も突き合わせる。
 *
 * @param SQL - 初期化済みのsql.jsモジュール
 * @param json - 生成した`.cliptap`のJSON文字列
 * @param schema - `schema.ts`のエクスポート
 * @param exportUtils - `exportImportUtils`のエクスポート
 * @param password - 読み込み用パスワード
 * @param dataset - 対象言語のサンプルデータ定義
 * @throws {Error} 検証に失敗した場合
 */
function verifyExportJson(SQL, json, schema, exportUtils, password, dataset) {
  const data = JSON.parse(json);

  if (data.s !== schema.SCHEMA_VERSION) {
    throw new Error(`Schema version mismatch: ${data.s} !== ${schema.SCHEMA_VERSION}`);
  }
  if (data.h !== sha256(exportUtils.buildPasswordHashInput(password, data.s))) {
    throw new Error('Password hash verification failed');
  }
  const expectedChecksum = sha256(
    exportUtils.buildChecksumPayload({ s: data.s, t: data.t, h: data.h, d: data.d })
  );
  if (data.c !== expectedChecksum) {
    throw new Error('Checksum verification failed');
  }

  /* デコードしたバイナリを開き、投入したデータが読み出せることを確認 */
  const db = new SQL.Database(exportUtils.decodeDoubleBase64ToUint8Array(data.d));
  try {
    const countOf = (table) => db.exec(`SELECT COUNT(*) FROM ${table}`)[0].values[0][0];
    const expected = {
      profiles: 1,
      categories: dataset.categories.length,
      variables: dataset.variables.length,
      profile_variables: dataset.variables.length,
      snippets: dataset.snippets.length,
      snippet_profiles: 0,
      system_variable_formats: 0,
      shortcuts: 0,
      shortcut_profiles: 0,
    };
    for (const [table, count] of Object.entries(expected)) {
      const actual = countOf(table);
      if (actual !== count) {
        throw new Error(`Row count mismatch in ${table}: ${actual} !== ${count}`);
      }
    }
  } finally {
    db.close();
  }
}

/**
 * ベースファイルを生成する
 */
async function main() {
  const server = await createModuleLoader();

  try {
    /* 実装からスキーマ・エクスポート形式・パスワードを読み込む */
    const schema = await server.ssrLoadModule(
      join(REPO_ROOT, 'packages/shared/src/database/schema.ts')
    );
    const exportUtils = await server.ssrLoadModule(
      join(REPO_ROOT, 'packages/shared/src/utils/exportImportUtils.ts')
    );
    const starterFile = await server.ssrLoadModule(
      join(WEB_DIR, 'src/constants/starterFile.ts')
    );

    const dataset = JSON.parse(await readFile(join(SCRIPT_DIR, 'starterData.json'), 'utf8'));

    const require = createRequire(import.meta.url);
    const sqlJsDir = dirname(require.resolve('sql.js'));
    const SQL = await initSqlJs({ locateFile: (file) => join(sqlJsDir, file) });

    for (const language of starterFile.STARTER_FILE_LANGUAGES) {
      const languageDataset = dataset[language];
      if (!languageDataset) {
        throw new Error(`starterData.json has no dataset for language: ${language}`);
      }

      const dbBytes = buildDatabase(SQL, schema, languageDataset);
      const json = buildExportJson(
        dbBytes,
        schema.SCHEMA_VERSION,
        starterFile.STARTER_FILE_PASSWORD,
        exportUtils
      );
      verifyExportJson(SQL, json, schema, exportUtils, starterFile.STARTER_FILE_PASSWORD, languageDataset);

      const fileName = starterFile.getStarterFileName(schema.SCHEMA_VERSION, language);
      await writeFile(join(PUBLIC_DIR, fileName), json, 'utf8');
      console.log(`[generate:starter] public/${fileName} (${json.length} bytes)`);
    }
  } finally {
    await server.close();
  }
}

await main();
