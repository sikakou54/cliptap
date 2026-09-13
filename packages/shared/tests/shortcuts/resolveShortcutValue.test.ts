import { afterEach, describe, expect, it } from 'vitest';
import { setMainDbAdapter } from '../../src/adapters/DbAdapter';
import { CREATE_INDEXES, CREATE_TABLES } from '../../src/database/schema';
import { ShortcutService } from '../../src/services/ShortcutService';
import { ProfileVariableMapper } from '../../src/mappers/ProfileMapper';
import { VariableService } from '../../src/services/VariableService';
import { resolveProfileValue } from '../../src/shortcuts/resolveValue';
import {
  createMemoryDbAdapter,
  type MemoryDbAdapter,
} from '../helpers/memoryDbAdapter';

/**
 * ショートカット値の中身は、保存した文字列をそのまま使うか、カスタム変数を参照して
 * その変数の値を使うかのどちらか。
 *
 * 参照の解決順序はカスタム変数（§8.6）と同じで、
 * 「基準プロファイルの非空値」→「標準プロファイルの非空値」→「空文字」とする。
 * 基準は表示中（アクティブ）のプロファイルで、ショートカットの紐づけ先ではない。
 * 紐づけは0件以上のため、紐づけ先を基準にすると0件や複数件のときに基準が決まらない。
 * 3実装（TypeScript / Swift / Kotlin）が同じ規則を写すため、ここで振る舞いを固定する。
 */
