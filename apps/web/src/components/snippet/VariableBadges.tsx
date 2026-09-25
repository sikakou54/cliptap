/**
 * 変数バッジコンポーネント
 *
 * @description
 * システム変数とカスタム変数のバッジを表示
 */
import { useTranslation, UI_SYSTEM_VARIABLES } from '@cliptap/shared';
import type { Variable } from '@cliptap/shared';
import { VariableIcon } from '@components/common/VariableIcon';

interface VariableBadgesProps {
  variables: Variable[];
  onInsertVariable: (variableName: string) => void;
}

export function VariableBadges({ variables, onInsertVariable }: VariableBadgesProps) {
  const { t } = useTranslation();
  const customVariables = variables.filter((v) => v.type === 'custom' && v.valid);

  /* 変数バッジコンテナ（システム変数とカスタム変数） */
  return (
    <div>
      {/* システム変数（クリックでカーソル位置に挿入） */}
      <div className="mb-4">
        {/* システム変数ラベル */}
        <p className="text-xs text-gray-500 dark:text-[#707070] mb-2">{t('snippet.system_variables')}</p>
        {/* システム変数バッジ一覧 */}
        <div className="flex flex-wrap gap-2">
          {UI_SYSTEM_VARIABLES.map((variable) => (
            /* システム変数バッジ */
            <button
              key={variable.name}
              onClick={() => onInsertVariable(variable.name)}
              className="px-3 py-1.5 bg-white dark:bg-[#2A2A2A] border border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300 rounded-lg text-sm font-medium hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors shadow-sm"
              title={`{{${variable.name}}}`}
            >
              {t(variable.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* カスタム変数（クリックでカーソル位置に挿入） */}
      {customVariables.length > 0 && (
        <div>
          {/* カスタム変数ラベル */}
          <p className="text-xs text-gray-500 dark:text-[#707070] mb-2">{t('snippet.custom_variables')}</p>
          {/* カスタム変数バッジ一覧 */}
          <div className="flex flex-wrap gap-2">
            {customVariables.map((variable) => (
              /* カスタム変数バッジ（アイコン + ラベル） */
              <button
                key={variable.id}
                onClick={() => onInsertVariable(variable.name)}
                className="px-3 py-1.5 bg-white dark:bg-[#2A2A2A] border border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300 rounded-lg text-sm font-medium hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors shadow-sm flex items-center gap-1.5"
                title={`{{${variable.name}}}`}
              >
                <VariableIcon name={variable.icon} size={14} />
                {variable.label && variable.label.trim() !== '' ? variable.label : `{{${variable.name}}}`}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

