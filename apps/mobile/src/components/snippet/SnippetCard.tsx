/**
 * スニペットカードコンポーネント
 *
 * 一覧画面で表示される個別のスニペットカード。
 * 右下のコピーボタンで本文を、タイトルのタップでタイトルだけをコピーする。
 * 本文のタップと左下の展開ボタンで展開し、右上の「・・・」メニューから編集・削除する。
 *
 * 主な機能:
 * - ワンタップコピー（触覚フィードバック付き）
 * - コンテンツの展開/折りたたみ
 * - 変数の自動解決（{{変数名}} → 実際の値）
 * - カテゴリバッジ表示
 * - 右上の「・・・」メニューからの編集・削除
 *
 * パフォーマンス最適化:
 * - React.memoによるメモ化
 * - カスタム比較関数で不要な再レンダリングを防止
 *
 * @see SnippetList - 親コンポーネント
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@lib/themeSystem';
import { useTranslation } from '@cliptap/shared';
import { SnippetWithDisplay, Category } from '@cliptap/shared';
import { CategoryBadge } from '@components/category/CategoryBadge';
import { ItemActionMenu } from '@components/common/ItemActionMenu';
import { UI_CONSTANTS } from '@constants/ui';
import { useSnippetCard } from '@hooks/components/useSnippetCard';

/**
 * SnippetCardのProps
 * @property snippet - 表示するスニペットデータ
 * @property onPress - タップ時のコールバック（コピー処理）
 * @property onEdit - メニューで「編集」が選ばれたときのコールバック
 * @property onDelete - メニューで「削除」が選ばれ、確認ダイアログでOKされたときのコールバック
 * @property onPressTitle - タイトルタップ時のコールバック（タイトルのみコピー、省略可）
 * @property disableCopy - コピー機能を無効化（省略可、デフォルト: false）
 * @property category - カテゴリオブジェクト（省略可：親から渡される場合、パフォーマンス最適化のため）
 */
interface SnippetCardProps {
  snippet: SnippetWithDisplay;
  onPress: (snippet: SnippetWithDisplay) => void | Promise<void>;
  onEdit: (snippet: SnippetWithDisplay) => void;
  onDelete: (snippet: SnippetWithDisplay) => void;
  onPressTitle?: (snippet: SnippetWithDisplay) => void | Promise<void>;
  disableCopy?: boolean;
  category?: Category | null;
  /** 一覧の最後の項目か（区切り線を引くかの判定に使う） */
  isLast: boolean;
}

