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
