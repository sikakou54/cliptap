/**
 * プロファイル複数選択コンポーネント
 *
 * @description
 * スニペット編集時に、そのスニペットを表示するプロファイル（環境）を
 * 複数選択するためのUIコンポーネント。
 *
 * 選択オプション:
 * - 「全て」: 全プロファイルで表示（selectedProfileIds = []）
 * - 個別プロファイル: 選択したプロファイルのみで表示
 */
import { useTranslation } from '@cliptap/shared';
import type { Profile } from '@cliptap/shared';

/** コンポーネントのプロパティ */
interface ProfileMultiSelectProps {
  /** 選択可能なプロファイル一覧 */
  profiles: Profile[];
  /** 選択中のプロファイルID配列（空配列 = 全選択） */
  selectedProfileIds: string[];
  /** 選択状態変更時のコールバック */
  onChange: (ids: string[]) => void;
}

/* ボタンの共通スタイルクラス */
const BASE_BUTTON_CLASSES =
  'px-3 py-1.5 rounded-full text-sm font-medium transition-colors border';

export function ProfileMultiSelect({
  profiles,
  selectedProfileIds,
  onChange,
}: ProfileMultiSelectProps) {
  /* 多言語翻訳関数を取得 */
  const { t } = useTranslation();
  /* 空配列の場合は「全て」が選択されているとみなす */
  const isAllSelected = selectedProfileIds.length === 0;

  /**
   * プロファイルの選択状態をトグル
   * @param profileId - トグル対象のプロファイルID
   */
  const toggleProfile = (profileId: string) => {
    /* すでに選択されている場合は除外 */
    if (selectedProfileIds.includes(profileId)) {
      onChange(selectedProfileIds.filter((id) => id !== profileId));
      return;
    }
    /* 選択されていない場合は追加 */
    onChange([...selectedProfileIds, profileId]);
  };

  /* プロファイル複数選択コンポーネント（スニペット編集時に使用） */
  return (
    <div>
      {/* ヘッダー（タイトルと選択数） */}
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-gray-700 dark:text-[#A0A0A0]">
          {t('profile.select_profiles_title')}
        </label>
        {/* 個別選択されている場合のみ選択数を表示 */}
        {selectedProfileIds.length > 0 && (
          <span className="text-xs text-gray-500 dark:text-[#707070]">
            {t('profile.profiles_selected', { count: selectedProfileIds.length })}
          </span>
        )}
      </div>
      {/* 説明テキスト */}
      <p className="text-xs text-gray-500 dark:text-[#707070] mb-3">
        {t('snippet.select_profiles_description')}
      </p>

      {/* プロファイル選択ボタンエリア */}
      {profiles.length === 0 ? (
        /* プロファイルが0件の場合は空状態を表示 */
        <div className="p-4 bg-gray-50 dark:bg-[#2A2A2A] border border-dashed border-gray-200 dark:border-[#333333] rounded-xl text-sm text-gray-500 dark:text-[#A0A0A0]">
          {t('profile.no_profiles')}
        </div>
      ) : (
        /* プロファイルが存在する場合はボタン一覧を表示 */
        <div className="flex flex-wrap gap-2">
          {/* 「全て」ボタン（空配列 = 全プロファイルで表示） */}
          <button
            type="button"
            onClick={() => onChange([])}
            className={`${BASE_BUTTON_CLASSES} ${
              isAllSelected
                ? 'bg-blue-600 dark:bg-blue-500 border-blue-600 dark:border-blue-500 text-white'
                : 'bg-gray-100 dark:bg-[#2A2A2A] border-gray-200 dark:border-[#333333] text-gray-700 dark:text-[#A0A0A0] hover:bg-gray-200 dark:hover:bg-[#333333]'
            }`}
          >
            {t('profile.all_profiles')}
          </button>
          {/* 個別プロファイルボタン（クリックでトグル） */}
          {profiles.map((profile) => {
            const isSelected = selectedProfileIds.includes(profile.id);
            /* 個別プロファイルボタン（クリックでトグル） */
            return (
              <button
                type="button"
                key={profile.id}
                onClick={() => toggleProfile(profile.id)}
                className={`${BASE_BUTTON_CLASSES} ${
                  isSelected
                    ? 'bg-blue-600 dark:bg-blue-500 border-blue-600 dark:border-blue-500 text-white'
                    : 'bg-white dark:bg-[#1A1A1A] border-gray-200 dark:border-[#333333] text-gray-700 dark:text-[#A0A0A0] hover:bg-gray-50 dark:hover:bg-[#2A2A2A]'
                }`}
              >
                {profile.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