const SnippetCardComponent = ({
  snippet,
  onPress,
  onEdit,
  onDelete,
  onPressTitle,
  disableCopy = false,
  category: categoryProp,
  isLast,
}: SnippetCardProps) => {
  const { colors, isTablet, responsive, responsiveFontSizes, responsiveLineHeights } = useTheme();
  const { t } = useTranslation();

  /* フックからロジックを取得 */
  const {
    isCopying,
    isCopied,
    isCopyingTitle,
    isTitleCopied,
    canCopyTitle,
    isExpanded,
    category,
    displayTitle,
    displayContent,
    handleCopy,
    handleCopyTitle,
    handleDelete,
    handleEdit,
    toggleExpanded,
  } = useSnippetCard({
    snippet,
    onPress,
    onEdit,
    onDelete,
    onPressTitle,
    categoryProp,
  });

  /* タイトルタップでコピーできるか（タイトルなし・コピー無効時は通常のテキスト表示に戻す） */
  const isTitleCopyEnabled = canCopyTitle && !disableCopy;

  return (
    <View
      style={[
        styles.card,
        /* 区切り線は項目と項目の間にだけ引く。最後にも引くと一覧の終わりに線が残り、
           下の余白や広告と切り離されて見える */
        !isLast && { borderBottomWidth: UI_CONSTANTS.BORDER_WIDTH.THIN, borderBottomColor: colors.border },
      ]}
    >
      {/* メインコンテンツエリア */}
      <View style={[
        styles.mainContent,
        {
          padding: responsive.card.padding,
          paddingBottom: 60,
        }
      ]}>
        {/* タイトル行。タイトルと、右端の「・・・」メニュー */}
        <View style={styles.titleRow}>
          {/* タイトル（タップでタイトルのみをコピー） */}
          <TouchableOpacity
            style={styles.titleContainer}
            onPress={handleCopyTitle}
            disabled={!isTitleCopyEnabled || isCopyingTitle}
            activeOpacity={isTitleCopyEnabled ? 0.7 : 1}
            hitSlop={UI_CONSTANTS.HIT_SLOP.SMALL}
            /* TouchableOpacityはラベルを与えると子のテキストを読み上げなくなるため、
               ラベルはタイトル本文のままにし、コピー操作はヒントで補足する */
            accessibilityRole={isTitleCopyEnabled ? 'button' : undefined}
            accessibilityLabel={displayTitle}
            accessibilityHint={isTitleCopyEnabled ? t('snippet.copy_title') : undefined}
          >
            <Text
              style={[
                styles.title,
                {
                  color: colors.text,
                  fontSize: responsiveFontSizes.base,
                }
              ]}
              numberOfLines={UI_CONSTANTS.NUMBER_OF_LINES.SINGLE}
              ellipsizeMode="tail"
            >
              {displayTitle}
            </Text>

            {/* コピーアイコン（タップでコピーできることを示す。コピー完了時は2秒間チェックマーク） */}
            {isTitleCopyEnabled && (
              <Ionicons
                name={isTitleCopied ? 'checkmark' : 'copy-outline'}
                size={isTablet ? 18 : 14}
                color={isTitleCopied ? colors.success : colors.textSecondary}
                style={styles.titleCopyIcon}
              />
            )}
          </TouchableOpacity>

          {/* 「・・・」メニュー（編集・削除）。タイトルのコピー操作と混ざらないよう、タイトルのタップ領域の外に置く */}
          <ItemActionMenu itemName={displayTitle} onEdit={handleEdit} onDelete={handleDelete} />
        </View>

        {/* カテゴリバッジ */}
        {category && (
          <View style={styles.categoryBadgeContainer}>
            <CategoryBadge category={category} size="small" />
          </View>
        )}

        <TouchableOpacity
          onPress={toggleExpanded}
          activeOpacity={0.7}
          style={[
            styles.contentWrapper,
            !isExpanded && {
              minHeight: isTablet ? 68 : 60,
            }
          ]}
        >
          <Text
            style={[
              styles.content,
              {
                color: colors.textSecondary,
                fontSize: responsiveFontSizes.sm,
                lineHeight: responsiveLineHeights.sm,
              }
            ]}
            numberOfLines={isExpanded ? undefined : UI_CONSTANTS.NUMBER_OF_LINES.DOUBLE}
            ellipsizeMode="tail"
          >
            {displayContent}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 展開ボタン */}
      <TouchableOpacity
        style={[
          styles.roundButton,
          {
            position: 'absolute',
            left: UI_CONSTANTS.GAP.MD,
            bottom: UI_CONSTANTS.GAP.MD,
            borderColor: colors.border,
          }
        ]}
        onPress={toggleExpanded}
        activeOpacity={0.7}
      >
        <Ionicons
          name={isExpanded ? "chevron-up" : "chevron-down"}
          size={isTablet ? 22 : 18}
          color={colors.textSecondary}
        />
      </TouchableOpacity>

      {/* コピーボタン */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[
            styles.roundButton,
            { borderColor: isCopied ? colors.success : colors.primary },
            /* 無効時は枠線を中立色へ戻す。style配列は後勝ちのため、上の borderColor より後ろに置く */
            disableCopy && [styles.disabledButton, { borderColor: colors.border }]
          ]}
          onPress={handleCopy}
          disabled={isCopying || disableCopy}
        >
          <Ionicons
            name={isCopied ? "checkmark" : "copy-outline"}
            size={isTablet ? 22 : 18}
            color={disableCopy ? colors.textSecondary : (isCopied ? colors.success : colors.primary)}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

/**
 * SnippetCard をメモ化して不要な再レンダリングを防ぐ
 * FlashList のパフォーマンス最適化のため
 *
 * カスタム比較関数でsnippetの主要プロパティとその他のPropsを比較
 * すべて変更なしの場合のみ再レンダリングをスキップ
 */
export const SnippetCard = React.memo(SnippetCardComponent, (prevProps, nextProps) => {
  return (
    prevProps.snippet.id === nextProps.snippet.id &&
    prevProps.isLast === nextProps.isLast &&
    prevProps.snippet.updatedAt === nextProps.snippet.updatedAt &&
    prevProps.snippet.title === nextProps.snippet.title &&
    prevProps.snippet.content === nextProps.snippet.content &&
    prevProps.snippet.categoryId === nextProps.snippet.categoryId &&
    prevProps.snippet.displayTitle === nextProps.snippet.displayTitle &&
    prevProps.snippet.displayContent === nextProps.snippet.displayContent &&
    prevProps.disableCopy === nextProps.disableCopy &&
    prevProps.category?.id === nextProps.category?.id
  );
});

const styles = StyleSheet.create({
  /* フラットデザイン。カードの枠・角丸・下地を持たず、下端の区切り線だけで項目を分ける */
  card: {
    overflow: 'hidden',
  },
  mainContent: {
    gap: UI_CONSTANTS.GAP.SM,
  },
  /* タイトルと「・・・」メニューを横に並べる。長いタイトルではコピーアイコンが「・・・」に近づくため、間を空けて押し間違えにくくする */
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: UI_CONSTANTS.GAP.LG,
  },
  /* タップ領域は行いっぱいのまま（タイトルの右の空いた所を押してもタイトルをコピーする） */
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  /* 行いっぱいに伸ばさず文字の幅に留め、コピーアイコンをタイトルの末尾に付ける。
     長いタイトルは縮めて末尾を省略し、アイコンは残す */
  title: {
    flexShrink: 1,
    fontWeight: UI_CONSTANTS.FONT_WEIGHT.SEMIBOLD,
  },
  titleCopyIcon: {
    marginLeft: UI_CONSTANTS.GAP.XS,
  },
  categoryBadgeContainer: {
    marginTop: UI_CONSTANTS.GAP.XS,
  },
  contentWrapper: {
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
  },
  actionButtons: {
    position: 'absolute',
    right: UI_CONSTANTS.GAP.MD,
    bottom: UI_CONSTANTS.GAP.MD,
    flexDirection: 'row',
    gap: UI_CONSTANTS.GAP.SM,
  },
  roundButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    opacity: 0.4,
  },
});
