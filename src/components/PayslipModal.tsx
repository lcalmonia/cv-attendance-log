import React from 'react';
import { X, Printer, ShieldCheck, Building2, Calendar, UserRound } from 'lucide-react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Controls - Hidden when printing */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 print:hidden bg-slate-900/90">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white text-sm">Official Payslip Voucher</span>
            <span className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
              {record.status.toUpperCase()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition shadow-md shadow-blue-600/25"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white transition rounded-lg hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Payslip Body */}
        <div className="p-6 sm:p-8 bg-slate-900 text-slate-100 print:bg-white print:text-black print:p-0">
          {/* Company Header */}
          <div className="flex items-start justify-between border-b border-slate-800 print:border-gray-300 pb-5 mb-5">
            <div>
              <div className="text-xs uppercase font-bold tracking-wider text-blue-400 print:text-blue-800">
                CV Group of Companies
              </div>
              <h2 className="text-xl font-bold text-white print:text-gray-900 mt-0.5">
                {record.businessName}
              </h2>
              <p className="text-xs text-slate-400 print:text-gray-600 mt-0.5">
                Employee Compensation & Payroll Statement
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-400 print:text-gray-500">Cut-Off Period</div>
              <div className="font-semibold text-white print:text-gray-800 text-sm">
                {period?.name || record.payrollPeriodId}
              </div>
              <div className="text-[11px] text-slate-400 print:text-gray-500 mt-0.5">
                Payout: {period?.payoutDate || 'Scheduled'}
              </div>
            </div>
          </div>

          {/* Employee Info Grid */}
          <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-950/60 print:bg-gray-50 border border-slate-800/80 print:border-gray-200 mb-6 text-xs">
            <div>
              <span className="text-slate-400 print:text-gray-500 block">Employee Name:</span>
              <span className="font-bold text-white print:text-gray-900 text-sm">{record.employeeName}</span>
              <span className="text-slate-400 print:text-gray-600 block mt-0.5">{record.position}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-400 print:text-gray-500 block">Employee ID:</span>
              <span className="font-mono font-semibold text-blue-400 print:text-blue-700">
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
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 print:text-gray-700 pb-1.5 border-b border-slate-800 print:border-gray-300">
                Earnings
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-300 print:text-gray-700">
                    Basic Pay ({record.daysWorked} days)
                  </span>
                  <span className="font-mono font-medium text-white print:text-gray-900">
                    ₱{record.basicPay.toLocaleString()}
                  </span>
                </div>

                {record.nightDifferentialPay ? <div className="flex justify-between text-cyan-400 print:text-cyan-700"><span>Night Differential ({(record.nightDifferentialHours||0).toFixed(1)} hrs)</span><span className="font-mono font-medium">+₱{record.nightDifferentialPay.toLocaleString()}</span></div> : null}
                {record.holidayOvertimePay ? <div className="flex justify-between text-cyan-400 print:text-cyan-700"><span>Holiday Overtime</span><span className="font-mono font-medium">+₱{record.holidayOvertimePay.toLocaleString()}</span></div> : null}
                {record.breakdown.incentives.map((inc, i) => (
                  <div key={i} className="flex justify-between text-emerald-400 print:text-emerald-700">
                    <span>{inc.name}</span>
                    <span className="font-mono font-medium">+₱{inc.amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-slate-800/60 print:border-gray-200 flex justify-between font-semibold text-xs text-white print:text-gray-900">
                <span>Gross Earnings:</span>
                <span className="font-mono">₱{record.grossPay.toLocaleString()}</span>
              </div>
            </div>

            {/* Deductions */}
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 print:text-gray-700 pb-1.5 border-b border-slate-800 print:border-gray-300">
                Deductions
              </div>
              <div className="space-y-2 text-xs">
                {record.lateMinutesTotal > 0 && (
                  <div className="flex justify-between text-amber-400 print:text-amber-700">
                    <span>Lateness ({record.lateMinutesTotal} mins)</span>
                    <span className="font-mono">Calculated</span>
                  </div>
                )}

                {record.breakdown.deductions.length === 0 ? (
                  <div className="text-slate-500 italic">No deductions applied</div>
                ) : (
                  record.breakdown.deductions.map((ded, i) => (
                    <div key={i} className="flex justify-between text-rose-400 print:text-rose-700">
                      <span>{ded.name}</span>
                      <span className="font-mono font-medium">-₱{ded.amount.toLocaleString()}</span>
                    </div>
                  ))
                )}
              </div>

              <div className="pt-2 border-t border-slate-800/60 print:border-gray-200 flex justify-between font-semibold text-xs text-rose-400 print:text-rose-700">
                <span>Total Deductions:</span>
                <span className="font-mono">-₱{record.totalDeductions.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* NET PAY BOX */}
          <div className="p-4 rounded-xl bg-blue-950/40 print:bg-blue-50 border border-blue-900/60 print:border-blue-200 flex items-center justify-between mb-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-400 print:text-blue-800">
                Net Take-Home Pay
              </span>
              <p className="text-[11px] text-slate-400 print:text-gray-600 mt-0.5">
                Computed from actual duty attendance and approved incentives
              </p>
            </div>
            <div className="text-2xl font-black font-mono text-emerald-400 print:text-emerald-800">
              ₱{record.netPay.toLocaleString()}
            </div>
          </div>

          {/* Verification & Approval Footer */}
          <div className="pt-4 border-t border-slate-800 print:border-gray-300 text-[11px] text-slate-400 print:text-gray-600 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 print:text-emerald-700" />
              <span>
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
            <div>Generated by CV Log Payroll System</div>
          </div>
        </div>
      </div>
    </div>
  );
};
