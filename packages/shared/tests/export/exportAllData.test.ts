import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { setCryptoAdapter } from '../../src/adapters/CryptoAdapter';
import { setMainDbAdapter, setTempDbAdapter, type DbAdapter } from '../../src/adapters/DbAdapter';
import { setExportAdapter, type ExportAdapter } from '../../src/adapters/ExportAdapter';
import { setImportAdapter } from '../../src/adapters/ImportAdapter';
import { CREATE_TABLES, SCHEMA_VERSION } from '../../src/database/schema';
import { ExportFailedError, IncorrectPasswordError } from '../../src/errors';
import { ExportService } from '../../src/services/ExportService';
import { ImportParserService } from '../../src/services/ImportParserService';
import { ImportService } from '../../src/services/ImportService';
import { FileDbAdapter } from '../helpers/fileDbAdapter';
import { createMemoryDbAdapter, type MemoryDbAdapter } from '../helpers/memoryDbAdapter';

const PASSWORD = 'backup-password';

/** 復元で逐語に戻るべき業務テーブル（カスタム変数以外の変数行は復元対象外） */
const BUSINESS_TABLE_QUERIES = {
  categories: 'SELECT * FROM categories ORDER BY id',
  variables: "SELECT * FROM variables WHERE type = 'custom' ORDER BY id",
  profiles: 'SELECT * FROM profiles ORDER BY id',
  profileVariables: 'SELECT * FROM profile_variables ORDER BY id',
  snippets: 'SELECT * FROM snippets ORDER BY id',
  snippetProfiles: 'SELECT * FROM snippet_profiles ORDER BY snippetId, profileId',
  systemVariableFormats: 'SELECT * FROM system_variable_formats ORDER BY variableKey',
  shortcuts: 'SELECT * FROM shortcuts ORDER BY id',
  shortcutProfiles: 'SELECT * FROM shortcut_profiles ORDER BY shortcutId, profileId',
  shortcutValues: 'SELECT * FROM shortcut_values ORDER BY id',
} as const;

/** 業務テーブルの全行をテーブルごとに読む */
const readBusinessData = (db: DbAdapter): Record<string, unknown[]> =>
  Object.fromEntries(
    Object.entries(BUSINESS_TABLE_QUERIES).map(([table, sql]) => [table, db.all(sql)])
  );

/** 全業務テーブルへ1件以上を入れる（使用回数・表示順・関連・変数参照を含む） */
const seedAllTables = (db: DbAdapter): void => {
  db.run("INSERT INTO categories VALUES ('c1', 'category', '#123456', 7, 'c-created')");
  db.run(
    "INSERT INTO variables VALUES ('v1', 'token', 'custom', 'Token', 'key', 1, 8, 'v-created', 'v-updated')"
  );
  db.run("INSERT INTO profiles VALUES ('p1', 'profile', 1, 1, 1, 0, 'p-created', 'p-updated')");
  db.run("INSERT INTO profiles VALUES ('p2', 'other', 0, 0, 1, 1, 'p2-created', 'p2-updated')");
  db.run(
    "INSERT INTO snippets VALUES ('s1', 'title', 'body', 'c1', 1, 42, 's-created', 's-updated')"
  );
  db.run(
    "INSERT INTO profile_variables VALUES ('pv1', 'p1', 'v1', 'secret', 'pv-created', 'pv-updated')"
  );
  db.run("INSERT INTO snippet_profiles VALUES ('s1', 'p1')");
  db.run("INSERT INTO system_variable_formats VALUES ('today', 'yyyy-MM-dd', 'format-updated')");
  db.run("INSERT INTO shortcuts VALUES ('sc1', 'c1', 'phone', 3, 'sc-created', 'sc-updated')");
  db.run("INSERT INTO shortcut_profiles VALUES ('sc1', 'p2')");
  db.run(
    "INSERT INTO shortcut_values VALUES ('sv1', 'sc1', '080-0000-0000', 1, 12, 1, 'sv-created', 'sv-updated')"
  );
};

/** 保存したファイル名と内容 */
interface CapturedFile {
  name: string;
  content: string;
}

/** 保存内容を捕捉するExportAdapterを作る */
const createCapturingExportAdapter = (captured: CapturedFile[]): ExportAdapter => ({
  saveExportFile: async (fileName: string, content: string) => {
    captured.push({ name: fileName, content });
    return `memory://${fileName}`;
  },
});

