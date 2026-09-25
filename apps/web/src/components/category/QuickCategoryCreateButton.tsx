import { useCallback } from 'react';
import { useTranslation, type Category } from '@cliptap/shared';
import { useCategoriesScreen } from '@hooks/screens/useCategoriesScreen';
import { CategoryModal } from './CategoryModal';

interface QuickCategoryCreateButtonProps {
  onCreated: (categoryId: string) => void;
}

export function QuickCategoryCreateButton({ onCreated }: QuickCategoryCreateButtonProps) {
  const { t } = useTranslation();
  const handleCreated = useCallback((category: Category) => onCreated(category.id), [onCreated]);
  const categoryScreen = useCategoriesScreen({ onCreated: handleCreated });

  return (
    <>
      <button
        type="button"
        onClick={categoryScreen.openCreateModal}
        className="rounded-lg px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30"
      >
        ＋ {t('category.create')}
      </button>

      <CategoryModal
        isOpen={categoryScreen.showModal}
        editingId={null}
        name={categoryScreen.name}
        color={categoryScreen.color}
        useCustomColor={categoryScreen.useCustomColor}
        customR={categoryScreen.customR}
        customG={categoryScreen.customG}
        customB={categoryScreen.customB}
        isRValid={categoryScreen.isRValid}
        isGValid={categoryScreen.isGValid}
        isBValid={categoryScreen.isBValid}
        isCustomColorValid={categoryScreen.isCustomColorValid}
        currentColor={categoryScreen.currentColor}
        presetColors={categoryScreen.presetColors}
        error={categoryScreen.error}
        isSubmitting={categoryScreen.isSubmitting}
        onClose={categoryScreen.handleCloseModal}
        onNameChange={categoryScreen.setName}
        onPresetColorSelect={categoryScreen.handlePresetColorSelect}
        onSwitchToPreset={categoryScreen.handleSwitchToPreset}
        onSwitchToCustom={categoryScreen.handleSwitchToCustom}
        onCustomRChange={categoryScreen.setCustomR}
        onCustomGChange={categoryScreen.setCustomG}
        onCustomBChange={categoryScreen.setCustomB}
        onSubmit={categoryScreen.handleSubmit}
      />
    </>
  );
}
