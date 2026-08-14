-- Track whether the category was auto-classified by the app vs explicitly set by the user.
-- Run ONCE in Supabase SQL Editor before deploying the new shopping add flow.
--
-- - Default is false (treated as user-classified).
-- - Existing items in the catch-all "כללי" are flagged as auto-classified so they
--   surface in the new "חלוקה" panel for the user to triage.

ALTER TABLE shopping_list
  ADD COLUMN IF NOT EXISTS category_auto BOOLEAN DEFAULT false;

UPDATE shopping_list
SET category_auto = true
WHERE (category IS NULL OR category = 'כללי')
  AND category_auto = false;
