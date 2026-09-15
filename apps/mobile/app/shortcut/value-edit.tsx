/**
 * @module ShortcutValueEditModal
 * @description ショートカット値編集モーダル
 *
 * ショートカットが持つ値1件（値名と値）を追加・編集するモーダル画面。
 *
 * @features
 * - 値名の入力（必須）
 * - 挿入する値の複数行入力（専用の値入力画面で、変数ツールバーからカスタム変数・システム変数を挿入できる）
 * - 入力内容は親画面（shortcut/edit）へ返し、DBへは親画面の保存時にまとめて反映
 *
 * @see src/hooks/screens/useShortcutValueEditScreen.ts - ビジネスロジック
 * @see app/shortcut/edit.tsx - 呼び出し元
 * @see app/shortcut/value-text-edit.tsx - 値入力画面
 */

import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from '@cliptap/shared';
import { useTheme } from '@lib/themeSystem';
import { useShortcutValueEditScreen } from '@hooks/screens/useShortcutValueEditScreen';
import { ScreenContainer } from '@components/common/ScreenContainer';
import { UI_CONSTANTS } from '@constants/ui';

/** キーボード回避のためにヘッダー分だけ持ち上げる高さ（iOSのみ） */
const KEYBOARD_VERTICAL_OFFSET = 90;

export default function ShortcutValueEditModal() {
  const { t } = useTranslation();
  const { colors, responsiveFontSizes, responsiveLineHeights } = useTheme();
  const params = useLocalSearchParams();

  const valueKey = (params.valueKey as string) || '';
  const initialName = (params.valueName as string) || '';
  const initialValue = (params.value as string) || '';

  const {
    valueName,
    setValueName,
    value,
    isEdit,
    canSave,
    handleOpenValueInput,
    handleSave,
  } = useShortcutValueEditScreen({
    valueKey,
    initialName,
    initialValue,
  });

  /* ショートカット値編集モーダル */
  return (
    <ScreenContainer
      title={isEdit ? t('shortcut.value_edit') : t('shortcut.value_create')}
      isModal={true}
      keyboardAvoiding
      keyboardVerticalOffset={Platform.OS === 'ios' ? KEYBOARD_VERTICAL_OFFSET : 0}
      rightAction={
        <TouchableOpacity onPress={handleSave} disabled={!canSave} style={styles.saveButton}>
          <Text
            style={[
              styles.saveText,
              {
                color: canSave ? colors.primary : colors.textSecondary,
                fontSize: responsiveFontSizes.base,
                lineHeight: responsiveLineHeights.base,
              },
            ]}
          >
            {t('common.done')}
          </Text>
        </TouchableOpacity>
      }
    >
      <View style={styles.content}>
        {/* 値名入力セクション */}
        <View style={styles.section}>
          {/* ラベルと文字数カウンター */}
          <View style={styles.labelRow}>
            <Text
              style={[
                styles.label,
                { color: colors.textSecondary, fontSize: responsiveFontSizes.sm },
              ]}
            >
              {t('shortcut.value_name')}
            </Text>
            <Text
              style={[
                styles.charCount,
                { color: colors.textSecondary, fontSize: responsiveFontSizes.xs },
              ]}
            >
              {valueName.length}/{UI_CONSTANTS.INPUT_LIMITS.SHORTCUT_VALUE_NAME_MAX}
            </Text>
          </View>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.surface,
                color: colors.text,
                fontSize: responsiveFontSizes.base,
              },
            ]}
            value={valueName}
            onChangeText={setValueName}
            placeholder={t('shortcut.value_name_placeholder')}
            placeholderTextColor={colors.textSecondary}
            autoFocus={!isEdit}
            maxLength={UI_CONSTANTS.INPUT_LIMITS.SHORTCUT_VALUE_NAME_MAX}
          />
        </View>

        {/* 値入力セクション */}
        <View style={styles.valueSection}>
          <Text
            style={[
              styles.label,
              { color: colors.textSecondary, fontSize: responsiveFontSizes.sm },
            ]}
          >
            {t('shortcut.value_value')}
          </Text>
          {/* タップで値入力の専用画面を開く。
              複数行の値をこの画面の狭い枠で編集させず、画面いっぱいで扱えるようにする
              （定型文の本文入力・カスタム変数の値入力と同じ扱い）。
              変数トークンは展開せず、保存する文字列のまま表示する */}
          <TouchableOpacity
            style={[styles.valueButton, { backgroundColor: colors.surface }]}
            onPress={handleOpenValueInput}
            activeOpacity={0.7}
          >
            <Text
              style={[
                {
                  color: value ? colors.text : colors.textSecondary,
                  fontSize: responsiveFontSizes.base,
                  lineHeight: responsiveLineHeights.base,
                },
              ]}
            >
              {value || t('shortcut.value_value_placeholder')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  saveButton: {
    padding: UI_CONSTANTS.SPACING.XS,
  },
  saveText: {
    fontWeight: UI_CONSTANTS.FONT_WEIGHT.SEMIBOLD,
  },
  content: {
    flex: 1,
    paddingTop: UI_CONSTANTS.SPACING.LG,
    paddingHorizontal: UI_CONSTANTS.SPACING.LG,
    paddingBottom: UI_CONSTANTS.SPACING.LG,
  },
  section: {
    marginBottom: UI_CONSTANTS.SPACING.XXL,
  },
  valueSection: {
    flex: 1,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: UI_CONSTANTS.GAP.MD,
  },
  label: {
    fontWeight: UI_CONSTANTS.FONT_WEIGHT.MEDIUM,
    marginBottom: UI_CONSTANTS.GAP.MD,
  },
  charCount: {
    marginBottom: UI_CONSTANTS.GAP.MD,
  },
  input: {
    borderRadius: UI_CONSTANTS.BORDER_RADIUS.BASE,
    padding: UI_CONSTANTS.SPACING.BASE,
    minHeight: UI_CONSTANTS.BUTTON_HEIGHT.MEDIUM,
  },
  /* 値の入力口。押すと専用画面へ移るため、入力欄ではなくボタンとして組む。
     minHeightで確保した高さの中でテキストを縦中央に置く。
     テキスト側をflex:1で伸ばすと、1行のときも枠いっぱいに広がって上へ寄って見える */
  valueButton: {
    borderRadius: UI_CONSTANTS.BORDER_RADIUS.BASE,
    padding: UI_CONSTANTS.SPACING.BASE,
    minHeight: UI_CONSTANTS.BUTTON_HEIGHT.LARGE,
    justifyContent: 'center',
  },
});
