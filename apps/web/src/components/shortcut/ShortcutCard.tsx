/**
 * ShortcutCard - ショートカットカード（Web版）
 *
 * @description
 * 1件のショートカットを表すカード。カードの見た目（枠線・角丸・影・カテゴリ色の左罫）は定型文カードと同じにし、
 * 中の配置はモバイル版の`ShortcutCard`に揃えている:
 * - 名前の行の右端に「・・・」メニュー（編集・削除）を置く
 * - カテゴリバッジは名前の直下に置く
 * - 値の行はクリックでその値だけをコピーし、コピーアイコンは値の文字の末尾に付ける
 * - 値が3件以上のときは先頭2件だけを出し、左下の展開ボタンで全件を出す
 *
 * @remarks
 * 【コピーアイコンを値の文字の末尾に置く理由】
 * 定型文カードのタイトルと同じ形に揃える。値の右端へ寄せると、短い値のときに
 * アイコンだけが離れて浮き、どの文字に対する操作なのか読み取りにくくなる（モバイルと同じ）。
 *
 * 【伏せている値も同じ行で扱う理由】
 * 隠すのは表示だけで、クリックするとコピーされるのは実際の値である。
 * 行の形を変えると押せない行に見えてしまうため、文字だけを置き換える（モバイルと同じ）。
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
import {
  MASKED_VALUE_TEXT,
  useTranslation,
  type ShortcutValueWithDisplay,
  type ShortcutWithDisplay,
} from '@cliptap/shared';
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
  /** この行に対応するプロファイル名（横断検索のときだけ渡す。通常の一覧では出さない） */
  profileLabel?: string | null;
  /** 値をコピーするときに展開の基準にするプロファイル（横断検索のときだけ渡す） */
  copyProfileId?: string | null;
  onCopyValue: (value: ShortcutValueWithDisplay, profileId: string | null) => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function ShortcutCard({
  shortcut,
  copiedValueId,
  categoryColor,
  categoryName,
  profileLabel,
  copyProfileId,
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

        {/* カテゴリバッジ（未分類の場合はモバイル版と同じく表示しない）と、
            横断検索のときだけ添えるプロファイル名（§8.7） */}
        {(categoryName || profileLabel) && (
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {categoryName && (
              <span
                className="inline-block rounded-md px-1.5 py-[3px] text-xs font-medium"
                style={{ backgroundColor: `${badgeColor}20`, color: badgeColor }}
              >
                {categoryName}
              </span>
            )}
            {profileLabel && (
              <span className="inline-block rounded-md border border-[#E5E7EB] bg-[#F8FAFC] px-1.5 py-[3px] text-xs font-medium text-[#6B7280] dark:border-[#2A2A2A] dark:bg-[#1A1A1A] dark:text-[#A0A0A0]">
                {profileLabel}
              </span>
            )}
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
                onClick={() => onCopyValue(value, copyProfileId ?? null)}
                className="-mx-2 block w-[calc(100%+1rem)] rounded-lg px-2 py-2 text-left transition-colors hover:bg-gray-50 dark:hover:bg-[#2A2A2A]"
                title={t('common.copy')}
                /* 伏せている値は読み上げにも出さない。画面で隠しても音声で漏れては意味がない */
                aria-label={value.isMasked ? t('common.copy') : `${value.displayValue} ${t('common.copy')}`}
              >
                {/* 値（表示中のプロファイルで変数を展開した文字列）。長い値も全体を確かめてからコピーできるよう折り返す。
                    伏せている値は記号に置き換える。コピーアイコンは文字の末尾へ続けて置く */}
                <span className="block whitespace-pre-wrap break-words font-mono text-sm text-gray-500 dark:text-[#A0A0A0]">
                  {value.isMasked ? MASKED_VALUE_TEXT : value.displayValue}
                  {/* コピーアイコン（コピー完了時は2秒間チェックマーク） */}
                  <span className={`ml-1 inline-block align-text-bottom ${copied ? 'text-emerald-500 dark:text-emerald-400' : 'text-gray-500 dark:text-[#A0A0A0]'}`}>
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
