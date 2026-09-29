import React from 'react';
import {
  LayoutDashboard,
  Building2,
  Users,
  CalendarDays,
  Clock,
  CheckCircle2,
  DollarSign,
  FileText,
  Award,
} from 'lucide-react';
import { UserRole } from '../types';

interface NavigationProps {
  role: UserRole;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ role, activeTab, setActiveTab }) => {
  const adminTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'businesses', label: 'Businesses', icon: Building2 },
    { id: 'employees', label: 'Employees', icon: Users },
    { id: 'schedules', label: 'Schedules', icon: CalendarDays },
    { id: 'attendance', label: 'Attendance', icon: Clock },
    { id: 'deductions', label: 'Deductions', icon: CheckCircle2 },
    { id: 'incentives', label: 'Incentives', icon: Award },
    { id: 'payroll', label: 'Payroll', icon: DollarSign },
  ];

  const employeeTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'my-schedule', label: 'My Schedule', icon: CalendarDays },
    { id: 'my-attendance', label: 'My Attendance', icon: Clock },
    { id: 'my-payroll', label: 'My Payroll', icon: DollarSign },
  ];

  const tabs = role === 'super_admin' ? adminTabs : employeeTabs;

  return (
    <nav className="bg-slate-900/80 border-b border-slate-800/80 backdrop-blur-xs sticky top-16 z-30 print:hidden overflow-x-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex space-x-1 sm:space-x-2 py-2 min-w-max">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
