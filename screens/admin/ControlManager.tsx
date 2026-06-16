
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
  Bell, Command, Shield, RefreshCcw, ArrowRight, UserCircle,
  Copy, ExternalLink, Link2, Archive, FileDown, ClipboardList, Siren,
  WifiOff, DatabaseBackup, MessageCircle, Wand2
} from 'lucide-react';
import { User, DeliveryLog, Student, UserRole, SystemConfig, Absence, Supervision, ControlRequest, ExamSchedule } from '../../types';
import { ROLES_ARABIC } from '../../constants';
import { supabase, db } from '../../supabase';
import SmartProctorDistribution, { SmartDistributionItem } from './SmartProctorDistribution';
import { isPlaceholderProctorStart } from '../../utils/proctorTime';
import { cleanControlRequestText, isInternalSignatureRecord, isSignatureRequest } from '../../services/signatures';

interface ControlManagerProps {
  users: User[];
  deliveryLogs: DeliveryLog[];
  students: Student[];
  onBroadcast: (msg: string, target: UserRole | 'ALL') => void;
  onUpdateUserGrades: (userId: string, grades: string[]) => void;
  systemConfig: SystemConfig & { allow_manual_join?: boolean, active_exam_date?: string };
  absences: Absence[];
  supervisions: Supervision[];
  smartSupervisions?: Supervision[];
  examSchedule?: ExamSchedule[];
  requests?: ControlRequest[];
  setDeliveryLogs: (log: DeliveryLog) => Promise<void>;
  setSystemConfig: (cfg: any) => Promise<void>;
  onRemoveSupervision: (teacherId: string) => Promise<void>;
  onAssignProctor: (teacherId: string, committeeNumber: string) => Promise<void>;
  onCommitSmartDistribution: (items: SmartDistributionItem[], replaceExisting: boolean) => Promise<void>;
  onDeleteSmartDistributions?: (ids: string[]) => Promise<void>;
  onUpdateSmartDistribution?: (id: string, teacherId: string) => Promise<void>;
  onUpsertExamSchedule?: (item: Partial<ExamSchedule>) => Promise<void>;
  onDeleteExamSchedule?: (id: string) => Promise<void>;
}

