CREATE TABLE IF NOT EXISTS payroll_rate_snapshots (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  payroll_period_id TEXT NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  daily_rate NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (payroll_period_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_payroll_rate_snapshots_period
  ON payroll_rate_snapshots(payroll_period_id);

-- Preserve the current rate for payroll periods that are already finalized.
-- Future finalization is handled transactionally by the API before the period
-- status is changed to finalized.
INSERT INTO payroll_rate_snapshots (payroll_period_id, employee_id, daily_rate)
SELECT p.id, e.id, e.daily_rate
FROM payroll_periods p
JOIN employees e ON e.status='active'
WHERE p.status='finalized'
ON CONFLICT (payroll_period_id, employee_id) DO NOTHING;
