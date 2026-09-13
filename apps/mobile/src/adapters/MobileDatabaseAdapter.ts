/**
 * Mobile用DbAdapter
 *
 * @description
 * expo-sqliteをラップして、共通DbAdapterインターフェースを実装。
 * open(path)で動的にデータベースを開く（メインDB/一時DB両対応）。
 *
 * @module MobileDatabaseAdapter
 */

import * as SQLite from 'expo-sqlite';
import {
  type DbAdapter,
  type DbRunResult,
  type FileIOAdapter,
  getFileName,
  getDirectoryPath,
  Logger,
  uint8ArrayToBase64,
} from '@cliptap/shared';

export interface MobileDatabaseAdapterOptions {
  fileIO: FileIOAdapter;
}

export class MobileDatabaseAdapter implements DbAdapter {
  private db: SQLite.SQLiteDatabase | null = null;
  private fileIO: FileIOAdapter | null = null;

  constructor(options: MobileDatabaseAdapterOptions) {
    this.fileIO = options.fileIO;
  }

  async open(path: string): Promise<void> {
    /* 既に開いているデータベースがある場合は先に閉じる（複数DBの切り替え対応） */
    if (this.db) {
      this.close();
    }

    /* パスからファイル名とディレクトリパスを抽出 */
    const fileName = getFileName(path);
    const dirPath = getDirectoryPath(path);

    /* ディレクトリが存在しない場合は作成（一時DB用のディレクトリ確保） */
    if (this.fileIO) {
      const exists = await this.fileIO.exists(dirPath);
      if (!exists) {
        await this.fileIO.makeDirectory(dirPath);
      }
    }

    /* expo-sqlite: openDatabaseAsync(fileName, options, dirPath)形式で開く */
    this.db = await SQLite.openDatabaseAsync(fileName, undefined, dirPath);
  }

  close(): void {
    if (!this.db) return;

    try {
      /* DbAdapterの同期close契約を守り、直後の再openや一時ファイル削除との競合を防ぐ */
      this.db.closeSync();
    } catch (error) {
      /* closeはfinallyから呼ばれるため、ここで送出すると本来のエラーを置き換えてしまう */
      Logger.warn('[MobileDatabaseAdapter] Failed to close database:', error);
    } finally {
      /* close失敗でも参照を捨て、壊れたハンドルを以降のopenで触らせない */
      this.db = null;
    }
  }

  /**
   * データベースインスタンスを取得（nullチェック付き）
   * @returns 開かれているデータベースインスタンス
   * @throws {Error} データベースが開かれていない場合
   */
  private getDb(): SQLite.SQLiteDatabase {
    if (!this.db) {
      throw new Error('MobileDatabaseAdapter: Database is not opened. Call open(path) first.');
    }
    return this.db;
  }

  get<T = unknown>(sql: string, params: unknown[] = []): T | null {
    return this.getDb().getFirstSync<T>(sql, params as (string | number | null)[]);
  }

  all<T = unknown>(sql: string, params: unknown[] = []): T[] {
    return this.getDb().getAllSync<T>(sql, params as (string | number | null)[]);
  }

  run(sql: string, params: unknown[] = []): DbRunResult {
    const result = this.getDb().runSync(sql, params as (string | number | null)[]);

    return {
      lastInsertRowId: result.lastInsertRowId,
      changes: result.changes,
    };
  }

  transaction<T>(fn: () => T): T {
    const db = this.getDb();
    let result: T;

    /* トランザクション開始 */
    db.execSync('BEGIN TRANSACTION;');

    try {
      /* トランザクション内で関数を実行 */
      result = fn();
      /* 正常終了時はコミット */
      db.execSync('COMMIT;');
    } catch (error) {
      /* エラー発生時はロールバック（変更を破棄） */
      db.execSync('ROLLBACK;');
      throw error;
    }

    return result;
  }

  async exec(sql: string): Promise<void> {
    await this.getDb().execAsync(sql);
  }

  /**
   * データベースをBase64文字列として出力する
   *
   * @remarks
   * ファイルを直接読むと、キーボード拡張が書き込んでまだチェックポイントされていない
   * WAL上の内容を取りこぼす。開いている接続からSQLiteの直列化で取得し、その時点の内容を丸ごと得る。
   * 他の操作はすべてJSスレッドの同期APIで行っているため、同じ接続を別スレッドから触らないよう同期版を使う。
   */
  async exportAsBase64(): Promise<string> {
    return uint8ArrayToBase64(this.getDb().serializeSync());
  }
}