const ControlManager: React.FC<ControlManagerProps> = ({ 
  users, deliveryLogs, students, onBroadcast, onUpdateUserGrades, systemConfig, absences, supervisions, smartSupervisions, examSchedule = [], requests = [], setDeliveryLogs, setSystemConfig, onRemoveSupervision, onAssignProctor, onCommitSmartDistribution, onDeleteSmartDistributions, onUpdateSmartDistribution, onUpsertExamSchedule, onDeleteExamSchedule
}) => {
  type ControlTab = 'cockpit' | 'ops-center' | 'assignments' | 'emergency-receipt' | 'comms' | 'proctors-mgmt';
  const [activeTab, setActiveTabState] = useState<ControlTab>(() => {
    const saved = localStorage.getItem('control_manager_active_tab') as ControlTab | null;
    return saved || 'cockpit';
  });
  const setActiveTab = (tab: ControlTab) => {
    setActiveTabState(tab);
    localStorage.setItem('control_manager_active_tab', tab);
  };
  const [broadcastTarget, setBroadcastTarget] = useState<UserRole | 'ALL'>('ALL');
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcastTone, setBroadcastTone] = useState<'INFO' | 'URGENT' | 'REMINDER' | 'THANKS'>('INFO');
  const [isResetting, setIsResetting] = useState(false);
  const [assignmentSearch, setAssignmentSearch] = useState('');
  const [globalSearch, setGlobalSearch] = useState('');
  const [auditEvents, setAuditEvents] = useState<{ id: string; time: string; action: string; detail: string }[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('control_audit_events') || '[]');
    } catch {
      return [];
    }
  });
  
  // States for Assigning/Swapping
  const [isAssigning, setIsAssigning] = useState(false);
  const [targetCommittee, setTargetCommittee] = useState<string | null>(null);
  const [proctorSearchInModal, setProctorSearchInModal] = useState('');

  const addAuditEvent = (action: string, detail: string) => {
    const event = { id: crypto.randomUUID(), time: new Date().toISOString(), action, detail };
    setAuditEvents(prev => {
      const next = [event, ...prev].slice(0, 80);
      localStorage.setItem('control_audit_events', JSON.stringify(next));
      return next;
    });
  };

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

  const allSupervisionRows = smartSupervisions || supervisions;
  const activeExamDateKey = systemConfig.active_exam_date || new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const isReserveRow = (item: Supervision) => String(item.subject || '').includes('[RESERVE]');

  const reserveCandidateIdsForTarget = useMemo(() => {
    if (!targetCommittee) return new Set<string>();
    return new Set(
      allSupervisionRows
        .filter(s => isReserveRow(s))
        .filter(s => s.committee_number === targetCommittee)
        .filter(s => !activeExamDateKey || String(s.date || '').slice(0, 10) === activeExamDateKey)
        .map(s => s.teacher_id),
    );
  }, [allSupervisionRows, targetCommittee, activeExamDateKey]);

  const proctorsListForModal = useMemo(() => {
    const q = proctorSearchInModal.trim();
    return users
      .filter(u => u.role === 'PROCTOR' && (!q || u.full_name.includes(q) || u.national_id.includes(q)))
      .sort((a, b) => {
        const aReserveForTarget = reserveCandidateIdsForTarget.has(a.id);
        const bReserveForTarget = reserveCandidateIdsForTarget.has(b.id);
        if (aReserveForTarget !== bReserveForTarget) return aReserveForTarget ? -1 : 1;
        const aActive = supervisions.some(s => s.teacher_id === a.id);
        const bActive = supervisions.some(s => s.teacher_id === b.id);
        if (aActive !== bActive) return aActive ? 1 : -1;
        const aCount = allSupervisionRows.filter(s => s.teacher_id === a.id && !isReserveRow(s)).length;
        const bCount = allSupervisionRows.filter(s => s.teacher_id === b.id && !isReserveRow(s)).length;
        if (aCount !== bCount) return aCount - bCount;
        const aReserveCount = allSupervisionRows.filter(s => s.teacher_id === a.id && isReserveRow(s)).length;
        const bReserveCount = allSupervisionRows.filter(s => s.teacher_id === b.id && isReserveRow(s)).length;
        if (aReserveCount !== bReserveCount) return aReserveCount - bReserveCount;
        return a.full_name.localeCompare(b.full_name, 'ar');
      });
  }, [users, proctorSearchInModal, supervisions, allSupervisionRows, reserveCandidateIdsForTarget]);

  const handleStartNewDay = async () => {
    const today = new Date().toISOString().split('T')[0];
    if (!confirm(`بدء يوم جديد سيقوم بتصفير اللجان لليوم (${today}). هل أنت متأكد؟`)) return;
    setIsResetting(true);
    try {
      await supabase.from('supervision').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await setSystemConfig({ ...systemConfig, active_exam_date: today });
      onBroadcast(`تم تفعيل يوم الاختبار الجديد (${today}). يرجى المباشرة فوراً.`, 'ALL');
      addAuditEvent('بداية يوم جديد', `تم تصفير اللجان وتفعيل تاريخ ${today}`);
      window.location.reload();
    } catch (err: any) { alert(err.message); } finally { setIsResetting(false); }
  };

  const studentInquiryUrl = `${window.location.origin}${window.location.pathname}?student_inquiry=1`;

  const handleCopyStudentInquiryLink = async () => {
    try {
      await navigator.clipboard.writeText(studentInquiryUrl);
      alert('تم نسخ رابط استعلام الطلاب عن اللجنة.');
    } catch {
      window.prompt('انسخ رابط استعلام الطلاب:', studentInquiryUrl);
    }
  };

  const todayLogs = useMemo(() => deliveryLogs.filter(l => !systemConfig.active_exam_date || l.time?.startsWith(systemConfig.active_exam_date)), [deliveryLogs, systemConfig.active_exam_date]);
  const visibleRequests = useMemo(() => requests.filter(r => !isInternalSignatureRecord(r) && !isSignatureRequest(r)), [requests]);
  const pendingRequests = useMemo(() => visibleRequests.filter(r => r.status !== 'DONE'), [visibleRequests]);
  const unassignedCommittees = useMemo(() => committeeStatus.filter(c => !c.proctor), [committeeStatus]);
  const closedWaitingReceipt = useMemo(() => {
    return committeeStatus.filter(c => {
      const hasPending = todayLogs.some(l => l.committee_number === c.num && l.status === 'PENDING');
      const hasConfirmed = todayLogs.some(l => l.committee_number === c.num && l.status === 'CONFIRMED');
      return hasPending && !hasConfirmed;
    });
  }, [committeeStatus, todayLogs]);

  const smartAlerts = useMemo(() => {
    const alerts: {title: string; text: string; level: 'red' | 'amber' | 'blue'}[] = [];
    if (unassignedCommittees.length) alerts.push({ title: 'لجان غير مسندة', text: `${unassignedCommittees.length} لجنة تحتاج مراقبًا قبل بداية الاختبار.`, level: 'red' });
    if (pendingRequests.length) alerts.push({ title: 'بلاغات مفتوحة', text: `${pendingRequests.length} بلاغ يحتاج متابعة أو إغلاق.`, level: 'red' });
    if (closedWaitingReceipt.length) alerts.push({ title: 'لجان في الطريق', text: `${closedWaitingReceipt.length} لجنة أغلقت ميدانيًا وتنتظر الاستلام في الكنترول.`, level: 'amber' });
    if (!alerts.length) alerts.push({ title: 'الوضع مستقر', text: 'لا توجد مؤشرات حرجة حاليًا.', level: 'blue' });
    return alerts;
  }, [unassignedCommittees, pendingRequests, closedWaitingReceipt]);

  const timeline = useMemo(() => {
    const items = [
      ...supervisions
        .filter(s => !isPlaceholderProctorStart(s.date))
        .map(s => ({ time: s.date, type: 'دخول مراقب', title: `لجنة ${s.committee_number}`, text: users.find(u => u.id === s.teacher_id)?.full_name || 'مراقب غير معروف' })),
      ...todayLogs.map(l => ({ time: l.time, type: l.status === 'CONFIRMED' ? 'استلام كنترول' : 'إغلاق ميداني', title: `لجنة ${l.committee_number}`, text: `${l.grade} - ${l.teacher_name}` })),
      ...absences.map(a => ({ time: a.date, type: a.type === 'ABSENT' ? 'غياب' : 'تأخر', title: `لجنة ${a.committee_number}`, text: a.student_name })),
      ...visibleRequests.map(r => ({ time: r.time, type: r.status === 'DONE' ? 'إغلاق بلاغ' : 'بلاغ', title: `لجنة ${r.committee}`, text: cleanControlRequestText(r.text) })),
    ];
    return items
      .filter(i => i.time)
      .sort((a, b) => String(b.time).localeCompare(String(a.time)))
      .slice(0, 16);
  }, [supervisions, todayLogs, absences, visibleRequests, users]);

  const searchResults = useMemo(() => {
    const q = globalSearch.trim();
    if (!q) return [];
    return [
      ...students.filter(s => [s.name, s.national_id, s.committee_number, s.seating_number].some(v => String(v || '').includes(q))).slice(0, 6).map(s => ({ type: 'طالب', title: s.name, sub: `هوية ${s.national_id} - لجنة ${s.committee_number}` })),
      ...users.filter(u => [u.full_name, u.national_id, u.role].some(v => String(v || '').includes(q))).slice(0, 6).map(u => ({ type: 'مستخدم', title: u.full_name, sub: ROLES_ARABIC[u.role] || u.role })),
      ...visibleRequests.filter(r => [r.committee, cleanControlRequestText(r.text), r.from].some(v => String(v || '').includes(q))).slice(0, 6).map(r => ({ type: 'بلاغ', title: `لجنة ${r.committee}`, sub: cleanControlRequestText(r.text) })),
    ].slice(0, 12);
  }, [globalSearch, students, users, requests]);

  const performanceStats = useMemo(() => {
    const closed = new Set(todayLogs.filter(l => l.status === 'PENDING').map(l => l.committee_number)).size;
    const confirmed = new Set(todayLogs.filter(l => l.status === 'CONFIRMED').map(l => l.committee_number)).size;
    const requestCommittees = new Set(requests.map(r => r.committee)).size;
    return [
      { label: 'لجان نشطة', value: supervisions.length, icon: UserCheck, color: 'bg-blue-50 text-blue-600' },
      { label: 'في الطريق للكنترول', value: closed, icon: PackageSearch, color: 'bg-orange-50 text-orange-600' },
      { label: 'مستلمة نهائيًا', value: confirmed, icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-600' },
      { label: 'لجان بها بلاغات', value: requestCommittees, icon: Siren, color: 'bg-red-50 text-red-600' },
    ];
  }, [todayLogs, requests, supervisions]);

  const exportTodayBackup = () => {
    const payload = { date: systemConfig.active_exam_date, students, users, supervisions, absences, deliveryLogs, requests, exported_at: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `control-backup-${systemConfig.active_exam_date || new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addAuditEvent('نسخ احتياطي', `تم تصدير نسخة JSON لتاريخ ${systemConfig.active_exam_date || new Date().toISOString().slice(0,10)}`);
  };

  const archiveTodayLocally = () => {
    const key = `control_archive_${systemConfig.active_exam_date || new Date().toISOString().slice(0,10)}`;
    localStorage.setItem(key, JSON.stringify({ students, users, supervisions, absences, deliveryLogs, requests, archived_at: new Date().toISOString() }));
    addAuditEvent('أرشفة اليوم', `تم حفظ أرشيف محلي لتاريخ ${systemConfig.active_exam_date || new Date().toISOString().slice(0,10)}`);
    alert('تم حفظ أرشيف اليوم محليًا على هذا الجهاز.');
  };

  const broadcastTemplates = [
    { tone: 'INFO', title: 'تعليمات عامة', msg: 'تنبيه من الكنترول: يرجى الالتزام بالتعليمات الرسمية ومتابعة إشعارات النظام أولًا بأول.' },
    { tone: 'URGENT', title: 'تنبيه عاجل', msg: 'تنبيه عاجل من الكنترول: يرجى مراجعة البلاغ فورًا واتخاذ الإجراء المطلوب دون تأخير.' },
    { tone: 'REMINDER', title: 'تذكير بالإغلاق', msg: 'تذكير من الكنترول: بعد انتهاء اللجنة يرجى إنهاء الإغلاق الرقمي والتوجه للتسليم مباشرة.' },
    { tone: 'THANKS', title: 'شكر وتقدير', msg: 'شكرًا لتعاونكم. يقدّر الكنترول سرعة الاستجابة ودقة الرصد في اللجان.' },
  ];

  const formatBroadcast = (msg: string) => {
    const prefix = broadcastTone === 'URGENT' ? 'عاجل من الكنترول' : broadcastTone === 'REMINDER' ? 'تذكير من الكنترول' : broadcastTone === 'THANKS' ? 'رسالة شكر من الكنترول' : 'تنبيه من الكنترول';
    return `${prefix}: ${msg.trim()}`;
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-[3rem] p-7 border border-orange-100 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="p-4 bg-orange-50 text-orange-600 rounded-2xl shadow-inner">
              <Link2 size={30} />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900">رابط استعلام الطلاب عن لجانهم</h3>
              <p className="text-sm font-bold text-slate-500 mt-1">صفحة عامة للطلاب برقم الهوية، بعنوان: استعلام عن اللجنة.</p>
              <p className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-xs font-black text-slate-500 break-all" dir="ltr">{studentInquiryUrl}</p>
            </div>
          </div>
          <div className="flex shrink-0 gap-3">
            <button onClick={handleCopyStudentInquiryLink} className="h-14 w-14 rounded-2xl bg-slate-950 text-white flex items-center justify-center shadow-xl hover:bg-orange-600 transition-all" title="نسخ الرابط">
              <Copy size={22} />
            </button>
            <button onClick={() => window.open(studentInquiryUrl, '_blank')} className="h-14 w-14 rounded-2xl bg-orange-500 text-white flex items-center justify-center shadow-xl hover:bg-orange-600 transition-all" title="فتح الرابط">
              <ExternalLink size={22} />
            </button>
          </div>
        </div>

        <button onClick={() => { localStorage.setItem('activeTab', 'control-monitor'); window.location.reload(); }} className="bg-slate-950 rounded-[3rem] p-7 text-white border border-white/10 shadow-xl text-right group overflow-hidden relative">
          <div className="absolute inset-0 bg-orange-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="relative z-10 flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-black text-orange-300 uppercase tracking-widest mb-2">TV Display</p>
              <h3 className="text-2xl font-black">لوحة العرض والتحكم</h3>
              <p className="text-xs font-bold text-slate-400 mt-2">تغيير التقسيمات وعرض حالة اللجان مباشرة.</p>
            </div>
            <MonitorPlay className="text-orange-400 group-hover:scale-110 transition-transform" size={42} />
          </div>
        </button>
      </div>

      <div className="bg-white rounded-[3rem] border border-slate-100 shadow-xl p-6">
        <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_1fr] gap-6">
          <div className="space-y-4">
            <div className="relative">
              <Search size={22} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={globalSearch} onChange={e => setGlobalSearch(e.target.value)} placeholder="بحث شامل: طالب، هوية، لجنة، مراقب، بلاغ..." className="w-full bg-slate-50 border-2 border-slate-100 rounded-[2rem] py-5 pr-14 pl-5 font-black outline-none focus:border-blue-500" />
            </div>
            {globalSearch && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {searchResults.length ? searchResults.map((r, i) => (
                  <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-[10px] font-black text-blue-600">{r.type}</span>
                    <p className="font-black text-slate-900 mt-1">{r.title}</p>
                    <p className="text-xs font-bold text-slate-500 truncate">{r.sub}</p>
                  </div>
                )) : <p className="text-center text-slate-400 font-black py-6">لا توجد نتائج مطابقة.</p>}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={exportTodayBackup} className="p-5 rounded-3xl bg-slate-950 text-white text-right shadow-xl hover:bg-blue-700 transition-all"><DatabaseBackup size={26} className="mb-3 text-orange-300" /><p className="font-black">نسخ احتياطي</p><p className="text-[10px] text-slate-400 font-bold mt-1">JSON لبيانات اليوم</p></button>
            <button onClick={archiveTodayLocally} className="p-5 rounded-3xl bg-orange-500 text-white text-right shadow-xl hover:bg-orange-600 transition-all"><Archive size={26} className="mb-3" /><p className="font-black">أرشفة اليوم</p><p className="text-[10px] text-orange-100 font-bold mt-1">حفظ محلي سريع</p></button>
            <button onClick={() => setActiveTab('ops-center')} className="p-5 rounded-3xl bg-blue-600 text-white text-right shadow-xl hover:bg-blue-700 transition-all"><ClipboardList size={26} className="mb-3" /><p className="font-black">مركز البلاغات</p><p className="text-[10px] text-blue-100 font-bold mt-1">الأولوية والسجل</p></button>
            <button onClick={() => { localStorage.setItem('activeTab', 'daily-reports'); window.location.reload(); }} className="p-5 rounded-3xl bg-emerald-600 text-white text-right shadow-xl hover:bg-emerald-700 transition-all"><FileDown size={26} className="mb-3" /><p className="font-black">تقرير نهاية اليوم</p><p className="text-[10px] text-emerald-100 font-bold mt-1">طباعة وتصدير</p></button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex justify-center overflow-x-auto pb-4 custom-scrollbar">
         <div className="bg-white p-2 rounded-[2.5rem] shadow-xl border flex gap-2 w-full max-w-6xl shrink-0">
            {[
              {id: 'cockpit', label: 'الرؤية العامة', icon: MonitorPlay},
              {id: 'ops-center', label: 'مركز العمليات', icon: ClipboardList},
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
           <SmartProctorDistribution
             users={users}
             students={students}
             supervisions={smartSupervisions || supervisions}
             activeDate={systemConfig.active_exam_date}
             examSchedule={examSchedule}
             onUpsertExamSchedule={onUpsertExamSchedule}
             onDeleteExamSchedule={onDeleteExamSchedule}
             onCommit={onCommitSmartDistribution}
             onDeleteSupervisions={onDeleteSmartDistributions}
             onUpdateSupervision={onUpdateSmartDistribution}
             systemConfig={systemConfig}
           />

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
                        const isReserveForTarget = reserveCandidateIdsForTarget.has(u.id);
                        const totalAssignments = allSupervisionRows.filter(s => s.teacher_id === u.id && !isReserveRow(s)).length;
                        const reserveAssignments = allSupervisionRows.filter(s => s.teacher_id === u.id && isReserveRow(s)).length;
                        const startedAssignments = allSupervisionRows.filter(s => {
                          if (s.teacher_id !== u.id) return false;
                          const d = new Date(s.date);
                          return s.date && !Number.isNaN(d.getTime()) && !(d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0);
                        }).length;
                        
                        return (
                           <button 
                             key={u.id} 
                             disabled={isCurrentInThisCom}
                             onClick={async () => {
                                if (confirm(`هل ترغب في تعيين (${u.full_name}) كبديل في اللجنة (${targetCommittee})؟`)) {
                                   await onAssignProctor(u.id, targetCommittee);
                                   addAuditEvent('استبدال طارئ', `تم تعيين ${u.full_name} على لجنة ${targetCommittee}${isReserveForTarget ? ' من احتياط اللجنة' : ''}`);
                                   setIsAssigning(false);
                                }
                             }}
                             className={`w-full p-6 rounded-[2.5rem] border-2 transition-all flex items-center justify-between group hover:shadow-2xl ${isCurrentInThisCom ? 'opacity-30 border-slate-100 bg-slate-50 grayscale' : isReserveForTarget ? 'border-violet-200 bg-violet-50 hover:border-violet-400 hover:bg-white shadow-violet-100' : 'border-slate-50 bg-slate-50 hover:border-blue-200 hover:bg-white'}`}
                           >
                              <div className="flex items-center gap-6">
                                 <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner ${isReserveForTarget ? 'bg-violet-600 text-white' : currentSv ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                    {currentSv ? <ArrowRightLeft size={28}/> : <UserCheck size={28}/>}
                                 </div>
                                 <div className="text-right">
                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                      {isReserveForTarget && <span className="px-3 py-1 rounded-full bg-violet-600 text-white text-[9px] font-black">احتياط هذه اللجنة</span>}
                                      <p className="font-black text-xl text-slate-800 leading-none">{u.full_name}</p>
                                    </div>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                       {isReserveForTarget ? 'مرشح من الاحتياط الذكي لنفس اللجنة' : currentSv ? `سيتم نقله من لجنة ${currentSv.committee_number}` : 'مراقب متاح وجاهز للبدء'}
                                    </p>
                                 </div>
                              </div>
                              <div className="hidden md:flex flex-col gap-2 text-[10px] font-black text-slate-500">
                                <span className="px-3 py-1 rounded-full bg-white border border-slate-100">مسند: {totalAssignments}</span>
                                <span className="px-3 py-1 rounded-full bg-white border border-slate-100">احتياط: {reserveAssignments}</span>
                                <span className="px-3 py-1 rounded-full bg-white border border-slate-100">باشر: {startedAssignments}</span>
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

      {activeTab === 'ops-center' && (
        <div className="space-y-8 animate-slide-up">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            {performanceStats.map(item => (
              <div key={item.label} className="bg-white rounded-[2.5rem] p-6 border border-slate-100 shadow-xl flex items-center gap-5">
                <div className={`p-4 rounded-2xl ${item.color}`}><item.icon size={28} /></div>
                <div>
                  <p className="text-4xl font-black text-slate-950 tabular-nums">{item.value}</p>
                  <p className="text-xs font-black text-slate-500 mt-1">{item.label}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            <div className="xl:col-span-1 space-y-5">
              <div className="bg-slate-950 text-white rounded-[3rem] p-7 shadow-2xl">
                <h3 className="text-2xl font-black mb-5 flex items-center gap-3"><Siren className="text-red-400" /> التنبيهات الذكية</h3>
                <div className="space-y-3">
                  {smartAlerts.map((a, i) => (
                    <div key={i} className={`p-4 rounded-2xl border ${a.level === 'red' ? 'bg-red-500/10 border-red-500/20 text-red-100' : a.level === 'amber' ? 'bg-orange-500/10 border-orange-500/20 text-orange-100' : 'bg-blue-500/10 border-blue-500/20 text-blue-100'}`}>
                      <p className="font-black">{a.title}</p>
                      <p className="text-xs font-bold opacity-80 mt-1">{a.text}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-[3rem] p-7 border border-slate-100 shadow-xl">
                <div className="flex items-center justify-between gap-3 mb-5">
                  <h3 className="text-xl font-black text-slate-900 flex items-center gap-3"><History className="text-blue-600" /> سجل التدقيق</h3>
                  <button onClick={() => { localStorage.removeItem('control_audit_events'); setAuditEvents([]); }} className="px-3 py-2 rounded-xl bg-slate-100 text-slate-500 text-[10px] font-black">مسح</button>
                </div>
                <div className="space-y-3 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                  {auditEvents.length ? auditEvents.slice(0, 8).map(event => (
                    <div key={event.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-black text-slate-900">{event.action}</p>
                        <span className="text-[10px] font-mono text-slate-400">{new Date(event.time).toLocaleString('ar-SA')}</span>
                      </div>
                      <p className="text-xs font-bold text-slate-500 mt-1">{event.detail}</p>
                    </div>
                  )) : (
                    <p className="text-center py-8 text-slate-400 font-black">لا توجد عمليات مسجلة بعد.</p>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-[3rem] p-7 border border-slate-100 shadow-xl">
                <h3 className="text-xl font-black text-slate-900 mb-5 flex items-center gap-3"><WifiOff className="text-orange-500" /> وضع الطوارئ</h3>
                <p className="text-sm font-bold text-slate-500 leading-7">عند انقطاع الإنترنت تحفظ شاشة المراقب التغييرات محليًا وتزامنها عند عودة الاتصال. استخدم النسخ الاحتياطي قبل بدء يوم جديد.</p>
                <button onClick={exportTodayBackup} className="mt-5 w-full bg-slate-950 text-white py-4 rounded-2xl font-black flex items-center justify-center gap-2"><FileDown size={18} /> تصدير نسخة الآن</button>
              </div>
            </div>

            <div className="xl:col-span-2 grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white rounded-[3rem] p-7 border border-slate-100 shadow-xl min-h-[520px]">
                <h3 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3"><History className="text-blue-600" /> سجل العمليات الزمني</h3>
                <div className="space-y-4 max-h-[430px] overflow-y-auto custom-scrollbar pr-2">
                  {timeline.map((item, i) => (
                    <div key={i} className="flex gap-4">
                      <div className="w-3 flex flex-col items-center">
                        <div className="w-3 h-3 rounded-full bg-blue-600 mt-2"></div>
                        <div className="w-px flex-1 bg-slate-200"></div>
                      </div>
                      <div className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl p-4">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[10px] font-black text-blue-600">{item.type}</span>
                          <span className="text-[10px] font-mono text-slate-400">{new Date(item.time).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="font-black text-slate-900 mt-1">{item.title}</p>
                        <p className="text-xs font-bold text-slate-500 truncate">{item.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-[3rem] p-7 border border-slate-100 shadow-xl min-h-[520px]">
                <h3 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-3"><MessageCircle className="text-red-600" /> مركز البلاغات</h3>
                <div className="space-y-4 max-h-[430px] overflow-y-auto custom-scrollbar pr-2">
                  {visibleRequests.length ? visibleRequests.slice(0, 16).map(req => (
                    <div key={req.id} className={`p-5 rounded-2xl border ${req.status === 'DONE' ? 'bg-emerald-50 border-emerald-100' : req.status === 'IN_PROGRESS' ? 'bg-blue-50 border-blue-100' : 'bg-red-50 border-red-100'}`}>
                      <div className="flex items-center justify-between">
                        <span className="bg-slate-950 text-white px-3 py-1 rounded-xl text-xs font-black">لجنة {req.committee}</span>
                        <span className="text-[10px] font-black text-slate-500">{req.status === 'DONE' ? 'مغلق' : req.status === 'IN_PROGRESS' ? 'قيد المتابعة' : 'عاجل'}</span>
                      </div>
                      <p className="font-black text-slate-900 mt-3 leading-7">{cleanControlRequestText(req.text)}</p>
                      <p className="text-xs font-bold text-slate-500 mt-2">{req.from} - {new Date(req.time).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  )) : <p className="text-center text-slate-300 font-black py-20">لا توجد بلاغات مسجلة.</p>}
                </div>
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
                                    await supabase.from('users').update({ assigned_committees: updated }).eq('id', user.id);
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
           <div className="bg-slate-950 text-white p-8 rounded-[3rem] shadow-2xl border border-white/10">
             <h3 className="text-3xl font-black mb-6 flex items-center gap-3"><Wand2 className="text-orange-300" /> قوالب بث إعلامي محسّنة</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
               {broadcastTemplates.map(t => (
                 <button key={t.title} onClick={() => { setBroadcastTone(t.tone as any); setBroadcastMsg(t.msg); }} className="p-4 rounded-2xl bg-white/5 border border-white/10 text-right hover:bg-white/10 transition-all">
                   <p className="font-black">{t.title}</p>
                   <p className="text-[10px] font-bold text-slate-400 mt-1 line-clamp-2">{t.msg}</p>
                 </button>
               ))}
             </div>
             <div className="flex flex-wrap gap-2 mb-6">
               {[
                 { id: 'INFO', label: 'معلومة' },
                 { id: 'URGENT', label: 'عاجل' },
                 { id: 'REMINDER', label: 'تذكير' },
                 { id: 'THANKS', label: 'شكر' },
               ].map(t => (
                 <button key={t.id} onClick={() => setBroadcastTone(t.id as any)} className={`px-5 py-3 rounded-2xl text-xs font-black border transition-all ${broadcastTone === t.id ? 'bg-orange-500 border-orange-500 text-white' : 'border-white/10 text-slate-400 hover:bg-white/5'}`}>{t.label}</button>
               ))}
             </div>
             {broadcastMsg.trim() && (
               <div className="p-5 rounded-2xl bg-white/5 border border-white/10">
                 <p className="text-[10px] font-black text-orange-300 mb-1">معاينة صياغة الرسالة قبل البث</p>
                 <p className="font-black leading-7">{formatBroadcast(broadcastMsg)}</p>
               </div>
             )}
           </div>
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
                 <button onClick={() => { if(broadcastMsg.trim()) { onBroadcast(formatBroadcast(broadcastMsg), broadcastTarget); addAuditEvent('بث إعلامي', `تم بث رسالة إلى ${broadcastTarget}`); setBroadcastMsg(''); alert('تم بث الرسالة بنجاح'); } }} disabled={!broadcastMsg.trim()} className="w-full py-8 bg-blue-600 text-white rounded-[2.5rem] font-black text-2xl flex items-center justify-center gap-6 shadow-2xl hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50">
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
