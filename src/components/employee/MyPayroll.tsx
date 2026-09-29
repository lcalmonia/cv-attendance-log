import React, { useEffect, useState } from 'react';
import {
  DollarSign,
  Calendar,
  CheckCircle2,
  Clock,
  Printer,
  FileText,
  AlertCircle,
  ShieldCheck,
  Building2,
} from 'lucide-react';
import { PayrollPeriod, PayrollRecord } from '../../types';
import { api } from '../../services/api';
import { PayslipModal } from '../PayslipModal';

export const MyPayroll: React.FC = () => {
  const [payroll, setPayroll] = useState<PayrollRecord | null>(null);
  const [payrollPeriods, setPayrollPeriods] = useState<PayrollPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [payslipOpen, setPayslipOpen] = useState(false);
  const [message, setMessage] = useState('');

  const loadPayrollPeriods = async () => {
    setLoading(true);
    try {
      const periods = await api.employee.getPayrollPeriods();
      setPayrollPeriods(periods);
      const currentPeriodId = periods[0]?.id || '';
      setSelectedPeriodId(currentPeriodId);
      if (currentPeriodId) {
        const data = await api.employee.getPayroll(currentPeriodId);
        setPayroll(data);
      } else {
        setPayroll(null);
      }
    } catch (err: any) {
      console.error(err);
      setPayroll(null);
    } finally {
      setLoading(false);
    }
  };

  const loadPayroll = async (periodId: string) => {
    setLoading(true);
    try {
      const data = await api.employee.getPayroll(periodId);
      setPayroll(data);
    } catch (err: any) {
      console.error(err);
      setPayroll(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayrollPeriods();
  }, []);

  const handlePeriodChange = async (periodId: string) => {
    setSelectedPeriodId(periodId);
    setMessage('');
    await loadPayroll(periodId);
  };

  const handleApprove = async () => {
    if (!payroll || !isCurrentPayroll) return;
    setApproving(true);
    try {
      const res = await api.employee.approvePayroll(payroll.payrollPeriodId);
      setPayroll({ ...payroll, employeeApprovedAt: res.approvedAt });
      setMessage('You have approved your payroll breakdown for this cut-off.');
    } catch (err: any) {
      alert(err.message || 'Failed to approve payroll');
    } finally {
      setApproving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-slate-500 font-sans">
        Calculating payroll ledger…
      </div>
    );
  }

  if (!payroll) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400">
        No active payroll calculation found for your account.
      </div>
    );
  }

  const isCurrentPayroll = payrollPeriods[0]?.id === payroll.payrollPeriodId;
  const isPreviousPayroll = payrollPeriods[1]?.id === payroll.payrollPeriodId;
  const isTentative = payroll.status === 'open';
  const isForApproval = payroll.status === 'for_approval';
  const isApproved = Boolean(payroll.employeeApprovedAt);
  const isFinalized = payroll.status === 'finalized';

  return (
    <div className="space-y-6">
      {/* Header & Status Notice */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          {payrollPeriods.length > 1 && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <label htmlFor="employee-payroll-period" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Payroll Reference
              </label>
              <select
                id="employee-payroll-period"
                value={selectedPeriodId}
                onChange={(e) => handlePeriodChange(e.target.value)}
                className="w-full sm:w-auto min-w-[280px] bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {payrollPeriods.map((period, index) => (
                  <option key={period.id} value={period.id}>
                    {index === 0 ? 'Current Payroll' : 'Previous Payroll'} — {period.startDate} to {period.endDate}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-white tracking-tight">My Payroll Summary</h1>
            {isTentative && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Tentative Payroll
              </span>
            )}
            {isCurrentPayroll && isForApproval && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20">
                For Approval
              </span>
            )}
            {isFinalized && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Finalized
              </span>
            )}
            {isPreviousPayroll && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-slate-700/60 text-slate-300 border border-slate-600">
                Previous Payroll
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400">
            {isPreviousPayroll
              ? 'Reference only. Older payroll periods are not available in the employee portal.'
              : isTentative
                ? 'Estimated salary calculation based on current cut-off clock logs. Not final salary.'
                : 'Official salary computation for the current payroll cut-off.'}
          </p>
        </div>

        <button
          onClick={() => setPayslipOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium border border-slate-700 transition"
        >
          <FileText className="w-4 h-4 text-blue-400" />
          <span>View / Print Payslip</span>
        </button>
      </div>

      {isPreviousPayroll && (
        <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 text-slate-300 text-xs">
          This is your most recent previous payroll for reference. Only the current payroll and this one previous payroll are available here.
        </div>
      )}

      {message && (
        <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800 text-emerald-200 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Tentative Callout per Requirement 12 */}
      {isTentative && (
        <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-800/60 text-xs text-amber-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="text-white block font-bold text-sm tracking-wide">
              TENTATIVE PAYROLL ESTIMATE
            </strong>
            This is a preliminary projection based on your daily rate of ₱{payroll.dailyRate.toLocaleString()} and
            attendance logged to date. Final deductions and incentives will be locked when Super Admin submits this
            cut-off for approval.
          </div>
        </div>
      )}

      {/* Approval Banner per Requirement 13 */}
      {isForApproval && (
        <div className="p-5 rounded-xl bg-blue-950/40 border border-blue-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="font-bold text-white text-base flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-400" />
              <span>Payroll Ready for Employee Confirmation</span>
            </div>
            <p className="text-xs text-slate-300">
              Please review your gross earnings, incentives, and deductions below. Once verified, click Approve Payroll.
            </p>
          </div>

          <div>
            {isApproved ? (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-sm font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Approved on {new Date(payroll.employeeApprovedAt!).toLocaleDateString()}</span>
              </div>
            ) : (
              <button
                onClick={handleApprove}
                disabled={approving}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition shadow-lg shadow-emerald-600/30 disabled:opacity-60"
              >
                {approving ? 'Confirming…' : 'Approve Payroll'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Summary 3-Column Numbers */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <span className="text-xs uppercase font-semibold text-slate-400">Gross Earnings</span>
          <div className="text-2xl font-bold text-white mt-1">
            ₱{payroll.grossPay.toLocaleString()}
          </div>
          <span className="text-xs text-slate-500 mt-1 block">
            Basic pay ({payroll.daysWorked} days) + incentives
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <span className="text-xs uppercase font-semibold text-slate-400">Total Deductions</span>
          <div className="text-2xl font-bold text-rose-400 mt-1">
            -₱{payroll.totalDeductions.toLocaleString()}
          </div>
          <span className="text-xs text-slate-500 mt-1 block">
            Statutory contributions & employee deductions
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 bg-gradient-to-br from-slate-900 to-blue-950/30">
          <span className="text-xs uppercase font-bold text-blue-400">
            {isTentative ? 'Estimated Net Pay' : 'Total Net Pay'}
          </span>
          <div className="text-3xl font-black text-emerald-400 mt-1">
            ₱{payroll.netPay.toLocaleString()}
          </div>
          <span className="text-xs text-slate-400 mt-1 block">
            Take-home salary after deductions
          </span>
        </div>
      </div>

      {/* Breakdown Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Earnings Breakdown */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2">
            Earnings Breakdown
          </h2>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center py-1">
              <div>
                <span className="font-medium text-slate-200">Base Duty Pay</span>
                <span className="text-xs text-slate-500 block">
                  {payroll.daysWorked} days × ₱{payroll.dailyRate.toLocaleString()}
                </span>
              </div>
              <span className="font-mono font-semibold text-white">
                ₱{payroll.baseDutyPay.toLocaleString()}
              </span>
            </div>

            {payroll.holidayOvertimePay ? (
              <div className="flex justify-between items-center py-1 text-cyan-400">
                <div>
                  <span className="font-medium">Overtime Pay</span>
                  <span className="text-xs text-cyan-500/80 block">Holiday overtime</span>
                </div>
                <span className="font-mono font-semibold">+₱{payroll.holidayOvertimePay.toLocaleString()}</span>
              </div>
            ) : null}

            {payroll.nightDifferentialPay ? (
              <div className="flex justify-between items-center py-1 text-cyan-400">
                <div>
                  <span className="font-medium">Night Differential</span>
                  <span className="text-xs text-cyan-500/80 block">{(payroll.nightDifferentialHours || 0).toFixed(2)} night hours</span>
                </div>
                <span className="font-mono font-semibold">+₱{payroll.nightDifferentialPay.toLocaleString()}</span>
              </div>
            ) : null}

            {payroll.breakdown.incentives.length > 0 ? (
              payroll.breakdown.incentives.map((inc, i) => (
                <div key={i} className="flex justify-between items-center py-1 text-emerald-400">
                  <div>
                    <span className="font-medium">{inc.name}</span>
                    <span className="text-xs text-emerald-500 block">Qualified Attendance Bonus</span>
                  </div>
                  <span className="font-mono font-semibold">+₱{inc.amount.toLocaleString()}</span>
                </div>
              ))
            ) : (
              <div className="text-xs text-slate-500 italic py-1">
                No active incentive programs qualified this cut-off.
              </div>
            )}
          </div>
        </div>

        {/* Deductions Breakdown */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2">
            Deductions Breakdown
          </h2>

          <div className="space-y-3 text-sm">
            {payroll.lateMinutesTotal > 0 && (
              <div className="flex justify-between items-center py-1 text-amber-400">
                <div>
                  <span className="font-medium">Late Deduction</span>
                  <span className="text-xs text-amber-500/80 block">
                    {payroll.lateMinutesTotal} late minutes
                  </span>
                </div>
                <span className="font-mono font-semibold">-₱{payroll.lateDeduction.toLocaleString()}</span>
              </div>
            )}

            {payroll.breakdown.deductions.length > 0 ? (
              payroll.breakdown.deductions.map((ded, i) => (
                <div key={i} className="flex justify-between items-center py-1 text-rose-400">
                  <div>
                    <span className="font-medium">{ded.name}</span>
                    <span className="text-xs text-rose-400/70 capitalize block">
                      {ded.type === 'recurring' ? 'Statutory / Company Policy' : 'Employee Specific'}
                    </span>
                  </div>
                  <span className="font-mono font-semibold">-₱{ded.amount.toLocaleString()}</span>
                </div>
              ))
            ) : (
              <div className="text-xs text-slate-500 italic py-1">
                No deductions recorded for this cut-off.
              </div>
            )}
          </div>
        </div>
      </div>

      {payslipOpen && (
        <PayslipModal record={payroll} onClose={() => setPayslipOpen(false)} />
      )}
    </div>
  );
};
