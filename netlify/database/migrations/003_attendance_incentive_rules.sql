ALTER TABLE incentive_programs
  ADD COLUMN IF NOT EXISTS incentive_type TEXT NOT NULL DEFAULT 'attendance'
  CHECK (incentive_type IN ('attendance','other'));

ALTER TABLE incentive_programs
  ADD COLUMN IF NOT EXISTS require_no_undertime BOOLEAN NOT NULL DEFAULT FALSE;
