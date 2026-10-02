-- Add administrator-controlled payroll multipliers for regular overtime and night differential.
-- Existing rows retain a neutral 1.00 multiplier until Super Admin configures the intended rates.
ALTER TABLE payroll_settings
  ADD COLUMN IF NOT EXISTS regular_overtime_multiplier NUMERIC(8,4) NOT NULL DEFAULT 1.00,
  ADD COLUMN IF NOT EXISTS night_differential_multiplier NUMERIC(8,4) NOT NULL DEFAULT 1.00;

ALTER TABLE payroll_settings
  DROP CONSTRAINT IF EXISTS payroll_settings_regular_overtime_multiplier_check,
  DROP CONSTRAINT IF EXISTS payroll_settings_night_differential_multiplier_check;

ALTER TABLE payroll_settings
  ADD CONSTRAINT payroll_settings_regular_overtime_multiplier_check
    CHECK (regular_overtime_multiplier >= 0),
  ADD CONSTRAINT payroll_settings_night_differential_multiplier_check
    CHECK (night_differential_multiplier >= 0);
