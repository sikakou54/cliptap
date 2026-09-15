/**
 * @module ShortcutEditModal
 * @description ショートカット作成・編集モーダル
 *
 * ショートカット名と、そのショートカットが持つ値一覧を編集するモーダル画面。
 *
 * @features
 * - ショートカット名の入力
 * - 所属プロファイルの選択（選択画面へ遷移。複数選択可、0件は全プロファイル向け）
 * - 値の追加/編集/削除（値の実体は保存時にまとめてDBへ反映）
 * - 値が1件も無い状態では保存できない
 *
 * @see src/hooks/screens/useShortcutEditScreen.ts - ビジネスロジック
 * @see app/profile/select.tsx - プロファイル選択画面（定型文フォームと共有）
 * @see docs/機能仕様書.md §8.24 ショートカット管理
 */

import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { getProfileSelectPlaceholder, useTranslation } from '@cliptap/shared';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@lib/themeSystem';
import { useShortcutEditScreen } from '@hooks/screens/useShortcutEditScreen';
import { CategoryBadge } from '@components/category/CategoryBadge';
import { ScreenContainer } from '@components/common/ScreenContainer';
import { UI_CONSTANTS } from '@constants/ui';

export default function ShortcutEditModal() {
  const { t } = useTranslation();
  const { colors, responsiveFontSizes, responsiveLineHeights } = useTheme();
  const params = useLocalSearchParams();

  const shortcutId = params.id as string | undefined;

  const {
    name,
    setName,
    profileIds,
    selectedProfileNames,
    selectedCategory,
    values,
    saving,
    isEdit,
    canSave,
    handleProfilePress,
    handleCategoryPress,
    handleAddValue,
    handleEditValue,
    handleDeleteValue,
    handleSave,
  } = useShortcutEditScreen({ shortcutId });

  /* ショートカット作成・編集モーダル */
  return (
    <ScreenContainer
      title={isEdit ? t('shortcut.edit') : t('shortcut.create')}
      isModal={true}
      rightAction={
        <TouchableOpacity onPress={handleSave} disabled={saving || !canSave} style={styles.saveButton}>
          <Text
            style={[
              styles.saveText,
              {
                color: saving || !canSave ? colors.textSecondary : colors.primary,
                fontSize: responsiveFontSizes.base,
                lineHeight: responsiveLineHeights.base,
              },
            ]}
          >
            {t('common.save')}
          </Text>
        </TouchableOpacity>
      }
    >
      {/* スクロール可能なコンテンツエリア */}
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* ショートカット名入力セクション */}
        <View style={styles.section}>
          {/* ラベルと文字数カウンター */}
          <View style={styles.labelRow}>
            <Text
              style={[
                styles.label,
                { color: colors.textSecondary, fontSize: responsiveFontSizes.sm },
              ]}
            >
              {t('shortcut.name')}
            </Text>
            <Text
              style={[
                styles.charCount,
                { color: colors.textSecondary, fontSize: responsiveFontSizes.xs },
              ]}
            >
              {name.length}/{UI_CONSTANTS.INPUT_LIMITS.SHORTCUT_NAME_MAX}
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
            value={name}
            onChangeText={setName}
            placeholder={t('shortcut.name_placeholder')}
            placeholderTextColor={colors.textSecondary}
            maxLength={UI_CONSTANTS.INPUT_LIMITS.SHORTCUT_NAME_MAX}
          />
        </View>

        {/* 所属プロファイル選択セクション（複数選択可能。0件は全プロファイル向け）。
            プロファイルが1件だけでも常に表示する。0件が「全プロファイル向け」であることを
            ここで見せないと、所属を持たないショートカットがどこに出るのか分からなくなるため。
            新規作成ではアクティブなプロファイルが初期選択される（定型文フォームと同じ形） */}
        <View style={styles.section}>
          <Text
            style={[
              styles.label,
              { color: colors.textSecondary, fontSize: responsiveFontSizes.sm },
            ]}
          >
            {t('shortcut.profile')}
          </Text>
          <TouchableOpacity
            style={[styles.categoryButton, { backgroundColor: colors.surface }]}
            onPress={handleProfilePress}
          >
            <View style={styles.profileSummary}>
              {/* 未選択なら全プロファイル向けであることを、選択済みなら件数と名前を出す */}
              {profileIds.length === 0 ? (
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: responsiveFontSizes.base,
                    lineHeight: responsiveLineHeights.base,
                  }}
                >
                  {getProfileSelectPlaceholder('shortcut', t)}
                </Text>
              ) : (
                <View>
                  {/* 選択中の件数 */}
                  <Text
                    style={[
                      styles.profileCount,
                      {
                        color: colors.text,
                        fontSize: responsiveFontSizes.base,
                        lineHeight: responsiveLineHeights.base,
                      },
                    ]}
                  >
                    {t('profile.profiles_selected', { count: profileIds.length })}
                  </Text>
                  {/* 選択中のプロファイル名（プロファイル一覧の並び順） */}
                  <Text
                    style={[
                      styles.profileNames,
                      {
                        color: colors.textSecondary,
                        fontSize: responsiveFontSizes.sm,
                        lineHeight: responsiveLineHeights.sm,
                      },
                    ]}
                  >
                    {selectedProfileNames.join(', ')}
                  </Text>
                </View>
              )}
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* カテゴリ選択セクション。カテゴリは任意のため、未選択は未分類として保存される */}
        <View style={styles.section}>
          <Text
            style={[
              styles.label,
              { color: colors.textSecondary, fontSize: responsiveFontSizes.sm },
            ]}
          >
            {t('shortcut.category')}
          </Text>
          <TouchableOpacity
            style={[styles.categoryButton, { backgroundColor: colors.surface }]}
            onPress={handleCategoryPress}
          >
            {/* 選択済みならバッジ、未選択なら選択を促す文言を出す（定型文フォームと同じ形） */}
            {selectedCategory ? (
              <CategoryBadge category={selectedCategory} />
            ) : (
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: responsiveFontSizes.base,
                  lineHeight: responsiveLineHeights.base,
                }}
              >
                {t('category.select')}
              </Text>
            )}
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* 値一覧セクション */}
        <View style={styles.section}>
          <Text
            style={[
              styles.label,
              { color: colors.textSecondary, fontSize: responsiveFontSizes.sm },
            ]}
          >
            {t('shortcut.values')}
          </Text>

          {/* 値の一覧と「値を追加」を、間隔を空けて縦に並べる */}
          <View style={styles.valueList}>
            {/* 登録済みの値（タップで編集）。
                名前・プロファイル・カテゴリの入力欄と同じ下地・角丸の箱で1件ずつ表示する */}
            {values.map((draft) => (
              <TouchableOpacity
                key={draft.key}
                style={[styles.valueRow, { backgroundColor: colors.surface }]}
                onPress={() => handleEditValue(draft)}
                activeOpacity={0.7}
              >
                <View style={styles.valueCardMain}>
                  {/* 値名 */}
                  <Text
                    style={[
                      styles.valueName,
                      {
                        color: colors.text,
                        fontSize: responsiveFontSizes.base,
                        lineHeight: responsiveLineHeights.base,
                      },
                    ]}
                    numberOfLines={UI_CONSTANTS.NUMBER_OF_LINES.SINGLE}
                  >
                    {draft.name}
                  </Text>
                  {/* 挿入する値。ホームの一覧と同じく、変数トークンを展開した文字列で表示する
                      （基準のプロファイルは useShortcutEditScreen の displayProfileId） */}
                  <Text
                    style={[
                      styles.valueText,
                      {
                        color: colors.textSecondary,
                        fontSize: responsiveFontSizes.sm,
                        lineHeight: responsiveLineHeights.sm,
                      },
                    ]}
                    numberOfLines={UI_CONSTANTS.NUMBER_OF_LINES.DOUBLE}
                  >
                    {draft.displayValue}
                  </Text>
                </View>

                {/* 削除ボタン */}
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    handleDeleteValue(draft);
                  }}
                  hitSlop={UI_CONSTANTS.HIT_SLOP.DEFAULT}
                  style={styles.valueDeleteButton}
                >
                  <Ionicons name="trash-outline" size={UI_CONSTANTS.ICON_SIZE.SM} color={colors.error} />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}

            {/* 値を追加 */}
            <TouchableOpacity
              style={[styles.addValueButton, { borderColor: colors.primary }]}
              onPress={handleAddValue}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={UI_CONSTANTS.ICON_SIZE.SM} color={colors.primary} />
              <Text
                style={[
                  styles.addValueText,
                  {
                    color: colors.primary,
                    fontSize: responsiveFontSizes.base,
                    lineHeight: responsiveLineHeights.base,
                  },
                ]}
              >
                {t('shortcut.value_create')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: UI_CONSTANTS.SPACING.LG,
    paddingHorizontal: UI_CONSTANTS.SPACING.LG,
    paddingBottom: UI_CONSTANTS.SPACING.XXXL,
  },
  saveButton: {
    padding: UI_CONSTANTS.SPACING.XS,
  },
  saveText: {
    fontWeight: UI_CONSTANTS.FONT_WEIGHT.SEMIBOLD,
  },
  section: {
    marginBottom: UI_CONSTANTS.SPACING.XXL,
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
  /* カテゴリ選択ボタン: バッジ（または選択を促す文言）と「＞」を両端に置く。
     プロファイル選択の行も同じ形のため共用する */
  categoryButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: UI_CONSTANTS.BORDER_RADIUS.BASE,
    padding: UI_CONSTANTS.SPACING.BASE,
    minHeight: UI_CONSTANTS.BUTTON_HEIGHT.MEDIUM,
  },
  /* プロファイル選択の表示部分。「＞」を右端へ押し出すため残りの幅を占める */
  profileSummary: {
    flex: 1,
  },
  profileCount: {
    fontWeight: UI_CONSTANTS.FONT_WEIGHT.MEDIUM,
  },
  profileNames: {
    marginTop: UI_CONSTANTS.GAP.XS,
  },
  /* 値の箱と「値を追加」を縦に並べる。箱どうしの間隔はここで取る */
  valueList: {
    gap: UI_CONSTANTS.GAP.SM,
  },
  /* 名前・プロファイル・カテゴリの入力欄（input / categoryButton）と同じ角丸・余白の箱。
     下地の色はテーマに従うため描画時に渡す */
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: UI_CONSTANTS.BORDER_RADIUS.BASE,
    padding: UI_CONSTANTS.SPACING.BASE,
    minHeight: UI_CONSTANTS.BUTTON_HEIGHT.MEDIUM,
  },
  valueCardMain: {
    flex: 1,
    gap: UI_CONSTANTS.GAP.XS,
    paddingRight: UI_CONSTANTS.GAP.MD,
  },
  valueName: {
    fontWeight: UI_CONSTANTS.FONT_WEIGHT.MEDIUM,
  },
  valueText: {
    fontFamily: 'monospace',
  },
  valueDeleteButton: {
    padding: UI_CONSTANTS.SPACING.XS,
  },
  addValueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: UI_CONSTANTS.GAP.XS,
    borderRadius: UI_CONSTANTS.BORDER_RADIUS.BASE,
    borderWidth: UI_CONSTANTS.BORDER_WIDTH.THIN,
    borderStyle: 'dashed',
    minHeight: UI_CONSTANTS.BUTTON_HEIGHT.MEDIUM,
  },
  addValueText: {
    fontWeight: UI_CONSTANTS.FONT_WEIGHT.MEDIUM,
  },
});
