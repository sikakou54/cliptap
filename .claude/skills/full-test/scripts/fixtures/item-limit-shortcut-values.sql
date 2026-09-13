-- item-limit-shortcut-values
-- Freeのショートカットの値の上限（1ショートカットあたり2件）の確認用。値が上限ちょうどのものと、上限を超えるものを1件ずつ持つ（§8.24）。
--
-- 内訳（どちらもMainに関連。ショートカット総数2件で、ショートカットの件数上限には当たらない）
--   値2件ショートカット sc_v2（値名A1・値名A2 ／ 値A1・値A2。値の上限ちょうど）
--   値3件ショートカット sc_v3（値名B1〜B3 ／ 値B1〜B3。Pro加入中に登録した想定の上限超過）
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
  ('pf_main', 'Main', 1, 1, 1, 0, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');

INSERT INTO variables (id, name, type, label, icon, valid, sortOrder, createdAt, updatedAt) VALUES
  ('var_client', 'client_name', 'custom', '取引先担当者名', 'person-outline', 1, 0, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');

INSERT INTO snippets (id, title, content, categoryId, copyWithTitle, copyCount, createdAt, updatedAt) VALUES
  ('sn_only', '唯一の定型文', '定型文の本文', 'cat_work', 0, 0, '2026-02-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z');

INSERT INTO shortcuts (id, categoryId, name, sortOrder, createdAt, updatedAt) VALUES
  ('sc_v2', 'cat_work', '値2件ショートカット', 0, '2026-03-01T00:00:01.000Z', '2026-03-01T00:00:01.000Z'),
  ('sc_v3', 'cat_work', '値3件ショートカット', 1, '2026-03-01T00:00:02.000Z', '2026-03-01T00:00:02.000Z');

INSERT INTO shortcut_values (id, shortcutId, name, value, variableId, useCount, sortOrder, createdAt, updatedAt) VALUES
  ('sv_v2_1', 'sc_v2', '値名A1', '値A1', NULL, 0, 0, '2026-03-01T00:00:01.000Z', '2026-03-01T00:00:01.000Z'),
  ('sv_v2_2', 'sc_v2', '値名A2', '値A2', NULL, 0, 1, '2026-03-01T00:00:01.000Z', '2026-03-01T00:00:01.000Z'),
  ('sv_v3_1', 'sc_v3', '値名B1', '値B1', NULL, 0, 0, '2026-03-01T00:00:02.000Z', '2026-03-01T00:00:02.000Z'),
  ('sv_v3_2', 'sc_v3', '値名B2', '値B2', NULL, 0, 1, '2026-03-01T00:00:02.000Z', '2026-03-01T00:00:02.000Z'),
  ('sv_v3_3', 'sc_v3', '値名B3', '値B3', NULL, 0, 2, '2026-03-01T00:00:02.000Z', '2026-03-01T00:00:02.000Z');

INSERT INTO shortcut_profiles (shortcutId, profileId) VALUES
  ('sc_v2', 'pf_main'),
  ('sc_v3', 'pf_main');
