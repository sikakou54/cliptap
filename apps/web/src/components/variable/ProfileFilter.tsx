/**
 * プロファイルフィルターコンポーネント
 *
 * @description
 * 変数値を表示する対象プロファイル（環境）を切り替えるフィルター。
 * プロファイルごとに異なる値を持つカスタム変数の値を確認できる。
 *
 * 【チップの見た目の出どころ】
 * 角丸・枠線・配色は、モバイルのチップ実装（apps/mobile/src/components/profile/ProfileChipSelector.tsx と
 * apps/mobile/src/components/category/CategoryFilter.tsx）が使うテーマトークンと同じ値に揃えている。
 * Web内の3つのチップ（dashboard/SearchProfileBar、common/CategoryFilterBar、variable/ProfileFilter）は
 * すべて同じ値のため、見た目を変えるときは3つとモバイル側をまとめて直す。
 */
import type { Profile } from '@cliptap/shared';

interface ProfileFilterProps {
  profiles: Profile[];
  selectedProfileId: string | null;
  onSelectProfile: (profileId: string) => void;
}

export function ProfileFilter({ profiles, selectedProfileId, onSelectProfile }: ProfileFilterProps) {
  if (profiles.length === 0) return null;

  /* プロファイルフィルター（環境切り替え、選択状態に応じてスタイル変更） */
  return (
    <div className="flex gap-2 overflow-x-auto py-2">
      {profiles.map((profile) => {
        const isSelected = selectedProfileId === profile.id;
        /* プロファイルフィルターボタン */
        return (
          <button
            key={profile.id}
            onClick={() => onSelectProfile(profile.id)}
            className={`whitespace-nowrap rounded-2xl border px-3 py-1.5 text-sm font-medium transition-colors ${
              isSelected
                ? 'border-[#3B82F6] bg-[#3B82F6] text-white dark:border-[#60A5FA] dark:bg-[#60A5FA]'
                : 'border-[#E5E7EB] bg-[#F8FAFC] text-[#111827] hover:bg-[#F3F4F6] dark:border-[#2A2A2A] dark:bg-[#1A1A1A] dark:text-white dark:hover:bg-[#2A2A2A]'
            }`}
          >
            {profile.name}
          </button>
        );
      })}
    </div>
  );
}

