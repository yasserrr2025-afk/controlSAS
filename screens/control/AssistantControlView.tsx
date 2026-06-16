import React, { useMemo, useState, useEffect, useRef } from 'react';
import { User, ControlRequest, Absence, Student } from '../../types';
import {
  AlertOctagon,
  ArrowRightCircle,
  BellRing,
  Check,
  CheckCircle,
  ChevronLeft,
  CircleDot,
  Clock,
  Fingerprint,
  Gauge,
  HelpCircle,
  Inbox,
  Layers,
  ListChecks,
  MapPin,
  Navigation,
  Search,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserX,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { db } from '../../supabase';
import TeacherBadgeView from '../proctor/TeacherBadgeView';
import { useNotificationSound } from '../../hooks/useNotificationSound';
import { getAbsenceKindLabel, getAbsenceReceipt } from '../../services/absenceReceipt';
import { cleanControlRequestText, isInternalSignatureRecord, isSignatureRequest } from '../../services/signatures';

interface Props {
  user: User;
  requests?: ControlRequest[];
  setRequests: () => Promise<void>;
  absences?: Absence[];
  students?: Student[];
  onAlert: (msg: string, type: string) => void;
  users?: User[];
  onAcknowledgeAbsence: (absence: Absence) => Promise<void>;
}

type AssistantTab = 'MISSION_CONTROL' | 'PRIORITIES' | 'TEAM_RADAR' | 'FIELD_LOGS';

const urgentWords = ['طارئ', 'صحي', 'إسعاف', 'إغماء', 'عاجل', 'نزيف', 'مرض', 'تعب'];

const formatTime = (value?: string) => {
  if (!value) return '--:--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
};

const minutesSince = (value?: string) => {
  if (!value) return 0;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
};

const isUrgentRequest = (request: ControlRequest) =>
  urgentWords.some(word => `${request.text} ${request.from}`.includes(word));

const AssistantControlView: React.FC<Props> = ({
  user,
  requests = [],
  setRequests,
  absences = [],
  students = [],
  onAlert,
  users = [],
  onAcknowledgeAbsence,
}) => {
  const [activeTab, setActiveTab] = useState<AssistantTab>('MISSION_CONTROL');
  const [showBadge, setShowBadge] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [fieldMode, setFieldMode] = useState(false);
  const [search, setSearch] = useState('');
  const [receivingAbsenceId, setReceivingAbsenceId] = useState<string | null>(null);
  const prevUrgentCount = useRef(0);
  const { playAlert } = useNotificationSound();

  const assignedCommittees = user.assigned_committees || [];

  const myRequests = useMemo(
    () => requests.filter(request => assignedCommittees.includes(request.committee) && !isInternalSignatureRecord(request) && !isSignatureRequest(request)),
    [requests, assignedCommittees],
  );

  const activeRequests = useMemo(() => {
    const query = search.trim();
    return myRequests
      .filter(request => request.status !== 'DONE')
      .filter(request => {
        if (!query) return true;
        return [request.committee, request.from, request.text, request.assistant_name]
          .some(value => String(value || '').includes(query));
      })
      .sort((a, b) => {
        const priorityA = isUrgentRequest(a) ? 2 : a.status === 'PENDING' ? 1 : 0;
        const priorityB = isUrgentRequest(b) ? 2 : b.status === 'PENDING' ? 1 : 0;
        if (priorityA !== priorityB) return priorityB - priorityA;
        return (b.time || '').localeCompare(a.time || '');
      });
  }, [myRequests, search]);

  const urgentCount = activeRequests.filter(request => request.status === 'PENDING').length;
  const inProgressCount = activeRequests.filter(request => request.status === 'IN_PROGRESS').length;

  useEffect(() => {
    if (!soundEnabled) return;
    if (urgentCount > prevUrgentCount.current) {
      playAlert('alert');
      onAlert(`بلاغ جديد في نطاق عملك: ${urgentCount} بلاغ معلق`, 'warning');
    }
    prevUrgentCount.current = urgentCount;
  }, [urgentCount, soundEnabled, onAlert, playAlert]);

  const myCommitteeAbsences = useMemo(() => {
    const query = search.trim();
    return absences
      .filter(absence => assignedCommittees.includes(absence.committee_number))
      .filter(absence => {
        if (!query) return true;
        const student = students.find(s => s.national_id === absence.student_id);
        return [
          absence.committee_number,
          absence.student_name,
          absence.student_id,
          student?.grade,
          student?.section,
        ].some(value => String(value || '').includes(query));
      })
      .sort((a, b) => {
        const receiptA = getAbsenceReceipt(a) ? 1 : 0;
        const receiptB = getAbsenceReceipt(b) ? 1 : 0;
        if (receiptA !== receiptB) return receiptA - receiptB;
        return (b.date || '').localeCompare(a.date || '');
      });
  }, [absences, assignedCommittees, search, students]);

  const absenceStats = useMemo(() => {
    const total = myCommitteeAbsences.length;
    const absent = myCommitteeAbsences.filter(a => a.type === 'ABSENT').length;
    const late = myCommitteeAbsences.filter(a => a.type === 'LATE').length;
    const waitingReceipt = myCommitteeAbsences.filter(a => !getAbsenceReceipt(a)).length;
    return { total, absent, late, waitingReceipt };
  }, [myCommitteeAbsences]);

  const teamStatus = useMemo(() => {
    const fieldStaff = users.filter(member =>
      (member.role === 'ASSISTANT_CONTROL' || member.role === 'CONTROL') && member.id !== user.id
    );

    return fieldStaff.map(member => {
      const memberCommittees = member.assigned_committees || [];
      const visibleRequests = requests.filter(r => !isInternalSignatureRecord(r) && !isSignatureRequest(r));
      const activeTask = visibleRequests.find(r => r.assistant_name === member.full_name && r.status === 'IN_PROGRESS');
      const pendingInScope = visibleRequests.filter(r => memberCommittees.includes(r.committee) && r.status === 'PENDING').length;
      const completedByMember = visibleRequests.filter(r => r.assistant_name === member.full_name && r.status === 'DONE').length;
      return {
        ...member,
        activeTask,
        memberCommittees,
        pendingInScope,
        completedByMember,
        isBusy: !!activeTask,
      };
    });
  }, [users, requests, user.id]);

  const priorityItems = useMemo(() => {
    const requestItems = activeRequests.slice(0, 8).map(request => ({
      id: `request-${request.id}`,
      tone: isUrgentRequest(request) ? 'red' : request.status === 'PENDING' ? 'amber' : 'blue',
      title: `بلاغ لجنة ${request.committee}`,
      subtitle: cleanControlRequestText(request.text),
      meta: `${request.from} - منذ ${minutesSince(request.time)} دقيقة`,
      tab: 'MISSION_CONTROL' as AssistantTab,
    }));

    const absenceItems = myCommitteeAbsences
      .filter(absence => !getAbsenceReceipt(absence))
      .slice(0, 6)
      .map(absence => ({
        id: `absence-${absence.id}`,
        tone: absence.type === 'ABSENT' ? 'red' : 'amber',
        title: `${getAbsenceKindLabel(absence.type)} - لجنة ${absence.committee_number}`,
        subtitle: absence.student_name,
        meta: 'بانتظار تأكيد الاستلام قبل الاتصال',
        tab: 'FIELD_LOGS' as AssistantTab,
      }));

    return [...requestItems, ...absenceItems].slice(0, 10);
  }, [activeRequests, myCommitteeAbsences]);

  const acknowledgeAbsence = async (absence: Absence) => {
    setReceivingAbsenceId(absence.id);
    try {
      await onAcknowledgeAbsence(absence);
    } finally {
      setReceivingAbsenceId(null);
    }
  };

  const updateRequestStatus = async (requestId: string, newStatus: 'IN_PROGRESS' | 'DONE', committee: string) => {
    try {
      await db.controlRequests.updateStatus(requestId, newStatus, user.full_name);
      await setRequests();
      onAlert(`تم تحديث حالة اللجنة ${committee} بنجاح.`, 'success');
    } catch (err: any) {
      onAlert(`خطأ في التحديث: ${err.message}`, 'error');
    }
  };

  const StatTile = ({
    label,
    value,
    icon,
    tone,
  }: {
    label: string;
    value: number | string;
    icon: React.ReactNode;
    tone: string;
  }) => (
    <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-4 sm:p-5 shadow-inner">
      <div className={`mb-3 inline-flex h-10 w-10 items-center justify-center rounded-2xl ${tone}`}>
        {icon}
      </div>
      <p className="text-[10px] font-black text-slate-400">{label}</p>
      <p className="mt-1 text-3xl font-black tabular-nums text-white">{value}</p>
    </div>
  );

  if (showBadge) {
    return (
      <div className="animate-fade-in pb-32 text-right">
        <div className="mb-6 flex flex-col gap-3 px-2 sm:flex-row sm:items-center sm:justify-between sm:px-6 no-print">
          <h2 className="flex items-center gap-3 text-xl font-black text-slate-900 sm:text-2xl">
            <Fingerprint className="text-blue-600" /> الهوية الرقمية للمساعد
          </h2>
          <button onClick={() => setShowBadge(false)} className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-700 p-4 font-black text-white shadow-xl transition-all active:scale-[0.98]">
            <ChevronLeft size={20} /> رجوع للمهام
          </button>
        </div>
        <TeacherBadgeView user={user} />
      </div>
    );
  }

  const compact = fieldMode;

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-3 pb-32 text-right sm:px-5 lg:space-y-7" dir="rtl">
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#020817] via-[#0a1628] to-[#050d1a] p-5 text-white shadow-2xl sm:p-7 lg:p-8">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-l from-blue-500 via-cyan-400 to-emerald-400" />
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-blue-600/20 blur-[100px]" />

        <div className="relative z-10 grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="min-w-0">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-blue-600 shadow-xl shadow-blue-600/25">
                <Navigation size={28} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-300">مساعد الكنترول</p>
                <h2 className="text-2xl font-black tracking-tight sm:text-3xl lg:text-4xl">وحدة التدخل الميداني</h2>
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {assignedCommittees.length ? assignedCommittees.map(committee => (
                <span key={committee} className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-black text-slate-100">
                  <MapPin size={14} className="text-blue-300" /> لجنة {committee}
                </span>
              )) : (
                <span className="inline-flex items-center gap-2 rounded-2xl bg-amber-500/10 px-4 py-2 text-xs font-black text-amber-200">
                  <AlertOctagon size={14} /> لم تسند لك لجان حتى الآن
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:w-[34rem]">
            <StatTile label="بلاغات معلقة" value={urgentCount} icon={<BellRing size={20} />} tone="bg-red-500/15 text-red-200" />
            <StatTile label="قيد المعالجة" value={inProgressCount} icon={<Gauge size={20} />} tone="bg-blue-500/15 text-blue-200" />
            <StatTile label="غياب/تأخير" value={absenceStats.total} icon={<UserX size={20} />} tone="bg-amber-500/15 text-amber-200" />
            <StatTile label="بانتظار استلام" value={absenceStats.waitingReceipt} icon={<Inbox size={20} />} tone="bg-emerald-500/15 text-emerald-200" />
          </div>
        </div>
      </section>

      {(urgentCount > 0 || absenceStats.waitingReceipt > 0) && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-amber-900 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-sm font-black">
              <Sparkles size={18} />
              يوجد إجراء يحتاج انتباهك: {urgentCount} بلاغ معلق و {absenceStats.waitingReceipt} حالة تنتظر تأكيد الاستلام.
            </p>
            <button onClick={() => setActiveTab(urgentCount ? 'MISSION_CONTROL' : 'FIELD_LOGS')} className="rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 px-5 py-3 text-xs font-black text-white shadow-lg shadow-amber-500/20 transition-all active:scale-[0.98]">
              الذهاب للإجراء
            </button>
          </div>
        </div>
      )}

      <div className="sticky top-[calc(env(safe-area-inset-top)+84px)] z-40 -mx-3 bg-[#f8fafc]/90 px-3 py-2 backdrop-blur sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:py-0">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-center">
          <div className="flex gap-2 overflow-x-auto rounded-3xl border border-slate-100 bg-white p-2 shadow-sm">
            {[
              { id: 'MISSION_CONTROL' as AssistantTab, label: 'البلاغات', icon: BellRing },
              { id: 'PRIORITIES' as AssistantTab, label: 'الأولويات', icon: ListChecks },
              { id: 'TEAM_RADAR' as AssistantTab, label: 'الفريق', icon: Users },
              { id: 'FIELD_LOGS' as AssistantTab, label: 'الغياب', icon: UserX },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex min-w-[7rem] flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-xs font-black transition-all ${
                  activeTab === item.id ? 'bg-gradient-to-br from-[#020817] via-[#0a1628] to-[#050d1a] text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <item.icon size={17} /> {item.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="بحث: لجنة، طالب، مراقب، بلاغ..."
              className="w-full rounded-3xl border border-slate-100 bg-white py-4 pl-4 pr-11 text-sm font-bold outline-none focus:border-blue-400 lg:w-80"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setSoundEnabled(value => !value)}
              className={`flex h-12 w-12 items-center justify-center rounded-2xl border shadow-sm transition-all ${
                soundEnabled ? 'border-slate-100 bg-white text-slate-700' : 'border-red-100 bg-red-50 text-red-600'
              }`}
              title={soundEnabled ? 'كتم الإشعارات الصوتية' : 'تفعيل الإشعارات الصوتية'}
            >
              {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </button>
            <button
              onClick={() => setFieldMode(value => !value)}
              className={`rounded-2xl px-4 py-3 text-xs font-black shadow-sm transition-all ${
                fieldMode ? 'bg-blue-600 text-white' : 'border border-slate-100 bg-white text-slate-600'
              }`}
            >
              وضع ميداني
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'PRIORITIES' && (
        <section className="space-y-4 animate-slide-up">
          <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
            <div className="space-y-3">
              {priorityItems.length ? priorityItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.tab)}
                  className={`w-full rounded-3xl border p-4 text-right shadow-sm transition-all hover:-translate-y-0.5 ${
                    item.tone === 'red' ? 'border-red-100 bg-red-50' :
                    item.tone === 'amber' ? 'border-amber-100 bg-amber-50' :
                    'border-blue-100 bg-blue-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-base font-black text-slate-950">{item.title}</p>
                      <p className="mt-1 line-clamp-2 text-sm font-bold text-slate-600">{item.subtitle}</p>
                      <p className="mt-3 text-[11px] font-black text-slate-400">{item.meta}</p>
                    </div>
                    <ArrowRightCircle className="mt-1 shrink-0 text-slate-400" size={24} />
                  </div>
                </button>
              )) : (
                <EmptyState icon={<ShieldCheck size={82} />} title="لا توجد أولويات عاجلة" subtitle="الوضع مستقر داخل نطاق لجانك." />
              )}
            </div>

            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <h3 className="mb-5 flex items-center gap-2 text-lg font-black text-slate-900">
                <Layers className="text-blue-600" size={22} /> ملخص نطاقك
              </h3>
              <div className="space-y-3">
                <ProgressLine label="بلاغات لم تبدأ" value={urgentCount} total={Math.max(activeRequests.length, 1)} color="bg-red-500" />
                <ProgressLine label="بلاغات قيد المعالجة" value={inProgressCount} total={Math.max(activeRequests.length, 1)} color="bg-blue-500" />
                <ProgressLine label="حالات تنتظر الاستلام" value={absenceStats.waitingReceipt} total={Math.max(absenceStats.total, 1)} color="bg-emerald-500" />
              </div>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'TEAM_RADAR' && (
        <section className="space-y-4 animate-slide-up">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {teamStatus.length ? teamStatus.map(member => (
              <div key={member.id} className={`rounded-3xl border p-5 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 ${member.isBusy ? 'border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100/50' : 'border-emerald-100 bg-white'}`}>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${member.isBusy ? 'bg-gradient-to-br from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-gradient-to-br from-emerald-600 to-emerald-500 text-white shadow-lg shadow-emerald-500/20'}`}>
                      <UserCheck size={24} />
                    </div>
                    <div>
                      <h4 className="text-base font-black leading-snug text-slate-950">{member.full_name}</h4>
                      <p className="mt-1 text-[10px] font-black text-slate-400">{member.role === 'CONTROL' ? 'استلام كنترول' : 'مساعد كنترول'}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[10px] font-black ${member.isBusy ? 'border-blue-200 bg-blue-100 text-blue-700' : 'border-emerald-200 bg-emerald-100 text-emerald-700'}`}>
                    <CircleDot size={11} fill="currentColor" /> {member.isBusy ? 'في مهمة' : 'متاح'}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-2xl bg-white/80 p-3">
                    <p className="text-[9px] font-black text-slate-400">نطاقه</p>
                    <p className="mt-1 text-xl font-black text-slate-900">{member.memberCommittees.length}</p>
                  </div>
                  <div className="rounded-2xl bg-white/80 p-3">
                    <p className="text-[9px] font-black text-slate-400">معلق</p>
                    <p className="mt-1 text-xl font-black text-red-600">{member.pendingInScope}</p>
                  </div>
                  <div className="rounded-2xl bg-white/80 p-3">
                    <p className="text-[9px] font-black text-slate-400">منجز</p>
                    <p className="mt-1 text-xl font-black text-emerald-600">{member.completedByMember}</p>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-white/70 bg-white/70 p-4">
                  {member.isBusy && member.activeTask ? (
                    <>
                      <p className="text-xs font-black text-blue-700">يعالج الآن لجنة {member.activeTask.committee}</p>
                      <p className="mt-1 line-clamp-2 text-xs font-bold text-slate-500">{cleanControlRequestText(member.activeTask.text)}</p>
                    </>
                  ) : (
                    <p className="text-xs font-black text-emerald-700">متاح لدعم اللجان ذات البلاغات المتراكمة.</p>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {member.memberCommittees.slice(0, 8).map(committee => (
                    <span key={committee} className="rounded-xl bg-slate-100 px-3 py-1 text-[10px] font-black text-slate-600">لجنة {committee}</span>
                  ))}
                  {member.memberCommittees.length > 8 && (
                    <span className="rounded-xl bg-slate-900 px-3 py-1 text-[10px] font-black text-white">+{member.memberCommittees.length - 8}</span>
                  )}
                </div>
              </div>
            )) : (
              <EmptyState icon={<HelpCircle size={82} />} title="لا يوجد أعضاء فريق مسجلين حالياً" subtitle="سيظهر هنا توزيع المساعدين والكنترول عند إضافتهم." />
            )}
          </div>
        </section>
      )}

      {activeTab === 'MISSION_CONTROL' && (
        <section className="space-y-4 animate-slide-up">
          {activeRequests.length ? (
            <div className={`grid gap-4 ${compact ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-2'}`}>
              {activeRequests.map(request => (
                <RequestCard
                  key={request.id}
                  request={request}
                  compact={compact}
                  onStart={() => updateRequestStatus(request.id, 'IN_PROGRESS', request.committee)}
                  onDone={() => updateRequestStatus(request.id, 'DONE', request.committee)}
                />
              ))}
            </div>
          ) : (
            <EmptyState icon={<ShieldCheck size={96} />} title="لا توجد بلاغات نشطة حالياً" subtitle="عند وصول بلاغ جديد سيظهر هنا فوراً حسب نطاق لجانك." />
          )}
        </section>
      )}

      {activeTab === 'FIELD_LOGS' && (
        <section className="space-y-4 animate-slide-up">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <SmallMetric label="الإجمالي" value={absenceStats.total} />
            <SmallMetric label="غياب" value={absenceStats.absent} tone="text-red-600" />
            <SmallMetric label="تأخير" value={absenceStats.late} tone="text-amber-600" />
            <SmallMetric label="ينتظر الاستلام" value={absenceStats.waitingReceipt} tone="text-emerald-600" />
          </div>

          {myCommitteeAbsences.length ? (
            <div className={`grid gap-4 ${compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'}`}>
              {myCommitteeAbsences.map(absence => {
                const student = students.find(s => s.national_id === absence.student_id);
                const receipt = getAbsenceReceipt(absence);
                return (
                  <div key={absence.id} className={`rounded-3xl border p-5 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 ${absence.type === 'ABSENT' ? 'border-red-100 bg-white' : 'border-amber-100 bg-white'}`}>
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black text-white ${absence.type === 'ABSENT' ? 'border-red-700 bg-gradient-to-r from-red-600 to-red-500' : 'border-amber-600 bg-gradient-to-r from-amber-500 to-amber-400'}`}>
                          {getAbsenceKindLabel(absence.type)}
                        </span>
                        <h4 className="mt-3 text-lg font-black leading-snug text-slate-950">{absence.student_name}</h4>
                      </div>
                      <div className="flex h-14 w-14 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-[#020817] via-[#0a1628] to-[#050d1a] text-white shadow-lg">
                        <span className="text-[8px] font-black opacity-50">لجنة</span>
                        <span className="text-2xl font-black leading-none">{absence.committee_number}</span>
                      </div>
                    </div>

                    <div className="mb-4 flex flex-wrap gap-2">
                      {student?.grade && <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[10px] font-black text-blue-600">{student.grade}</span>}
                      {student?.section && <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-black text-slate-500">فصل {student.section}</span>}
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-black text-slate-500">{formatTime(absence.date)}</span>
                    </div>

                    <div className={`mb-3 rounded-2xl border p-4 ${receipt ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-slate-100 bg-slate-50 text-slate-600'}`}>
                      <p className="flex items-center gap-2 text-xs font-black">
                        {receipt ? <CheckCircle size={16} /> : <Clock size={16} />}
                        {receipt ? `تم استلام ${getAbsenceKindLabel(absence.type)}` : `بانتظار تأكيد استلام ${getAbsenceKindLabel(absence.type)} قبل الاتصال`}
                      </p>
                      {receipt && (
                        <p className="mt-1 text-[10px] font-bold">
                          {receipt.role}: {receipt.by} - {formatTime(receipt.at)}
                        </p>
                      )}
                    </div>

                    {!receipt && (
                      <button
                        onClick={() => acknowledgeAbsence(absence)}
                        disabled={receivingAbsenceId === absence.id}
                        className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 py-4 text-xs font-black text-white shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98] disabled:opacity-60"
                      >
                        <Check size={18} /> {receivingAbsenceId === absence.id ? 'جاري تأكيد الاستلام...' : `تأكيد استلام ${getAbsenceKindLabel(absence.type)}`}
                      </button>
                    )}

                    <button
                      disabled={!receipt || !student?.parent_phone}
                      onClick={() => receipt && student?.parent_phone && window.open(`tel:${student.parent_phone}`)}
                      className={`flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-xs font-black shadow-sm transition-all active:scale-[0.98] ${
                        receipt && student?.parent_phone ? 'bg-gradient-to-br from-[#020817] via-[#0a1628] to-[#050d1a] text-white shadow-lg hover:opacity-90' : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                      }`}
                    >
                      الاتصال بولي الأمر بعد الاستلام
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState icon={<CheckCircle size={92} />} title="لا توجد حالات غياب أو تأخير" subtitle="سيظهر هنا ما يخص اللجان المسندة لك فقط." />
          )}
        </section>
      )}
    </div>
  );
};

const RequestCard = ({
  request,
  compact,
  onStart,
  onDone,
}: {
  request: ControlRequest;
  compact: boolean;
  onStart: () => void;
  onDone: () => void;
}) => {
  const urgent = isUrgentRequest(request);
  const waiting = minutesSince(request.time);
  const inProgress = request.status === 'IN_PROGRESS';
  return (
    <div className={`relative overflow-hidden rounded-3xl border bg-white p-5 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 ${urgent ? 'border-red-200' : inProgress ? 'border-blue-200' : 'border-slate-100'}`}>
      <div className={`absolute inset-x-0 top-0 h-1 ${urgent ? 'bg-red-600' : inProgress ? 'bg-blue-600' : 'bg-amber-500'}`} />
      <div className={`grid gap-4 ${compact ? 'grid-cols-1' : 'sm:grid-cols-[auto_1fr]'}`}>
        <div className={`flex items-center justify-between gap-3 ${compact ? '' : 'sm:block sm:text-center'}`}>
          <div className={`flex h-20 w-20 shrink-0 flex-col items-center justify-center rounded-3xl text-white shadow-lg ${urgent ? 'bg-gradient-to-br from-red-600 to-red-500 shadow-red-500/20' : inProgress ? 'bg-gradient-to-br from-blue-600 to-blue-500 shadow-blue-500/20' : 'bg-gradient-to-br from-[#020817] to-[#0a1628]'}`}>
            <span className="text-[9px] font-black opacity-60">لجنة</span>
            <span className="text-4xl font-black leading-none">{request.committee}</span>
          </div>
          <span className={`rounded-full border px-3 py-1 text-[10px] font-black ${urgent ? 'border-red-200 bg-red-50 text-red-700' : inProgress ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
            {urgent ? 'طارئ' : inProgress ? 'قيد المعالجة' : 'جديد'}
          </span>
        </div>

        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h4 className="text-lg font-black text-slate-950">{request.from}</h4>
            <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[10px] font-black text-slate-500">
              <Clock size={12} className="ml-1 inline" /> {formatTime(request.time)}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[10px] font-black text-slate-500">
              منذ {waiting} دقيقة
            </span>
          </div>
          <p className={`rounded-2xl bg-slate-50 p-4 font-black leading-relaxed text-slate-700 ${compact ? 'text-base' : 'text-lg'}`}>
            {cleanControlRequestText(request.text)}
          </p>
          {request.assistant_name && (
            <p className="mt-3 text-[11px] font-black text-blue-600">المتابع الحالي: {request.assistant_name}</p>
          )}
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {request.status === 'PENDING' ? (
              <button onClick={onStart} className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 py-4 text-sm font-black text-white shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98]">
                <ArrowRightCircle size={22} /> مباشرة البلاغ
              </button>
            ) : (
              <button onClick={onDone} className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 py-4 text-sm font-black text-white shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98]">
                <CheckCircle size={22} /> إغلاق البلاغ
              </button>
            )}
            <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 text-center">
              <p className="text-[9px] font-black text-slate-400">مسار الإجراء</p>
              <p className="mt-1 text-xs font-black text-slate-700">{request.status === 'PENDING' ? 'بانتظار مباشرة المساعد' : 'جاري المتابعة ميدانياً'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const EmptyState = ({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) => (
  <div className="rounded-[2rem] border-2 border-dashed border-slate-200 bg-white py-16 text-center shadow-inner">
    <div className="mx-auto mb-5 flex h-28 w-28 items-center justify-center rounded-full bg-slate-50 text-slate-200">
      {icon}
    </div>
    <h3 className="text-2xl font-black text-slate-300">{title}</h3>
    <p className="mt-2 text-sm font-bold text-slate-400">{subtitle}</p>
  </div>
);

const SmallMetric = ({ label, value, tone = 'text-slate-900' }: { label: string; value: number; tone?: string }) => (
  <div className="rounded-3xl border border-slate-100 bg-white p-4 text-center shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
    <p className="text-[10px] font-black text-slate-400">{label}</p>
    <p className={`mt-1 text-3xl font-black tabular-nums ${tone}`}>{value}</p>
  </div>
);

const ProgressLine = ({ label, value, total, color }: { label: string; value: number; total: number; color: string }) => {
  const percent = Math.min(100, Math.round((value / total) * 100));
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs font-black">
        <span className="text-slate-500">{label}</span>
        <span className="text-slate-900">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
};

export default AssistantControlView;
