#!/usr/bin/env node
/**
 * テスト仕様書と付帯台帳の機械検証
 *
 *   node validate.mjs [--dir docs/test]
 *
 * 「Claudeが追加判断せずCSVからテストを実行できること」を人手のレビューだけで
 * 保証するのは無理がある。曖昧な期待値・未割当のパターン・未定義の前提条件は
 * ここで機械的に落とす。エラーが1件でもあれば終了コード1。
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { basename, extname, join, isAbsolute, relative, sep } from 'node:path';
import { readCsvObjects } from './lib/csv.mjs';
import { ACTIONS, PRECONDITION_KEYS } from './lib/actions.mjs';
import { loadConfig, REPO_ROOT, SCRIPTS_DIR } from './lib/config.mjs';

const cfg = loadConfig();
let dir = cfg.testDocDir;
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--dir') dir = argv[++i];
}
if (!isAbsolute(dir)) dir = join(REPO_ROOT, dir);

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

/** 期待値に書かれていたら不合格にする表現。読む人によって解釈が割れるため */
const VAGUE = [
  '正しく', '適切に', '問題なく', 'きちんと', 'ちゃんと', '正常に動作',
  '期待通り', '期待どおり', '想定通り', '想定どおり', 'スムーズに',
  '適宜', '必要に応じて', 'など', 'いい感じ', '妥当な',
];

const VALID_CATEGORY = ['正常系', '異常系', '境界値', '状態遷移', '権限', '表示', '性能', '並行操作', '互換性'];
const VALID_PRIORITY = ['P1', 'P2', 'P3'];
const VALID_SOURCE = ['FunctionalSpec', 'SourceCode', 'RouteDefinition', 'Validation', 'StateManagement', 'API', 'Database', 'Constant', 'Review'];
const VALID_REACHABILITY = ['REACHABLE', 'UNREACHABLE'];
const VALID_SCOPE = ['in-scope', 'manual-only', 'out-of-scope'];

function walkFiles(dir) {
  const files = [];
  if (!existsSync(dir)) return files;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) files.push(...walkFiles(p));
    else if (e.isFile()) files.push(p);
  }
  return files;
}

function load(name, required = true) {
  const f = join(dir, name);
  if (!existsSync(f)) {
    if (required) err(`必須ファイルがありません: ${f}`);
    return { header: [], records: [] };
  }
  return readCsvObjects(readFileSync(f, 'utf8'));
}

function requireColumns(name, header, cols) {
  for (const c of cols) {
    if (!header.includes(c)) err(`${name}: 必須列がありません: ${c}`);
  }
}

/* ======================================== */
/* 読み込み */
/* ======================================== */

const features = load('features.csv');
const screensCsv = load('screens.csv');
const routes = load('routes.csv');
const matrix = load('pattern-matrix.csv');
const spec = load('testspec.csv');

const fixtures = existsSync(join(SCRIPTS_DIR, 'fixtures'))
  ? readdirSync(join(SCRIPTS_DIR, 'fixtures')).filter((f) => f.endsWith('.sql')).map((f) => f.replace(/\.sql$/, ''))
  : [];

const featureIds = new Set(features.records.map((r) => r.FeatureID).filter(Boolean));
const inScopeFeatureIds = new Set(features.records.filter((r) => r.Scope === 'in-scope').map((r) => r.FeatureID));
const screenIds = new Set(screensCsv.records.map((r) => r.ScreenID).filter(Boolean));
const patternIds = new Set(matrix.records.map((r) => r.PatternID).filter(Boolean));

/* ======================================== */
/* features.csv */
/* ======================================== */

requireColumns('features.csv', features.header, ['FeatureID', 'Name', 'SpecRef', 'Platform', 'Scope']);
{
  const seen = new Set();
  for (const r of features.records) {
    if (!r.FeatureID) { err(`features.csv:${r.__line}: FeatureIDが空です`); continue; }
    if (seen.has(r.FeatureID)) err(`features.csv:${r.__line}: FeatureIDが重複しています: ${r.FeatureID}`);
    seen.add(r.FeatureID);
    if (!/^F-(?:0[1-9]|1\d|2[0-4])$/.test(r.FeatureID)) {
      err(`features.csv:${r.__line}: FeatureIDは F-01〜F-24 の形式です: ${r.FeatureID}`);
    }
    if (!r.SpecRef) err(`features.csv:${r.__line}: ${r.FeatureID} にSpecRef（機能仕様書の節番号）がありません`);
    if (!VALID_SCOPE.includes(r.Scope)) {
      err(`features.csv:${r.__line}: Scope は ${VALID_SCOPE.join(' / ')} のいずれかです: 「${r.Scope}」`);
    }
  }
  for (let i = 1; i <= 23; i++) {
    const id = `F-${String(i).padStart(2, '0')}`;
    if (!seen.has(id)) err(`features.csv: 必須機能 ${id} がありません`);
  }
}

