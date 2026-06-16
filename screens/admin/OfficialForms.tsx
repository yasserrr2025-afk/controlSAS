
import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Absence, Student, Supervision, User } from '../../types';
import { Printer, Calendar, AlertTriangle, FileCheck, Info, Loader2, ListChecks, History, UserMinus, Clock } from 'lucide-react';
import OfficialHeader from '../../components/OfficialHeader';

interface Props {
  absences: Absence[];
  students: Student[];
  supervisions: Supervision[];
  users: User[];
}

const AdminOfficialForms: React.FC<Props> = ({ absences, students, supervisions, users }) => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printQueue, setPrintQueue] = useState<Absence[]>([]);
  const [printType, setPrintType] = useState<'INDIVIDUAL' | 'CUMULATIVE'>('INDIVIDUAL');
  const [cumulativeType, setCumulativeType] = useState<'ABSENT' | 'LATE'>('ABSENT');

  const dailyAbsences = useMemo(() => {
    return absences.filter(a => a.date.startsWith(selectedDate));
  }, [absences, selectedDate]);

  const allAbsences = useMemo(() => absences.filter(a => a.type === 'ABSENT').sort((a,b) => b.date.localeCompare(a.date)), [absences]);
  const allDelays = useMemo(() => absences.filter(a => a.type === 'LATE').sort((a,b) => b.date.localeCompare(a.date)), [absences]);

  const cumulativeData = useMemo(() => {
    const targetAbsences = cumulativeType === 'ABSENT' ? allAbsences : allDelays;
    const map: Record<string, { student: Student, count: number, committees: Set<string> }> = {};
    
    targetAbsences.forEach(a => {
      if (!map[a.student_id]) {
        const s = students.find(st => st.national_id === a.student_id);
        if (s) {
          map[a.student_id] = { student: s, count: 0, committees: new Set() };
        }
      }
      if (map[a.student_id]) {
        map[a.student_id].count++;
        map[a.student_id].committees.add(a.committee_number);
      }
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [allAbsences, allDelays, cumulativeType, students]);

  const getRandomUserByRole = (role: string) => {
    const filtered = users.filter(u => u.role === role);
    if (filtered.length === 0) return '................';
    return filtered[Math.floor(Math.random() * filtered.length)].full_name;
  };

  const getControlMemberForGrade = (grade: string) => {
    const member = users.find(u => u.role === 'CONTROL' && u.assigned_grades?.includes(grade));
    return member?.full_name || '................';
  };

  const getProctorName = (committeeNum: string, date: string) => {
    const sv = supervisions.find(s => s.committee_number === committeeNum && s.date.startsWith(date.split('T')[0]));
    const user = users.find(u => u.id === sv?.teacher_id);
    return user?.full_name || '................';
  };

  const getArabicDayName = (dateStr: string) => {
    return new Intl.DateTimeFormat('ar-SA', { weekday: 'long' }).format(new Date(dateStr));
  };

  const triggerPrint = (queue: Absence[], type: 'INDIVIDUAL' | 'CUMULATIVE' = 'INDIVIDUAL') => {
    setPrintType(type);
    setPrintQueue(queue);
    setIsPrinting(true);
    setTimeout(() => { window.print(); }, 800);
  };

  useEffect(() => {
    const handleAfterPrint = () => {
      setIsPrinting(false);
      setPrintQueue([]);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  // --- محضر غياب طالب (نموذج 36) ---
  const AbsenceForm = ({ absence }: { absence: Absence }) => {
    const student = students.find(s => s.national_id === absence.student_id);
    const proctorName = getProctorName(absence.committee_number, absence.date);
    const headName = getRandomUserByRole('CONTROL_MANAGER');
    const controlName = getControlMemberForGrade(student?.grade || '');
    const counselorName = getRandomUserByRole('COUNSELOR');
    const dayName = getArabicDayName(absence.date);

    return (
      <div className="official-page-container">
        <div className="official-a4-page relative flex flex-col border-[1.5pt] border-slate-900 p-4 pt-2">
          <OfficialHeader />
          <div className="text-center mb-4">
            <p className="text-[7pt] font-black text-slate-500 mb-1">النموذج الموحد رقم: 36</p>
            <h2 className="text-[10pt] font-black mb-1 border-b-2 border-slate-900 inline-block px-8">محضر إثبات غياب طالب</h2>
          </div>

          <div className="w-full border-[1pt] border-slate-900 mb-6 text-[8pt]">
             <div className="grid grid-cols-2 border-b-[1pt] border-slate-900">
                <div className="p-2 border-l-[1pt] border-slate-900 flex justify-between items-center">
                   <span className="font-bold">اسم الطالب:</span>
                   <span className="font-black text-right flex-1 px-2">{absence.student_name}</span>
                </div>
                <div className="p-2 flex justify-between items-center">
                   <span className="font-bold">رقم الجلوس:</span>
                   <span className="font-black tabular-nums">{student?.seating_number || '---'}</span>
                </div>
             </div>
             <div className="grid grid-cols-2 border-b-[1pt] border-slate-900">
                <div className="p-2 border-l-[1pt] border-slate-900 flex justify-between items-center">
                   <span className="font-bold">اليوم:</span>
                   <span className="font-black text-right flex-1 px-2">{dayName}</span>
                </div>
                <div className="p-2 flex justify-between items-center">
                   <span className="font-bold">التاريخ:</span>
                   <span className="font-black tabular-nums">{new Date(absence.date).toLocaleDateString('ar-SA')}</span>
                </div>
             </div>
             <div className="grid grid-cols-3">
                <div className="p-2 border-l-[1pt] border-slate-900 flex justify-between items-center">
                   <span className="font-bold">اللجنة:</span>
                   <span className="font-black text-sm">{absence.committee_number}</span>
                </div>
                <div className="p-2 border-l-[1pt] border-slate-900 flex justify-between items-center">
                   <span className="font-bold">الصف:</span>
                   <span className="font-black">{student?.grade || '---'}</span>
                </div>
                <div className="p-2 flex justify-between items-center">
                   <span className="font-bold">الفصل:</span>
                   <span className="font-black">{student?.section || '---'}</span>
                </div>
             </div>
          </div>

          <div className="mb-6">
            <div className="bg-slate-100 p-2 border-[1pt] border-slate-900 text-right font-black text-[8pt] mb-[-1px] px-4">بيان المصادقة والمطابقة (لجنة الكنترول)</div>
            <table className="w-full border-[1pt] border-slate-900 text-[8pt] text-right border-collapse">
              <thead className="bg-slate-50 font-bold">
                <tr>
                  <th className="border border-slate-900 p-2 w-8 text-center">م</th>
                  <th className="border border-slate-900 p-2">الاسم الرباعي</th>
                  <th className="border border-slate-900 p-2 w-32">الصفة</th>
                  <th className="border border-slate-900 p-2 w-32">التوقيع</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { role: 'رئيس لجنة الكنترول', name: headName },
                  { role: 'عضو لجنة الكنترول', name: controlName },
                  { role: 'مراقب اللجنة المعني', name: proctorName }
                ].map((row, i) => (
                  <tr key={i} className="h-10">
                    <td className="border border-slate-900 p-2 text-center font-bold">{i+1}</td>
                    <td className="border border-slate-900 p-2 font-black px-3">{row.name}</td>
                    <td className="border border-slate-900 p-2 font-bold px-3">{row.role}</td>
                    <td className="border border-slate-900 p-2"></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-auto grid grid-cols-2 gap-10 px-6 pb-6 text-[8pt]">
             <div className="text-center space-y-12">
                <p className="font-black underline underline-offset-4 text-[10pt]">رئيس الكنترول</p>
                <div className="space-y-1">
                  <p className="font-black">{headName}</p>
                  <p className="font-bold">.........................</p>
                </div>
             </div>
             <div className="text-center space-y-12">
                <p className="font-black underline underline-offset-4 text-[10pt]">مدير المدرسة</p>
                <div className="space-y-1">
                  <p className="font-bold">.........................</p>
                  <p className="text-slate-400 italic text-[7pt]">(الختم الرسمي)</p>
                </div>
             </div>
          </div>
        </div>
      </div>
    );
  };

  // --- تعهد تأخر طالب (نموذج 31) ---
  const DelayForm = ({ absence }: { absence: Absence }) => {
    const student = students.find(s => s.national_id === absence.student_id);
    const proctorName = getProctorName(absence.committee_number, absence.date);
    const headName = getRandomUserByRole('CONTROL_MANAGER');
    const dayName = getArabicDayName(absence.date);

    return (
      <div className="official-page-container">
        <div className="official-a4-page relative flex flex-col border-[1.5pt] border-slate-900 p-4 pt-2">
          <OfficialHeader />
          <div className="text-center mb-8">
            <p className="text-[7pt] font-black text-slate-500 mb-1">النموذج الموحد رقم: 31</p>
            <h2 className="text-[10pt] font-black mb-1 border-b-2 border-slate-900 inline-block px-8">تعهد تأخر طالب عن اختبار</h2>
          </div>
          <div className="p-8 border-[1pt] border-slate-900 bg-slate-50 leading-relaxed text-[8pt] mb-10 text-right">
             <p className="mb-4">
               أقر أنا الطالب / <span className="font-black px-4 border-b border-slate-400">{absence.student_name}</span>
             </p>
             <p className="mb-4">
               المقيد في الصف: <span className="font-black px-2">{student?.grade || '---'}</span> 
               فصل: <span className="font-black px-2">{student?.section || '---'}</span>
             </p>
             <p>
               بأنني قد تأخرت عن موعد بدء اختبار اليوم <span className="font-black">{dayName}</span> الموافق <span className="font-black tabular-nums">{new Date(absence.date).toLocaleDateString('ar-SA')}</span>، 
               وأتعهد بالالتزام بالحضور المبكر في الأيام القادمة، وفي حالة تكرار ذلك أتحمل كافة الإجراءات النظامية المتبعة.
             </p>
             
             <div className="flex justify-end mt-12">
                <div className="text-center min-w-[200px] space-y-4">
                  <p className="font-black text-[9pt]">توقيع الطالب المقر بما فيه</p>
                  <p className="text-slate-300">.........................</p>
                </div>
             </div>
          </div>

          <div className="mt-auto grid grid-cols-2 gap-10 px-6 pb-6 text-[8pt]">
             <div className="text-center space-y-12">
                <p className="font-black underline underline-offset-4 text-[10pt]">مراقب اللجنة</p>
                <div className="space-y-1">
                   <p className="font-black">{proctorName}</p>
                   <p className="font-bold">.........................</p>
                </div>
             </div>
             <div className="text-center space-y-12">
                <p className="font-black underline underline-offset-4 text-[10pt]">رئيس الكنترول</p>
                <div className="space-y-1">
                  <p className="font-black">{headName}</p>
                  <p className="font-bold">.........................</p>
                </div>
             </div>
          </div>
        </div>
      </div>
    );
  };

  const CumulativeReport = () => {
    return (
      <div className="official-page-container">
        <div className="official-a4-page relative flex flex-col border-[1.5pt] border-slate-900 p-4 pt-2">
          <table className="w-full border-collapse">
            <thead className="table-header-group">
              <tr>
                <th colSpan={6} className="p-0 font-normal border-none">
                  <OfficialHeader />
                  <div className="text-center mb-6">
                    <h2 className="text-[10pt] font-black mb-1 border-b-2 border-slate-900 inline-block px-8 uppercase">
                      سجل الحالات التراكمي الشامل
                    </h2>
                    <p className="text-[8pt] font-black text-slate-500 uppercase tracking-widest">
                      بيان {cumulativeType === 'ABSENT' ? 'الغياب التراكمي' : 'التأخر التراكمي'} للمرحلة
                    </p>
                  </div>
                </th>
              </tr>
              <tr className="bg-slate-50 font-black h-10 text-[8pt]">
                <th className="border border-slate-900 p-2 w-8 text-center">م</th>
                <th className="border border-slate-900 p-2 text-right px-3">الاسم الكامل للطالب</th>
                <th className="border border-slate-900 p-2 w-24 text-center">الصف</th>
                <th className="border border-slate-900 p-2 w-16 text-center">الفصل</th>
                <th className="border border-slate-900 p-2 w-20 text-center">عدد المرات</th>
                <th className="border border-slate-900 p-2 w-32 text-center">اللجان</th>
              </tr>
            </thead>
            <tbody>
              {cumulativeData.map((item, i) => (
                <tr key={item.student.id} className="h-10 text-[8pt]">
                  <td className="border border-slate-900 p-2 font-bold tabular-nums text-center">{i+1}</td>
                  <td className="border border-slate-900 p-2 text-right font-black px-3">{item.student.name}</td>
                  <td className="border border-slate-900 p-2 text-center">{item.student.grade}</td>
                  <td className="border border-slate-900 p-2 text-center">{item.student.section}</td>
                  <td className="border border-slate-900 p-2 font-black text-center">{item.count}</td>
                  <td className="border border-slate-900 p-2 text-[7pt] font-mono text-center">
                    {Array.from(item.committees).join(', ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-10 animate-fade-in text-right pb-24 relative">
      
      {/* Print Portal */}
      {isPrinting && createPortal(
         <div id="print-portal-container">
            <style>{`
               @media print {
                  @page { 
                    size: A4 portrait; 
                    margin: 2mm 5mm; 
                  }
                  body { background: white; margin: 0; padding: 0; }
                  #root, .app-root, header, .no-print { display: none !important; } 
                  #print-portal-container { display: block !important; position: absolute; top: 0; left: 0; width: 100%; z-index: 9999; }
                  .official-page-container { 
                    width: 210mm; 
                    min-height: 297mm; 
                    page-break-after: always; 
                    padding: 0mm; 
                    box-sizing: border-box; 
                    display: flex; 
                    justify-content: center; 
                    background: white; 
                  }
                  .official-a4-page { 
                    width: 100%; 
                    min-height: 100%; 
                    background: white; 
                    color: black; 
                  }
                  .table-header-group { display: table-header-group !important; }
                  table { border-collapse: collapse; width: 100%; }
               }
            `}</style>
            {printType === 'INDIVIDUAL' ? (
              printQueue.map((item, idx) => (
                <div key={idx}>
                   {item.type === 'ABSENT' ? <AbsenceForm absence={item} /> : <DelayForm absence={item} />}
                </div>
              ))
            ) : <CumulativeReport />}
         </div>,
         document.body
      )}

      {/* UI Control Area */}
      <div className="no-print space-y-10">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 border-b-8 border-blue-600 pb-10">
          <div>
            <h2 className="text-5xl font-black text-slate-900 tracking-tighter uppercase">مركز استخراج النماذج</h2>
            <p className="text-slate-400 font-bold mt-2 text-lg italic">استخراج النماذج المعتمدة (8pt/10pt) - بيانات محدثة لحظياً</p>
          </div>
          <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded-[2.5rem] shadow-xl border">
            <div className="relative">
              <Calendar className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input type="date" className="pr-14 pl-6 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-lg outline-none focus:border-blue-600 transition-all" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
            </div>
            <button 
              disabled={dailyAbsences.length === 0} 
              onClick={() => triggerPrint(dailyAbsences, 'INDIVIDUAL')} 
              className="bg-blue-600 text-white px-10 py-5 rounded-2xl font-black text-lg shadow-2xl hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center gap-4 active:scale-95"
            >
              <Printer size={28} /> طباعة الكل ({dailyAbsences.length})
            </button>
          </div>
        </div>

        {/* التراكمي */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-slate-950 p-10 rounded-[3.5rem] text-white shadow-2xl relative overflow-hidden group border-b-[15px] border-red-600">
              <h3 className="text-2xl font-black mb-4 flex items-center gap-3"><ListChecks className="text-red-500" /> سجل الغياب التراكمي</h3>
              <p className="text-sm text-slate-400 mb-8 italic">استخراج كشف شامل بجميع غيابات المرحلة مرتبة تنازلياً.</p>
              <button onClick={() => { setCumulativeType('ABSENT'); triggerPrint([], 'CUMULATIVE'); }} className="w-full py-5 bg-white text-slate-900 rounded-2xl font-black text-lg hover:bg-red-600 hover:text-white transition-all">استخراج الكشف</button>
          </div>
          <div className="bg-slate-950 p-10 rounded-[3.5rem] text-white shadow-2xl relative overflow-hidden group border-b-[15px] border-amber-500">
              <h3 className="text-2xl font-black mb-4 flex items-center gap-3"><History className="text-amber-500" /> سجل التأخر التراكمي</h3>
              <p className="text-sm text-slate-400 mb-8 italic">استخراج كشف تعهدات التأخر لطلاب اللجان.</p>
              <button onClick={() => { setCumulativeType('LATE'); triggerPrint([], 'CUMULATIVE'); }} className="w-full py-5 bg-white text-slate-900 rounded-2xl font-black text-lg hover:bg-amber-600 hover:text-white transition-all">استخراج الكشف</button>
          </div>
        </div>

        {/* قسم الغيابات اليومية للطباعة المفردة */}
        <div className="space-y-8">
           <div className="flex items-center gap-5 border-b pb-6 mt-16">
              <div className="p-4 bg-blue-600 text-white rounded-2xl shadow-xl"><Printer size={28} /></div>
              <h3 className="text-3xl font-black text-slate-900 uppercase">النماذج الفردية (حسب التاريخ المختار)</h3>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {dailyAbsences.length === 0 ? (
                <div className="col-span-full py-24 text-center bg-white rounded-[4rem] border-4 border-dashed border-slate-100 flex flex-col items-center gap-6">
                  <AlertTriangle size={64} className="text-slate-200" />
                  <p className="text-2xl font-black text-slate-300 italic">لا توجد حالات غياب أو تأخر في هذا التاريخ.</p>
                </div>
              ) : (
                dailyAbsences.map(a => (
                  <div key={a.id} className="bg-white p-8 rounded-[3rem] border-2 border-slate-50 shadow-xl flex flex-col justify-between group hover:border-blue-600 transition-all duration-300">
                    <div className="space-y-6">
                        <div className="flex justify-between items-center">
                          <span className={`px-4 py-1.5 rounded-xl font-black text-[10px] uppercase shadow-sm ${a.type === 'ABSENT' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                              {a.type === 'ABSENT' ? 'نموذج 36 - غياب' : 'نموذج 31 - تأخر'}
                          </span>
                          <div className="bg-slate-900 text-white px-4 py-1.5 rounded-xl text-xs font-black tabular-nums">لجنة {a.committee_number}</div>
                        </div>
                        <h4 className="text-2xl font-black text-slate-900 leading-tight h-14 overflow-hidden">{a.student_name}</h4>
                    </div>
                    <button onClick={() => triggerPrint([a], 'INDIVIDUAL')} className="mt-8 w-full py-4 bg-slate-100 text-slate-600 hover:bg-slate-900 hover:text-white rounded-2xl font-black text-sm transition-all flex justify-center items-center gap-4 active:scale-95">
                        <Printer size={20}/> استعراض وطباعة
                    </button>
                  </div>
                ))
              )}
           </div>
        </div>
      </div>
    </div>
  );
};

export default AdminOfficialForms;
