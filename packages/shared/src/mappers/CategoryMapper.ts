/**
 * カテゴリマッパー
 *
 * @description
 * カテゴリのCRUD操作を提供。
 * getMainDbAdapter()経由でDB操作を行い、Mobile/Webで共通のロジックを使用。
 *
 * @module CategoryMapper
 */

import { getMainDbAdapter } from '../adapters/DbAdapter';
import type { Category, CreateCategoryInput, UpdateCategoryInput } from '../schema';
import { generateUniqueId, getCurrentTimestamp } from '../utils/dateHelpers';

/* ======================================== */
/* SQLクエリ定義 */
/* ======================================== */

const CategoryQueries = {
  /* 全カテゴリを取得（sortOrder順） */
  SELECT_ALL: 'SELECT * FROM categories ORDER BY sortOrder ASC',
  /* IDでカテゴリを取得 */
  SELECT_BY_ID: 'SELECT * FROM categories WHERE id = ?',
  /* 名前でカテゴリを取得（重複チェック用） */
  SELECT_BY_NAME: 'SELECT * FROM categories WHERE name = ?',
  /* カテゴリを新規作成 */
  INSERT: `INSERT INTO categories (id, name, color, sortOrder, createdAt) VALUES (?, ?, ?, ?, ?)`,
  /* カテゴリを更新（名前、色、sortOrder） */
  UPDATE: `UPDATE categories SET name = ?, color = ?, sortOrder = ? WHERE id = ?`,
  /* カテゴリを削除 */
  DELETE: 'DELETE FROM categories WHERE id = ?',
  /* カテゴリの並び順を更新 */
  UPDATE_SORT_ORDER: 'UPDATE categories SET sortOrder = ? WHERE id = ?',
  /* カテゴリ総数を取得 */
  SELECT_COUNT: 'SELECT COUNT(*) as count FROM categories',
  /* 最大のsortOrderを取得（新規作成時に使用） */
  SELECT_MAX_SORT_ORDER: 'SELECT MAX(sortOrder) as maxOrder FROM categories',
  /* カテゴリ削除時、関連するスニペットのcategoryIdをNULLに更新 */
  NULLIFY_SNIPPET_CATEGORY: 'UPDATE snippets SET categoryId = NULL WHERE categoryId = ?',
  /* 削除するカテゴリを参照しているショートカットを未分類へ戻す */
  NULLIFY_SHORTCUT_CATEGORY: 'UPDATE shortcuts SET categoryId = NULL WHERE categoryId = ?',
};

/* ======================================== */
/* 行変換関数 */
/* ======================================== */

/**
 * DB行データをCategoryエンティティに変換
 * @param row - データベースから取得した行データ
 * @returns Category型のオブジェクト
 */
const toEntity = (row: any): Category => ({
  id: row.id, /* カテゴリID */
  name: row.name, /* カテゴリ名 */
  color: row.color || null, /* カテゴリ色（未設定・空文字はnullに寄せる） */
  sortOrder: row.sortOrder ?? 0, /* 並び順（列がNULLの場合は0） */
  createdAt: row.createdAt, /* 作成日時 */
});

/**
 * DB行データの配列をCategoryエンティティの配列に変換
 * @param rows - データベースから取得した行データの配列
 * @returns Category型の配列
 */
const toEntities = (rows: any[]): Category[] => rows.map(toEntity);

/**
 * カテゴリマッパー
 *
 * @description
 * 静的メソッドでカテゴリのCRUD操作を提供。
 * すべてのメソッドはgetMainDbAdapter()経由でDBアクセスを行う。
 */
export class CategoryMapper {
  /** バックアップ行をID・日時・並び順ごと逐語復元する。 */
  static restore(category: Category): void {
    getMainDbAdapter().run(CategoryQueries.INSERT, [
      category.id,
      category.name,
      category.color,
      category.sortOrder,
      category.createdAt,
    ]);
  }

  /**
   * 全カテゴリを取得
   * @returns カテゴリ一覧（sortOrder順、次に名前順）
   */
  static getAll(): Category[] {
    const db = getMainDbAdapter();
    const rows = db.all<any>(CategoryQueries.SELECT_ALL);
    return toEntities(rows);
  }

  /**
   * IDでカテゴリを取得
   * @param id - カテゴリID
   * @returns カテゴリ（存在しない場合はnull）
   */
  static getById(id: string): Category | null {
    const db = getMainDbAdapter();
    const row = db.get<any>(CategoryQueries.SELECT_BY_ID, [id]);
    return row ? toEntity(row) : null;
  }

