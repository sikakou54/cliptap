/**
 * 変数サービス
 *
 * @description
 * カスタム変数のCRUD操作とリゾルバー生成を提供する共通サービス。
 * Mapper層を経由してデータアクセスを行う。
 *
 * @module VariableService
 */

import { VariableMapper } from '../mappers/VariableMapper';
import { ProfileVariableMapper } from '../mappers/ProfileMapper';
import { ShortcutMapper } from '../mappers/ShortcutMapper';
import type { Variable, CreateVariableInput, UpdateVariableInput } from '../schema';
import type { VariableResolver } from '../variables/parser';
import { hasVariables, replaceVariables, VARIABLE_TOKEN_PATTERN } from '../variables/parser';
import { resolveSystemVariableValue } from '../variables/systemVariables';
import { SystemVariableFormatRegistry } from './SystemVariableFormatRegistry';
import {
  NotFoundError,
  DuplicateNameError,
  VariableNameRequiredError,
  VariableNameInvalidError,
  VariableNameReservedError,
  SystemVariableDeleteError,
} from '../errors';
import { isReservedVariableName } from '../constants/variables';

/**
 * カスタム変数リゾルバー作成に必要なコンテキスト
 */
export interface VariableResolverContext {
  /** 購読状態（Proプランかどうか） */
  isSubscribed: boolean;
  /** 指定プロファイルの変数値マップ（変数名 → 値） */
  profileVariablesMap: Record<string, string>;
  /** デフォルトプロファイルの変数値マップ（変数名 → 値） */
  defaultProfileVariablesMap: Record<string, string>;
}

/** 変数名のパターン（英数字とアンダースコアのみ、先頭は英字またはアンダースコア） */
const VARIABLE_NAME_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/**
 * 変数名のバリデーション
 */
function validateVariableName(name: string, currentId: string | null): void {
  const trimmedName = name.trim();

  if (!trimmedName) {
    throw new VariableNameRequiredError();
  }

  if (!VARIABLE_NAME_PATTERN.test(trimmedName)) {
    throw new VariableNameInvalidError(trimmedName);
  }

  if (isReservedVariableName(trimmedName)) {
    throw new VariableNameReservedError(trimmedName);
  }

  const existing = VariableMapper.getByName(trimmedName);
  if (existing && existing.id !== currentId) {
    throw new DuplicateNameError('variable', trimmedName);
  }
}

/**
 * プロファイル変数値の解決
 *
 * @param name - 変数名
 * @param profileMap - 対象プロファイルの変数値マップ
 * @param defaultMap - 標準プロファイルの変数値マップ
 * @returns 解決した値。未設定なら null
 *
 * @remarks
 * 解決順序は「対象プロファイルの非空値 → 標準プロファイルの非空値 → 未設定」。
 * 空文字は「未設定」として扱う。値が空のときに空文字へ置換してしまうと、
 * 利用者が値を入れ忘れたことに気づけなくなるため、未設定として扱って呼び出し側で
 * トークンを保持させる。
 * この順序は同期展開（expandTextSync＝一覧の見た目）とコピー経路
 * （createCustomVariableResolver）で必ず一致させる必要がある。食い違うと
 * 「一覧に見えている文字列とコピーされる文字列が違う」という利用者に直接見える不具合になる
 * （tests/variables/expandTextSyncParity.test.ts がこの一致を固定している）。
 */
function resolveProfileValue(
  name: string,
  profileMap: Record<string, string>,
  defaultMap: Record<string, string>
): string | null {
  return profileMap[name] || defaultMap[name] || null;
}

/**
 * 変数サービス
 */
export class VariableService {
  /**
   * 全変数を取得（有効なもののみ）
   */
  static getAll(): Variable[] {
    return VariableMapper.getAll();
  }

  /**
   * 全変数を取得（無効なものも含む）
   */
  static getAllIncludingInvalid(): Variable[] {
    return VariableMapper.getAllIncludingInvalid();
  }

  /**
   * 変数を作成
   * @throws {VariableNameRequiredError} 変数名が空の場合
   * @throws {VariableNameInvalidError} 変数名の形式が無効な場合
   * @throws {VariableNameReservedError} システム変数名と衝突する場合
   * @throws {DuplicateNameError} 同名の変数が既に存在する場合
   */
  static create(data: CreateVariableInput): Variable {
    /* 空文字→形式→予約語→重複の順で検証する。
       長さ上限はUI層のフォームバリデーションで判定しており
       （mobile: useVariableEditScreen / web: VariableEditModal、いずれも
       INPUT_LIMITS.VARIABLE_NAME_MAX）、Service層では検査していない */
    validateVariableName(data.name, null);

    /* 検証はService、SQLはMapperに集約する規約のため、
       トリム済みの検証済みデータをそのままMapperへ渡す */
    return VariableMapper.create({
      ...data,
      name: data.name.trim(),
    });
  }

