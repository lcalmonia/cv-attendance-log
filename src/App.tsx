import React, { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Navbar } from './components/Navbar';
import { Navigation } from './components/Navigation';
import { LoginScreen } from './components/LoginScreen';
const ChangePasswordScreen = lazy(() => import('./components/ChangePasswordScreen').then((m) => ({ default: m.ChangePasswordScreen })));
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard })));
const BusinessManagement = lazy(() => import('./components/admin/BusinessManagement').then((m) => ({ default: m.BusinessManagement })));
const EmployeeManagement = lazy(() => import('./components/admin/EmployeeManagement').then((m) => ({ default: m.EmployeeManagement })));
const ScheduleManagement = lazy(() => import('./components/admin/ScheduleManagement').then((m) => ({ default: m.ScheduleManagement })));
const AttendanceManagement = lazy(() => import('./components/admin/AttendanceManagement').then((m) => ({ default: m.AttendanceManagement })));
const DeductionManagement = lazy(() => import('./components/admin/DeductionManagement').then((m) => ({ default: m.DeductionManagement })));
const IncentiveManagement = lazy(() => import('./components/admin/IncentiveManagement').then((m) => ({ default: m.IncentiveManagement })));
const PayrollManagement = lazy(() => import('./components/admin/PayrollManagement').then((m) => ({ default: m.PayrollManagement })));
const PayrollSettingsManagement = lazy(() => import('./components/admin/PayrollSettingsManagement').then((m) => ({ default: m.PayrollSettingsManagement })));
const EmployeeDashboard = lazy(() => import('./components/employee/EmployeeDashboard').then((m) => ({ default: m.EmployeeDashboard })));
const MySchedule = lazy(() => import('./components/employee/MySchedule').then((m) => ({ default: m.MySchedule })));
const MyAttendance = lazy(() => import('./components/employee/MyAttendance').then((m) => ({ default: m.MyAttendance })));
const MyPayroll = lazy(() => import('./components/employee/MyPayroll').then((m) => ({ default: m.MyPayroll })));
import { api } from './services/api';

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
    try {
      const res = await api.auth.session();
      if (res.authenticated) {
        setSession(res);
        setAuthState('authenticated');
      } else {
        setAuthState('login');
      }
    } catch {
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
        <Suspense fallback={<div className="py-16 text-center text-slate-500">Loading your workspace…</div>}>
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
            {activeTab === 'settings' && <PayrollSettingsManagement />}
          </>
        ) : (
          <>
            {activeTab === 'dashboard' && <EmployeeDashboard onNavigate={setActiveTab} />}
            {activeTab === 'my-schedule' && <MySchedule />}
            {activeTab === 'my-attendance' && <MyAttendance />}
            {activeTab === 'my-payroll' && <MyPayroll />}
          </>
        )}
        </Suspense>
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
