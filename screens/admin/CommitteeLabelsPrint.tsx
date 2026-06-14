import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Student } from '../../types';
import { APP_CONFIG } from '../../constants';
import { Printer, QrCode, LayoutGrid, Info, Tag, Loader2, Filter, Users, UserSquare2, Table2 } from 'lucide-react';

interface Props {
  students: Student[];
}

type PrintMode = 'STUDENT' | 'COMMITTEE' | 'COMMITTEE_INFO';

const qrUrl = (data: string | number, size = 200) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(String(data))}&color=000000`;

const CommitteeLabelsPrint: React.FC<Props> = ({ students }) => {
  const [isPrinting, setIsPrinting] = useState(false);
  const [printMode, setPrintMode] = useState<PrintMode>('STUDENT');
  const [selectedCommittee, setSelectedCommittee] = useState<string>('ALL');

  const uniqueCommittees = useMemo(() => {
    return Array.from(new Set(students.map(student => student.committee_number)))
      .filter(Boolean)
      .map(String)
      .sort((a, b) => Number(a) - Number(b));
  }, [students]);

  const pagesByCommittee = useMemo(() => {
    const pages: { committee: string; students: Student[] }[] = [];
    const committeesToProcess = selectedCommittee === 'ALL' ? uniqueCommittees : [selectedCommittee];

    for (const committee of committeesToProcess) {
      const committeeStudents = students
        .filter(student => String(student.committee_number) === String(committee))
        .sort((a, b) => Number(a.seating_number || 0) - Number(b.seating_number || 0) || a.name.localeCompare(b.name, 'ar'));

      for (let i = 0; i < committeeStudents.length; i += 21) {
        pages.push({ committee, students: committeeStudents.slice(i, i + 21) });
      }
    }

    return pages;
  }, [students, uniqueCommittees, selectedCommittee]);

  const committeePages = useMemo(() => {
    const pages: string[][] = [];
    const committeesToProcess = selectedCommittee === 'ALL' ? uniqueCommittees : [selectedCommittee];

    for (let i = 0; i < committeesToProcess.length; i += 21) {
      pages.push(committeesToProcess.slice(i, i + 21));
    }

    return pages;
  }, [uniqueCommittees, selectedCommittee]);

  const committeeStats = useMemo(() => {
    return uniqueCommittees.reduce<Record<string, Array<{ grade: string; count: number }>>>((acc, committee) => {
      const rows = Array.from(
        students
          .filter(student => String(student.committee_number) === String(committee))
          .reduce((map, student) => {
            const grade = student.grade || 'غير محدد';
            map.set(grade, (map.get(grade) || 0) + 1);
            return map;
          }, new Map<string, number>())
      )
        .map(([grade, count]) => ({ grade, count }))
        .sort((a, b) => a.grade.localeCompare(b.grade, 'ar', { numeric: true }));

      acc[committee] = rows;
      return acc;
    }, {});
  }, [students, uniqueCommittees]);

  const totalLabels = printMode === 'STUDENT'
    ? pagesByCommittee.reduce((sum, page) => sum + page.students.length, 0)
    : selectedCommittee === 'ALL' ? uniqueCommittees.length : 1;

  const neededPages = printMode === 'STUDENT' ? pagesByCommittee.length : committeePages.length;

  const handlePrint = async () => {
    setIsPrinting(true);

    const imageUrlsToPreload: string[] = [];
    if (printMode === 'STUDENT') {
      pagesByCommittee.forEach(page => {
        page.students.forEach(student => {
          imageUrlsToPreload.push(qrUrl(student.parent_phone || student.national_id || student.seating_number || student.id, 150));
        });
      });
    } else {
      committeePages.forEach(page => page.forEach(committee => imageUrlsToPreload.push(qrUrl(committee, 220))));
    }

    await Promise.allSettled(
      imageUrlsToPreload.map(url => new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = url;
      }))
    );

    setTimeout(() => window.print(), 500);
  };

  useEffect(() => {
    const handleAfterPrint = () => setIsPrinting(false);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  const renderStudentPrint = () => pagesByCommittee.map((page, pageIdx) => (
    <div key={pageIdx} className="gs-1021-sheet">
      {page.students.map(student => (
        <div key={student.id} className="gs-1021-label">
          <div className="student-label-content">
            <div className="student-label-details">
              <div className="flex justify-between items-start">
                <img src={APP_CONFIG.LOGO_URL} alt="Logo" className="w-6 h-6 object-contain" />
                <div className="text-left text-[8pt] font-black text-black-bold">لجنة: {student.committee_number}</div>
              </div>
              <div className="text-[10pt] font-black text-black-bold text-center leading-tight mt-1 line-clamp-2" style={{ maxHeight: '24pt', overflow: 'hidden' }}>
                {student.name}
              </div>
              <div className="flex justify-between items-end mt-1 border-t border-black pt-1">
                <div className="text-[8pt] font-bold text-black-bold">{student.grade} - {student.section}</div>
                <div className="text-[9pt] font-black text-black-bold" style={{ direction: 'ltr' }}>رقم الجلوس: {student.seating_number || student.national_id}</div>
              </div>
            </div>

            <div className="w-[18mm] flex flex-col items-center justify-center shrink-0">
              <img
                src={qrUrl(student.parent_phone || student.national_id || student.seating_number || student.id, 150)}
                alt="QR"
                className="w-full h-auto aspect-square"
                style={{ imageRendering: 'pixelated' }}
                crossOrigin="anonymous"
              />
              <span className="text-[5pt] font-bold mt-0.5">موثق</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  ));

  const renderCommitteeCodePrint = () => committeePages.map((pageCommittees, pageIdx) => (
    <div key={pageIdx} className="gs-1021-sheet">
      {pageCommittees.map(committee => (
        <div key={committee} className="gs-1021-label">
          <div className="committee-code-content">
            <div className="w-[40%] flex items-center justify-center">
              <img
                src={qrUrl(committee, 220)}
                alt="QR"
                className="w-20 h-20"
                style={{ imageRendering: 'pixelated' }}
                crossOrigin="anonymous"
              />
            </div>
            <div className="flex-1 flex flex-col items-center justify-center gap-1 border-r border-black h-[85%] relative">
              <img src={APP_CONFIG.LOGO_URL} alt="Logo" className="w-10 h-10 object-contain mb-1" />
              <span className="text-[8pt] font-black text-black-bold uppercase tracking-widest leading-none mb-1">لجنة رقم</span>
              <span className="text-[32pt] font-black text-black-bold leading-none tabular-nums" style={{ color: '#000' }}>{committee}</span>
              <span className="text-[6pt] font-black text-black-bold mt-2 uppercase tracking-tighter text-center">كنترول الاختبارات الذكي</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  ));

  const renderCommitteeInfoPrint = () => committeePages.map((pageCommittees, pageIdx) => (
    <div key={pageIdx} className="gs-1021-sheet">
      {pageCommittees.map(committee => {
        const stats = committeeStats[committee] || [];
        const displayedStats = stats.length > 3
          ? [
              ...stats.slice(0, 2),
              { grade: 'أخرى', count: stats.slice(2).reduce((sum, row) => sum + row.count, 0) },
            ]
          : stats;
        return (
          <div key={committee} className="gs-1021-label">
            <div className="committee-info-content">
              <div className="committee-info-main">
                <div className="committee-info-top">
                  <img src={APP_CONFIG.LOGO_URL} alt="Logo" className="committee-info-logo" />
                  <div className="committee-title-block">
                    <span>معلومات اللجنة</span>
                    <strong>{committee}</strong>
                  </div>
                </div>

                <table className="committee-mini-table">
                  <thead>
                    <tr>
                      <th>الصف</th>
                      <th>العدد</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedStats.map(row => (
                      <tr key={row.grade}>
                        <td>{row.grade}</td>
                        <td>{row.count}</td>
                      </tr>
                    ))}
                    {!stats.length && <tr><td colSpan={2}>لا يوجد طلاب</td></tr>}
                  </tbody>
                </table>
              </div>

              <div className="committee-info-qr">
                <img
                  src={qrUrl(committee, 220)}
                  alt="QR"
                  className="committee-info-qr-img"
                  style={{ imageRendering: 'pixelated' }}
                  crossOrigin="anonymous"
                />
                <span>QR رقم اللجنة</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  ));

  const modeTitle = printMode === 'STUDENT' ? 'الطلاب' : printMode === 'COMMITTEE' ? 'كود تفعيل اللجان' : 'معلومات اللجان';

  return (
    <div className="space-y-10 animate-fade-in text-right pb-24 max-w-7xl mx-auto px-4 md:px-0">
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
                print-color-adjust: exact;
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
              .student-label-content,
              .committee-code-content,
              .committee-info-content {
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
                justify-content: space-between;
                border-left: 1pt solid #000;
                padding-left: 2mm;
              }
              .committee-code-content {
                align-items: center;
                justify-content: space-between;
                padding: 0 5mm;
              }
              .committee-info-content {
                align-items: stretch;
                justify-content: space-between;
                padding: 1.25mm;
                gap: 1.25mm;
                overflow: hidden;
              }
              .committee-info-main {
                flex: 1;
                min-width: 0;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                overflow: hidden;
              }
              .committee-info-top {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 1.5mm;
                border-bottom: .7pt solid #000;
                padding-bottom: .6mm;
                flex-shrink: 0;
              }
              .committee-info-logo {
                width: 9mm;
                height: 9mm;
                object-fit: contain;
              }
              .committee-title-block {
                text-align: left;
                color: #000 !important;
                font-weight: 900;
                line-height: 1;
              }
              .committee-title-block span {
                display: block;
                font-size: 6.4pt;
              }
              .committee-title-block strong {
                display: block;
                font-size: 20pt;
                margin-top: .35mm;
                letter-spacing: 0;
                color: #000 !important;
              }
              .committee-mini-table {
                width: 100%;
                border-collapse: collapse;
                table-layout: fixed;
                margin-top: .75mm;
                flex: 1;
              }
              .committee-mini-table th,
              .committee-mini-table td {
                border: .65pt solid #000;
                padding: .35mm .45mm;
                text-align: center;
                color: #000 !important;
                font-weight: 900;
                line-height: 1;
                white-space: nowrap;
                overflow: hidden;
              }
              .committee-mini-table th {
                font-size: 7pt;
                background: #f1f5f9 !important;
              }
              .committee-mini-table td {
                font-size: 7.6pt;
              }
              .committee-mini-table td:first-child {
                font-size: 6.2pt;
                line-height: .9;
              }
              .committee-info-qr {
                width: 21mm;
                height: 100%;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                border-right: 1pt solid #000;
                padding-right: 1mm;
                overflow: hidden;
              }
              .committee-info-qr-img {
                width: 17.5mm;
                height: 17.5mm;
              }
              .committee-info-qr span {
                color: #000 !important;
                font-size: 5.2pt;
                font-weight: 900;
                margin-top: .65mm;
                line-height: 1;
                white-space: nowrap;
              }
              .text-black-bold {
                color: #000 !important;
                font-weight: 900 !important;
              }
            }
          `}</style>

          <div className="print-only-labels" dir="rtl">
            {printMode === 'STUDENT' && renderStudentPrint()}
            {printMode === 'COMMITTEE' && renderCommitteeCodePrint()}
            {printMode === 'COMMITTEE_INFO' && renderCommitteeInfoPrint()}
          </div>
        </div>,
        document.body
      )}

      <div className="bg-slate-900 p-8 md:p-12 rounded-[3rem] shadow-2xl text-white no-print relative overflow-visible border-b-[8px] border-blue-600 z-10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 blur-[100px] rounded-full pointer-events-none"></div>
        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-10">
          <div className="space-y-6 w-full lg:w-auto flex-1">
            <div className="flex items-center gap-6">
              <div className="bg-blue-600 p-4 rounded-[1.5rem] shadow-xl text-white"><QrCode size={32} /></div>
              <div>
                <h3 className="text-3xl font-black tracking-tighter">منظومة طباعة الملصقات (GS-1021)</h3>
                <p className="text-slate-400 font-bold mt-1 text-sm bg-slate-800/50 inline-block px-3 py-1 rounded-full">
                  أرقام جلوس الطلاب، كود تفعيل اللجان، ومعلومات اللجان مع QR
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 bg-slate-800 p-2 rounded-2xl max-w-3xl shadow-inner gap-2">
              <button
                onClick={() => setPrintMode('STUDENT')}
                className={`flex items-center justify-center gap-3 py-4 rounded-xl font-black transition-all ${printMode === 'STUDENT' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
              >
                <Users size={20} /> أرقام جلوس الطلاب
              </button>
              <button
                onClick={() => setPrintMode('COMMITTEE')}
                className={`flex items-center justify-center gap-3 py-4 rounded-xl font-black transition-all ${printMode === 'COMMITTEE' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
              >
                <UserSquare2 size={20} /> كود تفعيل اللجان
              </button>
              <button
                onClick={() => setPrintMode('COMMITTEE_INFO')}
                className={`flex items-center justify-center gap-3 py-4 rounded-xl font-black transition-all ${printMode === 'COMMITTEE_INFO' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
              >
                <Table2 size={20} /> معلومات اللجان مع QR
              </button>
            </div>

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
                  {uniqueCommittees.map(committee => (
                    <option key={committee} value={committee}>
                      لجنة رقم {committee} ({students.filter(student => String(student.committee_number) === String(committee)).length} طالب)
                    </option>
                  ))}
                </select>
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">▼</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 bg-slate-800/80 p-4 rounded-2xl border border-white/5 w-fit">
              <div className="flex items-center gap-2">
                <Info size={18} className="text-blue-400" />
                <span className="text-xs font-black text-slate-300">طريقة العرض:</span>
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
            {isPrinting ? 'جاري التحضير...' : 'اطبع الملصقات الآن'}
          </button>
        </div>
      </div>

      <div className="no-print space-y-8 mt-12">
        <div className="flex items-center gap-4 border-b-2 border-slate-100 pb-4 pr-4">
          <LayoutGrid className="text-blue-600" size={28} />
          <h4 className="text-2xl font-black text-slate-800 tracking-tight">معاينة تخطيط الأوراق ({modeTitle})</h4>
        </div>

        {neededPages === 0 ? (
          <div className="bg-white p-24 rounded-[3rem] border-4 border-dashed border-slate-200 text-center flex flex-col items-center gap-6 shadow-inner">
            <div className="bg-slate-100 p-6 rounded-full"><Tag size={64} className="text-slate-300" /></div>
            <p className="text-2xl font-black text-slate-400 italic">لا توجد ملصقات لعرضها حسب الفلتر الحالي</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-10">
            {printMode === 'STUDENT' && pagesByCommittee.map((page, pageIdx) => (
              <div key={pageIdx} className="bg-white p-6 rounded-[2rem] shadow-xl border border-slate-200 flex flex-col items-center gap-6 hover:shadow-2xl transition-all group">
                <div className="flex justify-between w-full items-center border-b pb-3 border-dashed border-slate-200">
                  <span className="text-[11px] font-black text-slate-500 bg-slate-100 px-3 py-1 rounded-lg">صفحة رقم #{pageIdx + 1}</span>
                  <span className="text-[13px] font-black text-blue-600 bg-blue-50 px-4 py-1.5 rounded-xl border border-blue-100 shadow-sm">لجنة: {page.committee}</span>
                </div>
                <div className="grid grid-cols-3 gap-1 border border-slate-300 bg-slate-50 p-2 shadow-inner w-full max-w-[400px] aspect-[210/297] relative rounded-md overflow-hidden" dir="rtl">
                  {page.students.map(student => (
                    <div key={student.id} className="bg-white border border-slate-300 flex flex-col items-center justify-center p-1 shadow-sm aspect-[70/42.4] hover:border-blue-500 transition-all relative group/label">
                      <div className="w-full h-full flex items-center overflow-hidden gap-1 pl-1">
                        <div className="flex-1 flex flex-col justify-between h-full border-l border-slate-200 py-[2px] pr-1">
                          <div className="text-[5px] font-black text-slate-400">لجنة: {student.committee_number}</div>
                          <div className="text-[6px] font-black leading-tight text-slate-800 line-clamp-2">{student.name}</div>
                          <div className="text-[5px] font-black text-slate-500">{student.seating_number || '-'}</div>
                        </div>
                        <div className="w-[12px] h-[12px] bg-slate-200 shrink-0 flex items-center justify-center">
                          <QrCode size={8} className="text-slate-400 opacity-50" />
                        </div>
                      </div>
                    </div>
                  ))}
                  {Array.from({ length: 21 - page.students.length }).map((_, i) => (
                    <div key={`empty-${i}`} className="border border-slate-200/50 bg-slate-100/30 flex items-center justify-center shadow-sm aspect-[70/42.4]">
                      <span className="text-[3px] text-slate-300 uppercase">فارغ</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {printMode !== 'STUDENT' && committeePages.map((pageCommittees, pageIdx) => (
              <div key={pageIdx} className="bg-white p-6 rounded-[2rem] shadow-xl border border-slate-200 flex flex-col items-center gap-6 hover:shadow-2xl transition-all group">
                <div className="flex justify-between w-full items-center border-b pb-3 border-dashed border-slate-200">
                  <span className="text-[11px] font-black text-slate-500 bg-slate-100 px-3 py-1 rounded-lg">صفحة رقم #{pageIdx + 1}</span>
                  <span className="text-[13px] font-black text-blue-600 bg-blue-50 px-4 py-1.5 rounded-xl border border-blue-100 shadow-sm">{printMode === 'COMMITTEE' ? 'كود تفعيل اللجان' : 'معلومات اللجان مع QR'}</span>
                </div>
                <div className="grid grid-cols-3 gap-1 border border-slate-300 bg-slate-50 p-2 shadow-inner w-full max-w-[400px] aspect-[210/297] rounded-md overflow-hidden" dir="rtl">
                  {pageCommittees.map(committee => (
                    <div key={committee} className="bg-white border border-slate-300 flex items-stretch justify-between gap-1 p-1 shadow-sm aspect-[70/42.4]">
                      {printMode === 'COMMITTEE' ? (
                        <>
                          <div className="flex-1 flex flex-col items-center justify-center">
                            <img src={APP_CONFIG.LOGO_URL} alt="Logo" className="w-5 h-5 object-contain mb-1" />
                            <span className="text-[6px] font-black text-slate-600">لجنة رقم</span>
                            <span className="text-xl font-black text-slate-900 leading-none">{committee}</span>
                          </div>
                          <div className="w-10 border-r border-slate-300 flex items-center justify-center">
                            <QrCode size={20} className="text-slate-900" />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex-1 min-w-0 flex flex-col justify-between">
                            <div className="flex items-center justify-between gap-1 border-b border-slate-300 pb-1">
                              <img src={APP_CONFIG.LOGO_URL} alt="Logo" className="w-4 h-4 object-contain" />
                              <div className="text-left">
                                <span className="block text-[5px] font-black text-slate-500 leading-none">معلومات اللجنة</span>
                                <span className="block text-lg font-black text-slate-900 leading-none">{committee}</span>
                              </div>
                            </div>
                            <div className="mt-1 border border-slate-300 text-[6px] font-black text-slate-800">
                              {(committeeStats[committee] || []).slice(0, 4).map(row => (
                                <div key={row.grade} className="flex justify-between border-b border-slate-200 last:border-b-0 px-1 py-0.5">
                                  <span>{row.grade}</span>
                                  <span>{row.count}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="w-9 border-r border-slate-300 flex flex-col items-center justify-center">
                            <QrCode size={18} className="text-slate-900" />
                            <span className="text-[4px] font-black text-slate-500 mt-0.5">رقم اللجنة</span>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                  {Array.from({ length: 21 - pageCommittees.length }).map((_, i) => (
                    <div key={`empty-com-${i}`} className="border border-slate-200/50 bg-slate-100/30 flex items-center justify-center shadow-sm aspect-[70/42.4]">
                      <span className="text-[3px] text-slate-300 uppercase">فارغ</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.4s ease-out; }
      `}</style>
    </div>
  );
};

export default CommitteeLabelsPrint;
