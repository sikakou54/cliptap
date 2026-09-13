-- item-limit-shortcuts-60
-- Freeショートカット上限を超えて保持（60件。すべてアクティブなMainに関連）。上限超過分も使えることを確認する（§8.24 / §8.18）。
--
-- 内訳
--   Mainだけ 60件 sc_60_01〜60。名前 ショートカット01〜60、値名 値名01〜60、値 値01〜60（値は各1件）
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

WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 60)
INSERT INTO shortcuts (id, categoryId, name, sortOrder, createdAt, updatedAt)
SELECT 'sc_60_' || printf('%02d', n), 'cat_work', 'ショートカット' || printf('%02d', n), n - 1,
       '2026-03-01T00:' || printf('%02d', n / 60) || ':' || printf('%02d', n % 60) || '.000Z',
       '2026-03-01T00:' || printf('%02d', n / 60) || ':' || printf('%02d', n % 60) || '.000Z'
FROM seq;

WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 60)
INSERT INTO shortcut_values (id, shortcutId, name, value, variableId, useCount, sortOrder, createdAt, updatedAt)
SELECT 'sv_60_' || printf('%02d', n), 'sc_60_' || printf('%02d', n), '値名' || printf('%02d', n), '値' || printf('%02d', n), NULL, 0, 0,
       '2026-03-01T00:00:00.000Z', '2026-03-01T00:00:00.000Z'
FROM seq;

INSERT INTO shortcut_profiles (shortcutId, profileId)
SELECT id, 'pf_main' FROM shortcuts;
