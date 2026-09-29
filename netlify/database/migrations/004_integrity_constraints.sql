-- Allow the reserved "all" scope used by payroll settings while keeping
-- business-specific settings supported. The application resolves "all" as
-- the fallback setting for businesses without an override.
ALTER TABLE payroll_settings
  DROP CONSTRAINT IF EXISTS payroll_settings_business_id_fkey;

-- Prevent duplicate payroll cut-offs, including concurrent "next cut-off" creation.
CREATE UNIQUE INDEX IF NOT EXISTS payroll_periods_start_end_unique
  ON payroll_periods (start_date, end_date);

-- Enforce the application's single active initial Super Admin invariant at
-- the database level so concurrent setup requests cannot create two accounts.
CREATE UNIQUE INDEX IF NOT EXISTS users_active_super_admin_unique
  ON users (role)
  WHERE role = 'super_admin' AND status = 'active';
