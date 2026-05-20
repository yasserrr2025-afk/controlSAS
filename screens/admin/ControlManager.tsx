
import React, { useState, useMemo, useEffect } from 'react';
import { 
  ShieldCheck, Users, Box, Send, Activity, 
  Settings2, BarChart3, Layers, UserPlus, 
  AlertCircle, CheckCircle2, Clock, Search, 
  Target, Filter, Zap, MessageSquare, Briefcase,
  MonitorPlay, Fingerprint, Award, TrendingUp,
  Mail, BellRing, UserCheck, ShieldAlert, Info,
  Timer, Gauge, FileSpreadsheet, FileText, History,
  ArrowRightLeft, UserMinus, UserX, CheckCircle,
  PackageSearch, Unlock, ShieldX, Ghost, Scan,
  UserCog, LogOut, ToggleLeft, ToggleRight,
  Radio, CalendarPlus, AlertOctagon, RefreshCw,
  Plus, X, Check, Navigation, Megaphone,
  Bell, Command, Shield, RefreshCcw, ArrowRight, UserCircle
} from 'lucide-react';
import { User, DeliveryLog, Student, UserRole, SystemConfig, Absence, Supervision } from '../../types';
import { ROLES_ARABIC } from '../../constants';
import { APP_CONFIG } from '../../constants';
import { supabase, db, getActiveTenantId } from '../../supabase';

type ExamScheduleRow = {
  id: string;
  date: string;
  subject: string;
  period: number;
};

type SmartPreviewItem = {
  key: string;
  scheduleId: string;
  date: string;
  subject: string;
  period: number;
  committeeNumber: string;
  teacherId: string;
  teacherName: string;
  loadBefore: number;
  repeatedToday: boolean;
};

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
  onSmartAssign: (assignments: { teacherId: string; committeeNumber: string; date: string; period: number; subject: string }[], replaceExisting: boolean) => Promise<void>;
}

