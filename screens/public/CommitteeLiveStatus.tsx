
import React, { useMemo } from 'react';
import { Student, Absence, Supervision, User, DeliveryLog } from '../../types';
import { APP_CONFIG } from '../../constants';
import { 
  Users, UserCheck, CheckCircle2, Clock, 
  Activity, ShieldCheck, MapPin, ArrowRight,
  PackageCheck, Timer, UserX
} from 'lucide-react';

interface Props {
  committeeNumber: string;
  students: Student[];
  absences: Absence[];
  supervisions: Supervision[];
  users: User[];
  deliveryLogs: DeliveryLog[];
  onBack?: () => void;
}

const CommitteeLiveStatus: React.FC<Props> = ({ 
  committeeNumber, students, absences, supervisions, users, deliveryLogs, onBack 
}) => {
  // ملاحظة: لا نحتاج لتعريف activeDate هنا لأن App.tsx يقوم بفلترة المصفوفات مسبقاً 
  // بناءً على اليوم النشط في النظام قبل تمريرها لهذا المكون.

  const stats = useMemo(() => {
    // توحيد مقارنة رقم اللجنة لضمان الدقة
    const targetCom = String(committeeNumber).trim();

    const committeeStudents = students.filter(s => String(s.committee_number).trim() === targetCom);
    const committeeAbsences = absences.filter(a => String(a.committee_number).trim() === targetCom);
    
    const total = committeeStudents.length;
    const abs = committeeAbsences.filter(a => a.type === 'ABSENT').length;
    const late = committeeAbsences.filter(a => a.type === 'LATE').length;
    
    // البحث عن التكليف في المصفوفة المفلترة مسبقاً
    const sv = supervisions.find(s => String(s.committee_number).trim() === targetCom);
    const proctor = users.find(u => u.id === sv?.teacher_id);
    
    const logs = deliveryLogs.filter(l => String(l.committee_number).trim() === targetCom);
    const confirmedLogs = logs.filter(l => l.status === 'CONFIRMED');

    return {
      total,
      present: total - abs,
      abs,
      late,
      proctorName: proctor?.full_name || '--- بانتظار المباشرة ---',
      isAssigned: !!proctor,
      progress: total > 0 ? Math.round(((total - abs) / total) * 100) : 0,
      logs: confirmedLogs.sort((a, b) => b.time.localeCompare(a.time))
    };
  }, [committeeNumber, students, absences, supervisions, users, deliveryLogs]);

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 animate-fade-in text-right">
      {onBack && (
        <button onClick={onBack} className="mb-8 flex items-center gap-2 text-slate-400 font-bold hover:text-blue-600 transition-colors">
          <ArrowRight size={20} /> العودة للنظام
        </button>
      )}

      {/* Header Card */}
      <div className="bg-slate-950 p-10 rounded-[4rem] text-white shadow-2xl relative overflow-hidden border-b-[10px] border-blue-600 mb-10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 blur-[100px] rounded-full"></div>
        <div className="relative z-10 flex flex-col items-center gap-6">
          <div className="w-24 h-24 bg-white rounded-3xl p-1.5 shadow-2xl border-4 border-blue-500/20">
             <img src={APP_CONFIG.LOGO_URL} alt="Logo" className="w-full h-full object-contain" />
          </div>
          <div className="text-center">
             <h2 className="text-[10px] font-black uppercase tracking-[0.5em] text-blue-400 mb-2">بوابة المتابعة المباشرة</h2>
             <h1 className="text-4xl font-black tracking-tighter">اللجنة رقم {committeeNumber}</h1>
          </div>
          <div className="flex gap-4">
             <span className="bg-white/5 border border-white/10 px-6 py-2 rounded-full font-black text-[10px] flex items-center gap-2">
                <Clock size={14} className="text-blue-500" /> {new Date().toLocaleTimeString('ar-SA', {hour:'2-digit', minute:'2-digit'})}
             </span>
             <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-6 py-2 rounded-full font-black text-[10px] flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></div> مباشر الآن
             </span>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Proctor Assignment Info */}
        <div className="bg-white p-8 rounded-[3.5rem] shadow-xl border-2 border-slate-50 flex items-center gap-6">
           <div className={`w-20 h-20 rounded-[2rem] flex items-center justify-center shadow-lg ${stats.isAssigned ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-300'}`}>
              <UserCheck size={40} />
           </div>
           <div className="flex-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 leading-none">المراقب المسؤول</p>
              <h3 className="text-2xl font-black text-slate-900 leading-tight">{stats.proctorName}</h3>
           </div>
        </div>

        {/* Progress Tracker */}
        <div className="bg-white p-8 rounded-[3.5rem] shadow-xl border-2 border-slate-50 space-y-6">
           <div className="flex justify-between items-end">
              <div className="text-right">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">مؤشر رصد الحضور</p>
                 <h4 className="text-3xl font-black text-slate-900 tabular-nums">{stats.progress}%</h4>
              </div>
              <div className="flex gap-2">
                 <div className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-2xl text-center border border-emerald-100">
                    <p className="text-[8px] font-black uppercase mb-1">حاضر</p>
                    <p className="text-xl font-black tabular-nums">{stats.present}</p>
                 </div>
                 <div className="bg-red-50 text-red-600 px-4 py-2 rounded-2xl text-center border border-red-100">
                    <p className="text-[8px] font-black uppercase mb-1">غائب</p>
                    <p className="text-xl font-black tabular-nums">{stats.abs}</p>
                 </div>
              </div>
           </div>
           <div className="h-4 bg-slate-100 rounded-full overflow-hidden p-1 shadow-inner">
              <div className="h-full bg-blue-600 rounded-full transition-all duration-1000 shadow-[0_0_15px_rgba(37,99,235,0.4)]" style={{ width: `${stats.progress}%` }}></div>
           </div>
        </div>

        {/* Real-time Logs Feed */}
        <div className="bg-slate-50 p-8 rounded-[3.5rem] shadow-inner space-y-6 min-h-[300px]">
           <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
              <Activity className="text-blue-600" /> سجل عمليات الميدان
           </h3>
           <div className="space-y-4">
              {stats.logs.length === 0 ? (
                <div className="py-20 text-center text-slate-300 italic flex flex-col items-center gap-4">
                   <Timer size={48} className="opacity-20" />
                   <p className="font-black">بانتظار توثيق العمليات...</p>
                </div>
              ) : (
                stats.logs.map(log => (
                  <div key={log.id} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex justify-between items-center group transition-all hover:border-emerald-300">
                     <div className="flex items-center gap-4">
                        <div className="bg-emerald-50 text-emerald-600 p-3 rounded-2xl">
                           <PackageCheck size={24} />
                        </div>
                        <div>
                           <h5 className="font-black text-slate-900">{log.grade}</h5>
                           <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">تم الاستلام نظامياً</p>
                        </div>
                     </div>
                     <div className="text-left">
                        <p className="text-xl font-black text-slate-900 tabular-nums">{new Date(log.time).toLocaleTimeString('ar-SA', {hour:'2-digit', minute:'2-digit'})}</p>
                        <p className="text-[8px] font-black text-slate-400 uppercase">الوقت</p>
                     </div>
                  </div>
                ))
              )}
           </div>
        </div>

        {/* Footer info */}
        <div className="text-center pt-8 space-y-2 opacity-40">
           <p className="text-[10px] font-black uppercase tracking-[0.3em]">Smart Control Live Sync</p>
           <p className="text-[8px] font-bold italic text-slate-500 underline decoration-blue-500/30">جميع البيانات أعلاه يتم تحديثها آلياً بشكل لحظي</p>
        </div>
      </div>
    </div>
  );
};

export default CommitteeLiveStatus;
