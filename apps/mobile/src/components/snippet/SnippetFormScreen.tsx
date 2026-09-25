/**
 * スニペット作成・編集フォーム画面コンポーネント
 *
 * スニペットの新規作成と既存スニペットの編集を行う共通フォーム。
 * モーダル形式で表示され、各入力項目は専用画面へ遷移して入力する。
 *
 * 主な機能:
 * - タイトル入力（専用画面へ遷移）
 * - コンテンツ入力（専用画面へ遷移）
 * - カテゴリ選択（選択画面へ遷移）
 * - プロファイル（環境）選択（複数選択可能）
 * - タイトル付きコピー設定
 * - 変数プレビュー表示
 *
 * アーキテクチャ:
 * - UIとビジネスロジックを完全分離
 * - 全ての状態・ロジックはuseSnippetFormScreenフックで管理
 *
 * @see hooks/screens/useSnippetFormScreen.ts - ビジネスロジック
 * @see app/snippet/create.tsx - 新規作成ルート
 * @see app/snippet/edit.tsx - 編集ルート
 */

import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { getProfileSelectPlaceholder, useTranslation } from '@cliptap/shared';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@lib/themeSystem';
import { useSnippetFormScreen } from '@hooks/screens/useSnippetFormScreen';
import { CategoryBadge } from '@components/category/CategoryBadge';
import { VariablePreview } from './VariablePreview';
import { ScreenContainer } from '@components/common/ScreenContainer';
import { commonStyles, snippetFormStyles } from '@lib/styles/commonStyles';

/**
 * SnippetFormScreenのProps
 * @property mode - フォームモード（'create': 新規作成, 'edit': 編集）
 * @property snippetId - 編集対象のスニペットID（編集モード時のみ必須）
 */
interface SnippetFormScreenProps {
  mode: 'create' | 'edit';
  snippetId?: string;
}

export function SnippetFormScreen({ mode, snippetId }: SnippetFormScreenProps) {
  const { t } = useTranslation();
  const { colors, isTablet, responsiveFontSizes, responsiveLineHeights } = useTheme();

  const {
    title,
    content,
    selectedProfileIds,
    copyWithTitle,
    saving,
    loading,
    isEditMode,
    canSave,
    selectedCategory,
    profiles,
    handleTitlePress,
    handleContentPress,
    handleCategoryPress,
    handleProfilePress,
    handleCopyWithTitleChange,
    handleSave,
  } = useSnippetFormScreen({ mode, snippetId });

  if (loading) {
    /* ローディング状態 */
    return (
      <View style={[commonStyles.container, commonStyles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  /* スニペット作成・編集フォーム画面 */
  return (
    <ScreenContainer
      title={isEditMode ? t('snippet.edit') : t('snippet.create')}
      isModal={!isTablet}
      rightAction={
        <TouchableOpacity
          onPress={handleSave}
          style={snippetFormStyles.saveButton}
          disabled={saving || !canSave}
        >
          <Text style={[
            snippetFormStyles.saveText,
            {
              color: (saving || !canSave) ? colors.textSecondary : colors.primary,
              fontSize: responsiveFontSizes.base,
            }
          ]}>
            {t('common.save')}
          </Text>
        </TouchableOpacity>
      }
    >
      {/* スクロール可能なフォームコンテンツ */}
      <ScrollView style={snippetFormStyles.content}>
        {/* タイトル入力セクション */}
        <View style={snippetFormStyles.section}>
          <TouchableOpacity
            style={[snippetFormStyles.titleButton, { backgroundColor: colors.surface }]}
            onPress={handleTitlePress}
          >
            <Text style={[snippetFormStyles.titleText, { color: title ? colors.text : colors.textSecondary, fontSize: responsiveFontSizes.base, lineHeight: responsiveLineHeights.base }]}>
              {title || t('snippet.title_placeholder')}
            </Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* コンテンツ入力セクション */}
        <View style={snippetFormStyles.section}>
          <TouchableOpacity
            style={[snippetFormStyles.contentButton, { backgroundColor: colors.surface }]}
            onPress={handleContentPress}
          >
            <Text
              style={[snippetFormStyles.contentText, { color: content ? colors.text : colors.textSecondary, fontSize: responsiveFontSizes.base, lineHeight: responsiveLineHeights.base }]}
            >
              {content || t('snippet.content_placeholder')}
            </Text>
            <View style={snippetFormStyles.editIconContainer}>
              <Ionicons name="create-outline" size={20} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>
        </View>

        {/* カテゴリ選択セクション */}
        <View style={snippetFormStyles.section}>
          <TouchableOpacity
            style={[snippetFormStyles.categoryButton, { backgroundColor: colors.surface }]}
            onPress={handleCategoryPress}
          >
            {/* 選択されたカテゴリバッジまたはプレースホルダー */}
            {selectedCategory ? (
              <CategoryBadge category={selectedCategory} />
            ) : (
              <Text style={{ color: colors.textSecondary, fontSize: responsiveFontSizes.base, lineHeight: responsiveLineHeights.base }}>
                {t('snippet.select_category')}
              </Text>
            )}
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* プロファイル（環境）選択セクション（複数選択可能） */}
        <View style={snippetFormStyles.section}>
          <TouchableOpacity
            style={[snippetFormStyles.categoryButton, { backgroundColor: colors.surface }]}
            onPress={handleProfilePress}
          >
            <View style={{ flex: 1 }}>
              {/* 選択されたプロファイル数と名前の表示 */}
              {selectedProfileIds.length === 0 ? (
                <Text style={{ color: colors.textSecondary, fontSize: responsiveFontSizes.base, lineHeight: responsiveLineHeights.base }}>
                  {getProfileSelectPlaceholder('snippet', t)}
                </Text>
              ) : (
                <View>
                  <Text style={{ color: colors.text, fontSize: responsiveFontSizes.base, lineHeight: responsiveLineHeights.base, fontWeight: '500' }}>
                    {t('profile.profiles_selected', { count: selectedProfileIds.length })}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: responsiveFontSizes.sm, marginTop: 2 }}>
                    {profiles
                      .filter(p => selectedProfileIds.includes(p.id))
                      .map(p => p.name)
                      .join(', ')}
                  </Text>
                </View>
              )}
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* タイトル付きコピー設定 */}
        <View style={snippetFormStyles.section}>
          <View style={[snippetFormStyles.categoryButton, { backgroundColor: colors.surface }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: responsiveFontSizes.base, lineHeight: responsiveLineHeights.base, fontWeight: '500' }}>
                {t('snippet.copy_with_title')}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: responsiveFontSizes.sm, marginTop: 2 }}>
                {t('snippet.copy_with_title_description')}
              </Text>
            </View>
            {/* スイッチ */}
            <Switch
              value={copyWithTitle}
              onValueChange={handleCopyWithTitleChange}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.surface}
            />
          </View>
        </View>

        {/* 変数プレビュー */}
        <VariablePreview
          title={title}
          content={content}
          selectedProfileIds={selectedProfileIds}
          copyWithTitle={copyWithTitle}
        />
      </ScrollView>
    </ScreenContainer>
  );
}
