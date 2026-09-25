/**
 * カテゴリサービス
 *
 * @description
 * カテゴリのCRUD操作を提供する共通サービス。
 * Mapper層を経由してデータアクセスを行う。
 * Mobile/Webで共通のビジネスロジック（バリデーション含む）を提供。
 *
 * @module CategoryService
 */

import { CategoryMapper } from '../mappers/CategoryMapper';
import type { Category, CreateCategoryInput, UpdateCategoryInput } from '../schema';
import { EmptyContentError, DuplicateNameError } from '../errors';

/**
 * カテゴリサービス
 *
 * @description
 * 静的メソッドでカテゴリ操作を提供。
 * バリデーションを行い、Mapper層に処理を委譲。
 */
export class CategoryService {
  /**
   * 全カテゴリを取得
   *
   * @returns すべてのカテゴリの配列（orderカラムの昇順でソート済み）
   */
  static getAll(): Category[] {
    return CategoryMapper.getAll();
  }

  /**
   * IDでカテゴリを取得
   *
   * @param id - カテゴリのID
   * @returns カテゴリオブジェクト（存在しない場合はnull）
   */
  static getById(id: string): Category | null {
    return CategoryMapper.getById(id);
  }

  /**
   * 名前でカテゴリを取得
   *
   * @param name - カテゴリ名
   * @returns カテゴリオブジェクト（存在しない場合はnull）
   */
  static getByName(name: string): Category | null {
    return CategoryMapper.getByName(name);
  }

  /**
   * カテゴリを作成
   *
   * @param input - 作成するカテゴリの情報
   * @returns 作成されたカテゴリ
   * @throws {EmptyContentError} カテゴリ名が空の場合
   * @throws {DuplicateNameError} 同名のカテゴリが既に存在する場合
   */
  static create(input: CreateCategoryInput): Category {
    /* カテゴリ名の前後空白をトリム（ユーザー入力の正規化） */
    const trimmedName = input.name.trim();

    /* 空白のみの名前は一覧で識別できず重複判定もすり抜けるため、trim後の空文字を拒否する */
    if (!trimmedName) {
      throw new EmptyContentError();
    }

    /* 同名のカテゴリが既に存在するかチェック（重複防止） */
    const existing = CategoryMapper.getByName(trimmedName);
    if (existing) {
      throw new DuplicateNameError('category', trimmedName);
    }

    /* 検証はService、SQLはMapperに集約する規約のため、検証済みデータをそのままMapperへ渡す */
    return CategoryMapper.create({ ...input, name: trimmedName });
  }

  /**
   * カテゴリを更新
   *
   * @param data - 更新するカテゴリの情報
   * @returns 更新されたカテゴリ
   * @throws {EmptyContentError} カテゴリ名が空の場合
   * @throws {DuplicateNameError} 同名のカテゴリが既に存在する場合（自分以外）
   */
  static update(data: UpdateCategoryInput): Category {
    let updateData = { ...data };

    /* カテゴリ名が指定されている場合はバリデーションと重複チェック */
    if (data.name !== undefined) {
      /* カテゴリ名の前後空白をトリム（ユーザー入力の正規化） */
      const trimmedName = data.name.trim();

      /* 空白のみの名前は一覧で識別できず重複判定もすり抜けるため、trim後の空文字を拒否する */
      if (!trimmedName) {
        throw new EmptyContentError();
      }

      /* 同名のカテゴリが既に存在するかチェック（自分自身は除外、名前変更時のみ） */
      const existing = CategoryMapper.getByName(trimmedName);
      if (existing && existing.id !== data.id) {
        throw new DuplicateNameError('category', trimmedName);
      }

      /* トリム済みの名前で更新データを準備 */
      updateData = { ...updateData, name: trimmedName };
    }

    /* 検証はService、SQLはMapperに集約する規約のため、検証済みデータをそのままMapperへ渡す */
    return CategoryMapper.update(updateData);
  }

  /**
   * カテゴリを削除
   *
   * @param id - 削除するカテゴリのID
   *
   * @remarks
   * - カテゴリを削除してもそのカテゴリに属するスニペットは削除されない
   * - スニペットのcategoryIdはnullになる
   */
  static delete(id: string): void {
    CategoryMapper.delete(id);
  }

  /**
   * カテゴリの並び順を更新
   *
   * @param orderedIds - 新しい順序でのカテゴリID配列
   *
   * @remarks
   * - 配列のインデックスがそのままorderカラムの値になる
   * - ユーザーがドラッグ&ドロップで並べ替えた結果を反映する
   */
  static reorder(orderedIds: string[]): void {
    CategoryMapper.updateOrder(orderedIds);
  }
}
