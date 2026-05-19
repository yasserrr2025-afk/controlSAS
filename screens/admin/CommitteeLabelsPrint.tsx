import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Student } from '../../types';
import { APP_CONFIG } from '../../constants';
import { Printer, QrCode, LayoutGrid, Info, Tag, Loader2, Filter, Users, UserSquare2 } from 'lucide-react';

interface Props {
  students: Student[];
}

const CommitteeLabelsPrint: React.FC<Props> = ({ students }) => {
  const [isPrinting, setIsPrinting] = useState(false);
  const [printMode, setPrintMode] = useState<'STUDENT' | 'COMMITTEE'>('STUDENT');
  const [selectedCommittee, setSelectedCommittee] = useState<string>('ALL');

  const uniqueCommittees = useMemo(() => {
    return Array.from(new Set(students.map(s => s.committee_number)))
      .filter(Boolean)
      .sort((a, b) => Number(a) - Number(b));
  }, [students]);

  // Group students by committee, then chunk into pages of 21
  const pagesByCommittee = useMemo(() => {
    const pages: { committee: string, students: Student[] }[] = [];
    
    const committeesToProcess = selectedCommittee === 'ALL' 
      ? uniqueCommittees 
      : [selectedCommittee];

    for (const comNum of committeesToProcess) {
      const comStudents = students
        .filter(s => s.committee_number === comNum)
        .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
        
      for (let i = 0; i < comStudents.length; i += 21) {
        pages.push({
          committee: comNum,
          students: comStudents.slice(i, i + 21)
        });
      }
    }
    return pages;
  }, [students, uniqueCommittees, selectedCommittee]);

  // Chunk uniqueCommittees into pages of 21 for the COMMITTEE mode
  const committeePages = useMemo(() => {
    const pages = [];
    const committeesToProcess = selectedCommittee === 'ALL' 
      ? uniqueCommittees 
      : [selectedCommittee];
      
    for (let i = 0; i < committeesToProcess.length; i += 21) {
      pages.push(committeesToProcess.slice(i, i + 21));
    }
    return pages;
  }, [uniqueCommittees, selectedCommittee]);

  const handlePrint = async () => {
    setIsPrinting(true);

    // جمع روابط QR التي سيتم طباعتها حسب وضع الطباعة
    const imageUrlsToPreload: string[] = [];
    if (printMode === 'STUDENT') {
       pagesByCommittee.forEach(page => {
         page.students.forEach(student => {
           const data = student.parent_phone || student.national_id;
           imageUrlsToPreload.push(`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${data}&color=000000`);
         });
       });
    } else {
       committeePages.forEach(page => {
         page.forEach(comNum => {
           imageUrlsToPreload.push(`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${comNum}&color=000000`);
         });
       });
    }

    // الانتظار حتى يتم تحميل جميع الصور في المتصفح في الخلفية
    await Promise.allSettled(
      imageUrlsToPreload.map(url => {
        return new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => resolve(); // في حال فشل صورة لا نوقف البقية
          img.src = url;
        });
      })
    );

    // إعطاء فرصة قصيرة للـ DOM ليحدث نفسه بعد عرضها ثم الطباعة
    setTimeout(() => {
      window.print();
    }, 500);
  };

  useEffect(() => {
    const handleAfterPrint = () => {
      setIsPrinting(false);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  const totalLabels = printMode === 'STUDENT' 
    ? pagesByCommittee.reduce((sum, p) => sum + p.students.length, 0)
    : (selectedCommittee === 'ALL' ? uniqueCommittees.length : 1);

  const neededPages = printMode === 'STUDENT' ? pagesByCommittee.length : committeePages.length;

  return (
    <div className="space-y-10 animate-fade-in text-right pb-24 max-w-7xl mx-auto px-4 md:px-0">
      
      {/* طباعة بوابة الاستكرات */}
      {isPrinting && createPortal(
        <div id="labels-print-portal">
          <style>{`
            @media screen {
              #labels-print-portal { display: none !important; }
            }
            @media print {
              @page {
                size: A4 portrait;
                margin: 0;
              }
              body { 
                background: white !important; 
                margin: 0; 
                padding: 0; 
                -webkit-print-color-adjust: exact;
                color: black !important;
              }
              #root, #app-root, header, nav, .no-print { 
                display: none !important; 
              }
              #labels-print-portal { 
                display: block !important; 
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                direction: rtl;
              }
              .gs-1021-sheet {
                width: 210mm;
                height: 297mm;
                display: grid;
                grid-template-columns: repeat(3, 70mm);
                grid-template-rows: repeat(7, 42.4mm);
                page-break-after: always;
                box-sizing: border-box;
                padding: 0;
                margin: 0;
              }
              .gs-1021-label {
                width: 70mm;
                height: 42.4mm;
                box-sizing: border-box;
                border: 0.2pt solid #000;
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden;
                position: relative;
                background: white;
              }
              /* تصميم ملصق الطالب */
              .student-label-content {
                width: 100%;
                height: 100%;
                display: flex;
                align-items: stretch;
                padding: 2mm;
                gap: 2mm;
              }
              .student-label-details {
                flex: 1;
                display: flex;
                flex-direction: column;
                border-left: 1pt solid #000;
                padding-left: 2mm;
              }
              /* تصميم ملصق اللجنة (المراقب) */
              .committee-label-content {
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 0 5mm;
              }
              
              .text-black-bold {
                color: #000 !important;
                font-weight: 900 !important;
              }
            }
          `}</style>
          
          <div className="print-only-labels" dir="rtl">
            {printMode === 'STUDENT' ? (
              // طباعة ملصقات الطلاب
              pagesByCommittee.map((page, pageIdx) => (
                <div key={pageIdx} className="gs-1021-sheet">
                  {page.students.map((student) => (
                    <div key={student.id} className="gs-1021-label">
                      <div className="student-label-content">
                        {/* بيانات الطالب */}
                        <div className="student-label-details flex flex-col justify-between" style={{ flex: 1 }}>
                          <div className="flex justify-between items-start">
                             <img 
                                src={APP_CONFIG.LOGO_URL} 
                                alt="Logo" 
                                className="w-6 h-6 object-contain" 
                             />
                             <div className="text-left text-[8pt] font-black text-black-bold text-combine-upright">
                                لجنة: {student.committee_number}
                             </div>
                          </div>
                          <div className="text-[10pt] font-black text-black-bold text-center leading-tight mt-1 line-clamp-2" style={{ maxHeight: '24pt', overflow: 'hidden' }}>
                             {student.name}
                          </div>
                          <div className="flex justify-between items-end mt-1 border-t border-black pt-1">
                             <div className="text-[8pt] font-bold text-black-bold">{student.grade} - {student.section}</div>
                             <div className="text-[9pt] font-black text-black-bold" style={{ direction: 'ltr' }}>رقم الجلوس: {student.seating_number || student.national_id}</div>
                          </div>
                        </div>
                        
                        {/* كود QR برقم جوال ولي الأمر */}
                        <div className="w-[18mm] flex flex-col items-center justify-center shrink-0">
                          <img 
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${student.parent_phone || student.national_id}&color=000000`} 
                            alt="QR" 
                            className="w-full h-auto aspect-square"
                            style={{ imageRendering: 'pixelated' }}
                            crossOrigin="anonymous"
                          />
                          <span className="text-[5pt] font-bold mt-0.5" style={{letterSpacing: '-0.5px'}}>مُوَثَّق</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            ) : (
              // طباعة أرقام اللجان للمراقبين لمسحها وبدء المباشرة
              committeePages.map((pageCommittees, pageIdx) => (
                <div key={pageIdx} className="gs-1021-sheet">
                  {pageCommittees.map((comNum) => (
                    <div key={comNum} className="gs-1021-label">
                      <div className="committee-label-content">
                         {/* كود QR عالي التباين */}
                        <div className="w-[40%] flex items-center justify-center">
                          <img 
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${comNum}&color=000000`} 
                            alt="QR" 
                            className="w-20 h-20"
                            style={{ imageRendering: 'pixelated' }}
                            crossOrigin="anonymous"
                          />
                        </div>

                        {/* النص والشعار */}
                        <div className="flex-1 flex flex-col items-center justify-center gap-1 border-r border-black h-[85%] relative">
                          <img 
                            src={APP_CONFIG.LOGO_URL} 
                            alt="Logo" 
                            className="w-10 h-10 object-contain mb-1" 
                          />
                          <span className="text-[8pt] font-black text-black-bold uppercase tracking-widest leading-none mb-1">لجنة رقم</span>
                          <span className="text-[32pt] font-black text-black-bold leading-none tabular-nums" style={{ color: '#000' }}>{comNum}</span>
                          <span className="text-[6pt] font-black text-black-bold mt-2 uppercase tracking-tighter text-center">كنترول الاختبارات الذكي</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>,
        document.body
      )}

      {/* واجهة التحكم في المتصفح */}
      <div className="bg-slate-900 p-8 md:p-12 rounded-[3rem] shadow-2xl text-white no-print relative overflow-visible border-b-[8px] border-blue-600 z-10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 blur-[100px] rounded-full pointer-events-none"></div>
        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-10">
          <div className="space-y-6 w-full lg:w-auto flex-1">
             <div className="flex items-center gap-6">
                <div className="bg-blue-600 p-4 rounded-[1.5rem] shadow-xl text-white"><QrCode size={32} /></div>
                <div>
                   <h3 className="text-3xl font-black tracking-tighter">منظومة طباعة الملصقات (GS-1021)</h3>
                   <p className="text-slate-400 font-bold mt-1 text-sm bg-slate-800/50 inline-block px-3 py-1 rounded-full">تصميم أسود لضمان الوضوح العالي</p>
                </div>
             </div>
             
             {/* أزرار التبديل بين اللجان والطلاب */}
             <div className="flex bg-slate-800 p-2 rounded-2xl max-w-lg shadow-inner">
                <button 
                  onClick={() => setPrintMode('STUDENT')}
                  className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-xl font-black transition-all ${printMode === 'STUDENT' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                >
                  <Users size={20} /> أرقام جلوس الطلاب
                </button>
                <button 
                  onClick={() => setPrintMode('COMMITTEE')}
                  className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-xl font-black transition-all ${printMode === 'COMMITTEE' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                >
                  <UserSquare2 size={20} /> كود تفعيل اللجان (للمراقب)
                </button>
             </div>

             {/* فلاتر الطباعة المتقدمة */}
             <div className="bg-white/5 p-5 border border-white/10 rounded-2xl flex flex-col md:flex-row gap-5 items-center w-full max-w-2xl backdrop-blur-sm self-stretch lg:self-auto">
                <div className="flex items-center gap-3 shrink-0">
                   <Filter size={20} className="text-blue-400" />
                   <span className="font-black text-sm">تحديد اللجان:</span>
                </div>
                
                <div className="relative flex-1 w-full">
                  <select
                     value={selectedCommittee}
                     onChange={(e) => setSelectedCommittee(e.target.value)}
                     className="w-full appearance-none bg-slate-800 border-2 border-slate-700 text-white py-3 px-5 rounded-xl font-bold outline-none focus:border-blue-500 transition-all cursor-pointer shadow-inner pr-10"
                  >
                     <option value="ALL">الكل - طباعة كل اللجان</option>
                     {uniqueCommittees.map(com => (
                        <option key={com} value={com}>لجنة رقم {com} ({students.filter(s => s.committee_number === com).length} طالب)</option>
                     ))}
                  </select>
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    ▼
                  </div>
                </div>
             </div>

             <div className="flex flex-wrap items-center gap-4 bg-slate-800/80 p-4 rounded-2xl border border-white/5 w-fit">
                <div className="flex items-center gap-2">
                   <Info size={18} className="text-blue-400" />
                   <span className="text-xs font-black text-slate-300">طريقة العرض: </span>
                </div>
                <span className="text-xs font-bold bg-white/10 px-3 py-1 rounded-md">
                   {selectedCommittee === 'ALL' ? 'الكل متفرق' : `لجنة ${selectedCommittee} فقط`}
                </span>
                <div className="h-4 w-px bg-white/20"></div>
                <span className="text-xs font-bold bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-md">
                   العدد الإجمالي: {totalLabels} {printMode === 'STUDENT' ? 'طالب' : 'لجنة'}
                </span>
                <div className="h-4 w-px bg-white/20"></div>
                <span className="text-xs font-bold bg-amber-500/20 text-amber-300 px-3 py-1 rounded-md">
                   الأوراق المطلوبة: {neededPages} ورقة
                </span>
             </div>
          </div>
          
          <button 
            onClick={handlePrint}
            disabled={isPrinting || totalLabels === 0}
            className="w-full lg:w-auto bg-blue-600 text-white px-10 py-6 rounded-[2rem] font-black text-2xl shadow-2xl shadow-blue-600/30 hover:bg-blue-500 hover:scale-105 hover:-translate-y-1 transition-all flex items-center justify-center gap-5 active:scale-95 shrink-0 disabled:opacity-50 disabled:hover:scale-100 disabled:hover:translate-y-0"
          >
            {isPrinting ? <Loader2 size={32} className="animate-spin" /> : <Printer size={32} />} 
            {isPrinting ? 'جاري التحضير...' : 'اِطْبَع الملصقات الآن'}
          </button>
        </div>
      </div>

      {/* المعاينة في المتصفح */}
      <div className="no-print space-y-8 mt-12">
         <div className="flex items-center gap-4 border-b-2 border-slate-100 pb-4 pr-4">
            <LayoutGrid className="text-blue-600" size={28} />
            <h4 className="text-2xl font-black text-slate-800 tracking-tight">معاينة تخطيط الأوراق ({printMode === 'STUDENT' ? 'الطلاب' : 'المراقبين'})</h4>
         </div>
         
         {neededPages === 0 ? (
           <div className="bg-white p-24 rounded-[3rem] border-4 border-dashed border-slate-200 text-center flex flex-col items-center gap-6 shadow-inner">
              <div className="bg-slate-100 p-6 rounded-full"><Tag size={64} className="text-slate-300" /></div>
              <p className="text-2xl font-black text-slate-400 italic">لا توجد ملصقات لعرضها استناداً للفلتر الحالي</p>
           </div>
         ) : (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-10">
             {printMode === 'STUDENT' ? (
               // معاينة ملصقات الطلاب
               pagesByCommittee.map((page, pageIdx) => (
                 <div key={pageIdx} className="bg-white p-6 rounded-[2rem] shadow-xl border border-slate-200 flex flex-col items-center gap-6 hover:shadow-2xl transition-all group">
                    <div className="flex justify-between w-full items-center border-b pb-3 border-dashed border-slate-200">
                       <span className="text-[11px] font-black text-slate-500 bg-slate-100 px-3 py-1 rounded-lg">صفحة رقم #{pageIdx + 1}</span>
                       <span className="text-[13px] font-black text-blue-600 bg-blue-50 px-4 py-1.5 rounded-xl border border-blue-100 shadow-sm">لجنة: {page.committee}</span>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-1 border border-slate-300 bg-slate-50 p-2 shadow-inner w-full max-w-[400px] aspect-[210/297] relative rounded-md overflow-hidden" dir="rtl">
                       {page.students.map((student) => (
                          <div key={student.id} className="bg-white border border-slate-300 flex flex-col items-center justify-center p-1 shadow-sm aspect-[70/42.4] hover:border-blue-500 transition-all relative group/label">
                             <div className="w-full h-full flex items-center overflow-hidden gap-1 pl-1">
                                <div className="flex-1 flex flex-col justify-between h-full border-l border-slate-200 py-[2px] pr-1">
                                   <div className="text-[5px] font-black text-slate-400">لجنة: {student.committee_number}</div>
                                   <div className="text-[6px] font-black leading-tight text-slate-800 line-clamp-2">{student.name}</div>
                                   <div className="text-[5px] font-black text-slate-500">{student.seating_number || '-'}</div>
                                </div>
                                <div className="w-[8px] sm:w-[12px] h-[8px] sm:h-[12px] bg-slate-200 shrink-0 flex items-center justify-center">
                                  <QrCode size={8} className="text-slate-400 opacity-50" />
                                </div>
                             </div>
                             
                             <div className="absolute z-50 bg-slate-900 text-white p-3 rounded-xl shadow-2xl text-xs -top-12 left-1/2 -translate-x-1/2 w-48 opacity-0 group-hover/label:opacity-100 pointer-events-none transition-all flex flex-col gap-1 text-right border border-slate-700">
                               <div className="font-black text-sm text-blue-300 border-b border-slate-700 pb-1 mb-1">{student.name}</div>
                               <div className="flex justify-between"><span className="text-slate-400">لجنة:</span> <span className="font-black">{student.committee_number}</span></div>
                               <div className="flex justify-between"><span className="text-slate-400">جوال الولي:</span> <span className="font-black" dir="ltr">{student.parent_phone || 'غير مسجل'}</span></div>
                             </div>
                          </div>
                       ))}
                       {Array.from({ length: 21 - page.students.length }).map((_, i) => (
                         <div key={`empty-${i}`} className="border border-slate-200/50 bg-slate-100/30 flex items-center justify-center shadow-sm aspect-[70/42.4]">
                           <span className="text-[3px] text-slate-300 uppercase filter blur-[0.5px]">فارغ</span>
                         </div>
                       ))}
                    </div>
                 </div>
               ))
             ) : (
               // معاينة ملصقات اللجان 
               committeePages.map((pageCommittees, pageIdx) => (
                 <div key={pageIdx} className="bg-white p-6 rounded-[2rem] shadow-xl border border-slate-200 flex flex-col items-center gap-6 hover:shadow-2xl transition-all group">
                    <div className="flex justify-between w-full items-center border-b pb-3 border-dashed border-slate-200">
                       <span className="text-[11px] font-black text-slate-500 bg-slate-100 px-3 py-1 rounded-lg">صفحة رقم #{pageIdx + 1}</span>
                       <span className="text-[13px] font-black text-blue-600 bg-blue-50 px-4 py-1.5 rounded-xl border border-blue-100 shadow-sm">ملصقات المراقبين</span>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-1 border border-slate-300 bg-slate-50 p-2 shadow-inner w-full max-w-[400px] aspect-[210/297] rounded-md overflow-hidden" dir="rtl">
                       {pageCommittees.map((comNum) => (
                          <div key={comNum} className="bg-white border border-slate-300 flex flex-col items-center justify-center p-2 shadow-sm aspect-[70/42.4]">
                             <img src={APP_CONFIG.LOGO_URL} alt="Logo" className="w-5 h-5 object-contain mb-1" />
                             <span className="text-[6px] font-black text-slate-600">لجنة رقم</span>
                             <span className="text-xl font-black text-slate-900 leading-none">{comNum}</span>
                          </div>
                       ))}
                       {Array.from({ length: 21 - pageCommittees.length }).map((_, i) => (
                         <div key={`empty-com-${i}`} className="border border-slate-200/50 bg-slate-100/30 flex items-center justify-center shadow-sm aspect-[70/42.4]">
                           <span className="text-[3px] text-slate-300 uppercase filter blur-[0.5px]">فارغ</span>
                         </div>
                       ))}
                    </div>
                 </div>
               ))
             )}
           </div>
         )}
      </div>

      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.4s ease-out; }
        .text-combine-upright { text-combine-upright: all; }
      `}</style>
    </div>
  );
};

export default CommitteeLabelsPrint;
