
import React, { useState, useMemo } from 'react';
import { Supervision, User, Student, Absence, DeliveryLog, ControlRequest } from '../../types';
import OfficialHeader from '../../components/OfficialHeader';
import { Printer, Calendar, BookOpen, CheckCircle2, Clock, FileText } from 'lucide-react';
import { findStoredSignature } from '../../services/signatures';

interface Props {
  supervisions: Supervision[];
  users: User[];
  students: Student[];
  absences: Absence[];
  deliveryLogs: DeliveryLog[];
  controlRequests?: ControlRequest[];
}

const AdminSupervisionMonitor: React.FC<Props> = ({ supervisions, users, students, absences, deliveryLogs, controlRequests = [] }) => {
  const getRiyadhDateKey = (value: string | Date) => {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Riyadh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(d);
    const get = (type: string) => parts.find(part => part.type === type)?.value || '';
    return `${get('year')}-${get('month')}-${get('day')}`;
  };

  const matchesReportDate = (value?: string | null) => {
    if (!value) return false;
    const text = String(value);
    return text.startsWith(reportInfo.date) || getRiyadhDateKey(text) === reportInfo.date;
  };

  const [reportInfo, setReportInfo] = useState({ 
    date: getRiyadhDateKey(new Date()), 
    subject: '' 
  });

  // جلب اسم رئيس الكنترول ديناميكياً من قائمة المستخدمين
  const controlManagerName = useMemo(() => {
    const manager = users.find(u => u.role === 'CONTROL_MANAGER');
    return manager?.full_name || '....................................';
  }, [users]);

  const schoolPrincipalName = useMemo(() => {
    const admin = users.find(u => u.role === 'ADMIN');
    return admin?.full_name || '....................................';
  }, [users]);

  const buildVerificationUrl = (type: 'receiver' | 'proctor', stat: any) => {
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set('sv', '1');
    url.searchParams.set('c', String(stat.committee_number));
    url.searchParams.set('g', String(stat.grade));
    url.searchParams.set('d', reportInfo.date);
    url.searchParams.set('t', type === 'receiver' ? 'r' : 'p');
    return url.toString();
  };

  const detailedStats = useMemo(() => {
    const committeeNums = Array.from(new Set(students.map(s => s.committee_number))).filter(Boolean).sort((a,b)=>Number(a)-Number(b));
    
    return committeeNums.flatMap(num => {
      const committeeStudents = students.filter(s => s.committee_number === num);
      const gradesInCommittee = Array.from(new Set(committeeStudents.map(s => s.grade)));
      const sv = supervisions.find(s => s.committee_number === num);
      const proctor = users.find(u => u.id === sv?.teacher_id);

      return gradesInCommittee.map(grade => {
        const gradeStudents = committeeStudents.filter(s => s.grade === grade);
        const gradeAbsences = absences.filter(a => matchesReportDate(a.date) && a.committee_number === num && a.type === 'ABSENT' && gradeStudents.some(s => s.national_id === a.student_id));
        const gradeLates = absences.filter(a => matchesReportDate(a.date) && a.committee_number === num && a.type === 'LATE' && gradeStudents.some(s => s.national_id === a.student_id));
        
        const closeLog = deliveryLogs.find(l => 
          matchesReportDate(l.time) && 
          l.committee_number === num && 
          l.status === 'PENDING' && 
          (l.grade === grade || l.grade.includes(grade))
        );

        const delivery = deliveryLogs.find(l => 
          matchesReportDate(l.time) && 
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
          startTime: sv?.date || '',
          closeTime: closeLog?.time || '',
          receiptTime: delivery?.time || '',
          receiverSignature: findStoredSignature(controlRequests, 'receiver', num, grade)?.signature || '',
          proctorSignature: findStoredSignature(controlRequests, 'proctor', num, grade)?.signature || '',
          isDone: !!delivery
        };
      });
    });
  }, [supervisions, users, students, absences, deliveryLogs, controlRequests, reportInfo.date]);

  return (
    <div className="space-y-10 animate-fade-in text-right pb-32">
      {/* واجهة التحكم بالإعدادات قبل الطباعة */}
      <div className="bg-gradient-to-br from-[#020817] via-[#0a1628] to-[#050d1a] p-10 md:p-14 rounded-[4rem] shadow-2xl text-white no-print relative overflow-hidden border border-blue-900/40 border-b-[10px] border-b-blue-600">
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
                     <input type="date" className="w-full pr-14 p-5 bg-white/10 border border-white/10 rounded-2xl font-black outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30 transition-all" value={reportInfo.date} onChange={e => setReportInfo({...reportInfo, date: e.target.value})} />
                 </div>
              </div>
              <div className="space-y-3">
                 <label className="text-xs font-black text-slate-500 uppercase tracking-widest mr-3">المادة الدراسية</label>
                 <div className="relative">
                    <BookOpen className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                     <input type="text" placeholder="اكتب اسم المادة..." className="w-full pr-14 p-5 bg-white/10 border border-white/10 rounded-2xl font-black outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30 transition-all" value={reportInfo.subject} onChange={e => setReportInfo({...reportInfo, subject: e.target.value})} />
                 </div>
              </div>
           </div>
           <button onClick={() => window.print()} className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white py-6 rounded-[2rem] font-black text-2xl shadow-lg shadow-blue-900/40 hover:from-blue-500 hover:to-blue-400 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-5 active:scale-95">
             <Printer size={32} /> استخراج المسير المعتمد (A4)
           </button>
        </div>
      </div>

      {/* المعاينة التفاعلية في المتصفح */}
      <div className="bg-white rounded-[3.5rem] shadow-2xl border border-slate-100 overflow-hidden no-print">
         <div className="p-8 border-b bg-slate-50/50 flex justify-between items-center">
            <h4 className="text-xl font-black text-slate-800">بيانات المسير التفصيلية - معاينة ذكية</h4>
         </div>
         <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-right border-collapse min-w-[1000px]">
               <thead className="bg-gradient-to-r from-slate-900 to-slate-800 text-white text-[10px] font-black uppercase tracking-widest">
                 <tr>
                    <th className="p-6 text-white/80">م</th>
                    <th className="p-6 text-white/80">اللجنة</th>
                    <th className="p-6 text-right text-white/80">المراقب</th>
                    <th className="p-6 text-center text-white/80">الصف</th>
                    <th className="p-6 text-center text-white/80">الإحصاء</th>
                    <th className="p-6 text-center text-white/80">المستلم</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-100/70 font-bold text-slate-700">
                  {detailedStats.map((stat, idx) => (
                     <tr key={idx} className={`hover:bg-blue-50/30 transition-colors duration-150 ${stat.isDone ? 'bg-emerald-50/20' : ''}`}>
                       <td className="p-6 text-slate-300 text-xs">{idx + 1}</td>
                       <td className="p-6 font-black text-slate-900">لجنة {stat.committee_number}</td>
                       <td className="p-6 text-right text-sm">{stat.proctor_name}</td>
                        <td className="p-6 text-center"><span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[10px] border border-blue-200 font-black">{stat.grade}</span></td>
                       <td className="p-6 text-center tabular-nums space-x-2 space-x-reverse text-xs">
                           <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full border border-emerald-200">ح:{stat.present}</span>
                           <span className="text-red-600 bg-red-50 px-2 py-1 rounded-full border border-red-200">غ:{stat.absent}</span>
                       </td>
                       <td className="p-6 text-center">
                          {stat.isDone ? (
                             <span className="text-emerald-600 text-[10px] font-black bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">{stat.receiver}</span>
                           ) : (
                             <span className="text-slate-400 text-[10px] bg-slate-50 px-2 py-0.5 rounded-full border border-slate-200">بانتظار الاستلام</span>
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
              border: 0.8pt solid #111827 !important;
              padding: 3.5pt 2.5pt;
              font-size: 7.5pt; /* تصغير الخط لمحتوى الجدول */
              word-wrap: break-word;
              text-align: center;
            }
            .print-title {
              font-size: 14pt;
              font-weight: 900;
              border-bottom: 2pt solid #111827;
              padding-bottom: 3pt;
              display: inline-block;
              padding-inline: 18mm;
            }
            .print-meta {
              display: inline-flex;
              gap: 7mm;
              border: 0.8pt solid #111827;
              border-radius: 4pt;
              padding: 3pt 7pt;
              margin-top: 5pt;
              background: #f8fafc;
              font-size: 8.5pt;
              font-weight: 900;
            }
            .print-head-row th {
              background: #e5e7eb !important;
              color: #111827;
              font-size: 7pt;
              line-height: 1.4;
            }
            .print-table tbody tr:nth-child(even) td {
              background: #f8fafc !important;
            }
            .qr-box {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              gap: 1pt;
              height: 100%;
            }
            .qr-box img {
              width: 10.5mm;
              height: 10.5mm;
            }
            .qr-box span {
              font-size: 4.8pt;
              color: #334155;
              font-weight: 900;
              line-height: 1;
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
                    <h2 className="print-title leading-none">مسير المراقبة ورصد حضور واستلام المظاريف</h2>
                    <div className="print-meta text-black">
                      <span>اليوم/التاريخ: {new Intl.DateTimeFormat('ar-SA', {weekday:'long', day:'numeric', month:'long', year:'numeric'}).format(new Date(reportInfo.date))}</span>
                      <span>المادة: <span className="border-b border-black px-6">{reportInfo.subject || '................'}</span></span>
                    </div>
                  </div>
                </div>
              </th>
            </tr>
            <tr className="print-head-row bg-slate-50 font-black text-[7.5pt]">
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
              <tr key={i} className="h-[36pt]">
                <td className="cell-border tabular-nums" style={{ width: '8mm' }}>{i + 1}</td>
                <td className="cell-border font-black tabular-nums text-[9pt]" style={{ width: '13mm' }}>{stat.committee_number}</td>
                <td className="cell-border text-right font-black px-2 leading-tight" style={{ width: '45mm' }}>{stat.proctor_name}</td>
                <td className="cell-border font-bold" style={{ width: '28mm', fontSize: '7pt' }}>{stat.grade}</td>
                <td className="cell-border stat-cell text-emerald-700" style={{ width: '11mm' }}>{stat.present || '0'}</td>
                <td className="cell-border stat-cell text-red-700" style={{ width: '11mm' }}>{stat.absent || '0'}</td>
                <td className="cell-border stat-cell" style={{ width: '11mm' }}>{stat.late || '0'}</td>
                <td className="cell-border text-right px-2 font-bold" style={{ width: '33mm' }}>{stat.isDone ? stat.receiver : ''}</td>
                <td className="cell-border p-0" style={{ width: '22mm', textAlign: 'center', height: '18pt' }}>
                   {stat.receiverSignature && (
                     <img src={stat.receiverSignature} alt="توقيع المستلم" style={{ maxWidth: '20mm', maxHeight: '13mm', objectFit: 'contain' }} />
                   )}
                   {!stat.receiverSignature && stat.isDone && stat.receiver && (
                     <span style={{ fontSize: '6pt', fontWeight: 900, color: '#64748b' }}>محفوظ بدون توقيع</span>
                   )}
                   {!stat.receiverSignature && !stat.isDone && stat.receiver && (
                     <div className="qr-box">
                       <img src={`https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(buildVerificationUrl('receiver', stat))}&color=000000`} alt="QR" crossOrigin="anonymous" style={{ imageRendering: 'pixelated' }} />
                       <span>تحقق</span>
                     </div>
                   )}
                </td>
                <td className="cell-border p-0" style={{ width: '22mm', textAlign: 'center', height: '18pt' }}>
                   {stat.proctorSignature && (
                     <img src={stat.proctorSignature} alt="توقيع المراقب" style={{ maxWidth: '20mm', maxHeight: '13mm', objectFit: 'contain' }} />
                   )}
                   {!stat.proctorSignature && stat.isDone && (
                     <span style={{ fontSize: '6pt', fontWeight: 900, color: '#b45309' }}>بانتظار توقيع المراقب</span>
                   )}
                   {!stat.proctorSignature && !stat.isDone && stat.proctor_name && (
                     <div className="qr-box">
                       <img src={`https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(buildVerificationUrl('proctor', stat))}&color=000000`} alt="QR" crossOrigin="anonymous" style={{ imageRendering: 'pixelated' }} />
                       <span>تحقق</span>
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
                      </div>
                   </div>
                   <div className="space-y-8">
                      <p className="underline underline-offset-[4pt]">مدير المدرسة</p>
                      <div className="space-y-1">
                        <p className="text-slate-900">{schoolPrincipalName}</p>
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
