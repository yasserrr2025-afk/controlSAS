
import React, { useMemo, useState } from 'react';
import { User, Supervision, DeliveryLog, Absence, SystemConfig } from '../../types';
import { 
  Award, Trophy, Timer, Zap, Search, Printer, 
  ChevronLeft, Star, Medal, Target, TrendingUp,
  Download, FileBadge, CheckCircle, UserCheck, X
} from 'lucide-react';
import OfficialHeader from '../../components/OfficialHeader';

interface Props {
  users: User[];
  supervisions: Supervision[];
  deliveryLogs: DeliveryLog[];
  absences: Absence[];
  systemConfig: SystemConfig;
}

const ProctorPerformance: React.FC<Props> = ({ users, supervisions, deliveryLogs, absences, systemConfig }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProctor, setSelectedProctor] = useState<any>(null);

  const performanceData = useMemo(() => {
    const proctors = users.filter(u => u.role === 'PROCTOR');
    const examDate = systemConfig.active_exam_date || new Date().toISOString().split('T')[0];
    const [startH, startM] = (systemConfig.exam_start_time || '08:00').split(':').map(Number);
    const examStartTime = new Date();
    examStartTime.setHours(startH, startM, 0);

    return proctors.map(u => {
      const sv = supervisions.find(s => s.teacher_id === u.id && s.date.startsWith(examDate));
      const logs = deliveryLogs.filter(l => l.proctor_name === u.full_name && l.time.startsWith(examDate));
      
      let startDiff = -1;
      if (sv) {
        const joinTime = new Date(sv.date);
        startDiff = Math.max(0, Math.floor((joinTime.getTime() - examStartTime.getTime()) / 60000));
      }

      const isFinished = logs.length > 0 && logs.every(l => l.status === 'CONFIRMED');
      const score = sv ? Math.max(0, 100 - (startDiff * 2)) : 0;
      
      return {
        ...u,
        startDiff,
        isJoined: !!sv,
        isFinished,
        score: sv ? score : 0,
        rank: score > 90 ? 'GOLD' : score > 70 ? 'SILVER' : score > 0 ? 'BRONZE' : 'NONE'
      };
    }).sort((a, b) => b.score - a.score);
  }, [users, supervisions, deliveryLogs, systemConfig]);

  const filtered = performanceData.filter(p => p.full_name.includes(searchTerm));

  const AppreciationCertificate = ({ proctor }: { proctor: any }) => (
    <div className="official-page-container print-only">
      <div className="official-a4-page relative border-[10pt] border-double border-blue-900 p-12 flex flex-col items-center text-center">
        <OfficialHeader />
        
        <div className="mt-20 space-y-12 w-full">
          <div className="flex justify-center mb-8">
            <div className="relative">
              <Award size={120} className="text-blue-900" />
              <Star size={40} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white fill-blue-900" />
            </div>
          </div>

          <h1 className="text-5xl font-black text-blue-900 tracking-widest">شهادة شكر وتقدير</h1>
          
          <div className="space-y-6 text-2xl font-bold leading-loose text-slate-800">
            <p>تتقدم إدارة المدرسة بجزيل الشكر والامتنان للأستاذ/ة:</p>
            <p className="text-5xl font-black text-slate-900 border-b-4 border-dotted border-blue-900 pb-4 px-10 inline-block">
              {proctor.full_name}
            </p>
            <p className="max-w-3xl mx-auto">
              وذلك نظير تميزه الميداني وانضباطه العالي في أعمال مراقبة واختبارات الفصل الدراسي الحالي، 
              وتحقيقه مؤشر أداء قياسي في سرعة المباشرة والتوثيق الميداني.
            </p>
          </div>

          <div className="pt-20 grid grid-cols-2 w-full gap-20">
            <div className="text-center space-y-4">
               <p className="font-black text-2xl">رئيس الكنترول</p>
               <p className="text-slate-400">...........................</p>
            </div>
            <div className="text-center space-y-4">
               <p className="font-black text-2xl">مدير المدرسة</p>
               <p className="text-slate-400">...........................</p>
            </div>
          </div>
        </div>

        <div className="absolute bottom-10 left-10 text-[8pt] text-slate-400 font-mono">
          Ref ID: PERF-{proctor.national_id.slice(-4)}-{new Date().getFullYear()}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-10 animate-fade-in text-right pb-32">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 no-print">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">سجل تميز المراقبين</h2>
          <p className="text-slate-400 font-bold italic mt-2">تحليل ذكي للأداء الميداني بناءً على البصمة الزمنية</p>
        </div>
        <div className="relative w-full md:w-96">
          <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="ابحث عن مراقب..." 
            className="w-full pr-14 py-4 bg-white border-2 border-slate-100 rounded-[2rem] font-bold shadow-xl outline-none focus:border-blue-600"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 no-print">
        {filtered.map((p, idx) => (
          <div key={p.id} className="bg-white rounded-[3.5rem] p-8 shadow-2xl border-2 border-slate-50 relative overflow-hidden group hover:scale-[1.02] transition-all flex flex-col justify-between min-h-[400px]">
            <div className={`absolute top-0 left-0 w-full h-2 ${p.rank === 'GOLD' ? 'bg-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.5)]' : p.rank === 'SILVER' ? 'bg-slate-400' : p.rank === 'BRONZE' ? 'bg-orange-600' : 'bg-slate-100'}`}></div>
            
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-6">
                <div className="w-16 h-16 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-lg">
                   {p.rank === 'GOLD' ? <Trophy className="text-amber-400" /> : <Award className="text-slate-400" />}
                </div>
                <div className="text-left">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">مؤشر الأداء</p>
                   <p className={`text-3xl font-black ${p.score > 80 ? 'text-emerald-600' : 'text-slate-900'}`}>{p.score}%</p>
                </div>
              </div>

              <h3 className="text-xl font-black text-slate-800 mb-2 leading-tight">{p.full_name}</h3>
              <p className="text-[10px] font-bold text-slate-400 mb-6 italic">ID: {p.national_id}</p>

              <div className="space-y-4">
                 <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                    <div className="flex items-center gap-3 text-slate-500 font-bold text-xs"><Timer size={16}/> المباشرة</div>
                    <span className={`font-black text-sm ${p.startDiff <= 5 && p.startDiff !== -1 ? 'text-emerald-600' : 'text-red-500'}`}>
                       {p.startDiff === -1 ? 'لم يباشر' : `+ ${p.startDiff} دقيقة`}
                    </span>
                 </div>
                 <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                    <div className="flex items-center gap-3 text-slate-500 font-bold text-xs"><CheckCircle size={16}/> الحالة</div>
                    <span className={`px-3 py-1 rounded-lg text-[9px] font-black ${p.isFinished ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>
                       {p.isFinished ? 'تم التسليم' : 'قيد العمل'}
                    </span>
                 </div>
              </div>
            </div>

            <button 
              onClick={() => { setSelectedProctor(p); setTimeout(() => window.print(), 500); }}
              className={`mt-8 w-full py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-3 transition-all ${p.score >= 80 ? 'bg-slate-900 text-white hover:bg-blue-600 shadow-xl' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
              disabled={p.score < 80}
            >
              <FileBadge size={18} /> استخراج شهادة شكر
            </button>
          </div>
        ))}
      </div>

      {selectedProctor && <AppreciationCertificate proctor={selectedProctor} />}

      <style>{`
        @media print {
          .official-page-container { display: block !important; width: 100%; height: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
};

export default ProctorPerformance;
