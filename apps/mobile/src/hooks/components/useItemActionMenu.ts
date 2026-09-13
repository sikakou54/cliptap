/**
 * 一覧カードの「・・・」メニューのロジックフック
 *
 * 押された「・・・」ボタンの位置を測り、その真下（入り切らなければ真上）にメニューを出す。
 * 項目が選ばれたら、メニューを閉じてから編集・削除を実行する。
 *
 * @see components/common/ItemActionMenu.tsx - UIコンポーネント
 */

import { useCallback, useRef, useState, type RefObject } from 'react';
import { Platform, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UI_CONSTANTS } from '@constants/ui';

/* ========================================
   定数
   ======================================== */

/** メニュー項目1つの高さ（pt）。タップ領域の最小44ptに合わせる */
export const MENU_ITEM_HEIGHT = 44;

/** メニューの上下の内側の余白（pt） */
export const MENU_PADDING_VERTICAL = UI_CONSTANTS.GAP.XS;

/** 「・・・」ボタンとメニューの間の距離（pt） */
const MENU_GAP = UI_CONSTANTS.GAP.XS;

/**
 * メニューの高さの見積もり（pt）
 *
 * 下に入り切るかの判定にだけ使う。項目2つと上下の余白、枠線から求める。
 * 文字を大きくして実際の高さがこれを超えても、上に出すときは下端を基準に置くため、
 * メニューがボタンに重なることはない。
 */
const MENU_HEIGHT_ESTIMATE =
  MENU_ITEM_HEIGHT * 2 + MENU_PADDING_VERTICAL * 2 + UI_CONSTANTS.BORDER_WIDTH.THIN * 2;

/* ========================================
   型定義
   ======================================== */

/**
 * メニューの表示位置（Modalの中での絶対配置の値）
 * @property top - 下に出すときの上端（上に出すときは持たない）
 * @property bottom - 上に出すときの下端（下に出すときは持たない）
 * @property right - 右端。「・・・」ボタンの右端に揃える
 */
export interface MenuPosition {
  top?: number;
  bottom?: number;
  right: number;
}

/**
 * useItemActionMenuのProps
 * @property onEdit - メニューで「編集」が選ばれたときに呼ぶ
 * @property onDelete - メニューで「削除」が選ばれたときに呼ぶ
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
  triggerRef: RefObject<View | null>;
  visible: boolean;
  position: MenuPosition;

  /* ハンドラ */
  handleOpen: () => void;
  handleClose: () => void;
  handleSelectEdit: () => void;
  handleSelectDelete: () => void;
  handleDismiss: () => void;
}

/**
 * 一覧カードの「・・・」メニューのロジックフック
 *
 * @param props - 編集・削除が選ばれたときのコールバック
 * @returns メニューに必要な状態とハンドラ
 */
export function useItemActionMenu({
  onEdit,
  onDelete,
}: UseItemActionMenuProps): UseItemActionMenuReturn {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const triggerRef = useRef<View>(null);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<MenuPosition>({ right: 0 });

  /* iOSでメニューが閉じ切るまで保留している操作 */
  const pendingActionRef = useRef<(() => void) | null>(null);

  /**
   * ボタンの位置を測ってメニューを開く
   */
  const handleOpen = useCallback(() => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      const right = windowWidth - (x + width);
      const top = y + height + MENU_GAP;
      /* 画面下端のカードでは、ホームインジケータにかからない範囲に入り切るかで上下を決める */
      const fitsBelow =
        top + MENU_HEIGHT_ESTIMATE <= windowHeight - insets.bottom - UI_CONSTANTS.GAP.MD;

      setPosition(fitsBelow ? { top, right } : { bottom: windowHeight - y + MENU_GAP, right });
      setVisible(true);
    });
  }, [windowWidth, windowHeight, insets.bottom]);

  /**
   * 何も選ばずにメニューを閉じる（外側のタップ・Androidの戻る操作）
   */
  const handleClose = useCallback(() => {
    setVisible(false);
  }, []);

  /**
   * メニューを閉じてから操作を実行する
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
   * メニューが閉じ切ったとき（iOSのみ呼ばれる）に、保留していた操作を実行する
   */
  const handleDismiss = useCallback(() => {
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    action?.();
  }, []);

  return {
    triggerRef,
    visible,
    position,
    handleOpen,
    handleClose,
    handleSelectEdit,
    handleSelectDelete,
    handleDismiss,
  };
}
