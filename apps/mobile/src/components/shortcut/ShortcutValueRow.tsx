/**
 * ショートカット値の1行
 *
 * 値を1行で表示し、タップするとその値だけをクリップボードへコピーする。
 * 表示するのは表示中のプロファイルで変数トークンを展開した文字列で、
 * コピーはProviderがその時点のプロファイルと日時で展開し直す。
 *
 * 【値に名前を出さない理由】
 * 何の値かはショートカット名が表す。行ごとに名前を持たせると名前が二重になり、
 * 値そのものが読み取りにくくなる。値は登録順に並ぶだけとする。
 *
 * 【マスクした値も同じ行で扱う理由】
 * 隠すのは表示だけで、タップしたときにコピーされるのは実際の値である。
 * 行の形を変えると「押せない行」に見えてしまうため、文字だけを置き換える。
 *
 * 【行ごとにコンポーネントを分ける理由】
 * コピー完了の表示は押された行だけに出したい。一覧側で状態を持つと
 * 「どの行が押されたか」を識別子で管理することになり、行の追加・削除で崩れやすい。
 *
 * @see apps/mobile/src/components/shortcut/ShortcutCard.tsx - 使用元
 * @see apps/mobile/src/hooks/components/useSnippetCard.ts - 定型文側の同じ完了表示の作り
 */

import { useCallback, useEffect, useState } from 'react';
import { Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '@cliptap/shared';
import { useTheme } from '@lib/themeSystem';
import {
  MASKED_VALUE_TEXT,
  type ShortcutValue,
  type ShortcutValueWithDisplay,
} from '@cliptap/shared';
import { UI_CONSTANTS } from '@constants/ui';

/**
 * 値の行の上下の余白（pt）
 *
 * タップ対象としての高さをここで確保する。値の行高（スマートフォンで21pt）に
 * この余白の2倍を足して、最小タップ領域の44ptを下回らないこと（12×2+21=45pt）。
 */
const ROW_VERTICAL_PADDING = UI_CONSTANTS.SPACING.BASE;

/* ========================================
   Props定義
   ======================================== */

/**
 * ShortcutValueRowのProps
 * @property value - 表示・コピーするショートカット値（表示用に展開した文字列を持つ）
 * @property onCopy - タップされたときのコールバック（クリップボードへコピー）
 */
interface ShortcutValueRowProps {
  value: ShortcutValueWithDisplay;
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
      /* マスクした値は読み上げにも出さない。画面で隠しても音声で漏れては意味がない */
      accessibilityLabel={
        value.isMasked ? t('common.copy') : `${value.displayValue} ${t('common.copy')}`
      }
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
        {value.isMasked ? MASKED_VALUE_TEXT : value.displayValue}
        {/* 文字とアイコンの間隔は空白で作る。Textの中に置いたアイコンには余白の指定が効かない */}
        {' '}
        <Ionicons
          name={isCopied ? 'checkmark' : 'copy-outline'}
          size={isTablet ? 18 : 14}
          color={isCopied ? colors.success : colors.textSecondary}
        />
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  /* 行全体をタップ対象にする。高さは上下の余白で確保する */
  row: {
    paddingVertical: ROW_VERTICAL_PADDING,
  },
  valueText: {
    fontFamily: 'monospace',
  },
});
