
import React, { useState, useMemo, useEffect } from 'react';
import { 
  ShieldCheck, Users, Box, Send, Activity, 
  Settings2, BarChart3, Layers, UserPlus, 
  AlertCircle, CheckCircle2, Clock, Search, 
  Target, Filter, Zap, MessageSquare, Briefcase,
  MonitorPlay, Fingerprint, Award, TrendingUp,
  Mail, BellRing, UserCheck, ShieldAlert, Info,
  Timer, Gauge, FileSpreadsheet, History,
  ArrowRightLeft, UserMinus, UserX, CheckCircle,
  PackageSearch, Unlock, ShieldX, Ghost, Scan,
  UserCog, LogOut, ToggleLeft, ToggleRight,
  Radio, CalendarPlus, AlertOctagon, RefreshCw,
  Plus, X, Check, Navigation, Megaphone,
  Bell, Command, Shield, RefreshCcw, ArrowRight, UserCircle
} from 'lucide-react';
import { User, DeliveryLog, Student, UserRole, SystemConfig, Absence, Supervision } from '../../types';
import { ROLES_ARABIC } from '../../constants';
import { supabase, db, getActiveTenantId } from '../../supabase';

interface ControlManagerProps {
  users: User[];
  deliveryLogs: DeliveryLog[];
  students: Student[];
  onBroadcast: (msg: string, target: UserRole | 'ALL') => void;
  onUpdateUserGrades: (userId: string, grades: string[]) => void;
  onUpdateUserCommittees: (userId: string, committees: string[]) => void;
  systemConfig: SystemConfig & { allow_manual_join?: boolean, active_exam_date?: string };
  absences: Absence[];
  supervisions: Supervision[];
  setDeliveryLogs: (log: DeliveryLog) => Promise<void>;
  setSystemConfig: (cfg: any) => Promise<void>;
  onRemoveSupervision: (teacherId: string) => Promise<void>;
  onAssignProctor: (teacherId: string, committeeNumber: string) => Promise<void>;
}

