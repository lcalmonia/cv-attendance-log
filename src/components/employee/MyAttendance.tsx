import React, { useEffect, useState } from 'react';
import { Clock, CheckCircle2, XCircle, AlertCircle, Calendar } from 'lucide-react';
import { AttendanceRecord, PayrollPeriod, AttendanceStatus } from '../../types';
import { api } from '../../services/api';

export const MyAttendance: React.FC = () => {
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [data, setData] = useState<{
    period: PayrollPeriod;
    attendance: (AttendanceRecord & { scheduledTime: string })[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAttendance = async (periodId: string) => {
    if (!periodId) {
      setData(null);
      return;
    }
    setLoading(true);
    try {
      const res = await api.employee.getAttendance(periodId);
      setData(res);
    } catch (err) {
      console.error(err);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const list = await api.employee.getPeriods();
        setPeriods(list);
        const active = list.find((p) => p.status === 'open' || p.status === 'for_approval') || list[0];
        setSelectedPeriodId(active?.id || '');
        if (!active) setData(null);
      } catch (err) {
        console.error(err);
        setData(null);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (selectedPeriodId) loadAttendance(selectedPeriodId);
    else setData(null);
  }, [selectedPeriodId]);

  const formatDate = (date: string) => {
    const d = new Date(`${date}T12:00:00`);
    return Number.isNaN(d.getTime())
      ? date
      : d.toLocaleDateString('en-PH', { month: 'short', day: '2-digit', year: 'numeric', timeZone: 'Asia/Manila' });
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return '—';
    try {
      return new Date(isoString).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: true });
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
      case 'invalid':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
            <AlertCircle className="w-3 h-3" /> Invalid
          </span>
        );
      case 'incomplete':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400">
            <AlertCircle className="w-3 h-3" /> Incomplete
          </span>
        );
    }
  };

  const attendance = data?.attendance || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">My Attendance Log</h1>
          <p className="text-sm text-slate-400 mt-1">
            Personal attendance record for the selected cut-off period.
          </p>
        </div>
        <div className="w-full sm:w-auto">
          <label className="block text-xs font-medium text-slate-400 mb-1">Payroll Cut-Off Period</label>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-purple-400 shrink-0" />
            <select
              value={selectedPeriodId}
              onChange={(e) => setSelectedPeriodId(e.target.value)}
              className="w-full sm:w-[360px] bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              {periods.length === 0 ? <option value="">No payroll cut-offs available</option> : null}
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.startDate} to {p.endDate})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs font-semibold uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Scheduled Time</th>
                <th className="py-3 px-4">Time In</th>
                <th className="py-3 px-4">Break Window</th>
                <th className="py-3 px-4">Time Out</th>
                <th className="py-3 px-4">Late/Undertime/Overbreak</th>
                <th className="py-3 px-4">Overtime</th>
                <th className="py-3 px-4">OT Approval</th>
                <th className="py-3 px-4">Total Hours</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-500">
                    Loading your attendance history…
                  </td>
                </tr>
              ) : attendance.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    No clock-in records logged yet for this cut-off period.
                  </td>
                </tr>
              ) : (
                attendance.map((att) => (
                  <tr key={att.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-medium text-white">{formatDate(att.date)}</td>
                    <td className="py-3 px-4 text-xs font-semibold text-slate-300">
                      {att.scheduledTime}
                    </td>
                    <td className="py-3 px-4 text-xs font-mono font-medium text-white">
                      {formatTime(att.timeIn)}
                    </td>
                    <td className="py-3 px-4 text-xs font-mono text-slate-400">
                      {att.breakOut ? `${formatTime(att.breakOut)} – ${formatTime(att.breakIn)}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-xs font-mono font-medium text-white">
                      {formatTime(att.timeOut)}
                    </td>
                    <td className="py-3 px-4 text-xs" title={'Late: '+(att.lateMinutes||0)+' min • Undertime: '+(att.undertimeMinutes||0)+' min • Overbreak: '+(att.overbreakMinutes||0)+' min'}>
                      {(att.varianceMinutes || 0) > 0 ? (
                        <span className="font-semibold text-amber-400">+{att.varianceMinutes} mins</span>
                      ) : (
                        <span className="text-slate-500">0 min</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold text-cyan-400">
                      {(att.overtimeMinutes || 0) > 0 ? `${att.overtimeMinutes} min` : '—'}
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold">
                      {(att.overtimeMinutes || 0) <= 0
                        ? <span className="text-slate-500">Not required</span>
                        : att.overtimeApprovalStatus === 'approved'
                          ? <span className="text-emerald-400">Approved</span>
                          : att.overtimeApprovalStatus === 'rejected'
                            ? <span className="text-red-400">Rejected</span>
                            : <span className="text-amber-400">Pending Super Admin</span>}
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold text-slate-200">
                      {att.totalWorkMinutes > 0
                        ? `${Number(att.totalWorkMinutes / 60).toFixed(2).replace(/0+$/, '').replace(/\.$/, '')} hrs`
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
