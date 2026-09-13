/**
 * プロファイルマッパー
 *
 * @description
 * プロファイル（環境）のCRUD操作を提供。
 * getMainDbAdapter()経由でDB操作を行い、Mobile/Webで共通のロジックを使用。
 *
 * @module ProfileMapper
 */

import { getMainDbAdapter } from '../adapters/DbAdapter';
import type {
  Profile,
  ProfileVariable,
  CreateProfileInput,
  UpdateProfileInput,
  CreateProfileVariableInput,
} from '../schema';
import { generateUniqueId, getCurrentTimestamp } from '../utils/dateHelpers';
import {
  NotFoundError,
  DatabaseError,
  DuplicateNameError,
  DefaultProfileDeleteError,
} from '../errors';

/* ======================================== */
/* SQLクエリ定義 */
/* ======================================== */

/**
 * 削除するプロファイル「だけ」に紐づくショートカットのIDを返すサブクエリ（`?` は2個とも削除するプロファイルID）
 *
 * @remarks
 * 紐づけから判定するため、紐づけ（shortcut_profiles）を消す前に評価すること。
 * 紐づけが0件のショートカット（全プロファイル向け）は `sp.profileId = ?` に一致する行を持たないため拾わない。
 *
 * 他の紐づけとして数えるのは、実在するプロファイルへの紐づけだけに限る。
 * 存在しないプロファイルへの紐づけを「他にも紐づく」と数えると、削除後にその紐づけだけが残り、
 * どのプロファイルからも見えず0件（全プロファイル向け）にも戻らない行が残ってしまう。
 */
const SHORTCUT_IDS_ONLY_IN_PROFILE = `
  SELECT sp.shortcutId FROM shortcut_profiles sp
  WHERE sp.profileId = ?
    AND NOT EXISTS (SELECT 1 FROM shortcut_profiles other
                    WHERE other.shortcutId = sp.shortcutId AND other.profileId <> ?
                      AND other.profileId IN (SELECT id FROM profiles))
`;

