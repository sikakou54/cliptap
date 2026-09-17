/**
 * @module SearchScreen
 * @description 検索画面
 *
 * 定型文またはショートカットをキーワードで検索するためのモーダル画面。
 * 検索対象はホームの表示対象（切替トグル）を引き継ぐ。
 *
 * @features
 * - リアルタイム検索（300msデバウンス）
 * - 定型文はタイトル・本文の全文検索
 * - ショートカットは名前・値名・値の検索
 * - プロファイルの一時切替と一致件数（定型文・ショートカット共通）
 * - 検索結果のワンタップコピー
 * - 検索結果から編集画面への遷移
 *
 * @ux
 * - フェードアニメーションでの表示
 * - 自動フォーカスでキーボード即時表示
 * - 検索結果がない場合のEmpty State表示
 *
 * @see src/hooks/screens/useSearchScreen.ts - ビジネスロジック
 */

import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '@cliptap/shared';
import { useTheme } from '@lib/themeSystem';
import { useSearchScreen } from '@hooks/screens/useSearchScreen';
import { ScreenContainer } from '@components/common/ScreenContainer';
import { SnippetList } from '@components/snippet/SnippetList';
import { ShortcutList } from '@components/shortcut/ShortcutList';
import { SearchBar } from '@components/snippet/SearchBar';
import { ProfileChipSelector } from '@components/profile/ProfileChipSelector';

export default function SearchScreen() {
  const { t } = useTranslation();
  const { colors, isTablet, responsive, responsiveSpacing, maxContentWidth } = useTheme();
  const params = useLocalSearchParams();

  /* ホームの表示対象を引き継ぐ。パラメータが無い場合は定型文として扱う */
  const {
    query,
    setQuery,
    isShowingShortcuts,
    selectedProfileId,
    setSelectedProfileId,
    displaySnippets,
    displayShortcuts,
    validProfiles,
    filteredProfiles,
    categories,
    getProfileResultCount,
    allResultCount,
    hasSearchQuery,
    handleRefresh,
    handleCopySnippet,
    handleCopySnippetTitle,
    handleEditSnippet,
    handleDeleteSnippet,
    handleCopyShortcutValue,
    handleEditShortcut,
    handleDeleteShortcut,
    handleClose,
  } = useSearchScreen({ isShowingShortcuts: params.mode === 'shortcut' });

  /* ヘッダー（検索バーと閉じるボタン）。上部インセットはScreenContainerが確保するため内部余白のみ持つ */
  const header = (
    <View
      style={[
        styles.header,
        maxContentWidth !== undefined && { maxWidth: maxContentWidth, alignSelf: 'center', width: '100%' },
        {
          backgroundColor: colors.background,
          paddingTop: isTablet ? 20 : 8,
          paddingHorizontal: responsiveSpacing.containerPadding,
        },
      ]}
    >
      <View style={styles.searchRow}>
        {/* 検索バー */}
        <View style={styles.searchContainer}>
          <SearchBar
            value={query}
            onChangeText={setQuery}
            placeholder={isShowingShortcuts ? t('shortcut.search_placeholder') : undefined}
            autoFocus
          />
        </View>
        {/* 閉じるボタン（右端） */}
        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
          <Ionicons name="close" size={responsive.header.iconSize} color={colors.text} />
        </TouchableOpacity>
      </View>
    </View>
  );

  /* 検索画面コンテナ */
  return (
    <ScreenContainer customHeader={header} fullScreenModal>
      {/* メインコンテンツエリア（タブレットでは最大幅を制限） */}
      <View
        style={[
          styles.contentContainer,
          maxContentWidth !== undefined && { maxWidth: maxContentWidth, alignSelf: 'center', width: '100%' },
        ]}
      >
        {/* プロファイルチップセレクター。先頭の「すべて」が既定で、有効な全プロファイルを横断して検索する。
            チップを選ぶとその環境の結果だけに絞り込む。プロファイルが1件だけのときも出し、
            どの環境を見ているかを常に示す（Webの SearchProfileBar と同じ条件・§8.7）。
            一致が1件も無いときも「すべて」は残す。行ごと消すと検索中に画面の並びが変わるためである */}
        {validProfiles.length > 0 && (
          <ProfileChipSelector
            profiles={filteredProfiles}
            selectedProfileId={selectedProfileId}
            onSelectProfile={setSelectedProfileId}
            allLabel={t('profile.search_all')}
            allCount={allResultCount}
            showCount={hasSearchQuery}
            getCount={getProfileResultCount}
            containerPadding={responsiveSpacing.containerPadding}
          />
        )}

        {/* 検索結果一覧。検索対象で中身を入れ替える */}
        <View style={styles.listContainer}>
          {isShowingShortcuts ? (
            <ShortcutList
              shortcuts={displayShortcuts}
              categories={categories}
              onCopyValue={handleCopyShortcutValue}
              onEdit={handleEditShortcut}
              onDelete={handleDeleteShortcut}
              onRefresh={handleRefresh}
              /* 検索画面には追加ボタンが無いため、0件のときの「＋ボタンから追加」の案内は出さない */
              showEmptyHint={false}
            />
          ) : (
            <SnippetList
              snippets={displaySnippets}
              onPress={handleCopySnippet}
              onEdit={handleEditSnippet}
              onDelete={handleDeleteSnippet}
              onPressTitle={handleCopySnippetTitle}
              onRefresh={handleRefresh}
              disableCopy={false}
              categories={categories}
            />
          )}
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    flex: 1,
  },
  /* 検索バーの下余白はホーム（app/index.tsx）のヘッダーと同じ値にし、
     フィルター行の上の余白をホームのカテゴリフィルターと揃える */
  header: {
    paddingBottom: 8,
    flexDirection: 'column',
    gap: 8,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchContainer: {
    flex: 1,
  },
  closeButton: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    flex: 1,
  },
});
