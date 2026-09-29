import React, { useEffect, useState } from 'react';
import { Lock, UserRound, AlertCircle, ArrowRight } from 'lucide-react';
import { api } from '../services/api';

interface LoginScreenProps {
  onAuthenticated: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<'loading' | 'login' | 'setup'>('loading');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Setup form state
  const [setupData, setSetupData] = useState({
    fullName: '',
    employeeId: '',
    email: '',
    mobileNumber: '',
    password: '',
    confirmPassword: '',
  });

  useEffect(() => {
    api.auth
      .status()
      .then((res) => {
        setMode(res.hasAccounts ? 'login' : 'setup');
      })
      .catch(() => {
        setError('Unable to reach the server. Please check your connection.');
        setMode('login');
      });
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginId || !password) return;
    setError('');
    setBusy(true);

    try {
      await api.auth.login(loginId, password);
      onAuthenticated();
    } catch (err: any) {
      setError(err.message || 'Invalid credentials.');
    } finally {
      setBusy(false);
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (setupData.password !== setupData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (setupData.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setError('');
    setBusy(true);

    try {
      await api.auth.setup(setupData);
      await api.auth.login(setupData.employeeId, setupData.password);
      onAuthenticated();
    } catch (err: any) {
      setError(err.message || 'Failed to complete administrator setup.');
    } finally {
      setBusy(false);
    }
  };

  if (mode === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-300 flex items-center justify-center font-sans">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span>Loading CV Log…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 selection:bg-blue-600 selection:text-white">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8">
        {/* Brand */}
        <div className="flex items-center gap-3.5 mb-6">
          <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center font-black text-2xl text-white shadow-lg shadow-blue-500/25">
            CV
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">CV Log</h1>
            <p className="text-xs text-slate-400">Attendance & Payroll Management System</p>
          </div>
        </div>

        {mode === 'setup' ? (
          <div>
            <div className="mb-5 pb-4 border-b border-slate-800">
              <h2 className="text-base font-semibold text-white">Initialize Super Admin</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Set up the master administrator account for CV Group.
              </p>
            </div>

            <form onSubmit={handleSetup} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="Enter full name"
                  value={setupData.fullName}
                  onChange={(e) => setSetupData({ ...setupData, fullName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Employee ID</label>
                <input
                  type="text"
                  required
                  value={setupData.employeeId}
                  onChange={(e) => setSetupData({ ...setupData, employeeId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
                  <input
                    type="password"
                    required
                    placeholder="Min 6 chars"
                    value={setupData.password}
                    onChange={(e) => setSetupData({ ...setupData, password: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Confirm</label>
                  <input
                    type="password"
                    required
                    placeholder="Re-enter password"
                    value={setupData.confirmPassword}
                    onChange={(e) => setSetupData({ ...setupData, confirmPassword: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {error && (
                <div className="p-2.5 rounded-lg bg-red-950/60 border border-red-800/80 text-red-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full mt-2 py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition shadow-lg shadow-blue-600/25 disabled:opacity-60"
              >
                {busy ? 'Setting up…' : 'Create Super Admin Account'}
              </button>
            </form>
          </div>
        ) : (
          <div>
            <div className="mb-5 pb-3 border-b border-slate-800">
              <h2 className="text-base font-semibold text-white">Sign In to Your Account</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Enter your Employee ID or mobile number and password to access the portal.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Employee ID or Mobile
                </label>
                <div className="relative">
                  <UserRound className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    placeholder="Enter Employee ID or mobile number"
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-slate-300">Password</label>
                  <span className="text-[11px] text-slate-500">First time? Use Employee ID</span>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {error && (
                <div className="p-2.5 rounded-lg bg-red-950/60 border border-red-800/80 text-red-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition shadow-lg shadow-blue-600/25 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                <span>{busy ? 'Signing in…' : 'Sign In'}</span>
                {!busy && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>

          </div>
        )}
      </div>

      <p className="mt-6 text-xs text-slate-500 text-center">
        CV Group of Companies • Internal Attendance & Payroll Portal
      </p>
    </div>
  );
};
