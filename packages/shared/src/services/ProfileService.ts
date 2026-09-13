/**
 * プロファイルサービス
 *
 * @description
 * プロファイル（環境）のCRUD操作と変数値の設定を提供する共通サービス。
 * Mapper層を経由してデータアクセスを行う。
 *
 * @module ProfileService
 */

import { ProfileMapper, ProfileVariableMapper } from '../mappers/ProfileMapper';
import type {
  Profile,
  ProfileVariable,
  CreateProfileInput,
  UpdateProfileInput,
} from '../schema';
import {
  NotFoundError,
  DefaultProfileDeleteError,
  DuplicateNameError,
  EmptyContentError,
  InvalidProfileDefaultError,
} from '../errors';
import { Logger } from '../utils/logger';

/**
 * プロファイルサービス
 *
 * @description
 * 静的メソッドでプロファイル操作を提供。
 * バリデーションを行い、Mapper層に処理を委譲。
 */
export class ProfileService {
  /**
   * 全プロファイルを取得（有効なもののみ）
   *
   * @returns 有効なプロファイルの配列（validフラグがtrueのもののみ）
   *
   * @remarks
   * - 無料プランの場合、上限を超えたプロファイルはvalidフラグがfalseになる
   * - sortOrder順でソート済み
   */
  static getAll(): Profile[] {
    return ProfileMapper.getAll();
  }

  /**
   * 全プロファイルを取得（無効なものも含む）
   *
   * @returns すべてのプロファイルの配列（validフラグに関わらず）
   *
   * @remarks
   * - 管理画面等で全プロファイルを表示する際に使用
   */
  static getAllIncludingInvalid(): Profile[] {
    return ProfileMapper.getAllIncludingInvalid();
  }

  /**
   * IDでプロファイルを取得
   *
   * @param id - プロファイルのID
   * @returns プロファイルオブジェクト（存在しない場合はnull）
   */
  static getById(id: string): Profile | null {
    return ProfileMapper.getById(id);
  }

  /**
   * アクティブなプロファイルを取得
   *
   * @returns アクティブなプロファイル（存在しない場合はnull）
   *
   * @remarks
   * - 現在選択されているプロファイルを取得
   * - 変数展開時にデフォルトで使用される
   */
  static getActive(): Profile | null {
    return ProfileMapper.getActive();
  }

  /**
   * デフォルトプロファイルを取得
   *
   * @returns デフォルトプロファイル（存在しない場合はnull）
   *
   * @remarks
   * - isDefaultフラグがtrueのプロファイルを取得
   * - 通常は最初に作成されたプロファイル
   */
  static getDefault(): Profile | null {
    return ProfileMapper.getDefault();
  }

  /**
   * プロファイルを作成
   * @throws {EmptyContentError} プロファイル名が空の場合
   * @throws {DuplicateNameError} 同名のプロファイルが既に存在する場合
   */
  static create(data: CreateProfileInput): Profile {
    /* プロファイル名の前後空白をトリム */
    const trimmedName = data.name.trim();
    /* 空白のみの名前は一覧で識別できず重複判定もすり抜けるため、trim後の空文字を拒否する */
    if (!trimmedName) {
      throw new EmptyContentError();
    }

    /* 同名のプロファイルが既に存在するかチェック */
    const existing = ProfileMapper.getByName(trimmedName);
    if (existing) {
      throw new DuplicateNameError('profile', trimmedName);
    }

    /* 検証はService、SQLはMapperに集約する規約のため、検証済みデータをそのままMapperへ渡す */
    return ProfileMapper.create({ ...data, name: trimmedName });
  }

