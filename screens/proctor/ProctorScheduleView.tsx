import React, { useMemo } from 'react';
import { CalendarDays, CheckCircle2, Clock, ListChecks, ShieldCheck, UserPlus } from 'lucide-react';
import { Supervision, SystemConfig, User } from '../../types';

interface Props {
  user: User;
  supervisions: Supervision[];
  systemConfig: SystemConfig;
}

const dateKey = (value: string) => (value || '').slice(0, 10);
const isReserveAssignment = (item: Supervision) => String(item.subject || '').includes('[RESERVE]');
const cleanSubject = (subject?: string) => String(subject || 'اختبار').replace('[RESERVE]', '').trim() || 'اختبار';

const formatDate = (value: string) => {
  const key = dateKey(value);
  if (!key) return 'غير محدد';
  return new Date(`${key}T12:00:00`).toLocaleDateString('ar-SA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const isStartedAssignment = (value: string) => {
  const d = new Date(value);
  return value && !Number.isNaN(d.getTime()) && !(d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0);
};

const formatTime = (value: string) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'غير محدد';
  return d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
};

const ProctorScheduleView: React.FC<Props> = ({ user, supervisions, systemConfig }) => {
  const today = systemConfig?.active_exam_date || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
  const myAssignments = useMemo(
    () =>
      supervisions
        .filter(item => item.teacher_id === user.id)
        .sort((a, b) => {
          const byDate = dateKey(a.date).localeCompare(dateKey(b.date));
          if (byDate !== 0) return byDate;
          if (isReserveAssignment(a) !== isReserveAssignment(b)) return isReserveAssignment(a) ? 1 : -1;
          return Number(a.committee_number) - Number(b.committee_number);
        }),
    [supervisions, user.id],
  );

  const todayAssignments = myAssignments.filter(item => dateKey(item.date) === today);
  const primaryAssignments = myAssignments.filter(item => !isReserveAssignment(item));
  const reserveAssignments = myAssignments.filter(isReserveAssignment);
  const startedAssignments = primaryAssignments.filter(item => isStartedAssignment(item.date));
  const emergencyAssignments = primaryAssignments.filter(item => String(item.subject || '').includes('بديل'));

  const stats = [
    { label: 'إسنادات أساسية', value: primaryAssignments.length, icon: ListChecks, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'مباشرات فعلية', value: startedAssignments.length, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'تكليفات اليوم', value: todayAssignments.length, icon: ShieldCheck, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'احتياط', value: reserveAssignments.length, icon: UserPlus, color: 'text-violet-600', bg: 'bg-violet-50' },
  ];

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <div className="rounded-[3rem] bg-gradient-to-br from-[#0a1628] to-[#0f172a] text-white p-8 md:p-10 shadow-2xl overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,.32),transparent_38%),radial-gradient(circle_at_80%_10%,rgba(16,185,129,.24),transparent_34%),radial-gradient(circle_at_60%_80%,rgba(139,92,246,.18),transparent_40%)]" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm text-xs font-black text-blue-100 mb-5 shadow-lg">
              <CalendarDays size={16} />
              جدول مراقبتي
            </div>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight">مواعيد اللجان والتكليفات المسندة لك</h1>
            <p className="mt-4 text-sm md:text-base font-bold text-slate-300 max-w-2xl leading-relaxed">
              تظهر هنا اللجان الأساسية والاحتياط بوضوح، حتى يعرف كل مراقب تكليفه الفعلي أو جاهزيته كاحتياط في كل يوم وفترة.
            </p>
          </div>
          <div className="rounded-[2rem] bg-white/10 border border-white/20 backdrop-blur-sm p-5 min-w-[220px] shadow-xl">
            <p className="text-[11px] font-black text-slate-400">المراقب</p>
            <p className="text-xl font-black mt-1">{user.full_name}</p>
            <p className="text-xs font-bold text-slate-400 mt-3">تاريخ النظام النشط: {today}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map(item => (
          <div key={item.label} className="bg-white rounded-[2rem] border border-slate-100 shadow-md p-6 flex items-center justify-between gap-4 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
            <div>
              <p className="text-[11px] font-black text-slate-400 tracking-tight">{item.label}</p>
              <p className="text-4xl font-black text-slate-950 mt-2 tabular-nums">{item.value}</p>
            </div>
            <div className={`w-14 h-14 rounded-2xl ${item.bg} ${item.color} flex items-center justify-center shadow-sm`}>
              <item.icon size={26} />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-[3rem] border border-slate-100 shadow-xl overflow-hidden">
        <div className="p-6 md:p-8 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-950">تفاصيل الإسناد</h2>
            <p className="text-xs font-bold text-slate-400 mt-1">مرتب حسب التاريخ، والاحتياط يظهر بلون مستقل حتى لا يختلط مع اللجنة الأساسية.</p>
          </div>
          <div className="px-4 py-2 rounded-full bg-gradient-to-r from-slate-100 to-slate-200 border border-slate-200 text-slate-600 text-xs font-black shadow-sm">
            بداية الجلسة: {systemConfig?.exam_start_time || '08:00'}
          </div>
        </div>

        <div className="p-4 md:p-6 space-y-3">
          {myAssignments.length ? myAssignments.map(item => {
            const key = dateKey(item.date);
            const isToday = key === today;
            const isPast = key < today;
            const isReserve = isReserveAssignment(item);
            const isEmergency = String(item.subject || '').includes('بديل');
            const isStarted = !isReserve && isStartedAssignment(item.date);
            const status = isReserve ? 'احتياط' : isEmergency ? 'بديل طارئ' : isStarted ? 'تمت المباشرة' : isToday ? 'لجنة اليوم' : isPast ? 'منتهية' : 'قادمة';

            return (
              <div
                key={item.id}
                className={`grid grid-cols-1 lg:grid-cols-[1.2fr_.8fr_.8fr_.8fr] gap-4 p-5 rounded-[2rem] border transition-all duration-200 hover:scale-[1.01] hover:shadow-md ${
                  isReserve
                    ? 'bg-gradient-to-br from-violet-50 to-purple-50 border-violet-200 shadow-md shadow-violet-100'
                    : isToday
                    ? 'bg-gradient-to-br from-blue-50 to-sky-50 border-blue-200 shadow-md shadow-blue-100'
                    : 'bg-slate-50/80 border-slate-100 hover:bg-blue-50/30'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm ${
                    isReserve
                      ? 'bg-gradient-to-br from-violet-500 to-purple-600 text-white'
                      : isToday
                      ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white'
                      : 'bg-white border border-slate-100 text-slate-500'
                  }`}>
                    {isToday && !isReserve ? <CheckCircle2 size={26} /> : <Clock size={26} />}
                  </div>
                  <div>
                    <p className="text-sm font-black tracking-tight text-slate-950">{formatDate(item.date)}</p>
                    <p className="text-[11px] font-bold text-slate-400 mt-1">{key}</p>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400">{isReserve ? 'احتياط على لجنة' : 'اللجنة'}</p>
                  <p className="text-3xl font-black text-slate-950 tabular-nums">{item.committee_number}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400">المادة / الفترة</p>
                  <p className="font-black text-slate-900">{cleanSubject(item.subject).replace(' - بديل طارئ', '')} - فترة {item.period || 1}</p>
                  <p className={`text-[11px] font-black mt-2 ${isStarted ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {isReserve ? `أنت احتياط لهذه اللجنة، وسيتم استدعاؤك عند الحاجة. لا يظهر الاحتياط في التقرير الرسمي.` : isStarted ? `وقت المباشرة: ${formatTime(item.date)}` : 'لم تعتمد المباشرة بعد'}
                  </p>
                </div>
                <div className="flex lg:justify-end items-center">
                  <span className={`px-4 py-2 rounded-full border text-xs font-black transition-all active:scale-[0.98] ${
                    isReserve
                      ? 'bg-gradient-to-r from-violet-500 to-purple-600 border-violet-400 text-white shadow-sm'
                      : isEmergency
                      ? 'bg-gradient-to-r from-amber-400 to-amber-500 border-amber-400 text-white shadow-sm'
                      : isStarted
                      ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 border-emerald-400 text-white shadow-sm'
                      : isToday
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 border-blue-400 text-white shadow-sm'
                      : isPast
                      ? 'bg-slate-100 border-slate-200 text-slate-500'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  }`}>
                    {status}
                  </span>
                </div>
              </div>
            );
          }) : (
            <div className="p-12 text-center rounded-[2rem] bg-slate-50/80 border border-dashed border-slate-200">
              <div className="w-20 h-20 rounded-[1.5rem] bg-white border border-slate-100 shadow-sm flex items-center justify-center mx-auto mb-5">
                <CalendarDays size={40} className="text-slate-300" />
              </div>
              <p className="text-xl font-black tracking-tight text-slate-600">لا توجد لجان أو احتياط مسندة لك حتى الآن</p>
              <p className="text-sm font-bold text-slate-400 mt-2">عند اعتماد التوزيع الذكي ستظهر هنا تلقائياً.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProctorScheduleView;
