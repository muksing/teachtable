-- Add recorder name snapshot to teach_actuals
ALTER TABLE teach_actuals
  ADD COLUMN IF NOT EXISTS record_by_name TEXT DEFAULT '';
