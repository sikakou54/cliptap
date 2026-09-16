/**
 * ショートカットマッパー
 *
 * @description
 * ショートカットのCRUD操作を提供。
 * getMainDbAdapter()経由でDB操作を行い、Mobile/Webで共通のロジックを使用。
 *
 * @module ShortcutMapper
 */

import { getMainDbAdapter } from '../adapters/DbAdapter';
import type { Shortcut, ShortcutProfile, ShortcutRow } from '../schema';
import { generateUniqueId, getCurrentTimestamp } from '../utils/dateHelpers';

/**
 * SQLプレースホルダーを生成
 * @param count - プレースホルダーの数
 * @returns プレースホルダー文字列 (例: "?,?,?")
 */
const placeholders = (count: number): string =>
  Array.from({ length: count }, () => '?').join(',');

/* ======================================== */
/* SQLクエリ定義 */
/* ======================================== */

/**
 * 指定プロファイルから見えるショートカットの条件（別名 s の shortcuts に掛ける。`?` はプロファイルID1個）
 *
 * @remarks
 * そのプロファイルに紐づくものと、紐づけが0件のもの（全プロファイル向け）を拾う。
 * 定型文の snippet_profiles と同じ規則。
 *
 * 結合（JOIN）で絞らないのは、0件のショートカットは結合相手の行が無く、
 * INNER JOIN だと一覧からもIDでの取得からも消えてしまうため。
 * 複数のプロファイルに紐づいても行が増えないよう、紐づけ側はサブクエリで見る。
 *
 * 外側の括弧は外さないこと。後ろに AND の条件（カテゴリ等）を続けたとき、
 * 括弧が無いと AND が OR より先に結び付き「紐づく OR (紐づけ0件 AND 後続の条件)」と解釈され、
 * 表示中のプロファイルに紐づくものが後続の条件をすり抜ける。例外にならないため気付けない。
 *
 * iOS版・Android版のキーボードが同じ文字列を持ち、
 * `tests/shortcuts/visibleInProfileParity.test.ts` が3実装の一致を検査している。
 * 変えるときは3か所を同時に変えること。
 */
const VISIBLE_IN_PROFILE = '(s.id IN (SELECT sp.shortcutId FROM shortcut_profiles sp WHERE sp.profileId = ?) OR NOT EXISTS (SELECT 1 FROM shortcut_profiles sp2 WHERE sp2.shortcutId = s.id))';

