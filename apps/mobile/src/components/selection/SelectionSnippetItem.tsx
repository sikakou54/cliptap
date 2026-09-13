/**
 * @module SelectionSnippetItem
 * @description 選択スニペットアイテムコンポーネント
 *
 * インポート/エクスポートでスニペットを選択するための個別表示。
 * チェックボックスによる選択とコンテンツの展開/折りたたみをサポート。
 * カテゴリバッジとプロファイルバッジを表示。
 *
 * @see app/settings/select-import-data.tsx - インポートデータ選択画面
 * @see app/settings/select-export-data.tsx - エクスポートデータ選択画面
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  type ImportTabType,
  type SelectionSnippetData,
  type SemanticColors,
} from '@cliptap/shared';
import { useTheme } from '@lib/themeSystem';
import { dataItemStyles as styles } from './dataItemStyles';

export type { SelectionSnippetData } from '@cliptap/shared';

interface SelectionSnippetItemProps {
  item: SelectionSnippetData;
  isSelected: boolean;
  isExpanded: boolean;
  onToggleSelection: (id: string, type: ImportTabType) => void;
  onToggleExpand: (id: string) => void;
  colors: SemanticColors;
  t: (key: string) => string;
}

function SelectionSnippetItemInner({
  item,
  isSelected,
  isExpanded,
  onToggleSelection,
  onToggleExpand,
  colors,
  t,
}: SelectionSnippetItemProps) {
  /* 文字サイズはタブレットで拡大させるためテーマから取得する（色は呼び出し側からpropsで受け取る） */
  const { responsiveFontSizes } = useTheme();

  const profileNames = item.profiles.length === 0
    ? [t('profile.all_profiles')]
    : item.profiles.map(p => p.profileName).filter(Boolean) as string[];

  /* 選択スニペットアイテム */
  return (
    <View style={[styles.item, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
      {/* チェックボックス */}
      <TouchableOpacity
        style={styles.checkContainer}
        onPress={() => onToggleSelection(item.id, 'snippets')}
      >
        <Ionicons
          name={isSelected ? "checkbox" : "square-outline"}
          size={24}
          color={isSelected ? colors.primary : colors.textSecondary}
        />
      </TouchableOpacity>
      {/* スニペットコンテンツ（展開/折りたたみ可能） */}
      <TouchableOpacity
        style={styles.itemContent}
        activeOpacity={0.8}
        onPress={() => onToggleExpand(item.id)}
      >
        {/* ヘッダー（タイトルと展開アイコン） */}
        <View style={styles.header}>
          {/* スニペットタイトル */}
          <Text
            style={[styles.itemTitle, { color: colors.text, fontSize: responsiveFontSizes.base }]}
            numberOfLines={1}
          >
            {item.title || t('common.no_title')}
          </Text>
          {/* 展開/折りたたみアイコン */}
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.textSecondary}
          />
        </View>
        {/* スニペットコンテンツ */}
        <Text
          style={{ color: colors.textSecondary, fontSize: responsiveFontSizes.sm }}
          numberOfLines={isExpanded ? undefined : 2}
        >
          {item.content}
        </Text>
        {/* バッジコンテナ（カテゴリとプロファイル） */}
        <View style={[styles.badgeContainer, { borderTopColor: colors.border }]}>
          {/* カテゴリバッジ */}
          <View style={[styles.badge, { backgroundColor: `${item.categoryColor || colors.primary}20` }]}>
            <Text
              style={[
                styles.badgeText,
                { color: item.categoryColor || colors.primary, fontSize: responsiveFontSizes.xs },
              ]}
            >
              {item.categoryName || t('common.uncategorized')}
            </Text>
          </View>
          {/* プロファイルバッジ */}
          {profileNames.map((name, index) => (
            <View
              key={`profile-${index}`}
              style={[styles.badge, { backgroundColor: `${colors.textSecondary}20` }]}
            >
              <Text
                style={[
                  styles.badgeText,
                  { color: colors.textSecondary, fontSize: responsiveFontSizes.xs },
                ]}
              >
                {name}
              </Text>
            </View>
          ))}
        </View>
      </TouchableOpacity>
    </View>
  );
}

/** @description 選択スニペットアイテム（React.memoでメモ化） */
export const SelectionSnippetItem = React.memo(SelectionSnippetItemInner);
