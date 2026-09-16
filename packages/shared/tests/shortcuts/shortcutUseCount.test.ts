import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * ショートカットの使用回数は、キーボードからの挿入だけでなく
 * モバイル・Webのコピーでも加算する（定型文 §8.12 と同じ扱い）。
 *
 * Providerはフックのため実DBテストから直接呼べない。
 * 呼び忘れるとコピーしても使用頻度順が動かず、しかも例外にならないため気付けない。
 * ProfileProviderの保証（tests/profiles/deleteProfile.test.ts）と同じやり方で、
 * 実装のソース上に呼び出しが残っていることを固定する。
 */
describe('ショートカットの使用回数', () => {
  /** 共有パッケージのルート */
  const root = resolve(import.meta.dirname, '../..');

  const providerSource = readFileSync(
    resolve(root, 'src/providers/ShortcutProvider.tsx'),
    'utf8'
  );

  it('Providerのコピー経路で使用回数を加算する', () => {
    const start = providerSource.indexOf('const copyShortcut');
    expect(start).toBeGreaterThan(-1);

    /* コピー本体から関数の終わりまでの間に加算があること */
    const body = providerSource.slice(start, start + 1500);
    expect(body).toContain('getClipboardAdapter().copy(');
    expect(body).toContain('ShortcutService.recordUse(');
  });

  /**
   * コピー後に保持中の一覧も進めないと、使用頻度順にしていても
   * 画面を作り直すまで並びが変わらない。
   */
  it('コピー後に保持中の一覧の使用回数も進める', () => {
    const start = providerSource.indexOf('const copyShortcut');
    const body = providerSource.slice(start, start + 1500);

    expect(body).toContain('setShortcuts(');
    expect(body).toContain('useCount: current.useCount + 1');
  });

  /** 画面側はProviderを通す（Serviceを直呼びしてクリップボードと加算がばらけないようにする）。
      検索画面は展開の基準プロファイルを2番目の引数で渡すため、呼び出しの先頭部分で照合する */
  it('モバイルの画面はProvider経由でコピーする', () => {
    const mobileRoot = resolve(root, '../../apps/mobile');

    for (const file of [
      'src/hooks/screens/useHomeShortcuts.ts',
      'src/hooks/screens/useSearchShortcuts.ts',
    ]) {
      const source = readFileSync(resolve(mobileRoot, file), 'utf8');
      expect(source).toContain('copyShortcut(shortcut');
      expect(source).not.toContain('ShortcutService.recordUse');
    }
  });
});
