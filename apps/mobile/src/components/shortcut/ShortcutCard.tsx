/**
 * ショートカットカード
 *
 * 1件のショートカットを表すカード。定型文カード（SnippetCard）と同じ見た目・操作に揃える。
 * 値の行はタップでその値だけをクリップボードへコピーする。
 *
 * 【開閉式にする理由】
 * 値の件数は利用者のデータ次第で増える。全件を常に出すと1件のショートカットが
 * 画面を埋めてしまい、一覧として見渡せなくなる。
 * 定型文カードが本文を2行で畳むのと同じ考え方で、既定では数件だけを見せる。
 *
 * 【1件でも同じ行の形にする理由】
 * 値が1件のときだけ別の見せ方にすると、同じカードでも件数で操作が変わる。
 * 件数によらず「行をタップするとその値がコピーされる」1つの規則で通す。
 *
 * 【行全体ではなく「・・・」メニューから編集へ進む理由】
 * カードの中に「タップでコピー」する値の行があるため、カード全体もタップ対象にすると
 * どちらが起きるのか押す前に分からない。編集と削除は右上の「・・・」メニューに寄せる。
 *
 * @see apps/mobile/src/components/snippet/SnippetCard.tsx - 定型文側の同じ役割のコンポーネント
 * @see apps/mobile/src/components/shortcut/ShortcutList.tsx - 使用元
 */

import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '@cliptap/shared';
import { useTheme } from '@lib/themeSystem';
import { type Category, type Shortcut, type ShortcutValue, type ShortcutWithDisplay } from '@cliptap/shared';
import { CategoryBadge } from '@components/category/CategoryBadge';
import { ItemActionMenu } from '@components/common/ItemActionMenu';
import { ShortcutValueRow } from '@components/shortcut/ShortcutValueRow';
import { UI_CONSTANTS } from '@constants/ui';

/**
 * 畳んでいるときに見せる値の件数
 *
 * @remarks
 * 定型文カードが本文を2行で畳むのに合わせ、同じだけの高さに収まる件数にする。
 */
const COLLAPSED_VALUE_COUNT = 2;

/* ========================================
   Props定義
   ======================================== */

/**
 * ShortcutCardのProps
 * @property shortcut - 表示するショートカット（値は表示中のプロファイルで展開した表示用の文字列を持つ）
 * @property category - 所属カテゴリ（未分類ならnull）
 * @property onCopyValue - 値がタップされたときのコールバック（クリップボードへコピー）
 * @property onEdit - メニューで「編集」が選ばれたときのコールバック
 * @property onDelete - メニューで「削除」が選ばれたときのコールバック（確認ダイアログは呼び出し側が出す）
 * @property isLast - 一覧の最後の項目か（区切り線を引くかの判定に使う）
 */
interface ShortcutCardProps {
  shortcut: ShortcutWithDisplay;
  category: Category | null;
  onCopyValue: (value: ShortcutValue, profileId: string | null) => Promise<void>;
  /** この行に対応するプロファイル名（横断検索のときだけ渡す。通常の一覧では出さない） */
  profileLabel?: string | null;
  /** 値をコピーするときに展開の基準にするプロファイル（横断検索のときだけ渡す） */
  copyProfileId?: string | null;
  onEdit: (shortcut: Shortcut) => void;
  onDelete: (shortcut: Shortcut) => void;
  isLast: boolean;
}

