/**
 * @module seed
 * @description
 * テストデータシード機能
 *
 * 開発環境でのテスト・デモ用データを自動生成します。
 *
 * 主な機能:
 * - テストデータの生成（開発モード限定）
 * - 冪等性の保証（既存データがある場合はスキップ）
 *
 * 実行タイミング:
 * - アプリ初回起動時
 * - データベースリセット後
 *
 * データ構成（ストア用スクリーンショットの撮影に使う想定）:
 * - カテゴリ: 6種類（仕事、SNS、プロンプト、コード、連絡先、日常）
 * - スニペット: 24種類（仕事7、SNS4、プロンプト4、コード4、日常3、連絡先2）
 * - プロファイル: 2種類（取引先別。デフォルトの「Main」と合わせて無料プラン上限の3件）
 * - カスタム変数: 5種類（取引先担当者名、自社名、送信者名、案件名、メール署名）
 * - ショートカット: 19種類（全プロファイル向け 8件、Main 4件、A社用 3件、B社用 2件、A社用とB社用の両方 2件）
 *
 * dummy.jsonは ja / en の2組を持ち、端末の言語に合う組だけを投入する。
 * 日本語UIに英語データ（またはその逆）が混ざったキャプチャはストアに出せないため、
 * 言語判定は i18n/config.ts の getDeviceLanguage と同じ規則にしてある。
 * 投入済みかどうかは件数だけで判定するので、言語を切り替えて撮り直すときは
 * データベースを空にしてから起動すること（投入済みのまま言語だけ変えても入れ替わらない）。
 *
 * 一覧の既定の並びは作成日時の新しい順のため、dummy.jsonの配列の末尾ほど一覧の上に出る。
 * 撮影の一枚目に見せたいものを配列の後ろへ置いている。
 *
 * 定型文のうち「週次報告（A社様式）」はA社用、「作業報告（B社様式）」はB社用に限定してある。
 * プロファイルを切り替えると一覧の件数が変わることを、撮影で見せられるようにするため。
 *
 * 個人情報にあたる値（電話番号・メール・住所・口座・アカウントID）は末尾を小文字のxで伏せている。
 * 公開するスクリーンショットに実在しうる連絡先が写らないようにするため。桁数は残して何の値かは読めるようにする。
 *
 * tpl_001とtpl_002はタイトルにシステム変数を含む。
 * タイトルは本文と同様に変数展開の対象（一覧表示・コピー時の双方）。
 * - tpl_001: copyWithTitleがtrueのため、タイトルが本文の1行目として一緒にコピーされる
 * - tpl_002: 件名として使う（タイトルのみコピーで件名欄へ貼る）想定
 *
 * @see dummy.json - テストデータの定義ファイル
 * @see src/database/database.ts の setupDatabase / reset - データベース初期化
 */

import {
  SnippetMapper,            /* スニペット（定型文）データ操作 */
  CategoryMapper,           /* カテゴリデータ操作 */
  VariableMapper,           /* カスタム変数データ操作 */
  ProfileMapper,            /* プロファイル（環境）データ操作 */
  ProfileVariableMapper,    /* プロファイル別変数値データ操作 */
  ShortcutService,          /* ショートカット管理（Mapperは非公開のためService経由） */
  type Profile,             /* プロファイル名の解決で標準プロファイルを受け取るため */
} from '@cliptap/shared';
import { Logger } from '@cliptap/shared';
import * as Localization from 'expo-localization';

/* ======================================== */
/* テストデータ定義 */
/* ======================================== */

/**
 * JSONファイルからテストデータをインポート
 * dummy.jsonには開発用のサンプルデータが ja / en の2組で定義されている
 * 注意: tsconfig.jsonでresolveJsonModule: trueが必要
 */
import dummyData from '@root/dummy.json';

/**
 * 端末の言語に合うサンプルデータの組を選ぶ
 *
 * i18n/config.ts の getDeviceLanguage と同じ規則で、ja 以外はすべて en とみなす。
 * i18next の初期化を待たずに済ませているのは、シードがデータベース初期化の一部として
 * 走り、画面より前に呼ばれ得るため。判定規則が2か所に分かれるが、参照する情報
 * （端末の先頭ロケール）は同じなので結果は一致する。
 *
 * @returns dummy.jsonのキー（'ja' または 'en'）
 */
