/**
 * データベースアダプター
 *
 * @description
 * Mobile（expo-sqlite）とWeb（sql.js）の差異を吸収する共通インターフェース。
 * Mapper層がプラットフォームに依存せずSQLiteを操作するために使用。
 *
 * 3種類のDB用アダプターを提供:
 * - メインDB: 共有コンテナDB（アプリ・キーボード拡張で共有）
 * - システムDB: user_version管理用DB（マイグレーション時のデータ読み取り元としても使用）
 * - 一時DB: インポート（復元）処理用
 *
 * @module DbAdapter
 */

/**
 * データベースアダプターインターフェース
 */
export interface DbAdapter {
  /**
   * データベースを開く
   *
   * @description
   * 一時DBの場合: pathを指定してデータベースを開く
   * メインDBの場合: 既に開かれている場合は何もしない（no-op）
   *
   * @param path - データベースファイルのパス（一時DB用）
   */
  open(path: string): Promise<void>;

  /**
   * データベースを閉じる
   *
   * @description
   * 一時DBの場合: リソースを解放する
   * メインDBの場合: 何もしない（no-op）
   */
  close(): void;

  /**
   * 1行取得（SELECT）
   * @param sql - SQLクエリ（例: "SELECT * FROM snippets WHERE id = ?"）
   * @param params - バインドパラメータ（例: [123]）
   * @returns 結果行（存在しない場合はnull）
   */
  get<T = unknown>(sql: string, params?: unknown[]): T | null;

  /**
   * 複数行取得（SELECT）
   * @param sql - SQLクエリ（例: "SELECT * FROM snippets WHERE category_id = ?"）
   * @param params - バインドパラメータ（例: [456]）
   * @returns 結果行の配列（結果が0件の場合は空配列）
   */
  all<T = unknown>(sql: string, params?: unknown[]): T[];

  /**
   * 更新系クエリ実行（INSERT/UPDATE/DELETE）
   * @param sql - SQLクエリ（例: "INSERT INTO snippets (name, content) VALUES (?, ?)"）
   * @param params - バインドパラメータ（例: ["MySnippet", "Hello World"]）
   * @returns 実行結果（lastInsertRowId: 挿入されたID、changes: 影響を受けた行数）
   */
  run(sql: string, params?: unknown[]): DbRunResult;

  /**
   * トランザクション実行
   *
   * @description
   * 指定された関数をトランザクション内で実行。
   * 関数内で例外が発生した場合は自動的にロールバック、正常終了時はコミット。
   *
   * @param fn - トランザクション内で実行する関数
   * @returns 関数の戻り値
   */
  transaction<T>(fn: () => T): T;

  /**
   * SQL実行（DDL/複数文対応）
   *
   * @description
   * CREATE TABLE、ALTER TABLE、DROP TABLEなどのDDL文や、
   * 複数のSQL文を一度に実行する場合に使用。
   * マイグレーション処理で主に使用される。
   *
   * @param sql - 実行するSQL文（セミコロン区切りで複数文可）
   */
  exec(sql: string): Promise<void>;

  /**
   * データベースをBase64文字列としてエクスポート（オプション）
   *
   * @description
   * メインDBのバックアップで使用。
   * - Mobile: 開いている接続からSQLiteの直列化で取得してBase64化（WAL上の未反映分も含む）
   * - Web: sql.jsのdb.export()をBase64化
   *
   * @returns Base64エンコードされたデータベースバイナリ
   */
  exportAsBase64?(): Promise<string>;

  /**
   * メモリ上の変更をストレージへ書き戻す（オプション）
   *
   * @description
   * open()でファイル全体をメモリへ複製する実装（Web: sql.js）向け。
   * exec()やrun()による変更はメモリ上にしか存在しないため、
   * close()の前にこれを呼ばないと変更が失われる。
   * ファイルを直接操作する実装（Mobile: expo-sqlite）では不要のため未実装。
   */
  persist?(): Promise<void>;

