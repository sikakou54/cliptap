/**
 * @file global.d.ts
 * @description
 * グローバル型定義
 *
 * React Nativeのモーダル画面と親画面間のコールバック通信に使用する
 * グローバル変数の型定義。Expo Routerではモーダル間の直接的なコールバック
 * 受け渡しが難しいため、グローバル変数を経由して値を返す。
 *
 * 使用パターン:
 * 1. 親画面でコールバック関数をグローバル変数に設定
 * 2. モーダル画面で値を編集
 * 3. モーダル画面でグローバル変数のコールバックを呼び出し
 * 4. 親画面のコールバックが実行される
 *
 * @see app/snippet/title-input.tsx - タイトル入力モーダル
 * @see app/snippet/content-input.tsx - 本文入力モーダル
 * @see app/profile/select.tsx - プロファイル選択モーダル（定型文フォーム・ショートカット編集で共有）
 * @see app/shortcut/value-edit.tsx - ショートカット値編集モーダル
 * @see app/shortcut/value-edit.tsx - ショートカットの値入力モーダル
 */

declare global {
  /**
   * スニペット本文のコールバック
   * テキストエディターモーダルから親画面に編集後の本文を返す
   */
  var snippetContentCallback: ((content: string) => void) | undefined;

  /**
   * スニペットタイトルのコールバック
   * テキストエディターモーダルから親画面に編集後のタイトルを返す
   */
  var snippetTitleCallback: ((title: string) => void) | undefined;

  /**
   * カテゴリ選択のコールバック
   * カテゴリピッカーから親画面に選択されたカテゴリIDを返す
   * nullは「カテゴリなし」を表す
   */
  var categorySelectCallback: ((categoryId: string | null) => void) | undefined;

  /**
   * プロファイル選択のコールバック
   * プロファイル選択画面から親画面（定型文フォーム・ショートカット編集）に選択されたプロファイルIDの配列を返す
   * 空配列は「全てのプロファイル」（0件＝全プロファイル向け）を表す
   */
  var profileSelectCallback: ((selectedIds: string[]) => void) | undefined;

  /**
   * ショートカットの「挿入する値」の編集データ
   *
   * 値入力モーダルから親画面（ショートカット作成・編集）へ編集後の値を返す。
   * keyは編集対象を指す画面内のキーで、空文字は新規追加を表す。
   */
  var shortcutValueCallbackData: {
    /** 編集対象の画面内キー（空文字は新規追加） */
    key: string;
    /** 編集後の値（変数トークンは未展開） */
    value: string;
  } | undefined;

  /**
   * 変数値編集のデータ
   * 変数値編集モーダルから親画面に編集後のデータを返す
   */
  var variableValueCallbackData: {
    /** 対象プロファイルのID */
    profileId: string;
    /** 標準値かどうか（デフォルトプロファイルの場合true） */
    isStandard: boolean | string;
    /** 新しい変数値 */
    newValue: string;
  } | undefined;
}

/** このファイルをモジュールとして扱うための空エクスポート */
export {};
