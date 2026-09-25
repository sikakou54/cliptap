/**
 * スニペットモーダルのビジネスロジックフック
 *
 * @description
 * スニペットの作成・編集モーダルの状態管理とロジックを提供。
 * Dashboard画面から分離された専用フック。
 * 新規作成では無料プランの登録上限（定型文50件）も判定する。
 *
 * @see pages/Dashboard.tsx - 使用元
 */

import { useState, useCallback, useMemo } from 'react';
import {
  FREE_SNIPPETS_LIMIT,
  Logger,
  SnippetService,
  useSharedSubscription,
  useSnippets,
  useTranslation,
  type Snippet,
  type SnippetProfile,
} from '@cliptap/shared';
import { showErrorAlert } from '@utils/alerts';

/** スニペットフォームの値 */
export interface SnippetFormValues {
  title: string;
  content: string;
  categoryId: string | null;
  copyWithTitle: boolean;
  profileIds: string[];
}

export interface UseSnippetModalParams {
  /** スニペットとプロファイルの紐付け（編集時のプロファイルID取得用） */
  snippetProfiles: SnippetProfile[];
  /** スニペット更新後の再読み込みコールバック（親のuseSnippetsを更新するため） */
  onSnippetsChange?: () => void;
}

export interface UseSnippetModalReturn {
  /* 状態 */
  /** 新規作成モーダル表示中か */
  isCreating: boolean;
  /** 編集中のスニペット（nullの場合は編集モーダル非表示） */
  editingSnippet: Snippet | null;
  /** 編集中スニペットに紐づくプロファイルID一覧 */
  editingSnippetProfileIds: string[];

  /* ハンドラ */
  /** 新規作成モーダルを開く */
  handleCreate: () => void;
  /** 新規作成モーダルを閉じる */
  closeCreateModal: () => void;
  /** 編集モーダルを開く */
  handleEdit: (snippet: Snippet) => void;
  /** 編集モーダルを閉じる */
  closeEditModal: () => void;
  /** 新規スニペットを保存 */
  handleSaveCreate: (values: SnippetFormValues) => Promise<void>;
  /** 編集内容を保存 */
  handleSaveEdit: (values: SnippetFormValues) => Promise<void>;
  /** スニペットを削除 */
  handleDelete: (id: string) => Promise<void>;
}

/**
 * スニペットモーダルのビジネスロジックフック
 */
export function useSnippetModal({
  snippetProfiles,
  onSnippetsChange,
}: UseSnippetModalParams): UseSnippetModalReturn {
  const { t } = useTranslation();
  const { createSnippet, updateSnippet, deleteSnippet } = useSnippets();
  const { isLoading: isSubscriptionLoading, canAddSnippet } = useSharedSubscription();

  /* ======================================== */
  /* 状態管理 */
  /* ======================================== */
  const [editingSnippet, setEditingSnippet] = useState<Snippet | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  /* ======================================== */
  /* 派生状態 */
  /* ======================================== */

  /** 編集中スニペットに紐づくプロファイルID一覧 */
  const editingSnippetProfileIds = useMemo(() => {
    if (!editingSnippet) return [];
    return snippetProfiles
      .filter((sp) => sp.snippetId === editingSnippet.id)
      .map((sp) => sp.profileId);
  }, [editingSnippet, snippetProfiles]);

  /* ======================================== */
  /* ハンドラ */
  /* ======================================== */

  /**
   * 定型文を1件追加できるか判定し、できなければ上限の案内を出す
   *
   * @returns 追加できる場合true
   * @remarks
   * 件数は絞り込み前の総数をDBから数える。ダッシュボードの一覧はプロファイル・カテゴリで
   * 絞り込まれており、その件数では他のプロファイルの分を取りこぼすためである。
   * 上限以上ある既存の定型文は使えるまま残し、止めるのは新規作成だけとする。
   */
  const ensureCanAddSnippet = useCallback((): boolean => {
    if (canAddSnippet(SnippetService.count())) {
      return true;
    }
    showErrorAlert(t('snippet.limit_message', { limit: FREE_SNIPPETS_LIMIT }));
    return false;
  }, [canAddSnippet, t]);

  /**
   * 新規作成モーダルを開く
   *
   * @remarks
   * 権利確認中（起動直後・ログイン直後）は上限の判定を保留して開く。確認が終わるまでは
   * Pro利用者もFree扱いのため、ここで判定すると誤って上限の案内を出してしまう。
   * 上限は保存時に必ず判定する。
   */
  const handleCreate = useCallback(() => {
    if (!isSubscriptionLoading && !ensureCanAddSnippet()) {
      return;
    }
    setIsCreating(true);
  }, [isSubscriptionLoading, ensureCanAddSnippet]);

  /** 新規作成モーダルを閉じる */
  const closeCreateModal = useCallback(() => {
    setIsCreating(false);
  }, []);

  /**
   * 新規スニペットを保存
   *
   * @remarks
   * 保存時は権利確認中でも上限を判定する（未確定はFree扱い）。確認中に開いたモーダル、
   * 開いた後の件数の変化、保存の二度押しもここで止める。
   */
  const handleSaveCreate = useCallback(async (values: SnippetFormValues) => {
    if (!ensureCanAddSnippet()) {
      return;
    }
    try {
      await createSnippet(values);
      setIsCreating(false);
      /* 親のuseSnippetsも更新するため、コールバックを呼び出す */
      onSnippetsChange?.();
    } catch (err) {
      Logger.error('Failed to create:', err);
    }
  }, [ensureCanAddSnippet, createSnippet, onSnippetsChange]);

  /** 編集モーダルを開く */
  const handleEdit = useCallback((snippet: Snippet) => {
    setEditingSnippet(snippet);
  }, []);

  /** 編集モーダルを閉じる */
  const closeEditModal = useCallback(() => {
    setEditingSnippet(null);
  }, []);

  /** 編集内容を保存 */
  const handleSaveEdit = useCallback(async (values: SnippetFormValues) => {
    if (!editingSnippet) return;

    try {
      await updateSnippet({
        id: editingSnippet.id,
        title: values.title,
        content: values.content,
        categoryId: values.categoryId,
        copyWithTitle: values.copyWithTitle,
        profileIds: values.profileIds,
      });
      setEditingSnippet(null);
      /* 親のuseSnippetsも更新するため、コールバックを呼び出す */
      onSnippetsChange?.();
    } catch (err) {
      Logger.error('Failed to update:', err);
    }
  }, [editingSnippet, updateSnippet, onSnippetsChange]);

  /** スニペットを削除（確認ダイアログ付き） */
  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteSnippet(id);
      /* 親のuseSnippetsも更新するため、コールバックを呼び出す */
      onSnippetsChange?.();
    } catch (err) {
      Logger.error('Failed to delete:', err);
    }
  }, [deleteSnippet, onSnippetsChange]);

  return {
    /* 状態 */
    isCreating,
    editingSnippet,
    editingSnippetProfileIds,

    /* ハンドラ */
    handleCreate,
    closeCreateModal,
    handleEdit,
    closeEditModal,
    handleSaveCreate,
    handleSaveEdit,
    handleDelete,
  };
}
