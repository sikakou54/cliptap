/**
 * プロファイル管理Provider
 *
 * @description
 * プロファイルとプロファイル変数のグローバル状態を管理するProvider。
 * すべての画面で同じデータを参照でき、一箇所で更新すると全画面に即座に反映される。
 *
 * @module ProfileProvider
 */

import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { ProfileService } from '../services/ProfileService';
import { SubscriptionService } from '../services/SubscriptionService';
import { getMainDbAdapter } from '../adapters/DbAdapter';
import { Logger } from '../utils/logger';
import { useDatabase } from './DatabaseProvider';
import type { Profile, ProfileVariable, CreateProfileInput, UpdateProfileInput } from '../schema';

/* ======================================== */
/* 型定義 */
/* ======================================== */

/**
 * ProfileContextの型定義
 */
export interface ProfileContextValue {
  /** プロファイル一覧（無効なものも含む。管理画面のように無効を明示する画面で使用する） */
  profiles: Profile[];
  /** 有効なプロファイル一覧（切替・選択・展開など通常利用の選択肢はこちらを使用する） */
  validProfiles: Profile[];
  /** プロファイル変数一覧 */
  profileVariables: ProfileVariable[];
  /** アクティブなプロファイル */
  activeProfile: Profile | null;
  /** デフォルトプロファイル */
  defaultProfile: Profile | null;
  /** データ読み込み中フラグ */
  loading: boolean;
  /** エラー情報 */
  error: Error | null;
  /** データ再読み込み */
  refresh: () => void;
  /** プロファイル作成 */
  createProfile: (input: CreateProfileInput) => Profile;
  /** プロファイル更新 */
  updateProfile: (id: string, data: UpdateProfileInput) => Profile;
  /** プロファイル削除 */
  deleteProfile: (id: string) => void;
  /** アクティブプロファイルを設定 */
  setActiveProfile: (id: string) => void;
  /** 標準プロファイルを設定 */
  setDefaultProfile: (id: string) => void;
}

/**
 * ProfileProviderのProps
 */
interface ProfileProviderProps {
  /** 子コンポーネント */
  children: ReactNode;
}

/* ======================================== */
/* Context */
/* ======================================== */

const ProfileContext = createContext<ProfileContextValue | null>(null);

/* ======================================== */
/* Provider */
/* ======================================== */

/**
 * プロファイル管理Provider
 *
 * @param props - ProfileProviderProps
 */
