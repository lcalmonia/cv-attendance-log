import { getDatabase } from '@netlify/database';
import type { Config } from '@netlify/functions';
import { scryptSync, randomBytes, timingSafeEqual, createHash } from 'node:crypto';

const database = getDatabase();
const db = {
  sql: async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const rows = await database.sql(strings, ...values as any[]);
    return { rows: Array.isArray(rows) ? rows : (rows as any)?.rows || [] };
  },
  pool: database.pool,
};
const MAX_AGE = 7 * 24 * 60 * 60;
async function withTransaction<T>(work: (client: any) => Promise<T>) {
  const client = await database.pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}


function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });
}
const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();
const digits = (v: unknown) => String(v ?? '').replace(/\D/g, '');
const normMobile = (v: unknown) => { const d = digits(v); return d.length >= 10 ? d.slice(-10) : d; };
function minutesBetweenTimes(start: unknown, end: unknown) {
  if (!start || !end) return 0;
  const s = String(start), e = String(end);
  const asDate = (v: string) => {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const sd = asDate(s), ed = asDate(e);
  if (sd && ed) return Math.max(0, Math.round((ed.getTime() - sd.getTime()) / 60000));
  const parts = (v: string) => {
    const m = v.match(/(\d{1,2}):(\d{2})/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  };
  const sm = parts(s), em = parts(e);
  if (sm == null || em == null) return 0;
  return Math.max(0, (em - sm + 1440) % 1440);
}
function parseHm(v: unknown) {
  const m = String(v ?? '').match(/^(\d{1,2}):(\d{2})$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
}
function diffMinutes(start: unknown, end: unknown) {
  const s = parseHm(start), e = parseHm(end);
  return Math.max(0, (e - s + 1440) % 1440);
}
function nightDifferentialMinutes(start: string, end: string) {
  const s = new Date(start), e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e <= s) return 0;
  const PH_OFFSET_MS = 8 * 60 * 60 * 1000;
  let total = 0;
  const cursor = new Date(s);
  while (cursor < e) {
    const next = new Date(Math.min(cursor.getTime() + 60_000, e.getTime()));
    const phLocal = new Date(cursor.getTime() + PH_OFFSET_MS);
    const hour = phLocal.getUTCHours();
    if (hour >= 22 || hour < 6) total += Math.round((next.getTime() - cursor.getTime()) / 60000);
    cursor.setTime(next.getTime());
  }
  return total;
}
function holidayTypeOk(v: unknown) {
  return ['regular','special_non_working','special_working'].includes(String(v ?? ''));
}
function scheduleBreakMinutes(s: any) {
  return s?.break_out && s?.break_in ? minutesBetweenTimes(s.break_out, s.break_in) : 0;
}
function normalizedWorkMinutes(a: any, s: any) {
  if (!a?.time_in || !a?.time_out) return 0;

  // Work time never starts before the employee's scheduled Time In.
  // Early arrival is not extra worked time; late arrival starts from the
  // actual Time In. This same calculation is used by both portals and payroll.
  const actualIn = new Date(a.time_in);
  const actualOut = new Date(a.time_out);
  const scheduledIn = s?.date && s?.required_time_in
    ? scheduleDateTime(s.date, s.required_time_in)
    : null;
  if (Number.isNaN(actualIn.getTime()) || Number.isNaN(actualOut.getTime()) || actualOut <= actualIn) return 0;

  const effectiveStart = scheduledIn && !Number.isNaN(scheduledIn.getTime()) && scheduledIn > actualIn
    ? scheduledIn
    : actualIn;
  const elapsed = Math.max(0, Math.round((actualOut.getTime() - effectiveStart.getTime()) / 60000));
  const requiredBreak = scheduleBreakMinutes(s);
  const actualBreak = a?.break_out && a?.break_in ? minutesBetweenTimes(a.break_out, a.break_in) : 0;
  const effectiveBreak = Math.max(requiredBreak, actualBreak);
  return Math.max(0, elapsed - effectiveBreak);
}
function isInvalidShortDuty(a: any, s: any) {
  return Boolean(a?.time_in && a?.time_out && s?.is_working_day && normalizedWorkMinutes(a, s) < 60);
}
function scheduleDateTime(date: unknown, hm: unknown, overnightFrom?: unknown) {
  const dateKey = dateOnly(date), time = String(hm ?? '');
  if (!dateKey || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const base = new Date(`${dateKey}T${time}:00+08:00`);
  if (Number.isNaN(base.getTime())) return null;
  if (overnightFrom && parseHm(time) < parseHm(overnightFrom)) base.setUTCDate(base.getUTCDate() + 1);
  return base;
}
async function resolveScheduleForAttendance(employeeId: string, date: unknown, payrollPeriodId?: string | null) {
  const d=dateOnly(date);
  if(!d) return null;
  if(payrollPeriodId){
    const r=await db.pool.query(
      'SELECT s.* FROM schedules s JOIN payroll_periods p ON p.id=s.payroll_period_id WHERE s.employee_id=$1 AND s.payroll_period_id=$2 AND s.date=$3 AND s.date BETWEEN p.start_date AND p.end_date LIMIT 1',
      [employeeId,payrollPeriodId,d]
    );
    return r.rows[0]||null;
  }
  const r=await db.pool.query(
    "SELECT s.* FROM schedules s JOIN payroll_periods p ON p.id=s.payroll_period_id WHERE s.employee_id=$1 AND s.date=$2 ORDER BY CASE WHEN s.date BETWEEN p.start_date AND p.end_date THEN 0 ELSE 1 END, CASE p.status WHEN 'open' THEN 0 WHEN 'for_approval' THEN 1 WHEN 'approved' THEN 2 WHEN 'finalized' THEN 3 ELSE 4 END, p.start_date DESC, s.id DESC LIMIT 1",
    [employeeId,d]
  );
  return r.rows[0]||null;
}
function overtimeMinutes(a: any, s: any) {
  if (isInvalidShortDuty(a, s) || !s || !s.is_working_day || !a?.time_out || !s.required_time_out || !s.required_time_in) return 0;
  const scheduledOut = scheduleDateTime(s.date, s.required_time_out, s.required_time_in);
  const actualOut = new Date(a.time_out);
  if (!scheduledOut || Number.isNaN(actualOut.getTime())) return 0;
  const minutes = Math.max(0, Math.round((actualOut.getTime() - scheduledOut.getTime()) / 60000));
  return minutes > 30 ? minutes : 0;
}

function overtimeApprovalStatus(a: any, s: any) {
  const raw = overtimeMinutes(a, s);
  if (raw <= 0) return 'not_required';
  return ['pending','approved','rejected'].includes(String(a?.overtime_approval_status || ''))
    ? String(a.overtime_approval_status)
    : 'pending';
}

function approvedOvertimeMinutes(a: any, s: any) {
  return overtimeApprovalStatus(a, s) === 'approved' ? overtimeMinutes(a, s) : 0;
}

function attendanceVariance(a: any, s: any) {
  if (!s || !s.is_working_day || isInvalidShortDuty(a, s)) {
    return { lateMinutes: 0, undertimeMinutes: 0, overbreakMinutes: 0, varianceMinutes: 0 };
  }

  const requiredBreak = scheduleBreakMinutes(s);
  const actualBreak = a?.break_out && a?.break_in ? minutesBetweenTimes(a.break_out, a.break_in) : 0;
  const overbreakMinutes = Math.max(0, actualBreak - requiredBreak);

  let lateMinutes = Number(a?.late_minutes || 0);
  if (a?.time_in && s.required_time_in) {
    const scheduledIn = scheduleDateTime(s.date, s.required_time_in);
    const actualIn = new Date(a.time_in);
    if (scheduledIn && !Number.isNaN(actualIn.getTime())) {
      lateMinutes = Math.max(0, Math.round((actualIn.getTime() - scheduledIn.getTime()) / 60000));
    }
  }

  let undertimeMinutes = 0;
  if (a?.time_out && s.required_time_out && s.required_time_in) {
    const scheduledOut = scheduleDateTime(s.date, s.required_time_out, s.required_time_in);
    const actualOut = new Date(a.time_out);
    if (scheduledOut && !Number.isNaN(actualOut.getTime())) {
      undertimeMinutes = Math.max(0, Math.round((scheduledOut.getTime() - actualOut.getTime()) / 60000));
    }
  }

  return {
    lateMinutes,
    undertimeMinutes,
    overbreakMinutes,
    varianceMinutes: lateMinutes + undertimeMinutes + overbreakMinutes
  };
}

const hashToken = (v: string) => createHash('sha256').update(v).digest('hex');
function hashPassword(password: string, salt = randomBytes(16).toString('hex')) {
  if (password.length < 6) throw new Error('Password must be at least 6 characters.');
  return `scrypt:${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
function verifyPassword(password: string, stored: string) {
  try {
    const [algo, salt, hex] = String(stored || '').split(':');
    if (algo !== 'scrypt' || !salt || !hex) return false;
    const expected = Buffer.from(hex, 'hex');
    const actual = scryptSync(password, salt, expected.length);
    return expected.length > 0 && timingSafeEqual(actual, expected);
  } catch { return false; }
}
function cookies(request: Request) {
  const raw = request.headers.get('cookie') || '';
  return Object.fromEntries(raw.split(';').map(p => {
    const [k, ...v] = p.trim().split('=');
    return [k, decodeURIComponent(v.join('='))];
  }).filter(([k]) => k));
}
function sessionCookie(token: string, request: Request, maxAge = MAX_AGE) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `cvlog_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}
function phNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year:'numeric', month:'2-digit', day:'2-digit',
    hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false
  }).formatToParts(new Date());
  const get = (t:string) => parts.find(p=>p.type===t)?.value || '';
  return { date:`${get('year')}-${get('month')}-${get('day')}`, minute:Number(get('hour'))*60+Number(get('minute')), iso:new Date().toISOString() };
}
function dateOnly(v: unknown) {
  if (v == null) return '';
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? '' : v.toISOString().slice(0, 10);
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[\\/](\d{1,2})[\\/](\d{4})$/);
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}
function dateOk(v: unknown) { const s=String(v || ''); if(!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false; const [y,m,d]=s.split('-').map(Number); const dt=new Date(Date.UTC(y,m-1,d)); return dt.getUTCFullYear()===y && dt.getUTCMonth()===m-1 && dt.getUTCDate()===d; }
function timeOk(v: unknown) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v || '')); }

