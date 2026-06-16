import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Clock3,
  Flame,
  Gauge,
  LayoutDashboard,
  LayoutGrid,
  Megaphone,
  MonitorPlay,
  PackageCheck,
  Pin,
  PinOff,
  Radio,
  ShieldCheck,
  Sparkles,
  Timer,
  Trophy,
  Truck,
  UserCheck,
  UserX,
  Users,
  Zap,
} from 'lucide-react';
import { Absence, ControlRequest, DeliveryLog, Student, Supervision, User } from '../../types';
import { getAbsenceKindLabel, getAbsenceReceipt } from '../../services/absenceReceipt';
import { isPlaceholderProctorStart } from '../../utils/proctorTime';
import { cleanControlRequestText, isInternalSignatureRecord, isSignatureRequest } from '../../services/signatures';

interface Props {
  absences: Absence[];
  supervisions: Supervision[];
  users: User[];
  deliveryLogs: DeliveryLog[];
  students: Student[];
  requests: ControlRequest[];
}

type Scene = 'overview' | 'map' | 'alerts' | 'attendance' | 'timeline';

const sceneOrder: Scene[] = ['overview', 'map', 'alerts', 'attendance', 'timeline'];

const formatTime = (value?: string) => {
  if (!value) return '--:--';
  return new Date(value).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
};

const isReceiverSummon = (request: ControlRequest) => request.text?.startsWith('[CALL_RECEIVER]');
const cleanSummonText = (text?: string) => String(text || '').replace('[CALL_RECEIVER]', '').trim();
const summonAgeMinutes = (time?: string) => {
  if (!time) return 0;
  const value = new Date(time).getTime();
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.round((Date.now() - value) / 60000));
};

