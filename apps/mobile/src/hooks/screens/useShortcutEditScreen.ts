/**
 * ショートカット作成・編集画面のビジネスロジックフック
 *
 * ショートカットの新規作成・編集の状態管理とロジックを提供。
 * UIコンポーネント（shortcut/edit.tsx）から完全に分離されたビジネスロジック層。
 *
 * 主な責務:
 * - ショートカット名・所属プロファイル（0件以上。0件は全プロファイル向け）・カテゴリ・値一覧の下書き状態の管理
 * - プロファイル選択画面・値編集モーダルとの往復（値は追加・更新・削除）
 * - 保存可否の判定と保存処理（新規作成/更新）
 *
 * 値は変数トークンを展開していない保存文字列のまま扱う。展開結果は画面下部のプレビュー
 * （ShortcutValuePreview）がプロファイルを切り替えて表示するため、このフックでは展開しない。
 *
 * @see app/shortcut/edit.tsx - UIコンポーネント
 * @see src/components/shortcut/ShortcutPreview.tsx - 値のプレビュー
 * @see app/shortcut/value-edit.tsx - 値編集モーダル
 * @see app/profile/select.tsx - プロファイル選択画面（定型文フォームと共有）
 * @see packages/shared/src/providers/ShortcutProvider.tsx - ショートカットCRUD操作（useShortcuts）
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'expo-router';
import {
  Logger,
  translateError,
  useCategories,
  useProfiles,
  useShortcuts,
  type Category,
} from '@cliptap/shared';
import { showErrorAlert } from '@utils/alerts';
import { useItemLimitGuard } from '@hooks/useItemLimitGuard';

/* ======================================== */
/* 型定義 */
/* ======================================== */

/**
 * useShortcutEditScreenの引数の型
 */
interface UseShortcutEditScreenParams {
  /** 編集対象のショートカットID（新規作成時はundefined） */
  shortcutId?: string;
}

/**
 * useShortcutEditScreenの戻り値の型
 */
export interface UseShortcutEditScreenReturn {
  /* 状態 */
  /** ショートカット名 */
  name: string;
  /** ショートカット名を更新する */
  setName: (name: string) => void;
  /** 選択中の所属プロファイルID（空配列は全プロファイル向け） */
  profileIds: string[];
  /** 選択中の所属プロファイル名（プロファイル一覧の並び順） */
  selectedProfileNames: string[];
  /** 選択中のカテゴリ（未分類ならnull） */
  selectedCategory: Category | null;
  /** 編集中の値一覧（表示順。変数トークンを展開していない保存文字列のまま） */
  value: string;
  /** 保存処理中フラグ */
  saving: boolean;

  /* 派生状態 */
  /** 編集モードかどうか */
  isEdit: boolean;
  /** 保存できるかどうか */
  canSave: boolean;

  /* ハンドラ */
  /** プロファイル選択画面を開く */
  handleProfilePress: () => void;
  /** カテゴリ選択画面を開く */
  handleCategoryPress: () => void;
  /** 値の追加画面を開く */
  handleValuePress: () => void;
  /** 値の編集画面を開く */
  /** ショートカットを保存する */
  handleSave: () => void;
}

/* ======================================== */
/* ヘルパー */
/* ======================================== */

/* ======================================== */
/* フック実装 */
/* ======================================== */

/**
 * ショートカット作成・編集画面のビジネスロジックフック
 *
 * @param params - 画面パラメータ
 * @returns 画面に必要な全ての状態とハンドラ
 */
