import React, { useState } from 'react';
import { KeyRound, AlertCircle, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';

interface ChangePasswordScreenProps {
  onComplete: () => void;
}

export const ChangePasswordScreen: React.FC<ChangePasswordScreenProps> = ({ onComplete }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setError('');
    setBusy(true);

    try {
      await api.auth.changePassword(currentPassword, newPassword);
      onComplete();
    } catch (err: any) {
      setError(err.message || 'Failed to update password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Change Password Required</h1>
            <p className="text-xs text-slate-400">Please set a secure permanent password</p>
          </div>
        </div>

        <p className="text-xs text-slate-300 mb-5 leading-relaxed bg-slate-950 p-3 rounded-lg border border-slate-800">
          This is your first login with your temporary employee password. You must set a personal
          password before continuing.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Temporary / Current Password
            </label>
            <input
              type="password"
              required
              placeholder="Enter current password (your Employee ID)"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              New Password (minimum 6 characters)
            </label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
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
            className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition shadow-lg shadow-blue-600/25 disabled:opacity-60"
          >
            {busy ? 'Updating Password…' : 'Set Permanent Password & Enter'}
          </button>
        </form>
      </div>
    </div>
  );
};
