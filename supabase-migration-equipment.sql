-- Run this in Supabase Dashboard > SQL Editor

CREATE TABLE IF NOT EXISTS equipment_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  list_type text NOT NULL,
  category text NOT NULL DEFAULT 'ציוד נוסף',
  item_name text NOT NULL,
  is_packed boolean DEFAULT false,
  household_id uuid DEFAULT '92e1a987-99b7-41ec-93fb-ae2ada2bcf72'::uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE equipment_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allow_all_equipment_items ON equipment_items;
CREATE POLICY allow_all_equipment_items ON equipment_items FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS equipment_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  list_type text NOT NULL,
  last_pack_date date NOT NULL DEFAULT current_date,
  household_id uuid DEFAULT '92e1a987-99b7-41ec-93fb-ae2ada2bcf72'::uuid,
  UNIQUE(list_type, household_id)
);

ALTER TABLE equipment_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allow_all_equipment_sessions ON equipment_sessions;
CREATE POLICY allow_all_equipment_sessions ON equipment_sessions FOR ALL USING (true) WITH CHECK (true);
