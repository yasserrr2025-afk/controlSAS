
import React, { useMemo, useState } from 'react';
import { Absence, Student, Supervision, User } from '../../types';
import { APP_CONFIG } from '../../constants';
import OfficialHeader from '../../components/OfficialHeader';
import { Search, Printer, LayoutList, UserMinus, Clock, LayoutGrid, UserCheck, PhoneOutgoing, AlertCircle, CheckCircle2 } from 'lucide-react';

interface Props {
  absences: Absence[];
  students: Student[];
  supervisions: Supervision[];
  users: User[];
}

const StatCard = ({ title, value, icon, color, bgColor, textColor }: any) => (
  <div className={`p-8 rounded-[2.5rem] border-2 ${color} bg-white shadow-xl flex items-center gap-8 transition-all hover:scale-[1.03] text-right`}>
    <div className={`p-6 ${bgColor} ${textColor} rounded-3xl shadow-inner`}>{icon}</div>
    <div><p className="text-slate-400 text-[10px] font-black uppercase mb-1">{title}</p><p className="text-4xl font-black text-slate-900 leading-none tabular-nums">{value}</p></div>
  </div>
);

const CounselorAbsenceMonitor: React.FC<Props> = ({ absences, students, supervisions, users }) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  const enrichedAbsences = useMemo(() => {
    return absences.map((a: Absence) => {
      const student = students.find((s: Student) => s.national_id === a.student_id);
      const supervision = supervisions.find((sv: Supervision) => sv.committee_number === a.committee_number);
      const proctor = users.find((u: User) => u.id === (supervision?.teacher_id || a.proctor_id));
      
      return {
        ...a,
        studentName: student?.name || a.student_name,
        grade: student?.grade || '---',
        section: student?.section || '---',
        parentPhone: student?.parent_phone || '',
        proctorName: proctor?.full_name || 'بانتظار التحاق المراقب'
      };
    }).filter((a: any) => 
      a.studentName.includes(searchTerm) || 
      a.committee_number.includes(searchTerm) ||
      a.grade.includes(searchTerm)
    );
  }, [absences, students, supervisions, users, searchTerm]);

  const stats = {
    total: enrichedAbsences.length,
    absent: enrichedAbsences.filter((a: any) => a.type === 'ABSENT').length,
    late: enrichedAbsences.filter((a: any) => a.type === 'LATE').length,
  };

  return (
    <div className="space-y-10 animate-fade-in text-right pb-20">
      <div className="flex flex-col lg:flex-row justify-between items-end gap-6 no-print">
        <div className="space-y-2 flex-1">
          <h2 className="text-4xl font-black text-slate-800 tracking-tighter">متابعة غياب اليوم</h2>
          <p className="text-slate-400 font-bold italic">شاشة الموجه الطلابي - رصد الحالات لحظياً</p>
        </div>
        
        <div className="flex flex-wrap gap-4 w-full lg:w-auto">
          <div className="relative flex-1 lg:w-80">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="ابحث باسم الطالب، اللجنة، أو الصف..." 
              className="w-full pr-12 pl-4 py-4 bg-white border-2 border-slate-100 rounded-2xl font-bold shadow-sm outline-none focus:border-blue-600 transition-all"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <button onClick={() => window.print()} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black shadow-xl flex items-center gap-3 hover:bg-black transition-all">
            <Printer size={20} />
            تقرير الغياب
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 no-print">
        <StatCard title="إجمالي البلاغات" value={stats.total} icon={<LayoutList size={32} />} color="border-indigo-200" bgColor="bg-indigo-50" textColor="text-indigo-600" />
        <StatCard title="حالات الغياب" value={stats.absent} icon={<UserMinus size={32} />} color="border-red-200" bgColor="bg-red-50" textColor="text-red-600" />
        <StatCard title="حالات التأخر" value={stats.late} icon={<Clock size={32} />} color="border-amber-200" bgColor="bg-amber-50" textColor="text-amber-600" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 no-print">
        {enrichedAbsences.length > 0 ? enrichedAbsences.map((a: any) => (
          <div key={a.id} className={`bg-white rounded-[3.5rem] p-10 shadow-2xl border-2 transition-all hover:scale-[1.02] flex flex-col justify-between min-h-[420px] relative overflow-hidden group ${a.type === 'ABSENT' ? 'border-red-50' : 'border-amber-50'}`}>
            <div className={`absolute top-0 right-0 w-32 h-32 blur-3xl opacity-10 ${a.type === 'ABSENT' ? 'bg-red-600' : 'bg-amber-500'}`}></div>
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-6">
                <span className={`px-5 py-1.5 rounded-full font-black text-[10px] uppercase tracking-widest ${a.type === 'ABSENT' ? 'bg-red-600 text-white' : 'bg-amber-500 text-white shadow-amber-200 shadow-lg'}`}>
                  {a.type === 'ABSENT' ? 'غائب' : 'متأخر'}
                </span>
                <span className="text-slate-300 font-mono text-xs">{a.date.split('T')[0]}</span>
              </div>
              <div className="flex items-center gap-5 mb-8">
                <div className={`w-20 h-20 rounded-[1.8rem] flex items-center justify-center shadow-inner ${a.type === 'ABSENT' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                   <img src={APP_CONFIG.LOGO_URL} alt="Student" className="w-12 h-12 object-contain" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-800 leading-none mb-2">{a.studentName}</h3>
                  <div className="flex gap-2">
                    <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-[10px] font-black">{a.grade}</span>
                    <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-[10px] font-black">فصل: {a.section}</span>
                  </div>
                </div>
              </div>
              <div className="space-y-4 mb-8">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <LayoutGrid size={18} className="text-blue-600" />
                    <span className="text-sm font-bold text-slate-500">رقم اللجنة</span>
                  </div>
                  <span className="text-xl font-black text-slate-900">{a.committee_number}</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <UserCheck size={18} className="text-blue-600" />
                    <span className="text-sm font-bold text-slate-500">المراقب</span>
                  </div>
                  <span className="text-sm font-black text-slate-800">{a.proctorName}</span>
                </div>
              </div>
            </div>
            <div className="mt-auto">
              {a.parentPhone ? (
                <a href={`tel:${a.parentPhone}`} className={`w-full py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-4 transition-all shadow-xl active:scale-95 ${a.type === 'ABSENT' ? 'bg-red-600 text-white hover:bg-red-700 shadow-red-200' : 'bg-slate-900 text-white hover:bg-black shadow-slate-200'}`}><PhoneOutgoing size={24} />اتصال بولي الأمر</a>
              ) : (
                <div className="w-full py-5 bg-slate-100 text-slate-400 rounded-2xl font-bold flex items-center justify-center gap-3 border-2 border-dashed border-slate-200"><AlertCircle size={20} />رقم الجوال غير متوفر</div>
              )}
            </div>
          </div>
        )) : (
          <div className="col-span-full py-20 text-center flex flex-col items-center gap-6">
            <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center text-slate-300"><CheckCircle2 size={64} /></div>
            <h3 className="text-2xl font-black text-slate-400 italic">لا توجد حالات غياب مسجلة حتى الآن</h3>
          </div>
        )}
      </div>

      <div className="print-only w-full">
        <OfficialHeader />
        <div className="text-center my-8">
          <h2 className="text-2xl font-black border-b-4 border-double border-slate-900 pb-2 inline-block px-10">بيان غياب وتأخر الطلاب اليومي</h2>
          <p className="mt-4 font-bold text-lg">التاريخ: {new Date().toLocaleDateString('ar-SA')}</p>
        </div>
        <table className="w-full text-center border-2 border-slate-900 mt-4 border-collapse">
          <thead>
            <tr className="bg-slate-100">
              <th className="border-2 border-slate-900 p-2 font-black">م</th>
              <th className="border-2 border-slate-900 p-2 font-black">اسم الطالب</th>
              <th className="border-2 border-slate-900 p-2 font-black">اللجنة</th>
              <th className="border-2 border-slate-900 p-2 font-black">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {enrichedAbsences.map((stat, i) => (
              <tr key={i}>
                <td className="border-2 border-slate-900 p-2 font-bold">{i+1}</td>
                <td className="border-2 border-slate-900 p-2 text-right px-4 font-black">{stat.studentName}</td>
                <td className="border-2 border-slate-900 p-2 font-bold">{stat.committee_number}</td>
                <td className="border-2 border-slate-900 p-2">{stat.type === 'ABSENT' ? 'غائب' : 'متأخر'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CounselorAbsenceMonitor;
