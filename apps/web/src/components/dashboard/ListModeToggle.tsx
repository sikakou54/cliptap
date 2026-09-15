import { useTranslation } from '@cliptap/shared';

export type WebListMode = 'snippet' | 'shortcut';

interface ListModeToggleProps {
  mode: WebListMode;
  onChange: (mode: WebListMode) => void;
}

export function ListModeToggle({ mode, onChange }: ListModeToggleProps) {
  const { t } = useTranslation();
  return (
    <div className="flex rounded-lg bg-gray-100 p-1 dark:bg-[#2A2A2A]">
      <button type="button" onClick={() => onChange('snippet')} className={`rounded-md px-3 py-1.5 text-sm font-medium ${mode === 'snippet' ? 'bg-white text-blue-600 shadow-sm dark:bg-[#1A1A1A] dark:text-blue-400' : 'text-gray-500 dark:text-[#A0A0A0]'}`}>
        {t('shortcut.show_snippets')}
      </button>
      <button type="button" onClick={() => onChange('shortcut')} className={`rounded-md px-3 py-1.5 text-sm font-medium ${mode === 'shortcut' ? 'bg-white text-blue-600 shadow-sm dark:bg-[#1A1A1A] dark:text-blue-400' : 'text-gray-500 dark:text-[#A0A0A0]'}`}>
        {t('shortcut.show_shortcuts')}
      </button>
    </div>
  );
}
