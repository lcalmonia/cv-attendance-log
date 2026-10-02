import React, { useEffect, useState } from 'react';
import { CalendarDays, Plus, Edit2, Trash2, CheckCircle2, XCircle, Search, Filter, X } from 'lucide-react';
import { Schedule, PayrollPeriod, Employee } from '../../types';
import { api } from '../../services/api';

export const ScheduleManagement: React.FC = () => {
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [employees, setEmployees] = useState<(Employee & { businessName: string })[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [schedules, setSchedules] = useState<(Schedule & { employeeName: string })[]>([]);
  const [loading, setLoading] = useState(true);

  // Schedule Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }),
    requiredTimeIn: '08:00',
    requiredTimeOut: '17:00',
    breakOut: '12:00',
    breakIn: '13:00',
    isWorkingDay: true,
    notes: 'Regular Duty Shift',
  });
  const [busy, setBusy] = useState(false);
  const [nextModalOpen, setNextModalOpen] = useState(false);
  const [nextCutoff, setNextCutoff] = useState({ name: '', startDate: '', endDate: '', payoutDate: '' });

  // Period Modal
  const [periodModalOpen, setPeriodModalOpen] = useState(false);
  const [periodFormData, setPeriodFormData] = useState({
    name: '',
    startDate: '',
    endDate: '',
    payoutDate: '',
    status: 'open' as any,
  });

  const loadInitData = async () => {
    setLoading(true);
    try {
      const [pList, empList] = await Promise.all([
        api.admin.getPeriods(),
        api.admin.getEmployees(),
      ]);
      setPeriods(pList);
      setEmployees(empList);

      const activePeriod = pList.find((p) => p.status === 'open' || p.status === 'for_approval') || pList[0];
      if (activePeriod) {
        setSelectedPeriodId(activePeriod.id);
      }
      if (empList.length > 0) {
        setSelectedEmployeeId(empList[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadSchedules = async () => {
    if (!selectedPeriodId) return;
    setLoading(true);
    try {
      const list = await api.admin.getSchedules(selectedPeriodId, selectedEmployeeId || undefined);
      setSchedules(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitData();
  }, []);

  useEffect(() => {
    loadSchedules();
  }, [selectedPeriodId, selectedEmployeeId]);

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPeriodId || !selectedEmployeeId || !formData.date) return;
    setBusy(true);

    try {
      await api.admin.saveSchedule({
        employeeId: selectedEmployeeId,
        payrollPeriodId: selectedPeriodId,
        date: formData.date,
        requiredTimeIn: formData.isWorkingDay ? formData.requiredTimeIn : undefined,
        requiredTimeOut: formData.isWorkingDay ? formData.requiredTimeOut : undefined,
        breakOut: formData.isWorkingDay ? formData.breakOut : undefined,
        breakIn: formData.isWorkingDay ? formData.breakIn : undefined,
        isWorkingDay: formData.isWorkingDay,
        notes: formData.notes,
      });
      setModalOpen(false);
      loadSchedules();
    } catch (err: any) {
      alert(err.message || 'Failed to save schedule');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleOff = async (sched: Schedule) => {
    try {
      await api.admin.saveSchedule({
        ...sched,
        isWorkingDay: !sched.isWorkingDay,
        notes: !sched.isWorkingDay ? 'Duty Scheduled' : 'Marked OFF',
      });
      loadSchedules();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    if (!confirm('Remove this scheduled shift?')) return;
    try {
      await api.admin.deleteSchedule(id);
      loadSchedules();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreatePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!periodFormData.startDate || !periodFormData.endDate) return;
    setBusy(true);
    try {
      const p = await api.admin.createPeriod(periodFormData);
      setPeriods([p, ...periods]);
      setSelectedPeriodId(p.id);
      setPeriodModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to create period');
    } finally {
      setBusy(false);
    }
  };


  const handleCreateNextCutoff = async (e: React.FormEvent) => {
    e.preventDefault(); if (!selectedPeriodId || !nextCutoff.startDate || !nextCutoff.endDate) return;
    setBusy(true); try {
      const res = await api.admin.createNextCutoffSchedule({ currentPeriodId: selectedPeriodId, ...nextCutoff });
      setPeriods([res.period, ...periods.filter(p => p.id !== res.period.id)]);
      setSelectedPeriodId(res.period.id); setNextModalOpen(false);
      alert(`Next cut-off created and ${res.copiedSchedules} schedule entries copied.`);
    } catch (err:any) { alert(err.message || 'Failed to create next cut-off schedule.'); }
    finally { setBusy(false); }
  };

  const currentPeriod = periods.find((p) => p.id === selectedPeriodId);
  const currentEmployee = employees.find((e) => e.id === selectedEmployeeId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Schedule Management</h1>
          <p className="text-sm text-slate-400 mt-1">
            Configure flexible date-by-date working hours for employees before each cut-off begins.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setPeriodFormData({
                name: '',
                startDate: new Date().toISOString().slice(0, 10),
                endDate: new Date(Date.now() + 14 * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }),
                payoutDate: new Date(Date.now() + 20 * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' }),
                status: 'open',
              });
              setPeriodModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
          >
            <CalendarDays className="w-4 h-4 text-purple-400" />
            <span>New Cut-Off Period</span>
          </button>

          <button
            onClick={() => {
              const base = currentPeriod ? new Date(currentPeriod.endDate + 'T00:00:00Z') : new Date();
              const start = new Date(base); start.setUTCDate(start.getUTCDate() + 1);
              const end = new Date(start); end.setUTCDate(end.getUTCDate() + (currentPeriod ? Math.max(0, Math.round((new Date(currentPeriod.endDate+'T00:00:00Z').getTime()-new Date(currentPeriod.startDate+'T00:00:00Z').getTime())/86400000)) : 14));
              const fmt=(d:Date)=>d.toISOString().slice(0,10);
              setNextCutoff({name:'',startDate:fmt(start),endDate:fmt(end),payoutDate:fmt(end)}); setNextModalOpen(true);
            }}
            disabled={!selectedPeriodId}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 text-xs font-medium border border-purple-500/30 transition disabled:opacity-50"
          >
            <CalendarDays className="w-4 h-4" /><span>Create Schedule for Next Cut-Off</span>
          </button>

          <button
            onClick={() => {
              setFormData({
                date: currentPeriod?.startDate || new Date().toISOString().slice(0, 10),
                requiredTimeIn: '08:00',
                requiredTimeOut: '17:00',
                breakOut: '12:00',
                breakIn: '13:00',
                isWorkingDay: true,
                notes: 'Regular Shift',
              });
              setModalOpen(true);
            }}
            disabled={!selectedEmployeeId || !selectedPeriodId}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs sm:text-sm transition shadow-lg shadow-blue-600/20 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>Add / Edit Date Schedule</span>
          </button>
        </div>
      </div>

      {/* Selectors Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
        {/* Period Selector */}
        <div className="flex-1">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Payroll Cut-Off Period
          </label>
          <select
            value={selectedPeriodId}
            onChange={(e) => setSelectedPeriodId(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.startDate} to {p.endDate}) — [{p.status.toUpperCase()}]
              </option>
            ))}
          </select>
        </div>

        {/* Employee Selector */}
        <div className="flex-1">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Select Employee
          </label>
          <select
            value={selectedEmployeeId}
            onChange={(e) => setSelectedEmployeeId(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.fullName} ({e.employeeId}) • {e.businessName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Current Selection Banner */}
      {currentEmployee && currentPeriod && (
        <div className="flex items-center justify-between p-3.5 bg-slate-900/60 border border-slate-800/80 rounded-lg text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">{currentEmployee.fullName}</span>
            <span className="text-slate-500">|</span>
            <span className="text-blue-400">{currentEmployee.position}</span>
            <span className="text-slate-500">|</span>
            <span className="text-emerald-400">₱{currentEmployee.dailyRate}/day</span>
          </div>
          <div className="text-slate-400">
            Cut-off range: <span className="text-slate-200 font-medium">{currentPeriod.startDate} to {currentPeriod.endDate}</span>
          </div>
        </div>
      )}

      {/* Schedules Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs font-semibold uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Day</th>
                <th className="py-3 px-4">Duty Status</th>
                <th className="py-3 px-4">Required Hours</th>
                <th className="py-3 px-4">Break Window</th>
                <th className="py-3 px-4">Notes</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Loading schedules…
                  </td>
                </tr>
              ) : schedules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No schedules created for this employee in this cut-off period. Click &quot;Add / Edit Date Schedule&quot; to configure.
                  </td>
                </tr>
              ) : (
                schedules.map((s) => {
                  const scheduleDate = new Date(`${s.date}T12:00:00`);
                  const dayName = Number.isNaN(scheduleDate.getTime())
                    ? '—'
                    : scheduleDate.toLocaleDateString('en-PH', { weekday: 'long', timeZone: 'Asia/Manila' });
                  const displayDate = Number.isNaN(scheduleDate.getTime())
                    ? s.date
                    : scheduleDate.toLocaleDateString('en-PH', { month: 'short', day: '2-digit', year: 'numeric', timeZone: 'Asia/Manila' });
                  return (
                    <tr key={s.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-medium text-white">{displayDate}</td>
                      <td className="py-3 px-4 text-xs font-semibold text-slate-400">{dayName}</td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleToggleOff(s)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer transition ${
                            s.isWorkingDay
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20'
                              : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
                          }`}
                          title="Click to toggle Duty / OFF"
                        >
                          {s.isWorkingDay ? 'Working Day' : 'OFF'}
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        {s.isWorkingDay ? (
                          <span className="font-semibold text-white">
                            {s.requiredTimeIn} – {s.requiredTimeOut}
                          </span>
                        ) : (
                          <span className="text-slate-500 italic">No duty required</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-400">
                        {s.isWorkingDay && s.breakOut && s.breakIn
                          ? `${s.breakOut} – ${s.breakIn}`
                          : '—'}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-400 max-w-xs truncate">
                        {s.notes || '—'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setFormData({
                                date: s.date,
                                requiredTimeIn: s.requiredTimeIn || '08:00',
                                requiredTimeOut: s.requiredTimeOut || '17:00',
                                breakOut: s.breakOut || '12:00',
                                breakIn: s.breakIn || '13:00',
                                isWorkingDay: s.isWorkingDay,
                                notes: s.notes || '',
                              });
                              setModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 transition"
                            title="Edit Hours"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteSchedule(s.id)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-red-400 transition"
                            title="Delete Schedule Entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Schedule Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <h3 className="font-semibold text-white">Configure Scheduled Date</h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSchedule} className="p-4 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Date *</label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                />
                <div className="mt-2 rounded-lg bg-blue-500/10 border border-blue-500/20 px-3 py-2 text-xs">
                  <span className="text-slate-400">Scheduled day: </span>
                  <span className="font-semibold text-blue-400">
                    {(() => {
                      const selectedDate = formData.date ? new Date(`${formData.date}T12:00:00`) : null;
                      return selectedDate && !Number.isNaN(selectedDate.getTime())
                        ? selectedDate.toLocaleDateString('en-PH', {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                            timeZone: 'Asia/Manila',
                          })
                        : '—';
                    })()}
                  </span>
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isWorkingDay}
                    onChange={(e) => setFormData({ ...formData, isWorkingDay: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-0 bg-slate-950 border-slate-700"
                  />
                  <span>Is Required Duty / Working Day</span>
                </label>
                <span className="text-[11px] text-slate-500 block mt-0.5">
                  Uncheck to mark as scheduled rest day / OFF (will not count as absence)
                </span>
              </div>

              {formData.isWorkingDay && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Required Time In *
                      </label>
                      <input
                        type="time"
                        required
                        value={formData.requiredTimeIn}
                        onChange={(e) => setFormData({ ...formData, requiredTimeIn: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Required Time Out *
                      </label>
                      <input
                        type="time"
                        required
                        value={formData.requiredTimeOut}
                        onChange={(e) => setFormData({ ...formData, requiredTimeOut: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Break Out (optional)
                      </label>
                      <input
                        type="time"
                        value={formData.breakOut}
                        onChange={(e) => setFormData({ ...formData, breakOut: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Break In (optional)
                      </label>
                      <input
                        type="time"
                        value={formData.breakIn}
                        onChange={(e) => setFormData({ ...formData, breakIn: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Notes</label>
                <input
                  type="text"
                  placeholder="e.g. Morning Shift, Store Opening"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 transition shadow-lg shadow-blue-600/25 disabled:opacity-60"
                >
                  {busy ? 'Saving…' : 'Save Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {nextModalOpen && <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs"><div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-5"><div className="flex justify-between items-center mb-4"><h3 className="font-semibold text-white">Create Schedule for Next Cut-Off</h3><button onClick={()=>setNextModalOpen(false)}><X className="w-5 h-5 text-slate-400"/></button></div><p className="text-xs text-slate-400 mb-4">The current cut-off's employee schedules will be copied forward to the new date range.</p><form onSubmit={handleCreateNextCutoff} className="space-y-3"><input placeholder="Cut-off name (optional)" value={nextCutoff.name} onChange={e=>setNextCutoff({...nextCutoff,name:e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"/><div className="grid grid-cols-2 gap-3"><input required type="date" value={nextCutoff.startDate} onChange={e=>setNextCutoff({...nextCutoff,startDate:e.target.value})} className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"/><input required type="date" value={nextCutoff.endDate} onChange={e=>setNextCutoff({...nextCutoff,endDate:e.target.value})} className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"/></div><div><label className="block text-xs text-slate-400 mb-1">Payout Date</label><input required type="date" value={nextCutoff.payoutDate} onChange={e=>setNextCutoff({...nextCutoff,payoutDate:e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"/></div><div className="flex justify-end gap-2 pt-3 border-t border-slate-800"><button type="button" onClick={()=>setNextModalOpen(false)} className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300">Cancel</button><button disabled={busy} className="px-4 py-2 rounded-lg bg-purple-600 text-white font-medium">{busy?'Creating…':'Create & Copy Schedules'}</button></div></form></div></div>}

      {/* New Period Modal */}
      {periodModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <h3 className="font-semibold text-white">Create Payroll Cut-Off Period</h3>
              <button
                onClick={() => setPeriodModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePeriod} className="p-4 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Period Name (e.g. October 1–15, 2026)
                </label>
                <input
                  type="text"
                  placeholder="October 1–15, 2026"
                  value={periodFormData.name}
                  onChange={(e) => setPeriodFormData({ ...periodFormData, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={periodFormData.startDate}
                    onChange={(e) =>
                      setPeriodFormData({ ...periodFormData, startDate: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">End Date *</label>
                  <input
                    type="date"
                    required
                    value={periodFormData.endDate}
                    onChange={(e) =>
                      setPeriodFormData({ ...periodFormData, endDate: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Payout Date *</label>
                <input
                  type="date"
                  required
                  value={periodFormData.payoutDate}
                  onChange={(e) =>
                    setPeriodFormData({ ...periodFormData, payoutDate: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Status</label>
                <select
                  value={periodFormData.status}
                  onChange={(e) => setPeriodFormData({ ...periodFormData, status: e.target.value as any })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="open">Open</option>
                  <option value="for_approval">For Approval</option>
                  <option value="approved">Approved</option>
                  <option value="finalized">Finalized</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setPeriodModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 transition shadow-lg shadow-blue-600/25 disabled:opacity-60"
                >
                  {busy ? 'Creating…' : 'Create Cut-Off Period'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
