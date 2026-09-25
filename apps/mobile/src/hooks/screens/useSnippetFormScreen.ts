/**
 * スニペット作成・編集画面のビジネスロジックフック
 *
 * スニペットの新規作成・編集の全ての状態管理とロジックを提供。
 * UIコンポーネント（SnippetFormScreen.tsx）から完全に分離されたビジネスロジック層。
 *
 * 主な責務:
 * - タイトル・コンテンツ・カテゴリ・プロファイルの状態管理
 * - 保存処理（新規作成/更新）
 * - 各入力画面への遷移とコールバック処理
 * - バリデーション
 *
 * @see components/snippet/SnippetFormScreen.tsx - UIコンポーネント
 * @see packages/shared/src/providers/SnippetProvider.tsx - 定型文CRUD操作（useSnippets）
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from '@cliptap/shared';
import { useSnippets, useCategories, useProfiles, type Category } from '@cliptap/shared';
import { showInfo, showErrorAlert } from '@utils/alerts';
import { Profile } from '@cliptap/shared';
import { Logger } from '@cliptap/shared';
import { useItemLimitGuard } from '@hooks/useItemLimitGuard';

/**
 * useSnippetFormScreenの引数
 */
interface UseSnippetFormScreenParams {
  mode: 'create' | 'edit';
  snippetId?: string;
}

/**
 * useSnippetFormScreenの戻り値の型
 */
export interface UseSnippetFormScreenReturn {
  /* 状態 */
  title: string;
  content: string;
  selectedCategoryId: string | null;
  selectedProfileIds: string[];
  copyWithTitle: boolean;
  saving: boolean;
  loading: boolean;

  /* 派生状態 */
  isEditMode: boolean;
  canSave: boolean;
  selectedCategory: Category | undefined;
  categories: Category[];
  profiles: Profile[];

  /* ハンドラ */
  handleTitlePress: () => void;
  handleContentPress: () => void;
  handleCategoryPress: () => void;
  handleProfilePress: () => void;
  handleCopyWithTitleChange: (value: boolean) => void;
  handleSave: () => Promise<void>;
}

/**
 * スニペット作成・編集画面のビジネスロジックフック
 *
 * @param params - モードとスニペットID
 * @returns 画面に必要な全ての状態とハンドラ
 */