  /**
   * プロファイルを更新
   * @throws {NotFoundError} プロファイルが存在しない場合
   * @throws {EmptyContentError} プロファイル名が空の場合
   * @throws {DuplicateNameError} 同名のプロファイルが既に存在する場合
   */
  static update(id: string, data: UpdateProfileInput): Profile {
    /* 更新対象のプロファイルが存在するか確認 */
    const existing = ProfileMapper.getById(id);
    if (!existing) {
      throw new NotFoundError('profile', id);
    }

    let updateData = { ...data };
    /* プロファイル名が指定されている場合はバリデーションと重複チェック */
    if (data.name !== undefined) {
      /* プロファイル名の前後空白をトリム */
      const trimmedName = data.name.trim();
      /* 空白のみの名前は一覧で識別できず重複判定もすり抜けるため、trim後の空文字を拒否する */
      if (!trimmedName) {
        throw new EmptyContentError();
      }

      /* 名前が変更される場合のみ重複チェック（自分自身は除外） */
      if (trimmedName !== existing.name) {
        const duplicate = ProfileMapper.getByName(trimmedName);
        if (duplicate) {
          throw new DuplicateNameError('profile', trimmedName);
        }
      }

      /* トリム済みの名前で更新データを準備 */
      updateData = { ...updateData, name: trimmedName };
    }

    /* 検証はService、SQLはMapperに集約する規約のため、検証済みデータをそのままMapperへ渡す */
    return ProfileMapper.update(id, updateData);
  }

  /**
   * プロファイルを削除
   * @throws {NotFoundError} プロファイルが存在しない場合
   * @throws {DefaultProfileDeleteError} デフォルトプロファイルを削除しようとした場合
   */
  static delete(id: string): void {
    /* 削除対象のプロファイルが存在するか確認 */
    const profile = ProfileMapper.getById(id);
    if (!profile) {
      throw new NotFoundError('profile', id);
    }

    /* デフォルトプロファイルは削除不可（保護） */
    if (profile.isDefault) {
      throw new DefaultProfileDeleteError();
    }

    /* カスケード削除: プロファイル変数を先に削除してからプロファイルを削除（参照整合性維持） */
    ProfileVariableMapper.deleteByProfileId(id);
    ProfileMapper.delete(id);
  }

  /**
   * アクティブプロファイルを切り替え
   *
   * @remarks
   * アクティブにできるのは有効なプロファイルだけとする。
   * プラン上限で無効になったプロファイルを指定された場合は、標準プロファイルへ切り替える。
   *
   * @throws {NotFoundError} プロファイルが存在しない場合
   */
  static setActive(id: string): void {
    /* アクティブにするプロファイルが存在するか確認 */
    const profile = ProfileMapper.getById(id);
    if (!profile) {
      throw new NotFoundError('profile', id);
    }

    /* 無効なプロファイルは展開・絞り込みの基準にできないため標準プロファイルへ振り替える */
    if (!profile.valid) {
      const defaultProfile = ProfileMapper.getDefault();
      if (defaultProfile && defaultProfile.id !== id) {
        Logger.warn(
          `[ProfileService] Invalid profile requested as active, falling back to default: ${id}`
        );
        ProfileMapper.setActive(defaultProfile.id);
        return;
      }
    }

    /* Mapper層に処理を委譲（全プロファイルのisActiveをリセット後、指定プロファイルのみアクティブ化） */
    ProfileMapper.setActive(id);
  }

  /**
   * デフォルトプロファイルを設定
   *
   * @remarks
   * 標準にできるのは有効なプロファイルだけとする。
   * 標準は変数値のフォールバック先であり、無効プロファイルをアクティブ指定した際の
   * 振替先でもあるため、無効なものを標準にすると両方の解決先が失われる。
   * setActiveと違い振替先が存在しないため、フォールバックせずエラーとする。
   *
   * @param id - デフォルトにするプロファイルID
   * @throws {NotFoundError} プロファイルが存在しない場合
   * @throws {InvalidProfileDefaultError} プロファイルが無効な場合
   */
  static setDefault(id: string): void {
    /* デフォルトにするプロファイルが存在するか確認 */
    const profile = ProfileMapper.getById(id);
    if (!profile) {
      throw new NotFoundError('profile', id);
    }

    /* 無効なプロファイルはフォールバック先・振替先にできないため標準にしない */
    if (!profile.valid) {
      throw new InvalidProfileDefaultError();
    }

    /* Mapper層に処理を委譲（全プロファイルのisDefaultをリセット後、指定プロファイルのみデフォルト化） */
    ProfileMapper.setDefault(id);
  }

