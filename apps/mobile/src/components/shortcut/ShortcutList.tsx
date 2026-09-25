/**
 * ショートカット一覧コンポーネント
 *
 * ホーム画面と検索画面でショートカットをカード形式で表示する一覧。
 * 1件分の中身と操作は ShortcutCard が持つ。
 *
 * 【定型文の一覧と同じ作りに揃える理由】
 * 同じ位置の一覧を切替トグルで入れ替えて使うため、カードの並びや余白が違うと
 * 切り替えたときに画面が飛んだように見える。
 *
 * @see apps/mobile/src/components/snippet/SnippetList.tsx - 定型文側の同じ役割のコンポーネント
 * @see apps/mobile/src/components/shortcut/ShortcutCard.tsx - 1件分のカード
 * @see apps/mobile/app/index.tsx - ホーム画面での使用
 * @see apps/mobile/app/search.tsx - 検索画面での使用
 */

import { useCallback, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from '@cliptap/shared';
import { FlashList, ListRenderItemInfo } from '@mobile-types/flashlist';
import { useTheme } from '@lib/themeSystem';
import { type Category, type Shortcut, type ShortcutValue, type ShortcutWithDisplay } from '@cliptap/shared';
import EmptyState from '@components/common/EmptyState';
import { ShortcutCard } from '@components/shortcut/ShortcutCard';

/* ========================================
   Props定義
   ======================================== */

/**
 * ShortcutListのProps
 * @property shortcuts - 表示するショートカット一覧（表示順。値は表示中のプロファイルで展開した表示用の文字列を持つ）
 * @property categories - カテゴリバッジの解決に使う全カテゴリ
 * @property onCopyValue - 値がタップされたときのコールバック（クリップボードへコピー）
 * @property onEdit - カードのメニューで「編集」が選ばれたときのコールバック
 * @property onDelete - カードのメニューで「削除」が選ばれたときのコールバック（確認ダイアログは呼び出し側が出す）
 * @property onRefresh - 引き下げ更新のコールバック
 */
/**
 * 一覧に並べる項目
 *
 * @remarks
 * 検索画面の横断検索では、同じショートカットがプロファイルごとの展開結果に分かれて
 * 複数行になる（§8.7）。IDだけでは行を区別できないため、行を示す値・行のプロファイル名・
 * コピーの基準にするプロファイルを任意項目として持つ。
 */
export type ShortcutListItem = ShortcutWithDisplay & {
  /** 行を一意にする値（横断検索のときだけ入る） */
  rowKey?: string;
  /** 値をコピーするときに展開の基準にするプロファイル（横断検索のときだけ入る） */
  copyProfileId?: string | null;
};

interface ShortcutListProps {
  shortcuts: ShortcutListItem[];
  categories: Category[];
  onCopyValue: (value: ShortcutValue, profileId: string | null) => Promise<void>;
  onEdit: (shortcut: Shortcut) => void;
  onDelete: (shortcut: Shortcut) => void;
  onRefresh: () => void;
  /** 0件のときに「＋ボタンから追加」の案内を出すか（既定: true） */
  showEmptyHint?: boolean;
}

export function ShortcutList({
  shortcuts,
  categories,
  onCopyValue,
  onEdit,
  onDelete,
  onRefresh,
  showEmptyHint = true,
}: ShortcutListProps) {
  const { t } = useTranslation();
  const { isTablet, responsiveSpacing } = useTheme();

  /* タブレットは2カラム（定型文一覧と同じ） */
  const numColumns = isTablet ? 2 : 1;
  const columnGap = responsiveSpacing.cardGap;

  /* カードごとにfindで走査すると件数に比例して遅くなるため、IDで引ける形にしておく */
  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  );

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<ShortcutListItem>) => {
      /* 未分類、またはカテゴリが削除された直後はバッジを出さない */
      const category = item.categoryId ? categoryMap.get(item.categoryId) ?? null : null;

      /* ショートカットカードラッパー（タブレットでは2カラム表示） */
      return (
        <View
          style={[
            styles.cardWrapper,
            {
              width: isTablet ? '50%' : '100%',
              paddingRight: isTablet && index % 2 === 0 ? columnGap : 0,
            },
          ]}
        >
          <ShortcutCard
            shortcut={item}
            category={category}
            onCopyValue={onCopyValue}
            copyProfileId={item.copyProfileId}
            onEdit={onEdit}
            onDelete={onDelete}
            isLast={index === shortcuts.length - 1}
          />
        </View>
      );
    },
    [categoryMap, isTablet, columnGap, shortcuts.length, onCopyValue, onEdit, onDelete]
  );

  if (shortcuts.length === 0) {
    /* 空状態（ショートカットが無い、またはカテゴリ・検索語で絞り込んで0件になった場合）。
       追加の導線はヘッダーの＋ボタンなので、そこへ誘導する文言をそのまま使う。
       検索画面には＋ボタンが無いため、案内は呼び出し側で止める（WebのShortcutGridと同じ） */
    return (
      <View style={styles.emptyContainer}>
        <EmptyState
          icon="flash-outline"
          message={t('shortcut.empty')}
          description={showEmptyHint ? t('shortcut.empty_hint') : undefined}
        />
      </View>
    );
  }

  /* ショートカット一覧コンテナ */
  return (
    <View style={styles.listStyle}>
      {/* FlashList: FlatListの代替として使用（大量データでも高速） */}
      <FlashList<ShortcutListItem>
        /* 検索画面ではキーボードが出たままカードを操作する。既定のままだと最初のタップが
           キーボードを閉じるだけで消費され、コピーや「・・・」が1回では効かない */
        keyboardShouldPersistTaps="handled"
        data={shortcuts}
        estimatedItemSize={140}
        renderItem={renderItem}
        /* 横断検索では同じショートカットが複数行に分かれるため、IDだけでは重複する */
        keyExtractor={(item) => item.rowKey ?? item.id}
        contentContainerStyle={{
          paddingHorizontal: responsiveSpacing.containerPadding,
          paddingBottom: responsiveSpacing.sectionGap,
          paddingTop: 8,
        }}
        numColumns={numColumns}
        key={numColumns}
        refreshing={false}
        onRefresh={onRefresh}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  listStyle: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  /* フラットデザインでは項目を区切り線で分けるため、項目間の余白は持たない */
  cardWrapper: {
    marginBottom: 0,
  },
});
