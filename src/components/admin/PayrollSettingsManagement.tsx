import React, { useEffect, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { Business, Holiday, PayrollSettings } from '../../types';
import { api } from '../../services/api';

export const PayrollSettingsManagement: React.FC = () => {
  const [businesses,setBusinesses]=useState<Business[]>([]);
  const [businessId,setBusinessId]=useState('all');
  const [settings,setSettings]=useState<PayrollSettings>({businessId:'all',nightDifferentialMultiplier:1,regularOvertimeMultiplier:1,holidays:[]});
  const [nightMultiplier,setNightMultiplier]=useState('1.00');
  const [regularOtMultiplier,setRegularOtMultiplier]=useState('1.00');
  const [holiday,setHoliday]=useState({holidayDate:'',name:'',holidayType:'regular',overtimeRate:'1.00',businessId:'all'});
  const [loading,setLoading]=useState(true);

  const loadSettings=async()=>{setLoading(true);try{const s=await api.admin.getSettings(businessId);setSettings(s);setNightMultiplier(String(s.nightDifferentialMultiplier));setRegularOtMultiplier(String(s.regularOvertimeMultiplier));}finally{setLoading(false);}};
  useEffect(()=>{api.admin.getBusinesses().then(setBusinesses).catch(console.error);},[]);
  useEffect(()=>{loadSettings();},[businessId]);

  const save=async()=>{const ndMultiplier=Number(nightMultiplier),otMultiplier=Number(regularOtMultiplier);if(!Number.isFinite(ndMultiplier)||ndMultiplier<0||!Number.isFinite(otMultiplier)||otMultiplier<0){alert('Payroll multipliers must be valid non-negative numbers.');return;}await api.admin.updateSettings({businessId,nightDifferentialMultiplier:ndMultiplier,regularOvertimeMultiplier:otMultiplier});await loadSettings();alert('Payroll settings saved.');};
  const addHoliday=async(e:React.FormEvent)=>{e.preventDefault();await api.admin.createHoliday({...holiday,businessId});setHoliday({holidayDate:'',name:'',holidayType:'regular',overtimeRate:'1.00',businessId});await loadSettings();};
  const remove=async(id:string)=>{if(!confirm('Delete this holiday?'))return;await api.admin.deleteHoliday(id);await loadSettings();};

  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold text-white">Payroll Settings</h1><p className="text-sm text-slate-400 mt-1">Configure regular overtime and night differential rates, plus holiday overtime rules.</p></div>
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5">
      <div><label className="block text-xs font-medium text-slate-400 mb-1">Business</label><select value={businessId} onChange={e=>setBusinessId(e.target.value)} className="w-full sm:max-w-md bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"><option value="all">All Businesses</option>{businesses.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end"><div className="sm:col-span-2 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400">Night Differential hourly rate is automatically calculated per employee from <span className="text-slate-200 font-medium">Daily Rate ÷ Required Hours/Day</span>. Only the multiplier is configured here.</div><div><label className="block text-xs font-medium text-slate-400 mb-1">Night Differential Multiplier</label><input type="number" min="0" step="0.01" value={nightMultiplier} onChange={e=>setNightMultiplier(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"/><p className="text-[11px] text-slate-500 mt-1">ND hours × hourly rate × multiplier</p></div><div><label className="block text-xs font-medium text-slate-400 mb-1">Regular Overtime Multiplier</label><input type="number" min="0" step="0.01" value={regularOtMultiplier} onChange={e=>setRegularOtMultiplier(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white"/><p className="text-[11px] text-slate-500 mt-1">OT hours × hourly rate × multiplier</p></div><button onClick={save} disabled={loading} className="sm:col-span-3 justify-self-start inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium"><Save className="w-4 h-4"/>Save Payroll Rates</button></div>
    </div>
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <h2 className="font-semibold text-white mb-4">Holiday Dates & Overtime Rates</h2>
      <form onSubmit={addHoliday} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
        <div><label className="block text-xs text-slate-400 mb-1">Date</label><input required type="date" value={holiday.holidayDate} onChange={e=>setHoliday({...holiday,holidayDate:e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"/></div>
        <div><label className="block text-xs text-slate-400 mb-1">Holiday Name</label><input required value={holiday.name} onChange={e=>setHoliday({...holiday,name:e.target.value})} placeholder="e.g. Christmas Day" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"/></div>
        <div><label className="block text-xs text-slate-400 mb-1">Type</label><select value={holiday.holidayType} onChange={e=>setHoliday({...holiday,holidayType:e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"><option value="regular">Regular Holiday</option><option value="special_non_working">Special Non-Working</option><option value="special_working">Special Working</option></select></div>
        <div><label className="block text-xs text-slate-400 mb-1">OT Rate Multiplier</label><input required type="number" min="0" step="0.01" value={holiday.overtimeRate} onChange={e=>setHoliday({...holiday,overtimeRate:e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white"/></div>
        <button className="inline-flex justify-center items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium"><Plus className="w-4 h-4"/>Add Holiday</button>
      </form>
      <div className="mt-5 overflow-x-auto"><table className="w-full text-sm text-slate-300"><thead><tr className="border-b border-slate-800 text-xs uppercase text-slate-500"><th className="text-left py-2">Date</th><th className="text-left py-2">Holiday</th><th className="text-left py-2">Type</th><th className="text-left py-2">OT Rate</th><th></th></tr></thead><tbody>{settings.holidays.map((h:Holiday)=><tr key={h.id} className="border-b border-slate-800/60"><td className="py-2">{h.holidayDate}</td><td className="py-2">{h.name}</td><td className="py-2">{h.holidayType.replaceAll('_',' ')}</td><td className="py-2">{h.overtimeRate}×</td><td className="py-2 text-right"><button onClick={()=>remove(h.id)} className="p-2 text-red-400 hover:text-red-300"><Trash2 className="w-4 h-4"/></button></td></tr>)}{settings.holidays.length===0&&<tr><td colSpan={5} className="py-6 text-center text-slate-500">No holidays configured.</td></tr>}</tbody></table></div>
    </div>
  </div>;
};
