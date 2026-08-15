-- ============================================================
-- הרצה אחת מסודרת — כל המיגרציות החסרות, בסדר הנכון
--
-- נוצר אחרי שהתברר שטבלת shopping_templates לא קיימת במסד,
-- ולכן אף אחת מהמיגרציות הבאות עוד לא רצה. בטוח להרצה כעת.
--
-- הסדר קריטי: חלק 1 יוצר את הטבלאות שחלק 2 משנה.
-- להריץ פעם אחת בלבד.
-- ============================================================


-- ############################################################
-- חלק 1 מתוך 4 — טבלאות הרשימות היעודיות + סושי ולחמניות
-- ############################################################

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


-- ############################################################
-- חלק 2 מתוך 4 — עמודת קטגוריה לפריטי רשימה + פסטיבלים וקמפינג
-- ############################################################

-- Camping & festivals template + per-item categories for templates.
-- Run ONCE in Supabase SQL Editor.
--
-- 1) Adds a category column to shopping_template_items (templates can now
--    file each item into a category; the app uses it on bulk-add).
-- 2) Seeds the "פסטיבלים וקמפינג" template with 70 categorized items.

ALTER TABLE shopping_template_items
  ADD COLUMN IF NOT EXISTS category TEXT;

WITH t AS (
  INSERT INTO shopping_templates (name, household_id)
  VALUES ('פסטיבלים וקמפינג', '92e1a987-99b7-41ec-93fb-ae2ada2bcf72')
  RETURNING id
)
INSERT INTO shopping_template_items (template_id, item_name, category, sort_order)
SELECT t.id, v.name, v.cat, v.ord
FROM t,
(VALUES
  -- ⛺ לינה
  ('⛺ אוהל',                       '⛺ לינה',            1),
  ('💤 שקי שינה',                   '⛺ לינה',            2),
  ('🛏️ מזרנים',                     '⛺ לינה',            3),
  ('🛏️ סדין',                       '⛺ לינה',            4),
  ('🛌 שמיכה דקה להתכסות',          '⛺ לינה',            5),
  ('🧸 שמיכות לילד',                '⛺ לינה',            6),
  -- 🪑 מחנה וריהוט
  ('🧺 מחצלת או משהו לפרוס',        '🪑 מחנה וריהוט',     7),
  ('🧺 מחצלת',                      '🪑 מחנה וריהוט',     8),
  ('🪑 כסאות',                      '🪑 מחנה וריהוט',     9),
  ('🍽️ שולחן',                      '🪑 מחנה וריהוט',    10),
  ('🛒 עגלת קמפינג',                '🪑 מחנה וריהוט',    11),
  -- 💡 תאורה וחשמל
  ('💡 אורות',                      '💡 תאורה וחשמל',    12),
  ('🔦 פנסים',                      '💡 תאורה וחשמל',    13),
  ('🔋 מטען נייד',                  '💡 תאורה וחשמל',    14),
  ('🌀 מאוורר',                     '💡 תאורה וחשמל',    15),
  ('🔌 כבלים למאוורר ולהכל',        '💡 תאורה וחשמל',    16),
  -- 🔥 מנגל ובישול
  ('🥩 צלייה',                      '🔥 מנגל ובישול',    17),
  ('🍖 מנגל',                       '🔥 מנגל ובישול',    18),
  ('♨️ כירה',                       '🔥 מנגל ובישול',    19),
  ('⚫ פחמים',                      '🔥 מנגל ובישול',    20),
  ('🔥 מצית',                       '🔥 מנגל ובישול',    21),
  ('🎇 גפרורים',                    '🔥 מנגל ובישול',    22),
  ('🍲 סיר',                        '🔥 מנגל ובישול',    23),
  ('🍳 מחבת',                       '🔥 מנגל ובישול',    24),
  ('🪭 נפנף',                       '🔥 מנגל ובישול',    25),
  ('❄️ קרחומים',                    '🔥 מנגל ובישול',    26),
  -- 🍽️ מטבח ושונות
  ('🧻 נייר סופג',                  '🍽️ מטבח ושונות',    27),
  ('🧻 מגבונים',                    '🍽️ מטבח ושונות',    28),
  ('🚽 נייר טואלט',                 '🍽️ מטבח ושונות',    29),
  ('💧 בקבוקי מים',                 '🍽️ מטבח ושונות',    30),
  -- 👕 בגדים
  ('🩲 תחתונים',                    '👕 בגדים',          31),
  ('🧦 גרביים',                     '👕 בגדים',          32),
  ('👕 חולצות',                     '👕 בגדים',          33),
  ('🎽 גופיות',                     '👕 בגדים',          34),
  ('👖 מכנסיים',                    '👕 בגדים',          35),
  ('🩱 בגד ים',                     '👕 בגדים',          36),
  ('👙 חזיות',                      '👕 בגדים',          37),
  ('🛌 פיג׳מה',                     '👕 בגדים',          38),
  ('🧒 בגדים לילד',                 '👕 בגדים',          39),
  ('🧢 כובעים',                     '👕 בגדים',          40),
  ('🕶️ משקפי שמש',                  '👕 בגדים',          41),
  -- 🧼 רחצה
  ('🧖 מגבת',                       '🧼 רחצה',           42),
  ('🧴 שמפו ומרכך',                 '🧼 רחצה',           43),
  ('🪥 משחה ומברשת שיניים',         '🧼 רחצה',           44),
  ('🧼 סבון',                       '🧼 רחצה',           45),
  ('🪮 מסרק',                       '🧼 רחצה',           46),
  ('➰ גומיה לשיער',                '🧼 רחצה',           47),
  -- 👟 הנעלה
  ('🩴 כפכפים',                     '👟 הנעלה',          48),
  ('👡 סנדלי שורש',                 '👟 הנעלה',          49),
  -- 👶 תינוק
  ('👶 לול לפוצוניאו',              '👶 תינוק',          50),
  ('🥛 מטרנה',                      '👶 תינוק',          51),
  ('🍼 בקבוקים',                    '👶 תינוק',          52),
  ('⭕ מוצצים',                     '👶 תינוק',          53),
  ('🎀 שרוך למוצץ',                 '👶 תינוק',          54),
  ('🎒 מנשא',                       '👶 תינוק',          55),
  ('👶 חיתולים',                    '👶 תינוק',          56),
  ('🧴 משחה לחיתולים',              '👶 תינוק',          57),
  ('🛍️ שקיות חיתולים',              '👶 תינוק',          58),
  ('🧢 כובע לילד',                  '👶 תינוק',          59),
  ('🍪 נשנושים לילד',               '👶 תינוק',          60),
  ('🥄 סינר',                       '👶 תינוק',          61),
  ('🧸 צעצועים',                    '👶 תינוק',          62),
  -- 💊 בריאות
  ('💊 כדורים',                     '💊 בריאות',         63),
  ('🩹 פלסטרים',                    '💊 בריאות',         64),
  ('💊 נובימול',                    '💊 בריאות',         65),
  ('☀️ קרם הגנה',                   '💊 בריאות',         66),
  ('🧸 אלתוש',                      '💊 בריאות',         67),
  ('🦻 אטמים',                      '💊 בריאות',         68),
  -- 🎲 משחקים
  ('🎲 שש-בש',                      '🎲 משחקים',         69),
  ('🃏 קלפים',                      '🎲 משחקים',         70)
) AS v(name, cat, ord);


-- ############################################################
-- חלק 3 מתוך 4 — סימון סיווג אוטומטי ברשימת הקניות
-- ############################################################

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


-- ############################################################
-- חלק 4 מתוך 4 — תלות בין משימות
-- ############################################################

-- Add task dependency column.
-- Run this once in the Supabase SQL editor before using the new dependency feature.

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS depends_on_task_id UUID
    REFERENCES tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tasks_depends_on_task_id_idx ON tasks(depends_on_task_id);
