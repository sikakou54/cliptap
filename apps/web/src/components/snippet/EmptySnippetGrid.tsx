/**
 * 空のスニペットグリッドコンポーネント
 *
 * @description
 * スニペットが存在しない場合の表示
 */
import { useTranslation } from '@cliptap/shared';

/**
 * EmptySnippetGridのProps
 * @property showEmptyHint - 追加方法の案内を出すか（追加ボタンが見えている画面だけtrue）
 */
interface EmptySnippetGridProps {
  showEmptyHint?: boolean;
}

export function EmptySnippetGrid({ showEmptyHint = true }: EmptySnippetGridProps) {
  const { t } = useTranslation();

  /* 空状態UI（スニペットが0件の場合に表示） */
  return (
    <div className="text-center text-gray-500 dark:text-[#A0A0A0] mt-12">
      {/* 空状態アイコン（ドキュメントアイコン） */}
      <svg
        className="mx-auto h-16 w-16 text-gray-300 dark:text-[#707070]"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      {/* 空状態メッセージ */}
      <p className="mt-4">{t('snippet.no_snippets')}</p>
      {/* 追加方法の案内は、追加ボタンが見えている画面でだけ出す（ショートカットと同じ） */}
      {showEmptyHint && <p className="mt-2 text-sm">{t('snippet.no_snippets_hint')}</p>}
    </div>
  );
}

