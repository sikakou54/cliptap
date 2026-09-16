/**
 * ショートカットの値のプレビュー
 *
 * ショートカット作成・編集画面の最下部に置き、編集中の値の変数トークンを
 * 選んだプロファイルで展開した結果を表示する。タップするとその値をクリップボードへコピーする。
 * プレビューからのコピーは使用回数を加算せず、DBにも触れない（docs/機能仕様書.md §8.10）。
 *
 * 【同期展開にする理由】
 * ホーム・検索の一覧と同じ useVariableExpansion（expandTextSync）で展開し、一覧に見えている文字列と一致させる。
 * コピー経路（非同期のリゾルバ）との一致は packages/shared/tests/variables/expandTextSyncParity.test.ts が固定している。
 *
 * 【accessibilityLabel を付けない理由】
 * ラベルを明示すると子のテキストが読み上げとアクセシビリティツリーから隠れ、展開後の値を確かめられなくなる。
 * 役割（button）だけを持たせ、アイコンと展開後の値をそのまま読ませる。
 *
 * 【候補と選択の規則】
 * 候補は有効なプロファイルのうち所属プロファイルに含まれるもの（未指定なら有効なプロファイル全件）。
 * 選択中のプロファイルが候補から外れたら先頭へ移し、候補が0件なら選択を外す。定型文のプレビューと同じ規則。
 * ただし選択の追従は効果での状態同期ではなく、描画時の算出で行う（下記 selectedProfileId）。
 *
 * @see apps/mobile/src/components/snippet/VariablePreview.tsx - 定型文のプレビュー（見た目と候補の規則を揃えている）
 * @see apps/mobile/src/components/shortcut/ShortcutCard.tsx - 一覧の値のブロック（組み方を揃えている）
 * @see apps/mobile/app/shortcut/edit.tsx - 使用元
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Logger,
  useProfiles,
  useTranslation,
  useVariableExpansion,
  useVariables,
  type Profile,
} from '@cliptap/shared';
import { useTheme } from '@lib/themeSystem';
import { copyToClipboard } from '@utils/clipboard';
import { UI_CONSTANTS } from '@constants/ui';

/**
 * 値のブロックの上下の余白（pt）
 *
 * 値の行高（スマートフォンで21pt）にこの余白の2倍を足して、
 * 最小タップ領域の44ptを下回らないこと（一覧の ShortcutCard と同じ計算で12×2+21=45pt）。
 */
const VALUE_VERTICAL_PADDING = UI_CONSTANTS.SPACING.BASE;

/* ========================================
   Props定義
   ======================================== */

/**
 * ShortcutPreviewのProps
 * @property value - 編集中の値（変数トークンは未展開の保存文字列）
 * @property selectedProfileIds - 選択中の所属プロファイルID（空配列は全プロファイル向け）
 */
interface ShortcutPreviewProps {
  value: string;
  selectedProfileIds: string[];
}

