/**
 * スニペット検索機能を提供するカスタムフック
 *
 * @description
 * スニペットの全文検索機能を提供します。
 * デバウンス処理を組み込み、高速で効率的な検索体験を実現します。
 *
 * 主な機能:
 * - タイトルと本文の全文検索
 * - カテゴリによるフィルタリング
 * - デバウンス処理による不要なクエリの削減
 *
 * @module useSearch
 */

import { useState, useCallback, useEffect } from 'react';
import { SnippetService } from '../services/SnippetService';
import type { Snippet } from '../types/snippet';
import { useDebounce, DEFAULT_DEBOUNCE_DELAY } from './useDebounce';

/**
 * useSearch フックのオプション
 */
export interface UseSearchOptions {
  /** フィルタリング対象のカテゴリID（オプション） */
  categoryId?: string;
  /** デバウンス遅延時間（ミリ秒）。デフォルトは300ms */
  debounceDelay?: number;
  /** エラーログ出力関数（オプション） */
  onError?: (message: string, error: unknown) => void;
}

/**
 * useSearch フックの返却値
 */
export interface UseSearchResult {
  /** 現在の検索クエリ（ユーザー入力） */
  query: string;
  /** 検索クエリを更新する関数 */
  setQuery: (query: string) => void;
  /**
   * デバウンス後の検索クエリ（既定300ms）
   *
   * @remarks
   * results を使わない絞り込み（ショートカット検索）向け。
   * results もこの値で評価しているため、使えば定型文検索と同じ遅延で揃う。
   */
  debouncedQuery: string;
  /** 検索結果のスニペット配列 */
  results: Snippet[];
  /** 検索実行中フラグ */
  searching: boolean;
  /** 検索クエリをクリアする関数 */
  clearSearch: () => void;
  /** クエリが入力されているかどうか（空白除去後） */
  hasQuery: boolean;
}

/**
 * スニペット検索フック
 *
 * 検索クエリの状態管理とデバウンス処理を行い、検索結果を提供します。
 *
 * @param options - 検索オプション
 * @returns 検索状態と操作関数を含むオブジェクト
 */
export function useSearch(options: UseSearchOptions = {}): UseSearchResult {
  const {
    categoryId,
    debounceDelay = DEFAULT_DEBOUNCE_DELAY,
    onError,
  } = options;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Snippet[]>([]);
  const [searching, setSearching] = useState(false);

  /* useDebounceフックでデバウンス処理を統一 */
  const debouncedQuery = useDebounce(query, debounceDelay);

  /* debouncedQueryまたはcategoryIdが変更されたときに検索実行 */
  useEffect(() => {
    const performSearch = async () => {
      const trimmedQuery = debouncedQuery.trim();

      if (!trimmedQuery) {
        setResults([]);
        return;
      }

      try {
        setSearching(true);

        /* 検索ロジック（部分一致、大文字小文字無視など）はサービス内にカプセル化されている */
        const searchResults = SnippetService.search(trimmedQuery, categoryId);

        setResults(searchResults);
      } catch (error) {
        onError?.('[useSearch] Search failed:', error);
        setResults([]);
      } finally {
        setSearching(false);
      }
    };

    void performSearch();
  }, [debouncedQuery, categoryId, onError]);

  /**
   * 検索クエリをクリア
   * 検索結果もクリアして初期状態に戻す
   */
  const clearSearch = useCallback(() => {
    setQuery('');
    setResults([]);
  }, []);

  return {
    query,
    setQuery,
    debouncedQuery,
    results,
    searching,
    clearSearch,
    hasQuery: query.trim().length > 0,
  };
}