function resolveSeedLanguage(): 'ja' | 'en' {
  return Localization.getLocales()[0]?.languageCode === 'ja' ? 'ja' : 'en';
}

/** 投入対象の言語のサンプルデータ */
const dummyTemplates = dummyData[resolveSeedLanguage()];

/**
 * カテゴリテストデータ
 * dummy.jsonのcategoriesをそのまま使用
 */
const TEST_CATEGORIES = dummyTemplates.categories;

/**
 * 定型文テストデータ
 * JSONからスニペット形式に変換
 */
/* JSONデータを内部形式に変換してテストスニペットを生成 */
const TEST_SNIPPETS: DummySnippet[] = dummyTemplates.snippets.map(item => ({
  /* スニペットのタイトル（表示名） */
  title: item.title,
  /* スニペットの本文内容（JSONの'body'を'content'にマッピング） */
  content: item.body,
  /* 所属するカテゴリ名（後でIDに変換される） */
  categoryName: item.category,
  /* 所属させるプロファイル名（省略時は空配列＝全プロファイル向け） */
  profiles: 'profiles' in item ? item.profiles ?? [] : [],
  /* タイトルも一緒にコピーするかどうか（未定義時はfalse） */
  copyWithTitle: item.copyWithTitle ?? false,
}));

/**
 * プロファイルテストデータ
 * 取引先別のプロファイル定義
 */
const TEST_PROFILES = dummyTemplates.profiles;

/**
 * カスタム変数テストデータ
 * 変数メタデータと標準値、プロファイル別の値を含む
 */
const TEST_VARIABLES = dummyTemplates.custom_variables;

/**
 * ダミーデータの定型文
 *
 * @remarks
 * - profiles: 所属させるプロファイル名（0件以上。空配列は全プロファイル向け）
 * - categoryName: カテゴリ名（解決できなければ未分類）
 *
 * 型を明示するのは、JSONからの推論だと`profiles`を持つ要素と持たない要素で
 * ユニオンになり、中身を書き換えるたびに関係のない箇所で型が合わなくなるため
 * （DummyShortcutと同じ理由）。
 */
interface DummySnippet {
  title: string;
  content: string;
  categoryName: string;
  profiles: string[];
  copyWithTitle: boolean;
}

/**
 * ダミーデータのショートカット
 *
 * @remarks
 * - profiles: 所属させるプロファイル名（0件以上。空配列は全プロファイル向け）
 * - category: カテゴリ名（nullは未分類）
 * - values: 挿入する値（1件以上。保存する文字列で、変数トークン {{name}} をそのまま書ける）
 * - values[].isMasked: 表示を伏せるか（コピー・挿入は伏せていても実際の値を使う）
 */
interface DummyShortcut {
  name: string;
  profiles: string[];
  category: string | null;
  values: { value: string; isMasked: boolean }[];
}

/**
 * ショートカットテストデータ
 *
 * 所属プロファイル名・カテゴリ名・参照する変数名で持ち、シード時にIDへ解決する。
 * カテゴリがnullのものは未分類として登録される。
 *
 * 型を明示するのは、JSONからの推論だと`category`がnullだけの要素と文字列の要素で
 * ユニオンになり、中身を書き換えるたびに関係のない箇所で型が合わなくなるため。
 */
const TEST_SHORTCUTS: DummyShortcut[] = dummyTemplates.shortcuts;

/* ======================================== */
/* ヘルパー関数 */
/* ======================================== */

/**
 * テストデータが既に存在するかチェック
 *
 * スニペットまたはカスタム変数が1件でも存在すれば
 * シード済みと判断する（冪等性の保証）
 *
 * @returns true: データ存在（シード不要）、false: データなし（シード実行）
 */
