import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FREE_SHORTCUT_VALUES_LIMIT,
  INPUT_LIMITS,
  translateError,
  useSharedSubscription,
  useTranslation,
  type Category,
  type Profile,
  type ProfileVariable,
  type Shortcut,
  type ShortcutValueInput,
  type Variable,
} from '@cliptap/shared';
import { ProfileMultiSelect } from '@components/profile/ProfileMultiSelect';
import { VariableBadges } from '@components/snippet/VariableBadges';
import { ShortcutPreview } from './ShortcutPreview';
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
  value: '',
  isMasked: false,
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
  const { t } = useTranslation();
  const { canAddShortcutValue } = useSharedSubscription();
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [profileIds, setProfileIds] = useState<string[]>([]);
  const [values, setValues] = useState<DraftValue[]>([createDraftValue()]);
  const [initialSnapshot, setInitialSnapshot] = useState('');
  const [focusedValueKey, setFocusedValueKey] = useState<string | null>(null);
  const selectionByKey = useRef(new Map<string, number>());

  useEffect(() => {
    if (!isOpen) return;

    const nextName = shortcut?.name ?? '';
    const nextCategoryId = shortcut?.categoryId ?? null;
    const nextProfileIds = shortcut?.profileIds ?? (activeProfileId ? [activeProfileId] : []);
    const nextValues = shortcut
      ? shortcut.values.map((value) => ({
          key: value.id,
          id: value.id,
          value: value.value,
          isMasked: value.isMasked,
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
      values: nextValues.map(({ id, value, isMasked }) => ({ id, value, isMasked })),
    }));
  }, [isOpen, shortcut, activeProfileId]);

  const currentSnapshot = useMemo(() => JSON.stringify({
    name,
    categoryId,
    profileIds,
    values: values.map(({ id, value, isMasked }) => ({ id, value, isMasked })),
  }), [name, categoryId, profileIds, values]);

  const hasChanges = isOpen && initialSnapshot !== '' && currentSnapshot !== initialSnapshot;
  const { confirmClose } = useUnsavedChangesWarning({ hasChanges, isActive: isOpen });
  const handleClose = () => confirmClose(onClose);
  useBodyScrollLock(isOpen);
  useEscapeClose(isOpen, handleClose);

  const updateValue = (key: string, patch: Partial<Pick<DraftValue, 'value' | 'isMasked'>>) => {
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
    showConfirmMessage(t('shortcut.delete_value_confirm'), () => {
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

  /* 値そのものは空文字でも保存できるため、名前と件数だけを必須とする（モバイルと同じ） */
  const canSave = name.trim() !== '' && values.length > 0;

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
        values: values.map(({ id, value, isMasked }) => ({ id, value, isMasked })),
      });
    } catch (error) {
      showErrorAlert(translateError(error));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 dark:bg-black/80" onMouseDown={handleClose}>
      {/* モーダルコンテナ。デスクトップは画面の8割（幅80vw・高さ80vh）を占め、はみ出した内容は左右のカラムの中でスクロールする。
          スマートフォンは幅いっぱい（背景の余白ぶんを除く）で、高さは内容に合わせて最大94vhまで伸ばす */}
      <div
        className="flex max-h-[94vh] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-xl md:h-[80vh] md:w-[80vw] dark:bg-[#1A1A1A]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-[#2A2A2A]">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {shortcut ? t('shortcut.edit') : t('shortcut.create')}
          </h2>
          <button type="button" onClick={handleClose} className="min-h-11 min-w-11 rounded-lg text-2xl text-gray-500 hover:bg-gray-100 dark:text-[#A0A0A0] dark:hover:bg-[#2A2A2A]" aria-label={t('common.close')}>×</button>
        </div>

        <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[minmax(0,1fr)_22rem] md:overflow-hidden">
          <div className="space-y-6 p-6 md:overflow-y-auto">
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
                {values.map((entry) => (
                  <div key={entry.key} className="rounded-xl border border-gray-200 p-4 dark:border-[#2A2A2A]">
                    <div className="mb-3 flex items-center justify-end gap-1">
                      {/* 表示を伏せるかの切り替え。ここで決めた状態は一覧・プレビュー・拡張キーボードにも効く */}
                      <button
                        type="button"
                        onClick={() => updateValue(entry.key, { isMasked: !entry.isMasked })}
                        className={`min-h-10 min-w-10 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2A2A2A] ${entry.isMasked ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-[#A0A0A0]'}`}
                        aria-label={entry.isMasked ? t('shortcut.unmask_value') : t('shortcut.mask_value')}
                        title={entry.isMasked ? t('shortcut.unmask_value') : t('shortcut.mask_value')}
                      >
                        {entry.isMasked ? (
                          <svg className="mx-auto h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        ) : (
                          <svg className="mx-auto h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                      <button type="button" onClick={() => handleDeleteValue(entry)} className="min-h-10 min-w-10 rounded-lg text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20" aria-label={t('common.delete')}>×</button>
                    </div>
                    {/* 伏せる指定にしても入力欄は実際の値のまま出す。書き換えるには中身が見えている必要があるため。
                        隠れるのは一覧・プレビュー・拡張キーボードの表示だけ */}
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
                  </div>
                ))}
                {values.length === 0 && <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-[#333333] dark:text-[#A0A0A0]">{t('error.shortcut_value_required')}</p>}
              </div>
            </div>
          </div>

          <aside className="space-y-6 border-t border-gray-200 bg-gray-50 p-5 md:overflow-y-auto md:border-l md:border-t-0 dark:border-[#2A2A2A] dark:bg-[#141414]">
            <VariableBadges variables={variables} onInsertVariable={handleInsertVariable} />

            <div className="h-px bg-gray-200 dark:bg-[#2A2A2A]" />

            <ShortcutPreview
              values={values}
              selectedProfileIds={profileIds}
              profiles={profiles}
              variables={variables}
              profileVariables={profileVariables}
              defaultProfileId={defaultProfileId}
            />
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