describe('ショートカット値の解決', () => {
  const databases: MemoryDbAdapter[] = [];

  afterEach(() => databases.splice(0).forEach((db) => db.dispose()));

  const DEFAULT_PROFILE_ID = 'profile-main';
  const OTHER_PROFILE_ID = 'profile-other';

  const useDatabase = async (): Promise<MemoryDbAdapter> => {
    const db = createMemoryDbAdapter();
    databases.push(db);
    for (const sql of Object.values(CREATE_TABLES)) await db.exec(sql);
    for (const sql of Object.values(CREATE_INDEXES)) await db.exec(sql);
    /* 標準かつアクティブなプロファイルと、もう1件 */
    db.run(
      "INSERT INTO profiles VALUES (?, 'main', 1, 1, 0, 0, 'created', 'updated')",
      [DEFAULT_PROFILE_ID]
    );
    db.run(
      "INSERT INTO profiles VALUES (?, 'other', 0, 1, 1, 0, 'created', 'updated')",
      [OTHER_PROFILE_ID]
    );
    setMainDbAdapter(db);
    return db;
  };

  /** 指定プロファイルの1件目のショートカットが持つ、1件目の値を取り出す */
  const firstValueIn = (profileId: string) =>
    ShortcutService.getByProfileId(profileId)[0].values[0];

  /* ==================== 解決規則そのもの ==================== */

  describe('resolveProfileValue', () => {
    it('基準プロファイルの値を優先する', () => {
      expect(
        resolveProfileValue({ a: '固有', b: '標準' }, 'a', 'b')
      ).toBe('固有');
    });

    it('基準プロファイルに値が無ければ標準プロファイルの値を使う', () => {
      expect(resolveProfileValue({ b: '標準' }, 'a', 'b')).toBe('標準');
    });

    /* 値を入力せずに保存すると空文字が保存され得るため、空は未設定として読み飛ばす（§8.6） */
    it('基準プロファイルの値が空文字なら標準プロファイルの値を使う', () => {
      expect(resolveProfileValue({ a: '', b: '標準' }, 'a', 'b')).toBe('標準');
    });

    it('どこにも非空の値が無ければ空文字になる', () => {
      expect(resolveProfileValue({ a: '', b: '' }, 'a', 'b')).toBe('');
      expect(resolveProfileValue({}, 'a', 'b')).toBe('');
    });

    it('基準プロファイルが未確定でも標準プロファイルの値へ落ちる', () => {
      expect(resolveProfileValue({ b: '標準' }, null, 'b')).toBe('標準');
    });
  });

  /* ==================== 保存した文字列 ==================== */

  describe('保存した文字列', () => {
    it('保存した文字列がそのまま中身になる', async () => {
      await useDatabase();
      ShortcutService.create({
        profileIds: [DEFAULT_PROFILE_ID],
        name: '電話番号',
        values: [{ name: '会社', value: '03-0000-0000' }],
      });

      expect(firstValueIn(DEFAULT_PROFILE_ID).value).toBe('03-0000-0000');
    });

    /**
     * 読み手が「参照中かどうか」を意識せずに済むよう、解決結果は`value`に持つ。
     * 保存した文字列そのものは`storedValue`に別で持ち、参照が無ければ両者は一致する。
     */
    it('storedValueが保存した文字列を保持する', async () => {
      await useDatabase();
      ShortcutService.create({
        profileIds: [DEFAULT_PROFILE_ID],
        name: '電話番号',
        values: [{ name: '会社', value: '03-0000-0000' }],
      });

      expect(firstValueIn(DEFAULT_PROFILE_ID)).toMatchObject({
        storedValue: '03-0000-0000',
        value: '03-0000-0000',
        variableId: null,
      });
    });
  });

  /* ==================== カスタム変数の参照 ==================== */

  describe('カスタム変数の参照', () => {
    /** 参照用のカスタム変数を1件作り、プロファイル別の値を入れる */
    const createVariable = (values: Record<string, string>): string => {
      const variable = VariableService.create({
        name: 'company',
        label: '会社名',
        icon: 'business-outline',
        type: 'custom',
      });
      for (const [profileId, value] of Object.entries(values)) {
        ProfileVariableMapper.upsert({ profileId, variableId: variable.id, value });
      }
      return variable.id;
    };

    /**
     * 指定したプロファイルへ紐づけ、カスタム変数を参照する値を1件持つショートカットを作る
     *
     * @remarks
     * 紐づけは必ず配列で渡す。このテストは型チェックの対象外のため、
     * 単一IDのキーで渡すと例外にならず0件（全プロファイル向け）として作られてしまう。
     */
    const createReferencing = (
      profileIds: string[],
      variableId: string,
      value = '',
      name = '差出人'
    ) =>
      ShortcutService.create({
        profileIds,
        name,
        values: [{ name: '会社名', value, variableId }],
      });

    /** プロファイル別の値を入れた参照用の変数（MainとOtherで値が異なる） */
    const createVariableForBoth = (): string =>
      createVariable({
        [DEFAULT_PROFILE_ID]: '株式会社Main',
        [OTHER_PROFILE_ID]: '株式会社Other',
      });

    it('参照した変数の、表示中のプロファイルの値を返す', async () => {
      await useDatabase();
      const variableId = createVariableForBoth();
      createReferencing([DEFAULT_PROFILE_ID], variableId);
      createReferencing([OTHER_PROFILE_ID], variableId);

      expect(firstValueIn(DEFAULT_PROFILE_ID).value).toBe('株式会社Main');
      expect(firstValueIn(OTHER_PROFILE_ID).value).toBe('株式会社Other');
    });

    it('参照先に表示中のプロファイルの値が無ければ標準プロファイルの値へ落ちる', async () => {
      await useDatabase();
      const variableId = createVariable({ [DEFAULT_PROFILE_ID]: '株式会社Main' });
      createReferencing([OTHER_PROFILE_ID], variableId);

      expect(firstValueIn(OTHER_PROFILE_ID).value).toBe('株式会社Main');
    });

    /* 0件のショートカットは全プロファイルに出るため、1件の値が一覧ごとに別の中身になる */
    it('紐づけ0件のショートカットは、表示中のプロファイルごとに解決する', async () => {
      await useDatabase();
      const variableId = createVariableForBoth();
      createReferencing([], variableId);

      expect(firstValueIn(DEFAULT_PROFILE_ID).value).toBe('株式会社Main');
      expect(firstValueIn(OTHER_PROFILE_ID).value).toBe('株式会社Other');
    });

    it('複数のプロファイルに紐づくショートカットも、表示中のプロファイルで解決する', async () => {
      await useDatabase();
      const variableId = createVariableForBoth();
      createReferencing([DEFAULT_PROFILE_ID, OTHER_PROFILE_ID], variableId);

      expect(firstValueIn(DEFAULT_PROFILE_ID).value).toBe('株式会社Main');
      expect(firstValueIn(OTHER_PROFILE_ID).value).toBe('株式会社Other');
    });

    /**
     * IDでの取得は、呼び出し側が渡した基準プロファイルで解決する。
     * 紐づけ先で解決すると、編集画面で表示中と違うプロファイルの値が出る。
     * OTHERだけに紐づけたショートカットで基準nullを確かめ、紐づけ先ではなく標準へ落ちることを見る。
     */
    it('IDでの取得は渡した基準プロファイルで解決し、nullなら標準プロファイルで解決する', async () => {
      await useDatabase();
      const variableId = createVariableForBoth();
      const linkedToOther = createReferencing([OTHER_PROFILE_ID], variableId);
      const shared = createReferencing([], variableId, '', '宛先');

      const valueOf = (id: string, basis: string | null) =>
        ShortcutService.getById(id, basis)?.values[0]?.value;

      expect(valueOf(linkedToOther.id, OTHER_PROFILE_ID)).toBe('株式会社Other');
      expect(valueOf(linkedToOther.id, DEFAULT_PROFILE_ID)).toBe('株式会社Main');
      expect(valueOf(linkedToOther.id, null)).toBe('株式会社Main');
      expect(valueOf(shared.id, OTHER_PROFILE_ID)).toBe('株式会社Other');
      expect(valueOf(shared.id, null)).toBe('株式会社Main');
    });

    /* 画面は保存の戻り値で一覧を差し替えるため、戻り値も表示中のプロファイルで解決されている必要がある */
    it('作成・更新の戻り値も渡した基準プロファイルで解決する', async () => {
      await useDatabase();
      const variableId = createVariableForBoth();

      const created = ShortcutService.create(
        {
          profileIds: [DEFAULT_PROFILE_ID, OTHER_PROFILE_ID],
          name: '差出人',
          values: [{ name: '会社名', value: '', variableId }],
        },
        OTHER_PROFILE_ID
      );
      expect(created.values[0].value).toBe('株式会社Other');

      const updated = ShortcutService.update({ id: created.id, name: '差出人（会社）' }, OTHER_PROFILE_ID);
      expect(updated.values[0].value).toBe('株式会社Other');
    });

    /**
     * 値名は残し、中身だけが空になる。
     * 行ごと消すと、アプリで登録したはずの値がキーボードから見当たらなくなる（§8.24）。
     */
    it('参照先の変数にどこにも値が無ければ空文字になり、値自体は残る', async () => {
      await useDatabase();
      const variableId = createVariable({});
      createReferencing([DEFAULT_PROFILE_ID], variableId);

      const [shortcut] = ShortcutService.getByProfileId(DEFAULT_PROFILE_ID);
      expect(shortcut.values.map((value) => [value.name, value.value])).toEqual([
        ['会社名', ''],
      ]);
    });

    /**
     * 参照を張った時点で「中身の持ち主は変数側」と決めている。
     * 両方を見にいくと、どちらが挿入されるのか利用者には判断できない。
     * 自前の文字列は`storedValue`に残すだけで、`value`には出さない。
     */
    it('参照中は自前の文字列を使わず、storedValueにだけ残す', async () => {
      await useDatabase();
      const variableId = createVariable({ [DEFAULT_PROFILE_ID]: '株式会社Main' });
      createReferencing([DEFAULT_PROFILE_ID], variableId, '自前の値');

      expect(firstValueIn(DEFAULT_PROFILE_ID)).toMatchObject({
        variableId,
        value: '株式会社Main',
        storedValue: '自前の値',
      });
    });

    /**
     * 参照を外したら、参照前に入れていた文字列へ戻る。
     * 参照中も自前の文字列を消さずに保存しているため復帰できる。
     */
    it('参照を外すとstoredValueの文字列へ戻る', async () => {
      await useDatabase();
      const variableId = createVariable({ [DEFAULT_PROFILE_ID]: '株式会社Main' });
      const created = createReferencing([DEFAULT_PROFILE_ID], variableId, '自前の値');

      ShortcutService.update({
        id: created.id,
        values: [
          { id: created.values[0].id, name: '会社名', value: '自前の値', variableId: null },
        ],
      });

      expect(firstValueIn(DEFAULT_PROFILE_ID)).toMatchObject({
        variableId: null,
        value: '自前の値',
        storedValue: '自前の値',
      });
    });

    /**
     * 変数を削除すると参照が外れる（カテゴリ削除でcategoryIdをNULLへ戻すのと同じ扱い）。
     * 実行時に外部キーを強制しないため、宣言した ON DELETE SET NULL は働かない。
     * 参照が残ると、存在しない変数を指したまま解決を試み続けることになる。
     * 参照が外れた値は、保存していた文字列へ戻る（§8.5）。
     */
    it('参照先の変数を削除すると参照が外れ、保存した文字列へ戻る', async () => {
      await useDatabase();
      const variableId = createVariable({ [DEFAULT_PROFILE_ID]: '株式会社Main' });
      createReferencing([DEFAULT_PROFILE_ID], variableId, '自前の値');

      VariableService.delete(variableId);

      const [shortcut] = ShortcutService.getByProfileId(DEFAULT_PROFILE_ID);
      expect(shortcut.values.map((value) => [value.name, value.variableId, value.value])).toEqual([
        ['会社名', null, '自前の値'],
      ]);
    });
  });
});
