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
