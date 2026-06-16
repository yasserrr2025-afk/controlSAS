
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { User, Student, Absence, DeliveryLog, Supervision, ControlRequest } from '../../types';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  PackageCheck, Clock, Users, LayoutGrid, Scan, 
  CheckCircle2, Check, ChevronLeft, Loader2, Save, 
  Trophy, Zap, History, UserCircle, UserX, AlertCircle,
  X, Lock, Unlock, Camera, ShieldCheck, UserCheck,
  ClipboardCheck, MapPin, Search, GraduationCap, ArrowRight,
  Activity, Play, CheckCircle, AlertTriangle, FileText, ShieldAlert,
  Timer, Inbox, SlidersHorizontal
} from 'lucide-react';
import { db } from '../../supabase';
import { buildSignatureText, isInternalSignatureRecord, isSignatureRequest, SIGNATURE_REQUEST_PREFIX } from '../../services/signatures';

interface Props {
  user: User;
  students: Student[];
  absences: Absence[];
  deliveryLogs: DeliveryLog[];
  setDeliveryLogs: (log: DeliveryLog) => Promise<void>;
  supervisions: Supervision[];
  users: User[];
  onAlert: any;
  controlRequests: ControlRequest[];
  setControlRequests: any;
  systemConfig: any;
}

