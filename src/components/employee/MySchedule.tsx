import React, { useEffect, useState } from 'react';
import { Calendar, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Schedule } from '../../types';
import { api } from '../../services/api';

export const MySchedule: React.FC = () => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.employee
      .getSchedules()
      .then((data) => setSchedules(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">My Working Schedule</h1>
        <p className="text-sm text-slate-400 mt-1">
          Assigned duty hours and rest days determined by Super Admin for the active cut-off.
        </p>
      </div>

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
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    Loading your schedule…
                  </td>
                </tr>
              ) : schedules.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No schedules published yet for this period.
                  </td>
                </tr>
              ) : (
                schedules.map((s) => {
                  const dayName = new Date(`${s.date}T12:00:00`).toLocaleDateString('en-US', {
                    weekday: 'short',
                  });
                  return (
                    <tr key={s.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-mono font-medium text-white">{s.date}</td>
                      <td className="py-3 px-4 text-xs font-semibold text-slate-400">{dayName}</td>
                      <td className="py-3 px-4">
                        {s.isWorkingDay ? (
                          <span className="font-semibold text-white">
                            {s.requiredTimeIn} – {s.requiredTimeOut}
                          </span>
                        ) : (
                          <span className="text-slate-500 italic">Scheduled Rest Day</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-400">
                        {s.isWorkingDay && s.breakOut && s.breakIn
                          ? `${s.breakOut} – ${s.breakIn}`
                          : '—'}
                      </td>
                      <td className="py-3 px-4">
                        {s.isWorkingDay ? (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Scheduled Duty
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                            OFF
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-400">{s.notes || '—'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