/* ======================================== */
/* screens.csv */
/* ======================================== */

requireColumns('screens.csv', screensCsv.header, ['ScreenID', 'Name', 'Route', 'File', 'Presentation', 'Signature', 'SpecRef']);
{
  const seen = new Set();
  const registeredFiles = new Set();
  for (const r of screensCsv.records) {
    if (!r.ScreenID) { err(`screens.csv:${r.__line}: ScreenIDが空です`); continue; }
    if (seen.has(r.ScreenID)) err(`screens.csv:${r.__line}: ScreenIDが重複しています: ${r.ScreenID}`);
    seen.add(r.ScreenID);
    if (!/^SC-[A-Z0-9-]+$/.test(r.ScreenID)) {
      err(`screens.csv:${r.__line}: ScreenIDは SC- で始まる大文字識別子です: ${r.ScreenID}`);
    }
    if (!r.File) err(`screens.csv:${r.__line}: ${r.ScreenID} にFileがありません`);
    else {
      registeredFiles.add(r.File);
      if (!existsSync(join(REPO_ROOT, r.File))) {
        err(`screens.csv:${r.__line}: Fileが存在しません: ${r.File}`);
      }
    }
    if (!r.Signature) {
      err(`screens.csv:${r.__line}: ${r.ScreenID} にSignature（その画面を一意に識別するロケータ）がありません`);
    }
  }

  /* _layout はナビゲーション定義で画面ではない。同じファイルの表示差は複数行でよい。 */
  const appDir = join(REPO_ROOT, 'apps/mobile/app');
  const routeFiles = walkFiles(appDir)
    .filter((f) => ['.js', '.jsx', '.ts', '.tsx'].includes(extname(f)))
    .filter((f) => !basename(f).startsWith('_layout.'))
    .map((f) => relative(REPO_ROOT, f).split(sep).join('/'));
  for (const f of routeFiles) {
    if (!registeredFiles.has(f)) err(`screens.csv: 画面ルートファイルが未登録です: ${f}`);
  }
}

/* ======================================== */
/* routes.csv */
/* ======================================== */

requireColumns('routes.csv', routes.header,
  ['RouteID', 'Route', 'ScreenID', 'EntryPoint', 'TransitionCondition', 'RequiredState', 'RequiredPermission', 'PatternID', 'TestID', 'Tested']);
const routeIds = new Set();
for (const r of routes.records) {
  if (!r.RouteID) err(`routes.csv:${r.__line}: RouteIDが空です`);
  else {
    if (!/^R-\d{3}$/.test(r.RouteID)) err(`routes.csv:${r.__line}: RouteIDは R-001 形式です: ${r.RouteID}`);
    if (routeIds.has(r.RouteID)) err(`routes.csv:${r.__line}: RouteIDが重複しています: ${r.RouteID}`);
    routeIds.add(r.RouteID);
  }
  if (!r.Route) { err(`routes.csv:${r.__line}: Routeが空です`); continue; }
  if (r.ScreenID && !screenIds.has(r.ScreenID)) {
    err(`routes.csv:${r.__line}: screens.csv に無いScreenIDです: ${r.ScreenID}`);
  }
  if (!r.EntryPoint) err(`routes.csv:${r.__line}: ${r.Route} にEntryPoint（起点）がありません`);
  if (!r.PatternID) err(`routes.csv:${r.__line}: ${r.Route}（起点 ${r.EntryPoint}）にPatternIDが割り当てられていません`);
  for (const p of (r.PatternID || '').split(/[;\s]+/).filter(Boolean)) {
    if (!patternIds.has(p)) err(`routes.csv:${r.__line}: pattern-matrix.csv に無いPatternIDです: ${p}`);
  }
}

/* ======================================== */
/* pattern-matrix.csv */
/* ======================================== */

