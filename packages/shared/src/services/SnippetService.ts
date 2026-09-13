/**
 * スニペットサービス
 *
 * @description
 * スニペットのCRUD操作と変数展開を提供する共通サービス。
 * Mapper層を経由してデータアクセスを行う。
 *
 * @module SnippetService
 */

import { SnippetMapper } from '../mappers/SnippetMapper';
import type {
  Snippet,
  SnippetProfile,
  CreateSnippetInput,
  UpdateSnippetInput,
  SnippetSortBy,
} from '../schema';
import { NotFoundError, EmptyContentError } from '../errors';
import { hasVariables, replaceVariables, type VariableResolver } from '../variables/parser';
import { prepareSnippetForClipboard, prepareSnippetTitleForClipboard } from '../utils/snippetUtils';
import { SystemVariableFormatRegistry } from './SystemVariableFormatRegistry';

/**
 * スニペットサービス
 */
export class SnippetService {
  /**
   * IDでスニペットを取得
   *
   * @param id - スニペットのID
   * @returns スニペットオブジェクト（存在しない場合はnull）
   */
  static getById(id: string): Snippet | null {
    return SnippetMapper.getById(id);
  }

  /**
   * 保存済みのスニペット総数を取得
   *
   * @returns 全プロファイル合計のスニペット数
   * @remarks
   * 無料プランの登録上限の判定に使う。画面の一覧はプロファイル・カテゴリで絞り込まれているため、
   * その件数では他のプロファイルの分を取りこぼす。
   */
  static count(): number {
    return SnippetMapper.count();
  }

  /**
   * スニペットを作成
   *
   * @param data - 作成するスニペットの情報
   * @returns 作成されたスニペット
   * @throws {EmptyContentError} コンテンツが空の場合
   */
  static create(data: CreateSnippetInput): Snippet {
    /* 本文が空の場合はエラー（スニペットは必ずコンテンツが必要） */
    if (!data.content || data.content.trim() === '') {
      throw new EmptyContentError();
    }
    /* 検証はService、SQLはMapperに集約する規約のため、検証済みデータをそのままMapperへ渡す */
    return SnippetMapper.create(data);
  }

  /**
   * スニペットを更新
   *
   * @param data - 更新するスニペットの情報
   * @returns 更新されたスニペット
   * @throws {NotFoundError} スニペットが存在しない場合
   */
  static update(data: UpdateSnippetInput): Snippet {
    /* 更新対象のスニペットが存在するか確認（存在しない場合はエラー） */
    const existing = SnippetMapper.getById(data.id);
    if (!existing) {
      throw new NotFoundError('snippet', data.id);
    }
    /* 検証はService、SQLはMapperに集約する規約のため、検証済みデータをそのままMapperへ渡す */
    return SnippetMapper.update(data);
  }

  /**
   * スニペットを削除
   *
   * @param id - 削除するスニペットのID
   * @throws {NotFoundError} スニペットが存在しない場合
   */
  static delete(id: string): void {
    /* 削除対象のスニペットが存在するか確認（存在しない場合はエラー） */
    const existing = SnippetMapper.getById(id);
    if (!existing) {
      throw new NotFoundError('snippet', id);
    }
    /* Mapper層に処理を委譲（カスケード削除が実行される：snippet_profilesも削除） */
    SnippetMapper.delete(id);
  }

  /**
   * スニペットを検索
   *
   * @param query - 検索クエリ（タイトルまたはコンテンツに部分一致）
   * @param categoryId - カテゴリIDでフィルタリング（オプション）
   * @returns 検索にマッチしたスニペットの配列
   */
  static search(query: string, categoryId?: string): Snippet[] {
    return SnippetMapper.search(query, categoryId);
  }

  /**
   * ソート済みスニペットを取得
   *
   * @param sortBy - ソート基準（'created', 'updated', 'title', 'usage'）
   * @returns 指定された基準でソートされたスニペットの配列
   */
  static getSorted(sortBy: SnippetSortBy): Snippet[] {
    return SnippetMapper.getSorted(sortBy);
  }

  /**
   * スニペットのコピー回数をインクリメント
   *
   * @param id - スニペットのID
   * @description
   * コピー操作が成功した後に呼び出し、使用頻度を記録する
   */
  static incrementCopyCount(id: string): void {
    SnippetMapper.incrementCopyCount(id);
  }

  /**
   * スニペットに紐づくプロファイルID一覧を取得
   *
   * @param snippetId - スニペットのID
   * @returns このスニペットに関連付けられているプロファイルIDの配列
   */
  static getProfileIds(snippetId: string): string[] {
    return SnippetMapper.getProfileIds(snippetId);
  }

  /**
   * 全スニペット-プロファイル関連を取得
   *
   * @returns すべてのスニペットとプロファイルの関連データの配列
   */
  static getAllSnippetProfiles(): SnippetProfile[] {
    return SnippetMapper.getAllSnippetProfiles();
  }

