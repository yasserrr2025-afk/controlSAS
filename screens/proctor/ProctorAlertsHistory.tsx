
import React, { useMemo, useState } from 'react';
import { ControlRequest, DeliveryLog, Supervision } from '../../types';
import {
  History, Clock, CheckCircle2, Timer, UserCheck, Ghost,
  BarChart3, Circle, ChevronDown, ChevronUp,
  MessageSquare, Stethoscope, FileText, Pencil, UserSearch, Package,
  TrendingUp, ArrowRight
} from 'lucide-react';

interface Props {
  requests: ControlRequest[];
  userFullName: string;
  deliveryLogs: DeliveryLog[];
  supervisions: Supervision[];
  systemConfig: { active_exam_date?: string };
}

/* ── تصنيف النوع ── */
const CATEGORY_MAP: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  'ورقة إجابة':  { label: 'ورقة إجابة',   icon: FileText,      color: 'text-blue-600',    bg: 'bg-blue-50 border-blue-100' },
  'معلم المادة': { label: 'معلم المادة',   icon: UserSearch,    color: 'text-purple-600',  bg: 'bg-purple-50 border-purple-100' },
  'مرسام':       { label: 'أدوات رسم',     icon: Pencil,        color: 'text-amber-600',   bg: 'bg-amber-50 border-amber-100' },
  'ورقة أسئلة': { label: 'ورقة أسئلة',   icon: FileText,      color: 'text-indigo-600',  bg: 'bg-indigo-50 border-indigo-100' },
  'صحية':        { label: 'حالة صحية 🚨',  icon: Stethoscope,   color: 'text-red-600',     bg: 'bg-red-50 border-red-100' },
  'إنهاء':       { label: 'إنهاء اللجنة', icon: Package,       color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
  'متجه':        { label: 'إنهاء اللجنة', icon: Package,       color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
  'default':     { label: 'بلاغ عام',      icon: MessageSquare, color: 'text-slate-600',   bg: 'bg-slate-50 border-slate-100' },
};
function getCategoryMeta(text: string) {
  for (const key of Object.keys(CATEGORY_MAP)) {
    if (key !== 'default' && text.includes(key)) return CATEGORY_MAP[key];
  }
  return CATEGORY_MAP['default'];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
}

const ProctorAlertsHistory: React.FC<Props> = ({ requests, userFullName, deliveryLogs, supervisions, systemConfig }) => {
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'IN_PROGRESS' | 'DONE'>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const todayDate = systemConfig?.active_exam_date
    ? systemConfig.active_exam_date.split('T')[0]
    : new Date().toISOString().split('T')[0];

  /* ── تحديد متى تكون اللجنة مستلمة فعلاً من الكنترول ── */
  const confirmedCommittees = useMemo(() => {
    const set = new Set<string>();
    deliveryLogs.forEach(l => {
      if (l.status === 'CONFIRMED' && l.type === 'RECEIVE') {
        set.add(l.committee_number);
      }
    });
    return set;
  }, [deliveryLogs]);

  /* ── تحديد الحالة الفعلية لكل طلب ── */
  const myHistory = useMemo(() => {
    return requests
      .filter(r => r.from === userFullName)
      .map(r => {
        // إذا كانت رسالة إنهاء لجنة وتم استلامها من الكنترول → مكتمل
        const isClosureMsg = r.text.includes('متجه') || r.text.includes('إنهاء') || r.text.includes('أنهى رصد');
        const effectiveStatus = isClosureMsg && confirmedCommittees.has(r.committee)
          ? 'DONE'
          : r.status;
        return { ...r, effectiveStatus };
      })
      .sort((a, b) => b.time.localeCompare(a.time));
  }, [requests, userFullName, confirmedCommittees]);

  const stats = useMemo(() => ({
    total:       myHistory.length,
    done:        myHistory.filter(r => r.effectiveStatus === 'DONE').length,
    pending:     myHistory.filter(r => r.effectiveStatus === 'PENDING').length,
    in_progress: myHistory.filter(r => r.effectiveStatus === 'IN_PROGRESS').length,
    committees:  new Set(myHistory.map(r => r.committee)).size,
  }), [myHistory]);

  const filtered = useMemo(() => {
    if (filterStatus === 'ALL') return myHistory;
    return myHistory.filter(r => r.effectiveStatus === filterStatus);
  }, [myHistory, filterStatus]);

  /* ── تجميع حسب اليوم ── */
  const grouped = useMemo(() => {
    const groups: Record<string, typeof myHistory> = {};
    for (const req of filtered) {
      const day = req.time.split('T')[0];
      if (!groups[day]) groups[day] = [];
      groups[day].push(req);
    }
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-8 animate-fade-in text-right" dir="rtl">

      {/* ── الهيدر ── */}
      <div className="bg-slate-950 p-8 md:p-10 rounded-[3.5rem] text-white shadow-2xl relative overflow-hidden border-b-[8px] border-blue-600">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-600/10 blur-[80px] rounded-full pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="bg-blue-600 p-4 rounded-[1.5rem] shadow-2xl ring-4 ring-blue-500/20 shrink-0">
              <History size={36} />
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-black tracking-tighter">أرشيف البلاغات الميدانية</h2>
              <p className="text-slate-400 font-bold text-xs italic mt-1 uppercase tracking-widest">تتبع سجل طلباتك والمباشرات السابقة</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-5 py-4 rounded-2xl shrink-0">
            <BarChart3 size={20} className="text-blue-400" />
            <div className="text-right">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">إجمالي البلاغات</p>
              <p className="text-3xl font-black tabular-nums text-white">{stats.total}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── إحصائيات ── */}
      {stats.total > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'مكتملة',       value: stats.done,        icon: CheckCircle2, grad: 'from-emerald-500 to-emerald-600', shadow: 'shadow-emerald-500/20' },
            { label: 'في الانتظار',  value: stats.pending,     icon: Clock,        grad: 'from-amber-500 to-amber-600',    shadow: 'shadow-amber-500/20' },
            { label: 'قيد المتابعة', value: stats.in_progress, icon: Timer,        grad: 'from-blue-500 to-blue-700',      shadow: 'shadow-blue-500/20' },
            { label: 'لجان مختلفة', value: stats.committees,   icon: TrendingUp,   grad: 'from-slate-700 to-slate-900',    shadow: 'shadow-slate-500/20' },
          ].map(s => (
            <div key={s.label} className={`bg-gradient-to-br ${s.grad} text-white p-6 rounded-[2.5rem] shadow-xl ${s.shadow} flex flex-col gap-3`}>
              <s.icon size={26} className="opacity-80" />
              <div>
                <p className="text-5xl font-black tabular-nums leading-none">{s.value}</p>
                <p className="text-[10px] font-black uppercase tracking-widest opacity-70 mt-1.5">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── فلاتر الحالة ── */}
      {stats.total > 0 && (
        <div className="bg-white p-2 rounded-full shadow-md border border-slate-100 flex gap-2 overflow-x-auto">
          {([
            { id: 'ALL',         label: `الكل (${stats.total})`,               color: 'bg-slate-900 text-white' },
            { id: 'DONE',        label: `مكتمل (${stats.done})`,               color: 'bg-emerald-500 text-white' },
            { id: 'IN_PROGRESS', label: `قيد المتابعة (${stats.in_progress})`, color: 'bg-blue-600 text-white' },
            { id: 'PENDING',     label: `انتظار (${stats.pending})`,          color: 'bg-amber-500 text-white' },
          ] as const).map(f => (
            <button
              key={f.id}
              onClick={() => setFilterStatus(f.id)}
              className={`flex-1 min-w-[90px] py-3 px-3 rounded-full font-black text-sm transition-all whitespace-nowrap text-center ${filterStatus === f.id ? f.color + ' shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* ── القائمة المجمعة ── */}
      <div className="space-y-10">
        {grouped.length === 0 ? (
          <div className="py-32 text-center bg-white rounded-[4rem] border-4 border-dashed border-slate-100 flex flex-col items-center gap-6 shadow-inner">
            <Ghost size={80} className="text-slate-200" />
            <div>
              <p className="text-2xl font-black text-slate-300 italic">لا توجد بلاغات</p>
              <p className="text-sm font-bold text-slate-300 mt-2">لا يوجد أي سجل يطابق الفلتر المحدد</p>
            </div>
          </div>
        ) : (
          grouped.map(([day, dayReqs]) => (
            <div key={day} className="space-y-4">
              {/* عنوان اليوم */}
              <div className="flex items-center gap-4">
                <div className="h-px flex-1 bg-slate-100" />
                <div className="bg-slate-900 text-white px-5 py-2 rounded-full text-xs font-black uppercase tracking-widest shadow flex items-center gap-2">
                  <Circle size={8} className="fill-blue-400 text-blue-400" />
                  {formatDate(dayReqs[0].time)}
                </div>
                <div className="h-px flex-1 bg-slate-100" />
              </div>

              {/* بلاغات اليوم */}
              <div className="space-y-4">
                {dayReqs.map((req) => {
                  const meta = getCategoryMeta(req.text);
                  const st = req.effectiveStatus;
                  const isExpanded = expandedId === req.id;
                  const MetaIcon = meta.icon;

                  const statusStyle = st === 'DONE'
                    ? { bar: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700', label: 'مكتمل ✓', iconEl: <CheckCircle2 size={18} className="text-emerald-600" /> }
                    : st === 'IN_PROGRESS'
                    ? { bar: 'bg-blue-500', badge: 'bg-blue-100 text-blue-700', label: 'قيد المتابعة', iconEl: <Timer size={18} className="text-blue-600 animate-spin-slow" /> }
                    : { bar: 'bg-amber-400', badge: 'bg-amber-100 text-amber-700', label: 'في الانتظار', iconEl: <Clock size={18} className="text-amber-600" /> };

                  return (
                    <div
                      key={req.id}
                      className={`bg-white rounded-[2.5rem] border transition-all duration-300 overflow-hidden group relative
                        ${st === 'DONE' ? 'border-emerald-100 shadow-lg shadow-emerald-500/5' : st === 'IN_PROGRESS' ? 'border-blue-100 shadow-lg shadow-blue-500/5' : 'border-slate-100 shadow-md'}
                        hover:shadow-xl`}
                    >
                      {/* شريط الحالة الجانبي */}
                      <div className={`absolute top-0 right-0 bottom-0 w-1.5 rounded-r-[2.5rem] ${statusStyle.bar}`} />

                      {/* الجزء الرئيسي القابل للنقر */}
                      <button
                        className="w-full px-6 md:px-8 py-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-right"
                        onClick={() => setExpandedId(isExpanded ? null : req.id)}
                      >
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          {/* أيقونة نوع البلاغ */}
                          <div className={`w-14 h-14 rounded-[1.2rem] flex items-center justify-center shrink-0 border ${meta.bg} ${meta.color} shadow-sm`}>
                            <MetaIcon size={24} />
                          </div>

                          <div className="flex-1 min-w-0">
                            {/* الوسوم */}
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <span className="bg-slate-900 text-white px-3 py-1 rounded-lg font-black text-[10px] tabular-nums">لجنة {req.committee}</span>
                              <span className={`px-3 py-1 rounded-lg font-black text-[9px] uppercase tracking-widest ${statusStyle.badge}`}>
                                {statusStyle.label}
                              </span>
                              <span className={`px-3 py-1 rounded-lg font-black text-[9px] border ${meta.bg} ${meta.color}`}>
                                {meta.label}
                              </span>
                            </div>
                            {/* نص البلاغ */}
                            <p className="text-sm md:text-base font-black text-slate-800 leading-snug line-clamp-1 group-hover:text-blue-700 transition-colors">
                              {req.text}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 shrink-0 border-t md:border-t-0 md:border-r border-slate-50 pt-4 md:pt-0 md:pr-6 w-full md:w-auto">
                          <div className="text-right flex-1 md:flex-none">
                            <p className="text-sm font-black text-slate-700 font-mono">{formatTime(req.time)}</p>
                            {req.assistant_name && (
                              <p className="text-[10px] font-bold text-blue-500 mt-0.5 flex items-center gap-1">
                                <UserCheck size={11} /> {req.assistant_name}
                              </p>
                            )}
                          </div>
                          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${st === 'DONE' ? 'bg-emerald-50' : st === 'IN_PROGRESS' ? 'bg-blue-50' : 'bg-amber-50'}`}>
                            {statusStyle.iconEl}
                          </div>
                          <div className="text-slate-300">
                            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                          </div>
                        </div>
                      </button>

                      {/* ── التفاصيل الموسعة ── */}
                      {isExpanded && (
                        <div className="px-6 md:px-8 pb-8 border-t border-slate-50 pt-6 space-y-5 animate-slide-up">

                          {/* نص البلاغ كاملاً */}
                          <div className="bg-slate-50 rounded-[1.5rem] p-5 border border-slate-100">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">نص البلاغ الكامل</p>
                            <p className="text-sm font-bold text-slate-700 leading-relaxed">{req.text}</p>
                          </div>

                          {/* بطاقات المعلومات */}
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div className="bg-white border border-slate-100 rounded-[1.5rem] p-5 shadow-sm">
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">وقت الإرسال</p>
                              <p className="text-xl font-black text-slate-800 font-mono">{formatTime(req.time)}</p>
                              <p className="text-[10px] font-bold text-slate-400 mt-0.5">{formatDate(req.time)}</p>
                            </div>
                            <div className="bg-white border border-slate-100 rounded-[1.5rem] p-5 shadow-sm">
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">رقم اللجنة</p>
                              <p className="text-4xl font-black text-slate-900 tabular-nums">{req.committee}</p>
                            </div>
                            <div className="col-span-2 md:col-span-1 bg-white border border-slate-100 rounded-[1.5rem] p-5 shadow-sm">
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">المتابع من الكنترول</p>
                              {req.assistant_name ? (
                                <div className="flex items-center gap-2 mt-1">
                                  <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center"><UserCheck size={16} className="text-blue-600" /></div>
                                  <p className="text-sm font-black text-blue-700">{req.assistant_name}</p>
                                </div>
                              ) : (
                                <p className="text-sm font-bold text-slate-300 mt-1 italic">لم يُتابع بعد</p>
                              )}
                            </div>
                          </div>

                          {/* شريط تتبع التقدم */}
                          <div className="bg-slate-50 rounded-[1.5rem] p-5 border border-slate-100">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-5">مسار حالة البلاغ</p>
                            <div className="flex items-start gap-0 w-full">
                              {(['PENDING', 'IN_PROGRESS', 'DONE'] as const).map((step, i) => {
                                const LABELS = { PENDING: 'أُرسل', IN_PROGRESS: 'جاري المتابعة', DONE: 'مكتمل' };
                                const steps = ['PENDING', 'IN_PROGRESS', 'DONE'];
                                const currentIdx = steps.indexOf(st);
                                const stepIdx = steps.indexOf(step);
                                const isPast   = stepIdx <= currentIdx;
                                const isActive = step === st;
                                return (
                                  <React.Fragment key={step}>
                                    <div className="flex flex-col items-center gap-2 shrink-0">
                                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm border-2 transition-all ${isActive ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30' : isPast ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white border-slate-200 text-slate-300'}`}>
                                        {isPast && !isActive ? <CheckCircle2 size={18} /> : i + 1}
                                      </div>
                                      <p className={`text-[9px] font-black text-center whitespace-nowrap ${isPast ? 'text-slate-600' : 'text-slate-300'}`}>{LABELS[step]}</p>
                                    </div>
                                    {i < 2 && (
                                      <div className={`flex-1 h-0.5 mx-2 mt-5 transition-all ${stepIdx < currentIdx ? 'bg-emerald-400' : 'bg-slate-200'}`} />
                                    )}
                                  </React.Fragment>
                                );
                              })}
                            </div>
                          </div>

                          {/* رسالة الاكتمال عند الانتهاء */}
                          {st === 'DONE' && (
                            <div className="bg-emerald-50 border border-emerald-100 rounded-[1.5rem] p-5 flex items-center gap-4">
                              <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20">
                                <CheckCircle2 size={24} className="text-white" />
                              </div>
                              <div>
                                <p className="text-sm font-black text-emerald-800">تم إغلاق هذا البلاغ بنجاح</p>
                                <p className="text-[10px] font-bold text-emerald-600 mt-0.5">
                                  {req.assistant_name ? `تمت المتابعة بواسطة: ${req.assistant_name}` : 'تم تأكيد الاستلام من الكنترول'}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      <style>{`
        @keyframes fade-in  { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        @keyframes slide-up { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .animate-fade-in   { animation: fade-in  0.4s ease-out; }
        .animate-slide-up  { animation: slide-up 0.3s ease-out; }
        .animate-spin-slow { animation: spin 3s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .line-clamp-1 { overflow:hidden; display:-webkit-box; -webkit-line-clamp:1; -webkit-box-orient:vertical; }
      `}</style>
    </div>
  );
};

export default ProctorAlertsHistory;