function ShortcutCardComponent({
  shortcut,
  category,
  onCopyValue,
  profileLabel,
  copyProfileId,
  onEdit,
  onDelete,
  isLast,
}: ShortcutCardProps) {
  const { t } = useTranslation();
  const { colors, isTablet, responsive, responsiveFontSizes } = useTheme();

  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  /**
   * 値をコピーする
   *
   * @remarks
   * 横断検索では行ごとに展開の基準プロファイルが違うため、行が持つプロファイルを添えて渡す。
   * 通常の一覧はプロファイルを持たないため null を渡し、呼び出し側の既定（アクティブ環境）に任せる。
   */
  const handleCopyValue = useCallback(
    (value: ShortcutValue) => onCopyValue(value, copyProfileId ?? null),
    [onCopyValue, copyProfileId]
  );

  /* 畳んでいるときに隠れている値があるか（無ければ開閉ボタンを出さない） */
  const hasHiddenValues = shortcut.values.length > COLLAPSED_VALUE_COUNT;
  const visibleValues = isExpanded
    ? shortcut.values
    : shortcut.values.slice(0, COLLAPSED_VALUE_COUNT);

  return (
    <View
      style={[
        styles.card,
        /* 区切り線は項目と項目の間にだけ引く。最後にも引くと一覧の終わりに線が残り、
           下の余白や広告と切り離されて見える */
        !isLast && { borderBottomWidth: UI_CONSTANTS.BORDER_WIDTH.THIN, borderBottomColor: colors.border },
      ]}
    >
      {/* メインコンテンツエリア。下端の開閉ボタンを出すときだけ、その領域を空ける */}
      <View
        style={[
          styles.mainContent,
          { padding: responsive.card.padding },
          hasHiddenValues && { paddingBottom: 60 },
        ]}
      >
        {/* 名前の行。ショートカット名と、右端の「・・・」メニュー */}
        <View style={styles.nameRow}>
          {/* ショートカット名 */}
          <Text
            style={[
              styles.name,
              {
                color: colors.text,
                fontSize: responsiveFontSizes.base,
              },
            ]}
            numberOfLines={UI_CONSTANTS.NUMBER_OF_LINES.SINGLE}
            ellipsizeMode="tail"
          >
            {shortcut.name}
          </Text>

          {/* 「・・・」メニュー（編集・削除） */}
          <ItemActionMenu
            itemName={shortcut.name}
            onEdit={() => onEdit(shortcut)}
            onDelete={() => onDelete(shortcut)}
          />
        </View>

        {/* カテゴリバッジと、横断検索のときだけ添えるプロファイル名。
            同じショートカットがプロファイルごとの展開結果に分かれて並ぶため、どの環境の結果かを示す（§8.7） */}
        {(category !== null || profileLabel) && (
          <View style={styles.badgeRow}>
            {category !== null && <CategoryBadge category={category} size="small" />}
            {profileLabel && (
              <View style={[styles.profileBadge, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <Text style={[styles.profileBadgeText, { color: colors.textSecondary, fontSize: responsiveFontSizes.xs }]}>
                  {profileLabel}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* 登録されている値（タップでその値だけをコピーする） */}
        <View>
          {visibleValues.map((value) => (
            <ShortcutValueRow key={value.id} value={value} onCopy={handleCopyValue} />
          ))}
        </View>
      </View>

      {/* 展開ボタン。畳んでも全件見えているときは出さない */}
      {hasHiddenValues && (
        <TouchableOpacity
          style={[
            styles.roundButton,
            styles.expandButton,
            { borderColor: colors.border },
          ]}
          onPress={toggleExpanded}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={isExpanded ? t('common.collapse') : t('common.expand')}
        >
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={isTablet ? 22 : 18}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
      )}
    </View>
  );
}

/**
 * メモ化されたショートカットカード
 *
 * FlashList のパフォーマンス最適化のため、表示に効く値が変わったときだけ再描画する。
 */
export const ShortcutCard = React.memo(ShortcutCardComponent, (prevProps, nextProps) => {
  return (
    prevProps.shortcut.id === nextProps.shortcut.id &&
    prevProps.isLast === nextProps.isLast &&
    prevProps.shortcut.updatedAt === nextProps.shortcut.updatedAt &&
    prevProps.shortcut.name === nextProps.shortcut.name &&
    prevProps.shortcut.categoryId === nextProps.shortcut.categoryId &&
    prevProps.shortcut.values === nextProps.shortcut.values &&
    prevProps.category?.id === nextProps.category?.id &&
    prevProps.profileLabel === nextProps.profileLabel &&
    prevProps.copyProfileId === nextProps.copyProfileId
  );
});

const styles = StyleSheet.create({
  /* フラットデザイン。カードの枠・角丸・下地を持たず、下端の区切り線だけで項目を分ける
     （定型文カード SnippetCard.card と同じ扱い） */
  card: {
    overflow: 'hidden',
  },
  mainContent: {
    gap: UI_CONSTANTS.GAP.SM,
  },
  /* 名前と「・・・」メニューを横に並べる（定型文カード SnippetCard.titleRow と同じ間隔） */
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: UI_CONSTANTS.GAP.LG,
  },
  name: {
    flex: 1,
    fontWeight: UI_CONSTANTS.FONT_WEIGHT.SEMIBOLD,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: UI_CONSTANTS.GAP.XS,
    marginTop: UI_CONSTANTS.GAP.XS,
  },
  /* プロファイル名のバッジ。定型文カード（SnippetCard.profileBadge）と同じ見た目に揃える */
  profileBadge: {
    paddingHorizontal: UI_CONSTANTS.GAP.XS,
    paddingVertical: 2,
    borderRadius: UI_CONSTANTS.BORDER_RADIUS.SM,
    borderWidth: UI_CONSTANTS.BORDER_WIDTH.THIN,
  },
  profileBadgeText: {
    fontWeight: UI_CONSTANTS.FONT_WEIGHT.MEDIUM,
  },
  expandButton: {
    position: 'absolute',
    left: UI_CONSTANTS.GAP.MD,
    bottom: UI_CONSTANTS.GAP.MD,
  },
  /* 定型文カードの操作ボタン（SnippetCard.roundButton）と同じ寸法に揃える */
  roundButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: UI_CONSTANTS.BORDER_WIDTH.THIN,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
