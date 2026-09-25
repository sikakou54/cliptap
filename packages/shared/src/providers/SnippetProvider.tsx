/**
 * スニペット管理Provider
 *
 * @description
 * スニペット（定型文）のグローバル状態を管理するProvider。
 * すべての画面で同じデータを参照でき、一箇所で更新すると全画面に即座に反映される。
 *
 * @module SnippetProvider
 */

import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { SnippetService } from '../services/SnippetService';
import { Logger } from '../utils/logger';
import { getClipboardAdapter, hasClipboardAdapter } from '../adapters/ClipboardAdapter';
import { useDatabase } from './DatabaseProvider';
import { createCustomResolver, getCurrentLocale } from './variableCopyContext';
import type { Snippet, SnippetProfile, CreateSnippetInput, UpdateSnippetInput, SnippetSortBy } from '../schema';
import { hasSortPreferenceAdapter, getSortPreferenceAdapter } from '../adapters/SortPreferenceAdapter';

/* ======================================== */
/* 型定義 */
/* ======================================== */

/**
 * SnippetContextの型定義
 */
export interface SnippetContextValue {
  /** 全スニペット一覧（ソート済み、フィルタリングなし） */
  allSnippets: Snippet[];
  /** スニペット-プロファイル関連 */
  snippetProfiles: SnippetProfile[];
  /** データ読み込み中フラグ */
  loading: boolean;
  /** エラー情報 */
  error: Error | null;
  /** 現在のソート順 */
  sortBy: SnippetSortBy;
  /** ソート順を変更 */
  setSortBy: (sortBy: SnippetSortBy) => void;
  /** データ再読み込み関数 */
  refresh: () => void;
  /** スニペット作成 */
  createSnippet: (input: CreateSnippetInput) => Snippet;
  /** スニペット更新 */
  updateSnippet: (input: UpdateSnippetInput) => Snippet;
  /** スニペット削除 */
  deleteSnippet: (id: string) => void;
  /** クリップボードにコピー */
  copySnippet: (id: string, profileId?: string) => Promise<void>;
  /** タイトルだけをクリップボードにコピー */
  copySnippetTitle: (id: string, profileId?: string) => Promise<void>;
  /** ID指定で取得 */
  getById: (id: string) => Snippet | null;
}

/**
 * SnippetProviderのProps
 */
interface SnippetProviderProps {
  /** 子コンポーネント */
  children: ReactNode;
}

/* ======================================== */
/* Context */
/* ======================================== */

const SnippetContext = createContext<SnippetContextValue | null>(null);

/* ======================================== */
/* Provider */
/* ======================================== */

/**
 * スニペット管理Provider
 *
 * @param props - SnippetProviderProps
 */
