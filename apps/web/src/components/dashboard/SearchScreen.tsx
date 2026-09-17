/**
 * 検索画面（Web版）
 *
 * @description
 * ダッシュボードの検索ボタンで開く、検索専用の画面。画面全体を覆い、
 * 上から順に「閉じるボタンと検索欄」「プロファイルチップ」「結果一覧」を並べる。
 * 結果一覧は呼び出し側から children で受け取り、通常表示と同じグリッドをそのまま使う。
 *
 * @remarks
 * 【ヘッダーではなく画面にした理由】
 * 検索バーをヘッダーの行に差し込むと、その分だけプロファイル切替やカテゴリ行が隠れ、
 * 検索中だけヘッダーの作りが変わる。ヘッダーへ重ねて浮かせる案も、表示切替トグルや
 * 並べ替えボタンを覆ってしまう。モバイル（apps/mobile/app/search.tsx）と同じく
 * 検索専用の画面にすれば、検索中は検索のためだけの並びにできる。
 *
 * 【サイドメニューごと覆う理由】
 * モバイルの検索画面と同じく、検索中は検索だけに集中できる画面にする。
 * 他の画面への移動は、閉じてダッシュボードへ戻ってから行う。
 *
 * 【カテゴリを置かない理由】
 * 検索はカテゴリで絞り込まない（§8.7）。モバイルの検索画面もカテゴリを持たず、
 * プロファイルの切替だけで対象を変える。
 *
 * @see apps/web/src/pages/Dashboard.tsx - 使用元
 * @see apps/web/src/components/dashboard/SearchProfileBar.tsx - 一致件数付きのプロファイル切替
 * @see apps/mobile/app/search.tsx - モバイルの検索画面（並びと振る舞いの基準）
 */
import type { ReactNode } from 'react';
import { useTranslation } from '@cliptap/shared';
import type { Profile } from '@cliptap/shared';
import { useEscapeClose } from '@hooks/useEscapeClose';
import { SearchProfileBar } from './SearchProfileBar';

/**
 * SearchScreenのProps
 * @property searchQuery - 現在の検索語
 * @property setSearchQuery - 検索語の変更
 * @property onClose - 画面を閉じる（呼び出し側で検索語もクリアする）
 * @property placeholderKey - 入力欄のプレースホルダーの翻訳キー（定型文・ショートカットで出し分ける）
 * @property profiles - 切替の候補にする有効なプロファイル
 * @property searchProfileId - 検索対象として選んでいるプロファイル
 * @property getSearchResultCount - プロファイルごとの一致件数
 * @property allSearchResultCount - 横断した全体の一致件数
 * @property onSearchProfileSelect - プロファイルを選んだときのコールバック
 * @property children - 結果一覧（通常表示と同じグリッド）
 */
interface SearchScreenProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onClose: () => void;
  placeholderKey: string;
  profiles: Profile[];
  searchProfileId: string | null;
  getSearchResultCount: (profileId: string) => number;
  allSearchResultCount: number;
  onSearchProfileSelect: (profileId: string | null) => void;
  children: ReactNode;
}

export function SearchScreen({
  searchQuery,
  setSearchQuery,
  onClose,
  placeholderKey,
  profiles,
  searchProfileId,
  getSearchResultCount,
  allSearchResultCount,
  onSearchProfileSelect,
  children,
}: SearchScreenProps) {
  const { t } = useTranslation();

  /* Escキーで閉じる。開いている間だけ描画されるコンポーネントのため、常に開いているものとして登録する */
  useEscapeClose(true, onClose);

  /* 検索画面（サイドメニューも含めて画面全体を覆う）。
     下地はダッシュボードと同じ色を透かし、後ろに元の画面があることを見せる。
     ぼかしは掛けない。掛けると透かした意味が薄れ、後ろに何があるのか分からなくなる。
     z-40 はサイドメニュー（z-30）より上、編集モーダル（z-50）より下。
     モーダルと同じz-50にすると重なり順が描画順まかせになる */
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('common.search')}
      className="fixed inset-0 z-40 flex flex-col bg-gray-50/80 dark:bg-black/80"
    >
      {/* 検索欄と閉じるボタン（モバイルの検索画面と同じ並び）。
          下の罫線は引かない。下地を透かしているため、線を引くと後ろの画面と二重に見える。
          フィルター周囲の余白はSearchProfileBarにまとめる。 */}
      <div className="flex shrink-0 items-center gap-3 px-6 pt-4">
        <div className="relative flex-1">
          {/* 虫眼鏡アイコン（左側） */}
          <svg
            className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 dark:text-[#707070]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t(placeholderKey)}
            autoFocus
            className="block h-10 w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none dark:border-[#2A2A2A] dark:bg-[#1A1A1A] dark:text-white dark:placeholder-[#707070]"
          />
        </div>

        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 dark:text-[#A0A0A0] dark:hover:bg-[#2A2A2A]"
          aria-label={t('common.close')}
          title={t('common.close')}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* プロファイルチップ。先頭の「すべて」が既定で、有効な全プロファイルを横断して検索する。
          プロファイルを押すとその環境の結果だけに絞り込む。
          入力前から出し、件数は検索語があるときだけ添える（モバイルと同じ） */}
      <div className="shrink-0 px-6">
        <SearchProfileBar
          profiles={profiles}
          selectedProfileId={searchProfileId}
          getResultCount={getSearchResultCount}
          onSelect={onSearchProfileSelect}
          showCount={searchQuery.trim() !== ''}
          allLabel={t('profile.search_all')}
          allCount={allSearchResultCount}
        />
      </div>

      {/* 結果一覧。スクロールするのはここだけにして、検索欄とチップは常に見えるようにする。
          フィルター下の余白と重複しないよう、一覧側には上余白を足さない。 */}
      <div className={`min-h-0 flex-1 overflow-y-auto px-6 pb-4 ${profiles.length === 0 ? 'pt-3' : ''}`}>{children}</div>
    </div>
  );
}
