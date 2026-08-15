-- ============================================================
-- שאילתת בדיקה — מה כבר קיים במסד ומה חסר
-- להריץ ראשונה ב-Supabase SQL Editor. קריאה בלבד, לא משנה כלום.
--
-- בטוחה להרצה גם כשהטבלאות עדיין לא קיימות (משתמשת ב-catalog בלבד).
-- ============================================================

SELECT
  'טבלת shopping_templates' AS "מה בודקים",
  CASE WHEN to_regclass('public.shopping_templates') IS NOT NULL
       THEN 'קיים' ELSE 'חסר' END AS "מצב",
  'supabase-migration-shopping-templates.sql' AS "איזו מיגרציה מטפלת"

UNION ALL SELECT
  'טבלת shopping_template_items',
  CASE WHEN to_regclass('public.shopping_template_items') IS NOT NULL
       THEN 'קיים' ELSE 'חסר' END,
  'supabase-migration-shopping-templates.sql'

UNION ALL SELECT
  'עמודה shopping_template_items.category',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'shopping_template_items'
      AND column_name = 'category'
  ) THEN 'קיים' ELSE 'חסר' END,
  'supabase-migration-camping-template.sql'

UNION ALL SELECT
  'עמודה shopping_list.category_auto',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'shopping_list'
      AND column_name = 'category_auto'
  ) THEN 'קיים' ELSE 'חסר' END,
  'supabase-migration-shopping-category-auto.sql'

UNION ALL SELECT
  'עמודה tasks.depends_on_task_id',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tasks'
      AND column_name = 'depends_on_task_id'
  ) THEN 'קיים' ELSE 'חסר' END,
  'supabase-migration-tasks-depends-on.sql'

UNION ALL SELECT
  'טבלת equipment_items',
  CASE WHEN to_regclass('public.equipment_items') IS NOT NULL
       THEN 'קיים' ELSE 'חסר' END,
  'supabase-migration-equipment.sql';


-- ============================================================
-- אילו רשימות יעודיות קיימות (וכמה פריטים בכל אחת)
--
-- להריץ רק אחרי שטבלת shopping_templates קיימת.
-- שימושי לפני הרצת מיגרציה עם זריעה, כדי לא ליצור כפילות.
-- להרצה: לסמן את הבלוק שמתחת, להסיר את הסימון של ההערה, וללחוץ Run.
-- ============================================================

-- SELECT
--   t.name      AS "שם הרשימה",
--   COUNT(i.id) AS "מספר פריטים",
--   t.id        AS "מזהה"
-- FROM shopping_templates t
-- LEFT JOIN shopping_template_items i ON i.template_id = t.id
-- GROUP BY t.id, t.name
-- ORDER BY t.name;
