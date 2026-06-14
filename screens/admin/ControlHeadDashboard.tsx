
import React, { useMemo, useState, useEffect } from 'react';
import { 
  ShieldCheck, Activity, Bell, Zap, Users, 
  MonitorPlay, Radio, Megaphone, Send, Timer,
  AlertCircle, CheckCircle2, ShieldAlert,
  Signal, UserCheck, UserX, Clock, ArrowRight,
  TrendingUp, Gauge, LayoutGrid, HeartPulse,
  Server, MessageSquare, Briefcase, RefreshCw
} from 'lucide-react';
import { User, Student, Absence, DeliveryLog, ControlRequest, Supervision, SystemConfig } from '../../types';
import { ROLES_ARABIC } from '../../constants';
import { cleanControlRequestText, isInternalSignatureRecord, isSignatureRequest } from '../../services/signatures';

interface Props {
  users?: User[];
  students?: Student[];
  absences?: Absence[];
  deliveryLogs?: DeliveryLog[];
  requests?: ControlRequest[];
  supervisions?: Supervision[];
  systemConfig: SystemConfig;
  onBroadcast: (msg: string, target: any) => void;
}

const ControlHeadDashboard: React.FC<Props> = ({ 
  users = [], 
  students = [], 
  absences = [], 
  deliveryLogs = [], 
  requests = [], 
  supervisions = [], 
  systemConfig, 
  onBroadcast 
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [quickMsg, setQuickMsg] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const metrics = useMemo(() => {
    const totalStudents = (students || []).length;
    const totalAbsents = (absences || []).filter(a => a.type === 'ABSENT').length;
    const attendanceRate = totalStudents > 0 ? Math.round(((totalStudents - totalAbsents) / totalStudents) * 100) : 0;
    
    const committeeNums = new Set((students || []).map(s => s.committee_number));
    const activeComs = (supervisions || []).length;
    const readiness = committeeNums.size > 0 ? Math.round((activeComs / committeeNums.size) * 100) : 0;

    const visibleRequests = (requests || []).filter(r => !isInternalSignatureRecord(r) && !isSignatureRequest(r));
    const pendingRequests = visibleRequests.filter(r => r.status === 'PENDING');
    const urgentRequests = (requests || []).filter(r => r.status === 'PENDING' && (r.text.includes('صحية') || r.text.includes('نقص')));

    return {
      attendanceRate,
      readiness,
      pendingCount: pendingRequests.length,
      urgentCount: urgentRequests.length,
      totalComs: committeeNums.size,
      activeProctors: users.filter(u => u.role === 'PROCTOR' && supervisions.some(s => s.teacher_id === u.id)).length,
      idleProctors: users.filter(u => u.role === 'PROCTOR' && !supervisions.some(s => s.teacher_id === u.id)).length
    };
  }, [students, absences, supervisions, requests, users]);

  return (
    <div className="space-y-8 animate-fade-in text-right pb-32">
      <div className="bg-gradient-to-br from-[#020817] via-[#0a1628] to-[#050d1a] rounded-[3rem] p-8 md:p-12 text-white relative overflow-hidden border border-blue-900/30 shadow-[0_0_80px_rgba(37,99,235,0.12)]">
        <div className="absolute inset-0 bg-grid-dark opacity-50 pointer-events-none" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/10 blur-[150px] rounded-full -mr-64 -mt-64"></div>
        <div className="relative z-10 flex flex-col xl:flex-row justify-between items-center gap-12">
          <div className="flex items-center gap-8">
            <div className="bg-blue-600 p-6 rounded-[2.5rem] shadow-[0_0_50px_rgba(37,99,235,0.4)] animate-pulse">
               <ShieldCheck size={56} />
            </div>
            <div>
               <h1 className="text-4xl md:text-6xl font-black tracking-tighter uppercase leading-none">غرفة العمليات المركزية</h1>
               <div className="flex items-center gap-4 mt-4">
                  <span className="bg-emerald-500/20 text-emerald-400 px-4 py-1.5 rounded-full border border-emerald-500/30 text-[10px] font-black flex items-center gap-2">
                     <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></div> الاتصال مستقر
                  </span>
               </div>
            </div>
          </div>
          <div className="flex gap-8 items-center bg-white/5 p-8 rounded-[3rem] border border-white/10 backdrop-blur-xl">
             <div className="text-center space-y-2">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">توقيت الكنترول</p>
                <p className="text-5xl font-black tabular-nums text-blue-400 font-mono tracking-tighter">
                   {currentTime.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/[صم]/, '')}
                </p>
             </div>
             <div className="text-center space-y-2">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">معدل الإنجاز</p>
                <p className="text-5xl font-black tabular-nums text-white">{metrics.readiness}%</p>
             </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
         {[
           { label: 'جاهزية اللجان', val: metrics.readiness + '%', icon: LayoutGrid, color: 'text-blue-500', bg: 'bg-blue-50' },
           { label: 'حضور الطلاب', val: metrics.attendanceRate + '%', icon: HeartPulse, color: 'text-emerald-500', bg: 'bg-emerald-50' },
           { label: 'المراقبين المباشرين', val: metrics.activeProctors, icon: UserCheck, color: 'text-indigo-500', bg: 'bg-indigo-50' },
           { label: 'البلاغات العاجلة', val: metrics.urgentCount, icon: Zap, color: 'text-red-500', bg: 'bg-red-50', animate: metrics.urgentCount > 0 }
         ].map((m, i) => (
           <div key={i} className="bg-white p-7 rounded-[2rem] shadow-md border border-slate-100/80 flex items-center justify-between group hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <div className="text-right">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{m.label}</p>
                 <p className={`text-4xl font-black ${m.color} tabular-nums`}>{m.val}</p>
              </div>
              <div className={`p-5 ${m.bg} ${m.color} rounded-[1.8rem] shadow-inner`}>
                 <m.icon size={32} />
              </div>
           </div>
         ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
         <div className="xl:col-span-4 space-y-6">
            <div className="bg-gradient-to-br from-[#120810] to-[#1a0d1a] rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden flex flex-col h-[520px] border border-red-900/20">
               <h3 className="text-2xl font-black mb-8 border-b border-white/5 pb-6 text-red-500 flex items-center gap-3">
                 <Signal className="animate-pulse" /> البلاغات النشطة
               </h3>
               <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-2 text-right">
                  {requests.filter(r => r.status !== 'DONE').length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-700 opacity-30">
                       <p className="font-black text-xl italic">لا توجد بلاغات حالياً</p>
                    </div>
                  ) : (
                    requests.filter(r => r.status !== 'DONE' && !isInternalSignatureRecord(r) && !isSignatureRequest(r)).map(req => (
                      <div key={req.id} className="p-5 rounded-[1.5rem] border bg-red-500/[0.08] border-red-500/20 hover:border-red-500/40 transition-all">
                         <div className="flex justify-between items-start mb-3">
                            <span className="bg-slate-900 text-white px-3 py-1 rounded-lg font-black text-xs">لجنة {req.committee}</span>
                            <span className="text-[10px] text-slate-500">{new Date(req.time).toLocaleTimeString('ar-SA')}</span>
                         </div>
                         <p className="text-lg font-black text-white">{cleanControlRequestText(req.text)}</p>
                      </div>
                    ))
                  )}
               </div>
            </div>
         </div>

         <div className="xl:col-span-8">
             <div className="bg-white rounded-[2.5rem] p-8 shadow-md border border-slate-100 flex flex-col min-h-[440px]">
               <h3 className="text-3xl font-black text-slate-900 mb-10 text-right">خريطة الانتشار الميداني</h3>
               <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-10 gap-3 flex-1">
                  {Array.from(new Set(students.map(s => s.committee_number))).filter(Boolean).sort((a,b)=>Number(a)-Number(b)).map(num => {
                    const isOccupied = supervisions.some(s => s.committee_number === num);
                    const isFinished = deliveryLogs.some(l => l.committee_number === num && l.status === 'CONFIRMED');
                    const hasPendingReq = requests.some(r => r.committee === num && r.status === 'PENDING');
                    return (
                      <div key={num} className={`aspect-square border-2 flex flex-col items-center justify-center transition-all ${isFinished ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 border-emerald-400/50 text-white rounded-xl' : hasPendingReq ? 'bg-gradient-to-br from-red-500 to-red-600 border-red-400/50 text-white animate-pulse rounded-xl' : isOccupied ? 'bg-gradient-to-br from-blue-500 to-blue-600 border-blue-400/50 text-white rounded-xl' : 'bg-slate-50 border-slate-100 opacity-25 rounded-xl'}`}>
                         <span className="text-xl font-black tabular-nums">{num}</span>
                      </div>
                    );
                  })}
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};

export default ControlHeadDashboard;
