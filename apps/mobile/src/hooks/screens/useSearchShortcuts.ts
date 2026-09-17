/**
 * 検索画面のショートカット検索のビジネスロジックフック
 *
 * 検索画面で表示対象をショートカットにしているときの、一覧の取得・絞り込みと管理操作を提供。
 *
 * 主な責務:
 * - 有効な各プロファイルから見えるショートカットの取得
 * - 各プロファイルでの値の変数展開と、プロファイル横断での絞り込み
 * - 検索結果の値のコピー・編集・削除
 *
 * 【プロファイルごとに読み込む理由】
 * 検索は定型文と同じく有効な全プロファイルを横断する（§8.7）。
 * どのショートカットが見えるかと、値の変数トークンがどう展開されるかはプロファイルごとに変わり、
 * 検索語に一致するかどうかも変わる。そのため全件を1つの一覧にまとめず、
 * プロファイルごとに一覧を持ち、展開結果ごとに行を作る。
 * Providerはアクティブなプロファイルの分しか持たないため、この画面で読み込む。
 *
 * 【展開後の値で照合する理由】
 * 一覧に見えている文字列で探せるようにするため（shortcuts/search.ts）。
 * 展開は定型文の一覧と同じ useVariableExpansion を使い、定型文と同じ結果にする。
 *
 * 【フォーカス時に読み直す理由】
 * 画面を開いた時点ではProviderがまだプロファイルを読み終えていないことがあり、
 * 初期読み込みが空の一覧のままになる。有効なプロファイルが変わると読み直しの関数が作り直され、
 * フォーカス中でも読み直しが走るようにしてある。
 * Providerの一覧の変化をきっかけにすると、コピーで使用回数を進めるたびに全プロファイルを
 * 読み直してしまうため、この形にしている（useHomeScreen と同じ）。
 *
 * 【使用回数を手元で進めない理由】
 * 検索結果は使用回数で並べず、表示もしない。加算はProviderのコピー経路が行う。
 *
 * @see src/hooks/screens/useSearchScreen.ts - 検索語とプロファイル絞り込みの正本
 * @see packages/shared/src/shortcuts/crossProfileSearch.ts - 横断検索と行のまとめ方
 * @see packages/shared/src/shortcuts/search.ts - 検索語の突き合わせの規則
 * @see packages/shared/src/shortcuts/display.ts - 表示用の値の展開
 */

import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  searchShortcutsAcrossProfiles,
  sortShortcuts,
  useProfiles,
  useShortcuts,
  useTranslation,
  useVariableExpansion,
  useVariables,
  Logger,
  ShortcutService,
  type CrossProfileShortcut,
  type Profile,
  type Shortcut,
  type ShortcutValue,
} from '@cliptap/shared';
import { showConfirm, showErrorAlert } from '@utils/alerts';
import { useShortcutSortPreference } from '@hooks/useShortcutSortPreference';

/**
 * useSearchShortcutsの引数の型
 */
interface UseSearchShortcutsParams {
  /** ショートカットを検索中か（falseの間はDBを読まない） */
  enabled: boolean;
  /** 絞り込みに使う検索語（デバウンス済み） */
  query: string;
}

/**
 * useSearchShortcutsの戻り値の型
 */
export interface UseSearchShortcutsReturn {
  /* データ */
  /** 有効な全プロファイルを横断して検索語に一致したショートカット（展開結果ごとの行） */
  allShortcutRows: CrossProfileShortcut[];

  /* ハンドラ */
  /** 一覧を読み直す */
  handleRefreshShortcuts: () => void;
  /** 値をクリップボードへコピーする（展開の基準にするプロファイルを添える） */
  handleCopyShortcutValue: (value: ShortcutValue, profileId: string | null) => Promise<void>;
  /** 編集画面を開く */
  handleEditShortcut: (shortcut: Shortcut) => void;
  /** 確認のうえ削除する */
  handleDeleteShortcut: (shortcut: Shortcut) => void;
}

/**
 * 有効な各プロファイルから見えるショートカットを読み込む
 *
 * @param profiles - 読み込む対象のプロファイル
 * @returns プロファイルIDごとのショートカット一覧（値は保存されている文字列のまま）
 *
 * @remarks
 * 読み込みに失敗しても検索画面は開いたままにしたいため、例外は記録して空の一覧を返す。
 * 検索画面のチップで対象を切り替えるため、選択中のプロファイルだけでなく全件を読む。
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
  const { enabled, query } = params;

  const { t, language } = useTranslation();
  const router = useRouter();
  const { validProfiles, profileVariables, defaultProfile } = useProfiles();
  const { variables } = useVariables();
  const { deleteShortcut, copyShortcutValue } = useShortcuts();
  /* 検索結果もホームと同じ並べ替えに従う（§8.7） */
  const { currentSort } = useShortcutSortPreference();
  const { expandVariables } = useVariableExpansion({
    variables,
    profileVariables,
    locale: language,
  });

  const defaultProfileId = defaultProfile?.id ?? null;

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

  /* 有効な全プロファイルを横断して絞り込む。キー入力のたびにDBを読まないよう、
     読み込み済みの一覧をメモリ上で評価する。
     プロファイルごとの絞り込みと件数は、この結果から画面側で求める（useSearchScreen）。
     並べ替えはホームの一覧と同じ設定を使う。画面によって並び順が変わると、
     ホームで見えていた順を手掛かりに探せなくなるためである（§8.7） */
  const allShortcutRows = useMemo(
    () =>
      sortShortcuts(
        searchShortcutsAcrossProfiles({
          shortcutsByProfile,
          profiles: validProfiles,
          query,
          expand: (text, id) => expandVariables(text, id, defaultProfileId),
        }),
        currentSort
      ),
    [shortcutsByProfile, validProfiles, query, expandVariables, defaultProfileId, currentSort]
  );

  /* ======================================== */
  /* イベントハンドラ */
  /* ======================================== */

  /**
   * ショートカット値をクリップボードへコピーする
   *
   * ホームの一覧と同じ経路を使う（値だけをコピーし、値名は含めない）。
   * 横断検索では行ごとに展開の基準プロファイルが違うため、行が持つプロファイルを受け取って展開する。
   * これで画面に出ている文字列とコピーされる文字列が食い違わない。
   */
  const handleCopyShortcutValue = useCallback(
    async (value: ShortcutValue, profileId: string | null) => {
      try {
        await copyShortcutValue(value, profileId ?? undefined);
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
   * ホームの一覧と同じく、カード右上の「・・・」メニューから編集へ進む。
   * 定型文と同じく検索画面を編集画面で置き換え、検索へは戻さない（Webと同じ・§8.7）。
   */
  const handleEditShortcut = useCallback(
    (shortcut: Shortcut) => {
      router.replace({
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
    allShortcutRows,
    handleRefreshShortcuts: reloadShortcuts,
    handleCopyShortcutValue,
    handleEditShortcut,
    handleDeleteShortcut,
  };
}
