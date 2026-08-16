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
