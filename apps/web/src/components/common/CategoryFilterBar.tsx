/**
 * CategoryFilterBar - カテゴリフィルターバー
 *
 * @description
 * カテゴリフィルターボタンのリストを表示するコンポーネント。
 *
 * 選択状態の扱いは次の3点で成り立っている。
 * - 見た目は内部state（localSelected）が決めるため、クリックした瞬間にハイライトが移る
 * - 親への通知は requestAnimationFrame で次フレームに逃がし、一覧の再計算で入力が詰まらないようにする
 * - 親が持つ selectedCategory が変わったときは localSelected を追従させ、バー以外から選択が
 *   変わった場合でも表示がずれないようにする
 */
import React, { useState, useEffect } from 'react';
import type { Category } from '@cliptap/shared';

interface CategoryFilterBarProps {
  categories: Category[];
  selectedCategory: string | null;
  allLabel: string;
  uncategorizedLabel: string;
  showUncategorized?: boolean;
  onSelectCategory: (categoryId: string | null) => void;
}

function CategoryFilterBarComponent({
  categories,
  selectedCategory,
  allLabel,
  uncategorizedLabel,
  showUncategorized = true,
  onSelectCategory,
}: CategoryFilterBarProps) {
  const [localSelected, setLocalSelected] = useState(selectedCategory);

  /* 親の選択値へ追従する。自身のクリック経由では同値の代入になるため、即時ハイライトは壊れない */
  useEffect(() => {
    setLocalSelected(selectedCategory);
  }, [selectedCategory]);

  const handleSelect = (categoryId: string | null) => {
    /* 見た目（localSelected）を即時更新してから親へ通知する。
       親コールバックは一覧の再計算を伴うため、次フレームへ逃がしている */
    setLocalSelected(categoryId);
    requestAnimationFrame(() => onSelectCategory(categoryId));
  };

  /* カテゴリフィルターバー（全カテゴリ・未分類・各カテゴリのボタン、横スクロール対応） */
  return (
    <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
      {/* 全カテゴリボタン */}
      <button
        onClick={() => handleSelect(null)}
        className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap ${localSelected === null
          ? 'bg-blue-600 text-white'
          : 'bg-gray-100 dark:bg-[#2A2A2A] text-gray-700 dark:text-[#A0A0A0] hover:bg-gray-200 dark:hover:bg-[#333333]'
          }`}
      >
        {allLabel}
      </button>
      {/* 未分類ボタン */}
      {showUncategorized && (
        <button
          onClick={() => handleSelect('uncategorized')}
          className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap ${localSelected === 'uncategorized'
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 dark:bg-[#2A2A2A] text-gray-700 dark:text-[#A0A0A0] hover:bg-gray-200 dark:hover:bg-[#333333]'
            }`}
        >
          {uncategorizedLabel}
        </button>
      )}
      {/* 各カテゴリボタン（選択時はカテゴリ色を背景に使用） */}
      {categories.map((category) => (
        /* カテゴリフィルターボタン */
        <button
          key={category.id}
          onClick={() => handleSelect(category.id)}
          className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap ${localSelected === category.id
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 dark:bg-[#2A2A2A] text-gray-700 dark:text-[#A0A0A0] hover:bg-gray-200 dark:hover:bg-[#333333]'
            }`}
          style={
            localSelected === category.id && category.color
              ? { backgroundColor: category.color }
              : undefined
          }
        >
          {category.name}
        </button>
      ))}
    </div>
  );
}

/**
 * 既定の浅い比較でメモ化する。
 *
 * @remarks
 * 全propsを比較対象にするため、selectedCategory の変化も取りこぼさない。
 * onSelectCategory は参照が安定した state setter、ラベルは t() の結果で言語ごとに固定のため、
 * 比較項目を増やしても再レンダー回数は実質変わらない。
 */
export const CategoryFilterBar = React.memo(CategoryFilterBarComponent);