async function currentUser(request: Request) {
  const token = cookies(request).cvlog_session;
  if (!token) return null;
  const r = await db.sql`
    SELECT s.user_id AS "userId", u.role, u.employee_id AS "employeeId",
           e.id AS "employeeDbId", e.business_id AS "businessId"
    FROM sessions s
    JOIN users u ON u.id=s.user_id AND u.status='active'
    JOIN auth_accounts aa ON aa.user_id=u.id AND aa.is_active=true
    LEFT JOIN employees e ON e.user_id=s.user_id
    WHERE s.token_hash=${hashToken(token)} AND s.expires_at>NOW()
      AND (u.role='super_admin' OR e.status='active')
  `;
  return r.rows[0] || null;
}
const isAdmin=(u:any)=>u?.role==='super_admin';
const isEmployee=(u:any)=>u?.role==='employee';
async function employeeById(id:string) { const r=await db.sql`SELECT * FROM employees WHERE id=${id}`; return r.rows[0]||null; }
async function periodById(id:string) { const r=await db.sql`SELECT * FROM payroll_periods WHERE id=${id}`; return r.rows[0]||null; }
async function employeePayrollPeriods() {
  const r = await db.sql`SELECT id,name,start_date AS "startDate",end_date AS "endDate",payout_date AS "payoutDate",status FROM payroll_periods ORDER BY start_date DESC LIMIT 2`;
  return r.rows;
}
async function calculatePayroll(employeeId:string, periodId:string) {
  const e=await employeeById(employeeId), p=await periodById(periodId);
  if(!e||!p) throw new Error('Employee or payroll period not found.');
  if(p.status==='finalized'){
    const frozen=await db.sql`SELECT payroll_record AS "payrollRecord" FROM finalized_payroll_ledger WHERE payroll_period_id=${periodId} AND employee_id=${employeeId}`;
    const record=frozen.rows[0]?.payrollRecord;
    if(record) return typeof record==='string' ? JSON.parse(record) : record;
  }
  const sr=await db.sql`SELECT * FROM schedules WHERE employee_id=${employeeId} AND payroll_period_id=${periodId} ORDER BY date`;
  const schedules=sr.rows, duty=schedules.filter((s:any)=>s.is_working_day);
  const ar=await db.sql`SELECT * FROM attendance WHERE employee_id=${employeeId} AND date BETWEEN ${p.start_date} AND ${p.end_date} ORDER BY date`;
  const attendance=ar.rows;
  const hr=await db.sql`SELECT night_differential_hourly_rate AS "nightDifferentialHourlyRate", night_differential_multiplier AS "nightDifferentialMultiplier", regular_overtime_multiplier AS "regularOvertimeMultiplier" FROM payroll_settings WHERE business_id=${e.business_id} OR business_id='all' ORDER BY CASE WHEN business_id=${e.business_id} THEN 0 ELSE 1 END LIMIT 1`;
  const holidayR=await db.sql`SELECT holiday_date AS "holidayDate",name,holiday_type AS "holidayType",overtime_rate AS "overtimeRate" FROM holidays WHERE (business_id=${e.business_id} OR business_id='all') AND holiday_date BETWEEN ${p.start_date} AND ${p.end_date}`;
  const holidayMap=new Map<string, any>(holidayR.rows.map((h:any)=>[String(h.holidayDate).slice(0,10),h]));
  const ndRate=Number(hr.rows[0]?.nightDifferentialHourlyRate||0);
  const ndMultiplier=Number(hr.rows[0]?.nightDifferentialMultiplier ?? 1);
  const regularOtMultiplier=Number(hr.rows[0]?.regularOvertimeMultiplier ?? 1);
  const rateSnapshot=p.status==='finalized'
    ? (await db.sql`SELECT daily_rate AS "dailyRate" FROM payroll_rate_snapshots WHERE payroll_period_id=${periodId} AND employee_id=${employeeId}`).rows[0]
    : null;
  const payrollDailyRate=Number(rateSnapshot?.dailyRate ?? e.daily_rate);
  let daysWorked=0, late=0, nightDiffMinutes=0, overtimeMinutesTotal=0, holidayOvertimePay=0;
  const attendanceDays:any[]=[];
  for(const s of duty){
    const a=attendance.find((x:any)=>dateOnly(x.date)===dateOnly(s.date));
    const invalid=isInvalidShortDuty(a,s);
    const present=!!a?.time_in && !invalid;
    const metrics=attendanceVariance(a,s);
    const rawOvertimeMinutes=overtimeMinutes(a,s);
    const overtimeStatus=overtimeApprovalStatus(a,s);
    const regularOvertimeMinutes=approvedOvertimeMinutes(a,s);
    const dateKey=dateOnly(s.date);
    const holiday=holidayMap.get(dateKey);
    if(present){daysWorked++; late+=metrics.lateMinutes; if(!holiday) overtimeMinutesTotal+=regularOvertimeMinutes;}
    const nd=present&&a?.time_out?Math.max(0,nightDifferentialMinutes(String(a.time_in),String(a.time_out))-(a?.break_out&&a?.break_in?nightDifferentialMinutes(String(a.break_out),String(a.break_in)):0)):0;
    nightDiffMinutes+=nd;
    if(holiday&&present&&a?.time_out){
      const worked=normalizedWorkMinutes(a,s), scheduled=Math.max(0,diffMinutes(s.required_time_in,s.required_time_out)-scheduleBreakMinutes(s)), ot=Math.max(0,worked-scheduled);
      if(overtimeStatus==='approved' && rawOvertimeMinutes>0){
        holidayOvertimePay+=Math.round((ot/60)*payrollDailyRate/(Math.max(1,Number(e.required_hours_per_day||8)))*Number(holiday.overtimeRate||1)*100)/100;
      }
    }
    const normalizedMinutes=invalid?0:(present&&a?.time_out?normalizedWorkMinutes(a,s):Number(a?.total_work_minutes||0));
    attendanceDays.push({date:dateKey,status:invalid?'invalid':present?(metrics.lateMinutes>0?'late':'present'):'absent',lateMinutes:present?metrics.lateMinutes:0,undertimeMinutes:present?metrics.undertimeMinutes:0,overbreakMinutes:present?metrics.overbreakMinutes:0,varianceMinutes:present?metrics.varianceMinutes:0,overtimeMinutes:present&&!holiday?regularOvertimeMinutes:0,overtimeApprovalStatus:overtimeStatus,pendingOvertimeMinutes:present&&overtimeStatus==='pending'?rawOvertimeMinutes:0,hours:Math.round(normalizedMinutes/60*10)/10,nightDifferentialHours:nd/60,holiday:holiday?.name});
  }
  const minuteRate=payrollDailyRate/(Math.max(1,Number(e.required_hours_per_day||8))*60);
  const lateDed=Math.round(late*minuteRate*100)/100;
  let overbreak=0, undertime=0;
  for(const d of attendanceDays){
    overbreak += Number(d.overbreakMinutes||0);
    undertime += Number(d.undertimeMinutes||0);
  }
  const overbreakDed=Math.round(overbreak*minuteRate*100)/100;
  const undertimeDed=Math.round(undertime*minuteRate*100)/100;
  const hourlyRate=payrollDailyRate/Math.max(1,Number(e.required_hours_per_day||8));
  const regularOvertimePay=Math.round((overtimeMinutesTotal/60)*hourlyRate*regularOtMultiplier*100)/100;
  const baseDutyPay=Math.round(daysWorked*payrollDailyRate*100)/100;
  const basic=Math.round((baseDutyPay-lateDed-overbreakDed-undertimeDed)*100)/100;
  const incR=await db.sql`SELECT * FROM incentive_programs WHERE status='active' AND (business_id=${e.business_id} OR business_id='all') AND effective_date<=${p.end_date} ORDER BY name`;
  const incentives:any[]=[];
  for(const i of incR.rows){
    let q=true;
    if(i.incentive_type==='attendance' || !i.incentive_type){
      q=duty.length>0;
      for(const s of duty){
        const a=attendance.find((x:any)=>dateOnly(x.date)===dateOnly(s.date));
        const present=!!a?.time_in && !isInvalidShortDuty(a,s);
        if(i.require_no_absence&&!present) q=false;
        if(i.require_no_late&&attendanceVariance(a,s).lateMinutes>0) q=false;
        if(i.require_no_undertime){
          const iv=attendanceVariance(a,s);
          if(!present || !a?.time_out || iv.undertimeMinutes>0) q=false;
        }
        if(present && a?.break_out && a?.break_in && minutesBetweenTimes(a.break_out,a.break_in)>scheduleBreakMinutes(s)) q=false;
      }
    }
    incentives.push({
      name:i.name,
      amount:q ? Number(i.amount) : 0,
      type:i.incentive_type||'attendance',
      qualified:q,
      configuredAmount:Number(i.amount)
    });
  }
  const incentivePay=incentives.reduce((n,x)=>n+x.amount,0);
  const nightDifferentialPay=Math.round((nightDiffMinutes/60)*ndRate*ndMultiplier*100)/100;
  const gross=Math.round((baseDutyPay+regularOvertimePay+incentivePay+nightDifferentialPay+holidayOvertimePay)*100)/100;
  const deductionSnapshotHeader=p.status==='finalized'
    ? (await db.sql`SELECT 1 FROM payroll_deduction_snapshot_headers WHERE payroll_period_id=${periodId} AND employee_id=${employeeId}`).rows[0]
    : null;
  const deductionSnapshot=deductionSnapshotHeader
    ? (await db.sql`SELECT deduction_name AS "deductionName",amount,deduction_type AS "deductionType" FROM payroll_deduction_snapshots WHERE payroll_period_id=${periodId} AND employee_id=${employeeId} ORDER BY line_no`).rows
    : [];
  const deductions:any[]=[]; let empD=0, recD=0;
  if(deductionSnapshot.length){
    for(const d of deductionSnapshot){
      const a=Number(d.amount);
      if(d.deductionType==='employee') empD+=a;
      else if(d.deductionType==='recurring') recD+=a;
      deductions.push({name:d.deductionName,amount:a,type:d.deductionType});
    }
  } else {
    const ed=await db.sql`SELECT * FROM employee_deductions WHERE employee_id=${employeeId} AND status='active' AND (recurring=true OR payroll_period_id=${periodId}) ORDER BY deduction_name`;
    const cd=await db.sql`SELECT * FROM deduction_types WHERE status='active' AND (business_id=${e.business_id} OR business_id='all') ORDER BY name`;
    for(const d of ed.rows){const a=Number(d.amount); empD+=a; deductions.push({name:d.deduction_name,amount:a,type:'employee'});}
    for(const d of cd.rows){const a=d.calculation_type==='percentage'?Math.round(gross*Number(d.value)/100*100)/100:Number(d.value);recD+=a;deductions.push({name:d.name,amount:a,type:'recurring'});}
  }
  const total=Math.round((lateDed+overbreakDed+undertimeDed+empD+recD)*100)/100, net=Math.round((gross-total)*100)/100;
  const appr=await db.sql`SELECT approved_at FROM payroll_approvals WHERE payroll_period_id=${periodId} AND employee_id=${employeeId}`;
  const biz=await db.sql`SELECT name FROM businesses WHERE id=${e.business_id}`;
  return {
    id:`pay_${periodId}_${employeeId}`, payrollPeriodId:periodId, employeeId, businessId:e.business_id,
    employeeName:e.full_name,businessName:biz.rows[0]?.name||'',position:e.position,dailyRate:payrollDailyRate,
    scheduledDutyDays:duty.length,daysWorked,lateMinutesTotal:late,overbreakMinutesTotal:overbreak,undertimeMinutesTotal:undertime,lateDeduction:lateDed,overbreakDeduction:overbreakDed,undertimeDeduction:undertimeDed,regularOvertimePay,regularOvertimeMultiplier:regularOtMultiplier,overtimeMinutesTotal,overtimeHours:overtimeMinutesTotal/60,pendingOvertimeMinutesTotal:attendanceDays.reduce((n,x)=>n+Number(x.pendingOvertimeMinutes||0),0),baseDutyPay,basicPay:basic,incentivePay,nightDifferentialHours:nightDiffMinutes/60,nightDifferentialHourlyRate:ndRate,nightDifferentialMultiplier:ndMultiplier,nightDifferentialPay,holidayOvertimePay,employeeDeductionsTotal:empD,
    recurringDeductionsTotal:recD,totalDeductions:total,grossPay:gross,netPay:net,status:p.status,
    employeeApprovedAt:appr.rows[0]?.approved_at||undefined,
    finalizedAt:p.status==='finalized'?dateOnly(p.payout_date):undefined,
    breakdown:{incentives,deductions,attendanceDays}
  };
}