const ControlManager: React.FC<ControlManagerProps> = ({ 
  users, deliveryLogs, students, onBroadcast, onUpdateUserGrades, onUpdateUserCommittees, systemConfig, absences, supervisions, setDeliveryLogs, setSystemConfig, onRemoveSupervision, onAssignProctor
}) => {
  const [activeTab, setActiveTab] = useState<'cockpit' | 'assignments' | 'emergency-receipt' | 'comms' | 'proctors-mgmt'>('cockpit');
  const [broadcastTarget, setBroadcastTarget] = useState<UserRole | 'ALL'>('ALL');
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [assignmentSearch, setAssignmentSearch] = useState('');
  
  // States for Assigning/Swapping
  const [isAssigning, setIsAssigning] = useState(false);
  const [targetCommittee, setTargetCommittee] = useState<string | null>(null);
  const [proctorSearchInModal, setProctorSearchInModal] = useState('');

  const stats = useMemo(() => {
    const totalComs = new Set(students.map(s => s.committee_number)).size;
    const confirmed = deliveryLogs.filter(l => l.status === 'CONFIRMED').length;
    return {
      total: totalComs,
      confirmed,
      absentTotal: absences.filter(a => a.type === 'ABSENT').length,
      progress: Math.round((confirmed / totalComs) * 100) || 0
    };
  }, [students, deliveryLogs, absences]);

  const committeeStatus = useMemo(() => {
    const comNums = Array.from(new Set(students.map(s => s.committee_number))).filter(Boolean).sort((a,b)=>Number(a)-Number(b));
    return comNums.map(num => {
      const sv = supervisions.find(s => s.committee_number === num);
      const user = users.find(u => u.id === sv?.teacher_id);
      const gradesInCommittee = Array.from(new Set(students.filter(s => s.committee_number === num).map(s => s.grade)));
      return { num, proctor: user, svId: sv?.id, grades: gradesInCommittee };
    });
  }, [students, supervisions, users]);

  const availableProctors = useMemo(() => {
    const activeTeacherIds = supervisions.map(s => s.teacher_id);
    return users.filter(u => u.role === 'PROCTOR' && !activeTeacherIds.includes(u.id));
  }, [users, supervisions]);

  const proctorsListForModal = useMemo(() => {
    return users.filter(u => u.role === 'PROCTOR' && (u.full_name.includes(proctorSearchInModal) || u.national_id.includes(proctorSearchInModal)));
  }, [users, proctorSearchInModal]);

  const handleStartNewDay = async () => {
    const today = new Date().toISOString().split('T')[0];
    if (!confirm(`بدء يوم جديد سيقوم بتصفير اللجان لليوم (${today}). هل أنت متأكد؟`)) return;
    setIsResetting(true);
    try {
      let resetQuery = supabase.from('supervision').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      const tenantId = getActiveTenantId();
      if (tenantId) resetQuery = resetQuery.eq('tenant_id', tenantId);
      await resetQuery;
      await setSystemConfig({ ...systemConfig, active_exam_date: today });
      onBroadcast(`تم تفعيل يوم الاختبار الجديد (${today}). يرجى المباشرة فوراً.`, 'ALL');
      window.location.reload();
    } catch (err: any) { alert(err.message); } finally { setIsResetting(false); }
  };

  return (
    <div className="space-y-8 animate-fade-in text-right pb-32">
      {/* Header */}
      <div className="bg-slate-950 rounded-[4rem] p-10 text-white relative overflow-hidden shadow-2xl border-b-8 border-blue-600">
         <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 blur-[150px] rounded-full -mr-48 -mt-48"></div>
         <div className="relative z-10 flex flex-col lg:flex-row justify-between items-center gap-10">
            <div className="flex items-center gap-6">
               <div className="bg-blue-600 p-5 rounded-3xl shadow-2xl ring-4 ring-blue-500/20"><Gauge size={40} /></div>
               <div>
                  <h2 className="text-4xl md:text-5xl font-black tracking-tighter">مركز القيادة الاستراتيجي</h2>
                  <div className="flex items-center gap-3 mt-2">
                     <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${systemConfig.active_exam_date === new Date().toISOString().split('T')[0] ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white animate-pulse'}`}>
                        اليوم النشط: {systemConfig.active_exam_date}
                     </span>
                  </div>
               </div>
            </div>
            <button onClick={handleStartNewDay} disabled={isResetting} className="bg-white text-slate-950 px-8 py-5 rounded-[2rem] font-black text-lg flex items-center gap-4 shadow-2xl hover:bg-blue-50 transition-all active:scale-95 disabled:opacity-50">
               {isResetting ? <RefreshCw className="animate-spin" /> : <CalendarPlus size={28} className="text-blue-600" />}
               بدء يوم عمل جديد
            </button>
         </div>
      </div>

      {/* Tabs */}
      <div className="flex justify-center overflow-x-auto pb-4 custom-scrollbar">
         <div className="bg-white p-2 rounded-[2.5rem] shadow-xl border flex gap-2 w-full max-w-6xl shrink-0">
            {[
              {id: 'cockpit', label: 'الرؤية العامة', icon: MonitorPlay},
              {id: 'assignments', label: 'إسناد الصلاحيات', icon: Layers},
              {id: 'proctors-mgmt', label: 'إدارة المراقبين', icon: UserCog},
              {id: 'emergency-receipt', label: 'استلام طوارئ', icon: ShieldAlert},
              {id: 'comms', label: 'البث الإعلامي', icon: Megaphone},
            ].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex-1 py-4 px-6 rounded-[1.8rem] font-black text-xs flex items-center justify-center gap-3 transition-all ${activeTab === tab.id ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-50'}`}>
                <tab.icon size={18} />
                <span className="whitespace-nowrap">{tab.label}</span>
              </button>
            ))}
         </div>
      </div>

      {/* Proctor Management Tab - Enhanced with Replacement System */}
      {activeTab === 'proctors-mgmt' && (
        <div className="space-y-8 animate-slide-up">
           <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              <div className="lg:col-span-1 bg-slate-950 p-8 rounded-[3.5rem] text-white shadow-2xl border-b-8 border-emerald-500 overflow-hidden relative">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-3xl"></div>
                 <h3 className="text-xl font-black mb-6 flex items-center gap-3 text-emerald-400"><UserCheck size={24}/> المتاحون للإحلال ({availableProctors.length})</h3>
                 <div className="space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
                    {availableProctors.map(u => (
                       <div key={u.id} className="p-4 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between group hover:bg-white/10 transition-all">
                          <div className="text-right">
                             <p className="font-black text-sm">{u.full_name}</p>
                             <p className="text-[10px] text-emerald-400 font-black uppercase tracking-tighter">جاهز للاستبدال</p>
                          </div>
                          <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center"><UserCircle size={20}/></div>
                       </div>
                    ))}
                 </div>
              </div>

              <div className="lg:col-span-3 space-y-6">
                 <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4">
                       <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl"><RefreshCcw size={28} /></div>
                       <h3 className="text-2xl font-black text-slate-800 tracking-tight">نظام تبديل وإحلال المراقبين الذكي</h3>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 max-w-xs text-center md:text-right">يسمح هذا النظام بإجراء تبديل فوري في حال خروج مراقب لظرف طارئ مع الحفاظ على البيانات.</p>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {committeeStatus.map(com => (
                      <div key={com.num} className={`bg-white p-8 rounded-[3.5rem] border-2 shadow-xl transition-all relative group overflow-hidden ${com.proctor ? 'border-slate-50' : 'border-red-100 bg-red-50/10'}`}>
                         <div className="flex justify-between items-start mb-6">
                            <div className="bg-slate-950 text-white w-16 h-16 rounded-2xl flex flex-col items-center justify-center font-black">
                               <span className="text-[8px] opacity-40 mb-1">لجنة</span>
                               <span className="text-3xl leading-none">{com.num}</span>
                            </div>
                            {com.proctor ? (
                               <div className="bg-blue-600 text-white px-4 py-1.5 rounded-xl text-[10px] font-black uppercase shadow-lg">نشطة ميدانياً</div>
                            ) : (
                               <div className="bg-red-600 text-white px-4 py-1.5 rounded-xl text-[10px] font-black uppercase animate-pulse shadow-xl">تحتاج بديل فوراً</div>
                            )}
                         </div>

                         <div className="mb-8 min-h-[60px] flex items-center">
                            {com.proctor ? (
                               <div className="flex items-center gap-4 w-full">
                                  <div className="w-14 h-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-2xl ring-4 ring-slate-50"><UserCheck size={32}/></div>
                                  <div className="min-w-0 flex-1">
                                     <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">المراقب المكلف</p>
                                     <h4 className="text-lg font-black text-slate-900 truncate leading-tight">{com.proctor.full_name}</h4>
                                  </div>
                               </div>
                            ) : (
                               <div className="w-full py-4 text-center border-2 border-dashed border-red-200 rounded-2xl text-red-300 font-bold italic text-sm">شاغرة - بانتظار إحلال بديل</div>
                            )}
                         </div>

                         <div className="grid grid-cols-1">
                            <button 
                              onClick={() => { setTargetCommittee(com.num); setIsAssigning(true); }}
                              className={`w-full py-5 rounded-2xl font-black text-sm flex items-center justify-center gap-3 transition-all shadow-xl active:scale-95 ${com.proctor ? 'bg-slate-950 text-white hover:bg-blue-600 shadow-blue-200' : 'bg-red-600 text-white hover:bg-red-700 shadow-red-200 animate-bounce-subtle'}`}
                            >
                               {com.proctor ? <><ArrowRightLeft size={20}/> إجراء استبدال طارئ</> : <><Plus size={20}/> تعيين بديل فوري</>}
                            </button>
                         </div>
                      </div>
                    ))}
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Assignment/Replacement Modal */}
      {isAssigning && targetCommittee && (
         <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 animate-fade-in no-print overflow-y-auto">
            <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-2xl" onClick={() => setIsAssigning(false)}></div>
            <div className="bg-white w-full max-w-2xl rounded-[4rem] shadow-2xl relative z-10 overflow-hidden border-b-[15px] border-blue-600 animate-slide-up my-auto">
               <div className="bg-slate-950 p-10 text-white flex justify-between items-center relative">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/20 blur-3xl rounded-full"></div>
                  <div className="flex items-center gap-6 relative z-10">
                     <div className="w-20 h-20 bg-blue-600 text-white rounded-3xl flex flex-col items-center justify-center font-black shadow-xl">
                        <span className="text-[10px] opacity-50 mb-1">لجنة</span>
                        <span className="text-4xl leading-none">{targetCommittee}</span>
                     </div>
                     <div>
                        <h3 className="text-3xl font-black tracking-tight italic">وحدة الإحلال السريع</h3>
                        <p className="text-blue-400 text-[10px] font-black uppercase mt-1">Smart Replacement Unit</p>
                     </div>
                  </div>
                  <button onClick={() => setIsAssigning(false)} className="bg-white/10 p-3 rounded-full hover:bg-white/20 transition-all"><X size={32}/></button>
               </div>

               <div className="p-8 space-y-6">
                  <div className="relative">
                     <Search size={22} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400" />
                     <input 
                        type="text" 
                        placeholder="ابحث عن اسم المعلم البديل..." 
                        className="w-full pr-14 py-5 bg-slate-50 border-2 border-slate-100 rounded-[2rem] font-black text-lg outline-none focus:border-blue-600 shadow-inner"
                        value={proctorSearchInModal}
                        onChange={e => setProctorSearchInModal(e.target.value)}
                     />
                  </div>

                  <div className="max-h-[400px] overflow-y-auto custom-scrollbar space-y-3 px-2">
                     {proctorsListForModal.map(u => {
                        const currentSv = supervisions.find(s => s.teacher_id === u.id);
                        const isCurrentInThisCom = currentSv?.committee_number === targetCommittee;
                        
                        return (
                           <button 
                             key={u.id} 
                             disabled={isCurrentInThisCom}
                             onClick={async () => {
                                if (confirm(`هل ترغب في تعيين (${u.full_name}) كبديل في اللجنة (${targetCommittee})؟`)) {
                                   await onAssignProctor(u.id, targetCommittee);
                                   setIsAssigning(false);
                                }
                             }}
                             className={`w-full p-6 rounded-[2.5rem] border-2 transition-all flex items-center justify-between group hover:shadow-2xl ${isCurrentInThisCom ? 'opacity-30 border-slate-100 bg-slate-50 grayscale' : 'border-slate-50 bg-slate-50 hover:border-blue-200 hover:bg-white'}`}
                           >
                              <div className="flex items-center gap-6">
                                 <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ${currentSv ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                    {currentSv ? <ArrowRightLeft size={28}/> : <UserCheck size={28}/>}
                                 </div>
                                 <div className="text-right">
                                    <p className="font-black text-xl text-slate-800 leading-none mb-1">{u.full_name}</p>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                       {currentSv ? `سيتم نقله من لجنة ${currentSv.committee_number}` : 'مراقب احتياط جاهز للبدء'}
                                    </p>
                                 </div>
                              </div>
                              <CheckCircle className="text-blue-600 opacity-0 group-hover:opacity-100 transition-all" size={32}/>
                           </button>
                        );
                     })}
                  </div>
               </div>
            </div>
         </div>
      )}

      {/* Cockpit - Overview */}
      {activeTab === 'cockpit' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 animate-slide-up">
           <div className="xl:col-span-2 space-y-6">
              <div className="bg-white p-10 rounded-[3.5rem] border shadow-sm">
                 <div className="flex justify-between items-center mb-8">
                    <h3 className="text-2xl font-black flex items-center gap-3 text-slate-800"><Radio size={24} className="text-blue-600"/> مصفوفة اللجان الحية</h3>
                    <div className="flex gap-4 text-[10px] font-black text-slate-400">
                       <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-600 shadow-sm shadow-blue-200"></div> نشطة</span>
                       <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-slate-200 shadow-sm shadow-slate-200"></div> شاغرة</span>
                    </div>
                 </div>
                 <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-10 gap-3">
                    {committeeStatus.map(com => (
                      <div key={com.num} className={`aspect-square rounded-2xl flex flex-col items-center justify-center border-2 transition-all ${com.proctor ? 'bg-blue-600 border-blue-500 text-white shadow-lg scale-105' : 'bg-slate-50 border-slate-100 opacity-40'}`}>
                         <span className="text-[8px] font-black uppercase opacity-60">لجنة</span>
                         <span className="text-2xl font-black">{com.num}</span>
                      </div>
                    ))}
                 </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="bg-white p-8 rounded-[3rem] border shadow-sm flex items-center gap-6 group hover:scale-[1.02] transition-all">
                    <div className="bg-emerald-50 text-emerald-600 p-4 rounded-2xl group-hover:rotate-6 transition-transform"><CheckCircle2 size={32}/></div>
                    <div>
                       <p className="text-[10px] font-black text-slate-400 uppercase">اللجان المكتملة</p>
                       <p className="text-3xl font-black text-slate-900 tabular-nums">{stats.confirmed}</p>
                    </div>
                 </div>
                 <div className="bg-white p-8 rounded-[3rem] border shadow-sm flex items-center gap-6 group hover:scale-[1.02] transition-all">
                    <div className="bg-red-50 text-red-600 p-4 rounded-2xl group-hover:rotate-6 transition-transform"><UserX size={32}/></div>
                    <div>
                       <p className="text-[10px] font-black text-slate-400 uppercase">إجمالي الغيابات</p>
                       <p className="text-3xl font-black text-slate-900 tabular-nums">{stats.absentTotal}</p>
                    </div>
                 </div>
              </div>
           </div>
           
           <div className="bg-slate-950 p-8 rounded-[3.5rem] text-white shadow-xl relative overflow-hidden flex flex-col h-full min-h-[500px]">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 blur-3xl"></div>
              <h3 className="text-xl font-black mb-6 flex items-center gap-3 text-blue-400 relative z-10"><History /> العمليات اللحظية</h3>
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 relative z-10 space-y-4">
                 {deliveryLogs.filter(l => l.status === 'CONFIRMED').slice(-8).map(l => (
                   <div key={l.id} className="p-5 bg-white/5 rounded-2xl border border-white/10 flex flex-col gap-2 group hover:bg-white/10 transition-colors">
                      <div className="flex justify-between items-center">
                         <span className="font-black text-blue-400">لجنة {l.committee_number}</span>
                         <span className="text-[10px] text-slate-500 font-mono">{new Date(l.time).toLocaleTimeString('ar-SA')}</span>
                      </div>
                      <p className="text-xs font-bold text-slate-300">استلام نهائي: {l.grade}</p>
                   </div>
                 ))}
                 {deliveryLogs.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500 opacity-30 gap-4">
                       <Ghost size={64}/>
                       <p className="font-black">بانتظار العمليات...</p>
                    </div>
                 )}
              </div>
           </div>
        </div>
      )}

      {/* Assignments Tab */}
      {activeTab === 'assignments' && (
        <div className="space-y-8 animate-slide-up">
           <div className="bg-white p-10 rounded-[3.5rem] border shadow-xl flex flex-col lg:flex-row items-center justify-between gap-8">
              <div className="flex items-center gap-6">
                 <div className="bg-indigo-50 text-indigo-600 p-5 rounded-3xl shadow-inner"><Layers size={40} /></div>
                 <div>
                    <h3 className="text-3xl font-black text-slate-900">وحدة إسناد الصلاحيات</h3>
                    <p className="text-slate-400 font-bold italic">توزيع المهام والصفوف على أعضاء الكنترول</p>
                 </div>
              </div>
              <div className="relative w-full lg:w-96">
                 <Search size={20} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400" />
                 <input 
                    type="text" 
                    placeholder="بحث في طاقم العمل..." 
                    className="w-full pr-14 py-4 bg-slate-50 border-2 border-slate-100 rounded-[2rem] font-bold outline-none focus:border-indigo-600"
                    value={assignmentSearch}
                    onChange={e => setAssignmentSearch(e.target.value)}
                 />
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {users.filter(u => (u.role === 'CONTROL' || u.role === 'ASSISTANT_CONTROL') && (u.full_name.includes(assignmentSearch))).map(user => (
                <div key={user.id} className="bg-white p-10 rounded-[4rem] border-2 border-slate-50 shadow-2xl flex flex-col gap-8 transition-all hover:border-indigo-100">
                   <div className="flex items-center gap-6">
                      <div className={`w-20 h-20 rounded-[1.8rem] flex items-center justify-center shadow-xl ${user.role === 'CONTROL' ? 'bg-blue-600' : 'bg-indigo-900'} text-white`}>
                         <UserCheck size={40} />
                      </div>
                      <div className="flex-1">
                         <h4 className="text-2xl font-black text-slate-900 leading-tight">{user.full_name}</h4>
                         <div className="flex items-center gap-4 mt-1 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <span className="bg-slate-100 px-3 py-1 rounded-lg text-slate-800">{ROLES_ARABIC[user.role]}</span>
                            <span>ID: {user.national_id}</span>
                         </div>
                      </div>
                   </div>

                   <div className="space-y-4">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2">التخصيص الميداني:</p>
                      <div className="flex flex-wrap gap-2">
                         {user.role === 'CONTROL' ? (
                            Array.from(new Set(students.map(s => s.grade))).sort().map(grade => {
                               const isActive = user.assigned_grades?.includes(grade);
                               return (
                                 <button key={grade} onClick={() => onUpdateUserGrades(user.id, isActive ? user.assigned_grades!.filter(g => g !== grade) : [...(user.assigned_grades || []), grade])} className={`px-5 py-2.5 rounded-2xl font-black text-xs transition-all border-2 flex items-center gap-2 ${isActive ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400 hover:border-blue-200'}`}>
                                    {isActive ? <Check size={14}/> : <Plus size={14}/>}
                                    {grade}
                                 </button>
                               );
                            })
                         ) : (
                            Array.from(new Set(students.map(s => s.committee_number))).sort((a,b)=>Number(a)-Number(b)).map(com => {
                               const isActive = user.assigned_committees?.includes(com);
                               return (
                                 <button key={com} onClick={async () => {
                                    const updated = isActive ? user.assigned_committees!.filter(c => c !== com) : [...(user.assigned_committees || []), com];
                                    await onUpdateUserCommittees(user.id, updated);
                                 }} className={`px-5 py-2.5 rounded-2xl font-black text-xs transition-all border-2 flex items-center gap-2 ${isActive ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400 hover:border-indigo-200'}`}>
                                    {isActive ? <Check size={14}/> : <Plus size={14}/>}
                                    لجنة {com}
                                 </button>
                               );
                            })
                         )}
                      </div>
                   </div>
                </div>
              ))}
           </div>
        </div>
      )}

      {/* Comms Tab */}
      {activeTab === 'comms' && (
        <div className="space-y-8 animate-slide-up">
           <div className="bg-white p-12 rounded-[4rem] border shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 blur-3xl rounded-full"></div>
              <h3 className="text-3xl font-black text-slate-900 mb-10 flex items-center gap-4"><Megaphone size={32} className="text-blue-600" /> بث التعليمات والبلاغات</h3>
              
              <div className="space-y-8">
                 <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2 flex items-center gap-2"><Target size={14}/> الجمهور المستهدف</label>
                    <div className="flex flex-wrap gap-2">
                       {['ALL', 'PROCTOR', 'CONTROL', 'ASSISTANT_CONTROL', 'COUNSELOR'].map(role => (
                         <button key={role} onClick={() => setBroadcastTarget(role as any)} className={`px-6 py-3 rounded-2xl font-black text-xs transition-all border-2 ${broadcastTarget === role ? 'bg-slate-900 border-slate-800 text-white shadow-xl' : 'bg-white border-slate-100 text-slate-400 hover:border-blue-200'}`}>
                           {role === 'ALL' ? 'الكل' : ROLES_ARABIC[role]}
                         </button>
                       ))}
                    </div>
                 </div>
                 <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">نص البلاغ / التعليمات</label>
                    <textarea value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)} placeholder="اكتب التعليمات هنا بوضوح..." className="w-full bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] p-8 font-bold text-lg h-48 outline-none focus:border-blue-600 transition-all shadow-inner resize-none" />
                 </div>
                 <button onClick={() => { if(broadcastMsg.trim()) { onBroadcast(broadcastMsg, broadcastTarget); setBroadcastMsg(''); alert('تم بث البلاغ'); } }} disabled={!broadcastMsg.trim()} className="w-full py-8 bg-blue-600 text-white rounded-[2.5rem] font-black text-2xl flex items-center justify-center gap-6 shadow-2xl hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50">
                    <Send size={32}/> بث التعليمات الآن
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Emergency Receipt Tab */}
      {activeTab === 'emergency-receipt' && (
        <div className="space-y-8 animate-slide-up">
           <div className="bg-red-600 p-12 rounded-[4rem] text-white shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 blur-[100px] rounded-full -mr-32 -mt-32"></div>
              <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-10">
                 <div className="space-y-4">
                    <div className="flex items-center gap-6">
                       <div className="bg-white/10 p-5 rounded-3xl backdrop-blur-md"><ShieldAlert size={48}/></div>
                       <h3 className="text-4xl font-black tracking-tighter">بوابة استلام الطوارئ (Smart Bypass)</h3>
                    </div>
                    <p className="text-red-100 font-bold text-lg max-w-xl">يستخدم هذا الخيار في حال تعذر الإغلاق الرقمي من المراقب. النظام يستخرج الصفوف من بيانات الطلاب تلقائياً لتجنب الأخطاء.</p>
                 </div>
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {committeeStatus.map(com => (
                <div key={com.num} className="bg-white p-8 rounded-[3.5rem] border-2 border-slate-50 shadow-xl flex flex-col gap-6 group hover:border-red-600 transition-all">
                   <div className="flex justify-between items-center">
                      <div className="bg-slate-900 text-white w-16 h-16 rounded-2xl flex flex-col items-center justify-center font-black">
                         <span className="text-[8px] opacity-40 mb-1">لجنة</span>
                         <span className="text-3xl leading-none">{com.num}</span>
                      </div>
                   </div>
                   <div className="space-y-3">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-1">الصفوف المسجلة:</p>
                      <div className="flex flex-col gap-2">
                        {com.grades.map(grade => {
                           const isAlreadyConfirmed = deliveryLogs.some(l => l.committee_number === com.num && l.grade === grade && l.status === 'CONFIRMED');
                           return (
                             <div key={grade} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100 group-hover:bg-white transition-colors">
                               <span className="font-black text-sm text-slate-700">{grade}</span>
                               {isAlreadyConfirmed ? (
                                 <span className="flex items-center gap-1 text-emerald-600 font-black text-[9px] uppercase"><CheckCircle2 size={12}/> تم الاستلام</span>
                               ) : (
                                 <button onClick={async () => {
                                   if (confirm(`استلام لجنة ${com.num} (${grade}) يدوياً؟`)) {
                                     await setDeliveryLogs({ id: crypto.randomUUID(), teacher_name: 'رئيس الكنترول (يدوي)', proctor_name: 'تجاوز طوارئ', committee_number: com.num, grade, type: 'RECEIVE', time: new Date().toISOString(), period: 1, status: 'CONFIRMED' });
                                   }
                                 }} className="bg-slate-900 text-white px-4 py-2 rounded-xl font-black text-[10px] hover:bg-red-600 transition-all active:scale-95">استلام طوارئ</button>
                               )}
                             </div>
                           );
                        })}
                      </div>
                   </div>
                </div>
              ))}
           </div>
        </div>
      )}

      <style>{`
        @keyframes bounce-subtle {
           0%, 100% { transform: translateY(0); }
           50% { transform: translateY(-3px); }
        }
        .animate-bounce-subtle {
           animation: bounce-subtle 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default ControlManager;
