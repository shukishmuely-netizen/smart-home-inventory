-- ============================================================
-- שאילתת בדיקה — מה כבר קיים במסד ומה חסר
-- להריץ ראשונה ב-Supabase SQL Editor. קריאה בלבד, לא משנה כלום.
-- ============================================================

SELECT
  'טבלת shopping_templates' AS "מה בודקים",
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'shopping_templates'
  ) THEN 'קיים' ELSE 'חסר' END AS "מצב"

UNION ALL SELECT
  'טבלת shopping_template_items',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'shopping_template_items'
  ) THEN 'קיים' ELSE 'חסר' END

UNION ALL SELECT
  'עמודה shopping_template_items.category',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shopping_template_items' AND column_name = 'category'
  ) THEN 'קיים' ELSE 'חסר' END

UNION ALL SELECT
  'עמודה shopping_list.category_auto',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shopping_list' AND column_name = 'category_auto'
  ) THEN 'קיים' ELSE 'חסר' END

UNION ALL SELECT
  'עמודה tasks.depends_on_task_id',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'depends_on_task_id'
  ) THEN 'קיים' ELSE 'חסר' END;


-- ============================================================
-- אילו רשימות יעודיות כבר קיימות (וכמה פריטים בכל אחת)
-- אם מופיעה כאן רשימה פעמיים - יש כפילות שכדאי למחוק
-- ============================================================

SELECT
  t.name                AS "שם הרשימה",
  COUNT(i.id)           AS "מספר פריטים",
  t.id                  AS "מזהה"
FROM shopping_templates t
LEFT JOIN shopping_template_items i ON i.template_id = t.id
GROUP BY t.id, t.name
ORDER BY t.name;