export function useShortcutEditScreen(
  params: UseShortcutEditScreenParams
): UseShortcutEditScreenReturn {
  const { shortcutId } = params;

  const router = useRouter();
  const { activeProfileId, createShortcut, updateShortcut, getById } = useShortcuts();
  /* 既定のチェックは選択画面に出る有効なプロファイル（validProfiles）だけから選ぶ。
     選択済みの名前は無効なプロファイルへの保存済みの紐づけも含めて出すため、profilesから引く */
  const { profiles, validProfiles } = useProfiles();
  const { categories } = useCategories();
  const { ensureCanAddShortcut } = useItemLimitGuard();

  /* ======================================== */
  /* 状態管理 */
  /* ======================================== */
  const [name, setName] = useState('');
  /* 空配列は全プロファイル向け（定型文のプロファイル選択と同じ） */
  const [profileIds, setProfileIds] = useState<string[]>([]);
  /* カテゴリは任意のため、未選択（未分類）をnullで表す */
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  /* ======================================== */
  /* 派生状態 */
  /* ======================================== */
  const isEdit = !!shortcutId;

  /* 編集対象はIDで引く。Providerの一覧はアクティブなプロファイルから見える分しか持たないが、
     検索画面はプロファイルを跨いで検索し、他のプロファイルのショートカットからも編集へ進む。
     一覧から探すと見つからずフォームが空で開き、保存すると作成の分岐へ流れて重複して登録される。
     値は変数トークンを展開していない保存文字列のまま取得するため、そのままフォームへ入れられる */
  const editingShortcut = useMemo(
    () => (shortcutId ? getById(shortcutId) : null),
    [getById, shortcutId]
  );

  /**
   * 保存可能かどうか
   *
   * @remarks
   * 値が1件も無いショートカットは拡張キーボードから何も挿入できないため保存させない
   * （docs/機能仕様書.md §8.24）。値名の必須判定は値編集モーダル側で行うため、ここでは件数だけを見る。
   * 所属プロファイルは0件（全プロファイル向け）でも保存できるため、条件に含めない。
   */
  const canSave = useMemo(() => name.trim() !== '', [name]);

  /**
   * 選択中の所属プロファイル名
   *
   * @remarks
   * 選んだ順ではなくプロファイル一覧の並び順で出す。定型文フォームと同じ見え方にするため。
   */
  const selectedProfileNames = useMemo(
    () =>
      profiles
        .filter((profile) => profileIds.includes(profile.id))
        .map((profile) => profile.name),
    [profiles, profileIds]
  );

  /* ======================================== */
  /* 新規作成時の初期選択（アクティブなプロファイル） */
  /* ======================================== */

  /**
   * 初期選択を一度だけ適用したか
   *
   * @remarks
   * アクティブなプロファイルは初回レンダリングでは未確定になりうるため、確定してから入れる。
   * 判定を入れないと、利用者が選択を全部外して0件（＝全プロファイル向け）にした直後に
   * 再レンダリングで選択が戻ってしまう（定型文フォーム useSnippetFormScreen と同じ形）。
   */
  const didApplyInitialProfiles = useRef(false);

  useEffect(() => {
    /* 編集モードは保存済みの紐づけをそのまま使うため、初期選択を被せない */
    if (isEdit) {
      didApplyInitialProfiles.current = true;
      return;
    }
    if (didApplyInitialProfiles.current) return;

    /* 無効なプロファイル（Free上限超過分）は選択画面に出ないため、既定にも入れない。
       出ない項目を選択済みにすると、画面上は0件に見えるのに保存すると1件入る食い違いになる */
    const initialProfile = validProfiles.find((profile) => profile.id === activeProfileId);
    if (!initialProfile) return;

    setProfileIds([initialProfile.id]);
    didApplyInitialProfiles.current = true;
  }, [isEdit, activeProfileId, validProfiles]);

  /* ======================================== */
  /* 編集モード時のデータ反映 */
  /* ======================================== */

  /* 既存ショートカットのデータをフォームに反映する。
     新規作成モードではフォームの初期値（空・未分類）のまま何もしない。ここで空へ戻したり
     アクティブなプロファイルを入れ直したりすると、利用者が全部外した0件の選択が戻ってしまう */
  useEffect(() => {
    if (!editingShortcut) return;

    setName(editingShortcut.name);
    setProfileIds(editingShortcut.profileIds);
    setCategoryId(editingShortcut.categoryId);
    setValue(editingShortcut.value);
  }, [editingShortcut]);

  /* ======================================== */
  /* イベントハンドラ */
  /* ======================================== */

  /**
   * 値の入力画面を開く
   *
   * @remarks
   * 戻り値はグローバルのコールバックで受け取る。expo-router のモーダルは戻り値を返せないため、
   * プロファイル選択・カテゴリ選択と同じ形に揃えている。
   */
  const handleValuePress = useCallback(() => {
    global.shortcutValueCallback = (next: string) => setValue(next);
    router.push({
      pathname: '/shortcut/value-edit',
      params: { value },
    });
  }, [router, value]);

  /**
   * 選択中のカテゴリ
   *
   * @remarks
   * カテゴリが削除された直後は、保持しているIDに一致するカテゴリが無くなる。
   * その場合は未分類として扱い、存在しないカテゴリを表示しない。
   */
  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === categoryId) ?? null,
    [categories, categoryId]
  );

  /**
   * プロファイル選択画面へ遷移
   *
   * @remarks
   * 定型文フォーム（useSnippetFormScreen.handleProfilePress）と同じ画面を使い、
   * target で説明文をショートカット向けに切り替える。
   * expo-routerのモーダルは戻り値を返せないため、グローバルコールバックで受け取る。
   */
  const handleProfilePress = useCallback(() => {
    global.profileSelectCallback = (selectedIds: string[]) => {
      setProfileIds(selectedIds);
    };
    router.push({
      pathname: '/profile/select',
      params: { selectedIds: profileIds.join(','), target: 'shortcut' },
    });
  }, [profileIds, router]);

  /**
   * カテゴリ選択画面へ遷移
   *
   * @remarks
   * 定型文フォーム（useSnippetFormScreen.handleCategoryPress）と同じ経路を使う。
   * expo-routerのモーダルは戻り値を返せないため、グローバルコールバックで受け取る。
   */
  const handleCategoryPress = useCallback(() => {
    global.categorySelectCallback = (selectedId: string | null) => {
      setCategoryId(selectedId);
    };
    router.push({
      pathname: '/category/select',
      params: { selectedId: categoryId ?? 'null' },
    });
  }, [categoryId, router]);

  /**
   * ショートカットを保存する
   */
  const handleSave = useCallback(() => {
    if (!canSave || saving) return;

    /* 新規作成だけ登録上限を判定する（保存時は保留しない理由は useSnippetFormScreen と同じ）。
       editingShortcutが見つからない場合は作成へ進むため、条件は下の作成・更新の分岐と揃える */
    if (!(isEdit && editingShortcut) && !ensureCanAddShortcut()) return;

    setSaving(true);
    try {
      /* profileIdsは常に明示して渡す。更新で省略すると紐づけを変えない扱いになり、
         選択画面で変えた所属が保存されない */
      if (isEdit && editingShortcut) {
        updateShortcut({
          id: editingShortcut.id,
          profileIds,
          categoryId,
          name,
          value,
        });
      } else {
        createShortcut({ profileIds, categoryId, name, value });
      }

      router.back();
    } catch (error) {
      Logger.error('[ShortcutEditScreen] Failed to save shortcut:', error);
      showErrorAlert(translateError(error));
    } finally {
      setSaving(false);
    }
  }, [
    canSave,
    saving,
    value,
    isEdit,
    editingShortcut,
    ensureCanAddShortcut,
    updateShortcut,
    createShortcut,
    name,
    profileIds,
    categoryId,
    router,
  ]);

  /* ======================================== */
  /* 戻り値 */
  /* ======================================== */

  return {
    name,
    setName,
    profileIds,
    selectedProfileNames,
    selectedCategory,
    value,
    saving,
    isEdit,
    canSave,
    handleProfilePress,
    handleCategoryPress,
    handleValuePress,
    handleSave,
  };
}
