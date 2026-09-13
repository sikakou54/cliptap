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
 * @see app/shortcut/edit.tsx - UIコンポーネント
 * @see app/shortcut/value-edit.tsx - 値編集モーダル
 * @see app/profile/select.tsx - プロファイル選択画面（定型文フォームと共有）
 * @see packages/shared/src/providers/ShortcutProvider.tsx - ショートカットCRUD操作（useShortcuts）
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  Logger,
  translateError,
  useCategories,
  useProfiles,
  useShortcuts,
  type Category,
  type ShortcutValueInput,
} from '@cliptap/shared';
import { showConfirm, showErrorAlert } from '@utils/alerts';
import { useTranslation } from '@cliptap/shared';

/* ======================================== */
/* 型定義 */
/* ======================================== */

/**
 * 編集中の値1件
 *
 * @remarks
 * 新規追加した値はまだDBのIDを持たないため、画面内での識別子として`key`を別に持つ。
 * 保存済みの値は`key`と`id`が同じ値になり、保存時に`id`があるものだけが既存行の更新になる。
 */
export interface ShortcutValueDraft {
  /** 画面内で値を一意に識別するキー */
  key: string;
  /** 保存済みの値のID（新規追加した値はundefined） */
  id?: string;
  /** 値名 */
  name: string;
  /** 保存する文字列。カスタム変数を参照していない値は、一覧にもこれをそのまま表示する */
  value: string;
  /** 参照するカスタム変数のID（参照していなければnull） */
  variableId: string | null;
}

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
  /** 編集中の値一覧（表示順） */
  values: ShortcutValueDraft[];
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
  handleAddValue: () => void;
  /** 値の編集画面を開く */
  handleEditValue: (draft: ShortcutValueDraft) => void;
  /** 確認のうえ値を一覧から取り除く */
  handleDeleteValue: (draft: ShortcutValueDraft) => void;
  /** ショートカットを保存する */
  handleSave: () => void;
}

/* ======================================== */
/* ヘルパー */
/* ======================================== */

/**
 * 新規追加した値の画面内キーを作る
 *
 * @param existing - 既に一覧にある値
 * @returns 既存のどのキーとも重ならないキー
 *
 * @remarks
 * 乱数や時刻を使わず、既存キーとの衝突だけを避ける連番にする。
 * 追加・削除を繰り返しても既存の行のキーは変わらないため、
 * 値編集モーダルから戻ったときに対象を取り違えない。
 */
