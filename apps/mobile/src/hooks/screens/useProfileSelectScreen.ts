/**
 * プロファイル選択画面のビジネスロジックフック
 *
 * 定型文・ショートカットを表示するプロファイル（環境）を複数選択する画面の状態管理とロジックを提供。
 * 定型文フォームとショートカット編集の両方から開き、どちらも0件を全プロファイル向けとして扱う。
 * 対象による違いは説明文だけで、それは画面側（profile/select.tsx）が出し分けるため、ここは対象を知らない。
 * UIコンポーネント（profile/select.tsx）から完全に分離されたビジネスロジック層。
 *
 * 主な責務:
 * - 選択中プロファイルIDの状態管理
 * - プロファイルのトグル選択処理
 * - 「全ての環境」選択処理
 * - 保存処理（コールバック経由）
 *
 * @see app/profile/select.tsx - UIコンポーネント
 * @see src/hooks/screens/useSnippetFormScreen.ts - 呼び出し元（定型文フォーム）
 * @see src/hooks/screens/useShortcutEditScreen.ts - 呼び出し元（ショートカット編集）
 * @see packages/shared/src/providers/ProfileProvider.tsx - プロファイルCRUD操作（useProfiles）
 */

import { useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useProfiles } from '@cliptap/shared';
import { Profile } from '@cliptap/shared';

/**
 * useProfileSelectScreenの引数の型
 */
interface UseProfileSelectScreenParams {
  /** 現在選択中のプロファイルID配列 */
  selectedIds: string[];
}

/**
 * useProfileSelectScreenの戻り値の型
 */
export interface UseProfileSelectScreenReturn {
  /* 状態 */
  tempSelectedIds: string[];
  profiles: Profile[];

  /* ハンドラ */
  toggleProfile: (profileId: string) => void;
  handleSelectAll: () => void;
  handleSave: () => void;
}

/**
 * プロファイル選択画面のビジネスロジックフック
 *
 * @param params - 画面パラメータ
 * @returns 画面に必要な全ての状態とハンドラ
 */
export function useProfileSelectScreen(params: UseProfileSelectScreenParams): UseProfileSelectScreenReturn {
  const { selectedIds } = params;

  const router = useRouter();
  /* 選択肢は有効なプロファイルだけとする。無効なプロファイルへの既存の関連は保持する */
  const { validProfiles: profiles } = useProfiles();

  /* ======================================== */
  /* 状態管理 */
  /* ======================================== */
  const [tempSelectedIds, setTempSelectedIds] = useState<string[]>(selectedIds);

  /* ======================================== */
  /* イベントハンドラ */
  /* ======================================== */

  /**
   * プロファイルのトグル選択
   */
  const toggleProfile = useCallback((profileId: string) => {
    setTempSelectedIds((prev) => {
      if (prev.includes(profileId)) {
        return prev.filter((id) => id !== profileId);
      } else {
        return [...prev, profileId];
      }
    });
  }, []);

  /**
   * 「全ての環境」を選択（空配列=全プロファイル対象）
   */
  const handleSelectAll = useCallback(() => {
    setTempSelectedIds([]);
  }, []);

  /**
   * 保存処理
   * グローバルコールバック経由で選択結果を親画面に返す
   */
  const handleSave = useCallback(() => {
    if (global.profileSelectCallback) {
      global.profileSelectCallback(tempSelectedIds);
      global.profileSelectCallback = undefined;
    }
    router.back();
  }, [tempSelectedIds, router]);

  /* ======================================== */
  /* 戻り値 */
  /* ======================================== */
  return {
    /* 状態 */
    tempSelectedIds,
    profiles,

    /* ハンドラ */
    toggleProfile,
    handleSelectAll,
    handleSave,
  };
}