const getRiyadhDateKey = (value: string | Date) => {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const get = (type: string) => parts.find(part => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
};

const matchesMonitorDate = (value: string | undefined | null, date: string) => {
  if (!value || !date) return false;
  const text = String(value);
  return text.startsWith(date) || getRiyadhDateKey(text) === date;
};

const ControlRoomMonitor2: React.FC<Props> = ({ absences, supervisions, users, deliveryLogs, students, requests }) => {
  const [now, setNow] = useState(new Date());
  const [scene, setScene] = useState<Scene>('overview');
  const [pinnedScene, setPinnedScene] = useState<Scene | null>(null);
  const [priorityScene, setPriorityScene] = useState<{ scene: Scene; until: number; label: string } | null>(null);
  const [showDayComplete, setShowDayComplete] = useState(false);
  const latestSeenRef = useRef({ request: '', absence: '', delivery: '' });
  const wasCompleteRef = useRef(false);
  const activeDate = getRiyadhDateKey(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (priorityScene && Date.now() < priorityScene.until) return;
    if (pinnedScene) return;
    const timer = setInterval(() => {
      setScene(prev => sceneOrder[(sceneOrder.indexOf(prev) + 1) % sceneOrder.length]);
    }, 14000);
    return () => clearInterval(timer);
  }, [pinnedScene, priorityScene]);

  useEffect(() => {
    if (!priorityScene) return;
    const remaining = priorityScene.until - Date.now();
    if (remaining <= 0) {
      setPriorityScene(null);
      if (pinnedScene) setScene(pinnedScene);
      return;
    }
    const timer = setTimeout(() => {
      setPriorityScene(null);
      if (pinnedScene) setScene(pinnedScene);
    }, remaining);
    return () => clearTimeout(timer);
  }, [pinnedScene, priorityScene]);

  useEffect(() => {
    const latestRequest = [...requests].sort((a, b) => b.time.localeCompare(a.time))[0];
    const latestAbsence = [...absences].sort((a, b) => b.date.localeCompare(a.date))[0];
    const latestDelivery = [...deliveryLogs].sort((a, b) => b.time.localeCompare(a.time))[0];

    const seen = latestSeenRef.current;
    if (!seen.request && !seen.absence && !seen.delivery) {
      latestSeenRef.current = {
        request: latestRequest?.id || '',
        absence: latestAbsence?.id || '',
        delivery: latestDelivery?.id || '',
      };
      return;
    }

    const showPriority = (nextScene: Scene, durationMs: number, label: string) => {
      setScene(nextScene);
      setPriorityScene({ scene: nextScene, until: Date.now() + durationMs, label });
    };

    if (latestRequest && latestRequest.id !== seen.request) {
      latestSeenRef.current = { ...latestSeenRef.current, request: latestRequest.id };
      showPriority('alerts', 12000, `بلاغ جديد من لجنة ${latestRequest.committee}`);
      return;
    }

    if (latestAbsence && latestAbsence.id !== seen.absence) {
      latestSeenRef.current = { ...latestSeenRef.current, absence: latestAbsence.id };
      showPriority('attendance', 10000, `${getAbsenceKindLabel(latestAbsence.type)} جديد في لجنة ${latestAbsence.committee_number}`);
      return;
    }

    if (latestDelivery && latestDelivery.id !== seen.delivery) {
      latestSeenRef.current = { ...latestSeenRef.current, delivery: latestDelivery.id };
      return;
    }
  }, [absences, deliveryLogs, pinnedScene, requests]);

  const committees = useMemo(() => {
    const nums = Array.from(new Set(students.map(s => s.committee_number))).filter(Boolean).sort((a, b) => Number(a) - Number(b));
    return nums.map(num => {
      const committeeStudents = students.filter(s => s.committee_number === num);
      const grades = Array.from(new Set(committeeStudents.map(s => s.grade)));
      const supervision = supervisions.find(s => s.committee_number === num);
      const proctor = users.find(u => u.id === supervision?.teacher_id);
      const logs = deliveryLogs.filter(l => l.committee_number === num && matchesMonitorDate(l.time, activeDate));
      const confirmed = grades.length > 0 && grades.every(g => logs.some(l => l.grade === g && l.status === 'CONFIRMED'));
      const submitted = !confirmed && grades.length > 0 && grades.every(g => logs.some(l => l.grade === g));
      const normalRequests = requests.filter(r => r.committee === num && !isReceiverSummon(r) && !isSignatureRequest(r) && !isInternalSignatureRecord(r));
      const receiverSummons = requests
        .filter(r => r.committee === num && r.status !== 'DONE' && isReceiverSummon(r))
        .sort((a, b) => b.time.localeCompare(a.time));
      const activeSummon = receiverSummons[0];
      const activeSummonAge = activeSummon ? summonAgeMinutes(activeSummon.time) : 0;
      const summonTone = activeSummon
        ? activeSummonAge >= 10
          ? 'late'
          : activeSummon.status === 'IN_PROGRESS'
            ? 'ack'
            : 'new'
        : null;
      const pendingAlert = !confirmed && normalRequests.some(r => r.status === 'PENDING');
      const inProgressAlert = !confirmed && normalRequests.some(r => r.status === 'IN_PROGRESS');
      const committeeAbsences = absences.filter(a => a.committee_number === num && matchesMonitorDate(a.date, activeDate));
      const hasActualJoin = supervision && !isPlaceholderProctorStart(supervision.date);
      const status = confirmed ? 'confirmed' : submitted ? 'submitted' : pendingAlert ? 'alert' : inProgressAlert ? 'progress' : hasActualJoin ? 'active' : 'idle';
      const receiptLog = logs.find(l => l.status === 'CONFIRMED');
      const closeLog = logs.find(l => l.status === 'PENDING');

      return {
        num,
        grades,
        proctorName: proctor?.full_name || 'غير مسندة',
        totalStudents: committeeStudents.length,
        absents: committeeAbsences.filter(a => a.type === 'ABSENT').length,
        lates: committeeAbsences.filter(a => a.type === 'LATE').length,
        hasPendingAlert: pendingAlert,
        hasInProgressAlert: inProgressAlert,
        activeSummon,
        summonTone,
        summonCount: receiverSummons.length,
        status,
        joinedAt: hasActualJoin ? supervision?.date : undefined,
        closedAt: closeLog?.time,
        receivedAt: receiptLog?.time,
        receiverName: receiptLog?.teacher_name || '',
      };
    });
  }, [absences, activeDate, deliveryLogs, requests, students, supervisions, users]);

  const insights = useMemo(() => {
    const total = committees.length;
    const confirmed = committees.filter(c => c.status === 'confirmed').length;
    const active = committees.filter(c => c.status === 'active' || c.status === 'progress' || c.status === 'alert').length;
    const submitted = committees.filter(c => c.status === 'submitted').length;
    const idle = committees.filter(c => c.status === 'idle').length;
    const urgent = requests.filter(r => r.status === 'PENDING').length;
    const activeRequests = requests.filter(r => r.status !== 'DONE').length;
    const absentCount = absences.filter(a => a.type === 'ABSENT').length;
    const lateCount = absences.filter(a => a.type === 'LATE').length;
    const totalStudents = students.length;
    const attendanceIssueCount = absentCount + lateCount;
    const presentCount = Math.max(0, totalStudents - attendanceIssueCount);
    const attendanceRate = totalStudents ? Number(((presentCount / totalStudents) * 100).toFixed(1)) : 0;
    const absenceRate = totalStudents ? Number(((attendanceIssueCount / totalStudents) * 100).toFixed(1)) : 0;
    const progress = total ? Math.round((confirmed / total) * 100) : 0;

    const receiptDurations = committees
      .map(c => {
        const start = c.closedAt || c.joinedAt;
        if (!start || !c.receivedAt) return null;
        const mins = Math.max(0, Math.round((new Date(c.receivedAt).getTime() - new Date(start).getTime()) / 60000));
        return { ...c, mins };
      })
      .filter(Boolean) as Array<any>;

    const fastest = [...receiptDurations].sort((a, b) => a.mins - b.mins)[0];
    const delayed = [
      ...receiptDurations.filter(c => c.mins > 10).sort((a, b) => b.mins - a.mins),
      ...committees.filter(c => c.status === 'submitted').map(c => ({ ...c, mins: null })),
    ].slice(0, 5);

    const alertsByCommittee = requests.reduce((acc, item) => {
      const key = item.committee || 'غير محدد';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const topAlert = Object.entries(alertsByCommittee).sort((a, b) => b[1] - a[1])[0];

    const attendanceHotspot = [...committees].sort((a, b) => (b.absents + b.lates) - (a.absents + a.lates))[0];

    return {
      total,
      confirmed,
      active,
      submitted,
      idle,
      urgent,
      activeRequests,
      absentCount,
      lateCount,
      totalStudents,
      attendanceIssueCount,
      presentCount,
      attendanceRate,
      absenceRate,
      progress,
      fastest,
      delayed,
      topAlert: topAlert ? { committee: topAlert[0], count: topAlert[1] } : null,
      attendanceHotspot,
    };
  }, [absences, committees, requests, students.length]);

  const recentEvents = useMemo(() => {
    const deliveryEvents = deliveryLogs.map(log => ({
      time: log.time,
      tone: log.status === 'CONFIRMED' ? 'emerald' : 'orange',
      title: log.status === 'CONFIRMED' ? 'استلام نهائي' : 'إغلاق ميداني',
      text: `لجنة ${log.committee_number} - ${log.grade} - ${log.teacher_name}`,
      icon: log.status === 'CONFIRMED' ? PackageCheck : Truck,
    }));
    const requestEvents = requests.map(req => ({
      time: req.time,
      tone: req.status === 'DONE' ? 'slate' : 'red',
      title: req.status === 'DONE' ? 'إغلاق بلاغ' : 'بلاغ لجنة',
      text: `لجنة ${req.committee} - ${cleanControlRequestText(req.text)}`,
      icon: BellRing,
    }));
    const absenceEvents = absences.map(absence => ({
      time: absence.date,
      tone: absence.type === 'ABSENT' ? 'rose' : 'amber',
      title: getAbsenceKindLabel(absence.type),
      text: `لجنة ${absence.committee_number} - ${absence.student_name}`,
      icon: absence.type === 'ABSENT' ? UserX : Timer,
    }));
    return [...deliveryEvents, ...requestEvents, ...absenceEvents].sort((a, b) => b.time.localeCompare(a.time)).slice(0, 12);
  }, [absences, deliveryLogs, requests]);

  const alertBoardItems = useMemo(() => {
    return requests.filter(req => !isInternalSignatureRecord(req)).map(req => {
      const receiverSummon = isReceiverSummon(req);
      const signatureRequest = isSignatureRequest(req);
      return {
        id: `request-${req.id}`,
        time: req.time,
        committee: req.committee,
        title: signatureRequest
          ? 'طلب توقيع مراقب'
          : receiverSummon
          ? req.status === 'IN_PROGRESS' ? 'استلم المراقب الاستدعاء' : req.status === 'DONE' ? 'استدعاء مغلق' : 'استدعاء مراقب'
          : req.status === 'DONE' ? 'بلاغ مغلق' : 'بلاغ كنترول',
        text: cleanControlRequestText(req.text),
        source: req.from,
        tone: receiverSummon || signatureRequest ? (req.status === 'DONE' ? 'done' : req.status === 'IN_PROGRESS' ? 'summonAck' : 'summon') : req.status === 'DONE' ? 'done' : 'request',
        status: req.status,
      };
    })
      .sort((a, b) => b.time.localeCompare(a.time))
      .slice(0, 8);
  }, [requests]);

  const newsItems = useMemo(() => {
    const items = [
      `نسبة الإنجاز الآن ${insights.progress}% من إجمالي اللجان`,
      insights.urgent ? `${insights.urgent} بلاغ عاجل يحتاج متابعة فورية` : 'لا توجد بلاغات عاجلة حالياً',
      insights.submitted ? `${insights.submitted} لجنة متجهة للكنترول بانتظار المطابقة` : 'لا توجد لجان في الطريق للكنترول',
      insights.fastest ? `أسرع استلام: لجنة ${insights.fastest.num} خلال ${insights.fastest.mins} دقيقة` : 'بانتظار اكتمال أول استلام',
      insights.attendanceHotspot && (insights.attendanceHotspot.absents || insights.attendanceHotspot.lates)
        ? `أعلى حالات حضور: لجنة ${insights.attendanceHotspot.num} (${insights.attendanceHotspot.absents} غياب، ${insights.attendanceHotspot.lates} تأخير)`
        : 'حالات الحضور مستقرة حتى الآن',
    ];
    return [...items, ...items];
  }, [insights]);

  const statusStyle = (status: string, summonTone?: string | null) => {
    if (summonTone === 'late') return 'from-orange-600 to-amber-500 border-orange-100 shadow-orange-500/70 animate-pulse';
    if (summonTone === 'ack') return 'from-violet-600 to-indigo-500 border-violet-100 shadow-violet-500/60';
    if (summonTone === 'new') return 'from-blue-700 to-cyan-500 border-cyan-100 shadow-cyan-500/60 animate-pulse';
    switch (status) {
      case 'confirmed': return 'from-emerald-500 to-teal-500 border-emerald-200 shadow-emerald-500/30';
      case 'alert': return 'from-red-600 to-rose-500 border-red-200 shadow-red-500/60 animate-pulse';
      case 'submitted': return 'from-orange-500 to-amber-400 border-orange-100 shadow-orange-500/60 tv2-flash';
      case 'progress': return 'from-indigo-500 to-blue-500 border-blue-200 shadow-blue-500/40';
      case 'active': return 'from-blue-600 to-cyan-500 border-blue-200 shadow-blue-500/30';
      default: return 'from-slate-700 to-slate-600 border-slate-400/30 shadow-slate-700/20 opacity-70';
    }
  };

  const topCards = [
    { label: 'نسبة الإنجاز', value: `${insights.progress}%`, icon: Gauge, tone: 'text-emerald-300', sub: `${insights.confirmed} من ${insights.total} لجنة` },
    { label: 'لجان نشطة', value: insights.active, icon: Activity, tone: 'text-blue-300', sub: 'قيد المتابعة' },
    { label: 'متجه للكنترول', value: insights.submitted, icon: Truck, tone: 'text-orange-300', sub: 'بانتظار المطابقة' },
    { label: 'بلاغات مفتوحة', value: insights.activeRequests, icon: BellRing, tone: 'text-red-300', sub: `${insights.urgent} عاجل` },
    { label: 'غياب', value: insights.absentCount, icon: UserX, tone: 'text-rose-300', sub: 'حالات مرصودة' },
    { label: 'تأخير', value: insights.lateCount, icon: Timer, tone: 'text-amber-300', sub: 'حالات مرصودة' },
  ];

  const playCelebrationSound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const master = ctx.createGain();
      master.gain.value = 0.18;
      master.connect(ctx.destination);

      const beep = (time: number, freq: number, duration = 0.13) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, time);
        gain.gain.setValueAtTime(0.001, time);
        gain.gain.exponentialRampToValueAtTime(0.6, time + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);
        osc.connect(gain);
        gain.connect(master);
        osc.start(time);
        osc.stop(time + duration + 0.03);
      };

      const clap = (time: number) => {
        const bufferSize = Math.floor(ctx.sampleRate * 0.09);
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i += 1) {
          data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2.2);
        }
        const source = ctx.createBufferSource();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        filter.type = 'bandpass';
        filter.frequency.value = 1800 + Math.random() * 900;
        gain.gain.value = 0.7;
        source.buffer = buffer;
        source.connect(filter);
        filter.connect(gain);
        gain.connect(master);
        source.start(time);
      };

      const start = ctx.currentTime + 0.05;
      [523, 659, 784, 1046].forEach((freq, idx) => beep(start + idx * 0.16, freq, 0.16));
      for (let i = 0; i < 42; i += 1) {
        clap(start + 0.75 + i * 0.085);
      }
      setTimeout(() => ctx.close(), 5200);
    } catch {
      // الصوت اختياري وقد تمنعه بعض المتصفحات دون تفاعل سابق.
    }
  };

  useEffect(() => {
    const isComplete = insights.total > 0 && insights.confirmed === insights.total;
    if (isComplete && !wasCompleteRef.current) {
      wasCompleteRef.current = true;
      setShowDayComplete(true);
      playCelebrationSound();
      const timer = setTimeout(() => setShowDayComplete(false), 15000);
      return () => clearTimeout(timer);
    }
    if (!isComplete) {
      wasCompleteRef.current = false;
    }
  }, [insights.confirmed, insights.total]);

  const SceneBadge = ({ id, label }: { id: Scene; label: string }) => (
    <button
      onClick={() => setScene(id)}
      className={`h-2 flex-1 rounded-full transition-all ${scene === id ? 'bg-orange-300 shadow-[0_0_18px_rgba(251,146,60,0.8)]' : 'bg-white/10'}`}
      aria-label={label}
      title={label}
    />
  );

  const sceneLabels: Record<Scene, string> = {
    overview: 'المؤشرات',
    map: 'الخريطة',
    alerts: 'البلاغات',
    attendance: 'الحضور',
    timeline: 'السجل',
  };

  const togglePinnedScene = (id: Scene) => {
    setScene(id);
    setPinnedScene(prev => prev === id ? null : id);
  };

  return (
    <div className="tv2-root fixed inset-0 overflow-hidden bg-[#020617] text-white font-['Tajawal']" dir="rtl">
      <div className="pointer-events-none absolute inset-0 tv2-grid-bg" />
      <div className="pointer-events-none absolute -top-40 -right-40 h-[32rem] w-[32rem] rounded-full bg-cyan-500/20 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 -left-40 h-[34rem] w-[34rem] rounded-full bg-orange-500/20 blur-[130px]" />

      <div className="relative z-10 flex h-full flex-col p-5 2xl:p-8">
        {showDayComplete && (
          <div className="pointer-events-none fixed inset-0 z-[999] overflow-hidden bg-slate-950/45 backdrop-blur-[10px]">
            <div className="absolute inset-0 tv2-confetti" />
            <div className="absolute inset-0 flex items-center justify-center p-8 text-center">
              <div className="tv2-celebration-card relative w-full max-w-5xl rounded-[4rem] border border-emerald-200/25 bg-white/[0.16] p-10 shadow-[0_0_140px_rgba(16,185,129,0.38)]">
                <div className="absolute -inset-1 rounded-[4rem] bg-gradient-to-br from-emerald-300/25 via-white/10 to-cyan-300/20 blur-2xl" />
                <div className="relative z-10 space-y-7">
                  <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-[2rem] bg-emerald-400 text-slate-950 shadow-[0_0_70px_rgba(52,211,153,.78)] tv2-celebrate-pop">
                    <Trophy size={68} strokeWidth={3} />
                  </div>
                  <div>
                    <p className="text-xl font-black text-emerald-100/90">تم اكتمال اليوم الاختباري</p>
                    <h2 className="tv2-celebration-title mt-3 text-6xl md:text-7xl font-black tracking-tight text-white leading-[1.08]">
                      <span className="block">اكتملت جميع اللجان شكراً</span>
                      <span className="block">للجميع</span>
                    </h2>
                    <p className="mt-5 text-2xl font-black text-white/85">تصفيق حار لفريق الكنترول والمراقبين على إنجاز الاستلام بالكامل.</p>
                  </div>
                  <div className="grid grid-cols-3 gap-4 max-w-3xl mx-auto">
                    <div className="rounded-[1.8rem] bg-emerald-400/18 p-5 backdrop-blur-md"><p className="text-5xl font-black">{insights.confirmed}</p><p className="text-xs font-black text-emerald-50">لجان مكتملة</p></div>
                    <div className="rounded-[1.8rem] bg-cyan-400/16 p-5 backdrop-blur-md"><p className="text-5xl font-black">{students.length}</p><p className="text-xs font-black text-cyan-50">طالب ضمن اليوم</p></div>
                    <div className="rounded-[1.8rem] bg-orange-400/16 p-5 backdrop-blur-md"><p className="text-5xl font-black">{insights.absentCount + insights.lateCount}</p><p className="text-xs font-black text-orange-50">حالات متابعة</p></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <header className="mb-5 flex h-24 items-center justify-between gap-5">
          <div className="flex items-center gap-4 rounded-[2rem] border border-white/10 bg-white/[0.04] px-6 py-4 shadow-2xl backdrop-blur-xl">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-400 text-slate-950 shadow-[0_0_35px_rgba(251,146,60,0.55)]">
              <MonitorPlay size={30} />
            </div>
            <div>
              <p className="text-xs font-black text-orange-200">TV2 العرض الذكي</p>
              <h1 className="text-3xl font-black tracking-tight">غرفة الكنترول الحية</h1>
            </div>
          </div>

          <div className="min-w-0 flex-1 px-4">
            <div className="mb-3 flex items-center justify-center gap-3 text-sm font-black text-slate-300">
              {priorityScene ? <BellRing size={18} className="animate-pulse text-orange-300" /> : <Radio size={18} className="animate-pulse text-emerald-300" />}
              <span>
                {priorityScene
                  ? `${priorityScene.label} · يعود العرض تلقائيًا بعد قليل`
                  : pinnedScene
                    ? `مثبت الآن على شاشة ${sceneLabels[pinnedScene]}`
                    : 'عرض تلقائي متزامن مع اللجان والبلاغات والاستلام'}
              </span>
            </div>
            <div className="mx-auto mb-3 flex max-w-xl gap-2">
              <SceneBadge id="overview" label="المؤشرات" />
              <SceneBadge id="map" label="الخريطة" />
              <SceneBadge id="alerts" label="البلاغات" />
              <SceneBadge id="attendance" label="الحضور" />
              <SceneBadge id="timeline" label="السجل" />
            </div>
            <div className="mx-auto flex max-w-4xl items-center justify-center gap-2">
              {sceneOrder.map(id => (
                <button
                  key={id}
                  onClick={() => togglePinnedScene(id)}
                  className={`flex items-center gap-2 rounded-2xl border px-4 py-2 text-[11px] font-black transition-all ${
                    pinnedScene === id
                      ? 'border-orange-300/60 bg-orange-400 text-slate-950 shadow-[0_0_24px_rgba(251,146,60,0.45)]'
                      : scene === id
                        ? 'border-white/20 bg-white/10 text-white'
                        : 'border-white/10 bg-white/[0.035] text-slate-400 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {pinnedScene === id ? <PinOff size={13} /> : <Pin size={13} />}
                  {pinnedScene === id ? 'مثبت' : sceneLabels[id]}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] px-6 py-4 text-left shadow-2xl backdrop-blur-xl">
            <p className="text-xs font-black text-slate-400">الوقت الآن</p>
            <p className="font-mono text-4xl font-black tabular-nums text-orange-200">
              {now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
          </div>
        </header>

        <section className="mb-5 grid grid-cols-6 gap-4">
          {topCards.map(card => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-4 shadow-xl backdrop-blur-xl">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black text-slate-400">{card.label}</p>
                    <p className="mt-2 text-4xl font-black tabular-nums">{card.value}</p>
                  </div>
                  <Icon className={card.tone} size={30} />
                </div>
                <p className="mt-3 truncate text-xs font-bold text-slate-400">{card.sub}</p>
              </div>
            );
          })}
        </section>

        {priorityScene && (
          <div className="mb-4 flex items-center justify-between rounded-[1.8rem] border border-orange-300/30 bg-orange-500/15 px-6 py-3 text-orange-50 shadow-[0_0_28px_rgba(249,115,22,0.25)]">
            <div className="flex items-center gap-3">
              <BellRing size={22} className="animate-pulse text-orange-200" />
              <p className="text-sm font-black">{priorityScene.label}</p>
            </div>
            <p className="text-[11px] font-black text-orange-200">
              أولوية لحظية · ثم يكمل العرض {pinnedScene ? `إلى شاشة ${sceneLabels[pinnedScene]}` : 'التنقل التلقائي'}
            </p>
          </div>
        )}

        <main className="min-h-0 flex-1">
          {scene === 'overview' && (
            <div className="grid h-full grid-cols-12 gap-5 tv2-scene">
              <div className="col-span-7 rounded-[3rem] border border-white/10 bg-white/[0.04] p-8 shadow-2xl backdrop-blur-xl">
                <div className="mb-8 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-black text-orange-200">المؤشر العام</p>
                    <h2 className="text-5xl font-black tracking-tight">نبض اليوم الاختباري</h2>
                  </div>
                  <Sparkles size={44} className="text-orange-300" />
                </div>
                <div className="grid grid-cols-[18rem_1fr] gap-8">
                  <div className="relative grid aspect-square place-items-center rounded-full bg-slate-950 shadow-inner">
                    <div className="absolute inset-4 rounded-full border-[18px] border-white/5" />
                    <div
                      className="absolute inset-4 rounded-full"
                      style={{ background: `conic-gradient(#34d399 ${insights.progress * 3.6}deg, rgba(255,255,255,0.06) 0deg)` }}
                    />
                    <div className="absolute inset-12 rounded-full bg-[#020617]" />
                    <div className="relative text-center">
                      <p className="text-7xl font-black tabular-nums">{insights.progress}%</p>
                      <p className="text-xs font-black text-slate-400">اكتمال الاستلام</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      ['مكتملة', insights.confirmed, 'bg-emerald-500/15 text-emerald-200 border-emerald-400/20'],
                      ['نشطة', insights.active, 'bg-blue-500/15 text-blue-200 border-blue-400/20'],
                      ['في الطريق', insights.submitted, 'bg-orange-500/15 text-orange-200 border-orange-400/20'],
                      ['غير مسندة', insights.idle, 'bg-slate-500/15 text-slate-200 border-slate-400/20'],
                    ].map(([label, value, cls]) => (
                      <div key={String(label)} className={`rounded-[2rem] border p-6 ${cls}`}>
                        <p className="text-xs font-black opacity-70">{label}</p>
                        <p className="mt-4 text-6xl font-black tabular-nums">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="col-span-5 grid grid-rows-2 gap-5">
                <div className="rounded-[3rem] border border-white/10 bg-gradient-to-br from-orange-500/20 to-red-500/10 p-7 shadow-2xl">
                  <div className="mb-5 flex items-center gap-3">
                    <Flame size={34} className="text-orange-300" />
                    <h3 className="text-3xl font-black">أبرز لقطة</h3>
                  </div>
                  <p className="text-lg font-bold leading-9 text-orange-50">
                    {insights.fastest
                      ? `أسرع استلام حتى الآن للجنة ${insights.fastest.num} خلال ${insights.fastest.mins} دقيقة.`
                      : insights.submitted
                        ? `${insights.submitted} لجنة أغلقت ميدانيًا وتتجه للكنترول.`
                        : 'بانتظار اكتمال أول عملية استلام نهائية.'}
                  </p>
                </div>
                <div className="rounded-[3rem] border border-white/10 bg-white/[0.04] p-7 shadow-2xl">
                  <div className="mb-5 flex items-center gap-3">
                    <Zap size={34} className="text-cyan-300" />
                    <h3 className="text-3xl font-black">تنبيه ذكي</h3>
                  </div>
                  <p className="text-lg font-bold leading-9 text-slate-200">
                    {insights.topAlert
                      ? `لجنة ${insights.topAlert.committee} هي الأكثر بلاغًا اليوم بعدد ${insights.topAlert.count} بلاغ.`
                      : insights.attendanceHotspot && (insights.attendanceHotspot.absents || insights.attendanceHotspot.lates)
                        ? `أعلى حالات حضور في لجنة ${insights.attendanceHotspot.num}.`
                        : 'الوضع مستقر ولا توجد نقاط حرجة بارزة الآن.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {scene === 'map' && (
            <div className="h-full rounded-[3rem] border border-white/10 bg-white/[0.035] p-8 shadow-2xl backdrop-blur-xl tv2-scene">
              <div className="mb-7 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <LayoutGrid size={44} className="text-cyan-300" />
                  <div>
                    <h2 className="text-5xl font-black">خريطة اللجان الحية</h2>
                    <p className="mt-2 text-sm font-black text-slate-400">الألوان: أزرق نشطة، أخضر مكتملة، برتقالي متجهة، أحمر بلاغ، رمادي غير مسندة.</p>
                  </div>
                </div>
                <div className="flex gap-3 text-xs font-black">
                  <span className="rounded-full bg-blue-500 px-4 py-2">نشطة</span>
                  <span className="rounded-full bg-orange-500 px-4 py-2">متجهة</span>
                  <span className="rounded-full bg-red-600 px-4 py-2">بلاغ</span>
                  <span className="rounded-full bg-emerald-500 px-4 py-2">مكتملة</span>
                </div>
              </div>
              <div className="tv2-map-grid grid h-[calc(100%-7rem)] grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] gap-5 overflow-hidden">
                {committees.map(c => (
                  <div key={c.num} className={`relative min-h-0 overflow-hidden rounded-[2rem] border-2 bg-gradient-to-br p-5 shadow-2xl ${statusStyle(c.status, c.summonTone)}`}>
                    <div className="absolute -left-8 -top-8 h-24 w-24 rounded-full bg-white/20 blur-2xl" />
                    {c.activeSummon && (
                      <div className={`absolute right-3 top-3 z-20 flex max-w-[75%] items-center gap-1.5 rounded-full px-3 py-1 text-[9px] font-black text-white shadow-xl ${
                        c.summonTone === 'late'
                          ? 'bg-orange-700'
                          : c.summonTone === 'ack'
                            ? 'bg-violet-700'
                            : 'bg-blue-800'
                      }`}>
                        <BellRing size={12} />
                        <span className="truncate">
                          {c.summonTone === 'late' ? 'استدعاء متأخر' : c.summonTone === 'ack' ? 'استلمه المراقب' : 'استدعاء مراقب'}
                        </span>
                        {c.summonCount > 1 && <span className="rounded-full bg-white/20 px-1.5">+{c.summonCount - 1}</span>}
                      </div>
                    )}
                    {c.status === 'submitted' && <Truck className="absolute left-4 top-4 animate-bounce text-white/80" size={26} />}
                    {c.status === 'alert' && <BellRing className="absolute left-4 top-4 animate-pulse text-white" size={26} />}
                    {c.status === 'submitted' && (c.hasPendingAlert || c.hasInProgressAlert) && (
                      <div className="absolute left-3 top-12 flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-1 text-[9px] font-black text-white shadow-[0_0_18px_rgba(220,38,38,.55)]">
                        <BellRing size={12} />
                        بلاغ
                      </div>
                    )}
                    <div className="relative z-10 flex h-full flex-col justify-between">
                      <div>
                        <p className="text-sm font-black opacity-75">لجنة</p>
                        <p className="text-7xl font-black leading-none tabular-nums">{c.num}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-950/22 px-3 py-2 backdrop-blur-sm">
                        <p className="tv2-proctor-name text-sm font-black leading-5 text-white drop-shadow-sm">{c.proctorName}</p>
                        {c.activeSummon && (
                          <p className="mt-1 truncate text-[10px] font-black text-white/90">
                            {cleanSummonText(c.activeSummon.text)} · {c.activeSummon.from}
                          </p>
                        )}
                        <p className="mt-1 text-[11px] font-black opacity-75">{c.totalStudents} طالب · {c.grades.length} صف</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {scene === 'alerts' && (
            <div className="grid h-full grid-cols-12 gap-5 tv2-scene">
              <div className="col-span-7 rounded-[3rem] border border-red-400/20 bg-red-500/10 p-8 shadow-2xl">
                <div className="mb-7 flex items-center gap-4">
                  <BellRing size={44} className="animate-pulse text-red-300" />
                  <div>
                    <h2 className="text-5xl font-black">لوحة البلاغات</h2>
                    <p className="mt-2 text-sm font-black text-red-100">متابعة البلاغات المفتوحة والمغلقة خلال اليوم.</p>
                  </div>
                </div>
                <div className="space-y-4 overflow-hidden">
                  {alertBoardItems.length ? alertBoardItems.map(item => (
                    <div
                      key={item.id}
                      className={`rounded-[2rem] border p-5 ${
                        item.tone === 'done'
                          ? 'border-white/10 bg-white/5 opacity-60'
                          : item.tone === 'summonAck'
                            ? 'border-violet-300/40 bg-violet-600/25'
                            : item.tone === 'summon'
                              ? 'border-cyan-300/40 bg-blue-600/25'
                          : item.tone === 'late'
                            ? 'border-amber-300/30 bg-amber-500/20'
                            : item.tone === 'absence'
                              ? 'border-rose-300/30 bg-rose-600/20'
                              : 'border-red-300/30 bg-red-600/20'
                      }`}
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="rounded-2xl bg-slate-950 px-5 py-2 text-xl font-black">لجنة {item.committee}</span>
                          <span className={`rounded-2xl px-4 py-2 text-xs font-black ${
                            item.tone === 'late'
                              ? 'bg-amber-500'
                              : item.tone === 'summonAck'
                                ? 'bg-violet-600'
                                : item.tone === 'summon'
                                  ? 'bg-blue-600'
                              : item.tone === 'absence'
                                ? 'bg-rose-500'
                                : item.tone === 'done'
                                  ? 'bg-slate-500'
                                  : 'bg-red-600'
                          }`}>{item.title}</span>
                        </div>
                        <span className="font-mono text-sm font-black text-red-100">{formatTime(item.time)}</span>
                      </div>
                      <p className="text-2xl font-black leading-9">{item.text}</p>
                      <p className="mt-2 text-xs font-black text-red-100/70">{item.source}</p>
                    </div>
                  )) : (
                    <div className="grid h-96 place-items-center rounded-[3rem] border border-emerald-400/20 bg-emerald-500/10 text-center">
                      <div>
                        <CheckCircle2 size={90} className="mx-auto text-emerald-300" />
                        <p className="mt-5 text-4xl font-black">لا توجد بلاغات</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="col-span-5 rounded-[3rem] border border-white/10 bg-white/[0.04] p-8 shadow-2xl">
                <h3 className="mb-6 text-4xl font-black">أكثر اللجان احتياجًا للمتابعة</h3>
                <div className="space-y-4">
                  {committees
                    .filter(c => c.status === 'alert' || c.absents || c.lates || c.status === 'submitted')
                    .slice(0, 6)
                    .map(c => (
                      <div key={c.num} className="flex items-center justify-between rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
                        <div>
                          <p className="text-2xl font-black">لجنة {c.num}</p>
                          <p className="text-xs font-bold text-slate-400">{c.proctorName}</p>
                        </div>
                        <div className="flex gap-2 text-xs font-black">
                          {c.absents > 0 && <span className="rounded-xl bg-rose-500 px-3 py-2">{c.absents} غياب</span>}
                          {c.lates > 0 && <span className="rounded-xl bg-amber-500 px-3 py-2">{c.lates} تأخير</span>}
                          {c.status === 'submitted' && <span className="rounded-xl bg-orange-500 px-3 py-2">في الطريق</span>}
                          {c.status === 'alert' && <span className="rounded-xl bg-red-600 px-3 py-2">بلاغ</span>}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {scene === 'attendance' && (
            <div className="grid h-full grid-cols-12 gap-5 tv2-scene">
              <div className="col-span-5 rounded-[3rem] border border-white/10 bg-white/[0.04] p-8 shadow-2xl">
                <div className="mb-8 flex items-center gap-4">
                  <Users size={44} className="text-amber-300" />
                  <div>
                    <h2 className="text-5xl font-black">الحضور والغياب</h2>
                    <p className="mt-2 text-sm font-black text-slate-400">استلام الغياب والتأخير يظهر مباشرة.</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-5">
                  <div className="rounded-[3rem] bg-rose-500/15 p-8 text-center text-rose-100">
                    <UserX size={54} className="mx-auto mb-4" />
                    <p className="text-7xl font-black">{insights.absentCount}</p>
                    <p className="text-sm font-black">غياب</p>
                  </div>
                  <div className="rounded-[3rem] bg-amber-500/15 p-8 text-center text-amber-100">
                    <Timer size={54} className="mx-auto mb-4" />
                    <p className="text-7xl font-black">{insights.lateCount}</p>
                    <p className="text-sm font-black">تأخير</p>
                  </div>
                </div>
                <div className="mt-5 rounded-[3rem] border border-emerald-300/20 bg-emerald-500/12 p-8 text-center text-emerald-50 shadow-[0_0_45px_rgba(16,185,129,.08)]">
                  <UserCheck size={58} className="mx-auto mb-4 text-emerald-200" />
                  <p className="text-[11px] font-black uppercase tracking-[0.25em] text-emerald-200/75">إجمالي الحضور</p>
                  <p className="mt-2 text-8xl font-black leading-none tabular-nums">{insights.presentCount}</p>
                  <p className="mt-3 text-sm font-black text-emerald-100/70">من أصل {insights.totalStudents} طالب</p>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-5">
                  <div className="rounded-[2.5rem] border border-cyan-300/20 bg-cyan-500/12 p-6 text-center text-cyan-50">
                    <Gauge size={40} className="mx-auto mb-3 text-cyan-200" />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-100/70">نسبة الحضور</p>
                    <p className="mt-2 text-6xl font-black tabular-nums">{insights.attendanceRate}%</p>
                  </div>
                  <div className="rounded-[2.5rem] border border-rose-300/20 bg-rose-500/12 p-6 text-center text-rose-50">
                    <UserX size={40} className="mx-auto mb-3 text-rose-200" />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-100/70">نسبة الغياب والتأخير</p>
                    <p className="mt-2 text-6xl font-black tabular-nums">{insights.absenceRate}%</p>
                  </div>
                </div>
              </div>
              <div className="col-span-7 rounded-[3rem] border border-white/10 bg-white/[0.04] p-8 shadow-2xl">
                <h3 className="mb-6 text-4xl font-black">آخر حالات الغياب والتأخير</h3>
                <div className="space-y-4 overflow-hidden">
                  {[...absences].sort((a, b) => b.date.localeCompare(a.date)).length ? [...absences].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7).map(a => {
                    const receipt = getAbsenceReceipt(a);
                    return (
                      <div key={a.id} className="grid grid-cols-[1fr_auto] items-center gap-4 rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
                        <div>
                          <p className="text-2xl font-black">{a.student_name}</p>
                          <p className="mt-1 text-xs font-bold text-slate-400">لجنة {a.committee_number} · {formatTime(a.date)}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`rounded-2xl px-4 py-2 text-xs font-black ${a.type === 'ABSENT' ? 'bg-rose-500' : 'bg-amber-500'}`}>{getAbsenceKindLabel(a.type)}</span>
                          <span className={`rounded-2xl px-4 py-2 text-xs font-black ${receipt ? 'bg-emerald-500/20 text-emerald-200' : 'bg-orange-500/20 text-orange-200 animate-pulse'}`}>
                            {receipt ? `استلمه ${receipt.by}` : 'بانتظار الاستلام'}
                          </span>
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="grid h-96 place-items-center rounded-[3rem] border border-emerald-400/20 bg-emerald-500/10 text-center">
                      <div>
                        <ShieldCheck size={90} className="mx-auto text-emerald-300" />
                        <p className="mt-5 text-4xl font-black">لا توجد حالات مسجلة</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {scene === 'timeline' && (
            <div className="h-full rounded-[3rem] border border-white/10 bg-white/[0.04] p-8 shadow-2xl tv2-scene">
              <div className="mb-7 flex items-center gap-4">
                <Clock3 size={44} className="text-cyan-300" />
                <div>
                  <h2 className="text-5xl font-black">الشريط الزمني للعمليات</h2>
                  <p className="mt-2 text-sm font-black text-slate-400">آخر حركة في النظام خلال اليوم.</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-5">
                {recentEvents.slice(0, 9).map((event, idx) => {
                  const Icon = event.icon;
                  return (
                    <div key={`${event.time}-${idx}`} className="rounded-[2rem] border border-white/10 bg-slate-950/50 p-5 shadow-xl">
                      <div className="mb-4 flex items-center justify-between">
                        <Icon size={28} className={
                          event.tone === 'red' ? 'text-red-300' :
                          event.tone === 'orange' ? 'text-orange-300' :
                          event.tone === 'rose' ? 'text-rose-300' :
                          event.tone === 'amber' ? 'text-amber-300' :
                          event.tone === 'emerald' ? 'text-emerald-300' : 'text-slate-300'
                        } />
                        <span className="font-mono text-xs font-black text-slate-500">{formatTime(event.time)}</span>
                      </div>
                      <p className="text-xl font-black">{event.title}</p>
                      <p className="mt-2 line-clamp-2 text-sm font-bold leading-7 text-slate-300">{event.text}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </main>

        <footer className="mt-5 flex h-14 items-center gap-4 overflow-hidden rounded-[1.8rem] border border-orange-300/20 bg-orange-500/10 px-5">
          <Megaphone size={26} className="shrink-0 text-orange-200" />
          <div className="relative min-w-0 flex-1 overflow-hidden">
            <div className="tv2-news-track flex gap-12 whitespace-nowrap text-lg font-black text-orange-50">
              {newsItems.map((item, idx) => <span key={idx}>{item}</span>)}
            </div>
          </div>
        </footer>
      </div>

      <style>{`
        .tv2-grid-bg {
          background-image:
            linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px);
          background-size: 54px 54px;
          mask-image: radial-gradient(circle at center, black, transparent 78%);
        }
        .tv2-scene {
          animation: tv2SceneIn 700ms cubic-bezier(.2,.9,.2,1) both;
        }
        .tv2-news-track {
          width: max-content;
          animation: tv2Ticker 44s linear infinite;
        }
        .tv2-flash {
          animation: tv2OrangeFlash 1.4s ease-in-out infinite;
        }
        .tv2-confetti {
          background-image:
            radial-gradient(circle, #34d399 0 5px, transparent 6px),
            radial-gradient(circle, #fb923c 0 4px, transparent 5px),
            radial-gradient(circle, #38bdf8 0 4px, transparent 5px),
            radial-gradient(circle, #facc15 0 5px, transparent 6px);
          background-size: 120px 120px, 150px 150px, 170px 170px, 210px 210px;
          background-position: 0 -120px, 40px -150px, 90px -170px, 20px -210px;
          animation: tv2ConfettiFall 1.6s linear infinite;
        }
        .tv2-celebrate-pop {
          animation: tv2CelebratePop 900ms ease-in-out infinite alternate;
        }
        .tv2-celebration-card {
          backdrop-filter: blur(22px) saturate(150%);
          -webkit-backdrop-filter: blur(22px) saturate(150%);
          animation: tv2CardFloat 2.8s ease-in-out infinite alternate;
        }
        .tv2-celebration-title {
          text-shadow:
            0 3px 0 rgba(16,185,129,.95),
            0 8px 0 rgba(14,116,144,.55),
            0 18px 35px rgba(0,0,0,.75),
            0 0 42px rgba(52,211,153,.45);
          transform-style: preserve-3d;
          animation: tv2TitleFloat3d 2.2s ease-in-out infinite alternate;
        }
        .tv2-map-grid {
          grid-auto-rows: minmax(9.5rem, 1fr);
          align-content: stretch;
        }
        .tv2-proctor-name {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          text-wrap: balance;
        }
        @keyframes tv2SceneIn {
          from { opacity: 0; transform: translateY(20px) scale(.985); filter: blur(8px); }
          to { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }
        @keyframes tv2Ticker {
          from { transform: translateX(-50%); }
          to { transform: translateX(0); }
        }
        @keyframes tv2OrangeFlash {
          0%, 100% { box-shadow: 0 0 22px rgba(249,115,22,.45); filter: saturate(1); }
          50% { box-shadow: 0 0 58px rgba(249,115,22,.95); filter: saturate(1.3); }
        }
        @keyframes tv2ConfettiFall {
          from { background-position: 0 -120px, 40px -150px, 90px -170px, 20px -210px; }
          to { background-position: 0 120px, 40px 150px, 90px 170px, 20px 210px; }
        }
        @keyframes tv2CelebratePop {
          from { transform: scale(1) rotate(-2deg); }
          to { transform: scale(1.08) rotate(2deg); }
        }
        @keyframes tv2CardFloat {
          from { transform: translateY(0) scale(1); }
          to { transform: translateY(-10px) scale(1.01); }
        }
        @keyframes tv2TitleFloat3d {
          from { transform: perspective(900px) rotateX(8deg) rotateY(-5deg) translateY(0); }
          to { transform: perspective(900px) rotateX(2deg) rotateY(5deg) translateY(-14px); }
        }
        @media (max-width: 1300px) {
          .tv2-root header { height: 5.5rem; }
          .tv2-root h1, .tv2-root h2 { font-size: clamp(1.8rem, 3vw, 3rem); }
          .tv2-root .grid-cols-6 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .tv2-map-grid {
            grid-template-columns: repeat(auto-fit, minmax(10.5rem, 1fr));
            grid-auto-rows: minmax(8rem, 1fr);
          }
        }
      `}</style>
    </div>
  );
};

export default ControlRoomMonitor2;