const ControlManager: React.FC<ControlManagerProps> = ({ 
  users, deliveryLogs, students, onBroadcast, onUpdateUserGrades, onUpdateUserCommittees, systemConfig, absences, supervisions, setDeliveryLogs, setSystemConfig, onRemoveSupervision, onAssignProctor, onSmartAssign
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
  const [excludedProctorIds, setExcludedProctorIds] = useState<string[]>([]);
  const [replaceExistingSmart, setReplaceExistingSmart] = useState(false);
  const [isCommittingSmart, setIsCommittingSmart] = useState(false);
  const [assignmentHistory, setAssignmentHistory] = useState<Supervision[]>([]);
  const [smartPreview, setSmartPreview] = useState<SmartPreviewItem[]>([]);
  const [draggedPreviewKey, setDraggedPreviewKey] = useState<string | null>(null);
  const [examSchedule, setExamSchedule] = useState<ExamScheduleRow[]>([
    {
      id: crypto.randomUUID(),
      date: systemConfig.active_exam_date || new Date().toISOString().split('T')[0],
      subject: 'اختبار',
      period: 1
    }
  ]);

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
    const activeDate = systemConfig.active_exam_date || new Date().toISOString().split('T')[0];
    return comNums.map(num => {
      const sv = supervisions.find(s => s.committee_number === num && s.date?.startsWith(activeDate));
      const user = users.find(u => u.id === sv?.teacher_id);
      const gradesInCommittee = Array.from(new Set(students.filter(s => s.committee_number === num).map(s => s.grade)));
      return { num, proctor: user, svId: sv?.id, grades: gradesInCommittee };
    });
  }, [students, supervisions, users, systemConfig.active_exam_date]);

  const availableProctors = useMemo(() => {
    const activeDate = systemConfig.active_exam_date || new Date().toISOString().split('T')[0];
    const activeTeacherIds = supervisions.filter(s => s.date?.startsWith(activeDate)).map(s => s.teacher_id);
    return users.filter(u => u.role === 'PROCTOR' && !activeTeacherIds.includes(u.id));
  }, [users, supervisions, systemConfig.active_exam_date]);

  const proctorsListForModal = useMemo(() => {
    return users.filter(u => u.role === 'PROCTOR' && (u.full_name.includes(proctorSearchInModal) || u.national_id.includes(proctorSearchInModal)));
  }, [users, proctorSearchInModal]);

  const proctors = useMemo(() => users.filter(u => u.role === 'PROCTOR'), [users]);
  const activeDate = systemConfig.active_exam_date || new Date().toISOString().split('T')[0];

  useEffect(() => {
    db.supervision.getAll()
      .then(setAssignmentHistory)
      .catch(() => setAssignmentHistory(supervisions));
  }, [supervisions]);

  const smartStats = useMemo(() => {
    const counts = proctors.map(proctor => ({
      id: proctor.id,
      name: proctor.full_name,
      count: assignmentHistory.filter(s => s.teacher_id === proctor.id).length
    }));
    return {
      min: counts.length ? Math.min(...counts.map(item => item.count)) : 0,
      max: counts.length ? Math.max(...counts.map(item => item.count)) : 0,
      counts
    };
  }, [assignmentHistory, proctors]);

  const addScheduleRow = () => {
    setExamSchedule(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        date: prev[prev.length - 1]?.date || activeDate,
        subject: '',
        period: (prev[prev.length - 1]?.period || 0) + 1
      }
    ]);
  };

  const updateScheduleRow = (id: string, patch: Partial<ExamScheduleRow>) => {
    setExamSchedule(prev => prev.map(row => row.id === id ? { ...row, ...patch } : row));
  };

  const removeScheduleRow = (id: string) => {
    setExamSchedule(prev => prev.length === 1 ? prev : prev.filter(row => row.id !== id));
  };

  const makePreviewKey = (date: string, period: number, committeeNumber: string) => `${date}|${period}|${committeeNumber}`;

  const getExistingForSlot = (date: string, period: number) => {
    return supervisions.filter(s => s.date?.startsWith(date) && Number(s.period || 1) === Number(period));
  };

  const generateSmartAssignments = () => {
    const excluded = new Set(excludedProctorIds);
    const validSchedule = examSchedule.filter(row => row.date && row.subject.trim() && Number(row.period) > 0);
    const eligible = proctors.filter(proctor => !excluded.has(proctor.id));

    if (validSchedule.length === 0) {
      alert('أضف تاريخ الاختبار والمادة والفترة أولاً.');
      setSmartPreview([]);
      return;
    }
    if (eligible.length === 0) {
      alert('لا يوجد مراقبون متاحون بعد الاستثناءات.');
      setSmartPreview([]);
      return;
    }

    const preview: SmartPreviewItem[] = [];
    const usedByDate = new Map<string, Set<string>>();
    const workingLoad = new Map<string, number>(eligible.map(proctor => [
      proctor.id,
      assignmentHistory.filter(s => s.teacher_id === proctor.id).length
    ]));

    validSchedule.forEach(schedule => {
      const existingSlot = getExistingForSlot(schedule.date, schedule.period);
      const occupiedCommittees = new Set(existingSlot.map(s => s.committee_number));
      const targetCommittees = committeeStatus
        .filter(com => replaceExistingSmart || !occupiedCommittees.has(com.num))
        .map(com => com.num);

      if (!usedByDate.has(schedule.date)) {
        usedByDate.set(schedule.date, new Set(supervisions.filter(s => s.date?.startsWith(schedule.date)).map(s => s.teacher_id)));
      }
      const usedToday = usedByDate.get(schedule.date)!;

      targetCommittees.forEach(committeeNumber => {
        let candidates = eligible.filter(proctor => !usedToday.has(proctor.id));
        let repeatedToday = false;
        if (candidates.length === 0) {
          candidates = eligible;
          repeatedToday = true;
        }

        const selected = [...candidates].sort((a, b) => {
          const loadDiff = (workingLoad.get(a.id) || 0) - (workingLoad.get(b.id) || 0);
          if (loadDiff !== 0) return loadDiff;
          return a.full_name.localeCompare(b.full_name, 'ar');
        })[0];

        const loadBefore = workingLoad.get(selected.id) || 0;
        preview.push({
          key: makePreviewKey(schedule.date, schedule.period, committeeNumber),
          scheduleId: schedule.id,
          date: schedule.date,
          subject: schedule.subject.trim(),
          period: Number(schedule.period),
          committeeNumber,
          teacherId: selected.id,
          teacherName: selected.full_name,
          loadBefore,
          repeatedToday
        });
        usedToday.add(selected.id);
        workingLoad.set(selected.id, loadBefore + 1);
      });
    });

    if (preview.length === 0) {
      alert('كل لجان الفترات المحددة مرتبطة حالياً. فعّل خيار إعادة توزيع اللجان المرتبطة إذا أردت توليد توزيع جديد.');
      setSmartPreview([]);
      return;
    }

    setSmartPreview(preview);
  };

  const swapPreviewAssignments = (sourceKey: string, targetKey: string) => {
    if (sourceKey === targetKey) return;
    setSmartPreview(prev => {
      const source = prev.find(item => item.key === sourceKey);
      const target = prev.find(item => item.key === targetKey);
      if (!source || !target) return prev;
      return prev.map(item => {
        if (item.key === sourceKey) {
          return { ...item, teacherId: target.teacherId, teacherName: target.teacherName, loadBefore: target.loadBefore, repeatedToday: target.repeatedToday };
        }
        if (item.key === targetKey) {
          return { ...item, teacherId: source.teacherId, teacherName: source.teacherName, loadBefore: source.loadBefore, repeatedToday: source.repeatedToday };
        }
        return item;
      });
    });
  };

  const replacePreviewProctor = (itemKey: string) => {
    setSmartPreview(prev => {
      const target = prev.find(item => item.key === itemKey);
      if (!target) return prev;
      const usedInSameDate = new Set(prev.filter(item => item.date === target.date && item.key !== itemKey).map(item => item.teacherId));
      const candidates = proctors
        .filter(proctor => !excludedProctorIds.includes(proctor.id) && !usedInSameDate.has(proctor.id))
        .sort((a, b) => {
          const aLoad = assignmentHistory.filter(s => s.teacher_id === a.id).length;
          const bLoad = assignmentHistory.filter(s => s.teacher_id === b.id).length;
          return aLoad - bLoad || a.full_name.localeCompare(b.full_name, 'ar');
        });
      const replacement = candidates.find(proctor => proctor.id !== target.teacherId);
      if (!replacement) {
        alert('لا يوجد بديل مناسب لهذه اللجنة بعد الاستثناءات.');
        return prev;
      }
      const loadBefore = assignmentHistory.filter(s => s.teacher_id === replacement.id).length;
      return prev.map(item => item.key === itemKey ? {
        ...item,
        teacherId: replacement.id,
        teacherName: replacement.full_name,
        loadBefore,
        repeatedToday: false
      } : item);
    });
  };

  const commitSmartAssignments = async () => {
    if (smartPreview.length === 0) return;
    setIsCommittingSmart(true);
    try {
      await onSmartAssign(
        smartPreview.map(item => ({
          teacherId: item.teacherId,
          committeeNumber: item.committeeNumber,
          date: item.date,
          period: item.period,
          subject: item.subject
        })),
        replaceExistingSmart
      );
      onBroadcast(`تم إسناد اللجان للمراقبين. يرجى فتح صفحة رصد اللجنة وتأكيد المباشرة.`, 'PROCTOR');
      alert(`تم ربط ${smartPreview.length} مراقب باللجان بنجاح.`);
      setSmartPreview([]);
    } catch (err: any) {
      alert(err.message || 'تعذر ربط المراقبين باللجان.');
    } finally {
      setIsCommittingSmart(false);
    }
  };

  const printSmartReport = () => {
    if (smartPreview.length === 0) {
      alert('ولّد التوزيع أولاً حتى تتم طباعة التقرير.');
      return;
    }
    window.print();
  };

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
           <div className="bg-white p-8 rounded-[3.5rem] border-2 border-blue-50 shadow-2xl no-print">
              <div className="flex flex-col xl:flex-row justify-between gap-8">
                 <div className="space-y-3 max-w-2xl">
                    <div className="flex items-center gap-4">
                       <div className="p-4 bg-blue-600 text-white rounded-2xl shadow-xl"><Zap size={28}/></div>
                       <div>
                          <h3 className="text-2xl font-black text-slate-900">التوزيع الذكي للمراقبين</h3>
                          <p className="text-sm font-bold text-slate-400">يوزع اللجان على الأقل دخولاً أولاً، ويمنع تكرار المراقب في نفس اليوم قدر الإمكان.</p>
                       </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                       <div className="bg-slate-50 p-4 rounded-2xl">
                          <p className="text-[10px] font-black text-slate-400">اللجان</p>
                          <p className="text-2xl font-black text-slate-900">{committeeStatus.length}</p>
                       </div>
                       <div className="bg-slate-50 p-4 rounded-2xl">
                          <p className="text-[10px] font-black text-slate-400">غير مرتبطة</p>
                          <p className="text-2xl font-black text-blue-600">{committeeStatus.filter(com => !com.proctor).length}</p>
                       </div>
                       <div className="bg-slate-50 p-4 rounded-2xl">
                          <p className="text-[10px] font-black text-slate-400">المتاحون</p>
                          <p className="text-2xl font-black text-emerald-600">{proctors.length - excludedProctorIds.length}</p>
                       </div>
                       <div className="bg-slate-50 p-4 rounded-2xl">
                          <p className="text-[10px] font-black text-slate-400">فرق العدالة</p>
                          <p className="text-2xl font-black text-indigo-600">{Math.max(0, smartStats.max - smartStats.min)}</p>
                       </div>
                    </div>
                 </div>

                 <div className="w-full xl:w-[28rem] space-y-4">
                    <button
                      onClick={() => setReplaceExistingSmart(prev => !prev)}
                      className={`w-full p-4 rounded-2xl border-2 font-black text-sm flex items-center justify-between transition-all ${replaceExistingSmart ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-slate-50 border-slate-100 text-slate-500'}`}
                    >
                       <span>إعادة توزيع اللجان المرتبطة</span>
                       {replaceExistingSmart ? <ToggleRight/> : <ToggleLeft/>}
                    </button>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                       <button onClick={generateSmartAssignments} className="bg-blue-600 text-white py-4 rounded-2xl font-black text-sm shadow-xl hover:bg-blue-700 flex items-center justify-center gap-2">
                          <Zap size={18}/> توليد
                       </button>
                       <button onClick={commitSmartAssignments} disabled={smartPreview.length === 0 || isCommittingSmart} className="bg-slate-950 text-white py-4 rounded-2xl font-black text-sm shadow-xl hover:bg-black disabled:opacity-40 flex items-center justify-center gap-2">
                          <CheckCircle2 size={18}/> ربط
                       </button>
                       <button onClick={printSmartReport} disabled={smartPreview.length === 0} className="bg-emerald-600 text-white py-4 rounded-2xl font-black text-sm shadow-xl hover:bg-emerald-700 disabled:opacity-40 flex items-center justify-center gap-2">
                          <FileText size={18}/> طباعة
                       </button>
                    </div>
                 </div>
              </div>

              <div className="mt-8 bg-blue-50/60 p-5 rounded-[2rem] border border-blue-100">
                 <div className="flex flex-col md:flex-row justify-between gap-4 mb-4">
                    <div>
                       <h4 className="font-black text-slate-900 flex items-center gap-2"><CalendarPlus size={18} className="text-blue-600"/> أيام وفترات الاختبار</h4>
                       <p className="text-xs font-bold text-slate-500 mt-1">أضف الأيام الباقية وحدد المادة والفترة، ثم ولّد التوزيع لها دفعة واحدة.</p>
                    </div>
                    <button onClick={addScheduleRow} className="bg-blue-600 text-white px-5 py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg">
                      <Plus size={18}/> إضافة يوم/فترة
                    </button>
                 </div>
                 <div className="space-y-3">
                    {examSchedule.map(row => (
                      <div key={row.id} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_8rem_3rem] gap-3 bg-white p-3 rounded-2xl border border-blue-100">
                         <input type="date" value={row.date} onChange={e => updateScheduleRow(row.id, { date: e.target.value })} className="bg-slate-50 rounded-xl px-4 py-3 font-bold outline-none border border-slate-100 focus:border-blue-400" />
                         <input type="text" value={row.subject} onChange={e => updateScheduleRow(row.id, { subject: e.target.value })} placeholder="المادة" className="bg-slate-50 rounded-xl px-4 py-3 font-bold outline-none border border-slate-100 focus:border-blue-400" />
                         <select value={row.period} onChange={e => updateScheduleRow(row.id, { period: Number(e.target.value) })} className="bg-slate-50 rounded-xl px-4 py-3 font-bold outline-none border border-slate-100 focus:border-blue-400">
                            {[1, 2, 3, 4].map(period => <option key={period} value={period}>الفترة {period}</option>)}
                         </select>
                         <button onClick={() => removeScheduleRow(row.id)} className="bg-red-50 text-red-500 rounded-xl flex items-center justify-center hover:bg-red-100">
                            <X size={18}/>
                         </button>
                      </div>
                    ))}
                 </div>
              </div>

              <div className="mt-8 grid grid-cols-1 xl:grid-cols-2 gap-6">
                 <div className="bg-slate-50 p-5 rounded-[2rem] border border-slate-100">
                    <h4 className="font-black text-slate-800 mb-4 flex items-center gap-2"><UserMinus size={18} className="text-red-500"/> استثناء مراقبين لهذا اليوم</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto custom-scrollbar">
                       {proctors.map(proctor => {
                         const isExcluded = excludedProctorIds.includes(proctor.id);
                         const load = smartStats.counts.find(item => item.id === proctor.id)?.count || 0;
                         return (
                           <button
                             key={proctor.id}
                             onClick={() => setExcludedProctorIds(prev => isExcluded ? prev.filter(id => id !== proctor.id) : [...prev, proctor.id])}
                             className={`p-3 rounded-2xl text-right border-2 transition-all ${isExcluded ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white border-white text-slate-700 hover:border-blue-200'}`}
                           >
                              <p className="font-black text-sm truncate">{proctor.full_name}</p>
                              <p className="text-[10px] font-bold opacity-60">دخول سابق: {load}</p>
                           </button>
                         );
                       })}
                    </div>
                 </div>

                 <div className="bg-slate-950 p-5 rounded-[2rem] text-white">
                    <h4 className="font-black mb-4 flex items-center gap-2"><Filter size={18} className="text-blue-400"/> معاينة التوزيع قبل الاعتماد</h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                       {smartPreview.map(item => (
                         <div
                           key={item.key}
                           draggable
                           onDragStart={() => setDraggedPreviewKey(item.key)}
                           onDragOver={e => e.preventDefault()}
                           onDrop={() => {
                             if (draggedPreviewKey) swapPreviewAssignments(draggedPreviewKey, item.key);
                             setDraggedPreviewKey(null);
                           }}
                           className="bg-white/5 border border-white/10 rounded-2xl p-3 flex items-center justify-between gap-3 cursor-move"
                         >
                            <div>
                               <p className="font-black text-sm">{item.teacherName}</p>
                               <p className="text-[10px] text-slate-400">{item.date} - فترة {item.period} - {item.subject}</p>
                               <p className="text-[10px] text-slate-400">دخول سابق: {item.loadBefore}{item.repeatedToday ? ' - تكرار اضطراري' : ''}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => replacePreviewProctor(item.key)} className="bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded-xl font-black text-[10px] flex items-center gap-1">
                                <ArrowRightLeft size={12}/> استبدال
                              </button>
                              <span className="bg-blue-600 text-white px-3 py-1 rounded-xl font-black text-xs">لجنة {item.committeeNumber}</span>
                            </div>
                          </div>
                        ))}
                       {smartPreview.length === 0 && (
                         <div className="h-40 flex items-center justify-center text-slate-500 font-black text-sm border border-dashed border-white/10 rounded-2xl">
                            لم يتم توليد توزيع بعد
                         </div>
                       )}
                    </div>
                 </div>
              </div>
           </div>

           <div className="print-only smart-assignment-report" dir="rtl">
              <style>{`
                .smart-assignment-report { display: none; }
                @media print {
                  body * { visibility: hidden !important; }
                  .smart-assignment-report,
                  .smart-assignment-report * { visibility: visible !important; }
                  .smart-assignment-report {
                    display: block !important;
                    position: absolute;
                    inset: 0;
                    font-family: Tajawal, Arial, sans-serif;
                    color: #111827;
                    padding: 10mm 12mm;
                    background: white;
                  }
                  .smart-assignment-report table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 6mm;
                    font-size: 11pt;
                  }
                  .smart-assignment-report th,
                  .smart-assignment-report td {
                    border: 1px solid #111827;
                    padding: 7px;
                   text-align: center;
                  }
                  .smart-assignment-report th { background: #f1f5f9; }
                  @page { size: A4 portrait; margin: 8mm; }
                }
              `}</style>
              <div style={{ borderBottom: '4px double #111827', paddingBottom: '4mm', marginBottom: '7mm' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 1fr', alignItems: 'center', gap: '8mm' }}>
                  <div style={{ textAlign: 'right', fontWeight: 900, fontSize: '10pt', lineHeight: 1.8 }}>
                    <p>المملكة العربية السعودية</p>
                    <p>{APP_CONFIG.MINISTRY_NAME}</p>
                    <p>{APP_CONFIG.ADMINISTRATION_NAME}</p>
                    <p>{APP_CONFIG.SCHOOL_NAME}</p>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <img src={APP_CONFIG.LOGO_URL} alt="شعار" style={{ width: '22mm', height: '22mm', objectFit: 'contain', margin: '0 auto' }} />
                    <p style={{ fontSize: '7pt', fontWeight: 800, color: '#475569', marginTop: '1mm' }}>نظام الكنترول المطور</p>
                  </div>
                  <div style={{ textAlign: 'left', fontWeight: 800, fontSize: '10pt', lineHeight: 1.8 }}>
                    <p>التاريخ: {new Date().toLocaleDateString('ar-SA')}</p>
                    <p>اليوم: {new Intl.DateTimeFormat('ar-SA', { weekday: 'long' }).format(new Date())}</p>
                    <p>المرفقات: تقرير توزيع المراقبين</p>
                  </div>
                </div>
              </div>
              <div className="text-center">
                 <h1 style={{ fontSize: '18pt', fontWeight: 900 }}>تقرير توزيع المراقبين على اللجان</h1>
                 <p style={{ marginTop: '2mm', fontWeight: 700 }}>توزيع متعدد الأيام والفترات</p>
              </div>
              <table>
                 <thead>
                   <tr>
                     <th>م</th>
                     <th>رقم اللجنة</th>
                     <th>التاريخ</th>
                     <th>المادة</th>
                     <th>الفترة</th>
                     <th>اسم المراقب</th>
                     <th>عدد مرات الدخول السابقة</th>
                     <th>توقيع المراقب</th>
                     <th>ملاحظات</th>
                   </tr>
                 </thead>
                 <tbody>
                   {smartPreview.map((item, index) => (
                     <tr key={item.key}>
                       <td>{index + 1}</td>
                       <td>{item.committeeNumber}</td>
                       <td>{item.date}</td>
                       <td>{item.subject}</td>
                       <td>{item.period}</td>
                       <td>{item.teacherName}</td>
                       <td>{item.loadBefore}</td>
                       <td style={{ height: '12mm' }}></td>
                       <td>{item.repeatedToday ? 'تكرار اضطراري لنقص العدد' : ''}</td>
                     </tr>
                   ))}
                 </tbody>
              </table>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '18mm', fontWeight: 800 }}>
                 <span>مسؤول الكنترول: ....................</span>
                 <span>التوقيع: ....................</span>
                 <span>التاريخ: ....................</span>
              </div>
           </div>

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
