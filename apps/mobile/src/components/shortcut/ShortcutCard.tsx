/**
 * ショートカットカード
 *
 * 1件のショートカットを表すカード。定型文カード（SnippetCard）と同じ見た目・操作に揃える。
 * 値のブロックはタップでその値だけをクリップボードへコピーする。
 *
 * 【値のブロックだけをタップ対象にする理由】
 * カードの中に「タップでコピー」する値があるため、カード全体もタップ対象にすると
 * どちらが起きるのか押す前に分からない。編集と削除は右上の「・・・」メニューに寄せる。
 *
 * 【コピーアイコンを値の文字の末尾に置く理由】
 * 定型文カードのタイトルと同じ形に揃える。値の右端へ寄せると、短い値のときに
 * アイコンだけが離れて浮き、どの文字に対する操作なのか読み取りにくくなる。
 *
 * 【コピー完了の表示をカードが持つ理由】
 * 1ショートカットにつき値は1つのため、押された行を識別子で見分ける必要がない。
 * 完了表示（2秒）と処理中フラグはこのカードが1組だけ持つ。
 *
 * @see apps/mobile/src/components/snippet/SnippetCard.tsx - 定型文側の同じ役割のコンポーネント
 * @see apps/mobile/src/components/shortcut/ShortcutList.tsx - 使用元
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '@cliptap/shared';
import { useTheme } from '@lib/themeSystem';
import { type Category, type Shortcut, type ShortcutWithDisplay } from '@cliptap/shared';
import { CategoryBadge } from '@components/category/CategoryBadge';
import { ItemActionMenu } from '@components/common/ItemActionMenu';
import { UI_CONSTANTS } from '@constants/ui';

/**
 * 値のブロックの上下の余白（pt）
 *
 * タップ対象としての高さをここで確保する。値の行高（スマートフォンで21pt）に
 * この余白の2倍を足して、最小タップ領域の44ptを下回らないこと（12×2+21=45pt）。
 */
const VALUE_VERTICAL_PADDING = UI_CONSTANTS.SPACING.BASE;

/* ========================================
   Props定義
   ======================================== */

/**
 * ShortcutCardのProps
 * @property shortcut - 表示するショートカット（値は表示中のプロファイルで展開した文字列を持つ）
 * @property category - 所属カテゴリ（未分類ならnull）
 * @property onCopy - 値がタップされたときのコールバック（クリップボードへコピー）
 * @property onEdit - メニューで「編集」が選ばれたときのコールバック
 * @property onDelete - メニューで「削除」が選ばれたときのコールバック（確認ダイアログは呼び出し側が出す）
 * @property isLast - 一覧の最後の項目か（区切り線を引くかの判定に使う）
 */
interface ShortcutCardProps {
  shortcut: ShortcutWithDisplay;
  category: Category | null;
  onCopy: (shortcut: Shortcut) => Promise<void>;
  onEdit: (shortcut: Shortcut) => void;
  onDelete: (shortcut: Shortcut) => void;
  isLast: boolean;
}

