/**
 * DatabaseFileManager - データベースファイルパス管理
 *
 * 共有コンテナDBとManageDBのファイルパス取得・存在チェックを担当します。
 *
 * 依存注入パターン:
 * すべての関数はFileIOAdapterを引数で受け取ります。
 * これにより、Adapter登録順序への暗黙的な依存を排除し、
 * テスト容易性と明示的な依存関係を実現します。
 */

import { FileIOAdapter, Logger } from '@cliptap/shared';

const APP_GROUP_IDENTIFIER = 'group.com.sikakou.cliptap';
const DB_FILE_NAME = 'cliptap.db';

/**
 * 共有コンテナディレクトリからDBファイルパスを組み立てる
 *
 * getAppGroupDirectory() が末尾スラッシュ付きで返す場合があるため、
 * 連結前に取り除いて区切りが二重にならないようにしている。
 *
 * @param sharedDir - App Groupの共有コンテナディレクトリ
 * @returns DBファイルの素のパス（URIスキームは付けない）
 */
function buildSharedDbPath(sharedDir: string): string {
  return `${sharedDir.replace(/\/$/, '')}/${DB_FILE_NAME}`;
}

/**
 * メインDBファイルパスを取得
 *
 * メインアプリとキーボード拡張機能でデータベースを共有するため、
 * 共有コンテナ内のデータベースファイルパスを取得します。
 *
 * - iOS: App Groupの共有コンテナディレクトリ
 * - Android: files/group.com.sikakou.cliptap/databases
 *
 * Web版の getMainDatabasePath() と同様の役割を果たします。
 * 同じ共有コンテナDBを指す getSharedDatabaseFile() とは戻り値と失敗時の扱いが異なり、
 * こちらは `file://` 付きURIを返し、失敗時は例外ではなく null を返す（存在チェック用）。
 */
async function getMainDatabasePath(
  fileIO: FileIOAdapter
): Promise<string | null> {
  try {
    const sharedDir = await fileIO.getAppGroupDirectory(APP_GROUP_IDENTIFIER);

    if (!sharedDir) {
      Logger.error(`[Get Shared Container DB] App Group container not found: ${APP_GROUP_IDENTIFIER}`);
      return null;
    }

    const dbPath = buildSharedDbPath(sharedDir);
    const dbUri = `file://${dbPath}`;

    Logger.info(`[Get Shared Container DB] Path: ${dbUri}`);
    return dbUri;
  } catch (error) {
    Logger.error('Failed to get shared container database file:', error);
    return null;
  }
}

/**
 * SystemDatabaseファイルパスを取得（Documents/SQLite内）
 *
 * user_version（スキーマバージョン）を管理するデータベースファイルパスを取得します。
 * マイグレーション時のデータ読み取り元としても使用します。
 */
export async function getSystemDatabaseFile(fileIO: FileIOAdapter): Promise<string> {
  try {
    const docDir = fileIO.getDocumentDirectory();
    const dbPath = `${docDir.replace(/\/$/, '')}/SQLite/cliptap.db`;

    Logger.info(`[Get System DB] Path: ${dbPath}`);
    return dbPath;
  } catch (error) {
    Logger.error('Failed to get system database file:', error);
    return '';
  }
}

/**
 * 共有コンテナDBファイルパスを取得
 *
 * App Groupの共有コンテナ内DBの素のパスを返します。
 * コンテナが取得できなければ例外を投げます（ディレクトリの作成は行いません）。
 */
export async function getSharedDatabaseFile(
  fileIO: FileIOAdapter
): Promise<string> {
  const sharedDir = await fileIO.getAppGroupDirectory(APP_GROUP_IDENTIFIER);

  if (!sharedDir) {
    throw new Error(`App Group container not found: ${APP_GROUP_IDENTIFIER}`);
  }

  return buildSharedDbPath(sharedDir);
}

/**
 * メインDBファイルが存在するかチェック
 */
export async function checkMainDatabaseExists(
  fileIO: FileIOAdapter
): Promise<boolean> {
  const mainDbUri = await getMainDatabasePath(fileIO);
  if (!mainDbUri) return false;

  const exists = await fileIO.exists(mainDbUri);
  Logger.info(`[Main DB Check] Exists: ${exists}`);
  return exists;
}

/**
 * SystemDatabaseファイルが存在するかチェック
 */
export async function checkSystemDatabaseExists(
  fileIO: FileIOAdapter
): Promise<boolean> {
  const systemDbUri = await getSystemDatabaseFile(fileIO);
  if (!systemDbUri) return false;

  const exists = await fileIO.exists(systemDbUri);
  Logger.info(`[System DB Check] Exists: ${exists}`);
  return exists;
}
