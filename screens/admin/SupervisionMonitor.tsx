
import React, { useState, useMemo } from 'react';
import { Supervision, User, Student, Absence, DeliveryLog } from '../../types';
import OfficialHeader from '../../components/OfficialHeader';
import { Printer, Calendar, BookOpen, CheckCircle2, Clock, FileText } from 'lucide-react';

interface Props {
  supervisions: Supervision[];
  users: User[];
  students: Student[];
  absences: Absence[];
  deliveryLogs: DeliveryLog[];
}

const AdminSupervisionMonitor: React.FC<Props> = ({ supervisions, users, students, absences, deliveryLogs }) => {
  const [reportInfo, setReportInfo] = useState({ 
    date: new Date().toISOString().split('T')[0], 
    subject: '' 
  });

  // جلب اسم رئيس الكنترول ديناميكياً من قائمة المستخدمين
  const controlManagerName = useMemo(() => {
    const manager = users.find(u => u.role === 'CONTROL_MANAGER');
    return manager?.full_name || '....................................';
  }, [users]);

  const detailedStats = useMemo(() => {
    const committeeNums = Array.from(new Set(students.map(s => s.committee_number))).filter(Boolean).sort((a,b)=>Number(a)-Number(b));
    
    return committeeNums.flatMap(num => {
      const committeeStudents = students.filter(s => s.committee_number === num);
      const gradesInCommittee = Array.from(new Set(committeeStudents.map(s => s.grade)));
      const sv = supervisions.find(s => s.committee_number === num);
      const proctor = users.find(u => u.id === sv?.teacher_id);

      return gradesInCommittee.map(grade => {
        const gradeStudents = committeeStudents.filter(s => s.grade === grade);
        const gradeAbsences = absences.filter(a => a.date.startsWith(reportInfo.date) && a.committee_number === num && a.type === 'ABSENT' && gradeStudents.some(s => s.national_id === a.student_id));
        const gradeLates = absences.filter(a => a.date.startsWith(reportInfo.date) && a.committee_number === num && a.type === 'LATE' && gradeStudents.some(s => s.national_id === a.student_id));
        
        const delivery = deliveryLogs.find(l => 
          l.time.startsWith(reportInfo.date) && 
          l.committee_number === num && 
          l.status === 'CONFIRMED' && 
          (l.grade === grade || l.grade.includes(grade))
        );
        
        return {
          committee_number: num,
          proctor_name: proctor?.full_name || '................',
          grade,
          total: gradeStudents.length,
          present: gradeStudents.length - gradeAbsences.length,
          absent: gradeAbsences.length,
          late: gradeLates.length,
          receiver: delivery?.teacher_name || '................',
          isDone: !!delivery
        };
      });
    });
  }, [supervisions, users, students, absences, deliveryLogs, reportInfo.date]);

  return (
    <div className="space-y-10 animate-fade-in text-right pb-32">
      {/* واجهة التحكم بالإعدادات قبل الطباعة */}
      <div className="bg-slate-900 p-10 md:p-14 rounded-[4rem] shadow-2xl text-white no-print relative overflow-hidden border-b-[10px] border-blue-600">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 blur-[100px] rounded-full"></div>
        <div className="relative z-10 space-y-8">
           <div className="flex items-center gap-6">
              <div className="bg-blue-600 p-4 rounded-3xl shadow-xl"><Printer size={32} /></div>
              <h3 className="text-3xl font-black">إعداد مسير المراقبة والاستلام الميداني</h3>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                 <label className="text-xs font-black text-slate-500 uppercase tracking-widest mr-3">تاريخ التقرير</label>
                 <div className="relative">
                    <Calendar className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input type="date" className="w-full pr-14 p-5 bg-white/10 border border-white/10 rounded-2xl font-black outline-none focus:border-blue-500 transition-all" value={reportInfo.date} onChange={e => setReportInfo({...reportInfo, date: e.target.value})} />
                 </div>
              </div>
              <div className="space-y-3">
                 <label className="text-xs font-black text-slate-500 uppercase tracking-widest mr-3">المادة الدراسية</label>
                 <div className="relative">
                    <BookOpen className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input type="text" placeholder="اكتب اسم المادة..." className="w-full pr-14 p-5 bg-white/10 border border-white/10 rounded-2xl font-black outline-none focus:border-blue-600 transition-all" value={reportInfo.subject} onChange={e => setReportInfo({...reportInfo, subject: e.target.value})} />
                 </div>
              </div>
           </div>
           <button onClick={() => window.print()} className="w-full bg-blue-600 text-white py-6 rounded-[2rem] font-black text-2xl shadow-2xl hover:bg-blue-50 transition-all flex items-center justify-center gap-5 active:scale-95">
             <Printer size={32} /> استخراج المسير المعتمد (A4)
           </button>
        </div>
      </div>

      {/* المعاينة التفاعلية في المتصفح */}
      <div className="bg-white rounded-[3.5rem] shadow-2xl border-2 border-slate-50 overflow-hidden no-print">
         <div className="p-8 border-b bg-slate-50/50 flex justify-between items-center">
            <h4 className="text-xl font-black text-slate-800">بيانات المسير التفصيلية - معاينة ذكية</h4>
         </div>
         <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-right border-collapse min-w-[1000px]">
               <thead className="bg-slate-50 border-b text-[10px] font-black text-slate-400 uppercase tracking-widest">
                 <tr>
                   <th className="p-6">م</th>
                   <th className="p-6">اللجنة</th>
                   <th className="p-6 text-right">المراقب</th>
                   <th className="p-6 text-center">الصف</th>
                   <th className="p-6 text-center">الإحصاء</th>
                   <th className="p-6 text-center">المستلم</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                  {detailedStats.map((stat, idx) => (
                    <tr key={idx} className={`hover:bg-blue-50/30 transition-colors ${stat.isDone ? 'bg-emerald-50/10' : ''}`}>
                       <td className="p-6 text-slate-300 text-xs">{idx + 1}</td>
                       <td className="p-6 font-black text-slate-900">لجنة {stat.committee_number}</td>
                       <td className="p-6 text-right text-sm">{stat.proctor_name}</td>
                       <td className="p-6 text-center"><span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-lg text-[10px] border border-blue-100">{stat.grade}</span></td>
                       <td className="p-6 text-center tabular-nums space-x-2 space-x-reverse text-xs">
                          <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">ح:{stat.present}</span>
                          <span className="text-red-600 bg-red-50 px-2 py-1 rounded-md">غ:{stat.absent}</span>
                       </td>
                       <td className="p-6 text-center">
                          {stat.isDone ? (
                            <span className="text-emerald-600 text-[10px] font-black">{stat.receiver}</span>
                          ) : (
                            <span className="text-slate-300 text-[10px]">بانتظار الاستلام</span>
                          )}
                       </td>
                    </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>

      {/* الهيكل الخاص بالطباعة - مصمم للتكرار التلقائي وبدون هوامش علوية كبيرة */}
      <div className="print-only">
        <style>{`
          @media print {
            @page { 
              size: A4 portrait; 
              margin: 3mm; 
            }
            body { 
              background: white !important; 
              -webkit-print-color-adjust: exact; 
              margin: 0; 
              padding: 0; 
            }
            .no-print { display: none !important; }
            
            .print-table {
              width: 100%;
              border-collapse: collapse;
              table-layout: fixed;
            }
            /* تكرار الهيدر في كل صفحة */
            .print-table thead {
              display: table-header-group;
            }
            .print-table tfoot {
              display: table-footer-group;
            }
            .cell-border {
              border: 1pt solid black !important;
              padding: 3pt 2pt;
              font-size: 7.5pt; /* تصغير الخط لمحتوى الجدول */
              word-wrap: break-word;
              text-align: center;
            }
            .header-content {
              padding-top: 0mm;
            }
            .stat-cell {
               font-size: 7.5pt;
               font-weight: 900;
               font-family: 'Tajawal', sans-serif;
            }
          }
        `}</style>

        <table className="print-table w-full border-collapse" style={{ tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th colSpan={10} className="p-0 font-normal border-none text-right">
                <div className="header-content w-full mb-3">
                  <OfficialHeader />
                  <div className="text-center mt-2">
                    <h2 className="text-[12pt] font-black border-b-[2pt] border-black pb-1 inline-block px-10 leading-none">مسير المراقبة ورصد حضور واستلام المظاريف</h2>
                    <div className="flex justify-center gap-10 text-[9pt] font-black mt-2 text-black">
                      <span>اليوم/التاريخ: {new Intl.DateTimeFormat('ar-SA', {weekday:'long', day:'numeric', month:'long', year:'numeric'}).format(new Date(reportInfo.date))}</span>
                      <span>المادة: <span className="border-b border-black px-6">{reportInfo.subject || '................'}</span></span>
                    </div>
                  </div>
                </div>
              </th>
            </tr>
            <tr className="bg-slate-50 font-black text-[7.5pt]">
              <th className="cell-border" style={{ width: '8mm' }}>م</th>
              <th className="cell-border" style={{ width: '13mm' }}>اللجنة</th>
              <th className="cell-border text-right px-2" style={{ width: '45mm' }}>اسم المعلم (المراقب)</th>
              <th className="cell-border" style={{ width: '28mm' }}>الصف</th>
              <th className="cell-border" style={{ width: '11mm' }}>حاضر</th>
              <th className="cell-border" style={{ width: '11mm' }}>غائب</th>
              <th className="cell-border" style={{ width: '11mm' }}>متأخر</th>
              <th className="cell-border text-right px-2" style={{ width: '33mm' }}>المستلم (الكنترول)</th>
              <th className="cell-border" style={{ width: '22mm' }}>توقيع المستلم</th>
              <th className="cell-border" style={{ width: '22mm' }}>توقيع المراقب</th>
            </tr>
          </thead>
          
          <tbody>
            {detailedStats.map((stat, i) => (
              <tr key={i} className="h-[28pt]">
                <td className="cell-border tabular-nums" style={{ width: '8mm' }}>{i + 1}</td>
                <td className="cell-border font-black tabular-nums text-[9pt]" style={{ width: '13mm' }}>{stat.committee_number}</td>
                <td className="cell-border text-right font-black px-2 leading-tight" style={{ width: '45mm' }}>{stat.proctor_name}</td>
                <td className="cell-border font-bold" style={{ width: '28mm', fontSize: '7pt' }}>{stat.grade}</td>
                <td className="cell-border stat-cell text-emerald-700" style={{ width: '11mm' }}>{stat.present || '0'}</td>
                <td className="cell-border stat-cell text-red-700" style={{ width: '11mm' }}>{stat.absent || '0'}</td>
                <td className="cell-border stat-cell" style={{ width: '11mm' }}>{stat.late || '0'}</td>
                <td className="cell-border text-right px-2 font-bold" style={{ width: '33mm' }}>{stat.isDone ? stat.receiver : ''}</td>
                <td className="cell-border p-0" style={{ width: '22mm', textAlign: 'center', height: '18pt' }}>
                   {stat.isDone && stat.receiver && (
                     <div className="flex justify-center items-center w-full h-full">
                       <img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent('SIG|RECEIVER|' + stat.committee_number)}&color=000000`} alt="QR" className="w-[6mm] h-[6mm]" crossOrigin="anonymous" style={{ imageRendering: 'pixelated' }} />
                     </div>
                   )}
                </td>
                <td className="cell-border p-0" style={{ width: '22mm', textAlign: 'center', height: '18pt' }}>
                   {stat.isDone && stat.proctor_name && (
                     <div className="flex justify-center items-center w-full h-full">
                       <img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent('SIG|PROCTOR|' + stat.committee_number)}&color=000000`} alt="QR" className="w-[6mm] h-[6mm]" crossOrigin="anonymous" style={{ imageRendering: 'pixelated' }} />
                     </div>
                   )}
                </td>
              </tr>
            ))}
          </tbody>

          <tfoot>
            <tr>
              <td colSpan={10} className="pt-8 border-none">
                <div className="grid grid-cols-2 text-[10pt] font-black text-center gap-24 px-20">
                   <div className="space-y-8">
                      <p className="underline underline-offset-[4pt]">رئيس الكنترول</p>
                      <div className="space-y-1">
                        <p className="text-slate-900">{controlManagerName}</p>
                        <p className="text-slate-300">....................................</p>
                      </div>
                   </div>
                   <div className="space-y-8">
                      <p className="underline underline-offset-[4pt]">مدير المدرسة</p>
                      <div className="space-y-1">
                        <p className="text-slate-300">....................................</p>
                        <p className="text-slate-300">....................................</p>
                      </div>
                   </div>
                </div>
                <div className="text-left mt-6 text-[6pt] text-slate-300 italic px-4 border-t pt-1">
                   نظام كنترول الاختبارات المطور | استخراج: {new Date().toLocaleString('ar-SA')}
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default AdminSupervisionMonitor;
