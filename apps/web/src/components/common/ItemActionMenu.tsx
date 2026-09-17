/**
 * 一覧カードの「・・・」メニュー（Web版）
 *
 * @description
 * カード右上に置く「・・・」ボタンと、押したときにボタンの真下（右端揃え）へ出す「編集」「削除」のメニュー。
 * 外側のクリックとEscキーで閉じる。削除の確認ダイアログは呼び出し側が出す。
 *
 * @remarks
 * 【モバイルと同じ操作にしている理由】
 * モバイルのショートカットカード（apps/mobile/src/components/common/ItemActionMenu.tsx）と同じく、
 * カードの中に「クリックでコピー」する値の行があるため、編集と削除を1つのボタンに寄せて取り違えを防ぐ。
 * モバイルは画面下から出すシートだが、Webはポインタで操作するため、ボタンの近くに出すドロップダウンにする。
 * 項目の並び（編集→削除）とアイコン（編集は鉛筆、削除は赤いゴミ箱）はモバイルと同じ。
 *
 * 【読み上げラベルに項目名を含める理由】
 * 一覧ではカードごとに同じボタンが並ぶため、名前がないとどのカードの操作か分からない（文言もモバイルと同じ）。
 *
 * @see apps/web/src/components/shortcut/ShortcutCard.tsx - 使用元
 * @see apps/web/src/components/dashboard/SortMenu.tsx - 同じ作りのドロップダウン
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '@cliptap/shared';
import { useEscapeClose } from '@hooks/useEscapeClose';

/**
 * ItemActionMenuのProps
 * @property itemName - 操作対象の名前（読み上げラベルに使う）
 * @property onEdit - 「編集」が選ばれたときのコールバック
 * @property onDelete - 「削除」が選ばれたときのコールバック（確認ダイアログは呼び出し側が出す）
 */
interface ItemActionMenuProps {
  itemName: string;
  onEdit: () => void;
  onDelete: () => void;
}

export function ItemActionMenu({ itemName, onEdit, onDelete }: ItemActionMenuProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  /* 外側のクリックで閉じる（並べ替えメニュー SortMenu と同じ作り）。開いている間だけ監視する */
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  /* Escキーで閉じる */
  useEscapeClose(isOpen, () => setIsOpen(false));

  /**
   * 項目を選んだときの処理
   *
   * @remarks
   * 先にメニューを閉じてから操作を実行し、削除の確認ダイアログの裏にメニューを開いたまま残さない。
   */
  const handleSelect = (action: () => void) => {
    setIsOpen(false);
    action();
  };

  const moreActionsLabel = t('common.more_actions', { name: itemName });

  /* 「・・・」ボタンとメニュー */
  return (
    <div className="relative shrink-0" ref={menuRef}>
      {/* 「・・・」ボタン（押下領域40x40。カードの丸ボタンと同じ寸法） */}
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="flex h-10 w-10 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 dark:text-[#A0A0A0] dark:hover:bg-[#2A2A2A]"
        aria-label={moreActionsLabel}
        title={moreActionsLabel}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="5" cy="12" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="19" cy="12" r="2" />
        </svg>
      </button>

      {/* メニュー（ボタンの真下に右端を揃えて出す）。
          上下に余白を置かず、項目の背景を角丸で切り取る（overflow-hidden）。
          余白があると、先頭と末尾の項目を指したときに枠線との間へ背景の付かない帯が残る */}
      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 w-40 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-[#2A2A2A]"
        >
          {/* 編集（鉛筆アイコン） */}
          <button
            type="button"
            role="menuitem"
            onClick={() => handleSelect(onEdit)}
            className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            {t('common.edit')}
          </button>
          {/* 削除（ゴミ箱アイコン。アイコンも項目名と同じ赤で表示する） */}
          <button
            type="button"
            role="menuitem"
            onClick={() => handleSelect(onDelete)}
            className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            {t('common.delete')}
          </button>
        </div>
      )}
    </div>
  );
}
