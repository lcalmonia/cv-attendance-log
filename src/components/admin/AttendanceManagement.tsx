import React, { useEffect, useState } from 'react';
import { Clock, Calendar, Building2, Search, Filter, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { AttendanceRecord, Business, PayrollPeriod, AttendanceStatus } from '../../types';
import { api } from '../../services/api';

export const AttendanceManagement: React.FC = () => {
  const [records, setRecords] = useState<
    (AttendanceRecord & { employeeName: string; employeeIdCode: string; businessName: string })[]
  >([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedPeriodId, setSelectedPeriodId] = useState('all');
  const [selectedBusinessId, setSelectedBusinessId] = useState('all');
  const [selectedDate, setSelectedDate] = useState('');
  const [search, setSearch] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [bizList, pList] = await Promise.all([
        api.admin.getBusinesses(),
        api.admin.getPeriods(),
      ]);
      setBusinesses(bizList);
      setPeriods(pList);

      const attList = await api.admin.getAttendance({
        periodId: selectedPeriodId !== 'all' ? selectedPeriodId : undefined,
        businessId: selectedBusinessId !== 'all' ? selectedBusinessId : undefined,
        date: selectedDate || undefined,
      });
      setRecords(attList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedPeriodId, selectedBusinessId, selectedDate]);

  const formatTime = (isoString?: string) => {
    if (!isoString) return '—';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return isoString;
    }
  };

  const getStatusBadge = (status: AttendanceStatus) => {
    switch (status) {
      case 'present':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" /> Present
          </span>
        );
      case 'late':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3" /> Late
          </span>
        );
      case 'absent':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
            <XCircle className="w-3 h-3" /> Absent
          </span>
        );
      case 'incomplete':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300">
            <AlertCircle className="w-3 h-3 text-slate-400" /> Incomplete
          </span>
        );
    }
  };

  const filtered = records.filter(
    (r) =>
      r.employeeName.toLowerCase().includes(search.toLowerCase()) ||
      r.employeeIdCode.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Attendance Logs</h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time and historic clock logs, break durations, and automated lateness calculations.
          </p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Search */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Search Employee</label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Name or ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Business Filter */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Business</label>
          <select
            value={selectedBusinessId}
            onChange={(e) => setSelectedBusinessId(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Businesses</option>
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {/* Period Filter */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Cut-Off Period</label>
          <select
            value={selectedPeriodId}
            onChange={(e) => setSelectedPeriodId(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Dates</option>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Specific Date */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Specific Date</label>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
            />
            {selectedDate && (
              <button
                onClick={() => setSelectedDate('')}
                className="px-2 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg text-xs"
                title="Clear date"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs font-semibold uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Business</th>
                <th className="py-3 px-4">Time In</th>
                <th className="py-3 px-4">Break Window</th>
                <th className="py-3 px-4">Time Out</th>
                <th className="py-3 px-4">Lateness</th>
                <th className="py-3 px-4">Total Hours</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    Loading attendance entries…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    No attendance logs found matching filters.
                  </td>
                </tr>
              ) : (
                filtered.map((att) => (
                  <tr key={att.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-mono font-medium text-white">{att.date}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{att.employeeName}</div>
                      <div className="text-xs font-mono text-slate-400">{att.employeeIdCode}</div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-300">{att.businessName}</td>
                    <td className="py-3 px-4 text-xs font-mono">
                      <span className={att.timeIn ? 'text-white font-medium' : 'text-slate-500'}>
                        {formatTime(att.timeIn)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs font-mono text-slate-400">
                      {att.breakOut ? `${formatTime(att.breakOut)} – ${formatTime(att.breakIn)}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-xs font-mono">
                      <span className={att.timeOut ? 'text-white font-medium' : 'text-slate-500'}>
                        {formatTime(att.timeOut)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      {att.lateMinutes > 0 ? (
                        <span className="font-semibold text-amber-400">+{att.lateMinutes} mins</span>
                      ) : (
                        <span className="text-slate-500">0 min</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold text-slate-200">
                      {att.totalWorkMinutes > 0
                        ? `${(att.totalWorkMinutes / 60).toFixed(1)} hrs`
                        : '—'}
                    </td>
                    <td className="py-3 px-4">{getStatusBadge(att.status)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
