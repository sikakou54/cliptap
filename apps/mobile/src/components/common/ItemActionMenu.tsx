/**
 * 一覧カードの「・・・」メニュー
 *
 * 定型文カードとショートカットカードの右上に置く「・・・」ボタンと、
 * 押したときに画面の下から出す「編集」「削除」「キャンセル」のボトムシート。
 * 開くときは下からせり上げる（100ms）。
 * キャンセル、シートの外側のタップ、Androidの戻る操作で閉じる。
 * 削除の確認ダイアログは呼び出し側が出す。
 *
 * 【読み上げラベルに項目名を含める理由】
 * 一覧ではカードごとに同じボタンが並ぶため、名前がないと読み上げでどのカードの操作か分からない。
 * E2Eテストもこのラベルでカードを特定する。ボタンはタイトルと同じ行にあり、
 * 「基準の要素より下にある対象」を探す TAP_NEAR では拾えないためである。
 *
 * 【背景を暗くしない理由】
 * シートの後ろに色を付けた全面の層を置くと、iOSシミュレータで、同じ起動中に2回目以降に開いたシートの項目が
 * アクセシビリティツリーに出なくなり、E2Eテストが項目を見つけられなかった。
 * 色の層を押せない別の層に分けても同じで、色を付けなければ出る（2026-09-14 に確認。原因は未特定）。
 * そのため背景は透明のままにし、シートは上端の影で一覧から浮かせる。
 *
 * @see src/hooks/components/useItemActionMenu.ts - シートの開閉とせり上げ、選んだ操作の実行
 * @see src/components/snippet/SnippetCard.tsx - 使用元（定型文）
 * @see src/components/shortcut/ShortcutCard.tsx - 使用元（ショートカット）
 */

import { Animated, Modal, Pressable, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '@cliptap/shared';
import { useTheme } from '@lib/themeSystem';
import { UI_CONSTANTS } from '@constants/ui';
import { useItemActionMenu } from '@hooks/components/useItemActionMenu';

/* ========================================
   Props定義
   ======================================== */

/**
 * ItemActionMenuのProps
 * @property itemName - 操作対象の名前（読み上げラベルに使う）
 * @property onEdit - シートで「編集」が選ばれたときに呼ぶ
 * @property onDelete - シートで「削除」が選ばれたときに呼ぶ
 */
interface ItemActionMenuProps {
  itemName: string;
  onEdit: () => void;
  onDelete: () => void;
}

export function ItemActionMenu({ itemName, onEdit, onDelete }: ItemActionMenuProps) {
  const { t } = useTranslation();
  const { colors, isTablet, responsiveFontSizes } = useTheme();

  /* シートの下端をホームインジケータ・ナビゲーションバーに重ねないための下インセット。
     RNのModalはウィンドウ全体を覆うため、ウィンドウのインセットがそのまま使える */
  const insets = useSafeAreaInsets();

  /* フックからロジックを取得 */
  const {
    visible,
    translateY,
    handleOpen,
    handleClose,
    handleSheetLayout,
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

      {/* ボトムシート。せり上げはフック側で100ms以内に動かすため、Modal自体のアニメーションは付けない
          （Modalの slide は約0.3秒かかり、規約の100msを超える） */}
      <Modal
        visible={visible}
        transparent
        animationType="none"
        onRequestClose={handleClose}
        onDismiss={handleDismiss}
      >
        {/* シートの外側のタップで閉じる層（色は付けない。理由は冒頭のコメント） */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
        />

        {/* シート本体（画面の下端に置き、下からせり上げる） */}
        <Animated.View
          onLayout={handleSheetLayout}
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              shadowColor: colors.shadow,
              paddingBottom: insets.bottom + UI_CONSTANTS.SPACING.SM,
              transform: [{ translateY }],
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

          {/* 削除（取り消せない操作のため、操作の項目の一番下に赤字で置く。アイコンもゴミ箱を同じ赤で出す） */}
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

          {/* キャンセル（何もせず閉じる。区切り線で操作の項目と分け、中央に置く） */}
          <TouchableOpacity
            style={[styles.item, styles.cancelItem, { borderTopColor: colors.border }]}
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
          >
            <Text
              style={[styles.itemText, { color: colors.text, fontSize: responsiveFontSizes.base }]}
              numberOfLines={UI_CONSTANTS.NUMBER_OF_LINES.SINGLE}
            >
              {t('common.cancel')}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  /**
   * シート本体。画面の下端に固定する（背景色・影の色・下の余白・せり上げの位置は使用箇所で重ねる）
   * 背景を暗くしないため、上端の影で一覧から浮かせる
   */
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: UI_CONSTANTS.SPACING.SM,
    borderTopLeftRadius: UI_CONSTANTS.BORDER_RADIUS.XXL,
    borderTopRightRadius: UI_CONSTANTS.BORDER_RADIUS.XXL,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 16,
  },
  /* アイコンと項目名を横に並べる（並べ替えメニュー SortMenu.option と同じ間隔） */
  item: {
    minHeight: UI_CONSTANTS.BUTTON_HEIGHT.LARGE,
    flexDirection: 'row',
    alignItems: 'center',
    gap: UI_CONSTANTS.GAP.MD,
    paddingHorizontal: UI_CONSTANTS.SPACING.LG,
  },
  /** キャンセル（区切り線の色は使用箇所で重ねる） */
  cancelItem: {
    justifyContent: 'center',
    borderTopWidth: UI_CONSTANTS.BORDER_WIDTH.THIN,
  },
  itemText: {
    fontWeight: UI_CONSTANTS.FONT_WEIGHT.MEDIUM,
  },
});
