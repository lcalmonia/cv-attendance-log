CREATE TABLE IF NOT EXISTS finalized_payroll_ledger (
  payroll_period_id TEXT NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  payroll_record JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (payroll_period_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_finalized_payroll_ledger_period
  ON finalized_payroll_ledger(payroll_period_id);

-- This ledger is populated transactionally by the API immediately before a
-- payroll period is marked finalized. It freezes the exact payroll result
-- returned to both the Super Admin and Employee portals.
