import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * ショートカット編集画面は、編集対象をIDで引く。
 *
 * Providerの一覧はアクティブなプロファイルから見える分しか持たないが、
 * 検索画面はプロファイルを跨いで検索し、他のプロファイルのショートカットからも編集へ進む。
 * 一覧から探すと見つからずフォームが空で開き、保存すると作成の分岐へ流れて重複して登録される。
 * 例外にならないため気付けないので、実装のソース上で引き方を固定する
 * （tests/shortcuts/shortcutUseCount.test.ts と同じやり方）。
 */
describe('ショートカット編集画面の編集対象の引き方', () => {
  /** モバイルアプリのルート */
  const mobileRoot = resolve(import.meta.dirname, '../../../../apps/mobile');

  const source = readFileSync(
    resolve(mobileRoot, 'src/hooks/screens/useShortcutEditScreen.ts'),
    'utf8'
  );

  it('編集対象はIDで取得する', () => {
    expect(source).toContain('getById(shortcutId)');
  });

  it('アクティブなプロファイルの一覧からは探さない', () => {
    expect(source).not.toContain('shortcuts.find(');
  });
});
