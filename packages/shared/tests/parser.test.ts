import { describe, it, expect } from 'vitest';
import { hasVariables, extractVariables, replaceVariables } from '../src/variables/parser';

describe('VariableParser', () => {
  it('should detect variables', () => {
    expect(hasVariables('Hello {{name}}')).toBe(true);
    expect(hasVariables('Hello world')).toBe(false);
  });

  it('should extract variables', () => {
    const text = '{{name}} and {{age}}';
    expect(extractVariables(text)).toEqual(['name', 'age']);
  });

  it('should replace variables multiple times correctly (Regex state check)', async () => {
    /* This test ensures the "lastIndex" bug is fixed */
    const text = '{{a}} {{b}}';
    const resolver = (name: string) => name.toUpperCase();
    
    const result1 = await replaceVariables(text, { customResolver: resolver });
    expect(result1).toBe('A B');

    const result2 = await replaceVariables(text, { customResolver: resolver });
    expect(result2).toBe('A B');
  });

  it('should replace variables in long string', async () => {
    const text = 'Start {{var1}} middle {{var2}} end';
    const resolver = (name: string) => `[${name}]`;
    const result = await replaceVariables(text, { customResolver: resolver });
    expect(result).toBe('Start [var1] middle [var2] end');
  });

  /* 値に置換パターンの記号が含まれていても、そのままの文字列で出力する。
     文字列で置換すると `$&` がトークン自身に、`$$` が `$` に化け、一覧表示とコピーがずれる */
  it.each([['$&'], ['$$5'], ['$`'], ["$'"], ['$1'], ['A$&B $$ C']])(
    'keeps the replacement-pattern characters in %s literally',
    async (value) => {
      const result = await replaceVariables('[{{price}}]', { customResolver: () => value });
      expect(result).toBe(`[${value}]`);
    }
  );

  /* 展開した値に別のトークンが含まれていても再展開しない（一覧表示・キーボードと同じ） */
  it('does not expand a token that appears inside a resolved value', async () => {
    const resolver = (name: string) => (name === 'a' ? '{{b}}' : 'B');
    const result = await replaceVariables('{{a}} {{b}}', { customResolver: resolver });
    expect(result).toBe('{{b}} B');
  });

  it('resolves the same token only once', async () => {
    let calls = 0;
    const resolver = () => {
      calls += 1;
      return 'X';
    };
    const result = await replaceVariables('{{a}}-{{a}}-{{a}}', { customResolver: resolver });
    expect(result).toBe('X-X-X');
    expect(calls).toBe(1);
  });
});

