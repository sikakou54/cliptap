/**
 * ショートカットサービス
 *
 * @description
 * ショートカットと、そのショートカットが持つ値のCRUD操作を提供する共通サービス。
 * Mapper層を経由してデータアクセスを行う。
 * Mobile/Webで共通のビジネスロジック（バリデーション含む）を提供。
 *
 * @module ShortcutService
 */

import { ShortcutMapper } from '../mappers/ShortcutMapper';
import { replaceVariables, type VariableResolver } from '../variables/parser';
import { SystemVariableFormatRegistry } from './SystemVariableFormatRegistry';
import type {
  CreateShortcutInput,
  Shortcut,
  ShortcutValueInput,
  UpdateShortcutInput,
} from '../schema';
import {
  DuplicateNameError,
  EmptyContentError,
  ShortcutValueRequiredError,
} from '../errors';

/**
 * ショートカットサービス
 *
 * @description
 * 静的メソッドでショートカット操作を提供。
 * バリデーションを行い、Mapper層に処理を委譲。
 */
export class ShortcutService {
  /**
   * 指定プロファイルから見えるショートカットを取得
   *
   * @param profileId - 表示中のプロファイルID
   * @returns ショートカットの配列（sortOrderの昇順でソート済み、値も並び順）
   *
   * @remarks
   * そのプロファイルに紐づくものと、紐づけが0件のもの（全プロファイル向け）を返す。
   * 値は保存されている文字列のまま返し、変数トークンは展開しない。
   * 表示は shortcuts/display の attachDisplayValues、コピーは prepareValueForClipboard で展開する。
   */
  static getByProfileId(profileId: string): Shortcut[] {
    return ShortcutMapper.getByProfileId(profileId);
  }

  /**
   * IDでショートカットを取得
   *
   * @param id - ショートカットのID
   * @returns ショートカット（存在しない場合はnull。値は保存されている文字列のまま）
   */
  static getById(id: string): Shortcut | null {
    return ShortcutMapper.getById(id);
  }

  /**
   * ショートカットを作成
   *
   * @param input - 作成するショートカットの情報
   * @returns 作成されたショートカット
   * @throws {EmptyContentError} ショートカット名が空の場合
   * @throws {DuplicateNameError} 紐づけるいずれかのプロファイルで同名のショートカットが見える場合
   * @throws {ShortcutValueRequiredError} 値が1件も無い場合
   *
   * @remarks
   * profileIdsは0件以上。省略または空配列は全プロファイル向けになる（定型文と同じ）。
   * 値は前後空白を除いて保存する。空文字も保存できる（空文字の挿入を選ぶ意図を壊さないため）。
   */
  static create(input: CreateShortcutInput): Shortcut {
    /* ショートカット名の前後空白をトリム（ユーザー入力の正規化） */
    const trimmedName = input.name.trim();

    /* 空白のみの名前は一覧で識別できず重複判定もすり抜けるため、trim後の空文字を拒否する */
    if (!trimmedName) {
      throw new EmptyContentError();
    }

    /* 省略は0件（全プロファイル向け）として扱う */
    const profileIds = this.normalizeProfileIds(input.profileIds ?? []);

    /* 紐づけるいずれかのプロファイルに同名が見えるかチェック（重複防止）。
       紐づけの重ならないプロファイルの同名は許す */
    this.assertNameAvailable(trimmedName, profileIds);

    const values = this.normalizeValues(input.values);

    /* 検証はService、SQLはMapperに集約する規約のため、検証済みデータをそのままMapperへ渡す。
       カテゴリは任意のため、未指定は未分類（null）として扱う */
    return ShortcutMapper.create(
      profileIds,
      trimmedName,
      values,
      input.categoryId ?? null
    );
  }

