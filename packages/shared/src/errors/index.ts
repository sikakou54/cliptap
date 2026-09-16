/**
 * @module errors
 * @description ClipTapアプリ共通のカスタム例外クラス
 *
 * 例外階層:
 * この図は base.ts / database.ts / validation.ts / importExport.ts / misc.ts の実装を写したもの。
 * クラスを追加・削除したら同じ変更でこの図も更新する。
 * ```
 * Error
 * └── ClipTapError (基底クラス)
 *     ├── DatabaseError (データベース関連)
 *     ├── ValidationError (バリデーション関連)
 *     │   ├── EmptyContentError
 *     │   ├── DuplicateNameError
 *     │   ├── SystemVariableDeleteError
 *     │   ├── DefaultProfileDeleteError
 *     │   ├── InvalidProfileDefaultError
 *     │   ├── VariableNameRequiredError
 *     │   ├── VariableNameInvalidError
 *     │   ├── VariableNameReservedError
 *     │   └── InvalidRgbValueError
 *     ├── NotFoundError (リソース未検出。validation.ts にあるが ValidationError の配下ではない)
 *     ├── ImportExportError (インポート/エクスポート関連)
 *     │   ├── IncorrectPasswordError
 *     │   ├── ChecksumMismatchError
 *     │   ├── VersionMismatchError
 *     │   ├── NewerVersionError
 *     │   ├── InvalidFileTypeError
 *     │   ├── InvalidFileFormatError
 *     │   ├── PasswordRequiredError
 *     │   ├── ExportFailedError
 *     │   └── RestoreFailedError
 *     └── EnvironmentError (実行環境関連)
 * ```
 */

/* ======================================== */
/* 基底クラス */
/* ======================================== */
export { ClipTapError, type ErrorSeverity } from './base';

/* ======================================== */
/* データベース関連 */
/* ======================================== */
export { DatabaseError } from './database';

/* ======================================== */
/* バリデーション関連 */
/* ======================================== */
export {
  ValidationError,
  EmptyContentError,
  DuplicateNameError,
  NotFoundError,
  SystemVariableDeleteError,
  DefaultProfileDeleteError,
  InvalidProfileDefaultError,
  VariableNameRequiredError,
  VariableNameInvalidError,
  VariableNameReservedError,
  InvalidRgbValueError,
} from './validation';

/* ======================================== */
/* インポート/エクスポート関連 */
/* ======================================== */
export {
  ImportExportError,
  IncorrectPasswordError,
  ChecksumMismatchError,
  VersionMismatchError,
  NewerVersionError,
  InvalidFileTypeError,
  InvalidFileFormatError,
  PasswordRequiredError,
  ExportFailedError,
  RestoreFailedError,
} from './importExport';

/* ======================================== */
/* その他 */
/* ======================================== */
export {
  EnvironmentError,
} from './misc';
