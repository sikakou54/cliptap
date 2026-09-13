/**
 * ショートカットの検索
 *
 * @module shortcuts/search
 *
 * @remarks
 * 定型文の検索（SnippetService.search）はSQLで行うが、ショートカットは
 * 表示対象がアクティブなプロファイルの分だけで件数も小さいため、
 * 取得済みの一覧をメモリ上で絞り込む。取得経路を1本に保つためでもある。
 */

/**
 * 検索対象になるショートカット値
 */
export interface SearchableShortcutValue {
  /** 値を識別する名称 */
  readonly name: string;
  /** 実際に挿入する文字列 */
  readonly value: string;
}

/**
 * 検索対象になるショートカット
 */
export interface SearchableShortcut {
  /** ショートカット名 */
  readonly name: string;
  /** ショートカットが持つ値 */
  readonly values: readonly SearchableShortcutValue[];
}

/**
 * 検索語を突き合わせ用に正規化する
 *
 * @param term - 入力された検索語、または突き合わせ先の文字列
 * @returns 前後の空白を除去して小文字化した文字列
 *
 * @remarks
 * 英字は大小を区別せずに突き合わせる。日本語はこの正規化の影響を受けない。
 * 並べ替え（shortcuts/sort.ts）と同じ方針に揃えている。
 */
function normalize(term: string): string {
  return term.trim().toLowerCase();
}

/**
 * ショートカットを検索語で絞り込む
 *
 * @param shortcuts - 絞り込む前のショートカット一覧（表示順）
 * @param query - 検索語
 * @returns 検索語に一致したショートカット（元の並び順を保つ）
 *
 * @remarks
 * ショートカット名・値名・値のいずれかに検索語が含まれれば一致とする。
 * 値まで対象にするのは、「090」のように挿入される値そのものを手掛かりに
 * 探す場面があるため。
 *
 * 空の検索語は絞り込みを行わず全件を返す。空文字はどんな文字列にも
 * 含まれると判定されるため、条件として扱うと意味を持たない。
 */
export function searchShortcuts<T extends SearchableShortcut>(
  shortcuts: readonly T[],
  query: string
): T[] {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return [...shortcuts];

  return shortcuts.filter((shortcut) => {
    if (normalize(shortcut.name).includes(normalizedQuery)) return true;
    return shortcut.values.some(
      (value) =>
        normalize(value.name).includes(normalizedQuery) ||
        normalize(value.value).includes(normalizedQuery)
    );
  });
}
