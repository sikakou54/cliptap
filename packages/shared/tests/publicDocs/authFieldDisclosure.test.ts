import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { REPOSITORY_ROOT } from '../helpers/sourceScan';

/**
 * アカウント連携で外部へ渡る項目の開示ガード
 *
 * @remarks
 * 公開文書は「Firebaseに保存されるのは〜のみです」という閉じた列挙を持つ。
 * 閉じた列挙は、実装に項目が増えた瞬間に静かに嘘になる。監査では
 * `displayName` と `photoURL` を読み出しているのに列挙から漏れていた。
 *
 * ここでは列挙の正本を文書側に作らず、`SharedUser` の型定義を読んで
 * 「型に在る項目が、すべて開示済みか、開示しない理由付きで除外されているか」を確認する。
 * 型に項目を1つ足すとテストが落ちるため、文書を直さずに済ませられない。
 */

/** 認証ユーザーの型定義 */
const AUTH_TYPE_PATH = 'packages/shared/src/types/Auth.ts';
const AUTH_TYPE_NAME = 'SharedUser';

/**
 * 開示が必要な項目と、文書に必ず現れる語句
 *
 * @remarks
 * Firebase Authenticationのユーザーレコードに保存され、利用者に開示すべき項目。
 * 語句は文書側の表記に合わせる（表記を変えるときは文書と同じ変更でここも直す）。
 */
const DISCLOSED_FIELDS: Readonly<Record<string, string>> = {
  uid: 'ユーザー識別子（UID）',
  email: 'メールアドレス',
  displayName: '表示名',
  photoURL: 'プロフィール画像URL',
};

/**
 * 開示の対象にしない項目と、その理由
 *
 * @remarks
 * 除外の判断をコードに残すことが目的。理由を書けない項目は開示側へ入れる。
 */
const FIELDS_NOT_DISCLOSED: Readonly<Record<string, string>> = {
  /* 匿名認証を使用していないため常にfalseで、利用者の情報にあたらない（signInAnonymously の呼び出しは無い） */
  isAnonymous: '匿名認証を使用していないため常にfalse',
  /* メールアドレスの検証状態であり、メールアドレス自体の開示に含まれる */
  emailVerified: 'メールアドレスの検証状態で、メールアドレスの開示に含まれる',
  /* IDトークンを取得する関数であり、保存される値ではない */
  getIdToken: '関数であり保存される値ではない',
};

/** 列挙を載せている公開文書 */
const DISCLOSURE_DOCUMENTS = [
  'apps/web/public/privacy.html',
  'apps/web/public/terms.html',
  'apps/mobile/assets/web/privacy.html',
  'apps/mobile/assets/web/terms.html',
  'store/EULA_License_Agreement.txt',
];

/** 型定義からプロパティ名を取り出す */
function readMemberNames(path: string, typeName: string): string[] {
  const content = readFileSync(resolve(REPOSITORY_ROOT, path), 'utf8');
  const source = ts.createSourceFile(path, content, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS);
  const names: string[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isInterfaceDeclaration(node) && node.name.text === typeName) {
      for (const member of node.members) {
        if (member.name && ts.isIdentifier(member.name)) names.push(member.name.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);

  return names;
}

describe('アカウント連携で外部へ渡る項目の開示', () => {
  const members = readMemberNames(AUTH_TYPE_PATH, AUTH_TYPE_NAME);

  it('型定義のすべての項目が、開示済みか理由付きで除外されている', () => {
    const unclassified = members
      .filter((name) => !(name in DISCLOSED_FIELDS) && !(name in FIELDS_NOT_DISCLOSED))
      .map((name) => `${AUTH_TYPE_PATH} の ${AUTH_TYPE_NAME}.${name} が開示対象か除外対象か決まっていない`);

    expect(unclassified).toEqual([]);
  });

  it('開示・除外の分類に実在しない項目が残っていない', () => {
    const stale = [...Object.keys(DISCLOSED_FIELDS), ...Object.keys(FIELDS_NOT_DISCLOSED)]
      .filter((name) => !members.includes(name))
      .map((name) => `${AUTH_TYPE_NAME} に存在しない ${name} が分類に残っている`);

    expect(stale).toEqual([]);
  });

  it('開示が必要な項目がすべての公開文書に書かれている', () => {
    const missing = DISCLOSURE_DOCUMENTS.flatMap((path) => {
      const content = readFileSync(resolve(REPOSITORY_ROOT, path), 'utf8');

      return Object.entries(DISCLOSED_FIELDS)
        .filter(([, phrase]) => !content.includes(phrase))
        .map(([field, phrase]) => `${path} に ${field} の開示（「${phrase}」）が無い`);
    });

    expect(missing).toEqual([]);
  });

  it('型定義の読み取りが実際に働いている', () => {
    /* 型名の改名や構造変更で0件になると検査が黙って無効化されるため固定する */
    expect(members).toContain('uid');
    expect(members).toContain('displayName');
    expect(members).toContain('photoURL');
    expect(members.length).toBeGreaterThanOrEqual(6);
    expect(readMemberNames(AUTH_TYPE_PATH, 'DoesNotExist')).toEqual([]);
  });
});
