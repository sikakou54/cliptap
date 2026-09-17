/**
 * SnippetCard - スニペットカード
 *
 * @description
 * 個々のスニペットを表示するカードコンポーネント。
 * タイトル、カテゴリ、本文、「・・・」メニュー（編集・削除）、展開・コピーボタンを含む。
 * 展開/折りたたみ機能あり（各カード内で独立して管理）。
 *
 * レイアウトはモバイル版の`SnippetCard`と揃えている:
 * - タイトル行そのものがタイトルのみコピーの操作領域で、コピーアイコンはタイトルの文字の末尾に付ける
 *   （長いタイトルは末尾を省略し、アイコンは残す）
 * - タイトル行の右端に「・・・」メニュー（編集・削除）を置く。タイトルのコピー操作と混ざらないよう、
 *   タイトルのクリック領域の外に置く
 * - カテゴリバッジはタイトル直下に置く
 * - 本文は折りたたみ時2行で、クリックすると展開する
 * - カード下部は左に展開ボタン、右にコピーの丸ボタンを置く
 *
 * カードで overflow を隠さないのは、「・・・」メニューをカードの外へはみ出して出すため。
 * 角丸は枠線が持つため、隠さなくても崩れない。
 *
 * パフォーマンス最適化:
 * - React.memoによるメモ化
 * - カスタム比較関数で不要な再レンダリングを防止
 */
import React, { useState } from 'react';
import { useTranslation } from '@cliptap/shared';
import type { SnippetWithDisplay } from '@cliptap/shared';
import { CATEGORY_FALLBACK_COLOR } from '@utils/categoryColor';
import { ItemActionMenu } from '@components/common/ItemActionMenu';
import { ExpandButton } from './ExpandButton';
import { CopyButton } from './CopyButton';

interface SnippetCardProps {
  snippet: SnippetWithDisplay;
  isCopied: boolean;
  isTitleCopied: boolean;
  /** カテゴリ色（未分類または削除済みカテゴリの場合はnull） */
  categoryColor: string | null;
  /** カテゴリ名（未分類または削除済みカテゴリの場合はnull） */
  categoryName: string | null;
  onCopy: () => void;
  onCopyTitle: () => void;
  /** メニューで「編集」が選ばれたときのコールバック */
  onEdit: () => void;
  /** メニューで「削除」が選ばれたときのコールバック（確認ダイアログは呼び出し側が出す） */
  onDelete: () => void;
}

function SnippetCardComponent({
  snippet,
  isCopied,
  isTitleCopied,
  categoryColor,
  categoryName,
  onCopy,
  onCopyTitle,
  onEdit,
  onDelete,
}: SnippetCardProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
  };

  /* タイトル未設定の定型文は（タイトルなし）を表示するだけでコピー対象がない */
  const canCopyTitle = Boolean(snippet.title);

  /* カテゴリ名はあるが色が未設定の場合があるため、バッジの色はフォールバックまで含めて確定させる */
  const badgeColor = categoryColor || CATEGORY_FALLBACK_COLOR;

  /* スニペットカード（タイトル、メニュー、カテゴリ、本文、展開・コピーボタン） */
  return (
    <div
      className="bg-white dark:bg-[#1A1A1A] rounded-xl shadow-sm border border-gray-200 dark:border-[#2A2A2A] hover:shadow-md transition-shadow"
      style={{
        borderLeftWidth: categoryColor ? '4px' : undefined,
        borderLeftColor: categoryColor || undefined,
      }}
    >
      {/* メインコンテンツエリア（下側の余白は下部ボタン行が持つ） */}
      <div className="p-4 pb-0 flex flex-col gap-1.5">
        {/* タイトル行。タイトル（クリックでタイトルのみをコピー）と、右端の「・・・」メニュー */}
        <div className="flex items-center gap-4">
          {/* タイトル。クリック領域は行の残り幅いっぱいのまま（タイトルの右の空いた所を押してもタイトルをコピーする） */}
          <button
            onClick={onCopyTitle}
            disabled={!canCopyTitle}
            className="min-w-0 flex-1 flex items-center text-left"
            title={canCopyTitle ? t('snippet.copy_title') : undefined}
            aria-label={canCopyTitle ? t('snippet.copy_title') : undefined}
          >
            {snippet.displayTitle ? (
              <h3 className="min-w-0 truncate font-semibold text-gray-900 dark:text-white">{snippet.displayTitle}</h3>
            ) : (
              <h3 className="min-w-0 truncate font-semibold text-gray-400 dark:text-[#707070]">{t('snippet.no_title')}</h3>
            )}

            {/* コピーアイコン（タイトルの文字の末尾に付ける。コピー完了時は2秒間チェックマーク） */}
            {canCopyTitle && (
              <span className={`ml-1 flex-shrink-0 ${isTitleCopied ? 'text-emerald-500 dark:text-emerald-400' : 'text-gray-500 dark:text-[#A0A0A0]'}`}>
                {isTitleCopied ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                )}
              </span>
            )}
          </button>

          {/* 「・・・」メニュー（編集・削除） */}
          <ItemActionMenu itemName={snippet.displayTitle || t('snippet.no_title')} onEdit={onEdit} onDelete={onDelete} />
        </div>

        {/* カテゴリバッジ（未分類の場合はモバイル版と同じく表示しない） */}
        {categoryName && (
          <div className="mt-1">
            <span
              className="inline-block text-xs font-medium px-1.5 py-[3px] rounded-md"
              style={{
                backgroundColor: `${badgeColor}20`,
                color: badgeColor,
              }}
            >
              {categoryName}
            </span>
          </div>
        )}

        {/* 本文部分（折りたたみ時は2行まで表示、クリックで展開/折りたたみ） */}
        <button onClick={handleToggle} className="w-full text-left">
          <div
            className={`text-gray-600 dark:text-[#A0A0A0] text-sm whitespace-pre-wrap overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? '' : 'line-clamp-2 min-h-[60px]'}`}
            style={{ maxHeight: isExpanded ? '1000px' : '4.5rem' }}
          >
            {snippet.displayContent}
          </div>
        </button>
      </div>

      {/* 下部ボタン行（左: 展開、右: コピー） */}
      <div className="flex items-center justify-between px-2 pt-3 pb-2">
        <ExpandButton isExpanded={isExpanded} onClick={handleToggle} />
        <CopyButton isCopied={isCopied} onClick={onCopy} />
      </div>
    </div>
  );
}

/**
 * SnippetCard をメモ化して不要な再レンダリングを防ぐ
 * リスト表示のパフォーマンス最適化のため
 *
 * カスタム比較関数でsnippetの主要プロパティとその他のPropsを比較
 * すべて変更なしの場合のみ再レンダリングをスキップ
 */
export const SnippetCard = React.memo(SnippetCardComponent, (prevProps, nextProps) => {
  return (
    prevProps.snippet.id === nextProps.snippet.id &&
    prevProps.snippet.updatedAt === nextProps.snippet.updatedAt &&
    prevProps.snippet.title === nextProps.snippet.title &&
    prevProps.snippet.content === nextProps.snippet.content &&
    prevProps.snippet.categoryId === nextProps.snippet.categoryId &&
    prevProps.snippet.displayTitle === nextProps.snippet.displayTitle &&
    prevProps.snippet.displayContent === nextProps.snippet.displayContent &&
    prevProps.isCopied === nextProps.isCopied &&
    prevProps.isTitleCopied === nextProps.isTitleCopied &&
    prevProps.categoryColor === nextProps.categoryColor &&
    prevProps.categoryName === nextProps.categoryName
  );
});