  /**
   * 変数を更新
   * @throws {NotFoundError} 変数が存在しない場合
   * @throws {VariableNameRequiredError} 変数名が空の場合
   * @throws {VariableNameInvalidError} 変数名の形式が無効な場合
   * @throws {VariableNameReservedError} システム変数名と衝突する場合
   * @throws {DuplicateNameError} 同名の変数が既に存在する場合
   */
  static update(id: string, data: UpdateVariableInput): Variable {
    /* 更新対象の変数が存在するか確認 */
    const existing = VariableMapper.getById(id);
    if (!existing) {
      throw new NotFoundError('variable', id);
    }

    /* 名前が更新される場合のみバリデーションを実行（自分自身との重複は許可） */
    if (data.name !== undefined) {
      validateVariableName(data.name, id);
    }

    /* 検証はService、SQLはMapperに集約する規約のため、
       トリム済みの検証済みデータをそのままMapperへ渡す */
    return VariableMapper.update(id, {
      ...data,
      name: data.name?.trim(),
    });
  }

  /**
   * 変数を削除
   * @throws {NotFoundError} 変数が存在しない場合
   * @throws {SystemVariableDeleteError} システム変数を削除しようとした場合
   */
  static delete(id: string): void {
    /* 削除対象の変数が存在するか確認 */
    const variable = VariableMapper.getById(id);
    if (!variable) {
      throw new NotFoundError('variable', id);
    }

    /* システム変数は削除不可（保護） */
    if (variable.type === 'system') {
      throw new SystemVariableDeleteError();
    }

    /* 手動カスケード削除: 変数に紐づく全プロファイル値を先に削除（参照整合性維持） */
    ProfileVariableMapper.deleteByVariableId(id);
    /* この変数を参照しているショートカット値の参照を外す。
       実行時に外部キーを強制しないため、宣言した ON DELETE SET NULL は働かない。
       参照が残ると、存在しない変数を指したまま解決を試み続けることになる。
       カテゴリ削除でcategoryIdをNULLへ戻すのと同じ扱いで、ショートカット値自体は消さない（§8.24） */
    ShortcutMapper.clearVariableReferences(id);
    /* 変数本体を削除 */
    VariableMapper.delete(id);
  }

  /**
   * カスタム変数リゾルバーを作成
   */
  static createCustomVariableResolver(
    context: VariableResolverContext,
    options?: { freeTierLimit?: number }
  ): VariableResolver {
    const freeTierLimit = options?.freeTierLimit ?? 5;

    return (name: string): string | null => {
      /* カスタム変数のみを取得 */
      const customVariables = VariableMapper.getAll().filter((v) => v.type === 'custom');

      /* Proプランの場合は全カスタム変数、無料プランの場合は作成日時が古い順に制限数までのみ有効 */
      const enabledVariables = context.isSubscribed
        ? customVariables
        : customVariables.slice(0, freeTierLimit);

      /* 指定された名前の変数を検索 */
      const variable = enabledVariables.find((v) => v.name === name);
      if (!variable) {
        return null;
      }

      /* 値が引ければ文字列、引けなければnullを返す。
         nullの場合は変数パーサーが元のトークンを保持する */
      return resolveProfileValue(name, context.profileVariablesMap, context.defaultProfileVariablesMap);
    };
  }


  /* ======================================== */
  /* 変数値の操作 */
  /* ======================================== */


  /**
   * 有効なカスタム変数の取得（無効化されたものは含まない）
   * @returns カスタム変数の配列
   *
   * @remarks
   * VariableMapper.getByType は SELECT_BY_TYPE（ORDER BY sortOrder ASC）で返すため、ここで再ソートしない。
   */
  static getAllCustomVariablesSorted(): Variable[] {
    return VariableMapper.getByType('custom');
  }

  /**
   * 全カスタム変数の取得（無効なものも含む、sortOrder順でソート済み）
   * @returns カスタム変数の配列
   *
   * @remarks
   * VariableMapper.getAllIncludingInvalid は SELECT_ALL（ORDER BY sortOrder ASC）で返すため、ここで再ソートしない。
   */
  static getAllCustomVariablesIncludingInvalidSorted(): Variable[] {
    return VariableMapper.getAllIncludingInvalid().filter((v) => v.type === 'custom');
  }

