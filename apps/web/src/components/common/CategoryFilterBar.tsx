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
 *
 * 【チップの見た目の出どころ】
 * 角丸・枠線・配色は、モバイルのチップ実装（apps/mobile/src/components/profile/ProfileChipSelector.tsx と
 * apps/mobile/src/components/category/CategoryFilter.tsx）が使うテーマトークンと同じ値に揃えている。
 * Web内の3つのチップ（dashboard/SearchProfileBar、common/CategoryFilterBar、variable/ProfileFilter）は
 * すべて同じ値のため、見た目を変えるときは3つとモバイル側をまとめて直す。
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

  /* カテゴリフィルターバー（全カテゴリ・未分類・各カテゴリのボタン、横スクロール対応）

     上の余白（mt-1.5 = 6px）が下（pb-2 = 8px + ヘッダーの pb-1 = 4px）より小さいのは、
     上段の行の高さが表示切替トグルのタップ領域（h-11 = 44px）で決まり、
     トグルのトラックとプロファイル切替の下地（どちらも32px）が行の下端より6px上で終わるため。
     その6pxを差し引いて、見た目の余白を上下とも12pxに揃えている */
  return (
    <div className="mt-1.5 flex gap-2 overflow-x-auto pb-2">
      {/* 全カテゴリボタン */}
      <button
        onClick={() => handleSelect(null)}
        className={`whitespace-nowrap rounded-2xl border px-3 py-1.5 text-sm font-medium ${localSelected === null
          ? 'border-[#3B82F6] bg-[#3B82F6] text-white dark:border-[#60A5FA] dark:bg-[#60A5FA]'
          : 'border-[#E5E7EB] bg-[#F8FAFC] text-[#111827] hover:bg-[#F3F4F6] dark:border-[#2A2A2A] dark:bg-[#1A1A1A] dark:text-white dark:hover:bg-[#2A2A2A]'
          }`}
      >
        {allLabel}
      </button>
      {/* 未分類ボタン */}
      {showUncategorized && (
        <button
          onClick={() => handleSelect('uncategorized')}
          className={`whitespace-nowrap rounded-2xl border px-3 py-1.5 text-sm font-medium ${localSelected === 'uncategorized'
            ? 'border-[#3B82F6] bg-[#3B82F6] text-white dark:border-[#60A5FA] dark:bg-[#60A5FA]'
            : 'border-[#E5E7EB] bg-[#F8FAFC] text-[#111827] hover:bg-[#F3F4F6] dark:border-[#2A2A2A] dark:bg-[#1A1A1A] dark:text-white dark:hover:bg-[#2A2A2A]'
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
          className={`whitespace-nowrap rounded-2xl border px-3 py-1.5 text-sm font-medium ${localSelected === category.id
            ? 'border-[#3B82F6] bg-[#3B82F6] text-white dark:border-[#60A5FA] dark:bg-[#60A5FA]'
            : 'border-[#E5E7EB] bg-[#F8FAFC] text-[#111827] hover:bg-[#F3F4F6] dark:border-[#2A2A2A] dark:bg-[#1A1A1A] dark:text-white dark:hover:bg-[#2A2A2A]'
            }`}
          style={
            localSelected === category.id && category.color
              ? { backgroundColor: category.color, borderColor: category.color }
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
