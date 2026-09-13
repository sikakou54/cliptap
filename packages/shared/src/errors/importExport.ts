/**
 * インポート/エクスポート関連エラー
 */

import { ClipTapError, type ErrorSeverity } from './base';

/**
 * インポート/エクスポートエラーの基底クラス
 *
 * すべてのインポート/エクスポート関連エラーはこのクラスを継承します。
 * バックアップファイルの読み書き、検証、復元時に使用されます。
 */
export class ImportExportError extends ClipTapError {
  constructor(message: string, code: string, severity: ErrorSeverity = 'error', cause?: unknown) {
    super(message, code, severity, cause);
    this.name = 'ImportExportError';
  }
}

/**
 * パスワード不正エラー
 *
 * インポート時に入力されたパスワードが正しくない場合にスローされます。
 */
export class IncorrectPasswordError extends ImportExportError {
  constructor(message: string = 'Incorrect password') {
    super(message, 'error.incorrect_password');
    this.name = 'IncorrectPasswordError';
  }
}

/**
 * チェックサム不一致エラー
 *
 * インポートデータのチェックサム検証が失敗した場合にスローされます。
 * データが改竄されている可能性があります。
 */
export class ChecksumMismatchError extends ImportExportError {
  constructor(message: string = 'Data checksum mismatch') {
    super(message, 'error.checksum_mismatch');
    this.name = 'ChecksumMismatchError';
  }
}

/**
 * バージョン不一致エラー
 *
 * インポートファイルのバージョンがサポート範囲外の場合にスローされます。
 * ファイルバージョンが古すぎる場合（最小サポートバージョン未満）に使用。
 */
export class VersionMismatchError extends ImportExportError {
  /** 期待されるバージョン */
  readonly expectedVersion: number;

  /** 実際のバージョン */
  readonly actualVersion: number;

  constructor(expectedVersion: number, actualVersion: number) {
    super(
      `Version mismatch: expected ${expectedVersion}, got ${actualVersion}`,
      'error.version_mismatch'
    );
    this.name = 'VersionMismatchError';
    this.expectedVersion = expectedVersion;
    this.actualVersion = actualVersion;
  }
}

/**
 * 新しいバージョンエラー
 *
 * インポートファイルのバージョンが現在のアプリスキーマより新しい場合にスローされます。
 * アプリのアップデートが必要な場合に使用。
 */
export class NewerVersionError extends ImportExportError {
  /** 現在のスキーマバージョン */
  readonly currentVersion: number;

  /** ファイルのバージョン */
  readonly fileVersion: number;

  constructor(currentVersion: number, fileVersion: number) {
    super(
      `File version ${fileVersion} is newer than app version ${currentVersion}. Please update the app.`,
      'error.newer_version'
    );
    this.name = 'NewerVersionError';
    this.currentVersion = currentVersion;
    this.fileVersion = fileVersion;
  }
}


/**
 * 無効なファイル形式エラー
 *
 * 選択されたファイルが.cliptap形式ではない場合にスローされます。
 */
export class InvalidFileTypeError extends ImportExportError {
  constructor(message: string = 'Invalid file type') {
    super(message, 'error.invalid_file_type');
    this.name = 'InvalidFileTypeError';
  }
}

/**
 * 無効なファイルフォーマットエラー
 *
 * ファイルの内容が正しいJSON形式ではない場合にスローされます。
 */
export class InvalidFileFormatError extends ImportExportError {
  constructor(message: string = 'Invalid file format') {
    super(message, 'error.invalid_file_format');
    this.name = 'InvalidFileFormatError';
  }
}

/**
 * パスワード必須エラー
 *
 * パスワード保護されたファイルをインポートする際にパスワードが未入力の場合にスローされます。
 */
export class PasswordRequiredError extends ImportExportError {
  constructor(message: string = 'Password is required') {
    super(message, 'error.password_required');
    this.name = 'PasswordRequiredError';
  }
}

/**
 * エクスポート失敗エラー
 *
 * エクスポート処理全般が失敗した場合にスローされます。
 */
export class ExportFailedError extends ImportExportError {
  constructor(message: string = 'Export failed', cause?: unknown) {
    super(message, 'error.generic', 'error', cause);
    this.name = 'ExportFailedError';
  }
}


/**
 * 復元失敗エラー
 *
 * バックアップファイルによる復元（全件置換）が失敗した場合にスローされます。
 */
export class RestoreFailedError extends ImportExportError {
  constructor(message: string = 'Restore failed', cause?: unknown) {
    super(message, 'error.generic', 'error', cause);
    this.name = 'RestoreFailedError';
  }
}
