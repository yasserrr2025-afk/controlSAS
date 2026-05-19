
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { User, Student, Absence, DeliveryLog, Supervision, ControlRequest } from '../../types';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  PackageCheck, Clock, Users, LayoutGrid, Scan, 
  CheckCircle2, Check, ChevronLeft, Loader2, Save, 
  Trophy, Zap, History, UserCircle, UserX, AlertCircle,
  X, Lock, Unlock, Camera, ShieldCheck, UserCheck,
  ClipboardCheck, MapPin, Search, GraduationCap, ArrowRight,
  Activity, Play, CheckCircle
} from 'lucide-react';
import { db } from '../../supabase';

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
  const qrScannerRef = useRef<Html5Qrcode | null>(null);

  const todayDate = systemConfig?.active_exam_date || new Date().toISOString().split('T')[0];

  const cleanId = (id: string | number | undefined): string => {
    if (id === undefined || id === null) return '';
    return String(id).trim();
  };

  /* ── مطابقة التاريخ بمرونة (يتعامل مع ISO كامل أو YYYY-MM-DD) ── */
  const matchDate = (isoStr: string | undefined | null, date: string): boolean => {
    if (!isoStr || !date) return false;
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return String(isoStr).startsWith(date);
      return d.toISOString().startsWith(date);
    } catch { return String(isoStr ?? '').startsWith(date); }
  };

  const getUniqueKey = (committee: string | number, grade: string): string => {
    return `${cleanId(committee)}_${grade.trim()}`;
  };

  // اللجان التي أغلقها المراقب ميدانياً اليوم وتنتظر الاستلام الفعلي
  const proctorSubmittedCommittees = useMemo(() => {
    return new Set(
      deliveryLogs
        .filter(l => l.type === 'RECEIVE' && matchDate(l.time, todayDate) && (l.status === 'PENDING' || l.proctor_name))
        .map(l => cleanId(l.committee_number))
    );
  }, [deliveryLogs, todayDate]);

  const receivedKeys = useMemo(() => {
    return new Set(deliveryLogs.filter(l => l.type === 'RECEIVE' && l.status === 'CONFIRMED' && matchDate(l.time, todayDate)).map(l => getUniqueKey(l.committee_number, l.grade)));
  }, [deliveryLogs, todayDate]);

  const myGrades = useMemo(() => {
    const all = Array.from(new Set(students.map(s => s.grade))).filter(Boolean);
    if (user.role === 'ADMIN') return all;
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
      .filter(l => l.type === 'RECEIVE' && l.status === 'CONFIRMED' && matchDate(l.time, todayDate))
      .sort((a,b) => b.time.localeCompare(a.time))
      .slice(0, 5);
  }, [deliveryLogs, todayDate]);

  const progressPercentage = useMemo(() => {
    const total = Object.keys(myTotalScope).length;
    if (total === 0) return 0;
    return Math.round((receivedKeys.size / total) * 100);
  }, [myTotalScope, receivedKeys]);

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

  const confirmReceipt = async () => {
    const item = currentQueue[currentQueueIndex];
    if (!item) return;

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
      
      <div className="flex flex-col md:flex-row justify-between items-end gap-6 border-b pb-8">
        <div className="space-y-2">
          <div className="bg-blue-600 text-white px-4 py-1 rounded-lg text-[10px] font-black w-fit shadow-lg uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
            غرفة العمليات - التوثيق المركزي
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter uppercase leading-none">مطابقة واستلام المظاريف</h2>
          <p className="text-slate-400 font-bold italic flex items-center gap-2 tracking-tight mt-2">التاريخ النشط حالياً: {todayDate}</p>
        </div>
        
        {/* Circular Progress */}
        <div className="flex items-center gap-4 bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
           <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">معدل الإنجاز</p>
              <p className="text-2xl font-black text-slate-900 tabular-nums">{progressPercentage}%</p>
           </div>
           <div className="relative w-16 h-16 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="none" className="text-slate-100" />
                <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="none" 
                        className="text-blue-600 transition-all duration-1000 ease-out" 
                        strokeDasharray="175" 
                        strokeDashoffset={175 - (175 * progressPercentage) / 100} />
              </svg>
              <Activity size={20} className="absolute text-blue-600" />
           </div>
        </div>
      </div>

      {/* Action Ticker */}
      {recentLogs.length > 0 && (
        <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-xl flex items-center gap-4 overflow-hidden border border-slate-800">
           <div className="bg-emerald-500/20 text-emerald-400 p-2 rounded-xl shrink-0"><CheckCircle size={20} className="animate-pulse" /></div>
           <div className="flex-1 whitespace-nowrap overflow-hidden relative">
              <div className="animate-ticker inline-flex gap-8 items-center h-full">
                {recentLogs.map(log => (
                  <span key={log.id} className="text-sm font-bold flex items-center gap-2">
                    <span className="text-emerald-400">تم الاستلام:</span> 
                    لجنة {log.committee_number} - {log.grade}
                    <span className="text-slate-500 text-[10px] mr-2">
                      ({new Date(log.time).toLocaleTimeString('ar-SA', {hour: '2-digit', minute:'2-digit'})})
                    </span>
                  </span>
                ))}
              </div>
           </div>
        </div>
      )}

      {/* كارت المسح الداكن */}
      <div className="bg-slate-950 rounded-3xl shadow-xl border-b-[5px] border-blue-600 p-5 space-y-4">

        {/* رأس */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-blue-600/20 border border-blue-500/30 text-blue-300 px-3 py-1 rounded-full text-xs font-black mb-2">
            <Scan size={11} /> وحدة الاستلام السريع
          </div>
          <h3 className="text-lg font-black text-white">مسح رقم اللجنة أو كود الموظف</h3>
          <p className="text-slate-500 text-xs font-bold mt-0.5">امسح بطاقة المراقب أو أدخل الرقم يدوياً</p>
        </div>

        {/* زر المسح */}
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
          className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white py-5 px-5 rounded-2xl font-black flex items-center justify-center gap-4 shadow-lg transition-all"
        >
          <div className="bg-white/20 p-2.5 rounded-xl shrink-0">
            <Scan size={26} />
          </div>
          <div className="text-right">
            <p className="font-black text-base leading-tight">مسح باركود اللجنة</p>
            <p className="text-blue-200 text-xs font-bold opacity-80">بطاقة المراقب أو QR اللجنة</p>
          </div>
        </button>
      </div>

      {/* فاصل */}
      <div className="flex items-center gap-3 px-2">
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-slate-400 text-xs font-black">أو أدخل يدوياً</span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>

      {/* كارت الإدخال — أبيض منفصل */}
      <div className="bg-white rounded-3xl shadow border border-slate-100 p-5 space-y-3">
        <p className="text-slate-500 text-xs font-black text-center">رقم اللجنة أو رقم هوية الموظف</p>
        {/* حقل الإدخال */}
        <input
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value.replace(/\D/g, ''))}
          onKeyDown={e => e.key === 'Enter' && searchInput.trim() && handleStartProcess(searchInput)}
          placeholder="اكتب الرقم هنا"
          className="w-full bg-slate-50 border-2 border-slate-200 focus:border-blue-500 rounded-2xl px-5 py-4 font-black text-3xl text-center text-slate-900 outline-none transition-all placeholder:text-slate-300 placeholder:text-base placeholder:font-bold"
          style={{ letterSpacing: '0.1em' }}
        />
        {/* زر التأكيد — عرض كامل وواضح */}
        <button
          onClick={() => handleStartProcess(searchInput)}
          disabled={!searchInput.trim()}
          className="w-full bg-slate-900 text-white hover:bg-blue-600 active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed py-4 rounded-2xl font-black text-base transition-all flex items-center justify-center gap-3 shadow"
        >
          <Play className="fill-current" size={20} />
          تأكيد البحث
        </button>
      </div>


      {/* شاشة المسح الكامل */}
      {isScanning && (
        <div className="fixed inset-0 z-[500] bg-slate-950 flex flex-col items-center justify-center no-print text-white" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
          <div className="text-center mb-8 px-4">
            <p className="text-white font-black text-xl">وجّه الكاميرا نحو الباركود</p>
            <p className="text-slate-400 text-sm font-bold mt-1">بطاقة المراقب · QR لجنة · صفحة التعريف</p>
          </div>
          <div className="relative w-72 h-72">
            <div id="receipt-qr-v15" className="w-full h-full bg-black rounded-3xl overflow-hidden shadow-2xl" />
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
            <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-2xl" onClick={() => !isSaving && setActiveCommitteeId(null)}></div>
            <div className="bg-white w-full max-w-2xl rounded-[4rem] shadow-[0_0_100px_rgba(0,0,0,0.5)] relative z-10 overflow-hidden border-b-[15px] border-slate-900 my-auto animate-slide-up">
               
               {isSaving || isSuccessState ? (
                  <div className="p-24 text-center space-y-10 animate-fade-in flex flex-col items-center">
                    {isSaving ? <Loader2 size={120} className="text-blue-600 animate-spin" /> : <ShieldCheck size={120} className="text-emerald-500 animate-bounce" />}
                    <h3 className="text-4xl font-black text-slate-900 tracking-tighter">{isSaving ? 'جاري الأرشفة والتوثيق...' : 'تم التوثيق المركزي بنجاح'}</h3>
                  </div>
               ) : (
                  <div>
                    <div className="bg-slate-900 p-10 text-white flex justify-between items-center relative overflow-hidden">
                       <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/20 blur-3xl rounded-full"></div>
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

                       <div className="pt-4">
                         <button 
                           onClick={confirmReceipt} 
                           disabled={isSaving}
                           className="w-full py-6 bg-emerald-600 text-white rounded-[2rem] font-black text-2xl flex items-center justify-center gap-4 shadow-[0_10px_30px_rgba(16,185,129,0.3)] hover:bg-emerald-700 transition-all active:scale-95 relative overflow-hidden group"
                         >
                            <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <Save size={32}/> 
                            <span>مطابقة وتوثيق الاستلام النهائي</span>
                         </button>
                         <p className="text-center text-[11px] font-bold text-slate-400 mt-4">بالضغط أنت تقر بأنك طابقت الأعداد الفعلية في المظروف مع المسجلة أعلاه.</p>
                       </div>
                    </div>
                  </div>
               )}
            </div>
         </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         {stats.remainingKeys.length === 0 ? (
           <div className="col-span-full py-24 bg-emerald-50 rounded-[4rem] border-2 border-dashed border-emerald-200 text-center flex flex-col items-center gap-6">
              <Trophy size={80} className="text-emerald-500 animate-bounce" />
              <h3 className="text-3xl font-black text-emerald-800">اكتمل استلام جميع مظاريف اليوم بنجاح</h3>
           </div>
         ) : (
           stats.remainingKeys.map(key => {
             const info = myTotalScope[key];
             const isReady = proctorSubmittedCommittees.has(info.committee);
              const sv = supervisions.find(s => cleanId(s.committee_number) === info.committee && matchDate(s.date, todayDate));
             const proctor = users.find(u => u.id === sv?.teacher_id);
             
             return (
               <div key={key} className={`bg-white p-8 rounded-[3.5rem] border-2 shadow-xl transition-all relative overflow-hidden group flex flex-col justify-between ${isReady ? 'border-emerald-400 bg-emerald-50/30 shadow-emerald-500/10 hover:shadow-emerald-500/20' : 'border-slate-50 opacity-80'}`}>
                  {isReady && (
                    <>
                      <div className="absolute top-0 right-0 bg-emerald-500 text-white px-6 py-2 rounded-bl-[1.5rem] font-black text-[9px] uppercase tracking-widest flex items-center gap-2 shadow-md z-10">
                        <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div> جاهزة للمطابقة
                      </div>
                      <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-400/20 blur-3xl rounded-full pointer-events-none"></div>
                    </>
                  )}

                  <div className="flex justify-between items-start mb-6 relative z-10 mt-2">
                     <div className="flex flex-col">
                        <div className="flex items-baseline gap-2">
                          <span className={`text-6xl font-black leading-none tracking-tighter tabular-nums ${isReady ? 'text-slate-900' : 'text-slate-300'}`}>{info.committee}</span>
                        </div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">لجنة ميدانية</span>
                     </div>
                     <div className={`px-4 py-1.5 rounded-xl text-[10px] font-black ${isReady ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}>
                        {info.grade}
                     </div>
                  </div>

                  <div className="space-y-4 mb-8 mt-auto relative z-10">
                     <div className="flex items-center gap-3 p-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-slate-100 shadow-sm transition-all group-hover:bg-white">
                        <UserCircle size={20} className={isReady ? 'text-slate-700' : 'text-slate-300'} />
                        <div className="min-w-0 flex-1">
                           <p className="text-[8px] font-black text-slate-400 uppercase leading-none mb-1">المراقب المسؤول</p>
                           <p className={`text-sm font-black truncate ${isReady ? 'text-slate-800' : 'text-slate-400'}`}>{proctor?.full_name || 'بانتظار المباشرة...'}</p>
                        </div>
                     </div>
                  </div>

                  <button 
                    onClick={() => {
                      if (isReady) handleStartProcess(info.committee);
                    }}
                    className={`w-full py-5 rounded-[2rem] font-black text-lg transition-all flex items-center justify-center gap-3 shadow-sm relative z-10 ${isReady ? 'bg-emerald-500 hover:bg-emerald-600 text-white active:scale-95' : 'bg-slate-50 text-slate-300 cursor-not-allowed border border-slate-100'}`}
                  >
                     {isReady ? <>استلام سريع <ArrowRight size={20} className="rotate-180" /></> : <><Lock size={18} /> قيد الرصد الميداني</>}
                  </button>
               </div>
             );
           })
         )}
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