function createDraftKey(existing: ShortcutValueDraft[]): string {
  const used = new Set(existing.map((draft) => draft.key));
  let index = existing.length;
  while (used.has(`draft-${index}`)) index += 1;
  return `draft-${index}`;
}

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

  const { t } = useTranslation();
  const router = useRouter();
  const { shortcuts, activeProfileId, createShortcut, updateShortcut } = useShortcuts();
  /* 既定のチェックは選択画面に出る有効なプロファイル（validProfiles）だけから選ぶ。
     選択済みの名前は無効なプロファイルへの保存済みの紐づけも含めて出すため、profilesから引く */
  const { profiles, validProfiles } = useProfiles();
  const { categories } = useCategories();

  /* ======================================== */
  /* 状態管理 */
  /* ======================================== */
  const [name, setName] = useState('');
  /* 空配列は全プロファイル向け（定型文のプロファイル選択と同じ） */
  const [profileIds, setProfileIds] = useState<string[]>([]);
  /* カテゴリは任意のため、未選択（未分類）をnullで表す */
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [values, setValues] = useState<ShortcutValueDraft[]>([]);
  const [saving, setSaving] = useState(false);

  /* ======================================== */
  /* 派生状態 */
  /* ======================================== */
  const isEdit = !!shortcutId;

  const editingShortcut = useMemo(
    () => shortcuts.find((shortcut) => shortcut.id === shortcutId),
    [shortcuts, shortcutId]
  );

  /**
   * 保存可能かどうか
   *
   * @remarks
   * 値が1件も無いショートカットは拡張キーボードから何も挿入できないため保存させない
   * （docs/機能仕様書.md §8.24）。値名の必須判定は値編集モーダル側で行うため、ここでは件数だけを見る。
   * 所属プロファイルは0件（全プロファイル向け）でも保存できるため、条件に含めない。
   */
  const canSave = useMemo(
    () => name.trim() !== '' && values.length > 0,
    [name, values]
  );

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
    setValues(
      editingShortcut.values.map((value) => ({
        key: value.id,
        id: value.id,
        name: value.name,
        value: value.storedValue,
        variableId: value.variableId,
      }))
    );
  }, [editingShortcut]);

  /* ======================================== */
  /* 画面フォーカス時の処理（コールバックデータ処理） */
  /* ======================================== */
  /* 値編集モーダル（shortcut/value-edit）からの戻り値をグローバル変数経由で受け取る。
     expo-router のモーダルは戻り値を返せないため、モーダル側が router.back() の直前に
     global.shortcutValueCallbackData へ書き込み、こちらはフォーカス復帰時に読み取って即座に破棄する。
     依存配列が空なのは setter のみを閉じ込めており再購読が不要なため。 */
  useFocusEffect(
    useCallback(() => {
      const callbackData = global.shortcutValueCallbackData;
      if (!callbackData) return;

      global.shortcutValueCallbackData = undefined;

      setValues((prev) => {
        const index = prev.findIndex((draft) => draft.key === callbackData.key);

        /* 既存の値の編集: 同じ位置で内容だけ差し替える（並び順を変えない） */
        if (index >= 0) {
          const next = [...prev];
          next[index] = {
            ...next[index],
            name: callbackData.name,
            value: callbackData.value,
            variableId: callbackData.variableId,
          };
          return next;
        }

        /* 新規追加: 末尾へ足す */
        return [
          ...prev,
          {
            key: createDraftKey(prev),
            name: callbackData.name,
            value: callbackData.value,
            variableId: callbackData.variableId,
          },
        ];
      });
    }, [])
  );

  /* ======================================== */
  /* イベントハンドラ */
  /* ======================================== */

  /**
   * 値の追加画面を開く
   *
   * @remarks
   * keyを空文字で渡すことで、モーダル側の戻り値を「新規追加」として扱わせる。
   */
  const handleAddValue = useCallback(() => {
    router.push({
      pathname: '/shortcut/value-edit',
      params: {
        valueKey: '',
        valueName: '',
        value: '',
        variableId: '',
        /* カスタム変数選択でプロファイル別の値を確認するとき、ここで選んでいるプロファイルに絞るため */
        profileIds: profileIds.join(','),
      },
    });
  }, [router, profileIds]);

  /**
   * 値の編集画面を開く
   */
  const handleEditValue = useCallback(
    (draft: ShortcutValueDraft) => {
      router.push({
        pathname: '/shortcut/value-edit',
        params: {
          valueKey: draft.key,
          /* カスタム変数選択のプロファイル切替を、ここで選んでいるプロファイルに絞るため */
          profileIds: profileIds.join(','),
          valueName: draft.name,
          value: draft.value,
          variableId: draft.variableId ?? '',
        },
      });
    },
    [router, profileIds]
  );

  /**
   * 値を一覧から取り除く
   *
   * @remarks
   * 取り除くのは画面上の下書きだけで、DBへは保存時にまとめて反映する。
   * 最後の1件も取り除ける。その状態では canSave が false になり保存できない（§8.24）。
   */
  const handleDeleteValue = useCallback(
    (draft: ShortcutValueDraft) => {
      showConfirm(
        t('shortcut.delete_value_confirm', { name: draft.name }),
        () => {
          setValues((prev) => prev.filter((entry) => entry.key !== draft.key));
        },
        undefined,
        'danger'
      );
    },
    [t]
  );

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

    setSaving(true);
    try {
      /* 新規追加の値はidを持たないため、そのままMapperの差し替え判定に渡せる */
      const inputs: ShortcutValueInput[] = values.map((draft) => ({
        id: draft.id,
        name: draft.name,
        value: draft.value,
        variableId: draft.variableId,
      }));

      /* profileIdsは常に明示して渡す。更新で省略すると紐づけを変えない扱いになり、
         選択画面で変えた所属が保存されない */
      if (isEdit && editingShortcut) {
        updateShortcut({
          id: editingShortcut.id,
          profileIds,
          categoryId,
          name,
          values: inputs,
        });
      } else {
        createShortcut({ profileIds, categoryId, name, values: inputs });
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
    values,
    isEdit,
    editingShortcut,
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
    values,
    saving,
    isEdit,
    canSave,
    handleProfilePress,
    handleCategoryPress,
    handleAddValue,
    handleEditValue,
    handleDeleteValue,
    handleSave,
  };
}