requireColumns('pattern-matrix.csv', matrix.header, [
  'FeatureID', 'ScreenID', 'ConditionID', 'Condition', 'PatternID',
  'InputState', 'DataState', 'UserState', 'PermissionState', 'SystemState',
  'ExpectedBehavior', 'RelatedRoute', 'Source', 'TestID', 'Covered',
  'Reachability', 'UnreachableReason', 'SpecRef', 'CodeRef',
]);
{
  const seen = new Set();
  for (const r of matrix.records) {
    const at = `pattern-matrix.csv:${r.__line}`;
    if (!r.PatternID) { err(`${at}: PatternIDが空です`); continue; }
    if (seen.has(r.PatternID)) err(`${at}: PatternIDが重複しています: ${r.PatternID}`);
    seen.add(r.PatternID);
    if (!/^P-F\d{2}-(?:\d{3}|[A-Z]\d{2})$/.test(r.PatternID)) {
      err(`${at}: PatternIDは P-F02-001 または P-F02-E01 の形式です: ${r.PatternID}`);
    }

    if (r.FeatureID && !featureIds.has(r.FeatureID)) err(`${at}: features.csv に無いFeatureIDです: ${r.FeatureID}`);
    if (r.ScreenID && !screenIds.has(r.ScreenID)) err(`${at}: screens.csv に無いScreenIDです: ${r.ScreenID}`);
    if (!r.ConditionID) err(`${at}: ${r.PatternID} にConditionIDがありません`);
    else if (!/^C-F\d{2}-[A-Z0-9]{2}$/.test(r.ConditionID)) {
      err(`${at}: ConditionIDの形式が違います（C-F02-01 の形）: ${r.ConditionID}`);
    }
    if (!r.ExpectedBehavior) err(`${at}: ${r.PatternID} にExpectedBehaviorがありません`);

    for (const v of VAGUE) {
      if (r.ExpectedBehavior?.includes(v)) err(`${at}: ${r.PatternID} のExpectedBehaviorが曖昧です（「${v}」）`);
    }

    if (!VALID_REACHABILITY.includes(r.Reachability)) {
      err(`${at}: Reachability は ${VALID_REACHABILITY.join(' / ')} のいずれかです: 「${r.Reachability}」`);
    }
    if (r.Reachability === 'UNREACHABLE' && !r.UnreachableReason) {
      err(`${at}: ${r.PatternID} はUNREACHABLEですが根拠（UnreachableReason）がありません`);
    }
    if (r.Reachability === 'REACHABLE' && !r.TestID) {
      err(`${at}: ${r.PatternID} に TestID が割り当てられていません（未テストPatternは残せません）`);
    }
    for (const s of (r.Source || '').split(/[;\s]+/).filter(Boolean)) {
      if (!VALID_SOURCE.includes(s)) warn(`${at}: 未定義のSourceです: ${s}（推奨: ${VALID_SOURCE.join(' / ')}）`);
    }
    if (!r.Source) err(`${at}: ${r.PatternID} にSource（そのパターンを特定した根拠）がありません`);
  }
}

/* ======================================== */
/* testspec.csv */
/* ======================================== */

requireColumns('testspec.csv', spec.header, [
  'TestID', 'PatternID', 'Category', 'FeatureID', 'ScreenID', 'TestPurpose',
  'Precondition', 'InitialRoute', 'InitialState', 'TestData', 'StepNo',
  'Action', 'Target', 'Input', 'ExpectedResult', 'ExpectedRoute',
  'PostCondition', 'Evidence', 'Cleanup', 'Priority', 'Source',
]);

/* 値をtrimしないので、IDや列挙値に紛れ込んだ空白はここで落とす */
const NO_SPACE_COLUMNS = ['TestID', 'PatternID', 'Category', 'FeatureID', 'ScreenID',
  'StepNo', 'Action', 'ExpectedRoute', 'Priority', 'InitialRoute'];
for (const r of spec.records) {
  for (const c of NO_SPACE_COLUMNS) {
    const v = r[c];
    if (v && v !== v.trim()) {
      err(`testspec.csv:${r.__line}: ${c} の前後に空白があります: 「${v}」`);
    }
  }
}

const byTest = new Map();
for (const r of spec.records) {
  if (!r.TestID) { err(`testspec.csv:${r.__line}: TestIDが空です`); continue; }
  if (!byTest.has(r.TestID)) byTest.set(r.TestID, []);
  byTest.get(r.TestID).push(r);
}