async function hasTestData(): Promise<boolean> {
  try {
    /* SnippetMapperを使って全スニペットを取得 */
    const snippets = SnippetMapper.getAll();
    /* VariableMapperを使ってカスタム変数のみを取得（type='custom'） */
    const variables = VariableMapper.getByType('custom');

    /* スニペットまたはカスタム変数が1件でも存在すればtrueを返す（シード不要） */
    /* どちらも0件の場合はfalseを返す（シード実行が必要） */
    return snippets.length > 0 || variables.length > 0;
  } catch (error) {
    /* データベース操作でエラーが発生した場合はログに記録 */
    Logger.error('[Seed] Failed to check existing data:', error);
    /* エラー時は安全のためfalseを返す（シードを試みる方が安全） */
    return false;
  }
}

/* ======================================== */
/* 個別シード関数 */
/* ======================================== */

/**
 * カテゴリをシード
 *
 * TEST_CATEGORIESの各カテゴリを作成し、
 * カテゴリ名→IDのマッピングを返す。
 * スニペット作成時にカテゴリを紐付けるために使用。
 *
 * 1件の失敗で残りを諦めないため、ループ内で個別に catch して継続する。
 *
 * @returns カテゴリ名とIDのMap
 */
async function seedCategories(): Promise<Map<string, string>> {
  /* スニペット作成時にカテゴリ名からIDを検索するために使用 */
  const categoryMap = new Map<string, string>();

  for (const categoryData of TEST_CATEGORIES) {
    try {
      /* IDとタイムスタンプは自動生成される */
      const category = CategoryMapper.create({
        name: categoryData.name,      /* カテゴリ名（例: "AIチャット"） */
        color: categoryData.color,    /* カテゴリの色（例: "#FF5733"） */
      });
      categoryMap.set(categoryData.name, category.id);
      Logger.info(`[Seed] Created category: ${categoryData.name}`);
    } catch (error) {
      Logger.error(`[Seed] Failed to create category ${categoryData.name}:`, error);
    }
  }

  return categoryMap;
}

/**
 * 定型文（スニペット）をシード
 *
 * TEST_SNIPPETSの各スニペットを、カテゴリと所属プロファイルを解決して作成する。
 *
 * 所属プロファイルは名前の配列で持ち、空配列は全プロファイル向けとしてそのまま作る。
 * 名前を挙げたのに1件も解決できなかったものは作らずに飛ばす。空配列で作ると全プロファイル向けになり、
 * 限定したはずの定型文が全体へ広がるため（ショートカットと同じ扱い）。
 *
 * 1件の失敗で残りを諦めないため、ループ内で個別に catch して継続する。
 *
 * @param categoryMap - カテゴリ名とIDのマッピング
 * @param profileMap - プロファイル名とIDのマッピング
 */
/**
 * プロファイル名の配列をIDの配列へ解決する
 *
 * @param profileNames - dummy.jsonが指定したプロファイル名（空配列は全プロファイル向け）
 * @param profileMap - プロファイル名とIDのマッピング
 * @param defaultProfile - 標準プロファイル（未取得ならnull）
 * @returns 解決できたID と、解決できなかった名前
 *
 * @remarks
 * 標準プロファイル「Main」はdatabase.tsが作るためprofileMapに含まれない。
 * dummy.jsonが "Main" を指したときは標準プロファイルの名前と突き合わせて解決する。
 * 定型文とショートカットで同じ規則にするため、1か所にまとめている。
 */
function resolveProfileIds(
  profileNames: readonly string[],
  profileMap: Map<string, string>,
  defaultProfile: Profile | null
): { profileIds: string[]; unresolvedProfiles: string[] } {
  const profileIds: string[] = [];
  const unresolvedProfiles: string[] = [];

  for (const profileName of profileNames) {
    const profileId =
      profileMap.get(profileName) ??
      (profileName === defaultProfile?.name ? defaultProfile.id : undefined);
    if (profileId) {
      profileIds.push(profileId);
    } else {
      unresolvedProfiles.push(profileName);
    }
  }

  return { profileIds, unresolvedProfiles };
}

