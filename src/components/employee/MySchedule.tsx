import React, { useEffect, useState } from 'react';
import { Calendar, CalendarDays } from 'lucide-react';
import { Schedule, PayrollPeriod } from '../../types';
import { api } from '../../services/api';

export const MySchedule: React.FC = () => {
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSchedules = async (periodId: string) => {
    if (!periodId) {
      setSchedules([]);
      return;
    }
    setLoading(true);
    try {
      const data = await api.employee.getSchedules(periodId);
      setSchedules(data);
    } catch (err) {
      console.error(err);
      setSchedules([]);
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
        setSchedules([]);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (selectedPeriodId) loadSchedules(selectedPeriodId);
    else setSchedules([]);
  }, [selectedPeriodId]);

  const selectedPeriod = periods.find((p) => p.id === selectedPeriodId);

  const formatDate = (date: string) => {
    const d = new Date(`${date}T12:00:00`);
    return Number.isNaN(d.getTime())
      ? date
      : d.toLocaleDateString('en-PH', { month: 'short', day: '2-digit', year: 'numeric', timeZone: 'Asia/Manila' });
  };

  const formatDay = (date: string) => {
    const d = new Date(`${date}T12:00:00`);
    return Number.isNaN(d.getTime())
      ? '—'
      : d.toLocaleDateString('en-PH', { weekday: 'long', timeZone: 'Asia/Manila' });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">My Working Schedule</h1>
          <p className="text-sm text-slate-400 mt-1">
            View your assigned duty hours and rest days by payroll cut-off.
          </p>
        </div>
        <div className="w-full lg:w-auto">
          <label className="block text-xs font-medium text-slate-400 mb-1">Payroll Cut-Off Period</label>
          <div className="relative">
            <CalendarDays className="w-4 h-4 text-purple-400 absolute left-3 top-2.5 pointer-events-none" />
            <select
              value={selectedPeriodId}
              onChange={(e) => setSelectedPeriodId(e.target.value)}
              className="w-full lg:w-[360px] appearance-none bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
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

      {selectedPeriod && (
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300">
          <Calendar className="w-4 h-4 text-purple-400" />
          <span>{selectedPeriod.name}</span>
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs font-semibold uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Day</th>
                <th className="py-3 px-4">Assigned Shift Schedule</th>
                <th className="py-3 px-4">Break Window</th>
                <th className="py-3 px-4">Duty Status</th>
                <th className="py-3 px-4">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {loading ? (
                <tr><td colSpan={6} className="py-8 text-center text-slate-500">Loading your schedule…</td></tr>
              ) : schedules.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-slate-500">No schedules published for this cut-off period.</td></tr>
              ) : (
                schedules.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-medium text-white">{formatDate(s.date)}</td>
                    <td className="py-3 px-4 text-xs font-semibold text-slate-400">{formatDay(s.date)}</td>
                    <td className="py-3 px-4">
                      {s.isWorkingDay ? <span className="font-semibold text-white">{s.requiredTimeIn} – {s.requiredTimeOut}</span> : <span className="text-slate-500 italic">Scheduled Rest Day</span>}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-400">{s.isWorkingDay && s.breakOut && s.breakIn ? `${s.breakOut} – ${s.breakIn}` : '—'}</td>
                    <td className="py-3 px-4">
                      {s.isWorkingDay ? (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Scheduled Duty</span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">OFF</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-400">{s.notes || '—'}</td>
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
