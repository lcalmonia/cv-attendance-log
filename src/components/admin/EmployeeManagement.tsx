import React, { useEffect, useState } from 'react';
import { Users, Plus, Edit2, KeyRound, Trash2, CheckCircle2, XCircle, Search, X, Building2 } from 'lucide-react';
import { Employee, Business, EmploymentStatus, AccountStatus } from '../../types';
import { api } from '../../services/api';

export const EmployeeManagement: React.FC = () => {
  const [employees, setEmployees] = useState<(Employee & { businessName: string })[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [businessFilter, setBusinessFilter] = useState('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);

  const [formData, setFormData] = useState({
    employeeId: '',
    fullName: '',
    mobileNumber: '',
    email: '',
    position: '',
    employmentStatus: 'regular' as EmploymentStatus,
    dateHired: new Date().toISOString().slice(0, 10),
    businessId: '',
    dailyRate: 600,
    requiredHoursPerDay: 8,
    status: 'active' as AccountStatus,
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [empList, bizList] = await Promise.all([
        api.admin.getEmployees(),
        api.admin.getBusinesses(),
      ]);
      setEmployees(empList);
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
    setEditingEmp(null);
    setFormData({
      employeeId: '',
      fullName: '',
      mobileNumber: '',
      email: '',
      position: '',
      employmentStatus: 'regular',
      dateHired: new Date().toISOString().slice(0, 10),
      businessId: businesses[0]?.id || '',
      dailyRate: 600,
      requiredHoursPerDay: 8,
      status: 'active',
    });
    setError('');
    setModalOpen(true);
  };

  const openEditModal = (emp: Employee) => {
    setEditingEmp(emp);
    setFormData({
      employeeId: emp.employeeId,
      fullName: emp.fullName,
      mobileNumber: emp.mobileNumber || '',
      email: emp.email || '',
      position: emp.position || '',
      employmentStatus: emp.employmentStatus,
      dateHired: emp.dateHired ? String(emp.dateHired).slice(0, 10) : new Date().toISOString().slice(0, 10),
      businessId: emp.businessId,
      dailyRate: emp.dailyRate,
      requiredHoursPerDay: emp.requiredHoursPerDay,
      status: emp.status,
    });
    setError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.employeeId || !formData.fullName || !formData.businessId) return;
    setBusy(true);
    setError('');

    try {
      if (editingEmp) {
        await api.admin.updateEmployee(editingEmp.id, formData);
        setSuccessMessage(`Updated ${formData.fullName}`);
      } else {
        await api.admin.createEmployee(formData);
        setSuccessMessage(`Created employee ${formData.fullName}. Account password is ${formData.employeeId}.`);
      }
      setModalOpen(false);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Operation failed');
    } finally {
      setBusy(false);
    }
  };

  const handleResetPassword = async (emp: Employee) => {
    if (
      !confirm(
        `Reset password for ${emp.fullName} (${emp.employeeId})?\nTemporary password will be set to their Employee ID: ${emp.employeeId}.`
      )
    ) {
      return;
    }
    try {
      const res = await api.admin.resetEmployeePassword(emp.id);
      setSuccessMessage(res.message);
    } catch (err: any) {
      alert(err.message || 'Failed to reset password');
    }
  };

  const handleDeleteEmployee = async (emp: Employee) => {
    const confirmed = confirm(
      `Delete employee ${emp.fullName} (${emp.employeeId}) permanently?\n\nThis will also remove their schedules, attendance records, deductions, payroll approvals, login account, and active sessions. This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      await api.admin.deleteEmployee(emp.id);
      setSuccessMessage(`Deleted employee ${emp.fullName}.`);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete employee');
    }
  };

  const filtered = employees.filter((e) => {
    const matchBiz = businessFilter === 'all' || e.businessId === businessFilter;
    const matchSearch =
      e.fullName.toLowerCase().includes(search.toLowerCase()) ||
      e.employeeId.toLowerCase().includes(search.toLowerCase()) ||
      e.position.toLowerCase().includes(search.toLowerCase());
    return matchBiz && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Employee Management</h1>
          <p className="text-sm text-slate-400 mt-1">
            Maintain employee rosters, assigned business, pay rates, and portal credentials.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition shadow-lg shadow-blue-600/20"
        >
          <Plus className="w-4 h-4" />
          <span>Add Employee</span>
        </button>
      </div>

      {successMessage && (
        <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800 text-emerald-200 text-xs flex items-center justify-between">
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage('')} className="text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by name, ID, or position…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-slate-500" />
          <select
            value={businessFilter}
            onChange={(e) => setBusinessFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Businesses</option>
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs font-semibold uppercase text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Business</th>
                <th className="py-3 px-4">Position & Status</th>
                <th className="py-3 px-4">Rate & Hours</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">Account</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Loading personnel directory…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No employees matching criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">{emp.fullName}</div>
                      <div className="text-xs font-mono text-blue-400 mt-0.5">{emp.employeeId}</div>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-medium">
                        {emp.businessName}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <div className="text-slate-200">{emp.position || 'Staff'}</div>
                      <span className="text-[11px] text-slate-400 capitalize">
                        {emp.employmentStatus.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <div className="font-semibold text-emerald-400">₱{emp.dailyRate.toLocaleString()} / day</div>
                      <div className="text-[11px] text-slate-400">{emp.requiredHoursPerDay} hrs/shift</div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-400">
                      <div>{emp.mobileNumber || '—'}</div>
                      <div className="text-[11px] text-slate-500">{emp.email || '—'}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          emp.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {emp.status === 'active' ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <XCircle className="w-3 h-3" />
                        )}
                        <span className="capitalize">{emp.status}</span>
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleResetPassword(emp)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 transition"
                          title="Reset Password to Employee ID"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openEditModal(emp)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                          title="Edit Employee"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-blue-400" />
                        </button>
                        <button
                          onClick={() => handleDeleteEmployee(emp)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-950 text-red-400 hover:text-red-300 transition"
                          title="Delete Employee"
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
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <h3 className="font-semibold text-white">
                {editingEmp ? 'Edit Employee Details' : 'Register New Employee'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-3.5 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Employee ID *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingEmp}
                    placeholder="e.g. ILK-EMP-105"
                    value={formData.employeeId}
                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-mono disabled:opacity-50"
                  />
                  {!editingEmp && (
                    <span className="text-[10px] text-slate-500 mt-0.5 block">
                      Initial login password will be this ID
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Business Assignment *
                  </label>
                  <select
                    value={formData.businessId}
                    onChange={(e) => setFormData({ ...formData, businessId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    {businesses.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Joshua De Leon"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Position</label>
                  <input
                    type="text"
                    placeholder="e.g. Barista"
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Employment Status
                  </label>
                  <select
                    value={formData.employmentStatus}
                    onChange={(e) => setFormData({ ...formData, employmentStatus: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="regular">Regular</option>
                    <option value="probationary">Probationary</option>
                    <option value="contractual">Contractual</option>
                    <option value="part_time">Part-time</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Daily Rate (₱) *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={formData.dailyRate}
                    onChange={(e) => setFormData({ ...formData, dailyRate: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Required Hours / Day *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={24}
                    value={formData.requiredHoursPerDay}
                    onChange={(e) =>
                      setFormData({ ...formData, requiredHoursPerDay: Number(e.target.value) })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Mobile Number
                  </label>
                  <input
                    type="text"
                    placeholder="+63 9XX XXX XXXX"
                    value={formData.mobileNumber}
                    onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Email</label>
                  <input
                    type="email"
                    placeholder="employee@domain.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Date Hired</label>
                  <input
                    type="date"
                    value={formData.dateHired}
                    onChange={(e) => setFormData({ ...formData, dateHired: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Account Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {error && (
                <div className="p-2.5 rounded-lg bg-red-950/60 border border-red-800/80 text-red-200 text-xs">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
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
                  {busy ? 'Saving…' : editingEmp ? 'Save Changes' : 'Create Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
