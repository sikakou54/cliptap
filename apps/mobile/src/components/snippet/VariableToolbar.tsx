/**
 * 変数挿入ツールバーコンポーネント
 *
 * テキスト入力画面でキーボードの上に表示される変数挿入ボタン群。
 * システム変数とカスタム変数をワンタップで挿入可能。
 * 定型文のタイトル・本文入力と、ショートカットの値入力で使う。
 *
 * 主な機能:
 * - システム変数ボタン（date, time, datetime等）
 * - カスタム変数ボタン（ユーザー定義変数）
 * - 横スクロール対応
 * - 10秒ごとの自動リフレッシュ（変数追加を反映）
 *
 * @see TextInputScreen - 親コンポーネント
 * @see app/shortcut/value-text-edit.tsx - ショートカットの値入力での使用
 * @see UI_SYSTEM_VARIABLES - システム変数定義
 */

import { View, ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme } from '@lib/themeSystem';
import { Ionicons } from '@expo/vector-icons';
import { VariableOption } from '@mobile-types/variable';
import { useVariableToolbar } from '@hooks/components/useVariableToolbar';

/* ========================================
   Props定義
   ======================================== */

/**
 * VariableToolbarのProps
 * @property onInsert - 変数挿入時のコールバック（変数名を受け取る）
 */
interface VariableToolbarProps {
  onInsert: (variableName: string) => void;
}

export function VariableToolbar({ onInsert }: VariableToolbarProps) {
  const { colors } = useTheme();

  /* フックからロジックを取得 */
  const {
    allVariables,
    shouldCenter,
    horizontalPadding,
    handleContentLayout,
  } = useVariableToolbar();

  /* 変数挿入ツールバーコンテナ */
  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      {/* 水平スクロール可能な変数ボタン一覧 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          shouldCenter && { paddingHorizontal: horizontalPadding },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.buttonContainer} onLayout={handleContentLayout}>
          {allVariables.map((variable) => (
            <VariableButton
              key={variable.name}
              variable={variable}
              onPress={() => onInsert(variable.name)}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

/**
 * VariableButtonのProps
 * @property variable - 変数オプションデータ
 * @property onPress - タップ時のコールバック
 */
interface VariableButtonProps {
  variable: VariableOption;
  onPress: () => void;
}

/**
 * 変数挿入ボタンコンポーネント
 * アイコン、ラベル、変数構文（{{name}}）を表示
 */
function VariableButton({ variable, onPress }: VariableButtonProps) {
  const { colors, responsiveFontSizes, responsiveLineHeights } = useTheme();

  /* 変数挿入ボタン */
  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          backgroundColor: colors.card,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.buttonContent}>
        {/* 変数アイコン */}
        <Ionicons name={variable.icon} size={16} color={colors.primary} />
        {/* 変数ラベル */}
        <Text style={[styles.buttonLabel, { color: colors.text, fontSize: responsiveFontSizes.xs, lineHeight: responsiveLineHeights.xs }]}>
          {variable.label}
        </Text>
      </View>
      {/* 変数コード（{{変数名}}） */}
      <Text style={[styles.buttonVariable, { color: colors.textSecondary, fontSize: responsiveFontSizes.xs - 2, lineHeight: Math.round((responsiveFontSizes.xs - 2) * 1.5) }]}>
        {`{{${variable.name}}}`}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 6,
    paddingBottom: 6,
  },
  scrollContent: {
    paddingBottom: 0,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
    alignItems: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  buttonLabel: {
    fontWeight: '600',
  },
  buttonVariable: {
    fontFamily: 'monospace',
    textAlign: 'center',
  },
});
