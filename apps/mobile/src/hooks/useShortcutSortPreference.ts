/**
 * ショートカットの並べ替え設定
 *
 * @module useShortcutSortPreference
 *
 * @remarks
 * ホームの一覧と検索結果は同じ並べ替えに従う（§8.7）。
 * 保存キー・既定値・読み書きをこのフックへ集め、画面ごとに持たないようにする。
 * 画面ごとに持つと、片方だけキーや既定値を直したときに並び順が食い違う。
 *
 * 【SortPreferenceAdapterを使わない理由】
 * 定型文の並べ替えはSortPreferenceAdapter経由で保存しているが、あれはWebとも共有する仕組みで、
 * ショートカットはモバイルだけの機能。共有インターフェースへショートカット用の口を足すと
 * Webに使われないメソッドが増えるため、ここで直接保存する
 * （モバイル固有の保存をAsyncStorageへ直接行う例は src/utils/devAdsOverride.ts にもある）。
 *
 * @see src/hooks/screens/useHomeShortcuts.ts - ホームの一覧（並べ替えの変更もここから）
 * @see src/hooks/screens/useSearchShortcuts.ts - 検索結果（読み取りだけ）
 */

import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Logger, type SnippetSortBy } from '@cliptap/shared';

/** 並べ替え設定の保存キー */
const SORT_PREFERENCE_KEY = '@shortcut_sort_preference';

/** 並べ替えの既定値（定型文と同じ） */
const DEFAULT_SORT: SnippetSortBy = 'created';

/** 保存値として受け付ける並べ替え基準 */
const SORT_VALUES: readonly SnippetSortBy[] = ['created', 'updated', 'title', 'usage'];

/**
 * useShortcutSortPreferenceの戻り値の型
 */
export interface UseShortcutSortPreferenceReturn {
  /** 現在の並べ替え基準（保存値の読み込みが終わるまでは既定値） */
  currentSort: SnippetSortBy;
  /** 並べ替え基準を変更して保存する */
  handleSortChange: (sortBy: SnippetSortBy) => void;
}

/**
 * ショートカットの並べ替え設定を読み書きする
 *
 * @returns 現在の並べ替え基準と、その変更手段
 */
export function useShortcutSortPreference(): UseShortcutSortPreferenceReturn {
  const [currentSort, setCurrentSort] = useState<SnippetSortBy>(DEFAULT_SORT);

  /* 保存した並べ替え基準を1回だけ読み込む。読めない場合は既定のままにする */
  useEffect(() => {
    let isActive = true;

    void (async () => {
      try {
        const saved = await AsyncStorage.getItem(SORT_PREFERENCE_KEY);
        if (!isActive) return;
        if (saved !== null && SORT_VALUES.includes(saved as SnippetSortBy)) {
          setCurrentSort(saved as SnippetSortBy);
        }
      } catch (error) {
        Logger.error('[ShortcutSortPreference] Failed to load the sort preference:', error);
      }
    })();

    /* 読み込み中に画面を離れた場合、戻ってきたときの選択を上書きしない */
    return () => {
      isActive = false;
    };
  }, []);

  const handleSortChange = useCallback((sortBy: SnippetSortBy) => {
    setCurrentSort(sortBy);

    void AsyncStorage.setItem(SORT_PREFERENCE_KEY, sortBy).catch((error) => {
      Logger.error('[ShortcutSortPreference] Failed to save the sort preference:', error);
    });
  }, []);

  return { currentSort, handleSortChange };
}
