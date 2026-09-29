CREATE TABLE IF NOT EXISTS businesses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  address TEXT NOT NULL DEFAULT '',
  contact_number TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  mobile_number TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL CHECK (role IN ('super_admin','employee')),
  business_id TEXT REFERENCES businesses(id) ON UPDATE CASCADE ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_accounts (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  login_id TEXT NOT NULL UNIQUE,
  mobile_login TEXT,
  password_hash TEXT NOT NULL,
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS auth_accounts_mobile_login_unique
  ON auth_accounts (mobile_login)
  WHERE mobile_login IS NOT NULL AND mobile_login <> '';

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('super_admin','employee')),
  employee_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at);
CREATE INDEX IF NOT EXISTS users_business_idx ON users (business_id);

CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL UNIQUE,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  full_name TEXT NOT NULL,
  mobile_number TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  position TEXT NOT NULL DEFAULT 'Staff',
  employment_status TEXT NOT NULL DEFAULT 'regular',
  date_hired DATE NOT NULL,
  daily_rate NUMERIC(12,2) NOT NULL DEFAULT 600,
  required_hours_per_day NUMERIC(6,2) NOT NULL DEFAULT 8,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive'))
);

CREATE INDEX IF NOT EXISTS employees_business_idx ON employees (business_id);

CREATE TABLE IF NOT EXISTS payroll_periods (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  payout_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','for_approval','approved','finalized')),
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS payroll_periods_dates_idx ON payroll_periods (start_date, end_date);

CREATE TABLE IF NOT EXISTS schedules (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  payroll_period_id TEXT NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  required_time_in TEXT,
  required_time_out TEXT,
  break_out TEXT,
  break_in TEXT,
  is_working_day BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT NOT NULL DEFAULT '',
  CONSTRAINT schedule_period_date_check CHECK (date >= (SELECT start_date FROM payroll_periods WHERE payroll_periods.id = payroll_period_id) AND date <= (SELECT end_date FROM payroll_periods WHERE payroll_periods.id = payroll_period_id))
);

CREATE UNIQUE INDEX IF NOT EXISTS schedules_employee_period_date_unique
  ON schedules (employee_id, payroll_period_id, date);

CREATE TABLE IF NOT EXISTS attendance (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  date DATE NOT NULL,
  time_in TIMESTAMPTZ,
  break_out TIMESTAMPTZ,
  break_in TIMESTAMPTZ,
  time_out TIMESTAMPTZ,
  late_minutes INTEGER NOT NULL DEFAULT 0,
  total_work_minutes INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present','absent','late','incomplete')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS attendance_employee_date_unique
  ON attendance (employee_id, date);

CREATE INDEX IF NOT EXISTS attendance_business_date_idx
  ON attendance (business_id, date);

CREATE TABLE IF NOT EXISTS deduction_types (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL DEFAULT 'all',
  name TEXT NOT NULL,
  calculation_type TEXT NOT NULL CHECK (calculation_type IN ('fixed','percentage')),
  value NUMERIC(12,2) NOT NULL,
  recurring BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive'))
);

CREATE INDEX IF NOT EXISTS deduction_types_business_idx ON deduction_types (business_id);

CREATE TABLE IF NOT EXISTS employee_deductions (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  deduction_type_id TEXT,
  deduction_name TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  payroll_period_id TEXT REFERENCES payroll_periods(id) ON DELETE SET NULL,
  recurring BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive'))
);

CREATE INDEX IF NOT EXISTS employee_deductions_employee_idx ON employee_deductions (employee_id);

CREATE TABLE IF NOT EXISTS incentive_programs (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  amount NUMERIC(12,2) NOT NULL,
  require_no_late BOOLEAN NOT NULL DEFAULT TRUE,
  require_no_absence BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  effective_date DATE NOT NULL
);

CREATE INDEX IF NOT EXISTS incentive_programs_business_idx ON incentive_programs (business_id);

CREATE TABLE IF NOT EXISTS payroll_approvals (
  payroll_period_id TEXT NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  approved_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (payroll_period_id, employee_id)
);
