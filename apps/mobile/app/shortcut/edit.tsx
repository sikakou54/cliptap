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
 * - 値の変数展開結果のプレビュー（プロファイル切替・値ごとのコピー。値一覧は保存する文字列のまま表示）
 *
 * @see src/hooks/screens/useShortcutEditScreen.ts - ビジネスロジック
 * @see src/components/shortcut/ShortcutPreview.tsx - 値のプレビュー
 * @see app/profile/select.tsx - プロファイル選択画面（定型文フォームと共有）
 * @see docs/機能仕様書.md §8.24 ショートカット管理
 */

import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { getProfileSelectPlaceholder, useTranslation } from '@cliptap/shared';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@lib/themeSystem';
import { MASKED_VALUE_TEXT } from '@cliptap/shared';
import { useShortcutEditScreen } from '@hooks/screens/useShortcutEditScreen';
import { CategoryBadge } from '@components/category/CategoryBadge';
import { ScreenContainer } from '@components/common/ScreenContainer';
import { ShortcutPreview } from '@components/shortcut/ShortcutPreview';
import { UI_CONSTANTS } from '@constants/ui';

/**
 * 値の行に重ねる丸ボタンの下地の不透明度（16進のアルファ）
 *
 * 下地を不透明にすると、隠れた分の値が読めなくなる。
 * 逆に薄くしすぎるとアイコンの線と値の文字が混ざるため、値が透けて読める濃さで止める。
 */
const VALUE_ICON_BADGE_ALPHA = '99';

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
    handleToggleValueMask,
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
                {/* 挿入する値。保存する文字列のまま表示し、変数トークンは展開しない
                    （展開結果は画面下部のプレビューで確かめる。定型文フォームの入力欄とプレビューと同じ分担）。
                    伏せている値はこの画面でも記号に置き換える。見たいときは目のボタンで戻す。
                    1行に固定するのは、値の長さで箱の高さが変わらないようにするため。
                    収まらない分は末尾を省略し、全文は値の編集画面とプレビューで確かめる */}
                <Text
                  style={[
                    styles.valueText,
                    {
                      color: colors.text,
                      fontSize: responsiveFontSizes.base,
                      lineHeight: responsiveLineHeights.base,
                    },
                  ]}
                  numberOfLines={UI_CONSTANTS.NUMBER_OF_LINES.SINGLE}
                >
                  {draft.isMasked ? MASKED_VALUE_TEXT : draft.value}
                </Text>

                {/* 目・削除のボタン。横並びの列としては場所を取らせず、箱の右端へ重ねて置く
                    （値の文字が箱の幅をすべて使えるようにするため。位置はこれまでと同じ右端・縦中央） */}
                <View style={styles.valueActions}>
                  {/* 表示を伏せるかの切り替え。ここで決めた状態は一覧・プレビュー・拡張キーボードにも効く */}
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      handleToggleValueMask(draft);
                    }}
                    hitSlop={UI_CONSTANTS.HIT_SLOP.DEFAULT}
                    style={[
                      styles.valueIconButton,
                      {
                        backgroundColor: colors.surfaceElevated + VALUE_ICON_BADGE_ALPHA,
                        borderColor: colors.border,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={
                      draft.isMasked ? t('shortcut.unmask_value') : t('shortcut.mask_value')
                    }
                  >
                    <Ionicons
                      name={draft.isMasked ? 'eye-off-outline' : 'eye-outline'}
                      size={UI_CONSTANTS.ICON_SIZE.SM}
                      color={draft.isMasked ? colors.primary : colors.textSecondary}
                    />
                  </TouchableOpacity>

                  {/* 削除ボタン */}
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      handleDeleteValue(draft);
                    }}
                    hitSlop={UI_CONSTANTS.HIT_SLOP.DEFAULT}
                    style={[
                      styles.valueIconButton,
                      {
                        backgroundColor: colors.surfaceElevated + VALUE_ICON_BADGE_ALPHA,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Ionicons name="trash-outline" size={UI_CONSTANTS.ICON_SIZE.SM} color={colors.error} />
                  </TouchableOpacity>
                </View>
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

        {/* 値のプレビュー（選んだプロファイルで変数を展開した結果を値ごとに表示し、行のタップでその値だけをコピーする）。
            定型文フォームの VariablePreview と同じく画面の最下部に置く */}
        <ShortcutPreview values={values} selectedProfileIds={profileIds} />
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
     値は1行に固定するため、箱の高さは値の長さによらず一定になる。
     下地の色はテーマに従うため描画時に渡す */
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: UI_CONSTANTS.BORDER_RADIUS.BASE,
    padding: UI_CONSTANTS.SPACING.BASE,
    minHeight: UI_CONSTANTS.BUTTON_HEIGHT.MEDIUM,
  },
  /* 保存する文字列をそのまま出すため、一覧・プレビューと同じ等幅で表示する。
     目・削除のボタンは箱へ重ねて置くため、値の文字は箱の幅をすべて使う */
  valueText: {
    flex: 1,
    fontFamily: 'monospace',
  },
  /* 目・削除のボタンを箱の右端へ重ねる。
     上下いっぱいに広げて縦中央へ揃えるのは、値が2行になって箱が高くなっても位置が変わらないようにするため。
     右の位置を箱の余白（valueRow.padding）と同じにして、重ねる前と同じ位置に見せる */
  valueActions: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: UI_CONSTANTS.SPACING.BASE,
    flexDirection: 'row',
    alignItems: 'center',
    gap: UI_CONSTANTS.GAP.MD,
  },
  /* 値の文字の上に重なるため、下地と枠線を持つ丸いボタンにする（定型文カードの丸ボタンと同じ形）。
     下地が無いと重なった文字とアイコンの線が混ざって読み取れず、不透明にすると隠れた値が読めない。
     そのため下地は半透明にする（VALUE_ICON_BADGE_ALPHA）。
     下地の色と枠線の色はテーマに従うため描画時に渡す */
  valueIconButton: {
    width: UI_CONSTANTS.SIZE.ICON_CONTAINER_MD,
    height: UI_CONSTANTS.SIZE.ICON_CONTAINER_MD,
    borderRadius: UI_CONSTANTS.SIZE.ICON_CONTAINER_MD / 2,
    borderWidth: UI_CONSTANTS.BORDER_WIDTH.THIN,
    alignItems: 'center',
    justifyContent: 'center',
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
