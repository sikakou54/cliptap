/**
 * コピー時の変数展開に使う文脈
 *
 * @module providers/variableCopyContext
 *
 * @description
 * 定型文とショートカット値をクリップボードへコピーするときに、変数トークンを展開するための
 * カスタム変数リゾルバーとロケールを用意する。
 *
 * @remarks
 * 定型文（SnippetProvider）とショートカット（ShortcutProvider）で同じ関数を使い、
 * Free上限による変数の絞り込みとプロファイル値のフォールバックを1か所に保つ。
 * どちらかだけが別の組み立て方になると、同じ `{{name}}` でもコピー結果が変わってしまう。
 * Provider内部の部品のため、パッケージの公開APIとしてはエクスポートしない。
 */

import { ProfileService } from '../services/ProfileService';
import { VariableService, type VariableResolverContext } from '../services/VariableService';
import { SubscriptionService } from '../services/SubscriptionService';
import { FEATURE_LIMITS } from '../constants/inputLimits';
import { getLocaleAdapter, hasLocaleAdapter } from '../adapters/LocaleAdapter';
import type { VariableResolver } from '../variables/parser';

/**
 * カスタム変数リゾルバーを作成
 *
 * @param profileId - 展開の基準プロファイルID（省略時はアクティブなプロファイル）
 * @returns 基準プロファイル→標準プロファイルの順に値を引くリゾルバー
 */
export function createCustomResolver(profileId?: string): VariableResolver {
  const isSubscribed = SubscriptionService.isSubscribed();
  const profileVariablesMap = profileId
    ? ProfileService.getProfileVariablesMap(profileId)
    : ProfileService.getActiveProfileVariablesMap();
  const defaultProfileVariablesMap = ProfileService.getDefaultProfileVariablesMap();

  const context: VariableResolverContext = {
    isSubscribed,
    profileVariablesMap,
    defaultProfileVariablesMap,
  };

  return VariableService.createCustomVariableResolver(context, {
    freeTierLimit: FEATURE_LIMITS.FREE_TIER_VARIABLES,
  });
}

/**
 * 現在のロケールを取得
 *
 * @returns ロケールアダプターが返す言語（未登録なら 'en'）
 */
export function getCurrentLocale(): string {
  if (hasLocaleAdapter()) {
    return getLocaleAdapter().getLanguage();
  }
  return 'en';
}
