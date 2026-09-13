/**
 * ソートメニューコンポーネント
 *
 * スニペット一覧のソート順を変更するアイコンボタン。
 * カテゴリフィルターの「すべて」の左隣に配置され、タップでモーダルを開いて変更可能。
 * デフォルト以外のソートが選択されている時はバッジを表示。
 *
 * ソートオプション:
 * - created: 作成日時順（デフォルト）
 * - recent: 更新日時順
 * - title: タイトル順（アルファベット/あいうえお順）
 * - usage: 使用頻度順（コピー回数が多い順）
 *
 * @see app/index.tsx - メイン画面での使用例
 */

import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '@cliptap/shared';
import { useTheme } from '@lib/themeSystem';
import { SnippetSortBy } from '@cliptap/shared';
import { UI_CONSTANTS } from '@constants/ui';
import { useSortMenu } from '@hooks/components/useSortMenu';

/* ========================================
   Props定義
   ======================================== */

/**
 * SortMenuのProps
 * @property currentSort - 現在のソート順
 * @property onSortChange - ソート順変更時のコールバック
 */
interface SortMenuProps {
  currentSort: SnippetSortBy;
  onSortChange: (sort: SnippetSortBy) => void;
  /** 名前で並べ替える選択肢のラベル（省略時は定型文の「タイトル」） */
  nameSortLabel?: string;
}

export function SortMenu({ currentSort, onSortChange, nameSortLabel }: SortMenuProps) {
  const { t } = useTranslation();
  const { colors, responsiveFontSizes, responsiveLineHeights } = useTheme();

  /* フックからロジックを取得 */
  const {
    visible,
    sortOptions,
    isDefaultSort,
    handlePress,
    handleSelect,
    handleClose,
  } = useSortMenu({ currentSort, onSortChange, nameSortLabel });

  return (
    <>
      {/* ソートボタン（アイコンのみ、カテゴリチップと同じ高さ） */}
      <TouchableOpacity
        style={[
          styles.button,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
        onPress={handlePress}
      >
        {/* ソートアイコン */}
        <Ionicons
          name="swap-vertical-outline"
          size={20}
          color={colors.text}
        />
        {/* バッジ（デフォルト以外のソートが選択されている時） */}
        {!isDefaultSort && (
          <View style={[styles.badge, { backgroundColor: colors.primary }]} />
        )}
      </TouchableOpacity>

      {/* ソート選択モーダル */}
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
      >
        {/* オーバーレイ（背景タップで閉じる） */}
        <Pressable style={[styles.overlay, { backgroundColor: colors.overlay }]} onPress={handleClose}>
          {/* モーダルコンテンツ */}
          <Pressable style={[styles.modal, { backgroundColor: colors.surface, shadowColor: colors.shadow }]} onPress={(e) => e.stopPropagation()}>
            {/* モーダルタイトル */}
            <Text style={[styles.modalTitle, { color: colors.text, fontSize: responsiveFontSizes.lg, lineHeight: responsiveLineHeights.lg }]}>
              {t('sort.title')}
            </Text>
            {/* ソートオプション一覧 */}
            {sortOptions.map((option, index) => {
              const optionColor = currentSort === option.value
                ? colors.primary
                : colors.text;

              return (
                <View key={option.value}>
                  <TouchableOpacity
                    style={[
                      styles.option,
                      index < sortOptions.length - 1 && styles.optionBorder,
                      { borderBottomColor: colors.border },
                    ]}
                    onPress={() => handleSelect(option.value)}
                  >
                    {/* オプションアイコン */}
                    <Ionicons name={option.icon} size={22} color={optionColor} />
                    {/* オプションラベル */}
                    <Text
                      style={[
                        styles.optionText,
                        {
                          color: optionColor,
                          fontSize: responsiveFontSizes.base,
                          lineHeight: responsiveLineHeights.base,
                        },
                      ]}
                    >
                      {option.label}
                    </Text>
                    {/* 選択中のチェックマーク */}
                    {currentSort === option.value && (
                      <Ionicons name="checkmark" size={22} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: UI_CONSTANTS.GAP.BASE,
    paddingVertical: UI_CONSTANTS.GAP.SM,
    borderRadius: UI_CONSTANTS.BORDER_RADIUS.XL,
    borderWidth: UI_CONSTANTS.BORDER_WIDTH.THIN,
    height: UI_CONSTANTS.SIZE.ICON_CONTAINER_MD,
    minWidth: UI_CONSTANTS.SIZE.ICON_CONTAINER_MD,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 100,
  },
  /** オーバーレイ（背景色は使用箇所でテーマの overlay を重ねる） */
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  /** モーダル本体（背景色と影の色は使用箇所でテーマから重ねる） */
  modal: {
    width: '80%',
    maxWidth: 360,
    borderRadius: UI_CONSTANTS.BORDER_RADIUS.LG,
    padding: UI_CONSTANTS.SPACING.LG,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontWeight: UI_CONSTANTS.FONT_WEIGHT.BOLD,
    marginBottom: UI_CONSTANTS.GAP.LG,
    textAlign: 'center',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: UI_CONSTANTS.GAP.MD,
    paddingVertical: UI_CONSTANTS.GAP.LG,
  },
  optionBorder: {
    borderBottomWidth: UI_CONSTANTS.BORDER_WIDTH.THIN,
  },
  optionText: {
    flex: 1,
    fontWeight: UI_CONSTANTS.FONT_WEIGHT.MEDIUM,
  },
});