  /**
   * 名前でカテゴリを取得
   * @param name - カテゴリ名
   * @returns カテゴリ（存在しない場合はnull）
   * @description
   * カテゴリ名の重複チェックで使用される
   */
  static getByName(name: string): Category | null {
    const db = getMainDbAdapter();
    const row = db.get<any>(CategoryQueries.SELECT_BY_NAME, [name]);
    return row ? toEntity(row) : null;
  }

  /**
   * カテゴリを作成
   * @param data - 作成データ
   * @returns 作成されたカテゴリ
   */
  static create(data: CreateCategoryInput): Category {
    const db = getMainDbAdapter();
    /* 一意性を保証するIDとタイムスタンプを生成 */
    const id = generateUniqueId();
    const now = getCurrentTimestamp();
    /* 既存カテゴリの最大sortOrder+1を次の並び順として設定（末尾に追加） */
    const sortOrder = this.getNextSortOrder();

    /* データベースに新規カテゴリを挿入 */
    db.run(CategoryQueries.INSERT, [
      id,
      data.name,
      data.color || null,
      sortOrder,
      now,
    ]);

    /* 挿入したデータを再取得して返却（DBから取得することで整合性を確保） */
    const category = this.getById(id);
    if (!category) {
      throw new Error('Failed to create category');
    }
    return category;
  }

  /**
   * カテゴリを更新
   * @param data - 更新データ（idを含む）
   * @returns 更新されたカテゴリ
   */
  static update(data: UpdateCategoryInput): Category {
    const db = getMainDbAdapter();
    /* 更新対象のカテゴリが存在するか確認（存在しない場合はエラー） */
    const category = this.getById(data.id);
    if (!category) {
      throw new Error(`Category not found: ${data.id}`);
    }

    /* 指定されたフィールドのみ更新、未指定なら既存値を保持（部分更新対応） */
    db.run(CategoryQueries.UPDATE, [
      data.name !== undefined ? data.name : category.name,
      data.color !== undefined ? data.color : category.color,
      data.sortOrder !== undefined ? data.sortOrder : category.sortOrder,
      data.id,
    ]);

    /* 更新後のデータを再取得して返却（DBから取得することで整合性を確保） */
    const updated = this.getById(data.id);
    if (!updated) {
      throw new Error('Failed to update category');
    }
    return updated;
  }

  /**
   * カテゴリを削除
   * @param id - カテゴリID
   * @description
   * カテゴリを参照しているスニペットとショートカットのcategoryIdはNULLに更新される。
   * 実行時に外部キーを強制していないため、DDLの`ON DELETE SET NULL`だけでは
   * NULLにならない。この明示的なUPDATEが実質の本体である。
   */
  static delete(id: string): void {
    const db = getMainDbAdapter();
    /* 途中で失敗すると、カテゴリだけ消えて参照が残る状態になるためまとめて実行する */
    db.transaction(() => {
      /* カテゴリ削除前に、関連するスニペットのcategoryIdをNULLに更新（参照整合性維持、カスケード削除の代替） */
      db.run(CategoryQueries.NULLIFY_SNIPPET_CATEGORY, [id]);
      /* ショートカットも定型文と同じカテゴリを共用するため、同じくNULLへ戻す */
      db.run(CategoryQueries.NULLIFY_SHORTCUT_CATEGORY, [id]);
      /* カテゴリ本体を削除（スニペットとショートカットは未分類として残る） */
      db.run(CategoryQueries.DELETE, [id]);
    });
  }

  /**
   * カテゴリの並び順を更新
   * @param orderedIds - 新しい順序のカテゴリID配列
   */
  static updateOrder(orderedIds: string[]): void {
    const db = getMainDbAdapter();
    /* 配列のインデックスをそのままsortOrderとして設定（ドラッグ&ドロップで並び替えた順序を反映） */
    orderedIds.forEach((id, index) => {
      db.run(CategoryQueries.UPDATE_SORT_ORDER, [index, id]);
    });
  }

  /**
   * カテゴリ数を取得
   * @returns カテゴリ数
   */
  static count(): number {
    const db = getMainDbAdapter();
    const result = db.get<{ count: number }>(CategoryQueries.SELECT_COUNT);
    return result?.count || 0;
  }

  /**
   * 次のsortOrder値を取得（新規カテゴリ作成時・インポート時に使用）
   * @returns 既存の最大sortOrder+1（データが存在しない場合は0）
   */
  static getNextSortOrder(): number {
    const db = getMainDbAdapter();
    /* 現在の最大sortOrderを取得（新規カテゴリを末尾に追加するため） */
    const result = db.get<{ maxOrder: number | null }>(
      CategoryQueries.SELECT_MAX_SORT_ORDER
    );
    /* 最大値+1を返す（データがない場合は-1+1=0が返る） */
    return (result?.maxOrder ?? -1) + 1;
  }
}
