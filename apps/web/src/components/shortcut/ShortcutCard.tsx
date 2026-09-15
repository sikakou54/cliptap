/**
 * ShortcutCard - ショートカットカード（Web版）
 *
 * @description
 * 1件のショートカットを表すカード。カードの見た目（枠線・角丸・影・カテゴリ色の左罫）は定型文カードと同じにし、
 * 中の配置はモバイル版の`ShortcutCard`に揃えている:
 * - 名前の行の右端に「・・・」メニュー（編集・削除）を置く
 * - カテゴリバッジは名前の直下に置く
 * - 値の行は値名とコピーアイコンを上、値を下に重ね、行のクリックでその値だけをコピーする
 * - 値が3件以上のときは先頭2件だけを出し、左下の展開ボタンで全件を出す
 *
 * @remarks
 * 【値名と値を横に並べない理由】
 * 値は電話番号や住所など長さがまちまちで、横に並べると値名の欄幅に引きずられて値が途中で切れる。
 * 縦に積めば値へ幅をすべて使える（モバイルと同じ）。
 *
 * 【開閉式にする理由】
 * 値の件数は利用者のデータ次第で増え、全件を常に出すと1件のカードがグリッドを縦に引き伸ばす。
 * 定型文カードが本文を2行で畳むのと同じ考え方で、既定では2件だけを見せる。
 *
 * 【カードで overflow を隠さない理由】
 * 「・・・」メニューをカードの外へはみ出して出すため。角丸は枠線が持つため、隠さなくても崩れない。
 *
 * @see apps/mobile/src/components/shortcut/ShortcutCard.tsx - 配置を揃えているモバイル版
 * @see apps/web/src/components/snippet/SnippetCard.tsx - カードの見た目を揃えている定型文カード
 */
import { useState } from 'react';
import { useTranslation, type ShortcutValueWithDisplay, type ShortcutWithDisplay } from '@cliptap/shared';
import { CATEGORY_FALLBACK_COLOR } from '@utils/categoryColor';
import { ItemActionMenu } from '@components/common/ItemActionMenu';
import { ExpandButton } from '@components/snippet/ExpandButton';

/** 畳んでいるときに見せる値の件数（モバイル版 ShortcutCard と同値） */
const COLLAPSED_VALUE_COUNT = 2;

/**
 * ShortcutCardのProps
 * @property shortcut - 表示するショートカット（値は表示中のプロファイルで展開した表示用の文字列を持つ）
 * @property copiedValueId - コピー完了を表示中の値のID（無ければnull）
 * @property categoryColor - カテゴリ色（未分類または削除済みカテゴリの場合はnull）
 * @property categoryName - カテゴリ名（未分類または削除済みカテゴリの場合はnull）
 * @property onCopyValue - 値の行がクリックされたときのコールバック（クリップボードへコピー）
 * @property onEdit - メニューで「編集」が選ばれたときのコールバック
 * @property onDelete - メニューで「削除」が選ばれたときのコールバック（確認ダイアログは呼び出し側が出す）
 */
interface ShortcutCardProps {
  shortcut: ShortcutWithDisplay;
  copiedValueId: string | null;
  categoryColor: string | null;
  categoryName: string | null;
  onCopyValue: (value: ShortcutValueWithDisplay) => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function ShortcutCard({
  shortcut,
  copiedValueId,
  categoryColor,
  categoryName,
  onCopyValue,
  onEdit,
  onDelete,
}: ShortcutCardProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  /* カテゴリ名はあるが色が未設定の場合があるため、バッジの色はフォールバックまで含めて確定させる */
  const badgeColor = categoryColor || CATEGORY_FALLBACK_COLOR;

  /* 畳んでいるときに隠れている値があるか（無ければ展開ボタンを出さない） */
  const hasHiddenValues = shortcut.values.length > COLLAPSED_VALUE_COUNT;
  const visibleValues = isExpanded ? shortcut.values : shortcut.values.slice(0, COLLAPSED_VALUE_COUNT);

  /* ショートカットカード（名前・メニュー・カテゴリ・値・展開ボタン） */
  return (
    <div
      className="rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-[#2A2A2A] dark:bg-[#1A1A1A]"
      style={{ borderLeftWidth: categoryColor ? '4px' : undefined, borderLeftColor: categoryColor || undefined }}
    >
      {/* メインコンテンツエリア（展開ボタンを出すときは、下側の余白をボタン行が持つ） */}
      <div className={`flex flex-col gap-1.5 p-4 ${hasHiddenValues ? 'pb-0' : ''}`}>
        {/* 名前の行。ショートカット名と、右端の「・・・」メニュー */}
        <div className="flex items-center gap-4">
          <h3 className="min-w-0 flex-1 truncate font-semibold text-gray-900 dark:text-white">{shortcut.name}</h3>
          <ItemActionMenu itemName={shortcut.name} onEdit={onEdit} onDelete={onDelete} />
        </div>

        {/* カテゴリバッジ（未分類の場合はモバイル版と同じく表示しない） */}
        {categoryName && (
          <div className="mt-1">
            <span
              className="inline-block rounded-md px-1.5 py-[3px] text-xs font-medium"
              style={{ backgroundColor: `${badgeColor}20`, color: badgeColor }}
            >
              {categoryName}
            </span>
          </div>
        )}

        {/* 登録されている値（クリックでその値だけをコピーする） */}
        <div>
          {visibleValues.map((value) => {
            const copied = copiedValueId === value.id;
            return (
              /* 値の行。ホバーの背景を文字から離すため、左右へ少しはみ出して行全体をクリック対象にする */
              <button
                type="button"
                key={value.id}
                onClick={() => onCopyValue(value)}
                className="-mx-2 block w-[calc(100%+1rem)] rounded-lg px-2 py-2 text-left transition-colors hover:bg-gray-50 dark:hover:bg-[#2A2A2A]"
                title={t('common.copy')}
                aria-label={`${value.name} ${t('common.copy')}`}
              >
                {/* 値名とコピーアイコン。アイコンは値名の直後に置き、値の長さで位置を動かさない */}
                <span className="flex items-center">
                  <span className="truncate text-xs font-medium text-gray-400 dark:text-[#707070]">{value.name}</span>
                  {/* コピーアイコン（コピー完了時は2秒間チェックマーク） */}
                  <span className={`ml-1 shrink-0 ${copied ? 'text-emerald-500 dark:text-emerald-400' : 'text-gray-500 dark:text-[#A0A0A0]'}`}>
                    {copied ? (
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg>
                    )}
                  </span>
                </span>
                {/* 値（表示中のプロファイルで変数を展開した文字列）。長い値も全体を確かめてからコピーできるよう折り返す */}
                <span className="block whitespace-pre-wrap break-words font-mono text-sm text-gray-500 dark:text-[#A0A0A0]">
                  {value.displayValue}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 下部ボタン行（左: 展開）。畳んでも全件見えているときは出さない */}
      {hasHiddenValues && (
        <div className="flex items-center px-2 pb-2 pt-1">
          <ExpandButton isExpanded={isExpanded} onClick={() => setIsExpanded((prev) => !prev)} />
        </div>
      )}
    </div>
  );
}
