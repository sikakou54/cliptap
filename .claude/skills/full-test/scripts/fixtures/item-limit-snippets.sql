-- item-limit-snippets
-- Free定型文上限ちょうど（全プロファイル合計50件）。Mainの一覧に出るのは10件で、残り40件は別プロファイルにだけ関連する（§8.2 / §8.18）。
--
-- 内訳（件数はすべて保存済み総数に含まれる）
--   全プロファイル向け 5件 sn_all_01〜05（関連0件。Mainの一覧に出る）
--   Mainだけ           5件 sn_main_01〜05（Mainの一覧に出る）
--   A社用だけ         30件 sn_a_01〜30
--   B社用だけ          5件 sn_b_01〜05（B社用を削除すると全プロファイル向けへ戻る確認に使う）
--   C社用だけ          5件 sn_c_01〜05（C社用は valid=0。無効なプロファイルにだけ関連する定型文も数える確認に使う）
-- ショートカットは0件。

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

-- 定型文とカスタム変数の両方が0件だと __DEV__ ビルドがテストデータを再投入するため、1件置く
INSERT INTO variables (id, name, type, label, icon, valid, sortOrder, createdAt, updatedAt) VALUES
  ('var_client', 'client_name', 'custom', '取引先担当者名', 'person-outline', 1, 0, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');

WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 5)
INSERT INTO snippets (id, title, content, categoryId, copyWithTitle, copyCount, createdAt, updatedAt)
SELECT 'sn_all_' || printf('%02d', n), '全体定型文' || printf('%02d', n), '全体本文' || printf('%02d', n), 'cat_work', 0, 0,
       '2026-02-01T00:00:' || printf('%02d', n) || '.000Z', '2026-02-01T00:00:' || printf('%02d', n) || '.000Z'
FROM seq;

WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 5)
INSERT INTO snippets (id, title, content, categoryId, copyWithTitle, copyCount, createdAt, updatedAt)
SELECT 'sn_main_' || printf('%02d', n), 'Main定型文' || printf('%02d', n), 'Main本文' || printf('%02d', n), 'cat_work', 0, 0,
       '2026-02-02T00:00:' || printf('%02d', n) || '.000Z', '2026-02-02T00:00:' || printf('%02d', n) || '.000Z'
FROM seq;

WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 30)
INSERT INTO snippets (id, title, content, categoryId, copyWithTitle, copyCount, createdAt, updatedAt)
SELECT 'sn_a_' || printf('%02d', n), 'A社定型文' || printf('%02d', n), 'A社本文' || printf('%02d', n), 'cat_work', 0, 0,
       '2026-02-03T00:00:' || printf('%02d', n) || '.000Z', '2026-02-03T00:00:' || printf('%02d', n) || '.000Z'
FROM seq;

WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 5)
INSERT INTO snippets (id, title, content, categoryId, copyWithTitle, copyCount, createdAt, updatedAt)
SELECT 'sn_b_' || printf('%02d', n), 'B社定型文' || printf('%02d', n), 'B社本文' || printf('%02d', n), 'cat_work', 0, 0,
       '2026-02-04T00:00:' || printf('%02d', n) || '.000Z', '2026-02-04T00:00:' || printf('%02d', n) || '.000Z'
FROM seq;

WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 5)
INSERT INTO snippets (id, title, content, categoryId, copyWithTitle, copyCount, createdAt, updatedAt)
SELECT 'sn_c_' || printf('%02d', n), 'C社定型文' || printf('%02d', n), 'C社本文' || printf('%02d', n), 'cat_work', 0, 0,
       '2026-02-05T00:00:' || printf('%02d', n) || '.000Z', '2026-02-05T00:00:' || printf('%02d', n) || '.000Z'
FROM seq;

-- LIKE の _ は任意の1文字に一致し 'sn_a_%' が sn_all_ まで拾うため、_ を文字どおり扱う GLOB で絞る
INSERT INTO snippet_profiles (snippetId, profileId)
SELECT id, 'pf_main' FROM snippets WHERE id GLOB 'sn_main_*';
INSERT INTO snippet_profiles (snippetId, profileId)
SELECT id, 'pf_a' FROM snippets WHERE id GLOB 'sn_a_*';
INSERT INTO snippet_profiles (snippetId, profileId)
SELECT id, 'pf_b' FROM snippets WHERE id GLOB 'sn_b_*';
INSERT INTO snippet_profiles (snippetId, profileId)
SELECT id, 'pf_c' FROM snippets WHERE id GLOB 'sn_c_*';
