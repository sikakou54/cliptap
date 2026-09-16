/**
 * ShortcutCard - ショートカットカード（Web版）
 *
 * @description
 * 1件のショートカットを表すカード。カードの見た目（枠線・角丸・影・カテゴリ色の左罫）は定型文カードと同じにし、
 * 中の配置はモバイル版の`ShortcutCard`に揃えている:
 * - 名前の行の右端に「・・・」メニュー（編集・削除）を置く
 * - カテゴリバッジは名前の直下に置く
 * - 値のブロックはクリックでその値をコピーし、コピーアイコンは値の文字の末尾に付ける
 *
 * @remarks
 * 【コピーアイコンを値の文字の末尾に置く理由】
 * 定型文カードのタイトルと同じ形に揃える。値の右端へ寄せると、短い値のときに
 * アイコンだけが離れて浮き、どの文字に対する操作なのか読み取りにくくなる（モバイルと同じ）。
 *
 * 【カードで overflow を隠さない理由】
 * 「・・・」メニューをカードの外へはみ出して出すため。角丸は枠線が持つため、隠さなくても崩れない。
 *
 * @see apps/mobile/src/components/shortcut/ShortcutCard.tsx - 配置を揃えているモバイル版
 * @see apps/web/src/components/snippet/SnippetCard.tsx - カードの見た目を揃えている定型文カード
 */
import { useTranslation, type ShortcutWithDisplay } from '@cliptap/shared';
import { CATEGORY_FALLBACK_COLOR } from '@utils/categoryColor';
import { ItemActionMenu } from '@components/common/ItemActionMenu';

/**
 * ShortcutCardのProps
 * @property shortcut - 表示するショートカット（値は表示中のプロファイルで展開した表示用の文字列を持つ）
 * @property copiedShortcutId - コピー完了を表示中のショートカットのID（無ければnull）
 * @property categoryColor - カテゴリ色（未分類または削除済みカテゴリの場合はnull）
 * @property categoryName - カテゴリ名（未分類または削除済みカテゴリの場合はnull）
 * @property onCopy - 値のブロックがクリックされたときのコールバック（クリップボードへコピー）
 * @property onEdit - メニューで「編集」が選ばれたときのコールバック
 * @property onDelete - メニューで「削除」が選ばれたときのコールバック（確認ダイアログは呼び出し側が出す）
 */
interface ShortcutCardProps {
  shortcut: ShortcutWithDisplay;
  copiedShortcutId: string | null;
  categoryColor: string | null;
  categoryName: string | null;
  onCopy: (shortcut: ShortcutWithDisplay) => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function ShortcutCard({
  shortcut,
  copiedShortcutId,
  categoryColor,
  categoryName,
  onCopy,
  onEdit,
  onDelete,
}: ShortcutCardProps) {
  const { t } = useTranslation();

  /* カテゴリ名はあるが色が未設定の場合があるため、バッジの色はフォールバックまで含めて確定させる */
  const badgeColor = categoryColor || CATEGORY_FALLBACK_COLOR;
  const copied = copiedShortcutId === shortcut.id;

  /* ショートカットカード（名前・メニュー・カテゴリ・値） */
  return (
    <div
      className="rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-[#2A2A2A] dark:bg-[#1A1A1A]"
      style={{ borderLeftWidth: categoryColor ? '4px' : undefined, borderLeftColor: categoryColor || undefined }}
    >
      {/* メインコンテンツエリア（展開ボタンを出すときは、下側の余白をボタン行が持つ） */}
      <div className="flex flex-col gap-1.5 p-4">
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

        {/* 登録されている値（クリックでコピーする）。
            ホバーの背景を文字から離すため、左右へ少しはみ出してブロック全体をクリック対象にする */}
        <button
          type="button"
          onClick={() => onCopy(shortcut)}
          className="-mx-2 block w-[calc(100%+1rem)] rounded-lg px-2 py-2 text-left transition-colors hover:bg-gray-50 dark:hover:bg-[#2A2A2A]"
          title={t('common.copy')}
          aria-label={`${shortcut.name} ${t('common.copy')}`}
        >
          {/* 値（表示中のプロファイルで変数を展開した文字列）。長い値も全体を確かめてからコピーできるよう折り返す。
              コピーアイコンは値の文字の末尾へ続けて置くため、同じ行の流れに入れる（コピー完了時は2秒間チェックマーク） */}
          <span className="whitespace-pre-wrap break-words font-mono text-sm text-gray-500 dark:text-[#A0A0A0]">
            {shortcut.displayValue}{' '}
            <span className={`inline-block align-middle ${copied ? 'text-emerald-500 dark:text-emerald-400' : 'text-gray-500 dark:text-[#A0A0A0]'}`}>
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
      </div>
    </div>
  );
}
