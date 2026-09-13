/**
 * 検索画面のショートカット検索のビジネスロジックフック
 *
 * 検索画面で表示対象をショートカットにしているときの、一覧の取得・絞り込みと管理操作を提供。
 *
 * 主な責務:
 * - 有効な各プロファイルから見えるショートカットの取得
 * - 検索語での絞り込みと、プロファイルごとの一致件数の算出
 * - 検索結果の値のコピー・編集・削除
 *
 * 【プロファイルごとに読み込む理由】
 * 検索は定型文と同じくプロファイルを跨ぎ、画面内で選んだプロファイルの分を表示する（§8.7）。
 * カスタム変数を参照している値はプロファイルごとに解決結果が変わり、検索語に一致するかどうかも変わる。
 * そのため全件を1つの一覧にまとめず、プロファイルごとに解決済みの一覧を持つ。
 * Providerはアクティブなプロファイルの分しか持たないため、この画面で読み込む。
 *
 * 【フォーカス時に読み直す理由】
 * 検索結果から編集画面へ進んで保存すると、この画面の一覧は古くなる。
 * Providerの一覧の変化をきっかけにすると、コピーで使用回数を進めるたびに全プロファイルを読み直してしまうため、
 * 画面へ戻ったときに読み直す（useHomeScreen と同じ形）。
 *
 * 【使用回数を手元で進めない理由】
 * 検索結果は使用回数で並べず、表示もしない。加算はProviderのコピー経路が行う。
 *
 * @see src/hooks/screens/useSearchScreen.ts - 検索語とプロファイル選択の正本
 * @see packages/shared/src/shortcuts/search.ts - 検索語の突き合わせの規則
 */

import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  searchShortcuts,
  useProfiles,
  useShortcuts,
  useTranslation,
  Logger,
  ShortcutService,
  type Profile,
  type Shortcut,
  type ShortcutValue,
} from '@cliptap/shared';
import { showConfirm, showErrorAlert } from '@utils/alerts';

/**
 * useSearchShortcutsの引数の型
 */
interface UseSearchShortcutsParams {
  /** ショートカットを検索中か（falseの間はDBを読まない） */
  enabled: boolean;
  /** 絞り込みに使う検索語（デバウンス済み） */
  query: string;
  /** 表示するプロファイルのID（画面内の一時選択。未確定ならnull） */
  selectedProfileId: string | null;
}

/**
 * useSearchShortcutsの戻り値の型
 */
export interface UseSearchShortcutsReturn {
  /* データ */
  /** 選択中のプロファイルで検索語に一致したショートカット（表示順） */
  displayShortcuts: Shortcut[];

  /* 派生関数 */
  /** 指定したプロファイルで検索語に一致したショートカットの件数を返す */
  getProfileShortcutCount: (profileId: string) => number;

  /* ハンドラ */
  /** 一覧を読み直す */
  handleRefreshShortcuts: () => void;
  /** 値をクリップボードへコピーする */
  handleCopyShortcutValue: (value: ShortcutValue) => Promise<void>;
  /** 編集画面を開く */
  handleEditShortcut: (shortcut: Shortcut) => void;
  /** 確認のうえ削除する */
  handleDeleteShortcut: (shortcut: Shortcut) => void;
}

/**
 * 有効な各プロファイルから見えるショートカットを読み込む
 *
 * @param profiles - 読み込む対象のプロファイル
 * @returns プロファイルIDごとのショートカット一覧（値はそのプロファイルで解決済み）
 *
 * @remarks
 * 読み込みに失敗しても検索画面は開いたままにしたいため、例外は記録して空の一覧を返す。
 */
function loadShortcutsByProfile(profiles: readonly Profile[]): Map<string, Shortcut[]> {
  const shortcutsByProfile = new Map<string, Shortcut[]>();
  try {
    for (const profile of profiles) {
      shortcutsByProfile.set(profile.id, ShortcutService.getByProfileId(profile.id));
    }
  } catch (error) {
    Logger.error('[SearchShortcuts] Failed to load shortcuts:', error);
    return new Map();
  }
  return shortcutsByProfile;
}

/**
 * 検索画面のショートカット検索のビジネスロジックフック
 *
 * @param params - 検索対象かどうか、検索語、選択中のプロファイル
 * @returns 画面に必要な状態とハンドラ
 */