const ControlReceiptView: React.FC<Props> = ({ user, students, absences, deliveryLogs, setDeliveryLogs, supervisions, users, onAlert, controlRequests, setControlRequests, systemConfig }) => {
  const [activeCommitteeId, setActiveCommitteeId] = useState<string | null>(null);
  const [currentQueueIndex, setCurrentQueueIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isSuccessState, setIsSuccessState] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'READY' | 'WAITING' | 'RECEIVED'>('ALL');
  const [receiptNote, setReceiptNote] = useState('');
  const [listSearch, setListSearch] = useState('');
  const [summonReason, setSummonReason] = useState('مراجعة المستلم');
  const [summonNote, setSummonNote] = useState('');
  const [isSummonSaving, setIsSummonSaving] = useState(false);
  const [receiverSignatureOpen, setReceiverSignatureOpen] = useState(false);
  const [receiverSignatureData, setReceiverSignatureData] = useState('');
  const receiverSignatureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const receiverSignatureDrawingRef = useRef(false);
  const qrScannerRef = useRef<Html5Qrcode | null>(null);

  const todayDate = systemConfig?.active_exam_date || new Date().toISOString().split('T')[0];

  const cleanId = (id: string | number | undefined): string => {
    if (id === undefined || id === null) return '';
    return String(id).trim();
  };

  /* ── مطابقة التاريخ بمرونة (يتعامل مع ISO كامل أو YYYY-MM-DD) ── */
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

  const matchDate = (isoStr: string | undefined | null, date: string): boolean => {
    if (!isoStr || !date) return false;
    const text = String(isoStr);
    return text.startsWith(date) || getRiyadhDateKey(text) === date;
  };

  const getUniqueKey = (committee: string | number, grade: string): string => {
    return `${cleanId(committee)}_${grade.trim()}`;
  };

  const actualTodayDate = useMemo(() => {
    return getRiyadhDateKey(new Date());
  }, []);

  const matchesReceiptWorkDate = (value?: string | null) => {
    return matchDate(value, todayDate) || matchDate(value, actualTodayDate);
  };

  // اللجان التي أغلقها المراقب ميدانياً اليوم وتنتظر الاستلام الفعلي
  const proctorSubmittedCommittees = useMemo(() => {
    return new Set(
      deliveryLogs
        .filter(l => l.type === 'RECEIVE' && (l.status === 'PENDING' || l.proctor_name) && matchesReceiptWorkDate(l.time))
        .map(l => cleanId(l.committee_number))
    );
  }, [deliveryLogs, todayDate, actualTodayDate]);

  const receivedKeys = useMemo(() => {
    return new Set(deliveryLogs.filter(l => l.type === 'RECEIVE' && l.status === 'CONFIRMED' && matchDate(l.time, todayDate)).map(l => getUniqueKey(l.committee_number, l.grade)));
  }, [deliveryLogs, todayDate]);

  const myGrades = useMemo(() => {
    const all = Array.from(new Set(students.map(s => s.grade))).filter(Boolean);
    if (user.role === 'ADMIN' || user.role === 'CONTROL_MANAGER') return all;
    return all.filter(g => user.assigned_grades?.includes(g));
  }, [students, user]);

  const myTotalScope = useMemo(() => {
    const map: Record<string, { grade: string, count: number, committee: string, key: string }> = {};
    students.filter(s => myGrades.includes(s.grade)).forEach(s => {
      const key = getUniqueKey(s.committee_number, s.grade);
      if (!map[key]) {
        map[key] = { grade: s.grade, count: 0, committee: cleanId(s.committee_number), key };
      }
      map[key].count++;
    });
    return map;
  }, [students, myGrades]);

  const stats = useMemo(() => {
    const allKeys = Object.keys(myTotalScope);
    const remaining = allKeys.filter(k => !receivedKeys.has(k));
    
    return {
      remainingCount: remaining.length,
      remainingKeys: remaining.sort((a, b) => parseInt(myTotalScope[a].committee) - parseInt(myTotalScope[b].committee))
    };
  }, [myTotalScope, receivedKeys]);

  const currentQueue = useMemo(() => {
    if (!activeCommitteeId) return [];
    return Object.keys(myTotalScope)
      .filter(k => myTotalScope[k].committee === cleanId(activeCommitteeId) && !receivedKeys.has(k))
      .map(k => ({ ...myTotalScope[k] }))
      .sort((a, b) => a.grade.localeCompare(b.grade));
  }, [activeCommitteeId, myTotalScope, receivedKeys]);

  const recentLogs = useMemo(() => {
    return deliveryLogs
      .filter(l => l.type === 'RECEIVE' && l.status === 'CONFIRMED' && matchDate(l.time, todayDate) && l.teacher_name === user.full_name)
      .sort((a,b) => b.time.localeCompare(a.time))
      .slice(0, 5);
  }, [deliveryLogs, todayDate, user.full_name]);

  const isReceiverSummon = (request: ControlRequest) => request.text?.startsWith('[CALL_RECEIVER]');
  const cleanSummonText = (text?: string) => String(text || '').replace('[CALL_RECEIVER]', '').trim();

  const activeCommitteeSummons = useMemo(() => {
    if (!activeCommitteeId) return [];
    return controlRequests
      .filter(request => request.committee === activeCommitteeId && request.status !== 'DONE' && isReceiverSummon(request))
      .sort((a, b) => b.time.localeCompare(a.time));
  }, [activeCommitteeId, controlRequests]);

  const handleSendSummon = async () => {
    if (!activeCommitteeId || isSummonSaving) return;
    setIsSummonSaving(true);
    try {
      const notePart = summonNote.trim() ? ` - ${summonNote.trim()}` : '';
      await db.controlRequests.insert({
        from: `${user.full_name} - المستلم`,
        committee: activeCommitteeId,
        text: `[CALL_RECEIVER] استدعاء المراقب: ${summonReason}${notePart}`,
        time: new Date().toISOString(),
        status: 'PENDING',
      });
      setSummonNote('');
      await setControlRequests();
      onAlert('تم إرسال استدعاء المراقب لهذه اللجنة.', 'success');
    } catch (error: any) {
      onAlert(error.message || 'تعذر إرسال استدعاء المراقب.', 'error');
    } finally {
      setIsSummonSaving(false);
    }
  };

  const handleCloseSummon = async (requestId: string) => {
    if (isSummonSaving) return;
    setIsSummonSaving(true);
    try {
      await db.controlRequests.updateStatus(requestId, 'DONE', user.full_name);
      await setControlRequests();
      onAlert('تم إغلاق الاستدعاء من شاشة الاستلام.', 'success');
    } catch (error: any) {
      onAlert(error.message || 'تعذر إغلاق الاستدعاء.', 'error');
    } finally {
      setIsSummonSaving(false);
    }
  };

  const progressPercentage = useMemo(() => {
    const total = Object.keys(myTotalScope).length;
    if (total === 0) return 0;
    const scopedReceived = Object.keys(myTotalScope).filter(k => receivedKeys.has(k)).length;
    return Math.round((scopedReceived / total) * 100);
  }, [myTotalScope, receivedKeys]);

  const scopeCards = useMemo(() => {
    return Object.values(myTotalScope)
      .map(info => {
        const isReceived = receivedKeys.has(info.key);
        const sv = supervisions.find(s => cleanId(s.committee_number) === info.committee && matchDate(s.date, todayDate));
        const proctor = users.find(u => u.id === sv?.teacher_id);
        const confirmedLog = deliveryLogs.find(l => l.status === 'CONFIRMED' && matchDate(l.time, todayDate) && getUniqueKey(l.committee_number, l.grade) === info.key);
        const pendingLog = deliveryLogs.find(l => l.status === 'PENDING' && matchesReceiptWorkDate(l.time) && getUniqueKey(l.committee_number, l.grade) === info.key)
          || deliveryLogs.find(l => l.type === 'RECEIVE' && l.status === 'PENDING' && matchesReceiptWorkDate(l.time) && cleanId(l.committee_number) === info.committee);
        const isReady = !isReceived && (proctorSubmittedCommittees.has(info.committee) || Boolean(pendingLog));
        const gradeAbsences = absences.filter(a => a.committee_number === info.committee && a.type === 'ABSENT' && matchDate(a.date, todayDate) && students.find(s => s.national_id === a.student_id)?.grade === info.grade);
        const gradeLates = absences.filter(a => a.committee_number === info.committee && a.type === 'LATE' && matchDate(a.date, todayDate) && students.find(s => s.national_id === a.student_id)?.grade === info.grade);
        const openAlerts = controlRequests.filter(r => r.committee === info.committee && r.status !== 'DONE' && !isInternalSignatureRecord(r) && !isSignatureRequest(r));
        const status = isReceived ? 'RECEIVED' : isReady ? 'READY' : 'WAITING';
        return {
          ...info,
          status,
          isReceived,
          isReady,
          proctorName: proctor?.full_name || pendingLog?.proctor_name || 'بانتظار المباشرة',
          receiverName: confirmedLog?.teacher_name || '',
          receivedAt: confirmedLog?.time || '',
          closedAt: pendingLog?.time || '',
          absences: gradeAbsences.length,
          lates: gradeLates.length,
          openAlerts,
        };
      })
      .filter(card => {
        if (statusFilter === 'ALL') return true;
        return card.status === statusFilter;
      })
      .filter(card => {
        const term = listSearch.trim();
        if (!term) return true;
        return card.committee.includes(term) || card.grade.includes(term) || card.proctorName.includes(term);
      })
      .sort((a, b) => {
        const rank = { READY: 0, WAITING: 1, RECEIVED: 2 } as Record<string, number>;
        return rank[a.status] - rank[b.status] || Number(a.committee) - Number(b.committee) || a.grade.localeCompare(b.grade);
      });
  }, [absences, actualTodayDate, controlRequests, deliveryLogs, listSearch, myTotalScope, proctorSubmittedCommittees, receivedKeys, statusFilter, students, supervisions, todayDate, users]);

  const personalStats = useMemo(() => {
    const cards = Object.values(myTotalScope);
    const received = cards.filter(c => receivedKeys.has(c.key)).length;
    const ready = cards.filter(c => !receivedKeys.has(c.key) && proctorSubmittedCommittees.has(c.committee)).length;
    const waiting = cards.filter(c => !receivedKeys.has(c.key) && !proctorSubmittedCommittees.has(c.committee)).length;
    const mineToday = deliveryLogs.filter(l => l.status === 'CONFIRMED' && l.teacher_name === user.full_name && matchDate(l.time, todayDate));
    return { total: cards.length, received, ready, waiting, mineToday: mineToday.length };
  }, [deliveryLogs, myTotalScope, proctorSubmittedCommittees, receivedKeys, todayDate, user.full_name]);

  // دالة المعالجة الذكية (تقبل رقم لجنة أو رقم هوية مراقب)
  const handleStartProcess = (val: string) => {
    const input = cleanId(val);
    if (!input) return;

    let targetCommitteeNum = input;
    
    // 1. التحقق أولاً: هل المدخل هو رقم هوية مراقب مسجل؟
    const proctorUser = users.find(u => cleanId(u.national_id) === input);
    
    if (proctorUser) {
      // إذا كانت هوية مراقب، نبحث عن تكليفه النشط اليوم
      const sv = supervisions.find(s => s.teacher_id === proctorUser.id && matchDate(s.date, todayDate));
      if (sv) {
        targetCommitteeNum = cleanId(sv.committee_number);
        onAlert(`تم التعرف على المراقب: ${proctorUser.full_name} - لجنة ${targetCommitteeNum}`);
      } else {
        onAlert(`تنبيه: المراقب ${proctorUser.full_name} ليس لديه تكليف مسجل اليوم.`);
        return;
      }
    }

    // 2. التحقق من أن اللجنة (سواء أدخلت مباشرة أو عبر هوية المراقب) قد تم إنهاؤها ميدانياً
    if (!proctorSubmittedCommittees.has(targetCommitteeNum)) {
      onAlert(`عذراً: اللجنة ${targetCommitteeNum} لم يتم إنهاؤها ميدانياً من قبل المراقب بعد.`);
      return;
    }

    // 3. التحقق من التبعية والصلاحيات
    const waiting = Object.keys(myTotalScope).filter(k => myTotalScope[k].committee === targetCommitteeNum && !receivedKeys.has(k));
    if (waiting.length === 0) {
      onAlert(`اللجنة ${targetCommitteeNum} مستلمة بالكامل أو خارج نطاق صلاحياتك الحالية.`);
      return;
    }

    setActiveCommitteeId(targetCommitteeNum);
    setCurrentQueueIndex(0);
    setSearchInput('');
    stopScanner();
  };

  const stopScanner = async () => {
    if (qrScannerRef.current) {
      try { 
        if (qrScannerRef.current.isScanning) {
          await qrScannerRef.current.stop(); 
        }
      } catch (e) { console.warn(e); } finally {
        qrScannerRef.current = null;
        setIsScanning(false);
      }
    }
  };

  const getCanvasPoint = (canvas: HTMLCanvasElement, event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const startReceiverSignature = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = receiverSignatureCanvasRef.current;
    if (!canvas) return;
    receiverSignatureDrawingRef.current = true;
    canvas.setPointerCapture(event.pointerId);
    const ctx = canvas.getContext('2d');
    const point = getCanvasPoint(canvas, event);
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  };

  const drawReceiverSignature = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = receiverSignatureCanvasRef.current;
    if (!canvas || !receiverSignatureDrawingRef.current) return;
    const ctx = canvas.getContext('2d');
    const point = getCanvasPoint(canvas, event);
    if (!ctx) return;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  };

  const finishReceiverSignature = () => {
    receiverSignatureDrawingRef.current = false;
    const data = receiverSignatureCanvasRef.current?.toDataURL('image/png') || '';
    if (data) {
      setReceiverSignatureData(data);
      localStorage.setItem(`receiver_signature_${user.id}`, data);
    }
  };

  const clearReceiverSignature = () => {
    const canvas = receiverSignatureCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setReceiverSignatureData('');
    localStorage.removeItem(`receiver_signature_${user.id}`);
  };

  const openReceiverSignature = () => {
    setReceiverSignatureOpen(true);
    setTimeout(() => {
      const canvas = receiverSignatureCanvasRef.current;
      const saved = localStorage.getItem(`receiver_signature_${user.id}`);
      if (!canvas || !saved) return;
      const ctx = canvas.getContext('2d');
      const image = new Image();
      image.onload = () => {
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
        ctx?.drawImage(image, 0, 0, canvas.width, canvas.height);
        setReceiverSignatureData(saved);
      };
      image.src = saved;
    }, 50);
  };

  const confirmReceipt = async (signatureData = receiverSignatureData) => {
    const item = currentQueue[currentQueueIndex];
    if (!item) return;
    if (!signatureData) {
      openReceiverSignature();
      onAlert('يرجى توقيع المستلم قبل اعتماد الاستلام.', 'warning');
      return;
    }

    const sv = supervisions.find(s => cleanId(s.committee_number) === item.committee && matchDate(s.date, todayDate));
    const proctorObj = users.find(u => u.id === sv?.teacher_id);
    
    const newLog: DeliveryLog = { 
      id: crypto.randomUUID(), 
      teacher_name: user.full_name, 
      proctor_name: proctorObj?.full_name || 'استلام مباشر', 
      committee_number: item.committee, 
      grade: item.grade, 
      type: 'RECEIVE', 
      time: new Date().toISOString(), 
      period: 1, 
      status: 'CONFIRMED' 
    };

    setIsSaving(true);
    try {
      await setDeliveryLogs(newLog);
      await db.controlRequests.insert({
        from: user.full_name,
        committee: item.committee,
        text: buildSignatureText({
          role: 'receiver',
          committee: item.committee,
          grade: item.grade,
          name: user.full_name,
          time: newLog.time,
          signature: signatureData,
        }),
        time: newLog.time,
        status: 'DONE',
      });
      await db.controlRequests.insert({
        from: `${user.full_name} - المستلم`,
        committee: item.committee,
        text: `${SIGNATURE_REQUEST_PREFIX} الرجاء توقيع مراقب اللجنة بعد استلام الكنترول للصف: ${item.grade}`,
        time: newLog.time,
        status: 'PENDING',
      });
      await setControlRequests();
      if (receiptNote.trim()) {
        onAlert(`تم حفظ الاستلام مع ملاحظة: ${receiptNote.trim()}`, 'info');
      }
      setReceiptNote('');
      setReceiverSignatureOpen(false);
      setIsSuccessState(true);
      setTimeout(() => {
        setIsSuccessState(false);
        if (currentQueue.length <= 1) {
          setActiveCommitteeId(null);
        } else {
          setCurrentQueueIndex(0);
        }
      }, 1000);
    } catch (error: any) {
      onAlert(`فشل التوثيق: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in text-right pb-32 px-4 md:px-0 max-w-7xl mx-auto">
      
      <div className="relative overflow-hidden rounded-[3.5rem] bg-gradient-to-br from-[#020817] via-[#0a1628] to-[#050d1a] text-white shadow-2xl border border-slate-800/60">
        <div className="absolute -top-28 -right-28 h-72 w-72 rounded-full bg-blue-600/30 blur-[90px] pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-emerald-500/20 blur-[100px] pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-indigo-700/10 blur-[120px] pointer-events-none" />
        <div className="relative z-10 p-7 md:p-10 space-y-8">
          <div className="flex flex-col xl:flex-row justify-between gap-8">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 bg-blue-500/15 border border-blue-400/20 text-blue-200 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                استلام الكنترول الذكي
              </div>
              <div>
                <h2 className="text-4xl md:text-6xl font-black tracking-tight leading-tight">مطابقة واستلام المظاريف</h2>
                <p className="text-slate-400 font-bold mt-2">شاشة مخصصة لـ {user.full_name} حسب الصفوف المسندة له فقط.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(myGrades.length ? myGrades : ['لا توجد صفوف مسندة']).map(grade => (
                  <span key={grade} className={`px-4 py-2 rounded-2xl text-[11px] font-black border ${myGrades.length ? 'bg-white/10 border-white/10 text-white' : 'bg-red-500/15 border-red-400/20 text-red-200'}`}>
                    {grade}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-3 min-w-0 xl:min-w-[680px]">
              {[
                { label: 'نطاقي', value: personalStats.total, icon: LayoutGrid, cls: 'text-blue-300 bg-blue-500/10 border-blue-400/20' },
                { label: 'جاهز', value: personalStats.ready, icon: Inbox, cls: 'text-emerald-300 bg-emerald-500/10 border-emerald-400/20' },
                { label: 'بانتظار', value: personalStats.waiting, icon: Timer, cls: 'text-orange-300 bg-orange-500/10 border-orange-400/20' },
                { label: 'مستلم', value: personalStats.received, icon: PackageCheck, cls: 'text-teal-300 bg-teal-500/10 border-teal-400/20' },
                { label: 'إنجازي', value: `${progressPercentage}%`, icon: Activity, cls: 'text-white bg-white/10 border-white/10' },
              ].map(item => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className={`rounded-[2rem] border p-4 ${item.cls}`}>
                    <Icon size={24} />
                    <p className="mt-4 text-3xl font-black tabular-nums">{item.value}</p>
                    <p className="text-[10px] font-black opacity-70">{item.label}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-5">
            <div className="rounded-[2.5rem] bg-white/[0.04] border border-white/10 p-5 space-y-4">
              <div className="flex items-center gap-3">
                <Scan size={22} className="text-blue-300" />
                <h3 className="font-black text-xl">وحدة الاستلام السريع</h3>
              </div>
              <button
                onClick={() => {
                  setIsScanning(true);
                  setTimeout(async () => {
                    try {
                      const scanner = new Html5Qrcode("receipt-qr-v15");
                      qrScannerRef.current = scanner;
                      await scanner.start(
                        { facingMode: "environment" },
                        { fps: 20, qrbox: { width: 260, height: 260 } },
                        (text) => { handleStartProcess(text); },
                        () => {}
                      );
                    } catch { setIsScanning(false); }
                  }, 300);
                }}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 active:scale-[0.98] text-white py-5 px-5 rounded-2xl font-black flex items-center justify-center gap-4 shadow-lg shadow-blue-600/30 transition-all"
              >
                <Camera size={26} />
                مسح باركود اللجنة أو بطاقة المراقب
              </button>
              <div className="grid grid-cols-[1fr_auto] gap-3">
                <input
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={e => e.key === 'Enter' && searchInput.trim() && handleStartProcess(searchInput)}
                  placeholder="رقم اللجنة أو هوية المراقب"
                  className="w-full bg-white/10 border border-white/10 focus:border-blue-400 rounded-2xl px-5 py-4 font-black text-xl text-white outline-none placeholder:text-slate-500"
                />
                <button
                  onClick={() => handleStartProcess(searchInput)}
                  disabled={!searchInput.trim()}
                  className="bg-white text-slate-950 disabled:opacity-30 px-6 rounded-2xl font-black transition-all"
                >
                  بحث
                </button>
              </div>
            </div>

            <div className="rounded-[2.5rem] bg-white/[0.04] border border-white/10 p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <History size={22} className="text-emerald-300" />
                  <h3 className="font-black text-xl">سجل استلامي اليوم</h3>
                </div>
                <span className="text-[10px] font-black text-slate-400">{todayDate}</span>
              </div>
              {recentLogs.length > 0 ? (
                <div className="space-y-2 max-h-44 overflow-y-auto custom-scrollbar">
                  {recentLogs.map(log => (
                    <div key={log.id} className="flex items-center justify-between gap-3 rounded-2xl bg-emerald-500/10 border border-emerald-400/10 p-3">
                      <div>
                        <p className="font-black text-sm">لجنة {log.committee_number} · {log.grade}</p>
                        <p className="text-[10px] font-bold text-emerald-200/80">{log.proctor_name}</p>
                      </div>
                      <span className="font-mono text-xs font-black text-emerald-200">{new Date(log.time).toLocaleTimeString('ar-SA', {hour:'2-digit', minute:'2-digit'})}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-44 grid place-items-center text-center text-slate-500 font-bold">
                  <div>
                    <PackageCheck size={42} className="mx-auto mb-3 opacity-40" />
                    لم تسجل أي عملية استلام باسمك حتى الآن.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* شاشة المسح الكامل */}
      {isScanning && (
        <div className="fixed inset-0 z-[500] bg-slate-950 flex flex-col items-center justify-center no-print text-white" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <div className="text-center mb-8 px-4">
            <p className="text-white font-black text-xl">وجّه الكاميرا نحو الباركود</p>
            <p className="text-slate-400 text-sm font-bold mt-1">بطاقة المراقب · QR لجنة · صفحة التعريف</p>
          </div>
          <div className="relative w-72 h-72">
            <div id="receipt-qr-v15" className="w-full h-full bg-black rounded-3xl overflow-hidden shadow-[0_0_40px_rgba(59,130,246,0.4)] border border-blue-400/50" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-500 rounded-tr-2xl pointer-events-none" />
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-500 rounded-tl-2xl pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-500 rounded-br-2xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-500 rounded-bl-2xl pointer-events-none" />
            <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-red-500 shadow-[0_0_12px_red] animate-scan-line pointer-events-none" />
          </div>
          <button
            onClick={stopScanner}
            className="mt-10 bg-slate-800 border border-slate-700 text-white px-12 py-4 rounded-2xl font-black text-lg active:scale-95 transition-all flex items-center gap-3"
          >
            <X size={20} /> إلغاء
          </button>
        </div>
      )}

      {activeCommitteeId && currentQueue.length > 0 && (
         <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 animate-fade-in no-print overflow-y-auto">
            <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-md" onClick={() => !isSaving && setActiveCommitteeId(null)}></div>
            <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl border border-slate-100 relative z-10 overflow-hidden border-b-[15px] border-slate-900 my-auto animate-slide-up">
               
               {isSaving || isSuccessState ? (
                  <div className="p-24 text-center space-y-10 animate-fade-in flex flex-col items-center">
                    {isSaving ? <Loader2 size={120} className="text-blue-600 animate-spin" /> : <ShieldCheck size={120} className="text-emerald-500 animate-bounce" />}
                    <h3 className="text-4xl font-black text-slate-900 tracking-tighter">{isSaving ? 'جاري الأرشفة والتوثيق...' : 'تم التوثيق المركزي بنجاح'}</h3>
                  </div>
               ) : (
                  <div>
                     <div className="bg-gradient-to-br from-[#020817] via-[#0a1628] to-[#050d1a] p-10 text-white flex justify-between items-center relative overflow-hidden border-b border-slate-800/60">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/25 blur-3xl rounded-full pointer-events-none"></div>
                        <div className="absolute bottom-0 left-0 w-24 h-24 bg-emerald-600/15 blur-3xl rounded-full pointer-events-none"></div>
                       <div className="flex items-center gap-6 relative z-10">
                          <div className="w-20 h-20 bg-blue-600 text-white rounded-[1.8rem] flex flex-col items-center justify-center font-black shadow-2xl">
                             <span className="text-[10px] opacity-50 uppercase leading-none mb-1">لجنة</span>
                             <span className="text-4xl leading-none">{activeCommitteeId}</span>
                          </div>
                          <div>
                             <h3 className="text-3xl font-black tracking-tight">محضر مطابقة واستلام</h3>
                             <p className="text-blue-400 text-sm font-bold mt-1 uppercase tracking-widest">Final Matching Protocol</p>
                          </div>
                       </div>
                       <button onClick={() => setActiveCommitteeId(null)} className="p-3 bg-white/5 hover:bg-white/10 rounded-full transition-all text-white/40 hover:text-white"><X size={32}/></button>
                    </div>

                    <div className="p-10 space-y-10">
                       <div className="flex flex-col md:flex-row items-center gap-8 justify-between border-b border-slate-100 pb-8">
                          <div className="text-center md:text-right flex-1">
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 leading-none">الصف المستهدف للمطابقة</p>
                             <h4 className="text-5xl font-black text-slate-900 tracking-tighter leading-tight break-words">{currentQueue[currentQueueIndex].grade}</h4>
                          </div>
                          <div className="bg-slate-50 p-6 rounded-[2.5rem] border-2 border-slate-100 flex flex-col items-center min-w-[150px] shadow-inner">
                             <p className="text-[10px] font-black text-slate-400 uppercase mb-2 leading-none">إجمالي الطلاب</p>
                             <span className="text-5xl font-black text-slate-950 tabular-nums">{currentQueue[currentQueueIndex].count}</span>
                          </div>
                       </div>

                       <div className="grid grid-cols-3 gap-4">
                          <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-[2rem] text-center shadow-sm">
                             <p className="text-[10px] font-black text-emerald-800 uppercase mb-1 leading-none">الحضور</p>
                             <p className="text-3xl font-black text-emerald-700 tabular-nums">
                               {currentQueue[currentQueueIndex].count - absences.filter(a => a.committee_number === activeCommitteeId && a.type === 'ABSENT' && a.date.startsWith(todayDate) && students.find(s => s.national_id === a.student_id)?.grade === currentQueue[currentQueueIndex].grade).length}
                             </p>
                          </div>
                          <div className="bg-red-50 border border-red-100 p-6 rounded-[2rem] text-center shadow-sm">
                             <p className="text-[10px] font-black text-red-800 uppercase mb-1 leading-none">الغياب</p>
                             <p className="text-3xl font-black text-red-700 tabular-nums">
                               {absences.filter(a => a.committee_number === activeCommitteeId && a.type === 'ABSENT' && a.date.startsWith(todayDate) && students.find(s => s.national_id === a.student_id)?.grade === currentQueue[currentQueueIndex].grade).length}
                             </p>
                          </div>
                          <div className="bg-amber-50 border border-amber-100 p-6 rounded-[2rem] text-center shadow-sm">
                             <p className="text-[10px] font-black text-amber-800 uppercase mb-1 leading-none">التأخر</p>
                             <p className="text-3xl font-black text-amber-700 tabular-nums">
                               {absences.filter(a => a.committee_number === activeCommitteeId && a.type === 'LATE' && a.date.startsWith(todayDate) && students.find(s => s.national_id === a.student_id)?.grade === currentQueue[currentQueueIndex].grade).length}
                             </p>
                          </div>
                        </div>

                        {/* بيانات المراقب والمستلم */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-blue-50 p-5 rounded-[2rem] border border-blue-100 flex items-center gap-4">
                            <div className="w-11 h-11 bg-blue-600 rounded-2xl flex items-center justify-center shrink-0">
                              <UserCheck size={20} className="text-white" />
                            </div>
                            <div className="flex-1 text-right">
                              <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">المراقب الميداني</p>
                              <h5 className="text-base font-black text-blue-900 leading-tight">
                                {users.find(u => u.id === supervisions.find(s => cleanId(s.committee_number) === activeCommitteeId && matchDate(s.date, todayDate))?.teacher_id)?.full_name || <span className="text-blue-300 italic text-sm">لم يُكلَّف بعد</span>}
                              </h5>
                            </div>
                          </div>
                          <div className="bg-emerald-50 p-5 rounded-[2rem] border border-emerald-100 flex items-center gap-4">
                            <div className="w-11 h-11 bg-emerald-600 rounded-2xl flex items-center justify-center shrink-0">
                              <ShieldCheck size={20} className="text-white" />
                            </div>
                            <div className="flex-1 text-right">
                              <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1">المستلم (كنترول)</p>
                              <h5 className="text-base font-black text-emerald-900 leading-tight">{user.full_name}</h5>
                            </div>
                          </div>
                        </div>

                        <div className="bg-indigo-50 border border-indigo-100 rounded-[2rem] p-5 space-y-4">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-11 h-11 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shrink-0">
                                <ShieldAlert size={21} />
                              </div>
                              <div className="text-right">
                                <p className="font-black text-indigo-950">استدعاء مراقب اللجنة</p>
                                <p className="text-xs font-bold text-indigo-500 mt-1">يظهر للمراقب المرتبط بهذه اللجنة ويظهر في TV2 بالألوان.</p>
                              </div>
                            </div>
                            <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black text-indigo-700 border border-indigo-100">
                              {activeCommitteeSummons.length ? `${activeCommitteeSummons.length} استدعاء نشط` : 'لا يوجد استدعاء نشط'}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-[170px_1fr_auto] gap-3">
                            <select
                              value={summonReason}
                              onChange={e => setSummonReason(e.target.value)}
                              className="rounded-2xl border border-indigo-100 bg-white px-4 py-3 text-sm font-black text-slate-800 outline-none focus:border-indigo-400"
                            >
                              <option>مراجعة المستلم</option>
                              <option>مطابقة عدد الأوراق</option>
                              <option>نقص أو زيادة أوراق</option>
                              <option>ملاحظة على المحضر</option>
                              <option>توقيع أو اعتماد مطلوب</option>
                              <option>أخرى</option>
                            </select>
                            <input
                              value={summonNote}
                              onChange={e => setSummonNote(e.target.value)}
                              placeholder="ملاحظة اختيارية للمراقب"
                              className="rounded-2xl border border-indigo-100 bg-white px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-indigo-400"
                            />
                            <button
                              onClick={handleSendSummon}
                              disabled={isSummonSaving}
                              className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-indigo-500/20 disabled:opacity-50"
                            >
                              {isSummonSaving ? 'جاري...' : 'إرسال الاستدعاء'}
                            </button>
                          </div>

                          {activeCommitteeSummons.length > 0 && (
                            <div className="space-y-2">
                              {activeCommitteeSummons.map(request => (
                                <div key={request.id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-2xl bg-white border border-indigo-100 p-4">
                                  <div className="text-right">
                                    <p className="font-black text-slate-900">{cleanSummonText(request.text)}</p>
                                    <p className="mt-1 text-[11px] font-bold text-slate-500">
                                      الحالة: {request.status === 'PENDING' ? 'مرسل وينتظر استلام المراقب' : 'استلمه المراقب'}
                                      {request.assistant_name ? ` - ${request.assistant_name}` : ''}
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => handleCloseSummon(request.id)}
                                    disabled={isSummonSaving}
                                    className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                                  >
                                    إغلاق الاستدعاء
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {controlRequests.some(r => r.committee === activeCommitteeId && r.status !== 'DONE' && !isInternalSignatureRecord(r) && !isSignatureRequest(r)) && (
                          <div className="bg-red-50 border border-red-100 rounded-[2rem] p-5 flex items-start gap-4">
                            <ShieldAlert size={24} className="text-red-600 shrink-0 mt-1" />
                            <div className="text-right">
                              <p className="font-black text-red-900">تنبيه بلاغات مفتوحة</p>
                              <p className="text-sm font-bold text-red-700 mt-1">
                                توجد بلاغات لم تغلق لهذه اللجنة. يمكنك الاستلام إذا تمت المطابقة فعلياً، وسيبقى البلاغ ظاهرًا في المتابعة.
                              </p>
                            </div>
                          </div>
                        )}

                        <div className="bg-slate-50 p-5 rounded-[2rem] border border-slate-100">
                          <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">
                            <FileText size={16} />
                            ملاحظات الاستلام
                          </label>
                          <textarea
                            value={receiptNote}
                            onChange={e => setReceiptNote(e.target.value)}
                            placeholder="مثال: تأخر المراقب، نقص ورقة، استلام يدوي..."
                            className="w-full h-24 bg-white border border-slate-200 rounded-2xl p-4 outline-none focus:border-blue-500 font-bold text-slate-800 resize-none"
                          />
                        </div>

                       <div className="pt-4">
                         <button 
                           onClick={() => confirmReceipt()} 
                           disabled={isSaving}
                           className="w-full py-6 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white rounded-[2rem] font-black text-xl flex items-center justify-center gap-4 shadow-[0_10px_30px_rgba(16,185,129,0.25)] shadow-emerald-500/25 hover:from-emerald-700 hover:to-emerald-600 transition-all active:scale-[0.97] relative overflow-hidden group"
                         >
                            <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <Save size={28}/> 
                            <span>استلام هذا الصف</span>
                         </button>
                         <p className="text-center text-[11px] font-bold text-slate-400 mt-4">بالضغط أنت تقر بأنك طابقت الأعداد الفعلية في المظروف مع المسجلة أعلاه.</p>
                       </div>
                    </div>
                  </div>
               )}
            </div>
         </div>
      )}

      {receiverSignatureOpen && activeCommitteeId && currentQueue[currentQueueIndex] && (
        <div className="fixed inset-0 z-[700] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-xl no-print">
          <div className="w-full max-w-xl rounded-[2.5rem] bg-white p-6 shadow-2xl border border-slate-100">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div className="text-right">
                <p className="text-xl font-black text-slate-950">توقيع مستلم الكنترول</p>
                <p className="mt-1 text-xs font-bold text-slate-500">
                  اللجنة {activeCommitteeId} · {currentQueue[currentQueueIndex].grade}
                </p>
              </div>
              <button
                onClick={() => setReceiverSignatureOpen(false)}
                className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-100 text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="rounded-[2rem] border-2 border-dashed border-slate-200 bg-slate-50 p-3">
              <canvas
                ref={receiverSignatureCanvasRef}
                width={760}
                height={260}
                onPointerDown={startReceiverSignature}
                onPointerMove={drawReceiverSignature}
                onPointerUp={finishReceiverSignature}
                onPointerCancel={finishReceiverSignature}
                className="h-44 w-full touch-none rounded-[1.5rem] bg-white shadow-inner"
              />
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                onClick={clearReceiverSignature}
                className="rounded-2xl border border-slate-200 bg-white py-4 text-sm font-black text-slate-600"
              >
                مسح التوقيع
              </button>
              <button
                onClick={() => confirmReceipt(receiverSignatureCanvasRef.current?.toDataURL('image/png') || receiverSignatureData)}
                disabled={isSaving}
                className="rounded-2xl bg-emerald-600 py-4 text-sm font-black text-white shadow-lg shadow-emerald-500/20 disabled:opacity-50"
              >
                حفظ التوقيع واعتماد الاستلام
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/60 overflow-hidden">
        <div className="p-5 md:p-6 border-b border-slate-100 bg-slate-50/60 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <SlidersHorizontal size={22} className="text-blue-600" />
            <div>
              <h3 className="text-2xl font-black text-slate-900">قائمة الاستلام المخصصة</h3>
              <p className="text-xs font-bold text-slate-400 mt-1">تعرض فقط اللجان والصفوف داخل نطاق صلاحيتك.</p>
            </div>
          </div>
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative">
              <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={listSearch}
                onChange={e => setListSearch(e.target.value)}
                placeholder="بحث: لجنة، صف، مراقب..."
                className="w-full md:w-72 pr-10 py-3 bg-white border border-slate-200 rounded-2xl outline-none focus:border-blue-500 font-bold text-sm"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto">
              {[
                ['ALL', 'الكل'],
                ['READY', 'جاهز'],
                ['WAITING', 'في الطريق/انتظار'],
                ['RECEIVED', 'مستلم'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setStatusFilter(id as any)}
                  className={`px-4 py-3 rounded-2xl text-xs font-black whitespace-nowrap transition-all ${statusFilter === id ? 'bg-slate-900 text-white shadow-lg' : 'bg-white border border-slate-200 text-slate-500 hover:border-blue-200'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-5 md:p-6">
          {myGrades.length === 0 && user.role === 'CONTROL' ? (
            <div className="py-24 bg-red-50 rounded-[3rem] border-2 border-dashed border-red-100 text-center flex flex-col items-center gap-5">
              <ShieldAlert size={70} className="text-red-400" />
              <h3 className="text-2xl font-black text-red-800">لم تسند لك صفوف استلام بعد</h3>
              <p className="text-red-500 font-bold">اطلب من رئيس الكنترول تحديد الصفوف الخاصة بك من الصلاحيات.</p>
            </div>
          ) : scopeCards.length === 0 ? (
            <div className="py-24 bg-emerald-50 rounded-[3rem] border-2 border-dashed border-emerald-200 text-center flex flex-col items-center gap-6">
              <Trophy size={80} className="text-emerald-500 animate-bounce" />
              <h3 className="text-3xl font-black text-emerald-800">لا توجد عناصر مطابقة لهذا العرض</h3>
              <p className="text-emerald-600 font-bold">جرّب تغيير الفلتر أو البحث.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {scopeCards.map(card => {
                const isReady = card.status === 'READY';
                const isReceived = card.status === 'RECEIVED';
                const statusClasses = isReceived
                  ? 'border-emerald-200/60 bg-gradient-to-br from-emerald-50 to-emerald-100/40 shadow-emerald-100'
                  : isReady
                    ? 'border-blue-200/60 bg-gradient-to-br from-blue-50 to-blue-100/40 shadow-blue-100'
                    : 'border-amber-200/60 bg-white shadow-amber-100';
                return (
                  <div key={card.key} className={`p-6 rounded-[3rem] border-2 shadow-xl hover:-translate-y-1 hover:shadow-2xl transition-all duration-300 relative overflow-hidden group flex flex-col min-h-[420px] ${statusClasses}`}>
                    <div className="absolute -top-16 -right-16 w-40 h-40 bg-white/70 blur-3xl rounded-full pointer-events-none" />
                    <div className="relative z-10 flex justify-between items-start gap-4">
                      <div>
                        <p className="text-[10px] font-black text-slate-400 mb-1">لجنة</p>
                        <p className="text-7xl font-black leading-none tabular-nums text-slate-950">{card.committee}</p>
                      </div>
                      <div className="text-left space-y-2">
                        <span className={`inline-flex px-4 py-2 rounded-2xl text-[10px] font-black ${isReceived ? 'bg-emerald-600 text-white' : isReady ? 'bg-blue-600 text-white' : 'bg-amber-500 text-white'}`}>
                          {isReceived ? 'تم الاستلام' : isReady ? 'جاهز للاستلام' : 'بانتظار الإغلاق'}
                        </span>
                        {card.openAlerts.length > 0 && <span className="block bg-red-600 text-white px-3 py-1 rounded-xl text-[9px] font-black">بلاغ مفتوح</span>}
                      </div>
                    </div>

                    <div className="relative z-10 mt-5 space-y-3 flex-1">
                      <div className="bg-white/80 rounded-2xl border border-white p-4">
                        <p className="text-[9px] font-black text-slate-400 mb-1">الصف</p>
                        <p className="font-black text-slate-900 text-xl">{card.grade}</p>
                      </div>
                      <div className="bg-white/80 rounded-2xl border border-white p-4">
                        <p className="text-[9px] font-black text-slate-400 mb-1">المراقب</p>
                        <p className="font-black text-slate-800 leading-6">{card.proctorName}</p>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-white rounded-2xl p-3 text-center border border-slate-100"><p className="text-[8px] font-black text-slate-400">طلاب</p><p className="font-black text-xl">{card.count}</p></div>
                        <div className="bg-white rounded-2xl p-3 text-center border border-red-100"><p className="text-[8px] font-black text-red-400">غياب</p><p className="font-black text-xl text-red-600">{card.absences}</p></div>
                        <div className="bg-white rounded-2xl p-3 text-center border border-amber-100"><p className="text-[8px] font-black text-amber-500">تأخير</p><p className="font-black text-xl text-amber-600">{card.lates}</p></div>
                      </div>
                      {(card.closedAt || card.receivedAt) && (
                        <div className="grid grid-cols-2 gap-2">
                          <div className="bg-white/70 rounded-2xl p-3 border border-slate-100"><p className="text-[8px] font-black text-slate-400">وقت الإغلاق</p><p className="font-black text-sm">{card.closedAt ? new Date(card.closedAt).toLocaleTimeString('ar-SA', {hour:'2-digit', minute:'2-digit'}) : '--:--'}</p></div>
                          <div className="bg-white/70 rounded-2xl p-3 border border-slate-100"><p className="text-[8px] font-black text-slate-400">وقت الاستلام</p><p className="font-black text-sm">{card.receivedAt ? new Date(card.receivedAt).toLocaleTimeString('ar-SA', {hour:'2-digit', minute:'2-digit'}) : '--:--'}</p></div>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        if (isReady) handleStartProcess(card.committee);
                      }}
                      disabled={!isReady}
                      className={`relative z-10 mt-5 w-full py-5 rounded-[2rem] font-black text-lg transition-all flex items-center justify-center gap-3 shadow-sm ${isReady ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white shadow-emerald-500/25 active:scale-[0.97]' : isReceived ? 'bg-emerald-100 text-emerald-700 cursor-default' : 'bg-white text-amber-500 cursor-not-allowed border border-amber-100'}`}
                    >
                      {isReady ? <>تأكيد الاستلام النهائي <ArrowRight size={20} className="rotate-180" /></> : isReceived ? <><CheckCircle2 size={20} /> مستلم بواسطة {card.receiverName || 'الكنترول'}</> : <><Lock size={18} /> لم تغلق اللجنة بعد</>}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.05); border-radius: 10px; }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slide-up { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes scan-laser { 0% { transform: translateY(-50%); } 100% { transform: translateY(50%); } }
        @keyframes scan-line { 0% { top: 0; } 50% { top: 100%; } 100% { top: 0; } }
        @keyframes ticker-scroll { 0% { transform: translateX(100%); } 100% { transform: translateX(-100%); } }
        
        .animate-fade-in { animation: fade-in 0.4s ease-out; }
        .animate-slide-up { animation: slide-up 0.4s ease-out forwards; }
        .animate-scan-laser { animation: scan-laser 3s linear infinite; }
        .animate-scan-line { animation: scan-line 2s cubic-bezier(0.4, 0, 0.2, 1) infinite; }
        .animate-ticker { animation: ticker-scroll 20s linear infinite; white-space: nowrap; display: inline-block; padding-left: 100%; }
        .animate-ticker:hover { animation-play-state: paused; }
      `}</style>
    </div>
  );
};

export default ControlReceiptView;
