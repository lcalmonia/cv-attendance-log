import React, { useEffect, useState } from 'react';
import {
  Clock,
  Calendar,
  Building2,
  CheckCircle2,
  Coffee,
  AlertCircle,
  Play,
  Pause,
  LogOut,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { AttendanceRecord, Schedule, AttendanceAction } from '../../types';
import { api } from '../../services/api';

interface EmployeeDashboardProps {
  onNavigate: (tab: string) => void;
}

export const EmployeeDashboard: React.FC<EmployeeDashboardProps> = ({ onNavigate }) => {
  const [data, setData] = useState<{
    employeeName: string;
    employeeId: string;
    position: string;
    businessName: string;
    todaySchedule: Partial<Schedule>;
    todayAttendance: AttendanceRecord | null;
    currentServerTime: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [clocking, setClocking] = useState(false);
  const [error, setError] = useState('');
  const [clockTimer, setClockTimer] = useState(new Date());

  const loadDashboard = async () => {
    try {
      const res = await api.employee.getDashboard();
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load employee portal');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
    const interval = setInterval(() => setClockTimer(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleClock = async (action: AttendanceAction) => {
    setClocking(true);
    setError('');
    try {
      await api.employee.clock(action);
      await loadDashboard();
    } catch (err: any) {
      setError(err.message || 'Action failed');
    } finally {
      setClocking(false);
    }
  };

  const schedule = data?.todaySchedule;
  const attendance = data?.todayAttendance;

  // Determine valid clocking actions
  const hasTimedIn = Boolean(attendance?.timeIn);
  const hasBrokenOut = Boolean(attendance?.breakOut);
  const hasBrokenIn = Boolean(attendance?.breakIn);
  const hasTimedOut = Boolean(attendance?.timeOut);

  const canTimeIn = !hasTimedIn;
  const canBreakOut = hasTimedIn && !hasBrokenOut && !hasTimedOut;
  const canBreakIn = hasTimedIn && hasBrokenOut && !hasBrokenIn && !hasTimedOut;
  const canTimeOut = hasTimedIn && (!hasBrokenOut || hasBrokenIn) && !hasTimedOut;
  const isCompleted = hasTimedIn && hasTimedOut;

  const formatTime = (isoString?: string) => {
    if (!isoString) return '—';
    try {
      return new Date(isoString).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome & Info Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs uppercase font-bold tracking-wider text-blue-400">
              Welcome back
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-0.5">
              {data?.employeeName || 'Employee'}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-2">
              <span className="font-mono text-slate-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                {data?.employeeId}
              </span>
              <span>•</span>
              <span className="text-slate-300 font-medium">{data?.position}</span>
              <span>•</span>
              <span className="flex items-center gap-1 text-blue-300">
                <Building2 className="w-3.5 h-3.5" />
                {data?.businessName}
              </span>
            </div>
          </div>

          {/* Current Live Digital Clock */}
          <div className="text-right bg-slate-950/80 p-4 rounded-xl border border-slate-800/80 self-start sm:self-auto">
            <div className="text-2xl font-mono font-bold text-white tracking-wider">
              {clockTimer.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              {clockTimer.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Schedule for Today & Clock Station */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Schedule Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-400" />
                <span>Today&apos;s Schedule</span>
              </h2>
              {schedule?.isWorkingDay ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Duty Day
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                  Scheduled Rest Day (OFF)
                </span>
              )}
            </div>

            {schedule?.isWorkingDay ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-xs text-slate-400">Required Shift Hours</div>
                  <div className="text-2xl font-bold text-white mt-1">
                    {schedule.requiredTimeIn} – {schedule.requiredTimeOut}
                  </div>
                  {schedule.notes && (
                    <div className="text-xs text-slate-400 mt-1 italic">{schedule.notes}</div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                    <span className="text-slate-500 block">Scheduled Break Out:</span>
                    <span className="font-semibold text-slate-200 mt-0.5 block">
                      {schedule.breakOut || 'Standard 1 hour'}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                    <span className="text-slate-500 block">Scheduled Break In:</span>
                    <span className="font-semibold text-slate-200 mt-0.5 block">
                      {schedule.breakIn || 'Standard 1 hour'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center bg-slate-950 rounded-xl border border-slate-800">
                <p className="text-slate-300 font-medium">No duty shift scheduled today.</p>
                <p className="text-xs text-slate-500 mt-1">
                  Enjoy your rest day! Scheduled OFF days do not count as absences.
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Want to review the full cut-off?</span>
            <button
              onClick={() => onNavigate('my-schedule')}
              className="text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1"
            >
              <span>View full schedule</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Real-Time Attendance Clock Station */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-400" />
                <span>Attendance Clock Station</span>
              </h2>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                <span>Server Synchronized</span>
              </div>
            </div>

            {/* Attendance Status Today */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-center">
                <span className="text-[11px] text-slate-500 block">Time In</span>
                <span className="font-mono font-bold text-white text-xs mt-1 block">
                  {formatTime(attendance?.timeIn)}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-center">
                <span className="text-[11px] text-slate-500 block">Break Out</span>
                <span className="font-mono font-bold text-slate-300 text-xs mt-1 block">
                  {formatTime(attendance?.breakOut)}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-center">
                <span className="text-[11px] text-slate-500 block">Break In</span>
                <span className="font-mono font-bold text-slate-300 text-xs mt-1 block">
                  {formatTime(attendance?.breakIn)}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-center">
                <span className="text-[11px] text-slate-500 block">Time Out</span>
                <span className="font-mono font-bold text-white text-xs mt-1 block">
                  {formatTime(attendance?.timeOut)}
                </span>
              </div>
            </div>

            {error && (
              <div className="p-2.5 rounded-lg bg-red-950/60 border border-red-800 text-red-200 text-xs mb-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Action Buttons (Strictly per Section 9) */}
            {isCompleted ? (
              <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/80 text-center space-y-1">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <div className="font-bold text-emerald-300">Attendance Completed Today</div>
                <p className="text-xs text-slate-400">
                  Total logged work duration:{' '}
                  <strong className="text-white">
                    {attendance ? (attendance.totalWorkMinutes / 60).toFixed(1) : 0} hours
                  </strong>
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {/* Time In */}
                {canTimeIn && (
                  <button
                    onClick={() => handleClock('time_in')}
                    disabled={clocking}
                    className="col-span-2 py-4 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-base transition shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Play className="w-5 h-5 fill-current" />
                    <span>Time In</span>
                  </button>
                )}

                {/* Break Out */}
                {canBreakOut && (
                  <button
                    onClick={() => handleClock('break_out')}
                    disabled={clocking}
                    className="py-3 px-4 rounded-xl bg-amber-600/90 hover:bg-amber-600 text-white font-semibold text-sm transition shadow-md shadow-amber-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Coffee className="w-4 h-4" />
                    <span>Break Out</span>
                  </button>
                )}

                {/* Break In */}
                {canBreakIn && (
                  <button
                    onClick={() => handleClock('break_in')}
                    disabled={clocking}
                    className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Break In</span>
                  </button>
                )}

                {/* Time Out */}
                {canTimeOut && (
                  <button
                    onClick={() => handleClock('time_out')}
                    disabled={clocking}
                    className={`${
                      canBreakOut ? 'col-span-1' : 'col-span-2'
                    } py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm transition shadow-md shadow-rose-600/20 flex items-center justify-center gap-2 disabled:opacity-50`}
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Time Out</span>
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span>Want to review logged days?</span>
            <button
              onClick={() => onNavigate('my-attendance')}
              className="text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
            >
              <span>View my attendance</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
