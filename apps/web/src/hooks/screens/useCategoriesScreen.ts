/**
 * カテゴリ管理画面のビジネスロジックフック
 *
 * カテゴリのCRUD操作と、モーダルの状態管理を提供。
 * UIコンポーネント（CategoryManage.tsx）から完全に分離されたビジネスロジック層。
 *
 * 主な責務:
 * - カテゴリ一覧の取得
 * - カテゴリの作成・編集・削除
 * - モーダルの開閉・フォーム状態管理
 * - RGB→Hex変換・バリデーション
 *
 * @see pages/CategoryManage.tsx - UIコンポーネント
 */

import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from '@cliptap/shared';
import { Logger, useCategories, CATEGORY_COLORS, DEFAULT_CATEGORY_COLOR, translateError, type Category } from '@cliptap/shared';
import { useUnsavedChangesWarning } from '@hooks/useUnsavedChangesWarning';
import { useBodyScrollLock } from '@hooks/useBodyScrollLock';
import { showConfirm } from '@utils/alerts';
import { DEFAULT_CUSTOM_RGB, resolveCategoryColorForm } from '@utils/categoryColor';

/** デフォルトのフォーム値 */
const DEFAULT_FORM_VALUES = {
  name: '',
  color: DEFAULT_CATEGORY_COLOR,
  useCustomColor: false,
  customR: DEFAULT_CUSTOM_RGB.r,
  customG: DEFAULT_CUSTOM_RGB.g,
  customB: DEFAULT_CUSTOM_RGB.b,
} as const;

/** 初期値の型 */
interface InitialValues {
  name: string;
  color: string;
  useCustomColor: boolean;
  customR: string;
  customG: string;
  customB: string;
}

/**
 * useCategoriesScreenの戻り値の型
 */
export interface UseCategoriesScreenReturn {
  /* データ */
  categories: Category[];
  presetColors: readonly string[];

  /* モーダル状態 */
  showModal: boolean;
  editingId: string | null;
  isSubmitting: boolean;
  error: string;

  /* フォーム状態 */
  name: string;
  color: string;
  useCustomColor: boolean;
  customR: string;
  customG: string;
  customB: string;

  /* 派生状態 */
  isRValid: boolean;
  isGValid: boolean;
  isBValid: boolean;
  isCustomColorValid: boolean;
  currentColor: string;
  hasChanges: boolean;

  /* フォームセッター */
  setName: (name: string) => void;
  setColor: (color: string) => void;
  setUseCustomColor: (use: boolean) => void;
  setCustomR: (r: string) => void;
  setCustomG: (g: string) => void;
  setCustomB: (b: string) => void;

  /* ハンドラ */
  openCreateModal: () => void;
  openEditModal: (category: Category) => void;
  handleCloseModal: () => void;
  handleSubmit: () => Promise<void>;
  handleDelete: (id: string) => Promise<void>;
  handlePresetColorSelect: (c: string) => void;
  handleSwitchToPreset: () => void;
  handleSwitchToCustom: () => void;
}

/**
 * RGB値を16進数カラーコード(#RRGGBB)に変換
 */
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const hex = Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
    return hex.toUpperCase();
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * RGB値が有効かどうかをチェック
 */
function isValidRGB(value: string): boolean {
  if (value === '') return false;
  const num = parseInt(value);
  return !isNaN(num) && num >= 0 && num <= 255;
}

/**
 * カテゴリ管理画面のビジネスロジックフック
 *
 * @returns 画面に必要な全ての状態とハンドラ
 */
interface UseCategoriesScreenOptions {
  onCreated?: (category: Category) => void;
}

