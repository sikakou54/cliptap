/**
 * ショートカット管理Provider
 *
 * @description
 * ショートカットのグローバル状態を管理するProvider。
 * すべての画面で同じデータを参照でき、一箇所で更新すると全画面に即座に反映される。
 *
 * @remarks
 * ショートカットは0件以上のプロファイルに紐づく（0件は全プロファイル向け。定型文と同じ）。
 * 保持するのは常にアクティブなプロファイルから見える分（紐づくもの＋0件のもの）だけとする。
 * カスタム変数を参照している値はプロファイルを切り替えると解決結果が変わるため、切替時に読み直す。
 * 作成・更新の戻り値とIDでの取得も、一覧と同じくアクティブなプロファイルを基準に解決する。
 * そのためProfileProviderの内側へ置くこと。
 *
 * @module ShortcutProvider
 */

import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { getClipboardAdapter, hasClipboardAdapter } from '../adapters/ClipboardAdapter';
import { ShortcutService } from '../services/ShortcutService';
import { Logger } from '../utils/logger';
import { useDatabase } from './DatabaseProvider';
import { useProfiles } from './ProfileProvider';
import type { CreateShortcutInput, Shortcut, ShortcutValue, UpdateShortcutInput } from '../schema';

/* ======================================== */
/* 型定義 */
/* ======================================== */

/**
 * ShortcutContextの型定義
 */
export interface ShortcutContextValue {
  /** アクティブなプロファイルから見えるショートカット一覧（sortOrder順） */
  shortcuts: Shortcut[];
  /** 一覧の絞り込みと値の参照解決の基準となるプロファイルID（アクティブなプロファイル。未確定ならnull） */
  activeProfileId: string | null;
  /** データ読み込み中フラグ */
  loading: boolean;
  /** エラー情報（エラーなしの場合null） */
  error: Error | null;
  /** データ再読み込み関数 */
  refresh: () => void;
  /** ショートカット作成 */
  createShortcut: (input: CreateShortcutInput) => Shortcut;
  /** ショートカット更新 */
  updateShortcut: (input: UpdateShortcutInput) => Shortcut;
  /** ショートカット削除 */
  deleteShortcut: (id: string) => void;
  /** ショートカット値をクリップボードへコピーする（使用回数も加算する） */
  copyShortcutValue: (value: ShortcutValue) => Promise<void>;
  /** IDで取得（値の参照はアクティブなプロファイルを基準に解決する） */
  getById: (id: string) => Shortcut | null;
}

/**
 * ShortcutProviderのProps
 */
interface ShortcutProviderProps {
  /** 子コンポーネント */
  children: ReactNode;
}

/* ======================================== */
/* Context */
/* ======================================== */

const ShortcutContext = createContext<ShortcutContextValue | null>(null);

/* ======================================== */
/* Provider */
/* ======================================== */

/**
 * ショートカット管理Provider
 *
 * @param props - ShortcutProviderProps
 */