describe('ExportService.exportAllData', () => {
  let tempDirectory = '';
  const fileDatabases: FileDbAdapter[] = [];
  const memoryDatabases: MemoryDbAdapter[] = [];

  beforeAll(() => {
    setCryptoAdapter({
      sha256: async (input: string) => createHash('sha256').update(input).digest('hex'),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    fileDatabases.splice(0).forEach((db) => db.close());
    memoryDatabases.splice(0).forEach((db) => db.dispose());
    if (tempDirectory) rmSync(tempDirectory, { recursive: true, force: true });
    tempDirectory = '';
  });

  /** 実ファイルのバックアップ元DBを作り、全テーブルへデータを入れる */
  const createSourceDatabase = async (): Promise<{ db: FileDbAdapter; path: string }> => {
    tempDirectory = mkdtempSync(join(tmpdir(), 'cliptap-backup-'));
    const path = join(tempDirectory, 'source.db');
    const db = new FileDbAdapter();
    fileDatabases.push(db);
    await db.open(path);
    for (const sql of Object.values(CREATE_TABLES)) await db.exec(sql);
    seedAllTables(db);
    return { db, path };
  };

  /** メインDBをバックアップし、保存されたファイルを返す */
  const backUp = async (main: DbAdapter): Promise<CapturedFile> => {
    const captured: CapturedFile[] = [];
    setMainDbAdapter(main);
    setExportAdapter(createCapturingExportAdapter(captured));
    await ExportService.exportAllData(PASSWORD);
    expect(captured).toHaveLength(1);
    return captured[0];
  };

  it('writes a ClipTap_backup file of the whole main database that the restore parser accepts', async () => {
    const source = await createSourceDatabase();

    const file = await backUp(source.db);

    expect(file.name).toMatch(/^ClipTap_backup_\d{14}\.cliptap$/);
    const { dbBytes, exportData } = await new ImportParserService().parseAndValidate(
      file.content,
      PASSWORD
    );
    expect(exportData.s).toBe(SCHEMA_VERSION);
    /* 一時DBで行を削らず、メインDBのバイト列をそのまま格納する */
    expect(Buffer.from(dbBytes).equals(readFileSync(source.path))).toBe(true);
    await expect(
      new ImportParserService().parseAndValidate(file.content, 'wrong-password')
    ).rejects.toBeInstanceOf(IncorrectPasswordError);
  });

  it('restores every business row exactly through the normal restore path', async () => {
    const source = await createSourceDatabase();
    const expected = readBusinessData(source.db);
    const file = await backUp(source.db);

    setImportAdapter({
      readImportFile: async () => file.content,
      writeTempDatabase: async (tempFileName: string, base64Data: string) => {
        const path = join(tempDirectory, tempFileName);
        writeFileSync(path, Buffer.from(base64Data, 'base64'));
        return path;
      },
      deleteFile: async (path: string) => {
        rmSync(path, { force: true });
      },
    });
    const tempDb = new FileDbAdapter();
    fileDatabases.push(tempDb);
    setTempDbAdapter(tempDb);
    const tempDbPath = await ImportService.prepareImportDatabase(PASSWORD, file.name);

    /* 復元先には消えるべき既存データを置く */
    const target = createMemoryDbAdapter();
    memoryDatabases.push(target);
    for (const sql of Object.values(CREATE_TABLES)) await target.exec(sql);
    target.run("INSERT INTO categories VALUES ('old', 'old', NULL, 0, 'old-time')");
    target.run(
      "INSERT INTO snippets VALUES ('old-s', 'old', 'old', 'old', 0, 3, 'old-time', 'old-time')"
    );
    setMainDbAdapter(target);

    await ImportService.importDatabaseFromTempDb(tempDbPath);

    expect(readBusinessData(target)).toEqual(expected);
  });

  it('names the file with the local timestamp', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 13, 14, 30, 25));

    expect(ExportService.generateFilename()).toBe('ClipTap_backup_20260913143025.cliptap');
  });

  it('wraps a failed save as ExportFailedError', async () => {
    const source = await createSourceDatabase();
    setMainDbAdapter(source.db);
    setExportAdapter({
      saveExportFile: async () => {
        throw new Error('share failed');
      },
    });

    await expect(ExportService.exportAllData(PASSWORD)).rejects.toBeInstanceOf(ExportFailedError);
  });

  it('wraps a main database without serialization support as ExportFailedError', async () => {
    const main = createMemoryDbAdapter();
    memoryDatabases.push(main);
    const captured: CapturedFile[] = [];
    setMainDbAdapter(main);
    setExportAdapter(createCapturingExportAdapter(captured));

    await expect(ExportService.exportAllData(PASSWORD)).rejects.toBeInstanceOf(ExportFailedError);
    expect(captured).toHaveLength(0);
  });
});
