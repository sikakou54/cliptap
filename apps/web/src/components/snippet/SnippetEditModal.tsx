/**
 * スニペット編集モーダルコンポーネント
 *
 * @description
 * スニペット（定型文）の作成・編集を行うフルスクリーンモーダル。
 * 左右2カラム構成で、左に編集フォーム、右に変数バッジとプレビューを表示。
 *
 * 機能:
 * - タイトル・本文入力
 * - カテゴリ選択
 * - プロファイル選択（表示対象環境）
 * - 変数挿入（システム変数・カスタム変数）
 * - リアルタイムプレビュー
 * - タイトル付きコピー設定
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import type { Variable, Category, Profile, ProfileVariable } from '@cliptap/shared';
import { useUnsavedChangesWarning } from '@hooks/useUnsavedChangesWarning';
import { useBodyScrollLock } from '@hooks/useBodyScrollLock';
import { useEscapeClose } from '@hooks/useEscapeClose';
import type { SnippetFormValues } from '@hooks/screens/useSnippetModal';
import { SnippetEditModalHeader } from './SnippetEditModalHeader';
import { SnippetEditModalFooter } from './SnippetEditModalFooter';
import { SnippetEditForm } from './SnippetEditForm';
import { SnippetEditSidebar } from './SnippetEditSidebar';

export type { SnippetFormValues };

interface SnippetEditModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialTitle: string;
  initialContent: string;
  initialCategoryId: string | null;
  initialProfileIds: string[];
  initialCopyWithTitle: boolean;
  categories: Category[];
  profiles: Profile[];
  profileVariables: ProfileVariable[];
  variables: Variable[];
  onSave: (values: SnippetFormValues) => void;
  onClose: () => void;
}

export function SnippetEditModal({
  isOpen,
  mode,
  initialTitle,
  initialContent,
  initialCategoryId,
  initialProfileIds,
  initialCopyWithTitle,
  categories,
  profiles,
  profileVariables,
  variables,
  onSave,
  onClose,
}: SnippetEditModalProps) {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [categoryId, setCategoryId] = useState<string | null>(initialCategoryId);
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>(initialProfileIds);
  const [copyWithTitle, setCopyWithTitle] = useState(initialCopyWithTitle);
  const [activeField, setActiveField] = useState<'title' | 'content' | null>(null);
  const [lastFocusedField, setLastFocusedField] = useState<'title' | 'content' | null>(null);
  const [pendingCursorPosition, setPendingCursorPosition] = useState<{ field: 'title' | 'content'; position: number } | null>(null);
  const formRef = useRef<{ titleInputRef: React.RefObject<HTMLInputElement>; contentTextareaRef: React.RefObject<HTMLTextAreaElement> } | null>(null);

  const hasChanges = useMemo(() => {
    if (!isOpen) return false;
    const titleChanged = title !== initialTitle;
    const contentChanged = content !== initialContent;
    const categoryChanged = categoryId !== initialCategoryId;
    const copyWithTitleChanged = copyWithTitle !== initialCopyWithTitle;
    const sortedSelected = [...selectedProfileIds].sort();
    const sortedInitial = [...initialProfileIds].sort();
    const profilesChanged = sortedSelected.length !== sortedInitial.length ||
      sortedSelected.some((id, i) => id !== sortedInitial[i]);

    return titleChanged || contentChanged || categoryChanged || copyWithTitleChanged || profilesChanged;
  }, [isOpen, title, initialTitle, content, initialContent, categoryId, initialCategoryId, copyWithTitle, initialCopyWithTitle, selectedProfileIds, initialProfileIds]);

  const { confirmClose } = useUnsavedChangesWarning({
    hasChanges,
    isActive: isOpen,
  });

  const handleClose = () => confirmClose(onClose);

  useBodyScrollLock(isOpen);
  /* 未保存確認を挟むため handleClose を渡す */
  useEscapeClose(isOpen, handleClose);

  useEffect(() => {
    if (isOpen) {
      setTitle(initialTitle);
      setContent(initialContent);
      setCategoryId(initialCategoryId);
      setSelectedProfileIds(initialProfileIds);
      setCopyWithTitle(initialCopyWithTitle);
      setActiveField(null);
      setLastFocusedField(null);
    }
  }, [isOpen, initialTitle, initialContent, initialCategoryId, initialProfileIds, initialCopyWithTitle]);

  useEffect(() => {
    if (pendingCursorPosition && formRef.current) {
      const ref = pendingCursorPosition.field === 'title' ? formRef.current.titleInputRef : formRef.current.contentTextareaRef;
      if (ref.current) {
        ref.current.focus();
        ref.current.setSelectionRange(pendingCursorPosition.position, pendingCursorPosition.position);
      }
      setPendingCursorPosition(null);
    }
  }, [pendingCursorPosition, title, content]);

  /**
   * 変数を挿入（カーソル位置に変数名を挿入）
   *
   * アクティブフィールドまたは最後にフォーカスしたフィールドのカーソル位置に
   * `{{変数名}}`形式の変数テキストを挿入する。
   * フォーカスがない場合は本文フィールドに挿入。
   * 挿入後、カーソル位置を変数テキストの直後に移動。
   */
  const insertVariable = (variableName: string) => {
    const variableText = `{{${variableName}}}`;
    /* 挿入先フィールドを決定: アクティブ → 最後にフォーカス → デフォルト（content） */
    const targetField = activeField || lastFocusedField || 'content';

    if (!formRef.current) return;
    const ref = targetField === 'title' ? formRef.current.titleInputRef : formRef.current.contentTextareaRef;

    if (ref.current) {
      /* フォーカス中のフィールドに挿入: カーソル位置を取得して変数を挿入 */
      const input = ref.current;
      const start = input.selectionStart || 0;
      const end = input.selectionEnd || 0;
      const currentValue = targetField === 'title' ? title : content;
      const newValue = currentValue.slice(0, start) + variableText + currentValue.slice(end);
      const newCursorPos = start + variableText.length;

      if (targetField === 'title') {
        setTitle(newValue);
      } else {
        setContent(newValue);
      }

      /* カーソル位置を変数テキストの直後に設定（useEffectで反映） */
      setPendingCursorPosition({ field: targetField, position: newCursorPos });
      setActiveField(targetField);
      setLastFocusedField(targetField);
    } else {
      /* フォーカス中のフィールドがない場合: 本文フィールドの末尾に挿入 */
      const newValue = content + variableText;
      const newCursorPos = newValue.length;
      setContent(newValue);
      setPendingCursorPosition({ field: 'content', position: newCursorPos });
      setActiveField('content');
      setLastFocusedField('content');
    }
  };

  const handleSave = () => {
    if (!title.trim()) {
      return;
    }
    onSave({
      title: title.trim(),
      content: content.trim(),
      categoryId,
      profileIds: selectedProfileIds,
      copyWithTitle,
    });
  };

  /* モーダルが閉じている場合は何も表示しない */
  if (!isOpen) return null;

  /* スニペット編集モーダル（フルスクリーン、2カラム構成）
      背景クリックで閉じる機能付き。未保存の変更がある場合は確認ダイアログを表示。 */
  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/80 flex items-center justify-center p-4 z-50" onClick={handleClose}>
      {/* モーダルコンテナ（画面の8割の大きさ、クリックイベントの伝播を停止）
          デスクトップは幅80vw・高さ80vhで固定し、はみ出した内容は各カラムの中でスクロールする。
          スマートフォンでは幅いっぱい（背景の余白ぶんを除く）とし、高さは内容に合わせて最大90vhまで伸ばす。
          背景クリックで閉じる機能を実現するため、コンテナ内のクリックは伝播を停止。 */}
      <div
        className="bg-white dark:bg-[#1A1A1A] rounded-2xl w-full md:w-[80vw] max-h-[90vh] md:h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー（タイトルと閉じるボタン）
            作成/編集モードに応じてタイトルを切り替え。
            閉じるボタンクリック時も未保存変更の確認を行う。 */}
        <SnippetEditModalHeader mode={mode} onClose={handleClose} />

        {/* コンテンツ（2カラム構成：左=編集フォーム、右=変数・プレビュー）
            モバイルでは縦並び、デスクトップでは横並び（flex-col md:flex-row）。
            デスクトップでは各カラムが独立してスクロール可能。 */}
        <div className="flex-1 overflow-y-auto md:overflow-hidden flex flex-col md:flex-row">
          {/* 左カラム：編集エリア（タイトル・本文・カテゴリ・プロファイル・タイトル付きコピー設定）
              フォーム入力フィールドと、フォーカス状態の管理を行う。
              フォーカス状態は変数挿入時の挿入先フィールドの判定に使用。 */}
          <SnippetEditForm
            ref={formRef}
            title={title}
            content={content}
            categoryId={categoryId}
            selectedProfileIds={selectedProfileIds}
            copyWithTitle={copyWithTitle}
            categories={categories}
            profiles={profiles}
            onTitleChange={setTitle}
            onContentChange={setContent}
            onCategoryChange={setCategoryId}
            onProfileIdsChange={setSelectedProfileIds}
            onCopyWithTitleChange={setCopyWithTitle}
            onFieldFocus={(field) => {
              /* フィールドフォーカス時: アクティブフィールドと最後にフォーカスしたフィールドを更新 */
              setActiveField(field);
              setLastFocusedField(field);
            }}
            onFieldBlur={() => {
              /* フィールドブラー時: 200ms遅延後にアクティブフィールドをクリア
                  （変数挿入ボタンクリック時のフォーカス移動を考慮）。
                  遅延の責務はここに一本化しており、SnippetEditForm 側では遅延させない。
                  なお activeField は null か lastFocusedField と同値しか取らないため、
                  クリアの時刻が挿入先（targetField）の判定結果を変えることはない。 */
              setTimeout(() => {
                setActiveField(null);
              }, 200);
            }}
          />

          {/* 右カラム：変数・プレビュー（変数バッジとリアルタイムプレビュー）
              システム変数・カスタム変数の挿入ボタンと、入力内容のリアルタイムプレビューを表示。
              プレビューでは変数が実際の値に置換された状態を表示。 */}
          <SnippetEditSidebar
            title={title}
            content={content}
            copyWithTitle={copyWithTitle}
            selectedProfileIds={selectedProfileIds}
            profiles={profiles}
            variables={variables}
            profileVariables={profileVariables}
            onInsertVariable={insertVariable}
          />
        </div>

        {/* フッター（キャンセル・保存ボタン）
            タイトルが空の場合は保存ボタンを無効化。
            キャンセル時も未保存変更の確認を行う。 */}
        <SnippetEditModalFooter onClose={handleClose} onSave={handleSave} canSave={!!title.trim()} />
      </div>
    </div>
  );
}

