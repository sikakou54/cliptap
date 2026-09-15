import type { Profile } from '@cliptap/shared';

interface SearchProfileBarProps {
  profiles: Profile[];
  selectedProfileId: string | null;
  getResultCount: (profileId: string) => number;
  onSelect: (profileId: string) => void;
}

export function SearchProfileBar({ profiles, selectedProfileId, getResultCount, onSelect }: SearchProfileBarProps) {
  const visibleProfiles = profiles.filter((profile) => getResultCount(profile.id) > 0);
  if (visibleProfiles.length === 0) return null;

  return (
    <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
      {visibleProfiles.map((profile) => {
        const selected = selectedProfileId === profile.id;
        return (
          <button
            type="button"
            key={profile.id}
            onClick={() => onSelect(profile.id)}
            className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium ${selected ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-[#333333] dark:bg-[#1A1A1A] dark:text-gray-300 dark:hover:bg-[#2A2A2A]'}`}
          >
            {profile.name} <span className={selected ? 'text-blue-100' : 'text-gray-400'}>{getResultCount(profile.id)}</span>
          </button>
        );
      })}
    </div>
  );
}
