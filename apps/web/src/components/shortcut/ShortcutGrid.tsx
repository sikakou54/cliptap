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
      /* 空状態は定型文（EmptySnippetGrid）と同じ出し方に揃える。
         枠や下地を持たせず、画面の背景の上にアイコンと文言だけを置く */
      <div className="mt-12 text-center text-gray-500 dark:text-[#A0A0A0]">
        {/* 空状態アイコン（ショートカットを表す稲妻。ListModeToggleと同じ形） */}
        <svg
          className="mx-auto h-16 w-16 text-gray-300 dark:text-[#707070]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        {/* 空状態メッセージ */}
        <p className="mt-4">{t('shortcut.empty')}</p>
        {/* 追加方法の案内は、追加ボタンが見えている画面でだけ出す */}
        {showEmptyHint && <p className="mt-2 text-sm">{t('shortcut.empty_hint')}</p>}
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
            copyProfileId={shortcut.copyProfileId}
            onEdit={() => onEdit(shortcut)}
            onDelete={() => onDelete(shortcut)}
          />
        );
      })}
    </div>
  );
}
