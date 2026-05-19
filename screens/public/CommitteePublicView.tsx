import React, { useMemo } from 'react';
import { Student, Supervision, Absence, User } from '../../types';
import { User as UserIcon, Clock, CheckCircle2, XCircle, AlertCircle, Calendar } from 'lucide-react';
import { APP_CONFIG } from '../../constants';

interface Props {
  committeeNumber: string;
  students: Student[];
  supervisions: Supervision[];
  absences: Absence[];
  users: User[];
}

const CommitteePublicView: React.FC<Props> = ({ 
  committeeNumber, 
  students, 
  supervisions, 
  absences, 
  users 
}) => {
  const commStudents = useMemo(() => {
    return students
      .filter(s => s.committee_number === committeeNumber)
      .sort((a, b) => {
        const numA = parseInt(a.seating_number || '0');
        const numB = parseInt(b.seating_number || '0');
        return numA - numB;
      });
  }, [students, committeeNumber]);

  const supervision = useMemo(() => {
    return supervisions.find(s => s.committee_number === committeeNumber);
  }, [supervisions, committeeNumber]);

  const proctor = useMemo(() => {
    if (!supervision) return null;
    return users.find(u => u.id === supervision.teacher_id);
  }, [supervision, users]);

  const joinTime = useMemo(() => {
    if (!supervision?.date) return '---';
    try {
      return new Date(supervision.date).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '---';
    }
  }, [supervision]);

  const stats = useMemo(() => {
    const total = commStudents.length;
    const commAbsences = absences.filter(a => a.committee_number === committeeNumber);
    const absentCount = commAbsences.filter(a => a.type === 'ABSENT').length;
    const lateCount = commAbsences.filter(a => a.type === 'LATE').length;
    const presentCount = total - absentCount;
    return { total, present: presentCount, absent: absentCount, late: lateCount };
  }, [commStudents, absences, committeeNumber]);

  if (!commStudents.length) {
    return (
      <div className="min-h-[100dvh] bg-slate-50 flex items-center justify-center font-['Tajawal']" dir="rtl">
        <div className="bg-white p-10 rounded-3xl shadow-2xl text-center space-y-4 max-w-sm w-full mx-6">
          <div className="text-6xl mb-6">🚫</div>
          <h2 className="text-2xl font-black text-slate-800">بيانات اللجنة غير متوفرة</h2>
          <p className="font-bold text-slate-500">تأكد من مسح باركود صحيح.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-slate-50 font-['Tajawal'] text-right pb-10" dir="rtl">
      {/* هيدر وزاري علوي */}
      <div className="bg-slate-900 text-white rounded-b-[3rem] p-6 pt-10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 blur-[80px] rounded-full pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col items-center space-y-4 text-center">
            <img src={APP_CONFIG.LOGO_URL} alt="Logo" className="w-20 h-20 object-contain rounded-2xl bg-white/10 p-2 border border-white/20" />
            <div>
              <h1 className="text-xl font-black mb-1 tracking-tight text-white/90">لجنة رقم {committeeNumber}</h1>
              <p className="text-xs font-bold text-slate-400 mb-3">الإدارة العامة للتعليم - لوحة الإشراف الميداني</p>
              <div className="inline-flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-full text-xs font-bold">
                 <Calendar size={14} className="text-blue-400" />
                 <span>{new Intl.DateTimeFormat('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date())}</span>
              </div>
            </div>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 -mt-6 relative z-20 space-y-6">
        
        {/* معلومات المراقب */}
        <div className="bg-white rounded-[2rem] p-6 shadow-xl border border-slate-100 flex items-center gap-4">
           <div className="bg-blue-50 text-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center shrink-0">
              <UserIcon size={32} />
           </div>
           <div className="flex-1 space-y-1">
             <p className="text-[10px] font-black tracking-widest text-slate-400 uppercase">المعلم المراقب</p>
             <h3 className="text-lg font-black text-slate-800 leading-tight">{proctor?.full_name || 'لم يقم بتسجيل الدخول بعد'}</h3>
             {proctor && (
               <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 mt-2 bg-emerald-50 px-2 py-1 rounded-lg w-fit">
                 <Clock size={14} />
                 <span>وقت الدخول: {joinTime}</span>
               </div>
             )}
           </div>
        </div>

        {/* لوحة الإحصائيات (Dashboard) */}
        <div className="grid grid-cols-2 gap-4">
           <div className="bg-white p-5 rounded-[2rem] shadow-xl border border-slate-100 space-y-2">
             <p className="text-xs font-black tracking-widest text-slate-400">حاضر</p>
             <p className="text-4xl font-black text-emerald-600 tabular-nums">{stats.present}</p>
           </div>
           <div className="bg-white p-5 rounded-[2rem] shadow-xl border border-slate-100 space-y-2">
             <p className="text-xs font-black tracking-widest text-slate-400">غائب أم متأخر</p>
             <p className="text-4xl font-black text-red-600 tabular-nums">{stats.absent + stats.late} <span className="text-sm text-slate-400 font-bold">({stats.absent} غائب)</span></p>
           </div>
        </div>

        {/* قائمة الطلاب */}
        <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden">
           <div className="bg-slate-50 p-5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-800">سجل الطلاب التفصيلي ({stats.total})</h3>
           </div>
           
           <div className="divide-y divide-slate-50">
             {commStudents.map(student => {
                const absenceRec = absences.find(a => a.student_id === student.national_id && a.committee_number === committeeNumber);
                const isAbsent = absenceRec?.type === 'ABSENT';
                const isLate = absenceRec?.type === 'LATE';
                const isPresent = !isAbsent && !isLate;

                return (
                  <div key={student.id} className="p-4 flex items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors">
                     {/* بيانات الطالب ورقم الجلوس */}
                     <div className="flex-1 min-w-0 flex flex-col justify-center">
                       <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[9px] font-black bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded text-center min-w-[24px] tabular-nums shrink-0">
                            {student.seating_number || '-'}
                          </span>
                          <h4 className="text-sm font-black text-slate-800 truncate leading-tight">{student.name}</h4>
                       </div>
                       <p className="text-[10px] font-bold text-slate-400 pr-9">{student.grade} - {student.section}</p>
                     </div>

                     {/* الحالة */}
                     <div className="shrink-0 flex items-center">
                       {isPresent && (
                         <div className="bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-lg text-[10px] font-black flex items-center gap-1.5">
                           <CheckCircle2 size={12} /> حاضر
                         </div>
                       )}
                       {isAbsent && (
                         <div className="bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-[10px] font-black flex items-center gap-1.5">
                           <XCircle size={12} /> غائب
                         </div>
                       )}
                       {isLate && (
                         <div className="bg-amber-50 text-amber-600 px-3 py-1.5 rounded-lg text-[10px] font-black flex items-center gap-1.5">
                           <AlertCircle size={12} /> متأخر
                         </div>
                       )}
                     </div>
                  </div>
                );
             })}
           </div>
        </div>
        
      </div>
    </div>
  );
};

export default CommitteePublicView;
