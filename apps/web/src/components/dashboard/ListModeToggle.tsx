/**
 * 定型文／ショートカットの表示切替スイッチ
 *
 * @description
 * 枠線だけの角丸のトラックの中を、塗りだけのノブ（枠線なし）が左右に動く切替スイッチ。
 * 左（紺のノブに書類のアイコン）が定型文、右（黄色のノブに稲妻のアイコン）がショートカットを表す。
 *
 * @remarks
 * 【モバイルと同じ見た目にしている理由】
 * 同じ「一覧の表示対象を切り替える」操作をモバイル・拡張キーボード・Webで行うため、
 * どこでも同じものだと分かるように揃える。寸法と配色はモバイルの
 * `apps/mobile/src/components/common/ListModeToggle.tsx`（色はテーマの listModeSnippet などと同値）に
 * 合わせており、変えるときは揃えること。
 * - トラック: 幅52px・高さ32px、枠線はtextTertiary（ライト #9CA3AF / ダーク #707070）
 * - ノブ: 直径28px、トラックの外形から2px内側、枠線なし（塗りだけ）
 * - ノブの塗りとアイコンの色: 定型文は紺 #212B3C に白、ショートカットは黄 #FBBF24 に紺（ライト・ダーク共通）
 * - アイコン: 16px
 * - ノブの移動: 20px（52 - 28 - 2 × 2）を100msで動かす
 *
 * 【ノブの色を表示対象で変える理由】
 * ノブの位置とアイコンの形に加えて色でも区別し、一目でどちらの一覧か分かるようにする（モバイルと同じ）。
 *
 * 【role="switch" にしている理由】
 * 見た目がスイッチのため、支援技術にもオン・オフの状態として伝える。
 * 名前は「ショートカットを表示」とし、aria-checked がオンならショートカットを表示中を表す。
 * ホバー時のtitleは、モバイルの読み上げと同じく押したら何が起きるかを示す。
 *
 * 【状態を持たない理由】
 * 表示対象はダッシュボードが持つ正本で、追加ボタンの行き先やカテゴリチップの集合も
 * 同じ値で決まる。スイッチ内に2つ目の状態を作らないため、制御コンポーネントにしている。
 *
 * @see apps/web/src/components/dashboard/DashboardHeader.tsx - ヘッダーでの使用
 */
import { useTranslation } from '@cliptap/shared';

/** 一覧の表示対象（定型文 / ショートカット） */
export type WebListMode = 'snippet' | 'shortcut';

/**
 * ListModeToggleのProps
 * @property mode - 表示中の一覧
 * @property onChange - 押されたときに、反対側の表示対象を渡して呼ぶ
 */
interface ListModeToggleProps {
  mode: WebListMode;
  onChange: (mode: WebListMode) => void;
}

export function ListModeToggle({ mode, onChange }: ListModeToggleProps) {
  const { t } = useTranslation();
  const isShowingShortcuts = mode === 'shortcut';

  return (
    /* 押下領域はトラックより上下に広げ、高さ44pxを確保する。
       押している間は全体を薄くし、押せたことをすぐに示す（モバイルのトグルと同じ0.2） */
    <button
      type="button"
      role="switch"
      aria-checked={isShowingShortcuts}
      aria-label={t('shortcut.show_shortcuts')}
      title={isShowingShortcuts ? t('shortcut.show_snippets') : t('shortcut.show_shortcuts')}
      onClick={() => onChange(isShowingShortcuts ? 'snippet' : 'shortcut')}
      className="flex h-11 items-center rounded-full px-1 active:opacity-20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
    >
      {/* トラック。塗りを持たず、ノブが動く範囲を示す枠線だけを引く。
          枠線1px + 内側の余白1px で、ノブをトラックの外形から2px内側に置く */}
      <span className="flex h-8 w-[52px] items-center rounded-full border border-gray-400 p-px dark:border-[#707070]">
        {/* ノブ。定型文は紺、ショートカットは黄色で塗る。枠線は付けず、塗りだけで形を示す */}
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full transition duration-100 motion-reduce:transition-none ${isShowingShortcuts ? 'translate-x-5 bg-[#FBBF24] text-[#212B3C]' : 'translate-x-0 bg-[#212B3C] text-white'}`}
        >
          {/* アイコンは今どちらの一覧かを表す（定型文=書類、ショートカット=稲妻）。
              色はノブの塗りの上で読める色にする（紺の上は白、黄色の上は紺） */}
          {isShowingShortcuts ? (
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          )}
        </span>
      </span>
    </button>
  );
}