export function ShortcutPreview({ value, selectedProfileIds }: ShortcutPreviewProps) {
  const { t, language } = useTranslation();
  /* プレビュー候補は有効なプロファイルだけとする（定型文のプレビューと同一の扱い） */
  const { validProfiles, profileVariables, defaultProfile } = useProfiles();
  const { variables } = useVariables();
  const { colors, isTablet, responsiveFontSizes, responsiveLineHeights } = useTheme();
  /* ホーム・検索の一覧と同じ規則で展開する */
  const { expandVariables } = useVariableExpansion({
    variables,
    profileVariables,
    locale: language,
  });

  /** チップで選んだプロファイルID（未選択はnull） */
  const [requestedProfileId, setRequestedProfileId] = useState<string | null>(null);
  /** コピー完了アイコンを出しているか */
  const [isCopied, setIsCopied] = useState(false);

  /**
   * プロファイルの候補
   * 所属プロファイルがある場合はそのうち有効なもの、ない場合は有効なプロファイル全件
   */
  const filteredProfiles = useMemo(
    () =>
      selectedProfileIds.length > 0
        ? validProfiles.filter((profile: Profile) => selectedProfileIds.includes(profile.id))
        : validProfiles,
    [validProfiles, selectedProfileIds]
  );

  /**
   * 展開の基準にするプロファイルID
   *
   * @remarks
   * 候補が0件なら未選択、選んだプロファイルが候補から外れていれば先頭の候補へ倒す。
   * 候補から消えたIDを使い続けると、どのチップも選択表示にならないのに
   * 消えたプロファイルで展開してしまうため。定型文のプレビュー（VariablePreview）と同じ規則。
   *
   * 追従を効果での状態同期にしないのは、候補が変わるたびに再描画が連鎖するため
   * （react-hooks/set-state-in-effect）。描画時に決めれば、同じ規則を状態の同期なしで満たせる。
   */
  const selectedProfileId = useMemo(() => {
    if (filteredProfiles.length === 0) return null;

    if (requestedProfileId && filteredProfiles.some((profile: Profile) => profile.id === requestedProfileId)) {
      return requestedProfileId;
    }

    return filteredProfiles[0].id;
  }, [filteredProfiles, requestedProfileId]);

  /**
   * 値の展開結果
   *
   * @remarks
   * value から同じレンダリングの中で作るため、入力を書き換えるとプレビューも同時に変わる。
   * フォールバック元の標準プロファイルは、有効かどうかを問わない（§8.6）。
   */
  const expandedValue = useMemo(
    () => expandVariables(value, selectedProfileId, defaultProfile?.id ?? null),
    [value, expandVariables, selectedProfileId, defaultProfile]
  );

  /**
   * 展開した値をクリップボードにコピーする
   */
  const handleCopy = useCallback(async () => {
    /* コピー対象が無いときはクリップボードAPIを呼ばない（定型文のプレビューと同じ） */
    if (expandedValue.trim() === '') return;

    try {
      await copyToClipboard(expandedValue);
      setIsCopied(true);
    } catch (error) {
      Logger.error('Failed to copy shortcut value preview:', error);
    }
  }, [expandedValue]);

  /**
   * コピー完了アイコンの自動リセット
   *
   * @remarks
   * クリーンアップでタイマーを解除するのは、アンマウント後や次のコピーで表示が切り替わった後に
   * 前回のタイマーが発火して表示を戻してしまわないようにするため。
   */
  useEffect(() => {
    if (!isCopied) return;

    const timeoutId = setTimeout(() => {
      setIsCopied(false);
    }, UI_CONSTANTS.COPY_SUCCESS_DURATION_MS);

    return () => clearTimeout(timeoutId);
  }, [isCopied]);

  /* ショートカットの値のプレビューボックス */
  return (
    <View style={[styles.previewBox, { backgroundColor: colors.card, borderColor: colors.primary }]}>
      {/* ヘッダー（ラベルとプロファイル選択） */}
      <View style={styles.header}>
        {/* プレビューラベル */}
        <Text
          style={[
            styles.label,
            { color: colors.primary, fontSize: responsiveFontSizes.xs, lineHeight: responsiveLineHeights.xs },
          ]}
        >
          {t('common.preview')}
        </Text>

        {/* プロファイル選択（候補のプロファイルのみ表示） */}
        {filteredProfiles.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.profileSelector}
            contentContainerStyle={styles.profileSelectorContent}
          >
            {filteredProfiles.map((profile: Profile) => {
              const isSelected = selectedProfileId === profile.id;
              /* プロファイルチップ */
              return (
                <TouchableOpacity
                  key={profile.id}
                  style={[
                    styles.profileChip,
                    { borderColor: isSelected ? colors.primary : colors.border },
                    isSelected && { backgroundColor: colors.primary },
                  ]}
                  onPress={() => setRequestedProfileId(profile.id)}
                >
                  <Text
                    style={[
                      styles.profileChipText,
                      {
                        color: isSelected ? colors.onPrimary : colors.textSecondary,
                        fontSize: responsiveFontSizes.xs,
                      },
                    ]}
                  >
                    {profile.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* 値の展開結果（タップでコピーする。展開結果が空のときは操作できない） */}
      <TouchableOpacity
        style={styles.valueRow}
        onPress={handleCopy}
        disabled={expandedValue.trim() === ''}
        activeOpacity={0.7}
        accessibilityRole="button"
      >
        {/* 変数を展開した値。長い値も全体を確かめてからコピーできるよう行数を制限しない
            （展開結果が空の場合は空状態メッセージ）。
            コピーアイコンは値の文字の末尾へ続けて置くため、同じText内に入れる（一覧の ShortcutCard と同じ） */}
        <Text
          style={[
            styles.valueText,
            {
              color: expandedValue.trim() === '' ? colors.textTertiary : colors.text,
              fontSize: responsiveFontSizes.sm,
              lineHeight: responsiveLineHeights.sm,
            },
          ]}
        >
          {expandedValue.trim() === '' ? t('common.preview_empty') : expandedValue}
          {/* 展開結果が空のときはコピーできないためアイコンを出さない。
              文字とアイコンの間隔は空白で作る。Textの中に置いたアイコンには余白の指定が効かない */}
          {expandedValue.trim() !== '' && (
            <>
              {' '}
              <Ionicons
                name={isCopied ? 'checkmark' : 'copy-outline'}
                size={isTablet ? 18 : 14}
                color={isCopied ? colors.success : colors.textSecondary}
              />
            </>
          )}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  previewBox: {
    padding: UI_CONSTANTS.GAP.BASE,
    borderRadius: UI_CONSTANTS.BORDER_RADIUS.BASE,
    borderWidth: UI_CONSTANTS.BORDER_WIDTH.THICK,
  },
  header: {
    marginBottom: UI_CONSTANTS.GAP.MD,
  },
  label: {
    fontWeight: UI_CONSTANTS.FONT_WEIGHT.BOLD,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  profileSelector: {
    marginTop: UI_CONSTANTS.GAP.MD,
  },
  profileSelectorContent: {
    gap: UI_CONSTANTS.GAP.MD,
  },
  /**
   * プロファイルチップ
   *
   * 角丸・余白は定型文のプレビュー（VariablePreview）のチップと同一トークンに揃えている。
   * 非選択時に背景を敷かないのは、親の previewBox が colors.card を敷いており、
   * colors.surface を重ねると二重背景になるため。
   */
  profileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: UI_CONSTANTS.GAP.BASE,
    paddingVertical: UI_CONSTANTS.GAP.SM,
    borderRadius: UI_CONSTANTS.BORDER_RADIUS.XL,
    borderWidth: UI_CONSTANTS.BORDER_WIDTH.THIN,
    gap: UI_CONSTANTS.GAP.XS,
  },
  profileChipText: {
    fontWeight: UI_CONSTANTS.FONT_WEIGHT.SEMIBOLD,
  },
  /* 値のブロック全体をタップ対象にする。高さは上下の余白で確保する */
  valueRow: {
    paddingVertical: VALUE_VERTICAL_PADDING,
  },
  valueText: {
    fontFamily: 'monospace',
  },
});
