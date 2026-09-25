import { describe, expect, it } from 'vitest';
import en from '../src/i18n/en.json';
import ja from '../src/i18n/ja.json';
import {
  getProfileSelectDescription,
  getProfileSelectPlaceholder,
  parseProfileSelectTarget,
  type ProfileSelectTarget,
} from '../src/utils/profileSelectLabels';

/**
 * プロファイル選択画面の文言は、呼び出し元（定型文・ショートカット）ごとに静的な翻訳キーへ振り分ける。
 *
 * キーを `${target}.select_profile` のように組み立てると、キーが未定義でも
 * 型チェック・Lint・未使用キー検出のいずれも素通りし、画面にキー名がそのまま出るまで気付けない。
 * 対象ごとに渡るキーと、その実在をここで固定する。
 */
describe('プロファイル選択の文言', () => {
  /** 受け取ったキーをそのまま返す翻訳関数（どのキーへ振り分けたかを見るため） */
  const echo = (key: string): string => key;

  /** ドット区切りのキーで翻訳ファイルの値を引く */
  const lookup = (messages: unknown, key: string): unknown =>
    key
      .split('.')
      .reduce<unknown>(
        (node, part) =>
          node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
        messages
      );

  const cases: Array<[ProfileSelectTarget, string, string]> = [
    ['snippet', 'snippet.select_profiles_description', 'snippet.select_profile'],
    ['shortcut', 'shortcut.select_profiles_description', 'shortcut.select_profile'],
  ];

  it.each(cases)('%s は説明文とプレースホルダーを静的キーから引く', (target, description, placeholder) => {
    expect(getProfileSelectDescription(target, echo)).toBe(description);
    expect(getProfileSelectPlaceholder(target, echo)).toBe(placeholder);
  });

  it.each(cases)('%s のキーは日本語・英語の両方に文字列で定義されている', (_target, description, placeholder) => {
    for (const messages of [ja, en]) {
      expect(typeof lookup(messages, description)).toBe('string');
      expect(typeof lookup(messages, placeholder)).toBe('string');
    }
  });

  /* 定型文とショートカットで同じ説明文を出すと、何を選んでいるのか画面から分からない */
  it('説明文は定型文とショートカットで異なる', () => {
    for (const messages of [ja, en]) {
      expect(lookup(messages, 'shortcut.select_profiles_description')).not.toBe(
        lookup(messages, 'snippet.select_profiles_description')
      );
    }
  });

  describe('parseProfileSelectTarget', () => {
    it('shortcut を受け取ったときだけショートカット向けにする', () => {
      expect(parseProfileSelectTarget('shortcut')).toBe('shortcut');
      expect(parseProfileSelectTarget('snippet')).toBe('snippet');
    });

    /**
     * 遷移パラメータは欠落・空・配列（同名パラメータの重複）になりうる。
     * 既存の遷移元は定型文だけだったため、判別できないものは定型文として扱う。
     */
    it.each([
      ['undefined', undefined],
      ['空文字', ''],
      ['未知の文字列', 'x'],
      ['配列', ['shortcut']],
    ])('%s は定型文向けにする', (_name, value) => {
      expect(parseProfileSelectTarget(value)).toBe('snippet');
    });
  });
});
