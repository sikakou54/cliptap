import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FREE_SHORTCUT_VALUES_LIMIT,
  INPUT_LIMITS,
  translateError,
  useSharedSubscription,
  useTranslation,
  useVariableExpansion,
  type Category,
  type Profile,
  type ProfileVariable,
  type Shortcut,
  type ShortcutValueInput,
  type Variable,
} from '@cliptap/shared';
import { ProfileMultiSelect } from '@components/profile/ProfileMultiSelect';
import { VariableBadges } from '@components/snippet/VariableBadges';
import { QuickCategoryCreateButton } from '@components/category/QuickCategoryCreateButton';
import { useBodyScrollLock } from '@hooks/useBodyScrollLock';
import { useEscapeClose } from '@hooks/useEscapeClose';
import { useUnsavedChangesWarning } from '@hooks/useUnsavedChangesWarning';
import { showConfirmMessage, showErrorAlert } from '@utils/alerts';

export interface ShortcutFormValues {
  name: string;
  categoryId: string | null;
  profileIds: string[];
  values: ShortcutValueInput[];
}

interface ShortcutEditModalProps {
  isOpen: boolean;
  shortcut: Shortcut | null;
  categories: Category[];
  profiles: Profile[];
  profileVariables: ProfileVariable[];
  variables: Variable[];
  activeProfileId: string | null;
  defaultProfileId: string | null;
  onSave: (values: ShortcutFormValues) => void;
  onClose: () => void;
}

interface DraftValue extends ShortcutValueInput {
  key: string;
}

const createDraftValue = (): DraftValue => ({
  key: crypto.randomUUID(),
  name: '',
  value: '',
});

