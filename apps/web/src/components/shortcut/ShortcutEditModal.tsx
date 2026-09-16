import { useEffect, useMemo, useRef, useState } from 'react';
import {
  INPUT_LIMITS,
  translateError,
  useTranslation,
  type Category,
  type Profile,
  type ProfileVariable,
  type Shortcut,
  type Variable,
} from '@cliptap/shared';
import { ProfileMultiSelect } from '@components/profile/ProfileMultiSelect';
import { VariableBadges } from '@components/snippet/VariableBadges';
import { ShortcutPreview } from './ShortcutPreview';
import { QuickCategoryCreateButton } from '@components/category/QuickCategoryCreateButton';
import { useBodyScrollLock } from '@hooks/useBodyScrollLock';
import { useEscapeClose } from '@hooks/useEscapeClose';
import { useUnsavedChangesWarning } from '@hooks/useUnsavedChangesWarning';
import { showErrorAlert } from '@utils/alerts';

export interface ShortcutFormValues {
  name: string;
  categoryId: string | null;
  profileIds: string[];
  value: string;
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
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [profileIds, setProfileIds] = useState<string[]>([]);
  const [value, setValue] = useState('');
  const [initialSnapshot, setInitialSnapshot] = useState('');
  /* 変数バッジからトークンを差し込む位置（テキストエリアのカーソル位置） */
  const selectionStart = useRef(0);

  useEffect(() => {
    if (!isOpen) return;

    const nextName = shortcut?.name ?? '';
    const nextCategoryId = shortcut?.categoryId ?? null;
    const nextProfileIds = shortcut?.profileIds ?? (activeProfileId ? [activeProfileId] : []);
    const nextValue = shortcut?.value ?? '';

    setName(nextName);
    setCategoryId(nextCategoryId);
    setProfileIds(nextProfileIds);
    setValue(nextValue);
    selectionStart.current = nextValue.length;
    setInitialSnapshot(JSON.stringify({
      name: nextName,
      categoryId: nextCategoryId,
      profileIds: nextProfileIds,
      value: nextValue,
    }));
  }, [isOpen, shortcut, activeProfileId]);

  const currentSnapshot = useMemo(() => JSON.stringify({
    name,
    categoryId,
    profileIds,
    value,
  }), [name, categoryId, profileIds, value]);

  const hasChanges = isOpen && initialSnapshot !== '' && currentSnapshot !== initialSnapshot;
  const { confirmClose } = useUnsavedChangesWarning({ hasChanges, isActive: isOpen });
  const handleClose = () => confirmClose(onClose);
  useBodyScrollLock(isOpen);
  useEscapeClose(isOpen, handleClose);

  /* 変数バッジのトークンを、テキストエリアのカーソル位置へ差し込む */
  const handleInsertVariable = (variableName: string) => {
    const token = `{{${variableName}}}`;
    const cursor = Math.min(selectionStart.current, value.length);
    setValue(`${value.slice(0, cursor)}${token}${value.slice(cursor)}`);
    selectionStart.current = cursor + token.length;
  };

  /* 値は空文字も保存できるため、名前だけを必須とする（モバイルと同じ） */
  const canSave = name.trim() !== '';

  const handleSave = () => {
    if (!canSave) return;
    try {
      onSave({ name, categoryId, profileIds, value });
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
              <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">{t('shortcut.value_value')}</h3>

              {/* 挿入する値。保存する文字列のまま編集し、変数トークンは右列のプレビューで展開結果を確かめる */}
              <textarea
                value={value}
                onChange={(event) => setValue(event.target.value)}
                onFocus={(event) => {
                  selectionStart.current = event.currentTarget.selectionStart;
                }}
                onSelect={(event) => {
                  selectionStart.current = event.currentTarget.selectionStart;
                }}
                rows={6}
                className="w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-gray-900 dark:border-[#333333] dark:bg-[#242424] dark:text-white"
                placeholder={t('shortcut.value_value_placeholder')}
              />
            </div>
          </div>

          <aside className="space-y-6 border-t border-gray-200 bg-gray-50 p-5 md:overflow-y-auto md:border-l md:border-t-0 dark:border-[#2A2A2A] dark:bg-[#141414]">
            <VariableBadges variables={variables} onInsertVariable={handleInsertVariable} />

            <div className="h-px bg-gray-200 dark:bg-[#2A2A2A]" />

            <ShortcutPreview
              value={value}
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
