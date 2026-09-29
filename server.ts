import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
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
} from './src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// -------------------------------------------------------------
// Database Interfaces
// -------------------------------------------------------------

interface AuthAccount {
  userId: string;
  loginId: string;
  mobileLogin: string | null;
  passwordHash: string;
  mustChangePassword: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AuthSession {
  tokenHash: string;
  userId: string;
  role: 'super_admin' | 'employee';
  employeeId: string;
  expiresAt: number;
}

interface DatabaseSchema {
  accounts: Record<string, AuthAccount>;
  sessions: Record<string, AuthSession>;
  businesses: Record<string, Business>;
  users: Record<string, User>;
  employees: Record<string, Employee>;
  payrollPeriods: Record<string, PayrollPeriod>;
  schedules: Record<string, Schedule>;
  attendance: Record<string, AttendanceRecord>;
  deductionTypes: Record<string, DeductionType>;
  employeeDeductions: Record<string, EmployeeDeduction>;
  incentivePrograms: Record<string, IncentiveProgram>;
  payrollApprovals: Record<string, { approvedAt: string; employeeId: string }>; // key: `${periodId}_${employeeId}`
}

const DATA_DIR = path.resolve(__dirname, '.data');
const DB_FILE = path.resolve(DATA_DIR, 'cvlog_db.json');

// -------------------------------------------------------------
// Crypto & Auth Helpers
// -------------------------------------------------------------

function normalizeLogin(value: string) {
  return value.trim().toLowerCase();
}

function normalizeMobile(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

function hashPassword(password: string, salt = randomBytes(16).toString('hex'), minimumLength = 4) {
  if (password.length < minimumLength) {
    throw new Error(`Password must be at least ${minimumLength} characters.`);
  }
  const derived = scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

function verifyPassword(password: string, stored: string) {
  try {
    const [algorithm, salt, expectedHex] = String(stored || '').split(':');
    if (algorithm !== 'scrypt' || !salt || !expectedHex) return false;

    const expected = Buffer.from(expectedHex, 'hex');
    if (expected.length === 0) return false;

    const actual = scryptSync(password, salt, expected.length);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function createSessionToken() {
  return randomBytes(32).toString('base64url');
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

// -------------------------------------------------------------
// Initial Seed Data Setup
// -------------------------------------------------------------

function generateSeedData(): DatabaseSchema {
  const now = new Date().toISOString();

  // Businesses
  const businesses: Record<string, Business> = {
    biz_cvg: {
      id: 'biz_cvg',
      name: 'CV Group of Companies',
      code: 'CVG',
      address: 'Central Commercial Center, BGC, Taguig City',
      contactNumber: '+63 917 888 1000',
      status: 'active',
      createdAt: '2026-01-01T00:00:00Z',
    },
    biz_ilk: {
      id: 'biz_ilk',
      name: 'iLuvKeyks Coffee & Tea',
      code: 'ILK',
      address: 'Unit 102, Commercial Strip, Taguig City',
      contactNumber: '+63 917 888 2000',
      status: 'active',
      createdAt: '2026-01-15T00:00:00Z',
    },
    biz_hpw: {
      id: 'biz_hpw',
      name: 'HydraPure Water Refilling Station',
      code: 'HPW',
      address: 'Blk 4 Lot 12, Commercial Hub, Pasig City',
      contactNumber: '+63 918 555 3000',
      status: 'active',
      createdAt: '2026-02-01T00:00:00Z',
    },
  };

  // Users & Accounts
  const users: Record<string, User> = {
    usr_admin: {
      id: 'usr_admin',
      employeeId: 'CVG-ADM-001',
      fullName: 'Carlos Valderama',
      email: 'admin@cvgroup.com',
      mobileNumber: '+63 917 888 1234',
      role: 'super_admin',
      status: 'active',
      mustChangePassword: false,
      createdAt: now,
    },
    usr_joshua: {
      id: 'usr_joshua',
      employeeId: 'ILK-EMP-101',
      fullName: 'Joshua De Leon',
      email: 'joshua.deleon@iluvkeyks.com',
      mobileNumber: '+63 920 123 4567',
      role: 'employee',
      businessId: 'biz_ilk',
      status: 'active',
      mustChangePassword: true,
      createdAt: now,
    },
    usr_maria: {
      id: 'usr_maria',
      employeeId: 'HPW-EMP-201',
      fullName: 'Maria Elena Santos',
      email: 'maria.santos@hydrapure.com',
      mobileNumber: '+63 918 555 6789',
      role: 'employee',
      businessId: 'biz_hpw',
      status: 'active',
      mustChangePassword: true,
      createdAt: now,
    },
    usr_rico: {
      id: 'usr_rico',
      employeeId: 'HPW-EMP-202',
      fullName: 'Rico Bautista',
      email: 'rico.bautista@hydrapure.com',
      mobileNumber: '+63 929 444 8899',
      role: 'employee',
      businessId: 'biz_hpw',
      status: 'active',
      mustChangePassword: true,
      createdAt: now,
    },
  };

  const accounts: Record<string, AuthAccount> = {
    usr_admin: {
      userId: 'usr_admin',
      loginId: 'cvg-adm-001',
      mobileLogin: '9178881234',
      passwordHash: hashPassword('AdminPassword123!'),
      mustChangePassword: false,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    usr_joshua: {
      userId: 'usr_joshua',
      loginId: 'ilk-emp-101',
      mobileLogin: '9201234567',
      passwordHash: hashPassword(normalizeLogin('ILK-EMP-101'), undefined, 1),
      mustChangePassword: true,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    usr_maria: {
      userId: 'usr_maria',
      loginId: 'hpw-emp-201',
      mobileLogin: '9185556789',
      passwordHash: hashPassword(normalizeLogin('HPW-EMP-201'), undefined, 1),
      mustChangePassword: true,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    usr_rico: {
      userId: 'usr_rico',
      loginId: 'hpw-emp-202',
      mobileLogin: '9294448899',
      passwordHash: hashPassword(normalizeLogin('HPW-EMP-202'), undefined, 1),
      mustChangePassword: true,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
  };

  // Employees
  const employees: Record<string, Employee> = {
    emp_joshua: {
      id: 'emp_joshua',
      userId: 'usr_joshua',
      employeeId: 'ILK-EMP-101',
      businessId: 'biz_ilk',
      fullName: 'Joshua De Leon',
      mobileNumber: '+63 920 123 4567',
      email: 'joshua.deleon@iluvkeyks.com',
      position: 'Barista / Shift Lead',
      employmentStatus: 'regular',
      dateHired: '2025-03-01',
      dailyRate: 650,
      requiredHoursPerDay: 8,
      status: 'active',
    },
    emp_maria: {
      id: 'emp_maria',
      userId: 'usr_maria',
      employeeId: 'HPW-EMP-201',
      businessId: 'biz_hpw',
      fullName: 'Maria Elena Santos',
      mobileNumber: '+63 918 555 6789',
      email: 'maria.santos@hydrapure.com',
      position: 'Branch Operations Supervisor',
      employmentStatus: 'regular',
      dateHired: '2025-01-15',
      dailyRate: 780,
      requiredHoursPerDay: 8,
      status: 'active',
    },
    emp_rico: {
      id: 'emp_rico',
      userId: 'usr_rico',
      employeeId: 'HPW-EMP-202',
      businessId: 'biz_hpw',
      fullName: 'Rico Bautista',
      mobileNumber: '+63 929 444 8899',
      email: 'rico.bautista@hydrapure.com',
      position: 'Delivery & Maintenance Specialist',
      employmentStatus: 'regular',
      dateHired: '2025-04-10',
      dailyRate: 580,
      requiredHoursPerDay: 8,
      status: 'active',
    },
  };

  // Payroll Periods
  const payrollPeriods: Record<string, PayrollPeriod> = {
    period_curr: {
      id: 'period_curr',
      name: 'September 16–30, 2026',
      startDate: '2026-09-16',
      endDate: '2026-09-30',
      payoutDate: '2026-10-05',
      status: 'for_approval',
    },
    period_next: {
      id: 'period_next',
      name: 'October 1–15, 2026',
      startDate: '2026-10-01',
      endDate: '2026-10-15',
      payoutDate: '2026-10-20',
      status: 'open',
    },
  };

  // Schedules for Joshua (period_curr)
  const schedules: Record<string, Schedule> = {};
  const dates = [
    { date: '2026-09-16', in: '08:00', out: '17:00', duty: true },
    { date: '2026-09-17', in: '08:00', out: '17:00', duty: true },
    { date: '2026-09-18', in: '10:00', out: '19:00', duty: true },
    { date: '2026-09-19', in: '08:00', out: '17:00', duty: true },
    { date: '2026-09-20', in: '', out: '', duty: false }, // OFF
    { date: '2026-09-21', in: '12:00', out: '21:00', duty: true },
    { date: '2026-09-22', in: '08:00', out: '17:00', duty: true },
    { date: '2026-09-23', in: '08:00', out: '17:00', duty: true },
    { date: '2026-09-24', in: '08:00', out: '17:00', duty: true },
    { date: '2026-09-25', in: '08:00', out: '17:00', duty: true },
    { date: '2026-09-26', in: '10:00', out: '19:00', duty: true },
    { date: '2026-09-27', in: '', out: '', duty: false }, // OFF
    { date: '2026-09-28', in: '08:00', out: '17:00', duty: true },
    { date: '2026-09-29', in: '08:00', out: '17:00', duty: true },
    { date: '2026-09-30', in: '08:00', out: '17:00', duty: true },
  ];

  dates.forEach((d) => {
    const id = `sched_joshua_${d.date}`;
    schedules[id] = {
      id,
      employeeId: 'emp_joshua',
      payrollPeriodId: 'period_curr',
      date: d.date,
      requiredTimeIn: d.duty ? d.in : undefined,
      requiredTimeOut: d.duty ? d.out : undefined,
      breakOut: d.duty ? '12:00' : undefined,
      breakIn: d.duty ? '13:00' : undefined,
      isWorkingDay: d.duty,
      notes: d.duty ? 'Regular Shift' : 'Weekly Scheduled Rest Day',
    };

    // Maria's schedule too
    const mariaId = `sched_maria_${d.date}`;
    schedules[mariaId] = {
      id: mariaId,
      employeeId: 'emp_maria',
      payrollPeriodId: 'period_curr',
      date: d.date,
      requiredTimeIn: d.duty ? '08:30' : undefined,
      requiredTimeOut: d.duty ? '17:30' : undefined,
      breakOut: d.duty ? '12:00' : undefined,
      breakIn: d.duty ? '13:00' : undefined,
      isWorkingDay: d.duty,
      notes: d.duty ? 'Branch Duty' : 'OFF',
    };
  });

  // Attendance Records
  const attendance: Record<string, AttendanceRecord> = {
    att_joshua_16: {
      id: 'att_joshua_16',
      employeeId: 'emp_joshua',
      businessId: 'biz_ilk',
      date: '2026-09-16',
      timeIn: '2026-09-16T07:58:00Z',
      breakOut: '2026-09-16T12:00:00Z',
      breakIn: '2026-09-16T13:00:00Z',
      timeOut: '2026-09-16T17:02:00Z',
      lateMinutes: 0,
      totalWorkMinutes: 484,
      status: 'present',
    },
    att_joshua_17: {
      id: 'att_joshua_17',
      employeeId: 'emp_joshua',
      businessId: 'biz_ilk',
      date: '2026-09-17',
      timeIn: '2026-09-17T08:05:00Z', // 5 mins late
      breakOut: '2026-09-17T12:00:00Z',
      breakIn: '2026-09-17T13:00:00Z',
      timeOut: '2026-09-17T17:00:00Z',
      lateMinutes: 5,
      totalWorkMinutes: 475,
      status: 'late',
    },
    att_joshua_18: {
      id: 'att_joshua_18',
      employeeId: 'emp_joshua',
      businessId: 'biz_ilk',
      date: '2026-09-18',
      timeIn: '2026-09-18T09:55:00Z',
      breakOut: '2026-09-18T13:00:00Z',
      breakIn: '2026-09-18T14:00:00Z',
      timeOut: '2026-09-18T19:00:00Z',
      lateMinutes: 0,
      totalWorkMinutes: 485,
      status: 'present',
    },
    att_maria_16: {
      id: 'att_maria_16',
      employeeId: 'emp_maria',
      businessId: 'biz_hpw',
      date: '2026-09-16',
      timeIn: '2026-09-16T08:25:00Z',
      breakOut: '2026-09-16T12:00:00Z',
      breakIn: '2026-09-16T13:00:00Z',
      timeOut: '2026-09-16T17:35:00Z',
      lateMinutes: 0,
      totalWorkMinutes: 490,
      status: 'present',
    },
  };

  // Deductions
  const deductionTypes: Record<string, DeductionType> = {
    ded_sss: {
      id: 'ded_sss',
      businessId: 'all',
      name: 'SSS Contribution',
      calculationType: 'fixed',
      value: 500,
      recurring: true,
      status: 'active',
    },
    ded_philhealth: {
      id: 'ded_philhealth',
      businessId: 'all',
      name: 'PhilHealth',
      calculationType: 'fixed',
      value: 250,
      recurring: true,
      status: 'active',
    },
    ded_pagibig: {
      id: 'ded_pagibig',
      businessId: 'all',
      name: 'Pag-IBIG Fund',
      calculationType: 'fixed',
      value: 100,
      recurring: true,
      status: 'active',
    },
  };

  const employeeDeductions: Record<string, EmployeeDeduction> = {
    emp_ded_1: {
      id: 'emp_ded_1',
      employeeId: 'emp_joshua',
      deductionName: 'Uniform & Apron Set',
      amount: 450,
      payrollPeriodId: 'period_curr',
      recurring: false,
      status: 'active',
    },
  };

  // Incentive Programs
  const incentivePrograms: Record<string, IncentiveProgram> = {
    inc_perf_ilk: {
      id: 'inc_perf_ilk',
      businessId: 'biz_ilk',
      name: 'iLuvKeyks Perfect Attendance Incentive',
      description: 'Awarded for complete presence on all required duty days with zero late arrivals.',
      amount: 1200,
      requireNoLate: true,
      requireNoAbsence: true,
      status: 'active',
      effectiveDate: '2026-01-01',
    },
    inc_perf_hpw: {
      id: 'inc_perf_hpw',
      businessId: 'biz_hpw',
      name: 'HydraPure Reliability Incentive',
      description: 'Attendance incentive for full attendance across all scheduled duty dates.',
      amount: 1500,
      requireNoLate: false,
      requireNoAbsence: true,
      status: 'active',
      effectiveDate: '2026-01-01',
    },
  };

  return {
    accounts,
    sessions: {},
    businesses,
    users,
    employees,
    payrollPeriods,
    schedules,
    attendance,
    deductionTypes,
    employeeDeductions,
    incentivePrograms,
    payrollApprovals: {},
  };
}

function initDatabase(): DatabaseSchema {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(content) as DatabaseSchema;
      if (parsed.businesses && parsed.employees) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[CV Log] Could not read existing DB file; re-seeding:', err);
  }

  const initial = generateSeedData();
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[CV Log] Failed to write seed file:', err);
  }
  return initial;
}

const db: DatabaseSchema = initDatabase();

let persistTimer: NodeJS.Timeout | null = null;
function persistDB() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[CV Log] Error saving to db file:', err);
    }
  }, 100);
}

// -------------------------------------------------------------
// Payroll Engine (Calculation per requirements 7, 8, 12, 16, 17)
// -------------------------------------------------------------

function calculateEmployeePayroll(employeeId: string, periodId: string): PayrollRecord {
  const employee = db.employees[employeeId];
  const period = db.payrollPeriods[periodId];
  const business = employee ? db.businesses[employee.businessId] : undefined;

  if (!employee || !period) {
    throw new Error('Employee or Payroll Period not found');
  }

  // 1. Schedules in this period
  const schedulesInPeriod = Object.values(db.schedules).filter(
    (s) => s.employeeId === employeeId && s.payrollPeriodId === periodId
  );
  const dutySchedules = schedulesInPeriod.filter((s) => s.isWorkingDay);
  const scheduledDutyDays = dutySchedules.length;

  // 2. Attendance records in this period
  const attendanceInPeriod = Object.values(db.attendance).filter(
    (a) => a.employeeId === employeeId && a.date >= period.startDate && a.date <= period.endDate
  );

  let daysWorked = 0;
  let lateMinutesTotal = 0;
  const attendanceBreakdown: Array<{ date: string; status: any; lateMinutes: number; hours: number }> = [];

  for (const s of dutySchedules) {
    const record = attendanceInPeriod.find((a) => a.date === s.date);
    if (record && (record.status === 'present' || record.status === 'late' || record.timeIn)) {
      daysWorked += 1;
      lateMinutesTotal += record.lateMinutes || 0;
      attendanceBreakdown.push({
        date: s.date,
        status: record.status,
        lateMinutes: record.lateMinutes || 0,
        hours: Math.round(((record.totalWorkMinutes || 0) / 60) * 10) / 10,
      });
    } else {
      attendanceBreakdown.push({
        date: s.date,
        status: 'absent',
        lateMinutes: 0,
        hours: 0,
      });
    }
  }

  // Basic Pay Calculation
  const minuteRate = employee.dailyRate / (Math.max(1, employee.requiredHoursPerDay) * 60);
  const lateDeductionTotal = Math.round(lateMinutesTotal * minuteRate * 100) / 100;
  const rawBasic = daysWorked * employee.dailyRate;
  const basicPay = Math.max(0, Math.round((rawBasic - lateDeductionTotal) * 100) / 100);

  // 3. Incentives Qualification (Requirement 8)
  const incentivesQualified: Array<{ name: string; amount: number }> = [];
  let incentivePay = 0;

  const activePrograms = Object.values(db.incentivePrograms).filter(
    (inc) => inc.status === 'active' && (inc.businessId === employee.businessId || inc.businessId === 'all')
  );

  for (const inc of activePrograms) {
    let qualified = true;

    // Check attendance on required scheduled duty days
    for (const s of dutySchedules) {
      const record = attendanceInPeriod.find((a) => a.date === s.date);
      const isPresent = record && (record.status === 'present' || record.status === 'late');

      if (inc.requireNoAbsence && !isPresent) {
        qualified = false;
        break;
      }
      if (inc.requireNoLate && record && record.lateMinutes > 0) {
        qualified = false;
        break;
      }
    }

    // Must have at least 1 duty day scheduled and completed
    if (scheduledDutyDays === 0 || daysWorked === 0) {
      qualified = false;
    }

    if (qualified) {
      incentivesQualified.push({ name: inc.name, amount: inc.amount });
      incentivePay += inc.amount;
    }
  }

  const grossPay = Math.round((basicPay + incentivePay) * 100) / 100;

  // 4. Deductions (Requirement 7)
  const deductionsBreakdown: Array<{ name: string; amount: number; type: 'employee' | 'recurring' }> = [];
  let employeeDeductionsTotal = 0;
  let recurringDeductionsTotal = 0;

  // Employee specific
  const empDeds = Object.values(db.employeeDeductions).filter(
    (d) =>
      d.employeeId === employeeId &&
      d.status === 'active' &&
      (d.recurring || d.payrollPeriodId === periodId)
  );

  for (const d of empDeds) {
    employeeDeductionsTotal += d.amount;
    deductionsBreakdown.push({ name: d.deductionName, amount: d.amount, type: 'employee' });
  }

  // Common Recurring Deductions for Business
  const commonDeds = Object.values(db.deductionTypes).filter(
    (d) => d.status === 'active' && (d.businessId === employee.businessId || d.businessId === 'all')
  );

  for (const d of commonDeds) {
    let amount = 0;
    if (d.calculationType === 'fixed') {
      amount = d.value;
    } else if (d.calculationType === 'percentage') {
      amount = Math.round(((grossPay * d.value) / 100) * 100) / 100;
    }
    recurringDeductionsTotal += amount;
    deductionsBreakdown.push({ name: d.name, amount, type: 'recurring' });
  }

  const totalDeductions = Math.round((employeeDeductionsTotal + recurringDeductionsTotal) * 100) / 100;
  const netPay = Math.max(0, Math.round((grossPay - totalDeductions) * 100) / 100);

  const approvalKey = `${periodId}_${employeeId}`;
  const approval = db.payrollApprovals[approvalKey];

  return {
    id: `pay_${periodId}_${employeeId}`,
    payrollPeriodId: periodId,
    employeeId,
    businessId: employee.businessId,
    employeeName: employee.fullName,
    businessName: business?.name || 'CV Group',
    position: employee.position,
    dailyRate: employee.dailyRate,
    scheduledDutyDays,
    daysWorked,
    lateMinutesTotal,
    basicPay,
    incentivePay,
    employeeDeductionsTotal,
    recurringDeductionsTotal,
    totalDeductions,
    grossPay,
    netPay,
    status: period.status,
    employeeApprovedAt: approval?.approvedAt,
    finalizedAt: period.status === 'finalized' ? period.payoutDate : undefined,
    breakdown: {
      incentives: incentivesQualified,
      deductions: deductionsBreakdown,
      attendanceDays: attendanceBreakdown,
    },
  };
}

// -------------------------------------------------------------
// Authentication & Authorization Middlewares
// -------------------------------------------------------------

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    employeeId: string;
    role: 'super_admin' | 'employee';
    employeeDbId?: string; // Employee table ID
    businessId?: string;
  };
}

function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: 'Unauthorized: Missing token' });
    return;
  }

  const tokenHash = hashToken(token);
  const session = db.sessions[tokenHash];

  if (!session || session.expiresAt <= Date.now()) {
    if (session) delete db.sessions[tokenHash];
    res.status(401).json({ error: 'Unauthorized: Session expired' });
    return;
  }

  const employee = Object.values(db.employees).find((e) => e.userId === session.userId);

  req.user = {
    userId: session.userId,
    employeeId: session.employeeId,
    role: session.role,
    employeeDbId: employee?.id,
    businessId: employee?.businessId,
  };

  next();
}

