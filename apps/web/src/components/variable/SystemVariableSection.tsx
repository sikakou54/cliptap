/**
 * システム変数セクションコンポーネント
 *
 * @description
 * システム提供の変数（DATE、TIME等）一覧を表示。
 * これらの変数は読み取り専用で、編集・削除不可。
 */
import { useState } from 'react';
import {
  DEFAULT_SYSTEM_VARIABLE_FORMATS,
  SystemVariableFormatService,
  formatByPattern,
  normalizeLocale,
  type SystemVariableFormats,
  type SystemVariableKey,
  useTranslation,
} from '@cliptap/shared';
import { SystemVariableItem } from './SystemVariableItem';
import { SystemVariableFormatModal } from './SystemVariableFormatModal';
import type { SystemVariable } from '@hooks/screens/useVariablesScreen';
import { showConfirm } from '@utils/alerts';

interface SystemVariableSectionProps {
  systemVariables: readonly SystemVariable[];
}

export function SystemVariableSection({ systemVariables }: SystemVariableSectionProps) {
  const { t } = useTranslation();
  const [formats, setFormats] = useState<SystemVariableFormats>(() => (
    SystemVariableFormatService.loadRegistry()
  ));
  const [editingKey, setEditingKey] = useState<SystemVariableKey | null>(null);
  const locale = normalizeLocale(navigator.language);

  const handleResetAll = () => {
    showConfirm('variables.format_reset_all_confirm', () => {
      SystemVariableFormatService.deleteAll();
      setFormats(SystemVariableFormatService.loadRegistry());
      setEditingKey(null);
    });
  };

  /* システム変数セクション（タイトルと変数一覧） */
  return (
    <div>
      {/* セクションタイトル */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-gray-500 dark:text-[#707070]">{t('snippet.system_variables')}</h2>
        <button
          type="button"
          onClick={handleResetAll}
          className="rounded-lg px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30"
        >
          {t('variables.format_reset_all')}
        </button>
      </div>
      {/* システム変数一覧コンテナ */}
      <div className="bg-white dark:bg-[#1A1A1A] rounded-xl shadow-sm border border-gray-200 dark:border-[#2A2A2A] overflow-hidden">
        {systemVariables.map((variable, index) => (
          <SystemVariableItem
            key={variable.name}
            variable={variable}
            isLast={index === systemVariables.length - 1}
            preview={formatByPattern(
              new Date(),
              formats[variable.name as SystemVariableKey]
                ?? DEFAULT_SYSTEM_VARIABLE_FORMATS[variable.name as SystemVariableKey],
              locale
            )}
            onFormat={() => setEditingKey(variable.name as SystemVariableKey)}
          />
        ))}
      </div>
      <p className="mt-3 text-sm text-gray-500 dark:text-[#707070]">
        {t('variables.format_desc')}
      </p>
      <SystemVariableFormatModal
        variableKey={editingKey}
        onClose={() => setEditingKey(null)}
        onChanged={() => setFormats(SystemVariableFormatService.loadRegistry())}
      />
    </div>
  );
}
