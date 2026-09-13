/**
 * @module SelectExportDataScreen
 * @description エクスポートデータ選択画面
 *
 * エクスポートするデータを選択するモーダル画面。
 *
 * @features
 * - データ種別ごとのタブ切り替え（定型文/プロファイル/変数/カテゴリ）
 * - 個別選択・全選択切り替え
 * - パスワード入力後にエクスポート実行
 *
 * @see src/hooks/screens/useSelectExportDataScreen.ts - ビジネスロジック
 */
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Pressable,
  Modal,
  TextInput,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { useTranslation } from '@cliptap/shared'
import { Ionicons } from '@expo/vector-icons';
import { type ImportTabType, getSelectionTabLabel } from '@cliptap/shared';
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
import { useSelectExportDataScreen } from '@hooks/screens/useSelectExportDataScreen';

const TAB_OPTIONS: ImportTabType[] = ['snippets', 'profiles', 'variables', 'categories'];

export default function SelectExportDataScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();

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
    isAllSelected,
    showPasswordModal,
    password,
    setPassword,
    setActiveTab,
    toggleSelection,
    toggleSelectAll,
    toggleSnippetExpand,
    toggleVariableExpand,
    handleExportPress,
    handlePasswordSubmit,
    closePasswordModal,
  } = useSelectExportDataScreen();

  if (isLoading) {
    return (
      <View style={[commonStyles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScreenContainer
      title={t('export_import.select_export_data')}
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
                const isCategorySelected = item.categoryId && selectedCategoryIds.has(item.categoryId);
                const displayItem = {
                  ...item,
                  categoryName: isCategorySelected ? item.categoryName : null,
                  categoryColor: isCategorySelected ? item.categoryColor : null,
                  profiles: item.profiles.filter(p => selectedProfileIds.has(p.profileId)),
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
              ItemSeparatorComponent={() => (
                <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />
              )}
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
                profileValues: item.profileValues.filter(pv => selectedProfileIds.has(pv.profileId)),
              };
              return (
                <SelectionVariableItem
                  item={filteredItem}
                  isSelected={selectedVariableIds.has(item.id)}
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
                onToggleSelection={toggleSelection}
                colors={colors}
              />
            )}
            contentContainerStyle={styles.listContent}
            style={{ backgroundColor: colors.background }}
          />
        )}
      </View>

      {/* フッター（エクスポートボタン） */}
      <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
        <TouchableOpacity
          style={[styles.exportButton, { backgroundColor: totalSelected > 0 ? colors.primary : colors.border }]}
          onPress={handleExportPress}
          disabled={totalSelected === 0 || isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color={colors.onPrimary} />
          ) : (
            <Text style={[styles.exportButtonText, { color: colors.onPrimary }]}>{t('export_import.export')}</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* パスワード入力モーダル */}
      <Modal
        visible={showPasswordModal}
        transparent
        animationType="fade"
        onRequestClose={closePasswordModal}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
            <TouchableWithoutFeedback>
              <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {t('export_import.password_title')}
                </Text>
                <Text style={[styles.modalDescription, { color: colors.textSecondary }]}>
                  {t('export_import.password_description')}
                </Text>
                <TextInput
                  style={[styles.passwordInput, {
                    backgroundColor: colors.background,
                    color: colors.text,
                    borderColor: colors.border
                  }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t('export_import.password_placeholder')}
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry
                  autoFocus
                />
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton, { borderColor: colors.border }]}
                    onPress={closePasswordModal}
                  >
                    <Text style={[styles.cancelButtonText, { color: colors.text }]}>
                      {t('common.cancel')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.submitButton, { backgroundColor: colors.primary }]}
                    onPress={handlePasswordSubmit}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <ActivityIndicator size="small" color={colors.onPrimary} />
                    ) : (
                      <Text style={[styles.submitButtonText, { color: colors.onPrimary }]}>
                        {t('common.ok')}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
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
  exportButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    minWidth: 100,
    alignItems: 'center',
  },
  /** エクスポートボタンのテキスト（文字色は使用箇所でテーマの onPrimary を重ねる） */
  exportButtonText: {
    fontWeight: '600',
  },
  /** モーダルオーバーレイ（背景色は使用箇所でテーマの overlay を重ねる） */
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalDescription: {
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  passwordInput: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {},
  /** 送信ボタンのテキスト（文字色は使用箇所でテーマの onPrimary を重ねる） */
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
