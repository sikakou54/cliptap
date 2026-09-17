/**
 * スニペットマッパー
 *
 * @description
 * スニペットのCRUD操作を提供。
 * getMainDbAdapter()経由でDB操作を行い、Mobile/Webで共通のロジックを使用。
 *
 * @module SnippetMapper
 */

import { getMainDbAdapter } from '../adapters/DbAdapter';
import type {
  Snippet,
  CreateSnippetInput,
  UpdateSnippetInput,
  SnippetProfile,
  SnippetSortBy,
} from '../schema';
import { generateUniqueId, getCurrentTimestamp } from '../utils/dateHelpers';
import { EmptyContentError, NotFoundError, DatabaseError } from '../errors';

/* ======================================== */
/* SQLクエリ定義 */
/* ======================================== */

const SnippetQueries = {
  /* 全スニペットを取得（作成日時順） */
  SELECT_ALL: 'SELECT * FROM snippets ORDER BY createdAt ASC',
  /* プロファイルフィルタ付き全スニペットを取得 */
  /* LEFT JOIN + NOT EXISTS で「指定プロファイルに紐づく」または「どのプロファイルにも紐づかない（全環境対応）」スニペットを取得 */
  SELECT_ALL_WITH_PROFILE_FILTER: `
    SELECT DISTINCT s.* FROM snippets s
    LEFT JOIN snippet_profiles sp ON s.id = sp.snippetId
    WHERE sp.profileId = ? OR NOT EXISTS (SELECT 1 FROM snippet_profiles sp2 WHERE sp2.snippetId = s.id)
    ORDER BY s.createdAt ASC
  `,
  /* IDでスニペットを取得 */
  SELECT_BY_ID: 'SELECT * FROM snippets WHERE id = ?',
  /* カテゴリIDでスニペットを取得 */
  SELECT_BY_CATEGORY: 'SELECT * FROM snippets WHERE categoryId = ? ORDER BY createdAt ASC',
  /* 未分類スニペットを取得（categoryId=NULL） */
  SELECT_BY_CATEGORY_NULL: 'SELECT * FROM snippets WHERE categoryId IS NULL ORDER BY createdAt ASC',
  /* カテゴリIDとプロファイルIDでスニペットを取得 */
  SELECT_BY_CATEGORY_WITH_PROFILE: `
    SELECT DISTINCT s.* FROM snippets s
    LEFT JOIN snippet_profiles sp ON s.id = sp.snippetId
    WHERE s.categoryId = ? AND (sp.profileId = ? OR NOT EXISTS (SELECT 1 FROM snippet_profiles sp2 WHERE sp2.snippetId = s.id))
    ORDER BY s.createdAt ASC
  `,
  /* 未分類スニペットをプロファイルIDでフィルタして取得 */
  SELECT_BY_CATEGORY_NULL_WITH_PROFILE: `
    SELECT DISTINCT s.* FROM snippets s
    LEFT JOIN snippet_profiles sp ON s.id = sp.snippetId
    WHERE s.categoryId IS NULL AND (sp.profileId = ? OR NOT EXISTS (SELECT 1 FROM snippet_profiles sp2 WHERE sp2.snippetId = s.id))
    ORDER BY s.createdAt ASC
  `,
  /* スニペットを新規作成 */
  INSERT: `INSERT INTO snippets (id, title, content, categoryId, copyWithTitle, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  /* 復元専用のスニペット挿入。通常作成のINSERTはcopyCount列を持たないため、コピー回数を保持する復元ではこちらを使う */
  RESTORE_INSERT: `INSERT INTO snippets
        (id, title, content, categoryId, copyWithTitle, copyCount, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  /* コピー回数を1加算（コピー成功後に呼ぶ） */
  INCREMENT_COPY_COUNT: 'UPDATE snippets SET copyCount = copyCount + 1 WHERE id = ?',
  /* スニペットを更新 */
  UPDATE: `UPDATE snippets SET title = ?, content = ?, categoryId = ?, copyWithTitle = ?, updatedAt = ? WHERE id = ?`,
  /* スニペットを削除 */
  DELETE: 'DELETE FROM snippets WHERE id = ?',
  /* スニペット総数を取得 */
  SELECT_COUNT: 'SELECT COUNT(*) as count FROM snippets',
  /* カテゴリ別スニペット数を取得 */
  SELECT_COUNT_BY_CATEGORY: 'SELECT COUNT(*) as count FROM snippets WHERE categoryId = ?',
  /* 未分類スニペット数を取得 */
  SELECT_COUNT_BY_CATEGORY_NULL: 'SELECT COUNT(*) as count FROM snippets WHERE categoryId IS NULL',
};

const SnippetProfileQueries = {
  /* 全スニペット・プロファイル関連を取得 */
  SELECT_ALL: 'SELECT * FROM snippet_profiles',
  /* スニペットIDでプロファイルIDを取得 */
  SELECT_BY_SNIPPET: 'SELECT profileId FROM snippet_profiles WHERE snippetId = ?',
  /* スニペット・プロファイル関連を作成 */
  INSERT: 'INSERT INTO snippet_profiles (snippetId, profileId) VALUES (?, ?)',
  /* スニペットIDで関連を全て削除 */
  DELETE_BY_SNIPPET: 'DELETE FROM snippet_profiles WHERE snippetId = ?',
};

/* ======================================== */
/* 行変換関数 */
/* ======================================== */

/**
 * DB行データをSnippetエンティティに変換
 * @param row - データベースから取得した行データ
 * @returns Snippet型のオブジェクト
 */
const toEntity = (row: any): Snippet => ({
  id: row.id, /* スニペットID */
  title: row.title || null, /* スニペットタイトル（未設定時はnull） */
  content: row.content, /* スニペット本文 */
  categoryId: row.categoryId || null, /* カテゴリID（未分類の場合はnull） */
  copyWithTitle: Boolean(row.copyWithTitle), /* タイトルと一緒にコピーするか（SQLiteでは0/1で格納） */
  copyCount: row.copyCount ?? 0, /* コピー回数（使用頻度ソート用） */
  createdAt: row.createdAt, /* 作成日時 */
  updatedAt: row.updatedAt, /* 最終更新日時 */
});

/**
 * DB行データの配列をSnippetエンティティの配列に変換
 * @param rows - データベースから取得した行データの配列
 * @returns Snippet型の配列
 */
const toEntities = (rows: any[]): Snippet[] => rows.map(toEntity);

/**
 * スニペットマッパー
 *
 * @description
 * スニペット（定型文）のCRUD操作を提供する静的メソッド群
 */
export class SnippetMapper {
  /** バックアップ行をID・日時・使用回数ごと逐語復元する。 */
  static restore(snippet: Snippet): void {
    getMainDbAdapter().run(
      SnippetQueries.RESTORE_INSERT,
      [
        snippet.id,
        snippet.title,
        snippet.content,
        snippet.categoryId,
        snippet.copyWithTitle ? 1 : 0,
        snippet.copyCount,
        snippet.createdAt,
        snippet.updatedAt,
      ]
    );
  }

  /** バックアップのスニペット・プロファイル関連を逐語復元する。 */
  static restoreProfileLink(link: SnippetProfile): void {
    getMainDbAdapter().run(SnippetProfileQueries.INSERT, [
      link.snippetId,
      link.profileId,
    ]);
  }

  /**
   * 全スニペットを取得
   * @param filterByProfileId - プロファイルIDでフィルタ（オプション）
   * @returns スニペット一覧（作成日時順）
   * @description
   * filterByProfileIdが指定された場合、そのプロファイルに紐づくスニペット
   * または全環境対応スニペット（どのプロファイルにも紐づかない）を返す。
   */
  static getAll(filterByProfileId?: string | null): Snippet[] {
    const db = getMainDbAdapter();
    /* プロファイルフィルタが指定された場合、該当プロファイルに紐づくスニペットまたは全環境対応スニペットを取得 */
    if (filterByProfileId) {
      const rows = db.all<any>(
        SnippetQueries.SELECT_ALL_WITH_PROFILE_FILTER,
        [filterByProfileId]
      );
      return toEntities(rows);
    }
    /* プロファイルフィルタ未指定の場合、全スニペットを取得 */
    const rows = db.all<any>(SnippetQueries.SELECT_ALL);
    return toEntities(rows);
  }

  /**
   * IDでスニペットを取得
   * @param id - スニペットID
   * @returns スニペット（存在しない場合はnull）
   * @description
   * スニペット本体とそれに紐づくプロファイルIDの配列を返す。
   */
  static getById(id: string): Snippet | null {
    const db = getMainDbAdapter();
    const row = db.get<any>(SnippetQueries.SELECT_BY_ID, [id]);
    if (!row) return null;

    /* スニペットに紐づくプロファイルIDの配列を取得（snippet_profilesテーブルから） */
    const profileIds = this.getProfileIds(id);
    return {
      ...toEntity(row),
      profileIds,
    };
  }

  /**
   * カテゴリIDでスニペットを取得
   * @param categoryId - カテゴリID（nullの場合は未分類）
   * @param filterByProfileId - プロファイルIDでフィルタ（オプション）
   * @returns スニペット一覧（作成日時順）
   */
  static getByCategory(
    categoryId: string | null,
    filterByProfileId?: string | null
  ): Snippet[] {
    const db = getMainDbAdapter();
    let rows: any[];

    /* プロファイルフィルタとカテゴリIDの組み合わせに応じて適切なクエリを選択 */
    if (filterByProfileId) {
      /* 未分類（categoryId=null）かつプロファイルフィルタ有り */
      if (categoryId === null) {
        rows = db.all<any>(
          SnippetQueries.SELECT_BY_CATEGORY_NULL_WITH_PROFILE,
          [filterByProfileId]
        );
      } else {
        /* カテゴリ指定かつプロファイルフィルタ有り */
        rows = db.all<any>(
          SnippetQueries.SELECT_BY_CATEGORY_WITH_PROFILE,
          [categoryId, filterByProfileId]
        );
      }
    } else {
      /* プロファイルフィルタ無しの場合 */
      if (categoryId === null) {
        rows = db.all<any>(SnippetQueries.SELECT_BY_CATEGORY_NULL);
      } else {
        rows = db.all<any>(SnippetQueries.SELECT_BY_CATEGORY, [categoryId]);
      }
    }

    return toEntities(rows);
  }

  /**
   * スニペットを作成
   * @param data - 作成データ
   * @returns 作成されたスニペット
   */
  static create(data: CreateSnippetInput): Snippet {
    const db = getMainDbAdapter();
    /* 本文が空の場合はエラー（スニペットは必ずコンテンツが必要） */
    if (!data.content || data.content.trim() === '') {
      throw new EmptyContentError();
    }

    /* 一意性を保証するIDとタイムスタンプを生成 */
    const id = generateUniqueId();
    const now = getCurrentTimestamp();

    /* データベースに新規スニペットを挿入（SQLiteではブール値は0/1で格納） */
    db.run(SnippetQueries.INSERT, [
      id,
      data.title || null,
      data.content,
      data.categoryId || null,
      data.copyWithTitle ? 1 : 0,
      now,
      now,
    ]);

    /* プロファイルIDが指定されている場合、snippet_profilesテーブルに関連付けを作成 */
    /* 空配列の場合は全環境対応スニペット（snippet_profilesに関連なし） */
    if (data.profileIds && data.profileIds.length > 0) {
      this.setProfileIds(id, data.profileIds);
    }

    /* 挿入したデータを再取得して返却（DBから取得することで整合性を確保） */
    const snippet = this.getById(id);
    if (!snippet) {
      throw new DatabaseError('Failed to create snippet');
    }
    return snippet;
  }

  /**
   * スニペットを更新
   * @param data - 更新データ（idを含む）
   * @returns 更新されたスニペット
   */
  static update(data: UpdateSnippetInput): Snippet {
    const db = getMainDbAdapter();
    const { id } = data;
    /* 更新対象のスニペットが存在するか確認（存在しない場合はエラー） */
    const snippet = this.getById(id);

    if (!snippet) {
      throw new NotFoundError('snippet', id);
    }

    const now = getCurrentTimestamp();

    /* 指定されたフィールドのみ更新、未指定なら既存値を保持（部分更新対応） */
    db.run(SnippetQueries.UPDATE, [
      data.title !== undefined ? data.title : snippet.title,
      data.content !== undefined ? data.content : snippet.content,
      data.categoryId !== undefined ? data.categoryId : snippet.categoryId,
      data.copyWithTitle !== undefined
        ? data.copyWithTitle ? 1 : 0
        : snippet.copyWithTitle ? 1 : 0,
      now,
      id,
    ]);

    /* プロファイルIDが指定されている場合、関連付けを更新（既存の関連付けは全て削除してから再作成） */
    if (data.profileIds !== undefined) {
      this.setProfileIds(id, data.profileIds);
    }

    /* 更新後のデータを再取得して返却（DBから取得することで整合性を確保） */
    const updated = this.getById(id);
    if (!updated) {
      throw new DatabaseError('Failed to update snippet');
    }
    return updated;
  }

  /**
   * スニペットを削除
   * @param id - スニペットID
   * @description
   * snippet_profilesの関連レコードも削除される（カスケード）
   */
  static delete(id: string): void {
    const db = getMainDbAdapter();
    /* カスケード削除: snippet_profilesの関連レコードを先に削除（参照整合性維持、外部キー制約の回避） */
    db.run(SnippetProfileQueries.DELETE_BY_SNIPPET, [id]);
    /* スニペット本体を削除（関連データは既に削除済み） */
    db.run(SnippetQueries.DELETE, [id]);
  }

  /**
   * ソート条件を指定してスニペットを取得
   * @param sortBy - ソート条件（'created', 'updated', 'title', 'usage'）
   * @returns ソート済みスニペット一覧
   */
  static getSorted(sortBy: SnippetSortBy): Snippet[] {
    const db = getMainDbAdapter();
    let orderClause = '';
    switch (sortBy) {
      case 'created':
        /* 作成日時順（新しい順）、同日時はタイトル順 */
        orderClause = 'ORDER BY createdAt DESC, title IS NULL, title ASC';
        break;
      case 'updated':
        /* 更新日時順（新しい順）、同日時はタイトル順 */
        orderClause = 'ORDER BY updatedAt DESC, title IS NULL, title ASC';
        break;
      case 'title':
        /* タイトル順、同タイトルは作成日時順。NULLタイトルは末尾に配置 */
        orderClause = 'ORDER BY title IS NULL, title ASC, createdAt DESC';
        break;
      case 'usage':
        /* コピー回数順（多い順）、同数は作成日時順 */
        orderClause = 'ORDER BY copyCount DESC, createdAt DESC';
        break;
      /* SnippetSortByは4値の閉じたunionのため型上は到達しない。
         ここを削るとorderClauseが空のまま `SELECT * FROM snippets ` になりORDER BYが消えるため、
         'created'と同じ並びを既定として残している */
      default:
        /* デフォルトは作成日時順、同日時はタイトル順 */
        orderClause = 'ORDER BY createdAt DESC, title IS NULL, title ASC';
    }

    /* orderClauseは上のswitchが設定するリテラルのみで、外部入力を連結しない */
    const rows = db.all<any>(`SELECT * FROM snippets ${orderClause}`);
    return toEntities(rows);
  }

  /**
   * スニペットのコピー回数をインクリメント
   * @param id - スニペットID
   * @description
   * コピー操作が成功した後に呼び出し、使用頻度を記録する
   */
  static incrementCopyCount(id: string): void {
    const db = getMainDbAdapter();
    db.run(SnippetQueries.INCREMENT_COPY_COUNT, [id]);
  }

  /**
   * スニペット総数を取得
   * @returns スニペット数
   */
  static count(): number {
    const db = getMainDbAdapter();
    const result = db.get<{ count: number }>(SnippetQueries.SELECT_COUNT);
    return result?.count || 0;
  }

  /**
   * カテゴリごとのスニペット数を取得
   * @param categoryId - カテゴリID（nullの場合は未分類）
   * @returns 該当カテゴリのスニペット数
   */
  static countByCategory(categoryId: string | null): number {
    const db = getMainDbAdapter();
    if (categoryId === null) {
      const result = db.get<{ count: number }>(SnippetQueries.SELECT_COUNT_BY_CATEGORY_NULL);
      return result?.count || 0;
    }
    const result = db.get<{ count: number }>(
      SnippetQueries.SELECT_COUNT_BY_CATEGORY,
      [categoryId]
    );
    return result?.count || 0;
  }

  /**
   * スニペットに紐づくプロファイルID一覧を取得
   * @param snippetId - スニペットID
   * @returns プロファイルIDの配列
   * @description
   * このスニペットが表示される環境のIDの配列を返す。
   * 空配列の場合は全環境対応スニペット。
   */
  static getProfileIds(snippetId: string): string[] {
    const db = getMainDbAdapter();
    const rows = db.all<{ profileId: string }>(
      SnippetProfileQueries.SELECT_BY_SNIPPET,
      [snippetId]
    );
    return rows.map((row) => row.profileId);
  }

  /**
   * スニペットに紐づくプロファイルIDを設定
   * @param snippetId - スニペットID
   * @param profileIds - プロファイルIDの配列
   * @description
   * 既存の関連を全て削除してから、新しい関連を作成する。
   * 空配列の場合は全環境対応スニペットになる。
   */
  static setProfileIds(snippetId: string, profileIds: string[]): void {
    const db = getMainDbAdapter();
    /* 既存の関連を全削除（一貫性のため、再設定時もクリーンアップ、置き換え方式） */
    db.run(SnippetProfileQueries.DELETE_BY_SNIPPET, [snippetId]);

    /* 空配列の場合、snippet_profilesに関連なし = 全環境対応スニペット（どのプロファイルでも表示） */
    if (profileIds.length === 0) {
      return;
    }

    /* 新しい関連付けを作成（指定されたプロファイルIDごとに） */
    for (const profileId of profileIds) {
      db.run(SnippetProfileQueries.INSERT, [snippetId, profileId]);
    }
  }

  /**
   * snippet_profilesの全データを取得
   * @returns 全スニペット・プロファイル関連
   */
  static getAllSnippetProfiles(): SnippetProfile[] {
    const db = getMainDbAdapter();
    return db.all<SnippetProfile>(SnippetProfileQueries.SELECT_ALL);
  }
}
