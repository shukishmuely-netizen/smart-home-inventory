-- ============================================================
-- הרצה מאוחדת: הרשאות + סידור רשימות + היסטוריית מוצרים
-- להריץ פעם אחת. כל החלקים בטוחים גם להרצה חוזרת.
-- ============================================================

-- ##### חלק 1: הרשאות לטבלאות הרשימות #####
-- ============================================================
-- תיקון: האפליקציה לא רואה את הרשימות היעודיות
--
-- הטבלאות החדשות נוצרו בלי אותן הרשאות שיש לשאר טבלאות
-- האפליקציה, ולכן הגישה עם המפתח הציבורי מחזירה רשימה ריקה
-- בלי הודעת שגיאה.
--
-- הסקריפט מעתיק לטבלאות החדשות בדיוק את אותה תצורה
-- שיש לטבלת shopping_list שכבר עובדת - בלי לנחש.
-- בטוח להרצה חוזרת.
-- ============================================================

-- 1) הרשאות גישה לתפקידים שהאפליקציה משתמשת בהם
GRANT SELECT, INSERT, UPDATE, DELETE ON shopping_templates      TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON shopping_template_items TO anon, authenticated;

-- 2) התאמת מדיניות האבטחה לזו של טבלה קיימת שעובדת
DO $$
DECLARE
  ref_rls      boolean;
  ref_policies integer;
BEGIN
  SELECT c.relrowsecurity INTO ref_rls
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'shopping_list';

  IF ref_rls IS NULL THEN
    RAISE EXCEPTION 'לא נמצאה הטבלה shopping_list';
  END IF;

  SELECT COUNT(*) INTO ref_policies
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'shopping_list';

  IF NOT ref_rls THEN
    -- הטבלה הקיימת עובדת בלי RLS - לעשות אותו דבר
    ALTER TABLE shopping_templates      DISABLE ROW LEVEL SECURITY;
    ALTER TABLE shopping_template_items DISABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'RLS כובה בשתי הטבלאות, בהתאמה ל-shopping_list';
  ELSE
    -- הטבלה הקיימת עובדת עם RLS ומדיניות - ליצור מדיניות מקבילה
    ALTER TABLE shopping_templates      ENABLE ROW LEVEL SECURITY;
    ALTER TABLE shopping_template_items ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS shopping_templates_all ON shopping_templates;
    CREATE POLICY shopping_templates_all ON shopping_templates
      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS shopping_template_items_all ON shopping_template_items;
    CREATE POLICY shopping_template_items_all ON shopping_template_items
      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

    RAISE NOTICE 'RLS הודלק ונוספה מדיניות פתוחה, בהתאמה ל-shopping_list (% מדיניות)', ref_policies;
  END IF;
END $$;

-- 3) רענון מטמון הסכימה, כדי שהשכבה שמגישה את ה-API תכיר את הטבלאות מיד
NOTIFY pgrst, 'reload schema';


-- ============================================================
-- אימות: מה האפליקציה אמורה לראות עכשיו
-- ============================================================
SELECT
  t.name                     AS "שם הרשימה",
  COUNT(i.id)                AS "פריטים",
  COUNT(DISTINCT i.category) AS "קטגוריות"
FROM shopping_templates t
LEFT JOIN shopping_template_items i ON i.template_id = t.id
GROUP BY t.id, t.name
ORDER BY t.created_at;

-- ##### חלק 2: מחיקת כפילויות והעברת הקמפינג #####
-- ============================================================
-- סידור הרשימות
--
-- 1) מחיקת כפילויות (סושי ולחמניות ללג נוצרו פעמיים)
-- 2) העברת פסטיבלים וקמפינג מרשימות הקניות אל רשימות הציוד,
--    כך שיישב יחד עם חו"ל וסופ"ש
--
-- בטוח להרצה חוזרת.
-- ============================================================

-- ------------------------------------------------------------
-- 1) מחיקת כפילויות — שומר מכל שם את המופע שנוצר ראשון.
--    הפריטים של העותקים העודפים נמחקים אוטומטית יחד איתם.
-- ------------------------------------------------------------
DELETE FROM shopping_templates
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY name ORDER BY created_at, id) AS rn
    FROM shopping_templates
  ) ranked
  WHERE ranked.rn > 1
);