export function useSnippetFormScreen({
  mode,
  snippetId,
}: UseSnippetFormScreenParams): UseSnippetFormScreenReturn {
  const router = useRouter();
  const { t } = useTranslation();

  /* ======================================== */
  /* データ取得（カスタムHooks） */
  /* ======================================== */
  const { createSnippet, updateSnippet, getById } = useSnippets();
  const { categories, refresh: refreshCategories } = useCategories();
  /* 選択済みプロファイル名の表示は、選択肢と同じく有効なプロファイルだけを対象にする */
  const { validProfiles: profiles, activeProfile } = useProfiles();
  const { ensureCanAddSnippet } = useItemLimitGuard();

  /* ======================================== */
  /* 状態管理 */
  /* ======================================== */
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);
  const [copyWithTitle, setCopyWithTitle] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(mode === 'edit');

  /* ======================================== */
  /* 派生状態 */
  /* ======================================== */
  const isEditMode = mode === 'edit';
  const canSave = title.trim() !== '' && content.trim() !== '';
  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === selectedCategoryId),
    [categories, selectedCategoryId]
  );

  /* ======================================== */
  /* カテゴリ一覧の再読み込み（画面フォーカス時） */
  /* ======================================== */
  useFocusEffect(
    useCallback(() => {
      void refreshCategories();
    }, [refreshCategories])
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
   * 再レンダリングで選択が戻ってしまう。
   */
  const didApplyInitialProfiles = useRef(false);

  useEffect(() => {
    /* 編集モードは保存済みの選択をそのまま使うため、初期選択を被せない */
    if (isEditMode) {
      didApplyInitialProfiles.current = true;
      return;
    }
    if (didApplyInitialProfiles.current) return;

    /* 無効なプロファイル（Free上限超過分）は選択画面に出ないため、既定にも入れない。
       出ない項目を選択済みにすると、画面上は0件に見えるのに保存すると1件入る食い違いになる */
    const initialProfile = profiles.find((profile) => profile.id === activeProfile?.id);
    if (!initialProfile) return;

    setSelectedProfileIds([initialProfile.id]);
    didApplyInitialProfiles.current = true;
  }, [isEditMode, activeProfile, profiles]);

  /* ======================================== */
  /* 編集モード時のスニペットデータ読み込み */
  /* ======================================== */
  useEffect(() => {
    const loadSnippet = async () => {
      if (!isEditMode || !snippetId) {
        setLoading(false);
        return;
      }

      try {
        const snippet = getById(snippetId);
        if (snippet) {
          setTitle(snippet.title || '');
          setContent(snippet.content);
          setSelectedCategoryId(snippet.categoryId);
          setSelectedProfileIds(snippet.profileIds ?? []);
          setCopyWithTitle(snippet.copyWithTitle);
        }
      } catch (error) {
        Logger.error('[SnippetFormScreen] Snippet not found:', error);
        router.back();
      } finally {
        setLoading(false);
      }
    };

    void loadSnippet();
  }, [isEditMode, snippetId, getById, router]);

  /* ======================================== */
  /* イベントハンドラ */
  /* ======================================== */

  /**
   * タイトル入力画面へ遷移
   * グローバルコールバックで値を受け取る
   */
  const handleTitlePress = useCallback(() => {
    global.snippetTitleCallback = (newTitle: string) => {
      setTitle(newTitle);
    };
    router.push({
      pathname: '/snippet/title-input',
      params: { title, onSave: 'true' },
    });
  }, [title, router]);

  /**
   * コンテンツ入力画面へ遷移
   * グローバルコールバックで値を受け取る
   */
  const handleContentPress = useCallback(() => {
    global.snippetContentCallback = (newContent: string) => {
      setContent(newContent);
    };
    router.push({
      pathname: '/snippet/content-input',
      params: { content, onSave: 'true' },
    });
  }, [content, router]);

  /**
   * カテゴリ選択画面へ遷移
   * グローバルコールバックで選択結果を受け取る
   */
  const handleCategoryPress = useCallback(() => {
    global.categorySelectCallback = (categoryId: string | null) => {
      setSelectedCategoryId(categoryId);
    };
    router.push({
      pathname: '/category/select',
      params: { selectedId: selectedCategoryId ?? 'null' },
    });
  }, [selectedCategoryId, router]);

  /**
   * プロファイル選択画面へ遷移
   * グローバルコールバックで選択結果を受け取る
   * 選択画面はショートカット編集と共有のため、target で定型文向けの説明文を出させる
   */
  const handleProfilePress = useCallback(() => {
    global.profileSelectCallback = (profileIds: string[]) => {
      setSelectedProfileIds(profileIds);
    };
    router.push({
      pathname: '/profile/select',
      params: { selectedIds: selectedProfileIds.join(','), target: 'snippet' },
    });
  }, [selectedProfileIds, router]);

  /**
   * タイトル付きコピー設定変更
   */
  const handleCopyWithTitleChange = useCallback((value: boolean) => {
    setCopyWithTitle(value);
  }, []);

  /**
   * 保存処理
   * バリデーション後、新規作成または更新を実行
   */
  const handleSave = useCallback(async () => {
    if (!title.trim()) {
      showInfo('error.empty_title');
      return;
    }

    if (!content.trim()) {
      showInfo('error.empty_content');
      return;
    }

    /* 新規作成だけ登録上限を判定する。ディープリンクなどホームの追加ボタンを経由しない開き方があり、
       権利確認中にホームが判定を保留した場合もここで止めるため、保存時は保留せず必ず判定する。
       止めた場合も画面は閉じず、入力は残る。条件は下の作成・更新の分岐と揃える */
    if (!(isEditMode && snippetId) && !ensureCanAddSnippet()) {
      return;
    }

    setSaving(true);
    try {
      if (isEditMode && snippetId) {
        updateSnippet({
          id: snippetId,
          title: title.trim(),
          content: content.trim(),
          categoryId: selectedCategoryId,
          profileIds: selectedProfileIds,
          copyWithTitle,
        });
      } else {
        createSnippet({
          title: title.trim(),
          content: content.trim(),
          categoryId: selectedCategoryId,
          profileIds: selectedProfileIds,
          copyWithTitle,
        });
      }
      router.back();
    } catch {
      showErrorAlert(t('error.generic'));
    } finally {
      setSaving(false);
    }
  }, [
    title,
    content,
    isEditMode,
    snippetId,
    selectedCategoryId,
    selectedProfileIds,
    copyWithTitle,
    ensureCanAddSnippet,
    updateSnippet,
    createSnippet,
    router,
    t,
  ]);

  /* ======================================== */
  /* 戻り値 */
  /* ======================================== */
  return {
    /* 状態 */
    title,
    content,
    selectedCategoryId,
    selectedProfileIds,
    copyWithTitle,
    saving,
    loading,

    /* 派生状態 */
    isEditMode,
    canSave,
    selectedCategory,
    categories,
    profiles,

    /* ハンドラ */
    handleTitlePress,
    handleContentPress,
    handleCategoryPress,
    handleProfilePress,
    handleCopyWithTitleChange,
    handleSave,
  };
}
