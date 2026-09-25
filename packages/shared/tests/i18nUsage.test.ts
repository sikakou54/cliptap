import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import en from '../src/i18n/en.json';
import ja from '../src/i18n/ja.json';
import { listSourceFiles, REPOSITORY_ROOT } from './helpers/sourceScan';

function flatten(value: unknown, prefix = '', keys = new Set<string>()): Set<string> {
  if (!value || typeof value !== 'object') return keys;
  for (const [name, child] of Object.entries(value)) {
    const key = prefix ? `${prefix}.${name}` : name;
    if (child && typeof child === 'object') flatten(child, key, keys);
    else keys.add(key);
  }
  return keys;
}

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(target);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [target] : [];
  });
}

describe('i18n usage', () => {
  it('uses existing literal keys and does not hide hardcoded strings in default values', () => {
    const repositoryRoot = path.resolve(process.cwd(), '../..');
    const roots = [
      'packages/shared/src',
      'apps/mobile/src',
      'apps/mobile/app',
      'apps/web/src',
    ].map((root) => path.join(repositoryRoot, root));
    const keys = flatten(en);
    const jaKeys = flatten(ja);
    const missing: string[] = [];
    const hardcodedDefaults: string[] = [];

    for (const filename of roots.flatMap(sourceFiles)) {
      const text = fs.readFileSync(filename, 'utf8');
      const source = ts.createSourceFile(
        filename,
        text,
        ts.ScriptTarget.Latest,
        true,
        filename.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      );

      const visit = (node: ts.Node): void => {
        if (ts.isCallExpression(node)
          && ts.isIdentifier(node.expression)
          && node.expression.text === 't') {
          const first = node.arguments[0];
          const second = node.arguments[1];
          if (first && ts.isStringLiteralLike(first)) {
            if (!keys.has(first.text) || !jaKeys.has(first.text)) {
              missing.push(`${path.relative(repositoryRoot, filename)}:${first.getStart(source)} ${first.text}`);
            }
          }
          if (second && ts.isStringLiteralLike(second)) {
            hardcodedDefaults.push(`${path.relative(repositoryRoot, filename)}:${second.getStart(source)}`);
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }

    expect(missing).toEqual([]);
    expect(hardcodedDefaults).toEqual([]);
  });
});

/* ======================================== */
/* 表示文字列のハードコード検出 */
/* ======================================== */

/**
 * 文言ハードコードのガード
 *
 * @remarks
 * `t('key')` のキー存在だけを見ていると、そもそも t を通していない直書き文字列を
 * 一件も検出できない。JSXに直接書かれた表示文字列（テキストノード、表示用属性、
 * 文字列リテラルの子要素）と、日本語を含む文字列リテラルを検出する。
 */

/** 走査対象（両アプリのアプリケーションコード全体） */
const SCAN_DIRS = ['apps/mobile/app', 'apps/mobile/src', 'apps/web/src'];

/** 日本語（ひらがな・カタカナ・漢字） */
const JAPANESE = /[぀-ゟ゠-ヿ一-鿿]/;

/** 表示文字列とみなす最低条件（英字または日本語を1文字以上含む） */
const DISPLAY_TEXT = /[A-Za-z぀-ゟ゠-ヿ一-鿿]/;

/**
 * 表示に使われる属性
 *
 * @remarks
 * className / testID / icon / name などのスタイル・識別子系は表示文言ではないため含めない。
 */
const DISPLAY_ATTRIBUTES = new Set([
  'title',
  'subtitle',
  'label',
  'description',
  'message',
  'placeholder',
  'alt',
  'aria-label',
  'accessibilityLabel',
  'accessibilityHint',
  'confirmText',
  'cancelText',
  'emptyMessage',
]);

/**
 * i18nを通さないことが妥当な文字列
 *
 * @remarks
 * - R / G / B: RGB各チャンネルのラベル。言語によらず同一表記
 * - Pro / Free: プラン名。ja.json でも「Pro」「Free」と表記して統一している
 * - ClipTap Web: 製品名
 */
const ALLOWED_LITERALS = new Set(['R', 'G', 'B', 'Pro', 'Free', 'ClipTap Web']);

/**
 * 表示文言のハードコードを許可するファイル
 *
 * @remarks
 * - DeveloperMenu.tsx / useDevMenu.ts / capture-host.tsx: `__DEV__` のときだけ描画される
 *   開発者向けの画面とメニュー。本番ビルドでは到達しないため利用者向け文言ではない
 * - MobileFileShareAdapter.ts: 共有シートのタイトルは docs/機能仕様書.md §8.13 により
 *   UI言語にかかわらず日本語固定と定められている
 */
const ALLOWED_FILES = new Set([
  'apps/mobile/app/capture-host.tsx',
  'apps/mobile/src/components/settings/DeveloperMenu.tsx',
  'apps/mobile/src/hooks/screens/useDevMenu.ts',
  'apps/mobile/src/adapters/MobileFileShareAdapter.ts',
]);

/** 検出結果（許可判定に使うため、位置と文言を分けて保持する） */
interface Hardcoded {
  /** リポジトリルートからの相対パス */
  readonly file: string;
  /** 1始まりの行番号 */
  readonly line: number;
  /** 検出した文言 */
  readonly text: string;
}

/** 検出結果を読みやすい1行へ整形する */
function format(hit: Hardcoded): string {
  return `${hit.file}:${hit.line} ${JSON.stringify(hit.text)}`;
}

/** 文字列リテラル系ノードから中身を取り出す（該当しなければ null） */
function literalText(node: ts.Node): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return null;
}

/**
 * 1ファイルから表示文字列のハードコードを収集する
 *
 * @param file - リポジトリルートからの相対パス
 * @returns 検出結果の配列
 */
function collectHardcoded(file: string): Hardcoded[] {
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(path.resolve(REPOSITORY_ROOT, file), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const hits: Hardcoded[] = [];
  const lineOf = (node: ts.Node): number =>
    source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
  const add = (node: ts.Node, text: string): void => {
    const trimmed = text.trim();
    /* 記号のみ・数字のみは表示文言ではないため対象外 */
    if (!DISPLAY_TEXT.test(trimmed)) return;
    hits.push({ file, line: lineOf(node), text: trimmed });
  };

  const visit = (node: ts.Node): void => {
    /* (a) JSXテキストノード（<Text>直書き</Text>） */
    if (ts.isJsxText(node)) add(node, node.text);

    /* (a') 文字列リテラルの子要素（<Text>{'直書き'}</Text>） */
    if (ts.isJsxExpression(node)
      && node.parent
      && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))
      && node.expression) {
      const text = literalText(node.expression);
      if (text !== null) add(node.expression, text);
    }

    /* (b) 表示用属性への直書き（title / label / placeholder / alt / aria-label 等） */
    if (ts.isJsxAttribute(node) && DISPLAY_ATTRIBUTES.has(node.name.getText(source))) {
      const initializer = node.initializer;
      if (initializer) {
        const inner = ts.isJsxExpression(initializer) ? initializer.expression : initializer;
        const text = inner ? literalText(inner) : null;
        if (text !== null) add(inner as ts.Node, text);
      }
    }

    /* (c) 日本語を含む文字列リテラル（Alert.alert等、JSX外の直書き） */
    const text = literalText(node);
    if (text !== null && JAPANESE.test(text) && !ts.isJsxAttribute(node.parent)) {
      /* JSXテキスト・属性で拾った分と重複しない位置のみ追加する */
      if (!hits.some((hit) => hit.line === lineOf(node) && hit.text === text.trim())) {
        add(node, text);
      }
    }

    ts.forEachChild(node, visit);
  };
  visit(source);

  return hits;
}

describe('i18n hardcoded strings', () => {
  const scanned = SCAN_DIRS.flatMap((dir) => listSourceFiles(dir));
  const allHits = scanned
    .filter((file) => !ALLOWED_FILES.has(file))
    .flatMap(collectHardcoded);

  it('走査対象のソースが存在する', () => {
    expect(scanned.length).toBeGreaterThan(0);
    expect(scanned.filter((file) => file.endsWith('.tsx')).length).toBeGreaterThan(0);
  });

  it('表示文言はすべてi18n経由で、JSXや文字列リテラルへ直書きしない', () => {
    const offenders = allHits
      .filter((hit) => !ALLOWED_LITERALS.has(hit.text))
      .map(format);

    expect(offenders).toEqual([]);
  });

  it('検出処理が実際に働いている（許可文言は現物として検出できている）', () => {
    /* 許可リストを外すと検出される実例があることを確認し、空振りのガードにしない */
    const detected = new Set(allHits.map((hit) => hit.text));

    expect(allHits.length).toBeGreaterThan(0);
    for (const literal of ALLOWED_LITERALS) expect(detected).toContain(literal);
  });

  it('例外として許可したファイルは実在し、実際に直書き文言を含む', () => {
    /* 許可リストが古くなって空振りしていないことを確認する */
    for (const file of ALLOWED_FILES) {
      expect(scanned).toContain(file);
      expect(collectHardcoded(file).length).toBeGreaterThan(0);
    }
  });
});

/* ======================================== */
/* 未使用キーの検出 */
/* ======================================== */

/**
 * 未使用の翻訳キーのガード
 *
 * @remarks
 * 「使われているキーが存在するか」だけを見ていると、参照側を消したときに
 * 翻訳ファイルへ取り残されたキーを検出できない。使われないキーが残ると
 * 文言の変更漏れや、実際には表示されない文言のレビューを招くため、
 * 逆方向（キーが使われているか）も検査する。
 */

/** 翻訳キーの参照元として走査するディレクトリ */
const USAGE_SCAN_DIRS = [
  'packages/shared/src',
  'apps/mobile/src',
  'apps/mobile/app',
  'apps/web/src',
];

/**
 * コメントを取り除く
 *
 * @remarks
 * 「組み立ててはいけない」と説明するコメントには、例として組み立ての記述が現れる。
 * 実装として組み立てているかだけを見たいので、判定前にコメントを落とす。
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

describe('i18n unused keys', () => {
  const scanned = USAGE_SCAN_DIRS.flatMap((dir) => listSourceFiles(dir));
  const sourceText = scanned
    .map((file) => fs.readFileSync(path.resolve(REPOSITORY_ROOT, file), 'utf8'))
    .join('\n');
  const enKeys = [...flatten(en)];
  const jaKeys = [...flatten(ja)];

  it('走査対象のソースと翻訳キーを検出できている', () => {
    expect(scanned.length).toBeGreaterThan(0);
    expect(enKeys.length).toBeGreaterThan(0);
  });

  it('ja/enのキー集合が一致する', () => {
    expect([...enKeys].sort()).toEqual([...jaKeys].sort());
  });

  it('どこからも参照されていない翻訳キーが残っていない', () => {
    /* 翻訳キーはすべて文字列リテラルで書く決まりのため、
       ソースにそのまま現れないキーは使われていないと判断してよい */
    const unused = enKeys.filter((key) => !sourceText.includes(key));

    expect(unused).toEqual([]);
  });

  /**
   * 翻訳キーを組み立てることを禁止する
   *
   * @remarks
   * `t(`snippet.${type}_input`)` のように組み立てると、対応するキーが未定義でも
   * 型チェックもLintも通り、未定義キー検出テストも「使われている」と見なせないため
   * 素通りする。画面にキー名がそのまま出て初めて気付くことになる。
   * 選択肢が閉じているなら、switchや対応表で静的キーへ振り分けること。
   */
  it('翻訳キーをテンプレートリテラルで組み立てていない', () => {
    const offenders = scanned.filter((file) => {
      const text = stripComments(fs.readFileSync(path.resolve(REPOSITORY_ROOT, file), 'utf8'));
      /* t(`...${...}...`) の形を探す。キーを組み立てている記述はこれだけ */
      return /\bt\(\s*`[^`]*\$\{/.test(text);
    });

    expect(offenders).toEqual([]);
  });

  /**
   * 翻訳キーの定数も組み立てないこと
   *
   * @remarks
   * t() へ渡す直前で組み立てなくても、キー文字列を変数で作れば同じ穴が開く。
   * `error.` や `snippet.` のような名前空間から始まるテンプレートリテラルを禁止する。
   */
  it('翻訳キーの文字列を名前空間から組み立てていない', () => {
    const namespaces = Object.keys(en).join('|');
    const pattern = new RegExp('`(?:' + namespaces + ')\\.[^`]*\\$\\{');

    const offenders = scanned.filter((file) => {
      const text = stripComments(fs.readFileSync(path.resolve(REPOSITORY_ROOT, file), 'utf8'));
      return pattern.test(text);
    });

    expect(offenders).toEqual([]);
  });
});
