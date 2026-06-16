import React, { useState, useEffect } from 'react';
import { Users, Save, RefreshCw, LayoutGrid, Settings2, ShieldCheck, Info, Loader2, ArrowLeftRight, Printer, Database, FileText } from 'lucide-react';
import { db } from '../../supabase';
import { Student } from '../../types';
import { APP_CONFIG } from '../../constants';

const PrintHeader: React.FC<{ date: string }> = ({ date }) => (
  <div className="w-full border-b-4 border-double border-slate-900 pb-3 mb-4">
    <div className="grid grid-cols-3 items-center gap-2">
      <div className="text-[10pt] font-black text-right leading-relaxed space-y-0.5">
        <p>المملكة العربية السعودية</p>
        <p>وزارة التعليم</p>
        <p>إدارة التعليم بمحافظة جدة</p>
        <p>مدرسة عماد الدين زنكي المتوسطة</p>
      </div>
      <div className="flex flex-col items-center justify-center">
        <img src={APP_CONFIG.LOGO_URL} alt="شعار" className="w-16 h-16 object-contain" />
        <p className="text-[8pt] text-slate-500 font-black mt-1 text-center">نظام كنترول الاختبارات</p>
      </div>
      <div className="text-[10pt] font-bold text-left leading-relaxed space-y-0.5">
        <p>التاريخ: <span className="font-black tabular-nums">{new Date(date).toLocaleDateString('ar-SA')}</span></p>
        <p>اليوم: <span className="font-black">{new Intl.DateTimeFormat('ar-SA', { weekday: 'long' }).format(new Date(date))}</span></p>
        <p>العام الدراسي: <span className="font-black">1446 / 1447</span></p>
      </div>
    </div>
  </div>
);

interface CommitteePreview {
  number: string;
  students: Student[];
  columns: Student[][];
  stats: Record<string, number>;
}

interface Props {
  systemConfig?: { academic_year?: string; [key: string]: any };
}

