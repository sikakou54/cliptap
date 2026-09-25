/**
 * ショートカット値のプレビュー（Web版）
 *
 * 編集中の全ての値を、選択したプロファイルで同期展開して表示する。
 * 同期展開にすることで、値を削除したレンダリングと同時にプレビューからも行が消え、
 * ホーム・検索の一覧と同じ VariableService.expandTextSync の結果を表示できる。
 * 行のクリックでその値だけをコピーする。使用回数は加算せず、DBへ書き込まない（docs/機能仕様書.md §8.10）。
 *
 * @see apps/web/src/components/snippet/SnippetPreview.tsx - 定型文のプレビュー（見た目と候補の規則を揃えている）
 * @see apps/web/src/components/shortcut/ShortcutCard.tsx - 一覧の値の行（行の組み方を揃えている）
 * @see apps/mobile/src/components/shortcut/ShortcutPreview.tsx - モバイル版
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Logger,
  MASKED_VALUE_TEXT,
  getClipboardAdapter,
  useTranslation,
  useVariableExpansion,
  type Profile,
  type ProfileVariable,
  type Variable,
} from '@cliptap/shared';
import { ProfileTabs } from '@components/snippet/ProfileTabs';

/** コピー完了表示を出しておく時間（ミリ秒） */
const COPY_SUCCESS_DURATION_MS = 2000;

interface ShortcutPreviewValue {
  key: string;
  value: string;
  /** 表示を伏せるか（コピーは伏せていても展開後の実際の値を入れる） */
  isMasked: boolean;
}

interface ShortcutPreviewProps {
  values: ShortcutPreviewValue[];
  selectedProfileIds: string[];
  profiles: Profile[];
  variables: Variable[];
  profileVariables: ProfileVariable[];
  defaultProfileId: string | null;
}

export function ShortcutPreview({
  values,
  selectedProfileIds,
  profiles,
  variables,
  profileVariables,
  defaultProfileId,
}: ShortcutPreviewProps) {
  const { t, language } = useTranslation();
  const { expandVariables } = useVariableExpansion({ variables, profileVariables, locale: language });
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  /* 候補は有効なプロファイルだけ。対象未指定なら全件、指定時は対象に含まれるものだけにする。 */
  const filteredProfiles = useMemo(() => {
    const validProfiles = profiles.filter((profile) => profile.valid);
    return selectedProfileIds.length === 0
      ? validProfiles
      : validProfiles.filter((profile) => selectedProfileIds.includes(profile.id));
  }, [profiles, selectedProfileIds]);

  /* 選択中の候補が外れたら先頭へ移し、候補が0件なら選択を外す。 */
  useEffect(() => {
    if (filteredProfiles.length === 0) {
      setSelectedProfileId(null);
      return;
    }

    if (!selectedProfileId || !filteredProfiles.some((profile) => profile.id === selectedProfileId)) {
      setSelectedProfileId(filteredProfiles[0].id);
    }
  }, [filteredProfiles, selectedProfileId]);

  /* values と同じレンダリングで作り、入力・追加・削除を即時反映する。 */
  const previewRows = useMemo(
    () => values.map((entry) => ({
      key: entry.key,
      isMasked: entry.isMasked,
      expandedValue: expandVariables(entry.value, selectedProfileId, defaultProfileId),
    })),
    [defaultProfileId, expandVariables, selectedProfileId, values]
  );

  const handleCopy = async (key: string, text: string) => {
    if (text.trim() === '') return;

    try {
      /* アダプター未登録時の例外も捕捉するため、取得をtry内で行う。 */
      await getClipboardAdapter().copy(text);
      setCopiedKey(key);
    } catch (error) {
      Logger.error('Failed to copy shortcut value preview:', error);
    }
  };

  useEffect(() => {
    if (copiedKey === null) return;

    const timeoutId = setTimeout(() => setCopiedKey(null), COPY_SUCCESS_DURATION_MS);
    return () => clearTimeout(timeoutId);
  }, [copiedKey]);

  return (
    <div className="space-y-4 rounded-2xl border border-blue-200 bg-blue-50/30 p-4 dark:border-blue-900/40 dark:bg-blue-900/10">
      {/* プレビューラベル（コピーは値ごとに行が持つため、ヘッダーにコピーボタンを置かない） */}
      <p className="text-xs font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400">
        {t('common.preview')}
      </p>

      {/* プロファイルタブ（候補が0件のときは何も表示しない） */}
      <ProfileTabs
        profiles={filteredProfiles}
        selectedProfileId={selectedProfileId}
        onSelectProfile={setSelectedProfileId}
      />

      {/* 値ごとの展開結果（値が1件も無いときは空状態メッセージ） */}
      <div className="space-y-1 rounded-xl border border-gray-200 bg-white p-4 dark:border-[#2A2A2A] dark:bg-[#101010]">
        {previewRows.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-[#A0A0A0]">{t('common.preview_empty')}</p>
        ) : (
          previewRows.map((row) => {
            const isEmpty = row.expandedValue.trim() === '';
            const isCopied = copiedKey === row.key;

            return (
              /* 値の行（クリックでその値だけをコピーする。展開結果が空の行は操作できない） */
              <button
                key={row.key}
                type="button"
                onClick={() => handleCopy(row.key, row.expandedValue)}
                disabled={isEmpty}
                className="-mx-2 block w-[calc(100%+1rem)] rounded-lg px-2 py-2 text-left transition-colors enabled:hover:bg-gray-50 disabled:cursor-default dark:enabled:hover:bg-[#2A2A2A]"
                title={isEmpty ? undefined : t('common.copy')}
              >
                {/* 変数を展開した値。長い値も折り返して全体を確かめられるようにする（空の場合は空状態メッセージ）。
                    伏せている値は記号に置き換える。展開結果が空の行はコピーできないためアイコンを出さない */}
                <span className={`block whitespace-pre-wrap break-words font-mono text-sm ${isEmpty ? 'text-gray-400 dark:text-[#707070]' : 'text-gray-700 dark:text-[#A0A0A0]'}`}>
                  {isEmpty ? t('common.preview_empty') : row.isMasked ? MASKED_VALUE_TEXT : row.expandedValue}
                  {!isEmpty && (
                    <span className={`ml-1 inline-block align-text-bottom ${isCopied ? 'text-emerald-500 dark:text-emerald-400' : 'text-gray-500 dark:text-[#A0A0A0]'}`}>
                      {isCopied ? (
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                        </svg>
                      )}
                    </span>
                  )}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
