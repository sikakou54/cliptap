/**
 * テキスト入力画面コンポーネント
 *
 * タイトルまたはコンテンツを入力する専用画面。
 * スニペット作成・編集画面から遷移して使用。
 *
 * 主な機能:
 * - マルチライン対応テキスト入力
 * - 変数挿入ツールバー（キーボードの上に表示）
 * - キーボード表示時の自動レイアウト調整
 * - カーソル位置への変数挿入
 *
 * アーキテクチャ:
 * - UIとビジネスロジックを完全分離
 * - 全ての状態・ロジックはuseTextInputScreenフックで管理
 *
 * @see hooks/screens/useTextInputScreen.ts - ビジネスロジック
 * @see SnippetFormScreen - 親コンポーネント
 * @see VariableToolbar - 変数挿入ツールバー
 */

import { View, Text, TextInput, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useTranslation } from '@cliptap/shared';
import { useTheme } from '@lib/themeSystem';
import { useTextInputScreen } from '@hooks/screens/useTextInputScreen';
import { VariableToolbar } from './VariableToolbar';
import { ScreenContainer } from '@components/common/ScreenContainer';
import { INPUT_LIMITS } from '@cliptap/shared';

/* ========================================
   Props定義
   ======================================== */

/**
 * TextInputScreenのProps
 * @property type - 入力タイプ（'title': タイトル, 'content': コンテンツ）
 * @property initialValue - 初期テキスト値
 * @property hasOnSave - 保存コールバックが設定されているか
 */
export interface TextInputScreenProps {
  type: 'title' | 'content';
  initialValue?: string;
  hasOnSave?: boolean;
}

export function TextInputScreen({ type, initialValue, hasOnSave }: TextInputScreenProps) {
  const { t } = useTranslation();
  const { colors, isTablet, responsiveFontSizes, responsiveLineHeights } = useTheme();

  const {
    text,
    keyboardHeight,
    textInputRef,
    handleTextChange,
    handleSelectionChange,
    handleInsertVariable,
    handleSave,
  } = useTextInputScreen({ type, initialValue, hasOnSave });

  /* 翻訳キーは文字列リテラルで書く。組み立てると、キーの追加漏れをテストも検索も検出できず、
     画面にキー名がそのまま出るまで気付けない */
  const isContent = type === 'content';
  const screenTitle = isContent ? t('snippet.content_input') : t('snippet.title_input');
  const placeholder = isContent
    ? t('snippet.content_input_placeholder')
    : t('snippet.title_input_placeholder');

  /* テキスト入力画面 */
  return (
    <ScreenContainer
      title={screenTitle}
      isModal={!isTablet}
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
      <View
        style={[
          styles.contentWrapper,
          {
            marginBottom:
              keyboardHeight > 0
                ? Platform.OS === 'ios'
                  ? keyboardHeight
                  : keyboardHeight + 24
                : 0,
          },
        ]}
      >
        {/* テキスト入力エリア（余白を吸収し、入力欄を上端へ寄せる） */}
        <View style={styles.inputArea}>
          {/* テキスト入力フィールド */}
          <TextInput
            ref={textInputRef}
            value={text}
            onChangeText={handleTextChange}
            onSelectionChange={(e) => {
              handleSelectionChange(e.nativeEvent.selection.start);
            }}
            placeholder={placeholder}
            placeholderTextColor={colors.textSecondary}
            style={[
              /* 単一行のタイトルは伸縮させない（伸ばすと垂直中央に描画されるため） */
              type === 'content' ? styles.input : styles.inputSingleLine,
              {
                color: colors.text,
                fontSize: responsiveFontSizes.base,
                lineHeight: responsiveFontSizes.base * 1.5,
              },
            ]}
            multiline={type === 'content'}
            maxLength={type === 'title' ? INPUT_LIMITS.SNIPPET_TITLE_MAX : undefined}
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
    padding: 4,
  },
  saveText: {
    fontWeight: '600',
  },
  contentWrapper: {
    flex: 1,
  },
  inputArea: {
    flex: 1,
  },
  input: {
    flex: 1,
    padding: 16,
  },
  inputSingleLine: {
    padding: 16,
  },
  toolbarContainer: {
    borderTopWidth: 1,
  },
});