-- ------------------------------------------------------------
-- 2) העתקת פריטי הקמפינג אל רשימות הציוד, עם הקטגוריות שלהם.
--    ה-NOT EXISTS מונע כפילות אם הסקריפט ירוץ שוב.
-- ------------------------------------------------------------
INSERT INTO equipment_items (list_type, category, item_name, is_packed, household_id)
SELECT
  'פסטיבלים וקמפינג',
  COALESCE(NULLIF(TRIM(i.category), ''), 'ציוד נוסף'),
  i.item_name,
  false,
  '92e1a987-99b7-41ec-93fb-ae2ada2bcf72'
FROM shopping_template_items i
JOIN shopping_templates t ON t.id = i.template_id
WHERE t.name = 'פסטיבלים וקמפינג'
  AND NOT EXISTS (
    SELECT 1 FROM equipment_items e
    WHERE e.list_type = 'פסטיבלים וקמפינג'
      AND e.item_name = i.item_name
  );

-- הסרת הקמפינג מרשימות הקניות — מקומו עכשיו ברשימות הציוד
DELETE FROM shopping_templates WHERE name = 'פסטיבלים וקמפינג';


-- ============================================================
-- אימות
-- ============================================================

-- רשימות הקניות שנשארו: אמורות להיות סושי ולחמניות ללג, אחת מכל אחת
SELECT 'רשימות קניות' AS "סוג", t.name AS "שם", COUNT(i.id) AS "פריטים"
FROM shopping_templates t
LEFT JOIN shopping_template_items i ON i.template_id = t.id
GROUP BY t.id, t.name

UNION ALL

-- רשימות הציוד: אמורות לכלול פסטיבלים וקמפינג עם 70 פריטים
SELECT 'רשימות ציוד', e.list_type, COUNT(*)
FROM equipment_items e
GROUP BY e.list_type

ORDER BY 1, 2;

-- ##### חלק 3: היסטוריית מוצרים #####
-- ============================================================
-- היסטוריית מוצרים — כל מה שאי פעם היה ברשימת הקניות
--
-- כשפריט נמחק מהרשימה או מועבר למלאי, שמו נשמר כאן,
-- כדי שההשלמה האוטומטית תציע אותו גם בעתיד.
--
-- כולל את ההרשאות שהאפליקציה צריכה, באותה תצורה
-- כמו הטבלאות הקיימות. בטוח להרצה חוזרת.
-- ============================================================

CREATE TABLE IF NOT EXISTS shopping_history (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name    TEXT NOT NULL,
  household_id UUID,
  last_used    TIMESTAMPTZ DEFAULT now()
);

-- שם מוצר נשמר פעם אחת בלבד, בלי תלות באותיות גדולות/קטנות
CREATE UNIQUE INDEX IF NOT EXISTS shopping_history_name_uniq
  ON shopping_history (lower(item_name));


-- ------------------------------------------------------------
-- הרשאות גישה
-- ------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON shopping_history TO anon, authenticated;

DO $$
DECLARE
  ref_rls boolean;
BEGIN
  SELECT c.relrowsecurity INTO ref_rls
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'shopping_list';

  IF ref_rls IS NULL THEN
    RAISE EXCEPTION 'לא נמצאה הטבלה shopping_list';
  END IF;

  IF NOT ref_rls THEN
    ALTER TABLE shopping_history DISABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'RLS כובה, בהתאמה ל-shopping_list';
  ELSE
    ALTER TABLE shopping_history ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS shopping_history_all ON shopping_history;
    CREATE POLICY shopping_history_all ON shopping_history
      FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
    RAISE NOTICE 'RLS הודלק עם מדיניות פתוחה, בהתאמה ל-shopping_list';
  END IF;
END $$;


-- ------------------------------------------------------------
-- זריעה ראשונית: כל מה שנמצא כרגע ברשימת הקניות ובמלאי,
-- כדי שההיסטוריה לא תתחיל ריקה
-- ------------------------------------------------------------
INSERT INTO shopping_history (item_name, household_id)
SELECT DISTINCT ON (lower(TRIM(item_name)))
       TRIM(item_name), '92e1a987-99b7-41ec-93fb-ae2ada2bcf72'
FROM (
  SELECT item_name FROM shopping_list
  UNION
  SELECT item_name FROM inventory_items
) src
WHERE TRIM(COALESCE(item_name, '')) <> ''
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';


-- אימות
SELECT COUNT(*) AS "מוצרים בהיסטוריה" FROM shopping_history;
