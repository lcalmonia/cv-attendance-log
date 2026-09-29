import React, { useEffect, useState } from 'react';
import {
  DollarSign,
  Calendar,
  Building2,
  CheckCircle2,
  Clock,
  Printer,
  ChevronDown,
  ArrowRight,
  ShieldCheck,
  FileText,
} from 'lucide-react';
import { PayrollPeriod, PayrollRecord, PayrollStatus } from '../../types';
import { api } from '../../services/api';
import { PayslipModal } from '../PayslipModal';

export const PayrollManagement: React.FC = () => {
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [payrollData, setPayrollData] = useState<{
    period: PayrollPeriod;
    records: PayrollRecord[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBusinessFilter, setSelectedBusinessFilter] = useState('all');

  // Selected record for payslip modal
  const [activePayslip, setActivePayslip] = useState<PayrollRecord | null>(null);

  const loadPeriods = async () => {
    try {
      const list = await api.admin.getPeriods();
      setPeriods(list);
      if (list.length > 0 && !selectedPeriodId) {
        const defaultP = list.find((p) => p.status === 'for_approval' || p.status === 'open') || list[0];
        setSelectedPeriodId(defaultP.id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadPayroll = async (periodId: string) => {
    if (!periodId) return;
    setLoading(true);
    try {
      const data = await api.admin.getPayroll(periodId);
      setPayrollData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPeriods();
  }, []);

  useEffect(() => {
    if (selectedPeriodId) {
      loadPayroll(selectedPeriodId);
    }
  }, [selectedPeriodId]);

  const handleUpdateStatus = async (newStatus: PayrollStatus) => {
    if (!selectedPeriodId) return;
    try {
      await api.admin.updatePayrollStatus(selectedPeriodId, newStatus);
      loadPayroll(selectedPeriodId);
      loadPeriods();
    } catch (err: any) {
      alert(err.message || 'Failed to update payroll status');
    }
  };

  // Group records by business
  const records = payrollData?.records || [];
  const businesses = Array.from(new Set(records.map((r) => r.businessName)));

  const filteredRecords =
    selectedBusinessFilter === 'all'
      ? records
      : records.filter((r) => r.businessName === selectedBusinessFilter);

  // Totals
  const totalGross = filteredRecords.reduce((sum, r) => sum + r.grossPay, 0);
  const totalDeductions = filteredRecords.reduce((sum, r) => sum + r.totalDeductions, 0);
  const totalNet = filteredRecords.reduce((sum, r) => sum + r.netPay, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Payroll Processing</h1>
          <p className="text-sm text-slate-400 mt-1">
            Calculate earnings, qualify incentives, deduct contributions, and submit for employee approval.
          </p>
        </div>

        {/* Status Workflow Actions */}
        {payrollData && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 mr-1 hidden sm:inline">Set Status:</span>
            {payrollData.period.status === 'open' && (
              <button
                onClick={() => handleUpdateStatus('for_approval')}
                className="px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs transition shadow-lg shadow-amber-600/20"
              >
                Submit for Employee Approval
              </button>
            )}

            {payrollData.period.status === 'for_approval' && (
              <button
                onClick={() => handleUpdateStatus('finalized')}
                className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs transition shadow-lg shadow-emerald-600/20"
              >
                Finalize & Authorize Payout
              </button>
            )}

            {payrollData.period.status === 'finalized' && (
              <span className="px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 text-xs font-semibold">
                Cut-Off Finalized
              </span>
            )}
          </div>
        )}
      </div>

      {/* Period & Filter Selection */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
        <div className="flex-1">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Payroll Cut-Off Period
          </label>
          <select
            value={selectedPeriodId}
            onChange={(e) => setSelectedPeriodId(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-medium"
          >
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.startDate} to {p.endDate}) — Status: [{p.status.toUpperCase()}]
              </option>
            ))}
          </select>
        </div>

        <div className="w-full sm:w-64">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Filter Business
          </label>
          <select
            value={selectedBusinessFilter}
            onChange={(e) => setSelectedBusinessFilter(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Businesses</option>
            {businesses.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 uppercase font-semibold">Total Gross Pay</span>
          <div className="text-2xl font-bold text-white mt-1">₱{totalGross.toLocaleString()}</div>
          <span className="text-[11px] text-slate-500">Includes basic + qualified incentives</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 uppercase font-semibold">Total Deductions</span>
          <div className="text-2xl font-bold text-rose-400 mt-1">₱{totalDeductions.toLocaleString()}</div>
          <span className="text-[11px] text-slate-500">SSS, PhilHealth, Pag-IBIG & Cash Adv</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 uppercase font-semibold">Total Net Payout</span>
          <div className="text-2xl font-bold text-emerald-400 mt-1">₱{totalNet.toLocaleString()}</div>
          <span className="text-[11px] text-slate-500">Total payable to personnel</span>
        </div>
      </div>

      {/* Payroll Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs font-semibold uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Business</th>
                <th className="py-3 px-4">Days / Rate</th>
                <th className="py-3 px-4">Basic Pay</th>
                <th className="py-3 px-4">Incentives</th>
                <th className="py-3 px-4">Deductions</th>
                <th className="py-3 px-4">Net Salary</th>
                <th className="py-3 px-4">Employee Approval</th>
                <th className="py-3 px-4 text-right">Payslip</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    Computing payroll ledger…
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    No employee records found for this period.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{r.employeeName}</div>
                      <div className="text-xs text-slate-400">{r.position}</div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-300">{r.businessName}</td>
                    <td className="py-3 px-4 text-xs">
                      <div>
                        <span className="font-semibold text-white">{r.daysWorked}</span>
                        <span className="text-slate-500">/{r.scheduledDutyDays} days</span>
                      </div>
                      <span className="text-[11px] text-slate-400">₱{r.dailyRate}/day</span>
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-slate-200">
                      ₱{r.basicPay.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-mono text-emerald-400">
                      ₱{r.incentivePay.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-mono text-rose-400">
                      -₱{r.totalDeductions.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-white">
                      ₱{r.netPay.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      {r.employeeApprovedAt ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approved</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-400 font-medium">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Pending</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setActivePayslip(r)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-white transition text-xs font-medium"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Payslip</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payslip Modal */}
      {activePayslip && (
        <PayslipModal
          record={activePayslip}
          period={payrollData?.period}
          onClose={() => setActivePayslip(null)}
        />
      )}
    </div>
  );
};
