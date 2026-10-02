import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, CheckCircle2, XCircle, Search, X, DollarSign, Percent } from 'lucide-react';
import { DeductionType, EmployeeDeduction, Business, Employee, PayrollPeriod } from '../../types';
import { api } from '../../services/api';

export const DeductionManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'common' | 'employee'>('common');
  const [deductionTypes, setDeductionTypes] = useState<DeductionType[]>([]);
  const [employeeDeductions, setEmployeeDeductions] = useState<(EmployeeDeduction & { employeeName: string })[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [employees, setEmployees] = useState<(Employee & { businessName: string })[]>([]);
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [loading, setLoading] = useState(true);

  // Common Modal State
  const [commonModalOpen, setCommonModalOpen] = useState(false);
  const [editingCommonId, setEditingCommonId] = useState<string | null>(null);
  const [commonForm, setCommonForm] = useState({
    businessId: 'all',
    name: '',
    calculationType: 'fixed' as 'fixed' | 'percentage',
    value: 100,
    recurring: true,
    status: 'active' as any,
  });

  // Employee Modal State
  const [empModalOpen, setEmpModalOpen] = useState(false);
  const [editingEmpId, setEditingEmpId] = useState<string | null>(null);
  const [empForm, setEmpForm] = useState({
    employeeId: '',
    deductionName: '',
    amount: 500,
    payrollPeriodId: '',
    recurring: false,
    status: 'active' as any,
  });

  const [busy, setBusy] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [types, empDeds, bizList, empList, pList] = await Promise.all([
        api.admin.getDeductionTypes(),
        api.admin.getEmployeeDeductions(),
        api.admin.getBusinesses(),
        api.admin.getEmployees(),
        api.admin.getPeriods(),
      ]);
      setDeductionTypes(types);
      setEmployeeDeductions(empDeds);
      setBusinesses(bizList);
      setEmployees(empList);
      setPeriods(pList);
      if (empList.length > 0 && !empForm.employeeId) {
        setEmpForm((prev) => ({
          ...prev,
          employeeId: empList[0].id,
          payrollPeriodId: pList[0]?.id || '',
        }));
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

  const handleSaveCommon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commonForm.name) return;
    setBusy(true);
    try {
      if (editingCommonId) {
        await api.admin.updateDeductionType(editingCommonId, commonForm);
      } else {
        await api.admin.createDeductionType(commonForm);
      }
      setCommonModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to save deduction');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveEmpDeduction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empForm.employeeId || !empForm.deductionName) return;
    setBusy(true);
    try {
      if (editingEmpId) {
        await api.admin.updateEmployeeDeduction(editingEmpId, empForm);
      } else {
        await api.admin.createEmployeeDeduction(empForm);
      }
      setEmpModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to save employee deduction');
    } finally {
      setBusy(false);
    }
  };

  const handleEditCommon = (type: DeductionType) => {
    setEditingCommonId(type.id);
    setCommonForm({
      businessId: type.businessId,
      name: type.name,
      calculationType: type.calculationType,
      value: Number(type.value),
      recurring: type.recurring,
      status: type.status,
    });
    setCommonModalOpen(true);
  };

  const handleEditEmpDeduction = (deduction: EmployeeDeduction & { employeeName: string }) => {
    setEditingEmpId(deduction.id);
    setEmpForm({
      employeeId: deduction.employeeId,
      deductionName: deduction.deductionName,
      amount: Number(deduction.amount),
      payrollPeriodId: deduction.payrollPeriodId || periods[0]?.id || '',
      recurring: deduction.recurring,
      status: deduction.status,
    });
    setEmpModalOpen(true);
  };

  const handleDeleteCommon = async (id: string) => {
    if (!confirm('Delete this recurring deduction policy?')) return;
    try {
      await api.admin.deleteDeductionType(id);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteEmpDeduction = async (id: string) => {
    if (!confirm('Delete this employee deduction?')) return;
    try {
      await api.admin.deleteEmployeeDeduction(id);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleCommonStatus = async (type: DeductionType) => {
    try {
      await api.admin.updateDeductionType(type.id, {
        status: type.status === 'active' ? 'inactive' : 'active',
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
          <h1 className="text-2xl font-bold text-white tracking-tight">Deductions Management</h1>
          <p className="text-sm text-slate-400 mt-1">
            Configure common recurring business deductions (SSS, PhilHealth, Pag-IBIG) and employee-specific deductions.
          </p>
        </div>
        <button
          onClick={() => {
            if (activeTab === 'common') {
              setEditingCommonId(null);
              setCommonForm({
                businessId: 'all',
                name: '',
                calculationType: 'fixed',
                value: 100,
                recurring: true,
                status: 'active',
              });
              setCommonModalOpen(true);
            } else {
              setEditingEmpId(null);
              setEmpForm({
                employeeId: employees[0]?.id || '',
                deductionName: '',
                amount: 500,
                payrollPeriodId: periods[0]?.id || '',
                recurring: false,
                status: 'active',
              });
              setEmpModalOpen(true);
            }
          }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition shadow-lg shadow-blue-600/20"
        >
          <Plus className="w-4 h-4" />
          <span>{activeTab === 'common' ? 'Add Recurring Deduction' : 'Add Employee Deduction'}</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800">
        <button
          onClick={() => setActiveTab('common')}
          className={`py-3 px-5 text-sm font-semibold border-b-2 transition ${
            activeTab === 'common'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Common Recurring Deductions (Business-wide)
        </button>
        <button
          onClick={() => setActiveTab('employee')}
          className={`py-3 px-5 text-sm font-semibold border-b-2 transition ${
            activeTab === 'employee'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Employee-Specific Deductions
        </button>
      </div>

      {/* Content */}
      {activeTab === 'common' ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/80 text-xs font-semibold uppercase text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Deduction Name</th>
                  <th className="py-3 px-4">Applies To</th>
                  <th className="py-3 px-4">Calculation Mode</th>
                  <th className="py-3 px-4">Amount / Percentage</th>
                  <th className="py-3 px-4">Schedule</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      Loading deductions…
                    </td>
                  </tr>
                ) : deductionTypes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      No common deductions created yet.
                    </td>
                  </tr>
                ) : (
                  deductionTypes.map((d) => {
                    const biz = businesses.find((b) => b.id === d.businessId);
                    return (
                      <tr key={d.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4 font-semibold text-white">{d.name}</td>
                        <td className="py-3 px-4 text-xs text-slate-300">
                          {d.businessId === 'all' ? (
                            <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-medium">
                              All Businesses
                            </span>
                          ) : (
                            biz?.name || 'Assigned Business'
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs capitalize text-slate-300">
                          {d.calculationType === 'fixed' ? 'Fixed Amount' : 'Percentage of Gross'}
                        </td>
                        <td className="py-3 px-4 font-semibold text-rose-400">
                          {d.calculationType === 'fixed' ? `₱${d.value.toLocaleString()}` : `${d.value}%`}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-400">
                          {d.recurring ? 'Every Cut-Off' : 'One-time'}
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => handleToggleCommonStatus(d)}
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer transition ${
                              d.status === 'active'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {d.status === 'active' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                            <span className="capitalize">{d.status}</span>
                          </button>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleDeleteCommon(d.id)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-red-400 transition"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/80 text-xs font-semibold uppercase text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Deduction Reason</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Effective Cut-Off</th>
                  <th className="py-3 px-4">Recurrence</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      Loading employee deductions…
                    </td>
                  </tr>
                ) : employeeDeductions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      No employee-specific deductions recorded.
                    </td>
                  </tr>
                ) : (
                  employeeDeductions.map((ed) => {
                    const period = periods.find((p) => p.id === ed.payrollPeriodId);
                    return (
                      <tr key={ed.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4 font-semibold text-white">{ed.employeeName}</td>
                        <td className="py-3 px-4 text-slate-200">{ed.deductionName}</td>
                        <td className="py-3 px-4 font-semibold text-rose-400">
                          ₱{ed.amount.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-400">
                          {ed.recurring ? 'All Periods' : period?.name || 'Current'}
                        </td>
                        <td className="py-3 px-4 text-xs">
                          <span
                            className={`px-2 py-0.5 rounded font-medium ${
                              ed.recurring
                                ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {ed.recurring ? 'Recurring' : 'One-Time'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              ed.status === 'active'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span className="capitalize">{ed.status}</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleEditEmpDeduction(ed)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 transition"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteEmpDeduction(ed.id)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-red-400 transition"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Common Deduction */}
      {commonModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <h3 className="font-semibold text-white">{editingCommonId ? 'Edit Common Deduction' : 'Create Recurring Common Deduction'}</h3>
              <button onClick={() => setCommonModalOpen(false)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCommon} className="p-4 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Deduction Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SSS, PhilHealth, Pag-IBIG, Company Fee"
                  value={commonForm.name}
                  onChange={(e) => setCommonForm({ ...commonForm, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Apply To Business
                </label>
                <select
                  value={commonForm.businessId}
                  onChange={(e) => setCommonForm({ ...commonForm, businessId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="all">All Businesses (Global)</option>
                  {businesses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Calculation Type
                  </label>
                  <select
                    value={commonForm.calculationType}
                    onChange={(e) =>
                      setCommonForm({ ...commonForm, calculationType: e.target.value as any })
                    }
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="fixed">Fixed Amount (₱)</option>
                    <option value="percentage">Percentage (%)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    {commonForm.calculationType === 'fixed' ? 'Amount (₱) *' : 'Percentage (%) *'}
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    step="0.01"
                    value={commonForm.value}
                    onChange={(e) => setCommonForm({ ...commonForm, value: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={commonForm.recurring}
                    onChange={(e) => setCommonForm({ ...commonForm, recurring: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 bg-slate-950 border-slate-700"
                  />
                  <span>Automatically apply on every payroll period</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setCommonModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:text-white bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-60"
                >
                  {busy ? 'Saving…' : editingCommonId ? 'Save Changes' : 'Create Deduction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Employee Deduction */}
      {empModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <h3 className="font-semibold text-white">{editingEmpId ? 'Edit Employee Deduction' : 'Create Employee-Specific Deduction'}</h3>
              <button onClick={() => setEmpModalOpen(false)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEmpDeduction} className="p-4 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Employee *
                </label>
                <select
                  value={empForm.employeeId}
                  onChange={(e) => setEmpForm({ ...empForm, employeeId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName} ({emp.employeeId}) • {emp.businessName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Deduction Description *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cash Advance, Uniform, Emergency Loan"
                  value={empForm.deductionName}
                  onChange={(e) => setEmpForm({ ...empForm, deductionName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Amount (₱) *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={empForm.amount}
                    onChange={(e) => setEmpForm({ ...empForm, amount: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Effective Cut-Off
                  </label>
                  <select
                    disabled={empForm.recurring}
                    value={empForm.payrollPeriodId}
                    onChange={(e) => setEmpForm({ ...empForm, payrollPeriodId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
                  >
                    {periods.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={empForm.recurring}
                    onChange={(e) => setEmpForm({ ...empForm, recurring: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 bg-slate-950 border-slate-700"
                  />
                  <span>Recurring deduction (applies every cut-off until removed)</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEmpModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:text-white bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-60"
                >
                  {busy ? 'Saving…' : editingEmpId ? 'Save Changes' : 'Add Deduction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
