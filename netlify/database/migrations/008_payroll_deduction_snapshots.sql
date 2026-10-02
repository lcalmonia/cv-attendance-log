CREATE TABLE IF NOT EXISTS payroll_deduction_snapshots (
  id TEXT PRIMARY KEY,
  payroll_period_id TEXT NOT NULL REFERENCES payroll_periods(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  line_no INTEGER NOT NULL,
  deduction_name TEXT NOT NULL,
  deduction_type TEXT NOT NULL CHECK (deduction_type IN ('employee','recurring')),
  amount NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (payroll_period_id, employee_id, line_no)
);

CREATE INDEX IF NOT EXISTS idx_payroll_deduction_snapshots_period
  ON payroll_deduction_snapshots(payroll_period_id);

-- Future finalized payrolls are snapshotted by the API immediately before
-- the payroll period is marked finalized. Existing finalized payrolls cannot
-- be reconstructed exactly because their historical deduction ledger was not
-- previously stored.