  /**
   * 標準・アクティブプロファイルが欠けている場合に同じ対象で補完する
   *
   * @remarks
   * 補完先は有効なプロファイルに限る。標準は値フォールバック先、アクティブは展開と
   * 絞り込みの基準であり、無効なものを指定すると解決先が失われるため。
   * getAll()は有効なもののみを返すため、その先頭を補完先とする。
   * 有効なプロファイルが1件もない場合は補完しない。
   */
  static ensureDefaultAndActive(): void {
    const defaultProfile = this.getDefault();
    const activeProfile = this.getActive();
    if (defaultProfile && activeProfile) return;

    const targetProfileId = this.getAll()[0]?.id;
    if (!targetProfileId) {
      Logger.warn('[ProfileService] No profile available for default/active state');
      return;
    }

    if (!defaultProfile) this.setDefault(targetProfileId);
    if (!activeProfile) this.setActive(targetProfileId);
  }

  /* ======================================== */
  /* ProfileVariable操作 */
  /* ======================================== */


  /**
   * 全プロファイル変数を取得
   */
  static getAllProfileVariables(): ProfileVariable[] {
    return ProfileVariableMapper.getAll();
  }

  /**
   * 変数の全プロファイル値を一括設定
   *
   * @remarks
   * 値は前後空白を除去して保存する。
   * 空白だけの値をそのまま保存すると、必須判定（前後空白を除去して判定する）では
   * 空なのに解決時は非空として標準値を覆う、という矛盾が起きるため、
   * 書き込み境界であるService層で正規化する。
   */
  static setVariableValuesForVariable(
    _variableId: string,
    values: { profileId: string; variableId: string; value: string }[]
  ): void {
    for (const v of values) {
      ProfileVariableMapper.upsert({ ...v, value: v.value.trim() });
    }
  }

  /**
   * プロファイルの変数マップを取得
   */
  static getProfileVariablesMap(profileId: string): Record<string, string> {
    const variables = ProfileVariableMapper.getByProfileIdWithVariableNames(profileId);
    const map: Record<string, string> = {};
    for (const v of variables) {
      map[v.name] = v.value;
    }
    return map;
  }

  /**
   * アクティブプロファイルの変数マップを取得
   */
  static getActiveProfileVariablesMap(): Record<string, string> {
    const activeProfile = ProfileMapper.getActive();
    if (!activeProfile) {
      return {};
    }
    return this.getProfileVariablesMap(activeProfile.id);
  }

  /**
   * デフォルトプロファイルの変数マップを取得
   */
  static getDefaultProfileVariablesMap(): Record<string, string> {
    const defaultProfile = ProfileMapper.getDefault();
    if (!defaultProfile) {
      return {};
    }
    return this.getProfileVariablesMap(defaultProfile.id);
  }

  /* ======================================== */
  /* 拡張メソッド（Mobile/Web共通） */
  /* ======================================== */

  /**
   * プロファイルを削除（アクティブなプロファイルの自動切り替え付き）
   *
   * @param id - 削除するプロファイルのID
   *
   * @remarks
   * - 削除対象がアクティブな場合、デフォルト（標準）プロファイルにアクティブを切り替える
   * - デフォルトプロファイルは削除不可なので、必ず切り替え先が存在する
   * - 有効フラグの再計算は呼び出し側（ProfileProvider）がトランザクション内で行う
   *
   * @throws {NotFoundError} プロファイルが存在しない場合
   * @throws {DefaultProfileDeleteError} デフォルトプロファイルを削除しようとした場合
   */
  static deleteWithAutoSwitch(id: string): void {
    const profile = this.getById(id);
    if (!profile) {
      throw new NotFoundError('profile', id);
    }

    /* アクティブなプロファイルを削除する場合は、デフォルトプロファイルに切り替え */
    if (profile.isActive) {
      const defaultProfile = this.getDefault();
      if (defaultProfile) {
        ProfileMapper.setActive(defaultProfile.id);
      }
    }

    this.delete(id);
  }
}
