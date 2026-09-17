import { useMemo } from 'react';
import { useTranslation, type Category, type ShortcutValueWithDisplay, type ShortcutWithDisplay } from '@cliptap/shared';
import { ShortcutCard } from './ShortcutCard';

interface ShortcutGridProps {
  shortcuts: ShortcutWithDisplay[];
  gridColumns: 1 | 2 | 3;
  copiedValueId: string | null;
  categories: Category[];
  onCopyValue: (value: ShortcutValueWithDisplay) => void;
  onEdit: (shortcut: ShortcutWithDisplay) => void;
  onDelete: (shortcut: ShortcutWithDisplay) => void;
}

export function ShortcutGrid({
  shortcuts,
  gridColumns,
  copiedValueId,
  categories,
  onCopyValue,
  onEdit,
  onDelete,
}: ShortcutGridProps) {
  const { t } = useTranslation();
  const categoryMap = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);

  if (shortcuts.length === 0) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center dark:border-[#333333] dark:bg-[#1A1A1A]">
        <p className="font-semibold text-gray-700 dark:text-gray-300">{t('shortcut.empty')}</p>
        <p className="mt-2 text-sm text-gray-500 dark:text-[#A0A0A0]">{t('shortcut.empty_hint')}</p>
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
            key={shortcut.id}
            shortcut={shortcut}
            copiedValueId={copiedValueId}
            categoryColor={category?.color ?? null}
            categoryName={category?.name ?? null}
            onCopyValue={onCopyValue}
            onEdit={() => onEdit(shortcut)}
            onDelete={() => onDelete(shortcut)}
          />
        );
      })}
    </div>
  );
}