  /**
   * データベースが開かれているかを確認（オプション）
   *
   * @description
   * 主にWeb版で使用。データベースの状態確認に使用。
   *
   * @returns 開かれている場合はtrue
   */
  isOpen?(): boolean;

  /**
   * 現在開いているDBのパスを取得（オプション）
   *
   * @description
   * 主にWeb版で使用。現在のデータベースファイルパスを取得。
   *
   * @returns 現在開いているDBのパス、開かれていない場合はnull
   */
  getCurrentPath?(): string | null;
}

/**
 * run()の実行結果
 */
export interface DbRunResult {
  /** 最後に挿入された行のID（INSERTの場合のみ有効、それ以外は0や不定値） */
  lastInsertRowId: number;
  /** 影響を受けた行数（UPDATE/DELETEで変更・削除された行数） */
  changes: number;
}

/* ======================================== */
/* アダプターインスタンス管理 */
/* ======================================== */

let currentMainDbAdapter: DbAdapter | null = null;
let currentSystemDbAdapter: DbAdapter | null = null;
let currentTempDbAdapter: DbAdapter | null = null;

/* ======================================== */
/* メインDB用アダプター管理 */
/* ======================================== */

/**
 * メインDB用DbAdapterを登録
 * @param adapter - プラットフォーム固有のDbAdapter実装
 */
export function setMainDbAdapter(adapter: DbAdapter): void {
  currentMainDbAdapter = adapter;
}

/**
 * 登録済みのメインDB用DbAdapterを取得
 * @returns 登録済みのメインDB用DbAdapter
 * @throws {Error} MainDbAdapterが未登録の場合
 */
export function getMainDbAdapter(): DbAdapter {
  if (!currentMainDbAdapter) {
    throw new Error('MainDbAdapter is not set. Call setMainDbAdapter() at startup.');
  }
  return currentMainDbAdapter;
}

/**
 * メインDB用DbAdapterが登録済みか確認
 * @returns 登録済みの場合true
 */
export function hasMainDbAdapter(): boolean {
  return currentMainDbAdapter !== null;
}

/* ======================================== */
/* システムDB用アダプター管理 */
/* ======================================== */

/**
 * システムDB用DbAdapterを登録
 *
 * @description
 * user_version（スキーマバージョン）管理用のアダプター。
 * マイグレーション処理で旧バージョンのDBを操作する際にも使用。
 *
 * @param adapter - プラットフォーム固有のDbAdapter実装
 */
export function setSystemDbAdapter(adapter: DbAdapter): void {
  currentSystemDbAdapter = adapter;
}

/**
 * 登録済みのシステムDB用DbAdapterを取得
 * @returns 登録済みのシステムDB用DbAdapter
 * @throws {Error} SystemDbAdapterが未登録の場合
 */
export function getSystemDbAdapter(): DbAdapter {
  if (!currentSystemDbAdapter) {
    throw new Error('SystemDbAdapter is not set. Call setSystemDbAdapter() at startup.');
  }
  return currentSystemDbAdapter;
}

/* ======================================== */
/* 一時DB用アダプター管理 */
/* ======================================== */

/**
 * 一時DB用DbAdapterを登録
 *
 * @description
 * インポート（復元）処理で使用する一時DB用のアダプターを登録。
 *
 * @param adapter - プラットフォーム固有の一時DB用DbAdapter実装
 */
export function setTempDbAdapter(adapter: DbAdapter): void {
  currentTempDbAdapter = adapter;
}

/**
 * 登録済みの一時DB用DbAdapterを取得
 * @returns 登録済みの一時DB用DbAdapter
 * @throws {Error} TempDbAdapterが未登録の場合
 */
export function getTempDbAdapter(): DbAdapter {
  if (!currentTempDbAdapter) {
    throw new Error('TempDbAdapter is not set. Call setTempDbAdapter() at startup.');
  }
  return currentTempDbAdapter;
}

/**
 * 一時DB用DbAdapterが登録済みか確認
 * @returns 登録済みの場合true
 */
export function hasTempDbAdapter(): boolean {
  return currentTempDbAdapter !== null;
}

