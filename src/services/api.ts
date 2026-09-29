import {
  Business,
  User,
  Employee,
  PayrollPeriod,
  Schedule,
  AttendanceRecord,
  DeductionType,
  EmployeeDeduction,
  IncentiveProgram,
  PayrollRecord,
  PayrollStatus,
  AttendanceAction,
  PayrollSettings,
} from '../types';

export function getAuthToken(): null { return null; }
export function setAuthToken(_token: string) {}
export function clearAuthToken() {}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  const response = await fetch(path, { ...options, headers, credentials: 'include' });

  const text = await response.text();
  let data: any = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }

  return data as T;
}

export const api = {
  // Auth
  auth: {
    status: () => request<{ hasAccounts: boolean }>('/api/auth/status'),
    login: async (loginId: string, password: string) => {
      const res = await request<{
        userId: string;
        role: 'super_admin' | 'employee';
        fullName: string;
        employeeId: string;
        mustChangePassword?: boolean;
      }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ loginId, password }),
      });
      // Authentication is persisted by the HttpOnly session cookie set by the server.
      return res;
    },
    session: () =>
      request<{
        authenticated: boolean;
        userId: string;
        employeeId: string;
        fullName: string;
        email: string;
        role: 'super_admin' | 'employee';
        mustChangePassword: boolean;
        businessName?: string;
        businessId?: string;
      }>('/api/auth/session'),
    logout: async () => {
      try {
        await request('/api/auth/logout', { method: 'POST' });
      } finally {
        clearAuthToken();
      }
    },
    changePassword: (currentPassword: string, newPassword: string) =>
      request<{ success: boolean }>('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      }),
    setup: (payload: { fullName: string; employeeId: string; email?: string; mobileNumber?: string; password: string }) =>
      request<{ success: boolean }>('/api/auth/setup', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  },

  // Admin APIs
  admin: {
    getDashboard: () =>
      request<{
        businessesCount: number;
        activeEmployeesCount: number;
        timedInEmployees: number;
        currentCutoff: string;
        payrollStatus: string;
        periodId?: string;
      }>('/api/admin/dashboard'),

    // Businesses
    getBusinesses: () => request<Business[]>('/api/admin/businesses'),
    createBusiness: (data: Partial<Business>) =>
      request<Business>('/api/admin/businesses', { method: 'POST', body: JSON.stringify(data) }),
    updateBusiness: (id: string, data: Partial<Business>) =>
      request<Business>(`/api/admin/businesses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

    // Employees
    getEmployees: () => request<(Employee & { businessName: string })[]>('/api/admin/employees'),
    createEmployee: (data: Partial<Employee>) =>
      request<Employee>('/api/admin/employees', { method: 'POST', body: JSON.stringify(data) }),
    updateEmployee: (id: string, data: Partial<Employee>) =>
      request<Employee>(`/api/admin/employees/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteEmployee: (id: string) =>
      request<{ success: boolean }>(`/api/admin/employees/${id}`, { method: 'DELETE' }),
    resetEmployeePassword: (id: string) =>
      request<{ success: boolean; message: string }>(`/api/admin/employees/${id}/reset-password`, { method: 'POST' }),

    // Periods
    getPeriods: () => request<PayrollPeriod[]>('/api/admin/periods'),
    createPeriod: (data: Partial<PayrollPeriod>) =>
      request<PayrollPeriod>('/api/admin/periods', { method: 'POST', body: JSON.stringify(data) }),
    updatePeriod: (id: string, data: Partial<PayrollPeriod>) =>
      request<PayrollPeriod>(`/api/admin/periods/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

    // Schedules
    getSchedules: (periodId?: string, employeeId?: string) => {
      const q = new URLSearchParams();
      if (periodId) q.set('periodId', periodId);
      if (employeeId) q.set('employeeId', employeeId);
      return request<(Schedule & { employeeName: string })[]>(`/api/admin/schedules?${q.toString()}`);
    },
    saveSchedule: (data: Partial<Schedule>) =>
      request<Schedule>('/api/admin/schedules', { method: 'POST', body: JSON.stringify(data) }),
    deleteSchedule: (id: string) =>
      request<{ success: boolean }>(`/api/admin/schedules/${id}`, { method: 'DELETE' }),

    // Attendance
    getAttendance: (params: { periodId?: string; businessId?: string; date?: string }) => {
      const q = new URLSearchParams();
      if (params.periodId) q.set('periodId', params.periodId);
      if (params.businessId) q.set('businessId', params.businessId);
      if (params.date) q.set('date', params.date);
      return request<(AttendanceRecord & { employeeName: string; employeeIdCode: string; businessName: string; undertimeMinutes: number; overbreakMinutes: number; varianceMinutes: number })[]>(
        `/api/admin/attendance?${q.toString()}`
      );
    },
    deleteAttendance: (id: string) =>
      request<{ success: boolean }>(`/api/admin/attendance/${id}`, { method: 'DELETE' }),

    // Deductions
    getDeductionTypes: () => request<DeductionType[]>('/api/admin/deductions/types'),
    createDeductionType: (data: Partial<DeductionType>) =>
      request<DeductionType>('/api/admin/deductions/types', { method: 'POST', body: JSON.stringify(data) }),
    updateDeductionType: (id: string, data: Partial<DeductionType>) =>
      request<DeductionType>(`/api/admin/deductions/types/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteDeductionType: (id: string) =>
      request<{ success: boolean }>(`/api/admin/deductions/types/${id}`, { method: 'DELETE' }),

    getEmployeeDeductions: (employeeId?: string) => {
      const q = employeeId ? `?employeeId=${employeeId}` : '';
      return request<(EmployeeDeduction & { employeeName: string })[]>(`/api/admin/deductions/employee${q}`);
    },
    createEmployeeDeduction: (data: Partial<EmployeeDeduction>) =>
      request<EmployeeDeduction>('/api/admin/deductions/employee', { method: 'POST', body: JSON.stringify(data) }),
    deleteEmployeeDeduction: (id: string) =>
      request<{ success: boolean }>(`/api/admin/deductions/employee/${id}`, { method: 'DELETE' }),

    // Incentives
    getIncentives: () => request<(IncentiveProgram & { businessName: string })[]>('/api/admin/incentives'),
    createIncentive: (data: Partial<IncentiveProgram>) =>
      request<IncentiveProgram>('/api/admin/incentives', { method: 'POST', body: JSON.stringify(data) }),
    updateIncentive: (id: string, data: Partial<IncentiveProgram>) =>
      request<IncentiveProgram>(`/api/admin/incentives/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteIncentive: (id: string) =>
      request<{ success: boolean }>(`/api/admin/incentives/${id}`, { method: 'DELETE' }),

    // Payroll
    getPayroll: (periodId: string) =>
      request<{ period: PayrollPeriod; records: PayrollRecord[] }>(`/api/admin/payroll/${periodId}`),
    getSettings: (businessId?: string) => request<PayrollSettings>(`/api/admin/settings${businessId ? `?businessId=${encodeURIComponent(businessId)}` : ''}`),
    updateSettings: (data: { businessId: string; nightDifferentialHourlyRate: number }) => request<{ success: boolean }>('/api/admin/settings', { method: 'PUT', body: JSON.stringify(data) }),
    createHoliday: (data: any) => request<{ success: boolean; id: string }>('/api/admin/holidays', { method: 'POST', body: JSON.stringify(data) }),
    updateHoliday: (id: string, data: any) => request<{ success: boolean }>(`/api/admin/holidays/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteHoliday: (id: string) => request<{ success: boolean }>(`/api/admin/holidays/${id}`, { method: 'DELETE' }),
    addAttendance: (data: any) => request<{ success: boolean; id: string }>('/api/admin/attendance', { method: 'POST', body: JSON.stringify(data) }),
    updateAttendance: (id: string, data: any) => request<{ success: boolean }>(`/api/admin/attendance/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    createNextCutoffSchedule: (data: any) => request<any>('/api/admin/schedules/create-next-cutoff', { method: 'POST', body: JSON.stringify(data) }),
    updatePayrollStatus: (periodId: string, status: PayrollStatus) =>
      request<{ success: boolean; status: PayrollStatus }>('/api/admin/payroll/status', {
        method: 'POST',
        body: JSON.stringify({ periodId, status }),
      }),
  },

  // Employee APIs
  employee: {
    getPeriods: () => request<PayrollPeriod[]>('/api/employee/periods'),
    getPayrollPeriods: () => request<PayrollPeriod[]>('/api/employee/payroll-periods'),
    getDashboard: () =>
      request<{
        employeeName: string;
        employeeId: string;
        position: string;
        businessName: string;
        todaySchedule: Partial<Schedule>;
        todayAttendance: AttendanceRecord | null;
        currentServerTime: string;
      }>('/api/employee/dashboard'),
    clock: (action: AttendanceAction) =>
      request<{ success: boolean; attendance: AttendanceRecord }>('/api/employee/clock', {
        method: 'POST',
        body: JSON.stringify({ action }),
      }),
    getSchedules: (periodId?: string) => {
      const q = periodId ? `?periodId=${periodId}` : '';
      return request<Schedule[]>(`/api/employee/schedules${q}`);
    },
    getAttendance: (periodId?: string) => {
      const q = periodId ? `?periodId=${periodId}` : '';
      return request<{ period: PayrollPeriod; attendance: (AttendanceRecord & { scheduledTime: string })[] }>(
        `/api/employee/attendance${q}`
      );
    },
    getPayroll: (periodId?: string) => {
      const q = periodId ? `?periodId=${periodId}` : '';
      return request<PayrollRecord>(`/api/employee/payroll${q}`);
    },
    approvePayroll: (periodId: string) =>
      request<{ success: boolean; approvedAt: string }>('/api/employee/payroll/approve', {
        method: 'POST',
        body: JSON.stringify({ periodId }),
      }),
  },
};