const ShortcutQueries = {
  /* 指定プロファイルから見えるショートカットを取得（sortOrder順） */
  SELECT_BY_PROFILE: `SELECT s.* FROM shortcuts s WHERE ${VISIBLE_IN_PROFILE} ORDER BY s.sortOrder`,
  /* IDでショートカットを取得。紐づけが0件でも取得できるよう結合しない */
  SELECT_BY_ID: 'SELECT * FROM shortcuts WHERE id = ?',
  /* ショートカットを新規作成 */
  INSERT: `INSERT INTO shortcuts (id, categoryId, name, value, useCount, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  /* ショートカットのカテゴリ・名前・値・更新日時を更新（useCountは挿入・コピー時にだけ動かすため触れない） */
  UPDATE: `UPDATE shortcuts SET categoryId = ?, name = ?, value = ?, sortOrder = ?, updatedAt = ? WHERE id = ?`,
  /* 使用回数を1加算し、あわせて更新日時を進める */
  INCREMENT_USE_COUNT:
    'UPDATE shortcuts SET useCount = useCount + 1, updatedAt = ? WHERE id = ?',
  /* ショートカットを削除 */
  DELETE: 'DELETE FROM shortcuts WHERE id = ?',
  /* ショートカットの並び順を更新 */
  UPDATE_SORT_ORDER: 'UPDATE shortcuts SET sortOrder = ? WHERE id = ?',
  /* ショートカット総数を取得（プロファイルを問わない。複数プロファイルに紐づくものも1件と数える） */
  SELECT_COUNT: 'SELECT COUNT(*) AS count FROM shortcuts',
  /* 指定プロファイルから見えるショートカット数を取得 */
  SELECT_COUNT_BY_PROFILE: `SELECT COUNT(*) AS count FROM shortcuts s WHERE ${VISIBLE_IN_PROFILE}`,
  /* 名前の重複を探す（0件で保存する場合）。0件のショートカットは全プロファイルから見えるため、
     紐づけを問わず同名すべてと衝突する */
  SELECT_CONFLICT_FOR_ALL_PROFILES: 'SELECT s.id FROM shortcuts s WHERE s.name = ? AND s.id <> ? LIMIT 1',
  /* 最大sortOrderを取得（新規作成時に使用）。
     プロファイルを横断した通し番号にしている。表示順は並べ替え（shortcuts/sort.ts）が
     決めるため、通しでも見た目は変わらない */
  SELECT_MAX_SORT_ORDER: 'SELECT MAX(sortOrder) as maxOrder FROM shortcuts',
};

const ShortcutProfileQueries = {
  /* 紐づけを登録 */
  INSERT: 'INSERT INTO shortcut_profiles (shortcutId, profileId) VALUES (?, ?)',
  /* 指定ショートカットの紐づけを削除（紐づけの置き換えと、削除時に使う） */
  DELETE_BY_SHORTCUT: 'DELETE FROM shortcut_profiles WHERE shortcutId = ?',
  /* 指定ショートカットに紐づくプロファイルIDを取得（一覧の一括取得と同じ並び） */
  SELECT_BY_SHORTCUT: 'SELECT profileId FROM shortcut_profiles WHERE shortcutId = ? ORDER BY profileId',
  /* 一覧に載るショートカットの紐づけを一括取得する。
     指定プロファイルに紐づくショートカットについて、他のプロファイルへの紐づけも含めて全件読む。
     0件のショートカットは行を持たないため、ここには現れない */
  SELECT_FOR_PROFILE_LIST: 'SELECT shortcutId, profileId FROM shortcut_profiles WHERE shortcutId IN (SELECT shortcutId FROM shortcut_profiles WHERE profileId = ?) ORDER BY shortcutId, profileId',
};

/* ======================================== */
/* 行変換関数 */
/* ======================================== */

/**
 * DB行データをShortcutRowエンティティに変換
 * @param row - データベースから取得した行データ
 * @returns ShortcutRow型のオブジェクト
 */
const toShortcutRow = (row: any): ShortcutRow => ({
  id: row.id, /* ショートカットID */
  categoryId: row.categoryId ?? null, /* 所属カテゴリID（未分類はnull） */
  name: row.name, /* ショートカット名 */
  value: row.value, /* 保存されている文字列（変数トークンは未展開） */
  useCount: row.useCount ?? 0, /* 使用回数（列がNULLの場合は0） */
  sortOrder: row.sortOrder ?? 0, /* 並び順（列がNULLの場合は0） */
  createdAt: row.createdAt, /* 作成日時 */
  updatedAt: row.updatedAt, /* 更新日時 */
});

/* ======================================== */
/* Mapper */
/* ======================================== */

/**
 * ショートカットマッパー
 *
 * @description
 * 静的メソッドでショートカットのCRUD操作を提供。
 * すべてのメソッドはgetMainDbAdapter()経由でDBアクセスを行う。
 */
export class ShortcutMapper {
  /**
   * バックアップ行をID・日時・並び順ごと逐語復元する。
   *
   * @remarks
   * 紐づくプロファイルは別テーブルのため、`restoreProfileLink`で個別に復元する
   * （定型文の`SnippetMapper.restore`／`restoreProfileLink`と同じ分け方）。
   */
  static restore(shortcut: ShortcutRow): void {
    getMainDbAdapter().run(ShortcutQueries.INSERT, [
      shortcut.id,
      shortcut.categoryId,
      shortcut.name,
      shortcut.value,
      shortcut.useCount,
      shortcut.sortOrder,
      shortcut.createdAt,
      shortcut.updatedAt,
    ]);
  }

  /** バックアップの紐づけ行を逐語復元する。 */
  static restoreProfileLink(link: ShortcutProfile): void {
    getMainDbAdapter().run(ShortcutProfileQueries.INSERT, [
      link.shortcutId,
      link.profileId,
    ]);
  }

  /**
   * 指定プロファイルから見えるショートカットを取得
   * @param profileId - 表示中のプロファイルID
   * @returns ショートカット一覧（sortOrder順）
   * @description
   * そのプロファイルに紐づくものと、紐づけが0件のもの（全プロファイル向け）を返す。
   * 各要素の`profileIds`は、表示中のプロファイル以外も含めた全紐づけを持つ
   * （編集画面が一覧の要素を初期値にするため、表示中の1件だけにすると保存時に他の紐づけが消える）。
   *
   * 紐づけは、ショートカットの件数によらず1回のクエリでまとめて取得する。
   * どのショートカットが見えるかはプロファイルごとに変わるため、プロファイル指定を必須にしている。
   * プロファイルを跨いで検索する画面も、プロファイルごとに呼ぶ。
   * 値は保存されている文字列のまま返し、変数トークンは展開しない
   * （展開は表示の shortcuts/display と、コピーの ShortcutService.prepareValueForClipboard が行う）。
   */
  static getByProfileId(profileId: string): Shortcut[] {
    const db = getMainDbAdapter();
    const rows = db.all<any>(ShortcutQueries.SELECT_BY_PROFILE, [profileId]);
    const links = db.all<ShortcutProfile>(
      ShortcutProfileQueries.SELECT_FOR_PROFILE_LIST,
      [profileId]
    );

    /* ショートカットIDごとに紐づけをまとめる。行の無いショートカットは0件（全プロファイル向け） */
    const profileIdsByShortcut = new Map<string, string[]>();
    for (const link of links) {
      const entries = profileIdsByShortcut.get(link.shortcutId) ?? [];
      entries.push(link.profileId);
      profileIdsByShortcut.set(link.shortcutId, entries);
    }

    return rows.map((row) => ({
      ...toShortcutRow(row),
      profileIds: profileIdsByShortcut.get(row.id) ?? [],
    }));
  }

  /**
   * IDでショートカットを取得
   * @param id - ショートカットID
   * @returns ショートカット（存在しない場合はnull）
   * @description
   * 紐づけが0件のショートカットも取得できるよう、紐づけとは結合しない。
   */
  static getById(id: string): Shortcut | null {
    const db = getMainDbAdapter();
    const row = db.get<any>(ShortcutQueries.SELECT_BY_ID, [id]);
    if (!row) return null;

    return {
      ...toShortcutRow(row),
      profileIds: this.getProfileIds(id),
    };
  }

  /**
   * ショートカットに紐づくプロファイルID一覧を取得
   * @param shortcutId - ショートカットID
   * @returns プロファイルIDの配列（空配列は全プロファイル向け）
   */
  static getProfileIds(shortcutId: string): string[] {
    const db = getMainDbAdapter();
    const rows = db.all<{ profileId: string }>(
      ShortcutProfileQueries.SELECT_BY_SHORTCUT,
      [shortcutId]
    );
    return rows.map((row) => row.profileId);
  }

  /**
   * 指定した名前が、保存先のプロファイルで既に使われているか調べる
   *
   * @param name - ショートカット名
   * @param profileIds - 保存後に紐づくプロファイルID（空配列は全プロファイル向け）
   * @param excludeId - 判定から除くショートカットID（更新時に自分自身を除くため）
   * @returns 見つかったショートカットのID（無ければnull）
   *
   * @description
   * 選んだプロファイルのいずれかで同名が見えるなら衝突とする。
   * 紐づけが0件のショートカットは全プロファイルから見えるため、次の2つを衝突として数える。
   * - 既存が0件の同名は、どのプロファイルを選んでも常に衝突する
   * - 0件で保存する場合は、紐づけを問わず同名すべてと衝突する
   *
   * DB側に一意制約を置けない（紐づけが別テーブルのため）ので、この判定が唯一の担保になる。
   *
   * @remarks
   * excludeIdはSQLで除く。取得後にJavaScriptで弾くと、自分自身が先に1件ヒットしたときに
   * 別の衝突相手を見落とす（1件しか読まないため）。
   */
  static findConflictingName(
    name: string,
    profileIds: readonly string[],
    excludeId?: string
  ): string | null {
    const db = getMainDbAdapter();
    /* 除外対象が無いときも同じ形の条件にできるよう、IDとして成立しない空文字を渡す */
    const excluded = excludeId ?? '';

    if (profileIds.length === 0) {
      const row = db.get<{ id: string }>(
        ShortcutQueries.SELECT_CONFLICT_FOR_ALL_PROFILES,
        [name, excluded]
      );
      return row?.id ?? null;
    }

    /* 選んだプロファイルのどれかに紐づく同名と、0件（全プロファイル向け）の同名を探す。
       紐づけ側はサブクエリで見るため、複数に紐づく相手でも行は増えない */
    const row = db.get<{ id: string }>(
      `SELECT s.id FROM shortcuts s WHERE s.name = ? AND s.id <> ? AND (s.id IN (SELECT sp.shortcutId FROM shortcut_profiles sp WHERE sp.profileId IN (${placeholders(profileIds.length)})) OR NOT EXISTS (SELECT 1 FROM shortcut_profiles sp2 WHERE sp2.shortcutId = s.id)) LIMIT 1`,
      [name, excluded, ...profileIds]
    );
    return row?.id ?? null;
  }

  /**
   * ショートカットを作成
   * @param profileIds - 紐づけるプロファイルID（検証済み。空配列は全プロファイル向け）
   * @param name - ショートカット名（検証済み）
   * @param value - 挿入する値（検証済み。空文字も保存できる）
   * @param categoryId - 所属カテゴリID（未指定・nullは未分類）
   * @returns 作成されたショートカット
   * @description
   * ショートカット本体と紐づけの挿入を1トランザクションで行い、
   * 紐づけだけが残る中途半端な状態を作らない。
   */
  static create(
    profileIds: readonly string[],
    name: string,
    value: string,
    categoryId: string | null = null
  ): Shortcut {
    const db = getMainDbAdapter();
    /* 一意性を保証するIDとタイムスタンプを生成 */
    const id = generateUniqueId();
    const now = getCurrentTimestamp();
    /* 最大sortOrder+1を次の並び順として設定（末尾に追加） */
    const sortOrder = this.getNextSortOrder();

    db.transaction(() => {
      db.run(ShortcutQueries.INSERT, [id, categoryId, name, value, 0, sortOrder, now, now]);
      /* 紐づけは中間テーブルへ。空配列なら行を作らず全プロファイル向けになる */
      this.setProfileIds(id, profileIds);
    });

    /* 挿入したデータを再取得して返却（DBから取得することで整合性を確保） */
    const created = this.getById(id);
    if (!created) {
      throw new Error('Failed to create shortcut');
    }
    return created;
  }

  /**
   * ショートカットを更新
   * @param id - ショートカットID
   * @param name - 新しいショートカット名（未指定なら既存値を保持）
   * @param value - 新しい値（未指定なら既存値を保持）
   * @param profileIds - 新しい紐づけ（未指定なら既存の紐づけを保持。空配列で全プロファイル向け）
   * @param categoryId - 新しい所属カテゴリID（未指定なら既存値を保持。nullで未分類へ戻す）
   * @returns 更新されたショートカット
   * @description
   * 使用回数は更新の対象にしないため、値を書き換えても持ち越す。
   *
   * profileIdsを指定した場合は、旧値と比べず常に置き換える（全削除→挿入）。
   * 値と使用回数は本体の行に持つため、紐づけを変えても失われない。
   * 並び順は紐づけによらない通し番号のため、変えても採り直さない。
   */
  static update(
    id: string,
    name?: string,
    value?: string,
    profileIds?: readonly string[],
    categoryId?: string | null
  ): Shortcut {
    const db = getMainDbAdapter();
    /* 更新対象のショートカットが存在するか確認（存在しない場合はエラー） */
    const existing = this.getById(id);
    if (!existing) {
      throw new Error(`Shortcut not found: ${id}`);
    }

    const now = getCurrentTimestamp();

    db.transaction(() => {
      db.run(ShortcutQueries.UPDATE, [
        categoryId !== undefined ? categoryId : existing.categoryId,
        name !== undefined ? name : existing.name,
        value !== undefined ? value : existing.value,
        existing.sortOrder,
        now,
        id,
      ]);

      if (profileIds !== undefined) {
        this.setProfileIds(id, profileIds);
      }
    });

    /* 更新後のデータを再取得して返却（DBから取得することで整合性を確保） */
    const updated = this.getById(id);
    if (!updated) {
      throw new Error('Failed to update shortcut');
    }
    return updated;
  }

  /**
   * ショートカットを削除
   * @param id - ショートカットID
   * @description
   * 実行時の外部キー強制は行わない方針のため、紐づけも明示的に削除する
   */
  static delete(id: string): void {
    const db = getMainDbAdapter();
    db.transaction(() => {
      db.run(ShortcutProfileQueries.DELETE_BY_SHORTCUT, [id]);
      db.run(ShortcutQueries.DELETE, [id]);
    });
  }

  /**
   * ショートカットの並び順を更新
   * @param orderedIds - 新しい順序のショートカットID配列
   */
  static updateOrder(orderedIds: string[]): void {
    const db = getMainDbAdapter();
    /* 配列のインデックスをそのままsortOrderとして設定 */
    orderedIds.forEach((id, index) => {
      db.run(ShortcutQueries.UPDATE_SORT_ORDER, [index, id]);
    });
  }

  /**
   * ショートカットの使用回数を1加算し、あわせて更新日時を進める
   * @param shortcutId - ショートカットID
   * @description
   * 使用頻度順（§8.9）の根拠に使う。
   * 加算するのはモバイル・Webで値をコピーしたときと、拡張キーボードから値を挿入したときの2か所（§8.12）。
   * 使用回数と更新日時が同じ行にあるため、1文のUPDATEで足りる。
   * ここに置いているのは、iOS版・Android版のMapperが写す正本を1か所に保つためで、
   * TypeScript側からはテストがこの実装を呼んで振る舞いを固定している。
   *
   * 対応するネイティブ実装:
   * - apps/mobile/ios/ClipTapKeyboard/Mappers/ShortcutMapper.swift
   * - apps/mobile/android/app/src/main/java/com/sikakou/cliptap/mappers/ShortcutMapper.kt
   */
  static incrementUseCount(shortcutId: string): void {
    const db = getMainDbAdapter();
    db.run(ShortcutQueries.INCREMENT_USE_COUNT, [getCurrentTimestamp(), shortcutId]);
  }

  /**
   * ショートカット総数を取得
   * @returns 全プロファイル合計のショートカット数（複数プロファイルに紐づくものも1件と数える）
   */
  static count(): number {
    const db = getMainDbAdapter();
    const result = db.get<{ count: number }>(ShortcutQueries.SELECT_COUNT);
    return result?.count || 0;
  }

  /**
   * 指定プロファイルから見えるショートカット数を取得
   * @param profileId - 表示中のプロファイルID
   * @returns ショートカット数（紐づくもの＋0件で全プロファイル向けのもの）
   */
  static countByProfile(profileId: string): number {
    const db = getMainDbAdapter();
    const result = db.get<{ count: number }>(
      ShortcutQueries.SELECT_COUNT_BY_PROFILE,
      [profileId]
    );
    return result?.count || 0;
  }

  /**
   * 次のsortOrder値を取得（新規ショートカット作成時に使用）
   * @returns 全ショートカットの最大sortOrder+1（データが存在しない場合は0）
   *
   * @remarks
   * プロファイルを横断した通し番号にしている。表示順は並べ替え（shortcuts/sort.ts）が
   * 決めるので、通しでも見た目は変わらず、他のマスタ（カテゴリ・プロファイル・変数）とも揃う。
   */
  static getNextSortOrder(): number {
    const db = getMainDbAdapter();
    /* 現在の最大sortOrderを取得（新規ショートカットを末尾に追加するため） */
    const result = db.get<{ maxOrder: number | null }>(ShortcutQueries.SELECT_MAX_SORT_ORDER);
    /* 最大値+1を返す（データがない場合は-1+1=0が返る） */
    return (result?.maxOrder ?? -1) + 1;
  }

  /**
   * ショートカットの紐づけを指定の一覧へ置き換える
   *
   * @param shortcutId - 対象のショートカットID
   * @param profileIds - 紐づけるプロファイルID（検証済み。空配列は全プロファイル向け）
   *
   * @remarks
   * 呼び出し元のトランザクション内で実行することを前提とする。
   * 既存の紐づけを全削除してから挿入する（定型文の`SnippetMapper.setProfileIds`と同じ置き換え方式）。
   * 重複IDは主キー違反になるため、呼び出し側（ShortcutService）で除いてから渡すこと。
   */
  private static setProfileIds(shortcutId: string, profileIds: readonly string[]): void {
    const db = getMainDbAdapter();
    /* 既存の紐づけを全削除（旧値と比べず、常に入力どおりへ置き換える） */
    db.run(ShortcutProfileQueries.DELETE_BY_SHORTCUT, [shortcutId]);

    /* 空配列なら紐づけ行を作らない = 全プロファイル向け */
    for (const profileId of profileIds) {
      db.run(ShortcutProfileQueries.INSERT, [shortcutId, profileId]);
    }
  }
}
