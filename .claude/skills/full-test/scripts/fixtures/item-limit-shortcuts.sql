-- item-limit-shortcuts
-- Freeショートカット上限ちょうど（全プロファイル合計10件）。Mainの一覧に出るのは4件で、残り6件は別プロファイルにだけ関連する（§8.24 / §8.18）。
--
-- 内訳（件数はすべて保存済み総数に含まれる。各ショートカットは値を1件持つ）
--   全プロファイル向け 2件 sc_all_01〜02（関連0件。Mainの一覧に出る）
--   Mainだけ           2件 sc_main_01〜02（Mainの一覧に出る）
--   A社用だけ          2件 sc_a_01〜02
--   B社用だけ          2件 sc_b_01〜02（B社用を削除すると値ごと削除される確認に使う）
--   C社用だけ          2件 sc_c_01〜02（C社用は valid=0。無効なプロファイルにだけ関連するショートカットも数える確認に使う）
-- 定型文は1件（__DEV__ ビルドの再投入を避けるため）。

PRAGMA foreign_keys = ON;

DELETE FROM shortcut_values;
DELETE FROM shortcut_profiles;
DELETE FROM shortcuts;
DELETE FROM snippet_profiles;
DELETE FROM profile_variables;
DELETE FROM snippets;
DELETE FROM variables;
DELETE FROM categories;
DELETE FROM profiles;
DELETE FROM system_variable_formats;

INSERT INTO categories (id, name, color, sortOrder, createdAt) VALUES
  ('cat_work', '仕事', '#3B82F6', 0, '2026-01-01T00:00:00.000Z');

-- Freeの判定順（標準優先 → sortOrder）で上位3件が有効。C社用は無効。
INSERT INTO profiles (id, name, isActive, isDefault, valid, sortOrder, createdAt, updatedAt) VALUES
  ('pf_main', 'Main',  1, 1, 1, 0, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('pf_a',    'A社用', 0, 0, 1, 1, '2026-01-01T00:00:01.000Z', '2026-01-01T00:00:01.000Z'),
  ('pf_b',    'B社用', 0, 0, 1, 2, '2026-01-01T00:00:02.000Z', '2026-01-01T00:00:02.000Z'),
  ('pf_c',    'C社用', 0, 0, 0, 3, '2026-01-01T00:00:03.000Z', '2026-01-01T00:00:03.000Z');

INSERT INTO variables (id, name, type, label, icon, valid, sortOrder, createdAt, updatedAt) VALUES
  ('var_client', 'client_name', 'custom', '取引先担当者名', 'person-outline', 1, 0, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');

INSERT INTO snippets (id, title, content, categoryId, copyWithTitle, copyCount, createdAt, updatedAt) VALUES
  ('sn_only', '唯一の定型文', '定型文の本文', 'cat_work', 0, 0, '2026-02-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z');

-- グループごとに名前・並び順・日時をずらして固定する（sortOrderはプロファイルを横断した通し番号）
INSERT INTO shortcuts (id, categoryId, name, sortOrder, createdAt, updatedAt) VALUES
  ('sc_all_01',  'cat_work', '全体ショートカット01',  0, '2026-03-01T00:00:01.000Z', '2026-03-01T00:00:01.000Z'),
  ('sc_all_02',  'cat_work', '全体ショートカット02',  1, '2026-03-01T00:00:02.000Z', '2026-03-01T00:00:02.000Z'),
  ('sc_main_01', 'cat_work', 'Mainショートカット01', 2, '2026-03-02T00:00:01.000Z', '2026-03-02T00:00:01.000Z'),
  ('sc_main_02', 'cat_work', 'Mainショートカット02', 3, '2026-03-02T00:00:02.000Z', '2026-03-02T00:00:02.000Z'),
  ('sc_a_01',    'cat_work', 'A社ショートカット01',  4, '2026-03-03T00:00:01.000Z', '2026-03-03T00:00:01.000Z'),
  ('sc_a_02',    'cat_work', 'A社ショートカット02',  5, '2026-03-03T00:00:02.000Z', '2026-03-03T00:00:02.000Z'),
  ('sc_b_01',    'cat_work', 'B社ショートカット01',  6, '2026-03-04T00:00:01.000Z', '2026-03-04T00:00:01.000Z'),
  ('sc_b_02',    'cat_work', 'B社ショートカット02',  7, '2026-03-04T00:00:02.000Z', '2026-03-04T00:00:02.000Z'),
  ('sc_c_01',    'cat_work', 'C社ショートカット01',  8, '2026-03-05T00:00:01.000Z', '2026-03-05T00:00:01.000Z'),
  ('sc_c_02',    'cat_work', 'C社ショートカット02',  9, '2026-03-05T00:00:02.000Z', '2026-03-05T00:00:02.000Z');

-- 値はショートカットごとに1件。値名はショートカットIDの末尾から作り、画面上で一意にする
INSERT INTO shortcut_values (id, shortcutId, name, value, variableId, useCount, sortOrder, createdAt, updatedAt)
SELECT 'sv_' || substr(id, 4), id, '値名' || substr(id, 4), '値' || substr(id, 4), NULL, 0, 0, createdAt, updatedAt
FROM shortcuts;

INSERT INTO shortcut_profiles (shortcutId, profileId) VALUES
  ('sc_main_01', 'pf_main'),
  ('sc_main_02', 'pf_main'),
  ('sc_a_01',    'pf_a'),
  ('sc_a_02',    'pf_a'),
  ('sc_b_01',    'pf_b'),
  ('sc_b_02',    'pf_b'),
  ('sc_c_01',    'pf_c'),
  ('sc_c_02',    'pf_c');