const ProfileQueries = {
  /* 全プロファイルを取得（標準優先→表示順）
     有効判定がSET_VALID_BY_LIMITと同じ並びになるため、
     一覧の上からN件が有効なプロファイルと一致し、無効は末尾へ集まる */
  SELECT_ALL: 'SELECT * FROM profiles ORDER BY isDefault DESC, sortOrder ASC',
  /* 有効なプロファイルのみ取得（Proプランの制限に応じてvalidフラグで絞り込み） */
  SELECT_VALID: 'SELECT * FROM profiles WHERE valid = 1 ORDER BY isDefault DESC, sortOrder ASC',
  /* IDでプロファイルを取得 */
  SELECT_BY_ID: 'SELECT * FROM profiles WHERE id = ?',
  /* 名前でプロファイルを取得（重複チェック用） */
  SELECT_BY_NAME: 'SELECT * FROM profiles WHERE name = ?',
  /* アクティブなプロファイルを取得（現在選択中の環境） */
  SELECT_ACTIVE: 'SELECT * FROM profiles WHERE isActive = 1 LIMIT 1',
  /* デフォルトプロファイルを取得 */
  SELECT_DEFAULT: 'SELECT * FROM profiles WHERE isDefault = 1 LIMIT 1',
  /* プロファイルを新規作成 */
  INSERT: `INSERT INTO profiles (id, name, isDefault, isActive, valid, sortOrder, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  /* 最大のsortOrderを取得（新規作成時に使用） */
  SELECT_MAX_SORT_ORDER: 'SELECT MAX(sortOrder) as maxOrder FROM profiles',
  /* プロファイルを更新（名前、sortOrder） */
  UPDATE: `UPDATE profiles SET name = ?, sortOrder = ?, updatedAt = ? WHERE id = ?`,
  /* プロファイルを削除 */
  DELETE: 'DELETE FROM profiles WHERE id = ?',
  /* 全プロファイルのisActiveをリセット（アクティブ切り替え前処理） */
  RESET_ACTIVE: 'UPDATE profiles SET isActive = 0',
  /* 指定プロファイルをアクティブに設定 */
  SET_ACTIVE: 'UPDATE profiles SET isActive = 1 WHERE id = ?',
  /* 全プロファイルのisDefaultをリセット（デフォルト切り替え前処理） */
  RESET_DEFAULT: 'UPDATE profiles SET isDefault = 0',
  /* 指定プロファイルをデフォルトに設定 */
  SET_DEFAULT: 'UPDATE profiles SET isDefault = 1 WHERE id = ?',
  /* プロファイル総数を取得 */
  SELECT_COUNT: 'SELECT COUNT(*) as count FROM profiles',
  /* 全プロファイルをinvalidに設定（Proプラン制限適用前処理） */
  RESET_VALID: `UPDATE profiles SET valid = 0, updatedAt = ?`,
  /* デフォルトプロファイルを優先し、sortOrder順でlimit件のプロファイルをvalidに設定（Proプラン制限適用） */
  SET_VALID_BY_LIMIT: `
    UPDATE profiles SET valid = 1, updatedAt = ?
    WHERE id IN (
      SELECT id FROM profiles ORDER BY isDefault DESC, sortOrder ASC LIMIT ?
    )
  `,
  /* プロファイル削除時、関連するスニペット・プロファイル紐付けを削除 */
  DELETE_SNIPPET_PROFILES: 'DELETE FROM snippet_profiles WHERE profileId = ?',
  /* プロファイル削除時、そのプロファイルだけに紐づくショートカットの値を削除（バインドは [id, id]） */
  DELETE_SHORTCUT_VALUES: `DELETE FROM shortcut_values
    WHERE shortcutId IN (${SHORTCUT_IDS_ONLY_IN_PROFILE})`,
  /* プロファイル削除時、そのプロファイルだけに紐づくショートカット本体を削除（バインドは [id, id]） */
  DELETE_SHORTCUTS: `DELETE FROM shortcuts
    WHERE id IN (${SHORTCUT_IDS_ONLY_IN_PROFILE})`,
  /* プロファイル削除時、ショートカットとの紐づけを削除（値・本体の削除より後に行う） */
  DELETE_SHORTCUT_PROFILES: 'DELETE FROM shortcut_profiles WHERE profileId = ?',
};

const ProfileVariableQueries = {
  /* 全プロファイル変数を取得 */
  SELECT_ALL: 'SELECT * FROM profile_variables',
  /* プロファイルIDでプロファイル変数を取得 */
  SELECT_BY_PROFILE: 'SELECT * FROM profile_variables WHERE profileId = ?',
  /* プロファイルIDと変数IDでプロファイル変数を取得（一意検索） */
  SELECT_BY_PROFILE_AND_VARIABLE: 'SELECT * FROM profile_variables WHERE profileId = ? AND variableId = ?',
  /* IDでプロファイル変数を取得 */
  SELECT_BY_ID: 'SELECT * FROM profile_variables WHERE id = ?',
  /* プロファイル変数を新規作成 */
  INSERT: `INSERT INTO profile_variables (id, profileId, variableId, value, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)`,
  /* プロファイルIDと変数IDでプロファイル変数の値を更新 */
  UPDATE_BY_PROFILE_AND_VARIABLE: `UPDATE profile_variables SET value = ?, updatedAt = ? WHERE profileId = ? AND variableId = ?`,
  /* プロファイルIDに紐づく全プロファイル変数を削除 */
  DELETE_BY_PROFILE: 'DELETE FROM profile_variables WHERE profileId = ?',
  /* 変数IDに紐づく全プロファイル変数を削除 */
  DELETE_BY_VARIABLE: 'DELETE FROM profile_variables WHERE variableId = ?',
  /* プロファイルIDで変数名と値を取得（JOIN使用、スニペット置換で使用） */
  SELECT_WITH_VARIABLE_NAMES: `
    SELECT v.name, pv.value
    FROM profile_variables pv
    INNER JOIN variables v ON pv.variableId = v.id
    WHERE pv.profileId = ? AND v.valid = 1
  `,
};

/* ======================================== */
/* 行変換関数 */
/* ======================================== */

/**
 * DB行データをProfileエンティティに変換
 * @param row - データベースから取得した行データ
 * @returns Profile型のオブジェクト
 */
const toProfileEntity = (row: any): Profile => ({
  id: row.id, /* プロファイルID */
  name: row.name, /* プロファイル名 */
  isDefault: Boolean(row.isDefault), /* デフォルトプロファイルか（SQLiteでは0/1、JSではboolean） */
  isActive: Boolean(row.isActive), /* アクティブプロファイルか（現在選択中の環境） */
  valid: Boolean(row.valid), /* 有効かどうか（Proプラン制限） */
  sortOrder: row.sortOrder ?? 0, /* 並び順 */
  createdAt: row.createdAt, /* 作成日時 */
  updatedAt: row.updatedAt, /* 最終更新日時 */
});

/**
 * DB行データの配列をProfileエンティティの配列に変換
 * @param rows - データベースから取得した行データの配列
 * @returns Profile型の配列
 */
const toProfileEntities = (rows: any[]): Profile[] => rows.map(toProfileEntity);

/**
 * DB行データをProfileVariableエンティティに変換
 * @param row - データベースから取得した行データ
 * @returns ProfileVariable型のオブジェクト
 */
const toPVEntity = (row: any): ProfileVariable => ({
  id: row.id, /* プロファイル変数ID */
  profileId: row.profileId, /* プロファイルID */
  variableId: row.variableId, /* 変数ID */
  value: row.value, /* 変数値（このプロファイルでの値） */
  createdAt: row.createdAt, /* 作成日時 */
  updatedAt: row.updatedAt, /* 最終更新日時 */
});

/**
 * DB行データの配列をProfileVariableエンティティの配列に変換
 * @param rows - データベースから取得した行データの配列
 * @returns ProfileVariable型の配列
 */
const toPVEntities = (rows: any[]): ProfileVariable[] => rows.map(toPVEntity);

/**
 * プロファイルマッパー
 *
 * @description
 * プロファイル（環境）のCRUD操作を提供する静的メソッド群
 */
export class ProfileMapper {
  /** バックアップ行をID・日時・状態・並び順ごと逐語復元する。 */
  static restore(profile: Profile): void {
    getMainDbAdapter().run(ProfileQueries.INSERT, [
      profile.id,
      profile.name,
      profile.isDefault ? 1 : 0,
      profile.isActive ? 1 : 0,
      profile.valid ? 1 : 0,
      profile.sortOrder,
      profile.createdAt,
      profile.updatedAt,
    ]);
  }

  /**
   * 有効な全プロファイルを取得
   * @returns 有効なプロファイル一覧（標準優先→表示順）
   */
  static getAll(): Profile[] {
    const db = getMainDbAdapter();
    const rows = db.all<any>(ProfileQueries.SELECT_VALID);
    return toProfileEntities(rows);
  }

  /**
   * 無効なものも含む全プロファイルを取得
   * @returns 全プロファイル（標準優先→表示順）
   */
  static getAllIncludingInvalid(): Profile[] {
    const db = getMainDbAdapter();
    const rows = db.all<any>(ProfileQueries.SELECT_ALL);
    return toProfileEntities(rows);
  }

  /**
   * IDでプロファイルを取得
   * @param id - プロファイルID
   * @returns プロファイル（存在しない場合はnull）
   */
  static getById(id: string): Profile | null {
    const db = getMainDbAdapter();
    const row = db.get<any>(ProfileQueries.SELECT_BY_ID, [id]);
    return row ? toProfileEntity(row) : null;
  }

  /**
   * 名前でプロファイルを取得
   * @param name - プロファイル名
   * @returns プロファイル（存在しない場合はnull）
   */
  static getByName(name: string): Profile | null {
    const db = getMainDbAdapter();
    const row = db.get<any>(ProfileQueries.SELECT_BY_NAME, [name]);
    return row ? toProfileEntity(row) : null;
  }

  /**
   * アクティブなプロファイルを取得
   * @returns 現在アクティブなプロファイル（存在しない場合はnull）
   */
  static getActive(): Profile | null {
    const db = getMainDbAdapter();
    const row = db.get<any>(ProfileQueries.SELECT_ACTIVE);
    return row ? toProfileEntity(row) : null;
  }

  /**
   * デフォルトプロファイルを取得
   * @returns デフォルトプロファイル（存在しない場合はnull）
   */
  static getDefault(): Profile | null {
    const db = getMainDbAdapter();
    const row = db.get<any>(ProfileQueries.SELECT_DEFAULT);
    return row ? toProfileEntity(row) : null;
  }

  /**
   * プロファイルを作成
   * @param data - 作成データ
   * @param isDefault - デフォルトプロファイルかどうか（通常はfalse）
   * @returns 作成されたプロファイル
   */
  static create(data: CreateProfileInput, isDefault?: boolean): Profile {
    const db = getMainDbAdapter();
    /* 同名のプロファイルが既に存在するかチェック */
    const existing = this.getByName(data.name);
    if (existing) {
      throw new DuplicateNameError('profile', data.name);
    }

    /* 新規IDとタイムスタンプを生成 */
    const id = generateUniqueId();
    const now = getCurrentTimestamp();
    /* sortOrderが指定されている場合はそれを使用、なければ既存プロファイルの最大sortOrder+1を次の並び順として設定（末尾に追加） */
    const sortOrder = data.sortOrder !== undefined ? data.sortOrder : this.getNextSortOrder();

    /* データベースに新規プロファイルを挿入 */
    db.run(ProfileQueries.INSERT, [
      id,
      data.name,
      isDefault ? 1 : 0, /* isDefault（デフォルトプロファイルかどうか） */
      0, /* isActive（初期値は非アクティブ） */
      1, /* valid（初期値は有効） */
      sortOrder,
      now,
      now,
    ]);

    /* 挿入したデータを再取得して返却（整合性確保） */
    const profile = this.getById(id);
    if (!profile) {
      throw new DatabaseError('Failed to create profile');
    }
    return profile;
  }

  /**
   * プロファイルを更新
   * @param id - プロファイルID
   * @param data - 更新データ
   * @returns 更新されたプロファイル
   */
  static update(id: string, data: UpdateProfileInput): Profile {
    const db = getMainDbAdapter();
    /* 更新対象のプロファイルが存在するか確認 */
    const profile = this.getById(id);

    if (!profile) {
      throw new NotFoundError('profile', id);
    }

    /* プロファイル名が変更される場合、新しい名前の重複をチェック */
    if (data.name && data.name !== profile.name) {
      const existing = this.getByName(data.name);
      if (existing) {
        throw new DuplicateNameError('profile', data.name);
      }
    }

    const now = getCurrentTimestamp();
    /* 指定された名前があればそれを使用、未指定なら既存値を保持 */
    const newName = data.name !== undefined ? data.name : profile.name;
    /* 指定されたsortOrderがあればそれを使用、未指定なら既存値を保持 */
    const newSortOrder = data.sortOrder !== undefined ? data.sortOrder : profile.sortOrder;

    /* プロファイルを更新（名前とsortOrder） */
    db.run(ProfileQueries.UPDATE, [newName, newSortOrder, now, id]);

    /* 更新後のデータを再取得して返却（整合性確保） */
    const updated = this.getById(id);
    if (!updated) {
      throw new DatabaseError('Failed to update profile');
    }
    return updated;
  }

  /**
   * プロファイルを削除
   * @param id - プロファイルID
   */
  static delete(id: string): void {
    const db = getMainDbAdapter();
    const profile = this.getById(id);

    if (!profile) {
      throw new NotFoundError('profile', id);
    }

    if (profile.isDefault) {
      throw new DefaultProfileDeleteError();
    }

    /* カスケード削除: 関連データを全て削除（参照整合性維持）。
       実行時に外部キーを強制していないため、宣言したON DELETE CASCADEは働かない。
       ショートカットは、このプロファイルだけに紐づくものを値ごと消す。紐づけだけを外すと
       紐づけが0件になり、全プロファイル向けとして他のプロファイルへ静かに広がってしまうため。
       他のプロファイルにも紐づくものは紐づけだけを外し、はじめから0件（全プロファイル向け）のものは触らない
       （定型文・変数は本体が残る） */
    db.run(ProfileVariableQueries.DELETE_BY_PROFILE, [id]); /* プロファイル変数を削除 */
    db.run(ProfileQueries.DELETE_SNIPPET_PROFILES, [id]); /* スニペット関連を削除 */
    /* 値→本体→紐づけの順に消す。値と本体は「このプロファイルだけに紐づくか」を紐づけから判定するため、
       先に紐づけを消すと判定できなくなる（専用のものが0件になって全プロファイル向けに残る） */
    db.run(ProfileQueries.DELETE_SHORTCUT_VALUES, [id, id]); /* 専用ショートカットの値を削除 */
    db.run(ProfileQueries.DELETE_SHORTCUTS, [id, id]); /* 専用ショートカット本体を削除 */
    db.run(ProfileQueries.DELETE_SHORTCUT_PROFILES, [id]); /* このプロファイルへの紐づけを削除 */
    db.run(ProfileQueries.DELETE, [id]); /* プロファイルを削除 */
  }

  /**
   * アクティブプロファイルを設定
   * @param id - アクティブにするプロファイルID
   */
  static setActive(id: string): void {
    const db = getMainDbAdapter();
    const profile = this.getById(id);

    if (!profile) {
      throw new NotFoundError('profile', id);
    }

    /* 全プロファイルのisActiveをリセット後、指定プロファイルのみアクティブ化 */
    db.run(ProfileQueries.RESET_ACTIVE);
    db.run(ProfileQueries.SET_ACTIVE, [id]);
  }

  /**
   * デフォルトプロファイルを設定
   * @param id - デフォルトにするプロファイルID
   */
  static setDefault(id: string): void {
    const db = getMainDbAdapter();
    const profile = this.getById(id);

    if (!profile) {
      throw new NotFoundError('profile', id);
    }

    /* 全プロファイルのisDefaultをリセット後、指定プロファイルのみデフォルト化 */
    /* ここでトランザクションを張らないこと。インポートの全復元・選択インポートが
       トランザクション内からsetDefaultを呼ぶため入れ子になり、
       SAVEPOINT非対応のアダプターで取込全体が失敗する。
       不可分性が必要な呼び出し側（ProfileProvider）でトランザクションを張る */
    db.run(ProfileQueries.RESET_DEFAULT);
    db.run(ProfileQueries.SET_DEFAULT, [id]);
  }

  /**
   * プロファイル総数を取得
   * @returns プロファイル数
   */
  static count(): number {
    const db = getMainDbAdapter();
    const result = db.get<{ count: number }>(ProfileQueries.SELECT_COUNT);
    return result?.count || 0;
  }

  /**
   * プランに応じてvalidフラグを更新
   * @param limit - 有効にするプロファイル数（無料プランは3、Proプランは無制限）
   * @description
   * 無料プランではデフォルトプロファイルを優先し、sortOrder順にlimit件のみvalidにする。
   * デフォルトプロファイルも含めてlimit件にカウントされる。
   */
  static updateValidFlags(limit: number): void {
    const db = getMainDbAdapter();
    const now = getCurrentTimestamp();
    /* 全プロファイルを無効化（Proプラン制限適用前処理） */
    db.run(ProfileQueries.RESET_VALID, [now]);
    /* デフォルトプロファイルを優先し、sortOrder順でlimit件のプロファイルのみ有効化 */
    db.run(ProfileQueries.SET_VALID_BY_LIMIT, [now, limit]);
  }

  /**
   * 次のsortOrder値を取得（新規プロファイル作成時・インポート時に使用）
   * @returns 既存の最大sortOrder+1（データが存在しない場合は0）
   */
  static getNextSortOrder(): number {
    const db = getMainDbAdapter();
    /* 現在の最大sortOrderを取得（新規プロファイルを末尾に追加するため） */
    const result = db.get<{ maxOrder: number | null }>(
      ProfileQueries.SELECT_MAX_SORT_ORDER
    );
    /* 最大値+1を返す（データがない場合は-1+1=0が返る） */
    return (result?.maxOrder ?? -1) + 1;
  }
}

/**
 * プロファイル変数マッパー
 *
 * @description
 * プロファイル変数（profile_variables）のCRUD操作を提供する静的メソッド群。
 * プロファイルごとに異なる変数値を管理する。
 */
export class ProfileVariableMapper {
  /** バックアップ行をID・日時ごと逐語復元する。 */
  static restore(profileVariable: ProfileVariable): void {
    getMainDbAdapter().run(ProfileVariableQueries.INSERT, [
      profileVariable.id,
      profileVariable.profileId,
      profileVariable.variableId,
      profileVariable.value,
      profileVariable.createdAt,
      profileVariable.updatedAt,
    ]);
  }

  /**
   * プロファイルIDで変数一覧を取得
   * @param profileId - プロファイルID
   * @returns 該当プロファイルの全変数
   */
  static getByProfileId(profileId: string): ProfileVariable[] {
    const db = getMainDbAdapter();
    const rows = db.all<any>(ProfileVariableQueries.SELECT_BY_PROFILE, [profileId]);
    return toPVEntities(rows);
  }


  /**
   * プロファイルIDと変数IDで変数を取得
   * @param profileId - プロファイルID
   * @param variableId - 変数ID
   * @returns プロファイル変数（存在しない場合はnull）
   */
  static get(profileId: string, variableId: string): ProfileVariable | null {
    const db = getMainDbAdapter();
    const row = db.get<any>(
      ProfileVariableQueries.SELECT_BY_PROFILE_AND_VARIABLE,
      [profileId, variableId]
    );
    return row ? toPVEntity(row) : null;
  }

  /**
   * プロファイル変数を設定（存在すれば更新、なければ作成）
   * @param data - プロファイル変数データ
   * @returns 設定されたプロファイル変数
   * @description
   * upsert操作: 既存レコードがあれば更新、なければ新規作成。
   */
  static upsert(data: CreateProfileVariableInput): ProfileVariable {
    const db = getMainDbAdapter();
    /* 既存レコードの有無を確認（upsert処理の判定） */
    const existing = this.get(data.profileId, data.variableId);
    const now = getCurrentTimestamp();

    if (existing) {
      /* 既存レコードがある場合: 更新 */
      db.run(ProfileVariableQueries.UPDATE_BY_PROFILE_AND_VARIABLE, [
        data.value,
        now,
        data.profileId,
        data.variableId,
      ]);
      /* 更新後のデータを再取得して返却（整合性確保） */
      const updated = this.get(data.profileId, data.variableId);
      if (!updated) {
        throw new DatabaseError('Failed to update profile variable');
      }
      return updated;
    } else {
      /* 既存レコードがない場合: 新規作成 */
      const id = generateUniqueId();
      db.run(ProfileVariableQueries.INSERT, [
        id,
        data.profileId,
        data.variableId,
        data.value,
        now,
        now,
      ]);
      /* 挿入したデータを再取得して返却（整合性確保） */
      const row = db.get<any>(ProfileVariableQueries.SELECT_BY_ID, [id]);
      if (!row) {
        throw new DatabaseError('Failed to create profile variable');
      }
      return toPVEntity(row);
    }
  }

  /**
   * プロファイルIDに紐づく全変数を削除
   * @param profileId - プロファイルID
   * @description
   * プロファイル削除時に使用。関連する全変数を削除する。
   */
  static deleteByProfileId(profileId: string): void {
    const db = getMainDbAdapter();
    db.run(ProfileVariableQueries.DELETE_BY_PROFILE, [profileId]);
  }

  /**
   * 変数IDに紐づく全プロファイル変数を削除
   * @param variableId - 変数ID
   * @description
   * 変数削除時に使用。関連する全プロファイル値を削除する。
   */
  static deleteByVariableId(variableId: string): void {
    const db = getMainDbAdapter();
    db.run(ProfileVariableQueries.DELETE_BY_VARIABLE, [variableId]);
  }

  /**
   * 全プロファイル変数を取得
   * @returns 全プロファイル変数
   */
  static getAll(): ProfileVariable[] {
    const db = getMainDbAdapter();
    const rows = db.all<any>(ProfileVariableQueries.SELECT_ALL);
    return toPVEntities(rows);
  }

  /**
   * プロファイルIDで変数を取得（変数名を含む）
   * @param profileId - プロファイルID
   * @returns 変数名と値のペア配列
   * @description
   * スニペット置換時に使用。変数名と値のマップを作成するためのデータを取得。
   */
  static getByProfileIdWithVariableNames(profileId: string): Array<{ name: string; value: string }> {
    const db = getMainDbAdapter();
    return db.all<{ name: string; value: string }>(
      ProfileVariableQueries.SELECT_WITH_VARIABLE_NAMES,
      [profileId]
    );
  }
}