async function seedSnippets(
  categoryMap: Map<string, string>,
  profileMap: Map<string, string>
): Promise<void> {
  /* 標準プロファイル「Main」の解決先として先に取得しておく（ショートカットと同じ） */
  const defaultProfile = ProfileMapper.getDefault();

  for (const snippetData of TEST_SNIPPETS) {
    try {
      /* カテゴリが存在しない場合はundefinedになる */
      const categoryId = categoryMap.get(snippetData.categoryName);

      const { profileIds, unresolvedProfiles } = resolveProfileIds(
        snippetData.profiles,
        profileMap,
        defaultProfile
      );

      /* 名前を挙げたのに1件も解決できなかった。空配列のまま作ると全プロファイル向けへ広がるため作らない */
      if (snippetData.profiles.length > 0 && profileIds.length === 0) {
        Logger.error(
          `[Seed] Skipped snippet ${snippetData.title}: profiles not found (${unresolvedProfiles.join(', ')})`
        );
        continue;
      }

      SnippetMapper.create({
        title: snippetData.title,                     /* スニペットのタイトル */
        content: snippetData.content,                 /* スニペットの本文内容 */
        categoryId: categoryId || undefined,          /* カテゴリID（なくてもOK） */
        copyWithTitle: snippetData.copyWithTitle,     /* タイトルも一緒にコピーするか */
        profileIds,                                   /* 空配列 = 全プロファイルで表示 */
      });

      if (unresolvedProfiles.length > 0) {
        Logger.error(
          `[Seed] Snippet ${snippetData.title} is created without some profiles: profiles not found (${unresolvedProfiles.join(', ')})`
        );
      }

      Logger.info(
        `[Seed] Created snippet: ${snippetData.title} (profiles: [${snippetData.profiles.join(', ')}])`
      );
    } catch (error) {
      Logger.error(`[Seed] Failed to create snippet ${snippetData.title}:`, error);
    }
  }
}

/**
 * プロファイル（環境）をシード
 *
 * TEST_PROFILESの各プロファイルを作成し、
 * プロファイル名→IDのマッピングを返す。
 * カスタム変数の値設定時にプロファイルを紐付けるために使用。
 *
 * 1件の失敗で残りを諦めないため、ループ内で個別に catch して継続する。
 *
 * @returns プロファイル名とIDのMap
 */
async function seedProfiles(): Promise<Map<string, string>> {
  /* カスタム変数の値設定時にプロファイル名からIDを検索するために使用 */
  const profileMap = new Map<string, string>();

  for (const profileData of TEST_PROFILES) {
    try {
      /* IDとタイムスタンプは自動生成される */
      const profile = ProfileMapper.create({
        name: profileData.name,    /* プロファイル名（例: "A社向け"） */
      });
      profileMap.set(profileData.name, profile.id);
      Logger.info(`[Seed] Created profile: ${profileData.name} (${profile.id})`);
    } catch (error) {
      Logger.error(`[Seed] Failed to create profile ${profileData.name}:`, error);
    }
  }

  return profileMap;
}

/**
 * カスタム変数をシード（プロファイル対応）
 *
 * カスタム変数のメタデータと値を作成します。
 *
 * データモデル:
 * 1. variables テーブル: 変数のメタデータ（name, label, iconなど）
 * 2. profile_variables テーブル: プロファイル別の値
 *    - デフォルトプロファイル: 標準値を格納
 *    - その他のプロファイル: 環境固有の値を格納
 *
 * 処理フロー:
 * 1. 変数メタデータの作成（variablesテーブル）
 * 2. デフォルトプロファイルに標準値を設定
 * 3. 各プロファイルに固有の値を設定
 *
 * 1件の失敗で残りを諦めないため、ループ内で個別に catch して継続する。
 * 値の設定（upsert）も変数ごとに catch するので、値の設定に失敗しても
 * 変数メタデータの作成自体は残る。
 *
 * @param {Map<string, string>} profileMap - プロファイル名とIDのマッピング
 */
