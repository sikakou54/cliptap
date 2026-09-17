/**
 * 共通サービス層
 *
 * @description
 * Mobile/Webで共通のビジネスロジックを提供するサービス。
 * 新アーキテクチャでは静的メソッドベースのサービスを使用。
 *
 * @module services
 */

export { CategoryService } from './CategoryService';
export { ProfileService } from './ProfileService';
export { SnippetService } from './SnippetService';
export { VariableService, type VariableResolverContext } from './VariableService';
export { ShortcutService } from './ShortcutService';
export {
  SubscriptionService,
  FREE_PROFILES_LIMIT,
  FREE_VARIABLES_LIMIT,
  FREE_SNIPPETS_LIMIT,
  FREE_SHORTCUTS_LIMIT,
  FREE_SHORTCUT_VALUES_LIMIT,
  type ValidFlagsUpdater,
} from './SubscriptionService';
export { createValidFlagsUpdater } from './validFlagsUpdater';

export { AuthService } from './AuthService';

export { ImportService } from './ImportService';
export { SystemVariableFormatRegistry } from './SystemVariableFormatRegistry';
export { SystemVariableFormatService } from './SystemVariableFormatService';
