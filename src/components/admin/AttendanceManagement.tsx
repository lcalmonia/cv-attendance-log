import React, { useEffect, useState } from 'react';
import { Clock, Search, AlertCircle, CheckCircle2, XCircle, Plus, Edit2, Trash2, X } from 'lucide-react';
import { AttendanceRecord, Business, PayrollPeriod, AttendanceStatus, Employee, Schedule } from '../../types';
import { api } from '../../services/api';

type Row = AttendanceRecord & { employeeName:string; employeeIdCode:string; businessName:string };
const empty={employeeId:'',date:'',timeIn:'',breakOut:'',breakIn:'',timeOut:'',lateMinutes:'0',totalWorkMinutes:'0',status:'present'};

export const AttendanceManagement: React.FC = () => {
  const [records,setRecords]=useState<Row[]>([]),[businesses,setBusinesses]=useState<Business[]>([]),[periods,setPeriods]=useState<PayrollPeriod[]>([]),[employees,setEmployees]=useState<(Employee & {businessName:string})[]>([]);
  const [selectedPeriodId,setSelectedPeriodId]=useState(''),[selectedBusinessId,setSelectedBusinessId]=useState('all'),[selectedDate,setSelectedDate]=useState(''),[search,setSearch]=useState(''),[loading,setLoading]=useState(true);
  const [modal,setModal]=useState(false),[editId,setEditId]=useState<string|null>(null),[form,setForm]=useState<any>(empty),[schedule,setSchedule]=useState<Schedule|null>(null);
  const [overtimeBusyId,setOvertimeBusyId]=useState<string|null>(null);

  const loadAttendance=async()=>{if(!selectedPeriodId){setRecords([]);return;}setLoading(true);try{const a=await api.admin.getAttendance({periodId:selectedPeriodId,businessId:selectedBusinessId!=='all'?selectedBusinessId:undefined,date:selectedDate||undefined});setRecords(a);}catch(err){console.error(err);setRecords([]);}finally{setLoading(false);}};
  useEffect(()=>{Promise.all([api.admin.getBusinesses(),api.admin.getPeriods(),api.admin.getEmployees()]).then(([b,p,e])=>{setBusinesses(b);setPeriods(p);setEmployees(e);const active=p.find(x=>x.status==='open'||x.status==='for_approval')||p[0];setSelectedPeriodId(active?.id||'');}).catch((err)=>console.error(err));},[]);
  useEffect(()=>{loadAttendance();},[selectedPeriodId,selectedBusinessId,selectedDate]);

  const localValue=(v?:string)=>v?new Date(v).toLocaleTimeString('en-PH',{timeZone:'Asia/Manila',hour:'2-digit',minute:'2-digit',hour12:false}):'';
  const addDays=(date:string,days:number)=>{const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);};
  const timeMinutes=(time:string)=>{const [h,m]=time.split(':').map(Number);return h*60+m;};
  const minutesBetween=(start?:string,end?:string)=>{if(!start||!end)return 0;return Math.max(0,(timeMinutes(end)-timeMinutes(start)+1440)%1440);};
  const scheduleDateTime=(date:string,time?:string,overnightFrom?:string)=>{if(!date||!time)return null;const base=new Date(date+'T'+time+':00+08:00');if(Number.isNaN(base.getTime()))return null;if(overnightFrom&&timeMinutes(time)<timeMinutes(overnightFrom))base.setUTCDate(base.getUTCDate()+1);return base;};
  const buildAttendanceTimes=(dutyDate:string,values:{timeIn?:string;breakOut?:string;breakIn?:string;timeOut?:string})=>{
    const result:{timeIn:string|null;breakOut:string|null;breakIn:string|null;timeOut:string|null}={timeIn:null,breakOut:null,breakIn:null,timeOut:null};
    let currentDate=dutyDate;
    let previousMinutes:number|null=null;
    (['timeIn','breakOut','breakIn','timeOut'] as const).forEach(key=>{
      const value=values[key];
      if(!value)return;
      const minutes=timeMinutes(value);
      if(previousMinutes!==null&&minutes<previousMinutes)currentDate=addDays(currentDate,1);
      result[key]=new Date(currentDate+'T'+value+':00+08:00').toISOString();
      previousMinutes=minutes;
    });
    return result;
  };
  useEffect(()=>{if(!modal||!selectedPeriodId||!form.employeeId||!form.date){setSchedule(null);return;}api.admin.getSchedules(selectedPeriodId,form.employeeId).then(list=>setSchedule(list.find(s=>s.date===form.date)||null)).catch(()=>setSchedule(null));},[modal,selectedPeriodId,form.employeeId,form.date]);
  const preview=(()=>{
    if(!schedule)return null;
    const actualDateTimes=buildAttendanceTimes(form.date||'',form);
    const requiredIn=schedule.requiredTimeIn?scheduleDateTime(form.date,schedule.requiredTimeIn):null;
    const requiredOut=schedule.requiredTimeOut?scheduleDateTime(form.date,schedule.requiredTimeOut,schedule.requiredTimeIn):null;
    const actualIn=actualDateTimes.timeIn?new Date(actualDateTimes.timeIn):null;
    const actualOut=actualDateTimes.timeOut?new Date(actualDateTimes.timeOut):null;
    const requiredBreak=minutesBetween(schedule.breakOut,schedule.breakIn);
    const actualBreak=form.breakOut&&form.breakIn?minutesBetween(form.breakOut,form.breakIn):0;

    // Always deduct the scheduled/required break. If the employee takes no
    // break or takes a shorter break, the full required break is still deducted.
    // If the employee takes a longer break, deduct the actual longer break.
    const effectiveBreak=Math.max(requiredBreak,actualBreak);
    const overbreak=Math.max(0,actualBreak-requiredBreak);
    const undertime=requiredOut&&actualOut
      ?Math.max(0,Math.round((requiredOut.getTime()-actualOut.getTime())/60000))
      :0;
    const late=actualIn&&requiredIn
      ?Math.max(0,Math.round((actualIn.getTime()-requiredIn.getTime())/60000))
      :0;

    // Early arrival does not add work time. Work starts at the scheduled
    // Time In when the employee arrived early; otherwise it starts at actual
    // Time In. This mirrors the backend calculation exactly.
    const effectiveStart=actualIn&&requiredIn
      ?(actualIn<requiredIn?requiredIn:actualIn)
      :actualIn;
    const elapsed=effectiveStart&&actualOut
      ?Math.max(0,Math.round((actualOut.getTime()-effectiveStart.getTime())/60000))
      :0;
    const work=Math.max(0,elapsed-effectiveBreak);

    const outDiff=requiredOut&&actualOut
      ?Math.max(0,Math.round((actualOut.getTime()-requiredOut.getTime())/60000))
      :0;
    const overtime=outDiff>30?outDiff:0;

    return {
      late,
      overbreak,
      undertime,
      work,
      overtime,
      requiredBreak,
      status:!form.timeIn?'absent':work<60&&form.timeOut?'invalid':late>0?'late':'present'
    };
  })();
  const save=async(e:React.FormEvent)=>{e.preventDefault();try{const selectedPeriod=periods.find(p=>p.id===selectedPeriodId);if(!selectedPeriod)throw new Error('Please select a payroll cut-off period.');if(form.date<selectedPeriod.startDate||form.date>selectedPeriod.endDate)throw new Error('The attendance date must be within the selected payroll cut-off period.');const times=buildAttendanceTimes(form.date,form);const payload={employeeId:form.employeeId,date:form.date,payrollPeriodId:selectedPeriodId,...times};if(editId)await api.admin.updateAttendance(editId,payload);else await api.admin.addAttendance(payload);setModal(false);await loadAttendance();}catch(err:any){alert(err.message||'Unable to save attendance.')}};
  const setOvertimeApproval = async (record: Row, status: 'approved' | 'rejected') => {
    if ((record.overtimeMinutes || 0) <= 0) return;
    const action = status === 'approved' ? 'approve' : 'reject';
    if (!confirm(`${action === 'approve' ? 'Approve' : 'Reject'} ${record.overtimeMinutes} minute(s) of overtime for ${record.employeeName} on ${record.date}?`)) return;
    setOvertimeBusyId(record.id);
    try {
      await api.admin.setOvertimeApproval(record.id, status);
      await loadAttendance();
    } catch (err:any) {
      alert(err.message || 'Unable to update overtime approval.');
    } finally {
      setOvertimeBusyId(null);
    }
  };

  const deleteAttendance = async (record: Row) => {
    if (!confirm(`Delete the attendance record for ${record.employeeName} on ${record.date}? This action cannot be undone.`)) return;
    try {
      await api.admin.deleteAttendance(record.id);
      await loadAttendance();
    } catch (err:any) {
      alert(err.message || 'Unable to delete attendance.');
    }
  };
  const badge=(s:AttendanceStatus)=>s==='present'?<span className="text-emerald-400"><CheckCircle2 className="inline w-3.5 h-3.5"/> Present</span>:s==='late'?<span className="text-amber-400"><Clock className="inline w-3.5 h-3.5"/> Late</span>:s==='absent'?<span className="text-red-400"><XCircle className="inline w-3.5 h-3.5"/> Absent</span>:s==='invalid'?<span className="text-red-400"><AlertCircle className="inline w-3.5 h-3.5"/> Invalid</span>:<span className="text-slate-400"><AlertCircle className="inline w-3.5 h-3.5"/> Incomplete</span>;
  const filtered=records.filter(r=>r.employeeName.toLowerCase().includes(search.toLowerCase())||r.employeeIdCode.toLowerCase().includes(search.toLowerCase()));
  const input="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white";
  return <div className="space-y-6">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div><h1 className="text-2xl font-bold text-white">Attendance Logs</h1><p className="text-sm text-slate-400 mt-1">Review, add, and correct employee attendance records.</p></div><button onClick={()=>{setEditId(null);setForm({...empty,employeeId:employees[0]?.id||'',date:new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Manila'})});setModal(true)}} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium"><Plus className="w-4 h-4"/> Add Attendance</button></div>
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <div><label className="block text-xs text-slate-400 mb-1">Search Employee</label><div className="relative"><Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5"/><input className={input+" pl-9"} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name or ID"/></div></div>
      <div><label className="block text-xs text-slate-400 mb-1">Business</label><select className={input} value={selectedBusinessId} onChange={e=>setSelectedBusinessId(e.target.value)}><option value="all">All Businesses</option>{businesses.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
      <div><label className="block text-xs text-slate-400 mb-1">Payroll Cut-Off Period</label><select required className={input} value={selectedPeriodId} onChange={e=>{setSelectedPeriodId(e.target.value);setSelectedDate('')}}><option value="" disabled>Select a cut-off period</option>{periods.map(p=><option key={p.id} value={p.id}>{p.name} ({p.startDate} to {p.endDate})</option>)}</select></div>
      <div><label className="block text-xs text-slate-400 mb-1">Date</label><input type="date" className={input} value={selectedDate} onChange={e=>setSelectedDate(e.target.value)}/></div>
    </div>
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-left text-sm text-slate-300"><thead className="bg-slate-950/80 text-xs uppercase text-slate-400"><tr>{['Date','Employee','Business','Time In','Break','Time Out','Late','Overbreak','Undertime','OT','OT Approval','Hours','Status',''].map(h=><th key={h} className="py-3 px-4">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-800/80">{loading?<tr><td colSpan={12} className="py-8 text-center text-slate-500">Loading…</td></tr>:filtered.length===0?<tr><td colSpan={12} className="py-8 text-center text-slate-500">No attendance logs found.</td></tr>:filtered.map(a=><tr key={a.id} className="hover:bg-slate-800/40"><td className="py-3 px-4 font-mono text-white">{a.date}</td><td className="py-3 px-4"><div className="font-semibold text-white">{a.employeeName}</div><div className="text-xs text-slate-500">{a.employeeIdCode}</div></td><td className="py-3 px-4 text-xs">{a.businessName}</td><td className="py-3 px-4 font-mono text-xs">{a.timeIn?new Date(a.timeIn).toLocaleTimeString('en-PH',{timeZone:'Asia/Manila',hour:'2-digit',minute:'2-digit'}):'—'}</td><td className="py-3 px-4 font-mono text-xs">{a.breakOut?new Date(a.breakOut).toLocaleTimeString('en-PH',{timeZone:'Asia/Manila',hour:'2-digit',minute:'2-digit'}):'—'}{a.breakIn?' – '+new Date(a.breakIn).toLocaleTimeString('en-PH',{timeZone:'Asia/Manila',hour:'2-digit',minute:'2-digit'}):''}</td><td className="py-3 px-4 font-mono text-xs">{a.timeOut?new Date(a.timeOut).toLocaleTimeString('en-PH',{timeZone:'Asia/Manila',hour:'2-digit',minute:'2-digit'}):'—'}</td><td className="py-3 px-4 text-xs">{(a.lateMinutes||0)>0?<span className="font-semibold text-amber-400">{a.lateMinutes} min</span>:<span className="text-slate-500">0</span>}</td><td className="py-3 px-4 text-xs">{(a.overbreakMinutes||0)>0?<span className="font-semibold text-orange-400">{a.overbreakMinutes} min</span>:<span className="text-slate-500">0</span>}</td><td className="py-3 px-4 text-xs">{(a.undertimeMinutes||0)>0?<span className="font-semibold text-rose-400">{a.undertimeMinutes} min</span>:<span className="text-slate-500">0</span>}</td><td className="py-3 px-4 text-xs">{(a.overtimeMinutes||0)>0?<span className="font-semibold text-cyan-400">{a.overtimeMinutes} min</span>:<span className="text-slate-500">0 min</span>}</td>
<td className="py-3 px-4 text-xs min-w-[170px]">
  {(a.overtimeMinutes||0)<=0
    ? <span className="text-slate-500">Not required</span>
    : a.overtimeApprovalStatus==='approved'
      ? <span className="font-semibold text-emerald-400">Approved</span>
      : a.overtimeApprovalStatus==='rejected'
        ? <div className="space-y-1"><span className="font-semibold text-red-400">Rejected</span><div><button disabled={overtimeBusyId===a.id} onClick={()=>setOvertimeApproval(a,'approved')} className="text-[11px] text-emerald-400 hover:text-emerald-300 disabled:opacity-50">Approve again</button></div></div>
        : <div className="space-y-1"><span className="font-semibold text-amber-400">Pending</span><div className="flex gap-2"><button disabled={overtimeBusyId===a.id} onClick={()=>setOvertimeApproval(a,'approved')} className="text-[11px] text-emerald-400 hover:text-emerald-300 disabled:opacity-50">Approve</button><button disabled={overtimeBusyId===a.id} onClick={()=>setOvertimeApproval(a,'rejected')} className="text-[11px] text-red-400 hover:text-red-300 disabled:opacity-50">Reject</button></div></div>}
</td>
<td className="py-3 px-4 text-xs">{a.totalWorkMinutes>0?((a.totalWorkMinutes/60).toFixed(2).replace(/0+$/,'').replace(/\.$/,''))+' hrs':'—'}</td><td className="py-3 px-4 text-xs">{badge(a.status)}</td><td className="py-3 px-4 text-right"><button onClick={()=>{setEditId(a.id);setForm({employeeId:a.employeeId,date:a.date,timeIn:localValue(a.timeIn),breakOut:localValue(a.breakOut),breakIn:localValue(a.breakIn),timeOut:localValue(a.timeOut),lateMinutes:String(a.lateMinutes||0),totalWorkMinutes:String(a.totalWorkMinutes||0),status:a.status});setModal(true)}} className="p-2 text-blue-400 hover:text-blue-300"><Edit2 className="w-4 h-4"/></button><button onClick={()=>deleteAttendance(a)} className="p-2 text-red-400 hover:text-red-300" title="Delete"><Trash2 className="w-4 h-4"/></button></td></tr>)}</tbody></table></div></div>
    {modal&&<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80"><div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-xl shadow-2xl"><div className="flex items-center justify-between p-4 border-b border-slate-800"><h2 className="font-semibold text-white">{editId?'Edit Attendance':'Add Attendance'}</h2><button onClick={()=>setModal(false)}><X className="w-5 h-5 text-slate-400"/></button></div><form onSubmit={save} className="p-4 space-y-3">
      {!editId&&<div><label className="block text-xs text-slate-400 mb-1">Employee</label><select required className={input} value={form.employeeId} onChange={e=>setForm({...form,employeeId:e.target.value})}>{employees.map(e=><option key={e.id} value={e.id}>{e.fullName} ({e.employeeId})</option>)}</select></div>}
      <div><label className="block text-xs text-slate-400 mb-1">Duty Date</label><input required type="date" className={input} value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></div>
      <div className="rounded-lg bg-slate-950/70 border border-slate-800 px-3 py-2 text-xs text-slate-400">
        {schedule?.isWorkingDay
          ? <>Scheduled duty: <span className="font-semibold text-slate-200">{schedule.requiredTimeIn} – {schedule.requiredTimeOut}</span>{schedule.breakOut&&schedule.breakIn?<><span className="mx-2 text-slate-600">•</span>Required break: <span className="font-semibold text-slate-200">{schedule.breakOut} – {schedule.breakIn} ({minutesBetween(schedule.breakOut,schedule.breakIn)} min)</span></>:<span className="ml-2 text-amber-400">• No required break is configured for this schedule</span>}</>
          : 'No working schedule found for this date.'}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {([['timeIn','Time In'],['breakOut','Break Out'],['breakIn','Break In'],['timeOut','Time Out']] as const).map(([key,label])=>(
          <div key={key}>
            <label className="block text-xs text-slate-400 mb-1">{label}</label>
            <input
              type="time"
              className={input}
              value={form[key] || ''}
              onChange={e=>setForm({...form,[key]:e.target.value})}
            />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3"><div><label className="block text-xs text-slate-400 mb-1">Late Minutes</label><div className={input+" opacity-80"}>{preview?preview.late:0}</div></div><div><label className="block text-xs text-slate-400 mb-1">Overbreak</label><div className={input+" opacity-80"}>{preview?preview.overbreak:0} min</div></div><div><label className="block text-xs text-slate-400 mb-1">Undertime</label><div className={input+" opacity-80"}>{preview?preview.undertime:0} min</div></div><div><label className="block text-xs text-slate-400 mb-1">Work Hours</label><div className={input+" opacity-80"}>{preview?(preview.work/60).toFixed(2):'0.00'}</div></div><div><label className="block text-xs text-slate-400 mb-1">Overtime</label><div className={input+" opacity-80"}>{preview?preview.overtime:0} min</div></div></div>
      <p className="text-xs text-slate-500">Calculations use the employee's scheduled duty times. Overtime is excluded from payroll until a Super Admin approves it.  Early arrival does not add work hours; credited work starts at the scheduled Time In. The required scheduled break is always deducted when there is no break or the actual break is shorter. Any break time beyond the required break is Overbreak and is deducted from Work Hours. Leaving before the scheduled Time Out is Undertime and reduces credited Work Hours. Overtime counts only when it exceeds 30 minutes.</p>
      <div className="flex justify-end gap-2 pt-3 border-t border-slate-800"><button type="button" onClick={()=>setModal(false)} className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300">Cancel</button><button className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium">{editId?'Save Changes':'Add Attendance'}</button></div>
    </form></div></div>}
  </div>;
};
