CREATE TABLE IF NOT EXISTS payroll_settings (
  business_id TEXT PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  night_differential_hourly_rate NUMERIC(12,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS holidays (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL DEFAULT 'all',
  holiday_date DATE NOT NULL,
  name TEXT NOT NULL,
  holiday_type TEXT NOT NULL DEFAULT 'regular' CHECK (holiday_type IN ('regular','special_non_working','special_working')),
  overtime_rate NUMERIC(8,2) NOT NULL DEFAULT 1.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_id, holiday_date)
);

CREATE INDEX IF NOT EXISTS holidays_date_idx ON holidays (holiday_date);
