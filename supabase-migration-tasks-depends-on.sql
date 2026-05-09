-- Add task dependency column.
-- Run this once in the Supabase SQL editor before using the new dependency feature.

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS depends_on_task_id UUID
    REFERENCES tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS tasks_depends_on_task_id_idx ON tasks(depends_on_task_id);
