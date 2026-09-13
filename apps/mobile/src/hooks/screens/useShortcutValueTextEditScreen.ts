/**
 * ショートカットの値入力モーダルのビジネスロジックフック
 *
 * 「挿入する値」だけを入力する画面の状態とロジックを提供。
 * UIコンポーネント（shortcut/value-text-edit.tsx）から完全に分離されたビジネスロジック層。
 *
 * 【値だけを別のモーダルにする理由】
 * 挿入する値は住所や定型の文面など複数行になることがあり、値名と同じ画面に収めると
 * 入力欄が狭くなって全体を確かめられない。カスタム変数の値入力（profile-value-edit）と
 * 同じく、値だけを画面いっぱいに広げて入力する。
 *
 * @see app/shortcut/value-text-edit.tsx - UIコンポーネント
 * @see src/hooks/screens/useProfileValueEditScreen.ts - カスタム変数側の同じ役割のフック
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { TextInput } from 'react-native';
import { useRouter } from 'expo-router';

/**
 * useShortcutValueTextEditScreenの引数の型
 */
interface UseShortcutValueTextEditScreenParams {
  /** 初期値（呼び出し元が保持している編集中の値） */
  initialValue: string;
}

/**
 * useShortcutValueTextEditScreenの戻り値の型
 */
export interface UseShortcutValueTextEditScreenReturn {
  /* 状態 */
  /** 入力中の値 */
  value: string;
  /** 入力中の値を更新する */
  setValue: (value: string) => void;
  /** 入力欄への参照（自動フォーカス用） */
  textInputRef: React.RefObject<TextInput | null>;

  /* ハンドラ */
  /** 入力内容を呼び出し元へ返して閉じる */
  handleSave: () => void;
}

/**
 * ショートカットの値入力モーダルのビジネスロジックフック
 *
 * @param params - 初期値
 * @returns 画面に必要な状態とハンドラ
 */
export function useShortcutValueTextEditScreen(
  params: UseShortcutValueTextEditScreenParams
): UseShortcutValueTextEditScreenReturn {
  const { initialValue } = params;

  const router = useRouter();

  /* 初期値はレンダー時に確定するため、effectで書き戻さず初期値として渡す。
     effectで入れると、1レンダー分だけ空の入力欄が見えるうえに
     入力後の再レンダーで打ち消される余地が残る */
  const [value, setValue] = useState(initialValue);
  const textInputRef = useRef<TextInput>(null);

  /* 開いた直後から打ち始められるようにする。
     即座にfocusするとモーダルの表示アニメーションと重なって効かないことがあるため少し待つ */
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      textInputRef.current?.focus();
    }, 100);

    return () => clearTimeout(timeoutId);
  }, []);

  /**
   * 入力内容を呼び出し元へ返して閉じる
   *
   * expo-routerのモーダルは戻り値を返せないため、グローバル変数経由で受け渡す
   * （値編集モーダルが親画面へ返すときと同じ作り）。
   */
  const handleSave = useCallback(() => {
    global.shortcutValueTextCallback?.(value);
    router.back();
  }, [value, router]);

  return {
    value,
    setValue,
    textInputRef,
    handleSave,
  };
}
