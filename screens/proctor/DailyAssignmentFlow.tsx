import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  User,
  Supervision,
  Student,
  Absence,
  DeliveryLog,
  ControlRequest,
  CommitteeReport,
} from "../../types";
import { Html5Qrcode } from "html5-qrcode";
import {
  Loader2,
  ShieldCheck,
  Camera,
  Shield,
  Zap,
  PackageCheck,
  RefreshCcw,
  ChevronLeft,
  CheckCircle2,
  Minus,
  Plus,
  GraduationCap,
  History,
  Clock,
  FileText,
  UserCog,
  Pencil,
  Stethoscope,
  MessageSquare,
  ChevronRight,
  Users,
  Check,
  AlertCircle,
  Award,
  Sparkles,
  CheckCircle,
  Info,
  X,
  UserSearch,
  AlertTriangle,
  ArrowRight,
  Timer,
  UserCheck,
  Bell,
  Package,
} from "lucide-react";
import { db, supabase } from "../../supabase";
import { APP_CONFIG, ROLES_ARABIC } from "../../constants";
import { getAbsenceKindLabel, getAbsenceReceipt } from "../../services/absenceReceipt";

interface Props {
  user: User;
  users?: User[];
  supervisions?: Supervision[];
  setSupervisions: () => Promise<void>;
  students?: Student[];
  absences?: Absence[];
  setAbsences: () => Promise<void>;
  onAlert: (msg: string, type: string) => void;
  sendRequest: (txt: string, com: string) => Promise<void>;
  deliveryLogs?: DeliveryLog[];
  setDeliveryLogs: (log: Partial<DeliveryLog>) => Promise<void>;
  systemConfig: any;
  controlRequests?: ControlRequest[];
}