export function ProfileProvider({ children }: ProfileProviderProps) {
  /* ======================================== */
  /* 状態管理 */
  /* ======================================== */
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profileVariables, setProfileVariables] = useState<ProfileVariable[]>([]);
  const [activeProfile, setActiveProfileState] = useState<Profile | null>(null);
  const [defaultProfile, setDefaultProfileState] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  /* データベース初期化状態（DatabaseProviderが必須） */
  const { isLoaded: isDatabaseLoaded } = useDatabase();

  /* ======================================== */
  /* データ読み込み */
  /* ======================================== */
  const loadProfiles = useCallback(() => {
    try {
      setLoading(true);
      Logger.info('[ProfileProvider] loadProfiles called');

      /* アクティブ未設定のときは標準プロファイルを昇格させる。DBのisActiveも書き換えるため、次回以降の読み込みでも同じプロファイルが選ばれる */
      /* 昇格はstateへ反映する前に済ませる。読み込んだ後に書き換えると、profiles配列だけが
         書き換え前のスナップショットのまま残り、全要素のisActiveがfalseの状態でactiveProfileと
         食い違う。この食い違いを踏むと環境を指定した定型文が一覧から消えるため、
         必ず「DB書込 → 読込 → state反映」の順にする */
      if (!ProfileService.getActive()) {
        const defaultProfileToActivate = ProfileService.getDefault();
        if (defaultProfileToActivate) {
          ProfileService.setActive(defaultProfileToActivate.id);
          Logger.info('[ProfileProvider] Auto-activated default profile:', defaultProfileToActivate.id);
        }
      }

      const allProfiles = ProfileService.getAllIncludingInvalid();
      Logger.info('[ProfileProvider] Loaded profiles count:', allProfiles.length);

      const allVars = ProfileService.getAllProfileVariables();
      Logger.info('[ProfileProvider] Loaded profile variables count:', allVars.length);

      const defaultProf = ProfileService.getDefault();
      Logger.info('[ProfileProvider] Default profile:', defaultProf?.name ?? 'none');

      const active = ProfileService.getActive();
      Logger.info('[ProfileProvider] Active profile:', active?.name ?? 'none');

      /* 同一スナップショットとして一括で反映する */
      setProfiles(allProfiles);
      setProfileVariables(allVars);
      setDefaultProfileState(defaultProf);
      setActiveProfileState(active);
      setError(null);
    } catch (err) {
      Logger.error('[ProfileProvider] Failed to load profiles:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  /* データベースが初期化された後にデータを読み込む */
  useEffect(() => {
    if (!isDatabaseLoaded) return;
    loadProfiles();
  }, [loadProfiles, isDatabaseLoaded]);

  /* ======================================== */
  /* CRUD操作 */
  /* ======================================== */

  /**
   * プロファイル作成
   *
   * 作成後に一覧を再読込し、Contextを参照する全画面へ即時反映する。
   */
  const createProfile = useCallback(
    (input: CreateProfileInput): Profile => {
      const profile = ProfileService.create(input);
      loadProfiles();
      return profile;
    },
    [loadProfiles]
  );

  /**
   * プロファイル更新
   *
   * 更新後に一覧を再読込し、Contextを参照する全画面へ即時反映する。
   */
  const updateProfile = useCallback(
    (id: string, data: UpdateProfileInput): Profile => {
      const profile = ProfileService.update(id, data);
      loadProfiles();
      return profile;
    },
    [loadProfiles]
  );

  /**
   * プロファイル削除
   *
   * @remarks
   * アクティブの振替、削除、有効フラグ再計算を1つのトランザクションにまとめる。
   * 削除で件数が減るとFreeの上限に空きが出るため、無効→有効への昇格を即時反映する。
   * ここを唯一の削除経路とし、モバイルとWebで挙動を揃える。
   */
  const deleteProfile = useCallback(
    (id: string): void => {
      getMainDbAdapter().transaction(() => {
        ProfileService.deleteWithAutoSwitch(id);
        SubscriptionService.updateValidFlags();
      });
      loadProfiles();
    },
    [loadProfiles]
  );

  /**
   * アクティブプロファイルを設定
   *
   * 設定後に一覧を再読込し、activeProfileと一覧を同じスナップショットへ揃える。
   */
  const setActiveProfile = useCallback(
    (id: string): void => {
      ProfileService.setActive(id);
      loadProfiles();
    },
    [loadProfiles]
  );

  /**
   * 標準プロファイルを設定
   *
   * @remarks
   * 標準の切替と有効フラグ再計算を1つのトランザクションにまとめる。
   * 標準の切替は「isDefaultの一括リセット」と「対象のみ有効化」の2文で構成されるため、
   * 途中で失敗すると標準0件になり変数値のフォールバック先が失われる。
   * また有効判定は標準を最優先に表示順で行うため、切替でFreeの有効な集合が変わりうる。
   * Mapper側でトランザクションを張らないのは、復元（全件置換）が
   * 既にトランザクション内からsetDefaultを呼んでおり、アダプタがネストに対応しないため。
   */
  const setDefaultProfile = useCallback(
    (id: string): void => {
      getMainDbAdapter().transaction(() => {
        ProfileService.setDefault(id);
        SubscriptionService.updateValidFlags();
      });
      loadProfiles();
    },
    [loadProfiles]
  );

  /**
   * 有効なプロファイル一覧
   *
   * プラン上限を超えて無効になったプロファイルは、通常利用の選択肢・展開対象から
   * 除外する。無効なものを明示的に扱う画面（プロファイル管理）だけがprofilesを使う。
   */
  const validProfiles = useMemo(() => profiles.filter((profile) => profile.valid), [profiles]);

  /* ======================================== */
  /* Context Value */
  /* ======================================== */
  const value = useMemo<ProfileContextValue>(
    () => ({
      profiles,
      validProfiles,
      profileVariables,
      activeProfile,
      defaultProfile,
      loading,
      error,
      refresh: loadProfiles,
      createProfile,
      updateProfile,
      deleteProfile,
      setActiveProfile,
      setDefaultProfile,
    }),
    [
      profiles,
      validProfiles,
      profileVariables,
      activeProfile,
      defaultProfile,
      loading,
      error,
      loadProfiles,
      createProfile,
      updateProfile,
      deleteProfile,
      setActiveProfile,
      setDefaultProfile,
    ]
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

/* ======================================== */
/* Hook */
/* ======================================== */

/**
 * プロファイル状態を取得するフック
 *
 * @returns プロファイル状態とアクション
 * @throws Provider外で使用された場合にエラー
 */
export function useProfiles(): ProfileContextValue {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfiles must be used within ProfileProvider');
  }
  return context;
}