export function useCategoriesScreen({ onCreated }: UseCategoriesScreenOptions = {}): UseCategoriesScreenReturn {
  const { t } = useTranslation();
  const { categories, createCategory, updateCategory, deleteCategory } = useCategories();

  /* ======================================== */
  /* モーダル状態 */
  /* ======================================== */
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* ======================================== */
  /* フォーム状態 */
  /* ======================================== */
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(DEFAULT_CATEGORY_COLOR);
  const [useCustomColor, setUseCustomColor] = useState(false);
  const [customR, setCustomR] = useState<string>(DEFAULT_FORM_VALUES.customR);
  const [customG, setCustomG] = useState<string>(DEFAULT_FORM_VALUES.customG);
  const [customB, setCustomB] = useState<string>(DEFAULT_FORM_VALUES.customB);

  /* 初期値保存用 */
  const [initialValues, setInitialValues] = useState<InitialValues | null>(null);

  /* プリセットカラー */
  const presetColors = CATEGORY_COLORS;

  /* ======================================== */
  /* 派生状態 */
  /* ======================================== */

  /* 各RGB値の有効性 */
  const isRValid = isValidRGB(customR);
  const isGValid = isValidRGB(customG);
  const isBValid = isValidRGB(customB);

  /* カスタムRGB値から現在の色を計算 */
  const getCustomColor = useCallback((): string | null => {
    const r = parseInt(customR);
    const g = parseInt(customG);
    const b = parseInt(customB);

    if (isNaN(r) || isNaN(g) || isNaN(b)) {
      return null;
    }

    if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) {
      return null;
    }

    return rgbToHex(r, g, b);
  }, [customR, customG, customB]);

  /* カスタムカラーが有効かどうか */
  const isCustomColorValid = useCustomColor ? (isRValid && isGValid && isBValid) : true;

  /* 現在選択されている色（カスタムまたはプリセット） */
  const currentColor = useCustomColor ? (getCustomColor() || color) : color;

  /* 変更があるかどうかを判定 */
  const hasChanges = useMemo(() => {
    if (!showModal || !initialValues) return false;
    const nameChanged = name !== initialValues.name;
    const colorChanged = color !== initialValues.color;
    const useCustomColorChanged = useCustomColor !== initialValues.useCustomColor;
    const customRChanged = customR !== initialValues.customR;
    const customGChanged = customG !== initialValues.customG;
    const customBChanged = customB !== initialValues.customB;
    return nameChanged || colorChanged || useCustomColorChanged || customRChanged || customGChanged || customBChanged;
  }, [showModal, initialValues, name, color, useCustomColor, customR, customG, customB]);

  /* 未保存警告フック */
  const { confirmClose } = useUnsavedChangesWarning({
    hasChanges,
    isActive: showModal,
  });

  /* モーダル表示時に背景スクロールを無効化 */
  useBodyScrollLock(showModal);

  /* ======================================== */
  /* ハンドラ */
  /* ======================================== */

  /** フォームをリセット */
  const resetForm = useCallback(() => {
    setEditingId(null);
    setName(DEFAULT_FORM_VALUES.name);
    setColor(DEFAULT_FORM_VALUES.color);
    setUseCustomColor(DEFAULT_FORM_VALUES.useCustomColor);
    setCustomR(DEFAULT_FORM_VALUES.customR);
    setCustomG(DEFAULT_FORM_VALUES.customG);
    setCustomB(DEFAULT_FORM_VALUES.customB);
    setError('');
  }, []);

  /** 閉じる処理（警告付き） */
  const handleCloseModal = useCallback(() => {
    confirmClose(() => {
      setShowModal(false);
      resetForm();
    });
  }, [confirmClose, resetForm]);

  /** 新規作成モーダルを開く */
  const openCreateModal = useCallback(() => {
    resetForm();
    setInitialValues({ ...DEFAULT_FORM_VALUES });
    setShowModal(true);
  }, [resetForm]);

  /** 編集モーダルを開く */
  const openEditModal = useCallback((category: Category) => {
    setEditingId(category.id);
    setName(category.name);
    setError('');

    /* 保存されている色から、プリセット選択とカスタムRGBのどちらで開くかを決める */
    const colorForm = resolveCategoryColorForm(category.color, presetColors);

    /* 状態を一括更新 */
    setUseCustomColor(colorForm.useCustomColor);
    setColor(colorForm.color);
    setCustomR(colorForm.customR);
    setCustomG(colorForm.customG);
    setCustomB(colorForm.customB);

    /* 初期値を保存 */
    setInitialValues({
      name: category.name,
      color: colorForm.color,
      useCustomColor: colorForm.useCustomColor,
      customR: colorForm.customR,
      customG: colorForm.customG,
      customB: colorForm.customB,
    });

    setShowModal(true);
  }, [presetColors]);

  /** 保存処理 */
  const handleSubmit = useCallback(async () => {
    if (!name.trim()) {
      setError(t('category.name_placeholder'));
      return;
    }

    if (useCustomColor && !isCustomColorValid) {
      setError(t('category.invalid_rgb_values'));
      return;
    }

    setIsSubmitting(true);
    setError('');

    /*
     * ここに到達するのは useCustomColor が false か、true かつ isCustomColorValid が true のときだけ
     * （不正なRGBは上の早期returnで弾いている）。よって getCustomColor() は必ず値を返す
     */
    const colorToSave = useCustomColor ? getCustomColor()! : color;

    try {
      if (editingId) {
        updateCategory({
          id: editingId,
          name: name.trim(),
          color: colorToSave,
        });
      } else {
        const created = createCategory({
          name: name.trim(),
          color: colorToSave,
        });
        onCreated?.(created);
      }

      setShowModal(false);
      resetForm();
    } catch (err) {
      /* ClipTapError は自身が持つ翻訳キーで表示される（重複名も同経路で解決される） */
      setError(translateError(err));
    } finally {
      setIsSubmitting(false);
    }
  }, [name, useCustomColor, isCustomColorValid, getCustomColor, color, editingId, updateCategory, createCategory, resetForm, t, onCreated]);

  /** カテゴリ削除 */
  const handleDelete = useCallback(async (id: string) => {
    showConfirm('category.delete_confirm', () => {
      try {
        deleteCategory(id);
      } catch (err) {
        Logger.error('Failed to delete category:', err);
      }
    });
  }, [deleteCategory]);

  /** プリセットカラーを選択 */
  const handlePresetColorSelect = useCallback((c: string) => {
    setColor(c);
    setUseCustomColor(false);
    setCustomR(DEFAULT_FORM_VALUES.customR);
    setCustomG(DEFAULT_FORM_VALUES.customG);
    setCustomB(DEFAULT_FORM_VALUES.customB);
  }, []);

  /** プリセットモードに切り替え */
  const handleSwitchToPreset = useCallback(() => {
    if (useCustomColor) {
      const currentCustomColor = getCustomColor();
      if (currentCustomColor) {
        const normalizedCustom = currentCustomColor.toUpperCase();
        const matchingPreset = presetColors.find(c => c.toUpperCase() === normalizedCustom);
        if (matchingPreset) {
          setColor(matchingPreset);
        } else {
          setColor(DEFAULT_CATEGORY_COLOR);
        }
      } else {
        setColor(DEFAULT_CATEGORY_COLOR);
      }
      setCustomR(DEFAULT_FORM_VALUES.customR);
      setCustomG(DEFAULT_FORM_VALUES.customG);
      setCustomB(DEFAULT_FORM_VALUES.customB);
    }
    setUseCustomColor(false);
  }, [useCustomColor, getCustomColor, presetColors]);

  /** カスタムRGBモードに切り替え */
  const handleSwitchToCustom = useCallback(() => {
    if (!useCustomColor) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      setCustomR(r.toString());
      setCustomG(g.toString());
      setCustomB(b.toString());
    }
    setUseCustomColor(true);
  }, [useCustomColor, color]);

  /* ======================================== */
  /* 戻り値 */
  /* ======================================== */
  return {
    /* データ */
    categories,
    presetColors,

    /* モーダル状態 */
    showModal,
    editingId,
    isSubmitting,
    error,

    /* フォーム状態 */
    name,
    color,
    useCustomColor,
    customR,
    customG,
    customB,

    /* 派生状態 */
    isRValid,
    isGValid,
    isBValid,
    isCustomColorValid,
    currentColor,
    hasChanges,

    /* フォームセッター */
    setName,
    setColor,
    setUseCustomColor,
    setCustomR,
    setCustomG,
    setCustomB,

    /* ハンドラ */
    openCreateModal,
    openEditModal,
    handleCloseModal,
    handleSubmit,
    handleDelete,
    handlePresetColorSelect,
    handleSwitchToPreset,
    handleSwitchToCustom,
  };
}
