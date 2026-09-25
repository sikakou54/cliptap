/**
 * スニペット関連ユーティリティ
 *
 * @description
 * スニペット関連のユーティリティ関数を提供。
 *
 * @module snippetFilterUtils
 */

import type { Snippet, SnippetProfile } from '../schema';

/**
 * 定型文が検索語に一致するかを判定する
 *
 * @param title - 照合するタイトル（変数を展開したもの。無ければnull）
 * @param content - 照合する本文（変数を展開したもの）
 * @param normalizedQuery - 小文字化して前後空白を除いた検索語（空なら常に一致）
 * @returns 一致するならtrue
 *
 * @remarks
 * 照合するのは画面に出ている展開後の文字列とする。保存文字列（例: `{{company}}`）では
 * 照合しないため、変数名では一致しない。ショートカットの検索（shortcuts/search.ts）と
 * 同じ規則で、一覧に見えている文字列で探せるようにするためである（§8.7）。
 * 一覧と件数で同じ判定を使うため、規則をここに集める。
 */
export function matchesSnippetText(
  title: string | null,
  content: string,
  normalizedQuery: string
): boolean {
  if (!normalizedQuery) return true;
  return Boolean(title?.toLowerCase().includes(normalizedQuery))
    || content.toLowerCase().includes(normalizedQuery);
}

/**
 * 各プロファイルのスニペット数を計算
 *
 * @param snippets - スニペット一覧
 * @param snippetProfiles - スニペット-プロファイル関連一覧
 * @param profileId - プロファイルID
 * @param matches - 数える対象かを判定する関数（省略時はプロファイルの絞り込みだけ）
 * @returns 該当プロファイルのスニペット数
 */
export function getSnippetCountByProfile(
  snippets: Snippet[],
  snippetProfiles: SnippetProfile[],
  profileId: string,
  matches?: (snippet: Snippet) => boolean
): number {
  /* snippet_profilesマップを作成 */
  const snippetProfileMap = new Map<string, string[]>();
  for (const sp of snippetProfiles) {
    const existing = snippetProfileMap.get(sp.snippetId) || [];
    existing.push(sp.profileId);
    snippetProfileMap.set(sp.snippetId, existing);
  }

  /* 指定プロファイルに関連するスニペット数をカウント */
  return snippets.filter((snippet) => {
    const profileIds = snippetProfileMap.get(snippet.id);
    /* snippet_profilesに登録されていない（全環境対応）か、指定プロファイルに紐づくスニペット */
    const visible = !profileIds || profileIds.length === 0 || profileIds.includes(profileId);
    return visible && (matches ? matches(snippet) : true);
  }).length;
}