async function seedVariables(
  profileMap: Map<string, string>
): Promise<void> {
  /* 標準値はデフォルトプロファイル（Main）に格納するため、先に取得しておく */
  const defaultProfile = ProfileMapper.getDefault();
  if (!defaultProfile) {
    Logger.error('[Seed] Default profile not found, cannot seed variables');
    return;
  }

  for (const variableData of TEST_VARIABLES) {
    try {
      /* 変数の値はprofile_variablesテーブルに別途格納される */
      const variable = VariableMapper.create({
        name: variableData.name,      /* 変数名（例: "company"） */
        label: variableData.label,    /* 表示ラベル（例: "会社名"） */
        icon: variableData.icon,      /* アイコン名（例: "business-outline"） */
        type: 'custom',               /* 変数タイプ（カスタム変数として作成） */
      });

      Logger.info(`[Seed] Created variable: ${variableData.name}`);

      /* profile_variablesテーブルに（デフォルトプロファイルID, 変数ID, 標準値）を挿入 */
      try {
        ProfileVariableMapper.upsert({
          profileId: defaultProfile.id,           /* デフォルトプロファイルのID */
          variableId: variable.id,                /* 作成した変数のID */
          value: variableData.standardValue,      /* 標準値（全プロファイル共通のデフォルト値） */
        });
        /* 値はログが長くなりすぎないよう20文字までに切り詰めて出力する */
        Logger.info(`[Seed] Set standard value for ${variableData.name} = ${variableData.standardValue.substring(0, 20)}...`);
      } catch (error) {
        Logger.error(`[Seed] Failed to set standard value for ${variableData.name}:`, error);
      }

      /* profileValuesが定義されている場合のみ、プロファイル固有の値を設定する */
      if (variableData.profileValues) {
        for (const [profileName, value] of Object.entries(variableData.profileValues)) {
          const profileId = profileMap.get(profileName);
          /* プロファイル作成に失敗していると profileMap に無いため、その分の値設定は行わない */
          if (profileId) {
            try {
              ProfileVariableMapper.upsert({
                profileId,              /* プロファイルのID */
                variableId: variable.id, /* 変数のID */
                value,                  /* プロファイル固有の値 */
              });
              Logger.info(`[Seed] Set variable value for ${profileName}: ${variableData.name} = ${value.substring(0, 20)}...`);
            } catch (error) {
              Logger.error(`[Seed] Failed to set variable value for ${profileName}:`, error);
            }
          }
        }
      }
    } catch (error) {
      Logger.error(`[Seed] Failed to create variable ${variableData.name}:`, error);
    }
  }
}

/**
 * ショートカットをシード
 *
 * TEST_SHORTCUTSの各ショートカットを、所属プロファイルとカテゴリを解決して作成する。
 *
 * 所属プロファイルは名前の配列で持ち、空配列は全プロファイル向けとしてそのまま作る。
 * 名前を挙げたのに1件も解決できなかったものは作らずに飛ばす。空配列で作ると全プロファイル向けになり、
 * 限定したはずのショートカットが全体へ広がるため。
 * 一部だけ解決できなかったものは、解決できた分に紐づけて作り、解決できなかった名前をログに残す。
 * カテゴリは任意のため、未指定・解決できない場合は未分類（null）として登録する。
 * 値には変数トークン（{{name}}）をそのまま書ける。表示・コピー・キーボードからの挿入の時点で展開される（§8.24）。
 *
 * 1件の失敗で残りを諦めないため、ループ内で個別に catch して継続する。
 *
 * @param profileMap - プロファイル名とIDのマッピング
 * @param categoryMap - カテゴリ名とIDのマッピング
 */