function checkDirectives(text, at, label) {
  if (!text) { err(`${at}: ${label} が空です（前提条件を曖昧にしたまま残せません。無条件なら none と書く）`); return; }
  if (text.trim() === 'none') return;
  for (const part of text.split(';')) {
    const s = part.trim();
    if (!s) continue;
    const eq = s.indexOf('=');
    if (eq < 0) { err(`${at}: ${label} が「key=value」形式ではありません: ${s}`); continue; }
    const k = s.slice(0, eq).trim();
    const v = s.slice(eq + 1).trim();
    if (!PRECONDITION_KEYS.includes(k)) {
      err(`${at}: ${label} に未定義のキーがあります: ${k}（使えるのは ${PRECONDITION_KEYS.join(' / ')}）`);
      continue;
    }
    if (k === 'fixture' && !fixtures.includes(v)) {
      err(`${at}: ${label} のfixtureが存在しません: ${v}（あるのは ${fixtures.join(' / ')}）`);
    }
    if (k === 'plan' && !['free', 'pro', 'clear'].includes(v)) err(`${at}: plan の値が不正です: ${v}`);
    if (k === 'sort' && !['created', 'updated', 'title', 'usage', 'clear'].includes(v)) err(`${at}: sort の値が不正です: ${v}`);
    if (k === 'locale' && !['ja', 'en'].includes(v)) err(`${at}: locale の値が不正です: ${v}`);
    if (k === 'appearance' && !['light', 'dark'].includes(v)) err(`${at}: appearance の値が不正です: ${v}`);
    if (k === 'network' && !['on', 'off'].includes(v)) err(`${at}: network の値が不正です: ${v}`);
    if (k === 'install' && v !== 'fresh') err(`${at}: install の値は fresh だけです: ${v}`);
    if (k === 'launch' && !['yes', 'no'].includes(v)) err(`${at}: launch の値が不正です: ${v}`);
  }
}

const usedPatterns = new Set();

for (const [testId, steps] of byTest) {
  const head = steps[0];
  const at0 = `testspec.csv:${head.__line} (${testId})`;

  if (!/^TC-\d{4}$/.test(testId)) err(`${at0}: TestIDは TC-0001 形式です: ${testId}`);

  const testLevelColumns = [
    'PatternID', 'Category', 'FeatureID', 'ScreenID', 'TestPurpose', 'Precondition',
    'InitialRoute', 'InitialState', 'TestData', 'Priority', 'Source',
  ];
  for (const s of steps.slice(1)) {
    for (const c of testLevelColumns) {
      if (s[c] !== head[c]) {
        err(`testspec.csv:${s.__line} (${testId}): テスト単位の列 ${c} が先頭行と一致しません`);
      }
    }
  }

  if (!head.PatternID) err(`${at0}: PatternIDがありません`);
  for (const p of (head.PatternID || '').split(/[;\s]+/).filter(Boolean)) {
    usedPatterns.add(p);
    if (!patternIds.has(p)) err(`${at0}: pattern-matrix.csv に無いPatternIDです: ${p}`);
  }
  if (head.FeatureID && !featureIds.has(head.FeatureID)) err(`${at0}: features.csv に無いFeatureIDです: ${head.FeatureID}`);
  if (head.ScreenID && !screenIds.has(head.ScreenID)) err(`${at0}: screens.csv に無いScreenIDです: ${head.ScreenID}`);
  if (!head.TestPurpose) err(`${at0}: TestPurpose（何を確かめるテストか）がありません`);
  if (!VALID_CATEGORY.includes(head.Category)) err(`${at0}: Category は ${VALID_CATEGORY.join(' / ')} のいずれかです: 「${head.Category}」`);
  if (!VALID_PRIORITY.includes(head.Priority)) err(`${at0}: Priority は ${VALID_PRIORITY.join(' / ')} のいずれかです: 「${head.Priority}」`);
  if (!head.Source) err(`${at0}: Source（このテストの根拠）がありません`);
  if (head.InitialRoute && !screenIds.has(head.InitialRoute)) {
    err(`${at0}: InitialRoute が screens.csv のScreenIDではありません: ${head.InitialRoute}`);
  }

  checkDirectives(head.Precondition, at0, 'Precondition');

  /* ステップ番号は1から連番。飛びや重複があると実行順が一意に決まらない */
  const nums = steps.map((s) => Number(s.StepNo));
  nums.forEach((n, i) => {
    if (n !== i + 1) err(`${at0}: StepNoが1からの連番になっていません（${nums.join(',')}）`);
  });

  let assertCount = 0;
  for (const s of steps) {
    const at = `testspec.csv:${s.__line} (${testId} Step ${s.StepNo})`;
    const a = ACTIONS[s.Action];
    if (!a) { err(`${at}: 未定義のActionです: ${s.Action}`); continue; }
    if (a.kind === 'assert') assertCount++;

    if (a.target && !s.Target) err(`${at}: ${s.Action} には Target（${a.target}）が必要です`);
    if (a.input && !s.Input) err(`${at}: ${s.Action} には Input（${a.input}）が必要です`);
    if (!a.target && s.Target) warn(`${at}: ${s.Action} は Target を使いません`);

    if (!s.ExpectedResult) err(`${at}: ExpectedResult が空です`);
    for (const v of VAGUE) {
      if (s.ExpectedResult?.includes(v)) err(`${at}: ExpectedResult が曖昧です（「${v}」）`);
    }
    if (s.ExpectedRoute && !screenIds.has(s.ExpectedRoute)) {
      err(`${at}: ExpectedRoute が screens.csv のScreenIDではありません: ${s.ExpectedRoute}`);
    }
    if (s.Action === 'ASSERT_SCREEN' && !screenIds.has(s.Target)) {
      err(`${at}: ASSERT_SCREEN の Target が screens.csv のScreenIDではありません: ${s.Target}`);
    }
    /* Signature は日本語ラベル前提で作ってある。英語表示のまま使うと必ず落ちる */
    if (s.Action === 'ASSERT_SCREEN' && /(^|;)\s*locale\s*=\s*en/.test(head.Precondition || '')) {
      err(`${at}: locale=en のテストで ASSERT_SCREEN は使えません（screens.csv の Signature は日本語ラベル）。英語ラベルの ASSERT_VISIBLE で代替してください`);
    }
    if (s.Action === 'SET_STATE' && !fixtures.includes(s.Target)) {
      err(`${at}: SET_STATE の Target が存在しないfixtureです: ${s.Target}`);
    }
    if (s.Cleanup) checkDirectives(s.Cleanup, at, 'Cleanup');
  }

  if (assertCount === 0) {
    err(`${at0}: 検証ステップ（ASSERT_*）が1つもありません。PASS/FAILを判定できません`);
  }
  if (!steps.some((s) => s.PostCondition)) {
    warn(`${at0}: PostCondition が全ステップで空です`);
  }
}

