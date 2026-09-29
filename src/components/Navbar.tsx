import React from 'react';
import { LogOut, UserCheck, ShieldCheck, Building2 } from 'lucide-react';

interface NavbarProps {
  user: {
    fullName: string;
    employeeId: string;
    role: 'super_admin' | 'employee';
    businessName?: string;
  };
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ user, onLogout }) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-black text-xl text-white shadow-lg shadow-blue-500/20">
              CV
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-white tracking-tight">CV Log</span>
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {user.role === 'super_admin' ? 'Super Admin' : 'Employee Portal'}
                </span>
              </div>
              <p className="text-xs text-slate-400">CV Group Attendance & Payroll</p>
            </div>
          </div>

          {/* User profile & Logout */}
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-sm font-semibold text-slate-200">{user.fullName}</span>
              <div className="flex items-center gap-2 text-xs text-slate-400 justify-end">
                <span>{user.employeeId}</span>
                {user.businessName && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-slate-300">
                      <Building2 className="w-3 h-3 text-blue-400" />
                      {user.businessName}
                    </span>
                  </>
                )}
              </div>
            </div>

            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition border border-slate-700/60"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4 text-slate-400" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
