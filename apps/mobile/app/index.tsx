/**
 * @module HomeScreen
 * @description メイン画面（ホーム画面）
 *
 * 定型文とショートカットの一覧を、切替トグルで入れ替えて表示する。
 * 定型文はワンタップコピー。ショートカットは値の行をタップするとその値だけをコピーし、
 * 編集は行タップではなく編集アイコンから開く（§8.24）。
 *
 * @features
 * - 定型文一覧の表示（FlashListによる高速レンダリング）
 * - ワンタップでクリップボードにコピー
 * - ショートカット一覧の表示と作成・編集・削除
 * - フィルター行の切替トグルによる表示対象の入れ替え
 * - カテゴリによるフィルタリング（定型文・ショートカットの両方に効く）
 * - プロファイル（環境）の切り替え
 * - スワイプによる編集・削除操作
 *
 * @navigation
 * - 設定アイコン → /settings
 * - 検索アイコン → /search（モーダル）
 * - 追加アイコン → /snippet/create または /shortcut/edit（表示対象で分岐、モーダル）
 *
 * @see src/hooks/screens/useHomeScreen.ts - ビジネスロジック
 * @see src/components/snippet/SnippetList.tsx - 定型文の一覧表示コンポーネント
 * @see src/components/shortcut/ShortcutList.tsx - ショートカットの一覧表示コンポーネント
 */

import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '@cliptap/shared';
import { useTheme } from '@lib/themeSystem';
import { useHomeScreen } from '@hooks/screens/useHomeScreen';
import { ScreenContainer } from '@components/common/ScreenContainer';
import { SnippetList } from '@components/snippet/SnippetList';
import { ShortcutList } from '@components/shortcut/ShortcutList';
import { CategoryFilter } from '@components/category/CategoryFilter';
import { ProfileSelector } from '@components/profile/ProfileSelector';
import { SortMenu } from '@components/snippet/SortMenu';
import { ListModeToggle } from '@components/common/ListModeToggle';
import { AdBanner } from '@components/ads/AdBanner';

export default function HomeScreen() {
  const { t } = useTranslation();
  const { colors, isTablet, responsive, responsiveSpacing, maxContentWidth } = useTheme();

  const {
    listMode,
    selectedCategoryId,
    activeProfileId,
    snippets,
    shortcuts,
    categories,
    filteredCategories,
    handleToggleListMode,
    handleCategorySelect,
    handleRefresh,
    handleCopySnippet,
    handleCopySnippetTitle,
    handleEditSnippet,
    handleDeleteSnippet,
    handleCopyShortcutValue,
    handleEditShortcut,
    handleDeleteShortcut,
    handleNavigateToSettings,
    handleNavigateToSearch,
    handleNavigateToCreate,
    handleProfileChange,
    currentSort,
    handleSortChange,
  } = useHomeScreen();

  /* ショートカットを表示中か。一覧・並べ替えの出し分けに使う */
  const isShowingShortcuts = listMode === 'shortcut';

  /* ヘッダー（プロファイル選択・アクションボタン）。上部インセットはScreenContainerが確保するため内部余白のみ持つ */
  const header = (
    <View
      style={[
        styles.header,
        maxContentWidth !== undefined && { maxWidth: maxContentWidth, alignSelf: 'center', width: '100%' },
        {
          backgroundColor: colors.background,
          paddingTop: isTablet ? 20 : 8,
          paddingBottom: 12,
          paddingHorizontal: responsiveSpacing.containerPadding,
        },
      ]}
    >
      <View style={styles.topRow}>
        {/* プロファイル選択（環境切り替え） */}
        <View style={styles.profileContainer}>
          <ProfileSelector onProfileChange={handleProfileChange} />
        </View>

        {/* 表示切替トグルとアクションボタン（設定・検索・追加）。
            アイコン群は縮まずプロファイル名だけが縮む配置のため、狭い端末でプロファイル名が
            読めなくならないよう増やしすぎないこと。入出力（バックアップ）は設定画面から開く */}
        <View style={styles.iconGroup}>
          {/* 定型文／ショートカットの表示切替。
              以前ショートカット画面へ遷移していたアイコンと同じ位置に置き、
              押した先が「別画面」から「同じ位置の別の一覧」へ変わったことを位置で示す */}
          <ListModeToggle
            isShowingShortcuts={isShowingShortcuts}
            onToggle={handleToggleListMode}
          />

          {/* 設定画面への遷移 */}
          <TouchableOpacity onPress={handleNavigateToSettings} style={styles.iconButton}>
            <Ionicons
              name="settings-outline"
              size={responsive.header.iconSize + 2}
              color={colors.text}
            />
          </TouchableOpacity>

          {/* 検索画面への遷移 */}
          <TouchableOpacity onPress={handleNavigateToSearch} style={styles.iconButton}>
            <Ionicons
              name="search-outline"
              size={responsive.header.iconSize + 2}
              color={colors.text}
            />
          </TouchableOpacity>

          {/* 新規作成画面への遷移 */}
          <TouchableOpacity onPress={handleNavigateToCreate} style={styles.iconButton}>
            <Ionicons
              name="add-circle-outline"
              size={responsive.header.iconSize + 8}
              color={colors.primary}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <ScreenContainer customHeader={header}>
      {/* メインコンテンツエリア（タブレットでは最大幅を制限） */}
      <View
        style={[
          styles.contentContainer,
          maxContentWidth !== undefined && { maxWidth: maxContentWidth, alignSelf: 'center', width: '100%' },
        ]}
      >
        {/* カテゴリフィルター（横スクロール可能なカテゴリ一覧）+ ソートメニュー。
            並べ替えは定型文とショートカットの両方に効く。名前の呼び方だけ表示対象で変える */}
        <CategoryFilter
          categories={filteredCategories}
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={handleCategorySelect}
          sortMenu={
            <SortMenu
              currentSort={currentSort}
              onSortChange={handleSortChange}
              nameSortLabel={isShowingShortcuts ? t('sort.name') : undefined}
            />
          }
        />

        {/* 一覧（FlashListによる高速レンダリング）。表示対象で中身を入れ替える */}
        <View style={styles.listContainer}>
          {isShowingShortcuts ? (
            <ShortcutList
              shortcuts={shortcuts}
              categories={categories}
              onCopyValue={handleCopyShortcutValue}
              onEdit={handleEditShortcut}
              onDelete={handleDeleteShortcut}
              onRefresh={handleRefresh}
            />
          ) : (
            <SnippetList
              snippets={snippets}
              onPress={handleCopySnippet}
              onEdit={handleEditSnippet}
              onDelete={handleDeleteSnippet}
              onPressTitle={handleCopySnippetTitle}
              onRefresh={handleRefresh}
              categories={categories}
              overrideProfileId={activeProfileId}
              extraData={currentSort}
            />
          )}
        </View>
      </View>

      {/* 広告バナー（無料プランのみ表示） */}
      <AdBanner />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    flex: 1,
  },
  header: {
    paddingBottom: 8,
    flexDirection: 'column',
    gap: 8,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  profileContainer: {
    flexShrink: 1,
    minWidth: 0,
  },
  iconGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 0,
  },
  iconButton: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    flex: 1,
  },
});