/* in-scope の機能にパターンが1件も無いのは、単に洗い出していないだけ */
for (const fid of inScopeFeatureIds) {
  if (!matrix.records.some((r) => r.FeatureID === fid)) {
    err(`pattern-matrix.csv: ${fid} のパターンが1件もありません（in-scope の機能は必ず展開すること）`);
  }
}

/* パターンとテストの双方向の突き合わせ */
for (const r of matrix.records) {
  if (r.Reachability !== 'REACHABLE') continue;
  for (const t of (r.TestID || '').split(/[;\s]+/).filter(Boolean)) {
    if (!byTest.has(t)) err(`pattern-matrix.csv:${r.__line}: testspec.csv に無いTestIDです: ${t}`);
  }
}
for (const p of patternIds) {
  const row = matrix.records.find((r) => r.PatternID === p);
  if (row?.Reachability === 'REACHABLE' && !usedPatterns.has(p)) {
    err(`pattern-matrix.csv: ${p} を参照するテストがtestspec.csvにありません（未テストPattern）`);
  }
}

/* routes.csv のTestIDも実在するテストだけを参照する。 */
for (const r of routes.records) {
  for (const t of (r.TestID || '').split(/[;\s]+/).filter(Boolean)) {
    if (!byTest.has(t)) err(`routes.csv:${r.__line}: testspec.csv に無いTestIDです: ${t}`);
  }
}

/* ======================================== */
/* 出力 */
/* ======================================== */

for (const w of warnings) console.log(`WARN  ${w}`);
for (const e of errors) console.log(`ERROR ${e}`);

console.log('');
console.log(`検証対象: ${dir}`);
console.log(`  機能 ${features.records.length} / 画面 ${screenIds.size} / ルート ${routes.records.length} / パターン ${patternIds.size} / テスト ${byTest.size}`);
console.log(`  警告 ${warnings.length} 件 / エラー ${errors.length} 件`);

if (errors.length > 0) {
  console.log('\nエラーが残っている状態を「実行可能な完成版」として扱ってはいけません。');
  process.exit(1);
}
console.log('\n検証に合格しました。');
