-- Optional per-schedule break clock requirements.
-- Existing schedules default to false so this feature does not retroactively
-- change the clock-out rules for previously configured shifts.
ALTER TABLE schedules
  ADD COLUMN IF NOT EXISTS require_break_out BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS require_break_in BOOLEAN NOT NULL DEFAULT FALSE;
