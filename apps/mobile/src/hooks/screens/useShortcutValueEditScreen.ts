/**
 * ショートカットの値入力モーダルのビジネスロジックフック
 *
 * 「挿入する値」だけを入力する画面の状態とロジックを提供。
 * UIコンポーネント（shortcut/value-edit.tsx）から完全に分離されたビジネスロジック層。
 *
 * 主な責務:
 * - 入力中の値の状態管理
 * - カーソル位置の管理と、変数ツールバーからの変数トークンの挿入
 * - キーボード高さの管理（ツールバーをキーボードの直上へ置くため）
 * - 呼び出し元（値編集モーダル）への受け渡し
 *
 * 【値だけを別のモーダルにする理由】
 * 挿入する値は住所や定型の文面など複数行になることがあり、値名と同じ画面に収めると
 * 入力欄が狭くなって全体を確かめられない。カスタム変数の値入力（profile-value-edit）と
 * 同じく、値だけを画面いっぱいに広げて入力する。
 *
 * 【定型文の本文入力（useTextInputScreen）とまとめない理由】
 * キーボード高さとカーソル位置の扱いは同じだが、定型文の画面はタブレットでカード表示、
 * この画面はモーダル表示と提示方法が異なり、入力内容の返し先も違う。
 * 1つのフックへまとめると、リリース済みの定型文の画面にショートカット用の分岐が混ざるため、
 * 同じ処理をそれぞれが素直に持つ。挙動を変えるときは両方を揃えること。
 *
 * @see app/shortcut/value-edit.tsx - UIコンポーネント
 * @see src/hooks/screens/useTextInputScreen.ts - 定型文の本文入力の同じ処理
 * @see src/hooks/screens/useProfileValueEditScreen.ts - カスタム変数側の同じ役割のフック
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { TextInput, Keyboard, Platform } from 'react-native';
import { useRouter } from 'expo-router';

/** フォーカス遅延時間（ミリ秒）- モーダルの表示アニメーションと重なって効かないのを避ける */
const FOCUS_DELAY_MS = 100;

/**
 * useShortcutValueEditScreenの引数の型
 */
interface UseShortcutValueEditScreenParams {
  /**
   * 編集対象の画面内キー（空文字は新規追加）
   *
   * @remarks
   * 1件のショートカットは値を複数持つため、どの値を編集しているかを呼び出し元へ返す必要がある。
   * 値そのものは識別子にできない（同じ文字列の値を2件持てる）ため、呼び出し元が振ったキーを預かる。
   */
  valueKey: string;
  /** 初期値（呼び出し元が保持している編集中の値） */
  initialValue: string;
}

/**
 * useShortcutValueEditScreenの戻り値の型
 */
export interface UseShortcutValueEditScreenReturn {
  /* 状態 */
  /** 入力中の値 */
  value: string;
  /** 表示中のキーボードの高さ（非表示なら0） */
  keyboardHeight: number;
  /** 入力欄への参照（自動フォーカス用） */
  textInputRef: React.RefObject<TextInput | null>;

  /* ハンドラ */
  /** 入力中の値を更新する */
  handleChangeText: (value: string) => void;
  /** カーソル位置の変化を受け取る */
  handleSelectionChange: (start: number) => void;
  /** 変数トークン（{{name}}）をカーソル位置へ挿入する */
  handleInsertVariable: (variableName: string) => void;
  /** 入力内容を呼び出し元へ返して閉じる */
  handleSave: () => void;
}

/**
 * ショートカットの値入力モーダルのビジネスロジックフック
 *
 * @param params - 編集対象のキーと初期値
 * @returns 画面に必要な状態とハンドラ
 */
export function useShortcutValueEditScreen(
  params: UseShortcutValueEditScreenParams
): UseShortcutValueEditScreenReturn {
  const { valueKey, initialValue } = params;

  const router = useRouter();

  /* ======================================== */
  /* 状態管理 */
  /* ======================================== */

  /* 初期値はレンダー時に確定するため、effectで書き戻さず初期値として渡す。
     effectで入れると、1レンダー分だけ空の入力欄が見えるうえに
     入力後の再レンダーで打ち消される余地が残る */
  const [value, setValue] = useState(initialValue);
  /* 開いた直後はカーソルを末尾に置くため、挿入位置も末尾から始める */
  const [cursorPosition, setCursorPosition] = useState(initialValue.length);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const textInputRef = useRef<TextInput>(null);

  /* ======================================== */
  /* キーボードイベントリスナー */
  /* ======================================== */

  /* ツールバーをキーボードの直上へ置くため、キーボードの高さを追う（定型文の本文入力と同じ） */
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const keyboardShow = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const keyboardHide = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      keyboardShow.remove();
      keyboardHide.remove();
    };
  }, []);

  /* ======================================== */
  /* 自動フォーカスとカーソル位置設定 */
  /* ======================================== */

  /* 開いた直後から打ち始められるようにし、カーソルを末尾へ置く。
     即座にfocusするとモーダルの表示アニメーションと重なって効かないことがあるため少し待つ */
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      textInputRef.current?.focus();
      if (initialValue.length > 0) {
        textInputRef.current?.setNativeProps({
          selection: { start: initialValue.length, end: initialValue.length },
        });
      }
    }, FOCUS_DELAY_MS);

    return () => clearTimeout(timeoutId);
  }, [initialValue.length]);

  /* ======================================== */
  /* イベントハンドラ */
  /* ======================================== */

  /**
   * 入力中の値を更新する
   */
  const handleChangeText = useCallback((newValue: string) => {
    setValue(newValue);
  }, []);

  /**
   * カーソル位置の変化を受け取る
   */
  const handleSelectionChange = useCallback((start: number) => {
    setCursorPosition(start);
  }, []);

  /**
   * 変数トークンをカーソル位置へ挿入する
   *
   * @remarks
   * 挿入後もキーボードを出したまま続けて入力できるよう、入力欄へフォーカスを戻す。
   */
  const handleInsertVariable = useCallback(
    (variableName: string) => {
      const token = `{{${variableName}}}`;
      const nextValue = value.slice(0, cursorPosition) + token + value.slice(cursorPosition);

      setValue(nextValue);
      setCursorPosition(cursorPosition + token.length);

      setTimeout(() => {
        textInputRef.current?.focus();
      }, FOCUS_DELAY_MS);
    },
    [value, cursorPosition]
  );

  /**
   * 入力内容を呼び出し元へ返して閉じる
   *
   * expo-routerのモーダルは戻り値を返せないため、グローバル変数経由で受け渡す
   * （値編集モーダルが親画面へ返すときと同じ作り）。
   */
  const handleSave = useCallback(() => {
    global.shortcutValueCallbackData = { key: valueKey, value };
    router.back();
  }, [valueKey, value, router]);

  return {
    value,
    keyboardHeight,
    textInputRef,
    handleChangeText,
    handleSelectionChange,
    handleInsertVariable,
    handleSave,
  };
}
