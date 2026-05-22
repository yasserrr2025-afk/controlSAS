
import React, { useMemo, useEffect, useRef, useState } from 'react';
import { 
  Activity, Monitor, ShieldAlert, Timer, 
  LayoutGrid, PackageCheck, UserX, UserCheck, 
  History, UserCircle, TriangleAlert, Info,
  Clock, CheckCircle2, Radio, Bell, Signal,
  MapPin, Users, Zap, X, AlertCircle, ChevronDown,
  ArrowDownToLine, Flame, Maximize2, Minimize2, MoveRight,
  MonitorPlay, LayoutPanelTop, Truck, Trophy
} from 'lucide-react';
import { Supervision, Absence, DeliveryLog, User, Student, ControlRequest } from '../../types';
import { getAbsenceKindLabel, getAbsenceReceipt } from '../../services/absenceReceipt';

interface Props {
  absences: Absence[];
  supervisions: Supervision[];
  users: User[];
  deliveryLogs: DeliveryLog[];
  students: Student[];
  requests: ControlRequest[];
}

const ControlRoomMonitor: React.FC<Props> = ({ absences, supervisions, users, deliveryLogs, students, requests }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [maximizedPanel, setMaximizedPanel] = useState<'MAP' | 'ABSENCES' | 'REPORTS' | null>(null);
  const [screenMode, setScreenMode] = useState<'split' | 'map' | 'alerts'>('split');
  const [isCompact, setIsCompact] = useState(false);
  const [showTicker, setShowTicker] = useState(true);
  const [autoRotate, setAutoRotate] = useState(false);
  const [recentlyChanged, setRecentlyChanged] = useState<Set<string>>(new Set());
  const [showDayComplete, setShowDayComplete] = useState(false);
  const previousCommitteeStatus = useRef<Record<string, string>>({});
  const wasCompleteRef = useRef(false);
  const activeDate = new Date().toISOString().split('T')[0];

  const getMapColumns = (total: number, isFull: boolean) => {
    if (!isFull) {
      if (isCompact) return 'repeat(12, minmax(0, 1fr))';
      return 'repeat(9, minmax(0, 1fr))';
    }
    if (total <= 6) return 'repeat(3, minmax(150px, 1fr))';
    if (total <= 12) return 'repeat(4, minmax(140px, 1fr))';
    if (total <= 18) return 'repeat(6, minmax(130px, 1fr))';
    if (total <= 24) return 'repeat(8, minmax(110px, 1fr))';
    return 'repeat(auto-fit, minmax(96px, 1fr))';
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!autoRotate) return;
    const modes: Array<'split' | 'map' | 'alerts'> = ['split', 'map', 'alerts'];
    const timer = setInterval(() => {
      setMaximizedPanel(null);
      setScreenMode(prev => modes[(modes.indexOf(prev) + 1) % modes.length]);
    }, 20000);
    return () => clearInterval(timer);
  }, [autoRotate]);

  const stats = useMemo(() => {
    const totalComs = new Set(students.map(s => s.committee_number)).size;
    const completed = new Set(deliveryLogs.filter(l => l.status === 'CONFIRMED').map(l => l.committee_number)).size;
    const absents = absences.filter(a => a.type === 'ABSENT').length;
    const lates = absences.filter(a => a.type === 'LATE').length;
    const activeReqs = requests.filter(r => r.status !== 'DONE').length;
    
    return {
      totalComs,
      completed,
      absents,
      lates,
      activeReqs,
      progress: Math.round((completed / totalComs) * 100) || 0
    };
  }, [students, deliveryLogs, absences, requests]);

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
        gain.gain.exponentialRampToValueAtTime(0.55, time + 0.025);
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
      for (let i = 0; i < 42; i += 1) clap(start + 0.75 + i * 0.085);
      setTimeout(() => ctx.close(), 5200);
    } catch {}
  };

  useEffect(() => {
    const isComplete = stats.totalComs > 0 && stats.completed === stats.totalComs;
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
  }, [stats.completed, stats.totalComs]);

  const committeeGrid = useMemo(() => {
    const comNums = Array.from(new Set(students.map(s => s.committee_number))).filter(Boolean).sort((a: any, b: any) => Number(a) - Number(b));
    
    return comNums.map(num => {
      // ط¬ظ„ط¨ ط§ظ„طµظپظˆظپ ط§ظ„ظ…طھظˆظ‚ط¹ط© ظ„ظ‡ط°ظ‡ ط§ظ„ظ„ط¬ظ†ط©
      const committeeGrades = Array.from(new Set(students.filter(s => s.committee_number === num).map(s => s.grade)));
      
      // ط¬ظ„ط¨ ط³ط¬ظ„ط§طھ ط§ظ„ط§ط³طھظ„ط§ظ… ظ„ظ‡ط°ظ‡ ط§ظ„ظ„ط¬ظ†ط© ط§ظ„ظٹظˆظ…
      const committeeLogs = deliveryLogs.filter(l => l.committee_number === num && l.time.startsWith(activeDate));
      
      // ط§ظ„ظ„ط¬ظ†ط© ظ…ظƒطھظ…ظ„ط© (ط£ط®ط¶ط±) ط¥ط°ط§ ظƒط§ظ† ظƒظ„ ط§ظ„طµظپظˆظپ ظ…ط³ط¬ظ„ط© ظƒظ€ CONFIRMED
      const isDone = committeeGrades.length > 0 && committeeGrades.every(g => 
        committeeLogs.some(l => l.grade === g && l.status === 'CONFIRMED')
      );

      // ط§ظ„ظ„ط¬ظ†ط© "ظ…طھط¬ظ‡ط© ظ„ظ„ظƒظ†طھط±ظˆظ„" (ط¨ط±طھظ‚ط§ظ„ظٹ) ط¥ط°ط§ ظƒط§ظ†طھ ظ…ظ†طھظ‡ظٹط© ظ…ظٹط¯ط§ظ†ظٹط§ظ‹ (PENDING) ظˆظ„ظƒظ† ظ„ظ… طھظƒطھظ…ظ„ ظ…ط·ط§ط¨ظ‚طھظ‡ط§ ط¨ط¹ط¯
      const isSubmitted = !isDone && committeeGrades.length > 0 && committeeGrades.every(g => 
        committeeLogs.some(l => l.grade === g)
      );

      const hasAlert = !isSubmitted && !isDone && requests.some(r => r.committee === num && r.status === 'PENDING');
      const inProgress = !isSubmitted && !isDone && requests.some(r => r.committee === num && r.status === 'IN_PROGRESS');
      const isOccupied = supervisions.some(s => s.committee_number === num);
      const status = isDone ? 'done' : hasAlert ? 'alert' : isSubmitted ? 'submitted' : inProgress ? 'progress' : isOccupied ? 'active' : 'idle';

      return { num, isDone, isSubmitted, hasAlert, inProgress, isOccupied, status };
    });
  }, [students, deliveryLogs, requests, supervisions, activeDate]);

  useEffect(() => {
    const nextStatus = Object.fromEntries(committeeGrid.map(c => [c.num, c.status]));
    const previous = previousCommitteeStatus.current;
    if (Object.keys(previous).length === 0) {
      previousCommitteeStatus.current = nextStatus;
      return;
    }

    const changed = committeeGrid
      .filter(c => previous[c.num] && previous[c.num] !== c.status)
      .map(c => c.num);

    previousCommitteeStatus.current = nextStatus;
    if (changed.length === 0) return;

    setRecentlyChanged(prev => new Set([...Array.from(prev), ...changed]));
    const timer = setTimeout(() => {
      setRecentlyChanged(prev => {
        const next = new Set(prev);
        changed.forEach(num => next.delete(num));
        return next;
      });
    }, 2000);
    return () => clearTimeout(timer);
  }, [committeeGrid]);

  const submittedCommittees = useMemo(() => {
    return new Set(committeeGrid.filter(c => c.isSubmitted || c.isDone).map(c => c.num));
  }, [committeeGrid]);

  const sortedRequests = useMemo(() => {
    return requests
      .filter(req => req.status === 'DONE' || !submittedCommittees.has(req.committee))
      .sort((a, b) => b.time.localeCompare(a.time));
  }, [requests, submittedCommittees]);

  const toggleMaximize = (panel: 'MAP' | 'ABSENCES' | 'REPORTS') => {
    setMaximizedPanel(maximizedPanel === panel ? null : panel);
  };

  const MapPanel = ({ isFull = false }) => (
    <div className={`tv-panel tv-map-panel bg-white/[0.02] border border-white/5 rounded-[3.5rem] p-8 flex flex-col shadow-inner transition-all duration-500 ${isFull ? 'h-full' : 'h-[55%]'}`}>
      <div className="tv-panel-head flex items-center justify-between mb-8">
         <div className="flex items-center gap-4">
            <div className="bg-orange-500/10 p-4 rounded-[1.5rem] text-orange-300"><LayoutGrid size={isFull ? 40 : 28} /></div>
            <div>
              <h2 className={`${isFull ? 'text-5xl' : 'text-3xl'} font-black tracking-normal`}>خريطة اللجان الحية</h2>
              <p className="text-slate-300 text-xs font-black mt-2">تزامن لحظي مع الميدان لهذا اليوم</p>
            </div>
         </div>
         <div className="flex gap-4 items-center">
            <div className="tv-legend flex gap-6 items-center bg-black/40 px-6 py-2 rounded-full border border-white/5 text-[8px] font-black uppercase tracking-widest">
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500"></div><span>مكتملة</span></div>
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500"></div><span>نشطة</span></div>
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-slate-500"></div><span>غير مسندة</span></div>
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></div><span>متجه للكنترول</span></div>
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></div><span>بلاغ عاجل</span></div>
            </div>
            <button onClick={() => toggleMaximize('MAP')} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all">
               {isFull ? <Minimize2 size={24} className="text-orange-300" /> : <Maximize2 size={24} />}
            </button>
         </div>
      </div>
       <div className={`flex-1 ${isFull ? 'overflow-hidden' : 'overflow-y-auto custom-scrollbar'}`}>
          <div
            className={`tv-committee-grid grid ${isFull ? 'tv-committee-grid-full' : isCompact ? 'grid-cols-8 md:grid-cols-10 lg:grid-cols-12' : 'grid-cols-6 md:grid-cols-8 lg:grid-cols-9'} gap-4 p-2`}
            style={isFull ? { gridTemplateColumns: getMapColumns(committeeGrid.length, isFull) } : undefined}
          >
            {committeeGrid.map(c => (
              <div key={c.num} className={`tv-committee-cell ${recentlyChanged.has(c.num) ? 'tv-status-pop' : ''}
                aspect-square rounded-[2rem] border-2 flex flex-col items-center justify-center transition-all duration-700 relative overflow-hidden
                ${c.isDone ? 'bg-emerald-600 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 
                  c.hasAlert ? 'bg-red-600 border-red-400 shadow-[0_0_40px_rgba(220,38,38,0.5)] animate-pulse scale-110 z-20' : 
                  c.isSubmitted ? 'bg-orange-500 border-orange-200 shadow-[0_0_55px_rgba(249,115,22,0.95)] animate-[orangeFlash_1.2s_ease-in-out_infinite] scale-105' :
                  c.inProgress ? 'bg-blue-600/70 border-blue-300 shadow-[0_0_28px_rgba(37,99,235,0.35)]' :
                  c.isOccupied ? 'bg-blue-600 border-blue-300 shadow-[0_0_22px_rgba(37,99,235,0.3)]' : 
                  'bg-slate-700/40 border-slate-500/30 text-slate-300 opacity-70'}
              `}>
                {c.isSubmitted && (
                   <div className="absolute inset-0 flex items-center justify-center opacity-10">
                      <Truck size={isFull ? 96 : 72} className="-rotate-12" />
                   </div>
                )}
                {c.isSubmitted && <Truck size={isFull ? 26 : 20} className="absolute top-3 right-3 text-white animate-bounce drop-shadow-xl" />}
                 <span className={`${isFull ? 'text-sm' : 'text-[9px]'} font-black opacity-70 relative z-10`}>لجنة</span>
                 <span className={`${isFull ? 'tv-full-map-number' : isCompact ? 'text-2xl' : 'text-3xl'} font-black tabular-nums tracking-tighter relative z-10`}>{c.num}</span>
                {c.isSubmitted && <span className="relative z-10 mt-1 rounded-full bg-white/20 px-2 py-1 text-[8px] font-black">إلى الكنترول</span>}
              </div>
            ))}
         </div>
      </div>
    </div>
  );

  const AbsencesPanel = ({ isFull = false }) => (
    <div className={`tv-panel tv-absences-panel bg-white/[0.03] border border-white/10 rounded-[3.5rem] p-10 flex flex-col shadow-2xl transition-all duration-500 ${isFull ? 'h-full' : 'h-[45%]'}`}>
       <div className="tv-panel-head flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
             <div className="p-4 bg-orange-500/10 text-orange-300 rounded-2xl"><Users size={isFull ? 40 : 28} /></div>
             <div>
                <h3 className={`${isFull ? 'text-5xl' : 'text-2xl'} font-black text-white tracking-normal`}>غياب وتأخر اللجان</h3>
                <p className="text-slate-300 text-xs font-black mt-2">رصد يومي دقيق للحالات</p>
             </div>
          </div>
          <button onClick={() => toggleMaximize('ABSENCES')} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all">
             {isFull ? <Minimize2 size={24} className="text-orange-300" /> : <Maximize2 size={24} />}
          </button>
       </div>
       <div className="flex-1 overflow-y-auto custom-scrollbar">
          <table className="w-full text-right border-collapse">
             <thead className={`sticky top-0 bg-[#020617] font-black text-slate-500 uppercase tracking-widest border-b border-white/10 ${isFull ? 'text-base' : 'text-[11px]'}`}>
                <tr>
                  <th className="py-4 px-6">الطالب</th>
                  <th className="py-4 px-6">اللجنة</th>
                  <th className="py-4 px-6">الصف</th>
                  <th className="py-4 px-6">الحالة</th>
                  <th className="py-4 px-6">الاستلام</th>
                  <th className="py-4 px-6 text-left">الوقت</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-white/5">
                {absences.length === 0 ? (
                  <tr><td colSpan={6} className="py-20 text-center text-slate-600 font-black text-xl opacity-70">لا توجد غيابات مرصودة لهذا اليوم</td></tr>
                ) : (
                  absences.map(a => {
                    const student = students.find(s => s.national_id === a.student_id);
                    const receipt = getAbsenceReceipt(a);
                    return (
                      <tr key={a.id} className={`${isFull ? 'text-2xl h-24' : 'text-base'} hover:bg-white/[0.02]`}>
                         <td className="py-5 px-6 font-black text-white">{a.student_name}</td>
                         <td className="py-5 px-6 font-black text-slate-300">لجنة {a.committee_number}</td>
                         <td className="py-5 px-6 font-bold text-slate-400">{student?.grade}</td>
                          <td className="py-5 px-6">
                             <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black ${a.type === 'ABSENT' ? 'bg-red-500' : 'bg-amber-500'} text-white`}>
                                {a.type === 'ABSENT' ? 'غائب' : 'متأخر'}
                             </span>
                           </td>
                          <td className="py-5 px-6">
                            <div className={`inline-flex flex-col rounded-2xl px-4 py-2 font-black ${receipt ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/20' : 'bg-orange-500/15 text-orange-300 border border-orange-400/20 animate-pulse'}`}>
                              <span className="text-[10px]">{receipt ? `تم استلام ${getAbsenceKindLabel(a.type)}` : `بانتظار استلام ${getAbsenceKindLabel(a.type)}`}</span>
                              {receipt && <span className="mt-1 text-[9px] opacity-80">{receipt.role}: {receipt.by}</span>}
                              {receipt && <span className="mt-1 text-[9px] opacity-70">{new Date(receipt.at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</span>}
                            </div>
                          </td>
                          <td className="py-5 px-6 text-left font-black text-orange-300 font-mono">
                           {new Date(a.date).toLocaleTimeString('ar-SA', {hour:'2-digit', minute:'2-digit'})}
                         </td>
                      </tr>
                    );
                  })
                )}
             </tbody>
          </table>
       </div>
    </div>
  );

  const ReportsPanel = ({ isFull = false }) => (
    <div className={`tv-panel tv-reports-panel bg-white/[0.03] border border-white/10 rounded-[3.5rem] p-8 flex flex-col shadow-2xl transition-all duration-500 ${isFull ? 'h-full' : 'flex-1 overflow-hidden'}`}>
       <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
             <ShieldAlert size={isFull ? 40 : 24} className="text-red-500 animate-pulse" />
             <h2 className={`${isFull ? 'text-4xl' : 'text-xl'} font-black text-white tracking-normal`}>بلاغات العمليات اليومية</h2>
          </div>
          <button onClick={() => toggleMaximize('REPORTS')} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all">
             {isFull ? <Minimize2 size={24} className="text-orange-300" /> : <Maximize2 size={24} />}
          </button>
       </div>
       <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar">
          {sortedRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-700 opacity-20">
               <CheckCircle2 size={isFull ? 120 : 64} />
               <p className="font-black mt-4">لا توجد بلاغات اليوم</p>
            </div>
          ) : (
            sortedRequests.map((req) => (
              <div key={req.id} className={`p-6 rounded-[2.5rem] border-2 transition-all duration-700 ${req.status === 'DONE' ? 'opacity-30' : 'bg-red-600/10 border-red-500/30 shadow-[0_0_20px_rgba(220,38,38,0.1)]'}`}>
                 <div className="flex justify-between items-start mb-3">
                    <div className="bg-slate-900 text-white px-4 py-2 rounded-xl font-black text-lg">لجنة {req.committee}</div>
                    <span className="text-[10px] font-mono text-slate-500">{new Date(req.time).toLocaleTimeString('ar-SA')}</span>
                 </div>
                 <p className={`${isFull ? 'text-3xl' : 'text-lg'} font-black text-white leading-relaxed`}>{req.text}</p>
                 <p className="text-[10px] font-black text-slate-500 mt-3 uppercase tracking-widest">{req.from}</p>
              </div>
            ))
          )}
       </div>
    </div>
  );

  return (
    <div className="tv-monitor fixed inset-0 bg-[#020617] text-white overflow-hidden font-['Tajawal'] z-[100] flex flex-col p-4 dir-rtl text-right">
      {showDayComplete && (
        <div className="pointer-events-none fixed inset-0 z-[999] overflow-hidden bg-slate-950/45 backdrop-blur-[10px]">
          <div className="absolute inset-0 tv-confetti" />
          <div className="absolute inset-0 flex items-center justify-center p-8 text-center">
            <div className="tv-celebration-card relative w-full max-w-5xl rounded-[4rem] border border-emerald-200/25 bg-white/[0.16] p-10 shadow-[0_0_140px_rgba(16,185,129,0.38)]">
              <div className="absolute -inset-1 rounded-[4rem] bg-gradient-to-br from-emerald-300/25 via-white/10 to-cyan-300/20 blur-2xl" />
              <div className="relative z-10 space-y-7">
                <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-[2rem] bg-emerald-400 text-slate-950 shadow-[0_0_70px_rgba(52,211,153,.78)] tv-celebrate-pop">
                  <Trophy size={68} strokeWidth={3} />
                </div>
                <div>
                  <p className="text-xl font-black text-emerald-100/90">تم اكتمال اليوم الاختباري</p>
                  <h2 className="tv-celebration-title mt-3 text-6xl md:text-7xl font-black tracking-tight text-white leading-[1.08]">
                    <span className="block">اكتملت جميع اللجان شكراً</span>
                    <span className="block">للجميع</span>
                  </h2>
                  <p className="mt-5 text-2xl font-black text-white/85">تصفيق حار لفريق الكنترول والمراقبين على إنجاز الاستلام بالكامل.</p>
                </div>
                <div className="grid grid-cols-3 gap-4 max-w-3xl mx-auto">
                  <div className="rounded-[1.8rem] bg-emerald-400/18 p-5 backdrop-blur-md"><p className="text-5xl font-black">{stats.completed}</p><p className="text-xs font-black text-emerald-50">لجان مكتملة</p></div>
                  <div className="rounded-[1.8rem] bg-cyan-400/16 p-5 backdrop-blur-md"><p className="text-5xl font-black">{students.length}</p><p className="text-xs font-black text-cyan-50">طالب ضمن اليوم</p></div>
                  <div className="rounded-[1.8rem] bg-orange-400/16 p-5 backdrop-blur-md"><p className="text-5xl font-black">{stats.absents + stats.lates}</p><p className="text-xs font-black text-orange-50">حالات متابعة</p></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="tv-topbar flex justify-between items-center h-24 mb-4 border-b border-white/5 pb-4">
        <div className="tv-time-card bg-white/[0.03] border border-white/10 rounded-[2rem] px-8 py-3 flex items-center gap-6 shadow-2xl backdrop-blur-md">
           <MonitorPlay className="text-orange-400" size={32} />
           <div className="tv-clock text-4xl font-black tabular-nums tracking-widest text-orange-300 font-mono">
              {currentTime.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
           </div>
        </div>
        <div className="tv-progress flex-1 flex flex-col items-center justify-center">
           <div className="flex items-center gap-6">
              <span className="tv-progress-number text-4xl font-black text-white">{stats.progress}%</span>
              <div className="tv-progress-bar w-96 h-3 bg-white/5 rounded-full overflow-hidden border border-white/10 shadow-inner">
                 <div className="h-full bg-gradient-to-l from-orange-600 via-amber-400 to-emerald-400 transition-all duration-1000 shadow-[0_0_24px_rgba(249,115,22,0.55)]" style={{ width: `${stats.progress}%` }}></div>
              </div>
           </div>
           <p className="text-sm font-black text-slate-200 mt-2">معدل الإنجاز الميداني النشط</p>
        </div>
        <div className="tv-status flex items-center gap-6">
           <div className="hidden xl:flex bg-white/[0.03] border border-white/10 rounded-[2rem] p-2 gap-2">
              {[
                { id: 'split', label: 'تقسيم', icon: LayoutPanelTop },
                { id: 'map', label: 'الخريطة', icon: LayoutGrid },
                { id: 'alerts', label: 'البلاغات', icon: Bell },
              ].map(item => (
                <button key={item.id} onClick={() => { setAutoRotate(false); setScreenMode(item.id as any); setMaximizedPanel(null); }} className={`px-4 py-3 rounded-2xl text-[10px] font-black flex items-center gap-2 transition-all ${screenMode === item.id ? 'bg-orange-500 text-white shadow-[0_0_24px_rgba(249,115,22,0.35)]' : 'text-slate-400 hover:bg-white/5'}`}>
                  <item.icon size={16} />
                  {item.label}
                </button>
              ))}
              <button onClick={() => setAutoRotate(v => !v)} className={`px-4 py-3 rounded-2xl text-[10px] font-black flex items-center gap-2 transition-all ${autoRotate ? 'bg-emerald-500 text-white shadow-[0_0_24px_rgba(16,185,129,0.35)]' : 'text-slate-400 hover:bg-white/5'}`}>
                <Activity size={16} />
                تلقائي
              </button>
              <button onClick={() => setIsCompact(v => !v)} className={`px-4 py-3 rounded-2xl text-[10px] font-black transition-all ${isCompact ? 'bg-white text-slate-950' : 'text-slate-400 hover:bg-white/5'}`}>
                تكثيف
              </button>
              <button onClick={() => setShowTicker(v => !v)} className={`px-4 py-3 rounded-2xl text-[10px] font-black transition-all ${showTicker ? 'bg-white text-slate-950' : 'text-slate-400 hover:bg-white/5'}`}>
                الشريط
              </button>
           </div>
           <div className="text-right">
              <span className="bg-emerald-400/10 text-emerald-400 px-6 py-2 rounded-full border border-emerald-400/20 text-[10px] font-black flex items-center gap-3">
                 <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]"></div> البث المباشر نشط
              </span>
              <button onClick={() => setAutoRotate(v => !v)} className={`tv-auto-toggle mt-2 w-full rounded-full border px-4 py-2 text-[10px] font-black transition-all ${autoRotate ? 'border-emerald-400/30 bg-emerald-400/15 text-emerald-300' : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/10'}`}>
                {autoRotate ? 'التبديل التلقائي يعمل' : 'تشغيل التبديل التلقائي'}
              </button>
              <p className="text-slate-300 font-bold text-xs mt-2 mr-2">تاريخ اليوم: {activeDate}</p>
           </div>
        </div>
      </div>
      {showTicker && (
        <div className="tv-ticker mb-4 flex items-center gap-4 overflow-hidden rounded-[1.5rem] border border-orange-400/20 bg-orange-500/10 px-5 py-3 text-orange-100">
          <Truck size={26} className="text-orange-300 animate-bounce" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black tracking-normal text-orange-300">حالة متجه للكنترول</p>
            <p className="truncate text-sm font-black">
              اللون البرتقالي الوامض يعني أن أوراق اللجنة في طريقها للكنترول ولم تكتمل المطابقة النهائية بعد.
            </p>
          </div>
        </div>
      )}

      <div className={`tv-layout ${screenMode === 'map' ? 'flex-1 overflow-hidden' : screenMode === 'alerts' ? 'flex-1 grid grid-cols-12 gap-6 overflow-hidden' : 'flex-1 grid grid-cols-12 gap-6 overflow-hidden'}`}>
        {screenMode !== 'map' && (
        <div className={`tv-sidebar ${screenMode === 'alerts' ? 'col-span-4' : 'col-span-3'} flex flex-col gap-6 overflow-hidden`}>
          <div className="tv-stats-grid grid grid-cols-1 gap-4">
             {[
               { icon: Users, color: 'text-orange-300', bg: 'bg-orange-500/10', val: stats.totalComs, label: 'إجمالي اللجان' },
               { icon: PackageCheck, color: 'text-emerald-500', bg: 'bg-emerald-600/10', val: stats.completed, label: 'لجان منتهية' },
               { icon: Timer, color: 'text-amber-500', bg: 'bg-amber-600/10', val: stats.lates, label: 'حالات تأخر' },
               { icon: UserX, color: 'text-red-500', bg: 'bg-red-600/10', val: stats.absents, label: 'حالات غياب' }
             ].map((s, i) => (
                <div key={i} className="tv-stat-card bg-white/[0.03] border border-white/10 rounded-[2.5rem] p-6 flex items-center justify-between group hover:bg-white/[0.05] transition-all shadow-xl">
                   <div className="text-right">
                      <p className="text-5xl font-black tabular-nums leading-none tracking-tighter mb-2">{s.val}</p>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">{s.label}</p>
                   </div>
                   <div className={`p-5 ${s.bg} ${s.color} rounded-[1.8rem] shadow-inner group-hover:scale-110 transition-transform`}><s.icon size={32} /></div>
                </div>
             ))}
          </div>
          {screenMode !== 'alerts' && maximizedPanel !== 'REPORTS' && <ReportsPanel />}
        </div>
        )}
        <div className={`tv-main-area ${screenMode === 'map' ? 'h-full' : screenMode === 'alerts' ? 'col-span-8' : 'col-span-9'} flex flex-col gap-6 overflow-hidden`}>
          {screenMode === 'map' ? <MapPanel isFull /> : screenMode === 'alerts' ? <ReportsPanel isFull /> : maximizedPanel === 'MAP' ? <MapPanel isFull /> : maximizedPanel === 'ABSENCES' ? <AbsencesPanel isFull /> : maximizedPanel === 'REPORTS' ? <ReportsPanel isFull /> : <><MapPanel /><AbsencesPanel /></>}
        </div>
      </div>
      <style>{`
        .tv-monitor {
          padding: clamp(10px, 1.15vw, 22px);
          gap: clamp(8px, 0.8vw, 16px);
          inset: 0 !important;
          width: 100vw;
          height: 100dvh;
          max-width: 100vw;
        }
        .tv-confetti {
          background-image:
            radial-gradient(circle, #34d399 0 5px, transparent 6px),
            radial-gradient(circle, #fb923c 0 4px, transparent 5px),
            radial-gradient(circle, #38bdf8 0 4px, transparent 5px),
            radial-gradient(circle, #facc15 0 5px, transparent 6px);
          background-size: 120px 120px, 150px 150px, 170px 170px, 210px 210px;
          background-position: 0 -120px, 40px -150px, 90px -170px, 20px -210px;
          animation: tvConfettiFall 1.6s linear infinite;
        }
        .tv-celebrate-pop {
          animation: tvCelebratePop 900ms ease-in-out infinite alternate;
        }
        .tv-celebration-card {
          backdrop-filter: blur(22px) saturate(150%);
          -webkit-backdrop-filter: blur(22px) saturate(150%);
          animation: tvCardFloat 2.8s ease-in-out infinite alternate;
        }
        .tv-celebration-title {
          text-shadow:
            0 3px 0 rgba(16,185,129,.95),
            0 8px 0 rgba(14,116,144,.55),
            0 18px 35px rgba(0,0,0,.75),
            0 0 42px rgba(52,211,153,.45);
          transform-style: preserve-3d;
          animation: tvTitleFloat3d 2.2s ease-in-out infinite alternate;
        }
        @keyframes tvConfettiFall {
          from { background-position: 0 -120px, 40px -150px, 90px -170px, 20px -210px; }
          to { background-position: 0 120px, 40px 150px, 90px 170px, 20px 210px; }
        }
        @keyframes tvCelebratePop {
          from { transform: scale(1) rotate(-2deg); }
          to { transform: scale(1.08) rotate(2deg); }
        }
        @keyframes tvCardFloat {
          from { transform: translateY(0) scale(1); }
          to { transform: translateY(-10px) scale(1.01); }
        }
        @keyframes tvTitleFloat3d {
          from { transform: perspective(900px) rotateX(8deg) rotateY(-5deg) translateY(0); }
          to { transform: perspective(900px) rotateX(2deg) rotateY(5deg) translateY(-14px); }
        }
        .tv-topbar {
          display: grid;
          grid-template-columns: minmax(240px, 0.95fr) minmax(280px, 1.2fr) minmax(220px, 0.9fr);
          gap: clamp(10px, 1.2vw, 24px);
          height: auto;
          min-height: clamp(72px, 8.5vh, 112px);
          align-items: center;
          margin-bottom: clamp(8px, 0.8vw, 16px);
          padding-bottom: clamp(8px, 0.8vw, 16px);
        }
        .tv-time-card {
          padding: clamp(10px, 1vw, 18px) clamp(16px, 1.8vw, 32px);
          border-radius: clamp(20px, 2vw, 32px);
          gap: clamp(10px, 1vw, 24px);
          justify-self: end;
        }
        .tv-clock {
          font-size: clamp(1.55rem, 2.8vw, 3.15rem);
          letter-spacing: 0;
          white-space: nowrap;
        }
        .tv-progress-number {
          font-size: clamp(1.7rem, 2.8vw, 3.2rem);
          line-height: 1;
        }
        .tv-progress-bar {
          width: clamp(170px, 28vw, 430px);
        }
        .tv-status {
          justify-self: start;
          min-width: 0;
        }
        .tv-ticker {
          min-height: clamp(44px, 5vh, 64px);
          padding: clamp(10px, 1vw, 16px) clamp(14px, 1.6vw, 24px);
        }
        .tv-layout {
          min-height: 0;
          gap: clamp(12px, 1.25vw, 28px);
        }
        .tv-sidebar,
        .tv-main-area {
          min-height: 0;
          gap: clamp(12px, 1.15vw, 24px);
        }
        .tv-panel {
          border-radius: clamp(24px, 3vw, 56px);
          padding: clamp(16px, 1.7vw, 40px);
          min-height: 0;
        }
        .tv-map-panel:not(.h-full) {
          height: auto !important;
          flex: 1.15 1 0;
        }
        .tv-absences-panel:not(.h-full) {
          height: auto !important;
          flex: 0.85 1 0;
        }
        .tv-panel-head {
          gap: clamp(10px, 1vw, 18px);
          margin-bottom: clamp(14px, 1.6vw, 32px);
        }
        .tv-panel-head h2,
        .tv-panel-head h3 {
          font-size: clamp(1.45rem, 2.5vw, 3.6rem);
          line-height: 1.1;
        }
        .tv-legend {
          flex-wrap: wrap;
          justify-content: center;
          row-gap: 8px;
          column-gap: clamp(12px, 1.5vw, 24px);
          font-size: clamp(0.5rem, 0.62vw, 0.72rem);
          padding: 8px clamp(12px, 1.4vw, 24px);
          letter-spacing: 0;
        }
        .tv-committee-grid {
          gap: clamp(8px, 1vw, 18px);
        }
        .tv-committee-cell {
          border-radius: clamp(18px, 2vw, 32px);
          min-width: 0;
        }
        .tv-committee-grid-full {
          align-content: start;
          justify-content: center;
          gap: clamp(14px, 1.7vw, 30px) !important;
          max-height: 100%;
          overflow: hidden;
        }
        .tv-committee-grid-full .tv-committee-cell {
          max-width: min(14vw, 190px);
          min-width: 0;
          border-radius: clamp(24px, 2.2vw, 38px);
        }
        .tv-full-map-number {
          font-size: clamp(2.6rem, 4.8vw, 5.8rem);
          line-height: 0.95;
        }
        .tv-stat-card {
          padding: clamp(16px, 1.45vw, 28px);
          border-radius: clamp(22px, 2.4vw, 40px);
        }
        .tv-stat-card p:first-child {
          font-size: clamp(2rem, 3.2vw, 4rem);
        }
        .tv-stat-card p:last-child {
          color: rgb(203 213 225);
          font-size: clamp(0.62rem, 0.75vw, 0.9rem);
          letter-spacing: 0;
        }
        .tv-auto-toggle {
          white-space: nowrap;
        }
        .tv-status-pop {
          animation: statusPop 2s ease-in-out;
          z-index: 30;
        }
        @keyframes orangeFlash {
          0%, 100% { filter: brightness(1); transform: scale(1.03); }
          50% { filter: brightness(1.35); transform: scale(1.09); }
        }
        @keyframes statusPop {
          0% { transform: scale(1); box-shadow: 0 0 0 rgba(255,255,255,0); }
          12% { transform: scale(1.24); box-shadow: 0 0 42px rgba(255,255,255,0.55); }
          38% { transform: scale(1.14); }
          100% { transform: scale(1); }
        }
        @media (min-width: 1500px) {
          .tv-layout {
            grid-template-columns: repeat(12, minmax(0, 1fr));
          }
          .tv-committee-grid {
            grid-template-columns: repeat(12, minmax(0, 1fr)) !important;
          }
          .tv-committee-grid-full {
            grid-template-columns: repeat(6, minmax(130px, 1fr)) !important;
          }
        }
        @media (max-width: 1280px) {
          .tv-topbar {
            grid-template-columns: minmax(210px, 0.92fr) minmax(230px, 1fr) minmax(190px, 0.78fr);
          }
          .tv-time-card,
          .tv-status {
            justify-self: stretch;
          }
          .tv-layout {
            grid-template-columns: minmax(210px, 26%) minmax(0, 1fr) !important;
          }
          .tv-sidebar {
            grid-column: auto / span 1 !important;
          }
          .tv-main-area {
            grid-column: auto / span 1 !important;
          }
          .tv-committee-grid {
            grid-template-columns: repeat(7, minmax(0, 1fr)) !important;
          }
          .tv-committee-grid-full {
            grid-template-columns: repeat(5, minmax(120px, 1fr)) !important;
          }
          .tv-sidebar .tv-reports-panel {
            display: none;
          }
        }
        @media (max-width: 980px) {
          .tv-monitor {
            overflow-y: auto;
          }
          .tv-topbar {
            grid-template-columns: 1fr;
          }
          .tv-progress {
            grid-column: 1 / -1;
          }
          .tv-layout {
            display: flex !important;
            flex-direction: column;
            overflow: visible;
          }
          .tv-sidebar,
          .tv-main-area {
            overflow: visible;
          }
          .tv-stats-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
          .tv-stat-card {
            min-height: 110px;
          }
          .tv-map-panel,
          .tv-absences-panel,
          .tv-reports-panel {
            height: auto !important;
            min-height: 360px;
          }
          .tv-committee-grid {
            grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
          }
          .tv-committee-grid-full {
            grid-template-columns: repeat(4, minmax(100px, 1fr)) !important;
          }
          .tv-ticker p:last-child {
            white-space: normal;
          }
        }
        @media (max-width: 760px) {
          .tv-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .tv-committee-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
          }
          .tv-committee-grid-full {
            grid-template-columns: repeat(3, minmax(86px, 1fr)) !important;
          }
          .tv-panel-head {
            align-items: flex-start;
            flex-direction: column;
          }
          .tv-legend {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default ControlRoomMonitor;


