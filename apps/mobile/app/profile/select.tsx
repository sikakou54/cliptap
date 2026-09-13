/**
 * @module ProfileSelectScreen
 * @description プロファイル（環境）選択画面
 *
 * 定型文・ショートカットを表示するプロファイルを複数選択するためのモーダル画面。
 * 定型文フォームとショートカット編集の両方から開く共有の画面で、選び方は同じ
 * （0件＝全プロファイル向け）。遷移パラメータ target で何を選んでいるかを受け取り、
 * 説明文だけを対象に合わせて出し分ける。
 *
 * @features
 * - 利用可能なプロファイルの一覧表示
 * - 複数選択によるプロファイル指定
 * - 「全ての環境」オプション（空配列=全プロファイルで表示）
 * - 選択対象（定型文 / ショートカット）に応じた説明文
 *
 * @see src/hooks/screens/useProfileSelectScreen.ts - ビジネスロジック
 * @see src/hooks/screens/useSnippetFormScreen.ts - 呼び出し元（定型文フォーム）
 * @see src/hooks/screens/useShortcutEditScreen.ts - 呼び出し元（ショートカット編集）
 * @see packages/shared/src/utils/profileSelectLabels.ts - 対象の読み取りと説明文の出し分け
 */

import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { getProfileSelectDescription, parseProfileSelectTarget, useTranslation } from '@cliptap/shared';
import { useTheme } from '@lib/themeSystem';
import { useProfileSelectScreen } from '@hooks/screens/useProfileSelectScreen';
import { Profile } from '@cliptap/shared';
import { ScreenContainer } from '@components/common/ScreenContainer';
import { UI_CONSTANTS } from '@constants/ui';

export default function ProfileSelectScreen() {
  const { t } = useTranslation();
  const { colors, isTablet, responsiveFontSizes } = useTheme();
  const params = useLocalSearchParams();

  const selectedIds = params.selectedIds
    ? typeof params.selectedIds === 'string'
      ? params.selectedIds.split(',').filter((id) => id !== '')
      : params.selectedIds
    : [];

  /* 何を選んでいるか（定型文 / ショートカット）。未指定・想定外の値は定型文として扱う */
  const target = parseProfileSelectTarget(params.target);

  const {
    tempSelectedIds,
    profiles,
    toggleProfile,
    handleSelectAll,
    handleSave,
  } = useProfileSelectScreen({ selectedIds: Array.isArray(selectedIds) ? selectedIds : [] });

  return (
    <ScreenContainer
      title={t('profile.select_profiles_title')}
      isModal={!isTablet}
      /* 画面下端まで一覧が伸びるため下辺のセーフエリアも確保する */
      edges={['top', 'left', 'right', 'bottom']}
      rightAction={
        <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
          <Text style={[styles.saveText, { color: colors.primary, fontSize: responsiveFontSizes.base }]}>
            {t('common.save')}
          </Text>
        </TouchableOpacity>
      }
    >
      <ScrollView style={styles.content}>
        <Text style={[styles.description, { color: colors.textSecondary, fontSize: responsiveFontSizes.sm }]}>
          {getProfileSelectDescription(target, t)}
        </Text>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <TouchableOpacity
            style={[styles.profileOption, { borderBottomColor: colors.border, borderBottomWidth: 1 }]}
            onPress={handleSelectAll}
          >
            <View style={styles.profileOptionLeft}>
              <Ionicons
                name={tempSelectedIds.length === 0 ? 'checkbox' : 'square-outline'}
                size={24}
                color={tempSelectedIds.length === 0 ? colors.primary : colors.textSecondary}
                style={styles.checkbox}
              />
              <Text style={[styles.profileName, { color: colors.text, fontSize: responsiveFontSizes.base }]}>
                {t('profile.all_profiles')}
              </Text>
            </View>
          </TouchableOpacity>

          {profiles.map((profile: Profile, index: number) => {
            const isSelected = tempSelectedIds.includes(profile.id);
            const isLastItem = index === profiles.length - 1;

            return (
              <TouchableOpacity
                key={profile.id}
                style={[
                  styles.profileOption,
                  !isLastItem && { borderBottomColor: colors.border, borderBottomWidth: 1 }
                ]}
                onPress={() => toggleProfile(profile.id)}
              >
                <View style={styles.profileOptionLeft}>
                  <Ionicons
                    name={isSelected ? 'checkbox' : 'square-outline'}
                    size={24}
                    color={isSelected ? colors.primary : colors.textSecondary}
                    style={styles.checkbox}
                  />
                  <View style={styles.profileInfo}>
                    <Text style={[styles.profileName, { color: colors.text, fontSize: responsiveFontSizes.base }]}>
                      {profile.name}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  description: {
    marginBottom: 16,
    lineHeight: 20,
  },
  section: {
    borderRadius: UI_CONSTANTS.BORDER_RADIUS.BASE,
    overflow: 'hidden',
    marginBottom: 16,
  },
  profileOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  profileOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  checkbox: {
    marginRight: UI_CONSTANTS.GAP.BASE,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontWeight: UI_CONSTANTS.FONT_WEIGHT.MEDIUM,
  },
  saveButton: {
    padding: UI_CONSTANTS.GAP.XS,
  },
  saveText: {
    fontWeight: UI_CONSTANTS.FONT_WEIGHT.SEMIBOLD,
  },
});