function superAdminOnly(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'super_admin') {
    res.status(403).json({ error: 'Forbidden: Super Admin access required' });
    return;
  }
  next();
}

function employeeOnly(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'employee') {
    res.status(403).json({ error: 'Forbidden: Employee access required' });
    return;
  }
  next();
}

// -------------------------------------------------------------
// Main Application Server
// -------------------------------------------------------------

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  const noCache = (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  };

  // ===========================================================
  // PUBLIC & AUTHENTICATION ENDPOINTS
  // ===========================================================

  app.get('/api/auth/status', noCache, (_req: Request, res: Response) => {
    const hasAdmin = Object.values(db.users).some((u) => u.role === 'super_admin' && u.status === 'active');
    res.json({ hasAccounts: hasAdmin });
  });

  app.post('/api/auth/login', noCache, (req: Request, res: Response) => {
    const rawLogin = String(req.body.loginId || '');
    const loginId = normalizeLogin(rawLogin);
    const mobile = normalizeMobile(rawLogin);
    const password = String(req.body.password || '');

    if (!loginId || !password) {
      res.status(400).json({ error: 'Employee ID or Mobile and password are required.' });
      return;
    }

    // Find account by loginId or mobileLogin
    let account = Object.values(db.accounts).find(
      (a) => a.loginId === loginId || (mobile && mobile.length >= 10 && a.mobileLogin === mobile)
    );

    // If account not found, check if an employee exists with default temporary password
    if (!account) {
      const user = Object.values(db.users).find(
        (u) =>
          normalizeLogin(u.employeeId) === loginId ||
          (mobile && mobile.length >= 10 && normalizeMobile(u.mobileNumber) === mobile)
      );

      if (user && normalizeLogin(password) === normalizeLogin(user.employeeId)) {
        account = {
          userId: user.id,
          loginId: normalizeLogin(user.employeeId),
          mobileLogin: user.mobileNumber ? normalizeMobile(user.mobileNumber) : null,
          passwordHash: hashPassword(normalizeLogin(user.employeeId), undefined, 1),
          mustChangePassword: true,
          isActive: user.status === 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        db.accounts[user.id] = account;
        persistDB();
      }
    }

    if (!account || !account.isActive) {
      res.status(401).json({ error: 'Invalid credentials or inactive account.' });
      return;
    }

    const isValidPassword =
      verifyPassword(password, account.passwordHash) ||
      verifyPassword(normalizeLogin(password), account.passwordHash);

    if (!isValidPassword) {
      res.status(401).json({ error: 'Invalid credentials.' });
      return;
    }

    const user = db.users[account.userId];
    if (!user) {
      res.status(401).json({ error: 'User profile not found.' });
      return;
    }

    const token = createSessionToken();
    db.sessions[hashToken(token)] = {
      tokenHash: hashToken(token),
      userId: account.userId,
      role: user.role,
      employeeId: user.employeeId,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    };
    persistDB();

    res.json({
      token,
      userId: account.userId,
      role: user.role,
      fullName: user.fullName,
      employeeId: user.employeeId,
      mustChangePassword: account.mustChangePassword,
    });
  });

  app.get('/api/auth/session', noCache, authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const user = db.users[req.user!.userId];
    const account = db.accounts[req.user!.userId];
    const employee = Object.values(db.employees).find((e) => e.userId === req.user!.userId);
    const business = employee ? db.businesses[employee.businessId] : undefined;

    res.json({
      authenticated: true,
      userId: req.user!.userId,
      employeeId: user?.employeeId,
      fullName: user?.fullName,
      email: user?.email,
      role: req.user!.role,
      mustChangePassword: account?.mustChangePassword ?? false,
      businessName: business?.name,
      businessId: employee?.businessId,
    });
  });

  app.post('/api/auth/logout', noCache, (req: Request, res: Response) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (token) {
      delete db.sessions[hashToken(token)];
      persistDB();
    }
    res.json({ success: true });
  });

  app.post('/api/auth/change-password', noCache, authMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const account = db.accounts[req.user!.userId];
    if (!account) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }

    const currentPassword = String(req.body.currentPassword || '');
    const newPassword = String(req.body.newPassword || '');

    if (newPassword.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters.' });
      return;
    }

    const passwordToVerify = account.mustChangePassword ? normalizeLogin(currentPassword) : currentPassword;
    if (!verifyPassword(passwordToVerify, account.passwordHash)) {
      res.status(400).json({ error: 'Current password is incorrect.' });
      return;
    }

    account.passwordHash = hashPassword(newPassword);
    account.mustChangePassword = false;
    account.updatedAt = new Date().toISOString();

    const user = db.users[req.user!.userId];
    if (user) user.mustChangePassword = false;

    persistDB();
    res.json({ success: true });
  });

  // Setup initial super admin if none exists
  app.post('/api/auth/setup', noCache, (req: Request, res: Response) => {
    const hasAdmin = Object.values(db.users).some((u) => u.role === 'super_admin' && u.status === 'active');
    if (hasAdmin) {
      res.status(403).json({ error: 'Initial administrator setup has already been completed.' });
      return;
    }

    const { fullName, employeeId, email, mobileNumber, password } = req.body;
    if (!fullName || !employeeId || !password) {
      res.status(400).json({ error: 'Name, employee ID, and password are required.' });
      return;
    }

    const userId = 'usr_admin';
    const loginId = normalizeLogin(employeeId);

    db.users[userId] = {
      id: userId,
      employeeId,
      fullName,
      email: email || '',
      mobileNumber: mobileNumber || '',
      role: 'super_admin',
      status: 'active',
      mustChangePassword: false,
      createdAt: new Date().toISOString(),
    };

    db.accounts[userId] = {
      userId,
      loginId,
      mobileLogin: mobileNumber ? normalizeMobile(mobileNumber) : null,
      passwordHash: hashPassword(password),
      mustChangePassword: false,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    persistDB();
    res.json({ success: true });
  });

  // ===========================================================
  // SUPER ADMIN APIS
  // ===========================================================

  // Dashboard Summary
  app.get('/api/admin/dashboard', noCache, authMiddleware, superAdminOnly, (_req: Request, res: Response) => {
    const businessesCount = Object.values(db.businesses).filter((b) => b.status === 'active').length;
    const activeEmployeesCount = Object.values(db.employees).filter((e) => e.status === 'active').length;

    // Today's attendance - employees currently timed in (has timeIn but no timeOut)
    const today = new Date().toISOString().slice(0, 10);
    const timedInEmployees = Object.values(db.attendance).filter(
      (a) => a.date === today && a.timeIn && !a.timeOut
    ).length;

    // Current Payroll Cutoff
    const sortedPeriods = Object.values(db.payrollPeriods).sort((a, b) => b.startDate.localeCompare(a.startDate));
    const currentPeriod =
      sortedPeriods.find((p) => p.status === 'open' || p.status === 'for_approval') || sortedPeriods[0];

    res.json({
      businessesCount,
      activeEmployeesCount,
      timedInEmployees,
      currentCutoff: currentPeriod ? currentPeriod.name : 'No active cutoff',
      payrollStatus: currentPeriod ? currentPeriod.status : 'None',
      periodId: currentPeriod?.id,
    });
  });

  // Businesses CRUD
  app.get('/api/admin/businesses', noCache, authMiddleware, superAdminOnly, (_req: Request, res: Response) => {
    res.json(Object.values(db.businesses));
  });

  app.post('/api/admin/businesses', noCache, authMiddleware, superAdminOnly, (req: Request, res: Response) => {
    const { name, code, address, contactNumber, status = 'active' } = req.body;
    if (!name || !code) {
      res.status(400).json({ error: 'Business name and code are required.' });
      return;
    }
    const id = `biz_${randomBytes(6).toString('hex')}`;
    const business: Business = {
      id,
      name,
      code: code.toUpperCase(),
      address: address || '',
      contactNumber: contactNumber || '',
      status,
      createdAt: new Date().toISOString(),
    };
    db.businesses[id] = business;
    persistDB();
    res.json(business);
  });

  app.put('/api/admin/businesses/:id', noCache, authMiddleware, superAdminOnly, (req: Request, res: Response) => {
    const id = req.params.id;
    const b = db.businesses[id];
    if (!b) {
      res.status(404).json({ error: 'Business not found.' });
      return;
    }
    const { name, code, address, contactNumber, status } = req.body;
    if (name) b.name = name;
    if (code) b.code = code.toUpperCase();
    if (address !== undefined) b.address = address;
    if (contactNumber !== undefined) b.contactNumber = contactNumber;
    if (status) b.status = status;

    persistDB();
    res.json(b);
  });

  // Employees CRUD
  app.get('/api/admin/employees', noCache, authMiddleware, superAdminOnly, (_req: Request, res: Response) => {
    const employees = Object.values(db.employees).map((emp) => {
      const b = db.businesses[emp.businessId];
      return {
        ...emp,
        businessName: b?.name || 'Unassigned',
      };
    });
    res.json(employees);
  });

  app.post('/api/admin/employees', noCache, authMiddleware, superAdminOnly, (req: Request, res: Response) => {
    const {
      employeeId,
      fullName,
      mobileNumber = '',
      email = '',
      position,
      employmentStatus = 'regular',
      dateHired = new Date().toISOString().slice(0, 10),
      businessId,
      dailyRate = 600,
      requiredHoursPerDay = 8,
      status = 'active',
    } = req.body;

    if (!employeeId || !fullName || !businessId) {
      res.status(400).json({ error: 'Employee ID, full name, and business are required.' });
      return;
    }

    if (Object.values(db.employees).some((e) => normalizeLogin(e.employeeId) === normalizeLogin(employeeId))) {
      res.status(400).json({ error: 'An employee with this Employee ID already exists.' });
      return;
    }

    const userId = `usr_${randomBytes(6).toString('hex')}`;
    const empId = `emp_${randomBytes(6).toString('hex')}`;

    // 1. Create User
    db.users[userId] = {
      id: userId,
      employeeId,
      fullName,
      email,
      mobileNumber,
      role: 'employee',
      businessId,
      status,
      mustChangePassword: true,
      createdAt: new Date().toISOString(),
    };

    // 2. Create Account with temporary password = employeeId
    db.accounts[userId] = {
      userId,
      loginId: normalizeLogin(employeeId),
      mobileLogin: mobileNumber ? normalizeMobile(mobileNumber) : null,
      passwordHash: hashPassword(normalizeLogin(employeeId), undefined, 1),
      mustChangePassword: true,
      isActive: status === 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 3. Create Employee
    const employee: Employee = {
      id: empId,
      userId,
      employeeId,
      businessId,
      fullName,
      mobileNumber,
      email,
      position: position || 'Staff',
      employmentStatus,
      dateHired,
      dailyRate: Number(dailyRate) || 600,
      requiredHoursPerDay: Number(requiredHoursPerDay) || 8,
      status,
    };
    db.employees[empId] = employee;
    persistDB();

    res.json(employee);
  });

  app.put('/api/admin/employees/:id', noCache, authMiddleware, superAdminOnly, (req: Request, res: Response) => {
    const id = req.params.id;
    const emp = db.employees[id];
    if (!emp) {
      res.status(404).json({ error: 'Employee not found.' });
      return;
    }

    const {
      fullName,
      mobileNumber,
      email,
      position,
      employmentStatus,
      dateHired,
      businessId,
      dailyRate,
      requiredHoursPerDay,
      status,
    } = req.body;

    if (fullName) emp.fullName = fullName;
    if (mobileNumber !== undefined) emp.mobileNumber = mobileNumber;
    if (email !== undefined) emp.email = email;
    if (position) emp.position = position;
    if (employmentStatus) emp.employmentStatus = employmentStatus;
    if (dateHired) emp.dateHired = dateHired;
    if (businessId) emp.businessId = businessId;
    if (dailyRate !== undefined) emp.dailyRate = Number(dailyRate);
    if (requiredHoursPerDay !== undefined) emp.requiredHoursPerDay = Number(requiredHoursPerDay);
    if (status) {
      emp.status = status;
      if (db.accounts[emp.userId]) {
        db.accounts[emp.userId].isActive = status === 'active';
      }
    }

    // Sync with User
    const user = db.users[emp.userId];
    if (user) {
      user.fullName = emp.fullName;
      user.email = emp.email;
      user.mobileNumber = emp.mobileNumber;
      user.businessId = emp.businessId;
      user.status = emp.status;
    }

    persistDB();
    res.json(emp);
  });

  // Reset employee password to Employee ID
  app.post('/api/admin/employees/:id/reset-password', noCache, authMiddleware, superAdminOnly, (req: Request, res: Response) => {
    const emp = db.employees[req.params.id];
    if (!emp) {
      res.status(404).json({ error: 'Employee not found.' });
      return;
    }

    const account = db.accounts[emp.userId];
    if (account) {
      account.passwordHash = hashPassword(normalizeLogin(emp.employeeId), undefined, 1);
      account.mustChangePassword = true;
      account.updatedAt = new Date().toISOString();
    }
    const user = db.users[emp.userId];
    if (user) user.mustChangePassword = true;

    persistDB();
    res.json({ success: true, message: `Password reset to temporary: ${emp.employeeId}` });
  });

  // Payroll Periods
  app.get('/api/admin/periods', noCache, authMiddleware, superAdminOnly, (_req: Request, res: Response) => {
    const list = Object.values(db.payrollPeriods).sort((a, b) => b.startDate.localeCompare(a.startDate));
    res.json(list);
  });

  app.post('/api/admin/periods', noCache, authMiddleware, superAdminOnly, (req: Request, res: Response) => {
    const { name, startDate, endDate, payoutDate, status = 'open' } = req.body;
    if (!startDate || !endDate || !payoutDate) {
      res.status(400).json({ error: 'Start date, end date, and payout date are required.' });
      return;
    }
    const id = `period_${randomBytes(6).toString('hex')}`;
    const period: PayrollPeriod = {
      id,
      name: name || `${startDate} to ${endDate}`,
      startDate,
      endDate,
      payoutDate,
      status,
    };
    db.payrollPeriods[id] = period;
    persistDB();
    res.json(period);
  });

  app.put('/api/admin/periods/:id', noCache, authMiddleware, superAdminOnly, (req: Request, res: Response) => {
    const p = db.payrollPeriods[req.params.id];
    if (!p) {
      res.status(404).json({ error: 'Payroll period not found.' });
      return;
    }
    const { name, startDate, endDate, payoutDate, status } = req.body;
    if (name) p.name = name;
    if (startDate) p.startDate = startDate;
    if (endDate) p.endDate = endDate;
    if (payoutDate) p.payoutDate = payoutDate;
    if (status) p.status = status;

    persistDB();
    res.json(p);
  });

  // Schedules (Section 5)
  app.get('/api/admin/schedules', noCache, authMiddleware, superAdminOnly, (req: Request, res: Response) => {
    const periodId = req.query.periodId as string;
    const employeeId = req.query.employeeId as string;

    let list = Object.values(db.schedules);
    if (periodId) list = list.filter((s) => s.payrollPeriodId === periodId);
    if (employeeId) list = list.filter((s) => s.employeeId === employeeId);

    // Join employee name
    const enriched = list.map((s) => ({
      ...s,
      employeeName: db.employees[s.employeeId]?.fullName || 'Unknown',
    }));

    res.json(enriched);
  });

  app.post('/api/admin/schedules', noCache, authMiddleware, superAdminOnly, (req: Request, res: Response) => {
    const {
      employeeId,
      payrollPeriodId,
      date,
      requiredTimeIn,
      requiredTimeOut,
      breakOut,
      breakIn,
      isWorkingDay = true,
      notes = '',
    } = req.body;

    if (!employeeId || !payrollPeriodId || !date) {
      res.status(400).json({ error: 'Employee, payroll period, and date are required.' });
      return;
    }

    // Find if already exists for this employee and date
    let existing = Object.values(db.schedules).find(
      (s) => s.employeeId === employeeId && s.date === date
    );

    if (existing) {
      existing.payrollPeriodId = payrollPeriodId;
      existing.requiredTimeIn = isWorkingDay ? requiredTimeIn : undefined;
      existing.requiredTimeOut = isWorkingDay ? requiredTimeOut : undefined;
      existing.breakOut = isWorkingDay ? breakOut : undefined;
      existing.breakIn = isWorkingDay ? breakIn : undefined;
      existing.isWorkingDay = isWorkingDay;
      existing.notes = notes;
      persistDB();
      res.json(existing);
      return;
    }

    const id = `sched_${randomBytes(6).toString('hex')}`;
    const schedule: Schedule = {
      id,
      employeeId,
      payrollPeriodId,
      date,
      requiredTimeIn: isWorkingDay ? requiredTimeIn : undefined,
      requiredTimeOut: isWorkingDay ? requiredTimeOut : undefined,
      breakOut: isWorkingDay ? breakOut : undefined,
      breakIn: isWorkingDay ? breakIn : undefined,
      isWorkingDay,
      notes,
    };
    db.schedules[id] = schedule;
    persistDB();
    res.json(schedule);
  });

  app.delete('/api/admin/schedules/:id', noCache, authMiddleware, superAdminOnly, (req: Request, res: Response) => {
    delete db.schedules[req.params.id];
    persistDB();
    res.json({ success: true });
  });

  // Attendance Records (Section 6)
  app.get('/api/admin/attendance', noCache, authMiddleware, superAdminOnly, (req: Request, res: Response) => {
    const { periodId, businessId, date } = req.query;
    let list = Object.values(db.attendance);

    if (date) {
      list = list.filter((a) => a.date === date);
    }
    if (businessId) {
      list = list.filter((a) => a.businessId === businessId);
    }
    if (periodId) {
      const period = db.payrollPeriods[periodId as string];
      if (period) {
        list = list.filter((a) => a.date >= period.startDate && a.date <= period.endDate);
      }
    }

    const enriched = list.map((a) => {
      const emp = db.employees[a.employeeId];
      const biz = db.businesses[a.businessId];
      return {
        ...a,
        employeeName: emp?.fullName || 'Unknown',
        employeeIdCode: emp?.employeeId || '',
        businessName: biz?.name || 'Unknown',
      };
    });

    res.json(enriched);
  });

  // Deductions - Recurring types
  app.get('/api/admin/deductions/types', noCache, authMiddleware, superAdminOnly, (_req: Request, res: Response) => {
    res.json(Object.values(db.deductionTypes));
  });

  app.post('/api/admin/deductions/types', noCache, authMiddleware, superAdminOnly, (req: Request, res: Response) => {
    const { businessId = 'all', name, calculationType = 'fixed', value, recurring = true, status = 'active' } = req.body;
    if (!name || value === undefined) {
      res.status(400).json({ error: 'Name and value are required.' });
      return;
    }
    const id = `ded_${randomBytes(6).toString('hex')}`;
    const type: DeductionType = {
      id,
      businessId,
      name,
      calculationType,
      value: Number(value),
      recurring,
      status,
    };
    db.deductionTypes[id] = type;
    persistDB();
    res.json(type);
  });

  app.put('/api/admin/deductions/types/:id', noCache, authMiddleware, superAdminOnly, (req: Request, res: Response) => {
    const d = db.deductionTypes[req.params.id];
    if (!d) {
      res.status(404).json({ error: 'Deduction type not found.' });
      return;
    }
    const { name, calculationType, value, recurring, status } = req.body;
    if (name) d.name = name;
    if (calculationType) d.calculationType = calculationType;
    if (value !== undefined) d.value = Number(value);
    if (recurring !== undefined) d.recurring = recurring;
    if (status) d.status = status;
    persistDB();
    res.json(d);
  });

  app.delete('/api/admin/deductions/types/:id', noCache, authMiddleware, superAdminOnly, (req: Request, res: Response) => {
    delete db.deductionTypes[req.params.id];
    persistDB();
    res.json({ success: true });
  });

  // Deductions - Employee Specific
  app.get('/api/admin/deductions/employee', noCache, authMiddleware, superAdminOnly, (req: Request, res: Response) => {
    const employeeId = req.query.employeeId as string;
    let list = Object.values(db.employeeDeductions);
    if (employeeId) list = list.filter((d) => d.employeeId === employeeId);

    const enriched = list.map((d) => ({
      ...d,
      employeeName: db.employees[d.employeeId]?.fullName || 'Unknown',
    }));
    res.json(enriched);
  });

  app.post('/api/admin/deductions/employee', noCache, authMiddleware, superAdminOnly, (req: Request, res: Response) => {
    const { employeeId, deductionName, amount, payrollPeriodId, recurring = false, status = 'active' } = req.body;
    if (!employeeId || !deductionName || amount === undefined) {
      res.status(400).json({ error: 'Employee, deduction name, and amount are required.' });
      return;
    }
    const id = `emp_ded_${randomBytes(6).toString('hex')}`;
    const deduction: EmployeeDeduction = {
      id,
      employeeId,
      deductionName,
      amount: Number(amount),
      payrollPeriodId: recurring ? undefined : payrollPeriodId,
      recurring,
      status,
    };
    db.employeeDeductions[id] = deduction;
    persistDB();
    res.json(deduction);
  });

  app.delete('/api/admin/deductions/employee/:id', noCache, authMiddleware, superAdminOnly, (req: Request, res: Response) => {
    delete db.employeeDeductions[req.params.id];
    persistDB();
    res.json({ success: true });
  });

  // Incentives CRUD (Section 8)
  app.get('/api/admin/incentives', noCache, authMiddleware, superAdminOnly, (_req: Request, res: Response) => {
    const list = Object.values(db.incentivePrograms).map((inc) => ({
      ...inc,
      businessName: inc.businessId === 'all' ? 'All Businesses' : db.businesses[inc.businessId]?.name || 'Unknown',
    }));
    res.json(list);
  });

  app.post('/api/admin/incentives', noCache, authMiddleware, superAdminOnly, (req: Request, res: Response) => {
    const {
      businessId,
      name,
      description = '',
      amount,
      requireNoLate = true,
      requireNoAbsence = true,
      status = 'active',
      effectiveDate = new Date().toISOString().slice(0, 10),
    } = req.body;

    if (!businessId || !name || amount === undefined) {
      res.status(400).json({ error: 'Business, name, and amount are required.' });
      return;
    }

    const id = `inc_${randomBytes(6).toString('hex')}`;
    const inc: IncentiveProgram = {
      id,
      businessId,
      name,
      description,
      amount: Number(amount),
      requireNoLate,
      requireNoAbsence,
      status,
      effectiveDate,
    };
    db.incentivePrograms[id] = inc;
    persistDB();
    res.json(inc);
  });

  app.put('/api/admin/incentives/:id', noCache, authMiddleware, superAdminOnly, (req: Request, res: Response) => {
    const inc = db.incentivePrograms[req.params.id];
    if (!inc) {
      res.status(404).json({ error: 'Incentive not found.' });
      return;
    }
    const { name, description, amount, requireNoLate, requireNoAbsence, status } = req.body;
    if (name) inc.name = name;
    if (description !== undefined) inc.description = description;
    if (amount !== undefined) inc.amount = Number(amount);
    if (requireNoLate !== undefined) inc.requireNoLate = requireNoLate;
    if (requireNoAbsence !== undefined) inc.requireNoAbsence = requireNoAbsence;
    if (status) inc.status = status;

    persistDB();
    res.json(inc);
  });

  app.delete('/api/admin/incentives/:id', noCache, authMiddleware, superAdminOnly, (req: Request, res: Response) => {
    delete db.incentivePrograms[req.params.id];
    persistDB();
    res.json({ success: true });
  });

  // Payroll Calculation & Management (Section 15)
  app.get('/api/admin/payroll/:periodId', noCache, authMiddleware, superAdminOnly, (req: Request, res: Response) => {
    const periodId = req.params.periodId;
    const period = db.payrollPeriods[periodId];
    if (!period) {
      res.status(404).json({ error: 'Payroll period not found.' });
      return;
    }

    const employees = Object.values(db.employees).filter((e) => e.status === 'active');
    const records = employees.map((emp) => calculateEmployeePayroll(emp.id, periodId));

    res.json({
      period,
      records,
    });
  });

  app.post('/api/admin/payroll/status', noCache, authMiddleware, superAdminOnly, (req: Request, res: Response) => {
    const { periodId, status } = req.body;
    const period = db.payrollPeriods[periodId];
    if (!period) {
      res.status(404).json({ error: 'Payroll period not found.' });
      return;
    }
    if (!['open', 'for_approval', 'approved', 'finalized'].includes(status)) {
      res.status(400).json({ error: 'Invalid payroll status.' });
      return;
    }

    period.status = status;
    persistDB();
    res.json({ success: true, status: period.status });
  });

  // ===========================================================
  // EMPLOYEE PORTAL APIS (STRICTLY SCOPED - Sections 9, 10, 11, 12, 13)
  // ===========================================================

  // Employee Dashboard (Section 9)
  app.get('/api/employee/dashboard', noCache, authMiddleware, employeeOnly, (req: AuthenticatedRequest, res: Response) => {
    const employeeDbId = req.user!.employeeDbId;
    if (!employeeDbId || !db.employees[employeeDbId]) {
      res.status(404).json({ error: 'Employee record not found.' });
      return;
    }
    const emp = db.employees[employeeDbId];
    const biz = db.businesses[emp.businessId];

    const today = new Date().toISOString().slice(0, 10);

    // Today's schedule
    const todaySchedule = Object.values(db.schedules).find(
      (s) => s.employeeId === employeeDbId && s.date === today
    );

    // Today's attendance
    const todayAttendance = Object.values(db.attendance).find(
      (a) => a.employeeId === employeeDbId && a.date === today
    );

    res.json({
      employeeName: emp.fullName,
      employeeId: emp.employeeId,
      position: emp.position,
      businessName: biz?.name || 'CV Group',
      todaySchedule: todaySchedule || { isWorkingDay: false, notes: 'No schedule assigned' },
      todayAttendance: todayAttendance || null,
      currentServerTime: new Date().toISOString(),
    });
  });

  // Clock in / Break out / Break in / Time out (Section 6 & 9)
  app.post('/api/employee/clock', noCache, authMiddleware, employeeOnly, (req: AuthenticatedRequest, res: Response) => {
    const employeeDbId = req.user!.employeeDbId!;
    const emp = db.employees[employeeDbId];
    if (!emp) {
      res.status(404).json({ error: 'Employee record not found.' });
      return;
    }

    const { action } = req.body;
    if (!['time_in', 'break_out', 'break_in', 'time_out'].includes(action)) {
      res.status(400).json({ error: 'Invalid clock action.' });
      return;
    }

    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const nowIso = now.toISOString();

    let record = Object.values(db.attendance).find(
      (a) => a.employeeId === employeeDbId && a.date === today
    );

    const schedule = Object.values(db.schedules).find(
      (s) => s.employeeId === employeeDbId && s.date === today
    );

    // State validation per spec
    if (action === 'time_in') {
      if (record && record.timeIn) {
        res.status(400).json({ error: 'Already timed in for today.' });
        return;
      }

      // Calculate lateness from Required Time In
      let lateMinutes = 0;
      if (schedule && schedule.requiredTimeIn) {
        const [reqH, reqM] = schedule.requiredTimeIn.split(':').map(Number);
        // Compare with local time in Philippines / UTC offset or user's local day
        const actualHours = now.getHours();
        const actualMinutes = now.getMinutes();
        const scheduledMinutes = reqH * 60 + reqM;
        const currentMinutesOfDay = actualHours * 60 + actualMinutes;
        if (currentMinutesOfDay > scheduledMinutes) {
          lateMinutes = currentMinutesOfDay - scheduledMinutes;
        }
      }

      const id = record?.id || `att_${randomBytes(6).toString('hex')}`;
      record = {
        id,
        employeeId: employeeDbId,
        businessId: emp.businessId,
        date: today,
        timeIn: nowIso,
        lateMinutes,
        totalWorkMinutes: 0,
        status: lateMinutes > 0 ? 'late' : 'present',
      };
      db.attendance[id] = record;
    } else if (action === 'break_out') {
      if (!record || !record.timeIn) {
        res.status(400).json({ error: 'Must time in first.' });
        return;
      }
      if (record.breakOut) {
        res.status(400).json({ error: 'Already taken a break.' });
        return;
      }
      record.breakOut = nowIso;
    } else if (action === 'break_in') {
      if (!record || !record.breakOut) {
        res.status(400).json({ error: 'Must break out before breaking back in.' });
        return;
      }
      if (record.breakIn) {
        res.status(400).json({ error: 'Already returned from break.' });
        return;
      }
      record.breakIn = nowIso;
    } else if (action === 'time_out') {
      if (!record || !record.timeIn) {
        res.status(400).json({ error: 'Must time in before timing out.' });
        return;
      }
      if (record.timeOut) {
        res.status(400).json({ error: 'Already timed out for today.' });
        return;
      }
      record.timeOut = nowIso;

      // Compute total work minutes
      const startMs = new Date(record.timeIn).getTime();
      const endMs = new Date(nowIso).getTime();
      let totalMs = endMs - startMs;

      if (record.breakOut && record.breakIn) {
        const breakDuration = new Date(record.breakIn).getTime() - new Date(record.breakOut).getTime();
        if (breakDuration > 0) totalMs -= breakDuration;
      }

      record.totalWorkMinutes = Math.max(0, Math.floor(totalMs / (1000 * 60)));
      record.status = record.lateMinutes > 0 ? 'late' : 'present';
    }

    persistDB();
    res.json({ success: true, attendance: record });
  });

  // My Schedules (Section 10)
  app.get('/api/employee/schedules', noCache, authMiddleware, employeeOnly, (req: AuthenticatedRequest, res: Response) => {
    const employeeDbId = req.user!.employeeDbId!;
    const periodId = req.query.periodId as string;

    let list = Object.values(db.schedules).filter((s) => s.employeeId === employeeDbId);
    if (periodId) {
      list = list.filter((s) => s.payrollPeriodId === periodId);
    }

    list.sort((a, b) => a.date.localeCompare(b.date));
    res.json(list);
  });

  // My Attendance (Section 11)
  app.get('/api/employee/attendance', noCache, authMiddleware, employeeOnly, (req: AuthenticatedRequest, res: Response) => {
    const employeeDbId = req.user!.employeeDbId!;
    const periodId = req.query.periodId as string;

    let period = periodId ? db.payrollPeriods[periodId] : undefined;
    if (!period) {
      const sorted = Object.values(db.payrollPeriods).sort((a, b) => b.startDate.localeCompare(a.startDate));
      period = sorted.find((p) => p.status === 'open' || p.status === 'for_approval') || sorted[0];
    }

    let records = Object.values(db.attendance).filter((a) => a.employeeId === employeeDbId);
    if (period) {
      records = records.filter((a) => a.date >= period.startDate && a.date <= period.endDate);
    }

    // Join with schedule for that date
    const enriched = records.map((a) => {
      const sched = Object.values(db.schedules).find((s) => s.employeeId === employeeDbId && s.date === a.date);
      return {
        ...a,
        scheduledTime: sched && sched.isWorkingDay ? `${sched.requiredTimeIn} - ${sched.requiredTimeOut}` : 'OFF',
      };
    });

    enriched.sort((a, b) => b.date.localeCompare(a.date));
    res.json({ period, attendance: enriched });
  });

  // My Tentative Payroll & Payroll for Approval (Sections 12, 13, 14)
  app.get('/api/employee/payroll', noCache, authMiddleware, employeeOnly, (req: AuthenticatedRequest, res: Response) => {
    const employeeDbId = req.user!.employeeDbId!;
    const periodId = req.query.periodId as string;

    let period = periodId ? db.payrollPeriods[periodId] : undefined;
    if (!period) {
      const sorted = Object.values(db.payrollPeriods).sort((a, b) => b.startDate.localeCompare(a.startDate));
      period = sorted.find((p) => p.status === 'for_approval' || p.status === 'open' || p.status === 'approved' || p.status === 'finalized') || sorted[0];
    }

    if (!period) {
      res.status(404).json({ error: 'No active payroll period found.' });
      return;
    }

    const payroll = calculateEmployeePayroll(employeeDbId, period.id);
    res.json(payroll);
  });

  // Approve Payroll (Section 13)
  app.post('/api/employee/payroll/approve', noCache, authMiddleware, employeeOnly, (req: AuthenticatedRequest, res: Response) => {
    const employeeDbId = req.user!.employeeDbId!;
    const { periodId } = req.body;

    const period = db.payrollPeriods[periodId];
    if (!period) {
      res.status(404).json({ error: 'Payroll period not found.' });
      return;
    }

    const approvalKey = `${periodId}_${employeeDbId}`;
    db.payrollApprovals[approvalKey] = {
      approvedAt: new Date().toISOString(),
      employeeId: req.user!.employeeId,
    };

    persistDB();
    res.json({ success: true, approvedAt: db.payrollApprovals[approvalKey].approvedAt });
  });

  // Web manifest and icons
  app.get('/api/manifest.webmanifest', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/manifest+json');
    res.json({
      name: 'CV Log – Multi-Business Attendance & Payroll',
      short_name: 'CV Log',
      description: 'Simple, clean attendance and payroll system for CV Group of Companies.',
      start_url: '/',
      display: 'standalone',
      background_color: '#0f172a',
      theme_color: '#0f172a',
      icons: [{ src: '/api/app-icon', sizes: '512x512', type: 'image/svg+xml' }],
    });
  });

  app.get('/api/app-icon', (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(
      `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="120" fill="#2563eb"/><text x="256" y="320" text-anchor="middle" font-family="Arial, sans-serif" font-size="200" font-weight="900" fill="white">CV</text></svg>`
    );
  });

  // Vite Frontend in Dev, dist in Prod
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: PORT },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[CV Log] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[CV Log] Fatal startup error:', err);
  process.exit(1);
});