  /**
   * 有効なカスタム変数のみを取得（Free tier制限付き）
   * @param isSubscribed - Proプランに加入している場合はtrue
   * @param freeTierLimit - 無料プランの変数数制限（デフォルト: 5）
   * @returns 有効なカスタム変数の配列
   */
  static getEnabledCustomVariables(isSubscribed: boolean, freeTierLimit: number = 5): Variable[] {
    const sortedVars = this.getAllCustomVariablesSorted();
    return isSubscribed ? sortedVars : sortedVars.slice(0, freeTierLimit);
  }

  /* ======================================== */
  /* 同期版 変数展開（UI表示用） */
  /* ======================================== */

  /**
   * テキスト内の変数を同期的に展開（UI表示用）
   *
   * @description
   * システム変数とカスタム変数を同期的に展開します。
   * useDashboard等のUI表示用途に最適化されています。
   *
   * @param text - 展開対象のテキスト
   * @param options - 展開オプション
   * @returns 変数展開後のテキスト
   */
  static expandTextSync(
    text: string,
    options: {
      locale: string;
      profileVariablesMap: Record<string, string>;
      defaultProfileVariablesMap: Record<string, string>;
      variables?: Variable[];
    }
  ): string {
    const { locale, profileVariablesMap, defaultProfileVariablesMap, variables } = options;

    if (!hasVariables(text)) {
      return text;
    }

    const validVariables = variables ?? VariableMapper.getAll().filter((v) => v.valid);

    return text.replace(VARIABLE_TOKEN_PATTERN, (match: string, variableName: string): string => {
      const trimmedName = variableName.trim();

      /* システム変数を最優先で解決（ユーザー定義変数で上書き不可） */
      const systemValue = resolveSystemVariableValue(
        trimmedName,
        locale,
        new Date(),
        SystemVariableFormatRegistry.getAll()
      );
      if (systemValue !== null) {
        return systemValue;
      }

      /* validフラグがtrueのカスタム変数のみ展開対象 */
      const variable = validVariables.find((v) => v.name === trimmedName);
      if (!variable) {
        return match; /* 定義のない変数はトークンのまま残す */
      }

      /* 未設定ならトークンを保持して、値が入っていないことに気づかせる */
      const resolved = resolveProfileValue(variable.name, profileVariablesMap, defaultProfileVariablesMap);
      return resolved ?? match;
    });
  }

  /**
   * プロファイルIDから変数マップを構築するヘルパー
   *
   * @param profileId - プロファイルID
   * @param variables - 変数の配列
   * @param profileVariables - プロファイル変数の配列
   * @returns 変数名から値へのマップ
   */
  static buildProfileVariablesMapFromArrays(
    profileId: string | null,
    variables: Variable[],
    profileVariables: Array<{ profileId: string; variableId: string; value: string }>
  ): Record<string, string> {
    if (!profileId) return {};

    const map: Record<string, string> = {};
    for (const pv of profileVariables) {
      if (pv.profileId === profileId) {
        const variable = variables.find((v) => v.id === pv.variableId);
        if (variable) {
          map[variable.name] = pv.value;
        }
      }
    }
    return map;
  }

  /* ======================================== */
  /* プレビュー生成 */
  /* ======================================== */

  /**
   * テキストの変数を解決してプレビュー用のテキストを生成
   *
   * @param title - タイトルテキスト
   * @param content - コンテンツテキスト
   * @param options - オプション
   * @param options.locale - ロケール（デフォルト: 'en'）
   * @param options.customResolver - カスタム変数リゾルバー
   * @returns 解決されたタイトルとコンテンツ
   */
  static async resolvePreviewText(
    title: string,
    content: string,
    options: {
      locale?: string;
      customResolver?: VariableResolver;
    } = {}
  ): Promise<{ title: string; content: string }> {
    const { locale = 'en', customResolver } = options;

    const titleHasVars = hasVariables(title);
    const contentHasVars = hasVariables(content);

    const resolvedTitle = !title
      ? ''
      : titleHasVars
        ? await replaceVariables(title, {
            locale,
            customResolver,
            formats: SystemVariableFormatRegistry.getAll(),
          })
        : title;

    const resolvedContent = !content
      ? ''
      : contentHasVars
        ? await replaceVariables(content, {
            locale,
            customResolver,
            formats: SystemVariableFormatRegistry.getAll(),
          })
        : content;

    return { title: resolvedTitle, content: resolvedContent };
  }
}
