
import React, { useMemo, useEffect, useState } from 'react';
import { 
  Activity, Monitor, ShieldAlert, Timer, 
  LayoutGrid, PackageCheck, UserX, UserCheck, 
  History, UserCircle, TriangleAlert, Info,
  Clock, CheckCircle2, Radio, Bell, Signal,
  MapPin, Users, Zap, X, AlertCircle, ChevronDown,
  ArrowDownToLine, Flame, Maximize2, Minimize2, MoveRight,
  MonitorPlay, LayoutPanelTop, Truck
} from 'lucide-react';
import { Supervision, Absence, DeliveryLog, User, Student, ControlRequest } from '../../types';

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
  const activeDate = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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

  const committeeGrid = useMemo(() => {
    const comNums = Array.from(new Set(students.map(s => s.committee_number))).filter(Boolean).sort((a: any, b: any) => Number(a) - Number(b));
    
    return comNums.map(num => {
      // جلب الصفوف المتوقعة لهذه اللجنة
      const committeeGrades = Array.from(new Set(students.filter(s => s.committee_number === num).map(s => s.grade)));
      
      // جلب سجلات الاستلام لهذه اللجنة اليوم
      const committeeLogs = deliveryLogs.filter(l => l.committee_number === num && l.time.startsWith(activeDate));
      
      // اللجنة مكتملة (أخضر) إذا كان كل الصفوف مسجلة كـ CONFIRMED
      const isDone = committeeGrades.length > 0 && committeeGrades.every(g => 
        committeeLogs.some(l => l.grade === g && l.status === 'CONFIRMED')
      );

      // اللجنة "متجهة للكنترول" (برتقالي) إذا كانت منتهية ميدانياً (PENDING) ولكن لم تكتمل مطابقتها بعد
      const isSubmitted = !isDone && committeeGrades.length > 0 && committeeGrades.every(g => 
        committeeLogs.some(l => l.grade === g)
      );

      const hasAlert = requests.some(r => r.committee === num && r.status === 'PENDING');
      const inProgress = requests.some(r => r.committee === num && r.status === 'IN_PROGRESS');
      const isOccupied = supervisions.some(s => s.committee_number === num);

      return { num, isDone, isSubmitted, hasAlert, inProgress, isOccupied };
    });
  }, [students, deliveryLogs, requests, supervisions, activeDate]);

  const sortedRequests = useMemo(() => {
    return [...requests].sort((a, b) => b.time.localeCompare(a.time));
  }, [requests]);

  const toggleMaximize = (panel: 'MAP' | 'ABSENCES' | 'REPORTS') => {
    setMaximizedPanel(maximizedPanel === panel ? null : panel);
  };

  const MapPanel = ({ isFull = false }) => (
    <div className={`bg-white/[0.02] border border-white/5 rounded-[3.5rem] p-8 flex flex-col shadow-inner transition-all duration-500 ${isFull ? 'h-full' : 'h-[55%]'}`}>
      <div className="flex items-center justify-between mb-8">
         <div className="flex items-center gap-4">
            <div className="bg-blue-600/10 p-4 rounded-[1.5rem] text-blue-400"><LayoutGrid size={isFull ? 40 : 28} /></div>
            <div>
              <h2 className={`${isFull ? 'text-5xl' : 'text-3xl'} font-black tracking-tighter`}>خريطة اللجان الحية</h2>
              <p className="text-slate-500 text-[10px] font-black uppercase mt-1">تزامن لحظي مع الميدان لليوم</p>
            </div>
         </div>
         <div className="flex gap-4 items-center">
            <div className="flex gap-6 items-center bg-black/40 px-6 py-2 rounded-full border border-white/5 text-[8px] font-black uppercase tracking-widest">
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500"></div><span>مكتملة</span></div>
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></div><span>متجه للكنترول</span></div>
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></div><span>بلاغ عاجل</span></div>
            </div>
            <button onClick={() => toggleMaximize('MAP')} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all">
               {isFull ? <Minimize2 size={24} className="text-blue-400" /> : <Maximize2 size={24} />}
            </button>
         </div>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar">
         <div className={`grid ${isFull ? 'grid-cols-8 md:grid-cols-10 lg:grid-cols-12' : 'grid-cols-6 md:grid-cols-8 lg:grid-cols-9'} gap-4 p-2`}>
            {committeeGrid.map(c => (
              <div key={c.num} className={`
                aspect-square rounded-[2rem] border-2 flex flex-col items-center justify-center transition-all duration-700 relative overflow-hidden
                ${c.isDone ? 'bg-emerald-600 border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 
                  c.hasAlert ? 'bg-red-600 border-red-400 shadow-[0_0_40px_rgba(220,38,38,0.5)] animate-pulse scale-110 z-20' : 
                  c.isSubmitted ? 'bg-orange-500 border-orange-300 shadow-[0_0_30px_rgba(249,115,22,0.6)] animate-pulse scale-105' :
                  c.inProgress ? 'bg-blue-600/40 border-blue-400' :
                  c.isOccupied ? 'bg-blue-600/20 border-blue-500/30' : 
                  'bg-white/5 border-white/5 opacity-20'}
              `}>
                {c.isSubmitted && (
                   <div className="absolute inset-0 flex items-center justify-center opacity-10">
                      <Truck size={60} className="-rotate-12" />
                   </div>
                )}
                {c.isSubmitted && <Truck size={12} className="absolute top-2 right-2 text-white animate-bounce" />}
                <span className="text-[8px] font-black opacity-40 uppercase relative z-10">لجنة</span>
                <span className={`${isFull ? 'text-4xl' : 'text-3xl'} font-black tabular-nums tracking-tighter relative z-10`}>{c.num}</span>
              </div>
            ))}
         </div>
      </div>
    </div>
  );

  const AbsencesPanel = ({ isFull = false }) => (
    <div className={`bg-white/[0.03] border border-white/10 rounded-[3.5rem] p-10 flex flex-col shadow-2xl transition-all duration-500 ${isFull ? 'h-full' : 'h-[45%]'}`}>
       <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
             <div className="p-4 bg-blue-600/10 text-blue-400 rounded-2xl"><Users size={isFull ? 40 : 28} /></div>
             <div>
                <h3 className={`${isFull ? 'text-5xl' : 'text-2xl'} font-black text-white tracking-tight`}>بيانات غياب وتأخر اللجان</h3>
                <p className="text-slate-500 text-[10px] font-black uppercase mt-1">رصد يومي دقيق للحالات</p>
             </div>
          </div>
          <button onClick={() => toggleMaximize('ABSENCES')} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all">
             {isFull ? <Minimize2 size={24} className="text-blue-400" /> : <Maximize2 size={24} />}
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
                  <th className="py-4 px-6 text-left">الوقت</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-white/5">
                {absences.length === 0 ? (
                  <tr><td colSpan={5} className="py-20 text-center text-slate-700 font-black italic text-xl opacity-20">لا يوجد غيابات مرصودة لهذا اليوم</td></tr>
                ) : (
                  absences.map(a => {
                    const student = students.find(s => s.national_id === a.student_id);
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
                         <td className="py-5 px-6 text-left font-black text-blue-400 font-mono">
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
    <div className={`bg-white/[0.03] border border-white/10 rounded-[3.5rem] p-8 flex flex-col shadow-2xl transition-all duration-500 ${isFull ? 'h-full' : 'flex-1 overflow-hidden'}`}>
       <div className="flex items-center justify-between mb-6 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
             <ShieldAlert size={isFull ? 40 : 24} className="text-red-500 animate-pulse" />
             <h2 className={`${isFull ? 'text-4xl' : 'text-xl'} font-black text-white tracking-tighter`}>بلاغات العمليات اليومية</h2>
          </div>
          <button onClick={() => toggleMaximize('REPORTS')} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all">
             {isFull ? <Minimize2 size={24} className="text-blue-400" /> : <Maximize2 size={24} />}
          </button>
       </div>
       <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar">
          {sortedRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-700 opacity-20">
               <CheckCircle2 size={isFull ? 120 : 64} />
               <p className="font-black italic mt-4">لا توجد بلاغات اليوم</p>
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
    <div className="fixed inset-0 bg-[#020617] text-white overflow-hidden font-['Tajawal'] z-[100] flex flex-col p-4 dir-rtl text-right">
      <div className="flex justify-between items-center h-24 mb-4 border-b border-white/5 pb-4">
        <div className="bg-white/[0.03] border border-white/10 rounded-[2rem] px-8 py-3 flex items-center gap-6 shadow-2xl backdrop-blur-md">
           <MonitorPlay className="text-blue-500" size={32} />
           <div className="text-4xl font-black tabular-nums tracking-widest text-blue-400 font-mono">
              {currentTime.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/[صم]/, '')}
           </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center">
           <div className="flex items-center gap-6">
              <span className="text-4xl font-black text-white">{stats.progress}%</span>
              <div className="w-96 h-3 bg-white/5 rounded-full overflow-hidden border border-white/10 shadow-inner">
                 <div className="h-full bg-gradient-to-l from-blue-600 via-blue-400 to-indigo-500 transition-all duration-1000 shadow-[0_0_20px_rgba(37,99,235,0.4)]" style={{ width: `${stats.progress}%` }}></div>
              </div>
           </div>
           <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.4em] mt-2">معدل الإنجاز الميداني النشط</p>
        </div>
        <div className="flex items-center gap-6">
           <div className="text-right">
              <span className="bg-emerald-400/10 text-emerald-400 px-6 py-2 rounded-full border border-emerald-400/20 text-[10px] font-black flex items-center gap-3">
                 <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]"></div> البث المباشر نشط
              </span>
              <p className="text-slate-500 font-bold text-[10px] mt-2 mr-2">تاريخ اليوم: {activeDate}</p>
           </div>
        </div>
      </div>
      <div className="flex-1 grid grid-cols-12 gap-6 overflow-hidden">
        <div className="col-span-3 flex flex-col gap-6 overflow-hidden">
          <div className="grid grid-cols-1 gap-4">
             {[
               { icon: Users, color: 'text-blue-500', bg: 'bg-blue-600/10', val: stats.totalComs, label: 'إجمالي اللجان' },
               { icon: PackageCheck, color: 'text-emerald-500', bg: 'bg-emerald-600/10', val: stats.completed, label: 'لجان منتهية' },
               { icon: Timer, color: 'text-amber-500', bg: 'bg-amber-600/10', val: stats.lates, label: 'حالات تأخر' },
               { icon: UserX, color: 'text-red-500', bg: 'bg-red-600/10', val: stats.absents, label: 'حالات غياب' }
             ].map((s, i) => (
                <div key={i} className="bg-white/[0.03] border border-white/10 rounded-[2.5rem] p-6 flex items-center justify-between group hover:bg-white/[0.05] transition-all shadow-xl">
                   <div className="text-right">
                      <p className="text-5xl font-black tabular-nums leading-none tracking-tighter mb-2">{s.val}</p>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">{s.label}</p>
                   </div>
                   <div className={`p-5 ${s.bg} ${s.color} rounded-[1.8rem] shadow-inner group-hover:scale-110 transition-transform`}><s.icon size={32} /></div>
                </div>
             ))}
          </div>
          {maximizedPanel !== 'REPORTS' && <ReportsPanel />}
        </div>
        <div className="col-span-9 flex flex-col gap-6 overflow-hidden">
          {maximizedPanel === 'MAP' ? <MapPanel isFull /> : maximizedPanel === 'ABSENCES' ? <AbsencesPanel isFull /> : maximizedPanel === 'REPORTS' ? <ReportsPanel isFull /> : <><MapPanel /><AbsencesPanel /></>}
        </div>
      </div>
    </div>
  );
};

export default ControlRoomMonitor;
