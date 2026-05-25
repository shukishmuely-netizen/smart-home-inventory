-- Reusable "named" shopping lists (templates).
-- Each template has a name and an ordered list of item names.
-- Clicking a template in the app pushes all its items into shopping_list.
--
-- Run ONCE in Supabase SQL Editor before deploying the feature.

CREATE TABLE IF NOT EXISTS shopping_templates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  household_id UUID,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shopping_template_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES shopping_templates(id) ON DELETE CASCADE,
  item_name   TEXT NOT NULL,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shopping_template_items_template_id_idx
  ON shopping_template_items(template_id);

-- Seed two initial templates.
WITH t AS (
  INSERT INTO shopping_templates (name, household_id)
  VALUES ('סושי', '92e1a987-99b7-41ec-93fb-ae2ada2bcf72')
  RETURNING id
)
INSERT INTO shopping_template_items (template_id, item_name, sort_order)
SELECT t.id, v.name, v.ord
FROM t,
(VALUES
  ('🍚 אורז',     1),
  ('🥑 אבוקדו',   2),
  ('🌿 אצות',     3),
  ('🌰 שומשום',   4),
  ('🥒 מלפפון',   5),
  ('🫑 גמבה',     6),
  ('🥚 ביצים',    7),
  ('🥕 גזר',      8),
  ('🐟 דג',       9)
) AS v(name, ord);

WITH t AS (
  INSERT INTO shopping_templates (name, household_id)
  VALUES ('לחמניות ללג', '92e1a987-99b7-41ec-93fb-ae2ada2bcf72')
  RETURNING id
)
INSERT INTO shopping_template_items (template_id, item_name, sort_order)
SELECT t.id, v.name, v.ord
FROM t,
(VALUES
  ('🌾 קמח מולינו',                  1),
  ('🌰 שומשום',                      2),
  ('🟣 פרג',                         3),
  ('🍞 שמרים (כ-30 לקילו)',         4),
  ('🥚 ביצים (5 לקילו)',            5),
  ('🥛 יוגורט חלבון (400 לקילו)',   6)
) AS v(name, ord);