export function SnippetProvider({ children }: SnippetProviderProps) {
  /* ======================================== */
  /* 状態管理 */
  /* ======================================== */
  const [allSnippets, setAllSnippets] = useState<Snippet[]>([]);
  const [snippetProfiles, setSnippetProfiles] = useState<SnippetProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [sortBy, setSortByState] = useState<SnippetSortBy>('created');
  const [isSortPreferenceLoaded, setIsSortPreferenceLoaded] = useState(false);

  /* データベース初期化状態（DatabaseProviderが必須） */
  const { isLoaded: isDatabaseLoaded } = useDatabase();

  /* 初回マウント時に保存されたソート設定を読み込み */
  useEffect(() => {
    async function loadSortPreference() {
      if (!hasSortPreferenceAdapter()) {
        setIsSortPreferenceLoaded(true);
        return;
      }

      try {
        const adapter = getSortPreferenceAdapter();
        const saved = await adapter.getSortPreference();
        if (saved) {
          setSortByState(saved);
        }
      } catch (err) {
        Logger.error('[SnippetProvider] Failed to load sort preference:', err);
      } finally {
        setIsSortPreferenceLoaded(true);
      }
    }

    void loadSortPreference();
  }, []);

  /* ======================================== */
  /* データ読み込み */
  /* ======================================== */
  const loadSnippets = useCallback((currentSortBy: SnippetSortBy) => {
    try {
      setLoading(true);

      /* 全スニペットを取得（SQLでソート済み） */
      const data = SnippetService.getSorted(currentSortBy);
      setAllSnippets(data);

      /* 全スニペット-プロファイル関連を取得 */
      const allSnippetProfiles = SnippetService.getAllSnippetProfiles();
      setSnippetProfiles(allSnippetProfiles);

      setError(null);
    } catch (err) {
      Logger.error('[SnippetProvider] Failed to load snippets:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  /* データベースが初期化され、ソート設定が読み込まれた後にデータを読み込む */
  useEffect(() => {
    if (!isDatabaseLoaded || !isSortPreferenceLoaded) return;
    loadSnippets(sortBy);
  }, [loadSnippets, isDatabaseLoaded, isSortPreferenceLoaded, sortBy]);

  /* ======================================== */
  /* CRUD操作 */
  /* ======================================== */

  /**
   * ソート順を変更し、永続化する
   */
  const setSortBy = useCallback((newSortBy: SnippetSortBy) => {
    setSortByState(newSortBy);

    /* 非同期で永続化（UIをブロックしない） */
    if (hasSortPreferenceAdapter()) {
      const adapter = getSortPreferenceAdapter();
      void adapter.setSortPreference(newSortBy).catch((err) => {
        Logger.error('[SnippetProvider] Failed to save sort preference:', err);
      });
    }
  }, []);

  /**
   * 現在のソート順でデータを再読み込み
   */
  const refresh = useCallback(() => {
    loadSnippets(sortBy);
  }, [loadSnippets, sortBy]);

  /**
   * スニペット作成
   * @throws {EmptyContentError} スニペットの本文が空の場合
   */
  const createSnippet = useCallback(
    (input: CreateSnippetInput): Snippet => {
      const snippet = SnippetService.create(input);
      loadSnippets(sortBy);
      return snippet;
    },
    [loadSnippets, sortBy]
  );

  /**
   * スニペット更新
   *
   * 更新後に現在のソート順で再読込し、Contextを見ている全画面へ即時反映する。
   */
  const updateSnippet = useCallback(
    (input: UpdateSnippetInput): Snippet => {
      const snippet = SnippetService.update(input);
      loadSnippets(sortBy);
      return snippet;
    },
    [loadSnippets, sortBy]
  );

  /**
   * スニペット削除
   *
   * 削除後に現在のソート順で再読込し、Contextを見ている全画面へ即時反映する。
   */
  const deleteSnippet = useCallback(
    (id: string): void => {
      SnippetService.delete(id);
      loadSnippets(sortBy);
    },
    [loadSnippets, sortBy]
  );

  /* ======================================== */
  /* ユーティリティ */
  /* ======================================== */

  /**
   * クリップボードにコピー（変数展開込み）
   */
  const copySnippet = useCallback(async (id: string, profileId?: string): Promise<void> => {
    let textToCopy: string;

    try {
      const customResolver = createCustomResolver(profileId);
      textToCopy = await SnippetService.prepareForClipboard(id, {
        locale: getCurrentLocale(),
        customResolver,
        shouldReplaceVariables: true,
      });
    } catch (err) {
      /* 展開に失敗したからといってコピー自体を失敗させると、利用者は原因が分からないまま操作できなくなる。
         未展開のテキストなら貼り付け先で手直しできるため、警告ログだけ残して処理を続ける */
      Logger.warn('[SnippetProvider] Variable replacement failed, copying original content:', err);
      textToCopy = await SnippetService.prepareForClipboard(id, {
        shouldReplaceVariables: false,
      });
    }

    if (hasClipboardAdapter()) {
      await getClipboardAdapter().copy(textToCopy);

      /* アプリ本体とWebは一覧・検索・詳細のどの導線から呼ばれても本文コピー1回として加算する。
         加算条件がフルアクセス許可に依存する拡張キーボードは、
         ネイティブ側（ClipTapKeyboard/Services/SnippetService.swift の isUsageTrackingEnabled）で個別に判定している */
      SnippetService.incrementCopyCount(id);
      setAllSnippets(prev => prev.map(s =>
        s.id === id ? { ...s, copyCount: (s.copyCount ?? 0) + 1 } : s
      ));
    }
  }, []);

  /**
   * タイトルだけをクリップボードにコピー（変数展開込み）
   *
   * 【使用回数を加算しない理由】
   * タイトルをコピーしたあと本文もコピーすると、1回の利用が2回分として数えられてしまいます。
   * 使用回数は本文を含むコピー（copySnippet）でのみ加算します。
   */
  const copySnippetTitle = useCallback(async (id: string, profileId?: string): Promise<void> => {
    let titleToCopy: string;

    try {
      const customResolver = createCustomResolver(profileId);
      titleToCopy = await SnippetService.prepareTitleForClipboard(id, {
        locale: getCurrentLocale(),
        customResolver,
        shouldReplaceVariables: true,
      });
    } catch (err) {
      /* 本文コピーと同じ方針。展開に失敗してもコピー自体は成立させ、未展開のタイトルを渡して手直しできる状態にする */
      Logger.warn('[SnippetProvider] Variable replacement failed, copying original title:', err);
      titleToCopy = await SnippetService.prepareTitleForClipboard(id, {
        shouldReplaceVariables: false,
      });
    }

    /* タイトルがない場合はクリップボードを書き換えない */
    if (!titleToCopy) {
      return;
    }

    if (hasClipboardAdapter()) {
      await getClipboardAdapter().copy(titleToCopy);
    }
  }, []);

  const getById = useCallback((id: string): Snippet | null => SnippetService.getById(id), []);

  /* ======================================== */
  /* Context Value */
  /* ======================================== */
  const value = useMemo<SnippetContextValue>(
    () => ({
      allSnippets,
      snippetProfiles,
      loading,
      error,
      sortBy,
      setSortBy,
      refresh,
      createSnippet,
      updateSnippet,
      deleteSnippet,
      copySnippet,
      copySnippetTitle,
      getById,
    }),
    [
      allSnippets,
      snippetProfiles,
      loading,
      error,
      sortBy,
      setSortBy,
      refresh,
      createSnippet,
      updateSnippet,
      deleteSnippet,
      copySnippet,
      copySnippetTitle,
      getById,
    ]
  );

  return <SnippetContext.Provider value={value}>{children}</SnippetContext.Provider>;
}

/* ======================================== */
/* Hook */
/* ======================================== */

/**
 * スニペット状態を取得するフック（全データを返す）
 *
 * @returns スニペット状態とアクション
 * @throws Provider外で使用された場合にエラー
 */
export function useSnippets(): SnippetContextValue {
  const context = useContext(SnippetContext);
  if (!context) {
    throw new Error('useSnippets must be used within SnippetProvider');
  }
  return context;
}

