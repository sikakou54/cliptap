/**
 * ショートカット値の解決
 *
 * @module shortcuts/resolveValue
 *
 * @remarks
 * ショートカット値は、保存された文字列をそのまま挿入するか、カスタム変数を参照して
 * その変数の値を挿入するかのどちらか。参照の解決順序はカスタム変数の展開
 * （docs/機能仕様書.md §8.6）と同じで、
 * 「基準プロファイルの非空値」→「標準プロファイルの非空値」→「空文字」。
 *
 * ここが解決規則の正本で、iOS版・Android版のキーボードはこの規則を写す。
 *
 * 対応するネイティブ実装:
 * - apps/mobile/ios/ClipTapKeyboard/Mappers/ShortcutMapper.swift
 * - apps/mobile/android/app/src/main/java/com/sikakou/cliptap/mappers/ShortcutMapper.kt
 */

/**
 * プロファイルIDごとの値
 */
export type ProfileValueMap = Readonly<Record<string, string>>;

/**
 * プロファイル別の値を1つに解決する
 *
 * @param values - プロファイルIDごとの値
 * @param profileId - 基準プロファイルID（未確定ならnull）
 * @param defaultProfileId - 標準プロファイルID（未確定ならnull）
 * @returns 解決した値（どこにも非空の値が無ければ空文字）
 *
 * @remarks
 * 空文字を未設定として扱うのは、値を入力せずに保存すると空文字が保存され得るため
 * （カスタム変数と同じ。§8.6）。保存側では消さず、解決側で読み飛ばす。
 */
export function resolveProfileValue(
  values: ProfileValueMap,
  profileId: string | null,
  defaultProfileId: string | null
): string {
  if (profileId) {
    const own = values[profileId];
    if (own) return own;
  }

  if (defaultProfileId) {
    const fallback = values[defaultProfileId];
    if (fallback) return fallback;
  }

  return '';
}

/**
 * 解決に必要なショートカット値の情報
 */
export interface ResolvableShortcutValue {
  /** 参照するカスタム変数のID（参照していなければnull） */
  readonly variableId: string | null;
  /** 保存されている文字列 */
  readonly storedValue: string;
}

/**
 * ショートカット値の中身を解決する
 *
 * @param value - 解決するショートカット値
 * @param profileId - 基準プロファイルID（未確定ならnull）
 * @param defaultProfileId - 標準プロファイルID（未確定ならnull）
 * @param variableValues - カスタム変数IDごとの、プロファイル別の値
 * @returns 挿入・表示する文字列
 *
 * @remarks
 * カスタム変数を参照している値は、保存された文字列を持っていても使わない。
 * 参照を張った時点で「中身の持ち主は変数側」と決めており、
 * 両方を見にいくと、どちらが出るのか利用者には判断できないためである。
 *
 * 参照先の変数が削除されている場合は`variableId`がNULLへ戻るため、ここには現れない（§8.5）。
 * 変数が残っていて値だけが無い場合は、カスタム変数と同じ順でフォールバックし、
 * 最後は空文字になる。値名は一覧に残るため、利用者は未設定に気付ける（§8.24）。
 */
export function resolveShortcutValue(
  value: ResolvableShortcutValue,
  profileId: string | null,
  defaultProfileId: string | null,
  variableValues: Readonly<Record<string, ProfileValueMap>>
): string {
  if (value.variableId) {
    const values = variableValues[value.variableId];
    if (!values) return '';
    return resolveProfileValue(values, profileId, defaultProfileId);
  }

  return value.storedValue;
}