function ShortcutCardComponent({
  shortcut,
  category,
  onCopy,
  onEdit,
  onDelete,
  isLast,
}: ShortcutCardProps) {
  const { t } = useTranslation();
  const { colors, isTablet, responsive, responsiveFontSizes, responsiveLineHeights } = useTheme();

  /** コピー完了アイコンを出しているか */
  const [isCopied, setIsCopied] = useState(false);
  /** コピー処理中か（連打で二重にコピーしないため） */
  const [isCopying, setIsCopying] = useState(false);

  /**
   * コピー完了アイコンの自動リセット
   *
   * クリーンアップでタイマーを解除するのは、アンマウント後や次のコピーでフラグが
   * 立ち直した後に、前回のタイマーが発火して表示を戻してしまわないようにするため。
   */
  useEffect(() => {
    if (!isCopied) return;

    const timeoutId = setTimeout(() => {
      setIsCopied(false);
    }, UI_CONSTANTS.COPY_SUCCESS_DURATION_MS);

    return () => clearTimeout(timeoutId);
  }, [isCopied]);

  const handleCopyPress = useCallback(async () => {
    if (isCopying) return;
    setIsCopying(true);

    try {
      await onCopy(shortcut);
      setIsCopied(true);
    } catch {
      setIsCopied(false);
    } finally {
      setIsCopying(false);
    }
  }, [isCopying, onCopy, shortcut]);

  return (
    <View
      style={[
        styles.card,
        /* 区切り線は項目と項目の間にだけ引く。最後にも引くと一覧の終わりに線が残り、
           下の余白や広告と切り離されて見える */
        !isLast && { borderBottomWidth: UI_CONSTANTS.BORDER_WIDTH.THIN, borderBottomColor: colors.border },
      ]}
    >
      <View style={[styles.mainContent, { padding: responsive.card.padding }]}>
        {/* 名前の行。ショートカット名と、右端の「・・・」メニュー */}
        <View style={styles.nameRow}>
          {/* ショートカット名 */}
          <Text
            style={[
              styles.name,
              {
                color: colors.text,
                fontSize: responsiveFontSizes.base,
              },
            ]}
            numberOfLines={UI_CONSTANTS.NUMBER_OF_LINES.SINGLE}
            ellipsizeMode="tail"
          >
            {shortcut.name}
          </Text>

          {/* 「・・・」メニュー（編集・削除） */}
          <ItemActionMenu
            itemName={shortcut.name}
            onEdit={() => onEdit(shortcut)}
            onDelete={() => onDelete(shortcut)}
          />
        </View>

        {/* カテゴリバッジ */}
        {category !== null && (
          <View style={styles.categoryBadgeContainer}>
            <CategoryBadge category={category} size="small" />
          </View>
        )}

        {/* 登録されている値（タップでコピーする） */}
        <TouchableOpacity
          style={styles.valueRow}
          onPress={handleCopyPress}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`${shortcut.name} ${t('common.copy')}`}
        >
          {/* 挿入・コピーされる値。変数トークンは表示中のプロファイルで展開して見せる。
              住所のような長い値でも全体を確かめてからコピーできるよう、行数を制限せず折り返す。
              コピーアイコンは値の文字の末尾へ続けて置くため、同じText内に入れる
              （別のViewに出すと折り返した最終行から離れてしまう） */}
          <Text
            style={[
              styles.valueText,
              {
                color: colors.textSecondary,
                fontSize: responsiveFontSizes.sm,
                lineHeight: responsiveLineHeights.sm,
              },
            ]}
          >
            {shortcut.displayValue}
            {/* 文字とアイコンの間隔は空白で作る。Textの中に置いたアイコンには余白の指定が効かない */}
            {' '}
            <Ionicons
              name={isCopied ? 'checkmark' : 'copy-outline'}
              size={isTablet ? 18 : 14}
              color={isCopied ? colors.success : colors.textSecondary}
            />
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/**
 * メモ化されたショートカットカード
 *
 * FlashList のパフォーマンス最適化のため、表示に効く値が変わったときだけ再描画する。
 */
export const ShortcutCard = React.memo(ShortcutCardComponent, (prevProps, nextProps) => {
  return (
    prevProps.shortcut.id === nextProps.shortcut.id &&
    prevProps.isLast === nextProps.isLast &&
    prevProps.shortcut.updatedAt === nextProps.shortcut.updatedAt &&
    prevProps.shortcut.name === nextProps.shortcut.name &&
    prevProps.shortcut.categoryId === nextProps.shortcut.categoryId &&
    /* 展開結果はプロファイルの切替や日付の変化で変わる。ここを見ないと古い表示が残る */
    prevProps.shortcut.displayValue === nextProps.shortcut.displayValue &&
    prevProps.category?.id === nextProps.category?.id
  );
});

const styles = StyleSheet.create({
  /* フラットデザイン。カードの枠・角丸・下地を持たず、下端の区切り線だけで項目を分ける
     （定型文カード SnippetCard.card と同じ扱い） */
  card: {
    overflow: 'hidden',
  },
  mainContent: {
    gap: UI_CONSTANTS.GAP.SM,
  },
  /* 名前と「・・・」メニューを横に並べる（定型文カード SnippetCard.titleRow と同じ間隔） */
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: UI_CONSTANTS.GAP.LG,
  },
  name: {
    flex: 1,
    fontWeight: UI_CONSTANTS.FONT_WEIGHT.SEMIBOLD,
  },
  categoryBadgeContainer: {
    marginTop: UI_CONSTANTS.GAP.XS,
  },
  /* 値のブロック全体をタップ対象にする。高さは上下の余白で確保する */
  valueRow: {
    paddingVertical: VALUE_VERTICAL_PADDING,
  },
  valueText: {
    fontFamily: 'monospace',
  },
});
