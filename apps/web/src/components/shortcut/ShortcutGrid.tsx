import { useMemo } from 'react';
import { useTranslation, type Category, type ShortcutValueWithDisplay, type ShortcutWithDisplay } from '@cliptap/shared';
import { ShortcutCard } from './ShortcutCard';

/**
 * グリッドに並べる項目
 *
 * @remarks
 * 検索画面の横断検索では、同じショートカットがプロファイルごとの展開結果に分かれて
 * 複数行になる（§8.7）。定型文グリッド（SnippetGridItem）と同じ考え方で任意項目を持つ。
 */
export type ShortcutGridItem = ShortcutWithDisplay & {
  /** 行を一意にする値（横断検索のときだけ入る） */
  rowKey?: string;
  /** この行に対応するプロファイル名（横断検索のときだけ入る） */
  profileLabel?: string | null;
  /** 値をコピーするときに展開の基準にするプロファイル（横断検索のときだけ入る） */
  copyProfileId?: string | null;
};

interface ShortcutGridProps {
  shortcuts: ShortcutGridItem[];
  gridColumns: 1 | 2 | 3;
  copiedValueId: string | null;
  categories: Category[];
  onCopyValue: (value: ShortcutValueWithDisplay, profileId: string | null) => void;
  onEdit: (shortcut: ShortcutWithDisplay) => void;
  onDelete: (shortcut: ShortcutWithDisplay) => void;
  /** 0件のときに追加方法の案内を添えるか（既定true）。検索画面では追加ボタンが見えないためfalseにする */
  showEmptyHint?: boolean;
}

export function ShortcutGrid({
  shortcuts,
  gridColumns,
  copiedValueId,
  categories,
  onCopyValue,
  onEdit,
  onDelete,
  showEmptyHint = true,
}: ShortcutGridProps) {
  const { t } = useTranslation();
  const categoryMap = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);

  if (shortcuts.length === 0) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center dark:border-[#333333] dark:bg-[#1A1A1A]">
        <p className="font-semibold text-gray-700 dark:text-gray-300">{t('shortcut.empty')}</p>
        {/* 追加方法の案内は、追加ボタンが見えている画面でだけ出す */}
        {showEmptyHint && <p className="mt-2 text-sm text-gray-500 dark:text-[#A0A0A0]">{t('shortcut.empty_hint')}</p>}
      </div>
    );
  }

  const gridClass = `grid items-start gap-4 pb-20 ${
    gridColumns === 1 ? 'grid-cols-1' : gridColumns === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
  }`;

  return (
    <div className={gridClass}>
      {shortcuts.map((shortcut) => {
        const category = shortcut.categoryId ? categoryMap.get(shortcut.categoryId) ?? null : null;
        return (
          <ShortcutCard
            /* 横断検索では同じショートカットが複数行に分かれるため、IDだけでは重複する */
            key={shortcut.rowKey ?? shortcut.id}
            shortcut={shortcut}
            copiedValueId={copiedValueId}
            categoryColor={category?.color ?? null}
            categoryName={category?.name ?? null}
            onCopyValue={onCopyValue}
            profileLabel={shortcut.profileLabel}
            copyProfileId={shortcut.copyProfileId}
            onEdit={() => onEdit(shortcut)}
            onDelete={() => onDelete(shortcut)}
          />
        );
      })}
    </div>
  );
}
