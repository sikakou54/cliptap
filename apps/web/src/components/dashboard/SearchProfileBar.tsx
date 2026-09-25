/**
 * 検索対象プロファイルの切替チップ（Web版）
 *
 * @description
 * 検索画面の上部に置く、プロファイルの切替。押すとそのプロファイルで検索し直す。
 * 検索語があるときは一致件数も添える。
 *
 * @remarks
 * 押しても標準（DBのアクティブ）は変えず、検索画面を閉じるまでの一時的な対象切替として働く（§8.7）。
 * 先頭の「すべて」が既定で、有効な全プロファイルを横断して検索する。プロファイルを押すと
 * その環境の結果だけに絞り込む（§8.7）。
 * 有効なプロファイルが1件だけのときも出す。切り替える先は無いが、どのプロファイルを対象に
 * 検索しているかを常に示すためである（モバイルも同じ条件で、判定は app/search.tsx が持つ）。
 *
 * 【チップの見た目の出どころ】
 * 角丸・枠線・配色は、モバイルのチップ実装（apps/mobile/src/components/profile/ProfileChipSelector.tsx と
 * apps/mobile/src/components/category/CategoryFilter.tsx）が使うテーマトークンと同じ値に揃えている。
 * Web内の3つのチップ（dashboard/SearchProfileBar、common/CategoryFilterBar、variable/ProfileFilter）は
 * すべて同じ値のため、見た目を変えるときは3つとモバイル側をまとめて直す。
 *
 * @see apps/web/src/components/dashboard/SearchScreen.tsx - 使用元
 * @see apps/mobile/app/search.tsx - モバイルの出し分け条件
 * @see apps/mobile/src/components/profile/ProfileChipSelector.tsx - モバイルの同じ役割
 */
import type { Profile } from '@cliptap/shared';

/**
 * SearchProfileBarのProps
 * @property profiles - 候補にする有効なプロファイル
 * @property selectedProfileId - 選択中のプロファイル
 * @property getResultCount - プロファイルごとの一致件数
 * @property onSelect - プロファイルを選んだときのコールバック
 * @property showCount - 件数を添えるか（検索語があるときだけtrue）
 */
interface SearchProfileBarProps {
  profiles: Profile[];
  selectedProfileId: string | null;
  getResultCount: (profileId: string) => number;
  onSelect: (profileId: string | null) => void;
  showCount: boolean;
  /** 「すべて」チップの文言 */
  allLabel: string;
  /** 「すべて」チップに添える件数 */
  allCount: number;
}

export function SearchProfileBar({ profiles, selectedProfileId, getResultCount, onSelect, showCount, allLabel, allCount }: SearchProfileBarProps) {
  /* 検索語があるときだけ、一致0件のプロファイルを落とす。
     入力前に落とすと、項目を持たないプロファイルへ切り替えられなくなる（モバイルも全件出す） */
  const visibleProfiles = showCount ? profiles.filter((profile) => getResultCount(profile.id) > 0) : profiles;
  if (profiles.length === 0) return null;

  /* チップ行の上下の余白。検索画面は検索欄・チップ・結果一覧の3つだけを縦に積むため、
     ダッシュボードのカテゴリフィルター（CategoryFilterBar）より一段広くとって行の区切りを見せる */
  return (
    <div className="mt-4 flex gap-2 overflow-x-auto pb-3">
      {/* 「すべて」チップ。横断検索が既定のため先頭へ置く（§8.7） */}
      <button
        type="button"
        onClick={() => onSelect(null)}
        aria-pressed={selectedProfileId === null}
        className={`flex items-center gap-1 whitespace-nowrap rounded-2xl border px-3 py-1.5 text-sm font-medium ${selectedProfileId === null ? 'border-[#3B82F6] bg-[#3B82F6] text-white dark:border-[#60A5FA] dark:bg-[#60A5FA]' : 'border-[#E5E7EB] bg-[#F8FAFC] text-[#111827] hover:bg-[#F3F4F6] dark:border-[#2A2A2A] dark:bg-[#1A1A1A] dark:text-white dark:hover:bg-[#2A2A2A]'}`}
      >
        {allLabel}
        {showCount && allCount > 0 && (
          <span
            className={`min-w-5 rounded-md px-1 py-0.5 text-center text-xs font-semibold ${selectedProfileId === null ? 'bg-white/30 text-white' : 'bg-[#E5E7EB] text-[#6B7280] dark:bg-[#2A2A2A] dark:text-[#A0A0A0]'}`}
          >
            {allCount}
          </span>
        )}
      </button>

      {visibleProfiles.map((profile) => {
        const selected = selectedProfileId === profile.id;
        const count = getResultCount(profile.id);
        return (
          <button
            type="button"
            key={profile.id}
            onClick={() => onSelect(profile.id)}
            aria-pressed={selected}
            className={`flex items-center gap-1 whitespace-nowrap rounded-2xl border px-3 py-1.5 text-sm font-medium ${selected ? 'border-[#3B82F6] bg-[#3B82F6] text-white dark:border-[#60A5FA] dark:bg-[#60A5FA]' : 'border-[#E5E7EB] bg-[#F8FAFC] text-[#111827] hover:bg-[#F3F4F6] dark:border-[#2A2A2A] dark:bg-[#1A1A1A] dark:text-white dark:hover:bg-[#2A2A2A]'}`}
          >
            {profile.name}
            {/* 一致件数のバッジ。モバイルのプロファイルチップ（ProfileChipSelector）と同じ形で、
                検索語があり、かつ1件以上あるときだけ添える */}
            {showCount && count > 0 && (
              <span
                className={`min-w-5 rounded-md px-1 py-0.5 text-center text-xs font-semibold ${selected ? 'bg-white/30 text-white' : 'bg-[#E5E7EB] text-[#6B7280] dark:bg-[#2A2A2A] dark:text-[#A0A0A0]'}`}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
