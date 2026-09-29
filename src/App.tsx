import React, { useCallback, useEffect, useState } from 'react';
import { Navbar } from './components/Navbar';
import { Navigation } from './components/Navigation';
import { LoginScreen } from './components/LoginScreen';
import { ChangePasswordScreen } from './components/ChangePasswordScreen';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { BusinessManagement } from './components/admin/BusinessManagement';
import { EmployeeManagement } from './components/admin/EmployeeManagement';
import { ScheduleManagement } from './components/admin/ScheduleManagement';
import { AttendanceManagement } from './components/admin/AttendanceManagement';
import { DeductionManagement } from './components/admin/DeductionManagement';
import { IncentiveManagement } from './components/admin/IncentiveManagement';
import { PayrollManagement } from './components/admin/PayrollManagement';
import { EmployeeDashboard } from './components/employee/EmployeeDashboard';
import { MySchedule } from './components/employee/MySchedule';
import { MyAttendance } from './components/employee/MyAttendance';
import { MyPayroll } from './components/employee/MyPayroll';
import { api, getAuthToken, clearAuthToken } from './services/api';

export default function App() {
  const [authState, setAuthState] = useState<'checking' | 'login' | 'authenticated'>('checking');
  const [session, setSession] = useState<{
    authenticated: boolean;
    userId: string;
    employeeId: string;
    fullName: string;
    email: string;
    role: 'super_admin' | 'employee';
    mustChangePassword: boolean;
    businessName?: string;
  } | null>(null);

  const [activeTab, setActiveTab] = useState('dashboard');

  const checkSession = useCallback(async () => {
    if (!getAuthToken()) {
      setAuthState('login');
      return;
    }
    try {
      const res = await api.auth.session();
      if (res.authenticated) {
        setSession(res);
        setAuthState('authenticated');
      } else {
        clearAuthToken();
        setAuthState('login');
      }
    } catch {
      clearAuthToken();
      setAuthState('login');
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const handleLogout = async () => {
    try {
      await api.auth.logout();
    } finally {
      clearAuthToken();
      setSession(null);
      setAuthState('login');
    }
  };

  const handlePasswordChanged = () => {
    if (session) {
      setSession({ ...session, mustChangePassword: false });
    }
  };

  if (authState === 'checking') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-300 flex items-center justify-center font-sans">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span>Loading CV Log…</span>
        </div>
      </div>
    );
  }

  if (authState === 'login' || !session) {
    return <LoginScreen onAuthenticated={checkSession} />;
  }

  if (session.mustChangePassword) {
    return <ChangePasswordScreen onComplete={handlePasswordChanged} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      <Navbar user={session} onLogout={handleLogout} />
      <Navigation role={session.role} activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {session.role === 'super_admin' ? (
          <>
            {activeTab === 'dashboard' && <AdminDashboard onNavigate={setActiveTab} />}
            {activeTab === 'businesses' && <BusinessManagement />}
            {activeTab === 'employees' && <EmployeeManagement />}
            {activeTab === 'schedules' && <ScheduleManagement />}
            {activeTab === 'attendance' && <AttendanceManagement />}
            {activeTab === 'deductions' && <DeductionManagement />}
            {activeTab === 'incentives' && <IncentiveManagement />}
            {activeTab === 'payroll' && <PayrollManagement />}
          </>
        ) : (
          <>
            {activeTab === 'dashboard' && <EmployeeDashboard onNavigate={setActiveTab} />}
            {activeTab === 'my-schedule' && <MySchedule />}
            {activeTab === 'my-attendance' && <MyAttendance />}
            {activeTab === 'my-payroll' && <MyPayroll />}
          </>
        )}
      </main>

      <footer className="bg-slate-900 border-t border-slate-800/80 py-5 text-xs text-slate-500 print:hidden mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-300">CV Log</span>
            <span>•</span>
            <span>CV Group of Companies Attendance & Payroll System</span>
          </div>
          <div className="text-[11px] text-slate-500">
            Role: <strong className="text-slate-400 capitalize">{session.role.replace('_', ' ')}</strong>
          </div>
        </div>
      </footer>
    </div>
  );
}
