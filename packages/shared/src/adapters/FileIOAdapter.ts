/**
 * ファイルI/Oアダプター
 *
 * @description
 * Mobile（expo-file-system）とWeb（Blob + fetch）の差異を吸収する共通インターフェース。
 * 純粋なファイル操作のみを提供し、UI関連機能（ファイル選択・共有）は別Adapterに分離。
 * バックアップ・復元処理、App Group共有コンテナアクセスで使用。
 *
 * @module FileIOAdapter
 */

/**
 * ファイル情報
 */
export interface FileInfo {
  exists: boolean;
  isDirectory: boolean;
  size?: number;
  uri: string;
  modificationTime?: number;
}

/**
 * ファイルI/Oアダプターインターフェース
 */
export interface FileIOAdapter {
  /**
   * ファイルを読み込み（テキスト）
   * @param uri - ファイルのURI
   * @returns ファイルの内容（UTF-8テキスト）
   */
  readFile(uri: string): Promise<string>;

  /**
   * ファイルを読み込み（Base64）
   * @param uri - ファイルのURI
   * @returns ファイルの内容（Base64文字列）
   */
  readBinary(uri: string): Promise<string>;

  /**
   * ファイルを書き込み
   * @param filename - ファイル名
   * @param content - ファイルの内容（テキストまたはBase64文字列）
   * @param options - オプション (encoding: 'utf8' | 'base64')
   * @returns 保存されたファイルのURI
   */
  writeFile(filename: string, content: string, options?: { encoding?: 'utf8' | 'base64' }): Promise<string>;

  /**
   * ファイルを削除
   */
  deleteFile(uri: string): Promise<void>;

  /**
   * ファイル/ディレクトリの存在確認
   */
  exists(uri: string): Promise<boolean>;

  /**
   * ファイル情報を取得
   */
  getInfo(uri: string): Promise<FileInfo>;

  /**
   * ディレクトリを作成
   */
  makeDirectory(uri: string): Promise<void>;

  /**
   * ドキュメントディレクトリのパスを取得
   */
  getDocumentDirectory(): string;

  /**
   * App Group共有コンテナディレクトリのパスを取得
   *
   * @description
   * iOSのアプリとキーボード拡張でデータベースを共有するために使用。
   *
   * @param identifier - App Group Identifier
   * @returns ディレクトリパス（サポートしていない環境ではnull）
   */
  getAppGroupDirectory(identifier: string): Promise<string | null>;
}

/* ======================================== */
/* アダプターインスタンス管理 */
/* ======================================== */

let currentFileIOAdapter: FileIOAdapter | null = null;

/**
 * FileIOAdapterを登録
 * @param adapter - プラットフォーム固有のFileIOAdapter実装
 */
export function setFileIOAdapter(adapter: FileIOAdapter): void {
  currentFileIOAdapter = adapter;
}

/**
 * 登録済みのFileIOAdapterを取得
 * @returns 登録済みのFileIOAdapter
 * @throws {Error} FileIOAdapterが未登録の場合
 */
export function getFileIOAdapter(): FileIOAdapter {
  if (!currentFileIOAdapter) {
    throw new Error('FileIOAdapter has not been initialized. Call setFileIOAdapter() first.');
  }
  return currentFileIOAdapter;
}

