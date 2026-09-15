/**
 * @module ShortcutValueTextEditModal
 * @description ショートカットの値入力モーダル
 *
 * ショートカット値の「挿入する値」だけを、画面いっぱいで入力する専用モーダル。
 * 値編集モーダル（shortcut/value-edit）から開き、入力内容をそこへ返す。
 *
 * 【値だけを別の画面にする理由】
 * 挿入する値は住所や定型の文面など複数行になることがあり、値名と同じ画面に収めると
 * 入力欄が狭くなって全体を確かめられない。カスタム変数の値入力（variable/profile-value-edit）と
 * 同じ扱いに揃える。
 *
 * 【変数ツールバーを置く理由】
 * 値にもカスタム変数・システム変数のトークン（{{name}}）を書けるため（§8.24）、
 * 定型文の本文入力（snippet/content-input）と同じツールバーをキーボードの直上に置き、
 * カーソル位置へ挿入できるようにする。
 *
 * @see src/hooks/screens/useShortcutValueTextEditScreen.ts - ビジネスロジック
 * @see app/shortcut/value-edit.tsx - 呼び出し元
 * @see src/components/snippet/TextInputScreen.tsx - 定型文の本文入力（同じツールバーとキーボード追従）
 * @see app/variable/profile-value-edit.tsx - カスタム変数側の同じ役割の画面
 */

import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from '@cliptap/shared';
import { useTheme } from '@lib/themeSystem';
import { useShortcutValueTextEditScreen } from '@hooks/screens/useShortcutValueTextEditScreen';
import { ScreenContainer } from '@components/common/ScreenContainer';
import { VariableToolbar } from '@components/snippet/VariableToolbar';
import { UI_CONSTANTS } from '@constants/ui';

/** Androidでキーボードの高さに足す余白（定型文の本文入力 TextInputScreen と同じ） */
const ANDROID_KEYBOARD_EXTRA_MARGIN = 24;

export default function ShortcutValueTextEditModal() {
  const { t } = useTranslation();
  const { colors, responsiveFontSizes, responsiveLineHeights } = useTheme();
  const params = useLocalSearchParams();

  const initialValue = (params.value as string) || '';

  const {
    value,
    keyboardHeight,
    textInputRef,
    handleChangeText,
    handleSelectionChange,
    handleInsertVariable,
    handleSave,
  } = useShortcutValueTextEditScreen({
    initialValue,
  });

  /* キーボードが出ている間は、その高さだけ下を空けてツールバーをキーボードの直上へ置く */
  const keyboardMargin =
    keyboardHeight > 0
      ? Platform.OS === 'ios'
        ? keyboardHeight
        : keyboardHeight + ANDROID_KEYBOARD_EXTRA_MARGIN
      : 0;

  /* ショートカットの値入力モーダル */
  return (
    <ScreenContainer
      title={t('shortcut.value_value')}
      isModal={true}
      rightAction={
        <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
          <Text
            style={[
              styles.saveText,
              {
                color: colors.primary,
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
      {/* キーボード表示に応じてレイアウト調整 */}
      <View style={[styles.contentWrapper, { marginBottom: keyboardMargin }]}>
        {/* 入力エリア（余白を吸収し、入力欄を上端へ寄せる） */}
        <View style={styles.inputArea}>
          {/* 画面いっぱいの入力欄。複数行の値をそのまま確かめられるようにする */}
          <TextInput
            ref={textInputRef}
            value={value}
            onChangeText={handleChangeText}
            onSelectionChange={(e) => {
              handleSelectionChange(e.nativeEvent.selection.start);
            }}
            placeholder={t('shortcut.value_value_placeholder')}
            placeholderTextColor={colors.textSecondary}
            style={[
              styles.input,
              {
                color: colors.text,
                fontSize: responsiveFontSizes.base,
                lineHeight: responsiveFontSizes.base * 1.5,
              },
            ]}
            multiline
            textAlignVertical="top"
            scrollEnabled={true}
          />
        </View>

        {/* 変数挿入ツールバー（キーボードの上に表示） */}
        <View
          style={[
            styles.toolbarContainer,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
            },
          ]}
        >
          <VariableToolbar onInsert={handleInsertVariable} />
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
  contentWrapper: {
    flex: 1,
  },
  inputArea: {
    flex: 1,
  },
  input: {
    flex: 1,
    padding: UI_CONSTANTS.SPACING.LG,
  },
  toolbarContainer: {
    borderTopWidth: UI_CONSTANTS.BORDER_WIDTH.THIN,
  },
});
