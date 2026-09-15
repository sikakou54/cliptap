/**
 * プロファイル選択チップコンポーネント
 *
 * 水平スクロール可能なチップ形式でプロファイルを選択するUI。
 * プロファイル別にデータを切り替える場面で使用。
 *
 * 主な機能:
 * - 水平スクロール可能なチップリスト
 * - 選択状態の視覚的フィードバック（色反転）
 * - オプションのカウントバッジ表示
 * - カスタマイズ可能なパディング
 *
 * @see app/search.tsx - 検索画面での使用（表示対象の絞り込み）
 */

import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '@lib/themeSystem';
import { Profile } from '@cliptap/shared';
import { UI_CONSTANTS } from '@constants/ui';

/* ========================================
   Props定義
   ======================================== */

/**
 * ProfileChipSelectorのProps
 * @property profiles - 表示するプロファイル一覧
 * @property selectedProfileId - 現在選択中のプロファイルID
 * @property onSelectProfile - プロファイル選択時のコールバック
 * @property showCount - カウントバッジを表示するか
 * @property getCount - 各プロファイルのカウント取得関数
 * @property containerPadding - コンテナの水平パディング
 */
export interface ProfileChipSelectorProps {
  /** 表示するプロファイルの配列 */
  profiles: Profile[];
  /** 現在選択されているプロファイルのID（未選択時はnull） */
  selectedProfileId: string | null;
  /** プロファイルがタップされた時に呼ばれるコールバック関数 */
  onSelectProfile: (profileId: string) => void;
  /** カウントバッジを表示するかどうか（デフォルト: false） */
  showCount?: boolean;
  /** 各プロファイルに紐づくアイテム数を取得する関数 */
  getCount?: (profileId: string) => number;
  /** スクロールビューの水平パディング（省略時はテーマのデフォルト値を使用） */
  containerPadding?: number;
}

export const ProfileChipSelector: React.FC<ProfileChipSelectorProps> = ({
  profiles,
  selectedProfileId,
  onSelectProfile,
  showCount = false,
  getCount,
  containerPadding,
}) => {
  /* ========================================
     Hooks & コンテキスト
     ======================================== */
  const { colors, responsiveSpacing, responsiveFontSizes } = useTheme();

  /* ========================================
     派生データ（計算値）
     ======================================== */
  /** 水平パディング（カスタム値またはテーマのデフォルト値） */
  const horizontalPadding = containerPadding ?? responsiveSpacing.containerPadding;

  /* ========================================
     早期リターン
     ======================================== */

  if (profiles.length === 0) {
    return null;
  }

  /* ========================================
     レンダリング
     ======================================== */

  /* プロファイルチップセレクター（水平スクロール） */
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={[
        styles.contentContainer,
        { paddingHorizontal: horizontalPadding }
      ]}
    >
      {profiles.map((profile) => {
        const isSelected = selectedProfileId === profile.id;
        const count = showCount && getCount ? getCount(profile.id) : 0;

        /* プロファイルチップ */
        return (
          <TouchableOpacity
            key={profile.id}
            style={[
              styles.chip,
              {
                borderColor: isSelected ? colors.primary : colors.border,
                backgroundColor: isSelected ? colors.primary : colors.surface,
              }
            ]}
            onPress={() => onSelectProfile(profile.id)}
          >
            {/* プロファイル名 */}
            <Text
              style={[
                styles.chipText,
                {
                  color: isSelected ? colors.onPrimary : colors.text,
                  fontSize: responsiveFontSizes.sm,
                }
              ]}
            >
              {profile.name}
            </Text>
            {/* カウントバッジ（オプション） */}
            {showCount && count > 0 && (
              <View
                style={[
                  styles.countBadge,
                  {
                    backgroundColor: isSelected ? colors.onPrimaryMuted : colors.border,
                  }
                ]}
              >
                <Text
                  style={[
                    styles.countBadgeText,
                    {
                      color: isSelected ? colors.onPrimary : colors.textSecondary,
                      fontSize: responsiveFontSizes.xs,
                    }
                  ]}
                >
                  {count}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};

/* ========================================
   スタイル定義
   ======================================== */
const styles = StyleSheet.create({
  /** スクロールコンテナ（高さ固定） */
  container: {
    flexGrow: 0,
  },
  /** コンテンツコンテナ（横並び） */
  contentContainer: {
    gap: UI_CONSTANTS.GAP.SM,
    paddingTop: 0,
    paddingBottom: UI_CONSTANTS.GAP.BASE,
  },
  /**
   * チップ（丸みのある長方形）
   *
   * 角丸と左右余白は他のチップ実装（CategoryFilter / SortMenu / VariablePreview /
   * settings/variables）と同一トークンに揃えている。
   * 高さは固定しない。カウントバッジを内包し、タブレットでは responsiveFontSizes.sm が18ptになるため、
   * 固定高にするとバッジと文字がクリップされる。
   */
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: UI_CONSTANTS.GAP.BASE,
    paddingVertical: UI_CONSTANTS.GAP.SM,
    borderRadius: UI_CONSTANTS.BORDER_RADIUS.XL,
    borderWidth: UI_CONSTANTS.BORDER_WIDTH.THIN,
    gap: UI_CONSTANTS.GAP.XS,
  },
  /** チップテキスト */
  chipText: {
    fontWeight: UI_CONSTANTS.FONT_WEIGHT.MEDIUM,
  },
  /** カウントバッジ */
  countBadge: {
    paddingHorizontal: UI_CONSTANTS.GAP.XS,
    paddingVertical: 2,
    borderRadius: UI_CONSTANTS.BORDER_RADIUS.SM,
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** カウントバッジテキスト */
  countBadgeText: {
    fontWeight: UI_CONSTANTS.FONT_WEIGHT.SEMIBOLD,
  },
});