export function ShortcutEditModal({
  isOpen,
  shortcut,
  categories,
  profiles,
  profileVariables,
  variables,
  activeProfileId,
  defaultProfileId,
  onSave,
  onClose,
}: ShortcutEditModalProps) {
  const { t, language } = useTranslation();
  const { canAddShortcutValue } = useSharedSubscription();
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [profileIds, setProfileIds] = useState<string[]>([]);
  const [values, setValues] = useState<DraftValue[]>([createDraftValue()]);
  const [initialSnapshot, setInitialSnapshot] = useState('');
  const [focusedValueKey, setFocusedValueKey] = useState<string | null>(null);
  const selectionByKey = useRef(new Map<string, number>());

  const { expandVariables } = useVariableExpansion({ variables, profileVariables, locale: language });
  const previewProfileId = useMemo(() => {
    if (profileIds.length === 0 || (activeProfileId && profileIds.includes(activeProfileId))) {
      return activeProfileId;
    }
    return profiles.find((profile) => profileIds.includes(profile.id))?.id ?? activeProfileId;
  }, [profileIds, activeProfileId, profiles]);

  useEffect(() => {
    if (!isOpen) return;

    const nextName = shortcut?.name ?? '';
    const nextCategoryId = shortcut?.categoryId ?? null;
    const nextProfileIds = shortcut?.profileIds ?? (activeProfileId ? [activeProfileId] : []);
    const nextValues = shortcut
      ? shortcut.values.map((value) => ({
          key: value.id,
          id: value.id,
          name: value.name,
          value: value.value,
        }))
      : [createDraftValue()];

    setName(nextName);
    setCategoryId(nextCategoryId);
    setProfileIds(nextProfileIds);
    setValues(nextValues);
    setFocusedValueKey(nextValues[0]?.key ?? null);
    selectionByKey.current.clear();
    setInitialSnapshot(JSON.stringify({
      name: nextName,
      categoryId: nextCategoryId,
      profileIds: nextProfileIds,
      values: nextValues.map(({ id, name: valueName, value }) => ({ id, name: valueName, value })),
    }));
  }, [isOpen, shortcut, activeProfileId]);

  const currentSnapshot = useMemo(() => JSON.stringify({
    name,
    categoryId,
    profileIds,
    values: values.map(({ id, name: valueName, value }) => ({ id, name: valueName, value })),
  }), [name, categoryId, profileIds, values]);

  const hasChanges = isOpen && initialSnapshot !== '' && currentSnapshot !== initialSnapshot;
  const { confirmClose } = useUnsavedChangesWarning({ hasChanges, isActive: isOpen });
  const handleClose = () => confirmClose(onClose);
  useBodyScrollLock(isOpen);
  useEscapeClose(isOpen, handleClose);

  const updateValue = (key: string, patch: Partial<Pick<DraftValue, 'name' | 'value'>>) => {
    setValues((current) => current.map((value) => value.key === key ? { ...value, ...patch } : value));
  };

  const handleAddValue = () => {
    if (!canAddShortcutValue(values.length)) {
      showErrorAlert(t('shortcut.value_limit_message', { limit: FREE_SHORTCUT_VALUES_LIMIT }));
      return;
    }
    const next = createDraftValue();
    setValues((current) => [...current, next]);
    setFocusedValueKey(next.key);
  };

  const handleDeleteValue = (value: DraftValue) => {
    showConfirmMessage(t('shortcut.delete_value_confirm', { name: value.name }), () => {
      setValues((current) => current.filter((entry) => entry.key !== value.key));
    });
  };

  const handleInsertVariable = (variableName: string) => {
    const targetKey = focusedValueKey ?? values[0]?.key;
    if (!targetKey) return;
    const token = `{{${variableName}}}`;
    const target = values.find((value) => value.key === targetKey);
    if (!target) return;
    const cursor = selectionByKey.current.get(targetKey) ?? target.value.length;
    updateValue(targetKey, {
      value: `${target.value.slice(0, cursor)}${token}${target.value.slice(cursor)}`,
    });
    selectionByKey.current.set(targetKey, cursor + token.length);
  };

  const canSave = name.trim() !== '' && values.length > 0 && values.every((value) => value.name.trim() !== '');

  const handleSave = () => {
    if (!canSave) return;
    const savedValueCount = shortcut?.values.length ?? 0;
    if (values.length > savedValueCount && !canAddShortcutValue(values.length - 1)) {
      showErrorAlert(t('shortcut.value_limit_message', { limit: FREE_SHORTCUT_VALUES_LIMIT }));
      return;
    }
    try {
      onSave({
        name,
        categoryId,
        profileIds,
        values: values.map(({ id, name: valueName, value }) => ({
          id,
          name: valueName.trim(),
          value,
        })),
      });
    } catch (error) {
      showErrorAlert(translateError(error));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 dark:bg-black/80" onMouseDown={handleClose}>
      <div
        className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-[#1A1A1A]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-[#2A2A2A]">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {shortcut ? t('shortcut.edit') : t('shortcut.create')}
          </h2>
          <button type="button" onClick={handleClose} className="min-h-11 min-w-11 rounded-lg text-2xl text-gray-500 hover:bg-gray-100 dark:text-[#A0A0A0] dark:hover:bg-[#2A2A2A]" aria-label={t('common.close')}>×</button>
        </div>

        <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="space-y-6 overflow-y-auto p-6">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-[#A0A0A0]">{t('shortcut.name')} *</label>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={INPUT_LIMITS.SHORTCUT_NAME_MAX}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:outline-none dark:border-[#2A2A2A] dark:bg-[#1A1A1A] dark:text-white"
                placeholder={t('shortcut.name_placeholder')}
                autoFocus
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700 dark:text-[#A0A0A0]">{t('shortcut.category')}</label>
                <QuickCategoryCreateButton onCreated={setCategoryId} />
              </div>
              <select value={categoryId ?? ''} onChange={(event) => setCategoryId(event.target.value || null)} className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 dark:border-[#2A2A2A] dark:bg-[#1A1A1A] dark:text-white">
                <option value="">{t('category.uncategorized')}</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </div>

            <ProfileMultiSelect
              profiles={profiles}
              selectedProfileIds={profileIds}
              onChange={setProfileIds}
              descriptionKey="shortcut.select_profiles_description"
            />

            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-white">{t('shortcut.values')} *</h3>
                <button type="button" onClick={handleAddValue} className="rounded-lg px-3 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30">＋ {t('shortcut.value_create')}</button>
              </div>

              <div className="space-y-4">
                {values.map((entry, index) => (
                  <div key={entry.key} className="rounded-xl border border-gray-200 p-4 dark:border-[#2A2A2A]">
                    <div className="mb-3 flex items-center gap-3">
                      <span className="text-sm font-semibold text-gray-500 dark:text-[#A0A0A0]">{index + 1}</span>
                      <input
                        value={entry.name}
                        onChange={(event) => updateValue(entry.key, { name: event.target.value })}
                        maxLength={INPUT_LIMITS.SHORTCUT_VALUE_NAME_MAX}
                        className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-[#333333] dark:bg-[#242424] dark:text-white"
                        placeholder={t('shortcut.value_name_placeholder')}
                      />
                      <button type="button" onClick={() => handleDeleteValue(entry)} className="min-h-10 min-w-10 rounded-lg text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20" aria-label={t('common.delete')}>×</button>
                    </div>
                    <textarea
                      value={entry.value}
                      onChange={(event) => updateValue(entry.key, { value: event.target.value })}
                      onFocus={(event) => {
                        setFocusedValueKey(entry.key);
                        selectionByKey.current.set(entry.key, event.currentTarget.selectionStart);
                      }}
                      onSelect={(event) => selectionByKey.current.set(entry.key, event.currentTarget.selectionStart)}
                      rows={3}
                      className="w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-[#333333] dark:bg-[#242424] dark:text-white"
                      placeholder={t('shortcut.value_value_placeholder')}
                    />
                    <p className="mt-2 whitespace-pre-wrap text-sm text-gray-500 dark:text-[#A0A0A0]">
                      {expandVariables(entry.value, previewProfileId, defaultProfileId)}
                    </p>
                  </div>
                ))}
                {values.length === 0 && <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-[#333333] dark:text-[#A0A0A0]">{t('error.shortcut_value_required')}</p>}
              </div>
            </div>
          </div>

          <aside className="overflow-y-auto border-t border-gray-200 bg-gray-50 p-5 md:border-l md:border-t-0 dark:border-[#2A2A2A] dark:bg-[#141414]">
            <VariableBadges variables={variables} onInsertVariable={handleInsertVariable} />
          </aside>
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4 dark:border-[#2A2A2A]">
          <button type="button" onClick={handleClose} className="rounded-lg px-5 py-2.5 text-gray-700 hover:bg-gray-100 dark:text-[#A0A0A0] dark:hover:bg-[#2A2A2A]">{t('common.cancel')}</button>
          <button type="button" onClick={handleSave} disabled={!canSave} className="rounded-lg bg-blue-600 px-5 py-2.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">{t('common.save')}</button>
        </div>
      </div>
    </div>
  );
}
