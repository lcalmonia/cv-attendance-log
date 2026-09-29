import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, CheckCircle2, XCircle, Search, X, Award, ShieldAlert } from 'lucide-react';
import { IncentiveProgram, Business } from '../../types';
import { api } from '../../services/api';

export const IncentiveManagement: React.FC = () => {
  const [incentives, setIncentives] = useState<(IncentiveProgram & { businessName: string })[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingInc, setEditingInc] = useState<IncentiveProgram | null>(null);

  const [formData, setFormData] = useState({
    businessId: '',
    name: '',
    description: '',
    amount: 1000,
    requireNoLate: true,
    requireNoAbsence: true,
    status: 'active' as any,
    effectiveDate: new Date().toISOString().slice(0, 10),
  });

  const [busy, setBusy] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [incList, bizList] = await Promise.all([
        api.admin.getIncentives(),
        api.admin.getBusinesses(),
      ]);
      setIncentives(incList);
      setBusinesses(bizList);
      if (bizList.length > 0 && !formData.businessId) {
        setFormData((prev) => ({ ...prev, businessId: bizList[0].id }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setEditingInc(null);
    setFormData({
      businessId: businesses[0]?.id || '',
      name: '',
      description: '',
      amount: 1000,
      requireNoLate: true,
      requireNoAbsence: true,
      status: 'active',
      effectiveDate: new Date().toISOString().slice(0, 10),
    });
    setModalOpen(true);
  };

  const openEditModal = (inc: IncentiveProgram) => {
    setEditingInc(inc);
    setFormData({
      businessId: inc.businessId,
      name: inc.name,
      description: inc.description || '',
      amount: inc.amount,
      requireNoLate: inc.requireNoLate,
      requireNoAbsence: inc.requireNoAbsence,
      status: inc.status,
      effectiveDate: inc.effectiveDate,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.businessId || !formData.name) return;
    setBusy(true);

    try {
      if (editingInc) {
        await api.admin.updateIncentive(editingInc.id, formData);
      } else {
        await api.admin.createIncentive(formData);
      }
      setModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Operation failed');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this incentive program?')) return;
    try {
      await api.admin.deleteIncentive(id);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleStatus = async (inc: IncentiveProgram) => {
    try {
      await api.admin.updateIncentive(inc.id, {
        status: inc.status === 'active' ? 'inactive' : 'active',
      });
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Incentive Programs</h1>
          <p className="text-sm text-slate-400 mt-1">
            Configure attendance and performance bonus programs per business.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition shadow-lg shadow-blue-600/20"
        >
          <Plus className="w-4 h-4" />
          <span>New Incentive Program</span>
        </button>
      </div>

      {/* Rules Notice (Requirement 8) */}
      <div className="p-3.5 bg-blue-950/40 border border-blue-900/60 rounded-xl text-xs text-blue-300 flex items-start gap-3">
        <Award className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="text-white block mb-0.5">Automated Attendance Qualification:</strong>
          Incentive qualification evaluates an employee&apos;s required scheduled duty days for each cut-off.
          Scheduled rest days (OFF) are never penalized as absences.
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs font-semibold uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Incentive Program</th>
                <th className="py-3 px-4">Business</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Attendance Rules</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    Loading incentive programs…
                  </td>
                </tr>
              ) : incentives.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No incentive programs created yet. Click &quot;New Incentive Program&quot; above.
                  </td>
                </tr>
              ) : (
                incentives.map((inc) => (
                  <tr key={inc.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{inc.name}</div>
                      <div className="text-xs text-slate-400 mt-0.5 max-w-sm">
                        {inc.description || 'No description'}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs font-medium text-slate-300">
                      {inc.businessName}
                    </td>
                    <td className="py-3 px-4 font-semibold text-emerald-400">
                      ₱{inc.amount.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-xs space-y-1">
                      {inc.requireNoAbsence && (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 text-slate-300 mr-1.5">
                          <span>Zero Absences on Duty Days</span>
                        </div>
                      )}
                      {inc.requireNoLate && (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                          <span>Zero Lateness</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleToggleStatus(inc)}
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer transition ${
                          inc.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {inc.status === 'active' ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <XCircle className="w-3 h-3" />
                        )}
                        <span className="capitalize">{inc.status}</span>
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEditModal(inc)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 transition"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(inc.id)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-red-400 transition"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <h3 className="font-semibold text-white">
                {editingInc ? 'Edit Incentive Program' : 'New Incentive Program'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Incentive Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Perfect Attendance Bonus"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Target Business *
                </label>
                <select
                  value={formData.businessId}
                  onChange={(e) => setFormData({ ...formData, businessId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="all">All Businesses</option>
                  {businesses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Incentive Amount (₱) *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Description / Eligibility Details
                </label>
                <textarea
                  rows={2}
                  placeholder="Explain when employee receives this incentive"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-2 pt-1 border-t border-slate-800">
                <span className="block text-xs font-semibold text-slate-300 mb-1">
                  Attendance Conditions
                </span>

                <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.requireNoAbsence}
                    onChange={(e) =>
                      setFormData({ ...formData, requireNoAbsence: e.target.checked })
                    }
                    className="w-4 h-4 rounded text-blue-600 bg-slate-950 border-slate-700"
                  />
                  <span>Must have zero absences on all scheduled duty days</span>
                </label>

                <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.requireNoLate}
                    onChange={(e) => setFormData({ ...formData, requireNoLate: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 bg-slate-950 border-slate-700"
                  />
                  <span>Must have zero lateness across the entire cut-off</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:text-white bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-60"
                >
                  {busy ? 'Saving…' : editingInc ? 'Save Changes' : 'Create Incentive'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
