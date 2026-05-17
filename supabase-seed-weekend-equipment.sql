-- Seed weekend (סופ"ש) equipment list with emojis and pack status.
-- Run ONCE in Supabase SQL Editor. Re-running will create duplicates.
--
-- is_packed = true  → item starts under "✅ נארז"
-- is_packed = false → item starts under the main unpacked list

INSERT INTO equipment_items (list_type, category, item_name, is_packed, household_id) VALUES
  -- Unpacked items
  ('סופ"ש', 'חשמל',      '🎧 אוזניות',            false, '92e1a987-99b7-41ec-93fb-ae2ada2bcf72'),
  ('סופ"ש', 'תרופות',    '💊 פרנטל',              false, '92e1a987-99b7-41ec-93fb-ae2ada2bcf72'),
  ('סופ"ש', 'נעליים',    '👟 נעליים',             false, '92e1a987-99b7-41ec-93fb-ae2ada2bcf72'),
  ('סופ"ש', 'ניאו',      '🧴 משחה לפטמות',        false, '92e1a987-99b7-41ec-93fb-ae2ada2bcf72'),
  ('סופ"ש', 'בגדים',     '👚 פיג׳מה להילה',       false, '92e1a987-99b7-41ec-93fb-ae2ada2bcf72'),
  -- Pills sub-items (unpacked)
  ('סופ"ש', 'תרופות',    '🩹 פלסטרים',            false, '92e1a987-99b7-41ec-93fb-ae2ada2bcf72'),
  ('סופ"ש', 'תרופות',    '💊 נוקטורנו וסטופיט',   false, '92e1a987-99b7-41ec-93fb-ae2ada2bcf72'),
  ('סופ"ש', 'תרופות',    '💊 בי 12',              false, '92e1a987-99b7-41ec-93fb-ae2ada2bcf72'),
  ('סופ"ש', 'תרופות',    '🍊 ויטמין סי',          false, '92e1a987-99b7-41ec-93fb-ae2ada2bcf72'),
  ('סופ"ש', 'תרופות',    '💊 פרופסיה',            false, '92e1a987-99b7-41ec-93fb-ae2ada2bcf72'),
  ('סופ"ש', 'תרופות',    '💊 תרופות הילה',        false, '92e1a987-99b7-41ec-93fb-ae2ada2bcf72'),

  -- Packed items
  ('סופ"ש', 'חשמל',      '🔌 מטען למחשב',         true,  '92e1a987-99b7-41ec-93fb-ae2ada2bcf72'),
  ('סופ"ש', 'ציוד נוסף', '🛂 דרכון',              true,  '92e1a987-99b7-41ec-93fb-ae2ada2bcf72'),
  ('סופ"ש', 'ציוד נוסף', '🍷 אלכוהול',            true,  '92e1a987-99b7-41ec-93fb-ae2ada2bcf72'),
  ('סופ"ש', 'ניאו',      '🥛 חלב ולחמניות',       true,  '92e1a987-99b7-41ec-93fb-ae2ada2bcf72'),
  ('סופ"ש', 'ניאו',      '🧸 אלתוש',              true,  '92e1a987-99b7-41ec-93fb-ae2ada2bcf72'),
  ('סופ"ש', 'ציוד נוסף', '🦻 אטמים',              true,  '92e1a987-99b7-41ec-93fb-ae2ada2bcf72'),
  ('סופ"ש', 'בגדים',     '🧦 תחתונים וגרביים',    true,  '92e1a987-99b7-41ec-93fb-ae2ada2bcf72'),
  ('סופ"ש', 'ציוד נוסף', '🧷 סיכות ביטחון',       true,  '92e1a987-99b7-41ec-93fb-ae2ada2bcf72'),
  ('סופ"ש', 'ציוד נוסף', '✂️ פינצטה',             true,  '92e1a987-99b7-41ec-93fb-ae2ada2bcf72'),
  ('סופ"ש', 'חשמל',      '💻 סטנד למחשב',         true,  '92e1a987-99b7-41ec-93fb-ae2ada2bcf72'),
  ('סופ"ש', 'ציוד נוסף', '🪥 מברשת שיניים',       true,  '92e1a987-99b7-41ec-93fb-ae2ada2bcf72'),
  ('סופ"ש', 'חשמל',      '💨 פן',                 true,  '92e1a987-99b7-41ec-93fb-ae2ada2bcf72'),
  ('סופ"ש', 'בגדים',     '👕 חולצות',             true,  '92e1a987-99b7-41ec-93fb-ae2ada2bcf72'),
  ('סופ"ש', 'בגדים',     '🛌 פיג׳מה',             true,  '92e1a987-99b7-41ec-93fb-ae2ada2bcf72'),
  ('סופ"ש', 'ציוד נוסף', '🧴 מוס',                true,  '92e1a987-99b7-41ec-93fb-ae2ada2bcf72'),
  ('סופ"ש', 'ציוד נוסף', '🌸 בושם',               true,  '92e1a987-99b7-41ec-93fb-ae2ada2bcf72'),
  ('סופ"ש', 'חשמל',      '💻 מחשב',               true,  '92e1a987-99b7-41ec-93fb-ae2ada2bcf72'),
  ('סופ"ש', 'חשמל',      '🔋 מטענים',             true,  '92e1a987-99b7-41ec-93fb-ae2ada2bcf72'),
  ('סופ"ש', 'ציוד נוסף', '🧴 דאודורנט',           true,  '92e1a987-99b7-41ec-93fb-ae2ada2bcf72'),
  ('סופ"ש', 'תרופות',    '💊 כדורים',             true,  '92e1a987-99b7-41ec-93fb-ae2ada2bcf72'),
  ('סופ"ש', 'נעליים',    '🩴 כפכפים',             true,  '92e1a987-99b7-41ec-93fb-ae2ada2bcf72'),
  ('סופ"ש', 'נעליים',    '🩴 כפכפים להילה',       true,  '92e1a987-99b7-41ec-93fb-ae2ada2bcf72');
