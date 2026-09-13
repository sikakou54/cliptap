/**
 * @module SelectImportDataScreen
 * @description インポートデータ選択画面
 *
 * バックアップファイルからインポートするデータを選択するモーダル画面。
 *
 * @features
 * - データ種別ごとのタブ切り替え（定型文/プロファイル/変数/カテゴリ）
 * - 個別選択・全選択切り替え
 * - 重複データの検知・警告表示
 *
 * @see src/hooks/screens/useSelectImportDataScreen.ts - ビジネスロジック
 */
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Pressable
} from 'react-native';
import { getSelectionTabLabel, useTranslation } from '@cliptap/shared';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { type ImportTabType } from '@cliptap/shared';
import { useTheme } from '@lib/themeSystem';
import { commonStyles } from '@lib/styles/commonStyles';
import { ScreenContainer } from '@components/common/ScreenContainer';
import { UI_CONSTANTS } from '@constants/ui';
import {
  SelectionSnippetItem,
  SelectionProfileItem,
  SelectionVariableItem,
  SelectionCategoryItem,
} from '@components/selection';
import { useSelectImportDataScreen } from '@hooks/screens/useSelectImportDataScreen';

const TAB_OPTIONS: ImportTabType[] = ['snippets', 'profiles', 'variables', 'categories'];

export default function SelectImportDataScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { tempDbPath } = useLocalSearchParams<{ tempDbPath: string }>();

  const {
    candidates,
    isLoading,
    isProcessing,
    activeTab,
    expandedSnippetIds,
    expandedVariableIds,
    selectedSnippetIds,
    selectedProfileIds,
    selectedVariableIds,
    selectedCategoryIds,
    totalSelected,
    isProfileDisabled,
    isVariableDuplicate,
    isCategoryDisabled,
    isAllSelected,
    setActiveTab,
    toggleSelection,
    toggleSelectAll,
    toggleSnippetExpand,
    toggleVariableExpand,
    handleImport,
  } = useSelectImportDataScreen({ tempDbPath: tempDbPath ?? '' });

  if (isLoading) {
    return (
      <View style={[commonStyles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScreenContainer
      title={t('export_import.select_import_data')}
      rightAction={
        <TouchableOpacity onPress={() => toggleSelectAll(activeTab)}>
          <Ionicons
            name={isAllSelected(activeTab) ? 'checkbox' : 'square-outline'}
            size={24}
            color={colors.primary}
          />
        </TouchableOpacity>
      }
      backIcon="close"
      isModal={true}
    >
      {/* タブコンテナ */}
      <View style={[styles.tabContainer, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        {TAB_OPTIONS.map((tab) => (
          <Pressable
            key={tab}
            style={[
              styles.tab,
              activeTab === tab && { borderBottomColor: colors.primary, borderBottomWidth: 2 }
            ]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[
              styles.tabText,
              { color: activeTab === tab ? colors.primary : colors.textSecondary }
            ]}>
              {getSelectionTabLabel(tab, t)}
            </Text>
            <Text style={[
              styles.tabCount,
              { color: activeTab === tab ? colors.primary : colors.textSecondary }
            ]}>
              ({tab === 'snippets' ? selectedSnippetIds.size :
                tab === 'profiles' ? selectedProfileIds.size :
                tab === 'variables' ? selectedVariableIds.size :
                selectedCategoryIds.size})
            </Text>
          </Pressable>
        ))}
      </View>

      {/* コンテンツ（タブ別リスト） */}
      <View style={[styles.content, { backgroundColor: colors.background }]}>
        {activeTab === 'snippets' && (
          <FlatList
            data={candidates.snippets}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const displayProfiles = item.profiles.filter(p => {
                const profile = candidates.profiles.find(cp => cp.id === p.profileId);
                if (!profile) return false;
                return selectedProfileIds.has(p.profileId) || isProfileDisabled(profile.name);
              });
              const category = candidates.categories.find(c => c.name === item.categoryName);
              const isCategorySelected = category && (selectedCategoryIds.has(category.id) || isCategoryDisabled(category.name));
              const displayItem = {
                ...item,
                categoryId: isCategorySelected ? category.id : null,
                categoryColor: isCategorySelected ? category.color : null,
                profiles: displayProfiles,
              };
              return (
                <SelectionSnippetItem
                  item={displayItem}
                  isSelected={selectedSnippetIds.has(item.id)}
                  isExpanded={expandedSnippetIds.has(item.id)}
                  onToggleSelection={toggleSelection}
                  onToggleExpand={toggleSnippetExpand}
                  colors={colors}
                  t={t}
                />
              );
            }}
            contentContainerStyle={styles.listContent}
            style={{ backgroundColor: colors.background }}
          />
        )}
        {activeTab === 'profiles' && (
          <FlatList
            data={candidates.profiles}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <SelectionProfileItem
                item={item}
                isSelected={selectedProfileIds.has(item.id)}
                isDisabled={isProfileDisabled(item.name)}
                disabledMessage={t('backup.already_registered_profile')}
                onToggleSelection={toggleSelection}
                colors={colors}
              />
            )}
            contentContainerStyle={styles.listContent}
            style={{ backgroundColor: colors.background }}
          />
        )}
        {activeTab === 'variables' && (
          <FlatList
            data={candidates.variables}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const filteredItem = {
                ...item,
                profileValues: item.profileValues.filter(pv => {
                  const profile = candidates.profiles.find(p => p.id === pv.profileId);
                  if (!profile) return false;
                  return selectedProfileIds.has(pv.profileId) || isProfileDisabled(profile.name);
                }),
              };
              return (
                <SelectionVariableItem
                  item={filteredItem}
                  isSelected={selectedVariableIds.has(item.id)}
                  isDuplicate={isVariableDuplicate(item.name)}
                  duplicateMessage={t('backup.variable_merge_warning')}
                  isExpanded={expandedVariableIds.has(item.id)}
                  onToggleSelection={toggleSelection}
                  onToggleExpand={toggleVariableExpand}
                  colors={colors}
                  t={t}
                />
              );
            }}
            contentContainerStyle={styles.listContent}
            style={{ backgroundColor: colors.background }}
          />
        )}
        {activeTab === 'categories' && (
          <FlatList
            data={candidates.categories}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <SelectionCategoryItem
                item={item}
                isSelected={selectedCategoryIds.has(item.id)}
                isDisabled={isCategoryDisabled(item.name)}
                disabledMessage={t('backup.already_registered_category')}
                onToggleSelection={toggleSelection}
                colors={colors}
              />
            )}
            contentContainerStyle={styles.listContent}
            style={{ backgroundColor: colors.background }}
          />
        )}
      </View>

      {/* フッター（インポートボタン） */}
      <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
        <TouchableOpacity
          style={[styles.importButton, { backgroundColor: totalSelected > 0 ? colors.primary : colors.border }]}
          onPress={handleImport}
          disabled={totalSelected === 0 || isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color={colors.onPrimary} />
          ) : (
            <Text style={[styles.importButtonText, { color: colors.onPrimary }]}>{t('export_import.import')}</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tabCount: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  /* 一覧の下余白。フッター（styles.footer）が position:absolute で画面下端に重なるため、最終行が隠れないよう余白を確保する */
  listContent: {
    paddingBottom: 100,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: UI_CONSTANTS.GAP.XL,
  },
  importButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    minWidth: 100,
    alignItems: 'center',
  },
  /** インポートボタンのテキスト（文字色は使用箇所でテーマの onPrimary を重ねる） */
  importButtonText: {
    fontWeight: '600',
  },
});
