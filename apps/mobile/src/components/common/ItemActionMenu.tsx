/**
 * 一覧カードの「・・・」メニュー
 *
 * 定型文カードとショートカットカードの右上に置く「・・・」ボタンと、
 * 押したときにボタンの真下（入り切らなければ真上）へ出す「編集」「削除」のメニュー。
 * 背景は暗くせず、メニューの外側のタップとAndroidの戻る操作で閉じる。
 * 削除の確認ダイアログは呼び出し側が出す。
 *
 * 【読み上げラベルに項目名を含める理由】
 * 一覧ではカードごとに同じボタンが並ぶため、名前がないと読み上げでどのカードの操作か分からない。
 * E2Eテストもこのラベルでカードを特定する。ボタンはタイトルと同じ行にあり、
 * 「基準の要素より下にある対象」を探す TAP_NEAR では拾えないためである。
 *
 * @see src/hooks/components/useItemActionMenu.ts - 位置の計算と、選んだ操作の実行
 * @see src/components/snippet/SnippetCard.tsx - 使用元（定型文）
 * @see src/components/shortcut/ShortcutCard.tsx - 使用元（ショートカット）
 */

import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '@cliptap/shared';
import { useTheme } from '@lib/themeSystem';
import { UI_CONSTANTS } from '@constants/ui';
import {
  MENU_ITEM_HEIGHT,
  MENU_PADDING_VERTICAL,
  useItemActionMenu,
} from '@hooks/components/useItemActionMenu';

/** メニューの最小幅（pt）。項目名が短くても押しやすい幅を確保する */
const MENU_MIN_WIDTH = 160;

/* ========================================
   Props定義
   ======================================== */

/**
 * ItemActionMenuのProps
 * @property itemName - 操作対象の名前（読み上げラベルに使う）
 * @property onEdit - メニューで「編集」が選ばれたときに呼ぶ
 * @property onDelete - メニューで「削除」が選ばれたときに呼ぶ
 */
interface ItemActionMenuProps {
  itemName: string;
  onEdit: () => void;
  onDelete: () => void;
}

export function ItemActionMenu({ itemName, onEdit, onDelete }: ItemActionMenuProps) {
  const { t } = useTranslation();
  const { colors, isTablet, responsiveFontSizes } = useTheme();

  /* フックからロジックを取得 */
  const {
    triggerRef,
    visible,
    position,
    handleOpen,
    handleClose,
    handleSelectEdit,
    handleSelectDelete,
    handleDismiss,
  } = useItemActionMenu({ onEdit, onDelete });

  return (
    <>
      {/* 「・・・」ボタン（アイコンは小さいため、タップ領域をhitSlopで44pt以上に広げる）。
          accessibilityRole は付けない。E2Eテストは role=button のラベル付き要素を定型文タイトルの並びとして確かめており、
          付けるとタイトルとこのボタンが交互に並んで並び順の確認が壊れる（アプリの他のアイコンボタンも役割を付けていない） */}
      <TouchableOpacity
        ref={triggerRef}
        onPress={handleOpen}
        hitSlop={UI_CONSTANTS.HIT_SLOP.LARGE}
        accessibilityLabel={t('common.more_actions', { name: itemName })}
      >
        <Ionicons
          name="ellipsis-horizontal"
          size={isTablet ? UI_CONSTANTS.ICON_SIZE.MD : UI_CONSTANTS.ICON_SIZE.SM}
          color={colors.textSecondary}
        />
      </TouchableOpacity>

      {/* メニュー。アニメーションは100ms以内の規約に収めるため付けない。
          Androidは edge-to-edge が有効なため、statusBarTranslucent を付けなくてもModalが全画面になり、
          measureInWindow で測った座標と揃う（付けると edge-to-edge を切ったときにステータスバーの分ずれる） */}
      <Modal
        visible={visible}
        transparent
        animationType="none"
        onRequestClose={handleClose}
        onDismiss={handleDismiss}
      >
        {/* 背景（色は付けない。タップで閉じる） */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        />

        {/* メニュー本体（ボタンの右端に揃えて、真下または真上に置く） */}
        <View
          style={[
            styles.menu,
            position,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.border,
              shadowColor: colors.shadow,
            },
          ]}
        >
          {/* 編集（カードにあった編集ボタンと同じ鉛筆のアイコン） */}
          <TouchableOpacity
            style={styles.item}
            onPress={handleSelectEdit}
            accessibilityRole="button"
            accessibilityLabel={t('common.edit')}
          >
            <Ionicons name="create-outline" size={UI_CONSTANTS.ICON_SIZE.SM} color={colors.text} />
            <Text
              style={[styles.itemText, { color: colors.text, fontSize: responsiveFontSizes.base }]}
              numberOfLines={UI_CONSTANTS.NUMBER_OF_LINES.SINGLE}
            >
              {t('common.edit')}
            </Text>
          </TouchableOpacity>

          {/* 削除（取り消せない操作のため、一番下に赤字で置く。アイコンもゴミ箱を同じ赤で出す） */}
          <TouchableOpacity
            style={styles.item}
            onPress={handleSelectDelete}
            accessibilityRole="button"
            accessibilityLabel={t('common.delete')}
          >
            <Ionicons name="trash-outline" size={UI_CONSTANTS.ICON_SIZE.SM} color={colors.danger} />
            <Text
              style={[styles.itemText, { color: colors.danger, fontSize: responsiveFontSizes.base }]}
              numberOfLines={UI_CONSTANTS.NUMBER_OF_LINES.SINGLE}
            >
              {t('common.delete')}
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  /** メニュー本体（位置・背景色・枠線の色・影の色は使用箇所で重ねる） */
  menu: {
    position: 'absolute',
    minWidth: MENU_MIN_WIDTH,
    paddingVertical: MENU_PADDING_VERTICAL,
    borderRadius: UI_CONSTANTS.BORDER_RADIUS.MD,
    borderWidth: UI_CONSTANTS.BORDER_WIDTH.THIN,
    /* 背景を暗くしないため、影で一覧から浮かせる */
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  /* アイコンと項目名を横に並べる（並べ替えメニュー SortMenu.option と同じ間隔） */
  item: {
    minHeight: MENU_ITEM_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: UI_CONSTANTS.GAP.MD,
    paddingHorizontal: UI_CONSTANTS.SPACING.LG,
  },
  itemText: {
    fontWeight: UI_CONSTANTS.FONT_WEIGHT.MEDIUM,
  },
});
