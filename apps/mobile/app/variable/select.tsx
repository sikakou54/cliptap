/**
 * @module VariableSelectScreen
 * @description カスタム変数選択画面
 *
 * ショートカット値から参照するカスタム変数を1件選ぶモーダル画面。
 *
 * @features
 * - 有効なカスタム変数の一覧表示（表示ラベルと、参照したときに挿入される値）
 * - プロファイルのバッジで、プロファイルごとに挿入される値を切り替えて確認（確認用。アクティブは変えない）
 *   バッジはショートカット作成・編集画面で選んでいるプロファイルに絞る（0件＝全プロファイル向けなら全件）
 * - 選択中の変数にチェックを表示
 * - 選択すると呼び出し元へ変数IDを返して閉じる
 *
 * @see app/shortcut/value-edit.tsx - 呼び出し元
 * @see src/hooks/screens/useShortcutValueEditScreen.ts - 戻り値の受け取り
 * @see packages/shared/src/shortcuts/resolveValue.ts - 表示する値の解決規則
 */

import { useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  resolveProfileValue,
  useProfiles,
  useTranslation,
  useVariables,
  type ProfileValueMap,
  type Variable,
} from '@cliptap/shared';
import { useTheme } from '@lib/themeSystem';
import { ScreenContainer } from '@components/common/ScreenContainer';
import { ProfileChipSelector } from '@components/profile/ProfileChipSelector';
import { UI_CONSTANTS } from '@constants/ui';

