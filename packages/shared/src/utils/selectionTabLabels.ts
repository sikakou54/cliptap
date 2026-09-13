/**
 * 選択タブの見出し
 *
 * @module utils/selectionTabLabels
 *
 * @remarks
 * 翻訳キーは文字列リテラルで書く。`t(\`backup.tab_${tab}\`)` のように組み立てると、
 * キーの追加漏れを未定義キー検出テストも全文検索も捕まえられず、
 * 画面にキー名がそのまま出るまで気付けない。
 * タブは4種の閉じたunionなので、ここで1対1に対応づける。
 */

import type { SelectionTabType } from '../hooks/useSelection';
import type { TranslationFunction } from '../hooks/useTranslation';

/**
 * 選択タブの見出しを取得する
 *
 * @param tab - タブの種別
 * @param t - 翻訳関数
 * @returns タブに表示する見出し
 */
export function getSelectionTabLabel(tab: SelectionTabType, t: TranslationFunction): string {
  switch (tab) {
    case 'snippets':
      return t('backup.tab_snippets');
    case 'profiles':
      return t('backup.tab_profiles');
    case 'variables':
      return t('backup.tab_variables');
    case 'categories':
      return t('backup.tab_categories');
  }
}
