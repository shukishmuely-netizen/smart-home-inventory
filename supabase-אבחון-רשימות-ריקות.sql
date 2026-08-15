-- ============================================================
-- אבחון: המיגרציה רצה, אבל האפליקציה מציגה "אין עדיין רשימות"
--
-- להריץ ב-SQL Editor. קריאה בלבד.
--
-- העורך של Supabase רץ בהרשאות מלאות ולכן רואה הכל,
-- בעוד שהאפליקציה ניגשת עם מפתח ציבורי (anon) שכפוף ל-RLS.
-- אם יש שורות בטבלה אבל RLS דלוק בלי מדיניות הרשאה,
-- האפליקציה תקבל רשימה ריקה בלי שום הודעת שגיאה — בדיוק מה שקרה.
-- ============================================================

-- 1) האם באמת יש נתונים בטבלאות
SELECT 'shopping_templates'      AS "טבלה", COUNT(*)::text AS "שורות" FROM shopping_templates
UNION ALL
SELECT 'shopping_template_items', COUNT(*)::text            FROM shopping_template_items
UNION ALL
SELECT 'shopping_list',           COUNT(*)::text            FROM shopping_list
UNION ALL
SELECT 'equipment_items',         COUNT(*)::text            FROM equipment_items;


-- 2) מצב ההרשאות: להשוות בין הטבלאות החדשות לטבלאות שכבר עובדות
SELECT
  c.relname                                   AS "טבלה",
  CASE WHEN c.relrowsecurity THEN 'דלוק' ELSE 'כבוי' END AS "RLS",
  COALESCE(p.cnt, 0)                          AS "מדיניות הרשאה",
  CASE
    WHEN NOT c.relrowsecurity THEN 'תקין - האפליקציה רואה'
    WHEN COALESCE(p.cnt, 0) = 0 THEN 'חוסם - האפליקציה מקבלת ריק'
    ELSE 'דלוק עם מדיניות'
  END                                         AS "משמעות"
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN (
  SELECT tablename, COUNT(*) AS cnt
  FROM pg_policies WHERE schemaname = 'public' GROUP BY tablename
) p ON p.tablename = c.relname
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'shopping_templates', 'shopping_template_items',
    'shopping_list', 'inventory_items', 'equipment_items',
    'equipment_sessions', 'tasks', 'category_order'
  )
ORDER BY c.relname;
