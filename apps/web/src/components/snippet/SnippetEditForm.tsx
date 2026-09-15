/**
 * スニペット編集フォームコンポーネント
 *
 * @description
 * スニペット編集モーダルの左カラム（編集フォーム）
 */
import { useRef, forwardRef, useImperativeHandle } from 'react';
import { useTranslation, INPUT_LIMITS } from '@cliptap/shared';
import type { Category, Profile } from '@cliptap/shared';
import { ProfileMultiSelect } from '@components/profile/ProfileMultiSelect';
import { QuickCategoryCreateButton } from '@components/category/QuickCategoryCreateButton';

export interface SnippetEditFormRef {
  titleInputRef: React.RefObject<HTMLInputElement | null>;
  contentTextareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

interface SnippetEditFormProps {
  title: string;
  content: string;
  categoryId: string | null;
  selectedProfileIds: string[];
  copyWithTitle: boolean;
  categories: Category[];
  profiles: Profile[];
  onTitleChange: (title: string) => void;
  onContentChange: (content: string) => void;
  onCategoryChange: (categoryId: string | null) => void;
  onProfileIdsChange: (profileIds: string[]) => void;
  onCopyWithTitleChange: (copyWithTitle: boolean) => void;
  onFieldFocus: (field: 'title' | 'content') => void;
  onFieldBlur: () => void;
}

export const SnippetEditForm = forwardRef<SnippetEditFormRef, SnippetEditFormProps>(function SnippetEditForm({
  title,
  content,
  categoryId,
  selectedProfileIds,
  copyWithTitle,
  categories,
  profiles,
  onTitleChange,
  onContentChange,
  onCategoryChange,
  onProfileIdsChange,
  onCopyWithTitleChange,
  onFieldFocus,
  onFieldBlur,
}, ref) {
  const { t } = useTranslation();
  const titleInputRef = useRef<HTMLInputElement>(null);
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({
    titleInputRef,
    contentTextareaRef,
  }));

  /* スニペット編集フォーム（タイトル、本文、カテゴリ、プロファイル、タイトル付きコピー設定）
     モーダルの左カラムに配置。レスポンシブ対応（モバイルでは全幅、デスクトップでは半分）。
     スクロール可能（デスクトップのみ）。 */
  return (
    <div className="w-full md:w-1/2 overflow-visible md:overflow-y-auto p-6 space-y-6 border-b md:border-b-0 md:border-r border-gray-200 dark:border-[#2A2A2A]">
      {/* タイトル入力フィールド
          スニペットのタイトルを入力。最大文字数制限あり。
          refは変数挿入機能でカーソル位置を制御するために使用。
          onFocus/onBlurでアクティブフィールドを管理（変数挿入先を決定）。 */}
      <div>
        {/* ラベルと文字数カウンター */}
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700 dark:text-[#A0A0A0]">{t('snippet.title')}</label>
          <span className="text-xs text-gray-500 dark:text-[#707070]">
            {title.length}/{INPUT_LIMITS.SNIPPET_TITLE_MAX}
          </span>
        </div>
        <input
          ref={titleInputRef}
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          onFocus={() => onFieldFocus('title')}
          onBlur={() => onFieldBlur()}
          placeholder={t('snippet.title_input_placeholder')}
          maxLength={INPUT_LIMITS.SNIPPET_TITLE_MAX}
          className="w-full px-4 py-3 border border-gray-300 dark:border-[#2A2A2A] rounded-xl focus:outline-none bg-white dark:bg-[#1A1A1A] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-[#707070]"
        />
      </div>

      {/* 本文入力フィールド
          スニペットの本文（コンテンツ）を入力。複数行対応（rows={12}）。
          refは変数挿入機能でカーソル位置を制御するために使用。
          onFocus/onBlurでアクティブフィールドを管理（変数挿入先を決定）。
          リサイズ不可（resize-none）。 */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-[#A0A0A0] mb-2">{t('snippet.content')}</label>
        <textarea
          ref={contentTextareaRef}
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          onFocus={() => onFieldFocus('content')}
          onBlur={() => onFieldBlur()}
          placeholder={t('snippet.content_placeholder')}
          rows={12}
          className="w-full px-4 py-3 border border-gray-300 dark:border-[#2A2A2A] rounded-xl focus:outline-none resize-none bg-white dark:bg-[#1A1A1A] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-[#707070]"
        />
      </div>

      {/* カテゴリ選択ドロップダウン
          スニペットを分類するカテゴリを選択。
          空文字列（未分類）を選択可能。categories配列から動的に生成。 */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700 dark:text-[#A0A0A0]">{t('snippet.category')}</label>
          <QuickCategoryCreateButton onCreated={onCategoryChange} />
        </div>
        <select
          value={categoryId || ''}
          onChange={(e) => onCategoryChange(e.target.value || null)}
          className="w-full px-4 py-3 border border-gray-300 dark:border-[#2A2A2A] rounded-xl focus:outline-none bg-white dark:bg-[#1A1A1A] text-gray-900 dark:text-white"
        >
          {/* 未分類オプション（空文字列でnullを表現） */}
          <option value="">{t('category.uncategorized')}</option>
          {/* カテゴリリスト（動的に生成） */}
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      {/* プロファイル複数選択（スニペットを表示する環境を選択）
          このスニペットを表示するプロファイル（環境）を複数選択可能。
          ProfileMultiSelectコンポーネントを使用。 */}
      <div>
        <ProfileMultiSelect
          profiles={profiles}
          selectedProfileIds={selectedProfileIds}
          onChange={onProfileIdsChange}
        />
      </div>

      {/* タイトル付きコピー設定（トグルスイッチ）
          コピー時にタイトルも含めるかどうかを設定。
          説明文とトグルスイッチを横並びで配置。 */}
      <div className="flex items-center justify-between">
        {/* 説明文（タイトルと説明） */}
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-[#A0A0A0]">{t('snippet.copy_with_title')}</p>
          <p className="text-xs text-gray-500 dark:text-[#707070]">{t('snippet.copy_with_title_description')}</p>
        </div>
        {/* トグルスイッチ（ON/OFF切り替え）
            クリックで状態を反転。ON時は青色、OFF時はグレー。
            スイッチの位置（left-1/left-7）でON/OFFを視覚的に表現。 */}
        <button
          type="button"
          onClick={() => onCopyWithTitleChange(!copyWithTitle)}
          className={`relative w-12 h-6 rounded-full transition-colors ${
            copyWithTitle ? 'bg-blue-600' : 'bg-gray-300 dark:bg-[#2A2A2A]'
          }`}
        >
          <span
            className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${copyWithTitle ? 'left-7' : 'left-1'}`}
          />
        </button>
      </div>
    </div>
  );
});