const ProctorDailyAssignmentFlow: React.FC<Props> = ({
  user,
  users = [],
  supervisions = [],
  setSupervisions,
  students = [],
  absences = [],
  setAbsences,
  onAlert,
  sendRequest,
  deliveryLogs = [],
  setDeliveryLogs,
  systemConfig,
  controlRequests = [],
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isClosingWizardOpen, setIsClosingWizardOpen] = useState(false);
  const [closingStep, setClosingStep] = useState(0);
  const [currentGradeIdx, setCurrentGradeIdx] = useState(0);
  const [closingCounts, setClosingCounts] = useState<Record<string, number>>(
    {},
  );
  const [isVerifying, setIsVerifying] = useState(false);
  const [countError, setCountError] = useState<string | null>(null);
  const [isCountingLocked, setIsCountingLocked] = useState(false);

  // نافذة البلاغات المتطورة
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportStep, setReportStep] = useState<
    | "CATEGORIES"
    | "SELECT_STUDENTS"
    | "SELECT_TEACHER"
    | "INPUT_QUANTITY"
    | "OTHER"
  >("CATEGORIES");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [otherText, setOtherText] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [filter, setFilter] = useState<'ALL' | 'PRESENT' | 'ABSENT' | 'LATE'>('ALL');
  const [elapsedTime, setElapsedTime] = useState('00:00');
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [localPendingCount, setLocalPendingCount] = useState(0);

  const qrScannerRef = useRef<Html5Qrcode | null>(null);
  const activeDate = useMemo(
    () =>
      systemConfig?.active_exam_date || new Date().toISOString().split("T")[0],
    [systemConfig],
  );

  const activeAssignment = useMemo(
    () =>
      supervisions.find(
        (s: any) =>
          s.teacher_id === user.id && s.date && s.date.startsWith(activeDate),
      ),
    [supervisions, user.id, activeDate],
  );

  const activeCommittee = activeAssignment?.committee_number || null;
  const [confirmedAssignments, setConfirmedAssignments] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(`confirmed_assignments_${user.id}`) || '[]');
    } catch {
      return [];
    }
  });
  const [assignmentStartTimes, setAssignmentStartTimes] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem(`assignment_start_times_${user.id}`) || '{}');
    } catch {
      return {};
    }
  });
  const activeAssignmentConfirmed = !!activeAssignment && confirmedAssignments.includes(activeAssignment.id);
  const activeAssignmentStartTime = activeAssignment
    ? assignmentStartTimes[activeAssignment.id] || activeAssignment.date
    : null;

  const markAssignmentStarted = (assignmentId: string, startedAt: string) => {
    const nextConfirmed = Array.from(new Set([...confirmedAssignments, assignmentId]));
    const nextStartTimes = { ...assignmentStartTimes, [assignmentId]: startedAt };
    setConfirmedAssignments(nextConfirmed);
    setAssignmentStartTimes(nextStartTimes);
    localStorage.setItem(`confirmed_assignments_${user.id}`, JSON.stringify(nextConfirmed));
    localStorage.setItem(`assignment_start_times_${user.id}`, JSON.stringify(nextStartTimes));
  };

  const confirmActiveAssignment = async () => {
    if (!activeAssignment) return;
    const startedAt = new Date().toISOString();
    try {
      const { error } = await supabase
        .from('supervision')
        .update({ date: startedAt })
        .eq('id', activeAssignment.id);
      if (error) throw new Error(error.message);
      markAssignmentStarted(activeAssignment.id, startedAt);
      setElapsedTime('00:00');
      await setSupervisions();
      onAlert(`تم تأكيد المباشرة في اللجنة رقم ${activeAssignment.committee_number}`, 'success');
    } catch (err: any) {
      onAlert(err.message || 'تعذر تأكيد المباشرة', 'error');
    }
  };

  const myActiveRequests = useMemo(
    () =>
      controlRequests
        .filter(
          (r) =>
            r.from === user.full_name &&
            r.committee === activeCommittee &&
            r.status !== "DONE",
        )
        .sort((a, b) => b.time.localeCompare(a.time)),
    [controlRequests, user.full_name, activeCommittee],
  );

  useEffect(() => {
    if (!activeAssignmentStartTime) return;
    const startTime = new Date(activeAssignmentStartTime).getTime();
    
    const updateTimer = () => {
      const now = new Date().getTime();
      const diff = Math.floor((now - startTime) / 1000);
      if (diff < 0) return;
      const hrs = Math.floor(diff / 3600);
      const mins = Math.floor((diff % 3600) / 60);
      const secs = diff % 60;
      
      if (hrs > 0) {
        setElapsedTime(`${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
      } else {
        setElapsedTime(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
      }
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activeAssignmentStartTime]);

  /* ── مراقبة الاتصال بالإنترنت ── */
  useEffect(() => {
    const goOnline = async () => {
      setIsOffline(false);
      // محاولة رفع السجلات المحلية المعلقة عند عودة الاتصال
      const localKey = `offline_absences_${user.id}`;
      const raw = localStorage.getItem(localKey);
      if (!raw) return;
      try {
        const pending: any[] = JSON.parse(raw);
        if (!pending.length) return;
        for (const rec of pending) {
          if (rec._delete) {
            await db.absences.delete(rec.student_id).catch(() => {});
          } else {
            await db.absences.upsert(rec).catch(() => {});
          }
        }
        localStorage.removeItem(localKey);
        setLocalPendingCount(0);
        await setAbsences();
        onAlert(`✅ تمت مزامنة ${pending.length} تغيير محفوظ محلياً`, 'success');
      } catch { /* تجاهل أخطاء المزامنة */ }
    };
    const goOffline = () => setIsOffline(true);
    window.addEventListener('online',  goOnline);
    window.addEventListener('offline', goOffline);
    // حساب عدد السجلات المحلية المعلقة
    const raw = localStorage.getItem(`offline_absences_${user.id}`);
    if (raw) { try { setLocalPendingCount(JSON.parse(raw).length); } catch {} }
    return () => {
      window.removeEventListener('online',  goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [user.id]);

  // منطق الإغلاق: اللجنة منتهية إذا كان هناك سجل (سواء معلق أو مؤكد) لجميع صفوف اللجنة
  const isCommitteeFinished = useMemo(() => {
    if (!activeCommittee) return false;
    const committeeGrades = Array.from(
      new Set(
        students
          .filter((s) => s.committee_number === activeCommittee)
          .map((s) => s.grade),
      ),
    );
    const reportedGrades = deliveryLogs
      .filter(
        (l) =>
          l.committee_number === activeCommittee &&
          l.time.startsWith(activeDate),
      )
      .map((l) => l.grade);

    return (
      committeeGrades.length > 0 &&
      committeeGrades.every((g) => reportedGrades.includes(g))
    );
  }, [deliveryLogs, activeCommittee, activeDate, students]);

  useEffect(() => {
    const timer = setTimeout(() => setIsInitialLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  const myStudents = useMemo(
    () => students.filter((s) => s.committee_number === activeCommittee),
    [students, activeCommittee],
  );
  const myGrades = useMemo(
    () => Array.from(new Set(myStudents.map((s) => s.grade))).sort(),
    [myStudents],
  );
  const myAbsences = useMemo(
    () =>
      absences.filter(
        (a) =>
          a.committee_number === activeCommittee &&
          a.date.startsWith(activeDate),
      ),
    [absences, activeCommittee, activeDate],
  );

  const stats = useMemo(() => {
    const total = myStudents.length;
    const abs = myAbsences.filter((a) => a.type === "ABSENT").length;
    const late = myAbsences.filter((a) => a.type === "LATE").length;
    return { total, present: total - abs, absent: abs, late };
  }, [myStudents, myAbsences]);

  const filteredStudents = useMemo(() => {
    if (filter === 'ALL') return myStudents;
    return myStudents.filter(s => {
      const status = myAbsences.find(a => a.student_id === s.national_id);
      if (filter === 'PRESENT') return !status;
      if (filter === 'ABSENT') return status?.type === 'ABSENT';
      if (filter === 'LATE') return status?.type === 'LATE';
      return true;
    });
  }, [myStudents, myAbsences, filter]);

  const joinCommittee = async (committeeNum: string) => {
    const cleanedNum = committeeNum.trim();
    if (!cleanedNum || isJoining) return;
    setIsJoining(true);
    try {
      const assignmentId = crypto.randomUUID();
      const startedAt = new Date().toISOString();
      await db.supervision.deleteByTeacherId(user.id);
      await db.supervision.insert({
        id: assignmentId,
        teacher_id: user.id,
        committee_number: cleanedNum,
        date: startedAt,
        period: 1,
        subject: "اختبار",
      });
      markAssignmentStarted(assignmentId, startedAt);
      setElapsedTime('00:00');
      await setSupervisions();
      onAlert(`تمت المباشرة في اللجنة ${cleanedNum}`, "success");
    } catch (err: any) {
      onAlert(err.message, "error");
    } finally {
      setIsJoining(false);
    }
  };

  const stopScanner = async () => {
    if (qrScannerRef.current) {
      try {
        if (qrScannerRef.current.isScanning) await qrScannerRef.current.stop();
      } catch (e) {
      } finally {
        qrScannerRef.current = null;
        setIsScanning(false);
      }
    }
  };

  const toggleStudentStatus = async (
    student: Student,
    type: "ABSENT" | "LATE",
  ) => {
    if (isCommitteeFinished) return;
    const existing = absences.find(
      (a) => a.student_id === student.national_id && a.date.startsWith(activeDate),
    );
    const isRemoving = existing && existing.type === type;

    // ── أولاً: حفظ محلي فوري (Optimistic / Offline) ──
    const localKey = `offline_absences_${user.id}`;
    const addToLocal = (rec: any) => {
      try {
        const raw = localStorage.getItem(localKey);
        const list: any[] = raw ? JSON.parse(raw) : [];
        const idx = list.findIndex(r => r.student_id === rec.student_id);
        if (idx >= 0) list[idx] = rec; else list.push(rec);
        localStorage.setItem(localKey, JSON.stringify(list));
        setLocalPendingCount(list.length);
      } catch {}
    };
    const removeFromLocal = (studentId: string) => {
      try {
        const raw = localStorage.getItem(localKey);
        if (!raw) return;
        const list: any[] = JSON.parse(raw).filter((r: any) => r.student_id !== studentId);
        localStorage.setItem(localKey, JSON.stringify(list));
        setLocalPendingCount(list.length);
      } catch {}
    };

    // ── ثانياً: رفع للسيرفر (مع fallback محلي) ──
    try {
      if (isRemoving) {
        removeFromLocal(student.national_id);
        await db.absences.delete(student.national_id);
      } else {
        const rec = {
          id: existing?.id || crypto.randomUUID(),
          student_id: student.national_id,
          student_name: student.name,
          committee_number: activeCommittee!,
          period: 1,
          type,
          proctor_id: user.id,
          date: new Date().toISOString(),
        };
        if (isOffline) {
          // في وضع عدم الاتصال: حفظ محلي فقط
          addToLocal(rec);
          onAlert('📵 لا يوجد اتصال — حُفظ محلياً وسيُزامَن تلقائياً', 'warning');
          await setAbsences(); // تحديث الواجهة من الذاكرة
          return;
        }
        await db.absences.upsert(rec);
        removeFromLocal(student.national_id); // نجح الرفع → نمسح المحلي
      }
      await setAbsences();
    } catch (err: any) {
      // فشل الاتصال → حفظ محلي
      if (!isRemoving) {
        const rec = {
          id: existing?.id || crypto.randomUUID(),
          student_id: student.national_id,
          student_name: student.name,
          committee_number: activeCommittee!,
          period: 1, type,
          proctor_id: user.id,
          date: new Date().toISOString(),
        };
        addToLocal(rec);
        onAlert('⚠️ فشل الاتصال — حُفظ التغيير محلياً', 'warning');
      } else {
        onAlert(err.message || String(err), 'error');
      }
    }
  };

  const handleUrgentReport = async () => {
    let message = "";
    switch (selectedCategory) {
      case "ANSWER_SHEET":
        const names = myStudents
          .filter((s) => selectedStudentIds.includes(s.national_id))
          .map((s) => s.name)
          .join("، ");
        message = `طلب ورقة إجابة للطلاب: (${names})`;
        break;
      case "SUBJECT_TEACHER":
        message = `استدعاء معلم المادة: (${otherText})`;
        break;
      case "PENCIL":
        message = `طلب مرسام/أدوات عدد: (${quantity})`;
        break;
      case "QUESTION_SHEET":
        message = `طلب ورقة أسئلة عدد: (${quantity})`;
        break;
      case "HEALTH":
        message = `🚨 حالة صحية طارئة في اللجنة`;
        break;
      case "OTHER":
        message = `بلاغ: ${otherText}`;
        break;
    }

    try {
      await sendRequest(message, activeCommittee!);
      onAlert("تم إرسال البلاغ فوراً لوحدة التحكم", "success");
      setIsReportModalOpen(false);
      resetReportState();
    } catch (err: any) {
      onAlert(err.message, "error");
    }
  };

  const resetReportState = () => {
    setReportStep("CATEGORIES");
    setSelectedCategory("");
    setSelectedStudentIds([]);
    setOtherText("");
    setQuantity(1);
  };

  const validateAndNext = () => {
    const currentGrade = myGrades[currentGradeIdx];
    const expected = myStudents.filter((s) => s.grade === currentGrade).length;
    const input = closingCounts[currentGrade] || 0;

    if (input !== expected) {
      setCountError(
        `العدد المدخل (${input}) غير مطابق للمسجل (${expected}). تأكد من العد جيداً.`,
      );
      setIsCountingLocked(true);
      return;
    }

    setCountError(null);
    setIsCountingLocked(false);
    if (currentGradeIdx < myGrades.length - 1) {
      setCurrentGradeIdx((prev) => prev + 1);
    } else {
      finalizeClosing();
    }
  };

  const finalizeClosing = async () => {
    setIsVerifying(true);
    try {
      for (const grade of myGrades) {
        await setDeliveryLogs({
          id: crypto.randomUUID(),
          teacher_name: "بانتظار الكنترول",
          proctor_name: user.full_name,
          committee_number: activeCommittee!,
          grade,
          type: "RECEIVE",
          time: new Date().toISOString(),
          period: 1,
          status: "PENDING",
        });
      }
      await sendRequest(
        `المراقب ${user.full_name} أنهى رصد اللجنة ومتجه للكنترول للتسليم.`,
        activeCommittee!,
      );
      setIsClosingWizardOpen(false);
      onAlert("تم إنهاء اللجنة بنجاح، يرجى التوجه للكنترول فوراً.", "success");
    } catch (err: any) {
      onAlert(err.message, "error");
    } finally {
      setIsVerifying(false);
    }
  };

  if (isInitialLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 animate-pulse text-slate-400">
        <Loader2 size={64} className="animate-spin text-blue-600" />
        <p className="font-black text-xl italic text-slate-500">
          جاري تأمين الجلسة الميدانية...
        </p>
      </div>
    );
  }

  // واجهة النجاح والقفل (وثيقة الإنجاز + سجل المطابقة)
  if (activeAssignment && !activeAssignmentConfirmed) {
    return (
      <div className="max-w-4xl mx-auto py-10 px-4 space-y-8 animate-fade-in text-center">
        <div className="bg-slate-950 p-10 rounded-[4rem] text-white shadow-2xl relative overflow-hidden border-b-[10px] border-emerald-500">
          <div className="absolute inset-0 bg-emerald-500/10"></div>
          <div className="relative z-10 flex flex-col items-center gap-8">
            <div className="w-28 h-28 bg-emerald-500 text-white rounded-[2.5rem] flex flex-col items-center justify-center font-black shadow-2xl">
              <span className="text-[10px] opacity-70 mb-1">اللجنة</span>
              <span className="text-6xl leading-none">{activeAssignment.committee_number}</span>
            </div>
            <div>
              <h2 className="text-4xl md:text-5xl font-black tracking-tighter">تم إسناد اللجنة رقم {activeAssignment.committee_number}</h2>
              <p className="text-emerald-100 font-bold text-lg mt-4">يرجى تأكيد المباشرة قبل الدخول إلى شاشة الرصد.</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-10 rounded-[3.5rem] shadow-2xl border border-slate-100">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-right mb-8">
            <div className="p-5 rounded-2xl bg-slate-50">
              <p className="text-[10px] font-black text-slate-400">اسم المراقب</p>
              <p className="font-black text-slate-900 mt-1">{user.full_name}</p>
            </div>
            <div className="p-5 rounded-2xl bg-slate-50">
              <p className="text-[10px] font-black text-slate-400">المادة</p>
              <p className="font-black text-slate-900 mt-1">{activeAssignment.subject || 'اختبار'}</p>
            </div>
            <div className="p-5 rounded-2xl bg-slate-50">
              <p className="text-[10px] font-black text-slate-400">الفترة</p>
              <p className="font-black text-slate-900 mt-1">{activeAssignment.period || 1}</p>
            </div>
          </div>
          <button
            onClick={confirmActiveAssignment}
            className="w-full p-8 bg-emerald-600 text-white rounded-[2.5rem] font-black text-2xl shadow-2xl hover:bg-emerald-700 transition-all flex items-center justify-center gap-4 active:scale-95"
          >
            <UserCheck size={32} />
            تأكيد المباشرة
          </button>
        </div>
      </div>
    );
  }

  if (isCommitteeFinished) {
    const committeeLogs = deliveryLogs.filter(
      (l) =>
        l.committee_number === activeCommittee && l.time.startsWith(activeDate),
    );
    
    // منع التكرار: نحتفظ بسجل واحد لكل صف، مع أولوية السجل المؤكد (CONFIRMED)
    const myLogs = Object.values(committeeLogs.reduce((acc, log) => {
      if (!acc[log.grade] || log.status === 'CONFIRMED') {
        acc[log.grade] = log;
      }
      return acc;
    }, {} as Record<string, DeliveryLog>)) as DeliveryLog[];

    const isFullyConfirmed = myLogs.length > 0 && myLogs.every(l => l.status === 'CONFIRMED');

    return (
      <div className="max-w-4xl mx-auto py-10 px-4 animate-fade-in pb-48 space-y-10">

        {/* ══════════════════════════════════════════════
            بطاقة الإنجاز الملكية
        ══════════════════════════════════════════════ */}
        {isFullyConfirmed ? (
          /* ── حالة مكتملة ومستلمة: بطاقة فاخرة ── */
          <div className="relative">
            {/* توهج خارجي ذهبي */}
            <div className="absolute -inset-1.5 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 rounded-[4.5rem] blur-md opacity-30 animate-pulse-slow" />
            <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 rounded-[4.5rem] opacity-20" />

            <div className="relative bg-gradient-to-br from-[#0a1628] via-[#0d1e38] to-[#060f20] rounded-[4.5rem] overflow-hidden shadow-2xl border border-amber-500/20">

              {/* نجوم ونقاط ديكور */}
              <div className="absolute top-6 right-8 w-2 h-2 bg-amber-400 rounded-full opacity-60 animate-pulse" />
              <div className="absolute top-14 right-20 w-1 h-1 bg-amber-300 rounded-full opacity-40" />
              <div className="absolute top-8 left-16 w-1.5 h-1.5 bg-yellow-300 rounded-full opacity-50 animate-pulse" />
              <div className="absolute bottom-10 right-14 w-1 h-1 bg-amber-400 rounded-full opacity-30" />
              <div className="absolute bottom-6 left-10 w-2 h-2 bg-yellow-400 rounded-full opacity-40 animate-pulse" />
              <div className="absolute top-1/2 right-4 w-1 h-1 bg-amber-300 rounded-full opacity-20" />
              <div className="absolute top-1/3 left-6 w-1.5 h-1.5 bg-amber-400 rounded-full opacity-30" />

              {/* شريط ذهبي علوي */}
              <div className="h-1 w-full bg-gradient-to-r from-transparent via-amber-400 to-transparent opacity-60" />

              {/* ضوء خلفي */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-48 bg-amber-400/10 blur-[80px] rounded-full pointer-events-none" />
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-emerald-500/10 blur-[60px] rounded-full pointer-events-none" />

              <div className="relative z-10 px-8 py-14 md:px-16 text-center space-y-8">

                {/* علامة الصح ثلاثية الأبعاد (SVG) */}
                <div className="flex justify-center mb-4">
                  <div className="relative w-36 h-36">
                    {/* الطبقة الخلفية (ظل/عمق) */}
                    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 140 140" fill="none">
                      <circle cx="72" cy="72" r="58" fill="url(#shadowGrad)" opacity="0.5"/>
                      <defs>
                        <radialGradient id="shadowGrad" cx="50%" cy="50%" r="50%">
                          <stop offset="0%" stopColor="#6b7280" />
                          <stop offset="100%" stopColor="#111827" />
                        </radialGradient>
                      </defs>
                    </svg>

                    {/* الطبقة الوسطى (حلقة ذهبية) */}
                    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 140 140" fill="none">
                      <circle cx="70" cy="68" r="58" fill="url(#ringGrad)" />
                      <circle cx="70" cy="68" r="50" fill="url(#mainGrad)" />
                      <defs>
                        <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%"   stopColor="#f59e0b" />
                          <stop offset="50%"  stopColor="#fbbf24" />
                          <stop offset="100%" stopColor="#d97706" />
                        </linearGradient>
                        <linearGradient id="mainGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%"   stopColor="#059669" />
                          <stop offset="50%"  stopColor="#10b981" />
                          <stop offset="100%" stopColor="#047857" />
                        </linearGradient>
                      </defs>
                    </svg>

                    {/* وميض ضوئي */}
                    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 140 140" fill="none">
                      <ellipse cx="55" cy="48" rx="22" ry="10" fill="white" opacity="0.15" transform="rotate(-30 55 48)" />
                    </svg>

                    {/* علامة الصح */}
                    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 140 140" fill="none">
                      <filter id="chkShadow" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="2" dy="4" stdDeviation="3" floodColor="#064e3b" floodOpacity="0.5"/>
                      </filter>
                      <path
                        d="M40 70 L58 90 L100 48"
                        stroke="white"
                        strokeWidth="9"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        filter="url(#chkShadow)"
                      />
                    </svg>

                    {/* نجمات حول الدائرة */}
                    {[0, 72, 144, 216, 288].map((angle, i) => (
                      <div
                        key={i}
                        className="absolute w-2.5 h-2.5 text-amber-300"
                        style={{
                          top:  `${50 + 46 * Math.sin((angle - 90) * Math.PI / 180)}%`,
                          left: `${50 + 46 * Math.cos((angle - 90) * Math.PI / 180)}%`,
                          transform: 'translate(-50%,-50%)',
                          animationDelay: `${i * 0.2}s`
                        }}
                      >
                        <Sparkles size={10} className="animate-pulse text-amber-300" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* وسام / بادج */}
                <div className="inline-flex items-center gap-2 bg-amber-500/15 border border-amber-400/30 text-amber-300 px-6 py-2 rounded-full font-black text-xs uppercase tracking-[0.3em]">
                  <ShieldCheck size={14} />
                  تمت المطابقة النهائية · وثيقة إنجاز رسمية
                </div>

                {/* العنوان */}
                <div className="space-y-2">
                  <p className="text-amber-400/70 font-black text-xs uppercase tracking-[0.4em]">اللجنة الميدانية رقم</p>
                  <h2 className="text-7xl font-black text-white tracking-tighter leading-none" style={{textShadow: '0 0 40px rgba(251,191,36,0.3)'}}>
                    {activeCommittee}
                  </h2>
                  <p className="text-2xl font-black text-emerald-400 tracking-tight">مكتملة ومستلمة بنجاح تام</p>
                </div>

                {/* الفاصل الذهبي */}
                <div className="flex items-center gap-4 max-w-xs mx-auto">
                  <div className="flex-1 h-px bg-gradient-to-r from-transparent to-amber-500/40"/>
                  <div className="w-2 h-2 bg-amber-400 rounded-full"/>
                  <div className="flex-1 h-px bg-gradient-to-l from-transparent to-amber-500/40"/>
                </div>

                {/* الرسالة الفاخرة */}
                <div className="space-y-3 max-w-lg mx-auto">
                  <p className="text-slate-300 font-bold text-lg leading-relaxed">
                    يشرفنا أن نُهنئ الأستاذ
                  </p>
                  <p className="text-white font-black text-2xl leading-snug" style={{textShadow: '0 0 20px rgba(255,255,255,0.1)'}}>
                    {user.full_name}
                  </p>
                  <p className="text-slate-400 font-bold text-base leading-relaxed italic">
                    على إتمام مهمته الميدانية باحتراف وأمانة.
                    وقد صادق الكنترول على استلام جميع مظاريف هذه اللجنة.
                    جزاك الله خير الجزاء على عطائك وإخلاصك.
                  </p>
                </div>

                {/* الوقت */}
                <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 text-slate-400 px-5 py-2.5 rounded-full text-xs font-bold">
                  <Clock size={13} />
                  {new Date().toLocaleString('ar-SA', { weekday:'long', day:'numeric', month:'long', hour:'2-digit', minute:'2-digit' })}
                </div>
              </div>

              {/* شريط ذهبي سفلي */}
              <div className="h-1 w-full bg-gradient-to-r from-transparent via-amber-400 to-transparent opacity-40" />
            </div>
          </div>
        ) : (
          /* ── حالة بانتظار الكنترول: كارت أزرق بسيط ── */
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-[4.5rem] blur opacity-20 group-hover:opacity-30 transition duration-700" />
            <div className="relative bg-gradient-to-br from-[#0d1b35] to-[#0a1220] rounded-[4.5rem] overflow-hidden shadow-2xl border border-blue-500/20">
              <div className="h-1 w-full bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50" />
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-blue-500/10 blur-[60px] rounded-full pointer-events-none" />
              <div className="relative z-10 px-8 py-14 text-center space-y-6">
                <div className="w-28 h-28 mx-auto relative">
                  <div className="absolute inset-0 bg-blue-600/30 rounded-[2.5rem] blur-xl" />
                  <div className="relative w-full h-full bg-gradient-to-br from-blue-500 to-blue-700 rounded-[2.5rem] flex items-center justify-center shadow-2xl border-4 border-blue-400/20">
                    <Award size={64} className="text-white drop-shadow-lg" />
                  </div>
                  <Sparkles size={22} className="absolute -top-3 -right-3 text-blue-300 animate-pulse" />
                </div>
                <div className="inline-flex items-center gap-2 bg-blue-500/15 border border-blue-400/30 text-blue-300 px-5 py-2 rounded-full font-black text-xs uppercase tracking-widest">
                  <ShieldCheck size={13} /> وثيقة إنجاز ميداني
                </div>
                <div>
                  <h2 className="text-5xl font-black text-white tracking-tighter">اللجنة {activeCommittee}</h2>
                  <p className="text-blue-400 font-black text-xl mt-1">منتهية ميدانياً · بانتظار الكنترول</p>
                </div>
                <p className="text-slate-400 font-bold text-base max-w-sm mx-auto leading-relaxed">
                  أستاذ {user.full_name}، تم إرسال بيانات اللجنة للكنترول بنجاح.
                  يرجى التوجه لمطابقة المظاريف في أقرب وقت.
                </p>
              </div>
              <div className="h-1 w-full bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-30" />
            </div>
          </div>
        )}


        {/* سجل مطابقة المظاريف المسلمة */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-6">
            <h3 className="text-2xl font-black text-slate-900 flex items-center gap-4">
              <History className="text-blue-600" size={32} /> سجل مطابقة
              المظاريف
            </h3>
          </div>
          <div className="grid grid-cols-1 gap-6">
            {myLogs.map((log) => {
              const totalGrade = students.filter(
                (s) =>
                  s.committee_number === activeCommittee &&
                  s.grade === log.grade,
              ).length;
              const comAbsences = absences.filter(
                (a) =>
                  a.committee_number === activeCommittee &&
                  a.date.startsWith(activeDate) &&
                  students.find((s) => s.national_id === a.student_id)
                    ?.grade === log.grade,
              );
              const absCount = comAbsences.filter(
                (a) => a.type === "ABSENT",
              ).length;
              const lateCount = comAbsences.filter(
                (a) => a.type === "LATE",
              ).length;

              return (
                <div
                  key={log.id}
                  className="bg-white p-8 rounded-[3.5rem] shadow-xl border-2 border-slate-50 flex flex-col md:flex-row justify-between items-center gap-8 transition-all hover:bg-slate-50 group"
                >
                  <div className="flex items-center gap-6 flex-1 w-full md:w-auto">
                    <div
                      className={`w-20 h-20 rounded-[1.8rem] flex items-center justify-center shadow-lg shrink-0 ${log.status === "CONFIRMED" ? "bg-emerald-600 text-white" : "bg-orange-500 text-white animate-pulse"}`}
                    >
                      {log.status === "CONFIRMED" ? (
                        <PackageCheck size={36} />
                      ) : (
                        <Package size={36} />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-1">
                        <h4 className="text-3xl font-black text-slate-900">
                          {log.grade}
                        </h4>
                        <span
                          className={`px-4 py-1 rounded-lg font-black text-[9px] uppercase tracking-widest ${log.status === "CONFIRMED" ? "bg-emerald-500 text-white" : "bg-orange-500 text-white"}`}
                        >
                          {log.status === "CONFIRMED"
                            ? "مستلم نظامياً"
                            : "متجه للكنترول"}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-lg text-[10px] font-black">
                          إجمالي: {totalGrade}
                        </span>
                        <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-lg text-[10px] font-black">
                          حاضر: {totalGrade - absCount}
                        </span>
                        <span className="bg-red-50 text-red-600 px-3 py-1 rounded-lg text-[10px] font-black">
                          غائب: {absCount}
                        </span>
                        <span className="bg-amber-50 text-amber-600 px-3 py-1 rounded-lg text-[10px] font-black">
                          تأخر: {lateCount}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 border-t md:border-t-0 md:border-r border-slate-100 pt-6 md:pt-0 md:pr-10 w-full md:w-auto justify-between md:justify-end">
                    <div className="text-right">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        المستلم
                      </p>
                      <p className="text-sm font-black text-slate-700">
                        {log.status === "CONFIRMED" ? log.teacher_name : "---"}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                        الوقت
                      </p>
                      <p className="text-xl font-black text-slate-900 tabular-nums">
                        {new Date(log.time).toLocaleTimeString("ar-SA", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <button
          onClick={() => window.location.reload()}
          className="w-full bg-slate-900 text-white py-8 rounded-[2.5rem] font-black text-2xl shadow-2xl flex items-center justify-center gap-4 active:scale-95 transition-all"
        >
          <RefreshCcw size={32} /> تحديث الحالة الميدانية
        </button>
      </div>
    );
  }

  // واجهة مسح الكود للمباشرة
  if (!activeCommittee) {
    return (
      <div className="max-w-4xl mx-auto py-10 px-4 space-y-12 animate-fade-in text-center">
        <div className="bg-slate-950 p-10 rounded-[4rem] text-white shadow-2xl relative overflow-hidden border-b-[10px] border-blue-600">
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-10">
            <div className="flex items-center gap-8">
              <div className="w-24 h-24 bg-white rounded-3xl p-1 flex items-center justify-center border-4 border-blue-500/20 shadow-2xl">
                <img
                  src={APP_CONFIG.LOGO_URL}
                  alt="Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="text-right">
                <h3 className="text-3xl font-black">{user.full_name}</h3>
                <span className="bg-blue-600 text-white px-4 py-1 rounded-full font-black text-[10px] mt-2 inline-block uppercase tracking-widest">
                  بانتظار المباشرة
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white p-12 rounded-[4rem] shadow-2xl border-b-[12px] border-slate-950">
          <div className="space-y-4 mb-12">
            <div className="bg-slate-950 w-24 h-24 rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl text-blue-400">
              <Shield size={48} />
            </div>
            <h2 className="text-5xl font-black tracking-tighter">
              بوابة المباشرة الميدانية
            </h2>
            <p className="text-slate-400 font-bold text-xl italic uppercase tracking-widest">
              امسح كود اللجنة لبدء الرصد
            </p>
          </div>
          <button
            onClick={() => {
              setIsScanning(true);
              setTimeout(async () => {
                try {
                  const scanner = new Html5Qrcode("proctor-qr-v70");
                  qrScannerRef.current = scanner;
                  await scanner.start(
                    { facingMode: "environment" },
                    { fps: 20, qrbox: 250 },
                    (text) => {
                      joinCommittee(text);
                      stopScanner();
                    },
                    () => {},
                  );
                } catch (err) {
                  setIsScanning(false);
                }
              }, 200);
            }}
            className="w-full p-12 bg-blue-600 rounded-[3.5rem] font-black text-3xl text-white shadow-2xl hover:bg-blue-700 transition-all flex flex-col items-center gap-6"
          >
            <Camera size={84} />
            <span>بدء مسح الكود</span>
          </button>
          {isScanning && (
            <div className="fixed inset-0 z-[500] bg-slate-950/98 backdrop-blur-3xl flex flex-col items-center justify-center p-8 no-print text-white">
              <div
                id="proctor-qr-v70"
                className="w-full max-w-sm aspect-square bg-black rounded-[4rem] border-8 border-white/10 overflow-hidden shadow-2xl"
              ></div>
              <button
                onClick={stopScanner}
                className="mt-12 bg-red-600 text-white px-24 py-6 rounded-[2rem] font-black text-2xl"
              >
                إلغاء
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // واجهة الرصد النشط
  return (
    <div className="space-y-8 animate-fade-in max-w-7xl mx-auto text-right pb-48 px-4 md:px-0">

      {/* ── بانر عدم الاتصال ── */}
      {isOffline && (
        <div className="bg-orange-500 text-white px-5 py-3.5 rounded-[1.5rem] flex items-center gap-3 shadow-lg font-bold text-sm animate-pulse">
          <span className="text-xl">📵</span>
          <div>
            <p className="font-black">أنت غير متصل بالإنترنت</p>
            <p className="text-orange-100 text-xs font-bold">التغييرات تُحفظ محلياً وتُزامَن تلقائياً عند عودة الاتصال</p>
          </div>
          {localPendingCount > 0 && (
            <span className="mr-auto bg-white text-orange-600 text-xs font-black px-3 py-1 rounded-full">
              {localPendingCount} معلق
            </span>
          )}
        </div>
      )}

      {/* بانر انتظار المزامنة (متصل لكن فيه معلقات) */}
      {!isOffline && localPendingCount > 0 && (
        <div className="bg-blue-600/10 border border-blue-500/30 text-blue-700 px-5 py-3 rounded-[1.5rem] flex items-center gap-3 text-sm font-bold">
          <span className="text-base">🔄</span>
          <p>جاري مزامنة {localPendingCount} تغيير محفوظ أثناء انقطاع الاتصال...</p>
        </div>
      )}

      <div className="bg-slate-950 p-8 md:p-10 rounded-[3.5rem] text-white shadow-2xl border-b-[8px] border-blue-600">
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-8">
            <div className="w-24 h-24 bg-blue-600 text-white rounded-[2rem] flex flex-col items-center justify-center font-black shadow-2xl">
              <span className="text-[10px] opacity-50 mb-1 leading-none uppercase">
                لجنة
              </span>
              <span className="text-5xl tabular-nums leading-none">
                {activeCommittee}
              </span>
            </div>
            <div className="text-right">
              <h3 className="text-3xl font-black">{user.full_name}</h3>
              <div className="flex flex-wrap items-center gap-3 mt-3">
                <span className="bg-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-lg font-black text-[10px] uppercase flex items-center gap-2 shadow-inner border border-emerald-500/20">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]"></div>{" "}
                  مباشر الآن
                </span>
                <span className="bg-white/10 text-slate-300 px-3 py-1.5 rounded-lg font-black text-sm tabular-nums flex items-center gap-2 shadow-inner font-mono tracking-widest border border-white/5">
                  <Timer size={14} className="text-blue-400" /> {elapsedTime}
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="bg-white/5 border border-white/10 p-5 rounded-3xl text-center min-w-[100px]">
              <p className="text-[8px] font-black uppercase text-slate-500 mb-1">
                الحضور
              </p>
              <p className="text-2xl font-black text-emerald-400 tabular-nums">
                {stats.present}
              </p>
            </div>
            <div className="bg-white/5 border border-white/10 p-5 rounded-3xl text-center min-w-[100px]">
              <p className="text-[8px] font-black uppercase text-slate-500 mb-1">
                الغياب
              </p>
              <p className="text-2xl font-black text-red-500 tabular-nums">
                {stats.absent}
              </p>
            </div>
            <div className="bg-white/5 border border-white/10 p-5 rounded-3xl text-center min-w-[100px]">
              <p className="text-[8px] font-black uppercase text-slate-500 mb-1">
                التأخر
              </p>
              <p className="text-2xl font-black text-amber-500 tabular-nums">
                {stats.late}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* تتبع البلاغات النشطة */}
      {myActiveRequests.length > 0 && (
        <div className="bg-white p-8 rounded-[3.5rem] shadow-2xl border-2 border-red-50 animate-bounce-subtle">
          <div className="flex items-center gap-4 mb-6 pb-4 border-b border-red-50">
            <div className="bg-red-600 p-2 rounded-xl text-white shadow-lg">
              <Bell size={20} className="animate-pulse" />
            </div>
            <h3 className="text-xl font-black text-slate-900">
              تتبع البلاغات الميدانية ({myActiveRequests.length})
            </h3>
          </div>
          <div className="space-y-4">
            {myActiveRequests.map((req) => (
              <div
                key={req.id}
                className="flex flex-col md:flex-row justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100 group"
              >
                <div className="flex items-center gap-4 flex-1">
                  <div
                    className={`w-3 h-3 rounded-full ${req.status === "PENDING" ? "bg-amber-500 animate-pulse" : "bg-blue-500"}`}
                  ></div>
                  <p className="font-black text-slate-700 text-sm">
                    {req.text}
                  </p>
                </div>
                <div className="flex items-center gap-4 mt-3 md:mt-0">
                  <span
                    className={`px-4 py-1 rounded-full font-black text-[9px] uppercase tracking-widest ${
                      req.status === "PENDING"
                        ? "bg-amber-100 text-amber-600"
                        : "bg-blue-600 text-white shadow-lg"
                    }`}
                  >
                    {req.status === "PENDING"
                      ? "بانتظار المباشرة"
                      : "المساعد في الطريق إليك"}
                  </span>
                  <div className="text-[9px] font-bold text-slate-400 font-mono">
                    {new Date(req.time).toLocaleTimeString("ar-SA", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={() => setIsReportModalOpen(true)}
          className="p-8 bg-gradient-to-br from-rose-500 to-rose-700 text-white rounded-[2.5rem] font-black text-2xl flex items-center justify-center gap-4 shadow-[0_10px_40px_rgba(225,29,72,0.4)] hover:scale-[1.02] transition-all border-b-[8px] border-rose-900 group relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-rose-400/30 blur-[40px] rounded-full group-hover:animate-ping pointer-events-none"></div>
          <div className="bg-white/20 p-2 rounded-2xl relative z-10">
             <AlertTriangle size={32} fill="currentColor" className="text-white group-hover:animate-bounce" />
          </div>
          <span className="relative z-10 tracking-tight">بلاغ ميداني عاجل</span>
        </button>
        <button
          onClick={() => {
            setClosingStep(0);
            setCurrentGradeIdx(0);
            setIsClosingWizardOpen(true);
            setCountError(null);
            setIsCountingLocked(false);
          }}
          className="p-8 bg-slate-900 text-white rounded-[2.5rem] font-black text-2xl flex items-center justify-center gap-6 shadow-xl hover:bg-slate-800 transition-all border-b-[8px] border-black"
        >
          <PackageCheck size={36} /> إنهاء وإغلاق اللجنة
        </button>
      </div>

      {/* Quick Action Filter Bar */}
      <div className="bg-white p-3 rounded-full shadow-lg border border-slate-100 flex items-center justify-between overflow-x-auto custom-scrollbar gap-2 sticky top-4 z-40">
        {[
          { id: 'ALL', label: 'الكل', count: stats.total, icon: Users, color: 'bg-slate-100 text-slate-700' },
          { id: 'PRESENT', label: 'حاضر', count: stats.present, icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-700' },
          { id: 'ABSENT', label: 'غائب', count: stats.absent, icon: X, color: 'bg-red-50 text-red-700' },
          { id: 'LATE', label: 'متأخر', count: stats.late, icon: Clock, color: 'bg-amber-50 text-amber-700' }
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id as any)}
            className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 py-3 px-4 rounded-full font-black text-sm transition-all ${filter === f.id ? f.color + ' ring-2 ring-offset-2 ring-current scale-[1.02]' : 'bg-transparent text-slate-400 hover:bg-slate-50'}`}
          >
            <f.icon size={16} />
            <span>{f.label}</span>
            <span className="bg-white/50 px-2 py-0.5 rounded-lg tabular-nums shadow-sm">{f.count}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
        {filteredStudents.map((s: Student) => {
          const status = myAbsences.find((a) => a.student_id === s.national_id);
          const isAbsent = status?.type === "ABSENT";
          const isLate = status?.type === "LATE";
          const receipt = getAbsenceReceipt(status);
          const isReceivedStatus = Boolean(status && receipt);
          const receivedTone = status?.type === "LATE" ? "late" : "absent";
          return (
            <div
              key={s.id}
              className={`p-6 md:p-8 rounded-[3.5rem] border transition-all duration-300 relative flex flex-col justify-between min-h-[300px] overflow-hidden group 
                ${isReceivedStatus ? (receivedTone === "late" ? "bg-gradient-to-br from-amber-50 via-white to-amber-50 border-amber-200 shadow-2xl shadow-amber-500/15 scale-100" : "bg-gradient-to-br from-red-50 via-white to-red-50 border-red-200 shadow-2xl shadow-red-500/15 scale-100") :
                  isAbsent ? "bg-slate-50 opacity-60 grayscale-[0.5] border-transparent shadow-none scale-95" : 
                  isLate ? "bg-gradient-to-br from-amber-50 to-white shadow-xl shadow-amber-500/10 border-amber-100" : 
                  "bg-white/80 backdrop-blur-3xl shadow-2xl border-white hover:border-blue-100"}`}
            >
              {isReceivedStatus && <div className={`absolute inset-x-0 top-0 h-2 ${receivedTone === "late" ? "bg-amber-500" : "bg-red-600"}`}></div>}
              {isLate && <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/10 blur-3xl rounded-full"></div>}
              {isReceivedStatus && <div className={`absolute top-0 right-0 w-44 h-44 ${receivedTone === "late" ? "bg-amber-500/10" : "bg-red-500/10"} blur-3xl rounded-full`}></div>}
              {(!isAbsent && !isLate) && <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 blur-3xl rounded-full"></div>}

              <div className="relative z-10 flex justify-between items-start mb-6">
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-transform ${isReceivedStatus ? (receivedTone === "late" ? "bg-amber-500 text-white shadow-amber-500/30" : "bg-red-600 text-white shadow-red-500/30") : isAbsent ? "bg-slate-300 text-slate-500 shadow-none" : isLate ? "bg-amber-500 text-white shadow-amber-500/30" : "bg-emerald-500 text-white shadow-emerald-500/30"}`}
                >
                  <GraduationCap size={28} />
                </div>
                <span
                  className={`px-4 py-1.5 rounded-xl font-black text-[10px] shadow-lg uppercase tracking-widest ${isReceivedStatus ? (receivedTone === "late" ? "bg-amber-500 text-white shadow-amber-500/20" : "bg-red-600 text-white shadow-red-500/20") : isAbsent ? "bg-slate-300 text-slate-600 shadow-none" : isLate ? "bg-amber-500 text-white shadow-amber-500/20" : "bg-emerald-100 text-emerald-700 shadow-none border border-emerald-200"}`}
                >
                  {status ? (receipt ? `مستلم - ${getAbsenceKindLabel(status.type)}` : isAbsent ? "تم طي القيد - غائب" : "متأخر") : "حاضر"}
                </span>
              </div>
              <div className="relative z-10 flex-1 text-right space-y-3 px-2">
                <h4 className={`text-2xl font-black break-words leading-tight ${isReceivedStatus ? (receivedTone === "late" ? "text-amber-950" : "text-red-950") : isAbsent ? "text-slate-500 line-through decoration-slate-300 decoration-2" : "text-slate-900"}`}>
                  {s.name}
                </h4>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-lg text-[9px] font-black ${isReceivedStatus ? (receivedTone === "late" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700") : isAbsent ? "bg-slate-200 text-slate-400" : "bg-slate-100 text-slate-500"}`}>
                    {s.grade} - فصل {s.section}
                  </span>
                  <span className={`px-3 py-1 rounded-lg text-[9px] font-black tabular-nums border ${isReceivedStatus ? (receivedTone === "late" ? "bg-white text-amber-700 border-amber-100" : "bg-white text-red-700 border-red-100") : isAbsent ? "bg-slate-200 text-slate-400 border-transparent" : "bg-white text-slate-600 border-slate-200"}`}>
                    جلوس: {s.seating_number || '-'}
                  </span>
                </div>
                {status && (
                  receipt ? (
                    <div className={`rounded-3xl border-2 px-5 py-4 text-white shadow-xl ${receivedTone === "late" ? "border-amber-200 bg-amber-500 shadow-amber-500/20" : "border-red-200 bg-red-600 shadow-red-500/20"}`}>
                      <p className="text-xs font-black">تم استلام {getAbsenceKindLabel(status.type)}</p>
                      <p className="mt-2 text-sm font-black leading-6">المستلم: {receipt.role} - {receipt.by}</p>
                      <p className={`mt-1 text-xs font-bold ${receivedTone === "late" ? "text-amber-50" : "text-red-100"}`}>الوقت: {new Date(receipt.at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  ) : (
                    <div className="rounded-2xl border px-4 py-3 text-[10px] font-black bg-orange-50 text-orange-700 border-orange-100">
                      بانتظار استلام {getAbsenceKindLabel(status?.type)} من الموجه/مساعد الكنترول
                    </div>
                  )
                )}
              </div>
              <div className="relative z-10 grid grid-cols-2 gap-3 mt-8">
                <button
                  onClick={() => toggleStudentStatus(s, "ABSENT")}
                  className={`py-4 rounded-[1.8rem] font-black text-xs transition-all flex items-center justify-center gap-2 ${isAbsent ? "bg-slate-800 text-white shadow-lg" : "bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-red-500 border border-slate-100"}`}
                >
                  {isAbsent ? <Check size={16} /> : <X size={16} />} 
                  {isAbsent ? "إلغاء الغياب" : "رصد غياب"}
                </button>
                <button
                  onClick={() => toggleStudentStatus(s, "LATE")}
                  disabled={isAbsent}
                  className={`py-4 rounded-[1.8rem] font-black text-xs transition-all flex items-center justify-center gap-2 ${isAbsent ? "opacity-50 cursor-not-allowed bg-slate-50 text-slate-300" : isLate ? "bg-amber-500 text-white shadow-lg shadow-amber-500/30" : "bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-amber-600 border border-slate-100"}`}
                >
                  {isLate ? <Check size={16} /> : <Clock size={16} />}
                  {isLate ? "إلغاء التأخر" : "رصد تأخر"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* نافذة البلاغات المتطورة */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-[700] flex items-center justify-center p-4 animate-fade-in no-print">
          <div
            className="absolute inset-0 bg-slate-950/98 backdrop-blur-3xl"
            onClick={() => setIsReportModalOpen(false)}
          ></div>
          <div className="bg-white w-full max-w-2xl rounded-[4rem] shadow-2xl relative z-10 overflow-hidden border-b-[15px] border-rose-600 animate-slide-up my-auto">
            <div className="bg-rose-600 p-8 text-white flex justify-between items-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-3xl rounded-full"></div>
              <div className="flex items-center gap-4 relative z-10">
                <div className="bg-white/20 p-3 rounded-2xl">
                  <Zap size={24} />
                </div>
                <h3 className="text-2xl font-black italic">
                  مركز بلاغات اللجنة {activeCommittee}
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsReportModalOpen(false);
                  resetReportState();
                }}
                className="bg-white/20 p-2 rounded-full hover:bg-white/30 transition-all"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-8">
              {reportStep === "CATEGORIES" && (
                <div className="grid grid-cols-2 gap-4 animate-fade-in">
                  {[
                    {
                      id: "ANSWER_SHEET",
                      label: "طلب ورقة إجابة",
                      icon: FileText,
                      step: "SELECT_STUDENTS",
                      color: "bg-blue-50 text-blue-600",
                    },
                    {
                      id: "SUBJECT_TEACHER",
                      label: "طلب معلم المادة",
                      icon: UserSearch,
                      step: "SELECT_TEACHER",
                      color: "bg-purple-50 text-purple-600",
                    },
                    {
                      id: "PENCIL",
                      label: "طلب مرسام",
                      icon: Pencil,
                      step: "INPUT_QUANTITY",
                      color: "bg-amber-50 text-amber-600",
                    },
                    {
                      id: "QUESTION_SHEET",
                      label: "طلب ورقة أسئلة",
                      icon: FileText,
                      step: "INPUT_QUANTITY",
                      color: "bg-indigo-50 text-indigo-600",
                    },
                    {
                      id: "HEALTH",
                      label: "حالة صحية",
                      icon: Stethoscope,
                      step: "CONFIRM",
                      color: "bg-red-50 text-red-600",
                    },
                    {
                      id: "OTHER",
                      label: "بلاغ آخر",
                      icon: MessageSquare,
                      step: "OTHER",
                      color: "bg-slate-50 text-slate-600",
                    },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => {
                        setSelectedCategory(cat.id);
                        if (cat.id === "HEALTH") setSelectedCategory("HEALTH");
                        else setReportStep(cat.step as any);
                      }}
                      className="p-8 bg-white border-2 border-slate-100 rounded-[2.5rem] flex flex-col items-center gap-4 hover:border-rose-500 hover:shadow-xl transition-all group"
                    >
                      <div
                        className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform ${cat.color}`}
                      >
                        <cat.icon size={32} />
                      </div>
                      <span className="font-black text-slate-800 text-sm">
                        {cat.label}
                      </span>
                    </button>
                  ))}
                  {selectedCategory === "HEALTH" && (
                    <button
                      onClick={handleUrgentReport}
                      className="col-span-2 py-6 bg-red-600 text-white rounded-[2rem] font-black text-xl shadow-xl mt-4 animate-pulse"
                    >
                      تأكيد إرسال البلاغ الصحي العاجل
                    </button>
                  )}
                </div>
              )}

              {reportStep === "SELECT_STUDENTS" && (
                <div className="space-y-6 animate-fade-in">
                  <div className="flex items-center gap-3 mb-4">
                    <Users className="text-blue-600" />
                    <h4 className="text-xl font-black text-slate-800">
                      اختر الطلاب المحتاجين للورقة:
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                    {myStudents.map((s) => (
                      <button
                        key={s.id}
                        onClick={() =>
                          setSelectedStudentIds((prev) =>
                            prev.includes(s.national_id)
                              ? prev.filter((id) => id !== s.national_id)
                              : [...prev, s.national_id],
                          )
                        }
                        className={`p-4 rounded-2xl flex items-center justify-between border-2 transition-all ${selectedStudentIds.includes(s.national_id) ? "bg-blue-50 border-blue-600" : "bg-slate-50 border-slate-100"}`}
                      >
                        <span className="font-bold text-slate-800">
                          {s.name}
                        </span>
                        {selectedStudentIds.includes(s.national_id) ? (
                          <CheckCircle2 className="text-blue-600" />
                        ) : (
                          <div className="w-6 h-6 rounded-full border-2 border-slate-200"></div>
                        )}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleUrgentReport}
                      disabled={selectedStudentIds.length === 0}
                      className="flex-1 py-6 bg-rose-600 text-white rounded-[2rem] font-black text-xl shadow-xl disabled:opacity-50"
                    >
                      إرسال الطلب ({selectedStudentIds.length})
                    </button>
                    <button
                      onClick={() => setReportStep("CATEGORIES")}
                      className="px-8 bg-slate-100 text-slate-600 rounded-[2rem] font-black"
                    >
                      رجوع
                    </button>
                  </div>
                </div>
              )}

              {reportStep === "SELECT_TEACHER" && (
                <div className="space-y-6 animate-fade-in">
                  <div className="flex items-center gap-3 mb-4">
                    <UserCog className="text-purple-600" />
                    <h4 className="text-xl font-black text-slate-800">
                      اختر المعلم المراد استدعاؤه:
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                    {/* جلب كافة المعلمين باستثناء الإداريين */}
                    {users
                      .filter((u) => u.id !== user.id)
                      .map((u) => (
                        <button
                          key={u.id}
                          onClick={() => setOtherText(u.full_name)}
                          className={`p-4 rounded-2xl flex items-center justify-between border-2 transition-all ${otherText === u.full_name ? "bg-purple-50 border-purple-600" : "bg-slate-50 border-slate-100"}`}
                        >
                          <div className="text-right">
                            <p className="font-bold text-slate-800">
                              {u.full_name}
                            </p>
                            <p className="text-[9px] font-black text-slate-400 uppercase">
                              {ROLES_ARABIC[u.role]}
                            </p>
                          </div>
                          {otherText === u.full_name ? (
                            <CheckCircle2 className="text-purple-600" />
                          ) : (
                            <div className="w-6 h-6 rounded-full border-2 border-slate-200"></div>
                          )}
                        </button>
                      ))}
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleUrgentReport}
                      disabled={!otherText}
                      className="flex-1 py-6 bg-rose-600 text-white rounded-[2rem] font-black text-xl shadow-xl disabled:opacity-50"
                    >
                      إرسال الاستدعاء
                    </button>
                    <button
                      onClick={() => setReportStep("CATEGORIES")}
                      className="px-8 bg-slate-100 text-slate-600 rounded-[2rem] font-black"
                    >
                      رجوع
                    </button>
                  </div>
                </div>
              )}

              {reportStep === "INPUT_QUANTITY" && (
                <div className="space-y-8 animate-fade-in text-center">
                  <h4 className="text-xl font-black text-slate-800">
                    حدد الكمية المطلوبة بدقة:
                  </h4>
                  <div className="flex items-center justify-center gap-10">
                    <button
                      onClick={() =>
                        setQuantity((prev) => Math.max(1, prev - 1))
                      }
                      className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 active:scale-90 transition-transform"
                    >
                      <Minus size={32} />
                    </button>
                    <span className="text-7xl font-black text-slate-900 tabular-nums">
                      {quantity}
                    </span>
                    <button
                      onClick={() => setQuantity((prev) => prev + 1)}
                      className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 active:scale-90 transition-transform"
                    >
                      <Plus size={32} />
                    </button>
                  </div>
                  <div className="flex gap-3 mt-8">
                    <button
                      onClick={handleUrgentReport}
                      className="flex-1 py-6 bg-rose-600 text-white rounded-[2rem] font-black text-xl shadow-xl"
                    >
                      تأكيد الطلب
                    </button>
                    <button
                      onClick={() => setReportStep("CATEGORIES")}
                      className="px-8 bg-slate-100 text-slate-600 rounded-[2rem] font-black"
                    >
                      رجوع
                    </button>
                  </div>
                </div>
              )}

              {reportStep === "OTHER" && (
                <div className="space-y-6 animate-fade-in">
                  <h4 className="text-xl font-black text-slate-800">
                    اكتب تفاصيل البلاغ للإدارة:
                  </h4>
                  <textarea
                    value={otherText}
                    onChange={(e) => setOtherText(e.target.value)}
                    className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-[2rem] font-bold text-lg h-32 outline-none focus:border-rose-600"
                    placeholder="اكتب هنا بوضوح..."
                  ></textarea>
                  <div className="flex gap-3">
                    <button
                      onClick={handleUrgentReport}
                      disabled={!otherText.trim()}
                      className="flex-1 py-6 bg-rose-600 text-white rounded-[2rem] font-black text-xl shadow-xl disabled:opacity-50"
                    >
                      إرسال البلاغ
                    </button>
                    <button
                      onClick={() => setReportStep("CATEGORIES")}
                      className="px-8 bg-slate-100 text-slate-600 rounded-[2rem] font-black"
                    >
                      رجوع
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* نافذة إغلاق وتقفيل اللجنة - بتصميم جذاب وأكثر حماية لمنع التداخل */}
      {isClosingWizardOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 overflow-hidden animate-fade-in no-print bg-slate-900/40">
          <div
            className="absolute inset-0 backdrop-blur-md"
            onClick={() => !isVerifying && setIsClosingWizardOpen(false)}
          ></div>

          <div
            className="bg-white w-full max-w-3xl max-h-[90vh] flex flex-col rounded-[3rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] relative z-10 border-2 border-slate-100 ring-4 ring-white/50 animate-slide-up"
            style={{ maxHeight: "95vh", overflow: "hidden" }}
          >
            {isVerifying ? (
              <div className="p-16 flex-1 flex flex-col items-center justify-center space-y-10 min-h-[400px]">
                <div className="relative">
                  <div className="absolute inset-0 bg-blue-500 blur-3xl opacity-20 rounded-full animate-pulse"></div>
                  <Loader2
                    size={120}
                    className="text-blue-600 animate-spin relative z-10"
                  />
                </div>
                <h3 className="text-4xl font-black text-slate-900 tracking-tighter italic text-center leading-tight">
                  جاري الأرشفة والتوثيق...
                  <br />
                  <span className="text-blue-600 text-2xl mt-4 inline-block">
                    يرجى الانتظار
                  </span>
                </h3>
              </div>
            ) : closingStep === 0 ? (
              <div className="flex flex-col h-full overflow-hidden">
                <div className="p-8 sm:p-10 border-b-2 border-slate-50 bg-slate-50/50 shrink-0">
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-5">
                      <div className="bg-emerald-100 p-4 rounded-3xl text-emerald-600 shadow-inner">
                        <CheckCircle2 size={40} />
                      </div>
                      <h3 className="text-3xl font-black tracking-tighter text-slate-900">
                        مراجعة الحالات
                      </h3>
                    </div>
                    <button
                      onClick={() => setIsClosingWizardOpen(false)}
                      className="bg-white p-3 rounded-full hover:bg-red-50 hover:text-red-500 transition-colors border border-slate-200 shadow-sm text-slate-500"
                    >
                      <X size={24} />
                    </button>
                  </div>
                  <p className="text-slate-500 font-bold text-lg leading-relaxed">
                    يرجى مراجعة حالات الغياب. يمكنك تحويل حالة الطالب من غائب
                    لمتأخر في حال وصوله للمقعد الآن:
                  </p>
                </div>

                <div className="flex-1 overflow-y-auto p-6 sm:p-10 space-y-4 bg-slate-50/30 custom-scrollbar relative">
                  {myAbsences.length === 0 ? (
                    <div className="py-16 text-center flex flex-col items-center gap-6 h-full justify-center">
                      <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center border-4 border-emerald-100">
                        <Check size={48} className="text-emerald-500" />
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-3xl text-slate-800 font-black">
                          قائمة الحضور مكتملة!
                        </h4>
                        <p className="text-slate-500 font-bold text-lg">
                          لا يوجد غياب أو تأخر في هذه اللجنة.
                        </p>
                      </div>
                    </div>
                  ) : (
                    myAbsences.map((a) => (
                      <div
                        key={a.id}
                        className="flex flex-col sm:flex-row justify-between items-center p-5 sm:p-6 bg-white rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all gap-5 group"
                      >
                        <div className="flex flex-col flex-1 text-center sm:text-right w-full">
                          <span className="font-black text-slate-900 text-xl">
                            {a.student_name}
                          </span>
                          <div className="mt-2">
                            <span
                              className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${a.type === "ABSENT" ? "bg-red-50 text-red-600 border border-red-100" : "bg-amber-50 text-amber-600 border border-amber-100"}`}
                            >
                              {a.type === "ABSENT"
                                ? "حالة: غائب"
                                : "حالة: متأخر"}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            const newType =
                              a.type === "ABSENT" ? "LATE" : "ABSENT";
                            await db.absences.upsert({ ...a, type: newType });
                            await setAbsences();
                          }}
                          className="w-full sm:w-auto bg-slate-50 text-slate-600 px-6 py-4 rounded-[1.5rem] hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all flex items-center justify-center gap-3 text-sm font-black active:scale-95 group/btn border border-slate-200"
                        >
                          <RefreshCcw
                            size={18}
                            className="group-hover/btn:rotate-180 transition-transform duration-500"
                          />
                          {a.type === "ABSENT" ? "تعديل لمتأخر" : "تعديل لغائب"}
                        </button>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-6 sm:p-8 border-t-2 border-slate-50 bg-white shrink-0">
                  <button
                    onClick={() => setClosingStep(1)}
                    className="w-full bg-slate-900 text-white py-6 rounded-[2rem] font-black text-2xl flex items-center justify-center gap-6 shadow-xl hover:bg-slate-800 active:scale-95 transition-all outline-none"
                  >
                    <span className="mt-1">متابعة الفرز والعد</span>
                    <ChevronLeft size={32} />
                  </button>
                </div>
              </div>
            ) : closingStep === 1 ? (
              <div className="flex flex-col h-full overflow-hidden">
                <div className="p-8 sm:p-10 text-center border-b-2 border-slate-50 shrink-0 relative">
                  <div className="flex items-center justify-between mb-8">
                    <button
                      onClick={() => {
                        setClosingStep(0);
                        setCountError(null);
                      }}
                      className="bg-slate-100 p-4 rounded-full text-slate-500 hover:bg-slate-200 transition-colors outline-none cursor-pointer border border-transparent shadow-sm"
                    >
                      <ChevronRight size={24} />
                    </button>
                    <div className="bg-blue-50 border border-blue-100 text-blue-600 px-8 py-2.5 rounded-full text-xl font-black shadow-inner">
                      {myGrades[currentGradeIdx]}
                    </div>
                    <button
                      onClick={() => setIsClosingWizardOpen(false)}
                      className="bg-white p-3 rounded-full hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors shadow-sm border border-slate-200 cursor-pointer"
                    >
                      <X size={24} />
                    </button>
                  </div>
                  <h4 className="text-4xl font-black text-slate-900 tracking-tighter mb-4">
                    حصيلة أوراق الإجابة
                  </h4>
                  <p className="text-slate-400 font-bold text-lg uppercase tracking-widest hidden sm:block">
                    قم بعد الأوراق الفعلية داخل مظروف الإجابة
                  </p>
                </div>

                <div className="flex-1 overflow-y-auto p-6 sm:p-10 flex flex-col items-center justify-center gap-8 bg-slate-50/20">
                  <div className="text-slate-500 font-bold mb-2 sm:hidden text-center text-sm px-4">
                    قم بعد الأوراق الفعلية وأدخل العدد أدناه:
                  </div>
                  <div className="flex items-center justify-center gap-6 sm:gap-10 w-full max-w-sm mx-auto">
                    <button
                      onClick={() => {
                        setClosingCounts((prev) => ({
                          ...prev,
                          [myGrades[currentGradeIdx]]: Math.max(
                            0,
                            (prev[myGrades[currentGradeIdx]] || 0) - 1,
                          ),
                        }));
                        setCountError(null);
                        setIsCountingLocked(false);
                      }}
                      className="w-16 h-16 sm:w-20 sm:h-20 bg-white border-2 border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:border-slate-300 hover:shadow-md active:scale-90 transition-all shrink-0 cursor-pointer outline-none"
                    >
                      <Minus size={36} />
                    </button>

                    <div className="relative group flex-1">
                      <input
                        type="number"
                        value={closingCounts[myGrades[currentGradeIdx]] || 0}
                        onChange={(e) => {
                          setClosingCounts({
                            ...closingCounts,
                            [myGrades[currentGradeIdx]]:
                              parseInt(e.target.value) || 0,
                          });
                          setCountError(null);
                          setIsCountingLocked(false);
                        }}
                        className={`w-full aspect-square bg-white border-4 rounded-[2.5rem] text-center font-black text-6xl text-slate-900 outline-none tabular-nums shadow-lg transition-all m-0 p-0 ${countError ? "border-red-500 bg-red-50 animate-shake text-red-600" : "border-blue-100 focus:border-blue-500 focus:ring-4 ring-blue-500/20"}`}
                        style={{ MozAppearance: "textfield" }}
                      />
                    </div>

                    <button
                      onClick={() => {
                        setClosingCounts((prev) => ({
                          ...prev,
                          [myGrades[currentGradeIdx]]:
                            (prev[myGrades[currentGradeIdx]] || 0) + 1,
                        }));
                        setCountError(null);
                        setIsCountingLocked(false);
                      }}
                      className="w-16 h-16 sm:w-20 sm:h-20 bg-white border-2 border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-300 hover:shadow-md active:scale-90 transition-all shrink-0 cursor-pointer outline-none"
                    >
                      <Plus size={36} />
                    </button>
                  </div>

                  {countError && (
                    <div className="w-full max-w-sm mx-auto bg-red-50/80 backdrop-blur-sm p-5 rounded-2xl border border-red-200 flex flex-col items-center gap-3 text-red-700 text-center animate-slide-up shadow-sm mt-4">
                      <AlertTriangle
                        className="shrink-0 text-red-500 hidden sm:block"
                        size={28}
                      />
                      <p className="text-sm font-black leading-relaxed">
                        {countError}
                      </p>
                    </div>
                  )}
                </div>

                <div className="p-6 sm:p-8 border-t-2 border-slate-50 bg-white shrink-0 relative z-10">
                  <button
                    onClick={validateAndNext}
                    disabled={isCountingLocked && !!countError}
                    className={`w-full py-6 rounded-[2rem] font-black text-2xl flex items-center justify-center gap-4 transition-all active:scale-95 outline-none ${isCountingLocked && !!countError ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none border-b-4 border-slate-300" : "bg-emerald-600 text-white border-b-[6px] border-emerald-800 shadow-xl shadow-emerald-600/20 hover:bg-emerald-500 hover:-translate-y-1"}`}
                  >
                    <span className="mt-1">
                      {currentGradeIdx === myGrades.length - 1
                        ? "تأكيد وإرسال للكنترول"
                        : "التالي"}
                    </span>
                    {currentGradeIdx === myGrades.length - 1 ? (
                      <PackageCheck size={32} />
                    ) : (
                      <ChevronLeft size={32} />
                    )}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      <style>{`
         @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
         .animate-fade-in { animation: fade-in 0.4s ease-out; }
         .custom-scrollbar::-webkit-scrollbar { height: 4px; width: 4px; }
         .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
         .animate-bounce-subtle { animation: bounce-subtle 3s infinite; }
         @keyframes bounce-subtle { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
         @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
         .animate-shake { animation: shake 0.2s cubic-bezier(.36,.07,.19,.97) both; transform: translate3d(0, 0, 0); }
       `}</style>
    </div>
  );
};

export default ProctorDailyAssignmentFlow;
