import React from 'react';
import { X, Printer, ShieldCheck } from 'lucide-react';
import { PayrollRecord, PayrollPeriod } from '../types';

interface PayslipModalProps {
  record: PayrollRecord;
  period?: PayrollPeriod;
  onClose: () => void;
}

export const PayslipModal: React.FC<PayslipModalProps> = ({ record, period, onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
      <div className="w-[calc(100vw-1rem)] sm:w-full max-w-xl max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-2 sm:my-8">
        {/* Controls - Hidden when printing */}
        <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 p-3 sm:p-4 border-b border-slate-800 print:hidden bg-slate-900/90">
          <div className="flex min-w-0 items-center gap-2">
            <span className="font-semibold text-white text-sm truncate">Official Payslip Voucher</span>
            <span className="shrink-0 text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {record.status.toUpperCase()}
            </span>
          </div>
          <div className="shrink-0 flex items-center gap-2 ml-auto">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition shadow-md shadow-blue-600/25"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden xs:inline">Print / Save PDF</span>
              <span className="xs:hidden">Print</span>
            </button>
            <button
              onClick={onClose}
              aria-label="Close payslip"
              className="shrink-0 p-1.5 text-slate-400 hover:text-white transition rounded-lg hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Payslip Body */}
        <div className="min-w-0 overflow-y-auto overscroll-contain p-4 sm:p-6 md:p-8 bg-slate-900 text-slate-100 print:overflow-visible print:bg-white print:text-black print:p-0">
          {/* Company Header */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-slate-800 print:border-gray-300 pb-5 mb-5">
            <div className="min-w-0">
              <div className="text-xs uppercase font-bold tracking-wider text-blue-400 print:text-blue-800">
                CV Group of Companies
              </div>
              <h2 className="text-xl font-bold text-white print:text-gray-900 mt-0.5 break-words">
                {record.businessName}
              </h2>
              <p className="text-xs text-slate-400 print:text-gray-600 mt-0.5">
                Employee Compensation & Payroll Statement
              </p>
            </div>
            <div className="text-left sm:text-right shrink-0">
              <div className="text-xs text-slate-400 print:text-gray-500">Cut-Off Period</div>
              <div className="font-semibold text-white print:text-gray-800 text-sm break-words">
                {period?.name || record.payrollPeriodId}
              </div>
              <div className="text-[11px] text-slate-400 print:text-gray-500 mt-0.5 break-words">
                Payout: {period?.payoutDate || 'Scheduled'}
              </div>
            </div>
          </div>

          {/* Employee Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-950/60 print:bg-gray-50 border border-slate-800/80 print:border-gray-200 mb-6 text-xs">
            <div className="min-w-0">
              <span className="text-slate-400 print:text-gray-500 block">Employee Name:</span>
              <span className="font-bold text-white print:text-gray-900 text-sm break-words">{record.employeeName}</span>
              <span className="text-slate-400 print:text-gray-600 block mt-0.5 break-words">{record.position}</span>
            </div>
            <div className="min-w-0 text-left sm:text-right">
              <span className="text-slate-400 print:text-gray-500 block">Employee ID:</span>
              <span className="font-mono font-semibold text-blue-400 print:text-blue-700 break-all">
                {record.employeeId}
              </span>
              <span className="text-slate-400 print:text-gray-600 block mt-0.5">
                Rate: ₱{record.dailyRate.toLocaleString()} / day
              </span>
            </div>
          </div>

          {/* Earnings & Deductions Breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
            {/* Earnings */}
            <div className="min-w-0 space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 print:text-gray-700 pb-1.5 border-b border-slate-800 print:border-gray-300">
                Earnings
              </div>
              <div className="space-y-2 text-xs">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-start">
                  <span className="min-w-0 break-words text-slate-300 print:text-gray-700">
                    Base Duty Pay ({record.daysWorked} days × ₱{record.dailyRate.toLocaleString()})
                  </span>
                  <span className="whitespace-nowrap font-mono font-medium text-white print:text-gray-900">
                    ₱{record.baseDutyPay.toLocaleString()}
                  </span>
                </div>

                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-start text-cyan-400 print:text-cyan-700">
                  <span className="min-w-0 break-words">Regular Overtime ({(record.overtimeHours||0).toFixed(2)} hrs)</span>
                  <span className="whitespace-nowrap font-mono font-medium">+₱{(record.regularOvertimePay||0).toLocaleString()}</span>
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-start text-cyan-400 print:text-cyan-700">
                  <span className="min-w-0 break-words">Night Differential ({(record.nightDifferentialHours||0).toFixed(1)} hrs)</span>
                  <span className="whitespace-nowrap font-mono font-medium">+₱{(record.nightDifferentialPay||0).toLocaleString()}</span>
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-start text-cyan-400 print:text-cyan-700">
                  <span className="min-w-0 break-words">Holiday Overtime</span>
                  <span className="whitespace-nowrap font-mono font-medium">+₱{(record.holidayOvertimePay||0).toLocaleString()}</span>
                </div>
                {record.breakdown.incentives.map((inc, i) => (
                  <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-start text-emerald-400 print:text-emerald-700">
                    <span className="min-w-0 break-words">{inc.name}{inc.qualified === false ? ' (Not Qualified)' : ''}</span>
                    <span className="whitespace-nowrap font-mono font-medium">+₱{inc.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-slate-800/60 print:border-gray-200 grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-start font-semibold text-xs text-white print:text-gray-900">
                <span>Gross Earnings:</span>
                <span className="whitespace-nowrap font-mono">₱{record.grossPay.toLocaleString()}</span>
              </div>
            </div>

            {/* Deductions */}
            <div className="min-w-0 space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 print:text-gray-700 pb-1.5 border-b border-slate-800 print:border-gray-300">
                Deductions
              </div>
              <div className="space-y-2 text-xs">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-start text-amber-400 print:text-amber-700">
                  <span className="min-w-0 break-words">Late Deduction ({record.lateMinutesTotal||0} mins)</span>
                  <span className="whitespace-nowrap font-mono">-₱{(record.lateDeduction||0).toLocaleString()}</span>
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-start text-amber-400 print:text-amber-700">
                  <span className="min-w-0 break-words">Overbreak Deduction ({record.overbreakMinutesTotal||0} mins)</span>
                  <span className="whitespace-nowrap font-mono">-₱{(record.overbreakDeduction||0).toLocaleString()}</span>
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-start text-amber-400 print:text-amber-700">
                  <span className="min-w-0 break-words">Undertime Deduction ({record.undertimeMinutesTotal||0} mins)</span>
                  <span className="whitespace-nowrap font-mono">-₱{(record.undertimeDeduction||0).toLocaleString()}</span>
                </div>

                {record.breakdown.deductions.length === 0 ? (
                  <div className="text-slate-500 italic">No deductions applied</div>
                ) : (
                  record.breakdown.deductions.map((ded, i) => (
                    <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-start text-rose-400 print:text-rose-700">
                      <span className="min-w-0 break-words">{ded.name}</span>
                      <span className="whitespace-nowrap font-mono font-medium">-₱{ded.amount.toLocaleString()}</span>
                    </div>
                  ))
                )}
              </div>

              <div className="pt-2 border-t border-slate-800/60 print:border-gray-200 grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-start font-semibold text-xs text-rose-400 print:text-rose-700">
                <span>Total Deductions:</span>
                <span className="whitespace-nowrap font-mono">-₱{record.totalDeductions.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* NET PAY BOX */}
          <div className="p-4 rounded-xl bg-blue-950/40 print:bg-blue-50 border border-blue-900/60 print:border-blue-200 flex flex-wrap items-center justify-between gap-3 mb-6">
            <div className="min-w-0">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-400 print:text-blue-800">
                Net Take-Home Pay
              </span>
              <p className="text-[11px] text-slate-400 print:text-gray-600 mt-0.5">
                Computed from actual duty attendance and approved incentives
              </p>
            </div>
            <div className={`shrink-0 text-2xl font-black font-mono ${record.netPay < 0 ? 'text-rose-400 print:text-rose-800' : 'text-emerald-400 print:text-emerald-800'}`}>
              {record.netPay < 0 ? '-₱' : '₱'}{Math.abs(record.netPay).toLocaleString()}
            </div>
          </div>

          {/* Verification & Approval Footer */}
          <div className="pt-4 border-t border-slate-800 print:border-gray-300 text-[11px] text-slate-400 print:text-gray-600 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="min-w-0 flex items-start gap-1.5">
              <ShieldCheck className="shrink-0 w-4 h-4 text-emerald-400 print:text-emerald-700" />
              <span className="min-w-0 break-words">
                Employee Approval:{' '}
                {record.employeeApprovedAt ? (
                  <strong className="text-emerald-400 print:text-emerald-800">
                    Confirmed on {new Date(record.employeeApprovedAt).toLocaleDateString()}
                  </strong>
                ) : (
                  <span className="italic text-amber-400 print:text-amber-700">Pending Employee Review</span>
                )}
              </span>
            </div>
            <div className="break-words">Generated by CV Log Payroll System</div>
          </div>
        </div>
      </div>
    </div>
  );
};