  /**
   * ショートカットを更新
   *
   * @param input - 更新するショートカットの情報
   * @returns 更新されたショートカット
   * @throws {EmptyContentError} ショートカット名が空の場合
   * @throws {DuplicateNameError} 保存後に紐づくいずれかのプロファイルで同名のショートカットが見える場合（自分以外）
   * @throws {ShortcutValueRequiredError} 値をすべて削除しようとした場合
   *
   * @remarks
   * profileIdsを指定すると紐づけをその一覧へ置き換える（空配列で全プロファイル向け）。
   * 省略した場合は紐づけを変えない。値と使用回数はそのまま持ち越す。
   * categoryIdにnullを渡すと未分類へ戻す。省略した場合は現在のカテゴリを変えない。
   */
  static update(input: UpdateShortcutInput): Shortcut {
    /* 現在の紐づけを知らないと、紐づけを変えない更新で名前の重複をどこで見るかが決まらない */
    const current = ShortcutMapper.getById(input.id);
    if (!current) {
      throw new Error(`Shortcut not found: ${input.id}`);
    }

    const profileIds =
      input.profileIds !== undefined ? this.normalizeProfileIds(input.profileIds) : undefined;
    let trimmedName: string | undefined;

    /* ショートカット名が指定されている場合はバリデーションと重複チェック */
    if (input.name !== undefined) {
      trimmedName = input.name.trim();

      /* 空白のみの名前は一覧で識別できず重複判定もすり抜けるため、trim後の空文字を拒否する */
      if (!trimmedName) {
        throw new EmptyContentError();
      }
    }

    /* 重複は保存後の紐づけで見る。名前を変えなくても紐づけを広げれば（0件にするのも含む）
       新たに同名が見えるようになる可能性があるため、名前変更・紐づけ変更の有無にかかわらず常に確認する */
    const nameToCheck = trimmedName ?? current.name;
    this.assertNameAvailable(nameToCheck, profileIds ?? current.profileIds, input.id);

    const values =
      input.values !== undefined ? this.normalizeValues(input.values) : undefined;

    /* 検証はService、SQLはMapperに集約する規約のため、検証済みデータをそのままMapperへ渡す。
       values・profileIds・categoryIdは未指定なら現在の値を変えないため、undefinedのまま渡す */
    return ShortcutMapper.update(
      input.id,
      trimmedName,
      values,
      profileIds,
      input.categoryId
    );
  }

  /**
   * ショートカットを削除
   *
   * @param id - 削除するショートカットのID
   *
   * @remarks
   * ショートカットが持つ値と紐づけの行もあわせて削除される。
   */
  static delete(id: string): void {
    ShortcutMapper.delete(id);
  }

  /**
   * ショートカットの並び順を更新
   *
   * @param orderedIds - 新しい順序でのショートカットID配列
   */
  static reorder(orderedIds: string[]): void {
    ShortcutMapper.updateOrder(orderedIds);
  }

  /**
   * ショートカット値の使用回数を1加算する
   *
   * @param valueId - ショートカット値のID
   * @param shortcutId - 所属するショートカットのID
   *
   * @remarks
   * 使用頻度順（§8.9）の根拠になる。ショートカットの使用回数は、持っている値の合計で数える。
   * 加算するのはモバイル・Webで値をコピーしたときと、拡張キーボードから値を挿入したときの2か所（§8.12）。
   * 使用回数は値の行が持つため、どのプロファイルで使ってもまとめて数える。
   * 振る舞いの正本としてここに置き、TypeScript側からはテストが呼んで固定している。
   */
  static recordUse(valueId: string, shortcutId: string): void {
    ShortcutMapper.incrementUseCount(valueId, shortcutId);
  }

  /**
   * ショートカット値をクリップボードへコピーするための文字列を準備する
   *
   * @param value - 保存されている値（変数トークンは未展開）
   * @param options - オプション
   * @param options.locale - ロケール（システム変数の曜日表記などに使用）
   * @param options.customResolver - カスタム変数リゾルバー（基準プロファイルの値を引く）
   * @returns 変数トークンを展開した文字列
   *
   * @remarks
   * 展開の規則は定型文のコピー（SnippetService.prepareForClipboard）と同じ replaceVariables に任せ、
   * 定型文とショートカットで同じトークンが違う結果にならないようにする。
   * 日時はこの呼び出し時点で解決するため、一覧に表示した時点の値とは分単位でずれることがある。
   */
  static async prepareValueForClipboard(
    value: string,
    options?: {
      locale?: string;
      customResolver?: VariableResolver;
    }
  ): Promise<string> {
    return replaceVariables(value, {
      locale: options?.locale,
      customResolver: options?.customResolver,
      formats: SystemVariableFormatRegistry.getAll(),
    });
  }