const SeatingPlanner: React.FC<Props> = ({ systemConfig }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [committeesCount, setCommitteesCount] = useState<number>(20);
  const [gradeCounts, setGradeCounts] = useState<Record<string, number>>({});
  const [randomize, setRandomize] = useState<boolean>(true);
  const [committees, setCommittees] = useState<CommitteePreview[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'generator' | 'current'>('generator');
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    try {
      setIsLoading(true);
      const data = await db.students.getAll();
      setStudents(data);
      
      const counts: Record<string, number> = {};
      data.forEach(s => {
        counts[s.grade] = (counts[s.grade] || 0) + 1;
      });
      setGradeCounts(counts);
    } catch (err) {
      alert('فشل في جلب بيانات الطلاب');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGradeCountChange = (grade: string, count: number) => {
    setGradeCounts(prev => ({...prev, [grade]: count}));
  };

  const distributeIntoColumns = (committeeStudents: Student[], isExisting: boolean) => {
    const numCols = 6;
    const finalCols: Student[][] = Array.from({ length: numCols }, () => []);
    
    const studentsByGrade: Record<string, Student[]> = {};
    committeeStudents.forEach(s => {
       if (!studentsByGrade[s.grade]) studentsByGrade[s.grade] = [];
       studentsByGrade[s.grade].push(s);
    });

    const grades = Object.keys(studentsByGrade);
    let fallbackCounter = 0;

    grades.forEach(g => {
       let targetCols = [-1, -1];
       if (g.includes('أول') || g.includes('1')) targetCols = [0, 3];
       else if (g.includes('ثاني') || g.includes('2')) targetCols = [1, 4];
       else if (g.includes('ثالث') || g.includes('3')) targetCols = [2, 5];
       else if (g.includes('رابع') || g.includes('4')) targetCols = [0, 3];
       else if (g.includes('خامس') || g.includes('5')) targetCols = [1, 4];
       else if (g.includes('سادس') || g.includes('6')) targetCols = [2, 5];
       else {
           const pairs = [[0,3], [1,4], [2,5]];
           targetCols = pairs[fallbackCounter % 3];
           fallbackCounter++;
       }

       const studentsForG = studentsByGrade[g];
       if (isExisting) {
           studentsForG.sort((a,b) => Number(a.seating_number) - Number(b.seating_number));
       }

       const total = studentsForG.length;
       const firstCount = Math.floor(total / 2); // الأقل دائماً في المسار الأول
       const secondCount = Math.ceil(total / 2); // الأكثر في المسار الثاني

       finalCols[targetCols[0]].push(...studentsForG.slice(0, firstCount));
       finalCols[targetCols[1]].push(...studentsForG.slice(firstCount, total));
    });

    if (!isExisting) {
       let seatNum = 1;
       finalCols.forEach(col => {
          col.forEach(s => {
             s.seating_number = seatNum.toString();
             seatNum++;
          });
       });
    } else {
       finalCols.forEach(col => {
          col.sort((a,b) => Number(a.seating_number) - Number(b.seating_number));
       });
    }

    return finalCols;
  };

  const generateCroquisSeating = () => {
    if (students.length === 0) return alert('لا يوجد طلاب لتوزيعهم');
    if (committeesCount < 1) return alert('يجب تحديد لجنة واحدة على الأقل');

    const availableGrades = Object.keys(gradeCounts).sort();
    const committeeAllocations: Record<string, Student[]>[] = Array.from({length: committeesCount}, () => ({}));
    const unassignedByGrade: Record<string, Student[]> = {};
    
    availableGrades.forEach(g => {
       const studentsOfGrade = students.filter(s => s.grade === g);
       if (randomize) studentsOfGrade.sort(() => Math.random() - 0.5);
       else studentsOfGrade.sort((a,b) => a.name.localeCompare(b.name, 'ar'));
       unassignedByGrade[g] = studentsOfGrade.slice(0, gradeCounts[g] || 0);
    });

    availableGrades.forEach(g => {
       const list = unassignedByGrade[g];
       let cIdx = 0;
       while (list.length > 0) {
          const s = list.shift()!;
          if (!committeeAllocations[cIdx][g]) committeeAllocations[cIdx][g] = [];
          committeeAllocations[cIdx][g].push(s);
          cIdx = (cIdx + 1) % committeesCount;
       }
    });

    const newCommittees: CommitteePreview[] = [];
    
    committeeAllocations.forEach((allocation, index) => {
        const gradesInCommittee = Object.keys(allocation).filter(g => allocation[g].length > 0);
        let committeeStudents: Student[] = [];
        gradesInCommittee.forEach(g => {
            committeeStudents.push(...allocation[g]);
        });
        
        committeeStudents.forEach(s => s.committee_number = (index + 1).toString());

        const finalCols = distributeIntoColumns(committeeStudents, false);

        const stats: Record<string, number> = {};
        committeeStudents.forEach(s => {
           stats[s.grade] = (stats[s.grade] || 0) + 1;
        });
        
        const updatedStudents = finalCols.flat();

        newCommittees.push({
            number: (index + 1).toString(),
            students: updatedStudents,
            columns: finalCols,
            stats
        });
    });

    setCommittees(newCommittees);
    alert('تم بناء الكروكي وتوزيع اللجان بنجاح!');
  };

  const loadExistingCroquis = () => {
    const assignedStudents = students.filter(s => s.committee_number);
    if (assignedStudents.length === 0) {
      alert('لا يوجد طلاب موزعين في قاعدة البيانات لعرضهم.');
      return;
    }

    const committeesMap: Record<string, Student[]> = {};
    assignedStudents.forEach(s => {
      if (!committeesMap[s.committee_number!]) committeesMap[s.committee_number!] = [];
      committeesMap[s.committee_number!].push(s);
    });

    const existingCommittees: CommitteePreview[] = [];

    Object.keys(committeesMap).sort((a,b) => Number(a) - Number(b)).forEach(comNum => {
       const comStudents = committeesMap[comNum];
       const finalCols = distributeIntoColumns(comStudents, true);

       const stats: Record<string, number> = {};
       comStudents.forEach(s => {
          stats[s.grade] = (stats[s.grade] || 0) + 1;
       });

       existingCommittees.push({
         number: comNum,
         students: comStudents,
         columns: finalCols,
         stats
       });
    });

    setCommittees(existingCommittees);
  };

  useEffect(() => {
     if (activeTab === 'current' || activeTab === 'report') {
       loadExistingCroquis();
     } else {
       setCommittees([]); 
     }
  }, [activeTab]);

  const handleSave = async () => {
    if (committees.length === 0) return;
    try {
      setIsSaving(true);
      const updatedStudents = committees.flatMap(c => c.students);
      await db.students.upsert(updatedStudents);
      alert('تم اعتماد الكروكي وتحديث قاعدة البيانات بنجاح!');
      setStudents(updatedStudents);
    } catch (err) {
      alert('حدث خطأ أثناء الحفظ');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrintAll = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 500);
  };

  const getStatusColor = (grade: string) => {
    const colors = ['bg-blue-100 text-blue-800 border-blue-200', 'bg-emerald-100 text-emerald-800 border-emerald-200', 'bg-purple-100 text-purple-800 border-purple-200', 'bg-orange-100 text-orange-800 border-orange-200', 'bg-rose-100 text-rose-800 border-rose-200'];
    let hash = 0;
    for (let i = 0; i < grade.length; i++) hash = grade.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  const totalSelectedStudents = Object.values(gradeCounts).reduce((a,b) => a + (b||0), 0);

  const getQrData = (com: CommitteePreview) => {
     return encodeURIComponent(`${window.location.origin}/?public_committee=${com.number}`);
  };

  return (
    <div className="space-y-8 print:space-y-0 print:m-0 print:p-0 animate-fade-in text-right pb-20 print:pb-0">
      
      {/* --- Print Styles --- */}
      <style>{`
        @media print {
          @page { size: A4 ${activeTab === 'report' ? 'portrait' : 'landscape'}; margin: 0 !important; }
          html, body, #app-root, main { 
            margin: 0 !important; 
            padding: 0 !important; 
            background: white !important;
            width: 100% !important;
            height: 100% !important;
            max-width: none !important;
          }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box !important; }
          .no-print, header, aside, .sidebar { display: none !important; }
          .print-only { display: block !important; }
          .page-break { 
            page-break-after: always; 
            page-break-inside: avoid;
            width: 100vw !important; 
            height: 100vh !important; 
            padding: ${activeTab === 'report' ? '10mm' : '5mm'} !important;
            margin: 0 !important;
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }
          /* Prevent the last blank page */
          .page-break:last-of-type {
            page-break-after: auto !important;
          }
        }
      `}</style>

      {activeTab === 'report' ? (
         <div className="hidden print-only print:block w-full print:m-0 print:p-0" dir="rtl">
            {committees.map((com) => {
               const sortedStudents = [...com.students].sort((a,b) => {
                  if (a.grade !== b.grade) return a.grade.localeCompare(b.grade, 'ar');
                  return a.name.localeCompare(b.name, 'ar');
               });
               const len = com.students.length;
               // حساب ذكي جداً للارتفاع بحيث لا يتجاوز الورقة أبداً
               const fontSize = len > 36 ? '10px' : len > 30 ? '11px' : len > 24 ? '12px' : '14px';
               const rowHeight = len > 36 ? '18px' : len > 30 ? '22px' : len > 24 ? '26px' : '32px';
               const hMargin = len > 24 ? 'mb-2' : 'mb-6';
               
               return (
               <div key={com.number} className="page-break bg-white relative">
                  <PrintHeader date={new Date().toISOString().split('T')[0]} />
                  <div className={`text-center ${hMargin}`}>
                     <h2 className="text-xl font-black underline underline-offset-8">بيان بأسماء طلاب لجنة رقم ({com.number})</h2>
                     <p className="text-sm font-bold text-slate-500 mt-2">إجمالي الطلاب: {com.students.length}</p>
                  </div>
                  <table className="w-full border-collapse border border-black text-center font-bold" style={{ fontSize }}>
                     <thead>
                        <tr className="bg-slate-100 font-black" style={{ height: rowHeight }}>
                           <th className="border border-black px-1 py-0 w-12">م</th>
                           <th className="border border-black px-1 py-0">رقم الجلوس</th>
                           <th className="border border-black px-2 py-0 text-right">اسم الطالب</th>
                           <th className="border border-black px-1 py-0">الصف</th>
                           <th className="border border-black px-1 py-0">الفصل</th>
                           <th className="border border-black px-1 py-0 w-32">توقيع الطالب</th>
                        </tr>
                     </thead>
                     <tbody>
                        {sortedStudents.map((s, idx) => (
                           <tr key={s.id} style={{ height: rowHeight }}>
                              <td className="border border-black px-1 py-0">{idx + 1}</td>
                              <td className="border border-black px-1 py-0">{s.seating_number || s.national_id}</td>
                              <td className="border border-black px-2 py-0 text-right font-black truncate">{s.name}</td>
                              <td className="border border-black px-1 py-0">{s.grade}</td>
                              <td className="border border-black px-1 py-0">{s.section}</td>
                              <td className="border border-black px-1 py-0"></td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
               );
            })}
         </div>
      ) : (
         <div className="hidden print-only print:block w-full print:m-0 print:p-0" dir="rtl">
        {committees.map((com) => (
           <div key={com.number} className="page-break bg-white relative">
              
              {/* Header: QR, Door and Title */}
              <div className="flex justify-between items-center mb-4">
                 <div className="flex items-center gap-4">
                    {/* Door Icon */}
                    <div className="flex flex-col items-center justify-center border-4 border-slate-800 rounded-xl bg-slate-50 w-20 h-20 shadow-sm relative overflow-hidden">
                       <div className="text-4xl filter drop-shadow-sm absolute top-0.5">🚪</div>
                       <div className="font-black text-[12px] bg-slate-800 text-white w-full text-center absolute bottom-0 py-0.5">الباب</div>
                    </div>
                    
                    <img 
                       src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${getQrData(com)}&color=000000`}
                       alt="QR"
                       className="w-20 h-20 border-2 border-black p-1 rounded-xl shadow-sm"
                       crossOrigin="anonymous"
                    />
                    <div>
                       <h1 className="text-4xl font-black text-black">لجنة رقم {com.number}</h1>
                       <p className="text-lg font-bold mt-1 text-slate-700 bg-slate-100 px-3 py-1 rounded-full inline-block border border-slate-300">كروكي مقاعد الطلاب</p>
                    </div>
                 </div>

                 {/* Stats Table (Horizontal) */}
                 <div className="border-4 border-black rounded-xl overflow-hidden shadow-sm">
                   <table className="border-collapse text-center">
                      <thead>
                         <tr className="bg-slate-800 text-white">
                            {Object.keys(com.stats).map(grade => (
                               <th key={grade} className="border-b-2 border-black border-l-2 border-slate-600 px-3 py-1.5 font-black text-base whitespace-nowrap">{grade}</th>
                            ))}
                            <th className="border-b-2 border-black px-3 py-1.5 font-black text-base bg-slate-900 whitespace-nowrap">الإجمالي</th>
                         </tr>
                      </thead>
                      <tbody>
                         <tr className="bg-white">
                            {Object.values(com.stats).map((count, i) => (
                               <td key={i} className="border-l-2 border-black px-3 py-1.5 font-black text-xl">{count}</td>
                            ))}
                            <td className="px-3 py-1.5 font-black text-2xl bg-slate-100 text-blue-900">{com.students.length}</td>
                         </tr>
                      </tbody>
                   </table>
                 </div>
              </div>

              {/* Croquis Layout */}
              <div className="flex-1 flex flex-col relative w-full mt-2">
                 
                 <div className="flex justify-between gap-3 mt-4 h-full w-full">
                   {com.columns.map((col, cIdx) => (
                      <div key={cIdx} className="flex-1 flex flex-col border-2 border-black rounded-2xl p-2 bg-slate-50 min-w-0">
                         <div className="bg-slate-800 text-white text-center font-black py-1.5 rounded-lg mb-2 text-sm shadow-sm">
                            مسار {cIdx + 1}
                         </div>
                         <div className="flex flex-col gap-2 flex-1">
                            {col.map((student) => (
                               <div key={student.id} className="bg-white border-2 border-slate-400 p-2 rounded-xl flex flex-col items-center justify-center text-center relative shadow-sm flex-1 min-h-[40px]">
                                  <div className="absolute top-1 right-2 text-xs font-black text-slate-500">{student.seating_number}</div>
                                  <div className="font-black text-[11px] leading-snug break-words w-full px-1">{student.name}</div>
                                  <div className="text-[9px] font-bold text-slate-500 mt-0.5 whitespace-nowrap">{student.grade} - {student.section}</div>
                               </div>
                            ))}
                            {/* Empty Seats Filler */}
                            {Array.from({ length: Math.max(0, 5 - col.length) }).map((_, i) => (
                               <div key={`emp-${i}`} className="border-2 border-dashed border-slate-300 bg-white/40 rounded-xl flex items-center justify-center flex-1 min-h-[40px] text-slate-300 font-bold text-xs">
                                  مقعد فارغ
                               </div>
                            ))}
                         </div>
                      </div>
                   ))}
                 </div>
              </div>
           </div>
        ))}
         </div>
      )}
      {/* --- End Print --- */}

      <div className="no-print">
        <div className="bg-gradient-to-br from-[#020817] via-[#0a1628] to-[#050d1a] p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden border border-blue-900/30 mb-8">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <LayoutGrid size={200} />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-blue-500/20 border border-blue-400/30 text-blue-200 text-sm font-bold mb-6">
                <ShieldCheck size={16} />
                كروكي لجان الاختبارات الدقيق (6 مسارات)
              </div>
              <h2 className="text-3xl md:text-4xl font-black mb-4 tracking-tight">إدارة الكروكي وطباعة اللجان 🪑</h2>
            </div>
            
            <div className="flex bg-white/10 p-2 rounded-2xl border border-white/10 flex-wrap gap-2">
               <button 
                 onClick={() => setActiveTab('generator')}
                 className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-black transition-all ${activeTab === 'generator' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}
               >
                 <Settings2 size={18} /> الموزع الآلي (توليد)
               </button>
               <button 
                 onClick={() => setActiveTab('current')}
                 className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-black transition-all ${activeTab === 'current' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}
               >
                 <Database size={18} /> كروكي اللجان الحالية
               </button>
               <button 
                 onClick={() => setActiveTab('report')}
                 className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-black transition-all ${activeTab === 'report' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}
               >
                 <FileText size={18} /> بيان اللجان الحالية
               </button>
            </div>
          </div>
        </div>

        {activeTab === 'generator' && (
          <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-8 mb-8 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6 bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                   <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                     <Settings2 className="text-blue-500" />
                     إعدادات التوزيع (6 مسارات)
                   </h3>
                   
                   <div className="space-y-3">
                     <label className="text-sm font-bold text-slate-700">العدد الإجمالي للجان المطلوبة</label>
                     <input 
                       type="number" min="1" max="100" value={committeesCount}
                       onChange={(e) => setCommitteesCount(parseInt(e.target.value) || 1)}
                       className="w-full bg-white border border-slate-200 rounded-xl px-5 py-3.5 font-black text-lg outline-none focus:border-blue-500 transition-all text-left dir-ltr shadow-sm"
                     />
                     <p className="text-xs text-slate-500 font-bold">متوسط الطلاب لكل لجنة: {Math.round(totalSelectedStudents / (committeesCount || 1))} طالب</p>
                   </div>

                   <div className="flex items-center gap-3 pt-4 border-t border-slate-200">
                     <label className="relative inline-flex items-center cursor-pointer">
                       <input type="checkbox" className="sr-only peer" checked={randomize} onChange={e => setRandomize(e.target.checked)} />
                       <div className="w-11 h-6 bg-slate-300 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                       <span className="ms-3 text-sm font-bold text-slate-700">خلط الأسماء عشوائياً (Shuffle)</span>
                     </label>
                   </div>
                </div>

                <div className="space-y-4">
                   <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                     <Users className="text-blue-500" />
                     تخصيص أعداد الطلاب
                   </h3>
                   <div className="space-y-3">
                     {Object.entries(gradeCounts).map(([grade, count]) => (
                        <div key={grade} className="flex items-center justify-between bg-white border border-slate-200 p-3 rounded-xl shadow-sm">
                           <span className="font-bold text-sm text-slate-700">{grade}</span>
                           <div className="flex items-center gap-2">
                             <input 
                                type="number" value={count}
                                onChange={(e) => handleGradeCountChange(grade, parseInt(e.target.value) || 0)}
                                className="w-20 text-center bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 font-black text-sm outline-none focus:border-blue-500"
                             />
                             <span className="text-xs text-slate-400">طالب</span>
                           </div>
                        </div>
                     ))}
                     <div className="flex justify-between items-center p-3 bg-blue-50 text-blue-800 rounded-xl font-black border border-blue-100">
                        <span>الإجمالي:</span>
                        <span className="text-lg">{totalSelectedStudents}</span>
                     </div>
                   </div>
                </div>
            </div>

            <div className="flex gap-4 pt-4">
                <button 
                  onClick={generateCroquisSeating}
                  disabled={isLoading}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-blue-500 text-white py-4 rounded-xl font-black text-base shadow-lg shadow-blue-600/20 hover:shadow-blue-600/40 hover:-translate-y-1 transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
                  توليد كروكي اللجان المتطابق
                </button>
                
                {committees.length > 0 && (
                  <button 
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex-1 bg-emerald-600 text-white py-4 rounded-xl font-black text-base shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 hover:-translate-y-1 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                    حفظ التوزيع في قاعدة البيانات
                  </button>
                )}
            </div>
          </div>
        )}

        {/* عرض الكروكي والطباعة */}
        {committees.length > 0 && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200">
                <div className="flex items-center gap-3 text-slate-800">
                 <LayoutGrid className="text-blue-600" />
                 <h3 className="text-2xl font-black">{activeTab === 'report' ? `معاينة بيان اللجان (${committees.length} لجان)` : `معاينة الكروكي (${committees.length} لجان)`}</h3>
               </div>
               
               <button 
                 onClick={handlePrintAll}
                 disabled={isPrinting}
                 className="w-full md:w-auto bg-slate-900 text-white px-8 py-3.5 rounded-xl font-black text-base shadow-lg shadow-slate-900/20 hover:bg-slate-800 hover:-translate-y-1 transition-all flex items-center justify-center gap-2"
               >
                 <Printer size={20} /> {activeTab === 'report' ? 'طباعة بيان اللجان (PDF / ورق طولي)' : 'طباعة جميع اللجان (PDF / ورق بالعرض)'}
               </button>
            </div>
            
            {activeTab === 'report' ? (
              <div className="grid grid-cols-1 gap-8">
                 {committees.map((com) => {
                   const sortedStudents = [...com.students].sort((a,b) => {
                      if (a.grade !== b.grade) return a.grade.localeCompare(b.grade, 'ar');
                      return a.name.localeCompare(b.name, 'ar');
                   });
                   return (
                   <div key={com.number} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                      <div className="text-center mb-6">
                         <h2 className="text-2xl font-black text-slate-800">بيان بأسماء طلاب لجنة رقم ({com.number})</h2>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse border border-slate-300 text-center text-sm">
                           <thead>
                              <tr className="bg-slate-100">
                                 <th className="border border-slate-300 p-3 w-12">م</th>
                                 <th className="border border-slate-300 p-3">رقم الجلوس</th>
                                 <th className="border border-slate-300 p-3 text-right">اسم الطالب</th>
                                 <th className="border border-slate-300 p-3">الصف</th>
                                 <th className="border border-slate-300 p-3">الفصل</th>
                              </tr>
                           </thead>
                           <tbody>
                              {sortedStudents.map((s, idx) => (
                                 <tr key={s.id} className="hover:bg-slate-50">
                                    <td className="border border-slate-300 p-2 font-bold">{idx + 1}</td>
                                    <td className="border border-slate-300 p-2 font-bold">{s.seating_number || s.national_id}</td>
                                    <td className="border border-slate-300 p-2 text-right font-black">{s.name}</td>
                                    <td className="border border-slate-300 p-2">{s.grade}</td>
                                    <td className="border border-slate-300 p-2">{s.section}</td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                      </div>
                   </div>
                   );
                 })}
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {committees.map((committee) => (
                <div key={committee.number} className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-md hover:shadow-xl transition-all duration-300">
                  <div className="bg-slate-50 p-5 border-b border-slate-100 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-blue-600 text-white rounded-[1.2rem] flex items-center justify-center font-black text-2xl shadow-lg shadow-blue-600/20">
                        {committee.number}
                      </div>
                      <div>
                        <h4 className="font-black text-xl text-slate-800">لجنة رقم {committee.number}</h4>
                        <p className="text-slate-500 text-sm font-bold flex items-center gap-1">
                          {committee.students.length} طالب <ArrowLeftRight size={14} className="mx-1" /> 6 مسارات
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-6 overflow-x-auto relative">
                    <div className="absolute top-2 right-4 text-3xl opacity-60 select-none hidden md:block filter drop-shadow-sm" title="باب اللجنة">🚪</div>
                    <div className="flex justify-between gap-3 min-w-max md:pr-12 pt-4">
                      {committee.columns.map((col, cIdx) => (
                          <div key={cIdx} className="flex flex-col gap-2 w-24 shrink-0">
                             <div className="text-center font-black text-xs bg-slate-100 text-slate-600 py-2 rounded-xl mb-1 border border-slate-200 shadow-sm">
                               مسار {cIdx + 1}
                             </div>
                             {col.map(student => (
                                 <div 
                                   key={student.id} 
                                   className={`rounded-2xl border p-2 text-center relative group cursor-help transition-all hover:-translate-y-1 hover:shadow-md ${getStatusColor(student.grade)}`}
                                 >
                                    <div className="absolute top-1 right-2 text-[10px] opacity-60 font-black">{student.seating_number}</div>
                                    <div className="mt-2 text-[11px] font-black truncate px-1">{student.grade.split(' ')[0]}</div>
                                    <div className="text-[9px] font-bold mt-0.5 bg-white/50 py-0.5 px-1.5 rounded-full inline-block shadow-sm">{student.section}</div>
                                    
                                    <div className="absolute opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity bottom-full mb-2 right-1/2 translate-x-1/2 bg-slate-900 text-white text-xs p-2.5 rounded-xl whitespace-nowrap z-20 shadow-xl font-bold">
                                       {student.name}
                                    </div>
                                 </div>
                             ))}
                          </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SeatingPlanner;
