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
 * @see src/hooks/screens/useShortcutValueTextEditScreen.ts - ビジネスロジック
 * @see app/shortcut/value-edit.tsx - 呼び出し元
 * @see app/variable/profile-value-edit.tsx - カスタム変数側の同じ役割の画面
 */

import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from '@cliptap/shared';
import { useTheme } from '@lib/themeSystem';
import { useShortcutValueTextEditScreen } from '@hooks/screens/useShortcutValueTextEditScreen';
import { ScreenContainer } from '@components/common/ScreenContainer';
import { UI_CONSTANTS } from '@constants/ui';

/** iOSでキーボードを避けるための上部オフセット（ヘッダー分） */
const KEYBOARD_VERTICAL_OFFSET = 90;

export default function ShortcutValueTextEditModal() {
  const { t } = useTranslation();
  const { colors, responsiveFontSizes } = useTheme();
  const params = useLocalSearchParams();

  const initialValue = (params.value as string) || '';

  const { value, setValue, textInputRef, handleSave } = useShortcutValueTextEditScreen({
    initialValue,
  });

  /* ショートカットの値入力モーダル */
  return (
    <ScreenContainer
      title={t('shortcut.value_value')}
      isModal={true}
      keyboardAvoiding
      keyboardVerticalOffset={Platform.OS === 'ios' ? KEYBOARD_VERTICAL_OFFSET : 0}
      rightAction={
        <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
          <Text
            style={[
              styles.saveText,
              { color: colors.primary, fontSize: responsiveFontSizes.base },
            ]}
          >
            {t('common.done')}
          </Text>
        </TouchableOpacity>
      }
    >
      <View style={styles.contentWrapper}>
        {/* 画面いっぱいの入力欄。複数行の値をそのまま確かめられるようにする */}
        <TextInput
          ref={textInputRef}
          value={value}
          onChangeText={setValue}
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
    padding: UI_CONSTANTS.SPACING.LG,
  },
  input: {
    flex: 1,
  },
});
