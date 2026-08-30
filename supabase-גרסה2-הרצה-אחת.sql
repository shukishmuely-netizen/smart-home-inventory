-- ============================================================
-- גרסה 2 — הרצה אחת מסודרת
-- חלק 1: סכימת בסיס (משלים טבלאות/אינדקסים/הרשאות חסרים)
-- חלק 2: תיקוני גרסה 2
-- בטוח להרצה חוזרת. לא מוחק שום נתון.
-- ============================================================

-- ##### חלק 1 מתוך 2 #####
-- ============================================================
-- סכימת בסיס — תיעוד כל הטבלאות שהאפליקציה צריכה
--
-- הטבלאות הליבה (מלאי, קניות, משימות, קטגוריות) נוצרו בעבר
-- ידנית בדאשבורד ולכן לא היה להן קובץ מיגרציה בכלל. הקובץ הזה
-- סוגר את הפער: הוא מתאר את המצב הקיים, ומאפשר לשחזר את המסד
-- מאפס אם יידרש.
--
-- בטוח להרצה על מסד קיים — הכל IF NOT EXISTS ולא נוגע בנתונים.
-- ============================================================

CREATE TABLE IF NOT EXISTS inventory_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name    TEXT NOT NULL,
  quantity     INTEGER DEFAULT 0,
  category     TEXT DEFAULT 'כללי',
  location     TEXT DEFAULT 'מזווה',
  household_id UUID,
  updated_at   TIMESTAMPTZ DEFAULT now(),
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shopping_list (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name     TEXT NOT NULL,
  category      TEXT DEFAULT 'כללי',
  category_auto BOOLEAN DEFAULT false,
  household_id  UUID,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS category_order (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_name TEXT NOT NULL,
  sort_order    INTEGER DEFAULT 99,
  household_id  UUID
);

CREATE TABLE IF NOT EXISTS tasks (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title              TEXT NOT NULL,
  description        TEXT,
  urgency            TEXT DEFAULT 'סטנדרטית',
  assignee           TEXT DEFAULT 'כולם',
  target_date        DATE,
  status             TEXT DEFAULT 'לא התחלתי',
  depends_on_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  household_id       UUID,
  created_at         TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS equipment_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_type    TEXT NOT NULL,
  category     TEXT DEFAULT 'ציוד נוסף',
  item_name    TEXT NOT NULL,
  is_packed    BOOLEAN DEFAULT false,
  household_id UUID,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS equipment_sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_type      TEXT NOT NULL,
  last_pack_date DATE,
  household_id   UUID
);

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
  category    TEXT,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shopping_history (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name    TEXT NOT NULL,
  household_id UUID,
  last_used    TIMESTAMPTZ DEFAULT now()
);

-- אינדקסים
CREATE INDEX  IF NOT EXISTS inventory_items_category_idx      ON inventory_items (category);
CREATE INDEX  IF NOT EXISTS shopping_list_category_idx        ON shopping_list (category);
CREATE INDEX  IF NOT EXISTS tasks_depends_on_task_id_idx      ON tasks (depends_on_task_id);
CREATE INDEX  IF NOT EXISTS equipment_items_list_type_idx     ON equipment_items (list_type);
CREATE INDEX  IF NOT EXISTS shopping_template_items_tpl_idx   ON shopping_template_items (template_id);
CREATE UNIQUE INDEX IF NOT EXISTS shopping_history_name_uniq  ON shopping_history (lower(item_name));
CREATE INDEX  IF NOT EXISTS shopping_history_name_idx         ON shopping_history (item_name);
CREATE UNIQUE INDEX IF NOT EXISTS equipment_sessions_uniq     ON equipment_sessions (list_type, household_id);

-- הרשאות: כל הטבלאות נגישות לתפקידים שהאפליקציה משתמשת בהם
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'inventory_items','shopping_list','category_order','tasks',
    'equipment_items','equipment_sessions','shopping_templates',
    'shopping_template_items','shopping_history'
  ] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO anon, authenticated', t);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

-- ##### חלק 2 מתוך 2 #####
-- ============================================================
-- תיקוני מסד לגרסה 2 — נגזר מממצאי מועצת הביקורת
-- קריאה בלבד היכן שאין מה לתקן. בטוח להרצה חוזרת.
-- ============================================================

-- ------------------------------------------------------------
-- 1) עגלת קמפינג: הסמל הנכון הוא עגלת תינוק ולא עגלת סופר
-- ------------------------------------------------------------
UPDATE equipment_items
SET item_name = '🚼 עגלת קמפינג'
WHERE item_name IN ('🛒 עגלת קמפינג', 'עגלת קמפינג');

UPDATE shopping_template_items
SET item_name = '🚼 עגלת קמפינג'
WHERE item_name IN ('🛒 עגלת קמפינג', 'עגלת קמפינג');


-- ------------------------------------------------------------
-- 2) אינדקס נוסף על שם המוצר בהיסטוריה.
--    האינדקס הקיים הוא על lower(item_name), ולכן אי אפשר לכתוב
--    עליו upsert לפי שם. האפליקציה כבר לא נשענת על upsert,
--    אבל אינדקס ישיר עוזר לחיפושים ולעתיד.
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS shopping_history_name_idx
  ON shopping_history (item_name);


-- ------------------------------------------------------------
-- 3) ברירת מחדל מפורשת לעמודת הסיווג האוטומטי,
--    כדי ששורות שנכתבות בלי הערך לא יישארו NULL
-- ------------------------------------------------------------
ALTER TABLE shopping_list
  ALTER COLUMN category_auto SET DEFAULT false;

UPDATE shopping_list SET category_auto = false WHERE category_auto IS NULL;


-- ------------------------------------------------------------
-- 4) פריטים שנשארו תקועים על סיווג לא ידוע.
--    האפליקציה מציגה אותם ככרטיסי סיווג; מי שלא סווג ידנית
--    במשך הזמן עובר ל"כללי" כדי שלא ייעלם מהמלאי.
--    להריץ רק אם רוצים לנקות אותם עכשיו.
-- ------------------------------------------------------------
-- UPDATE inventory_items SET category = 'כללי'
-- WHERE category IN ('uncertain', 'לא ידוע');


-- ============================================================
-- אימות
-- ============================================================
SELECT 'עגלת קמפינג' AS "בדיקה",
       COUNT(*) FILTER (WHERE item_name LIKE '🚼%') AS "מתוקן",
       COUNT(*) FILTER (WHERE item_name LIKE '🛒%') AS "נותר לתקן"
FROM equipment_items
WHERE item_name LIKE '%עגלת קמפינג%'

UNION ALL

SELECT 'סיווג לא ידוע במלאי',
       COUNT(*) FILTER (WHERE category IN ('uncertain', 'לא ידוע')),
       0
FROM inventory_items;
