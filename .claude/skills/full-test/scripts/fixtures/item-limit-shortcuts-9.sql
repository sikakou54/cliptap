-- item-limit-shortcuts-9
-- Freeショートカット上限の1件手前（9件）。関連は計13件あり、関連の数ではなく行数で数えることを確認する（§8.24）。
--
-- 内訳（各ショートカットは値を1件持つ）
--   3プロファイルに関連 3件 sc_three_01〜03（Main・A社用・B社用。関連9件）
--   全プロファイル向け  2件 sc_all_01〜02（関連0件）
--   A社用だけ           4件 sc_one_01〜04（関連4件）
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

INSERT INTO profiles (id, name, isActive, isDefault, valid, sortOrder, createdAt, updatedAt) VALUES
  ('pf_main', 'Main',  1, 1, 1, 0, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('pf_a',    'A社用', 0, 0, 1, 1, '2026-01-01T00:00:01.000Z', '2026-01-01T00:00:01.000Z'),
  ('pf_b',    'B社用', 0, 0, 1, 2, '2026-01-01T00:00:02.000Z', '2026-01-01T00:00:02.000Z');

INSERT INTO variables (id, name, type, label, icon, valid, sortOrder, createdAt, updatedAt) VALUES
  ('var_client', 'client_name', 'custom', '取引先担当者名', 'person-outline', 1, 0, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');

INSERT INTO snippets (id, title, content, categoryId, copyWithTitle, copyCount, createdAt, updatedAt) VALUES
  ('sn_only', '唯一の定型文', '定型文の本文', 'cat_work', 0, 0, '2026-02-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z');

INSERT INTO shortcuts (id, categoryId, name, sortOrder, createdAt, updatedAt) VALUES
  ('sc_three_01', 'cat_work', '三つ関連ショートカット01', 0, '2026-03-01T00:00:01.000Z', '2026-03-01T00:00:01.000Z'),
  ('sc_three_02', 'cat_work', '三つ関連ショートカット02', 1, '2026-03-01T00:00:02.000Z', '2026-03-01T00:00:02.000Z'),
  ('sc_three_03', 'cat_work', '三つ関連ショートカット03', 2, '2026-03-01T00:00:03.000Z', '2026-03-01T00:00:03.000Z'),
  ('sc_all_01',   'cat_work', '全体ショートカット01',     3, '2026-03-02T00:00:01.000Z', '2026-03-02T00:00:01.000Z'),
  ('sc_all_02',   'cat_work', '全体ショートカット02',     4, '2026-03-02T00:00:02.000Z', '2026-03-02T00:00:02.000Z'),
  ('sc_one_01',   'cat_work', 'A社ショートカット01',      5, '2026-03-03T00:00:01.000Z', '2026-03-03T00:00:01.000Z'),
  ('sc_one_02',   'cat_work', 'A社ショートカット02',      6, '2026-03-03T00:00:02.000Z', '2026-03-03T00:00:02.000Z'),
  ('sc_one_03',   'cat_work', 'A社ショートカット03',      7, '2026-03-03T00:00:03.000Z', '2026-03-03T00:00:03.000Z'),
  ('sc_one_04',   'cat_work', 'A社ショートカット04',      8, '2026-03-03T00:00:04.000Z', '2026-03-03T00:00:04.000Z');

INSERT INTO shortcut_values (id, shortcutId, name, value, variableId, useCount, sortOrder, createdAt, updatedAt)
SELECT 'sv_' || substr(id, 4), id, '値名' || substr(id, 4), '値' || substr(id, 4), NULL, 0, 0, createdAt, updatedAt
FROM shortcuts;

INSERT INTO shortcut_profiles (shortcutId, profileId) VALUES
  ('sc_three_01', 'pf_main'), ('sc_three_01', 'pf_a'), ('sc_three_01', 'pf_b'),
  ('sc_three_02', 'pf_main'), ('sc_three_02', 'pf_a'), ('sc_three_02', 'pf_b'),
  ('sc_three_03', 'pf_main'), ('sc_three_03', 'pf_a'), ('sc_three_03', 'pf_b'),
  ('sc_one_01',   'pf_a'),
  ('sc_one_02',   'pf_a'),
  ('sc_one_03',   'pf_a'),
  ('sc_one_04',   'pf_a');
