/**
 * ショートカット値の1行
 *
 * 値名を上、値を下に重ねて表示し、タップするとその値だけをクリップボードへコピーする。
 *
 * 【横並びにしない理由】
 * 値は電話番号や住所など長さがまちまちで、横に並べると値名の欄幅に引きずられて
 * 値が途中で切れる。縦に積めば値へ幅をすべて使える。
 *
 * 【行ごとにコンポーネントを分ける理由】
 * コピー完了の表示は押された行だけに出したい。一覧側で状態を持つと
 * 「どの行が押されたか」を識別子で管理することになり、行の追加・削除で崩れやすい。
 *
 * @see apps/mobile/src/components/shortcut/ShortcutList.tsx - 使用元
 * @see apps/mobile/src/hooks/components/useSnippetCard.ts - 定型文側の同じ完了表示の作り
 */

import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '@cliptap/shared';
import { useTheme } from '@lib/themeSystem';
import { type ShortcutValue } from '@cliptap/shared';
import { UI_CONSTANTS } from '@constants/ui';

/**
 * 値の行の上下の余白（pt）
 *
 * 値が縦に並ぶため、行間が詰まっているとどこからどこまでが1件か読み取りにくい。
 * タップ対象としての高さもここで確保する。
 */
const ROW_VERTICAL_PADDING = UI_CONSTANTS.SPACING.BASE;

/* ========================================
   Props定義
   ======================================== */

/**
 * ShortcutValueRowのProps
 * @property value - 表示・コピーするショートカット値
 * @property onCopy - タップされたときのコールバック（クリップボードへコピー）
 */
interface ShortcutValueRowProps {
  value: ShortcutValue;
  onCopy: (value: ShortcutValue) => Promise<void>;
}

export function ShortcutValueRow({ value, onCopy }: ShortcutValueRowProps) {
  const { t } = useTranslation();
  const { colors, isTablet, responsiveFontSizes, responsiveLineHeights } = useTheme();

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

  const handlePress = useCallback(async () => {
    if (isCopying) return;
    setIsCopying(true);

    try {
      await onCopy(value);
      setIsCopied(true);
    } catch {
      setIsCopied(false);
    } finally {
      setIsCopying(false);
    }
  }, [isCopying, onCopy, value]);

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={handlePress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${value.name} ${t('common.copy')}`}
    >
      <View style={styles.textContainer}>
        {/* 値名（上）とコピーアイコン。
            アイコンを値名のすぐ隣に置くのは、値の長さでアイコンの位置が動かないようにするため。
            定型文のタイトル脇にあるコピーアイコンと同じ並びでもある */}
        <View style={styles.nameRow}>
          <Text
            style={[
              styles.valueName,
              {
                color: colors.textTertiary,
                fontSize: responsiveFontSizes.xs,
                lineHeight: responsiveLineHeights.xs,
              },
            ]}
            numberOfLines={UI_CONSTANTS.NUMBER_OF_LINES.SINGLE}
          >
            {value.name}
          </Text>
          <Ionicons
            name={isCopied ? 'checkmark' : 'copy-outline'}
            size={isTablet ? 18 : 14}
            color={isCopied ? colors.success : colors.textSecondary}
            style={styles.copyIcon}
          />
        </View>
        {/* 挿入・コピーされる値（下）。
            住所のような長い値でも全体を確かめてからコピーできるよう、行数を制限せず折り返す */}
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
          {value.value}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: UI_CONSTANTS.GAP.BASE,
    /* 行全体をタップ対象にする。高さは上下の余白で確保する */
    paddingVertical: ROW_VERTICAL_PADDING,
  },
  /* 値名と値を縦に積む。幅はすべてこちらが使う */
  textContainer: {
    flex: 1,
  },
  /* 値名とコピーアイコンを横に並べる。アイコンは値名の直後に置き、右端へは寄せない */
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  valueName: {
    fontWeight: UI_CONSTANTS.FONT_WEIGHT.MEDIUM,
  },
  valueText: {
    fontFamily: 'monospace',
  },
  copyIcon: {
    marginLeft: UI_CONSTANTS.GAP.XS,
  },
});
