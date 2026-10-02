export type UserRole = 'super_admin' | 'employee';

export type EmploymentStatus = 'regular' | 'probationary' | 'contractual' | 'part_time';

export type AccountStatus = 'active' | 'inactive';

export type AttendanceAction = 'time_in' | 'break_out' | 'break_in' | 'time_out';

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'incomplete' | 'invalid';

export type PayrollStatus = 'open' | 'for_approval' | 'approved' | 'finalized';
export type OvertimeApprovalStatus = 'not_required' | 'pending' | 'approved' | 'rejected';

export interface Business {
  id: string;
  name: string;
  code: string;
  address: string;
  contactNumber: string;
  status: AccountStatus;
  createdAt: string;
}

export interface User {
  id: string;
  employeeId: string;
  fullName: string;
  email: string;
  mobileNumber: string;
  role: UserRole;
  businessId?: string;
  status: AccountStatus;
  mustChangePassword?: boolean;
  createdAt: string;
}

export interface Employee {
  id: string;
  userId: string;
  employeeId: string;
  businessId: string;
  fullName: string;
  mobileNumber: string;
  email: string;
  position: string;
  employmentStatus: EmploymentStatus;
  dateHired: string;
  dailyRate: number;
  requiredHoursPerDay: number;
  status: AccountStatus;
}

export interface PayrollPeriod {
  id: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  payoutDate: string; // YYYY-MM-DD
  status: PayrollStatus;
}

export interface Schedule {
  id: string;
  employeeId: string;
  payrollPeriodId: string;
  date: string; // YYYY-MM-DD
  requiredTimeIn?: string; // HH:mm
  requiredTimeOut?: string; // HH:mm
  breakOut?: string; // HH:mm
  breakIn?: string; // HH:mm
  isWorkingDay: boolean;
  notes?: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  businessId: string;
  payrollPeriodId?: string;
  date: string; // YYYY-MM-DD
  timeIn?: string; // ISO string
  breakOut?: string; // ISO string
  breakIn?: string; // ISO string
  timeOut?: string; // ISO string
  lateMinutes: number;
  totalWorkMinutes: number;
  undertimeMinutes?: number;
  overbreakMinutes?: number;
  varianceMinutes?: number;
  overtimeMinutes?: number;
  overtimeApprovalStatus?: OvertimeApprovalStatus;
  overtimeReviewedAt?: string;
  status: AttendanceStatus;
}

export interface DeductionType {
  id: string;
  businessId: string; // or 'all' for company-wide
  name: string;
  calculationType: 'fixed' | 'percentage';
  value: number;
  recurring: boolean;
  status: AccountStatus;
}

export interface EmployeeDeduction {
  id: string;
  employeeId: string;
  deductionTypeId?: string;
  deductionName: string;
  amount: number;
  payrollPeriodId?: string; // if one-time
  recurring: boolean;
  status: AccountStatus;
}

export interface IncentiveProgram {
  id: string;
  businessId: string;
  name: string;
  description: string;
  amount: number;
  incentiveType: 'attendance' | 'other';
  requireNoLate: boolean;
  requireNoUndertime: boolean;
  requireNoAbsence: boolean;
  status: AccountStatus;
  effectiveDate: string;
}

export interface PayrollRecord {
  id: string;
  payrollPeriodId: string;
  employeeId: string;
  businessId: string;
  employeeName: string;
  businessName: string;
  position: string;
  dailyRate: number;
  scheduledDutyDays: number;
  daysWorked: number;
  lateMinutesTotal: number;
  overbreakMinutesTotal?: number;
  undertimeMinutesTotal?: number;
  lateDeduction: number;
  overbreakDeduction?: number;
  undertimeDeduction?: number;
  baseDutyPay: number;
  basicPay: number;
  incentivePay: number;
  employeeDeductionsTotal: number;
  recurringDeductionsTotal: number;
  totalDeductions: number;
  grossPay: number;
  netPay: number;
  status: PayrollStatus;
  employeeApprovedAt?: string;
  finalizedAt?: string;
  nightDifferentialHours?: number;
  nightDifferentialHourlyRate?: number;
  nightDifferentialMultiplier?: number;
  nightDifferentialPay?: number;
  regularOvertimeMultiplier?: number;
  holidayOvertimePay?: number;
  regularOvertimePay?: number;
  overtimeMinutesTotal?: number;
  overtimeHours?: number;
  pendingOvertimeMinutesTotal?: number;
  breakdown: {
    incentives: Array<{ name: string; amount: number; qualified?: boolean; configuredAmount?: number }>;
    deductions: Array<{ name: string; amount: number; type: 'employee' | 'recurring' }>;
    attendanceDays: Array<{ date: string; status: AttendanceStatus; lateMinutes: number; undertimeMinutes?: number; overbreakMinutes?: number; varianceMinutes?: number; overtimeMinutes?: number; overtimeApprovalStatus?: OvertimeApprovalStatus; pendingOvertimeMinutes?: number; hours: number }>;
  };
}


export interface Holiday { id:string; businessId:string; holidayDate:string; name:string; holidayType:'regular'|'special_non_working'|'special_working'; overtimeRate:number; }
export interface PayrollSettings { businessId:string; nightDifferentialHourlyRate:number; nightDifferentialMultiplier:number; regularOvertimeMultiplier:number; holidays:Holiday[]; }
