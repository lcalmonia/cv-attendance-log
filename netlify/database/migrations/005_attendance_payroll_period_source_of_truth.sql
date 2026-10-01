-- Bind each attendance record to the exact payroll period/schedule used for calculation.
-- This removes ambiguity when the same employee/date can be resolved against more than one schedule.

ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS payroll_period_id TEXT REFERENCES payroll_periods(id) ON DELETE SET NULL;

-- Backfill existing records using the same schedule-selection priority used by the API:
-- prefer a schedule whose date is inside its payroll period, then prefer the most
-- relevant payroll status, newest period, and newest schedule.
UPDATE attendance a
SET payroll_period_id = (
  SELECT s.payroll_period_id
  FROM schedules s
  JOIN payroll_periods p ON p.id = s.payroll_period_id
  WHERE s.employee_id = a.employee_id
    AND s.date = a.date
  ORDER BY
    CASE WHEN a.date BETWEEN p.start_date AND p.end_date THEN 0 ELSE 1 END,
    CASE p.status
      WHEN 'open' THEN 0
      WHEN 'for_approval' THEN 1
      WHEN 'approved' THEN 2
      WHEN 'finalized' THEN 3
      ELSE 4
    END,
    p.start_date DESC,
    s.id DESC
  LIMIT 1
)
WHERE a.payroll_period_id IS NULL;

CREATE INDEX IF NOT EXISTS attendance_employee_period_date_idx
  ON attendance (employee_id, payroll_period_id, date);