async function seedShortcuts(
  profileMap: Map<string, string>,
  categoryMap: Map<string, string>
): Promise<void> {
  /* 標準プロファイル「Main」はdatabase.tsが作るためprofileMapに含まれない。
     dummy.jsonが "Main" を指したときの解決先として先に取得しておく */
  const defaultProfile = ProfileMapper.getDefault();

  for (const shortcutData of TEST_SHORTCUTS) {
    try {
      /* プロファイル名をIDへ解決する。プロファイル作成に失敗していると解決できない */
      const profileIds: string[] = [];
      const unresolvedProfiles: string[] = [];
      for (const profileName of shortcutData.profiles) {
        const profileId =
          profileMap.get(profileName) ??
          (profileName === defaultProfile?.name ? defaultProfile.id : undefined);
        if (profileId) {
          profileIds.push(profileId);
        } else {
          unresolvedProfiles.push(profileName);
        }
      }

      /* 名前を挙げたのに1件も解決できなかった。空配列のまま作ると全プロファイル向けへ広がるため作らない */
      if (shortcutData.profiles.length > 0 && profileIds.length === 0) {
        Logger.error(
          `[Seed] Skipped shortcut ${shortcutData.name}: profiles not found (${unresolvedProfiles.join(', ')})`
        );
        continue;
      }

      /* 一部だけ解決できなかった。解決できた分に紐づけて作り、欠けた名前を残す */
      if (unresolvedProfiles.length > 0) {
        Logger.error(
          `[Seed] Shortcut ${shortcutData.name} is created without some profiles: profiles not found (${unresolvedProfiles.join(', ')})`
        );
      }

      ShortcutService.create({
        profileIds,                                                  /* 所属プロファイルID（空配列は全プロファイル向け） */
        categoryId: shortcutData.category                            /* カテゴリID（未分類はnull） */
          ? categoryMap.get(shortcutData.category) ?? null
          : null,
        name: shortcutData.name,                                     /* ショートカット名 */
        values: shortcutData.values,                                 /* 挿入する値（変数トークンは未展開のまま） */
      });

      Logger.info(
        `[Seed] Created shortcut: ${shortcutData.name} (profiles: [${shortcutData.profiles.join(', ')}])`
      );
    } catch (error) {
      Logger.error(`[Seed] Failed to create shortcut ${shortcutData.name}:`, error);
    }
  }
}

/**
 * データをシード
 *
 * アプリ初回起動時にテストデータを作成します。
 *
 * 実行条件:
 * - __DEV__ のときだけテストデータを投入する。本番ビルドでは何もしない。
 *
 * 冪等性:
 * - 既存データがある場合は自動的にスキップ
 * - 複数回実行しても安全
 *
 * 生成されるデータ（端末の言語に合う組だけ）:
 * 1. カテゴリ 6種類
 * 2. プロファイル 2種類（デフォルトの「Main」と合わせて計3件）
 * 3. スニペット 24種類（うち2件はプロファイルを限定。残りは全プロファイル向け）
 * 4. カスタム変数 5種類 + 各プロファイル別の値
 * 5. ショートカット 19種類（現在のdummy.jsonは全件カテゴリ付き。未分類も登録できる）
 *
 * デフォルトプロファイル「Main」の作成はこの関数の責務ではなく、
 * src/database/database.ts の setupDatabase / reset が担う。
 *
 * 失敗しても例外を投げず、エラーログのみ残す。
 */
export async function runSeed(): Promise<void> {
  try {

    Logger.info('[Seed] Checking for existing test data...');

    /* テストデータは開発環境でのみ生成する（本番ビルドではここで打ち切る） */
    if (!__DEV__) {
      return;
    }

    const hasData = await hasTestData();
    if (hasData) {
      /* データが既に存在する場合はシードをスキップ（冪等性の保証） */
      Logger.info('[Seed] Test data already exists, skipping seed');
      return;
    }

    Logger.info('[Seed] Starting to seed test data...');

    /* 1. カテゴリを作成し、カテゴリ名→IDのマッピングを取得 */
    const categoryMap = await seedCategories();

    /* 2. プロファイルを作成し、プロファイル名→IDのマッピングを取得。
          定型文とショートカットの所属プロファイルを解決するため、どちらよりも先に行う */
    const profileMap = await seedProfiles();

    /* 3. スニペットを作成（カテゴリとプロファイルを解決） */
    await seedSnippets(categoryMap, profileMap);

    /* 4. カスタム変数を作成し、各プロファイル別の値も設定 */
    await seedVariables(profileMap);

    /* 5. ショートカットを作成 */
    await seedShortcuts(profileMap, categoryMap);

    Logger.info('[Seed] Test data seeding completed successfully!');
  } catch (error) {
    /* 呼び出し元（アプリ起動処理）を止めないため、ここで握り潰してログのみ残す */
    Logger.error('[Seed] Failed to seed test data:', error);
  }
}