export function ShortcutProvider({ children }: ShortcutProviderProps) {
  /* ======================================== */
  /* 状態管理 */
  /* ======================================== */
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  /* データベース初期化状態（DatabaseProviderが必須） */
  const { isLoaded: isDatabaseLoaded } = useDatabase();

  /* アクティブなプロファイル。配列から導出せずProviderの値を使う
     （Provider側が行うアクティブ未設定時の標準プロファイル昇格を取りこぼさないため） */
  const { activeProfile } = useProfiles();
  const activeProfileId = activeProfile?.id ?? null;

  /* ======================================== */
  /* データ読み込み */
  /* ======================================== */
  const loadShortcuts = useCallback(() => {
    /* プロファイルが確定するまでは空で待つ。全件表示へ倒すと他プロファイルの
       ショートカットが一瞬見えてしまう */
    if (!activeProfileId) {
      setShortcuts([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setShortcuts(ShortcutService.getByProfileId(activeProfileId));
      setError(null);
    } catch (err) {
      Logger.error('[ShortcutProvider] Failed to load shortcuts:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [activeProfileId]);

  /* データベースの初期化後と、アクティブなプロファイルの切替時に読み込む */
  useEffect(() => {
    if (!isDatabaseLoaded) return;
    loadShortcuts();
  }, [loadShortcuts, isDatabaseLoaded]);

  /* ======================================== */
  /* CRUD操作 */
  /* ======================================== */

  /**
   * ショートカット作成
   * @throws {EmptyContentError} ショートカット名が空の場合
   * @throws {DuplicateNameError} 紐づけるいずれかのプロファイルで同名のショートカットが見える場合
   * @throws {ShortcutValueRequiredError} 値が1件も無い場合
   */
  const createShortcut = useCallback(
    (input: CreateShortcutInput): Shortcut => {
      /* 戻り値の値は一覧と同じくアクティブなプロファイルで解決する */
      const shortcut = ShortcutService.create(input, activeProfileId);
      loadShortcuts();
      return shortcut;
    },
    [loadShortcuts, activeProfileId]
  );

  /**
   * ショートカット更新
   * @throws {EmptyContentError} ショートカット名が空の場合
   * @throws {DuplicateNameError} 保存後に紐づくいずれかのプロファイルで同名のショートカットが見える場合（自分以外）
   * @throws {ShortcutValueRequiredError} 値をすべて削除しようとした場合
   */
  const updateShortcut = useCallback(
    (input: UpdateShortcutInput): Shortcut => {
      /* 戻り値の値は一覧と同じくアクティブなプロファイルで解決する */
      const shortcut = ShortcutService.update(input, activeProfileId);
      loadShortcuts();
      return shortcut;
    },
    [loadShortcuts, activeProfileId]
  );

  /**
   * ショートカット削除
   * @remarks ショートカットが持つ値もすべて削除される
   */
  const deleteShortcut = useCallback(
    (id: string): void => {
      ShortcutService.delete(id);
      loadShortcuts();
    },
    [loadShortcuts]
  );

  /* ======================================== */
  /* ユーティリティ */
  /* ======================================== */

  /**
   * ショートカット値をクリップボードへコピーする
   *
   * @remarks
   * 挿入する値だけをコピーする（値名は含めない）。
   * ショートカット値は変数トークン（{{name}}）の展開対象ではない。
   * コピーするのはMapperが解決済みの value（カスタム変数を参照中はその変数の値）であり、
   * 保存文字列の storedValue ではない。
   *
   * 使用回数は定型文（SnippetProvider.copySnippet）と同じく、コピーでも加算する。
   * 加算条件がフルアクセス許可に依存する拡張キーボードは、
   * ネイティブ側（ClipTapKeyboard/Services/ShortcutService.swift の isUsageTrackingEnabled）で
   * 個別に判定している。
   *
   * 画面の並べ替え（使用頻度順）へ即座に反映するため、保持中の一覧も同じだけ進める。
   * 再取得ではなく手元で進めるのは、コピーのたびに一覧が組み直されて
   * 指の下で行が動くのを避けるため。
   */
  const copyShortcutValue = useCallback(async (value: ShortcutValue): Promise<void> => {
    if (!hasClipboardAdapter()) {
      throw new Error('Clipboard adapter is not registered');
    }

    await getClipboardAdapter().copy(value.value);

    ShortcutService.recordUse(value.id, value.shortcutId);
    setShortcuts((prev) =>
      prev.map((shortcut) =>
        shortcut.id === value.shortcutId
          ? {
              ...shortcut,
              values: shortcut.values.map((current) =>
                current.id === value.id
                  ? { ...current, useCount: current.useCount + 1 }
                  : current
              ),
            }
          : shortcut
      )
    );
  }, []);

  /**
   * IDでショートカットを取得
   * @remarks 複数のプロファイルに紐づくショートカットは本体から基準を決められないため、一覧と同じくアクティブなプロファイルで解決する
   */
  const getById = useCallback(
    (id: string): Shortcut | null => ShortcutService.getById(id, activeProfileId),
    [activeProfileId]
  );

  /* ======================================== */
  /* Context Value */
  /* ======================================== */
  const value = useMemo<ShortcutContextValue>(
    () => ({
      shortcuts,
      activeProfileId,
      loading,
      error,
      refresh: loadShortcuts,
      createShortcut,
      updateShortcut,
      deleteShortcut,
      copyShortcutValue,
      getById,
    }),
    [
      shortcuts,
      activeProfileId,
      loading,
      error,
      loadShortcuts,
      createShortcut,
      updateShortcut,
      deleteShortcut,
      copyShortcutValue,
      getById,
    ]
  );

  return <ShortcutContext.Provider value={value}>{children}</ShortcutContext.Provider>;
}

/* ======================================== */
/* Hook */
/* ======================================== */

/**
 * ショートカット状態を取得するフック
 *
 * @returns ショートカット状態とアクション
 * @throws Provider外で使用された場合にエラー
 */
export function useShortcuts(): ShortcutContextValue {
  const context = useContext(ShortcutContext);
  if (!context) {
    throw new Error('useShortcuts must be used within ShortcutProvider');
  }
  return context;
}
