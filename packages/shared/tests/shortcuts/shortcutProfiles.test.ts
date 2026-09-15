import { afterEach, describe, expect, it } from 'vitest';
import { setMainDbAdapter } from '../../src/adapters/DbAdapter';
import { CREATE_INDEXES, CREATE_TABLES } from '../../src/database/schema';
import { DuplicateNameError } from '../../src/errors';
import { ShortcutService } from '../../src/services/ShortcutService';
import {
  createMemoryDbAdapter,
  type MemoryDbAdapter,
} from '../helpers/memoryDbAdapter';

/**
 * ショートカットの紐づけプロファイルは shortcut_profiles（中間テーブル）が持つ。
 *
 * 定型文の snippet_profiles と同じく0件以上で、0件は全プロファイル向けを表す。
 * DB側に名前の一意制約は無いため、名前の重複判定はServiceとMapperのSQLだけが担う。
 *
 * @remarks
 * このディレクトリのテストは型チェックの対象外。入力に旧形式の単一IDを渡しても
 * 例外にならず「紐づけ省略＝0件＝全プロファイル向け」として通ってしまうため、
 * 作成・更新の入力は必ず紐づけIDの配列で書く。
 */
describe('ショートカットの紐づけプロファイル', () => {
  const databases: MemoryDbAdapter[] = [];

  afterEach(() => databases.splice(0).forEach((db) => db.dispose()));

  /** 標準かつアクティブなプロファイル */
  const MAIN = 'profile-main';
  /** 2件目のプロファイル */
  const OTHER = 'profile-other';
  /** 3件目のプロファイル（どれにも紐づけない側の確認に使う） */
  const THIRD = 'profile-third';

  /** 現行スキーマのDBに3件のプロファイルを入れ、メインDBとして登録する */
  const useDatabase = async (): Promise<MemoryDbAdapter> => {
    const db = createMemoryDbAdapter();
    databases.push(db);
    for (const sql of Object.values(CREATE_TABLES)) await db.exec(sql);
    for (const sql of Object.values(CREATE_INDEXES)) await db.exec(sql);
    db.run("INSERT INTO profiles VALUES (?, 'main', 1, 1, 1, 0, 'created', 'updated')", [MAIN]);
    db.run("INSERT INTO profiles VALUES (?, 'other', 0, 0, 1, 1, 'created', 'updated')", [OTHER]);
    db.run("INSERT INTO profiles VALUES (?, 'third', 0, 0, 1, 2, 'created', 'updated')", [THIRD]);
    setMainDbAdapter(db);
    return db;
  };

  /** 値を1件だけ持つ作成入力を、紐づけIDの配列付きで組み立てる */
  const inputWith = (name: string, profileIds: string[]) => ({
    profileIds,
    name,
    values: [{ name: '自分', value: '090-0000-0000' }],
  });

  /** 紐づけ行のプロファイルIDをID順で取り出す。行数の崩れ（重複・取り残し）もここで見える */
  const linkedProfileIds = (db: MemoryDbAdapter, shortcutId: string): string[] =>
    db
      .all<{ profileId: string }>(
        'SELECT profileId FROM shortcut_profiles WHERE shortcutId = ? ORDER BY profileId',
        [shortcutId]
      )
      .map((row) => row.profileId);

  /** 並び順に依存しない比較のため、ID配列を複製して昇順に並べる */
  const sorted = (ids: readonly string[] | undefined): string[] => [...(ids ?? [])].sort();

  /** 指定プロファイルの一覧に出るショートカット名を並び順で取り出す */
  const namesIn = (profileId: string): string[] =>
    ShortcutService.getByProfileId(profileId).map((shortcut) => shortcut.name);

  /* ==================== 作成 ==================== */

  describe('作成', () => {
    it('選んだプロファイルの数だけ紐づけ行を登録する', async () => {
      const db = await useDatabase();

      const created = ShortcutService.create(inputWith('電話番号', [MAIN, OTHER]));

      expect(linkedProfileIds(db, created.id)).toEqual([MAIN, OTHER]);
      expect(sorted(created.profileIds)).toEqual([MAIN, OTHER]);
    });

    /**
     * 0件は全プロファイル向け。紐づけ行が無くても本体は取得でき、どの一覧にも出る。
     * 取得で紐づけテーブルと結合していると、0件のものは行ごと消え、作成直後の再取得で失敗する。
     */
    it('0件で作成すると紐づけ行を持たず、IDで取得でき全プロファイルの一覧に出る', async () => {
      const db = await useDatabase();

      const created = ShortcutService.create(inputWith('電話番号', []));

      expect(linkedProfileIds(db, created.id)).toEqual([]);
      expect(created.profileIds).toEqual([]);
      expect(ShortcutService.getById(created.id)).not.toBeNull();
      expect(ShortcutService.getById(created.id)?.profileIds).toEqual([]);
      for (const profileId of [MAIN, OTHER, THIRD]) {
        expect(namesIn(profileId)).toEqual(['電話番号']);
      }
    });

    it('紐づけを省略して作成すると0件（全プロファイル向け）になる', async () => {
      const db = await useDatabase();

      const created = ShortcutService.create({
        name: '電話番号',
        values: [{ name: '自分', value: '090-0000-0000' }],
      });

      expect(linkedProfileIds(db, created.id)).toEqual([]);
      for (const profileId of [MAIN, OTHER, THIRD]) {
        expect(namesIn(profileId)).toEqual(['電話番号']);
      }
    });

    /* 同じIDを2回渡しても主キー違反で失敗させず、1行にまとめる */
    it('同じプロファイルIDを重ねて渡しても紐づけは1行になる', async () => {
      const db = await useDatabase();

      const created = ShortcutService.create(inputWith('電話番号', [MAIN, MAIN]));

      expect(linkedProfileIds(db, created.id)).toEqual([MAIN]);
    });

    /* 空文字の紐づけはどのプロファイルからも見えない行になるため登録しない */
    it('空文字のプロファイルIDは紐づけに登録しない', async () => {
      const db = await useDatabase();

      const created = ShortcutService.create(inputWith('電話番号', ['', OTHER]));

      expect(linkedProfileIds(db, created.id)).toEqual([OTHER]);
    });

    /** shortcuts 本体に profileId 列を残していないことを固定する */
    it('本体のテーブルは紐づけプロファイルの列を持たない', async () => {
      const db = await useDatabase();

      const columns = db
        .all<{ name: string }>("SELECT name FROM pragma_table_info('shortcuts')")
        .map((column) => column.name);

      expect(columns).not.toContain('profileId');
    });
  });

  /* ==================== 更新と削除 ==================== */

  describe('更新と削除', () => {
    /* 追加だけして古い行を残すと、外したはずのプロファイルの一覧にも出続ける */
    it('紐づけを渡して更新すると紐づけ行を置き換える', async () => {
      const db = await useDatabase();
      const created = ShortcutService.create(inputWith('電話番号', [MAIN]));

      const updated = ShortcutService.update({ id: created.id, profileIds: [OTHER, THIRD] });

      expect(linkedProfileIds(db, created.id)).toEqual([OTHER, THIRD]);
      expect(sorted(updated.profileIds)).toEqual([OTHER, THIRD]);
      expect(namesIn(MAIN)).toEqual([]);
    });

    it('空配列で更新すると紐づけ行が無くなり全プロファイル向けになる', async () => {
      const db = await useDatabase();
      const created = ShortcutService.create(inputWith('電話番号', [MAIN]));

      ShortcutService.update({ id: created.id, profileIds: [] });

      expect(linkedProfileIds(db, created.id)).toEqual([]);
      for (const profileId of [MAIN, OTHER, THIRD]) {
        expect(namesIn(profileId)).toEqual(['電話番号']);
      }
    });

    /* 省略を空配列と取り違えると、名前を変えただけで全プロファイル向けへ広がる */
    it('紐づけを省略した更新は紐づけ行を変えない', async () => {
      const db = await useDatabase();
      const created = ShortcutService.create(inputWith('電話番号', [MAIN, OTHER]));

      ShortcutService.update({ id: created.id, name: '電話' });

      expect(linkedProfileIds(db, created.id)).toEqual([MAIN, OTHER]);
    });

    it('削除すると紐づけ行も残らない', async () => {
      const db = await useDatabase();
      const created = ShortcutService.create(inputWith('電話番号', [MAIN, OTHER]));

      ShortcutService.delete(created.id);

      expect(db.all('SELECT * FROM shortcut_profiles')).toEqual([]);
    });
  });

  /* ==================== 名前の重複 ==================== */

  /**
   * 選んだプロファイルのいずれかで同名なら拒否する。
   * 0件のショートカットは全プロファイルの名前空間に参加する。
   * ここが外れると同じプロファイルの一覧に同名が並び、キーボードでどちらを選んだか分からなくなる。
   */
  describe('名前の重複', () => {
    it('選んだプロファイルのどれか1つに同名があれば拒否する', async () => {
      const db = await useDatabase();
      ShortcutService.create(inputWith('電話番号', [OTHER]));

      expect(() => ShortcutService.create(inputWith('電話番号', [MAIN, OTHER]))).toThrow(
        DuplicateNameError
      );
      /* 拒否したときは本体も紐づけも残さない */
      expect(db.all('SELECT id FROM shortcuts')).toHaveLength(1);
      expect(db.all('SELECT * FROM shortcut_profiles')).toHaveLength(1);
    });

    it('紐づけるプロファイルが重ならなければ同名を許す', async () => {
      const db = await useDatabase();
      ShortcutService.create(inputWith('電話番号', [OTHER]));

      ShortcutService.create(inputWith('電話番号', [MAIN, THIRD]));

      expect(db.all('SELECT id FROM shortcuts')).toHaveLength(2);
    });

    /* 既存の0件はすべてのプロファイルに出るため、どこへ紐づけても同じ一覧で並んでしまう */
    it('既存が0件（全プロファイル向け）なら、どのプロファイルを選んでも拒否する', async () => {
      await useDatabase();
      ShortcutService.create(inputWith('電話番号', []));

      for (const profileIds of [[MAIN], [THIRD], [OTHER, THIRD]]) {
        expect(() => ShortcutService.create(inputWith('電話番号', profileIds))).toThrow(
          DuplicateNameError
        );
      }
    });

    it('0件で保存すると、どのプロファイルに紐づく同名とも衝突する', async () => {
      const db = await useDatabase();
      ShortcutService.create(inputWith('電話番号', [THIRD]));

      expect(() => ShortcutService.create(inputWith('電話番号', []))).toThrow(DuplicateNameError);

      /* 更新で0件へ広げる場合も同じ。拒否したら紐づけは元のまま */
      const other = ShortcutService.create(inputWith('電話番号', [MAIN]));
      expect(() => ShortcutService.update({ id: other.id, profileIds: [] })).toThrow(
        DuplicateNameError
      );
      expect(linkedProfileIds(db, other.id)).toEqual([MAIN]);
    });

    /* N件で保存する条件と0件で保存する条件はSQLが別のため、両方で自分自身を除くことを確かめる */
    it('更新では自分自身を衝突相手にしない', async () => {
      await useDatabase();
      const linked = ShortcutService.create(inputWith('電話番号', [MAIN, OTHER]));
      const shared = ShortcutService.create(inputWith('住所', []));

      expect(() =>
        ShortcutService.update({ id: linked.id, name: '電話番号', profileIds: [MAIN, OTHER] })
      ).not.toThrow();
      expect(() => ShortcutService.update({ id: shared.id, name: '住所' })).not.toThrow();
      expect(() =>
        ShortcutService.update({ id: shared.id, name: '住所', profileIds: [] })
      ).not.toThrow();
    });

    /**
     * 名前を変えずに紐づけを広げただけでも、広げた先の同名と衝突しうるため確認する。
     *
     * 自分自身の除外はSQLで行う。衝突相手より先に自分が見つかる並びにしてあり、
     * 1件だけ読んでからJavaScriptで自分を弾く実装だと、自分を捨てて衝突相手を取りこぼし、
     * 保存が通ってしまう。
     */
    it('名前を変えずに紐づけを広げただけでも、広げた先の同名があれば拒否し紐づけを変えない', async () => {
      const db = await useDatabase();
      const self = ShortcutService.create(inputWith('請求先', [MAIN]));
      const rival = ShortcutService.create(inputWith('請求先', [OTHER]));

      /* 前提: 除外なしで1件だけ引くと、衝突相手ではなく自分が先に見つかる並びになっている */
      expect(
        db.get<{ id: string }>('SELECT s.id FROM shortcuts s WHERE s.name = ? LIMIT 1', ['請求先'])
          ?.id
      ).toBe(self.id);
      expect(rival.id).not.toBe(self.id);

      expect(() =>
        ShortcutService.update({ id: self.id, profileIds: [MAIN, OTHER] })
      ).toThrow(DuplicateNameError);
      expect(linkedProfileIds(db, self.id)).toEqual([MAIN]);
    });

    /**
     * 0件で保存するときの衝突判定（紐づけを問わない同名検索）でも、自分自身の除外はSQLで行う。
     *
     * 衝突相手より先に自分が見つかる並びにしてあり、1件だけ読んでから
     * JavaScriptで自分を弾く実装だと、衝突相手を取りこぼして0件への更新が通ってしまう。
     * N件で保存する側の同じ確認は、直前の「紐づけを広げただけでも…」が担っている。
     */
    it('0件へ広げる更新でも、先に自分が見つかる並びで同名があれば拒否し紐づけを変えない', async () => {
      const db = await useDatabase();
      const self = ShortcutService.create(inputWith('請求先', [MAIN]));
      const rival = ShortcutService.create(inputWith('請求先', [OTHER]));

      /* 前提: 除外なしで1件だけ引くと、衝突相手ではなく自分が先に見つかる並びになっている */
      expect(
        db.get<{ id: string }>('SELECT s.id FROM shortcuts s WHERE s.name = ? LIMIT 1', ['請求先'])
          ?.id
      ).toBe(self.id);
      expect(rival.id).not.toBe(self.id);

      expect(() => ShortcutService.update({ id: self.id, profileIds: [] })).toThrow(
        DuplicateNameError
      );
      expect(linkedProfileIds(db, self.id)).toEqual([MAIN]);
    });
  });

  /* ==================== 一覧 ==================== */

  /**
   * 一覧は「表示中のプロファイルに紐づくもの＋0件のもの」。
   * MAINだけ・OTHERだけ・0件・MAIN+OTHER の4件で、MAINとOTHERの一覧はそれぞれ3件になる。
   */
  describe('一覧', () => {
    /** 4パターンのショートカットを作成順に作る（MAIN+OTHERだけ値を2件持たせる） */
    const createFourKinds = () => {
      ShortcutService.create(inputWith('MAINだけ', [MAIN]));
      ShortcutService.create(inputWith('OTHERだけ', [OTHER]));
      ShortcutService.create(inputWith('全プロファイル', []));
      ShortcutService.create({
        profileIds: [MAIN, OTHER],
        name: '両方',
        values: [
          { name: '会社', value: '03-0000-0000' },
          { name: '自宅', value: '045-000-0000' },
        ],
      });
    };

    it('紐づくものと0件のものを並び順で返し、紐づかないものは返さない', async () => {
      await useDatabase();
      createFourKinds();

      expect(namesIn(MAIN)).toEqual(['MAINだけ', '全プロファイル', '両方']);
      expect(namesIn(OTHER)).toEqual(['OTHERだけ', '全プロファイル', '両方']);
      expect(namesIn(THIRD)).toEqual(['全プロファイル']);
    });

    /* 紐づけテーブルと結合すると、複数に紐づくショートカットの行や値が紐づけの数だけ重複しうる */
    it('複数のプロファイルに紐づいても1件として返し、値も重複しない', async () => {
      await useDatabase();
      createFourKinds();

      for (const profileId of [MAIN, OTHER]) {
        const both = ShortcutService.getByProfileId(profileId).filter(
          (shortcut) => shortcut.name === '両方'
        );
        expect(both).toHaveLength(1);
        expect(both[0].values.map((value) => value.name)).toEqual(['会社', '自宅']);
      }
    });

    /* 一覧の要素は編集画面の初期値になる。表示中の1件だけを持つと、保存で他の紐づけが外れる */
    it('一覧の要素は表示中のプロファイルに限らず全紐づけを持つ', async () => {
      await useDatabase();
      createFourKinds();

      const byName = new Map(
        ShortcutService.getByProfileId(MAIN).map((shortcut) => [shortcut.name, shortcut])
      );
      expect(sorted(byName.get('MAINだけ')?.profileIds)).toEqual([MAIN]);
      expect(byName.get('全プロファイル')?.profileIds).toEqual([]);
      expect(sorted(byName.get('両方')?.profileIds)).toEqual([MAIN, OTHER]);
    });

    it('IDでの取得は全紐づけを持ち、件数は一覧と一致する', async () => {
      await useDatabase();
      createFourKinds();

      const both = ShortcutService.getByProfileId(OTHER).find(
        (shortcut) => shortcut.name === '両方'
      );
      expect(both).toBeDefined();
      expect(sorted(ShortcutService.getById(both?.id ?? '')?.profileIds)).toEqual([
        MAIN,
        OTHER,
      ]);

      expect(ShortcutService.countByProfile(MAIN)).toBe(3);
      expect(ShortcutService.countByProfile(OTHER)).toBe(3);
      expect(ShortcutService.countByProfile(THIRD)).toBe(1);
      /* 総数は紐づけの数によらず1件ずつ数える（両方に紐づくものも1件） */
      expect(ShortcutService.count()).toBe(4);
    });
  });
});
