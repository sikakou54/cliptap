/**
 * バリデーション関連エラー
 */

import { ClipTapError, type ErrorSeverity } from './base';

/**
 * バリデーションエラーの基底クラス
 *
 * すべてのバリデーション関連エラーはこのクラスを継承します。
 * 入力値の検証、形式チェック、重複チェックなどで使用されます。
 */
export class ValidationError extends ClipTapError {
  constructor(message: string, code: string, severity: ErrorSeverity = 'error', cause?: unknown) {
    super(message, code, severity, cause);
    this.name = 'ValidationError';
  }
}

/**
 * 空のコンテンツエラー
 *
 * スニペットのcontentフィールドが空の場合にスローされます。
 */
export class EmptyContentError extends ValidationError {
  constructor(message: string = 'Content cannot be empty') {
    super(message, 'error.empty_content');
    this.name = 'EmptyContentError';
  }
}

/**
 * 名前の重複を検出する対象
 *
 * @remarks
 * 翻訳キーを1対1で持たせるため、文字列ではなく閉じたunionにしている。
 */
export type DuplicateNameEntityType = 'category' | 'profile' | 'variable' | 'shortcut';

/**
 * 対象ごとの重複エラーの翻訳キー
 *
 * @remarks
 * `error.duplicate_${entityType}_name` のように組み立てない。
 * 組み立てると、キーの追加漏れを未定義キー検出テストも全文検索も捕まえられず、
 * 画面にキー名がそのまま出るまで気付けない。
 */
const DUPLICATE_NAME_ERROR_CODES: Record<DuplicateNameEntityType, string> = {
  category: 'error.duplicate_category_name',
  profile: 'error.duplicate_profile_name',
  variable: 'error.duplicate_variable_name',
  shortcut: 'error.duplicate_shortcut_name',
};

/**
 * 名前重複エラー
 *
 * カテゴリ、プロファイル、変数などで同じ名前が既に存在する場合にスローされます。
 */
export class DuplicateNameError extends ValidationError {
  /** エンティティタイプ（category, profile, variable等） */
  readonly entityType: DuplicateNameEntityType;

  /** 重複している名前 */
  readonly duplicateName: string;

  constructor(entityType: DuplicateNameEntityType, name: string) {
    super(`${entityType} with name "${name}" already exists`, DUPLICATE_NAME_ERROR_CODES[entityType]);
    this.name = 'DuplicateNameError';
    this.entityType = entityType;
    this.duplicateName = name;
  }
}

/**
 * リソース未検出エラー
 *
 * 指定されたIDのエンティティ（スニペット、カテゴリ等）が見つからない場合にスローされます。
 */
export class NotFoundError extends ClipTapError {
  /** エンティティタイプ（snippet, category, profile等） */
  readonly entityType: string;

  /** 見つからなかったエンティティのID */
  readonly entityId: string;

  constructor(entityType: string, id: string) {
    super(`${entityType} with id "${id}" not found`, 'error.not_found');
    this.name = 'NotFoundError';
    this.entityType = entityType;
    this.entityId = id;
  }
}

/**
 * システム変数削除エラー
 *
 * システム変数（{{today}}, {{time}}等）の削除を試みた場合にスローされます。
 * システム変数は削除できません。
 */
export class SystemVariableDeleteError extends ValidationError {
  constructor(message: string = 'System variables cannot be deleted') {
    super(message, 'error.cannot_delete_system_variable');
    this.name = 'SystemVariableDeleteError';
  }
}

/**
 * デフォルトプロファイル削除エラー
 *
 * デフォルトプロファイルの削除を試みた場合にスローされます。
 * デフォルトプロファイルは削除できません。
 */
export class DefaultProfileDeleteError extends ValidationError {
  constructor(message: string = 'Default profile cannot be deleted') {
    super(message, 'error.cannot_delete_default_profile');
    this.name = 'DefaultProfileDeleteError';
  }
}

/**
 * 無効プロファイルの標準化エラー
 *
 * 無効なプロファイルを標準に設定しようとした場合にスローされます。
 * 無効なプロファイルは変数値のフォールバック先にも、無効プロファイル指定時の
 * 振替先にもできないため、標準にはできません。
 */
export class InvalidProfileDefaultError extends ValidationError {
  constructor(message: string = 'A disabled profile cannot be set as the default') {
    super(message, 'error.cannot_set_invalid_profile_as_default');
    this.name = 'InvalidProfileDefaultError';
  }
}

/**
 * 変数名必須エラー
 *
 * 変数名が空の場合にスローされます。
 */
export class VariableNameRequiredError extends ValidationError {
  constructor(message: string = 'Variable name is required') {
    super(message, 'error.variable_name_required');
    this.name = 'VariableNameRequiredError';
  }
}

/**
 * 変数名形式エラー
 *
 * 変数名に使用できない文字が含まれている場合にスローされます。
 * 許可されているのは英数字とアンダースコアのみです。
 */
export class VariableNameInvalidError extends ValidationError {
  /** 無効な変数名 */
  readonly invalidName: string;

  constructor(name: string) {
    super(
      `Variable name "${name}" is invalid. Only alphanumeric characters and underscores are allowed.`,
      'error.variable_name_invalid'
    );
    this.name = 'VariableNameInvalidError';
    this.invalidName = name;
  }
}

/**
 * 変数名予約語エラー
 *
 * システム変数の名前（today, time等）をカスタム変数として使用しようとした場合にスローされます。
 */
export class VariableNameReservedError extends ValidationError {
  /** 予約されている変数名 */
  readonly reservedName: string;

  constructor(name: string) {
    super(
      `Variable name "${name}" is a reserved keyword`,
      'error.variable_name_reserved'
    );
    this.name = 'VariableNameReservedError';
    this.reservedName = name;
  }
}

/**
 * ショートカット値必須エラー
 *
 * ショートカットに値が1件も残らない状態で保存しようとした場合にスローされます。
 * 値を持たないショートカットは拡張キーボードから何も挿入できないため許可しません。
 */
export class ShortcutValueRequiredError extends ValidationError {
  constructor(message: string = 'A shortcut requires at least one value') {
    super(message, 'error.shortcut_value_required');
    this.name = 'ShortcutValueRequiredError';
  }
}

/**
 * ショートカット値名必須エラー
 *
 * ショートカット値の値名が空の場合にスローされます。
 */
export class ShortcutValueNameRequiredError extends ValidationError {
  constructor(message: string = 'Shortcut value name is required') {
    super(message, 'error.shortcut_value_name_required');
    this.name = 'ShortcutValueNameRequiredError';
  }
}

/**
 * 無効なRGB値エラー
 *
 * カテゴリの色のRGB値が0-255の範囲外の場合にスローされます。
 */
export class InvalidRgbValueError extends ValidationError {
  constructor(message: string = 'RGB values must be between 0 and 255') {
    super(message, 'error.invalid_rgb_values');
    this.name = 'InvalidRgbValueError';
  }
}