export default function VariableSelectScreen() {
  const { t } = useTranslation();
  const { colors, isTablet, responsiveFontSizes, responsiveLineHeights } = useTheme();
  const params = useLocalSearchParams();
  const router = useRouter();
  const { variables } = useVariables();
  const { profiles, validProfiles, activeProfile, profileVariables } = useProfiles();

  const selectedId = (params.selectedId as string) || '';
  /* ショートカット作成・編集画面で選んでいるプロファイル（カンマ区切り。空は全プロファイル向け） */
  const shortcutProfileIdsParam = typeof params.profileIds === 'string' ? params.profileIds : '';

  /* 参照できるのは利用者が作ったカスタム変数だけ。
     システム変数は日時などその場で決まる値で、プロファイル別の値を持たないため対象外。
     無効な変数（Free上限超過分）は選択肢に出さない（§8.18、§8.24「参照できるのは有効なカスタム変数だけ」）。
     なお既に参照している値は、変数が無効になった後もその変数の値で解決され続ける */
  const selectableVariables = variables.filter(
    (variable) => variable.type === 'custom' && variable.valid
  );

  /**
   * 変数IDごとの、プロファイル別の値
   *
   * @remarks
   * 行ごとに profileVariables を走査しないよう、1回の走査で振り分けておく。
   */
  const valuesByVariable = useMemo(() => {
    const map: Record<string, Record<string, string>> = {};
    for (const profileVariable of profileVariables) {
      const entry = map[profileVariable.variableId] ?? {};
      entry[profileVariable.profileId] = profileVariable.value;
      map[profileVariable.variableId] = entry;
    }
    return map as Readonly<Record<string, ProfileValueMap>>;
  }, [profileVariables]);

  /**
   * バッジに並べるプロファイル
   *
   * @remarks
   * ショートカット作成・編集画面で選んでいるプロファイルのうち、有効なものだけを並べる。
   * そのショートカットが使われるのは選んだプロファイルだけなので、関係の無いプロファイルの値は見せない。
   * 0件（全プロファイル向け）のときと、選んだものがすべて無効なときは、有効なプロファイルをすべて並べる。
   * 後者で空にすると、値を確認する手段が無くなるため。
   */
  const badgeProfiles = useMemo(() => {
    const selected = shortcutProfileIdsParam.split(',').filter((id) => id !== '');
    if (selected.length === 0) return validProfiles;
    const narrowed = validProfiles.filter((profile) => selected.includes(profile.id));
    return narrowed.length > 0 ? narrowed : validProfiles;
  }, [shortcutProfileIdsParam, validProfiles]);

  /**
   * 値を確認するプロファイル（バッジで切り替える）
   *
   * @remarks
   * 未選択（null）の間は、並べたプロファイルにアクティブなプロファイルがあればそれ、無ければ先頭を使う。
   * 参照した値は使うときにアクティブなプロファイルで解決されるため、最初はその結果を見せたいが、
   * アクティブがショートカットの対象外なら、対象の中の値を見せる。
   * 初期値を effect で詰めずに派生させるのは、読み込み完了時に上書きして
   * 利用者が選んだバッジを戻してしまわないため。
   * ここでの切替は確認用で、アクティブなプロファイルそのものは変えない。
   */
  const [previewProfileId, setPreviewProfileId] = useState<string | null>(null);
  const defaultBasisProfileId =
    badgeProfiles.find((profile) => profile.id === activeProfile?.id)?.id ??
    badgeProfiles[0]?.id ??
    activeProfile?.id ??
    null;
  const basisProfileId = previewProfileId ?? defaultBasisProfileId;
  const defaultProfileId = profiles.find((profile) => profile.isDefault)?.id ?? null;

  /**
   * 変数を参照したときに挿入される値を求める
   *
   * @param variable - 対象のカスタム変数
   * @returns 解決した値（どのプロファイルにも非空の値が無ければ空文字）
   *
   * @remarks
   * 解決規則は shortcuts/resolveValue が正本で、ショートカット一覧・キーボードと同じ結果になる。
   * ここで規則を書き直すと、選んだときに見えた値と実際に挿入される値がずれ得る。
   */
  const resolveVariableValue = useCallback(
    (variable: Variable): string =>
      resolveProfileValue(valuesByVariable[variable.id] ?? {}, basisProfileId, defaultProfileId),
    [valuesByVariable, basisProfileId, defaultProfileId]
  );

  /**
   * 変数を選んで呼び出し元へ返す
   *
   * @remarks
   * コールバックはここで破棄しない。呼び出し元が開くたびに張り直すため、
   * 残っていても次の選択で上書きされる（カテゴリ選択と同じ扱い）。
   */
  const handleSelect = useCallback(
    (variable: Variable) => {
      if (global.variableSelectCallback) {
        global.variableSelectCallback(variable.id);
      }
      router.back();
    },
    [router]
  );

  /* カスタム変数選択モーダル */
  return (
    <ScreenContainer
      title={t('shortcut.variable_reference_title')}
      isModal={!isTablet}
      /* 項目が多いと一覧が画面下端までスクロールするため、下辺のセーフエリアも確保する */
      edges={['top', 'left', 'right', 'bottom']}
    >
      <ScrollView style={styles.content}>
        <Text
          style={[
            styles.description,
            { color: colors.textSecondary, fontSize: responsiveFontSizes.sm },
          ]}
        >
          {t('shortcut.variable_reference_description')}
        </Text>

        {/* 値を確認するプロファイルの切替（並べるプロファイルが2件以上のときだけ表示）。
            選んだプロファイルに値が無ければ標準プロファイルの値を出すのは、
            そのプロファイルで実際に挿入される値と一致させるため。
            画面の左右の余白は ScrollView 側が持つため、チップ側の余白は0にする */}
        {selectableVariables.length > 0 && badgeProfiles.length > 1 && (
          <View style={styles.profileChips}>
            <ProfileChipSelector
              profiles={badgeProfiles}
              selectedProfileId={basisProfileId}
              onSelectProfile={setPreviewProfileId}
              containerPadding={0}
            />
          </View>
        )}

        {selectableVariables.length === 0 ? (
          /* 参照できる変数が無いことを明示する。空の一覧だけでは、
             読み込み中なのか1件も無いのかを読み取れない */
          <Text
            style={[
              styles.empty,
              { color: colors.textSecondary, fontSize: responsiveFontSizes.base },
            ]}
          >
            {t('shortcut.variable_reference_empty')}
          </Text>
        ) : (
          /* 件数は有効なカスタム変数の数に留まり（Freeは5件まで、Proでも実用上は限られる）、
             仮想化の必要が無いため、ScrollView内に並べて下地を項目の分だけの高さに収める */
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            {selectableVariables.map((variable, index) => {
              const isSelected = variable.id === selectedId;
              const isLastItem = index === selectableVariables.length - 1;
              const value = resolveVariableValue(variable);
              const isNotSet = value === '';
              /* 表示ラベルが未設定（null・空白だけ）なら変数名で見分ける。
                 型の取り決め（Variable.label は null のとき name を使う）に合わせる */
              const displayLabel = variable.label?.trim() ? variable.label : variable.name;

              return (
                <TouchableOpacity
                  key={variable.id}
                  style={[
                    styles.option,
                    !isLastItem && { borderBottomColor: colors.border, borderBottomWidth: 1 },
                  ]}
                  onPress={() => handleSelect(variable)}
                  activeOpacity={0.7}
                >
                  <View style={styles.optionLeft}>
                    {/* 表示ラベル（未設定なら変数名） */}
                    <Text
                      style={[
                        styles.name,
                        {
                          color: colors.text,
                          fontSize: responsiveFontSizes.base,
                          lineHeight: responsiveLineHeights.base,
                        },
                      ]}
                      numberOfLines={UI_CONSTANTS.NUMBER_OF_LINES.SINGLE}
                    >
                      {displayLabel}
                    </Text>
                    {/* 参照したときに挿入される値。どの変数を選ぶかを値で判断できるようにする。
                        どのプロファイルにも値が無ければ空文字が挿入されるため、未設定と明示する */}
                    <Text
                      style={[
                        styles.value,
                        {
                          color: isNotSet ? colors.textTertiary : colors.textSecondary,
                          fontSize: responsiveFontSizes.sm,
                          lineHeight: responsiveLineHeights.sm,
                          fontStyle: isNotSet ? 'italic' : 'normal',
                        },
                      ]}
                      numberOfLines={UI_CONSTANTS.NUMBER_OF_LINES.DOUBLE}
                    >
                      {isNotSet ? t('common.not_set') : value}
                    </Text>
                  </View>
                  {/* 選択中の変数のチェック */}
                  {isSelected && (
                    <Ionicons
                      name="checkmark"
                      size={UI_CONSTANTS.ICON_SIZE.SM}
                      color={colors.primary}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: UI_CONSTANTS.SPACING.BASE,
    paddingTop: UI_CONSTANTS.SPACING.BASE,
  },
  description: {
    marginBottom: UI_CONSTANTS.SPACING.BASE,
    lineHeight: 20,
  },
  profileChips: {
    marginBottom: UI_CONSTANTS.SPACING.BASE,
  },
  /* 高さは項目の分だけにする。flex:1 にすると項目が少なくても下地が画面下端まで伸びる */
  section: {
    borderRadius: UI_CONSTANTS.BORDER_RADIUS.BASE,
    overflow: 'hidden',
    marginBottom: UI_CONSTANTS.SPACING.BASE,
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: UI_CONSTANTS.GAP.BASE,
    paddingHorizontal: UI_CONSTANTS.SPACING.BASE,
    paddingVertical: UI_CONSTANTS.SPACING.BASE,
  },
  optionLeft: {
    flex: 1,
  },
  name: {
    fontWeight: UI_CONSTANTS.FONT_WEIGHT.MEDIUM,
  },
  value: {
    marginTop: UI_CONSTANTS.GAP.XXS,
  },
  empty: {
    textAlign: 'center',
    marginTop: UI_CONSTANTS.SPACING.XXL,
  },
});