  /**
   * 保存済みのショートカット総数を取得
   *
   * @returns 全プロファイル合計のショートカット数（複数プロファイルに紐づくものも1件と数える）
   * @remarks
   * 無料プランの登録上限の判定に使う。Providerの一覧はアクティブなプロファイルで絞り込まれ、
   * プロファイル未確定の間は空になるため、その件数では上限をすり抜ける。
   */
  static count(): number {
    return ShortcutMapper.count();
  }

  /**
   * 指定プロファイルから見えるショートカット数を取得
   *
   * @param profileId - 表示中のプロファイルID
   * @returns ショートカット数（紐づくもの＋0件で全プロファイル向けのもの）
   */
  static countByProfile(profileId: string): number {
    return ShortcutMapper.countByProfile(profileId);
  }

  /**
   * その名前を使えるか確かめ、使えなければ例外を投げる
   *
   * @param name - 検証するショートカット名（トリム済み）
   * @param profileIds - 保存後に紐づくプロファイルID（正規化済み。空配列は全プロファイル向け）
   * @param excludeId - 判定から除くショートカットID（更新時に自分自身を除くため）
   * @throws {DuplicateNameError} 同名が使えない場合
   *
   * @remarks
   * 選んだプロファイルのいずれかで同名が見えるなら拒否する。紐づけの重ならない同名は許す。
   * 0件のショートカットは全プロファイルから見えるため、既存が0件なら常に衝突し、
   * 0件で保存するなら同名すべてと衝突する（判定はShortcutMapper.findConflictingName）。
   * DB側に一意制約を置けない（紐づけが別テーブルのため）ので、この検査が唯一の担保になる。
   */
  private static assertNameAvailable(
    name: string,
    profileIds: readonly string[],
    excludeId?: string
  ): void {
    if (ShortcutMapper.findConflictingName(name, profileIds, excludeId)) {
      throw new DuplicateNameError('shortcut', name);
    }
  }

  /**
   * 紐づけるプロファイルIDを保存できる形へ正規化する
   *
   * @param profileIds - 画面から渡されたプロファイルID
   * @returns 重複と空文字を除いたプロファイルID（元の並び順を保つ）
   *
   * @remarks
   * 重複は紐づけテーブルの主キー違反になる。
   * 空文字はどのプロファイルとも一致せず、どこからも見えない紐づけになる
   * （0件ではないため全プロファイル向けにもならない）。
   * 選択画面の戻り値を`split(',')`した`['']`がそのまま届く経路があるため、ここで除く。
   */
  private static normalizeProfileIds(profileIds: readonly string[]): string[] {
    return [...new Set(profileIds.filter((profileId) => profileId !== ''))];
  }

  /**
   * 値一覧を保存できる形へ正規化する
   *
   * @param inputs - 画面から渡された値一覧
   * @returns 前後空白を除去した値一覧
   * @throws {ShortcutValueRequiredError} 値が1件も無い場合
   *
   * @remarks
   * 値に名前は無いため、検証するのは件数だけとする。
   * 挿入する値そのものは空文字を許容する（空文字の挿入を選ぶ利用者の意図を壊さない）。
   * 変数トークン（{{name}}）は展開せず、入力された文字列のまま保存する。
   */
  private static normalizeValues(inputs: ShortcutValueInput[]): ShortcutValueInput[] {
    const normalized = inputs.map((input) => ({
      id: input.id,
      value: input.value.trim(),
      isMasked: input.isMasked,
    }));

    /* 値が1件も無いショートカットは拡張キーボードから何も挿入できないため拒否する */
    if (normalized.length === 0) {
      throw new ShortcutValueRequiredError();
    }

    return normalized;
  }
}
