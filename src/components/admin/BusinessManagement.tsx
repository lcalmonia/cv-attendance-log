import React, { useEffect, useState } from 'react';
import { Building2, Plus, Edit2, CheckCircle2, XCircle, Search, X } from 'lucide-react';
import { Business } from '../../types';
import { api } from '../../services/api';

export const BusinessManagement: React.FC = () => {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBiz, setEditingBiz] = useState<Business | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    address: '',
    contactNumber: '',
    status: 'active' as 'active' | 'inactive',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadData = () => {
    setLoading(true);
    api.admin
      .getBusinesses()
      .then((data) => setBusinesses(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setEditingBiz(null);
    setFormData({
      name: '',
      code: '',
      address: '',
      contactNumber: '',
      status: 'active',
    });
    setError('');
    setModalOpen(true);
  };

  const openEditModal = (biz: Business) => {
    setEditingBiz(biz);
    setFormData({
      name: biz.name,
      code: biz.code,
      address: biz.address || '',
      contactNumber: biz.contactNumber || '',
      status: biz.status,
    });
    setError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.code) return;
    setBusy(true);
    setError('');

    try {
      if (editingBiz) {
        await api.admin.updateBusiness(editingBiz.id, formData);
      } else {
        await api.admin.createBusiness(formData);
      }
      setModalOpen(false);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Operation failed');
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async (biz: Business) => {
    const newStatus = biz.status === 'active' ? 'inactive' : 'active';
    try {
      await api.admin.updateBusiness(biz.id, { status: newStatus });
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = businesses.filter(
    (b) =>
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      b.code.toLowerCase().includes(search.toLowerCase()) ||
      b.address?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Business Management</h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage the business entities and branches operating under CV Group.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition shadow-lg shadow-blue-600/20"
        >
          <Plus className="w-4 h-4" />
          <span>Add Business</span>
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by name, code, or address…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs font-semibold uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Business Name</th>
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Address</th>
                <th className="py-3 px-4">Contact Number</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    Loading businesses…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No businesses found.
                  </td>
                </tr>
              ) : (
                filtered.map((biz) => (
                  <tr key={biz.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-semibold text-white">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold text-xs">
                          {biz.code.slice(0, 3)}
                        </div>
                        <span>{biz.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {biz.code}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-xs max-w-xs truncate">
                      {biz.address || '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-400 text-xs">
                      {biz.contactNumber || '—'}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => toggleStatus(biz)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer transition ${
                          biz.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                            : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
                        }`}
                        title="Click to toggle status"
                      >
                        {biz.status === 'active' ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5" />
                        )}
                        <span className="capitalize">{biz.status}</span>
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => openEditModal(biz)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition inline-flex items-center gap-1 text-xs"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-blue-400" />
                        <span>Edit</span>
                      </button>
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
                {editingBiz ? 'Edit Business' : 'Add New Business'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Business Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. iLuvKeyks Coffee & Tea"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Business Code *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ILK"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white uppercase focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Address</label>
                <input
                  type="text"
                  placeholder="Unit / Street / City"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Contact Number
                </label>
                <input
                  type="text"
                  placeholder="+63 9XX XXX XXXX"
                  value={formData.contactNumber}
                  onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              {error && (
                <div className="p-2.5 rounded-lg bg-red-950/60 border border-red-800/80 text-red-200 text-xs">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
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
                  {busy ? 'Saving…' : editingBiz ? 'Save Changes' : 'Create Business'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
