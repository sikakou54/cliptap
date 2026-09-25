-- shortcut-preview
-- ショートカット作成・編集画面のプレビュー、候補プロファイル、空値、無効変数の確認用。

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
  ('pf_main', 'Main', 1, 1, 1, 0, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('pf_a', 'A社用', 0, 0, 1, 1, '2026-01-01T00:00:01.000Z', '2026-01-01T00:00:01.000Z'),
  ('pf_b', 'B社用', 0, 0, 1, 2, '2026-01-01T00:00:02.000Z', '2026-01-01T00:00:02.000Z'),
  ('pf_c', 'C社用', 0, 0, 0, 3, '2026-01-01T00:00:03.000Z', '2026-01-01T00:00:03.000Z');

INSERT INTO variables (id, name, type, label, icon, valid, sortOrder, createdAt, updatedAt) VALUES
  ('var_company', 'company', 'custom', '会社', 'business-outline', 1, 0, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('var_two', 'var_two', 'custom', '変数2', NULL, 1, 1, '2026-01-01T00:00:01.000Z', '2026-01-01T00:00:01.000Z'),
  ('var_three', 'var_three', 'custom', '変数3', NULL, 1, 2, '2026-01-01T00:00:02.000Z', '2026-01-01T00:00:02.000Z'),
  ('var_four', 'var_four', 'custom', '変数4', NULL, 1, 3, '2026-01-01T00:00:03.000Z', '2026-01-01T00:00:03.000Z'),
  ('var_five', 'var_five', 'custom', '変数5', NULL, 1, 4, '2026-01-01T00:00:04.000Z', '2026-01-01T00:00:04.000Z'),
  ('var_six', 'var_six', 'custom', '変数6', NULL, 0, 5, '2026-01-01T00:00:05.000Z', '2026-01-01T00:00:05.000Z');

INSERT INTO profile_variables (id, profileId, variableId, value, createdAt, updatedAt) VALUES
  ('pv_main_company', 'pf_main', 'var_company', 'Main株式会社', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('pv_a_company', 'pf_a', 'var_company', 'A株式会社', '2026-01-01T00:00:01.000Z', '2026-01-01T00:00:01.000Z'),
  ('pv_b_company', 'pf_b', 'var_company', 'B株式会社', '2026-01-01T00:00:02.000Z', '2026-01-01T00:00:02.000Z'),
  ('pv_c_company', 'pf_c', 'var_company', 'C株式会社', '2026-01-01T00:00:03.000Z', '2026-01-01T00:00:03.000Z');

INSERT INTO snippets (id, title, content, categoryId, copyWithTitle, copyCount, createdAt, updatedAt) VALUES
  ('sn_only', '唯一の定型文', '定型文の本文', 'cat_work', 0, 0, '2026-02-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z');

INSERT INTO shortcuts (id, categoryId, name, sortOrder, createdAt, updatedAt) VALUES
  ('sc_pv', 'cat_work', 'プレビュー確認', 0, '2026-03-01T00:00:00.000Z', '2026-03-01T00:00:00.000Z');

INSERT INTO shortcut_values (id, shortcutId, name, value, variableId, useCount, sortOrder, createdAt, updatedAt) VALUES
  ('sv_pv_company', 'sc_pv', '会社', '{{company}}', NULL, 7, 0, '2026-03-01T00:00:00.000Z', '2026-03-01T00:00:00.000Z'),
  ('sv_pv_today', 'sc_pv', '日付', '{{today}}', NULL, 3, 1, '2026-03-01T00:00:01.000Z', '2026-03-01T00:00:01.000Z'),
  ('sv_pv_empty', 'sc_pv', '空の値', '', NULL, 0, 2, '2026-03-01T00:00:02.000Z', '2026-03-01T00:00:02.000Z'),
  ('sv_pv_invalid', 'sc_pv', '無効な変数', '{{var_six}}', NULL, 0, 3, '2026-03-01T00:00:03.000Z', '2026-03-01T00:00:03.000Z');

-- 関連を作らず、全プロファイル向けにする。