export function useSearchShortcuts(params: UseSearchShortcutsParams): UseSearchShortcutsReturn {
  const { enabled, query, selectedProfileId } = params;

  const { t } = useTranslation();
  const router = useRouter();
  const { validProfiles } = useProfiles();
  const { deleteShortcut, copyShortcutValue } = useShortcuts();

  /* ======================================== */
  /* データ取得 */
  /* ======================================== */

  /* 開いた直後から一覧を出すため、初期値もその場で読む。フォーカス時の読み直しだけに任せると、
     初回の描画で一度だけ空状態が描かれる */
  const [shortcutsByProfile, setShortcutsByProfile] = useState<Map<string, Shortcut[]>>(() =>
    enabled ? loadShortcutsByProfile(validProfiles) : new Map()
  );

  /**
   * 一覧を読み直す
   *
   * 有効なプロファイルが変わると関数が作り直されるため、フォーカス中でも読み直しが走る。
   */
  const reloadShortcuts = useCallback(() => {
    if (!enabled) return;
    setShortcutsByProfile(loadShortcutsByProfile(validProfiles));
  }, [enabled, validProfiles]);

  /* 画面へ戻ったとき（編集画面を閉じたとき）に読み直す */
  useFocusEffect(reloadShortcuts);

  /* ======================================== */
  /* 派生状態 */
  /* ======================================== */

  /* キー入力のたびにDBを読まないよう、読み込み済みの一覧をメモリ上で絞り込む */
  const matchedByProfile = useMemo(() => {
    const matched = new Map<string, Shortcut[]>();
    for (const [profileId, shortcuts] of shortcutsByProfile) {
      matched.set(profileId, searchShortcuts(shortcuts, query));
    }
    return matched;
  }, [shortcutsByProfile, query]);

  /* 選択中のプロファイルに一致が無くても、別のプロファイルへは切り替えない（定型文と同じ。§8.7） */
  const displayShortcuts = useMemo(
    () => (selectedProfileId ? matchedByProfile.get(selectedProfileId) ?? [] : []),
    [matchedByProfile, selectedProfileId]
  );

  const getProfileShortcutCount = useCallback(
    (profileId: string): number => matchedByProfile.get(profileId)?.length ?? 0,
    [matchedByProfile]
  );

  /* ======================================== */
  /* イベントハンドラ */
  /* ======================================== */

  /**
   * ショートカット値をクリップボードへコピーする
   *
   * ホームの一覧と同じ経路を使う（値だけをコピーし、値名は含めない）。
   * 表示中の値は選択中のプロファイルで解決済みのため、そのまま渡せば同じ値がコピーされる。
   */
  const handleCopyShortcutValue = useCallback(
    async (value: ShortcutValue) => {
      try {
        await copyShortcutValue(value);
      } catch (error) {
        Logger.error('[SearchShortcuts] Failed to copy the shortcut value:', error);
        showErrorAlert(t('error.generic'));
        /* 行側でコピー完了表示を出さないよう再スローする */
        throw error;
      }
    },
    [copyShortcutValue, t]
  );

  /**
   * ショートカット編集画面へ遷移
   *
   * ホームの一覧と同じく、編集アイコンから編集へ進む。
   */
  const handleEditShortcut = useCallback(
    (shortcut: Shortcut) => {
      router.push({
        pathname: '/shortcut/edit',
        params: { id: shortcut.id },
      });
    },
    [router]
  );

  /**
   * ショートカット削除
   *
   * 値もまとめて削除されるため、ホームの一覧と同じく確認を挟む。
   * Providerが読み直すのはアクティブなプロファイルの分だけなので、この画面の一覧も読み直す。
   */
  const handleDeleteShortcut = useCallback(
    (shortcut: Shortcut) => {
      showConfirm(
        t('shortcut.delete_confirm', { name: shortcut.name }),
        () => {
          try {
            deleteShortcut(shortcut.id);
            reloadShortcuts();
          } catch (error) {
            Logger.error('[SearchShortcuts] Failed to delete shortcut:', error);
          }
        },
        undefined,
        'danger'
      );
    },
    [deleteShortcut, reloadShortcuts, t]
  );

  return {
    displayShortcuts,
    getProfileShortcutCount,
    handleRefreshShortcuts: reloadShortcuts,
    handleCopyShortcutValue,
    handleEditShortcut,
    handleDeleteShortcut,
  };
}
