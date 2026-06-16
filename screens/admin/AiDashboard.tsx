import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  Clock,
  Gauge,
  Loader2,
  Map,
  MessageSquare,
  RefreshCw,
  Scale,
  Send,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react';
import {
  Absence,
  CommitteeReport,
  ControlRequest,
  DeliveryLog,
  EnvelopeOpening,
  ExamSchedule,
  Student,
  Supervision,
  SystemConfig,
  User,
} from '../../types';
import { db } from '../../supabase';
import { fetchAIAnalysis, AiInsightsResult, fetchAIChat } from '../../services/aiService';
import { getActualSupervisionStart } from '../../utils/proctorTime';
import { cleanControlRequestText, isInternalSignatureRecord } from '../../services/signatures';

interface Props {
  systemConfig: SystemConfig;
}

interface DashboardData {
  users: User[];
  students: Student[];
  supervisions: Supervision[];
  absences: Absence[];
  logs: DeliveryLog[];
  requests: ControlRequest[];
  reports: CommitteeReport[];
  exams: ExamSchedule[];
  envelopes: EnvelopeOpening[];
}

type AiMode = 'absence' | 'proctor' | 'receipt' | 'errors' | 'predictive' | 'auditor';

const toDateKey = (value?: string | null) => {
  if (!value) return '';
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw.slice(0, 10);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const sameDate = (value: string | undefined | null, dateKey: string) => toDateKey(value) === dateKey;
const sameCommittee = (a: unknown, b: unknown) => String(a || '') === String(b || '');
const cleanNumber = (value: number) => Number.isFinite(value) ? value : 0;

const safeTime = (value?: string | null) => {
  if (!value) return '---';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '---';
  return date.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
};

const minutesBetween = (a?: string | null, b?: string | null) => {
  if (!a || !b) return null;
  const start = new Date(a).getTime();
  const end = new Date(b).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.max(0, Math.round((end - start) / 60000));
};

const AiDashboard: React.FC<Props> = ({ systemConfig }) => {
  const [activeTab, setActiveTab] = useState<'cockpit' | 'insights' | 'chat'>('cockpit');
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<AiInsightsResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedMode, setSelectedMode] = useState<AiMode>('predictive');

  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'ai'; content: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const loadAllData = async () => {
    setIsLoadingData(true);
    setLoadError('');
    try {
      const [users, students, supervisions, absences, logs, requests, reports, exams, envelopes] = await Promise.all([
        db.users.getAll(),
        db.students.getAll(),
        db.supervision.getAll(),
        db.absences.getAll(),
        db.deliveryLogs.getAll(),
        db.controlRequests.getAll(),
        db.committeeReports.getAll(),
        db.examSchedule.getAll(),
        db.envelopeOpenings.getAll(),
      ]);
      setData({ users, students, supervisions, absences, logs, requests, reports, exams, envelopes });
    } catch (err: any) {
      setLoadError(err.message || 'تعذر تحميل بيانات المحلل الذكي.');
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const analytics = useMemo(() => {
    if (!data) return null;

    const scheduleDates = data.exams.map(e => e.exam_date).filter(Boolean).sort();
    const absenceDates = data.absences.map(a => toDateKey(a.date)).filter(Boolean).sort();
    const logDates = data.logs.map(l => toDateKey(l.time)).filter(Boolean).sort();
    const activeDate = systemConfig.active_exam_date || scheduleDates.at(-1) || absenceDates.at(-1) || logDates.at(-1) || toDateKey(new Date().toISOString());

    const examsToday = data.exams.filter(e => sameDate(e.exam_date, activeDate));
    const relevantGrades = new Set(examsToday.flatMap(e => e.grades || []));
    const relevantCommittees = new Set<string>([
      ...examsToday.flatMap(e => (e.committees || []).map(String)),
      ...data.supervisions.filter(s => sameDate(s.date, activeDate)).map(s => String(s.committee_number)),
      ...data.students
        .filter(s => !relevantGrades.size || relevantGrades.has(s.grade))
        .map(s => String(s.committee_number))
        .filter(Boolean),
    ]);

    const studentsInScope = data.students.filter(s => {
      if (relevantCommittees.size && !relevantCommittees.has(String(s.committee_number))) return false;
      if (relevantGrades.size) return relevantGrades.has(s.grade);
      return true;
    });

    const todayAbsences = data.absences.filter(a => sameDate(a.date, activeDate));
    const todayLogs = data.logs.filter(l => sameDate(l.time, activeDate));
    const todayRequests = data.requests.filter(r => sameDate(r.time, activeDate));
    const todaySupervisions = data.supervisions.filter(s => sameDate(s.date, activeDate));
    const todayReports = data.reports.filter(r => sameDate(r.date, activeDate));

    const absentIds = new Set(todayAbsences.filter(a => a.type === 'ABSENT').map(a => a.student_id));
    const lateIds = new Set(todayAbsences.filter(a => a.type === 'LATE').map(a => a.student_id));
    const presentCount = Math.max(studentsInScope.length - absentIds.size, 0);
    const attendanceRate = studentsInScope.length ? Math.round((presentCount / studentsInScope.length) * 100) : 0;

    const committeeNumbers = Array.from(new Set([
      ...studentsInScope.map(s => String(s.committee_number)).filter(Boolean),
      ...todaySupervisions.map(s => String(s.committee_number)),
      ...todayLogs.map(l => String(l.committee_number)),
      ...todayRequests.map(r => String(r.committee)),
    ])).sort((a, b) => Number(a) - Number(b));

    const committeeStats = committeeNumbers.map(num => {
      const committeeStudents = studentsInScope.filter(s => sameCommittee(s.committee_number, num));
      const absences = todayAbsences.filter(a => sameCommittee(a.committee_number, num));
      const committeeAbsent = absences.filter(a => a.type === 'ABSENT');
      const committeeLate = absences.filter(a => a.type === 'LATE');
      const requests = todayRequests.filter(r => sameCommittee(r.committee, num));
      const supervisions = todaySupervisions.filter(s => sameCommittee(s.committee_number, num));
      const logs = todayLogs.filter(l => sameCommittee(l.committee_number, num));
      const receivePending = logs.find(l => l.type === 'RECEIVE' && l.status === 'PENDING');
      const receiveConfirmed = logs.find(l => l.type === 'RECEIVE' && l.status === 'CONFIRMED');
      const firstJoin = getActualSupervisionStart(supervisions);
      const closeTime = logs.filter(l => l.type === 'RECEIVE').map(l => l.time).filter(Boolean).sort()[0];
      const receiptMins = minutesBetween(closeTime, receiveConfirmed?.time);
      const proctorNames = Array.from(new Set(supervisions.map(s => data.users.find(u => u.id === s.teacher_id || u.national_id === s.teacher_id)?.full_name || s.teacher_id)));
      const riskScore =
        committeeAbsent.length * 4 +
        committeeLate.length * 2 +
        requests.filter(r => r.status !== 'DONE').length * 3 +
        (!proctorNames.length ? 4 : 0) +
        (receivePending && !receiveConfirmed ? 3 : 0);

      return {
        num,
        students: committeeStudents.length,
        present: Math.max(committeeStudents.length - committeeAbsent.length, 0),
        absent: committeeAbsent.length,
        late: committeeLate.length,
        requests: requests.length,
        openRequests: requests.filter(r => r.status !== 'DONE').length,
        proctors: proctorNames,
        firstJoin,
        closeTime,
        receiptTime: receiveConfirmed?.time,
        receiptMins,
        hasReport: todayReports.some(r => sameCommittee(r.committee_number, num)),
        isReceived: !!receiveConfirmed,
        isPendingReceipt: !!receivePending && !receiveConfirmed,
        riskScore,
      };
    });

    const receivedCount = committeeStats.filter(c => c.isReceived).length;
    const completionRate = committeeStats.length ? Math.round((receivedCount / committeeStats.length) * 100) : 0;
    const topRiskCommittees = [...committeeStats].sort((a, b) => b.riskScore - a.riskScore).slice(0, 6);
    const attendanceHotspots = [...committeeStats].filter(c => c.absent || c.late).sort((a, b) => (b.absent + b.late) - (a.absent + a.late)).slice(0, 5);
    const slowReceipts = [...committeeStats].filter(c => c.receiptMins !== null).sort((a, b) => (b.receiptMins || 0) - (a.receiptMins || 0)).slice(0, 5);

    const proctors = data.users.filter(u => u.role === 'PROCTOR');
    const loadByProctor = proctors.map(user => {
      const assignments = data.supervisions.filter(s => s.teacher_id === user.id || s.teacher_id === user.national_id);
      const todayAssignments = assignments.filter(s => sameDate(s.date, activeDate));
      const uniqueDays = new Set(assignments.map(s => toDateKey(s.date))).size;
      const byDay = assignments.reduce<Record<string, number>>((acc, s) => {
        const day = toDateKey(s.date);
        acc[day] = (acc[day] || 0) + 1;
        return acc;
      }, {});
      const overloadDays = Object.entries(byDay).filter(([, count]) => count > 1);
      const absRecords = todayAbsences.filter(a => a.proctor_id === user.id || a.proctor_id === user.national_id);
      return {
        id: user.id,
        name: user.full_name,
        totalAssignments: assignments.length,
        todayAssignments: todayAssignments.length,
        uniqueDays,
        overloadDays,
        recordedCases: absRecords.length,
      };
    }).sort((a, b) => b.totalAssignments - a.totalAssignments);

    const idleProctors = loadByProctor.filter(p => p.totalAssignments === 0);
    const overloadedToday = loadByProctor.filter(p => p.todayAssignments > 1);
    const busiest = loadByProctor.slice(0, 5);
    const openRequests = todayRequests.filter(r => r.status !== 'DONE');

    const recommendations: { title: string; detail: string; tone: 'danger' | 'warning' | 'success' | 'info' }[] = [];
    if (openRequests.length) {
      recommendations.push({
        title: 'بلاغات مفتوحة تحتاج إغلاقًا',
        detail: `يوجد ${openRequests.length} بلاغ غير مغلق. ابدأ باللجان ${Array.from(new Set(openRequests.map(r => r.committee))).slice(0, 4).join('، ')}.`,
        tone: 'danger',
      });
    }
    if (topRiskCommittees[0]?.riskScore > 0) {
      recommendations.push({
        title: 'لجنة عالية المخاطر',
        detail: `اللجنة ${topRiskCommittees[0].num} أعلى مؤشر اليوم: ${topRiskCommittees[0].absent} غياب، ${topRiskCommittees[0].late} تأخير، ${topRiskCommittees[0].openRequests} بلاغ مفتوح.`,
        tone: topRiskCommittees[0].riskScore >= 8 ? 'danger' : 'warning',
      });
    }
    if (overloadedToday.length) {
      recommendations.push({
        title: 'توازن المراقبين اليوم',
        detail: `${overloadedToday.length} مراقب لديهم أكثر من إسناد اليوم. راجع ${overloadedToday.slice(0, 3).map(p => p.name).join('، ')}.`,
        tone: 'warning',
      });
    }
    if (idleProctors.length && loadByProctor.some(p => p.uniqueDays > 3)) {
      recommendations.push({
        title: 'فرصة إحلال عادلة',
        detail: `${idleProctors.length} مراقب بلا إسناد مقابل مراقبين ذوي أيام عمل مرتفعة. رشح الاحتياط قبل التوزيع التالي.`,
        tone: 'info',
      });
    }
    if (!recommendations.length) {
      recommendations.push({
        title: 'الوضع مستقر',
        detail: 'لا توجد مؤشرات حرجة في بيانات اليوم. حافظ على متابعة البلاغات والإغلاق النهائي.',
        tone: 'success',
      });
    }

    const nextExams = data.exams
      .filter(e => e.exam_date >= activeDate)
      .sort((a, b) => `${a.exam_date}-${a.period}`.localeCompare(`${b.exam_date}-${b.period}`))
      .slice(0, 4);

    return {
      activeDate,
      studentsInScope,
      todayAbsences,
      todayLogs,
      todayRequests,
      todaySupervisions,
      committeeStats,
      attendanceRate,
      presentCount,
      absentCount: absentIds.size,
      lateCount: lateIds.size,
      completionRate,
      receivedCount,
      openRequests,
      topRiskCommittees,
      attendanceHotspots,
      slowReceipts,
      loadByProctor,
      idleProctors,
      overloadedToday,
      busiest,
      recommendations,
      nextExams,
      reportsCount: todayReports.length,
      envelopesCount: data.envelopes.filter(e => sameDate(e.date || e.time, activeDate)).length,
    };
  }, [data, systemConfig.active_exam_date]);

  const aiContext = useMemo(() => {
    if (!data || !analytics) return null;
    return {
      activeDate: analytics.activeDate,
      summary: {
        students: analytics.studentsInScope.length,
        committees: analytics.committeeStats.length,
        attendanceRate: analytics.attendanceRate,
        present: analytics.presentCount,
        absent: analytics.absentCount,
        late: analytics.lateCount,
        completionRate: analytics.completionRate,
        receivedCommittees: analytics.receivedCount,
        openRequests: analytics.openRequests.length,
        reports: analytics.reportsCount,
      },
      criticalCommittees: analytics.topRiskCommittees.map(c => ({
        committee: c.num,
        students: c.students,
        absent: c.absent,
        late: c.late,
        openRequests: c.openRequests,
        proctors: c.proctors,
        received: c.isReceived,
        riskScore: c.riskScore,
      })),
      proctorBalance: analytics.loadByProctor.slice(0, 20).map(p => ({
        name: p.name,
        totalAssignments: p.totalAssignments,
        uniqueDays: p.uniqueDays,
        todayAssignments: p.todayAssignments,
        overloadDays: p.overloadDays.length,
      })),
      requests: analytics.todayRequests.filter(r => !isInternalSignatureRecord(r)).map(r => ({ committee: r.committee, status: r.status, time: r.time, text: cleanControlRequestText(r.text) })),
      nextExams: analytics.nextExams.map(e => ({ date: e.exam_date, subject: e.subject, period: e.period, grades: e.grades })),
    };
  }, [data, analytics]);

  const handleAnalyze = async (type: AiMode) => {
    setSelectedMode(type);
    if (!systemConfig.openrouter_api_key) {
      setErrorMsg('أضف مفتاح OpenRouter في إعدادات النظام لتفعيل التحليل اللغوي الخارجي. التحليل المحلي أدناه يعمل بدون مفتاح.');
      setActiveTab('cockpit');
      return;
    }
    if (!aiContext) return;

    setActiveTab('insights');
    setIsAnalyzing(true);
    setAiResult(null);
    setErrorMsg('');

    try {
      const result = await fetchAIAnalysis(systemConfig.openrouter_api_key, aiContext, type);
      if (result) setAiResult(result);
    } catch (err: any) {
      setAiResult(buildLocalAnalysis(type, aiContext));
      setErrorMsg('تعذر الاتصال بالنماذج الخارجية، لذلك عُرض تحليل محلي احتياطي من بيانات النظام.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSendChat = async (question?: string) => {
    const userMsg = (question || chatInput).trim();
    if (!userMsg) return;
    if (!systemConfig.openrouter_api_key) {
      setErrorMsg('أضف مفتاح OpenRouter في إعدادات النظام لتفعيل الدردشة الذكية.');
      return;
    }

    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsChatting(true);
    setErrorMsg('');

    try {
      const response = await fetchAIChat(systemConfig.openrouter_api_key, aiContext, userMsg);
      setChatMessages(prev => [...prev, { role: 'ai', content: response }]);
    } catch (err: any) {
      setChatMessages(prev => [...prev, { role: 'ai', content: buildLocalChatAnswer(userMsg, aiContext) }]);
      setErrorMsg('النماذج الخارجية لم تستجب، وتم توليد الإجابة محليًا من مؤشرات النظام.');
    } finally {
      setIsChatting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'text-emerald-700 bg-emerald-50 border-emerald-200';
      case 'warning': return 'text-amber-700 bg-amber-50 border-amber-200';
      case 'danger': return 'text-rose-700 bg-rose-50 border-rose-200';
      default: return 'text-blue-700 bg-blue-50 border-blue-200';
    }
  };

  const toneClasses = {
    danger: 'border-rose-200 bg-rose-50 text-rose-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    info: 'border-blue-200 bg-blue-50 text-blue-900',
  };

  if (isLoadingData) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-4">
        <Loader2 size={42} className="animate-spin text-blue-600" />
        <p className="text-sm font-black text-slate-500">جاري بناء خريطة التحليل من بيانات القاعدة...</p>
      </div>
    );
  }

  if (loadError || !data || !analytics) {
    return (
      <div className="rounded-[2rem] border border-rose-100 bg-rose-50 p-8 text-right text-rose-800">
        <AlertTriangle size={32} className="mb-4" />
        <h3 className="text-2xl font-black">تعذر تشغيل المحلل الذكي</h3>
        <p className="mt-2 text-sm font-bold">{loadError || 'لا توجد بيانات كافية للتحليل.'}</p>
        <button onClick={loadAllData} className="mt-6 rounded-xl bg-rose-600 px-5 py-3 text-sm font-black text-white">إعادة المحاولة</button>
      </div>
    );
  }

  const kpis = [
    { label: 'نسبة الحضور', value: `${analytics.attendanceRate}%`, sub: `${analytics.presentCount} من ${analytics.studentsInScope.length} طالب`, icon: Gauge, tone: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
    { label: 'إنجاز الاستلام', value: `${analytics.completionRate}%`, sub: `${analytics.receivedCount} من ${analytics.committeeStats.length} لجنة`, icon: CheckCircle2, tone: 'bg-blue-50 text-blue-700 border-blue-100' },
    { label: 'بلاغات مفتوحة', value: analytics.openRequests.length, sub: `${analytics.todayRequests.length} بلاغ اليوم`, icon: ShieldAlert, tone: 'bg-rose-50 text-rose-700 border-rose-100' },
    { label: 'تأخير وغياب', value: analytics.absentCount + analytics.lateCount, sub: `${analytics.absentCount} غياب، ${analytics.lateCount} تأخير`, icon: UserX, tone: 'bg-amber-50 text-amber-700 border-amber-100' },
  ];

  const analysisButtons: { id: AiMode; title: string; desc: string; icon: React.ElementType }[] = [
    { id: 'predictive', title: 'تنبؤ مبكر', desc: 'يتوقع نقاط التعثر في الاختبار القادم.', icon: TrendingUp },
    { id: 'auditor', title: 'عدالة المراقبين', desc: 'يراجع التوازن والإسنادات المتكررة.', icon: Scale },
    { id: 'absence', title: 'الحضور والغياب', desc: 'يفسر بؤر الغياب والتأخير.', icon: UserCheck },
    { id: 'receipt', title: 'مسار الاستلام', desc: 'يفحص الإغلاق والتسليم للكنترول.', icon: Map },
    { id: 'errors', title: 'تدقيق البلاغات', desc: 'يلخص البلاغات واللجان الحرجة.', icon: AlertTriangle },
    { id: 'proctor', title: 'انضباط المراقبين', desc: 'يربط الدخول والتقارير وحالات الرصد.', icon: Clock },
  ];

  return (
    <div className="space-y-8 pb-20 text-right animate-fade-in">
      <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-6 bg-slate-950 p-7 text-white md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-200">
              <BrainCircuit size={36} />
            </div>
            <div>
              <p className="text-xs font-black text-blue-200">لوحة قرار تعتمد على بيانات النظام</p>
              <h2 className="mt-1 text-3xl font-black tracking-tight">المحلل الذكي للكنترول</h2>
              <p className="mt-2 text-sm font-bold text-slate-300">تاريخ التحليل: {analytics.activeDate} · آخر قراءة من القاعدة الآن</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={loadAllData} className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-xs font-black text-white hover:bg-white/15">
              <RefreshCw size={16} /> تحديث البيانات
            </button>
            {(['cockpit', 'insights', 'chat'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`rounded-xl px-4 py-3 text-xs font-black transition-all ${activeTab === tab ? 'bg-white text-slate-950' : 'bg-white/10 text-slate-300 hover:bg-white/15'}`}
              >
                {tab === 'cockpit' ? 'غرفة القرار' : tab === 'insights' ? 'تحليل AI' : 'الدردشة'}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-4">
          {kpis.map(item => {
            const Icon = item.icon;
            return (
              <div key={item.label} className={`rounded-2xl border p-5 ${item.tone}`}>
                <div className="flex items-center justify-between gap-3">
                  <Icon size={24} />
                  <span className="text-xs font-black">{item.label}</span>
                </div>
                <p className="mt-4 text-4xl font-black tabular-nums">{item.value}</p>
                <p className="mt-1 text-xs font-bold opacity-70">{item.sub}</p>
              </div>
            );
          })}
        </div>
      </div>

      {activeTab === 'cockpit' && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-2xl font-black text-slate-950">غرفة القرار</h3>
                  <p className="mt-1 text-xs font-bold text-slate-400">توصيات مولدة محليًا من بيانات اليوم، وتعمل بدون مفتاح AI.</p>
                </div>
                <Target className="text-blue-600" size={30} />
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {analytics.recommendations.map(item => (
                  <div key={item.title} className={`rounded-2xl border p-5 ${toneClasses[item.tone]}`}>
                    <p className="text-base font-black">{item.title}</p>
                    <p className="mt-2 text-sm font-bold leading-7 opacity-80">{item.detail}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-3">
                <BarChart3 className="text-rose-600" />
                <h3 className="text-xl font-black text-slate-950">خريطة اللجان الحرجة</h3>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {analytics.topRiskCommittees.map(item => (
                  <div key={item.num} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-lg font-black text-slate-950">لجنة {item.num}</p>
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${item.riskScore >= 8 ? 'bg-rose-100 text-rose-700' : item.riskScore > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        مؤشر {item.riskScore}
                      </span>
                    </div>
                    <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                      <SmallStat label="طلاب" value={item.students} />
                      <SmallStat label="غياب" value={item.absent} tone="text-rose-700" />
                      <SmallStat label="تأخير" value={item.late} tone="text-amber-700" />
                      <SmallStat label="بلاغ" value={item.openRequests} tone="text-blue-700" />
                    </div>
                    <p className="mt-3 truncate text-xs font-bold text-slate-500">المراقب: {item.proctors.join('، ') || 'غير مسند'}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-3">
                <Scale className="text-emerald-600" />
                <h3 className="text-xl font-black text-slate-950">ميزان المراقبين</h3>
              </div>
              <div className="space-y-3">
                {analytics.busiest.map(p => (
                  <div key={p.id} className="rounded-2xl bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-black text-slate-900">{p.name}</p>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600">{p.totalAssignments} إسناد</span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, p.totalAssignments * 8)}%` }} />
                    </div>
                    <p className="mt-2 text-xs font-bold text-slate-400">{p.uniqueDays} أيام عمل · اليوم {p.todayAssignments} إسناد</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-amber-50 p-4 text-amber-800">
                  <p className="text-3xl font-black">{analytics.overloadedToday.length}</p>
                  <p className="text-xs font-black">إسناد مزدوج اليوم</p>
                </div>
                <div className="rounded-2xl bg-blue-50 p-4 text-blue-800">
                  <p className="text-3xl font-black">{analytics.idleProctors.length}</p>
                  <p className="text-xs font-black">مراقب بلا إسناد</p>
                </div>
              </div>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center gap-3">
                <CalendarDays className="text-indigo-600" />
                <h3 className="text-xl font-black text-slate-950">الاختبارات القادمة</h3>
              </div>
              <div className="space-y-3">
                {analytics.nextExams.map(exam => (
                  <div key={`${exam.id}-${exam.period}`} className="rounded-2xl border border-slate-100 p-4">
                    <p className="font-black text-slate-900">{exam.subject}</p>
                    <p className="mt-1 text-xs font-bold text-slate-400">{exam.exam_date} · الفترة {exam.period} · {(exam.grades || []).join('، ') || 'كل الصفوف'}</p>
                  </div>
                ))}
                {analytics.nextExams.length === 0 && <p className="text-sm font-bold text-slate-400">لا توجد اختبارات قادمة في الجدول.</p>}
              </div>
            </section>
          </div>
        </div>
      )}

      {activeTab === 'insights' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {analysisButtons.map(button => {
              const Icon = button.icon;
              return (
                <button
                  key={button.id}
                  onClick={() => handleAnalyze(button.id)}
                  disabled={isAnalyzing}
                  className={`rounded-2xl border p-5 text-right transition-all hover:-translate-y-1 hover:shadow-lg disabled:opacity-60 ${selectedMode === button.id ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white'}`}
                >
                  <Icon size={24} className={selectedMode === button.id ? 'text-blue-700' : 'text-slate-500'} />
                  <p className="mt-4 text-lg font-black text-slate-950">{button.title}</p>
                  <p className="mt-1 text-xs font-bold leading-6 text-slate-500">{button.desc}</p>
                </button>
              );
            })}
          </div>

          <section className="min-h-[360px] rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
            {errorMsg && (
              <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-bold leading-7 text-amber-800">
                {errorMsg}
              </div>
            )}

            {!isAnalyzing && !aiResult && !errorMsg && (
              <div className="flex min-h-[280px] flex-col items-center justify-center text-center">
                <Sparkles size={44} className="text-blue-500" />
                <h3 className="mt-4 text-2xl font-black text-slate-950">اختر نوع التحليل</h3>
                <p className="mt-2 max-w-lg text-sm font-bold leading-7 text-slate-500">اللوحة المحلية في غرفة القرار جاهزة دائمًا، وهذا القسم يستدعي التحليل اللغوي المتقدم عند توفر مفتاح OpenRouter.</p>
              </div>
            )}

            {isAnalyzing && (
              <div className="flex min-h-[280px] flex-col items-center justify-center text-center">
                <Loader2 size={46} className="animate-spin text-blue-600" />
                <h3 className="mt-4 text-2xl font-black text-slate-950">جاري تحليل السياق المختصر</h3>
                <p className="mt-2 text-sm font-bold text-slate-500">تم تقليل البيانات إلى مؤشرات آمنة ومباشرة حتى تكون النتيجة أدق.</p>
              </div>
            )}

            {aiResult && !isAnalyzing && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  {aiResult.metrics.map(metric => (
                    <div key={metric.title} className={`rounded-2xl border p-5 text-center ${getStatusColor(metric.status)}`}>
                      <p className="text-3xl font-black">{metric.value}</p>
                      <p className="mt-2 text-xs font-black">{metric.title}</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-2xl bg-slate-50 p-6">
                  <h4 className="text-xl font-black text-slate-950">توصيات التحليل</h4>
                  <div className="mt-5 space-y-3">
                    {aiResult.insights.map((insight, idx) => (
                      <div key={idx} className="flex items-start gap-3 rounded-xl bg-white p-4 text-sm font-bold leading-7 text-slate-700">
                        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-blue-600" />
                        <p>{insight}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {activeTab === 'chat' && (
        <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <h3 className="text-xl font-black text-slate-950">اسأل المحلل الذكي</h3>
            <p className="mt-1 text-xs font-bold text-slate-400">الدردشة تعتمد على ملخص المؤشرات، وليس على أرقام الهوية أو الهواتف.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {['ما أخطر لجنة اليوم؟', 'من المراقبون الأكثر عبئًا؟', 'ما توصيتك قبل اختبار الغد؟'].map(q => (
                <button key={q} onClick={() => handleSendChat(q)} className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black text-slate-600 hover:bg-blue-50 hover:text-blue-700">
                  {q}
                </button>
              ))}
            </div>
          </div>

          <div className="h-[430px] overflow-y-auto bg-slate-50 p-5">
            {chatMessages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center text-center text-slate-400">
                <MessageSquare size={52} />
                <p className="mt-4 text-sm font-black">ابدأ بسؤال أو استخدم أحد الأسئلة الجاهزة.</p>
              </div>
            )}
            {chatMessages.map((msg, idx) => (
              <div key={idx} className={`mb-4 flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[82%] whitespace-pre-wrap rounded-2xl p-4 text-sm font-bold leading-7 ${msg.role === 'user' ? 'rounded-br-none bg-blue-600 text-white' : 'rounded-bl-none border border-slate-200 bg-white text-slate-700'}`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {isChatting && (
              <div className="flex justify-end">
                <div className="rounded-2xl rounded-bl-none border border-slate-200 bg-white p-4 text-sm font-black text-slate-400">يفكر...</div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="border-t border-slate-100 p-4">
            {errorMsg && <p className="mb-3 text-xs font-bold text-amber-700">{errorMsg}</p>}
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-2 focus-within:border-blue-400">
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSendChat()}
                disabled={isChatting}
                placeholder="اسأل عن اللجان، الحضور، المراقبين، أو الاستلام..."
                className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm font-bold outline-none"
              />
              <button onClick={() => handleSendChat()} disabled={isChatting || !chatInput.trim()} className="rounded-xl bg-blue-600 p-4 text-white disabled:opacity-40">
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const SmallStat = ({ label, value, tone = 'text-slate-700' }: { label: string; value: number | string; tone?: string }) => (
  <div className="rounded-xl bg-white p-2">
    <p className={`text-lg font-black ${tone}`}>{value}</p>
    <p className="text-[10px] font-black text-slate-400">{label}</p>
  </div>
);

const buildLocalAnalysis = (type: AiMode, context: any): AiInsightsResult => {
  const summary = context?.summary || {};
  const critical = context?.criticalCommittees || [];
  const proctors = context?.proctorBalance || [];
  const topCommittee = critical[0];
  const overloaded = proctors.filter((p: any) => Number(p.todayAssignments || 0) > 1);
  const idle = proctors.filter((p: any) => Number(p.totalAssignments || 0) === 0);

  const baseMetrics: AiInsightsResult['metrics'] = [
    { title: 'الحضور', value: `${summary.attendanceRate ?? 0}%`, status: (summary.attendanceRate ?? 0) >= 95 ? 'success' : (summary.attendanceRate ?? 0) >= 85 ? 'warning' : 'danger' },
    { title: 'الإنجاز', value: `${summary.completionRate ?? 0}%`, status: (summary.completionRate ?? 0) >= 90 ? 'success' : (summary.completionRate ?? 0) >= 60 ? 'warning' : 'danger' },
    { title: 'بلاغات مفتوحة', value: String(summary.openRequests ?? 0), status: (summary.openRequests ?? 0) ? 'warning' : 'success' },
    { title: 'لجان حرجة', value: String(critical.filter((c: any) => Number(c.riskScore || 0) > 0).length), status: critical.some((c: any) => Number(c.riskScore || 0) >= 8) ? 'danger' : 'info' },
  ];

  const insightsByType: Record<AiMode, string[]> = {
    predictive: [
      topCommittee ? `ابدأ المتابعة من لجنة ${topCommittee.committee}: مؤشرها ${topCommittee.riskScore} بسبب ${topCommittee.absent} غياب و${topCommittee.late} تأخير و${topCommittee.openRequests} بلاغ مفتوح.` : 'لا توجد لجنة حرجة واضحة في البيانات الحالية.',
      `قبل الاختبار القادم راجع تجهيز ${summary.committees ?? 0} لجنة، وتأكد من إغلاق البلاغات المفتوحة وعددها ${summary.openRequests ?? 0}.`,
      'ضع مراقبًا احتياطيًا قريبًا من اللجان الأعلى في الغياب أو البلاغات لتقليل زمن الاستجابة.',
    ],
    auditor: [
      overloaded.length ? `يوجد ${overloaded.length} مراقب لديهم أكثر من إسناد اليوم، وأولهم: ${overloaded.slice(0, 3).map((p: any) => p.name).join('، ')}.` : 'لا يظهر إسناد مزدوج اليوم حسب البيانات الحالية.',
      idle.length ? `يوجد ${idle.length} مراقب بلا إسناد في السجل الحالي، ويمكن استخدامهم كاحتياط لتخفيف الحمل.` : 'لا توجد قائمة واضحة لمراقبين بلا إسناد.',
      'اعتمد التبديل بناءً على اليوم والفترة، وليس مجموع الإسنادات التاريخية فقط.',
    ],
    absence: [
      `إجمالي الحالات المرصودة: ${Number(summary.absent || 0) + Number(summary.late || 0)}، منها ${summary.absent ?? 0} غياب و${summary.late ?? 0} تأخير.`,
      topCommittee ? `أعلى لجنة تستحق مراجعة حضور هي لجنة ${topCommittee.committee}.` : 'الحضور موزع دون بؤرة واضحة.',
      'راجع الطلاب المتأخرين قبل اعتماد الحضور النهائي لأن التأخير محسوب ضمن الحضور.',
    ],
    receipt: [
      `إنجاز الاستلام الحالي ${summary.completionRate ?? 0}% (${summary.receivedCommittees ?? 0} لجنة مستلمة).`,
      'أي لجنة أغلقت ميدانيًا ولم تظهر كمستلمة تحتاج متابعة مباشرة مع الكنترول.',
      topCommittee ? `اربط متابعة الاستلام باللجان الحرجة مثل لجنة ${topCommittee.committee}.` : 'لا توجد لجنة ذات أولوية عالية للاستلام الآن.',
    ],
    errors: [
      `عدد البلاغات المفتوحة في ملخص اليوم: ${summary.openRequests ?? 0}.`,
      topCommittee ? `لجنة ${topCommittee.committee} هي أولوية التدقيق لأنها تجمع أعلى مؤشر خطر.` : 'لا توجد بلاغات حرجة واضحة.',
      'اقفل البلاغات المنجزة بتحديث حالتها حتى لا تبقى في لوحة المخاطر.',
    ],
    proctor: [
      `عدد المراقبين الأعلى حملًا في العينة: ${proctors.slice(0, 5).length}.`,
      overloaded.length ? `راجع الإسناد المزدوج لـ ${overloaded.slice(0, 3).map((p: any) => p.name).join('، ')}.` : 'انضباط الإسناد اليومي يبدو مستقرًا.',
      'قارن وقت دخول المراقب مع وقت إغلاق اللجنة عند تقييم الانضباط.',
    ],
  };

  return { metrics: baseMetrics, insights: insightsByType[type] };
};

const buildLocalChatAnswer = (question: string, context: any) => {
  const summary = context?.summary || {};
  const critical = context?.criticalCommittees || [];
  const proctors = context?.proctorBalance || [];
  const nextExams = context?.nextExams || [];
  const topCommittee = critical[0];
  const q = question.toLowerCase();

  if (q.includes('أخطر') || q.includes('خطر') || q.includes('لجنة')) {
    return topCommittee
      ? `أخطر لجنة حاليًا هي لجنة ${topCommittee.committee}.\n\nالسبب:\n- مؤشر الخطر: ${topCommittee.riskScore}\n- الغياب: ${topCommittee.absent}\n- التأخير: ${topCommittee.late}\n- البلاغات المفتوحة: ${topCommittee.openRequests}\n- المراقبون: ${topCommittee.proctors?.join('، ') || 'غير محدد'}\n\nتوصيتي: ابدأ بها في المتابعة، ثم راجع حالة البلاغات والاستلام قبل اعتماد نهاية اليوم.`
      : 'لا تظهر لجنة حرجة بوضوح في البيانات الحالية.';
  }

  if (q.includes('مراقب') || q.includes('عبء') || q.includes('عبئ')) {
    const busiest = proctors.slice(0, 5);
    return busiest.length
      ? `أعلى المراقبين حملًا حسب السجل:\n${busiest.map((p: any, i: number) => `${i + 1}. ${p.name}: ${p.totalAssignments} إسناد، ${p.uniqueDays} أيام، اليوم ${p.todayAssignments} إسناد`).join('\n')}\n\nتوصيتي: لا تعتمد على المجموع فقط؛ راجع ازدواج الإسناد في نفس اليوم والفترة قبل التبديل.`
      : 'لا توجد بيانات كافية عن إسنادات المراقبين.';
  }

  if (q.includes('غد') || q.includes('القادم') || q.includes('اختبار')) {
    return nextExams.length
      ? `قبل الاختبار القادم:\n${nextExams.map((e: any, i: number) => `${i + 1}. ${e.date} - ${e.subject} - الفترة ${e.period} - ${Array.isArray(e.grades) && e.grades.length ? e.grades.join('، ') : 'كل الصفوف'}`).join('\n')}\n\nتوصيتي: جهز الاحتياط للجان الأعلى بلاغًا، وتأكد من اكتمال توزيع المراقبين قبل بداية الفترة.`
      : 'لا تظهر اختبارات قادمة في الملخص الحالي.';
  }

  return `ملخص سريع من البيانات الحالية:\n- نسبة الحضور: ${summary.attendanceRate ?? 0}%\n- الحضور: ${summary.present ?? 0}\n- الغياب: ${summary.absent ?? 0}\n- التأخير: ${summary.late ?? 0}\n- إنجاز الاستلام: ${summary.completionRate ?? 0}%\n- البلاغات المفتوحة: ${summary.openRequests ?? 0}\n\n${topCommittee ? `أولوية المتابعة: لجنة ${topCommittee.committee} لأنها الأعلى مؤشرًا.` : 'لا توجد أولوية حرجة واضحة الآن.'}`;
};

export default AiDashboard;
