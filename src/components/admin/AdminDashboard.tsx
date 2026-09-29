import React, { useEffect, useState } from 'react';
import { Building2, Users, Clock, CalendarDays, CheckCircle2, ChevronRight, ArrowUpRight } from 'lucide-react';
import { api } from '../../services/api';

interface AdminDashboardProps {
  onNavigate: (tab: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
  const [stats, setStats] = useState<{
    businessesCount: number;
    activeEmployeesCount: number;
    timedInEmployees: number;
    currentCutoff: string;
    payrollStatus: string;
    periodId?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.admin
      .getDashboard()
      .then((data) => setStats(data))
      .catch((err) => console.error('Failed to load dashboard stats', err))
      .finally(() => setLoading(false));
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Open</span>;
      case 'for_approval':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">For Approval</span>;
      case 'approved':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">Approved</span>;
      case 'finalized':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">Finalized</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-700 text-slate-300">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Super Admin Dashboard</h1>
        <p className="text-sm text-slate-400 mt-1">
          High-level operational overview across all CV Group businesses.
        </p>
      </div>

      {/* 5 Core Metric Cards (Section 2) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Businesses */}
        <div
          onClick={() => onNavigate('businesses')}
          className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Businesses</span>
            <Building2 className="w-4 h-4 text-blue-400 group-hover:scale-110 transition" />
          </div>
          <div className="text-2xl font-bold text-white">
            {loading ? '…' : stats?.businessesCount ?? 0}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 flex items-center gap-1 group-hover:text-blue-400">
            Manage enterprises <ChevronRight className="w-3 h-3" />
          </span>
        </div>

        {/* Active Employees */}
        <div
          onClick={() => onNavigate('employees')}
          className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Active Employees</span>
            <Users className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition" />
          </div>
          <div className="text-2xl font-bold text-white">
            {loading ? '…' : stats?.activeEmployeesCount ?? 0}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 flex items-center gap-1 group-hover:text-emerald-400">
            View personnel <ChevronRight className="w-3 h-3" />
          </span>
        </div>

        {/* Currently Timed In */}
        <div
          onClick={() => onNavigate('attendance')}
          className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Currently Timed In</span>
            <Clock className="w-4 h-4 text-amber-400 group-hover:scale-110 transition" />
          </div>
          <div className="text-2xl font-bold text-white">
            {loading ? '…' : stats?.timedInEmployees ?? 0}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 flex items-center gap-1 group-hover:text-amber-400">
            Live attendance log <ChevronRight className="w-3 h-3" />
          </span>
        </div>

        {/* Current Payroll Cutoff */}
        <div
          onClick={() => onNavigate('payroll')}
          className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition cursor-pointer group sm:col-span-2 lg:col-span-2"
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Current Payroll Cut-Off</span>
            <CalendarDays className="w-4 h-4 text-purple-400 group-hover:scale-110 transition" />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-bold text-white truncate">
                {loading ? 'Loading…' : stats?.currentCutoff || 'None'}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-slate-400">Status:</span>
                {loading ? null : getStatusBadge(stats?.payrollStatus || 'none')}
              </div>
            </div>
            <span className="p-2 rounded-lg bg-slate-800 text-slate-300 group-hover:bg-blue-600 group-hover:text-white transition">
              <ArrowUpRight className="w-4 h-4" />
            </span>
          </div>
        </div>
      </div>

      {/* Quick Access Modules Navigation */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
          Super Admin Modules
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[
            { id: 'businesses', label: 'Businesses', desc: 'Create & manage companies', icon: Building2, color: 'text-blue-400' },
            { id: 'employees', label: 'Employees', desc: 'Staff directory & credentials', icon: Users, color: 'text-emerald-400' },
            { id: 'schedules', label: 'Schedules', desc: 'Date-by-date work hours', icon: CalendarDays, color: 'text-indigo-400' },
            { id: 'attendance', label: 'Attendance', desc: 'All employees clock records', icon: Clock, color: 'text-amber-400' },
            { id: 'deductions', label: 'Deductions', desc: 'Recurring & employee specific', icon: CheckCircle2, color: 'text-rose-400' },
            { id: 'incentives', label: 'Incentives', desc: 'Attendance bonus programs', icon: CheckCircle2, color: 'text-teal-400' },
            { id: 'payroll', label: 'Payroll', desc: 'Run calculations & approvals', icon: ArrowUpRight, color: 'text-purple-400' },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className="flex flex-col text-left p-4 rounded-xl bg-slate-950/60 hover:bg-slate-800 border border-slate-800/80 hover:border-slate-700 transition"
              >
                <Icon className={`w-5 h-5 ${item.color} mb-2`} />
                <span className="text-sm font-semibold text-white">{item.label}</span>
                <span className="text-xs text-slate-400 mt-0.5">{item.desc}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
