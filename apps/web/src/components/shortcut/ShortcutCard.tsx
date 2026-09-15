import { useTranslation, type ShortcutValueWithDisplay, type ShortcutWithDisplay } from '@cliptap/shared';
import { CATEGORY_FALLBACK_COLOR } from '@utils/categoryColor';

interface ShortcutCardProps {
  shortcut: ShortcutWithDisplay;
  copiedValueId: string | null;
  categoryColor: string | null;
  categoryName: string | null;
  onCopyValue: (value: ShortcutValueWithDisplay) => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function ShortcutCard({
  shortcut,
  copiedValueId,
  categoryColor,
  categoryName,
  onCopyValue,
  onEdit,
  onDelete,
}: ShortcutCardProps) {
  const { t } = useTranslation();
  const badgeColor = categoryColor || CATEGORY_FALLBACK_COLOR;

  return (
    <div
      className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-[#2A2A2A] dark:bg-[#1A1A1A]"
      style={{ borderLeftWidth: categoryColor ? '4px' : undefined, borderLeftColor: categoryColor || undefined }}
    >
      <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-4">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-gray-900 dark:text-white">{shortcut.name}</h3>
          {categoryName && (
            <span className="mt-2 inline-block rounded-md px-1.5 py-[3px] text-xs font-medium" style={{ backgroundColor: `${badgeColor}20`, color: badgeColor }}>
              {categoryName}
            </span>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          <button type="button" onClick={onEdit} className="min-h-10 min-w-10 rounded-full text-gray-500 hover:bg-gray-100 dark:text-[#A0A0A0] dark:hover:bg-[#2A2A2A]" aria-label={t('common.edit')}>
            <svg className="mx-auto h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 13H9v-2.828l6.586-6.586z" /></svg>
          </button>
          <button type="button" onClick={onDelete} className="min-h-10 min-w-10 rounded-full text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20" aria-label={t('common.delete')}>
            <svg className="mx-auto h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>
      </div>

      <div className="border-t border-gray-100 dark:border-[#2A2A2A]">
        {shortcut.values.map((value, index) => {
          const copied = copiedValueId === value.id;
          return (
            <button
              type="button"
              key={value.id}
              onClick={() => onCopyValue(value)}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 ${index > 0 ? 'border-t border-gray-100 dark:border-[#2A2A2A]' : ''}`}
              title={t('common.copy')}
            >
              <span className="w-24 shrink-0 truncate text-sm font-medium text-gray-700 dark:text-gray-300">{value.name}</span>
              <span className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm text-gray-500 dark:text-[#A0A0A0]">{value.displayValue}</span>
              <span className={copied ? 'text-emerald-500' : 'text-blue-600 dark:text-blue-400'}>
                {copied ? (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
