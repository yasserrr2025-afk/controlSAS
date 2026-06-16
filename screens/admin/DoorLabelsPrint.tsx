import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Student } from '../../types';
import { APP_CONFIG } from '../../constants';

interface Props {
  students: Student[];
}

const DoorLabelsPrint: React.FC<Props> = ({ students }) => {
  const committees = useMemo(() => {
    const nums = Array.from(new Set(students.map(s => s.committee_number)))
      .filter(Boolean)
      .sort((a, b) => Number(a) - Number(b));
    return nums.map(num => {
      const commStudents = students.filter(s => s.committee_number === num);
      const grades = Array.from(new Set(commStudents.map(s => s.grade)));
      const gradeCounts = grades.map(g => ({
        grade: g,
        count: commStudents.filter(s => s.grade === g).length
      }));
      return { num, gradeCounts, count: commStudents.length };
    });
  }, [students]);

  const siteUrl = window.location.origin;

  return (
    <div className="bg-slate-100 min-h-screen p-8 print:p-0 print:bg-white text-right font-['Tajawal']" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-6 no-print">
        <div className="bg-white p-8 rounded-3xl shadow-xl flex justify-between items-center border-b-4 border-blue-600">
          <div>
            <h2 className="text-2xl font-black text-slate-800">طباعة ملصقات أبواب اللجان (بالباركود)</h2>
            <p className="text-slate-500 mt-2 font-bold">كل ملصق سيطبع في صفحة مستقلة A4 للصقه على باب اللجنة.</p>
          </div>
          <button 
            onClick={() => window.print()} 
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-black text-lg shadow-lg hover:shadow-xl transition-all active:scale-95"
          >
            طباعة الملصقات
          </button>
        </div>
      </div>

      <div className="print-only">
        <style>{`
          @media print {
            @page {
              size: A4 landscape;
              margin: 0;
            }
            html, body {
              background: white !important;
              margin: 0 !important;
              padding: 0 !important;
              width: 100%;
              height: 100%;
            }
            body * {
              visibility: hidden;
            }
            #door-labels-print-root, #door-labels-print-root * {
              visibility: visible;
            }
            #door-labels-print-root {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              margin: 0;
              padding: 0;
              background: white;
            }
            .door-label-page {
              width: 297mm;
              height: 210mm;
              page-break-after: always;
              display: flex;
              align-items: stretch;
              padding: 12mm;
              box-sizing: border-box;
              position: relative;
              background: white;
            }
            .door-label-page:last-child {
              page-break-after: auto;
            }
          }
        `}</style>

        {createPortal(
          <div id="door-labels-print-root" dir="rtl" className="font-['Tajawal'] hidden print:block bg-white z-[9999]">
            {committees.map((committee, idx) => {
          const publicUrl = `${siteUrl}?public_committee=${committee.num}`;
          return (
            <div key={idx} className="door-label-page bg-white">
              <div className="w-full flex border-4 border-slate-900 rounded-[3rem] p-10 bg-white shadow-2xl overflow-hidden relative">
                
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/5 blur-[100px] rounded-full pointer-events-none"></div>
                
                <div className="absolute top-6 right-8 left-8 flex justify-between items-start">
                  <div className="space-y-1 text-slate-800">
                    <p className="font-bold text-sm">المملكة العربية السعودية</p>
                    <p className="font-bold text-sm">وزارة التعليم</p>
                    <p className="font-bold text-sm">إدارة التعليم</p>
                  </div>
                  <img src={APP_CONFIG.LOGO_URL} alt="Ministry Logo" className="w-20 h-20 object-contain opacity-90" />
                </div>

                {/* Right Side - Info */}
                <div className="flex-1 flex flex-col justify-center pr-8 pt-20">
                   <div className="mb-6">
                      <h1 className="text-4xl font-black tracking-tighter text-blue-900 mb-2">لجنة اختبار رقم</h1>
                      <div className="text-[10rem] font-black leading-none text-blue-600 tabular-nums drop-shadow-sm">{committee.num}</div>
                   </div>

                   <div className="space-y-6 max-w-xl">
                      <div className="bg-slate-50 border-2 border-slate-100 rounded-3xl overflow-hidden shadow-sm">
                        <table className="w-full text-center">
                          <thead className="bg-slate-100 border-b-2 border-slate-200">
                            <tr>
                              {committee.gradeCounts.map((g, i) => (
                                <th key={i} className="py-3 px-4 text-xl font-black text-slate-700 border-l border-slate-200 last:border-0">{g.grade}</th>
                              ))}
                              <th className="py-3 px-4 text-xl font-black text-white bg-blue-600">الإجمالي</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              {committee.gradeCounts.map((g, i) => (
                                <td key={i} className="py-4 px-4 text-3xl font-black text-slate-900 border-l border-slate-200 last:border-0">{g.count}</td>
                              ))}
                              <td className="py-4 px-4 text-3xl font-black text-white bg-blue-500">{committee.count}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                   </div>
                </div>

                {/* Left Side - QR Code */}
                <div className="w-[35%] flex flex-col items-center justify-center border-r-[3px] border-dashed border-slate-200 pl-8 pr-12 pt-16">
                   <div className="bg-white p-4 rounded-[2.5rem] shadow-[0_0_40px_rgba(0,0,0,0.08)] border-2 border-slate-100 mb-8 w-full max-w-[280px] aspect-square flex items-center justify-center relative">
                     <div className="absolute inset-0 bg-blue-50/50 rounded-[2.5rem] transform rotate-3 scale-105 -z-10"></div>
                     <img 
                       src={`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(publicUrl)}&color=0f172a`} 
                       alt="QR Code" 
                       className="w-full h-full object-contain mix-blend-multiply"
                       crossOrigin="anonymous"
                     />
                   </div>
                   
                   <div className="text-center space-y-3 w-full">
                      <div className="inline-flex items-center justify-center gap-2 bg-slate-900 text-white px-6 py-2 rounded-full mb-2 shadow-lg">
                         <span className="font-bold text-lg">لوحة الإشراف الذكية</span>
                      </div>
                      <h3 className="text-3xl font-black text-slate-800 leading-tight">امسح الباركود</h3>
                      <p className="text-lg font-bold text-slate-500">لمتابعة حالة الحضور والغياب للجنة، ووقت استلام المراقب فورياً.</p>
                   </div>
                </div>

              </div>
            </div>
            );
          })}
          </div>,
          document.body
        )}
      </div>
    </div>
  );
};

export default DoorLabelsPrint;
