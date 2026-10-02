-- Add explicit Super Admin approval state for overtime.
-- Unapproved overtime must never be included in payroll computation.

ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS overtime_approval_status TEXT NOT NULL DEFAULT 'not_required'
    CHECK (overtime_approval_status IN ('not_required','pending','approved','rejected')),
  ADD COLUMN IF NOT EXISTS overtime_reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS overtime_reviewed_at TIMESTAMPTZ;

-- Existing qualifying overtime requires review before it can affect payroll.
-- Use the scheduled duty end, including overnight schedules, to identify
-- overtime that exceeds the existing 30-minute threshold.
UPDATE attendance a
SET overtime_approval_status = 'pending',
    overtime_reviewed_by = NULL,
    overtime_reviewed_at = NULL
FROM schedules s
WHERE s.employee_id = a.employee_id
  AND (s.payroll_period_id = a.payroll_period_id OR a.payroll_period_id IS NULL)
  AND s.date = a.date
  AND s.is_working_day = TRUE
  AND a.time_out IS NOT NULL
  AND s.required_time_in IS NOT NULL
  AND s.required_time_out IS NOT NULL
  AND (
    a.time_out
    - (
      (s.date::text || ' ' || s.required_time_out)::timestamp
      AT TIME ZONE 'Asia/Manila'
      + CASE
          WHEN s.required_time_out < s.required_time_in THEN INTERVAL '1 day'
          ELSE INTERVAL '0 day'
        END
    )
  ) > INTERVAL '30 minutes';

CREATE INDEX IF NOT EXISTS attendance_overtime_approval_idx
  ON attendance (payroll_period_id, overtime_approval_status);
