/**
 * ショートカット値編集モーダルのビジネスロジックフック
 *
 * ショートカットが持つ値1件の追加・編集の状態管理とロジックを提供。
 * UIコンポーネント（shortcut/value-edit.tsx）から完全に分離されたビジネスロジック層。
 *
 * 主な責務:
 * - 値名と値の入力状態の管理
 * - 保存可否の判定
 * - 値入力画面（shortcut/value-text-edit）との往復
 * - 親画面（shortcut/edit）への値の受け渡し
 *
 * @see app/shortcut/value-edit.tsx - UIコンポーネント
 * @see src/hooks/screens/useShortcutEditScreen.ts - 受け取り側
 */

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';

/**
 * useShortcutValueEditScreenの引数の型
 */
interface UseShortcutValueEditScreenParams {
  /** 編集対象の値の画面内キー（新規追加時は空文字） */
  valueKey: string;
  /** 値名の初期値 */
  initialName: string;
  /** 値の初期値（変数トークンは未展開） */
  initialValue: string;
}

/**
 * useShortcutValueEditScreenの戻り値の型
 */
export interface UseShortcutValueEditScreenReturn {
  /* 状態 */
  /** 値名 */
  valueName: string;
  /** 値名を更新する */
  setValueName: (name: string) => void;
  /** 挿入する値（変数トークンは未展開） */
  value: string;

  /* 派生状態 */
  /** 編集モードかどうか */
  isEdit: boolean;
  /** 保存できるかどうか */
  canSave: boolean;

  /* ハンドラ */
  /** 値の入力画面を開く */
  handleOpenValueInput: () => void;
  /** 入力内容を親画面へ返して閉じる */
  handleSave: () => void;
}

/**
 * ショートカット値編集モーダルのビジネスロジックフック
 *
 * @param params - 画面パラメータ
 * @returns 画面に必要な全ての状態とハンドラ
 */
export function useShortcutValueEditScreen(
  params: UseShortcutValueEditScreenParams
): UseShortcutValueEditScreenReturn {
  const { valueKey, initialName, initialValue } = params;

  const router = useRouter();

  /* ======================================== */
  /* 状態管理 */
  /* ======================================== */
  const [valueName, setValueName] = useState(initialName);
  const [value, setValue] = useState(initialValue);

  /* ======================================== */
  /* 派生状態 */
  /* ======================================== */
  const isEdit = valueKey !== '';

  /**
   * 保存可能かどうか
   *
   * @remarks
   * 値名は一覧で値を見分けるための表示なので必須にする。
   * 挿入する値そのものは空文字を許容する（空文字の挿入を選ぶ利用者の意図を壊さない）。
   */
  const canSave = useMemo(() => valueName.trim() !== '', [valueName]);

  /* ======================================== */
  /* イベントハンドラ */
  /* ======================================== */

  /**
   * 値の入力画面を開く
   *
   * @remarks
   * 値は複数行になることがあり、この画面の中に収めると入力欄が狭くなって全体を確かめられない。
   * カスタム変数の値入力（useVariableEditScreen.handleOpenValueEdit）と同じく専用画面へ出す。
   * 変数トークンを挿入する変数ツールバーも、その専用画面が持つ。
   * 戻り値はグローバル変数経由で受け取る（expo-routerのモーダルは戻り値を返せないため）。
   */
  const handleOpenValueInput = useCallback(() => {
    global.shortcutValueTextCallback = (newValue: string) => {
      setValue(newValue);
    };
    router.push({
      pathname: '/shortcut/value-text-edit',
      params: { value },
    });
  }, [value, router]);

  /**
   * 入力内容を親画面へ返して閉じる
   *
   * @remarks
   * expo-router のモーダルは戻り値を返せないため、グローバル変数へ書いてから戻る。
   * 親画面（shortcut/edit）はフォーカス復帰時にこれを読み取って即座に破棄する。
   * DBへの反映は親画面の保存時にまとめて行うため、ここではDBへ触れない。
   */
  const handleSave = useCallback(() => {
    if (!canSave) return;

    global.shortcutValueCallbackData = {
      key: valueKey,
      name: valueName.trim(),
      value,
    };

    router.back();
  }, [canSave, valueKey, valueName, value, router]);

  /* ======================================== */
  /* 戻り値 */
  /* ======================================== */

  return {
    valueName,
    setValueName,
    value,
    isEdit,
    canSave,
    handleOpenValueInput,
    handleSave,
  };
}
