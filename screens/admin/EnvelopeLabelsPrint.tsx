import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Printer, Package } from 'lucide-react';
import { APP_CONFIG } from '../../constants';

const ALLOWED_SUBJECTS = ['الرياضيات', 'اللغة العربية', 'العلوم', 'اللغة الإنجليزية'];

interface Props {
  students: any[];
}

const EnvelopeLabelsPrint: React.FC<Props> = ({ students }) => {
  const [isPrinting, setIsPrinting] = useState(false);

  const uniqueGrades = useMemo(() => {
    return Array.from(new Set(students.map(s => s.grade))).filter(Boolean);
  }, [students]);

  // Generate a label for each Subject x Grade
  const labels = useMemo(() => {
    const arr = [];
    for (const grade of uniqueGrades) {
      for (const subject of ALLOWED_SUBJECTS) {
        arr.push({ grade, subject });
      }
    }
    return arr;
  }, [uniqueGrades]);

  const chunkedLabels = useMemo(() => {
    const pages = [];
    for (let i = 0; i < labels.length; i += 21) {
      pages.push(labels.slice(i, i + 21));
    }
    return pages;
  }, [labels]);

  const handlePrint = async () => {
    setIsPrinting(true);

    const imageUrlsToPreload: string[] = [];
    labels.forEach(lbl => {
      const data = `ENV|${lbl.subject}|${lbl.grade}`;
      imageUrlsToPreload.push(`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(data)}&color=000000`);
    });

    await Promise.allSettled(
      imageUrlsToPreload.map(url => {
        return new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => resolve(); 
          img.src = url;
        });
      })
    );

    setTimeout(() => window.print(), 500);
  };

  useEffect(() => {
    const handleAfterPrint = () => setIsPrinting(false);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  return (
    <div className="space-y-8 animate-fade-in text-right">
       <div className="bg-slate-950 p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden border-b-[8px] border-blue-600 no-print">
         <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 blur-[80px] rounded-full"></div>
         <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
            <div>
              <h2 className="text-4xl font-black mb-2 flex items-center gap-4">
                 <Package className="text-blue-400" size={40} />
                 ملصقات مظاريف الأسئلة
              </h2>
              <p className="text-slate-400 font-bold max-w-lg">
                يتم إصدار ملصقات مخصصة لمظاريف الأسئلة لتسهيل عملية مسحها عبر النظام وتوثيق فتحها.
              </p>
            </div>
            <button 
              onClick={handlePrint}
              disabled={isPrinting || labels.length === 0}
              className={`px-8 py-5 rounded-[2rem] font-black text-xl flex items-center gap-4 transition-all shadow-xl active:scale-95 whitespace-nowrap ${isPrinting || labels.length === 0 ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-500 hover:-translate-y-1 hover:shadow-blue-600/20'}`}
            >
              {isPrinting ? <><svg className="animate-spin -ml-1 mr-3 h-6 w-6 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> جاري التجهيز...</> : <><Printer size={28}/> طباعة {labels.length} ملصق</>}
            </button>
         </div>
       </div>

       {/* طباعة ملصقات مظاريف الأسئلة (مقاس GS-1021 بمعدل 21 ملصق في الصفحة) */}
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
            {chunkedLabels.map((pageLabels, pageIndex) => (
              <div key={`page-${pageIndex}`} className="gs-1021-sheet bg-white">
                {pageLabels.map((lbl, idx) => {
                  const data = `ENV|${lbl.subject}|${lbl.grade}`;
                  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data)}&color=000000`;
                  
                  return (
                    <div key={idx} className="gs-1021-label">
                      <div className="committee-label-content">
                         {/* كود QR عالي التباين */}
                        <div className="w-[40%] flex items-center justify-center">
                          <img 
                            src={qrUrl} 
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
                          <span className="text-[8pt] font-black text-black-bold uppercase tracking-widest leading-none mb-1">مظروف أسئلة</span>
                          <span className="text-[12pt] font-black text-black-bold leading-none tabular-nums text-center" style={{ color: '#000' }}>{lbl.subject}</span>
                          <span className="text-[8pt] font-black text-black-bold mt-2 uppercase tracking-tighter text-center">{lbl.grade}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                {/* Fill remaining cells if less than 21 on the last page */}
                {Array.from({ length: 21 - pageLabels.length }).map((_, emptyIdx) => (
                  <div key={`empty-${pageIndex}-${emptyIdx}`} className="gs-1021-label" />
                ))}
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default EnvelopeLabelsPrint;
