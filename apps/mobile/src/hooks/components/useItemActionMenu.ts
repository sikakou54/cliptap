/**
 * 一覧カードの「・・・」メニューのロジックフック
 *
 * 「編集」「削除」を並べたボトムシートを開閉する。
 * 開くときは画面の下からせり上げ、閉じるときは即座に消す。
 * 項目が選ばれたら、シートを閉じてから編集・削除を実行する。
 *
 * @see components/common/ItemActionMenu.tsx - UIコンポーネント
 */

import { useCallback, useRef, useState } from 'react';
import { Animated, Platform, useWindowDimensions, type LayoutChangeEvent } from 'react-native';

/* ========================================
   定数
   ======================================== */

/**
 * シートをせり上げる時間（ms）
 *
 * アニメーションは100ms以内の規約に収める。UI_CONSTANTS.ANIMATION_DURATION は220ms以上のため使わない。
 */
const SHEET_SLIDE_MS = 100;

/* ========================================
   型定義
   ======================================== */

/**
 * useItemActionMenuのProps
 * @property onEdit - シートで「編集」が選ばれたときに呼ぶ
 * @property onDelete - シートで「削除」が選ばれたときに呼ぶ
 */
export interface UseItemActionMenuProps {
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * useItemActionMenuの戻り値の型
 */
export interface UseItemActionMenuReturn {
  /* 状態 */
  visible: boolean;
  translateY: Animated.Value;

  /* ハンドラ */
  handleOpen: () => void;
  handleClose: () => void;
  handleSheetLayout: (event: LayoutChangeEvent) => void;
  handleSelectEdit: () => void;
  handleSelectDelete: () => void;
  handleDismiss: () => void;
}

/**
 * 一覧カードの「・・・」メニューのロジックフック
 *
 * @param props - 編集・削除が選ばれたときのコールバック
 * @returns ボトムシートに必要な状態とハンドラ
 */
export function useItemActionMenu({
  onEdit,
  onDelete,
}: UseItemActionMenuProps): UseItemActionMenuReturn {
  const { height: windowHeight } = useWindowDimensions();

  const [visible, setVisible] = useState(false);

  /* シートの定位置からの下向きのずれ（0で定位置） */
  const [translateY] = useState(() => new Animated.Value(0));

  /* iOSでシートが閉じ切るまで保留している操作 */
  const pendingActionRef = useRef<(() => void) | null>(null);

  /**
   * シートを開く
   *
   * @remarks
   * シートの高さは表示してから測るため、測る前の最初のフレームでシートが定位置に一瞬出ないよう、
   * 画面の高さ分だけ下（画面外）に置いてから表示する。せり上げは handleSheetLayout で始める。
   */
  const handleOpen = useCallback(() => {
    translateY.setValue(windowHeight);
    setVisible(true);
  }, [translateY, windowHeight]);

  /**
   * シートの高さが決まったら、シートの高さ分だけ下からせり上げる
   *
   * @remarks
   * 高さは文字の大きさの設定で変わるため、固定値にせず実際の高さを使う。
   */
  const handleSheetLayout = useCallback(
    (event: LayoutChangeEvent) => {
      translateY.setValue(event.nativeEvent.layout.height);
      Animated.timing(translateY, {
        toValue: 0,
        duration: SHEET_SLIDE_MS,
        useNativeDriver: true,
      }).start();
    },
    [translateY]
  );

  /**
   * 何も選ばずにシートを閉じる（キャンセル・外側のタップ・Androidの戻る操作）
   */
  const handleClose = useCallback(() => {
    setVisible(false);
  }, []);

  /**
   * シートを閉じてから操作を実行する
   *
   * @remarks
   * iOSでは、Modalが閉じている途中に編集画面（モーダル表示）へ遷移すると画面が開かないことがあるため、
   * 閉じ切ったことを知らせる onDismiss まで保留する。
   * AndroidのModalは onDismiss を呼ばず、閉じる途中の遷移やダイアログ表示も妨げないため、すぐに実行する。
   */
  const closeThenRun = useCallback((action: () => void) => {
    setVisible(false);
    if (Platform.OS === 'ios') {
      pendingActionRef.current = action;
      return;
    }
    action();
  }, []);

  /**
   * 「編集」が選ばれたとき
   */
  const handleSelectEdit = useCallback(() => {
    closeThenRun(onEdit);
  }, [closeThenRun, onEdit]);

  /**
   * 「削除」が選ばれたとき（確認ダイアログは呼び出し側が出す）
   */
  const handleSelectDelete = useCallback(() => {
    closeThenRun(onDelete);
  }, [closeThenRun, onDelete]);

  /**
   * シートが閉じ切ったとき（iOSのみ呼ばれる）に、保留していた操作を実行する
   */
  const handleDismiss = useCallback(() => {
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    action?.();
  }, []);

  return {
    visible,
    translateY,
    handleOpen,
    handleClose,
    handleSheetLayout,
    handleSelectEdit,
    handleSelectDelete,
    handleDismiss,
  };
}