async function handle(request: Request) {
  const url=new URL(request.url), path=url.pathname.replace(/^\/api\/?/,'').replace(/\/$/,'');
  const m=request.method.toUpperCase();
  try {
    if(path==='health'&&m==='GET'){
      try{
        await db.sql`SELECT 1 AS ok`;
        return json({ok:true,database:true});
      }catch(e:any){
        console.error('[CV Log API health]',e);
        return json({ok:false,database:false,error:'Database connection failed.'},503);
      }
    }
    const u=await currentUser(request);
    if(path==='auth/status'&&m==='GET'){
      const r=await db.sql`SELECT EXISTS(SELECT 1 FROM users WHERE role='super_admin' AND status='active') AS ok`;
      return json({hasAccounts:Boolean(r.rows[0]?.ok)});
    }
    if(path==='auth/setup'&&m==='POST'){
      const b=await request.json(); const exists=await db.sql`SELECT 1 FROM users WHERE role='super_admin' AND status='active' LIMIT 1`;
      if(exists.rows[0]) return json({error:'Initial administrator setup has already been completed.'},403);
      if(!b.fullName||!b.employeeId||!b.password) return json({error:'Name, employee ID, and password are required.'},400);
      const userId=`usr_${randomBytes(8).toString('hex')}`, now=new Date().toISOString();
      const loginId=norm(b.employeeId), mobileLogin=normMobile(b.mobileNumber)||null, passwordHash=hashPassword(String(b.password));
      if((await db.sql`SELECT 1 FROM users WHERE lower(employee_id)=lower(${b.employeeId}) LIMIT 1`).rows[0]) return json({error:'This Employee ID is already in use.'},400);
      if((await db.sql`SELECT 1 FROM auth_accounts WHERE login_id=${loginId} LIMIT 1`).rows[0]) return json({error:'This Employee ID is already in use for login.'},400);
      if(mobileLogin && (await db.sql`SELECT 1 FROM auth_accounts WHERE mobile_login=${mobileLogin} LIMIT 1`).rows[0]) return json({error:'This mobile number is already in use.'},400);
      try{
        await withTransaction(async (client) => {
          await client.query(
            'INSERT INTO users(id,employee_id,full_name,email,mobile_number,role,status,must_change_password) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
            [userId,b.employeeId,b.fullName,b.email||'',b.mobileNumber||'','super_admin','active',false]
          );
          await client.query(
            'INSERT INTO auth_accounts(user_id,login_id,mobile_login,password_hash,must_change_password,is_active,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
            [userId,loginId,mobileLogin,passwordHash,false,true,now,now]
          );
        });
      }catch(e:any){
        if(e?.code==='23505')return json({error:'Initial administrator setup has already been completed or the login details are already in use.'},409);
        throw e;
      }
      return json({success:true});
    }
    if(path==='auth/login'&&m==='POST'){
      const b=await request.json(), login=norm(b.loginId), mobile=normMobile(b.loginId);
      const r=await db.sql`SELECT a.*,u.employee_id,u.full_name,u.role,u.status AS user_status,e.status AS employee_status FROM auth_accounts a JOIN users u ON u.id=a.user_id LEFT JOIN employees e ON e.user_id=u.id WHERE (a.login_id=${login} OR (a.mobile_login IS NOT NULL AND a.mobile_login=${mobile})) AND (u.role='super_admin' OR e.status='active') LIMIT 1`;
      const a=r.rows[0];
      if(!a||!a.is_active||a.user_status!=='active'||!verifyPassword(String(b.password||''),a.password_hash)) return json({error:'Invalid credentials or inactive account.'},401);
      const token=randomBytes(32).toString('base64url');
      await db.sql`INSERT INTO sessions(token_hash,user_id,role,employee_id,expires_at) VALUES(${hashToken(token)},${a.user_id},${a.role},${a.employee_id},NOW()+INTERVAL '7 days')`;
      return json({userId:a.user_id,role:a.role,fullName:a.full_name,employeeId:a.employee_id,mustChangePassword:Boolean(a.must_change_password)},200,{'Set-Cookie':sessionCookie(token,request)});
    }
    if(path==='auth/session'&&m==='GET'){
      if(!u) return json({authenticated:false},401);
      const r=await db.sql`SELECT u.*,e.business_id,b.name AS business_name FROM users u LEFT JOIN employees e ON e.user_id=u.id LEFT JOIN businesses b ON b.id=e.business_id WHERE u.id=${u.userId}`;
      const p=r.rows[0]; if(!p)return json({authenticated:false},401);
      return json({authenticated:true,userId:p.id,employeeId:p.employee_id,fullName:p.full_name,email:p.email,role:p.role,mustChangePassword:Boolean(p.must_change_password),businessName:p.business_name||undefined,businessId:p.business_id||undefined});
    }
    if(path==='auth/logout'&&m==='POST'){
      const t=cookies(request).cvlog_session; if(t) await db.sql`DELETE FROM sessions WHERE token_hash=${hashToken(t)}`;
      return json({success:true},200,{'Set-Cookie':sessionCookie('',request,0)});
    }
    if(path==='auth/change-password'&&m==='POST'){
      if(!u)return json({error:'Unauthorized'},401); const b=await request.json();
      const a=(await db.sql`SELECT * FROM auth_accounts WHERE user_id=${u.userId}`).rows[0];
      if(!a)return json({error:'Account not found.'},404);
      const ok=verifyPassword(String(b.currentPassword||''),a.password_hash)||(a.must_change_password&&norm(b.currentPassword)===norm(u.employeeId));
      if(!ok)return json({error:'Current password is incorrect.'},400);
      if(String(b.newPassword||'').length<6)return json({error:'New password must be at least 6 characters.'},400);
      const newHash=hashPassword(String(b.newPassword));
      await withTransaction(async (client) => {
        await client.query('UPDATE auth_accounts SET password_hash=$1,must_change_password=false,updated_at=NOW() WHERE user_id=$2',[newHash,u.userId]);
        await client.query('UPDATE users SET must_change_password=false WHERE id=$1',[u.userId]);
      });
      return json({success:true});
    }
    if(!u)return json({error:'Unauthorized'},401);
    if(path==='admin/dashboard'&&m==='GET'&&isAdmin(u)){
      const b=await db.sql`SELECT COUNT(*)::int c FROM businesses WHERE status='active'`, e=await db.sql`SELECT COUNT(*)::int c FROM employees WHERE status='active'`, t=await db.sql`SELECT COUNT(*)::int c FROM attendance WHERE date=${phNow().date} AND time_in IS NOT NULL AND time_out IS NULL`;
      const p=await db.sql`SELECT * FROM payroll_periods WHERE status IN('open','for_approval') ORDER BY start_date DESC LIMIT 1`, q=p.rows[0];
      return json({businessesCount:Number(b.rows[0]?.c||0),activeEmployeesCount:Number(e.rows[0]?.c||0),timedInEmployees:Number(t.rows[0]?.c||0),currentCutoff:q?.name||'No active cutoff',payrollStatus:q?.status||'None',periodId:q?.id});
    }
    if(path==='admin/businesses'&&m==='GET'&&isAdmin(u)){
      const r=await db.sql`SELECT id,name,code,address,contact_number AS "contactNumber",status,created_at AS "createdAt" FROM businesses ORDER BY name`; return json(r.rows);
    }
    if(path==='admin/businesses'&&m==='POST'&&isAdmin(u)){
      const b=await request.json(); if(!b.name||!b.code)return json({error:'Business name and code are required.'},400);
      const id=`biz_${randomBytes(8).toString('hex')}`;
      await db.sql`INSERT INTO businesses(id,name,code,address,contact_number,status) VALUES(${id},${b.name},${String(b.code).toUpperCase()},${b.address||''},${b.contactNumber||''},${b.status||'active'})`;
      return json({id,name:b.name,code:String(b.code).toUpperCase(),address:b.address||'',contactNumber:b.contactNumber||'',status:b.status||'active',createdAt:new Date().toISOString()});
    }
    if(path.startsWith('admin/businesses/')&&m==='PUT'&&isAdmin(u)){
      const id=path.split('/')[2], cur=(await db.sql`SELECT * FROM businesses WHERE id=${id}`).rows[0]; if(!cur)return json({error:'Business not found.'},404); const b=await request.json();
      const n={name:b.name??cur.name,code:b.code!==undefined?String(b.code).toUpperCase():cur.code,address:b.address??cur.address,contact:b.contactNumber??cur.contact_number,status:b.status??cur.status};
      await db.sql`UPDATE businesses SET name=${n.name},code=${n.code},address=${n.address},contact_number=${n.contact},status=${n.status} WHERE id=${id}`;
      return json({id,name:n.name,code:n.code,address:n.address,contactNumber:n.contact,status:n.status,createdAt:cur.created_at});
    }
    if(path==='admin/employees'&&m==='GET'&&isAdmin(u)){
      const r=await db.sql`SELECT e.id,e.user_id AS "userId",e.employee_id AS "employeeId",e.business_id AS "businessId",e.full_name AS "fullName",e.mobile_number AS "mobileNumber",e.email,e.position,e.employment_status AS "employmentStatus",e.date_hired AS "dateHired",e.daily_rate AS "dailyRate",e.required_hours_per_day AS "requiredHoursPerDay",e.status,b.name AS "businessName" FROM employees e JOIN businesses b ON b.id=e.business_id ORDER BY e.full_name`;
      return json(r.rows.map((x:any)=>({...x,dateHired:dateOnly(x.dateHired),dailyRate:Number(x.dailyRate),requiredHoursPerDay:Number(x.requiredHoursPerDay)})));
    }
    if(path==='admin/employees'&&m==='POST'&&isAdmin(u)){
      const b=await request.json(); if(!b.employeeId||!b.fullName||!b.businessId)return json({error:'Employee ID, full name, and business are required.'},400);
      const biz=(await db.sql`SELECT id FROM businesses WHERE id=${b.businessId} AND status='active'`).rows[0]; if(!biz)return json({error:'Selected business does not exist or is inactive.'},400);
      if((await db.sql`SELECT 1 FROM employees WHERE lower(employee_id)=lower(${b.employeeId})`).rows[0])return json({error:'An employee with this Employee ID already exists.'},400);
      const userId=`usr_${randomBytes(8).toString('hex')}`, empId=`emp_${randomBytes(8).toString('hex')}`, now=new Date().toISOString(), status=b.status||'active';
      const loginId=norm(b.employeeId), mobileLogin=normMobile(b.mobileNumber)||null;
      if(String(b.employeeId).trim().length<6)return json({error:'Employee ID must be at least 6 characters because it is the temporary password.'},400);
      if((await db.sql`SELECT 1 FROM users WHERE lower(employee_id)=lower(${b.employeeId}) LIMIT 1`).rows[0])return json({error:'An account with this Employee ID already exists.'},400);
      if(mobileLogin && (await db.sql`SELECT 1 FROM auth_accounts WHERE mobile_login=${mobileLogin} LIMIT 1`).rows[0])return json({error:'An account with this mobile number already exists.'},400);
      const emp={id:empId,userId,employeeId:b.employeeId,businessId:b.businessId,fullName:b.fullName,mobileNumber:b.mobileNumber||'',email:b.email||'',position:b.position||'Staff',employmentStatus:b.employmentStatus||'regular',dateHired:b.dateHired||phNow().date,dailyRate:Number(b.dailyRate||600),requiredHoursPerDay:Number(b.requiredHoursPerDay||8),status};
      try{
        await withTransaction(async (client) => {
          await client.query(
            'INSERT INTO users(id,employee_id,full_name,email,mobile_number,role,business_id,status,must_change_password) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
            [userId,b.employeeId,b.fullName,b.email||'',b.mobileNumber||'','employee',b.businessId,status,true]
          );
          await client.query(
            'INSERT INTO auth_accounts(user_id,login_id,mobile_login,password_hash,must_change_password,is_active,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
            [userId,loginId,mobileLogin,hashPassword(String(b.employeeId).trim()),true,status==='active',now,now]
          );
          await client.query(
            'INSERT INTO employees(id,user_id,employee_id,business_id,full_name,mobile_number,email,position,employment_status,date_hired,daily_rate,required_hours_per_day,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',
            [emp.id,emp.userId,emp.employeeId,emp.businessId,emp.fullName,emp.mobileNumber,emp.email,emp.position,emp.employmentStatus,emp.dateHired,emp.dailyRate,emp.requiredHoursPerDay,emp.status]
          );
        });
      }catch(e:any){
        if(e?.code==='23505')return json({error:'Employee ID or mobile number is already in use.'},409);
        throw e;
      }
      return json(emp);
    }
    if(path.startsWith('admin/employees/')&&path.endsWith('/reset-password')&&m==='POST'&&isAdmin(u)){
      const id=path.split('/')[2], e=await employeeById(id); if(!e)return json({error:'Employee not found.'},404);
      if(String(e.employee_id).trim().length<6)return json({error:'This employee ID is shorter than the required 6-character minimum and cannot be used as a temporary password.'},400);
      const resetHash=hashPassword(String(e.employee_id).trim());
      await withTransaction(async (client) => {
        await client.query('UPDATE auth_accounts SET password_hash=$1,must_change_password=true,updated_at=NOW() WHERE user_id=$2',[resetHash,e.user_id]);
        await client.query('UPDATE users SET must_change_password=true WHERE id=$1',[e.user_id]);
      });
      return json({success:true,message:`Password reset to temporary: ${e.employee_id}`});
    }
    if(path.startsWith('admin/employees/')&&m==='DELETE'&&isAdmin(u)){
      const id=path.split('/')[2];
      const e=await employeeById(id);
      if(!e)return json({error:'Employee not found.'},404);
      try{
        await withTransaction(async (client) => {
          // Explicitly remove the authentication/session chain first, then let
          // the users -> employees foreign-key cascade remove employee data.
          await client.query('DELETE FROM sessions WHERE user_id=$1',[e.user_id]);
          await client.query('DELETE FROM auth_accounts WHERE user_id=$1',[e.user_id]);
          await client.query('DELETE FROM users WHERE id=$1',[e.user_id]);
        });
      }catch(e:any){
        if(e?.code==='23503')return json({error:'This employee cannot be deleted because related records are still in use.'},409);
        throw e;
      }
      return json({success:true});
    }
    if(path.startsWith('admin/employees/')&&m==='PUT'&&isAdmin(u)){
      const id=path.split('/')[2]; const e=await employeeById(id); if(!e)return json({error:'Employee not found.'},404); const b=await request.json();
      const existingDateHired=dateOnly(e.date_hired)||''; const submittedDateHired=typeof b.dateHired==='string'?b.dateHired.trim():''; const dateHired=dateOk(submittedDateHired)?submittedDateHired:existingDateHired; if(!dateHired || !dateOk(dateHired))return json({error:'A valid Date Hired is required.'},400); const n={fullName:b.fullName??e.full_name,mobileNumber:b.mobileNumber??e.mobile_number,email:b.email??e.email,position:b.position??e.position,employmentStatus:b.employmentStatus??e.employment_status,dateHired,businessId:b.businessId??e.business_id,dailyRate:b.dailyRate!==undefined?Number(b.dailyRate):Number(e.daily_rate),requiredHoursPerDay:b.requiredHoursPerDay!==undefined?Number(b.requiredHoursPerDay):Number(e.required_hours_per_day),status:b.status??e.status};
      const validBiz=(await db.sql`SELECT 1 FROM businesses WHERE id=${n.businessId} AND status='active'`).rows[0]; if(!validBiz)return json({error:'Business does not exist or is inactive.'},400);
      const mobileLogin=normMobile(n.mobileNumber)||null;
      if(mobileLogin && (await db.sql`SELECT 1 FROM auth_accounts WHERE mobile_login=${mobileLogin} AND user_id<>${e.user_id} LIMIT 1`).rows[0])return json({error:'This mobile number is already in use by another account.'},400);
      await withTransaction(async (client) => {
        await client.query('UPDATE employees SET full_name=$1,mobile_number=$2,email=$3,position=$4,employment_status=$5,date_hired=$6,business_id=$7,daily_rate=$8,required_hours_per_day=$9,status=$10 WHERE id=$11',[n.fullName,n.mobileNumber,n.email,n.position,n.employmentStatus,n.dateHired,n.businessId,n.dailyRate,n.requiredHoursPerDay,n.status,id]);
        await client.query('UPDATE users SET full_name=$1,mobile_number=$2,email=$3,business_id=$4,status=$5 WHERE id=$6',[n.fullName,n.mobileNumber,n.email,n.businessId,n.status,e.user_id]);
        await client.query('UPDATE auth_accounts SET mobile_login=$1,is_active=$2 WHERE user_id=$3',[mobileLogin,n.status==='active',e.user_id]);
      });
      return json({id,userId:e.user_id,employeeId:e.employee_id,...n});
    }
    if(path==='admin/periods'&&m==='GET'&&isAdmin(u)){
      const r=await db.sql`SELECT id,name,start_date AS "startDate",end_date AS "endDate",payout_date AS "payoutDate",status FROM payroll_periods ORDER BY start_date DESC`;
      return json(r.rows.map((x:any)=>({...x,startDate:dateOnly(x.startDate),endDate:dateOnly(x.endDate),payoutDate:dateOnly(x.payoutDate)})));
    }
    if(path==='admin/periods'&&m==='POST'&&isAdmin(u)){
      const b=await request.json(); if(!dateOk(b.startDate)||!dateOk(b.endDate)||!dateOk(b.payoutDate)||b.endDate<b.startDate)return json({error:'Valid start date, end date, and payout date are required.'},400);
      const status=b.status||'open';
      if(status==='finalized')return json({error:'A payroll period must be finalized through the payroll finalization process.'},400);
      const id=`period_${randomBytes(8).toString('hex')}`; await db.sql`INSERT INTO payroll_periods(id,name,start_date,end_date,payout_date,status) VALUES(${id},${b.name||`${b.startDate} to ${b.endDate}`},${b.startDate},${b.endDate},${b.payoutDate},${status})`;
      return json({id,name:b.name||`${b.startDate} to ${b.endDate}`,startDate:b.startDate,endDate:b.endDate,payoutDate:b.payoutDate,status:b.status||'open'});
    }
    if(path.startsWith('admin/periods/')&&m==='PUT'&&isAdmin(u)){
      const id=path.split('/')[2], p=await periodById(id); if(!p)return json({error:'Payroll period not found.'},404); const b=await request.json();
      const n={name:b.name??p.name,startDate:b.startDate??dateOnly(p.start_date),endDate:b.endDate??dateOnly(p.end_date),payoutDate:b.payoutDate??dateOnly(p.payout_date),status:b.status??p.status};
      if(p.status==='finalized')return json({error:'Finalized payroll periods cannot be edited.'},400);
      if(n.status==='finalized')return json({error:'A payroll period must be finalized through the payroll finalization process.'},400);
      if(!dateOk(n.startDate)||!dateOk(n.endDate)||n.endDate<n.startDate)return json({error:'Invalid period dates.'},400);
      await db.sql`UPDATE payroll_periods SET name=${n.name},start_date=${n.startDate},end_date=${n.endDate},payout_date=${n.payoutDate},status=${n.status} WHERE id=${id}`;
      return json({id,...n});
    }
    if(path==='admin/schedules'&&m==='GET'&&isAdmin(u)){
      const q=new URL(request.url).searchParams, per=q.get('periodId'), emp=q.get('employeeId');
      if(per&&emp){const r=await db.sql`SELECT s.id,s.employee_id AS "employeeId",s.payroll_period_id AS "payrollPeriodId",s.date,s.required_time_in AS "requiredTimeIn",s.required_time_out AS "requiredTimeOut",s.break_out AS "breakOut",s.break_in AS "breakIn",s.is_working_day AS "isWorkingDay",s.notes,e.full_name AS "employeeName" FROM schedules s JOIN employees e ON e.id=s.employee_id WHERE s.payroll_period_id=${per} AND s.employee_id=${emp} ORDER BY s.date`;return json(r.rows.map((x:any)=>({...x,date:dateOnly(x.date)})));}
      if(per){const r=await db.sql`SELECT s.id,s.employee_id AS "employeeId",s.payroll_period_id AS "payrollPeriodId",s.date,s.required_time_in AS "requiredTimeIn",s.required_time_out AS "requiredTimeOut",s.break_out AS "breakOut",s.break_in AS "breakIn",s.is_working_day AS "isWorkingDay",s.notes,e.full_name AS "employeeName" FROM schedules s JOIN employees e ON e.id=s.employee_id WHERE s.payroll_period_id=${per} ORDER BY s.date`;return json(r.rows.map((x:any)=>({...x,date:dateOnly(x.date)})));}
      const r=await db.sql`SELECT s.id,s.employee_id AS "employeeId",s.payroll_period_id AS "payrollPeriodId",s.date,s.required_time_in AS "requiredTimeIn",s.required_time_out AS "requiredTimeOut",s.break_out AS "breakOut",s.break_in AS "breakIn",s.is_working_day AS "isWorkingDay",s.notes,e.full_name AS "employeeName" FROM schedules s JOIN employees e ON e.id=s.employee_id ORDER BY s.date`;return json(r.rows.map((x:any)=>({...x,date:dateOnly(x.date)})));
    }
    if(path==='admin/schedules/create-next-cutoff'&&m==='POST'&&isAdmin(u)){
      const b=await request.json(), cur=await periodById(b.currentPeriodId);
      if(!cur)return json({error:'Current payroll period not found.'},404);
      if(!dateOk(b.nextStartDate)||!dateOk(b.nextEndDate)||b.nextEndDate<b.nextStartDate)return json({error:'Valid next cut-off start/end dates are required.'},400);
      const payout=dateOk(b.nextPayoutDate)?b.nextPayoutDate:b.nextEndDate;
      const source=(await db.sql`SELECT * FROM schedules WHERE payroll_period_id=${cur.id} ORDER BY date`).rows;
      let next=(await db.sql`SELECT * FROM payroll_periods WHERE start_date=${b.nextStartDate} AND end_date=${b.nextEndDate} LIMIT 1`).rows[0];
      let copied=0;
      await withTransaction(async (client) => {
        if(!next){
          const id=`period_${randomBytes(8).toString('hex')}`;
          await client.query(
            'INSERT INTO payroll_periods(id,name,start_date,end_date,payout_date,status) VALUES($1,$2,$3,$4,$5,$6)',
            [id,b.name||`Next Cut-Off ${b.nextStartDate} to ${b.nextEndDate}`,b.nextStartDate,b.nextEndDate,payout,'open']
          );
          const nr=await client.query('SELECT * FROM payroll_periods WHERE id=$1',[id]);
          next=nr.rows[0];
        }
        const curStart=new Date(String(cur.start_date).slice(0,10)+'T00:00:00Z');
        const nextStart=new Date(String(next.start_date).slice(0,10)+'T00:00:00Z');
        const shiftDays=Math.round((nextStart.getTime()-curStart.getTime())/86400000);
        for(const s of source){
          const d=new Date(dateOnly(s.date)+'T00:00:00Z');
          d.setUTCDate(d.getUTCDate()+shiftDays);
          const date=d.toISOString().slice(0,10);
          if(date<String(next.start_date).slice(0,10)||date>String(next.end_date).slice(0,10))continue;
          const id=`sched_${randomBytes(8).toString('hex')}`;
          const ins=await client.query(
            'INSERT INTO schedules(id,employee_id,payroll_period_id,date,required_time_in,required_time_out,break_out,break_in,is_working_day,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(employee_id,payroll_period_id,date) DO NOTHING',
            [id,s.employee_id,next.id,date,s.required_time_in,s.required_time_out,s.break_out,s.break_in,s.is_working_day,s.notes]
          );
          copied+=ins.rowCount||0;
        }
      });
      return json({success:true,period:{id:next.id,name:next.name,startDate:String(next.start_date).slice(0,10),endDate:String(next.end_date).slice(0,10),payoutDate:String(next.payout_date).slice(0,10),status:next.status},copiedSchedules:copied});
    }
    if(path==='admin/schedules'&&m==='POST'&&isAdmin(u)){
      const b=await request.json(); if(!b.employeeId||!b.payrollPeriodId||!dateOk(b.date))return json({error:'Employee, payroll period, and valid date are required.'},400);
      const e=await employeeById(b.employeeId), p=await periodById(b.payrollPeriodId); if(!e||!p)return json({error:'Employee or payroll period not found.'},404);
      if(p.status!=='open')return json({error:'Schedules can only be changed while the payroll period is open.'},400);
      const date=dateOnly(b.date), start=dateOnly(p.start_date), end=dateOnly(p.end_date);
      if(!date||!start||!end||date<start||date>end)return json({error:'Schedule date must be inside the selected payroll cut-off.'},400);
      const working=b.isWorkingDay!==false;
      if(working&&(!timeOk(b.requiredTimeIn)||!timeOk(b.requiredTimeOut)||!b.requiredTimeIn||!b.requiredTimeOut))return json({error:'Required time in and time out are required for working days.'},400);
      if((b.breakOut&&!timeOk(b.breakOut))||(b.breakIn&&!timeOk(b.breakIn)))return json({error:'Break times are invalid.'},400);
      const existing=(await db.sql`SELECT id FROM schedules WHERE employee_id=${e.id} AND payroll_period_id=${p.id} AND date=${date}`).rows[0], id=existing?.id||b.id||`sched_${randomBytes(8).toString('hex')}`;
      if(existing) await db.sql`UPDATE schedules SET required_time_in=${working?b.requiredTimeIn:null},required_time_out=${working?b.requiredTimeOut:null},break_out=${working?(b.breakOut||null):null},break_in=${working?(b.breakIn||null):null},is_working_day=${working},notes=${b.notes||''} WHERE id=${id}`;
      else await db.sql`INSERT INTO schedules(id,employee_id,payroll_period_id,date,required_time_in,required_time_out,break_out,break_in,is_working_day,notes) VALUES(${id},${e.id},${p.id},${date},${working?b.requiredTimeIn:null},${working?b.requiredTimeOut:null},${working?(b.breakOut||null):null},${working?(b.breakIn||null):null},${working},${b.notes||''})`;
      // Any schedule change can change the amount of overtime, so previously
      // approved overtime for this duty date must be reviewed again.
      await db.sql`UPDATE attendance SET overtime_approval_status=CASE WHEN time_out IS NOT NULL AND ${working} THEN 'pending' ELSE 'not_required' END,overtime_reviewed_by=NULL,overtime_reviewed_at=NULL,updated_at=NOW() WHERE employee_id=${e.id} AND date=${date} AND payroll_period_id=${p.id}`;
      const s=(await db.sql`SELECT * FROM schedules WHERE id=${id}`).rows[0];
      return json({id:s.id,employeeId:s.employee_id,payrollPeriodId:s.payroll_period_id,date:dateOnly(s.date),requiredTimeIn:s.required_time_in||undefined,requiredTimeOut:s.required_time_out||undefined,breakOut:s.break_out||undefined,breakIn:s.break_in||undefined,isWorkingDay:Boolean(s.is_working_day),notes:s.notes});
    }
    if(path.startsWith('admin/schedules/')&&m==='DELETE'&&isAdmin(u)){
      const id=path.split('/')[2], s=(await db.sql`SELECT employee_id,payroll_period_id,date FROM schedules WHERE id=${id}`).rows[0]; if(s){const p=await periodById(s.payroll_period_id); if(p?.status!=='open')return json({error:'Schedules can only be changed while the payroll period is open.'},400); await db.sql`DELETE FROM schedules WHERE id=${id}`; await db.sql`UPDATE attendance SET overtime_approval_status='not_required',overtime_reviewed_by=NULL,overtime_reviewed_at=NULL,updated_at=NOW() WHERE employee_id=${s.employee_id} AND date=${s.date} AND payroll_period_id=${s.payroll_period_id}`;} return json({success:true});
    }
    if(path==='admin/attendance'&&m==='GET'&&isAdmin(u)){
      const q=new URL(request.url).searchParams;
      const biz=q.get('businessId');
      const date=q.get('date');
      const per=q.get('periodId');
      const selectedPeriod=per?await periodById(per):null;
      if(!selectedPeriod)return json([]);

      // Use the same parameterized pool query path already used by the
      // attendance write/schedule-resolution code. The selected payroll
      // period remains the authoritative schedule context for this view.
      const args:any[]=[
        dateOnly(selectedPeriod.start_date),
        dateOnly(selectedPeriod.end_date),
        selectedPeriod.id
      ];
      let sql=`SELECT
        a.id, a.employee_id AS "employeeId", a.business_id AS "businessId", a.date,
        a.time_in AS "timeIn", a.break_out AS "breakOut", a.break_in AS "breakIn",
        a.time_out AS "timeOut", a.late_minutes AS "lateMinutes",
        a.total_work_minutes AS "totalWorkMinutes", a.status,
        a.payroll_period_id AS "payrollPeriodId",
        a.overtime_approval_status AS "overtimeApprovalStatus",
        a.overtime_reviewed_by AS "overtimeReviewedBy",
        a.overtime_reviewed_at AS "overtimeReviewedAt",
        e.full_name AS "employeeName", e.employee_id AS "employeeIdCode",
        b.name AS "businessName",
        s.required_time_in AS "requiredTimeIn", s.required_time_out AS "requiredTimeOut",
        s.break_out AS "scheduleBreakOut", s.break_in AS "scheduleBreakIn",
        s.is_working_day AS "isWorkingDay"
      FROM attendance a
      JOIN employees e ON e.id=a.employee_id
      JOIN businesses b ON b.id=a.business_id
      LEFT JOIN schedules s
        ON s.employee_id=a.employee_id
       AND s.date=a.date
       AND s.payroll_period_id=$3
      WHERE a.date BETWEEN $1 AND $2
        AND (a.payroll_period_id=$3 OR a.payroll_period_id IS NULL)`;

      if(biz){ sql+=` AND a.business_id=$${args.length+1}`; args.push(biz); }
      if(date){ sql+=` AND a.date=$${args.length+1}`; args.push(date); }
      sql+=' ORDER BY a.date DESC,e.full_name';

      const r=await db.pool.query(sql,args);
      return json(r.rows.map((x:any)=>{
        // The SELECT aliases are camelCase for the API response, while the
        // shared attendance calculation functions intentionally consume the
        // database-shaped snake_case fields. Normalize once before calculating
        // so Admin and Employee portals use the exact same calculation path.
        const calculationRow={
          ...x,
          time_in:x.timeIn,
          break_out:x.breakOut,
          break_in:x.breakIn,
          time_out:x.timeOut,
          late_minutes:x.lateMinutes,
          total_work_minutes:x.totalWorkMinutes,
          overtime_approval_status:x.overtimeApprovalStatus,
          overtime_reviewed_by:x.overtimeReviewedBy,
          overtime_reviewed_at:x.overtimeReviewedAt
        };
        const s={date:x.date,required_time_in:x.requiredTimeIn,required_time_out:x.requiredTimeOut,break_out:x.scheduleBreakOut,break_in:x.scheduleBreakIn,is_working_day:x.isWorkingDay};
        const invalid=isInvalidShortDuty(calculationRow,s);
        const v=attendanceVariance(calculationRow,s);
        return {...x,date:dateOnly(x.date),lateMinutes:v.lateMinutes,undertimeMinutes:v.undertimeMinutes,overbreakMinutes:v.overbreakMinutes,varianceMinutes:v.varianceMinutes,overtimeMinutes:overtimeMinutes(calculationRow,s),overtimeApprovalStatus:overtimeApprovalStatus(calculationRow,s),totalWorkMinutes:calculationRow.time_in&&calculationRow.time_out?normalizedWorkMinutes(calculationRow,s):Number(x.totalWorkMinutes||0),status:invalid?'invalid':x.status};
      }));
    }
    if(path==='admin/settings'&&m==='GET'&&isAdmin(u)){
      const biz=new URL(request.url).searchParams.get('businessId')||'all';
      const s=(await db.sql`SELECT night_differential_hourly_rate AS "nightDifferentialHourlyRate",night_differential_multiplier AS "nightDifferentialMultiplier",regular_overtime_multiplier AS "regularOvertimeMultiplier" FROM payroll_settings WHERE business_id=${biz} OR business_id='all' ORDER BY CASE WHEN business_id=${biz} THEN 0 ELSE 1 END LIMIT 1`).rows[0];
      const h=(await db.sql`SELECT id,business_id AS "businessId",holiday_date AS "holidayDate",name,holiday_type AS "holidayType",overtime_rate AS "overtimeRate" FROM holidays WHERE business_id=${biz} OR business_id='all' ORDER BY holiday_date`).rows;
      return json({businessId:biz,nightDifferentialHourlyRate:Number(s?.nightDifferentialHourlyRate||0),nightDifferentialMultiplier:Number(s?.nightDifferentialMultiplier??1),regularOvertimeMultiplier:Number(s?.regularOvertimeMultiplier??1),holidays:h.map((x:any)=>({...x,holidayDate:String(x.holidayDate).slice(0,10),overtimeRate:Number(x.overtimeRate)}))});
    }
    if(path==='admin/settings'&&m==='PUT'&&isAdmin(u)){
       const b=await request.json(), biz=String(b.businessId||'all'), rate=Number(b.nightDifferentialHourlyRate), ndMultiplier=Number(b.nightDifferentialMultiplier), regularOtMultiplier=Number(b.regularOvertimeMultiplier);
       if(!Number.isFinite(rate)||rate<0||!Number.isFinite(ndMultiplier)||ndMultiplier<0||!Number.isFinite(regularOtMultiplier)||regularOtMultiplier<0)return json({error:'Payroll rates and multipliers must be valid non-negative numbers.'},400);
       if(biz!=='all' && !(await db.sql`SELECT 1 FROM businesses WHERE id=${biz}`).rows[0])return json({error:'Business not found.'},404);
       await db.sql`INSERT INTO payroll_settings(business_id,night_differential_hourly_rate,night_differential_multiplier,regular_overtime_multiplier) VALUES(${biz},${rate},${ndMultiplier},${regularOtMultiplier}) ON CONFLICT(business_id) DO UPDATE SET night_differential_hourly_rate=EXCLUDED.night_differential_hourly_rate,night_differential_multiplier=EXCLUDED.night_differential_multiplier,regular_overtime_multiplier=EXCLUDED.regular_overtime_multiplier,updated_at=NOW()`;
       return json({success:true,businessId:biz,nightDifferentialHourlyRate:rate,nightDifferentialMultiplier:ndMultiplier,regularOvertimeMultiplier:regularOtMultiplier});
     }
     if(path==='admin/holidays'&&m==='POST'&&isAdmin(u)){
      const b=await request.json();
      if(!dateOk(b.holidayDate)||!b.name||!holidayTypeOk(b.holidayType)||Number(b.overtimeRate)<0)return json({error:'Holiday date, name, type, and a valid overtime rate are required.'},400);
      const id=`hol_${randomBytes(8).toString('hex')}`;
      await db.sql`INSERT INTO holidays(id,business_id,holiday_date,name,holiday_type,overtime_rate) VALUES(${id},${b.businessId||'all'},${b.holidayDate},${b.name},${b.holidayType},${Number(b.overtimeRate)}) ON CONFLICT(business_id,holiday_date) DO UPDATE SET name=EXCLUDED.name,holiday_type=EXCLUDED.holiday_type,overtime_rate=EXCLUDED.overtime_rate`;
      return json({success:true,id});
    }
    if(path.startsWith('admin/holidays/')&&m==='PUT'&&isAdmin(u)){
      const id=path.split('/')[2], h=(await db.sql`SELECT * FROM holidays WHERE id=${id}`).rows[0]; if(!h)return json({error:'Holiday not found.'},404);
      const b=await request.json(), n={businessId:b.businessId??h.business_id,holidayDate:b.holidayDate??String(h.holiday_date).slice(0,10),name:b.name??h.name,holidayType:b.holidayType??h.holiday_type,overtimeRate:b.overtimeRate!==undefined?Number(b.overtimeRate):Number(h.overtime_rate)};
      if(!dateOk(n.holidayDate)||!n.name||!holidayTypeOk(n.holidayType)||n.overtimeRate<0)return json({error:'Invalid holiday data.'},400);
      await db.sql`UPDATE holidays SET business_id=${n.businessId},holiday_date=${n.holidayDate},name=${n.name},holiday_type=${n.holidayType},overtime_rate=${n.overtimeRate} WHERE id=${id}`;
      return json({success:true,id,...n});
    }
    if(path.startsWith('admin/holidays/')&&m==='DELETE'&&isAdmin(u)){await db.sql`DELETE FROM holidays WHERE id=${path.split('/')[2]}`;return json({success:true});}
    if(path==='admin/attendance'&&m==='POST'&&isAdmin(u)){
      const b=await request.json(), e=await employeeById(b.employeeId);
      if(!e||!dateOk(b.date))return json({error:'Employee and valid attendance date are required.'},400);
      const iso=(v:any)=>v?new Date(v).toISOString():null;
      const ti=iso(b.timeIn), bo=iso(b.breakOut), bi=iso(b.breakIn), to=iso(b.timeOut);
      if([b.timeIn,b.breakOut,b.breakIn,b.timeOut].some((v:any)=>v && Number.isNaN(new Date(v).getTime())))return json({error:'One or more attendance times are invalid.'},400);
      const schedule=await resolveScheduleForAttendance(e.id,b.date,b.payrollPeriodId||null);
      const attendancePeriodId=schedule?.payroll_period_id||b.payrollPeriodId||null;
      if(attendancePeriodId){
        const p=await periodById(attendancePeriodId);
        if(p?.status==='finalized')return json({error:'Attendance cannot be changed after the payroll period is finalized.'},400);
      }
      const draft={time_in:ti,break_out:bo,break_in:bi,time_out:to};
      const metrics=attendanceVariance(draft,schedule);
      const late=metrics.lateMinutes;
      const work=ti&&to&&schedule?normalizedWorkMinutes(draft,schedule):0;
      const invalid=isInvalidShortDuty(draft,schedule);
      const status=invalid?'present':(ti?(late>0?'late':'present'):'absent');
      const id=b.id||`att_${randomBytes(8).toString('hex')}`;
      const draftOvertime=overtimeMinutes(draft,schedule);
      const approvalStatus=draftOvertime>0?'pending':'not_required';
      await db.sql`INSERT INTO attendance(id,employee_id,business_id,payroll_period_id,date,time_in,break_out,break_in,time_out,late_minutes,total_work_minutes,status,overtime_approval_status,overtime_reviewed_by,overtime_reviewed_at) VALUES(${id},${e.id},${e.business_id},${schedule?.payroll_period_id||b.payrollPeriodId||null},${b.date},${ti},${bo},${bi},${to},${late},${work},${status},${approvalStatus},NULL,NULL) ON CONFLICT(employee_id,date) DO UPDATE SET business_id=EXCLUDED.business_id,payroll_period_id=EXCLUDED.payroll_period_id,time_in=EXCLUDED.time_in,break_out=EXCLUDED.break_out,break_in=EXCLUDED.break_in,time_out=EXCLUDED.time_out,late_minutes=EXCLUDED.late_minutes,total_work_minutes=EXCLUDED.total_work_minutes,status=EXCLUDED.status,overtime_approval_status=EXCLUDED.overtime_approval_status,overtime_reviewed_by=NULL,overtime_reviewed_at=NULL,updated_at=NOW()`;
      return json({success:true,id});
    }
    if(path.startsWith('admin/attendance/')&&path.endsWith('/overtime-approval')&&m==='POST'&&isAdmin(u)){
      const parts=path.split('/'), id=parts[2], b=await request.json();
      const decision=String(b.status||'');
      if(!['approved','rejected'].includes(decision))return json({error:'Overtime approval status must be approved or rejected.'},400);
      const a=(await db.sql`SELECT * FROM attendance WHERE id=${id}`).rows[0];
      if(!a)return json({error:'Attendance record not found.'},404);
      const s=await resolveScheduleForAttendance(a.employee_id,a.date,a.payroll_period_id||null);
      const rawOvertime=overtimeMinutes(a,s);
      if(rawOvertime<=0)return json({error:'This attendance record has no qualifying overtime to approve.'},400);
      const p=a.payroll_period_id?await periodById(a.payroll_period_id):null;
      if(!p)return json({error:'Payroll period not found for this attendance record.'},404);
      if(p.status==='finalized')return json({error:'Overtime cannot be changed after the payroll period is finalized.'},400);
      const now=new Date().toISOString();
      await db.sql`UPDATE attendance SET overtime_approval_status=${decision},overtime_reviewed_by=${u.userId},overtime_reviewed_at=${now},updated_at=NOW() WHERE id=${id}`;
      return json({success:true,status:decision,reviewedAt:now});
    }
    if(path.startsWith('admin/attendance/')&&m==='DELETE'&&isAdmin(u)){
      const id=path.split('/')[2];
      const a=(await db.sql`SELECT id,payroll_period_id FROM attendance WHERE id=${id}`).rows[0];
      if(!a)return json({error:'Attendance record not found.'},404);
      if(a.payroll_period_id){
        const p=await periodById(a.payroll_period_id);
        if(p?.status==='finalized')return json({error:'Attendance cannot be changed after the payroll period is finalized.'},400);
      }
      await db.sql`DELETE FROM attendance WHERE id=${id}`;
      return json({success:true});
    }
    if(path.startsWith('admin/attendance/')&&m==='PUT'&&isAdmin(u)){
      const id=path.split('/')[2], a=(await db.sql`SELECT * FROM attendance WHERE id=${id}`).rows[0]; if(!a)return json({error:'Attendance record not found.'},404);
      if(a.payroll_period_id){
        const p=await periodById(a.payroll_period_id);
        if(p?.status==='finalized')return json({error:'Attendance cannot be changed after the payroll period is finalized.'},400);
      }
      const b=await request.json(), iso=(v:any)=>v?new Date(v).toISOString():null;
      const n={timeIn:b.timeIn!==undefined?iso(b.timeIn):a.time_in,breakOut:b.breakOut!==undefined?iso(b.breakOut):a.break_out,breakIn:b.breakIn!==undefined?iso(b.breakIn):a.break_in,timeOut:b.timeOut!==undefined?iso(b.timeOut):a.time_out};
      const schedule=await resolveScheduleForAttendance(a.employee_id,a.date,a.payroll_period_id||b.payrollPeriodId||null);
      const draft={time_in:n.timeIn,break_out:n.breakOut,break_in:n.breakIn,time_out:n.timeOut};
      const metrics=attendanceVariance(draft,schedule);
      const derivedLate=metrics.lateMinutes;
      const derivedWork=n.timeIn&&n.timeOut&&schedule?normalizedWorkMinutes(draft,schedule):0;
      const invalid=isInvalidShortDuty(draft,schedule);
      const derivedStatus=invalid?'present':(n.timeIn?(derivedLate>0?'late':'present'):'absent');
      const derivedOvertime=overtimeMinutes(draft,schedule);
       const approvalStatus=derivedOvertime>0?'pending':'not_required';
       await db.sql`UPDATE attendance SET payroll_period_id=${schedule?.payroll_period_id||b.payrollPeriodId||a.payroll_period_id||null},time_in=${n.timeIn},break_out=${n.breakOut},break_in=${n.breakIn},time_out=${n.timeOut},late_minutes=${derivedLate},total_work_minutes=${derivedWork},status=${derivedStatus},overtime_approval_status=${approvalStatus},overtime_reviewed_by=NULL,overtime_reviewed_at=NULL,updated_at=NOW() WHERE id=${id}`;
      return json({success:true,id});
    }
    if(path==='admin/deductions/types'&&m==='GET'&&isAdmin(u)){const r=await db.sql`SELECT id,business_id AS "businessId",name,calculation_type AS "calculationType",value,recurring,status FROM deduction_types ORDER BY name`;return json(r.rows.map((x:any)=>({...x,value:Number(x.value)})));}
    if(path==='admin/deductions/types'&&m==='POST'&&isAdmin(u)){const b=await request.json();if(!b.name||b.value===undefined)return json({error:'Name and value are required.'},400);const id=`ded_${randomBytes(8).toString('hex')}`;await db.sql`INSERT INTO deduction_types(id,business_id,name,calculation_type,value,recurring,status) VALUES(${id},${b.businessId||'all'},${b.name},${b.calculationType||'fixed'},${Number(b.value)},${b.recurring!==false},${b.status||'active'})`;return json({id,businessId:b.businessId||'all',name:b.name,calculationType:b.calculationType||'fixed',value:Number(b.value),recurring:b.recurring!==false,status:b.status||'active'});}
    if(path.startsWith('admin/deductions/types/')&&m==='PUT'&&isAdmin(u)){const id=path.split('/')[3],d=(await db.sql`SELECT * FROM deduction_types WHERE id=${id}`).rows[0];if(!d)return json({error:'Deduction type not found.'},404);const b=await request.json(),n={businessId:b.businessId??d.business_id,name:b.name??d.name,calculationType:b.calculationType??d.calculation_type,value:b.value!==undefined?Number(b.value):Number(d.value),recurring:b.recurring!==undefined?Boolean(b.recurring):Boolean(d.recurring),status:b.status??d.status};if(!n.name||!['fixed','percentage'].includes(n.calculationType)||!Number.isFinite(n.value)||n.value<0)return json({error:'Invalid deduction data.'},400);if(n.businessId!=='all'&&!(await db.sql`SELECT 1 FROM businesses WHERE id=${n.businessId}`).rows[0])return json({error:'Business not found.'},404);await db.sql`UPDATE deduction_types SET business_id=${n.businessId},name=${n.name},calculation_type=${n.calculationType},value=${n.value},recurring=${n.recurring},status=${n.status} WHERE id=${id}`;return json({id,businessId:n.businessId,...n});}
    if(path.startsWith('admin/deductions/types/')&&m==='DELETE'&&isAdmin(u)){await db.sql`DELETE FROM deduction_types WHERE id=${path.split('/')[3]}`;return json({success:true});}
    if(path==='admin/deductions/employee'&&m==='GET'&&isAdmin(u)){const id=new URL(request.url).searchParams.get('employeeId');const r=id?await db.sql`SELECT d.*,e.full_name AS "employeeName" FROM employee_deductions d JOIN employees e ON e.id=d.employee_id WHERE d.employee_id=${id} ORDER BY d.id DESC`:await db.sql`SELECT d.*,e.full_name AS "employeeName" FROM employee_deductions d JOIN employees e ON e.id=d.employee_id ORDER BY d.id DESC`;return json(r.rows.map((x:any)=>({id:x.id,employeeId:x.employee_id,deductionTypeId:x.deduction_type_id||undefined,deductionName:x.deduction_name,amount:Number(x.amount),payrollPeriodId:x.payroll_period_id||undefined,recurring:Boolean(x.recurring),status:x.status,employeeName:x.employeeName})));}
    if(path==='admin/deductions/employee'&&m==='POST'&&isAdmin(u)){const b=await request.json();if(!b.employeeId||!b.deductionName||b.amount===undefined)return json({error:'Employee, deduction name, and amount are required.'},400);if(b.recurring===false&&!b.payrollPeriodId)return json({error:'Payroll period is required for one-time deductions.'},400);const id=`empded_${randomBytes(8).toString('hex')}`;await db.sql`INSERT INTO employee_deductions(id,employee_id,deduction_type_id,deduction_name,amount,payroll_period_id,recurring,status) VALUES(${id},${b.employeeId},${b.deductionTypeId||null},${b.deductionName},${Number(b.amount)},${b.recurring?null:b.payrollPeriodId},${Boolean(b.recurring)},${b.status||'active'})`;return json({id,employeeId:b.employeeId,deductionTypeId:b.deductionTypeId,deductionName:b.deductionName,amount:Number(b.amount),payrollPeriodId:b.recurring?undefined:b.payrollPeriodId,recurring:Boolean(b.recurring),status:b.status||'active'});}
    if(path.startsWith('admin/deductions/employee/')&&m==='PUT'&&isAdmin(u)){const id=path.split('/')[3],d=(await db.sql`SELECT * FROM employee_deductions WHERE id=${id}`).rows[0];if(!d)return json({error:'Employee deduction not found.'},404);const b=await request.json(),n={employeeId:b.employeeId??d.employee_id,deductionTypeId:b.deductionTypeId!==undefined?(b.deductionTypeId||null):(d.deduction_type_id||null),deductionName:b.deductionName??d.deduction_name,amount:b.amount!==undefined?Number(b.amount):Number(d.amount),payrollPeriodId:b.recurring===true?null:(b.payrollPeriodId ?? d.payroll_period_id ?? null),recurring:b.recurring!==undefined?Boolean(b.recurring):Boolean(d.recurring),status:b.status??d.status};if(!n.employeeId||!n.deductionName||!Number.isFinite(n.amount)||n.amount<0)return json({error:'Invalid employee deduction data.'},400);if(n.recurring===false&&!n.payrollPeriodId)return json({error:'Payroll period is required for one-time deductions.'},400);if(!(await employeeById(n.employeeId)))return json({error:'Employee not found.'},404);await db.sql`UPDATE employee_deductions SET employee_id=${n.employeeId},deduction_type_id=${n.deductionTypeId},deduction_name=${n.deductionName},amount=${n.amount},payroll_period_id=${n.payrollPeriodId},recurring=${n.recurring},status=${n.status} WHERE id=${id}`;return json({id,employeeId:n.employeeId,deductionTypeId:n.deductionTypeId||undefined,deductionName:n.deductionName,amount:n.amount,payrollPeriodId:n.payrollPeriodId||undefined,recurring:n.recurring,status:n.status});}
    if(path.startsWith('admin/deductions/employee/')&&m==='DELETE'&&isAdmin(u)){await db.sql`DELETE FROM employee_deductions WHERE id=${path.split('/')[3]}`;return json({success:true});}
    if(path==='admin/incentives'&&m==='GET'&&isAdmin(u)){const r=await db.sql`SELECT i.id,i.business_id AS "businessId",i.name,i.description,i.amount,i.incentive_type AS "incentiveType",i.require_no_late AS "requireNoLate",i.require_no_absence AS "requireNoAbsence",i.require_no_undertime AS "requireNoUndertime",i.status,i.effective_date AS "effectiveDate",CASE WHEN i.business_id='all' THEN 'All Businesses' ELSE COALESCE(b.name,'') END AS "businessName" FROM incentive_programs i LEFT JOIN businesses b ON b.id=i.business_id ORDER BY i.name`;return json(r.rows.map((x:any)=>({...x,amount:Number(x.amount)}))); }
    if(path==='admin/incentives'&&m==='POST'&&isAdmin(u)){const b=await request.json();if(!b.businessId||!b.name||b.amount===undefined)return json({error:'Business, name, and amount are required.'},400);const id=`inc_${randomBytes(8).toString('hex')}`,type=b.incentiveType||'attendance';if(!['attendance','other'].includes(type))return json({error:'Invalid incentive type.'},400);await db.sql`INSERT INTO incentive_programs(id,business_id,name,description,amount,incentive_type,require_no_late,require_no_absence,require_no_undertime,status,effective_date) VALUES(${id},${b.businessId},${b.name},${b.description||''},${Number(b.amount)},${type},${b.requireNoLate!==false},${b.requireNoAbsence!==false},${b.requireNoUndertime===true},${b.status||'active'},${b.effectiveDate||phNow().date})`;return json({id,businessId:b.businessId,name:b.name,description:b.description||'',amount:Number(b.amount),incentiveType:type,requireNoLate:b.requireNoLate!==false,requireNoAbsence:b.requireNoAbsence!==false,requireNoUndertime:b.requireNoUndertime===true,status:b.status||'active',effectiveDate:b.effectiveDate||phNow().date});}
    if(path.startsWith('admin/incentives/')&&m==='PUT'&&isAdmin(u)){const id=path.split('/')[2],i=(await db.sql`SELECT * FROM incentive_programs WHERE id=${id}`).rows[0];if(!i)return json({error:'Incentive not found.'},404);const b=await request.json(),n={name:b.name??i.name,description:b.description??i.description,amount:b.amount!==undefined?Number(b.amount):Number(i.amount),incentiveType:b.incentiveType??i.incentive_type,requireNoLate:b.requireNoLate!==undefined?Boolean(b.requireNoLate):i.require_no_late,requireNoAbsence:b.requireNoAbsence!==undefined?Boolean(b.requireNoAbsence):i.require_no_absence,requireNoUndertime:b.requireNoUndertime!==undefined?Boolean(b.requireNoUndertime):Boolean(i.require_no_undertime),status:b.status??i.status,effectiveDate:b.effectiveDate??String(i.effective_date).slice(0,10)};if(!['attendance','other'].includes(n.incentiveType))return json({error:'Invalid incentive type.'},400);await db.sql`UPDATE incentive_programs SET name=${n.name},description=${n.description},amount=${n.amount},incentive_type=${n.incentiveType},require_no_late=${n.requireNoLate},require_no_absence=${n.requireNoAbsence},require_no_undertime=${n.requireNoUndertime},status=${n.status},effective_date=${n.effectiveDate} WHERE id=${id}`;return json({id,businessId:i.business_id,...n});}
    if(path.startsWith('admin/incentives/')&&m==='DELETE'&&isAdmin(u)){await db.sql`DELETE FROM incentive_programs WHERE id=${path.split('/')[2]}`;return json({success:true});}
    if(path.startsWith('admin/payroll/')&&m==='GET'&&isAdmin(u)){
      const id=path.split('/')[2],p=await periodById(id);
      if(!p)return json({error:'Payroll period not found.'},404);
      let records:any[]=[];
      if(p.status==='finalized'){
        const frozen=(await db.sql`SELECT payroll_record AS "payrollRecord" FROM finalized_payroll_ledger WHERE payroll_period_id=${id} ORDER BY employee_id`).rows;
        if(frozen.length)records=frozen.map((row:any)=>typeof row.payrollRecord==='string'?JSON.parse(row.payrollRecord):row.payrollRecord);
      }
      if(!records.length){
        const es=(await db.sql`SELECT id FROM employees WHERE status='active' ORDER BY full_name`).rows;
        for(const e of es)records.push(await calculatePayroll(e.id,id));
      }
      return json({period:{id:p.id,name:p.name,startDate:dateOnly(p.start_date),endDate:dateOnly(p.end_date),payoutDate:dateOnly(p.payout_date),status:p.status},records});
    }
    if(path==='admin/payroll/status'&&m==='POST'&&isAdmin(u)){
      const b=await request.json();
      if(!['open','for_approval','approved','finalized'].includes(b.status))return json({error:'Invalid payroll status.'},400);
      const p=await periodById(b.periodId);
      if(!p)return json({error:'Payroll period not found.'},404);
      if(p.status==='finalized'&&b.status!=='finalized')return json({error:'Finalized payroll cannot be reopened.'},400);
      if(b.status==='finalized'&&p.status!=='finalized'){
        const es=(await db.sql`SELECT id FROM employees WHERE status='active' ORDER BY full_name`).rows;
        const payrollRecords=await Promise.all(es.map((e:any)=>calculatePayroll(e.id,p.id)));
        await withTransaction(async(client:any)=>{
          const locked=(await client.query('SELECT status FROM payroll_periods WHERE id=$1 FOR UPDATE',[p.id])).rows[0];
          if(!locked)throw new Error('Payroll period not found.');
          if(locked.status==='finalized')throw new Error('Payroll period is already finalized.');
          for(const r of payrollRecords){
            await client.query('INSERT INTO finalized_payroll_ledger(payroll_period_id,employee_id,payroll_record) VALUES($1,$2,$3::jsonb) ON CONFLICT(payroll_period_id,employee_id) DO NOTHING',[p.id,r.employeeId,JSON.stringify(r)]);
            await client.query('INSERT INTO payroll_rate_snapshots(id,payroll_period_id,employee_id,daily_rate) VALUES($1,$2,$3,$4) ON CONFLICT(payroll_period_id,employee_id) DO NOTHING',['rate_'+p.id+'_'+r.employeeId,p.id,r.employeeId,r.dailyRate]);
            await client.query('DELETE FROM payroll_deduction_snapshots WHERE payroll_period_id=$1 AND employee_id=$2',[p.id,r.employeeId]);
            await client.query('INSERT INTO payroll_deduction_snapshot_headers(payroll_period_id,employee_id) VALUES($1,$2) ON CONFLICT(payroll_period_id,employee_id) DO NOTHING',[p.id,r.employeeId]);
            for(let i=0;i<r.breakdown.deductions.length;i++){
              const d=r.breakdown.deductions[i];
              await client.query('INSERT INTO payroll_deduction_snapshots(id,payroll_period_id,employee_id,line_no,deduction_name,deduction_type,amount) VALUES($1,$2,$3,$4,$5,$6,$7)',['pds_'+p.id+'_'+r.employeeId+'_'+i,p.id,r.employeeId,i,d.name,d.type,Number(d.amount)]);
            }
          }
          await client.query('UPDATE payroll_periods SET status=$1 WHERE id=$2',['finalized',p.id]);
        });
      } else {
        await db.sql`UPDATE payroll_periods SET status=${b.status} WHERE id=${b.periodId}`;
      }
      return json({success:true,status:b.status});
    }
    if(path==='employee/dashboard'&&m==='GET'&&isEmployee(u)){const e=await employeeById(u.employeeDbId),biz=e?(await db.sql`SELECT name FROM businesses WHERE id=${e.business_id}`).rows[0]:null;if(!e)return json({error:'Employee record not found.'},404);const today=phNow().date;
      let a=(await db.sql`SELECT * FROM attendance WHERE employee_id=${e.id} AND date=${today}`).rows[0];
      let s=await resolveScheduleForAttendance(e.id,today,a?.payroll_period_id||null);
      if(!a){
        const open=(await db.sql`SELECT a.*,s.id AS schedule_id,s.payroll_period_id,s.required_time_in,s.required_time_out,s.break_out AS schedule_break_out,s.break_in AS schedule_break_in,s.is_working_day,s.notes FROM attendance a JOIN schedules s ON s.employee_id=a.employee_id AND s.date=a.date AND s.payroll_period_id=a.payroll_period_id WHERE a.employee_id=${e.id} AND a.time_in IS NOT NULL AND a.time_out IS NULL AND s.is_working_day=true AND s.required_time_out < s.required_time_in ORDER BY a.date DESC LIMIT 1`).rows[0];
        if(open){a=open;s=(await db.sql`SELECT * FROM schedules WHERE id=${open.schedule_id}`).rows[0];}
      }const todayMetrics=attendanceVariance(a,s);const todayInvalid=isInvalidShortDuty(a,s);return json({employeeName:e.full_name,employeeId:e.employee_id,position:e.position,businessName:biz?.name||'',todaySchedule:s?{id:s.id,employeeId:s.employee_id,payrollPeriodId:s.payroll_period_id,date:dateOnly(s.date),requiredTimeIn:s.required_time_in||undefined,requiredTimeOut:s.required_time_out||undefined,breakOut:s.break_out||undefined,breakIn:s.break_in||undefined,isWorkingDay:Boolean(s.is_working_day),notes:s.notes}:{isWorkingDay:false,notes:'No schedule assigned'},todayAttendance:a?{id:a.id,employeeId:a.employee_id,businessId:a.business_id,date:dateOnly(a.date),timeIn:a.time_in||undefined,breakOut:a.break_out||undefined,breakIn:a.break_in||undefined,timeOut:a.time_out||undefined,lateMinutes:todayMetrics.lateMinutes,overtimeMinutes:overtimeMinutes(a,s),overtimeApprovalStatus:overtimeApprovalStatus(a,s),totalWorkMinutes:a.time_in&&a.time_out&&s?normalizedWorkMinutes(a,s):Number(a.total_work_minutes||0),status:todayInvalid?'invalid':(a.time_in?(todayMetrics.lateMinutes>0?'late':'present'):a.status)}:null,currentServerTime:new Date().toISOString()});}
    if(path==='employee/clock'&&m==='POST'&&isEmployee(u)){
      const e=await employeeById(u.employeeDbId); if(!e)return json({error:'Employee record not found.'},404);
      const b=await request.json(); if(!['time_in','break_out','break_in','time_out'].includes(b.action))return json({error:'Invalid clock action.'},400);
      const now=new Date(), ph=phNow(), today=ph.date;
      let s:any=null, a:any=null;
      if(b.action==='time_in'){
        s=await resolveScheduleForAttendance(e.id,today);
        if(!s||!s.is_working_day)return json({error:'No working schedule is assigned for today.'},400);
        a=(await db.sql`SELECT * FROM attendance WHERE employee_id=${e.id} AND date=${today}`).rows[0];
      } else {
        a=(await db.sql`SELECT a.*,s.payroll_period_id,s.required_time_in,s.required_time_out,s.is_working_day FROM attendance a JOIN schedules s ON s.employee_id=a.employee_id AND s.date=a.date AND s.payroll_period_id=a.payroll_period_id WHERE a.employee_id=${e.id} AND a.time_in IS NOT NULL AND a.time_out IS NULL AND s.is_working_day=true ORDER BY a.date DESC,a.time_in DESC LIMIT 1`).rows[0];
        if(a) s=(await db.sql`SELECT * FROM schedules WHERE employee_id=${e.id} AND date=${a.date} AND payroll_period_id=${a.payroll_period_id}`).rows[0];
        if(!a){return json({error:'No open attendance record found. Please contact your supervisor if you forgot to time in.'},400);}
        if(b.action==='break_out' || b.action==='break_in' || b.action==='time_out'){
          const age=now.getTime()-new Date(a.time_in).getTime();
          if(age>36*60*60*1000)return json({error:'The open attendance record is too old. Please contact your supervisor.'},400);
        }
      }
      const p=await periodById(s.payroll_period_id); if(!p||p.status!=='open')return json({error:'Attendance is closed for this payroll period.'},400);
      if(b.action==='time_in'){
        if(a?.time_in)return json({error:'Already timed in for this scheduled date.'},400);
        const req=parseHm(s.required_time_in),late=Math.max(0,ph.minute-req),id=a?.id||`att_${randomBytes(8).toString('hex')}`;
        await db.sql`INSERT INTO attendance(id,employee_id,business_id,payroll_period_id,date,time_in,late_minutes,total_work_minutes,status) VALUES(${id},${e.id},${e.business_id},${s.payroll_period_id},${today},${ph.iso},${late},0,${late?'late':'present'}) ON CONFLICT(employee_id,date) DO UPDATE SET business_id=EXCLUDED.business_id,payroll_period_id=EXCLUDED.payroll_period_id,time_in=EXCLUDED.time_in,late_minutes=EXCLUDED.late_minutes,status=EXCLUDED.status,updated_at=NOW()`;
        a=(await db.sql`SELECT * FROM attendance WHERE id=${id}`).rows[0];
      } else if(b.action==='break_out'){
        if(a.break_out)return json({error:'Already taken a break.'},400);
        await db.sql`UPDATE attendance SET break_out=${ph.iso},updated_at=NOW() WHERE id=${a.id}`;
      } else if(b.action==='break_in'){
        if(!a.break_out)return json({error:'Must break out before breaking back in.'},400);
        if(a.break_in)return json({error:'Already returned from break.'},400);
        await db.sql`UPDATE attendance SET break_in=${ph.iso},updated_at=NOW() WHERE id=${a.id}`;
      } else {
        if(a.time_out)return json({error:'Already timed out.'},400);
        if(a.break_out&&!a.break_in)return json({error:'Please complete your break before timing out.'},400);
        const work=normalizedWorkMinutes({...a,time_out:ph.iso},s);
        const finalMetrics=attendanceVariance({...a,time_out:ph.iso},s);
        const clockOvertime=overtimeMinutes({...a,time_out:ph.iso},s);
        const approvalStatus=clockOvertime>0?'pending':'not_required';
        await db.sql`UPDATE attendance SET time_out=${ph.iso},total_work_minutes=${work},status=${finalMetrics.lateMinutes>0?'late':'present'},overtime_approval_status=${approvalStatus},overtime_reviewed_by=NULL,overtime_reviewed_at=NULL,updated_at=NOW() WHERE id=${a.id}`;
      }
      a=(await db.sql`SELECT * FROM attendance WHERE id=${a.id}`).rows[0];
      const responseMetrics=attendanceVariance(a,s);
      const responseInvalid=isInvalidShortDuty(a,s);
      return json({success:true,attendance:{id:a.id,employeeId:a.employee_id,businessId:a.business_id,payrollPeriodId:a.payroll_period_id||undefined,date:dateOnly(a.date),timeIn:a.time_in||undefined,breakOut:a.break_out||undefined,breakIn:a.break_in||undefined,timeOut:a.time_out||undefined,lateMinutes:responseMetrics.lateMinutes,overtimeMinutes:overtimeMinutes(a,s),overtimeApprovalStatus:overtimeApprovalStatus(a,s),totalWorkMinutes:a.time_in&&a.time_out&&s?normalizedWorkMinutes(a,s):Number(a.total_work_minutes||0),status:responseInvalid?'invalid':a.status}});
    }
    if(path==='employee/periods'&&m==='GET'&&isEmployee(u)){
      const r=await db.sql`SELECT id,name,start_date AS "startDate",end_date AS "endDate",payout_date AS "payoutDate",status FROM payroll_periods ORDER BY start_date DESC`;
      return json(r.rows.map((p:any)=>({id:p.id,name:p.name,startDate:dateOnly(p.startDate),endDate:dateOnly(p.endDate),payoutDate:dateOnly(p.payoutDate),status:p.status})));
    }
    if(path==='employee/schedules'&&m==='GET'&&isEmployee(u)){const q=new URL(request.url).searchParams,id=q.get('periodId');const r=id?await db.sql`SELECT * FROM schedules WHERE employee_id=${u.employeeDbId} AND payroll_period_id=${id} ORDER BY date`:await db.sql`SELECT * FROM schedules WHERE employee_id=${u.employeeDbId} ORDER BY date DESC`;return json(r.rows.map((s:any)=>({id:s.id,employeeId:s.employee_id,payrollPeriodId:s.payroll_period_id,date:dateOnly(s.date),requiredTimeIn:s.required_time_in||undefined,requiredTimeOut:s.required_time_out||undefined,breakOut:s.break_out||undefined,breakIn:s.break_in||undefined,isWorkingDay:Boolean(s.is_working_day),notes:s.notes})));}
    if(path==='employee/attendance'&&m==='GET'&&isEmployee(u)){
      const q=new URL(request.url).searchParams;
      const id=q.get('periodId');
      const p=id?await periodById(id):(await db.sql`SELECT * FROM payroll_periods WHERE status IN('open','for_approval','approved','finalized') ORDER BY start_date DESC LIMIT 1`).rows[0];
      if(!p)return json({period:null,attendance:[]});

      // The selected payroll cut-off is also the authoritative schedule context
      // for Employee Attendance. This must match the Admin Attendance query.
      const r=await db.sql`
        SELECT a.*,
               s.required_time_in,
               s.required_time_out,
               s.break_out AS schedule_break_out,
               s.break_in AS schedule_break_in,
               s.is_working_day,
               s.date AS schedule_date
        FROM attendance a
        LEFT JOIN schedules s
          ON s.employee_id=a.employee_id
         AND s.date=a.date
         AND s.payroll_period_id=${p.id}
        WHERE a.employee_id=${u.employeeDbId}
          AND a.date BETWEEN ${p.start_date} AND ${p.end_date}
          AND (a.payroll_period_id=${p.id} OR a.payroll_period_id IS NULL)
        ORDER BY a.date DESC`;

      return json({
        period:{
          id:p.id,
          name:p.name,
          startDate:dateOnly(p.start_date),
          endDate:dateOnly(p.end_date),
          payoutDate:dateOnly(p.payout_date),
          status:p.status
        },
        attendance:r.rows.map((a:any)=>{
          const s={
            date:a.schedule_date||a.date,
            required_time_in:a.required_time_in,
            required_time_out:a.required_time_out,
            break_out:a.schedule_break_out,
            break_in:a.schedule_break_in,
            is_working_day:a.is_working_day
          };
          const invalid=isInvalidShortDuty(a,s);
          const v=attendanceVariance(a,s);
          return {
            id:a.id,
            employeeId:a.employee_id,
            businessId:a.business_id,
            payrollPeriodId:a.payroll_period_id||undefined,
            date:dateOnly(a.date),
            timeIn:a.time_in||undefined,
            breakOut:a.break_out||undefined,
            breakIn:a.break_in||undefined,
            timeOut:a.time_out||undefined,
            lateMinutes:v.lateMinutes,
            undertimeMinutes:v.undertimeMinutes,
            overbreakMinutes:v.overbreakMinutes,
            varianceMinutes:v.varianceMinutes,
            overtimeMinutes:overtimeMinutes(a,s),
            overtimeApprovalStatus:overtimeApprovalStatus(a,s),
            totalWorkMinutes:a.time_in&&a.time_out?normalizedWorkMinutes(a,s):Number(a.total_work_minutes||0),
            status:invalid?'invalid':a.status,
            scheduledTime:a.is_working_day?`${a.required_time_in} - ${a.required_time_out}`:'OFF'
          };
        })
      });
    }
    if(path==='employee/payroll-periods'&&m==='GET'&&isEmployee(u)){
      const periods = await employeePayrollPeriods();
      return json(periods.map((p:any)=>({
        id:p.id,
        name:p.name,
        startDate:dateOnly(p.startDate),
        endDate:dateOnly(p.endDate),
        payoutDate:dateOnly(p.payoutDate),
        status:p.status
      })));
    }
    if(path==='employee/payroll'&&m==='GET'&&isEmployee(u)){
      const q=new URL(request.url).searchParams;
      const requestedId=q.get('periodId');
      const periods=await employeePayrollPeriods();
      if(!periods.length)return json({error:'No payroll period found.'},404);
      const p=requestedId
        ? periods.find((period:any)=>period.id===requestedId)
        : periods[0];
      if(!p)return json({error:'Only the current payroll and the immediately previous payroll are available in the employee portal.'},403);
      return json(await calculatePayroll(u.employeeDbId,p.id));
    }
    if(path==='employee/payroll/approve'&&m==='POST'&&isEmployee(u)){
      const b=await request.json();
      const periods=await employeePayrollPeriods();
      const current=periods[0];
      if(!current || b.periodId!==current.id)return json({error:'Only the current payroll can be approved from the employee portal.'},403);
      const p=await periodById(b.periodId);
      if(!p)return json({error:'Payroll period not found.'},404);
      if(p.status!=='for_approval')return json({error:'Payroll is not currently awaiting employee approval.'},400);
      const now=new Date().toISOString();
      await db.sql`INSERT INTO payroll_approvals(payroll_period_id,employee_id,approved_at) VALUES(${b.periodId},${u.employeeDbId},${now}) ON CONFLICT(payroll_period_id,employee_id) DO UPDATE SET approved_at=EXCLUDED.approved_at`;
      return json({success:true,approvedAt:now});
    }
    return json({error:'Not found'},404);
  } catch(e:any) {
    console.error('[CV Log API]',e);
    return json({error:'Internal server error.'},500);
  }
}
export default async (request: Request) => handle(request);
export const config: Config={path:'/api/*'};