  /**
   * テキストのプレビューを生成（変数展開後）
   *
   * @param text - プレビューを生成するテキスト
   * @param options - オプション
   * @param options.locale - ロケール（システム変数の日付フォーマット等に使用）
   * @param options.customResolver - カスタム変数リゾルバー
   * @returns 変数を展開した後のテキスト
   */
  static async getTextPreview(
    text: string,
    options?: {
      locale?: string;
      customResolver?: VariableResolver;
    }
  ): Promise<string> {
    /* 変数が含まれていない場合は早期リターン（パフォーマンス最適化、不要な処理を回避） */
    if (!hasVariables(text)) {
      return text;
    }

    /* 変数を実際の値に置換（システム変数とカスタム変数の両方を処理） */
    return replaceVariables(text, {
      locale: options?.locale,
      customResolver: options?.customResolver,
      formats: SystemVariableFormatRegistry.getAll(),
    });
  }

  /**
   * スニペットのプレビューを生成（変数展開後）
   *
   * @param id - スニペットのID
   * @param options - オプション
   * @param options.locale - ロケール（システム変数の日付フォーマット等に使用）
   * @param options.customResolver - カスタム変数リゾルバー
   * @returns 変数を展開した後のスニペットコンテンツ
   * @throws {NotFoundError} スニペットが見つからない場合
   */
  static async getPreview(
    id: string,
    options?: {
      locale?: string;
      customResolver?: VariableResolver;
    }
  ): Promise<string> {
    /* スニペットを取得（存在しない場合はエラー） */
    const snippet = SnippetMapper.getById(id);
    if (!snippet) {
      throw new NotFoundError('snippet', id);
    }

    /* 変数展開そのものは getTextPreview と同一の規則で行う。
       このメソッドの責務はIDからスニペットを引く部分だけに絞り、展開規則を二重に持たない */
    return this.getTextPreview(snippet.content, options);
  }

  /**
   * スニペットをクリップボードにコピーするためのテキストを準備
   *
   * @param id - スニペットのID
   * @param options - オプション
   * @param options.locale - ロケール（システム変数の日付フォーマット等に使用）
   * @param options.customResolver - カスタム変数リゾルバー
   * @param options.shouldReplaceVariables - 変数を置換するか（デフォルト: true）
   * @returns クリップボードにコピーするためのテキスト
   * @throws {NotFoundError} スニペットが見つからない場合
   *
   * @remarks
   * - copyWithTitleがtrueの場合、タイトルとコンテンツを結合する
   * - copyWithTitleがfalseの場合、コンテンツのみを返す
   * - shouldReplaceVariablesがtrueの場合、変数を実際の値に置換する
   */
  static async prepareForClipboard(
    id: string,
    options?: {
      locale?: string;
      customResolver?: VariableResolver;
      shouldReplaceVariables?: boolean;
    }
  ): Promise<string> {
    /* スニペットを取得（存在しない場合はエラー） */
    const snippet = SnippetMapper.getById(id);
    if (!snippet) {
      throw new NotFoundError('snippet', id);
    }

    /* クリップボード用テキストを準備（変数展開、タイトル結合等を処理） */
    return prepareSnippetForClipboard({
      snippet,
      customResolver: options?.customResolver,
      shouldReplaceVariables: options?.shouldReplaceVariables ?? true,
      locale: options?.locale,
    });
  }

  /**
   * スニペットのタイトルだけをクリップボードにコピーするためのテキストを準備
   *
   * @param id - スニペットのID
   * @param options - オプション
   * @param options.locale - ロケール（システム変数の日付フォーマット等に使用）
   * @param options.customResolver - カスタム変数リゾルバー
   * @param options.shouldReplaceVariables - 変数を置換するか（デフォルト: true）
   * @returns クリップボードにコピーするタイトル（タイトルがない場合は空文字）
   * @throws {NotFoundError} スニペットが見つからない場合
   *
   * @remarks
   * - 本文は結合せず、タイトルのみを返す
   * - copyWithTitleの値にかかわらずタイトルを返す
   * - shouldReplaceVariablesがtrueの場合、変数を実際の値に置換する
   */
  static async prepareTitleForClipboard(
    id: string,
    options?: {
      locale?: string;
      customResolver?: VariableResolver;
      shouldReplaceVariables?: boolean;
    }
  ): Promise<string> {
    /* スニペットを取得（存在しない場合はエラー） */
    const snippet = SnippetMapper.getById(id);
    if (!snippet) {
      throw new NotFoundError('snippet', id);
    }

    /* クリップボード用タイトルを準備（変数展開を処理） */
    return prepareSnippetTitleForClipboard({
      snippet,
      customResolver: options?.customResolver,
      shouldReplaceVariables: options?.shouldReplaceVariables ?? true,
      locale: options?.locale,
    });
  }
}
