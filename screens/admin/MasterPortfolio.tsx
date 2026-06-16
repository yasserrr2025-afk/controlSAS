import React, { useMemo } from 'react';
import { BookOpen, Printer, Download, FileText, Link as LinkIcon, Sparkles, Copy, Check } from 'lucide-react';
import { Student, User, Supervision, SystemConfig, Absence, CommitteeReport, ExamSchedule, DeliveryLog, ControlRequest } from '../../types';
import { APP_CONFIG } from '../../constants';
import { formatActualProctorStart, getActualSupervisionStart } from '../../utils/proctorTime';
import { cleanControlRequestText, isInternalSignatureRecord } from '../../services/signatures';

interface Props {
  students: Student[];
  users: User[];
  supervisions: Supervision[];
  systemConfig: SystemConfig;
  absences: Absence[];
  committeeReports: CommitteeReport[];
  examSchedule?: ExamSchedule[];
  deliveryLogs?: DeliveryLog[];
  controlRequests?: ControlRequest[];
  publicMode?: boolean;
}

export const MasterPortfolio: React.FC<Props> = ({ 
  students, users, supervisions, systemConfig, absences, committeeReports, 
  examSchedule = [], deliveryLogs = [], controlRequests = [], publicMode = false
}) => {
  const safeTime = (isoStr?: string) => {
    if (!isoStr) return '---';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return '---';
      return d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
    } catch { return '---'; }
  };

  const safeLoginTime = (isoStr?: string) => {
    return formatActualProctorStart(isoStr);
  };

  const matchesDate = (isoStr: string | undefined | null, date: string): boolean => {
    if (!isoStr || !date) return false;
    try {
      // Try date-string prefix match first (handles both ISO and date-only formats)
      const strVal = String(isoStr);
      if (strVal.startsWith(date)) return true;
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return false;
      // Compare as local date YYYY-MM-DD
      const local = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      return local === date || local.startsWith(date) || date.startsWith(local);
    } catch { return String(isoStr).startsWith(date); }
  };

  const eqCom = (a: any, b: any) => String(a) === String(b);

  const getProctorName = (teacherId?: string) => {
    if (!teacherId) return '';
    return users.find(u => u.id === teacherId || u.national_id === teacherId)?.full_name || teacherId;
  };

  const getCommitteeProctors = (committeeNumber: string, date: string, period?: number) => {
    const names = supervisions
      .filter(s => eqCom(s.committee_number, committeeNumber) && matchesDate(s.date, date) && (period === undefined || String(s.period) === String(period)))
      .map(s => getProctorName(s.teacher_id))
      .filter(Boolean);
    return Array.from(new Set(names));
  };

  const handlePrint = () => {
    window.print();
  };

  const livePortfolioUrl = 'https://control-exam.vercel.app/?portfolio_book_live=1';

  const committeesList = useMemo(() => {
    return Array.from(new Set(students.map(s => s.committee_number).filter(Boolean))).sort((a, b) => Number(a) - Number(b));
  }, [students]);

  const activeProctors = useMemo(() => {
    return Array.from(new Set(supervisions.map(s => s.teacher_id)));
  }, [supervisions]);

  const printDate = new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const controlHeadName = users.find(u => u.role === 'CONTROL_MANAGER')?.full_name || 'رئيس الكنترول';
  const schoolManagerName = users.find(u => u.role === 'ADMIN')?.full_name || 'مدير المدرسة';

  const getStudentExamStatus = (student: Student, committeeNumber: string, date: string, period?: number) => {
    return absences.find(a =>
      a.student_id === student.national_id &&
      eqCom(a.committee_number, committeeNumber) &&
      matchesDate(a.date, date) &&
      (period === undefined || String(a.period) === String(period))
    );
  };

  const getCommitteeTimeline = (committeeNumber: string, date: string, period?: number) => {
    const supvs = supervisions.filter(s =>
      eqCom(s.committee_number, committeeNumber) &&
      matchesDate(s.date, date) &&
      (period === undefined || String(s.period) === String(period))
    );
    const logs = deliveryLogs.filter(l =>
      eqCom(l.committee_number, committeeNumber) &&
      matchesDate(l.time, date) &&
      (period === undefined || String(l.period) === String(period))
    );
    const proctors = Array.from(new Set(supvs.map(s => getProctorName(s.teacher_id)).filter(Boolean)));
    const loginTime = getActualSupervisionStart(supvs);
    const closeLog = logs.filter(l => l.type === 'RECEIVE').sort((a, b) => String(a.time).localeCompare(String(b.time)))[0];
    const receiptLogs = logs
      .filter(l => l.type === 'RECEIVE' && l.status === 'CONFIRMED')
      .sort((a, b) => String(a.time).localeCompare(String(b.time)));
    const receiptLog = receiptLogs[0];
    const receiverNames = Array.from(new Set(
      receiptLogs
        .map(l => `${l.teacher_name || 'غير محدد'}${l.grade ? ` (${l.grade})` : ''}`)
        .filter(Boolean)
    ));
    const receiptTimes = Array.from(new Set(
      receiptLogs
        .map(l => safeTime(l.time))
        .filter(t => t !== '---')
    ));

    return {
      proctors,
      loginTime,
      closeLog,
      receiptLog,
      receiverNames: receiverNames.length ? receiverNames : (closeLog?.teacher_name ? [closeLog.teacher_name] : []),
      receiptTimes,
    };
  };

  const fieldLogRows = useMemo(() => {
    const reportRows = committeeReports.map(rep => ({
      id: `report-${rep.id}`,
      kind: 'تقرير ميداني',
      committee: rep.committee_number,
      time: rep.date,
      person: rep.proctor_name || getCommitteeProctors(rep.committee_number, rep.date).join(' - ') || 'غير محدد',
      detail: [rep.observations, rep.issues].filter(Boolean).join(' / ') || 'لا توجد ملاحظات مفصلة',
      action: rep.resolutions || 'للمتابعة',
      tone: 'report',
    }));
    const requestRows = controlRequests.filter(req => !isInternalSignatureRecord(req)).map(req => ({
      id: `request-${req.id}`,
      kind: 'بلاغ كنترول',
      committee: req.committee,
      time: req.time,
      person: req.from || getCommitteeProctors(req.committee, req.time).join(' - ') || 'غير محدد',
      detail: cleanControlRequestText(req.text) || 'بلاغ بدون نص',
      action: req.status === 'DONE' ? `منجز${req.assistant_name ? ` - ${req.assistant_name}` : ''}` : req.status === 'IN_PROGRESS' ? `قيد المعالجة${req.assistant_name ? ` - ${req.assistant_name}` : ''}` : req.status === 'REJECTED' ? 'مرفوض' : 'مفتوح',
      tone: req.status === 'DONE' ? 'done' : req.status === 'REJECTED' ? 'danger' : 'warning',
    }));
    return [...reportRows, ...requestRows].sort((a, b) => String(a.time).localeCompare(String(b.time)));
  }, [committeeReports, controlRequests, supervisions, users]);

  const OfficialPortfolioHeader = ({ title, meta }: { title: string; meta?: React.ReactNode }) => (
    <div className="official-report-header">
      <div className="official-side official-side-right">
        <p>المملكة العربية السعودية</p>
        <p>{APP_CONFIG.MINISTRY_NAME}</p>
        <p>{APP_CONFIG.ADMINISTRATION_NAME}</p>
        <p>مدرسة عماد الدين زنكي المتوسطة</p>
      </div>
      <div className="official-center">
        <img src={APP_CONFIG.LOGO_URL} alt="الشعار" />
        <h2>{title}</h2>
        <p>ملف إنجاز أعمال الاختبارات</p>
      </div>
      <div className="official-side official-side-left">
        <p>تاريخ الطباعة: {printDate}</p>
        <p>العام الدراسي: {systemConfig.academic_year || '1446 / 1447'}</p>
        <p>{meta || 'رقم الملف: إنجاز الاختبارات'}</p>
      </div>
    </div>
  );

  const SignatureFooter = () => (
    <div className="signature-footer">
      <div>
        <p className="signature-title">رئيس الكنترول</p>
        <p className="signature-name">{controlHeadName}</p>
        <p className="signature-line">______________________</p>
      </div>
      <div>
        <p className="signature-title">مدير المدرسة</p>
        <p className="signature-name">{schoolManagerName}</p>
        <p className="signature-line">______________________</p>
      </div>
    </div>
  );

  const [activeTab, setActiveTab] = React.useState<string>(publicMode ? 'COVER' : 'ALL');
  const [copied, setCopied] = React.useState(false);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(livePortfolioUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`space-y-8 animate-fade-in text-right ${publicMode ? 'live-portfolio-public min-h-screen bg-slate-100 pb-20' : ''}`}>
      {publicMode && (
        <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md shadow-sm border-b border-slate-200 p-3 overflow-x-auto print:hidden no-scrollbar">
          <div className="flex gap-2 min-w-max">
            <button 
              onClick={() => setActiveTab('COVER')}
              className={`px-4 py-2 rounded-xl text-sm font-black transition-all ${activeTab === 'COVER' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              الغلاف والإحصائيات
            </button>
            {examSchedule.map(e => (
              <button 
                key={e.id}
                onClick={() => setActiveTab(e.id)}
                className={`px-4 py-2 rounded-xl text-sm font-black transition-all ${activeTab === e.id ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {e.subject} ({new Date(e.exam_date).toLocaleDateString('ar-SA', {weekday:'short'})})
              </button>
            ))}
            <button 
              onClick={() => {
                if(window.confirm('تحذير: عرض جميع الصفحات قد يتسبب في بطء أو إغلاق المتصفح على الجوال. هل تود المتابعة؟')) {
                  setActiveTab('ALL');
                }
              }}
              className={`px-4 py-2 rounded-xl text-sm font-black transition-all ${activeTab === 'ALL' ? 'bg-amber-500 text-white shadow-md' : 'bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100'}`}
            >
              عرض كامل الملف (للطباعة)
            </button>
          </div>
        </div>
      )}

      <div className={`bg-slate-950 p-8 md:p-10 rounded-b-[2rem] md:rounded-[3.5rem] shadow-2xl relative overflow-hidden text-white flex flex-col md:flex-row items-center justify-between gap-6 border-b-8 border-amber-500 ${publicMode ? 'mx-0 rounded-none md:mx-4' : 'no-print'}`}>
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/20 blur-[100px] rounded-full pointer-events-none"></div>
        <div className="flex flex-col md:flex-row items-center md:items-start text-center md:text-right gap-6 relative z-10">
          <div className="bg-gradient-to-br from-amber-400 to-amber-600 p-5 rounded-[2rem] shadow-xl text-slate-950 shrink-0">
            {publicMode ? <Sparkles size={40} /> : <BookOpen size={40} />}
          </div>
          <div>
            <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-2">ملف إنجاز الاختبارات الشامل</h2>
            <p className="text-amber-200 font-bold text-sm md:text-base leading-relaxed max-w-xl">
              {publicMode ? 'نسخة حية محدثة تلقائيًا للمشرفين وإدارة التعليم بمحافظة جدة' : 'تصدير كتاب PDF متكامل يحتوي على جميع بيانات وإحصائيات الاختبارات الميدانية'}
            </p>
          </div>
        </div>
        {!publicMode ? (
          <div className="flex flex-col gap-3 relative z-10 w-full md:w-auto">
            <button onClick={handlePrint} className="bg-white text-slate-950 px-8 py-4 rounded-[2rem] font-black flex items-center justify-center gap-3 hover:bg-amber-50 transition-all shadow-xl active:scale-95">
              <Printer size={24}/> طباعة / تصدير PDF
            </button>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-black text-slate-400 mb-1">رابط ملف الإنجاز الحي</p>
                <p className="text-xs font-bold text-amber-100" dir="ltr">رابط تفاعلي محدث باستمرار</p>
              </div>
              <button onClick={handleCopyLink} className="bg-white/10 hover:bg-white/20 p-2 rounded-xl text-amber-200 transition-all flex items-center gap-2">
                {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                <span className="text-[10px] font-bold">{copied ? 'تم النسخ' : 'نسخ الرابط'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="relative z-10 rounded-3xl border border-white/10 bg-white/5 p-5 text-center w-full md:w-auto">
            <LinkIcon size={24} className="mx-auto mb-2 text-amber-300" />
            <p className="text-xs font-black text-slate-300 mb-3">رابط حي قابل للمشاركة</p>
            <button onClick={handleCopyLink} className="mx-auto bg-amber-500 hover:bg-amber-400 text-slate-900 px-4 py-2 rounded-xl transition-all flex items-center justify-center gap-2 font-bold text-sm">
                {copied ? <Check size={18} className="text-emerald-900" /> : <Copy size={18} />}
                <span>{copied ? 'تم النسخ بنجاح' : 'نسخ رابط الملف'}</span>
            </button>
          </div>
        )}
      </div>

      <div className="print-only-container">
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            body * { visibility: hidden; }
            .print-only-container, .print-only-container * { visibility: visible; }
            .print-only-container { position: absolute; left: 0; top: 0; width: 100%; }
            @page { size: A4 portrait; margin: 8mm; }
            * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .portfolio-page { height: 297mm; width: 210mm; margin: 0 auto; padding: 10mm 12mm 12mm; page-break-after: always; box-sizing: border-box; background: white; position: relative; overflow: hidden; border: 1.5pt solid #0f172a; }
            .portfolio-page:last-child { page-break-after: avoid; }
            .cover-page { display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; height: 100%; border: 10px double #cbd5e1; padding: 40px; border-radius: 20px; }
            .logo-large { width: 180px; margin-bottom: 40px; }
            .cover-title { font-size: 48px; font-weight: 900; color: #0f172a; margin-bottom: 20px; }
            .cover-subtitle { font-size: 24px; font-weight: bold; color: #475569; margin-bottom: 60px; }
            .cover-details { font-size: 20px; font-weight: bold; color: #1e293b; line-height: 2; border-top: 2px solid #e2e8f0; padding-top: 40px; width: 80%; }
            .cover-signature-footer { position: absolute; right: 28mm; left: 28mm; bottom: 24mm; display: grid; grid-template-columns: 1fr 1fr; gap: 35mm; text-align: center; color: #0f172a; font-weight: 900; }
            .cover-signature-footer .role { font-size: 11pt; color: #475569; margin-bottom: 4mm; }
            .cover-signature-footer .name { font-size: 12pt; color: #0f172a; }
            
            .official-report-header { display: grid; grid-template-columns: 1fr 1.3fr 1fr; gap: 8mm; align-items: center; border-bottom: 3px double #0f172a; padding-bottom: 4mm; margin-bottom: 5mm; min-height: 30mm; }
            .official-side { font-size: 9pt; font-weight: 900; line-height: 1.65; color: #0f172a; }
            .official-side-right { text-align: right; }
            .official-side-left { text-align: left; font-size: 8.5pt; color: #334155; }
            .official-center { text-align: center; }
            .official-center img { width: 18mm; height: 18mm; object-fit: contain; margin: 0 auto 1mm; }
            .official-center h2 { font-size: 15pt; font-weight: 900; color: #0f172a; line-height: 1.2; }
            .official-center p { font-size: 8pt; font-weight: 900; color: #64748b; margin-top: 1mm; }
            .content-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #0f172a; padding-bottom: 15px; margin-bottom: 20px; }
            .content-title { font-size: 24px; font-weight: 900; text-align: center; }
            .content-info { font-size: 14px; font-weight: bold; text-align: left; }
            
            .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 40px; }
            .stat-box { border: 2px solid #e2e8f0; border-radius: 16px; padding: 20px; text-align: center; }
            .stat-value { font-size: 36px; font-weight: 900; color: #0f172a; }
            .stat-label { font-size: 16px; font-weight: bold; color: #64748b; }
            
            .data-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            .data-table th, .data-table td { border: 1px solid #cbd5e1; padding: 7px; text-align: center; font-size: 11pt; font-weight: bold; }
            .data-table th { background: #f1f5f9; font-weight: 900; color: #0f172a; }
            .material-summary-page { display: flex; flex-direction: column; }
            .material-summary-title { display: flex; justify-content: space-between; align-items: center; gap: 4mm; margin-bottom: 4mm; padding: 3mm 4mm; background: #f8fafc; border: 1pt solid #cbd5e1; border-radius: 3mm; font-weight: 900; color: #0f172a; }
            .material-summary-page .data-table { margin-top: 0; table-layout: fixed; }
            .material-summary-page .data-table th, .material-summary-page .data-table td { padding: 4px 5px; font-size: 8.5pt; line-height: 1.25; }
            .material-summary-page .data-table th:nth-child(2), .material-summary-page .data-table td:nth-child(2) { width: 42mm; }
            .material-summary-page .data-table td:nth-child(2) { text-align: right; }
            .material-summary-page .data-table tr { break-inside: avoid; page-break-inside: avoid; }
            .count-present { color: #047857; background: #ecfdf5; }
            .count-absent { color: #b91c1c; background: #fef2f2; }
            .count-late { color: #b45309; background: #fffbeb; }
            .student-absent td { background: #fef2f2 !important; color: #991b1b; border-color: #fecaca; }
            .student-late td { background: #fffbeb !important; color: #92400e; border-color: #fde68a; }
            .status-pill { display: inline-block; min-width: 12mm; padding: 1.2mm 1.5mm; border-radius: 99px; font-size: 6.7pt; font-weight: 900; }
            .status-present { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
            .status-absent { background: #dc2626; color: white; border: 1px solid #991b1b; }
            .status-late { background: #f59e0b; color: white; border: 1px solid #b45309; }
            .signature-footer { margin-top: auto; display: grid; grid-template-columns: 1fr 1fr; gap: 30mm; padding: 8mm 12mm 0; font-weight: 900; text-align: center; color: #0f172a; break-inside: avoid; page-break-inside: avoid; }
            .signature-title { font-size: 11pt; text-decoration: underline; text-underline-offset: 4px; margin-bottom: 7mm; }
            .signature-name { min-height: 6mm; font-size: 10pt; }
            .signature-line { margin-top: 5mm; letter-spacing: 1px; }
            
            .footer { position: absolute; bottom: 15mm; left: 15mm; right: 15mm; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; }
            
            .student-table-container { display: grid; grid-template-columns: 1fr 1fr; gap: 10mm; }
            .student-table-container .data-table { table-layout: fixed; }
            .student-table-container .data-table th, .student-table-container .data-table td { font-size: 7.4pt; padding: 4px 3px; line-height: 1.2; }
            .student-table-container .data-table td:nth-child(2) { text-align: right; }
            .committee-proctor-strip { display: grid; grid-template-columns: 1.4fr .8fr .8fr; gap: 3mm; margin: 0 auto 5mm; max-width: 172mm; }
            .committee-receivers-strip { display: flex; flex-wrap: wrap; justify-content: center; gap: 3mm; margin: 5mm auto 0; max-width: 172mm; }
            .receiver-card { width: 42mm; border: 1px solid #cbd5e1; background: #f8fafc; border-radius: 2.5mm; padding: 2.4mm; text-align: center; min-height: 18mm; display: flex; flex-direction: column; justify-content: center; }
            .receiver-card .name { font-size: 7.4pt; font-weight: 900; color: #0f172a; line-height: 1.35; }
            .receiver-card .time { margin-top: 1.2mm; font-size: 7pt; font-weight: 900; color: #2563eb; }
            .operation-card { border: 1px solid #cbd5e1; background: #f8fafc; border-radius: 2.5mm; padding: 2mm; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
            .operation-card .label { font-size: 6.6pt; font-weight: 900; color: #64748b; margin-bottom: .8mm; }
            .operation-card .value { font-size: 8pt; font-weight: 900; color: #0f172a; line-height: 1.35; word-break: break-word; }
            .field-log-table th, .field-log-table td { font-size: 8.2pt; padding: 5px; line-height: 1.35; vertical-align: top; }
            .field-log-table td:nth-child(6), .field-log-table td:nth-child(7) { text-align: right; }
            .row-report td { background: #eff6ff; }
            .row-warning td { background: #fffbeb; color: #92400e; }
            .row-danger td { background: #fef2f2; color: #991b1b; }
            .row-done td { background: #ecfdf5; color: #065f46; }
          }
          @media screen {
            .print-only-container { display: none; }
            .live-portfolio-public .print-only-container { display: block; }
            .live-portfolio-public .portfolio-page {
              width: min(100%, 980px);
              min-height: 1120px;
              margin: 0 auto 28px;
              padding: 38px 46px 56px;
              box-sizing: border-box;
              background: white;
              position: relative;
              overflow: hidden;
              border: 1px solid #dbe3ef;
              border-radius: 26px;
              box-shadow: 0 18px 50px rgba(15, 23, 42, 0.12);
            }
            .live-portfolio-public .cover-page {
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              text-align: center;
              min-height: 1120px;
              border: 10px double #cbd5e1;
            }
            .live-portfolio-public .logo-large { width: 160px; margin-bottom: 34px; }
            .live-portfolio-public .cover-title { font-size: clamp(30px, 5vw, 48px); font-weight: 900; color: #0f172a; margin-bottom: 20px; }
            .live-portfolio-public .cover-subtitle { font-size: clamp(18px, 3vw, 24px); font-weight: bold; color: #475569; margin-bottom: 48px; }
            .live-portfolio-public .cover-details { font-size: 18px; font-weight: bold; color: #1e293b; line-height: 2; border-top: 2px solid #e2e8f0; padding-top: 34px; width: 86%; }
            .live-portfolio-public .cover-signature-footer { position: absolute; right: 70px; left: 70px; bottom: 70px; display: grid; grid-template-columns: 1fr 1fr; gap: 80px; text-align: center; color: #0f172a; font-weight: 900; }
            .live-portfolio-public .cover-signature-footer .role { font-size: 14px; color: #475569; margin-bottom: 12px; }
            .live-portfolio-public .cover-signature-footer .name { font-size: 17px; color: #0f172a; }
            .live-portfolio-public .official-report-header { display: grid; grid-template-columns: 1fr 1.25fr 1fr; gap: 24px; align-items: center; border-bottom: 3px double #0f172a; padding-bottom: 16px; margin-bottom: 20px; }
            .live-portfolio-public .official-side { font-size: 13px; font-weight: 900; line-height: 1.65; color: #0f172a; }
            .live-portfolio-public .official-side-right { text-align: right; }
            .live-portfolio-public .official-side-left { text-align: left; color: #334155; }
            .live-portfolio-public .official-center { text-align: center; }
            .live-portfolio-public .official-center img { width: 70px; height: 70px; object-fit: contain; margin: 0 auto 4px; }
            .live-portfolio-public .official-center h2 { font-size: 22px; font-weight: 900; color: #0f172a; line-height: 1.2; }
            .live-portfolio-public .official-center p { font-size: 12px; font-weight: 900; color: #64748b; margin-top: 4px; }
            .live-portfolio-public .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 18px; margin-bottom: 34px; }
            .live-portfolio-public .stat-box { border: 2px solid #e2e8f0; border-radius: 16px; padding: 20px; text-align: center; }
            .live-portfolio-public .stat-value { font-size: 36px; font-weight: 900; color: #0f172a; }
            .live-portfolio-public .stat-label { font-size: 15px; font-weight: bold; color: #64748b; }
            .live-portfolio-public .data-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            .live-portfolio-public .data-table th, .live-portfolio-public .data-table td { border: 1px solid #cbd5e1; padding: 7px; text-align: center; font-size: 13px; font-weight: bold; }
            .live-portfolio-public .data-table th { background: #f1f5f9; font-weight: 900; color: #0f172a; }
            .live-portfolio-public .material-summary-page { display: flex; flex-direction: column; }
            .live-portfolio-public .material-summary-title { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 16px; padding: 12px 16px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 14px; font-weight: 900; color: #0f172a; }
            .live-portfolio-public .student-table-container { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
            .live-portfolio-public .committee-proctor-strip { display: grid; grid-template-columns: 1.4fr .8fr .8fr; gap: 12px; margin: 0 auto 18px; }
            .live-portfolio-public .committee-receivers-strip { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; margin: 18px auto 0; }
            .live-portfolio-public .receiver-card, .live-portfolio-public .operation-card { border: 1px solid #cbd5e1; background: #f8fafc; border-radius: 12px; padding: 10px; text-align: center; }
            .live-portfolio-public .receiver-card .name, .live-portfolio-public .operation-card .value { font-weight: 900; color: #0f172a; }
            .live-portfolio-public .receiver-card .time { margin-top: 6px; font-size: 12px; font-weight: 900; color: #2563eb; }
            .live-portfolio-public .label { font-size: 11px; font-weight: 900; color: #64748b; margin-bottom: 4px; }
            .live-portfolio-public .status-pill { display: inline-block; min-width: 48px; padding: 4px 8px; border-radius: 99px; font-size: 11px; font-weight: 900; }
            .live-portfolio-public .status-present { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
            .live-portfolio-public .status-absent { background: #dc2626; color: white; border: 1px solid #991b1b; }
            .live-portfolio-public .status-late { background: #f59e0b; color: white; border: 1px solid #b45309; }
            .live-portfolio-public .signature-footer { margin-top: auto; display: grid; grid-template-columns: 1fr 1fr; gap: 80px; padding: 32px 40px 0; font-weight: 900; text-align: center; color: #0f172a; }
            .live-portfolio-public .footer { position: absolute; bottom: 22px; left: 32px; right: 32px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; }
            .live-portfolio-public .count-present { color: #047857; background: #ecfdf5; }
            .live-portfolio-public .count-absent { color: #b91c1c; background: #fef2f2; }
            .live-portfolio-public .count-late { color: #b45309; background: #fffbeb; }
            .live-portfolio-public .student-absent td { background: #fef2f2 !important; color: #991b1b; border-color: #fecaca; }
            .live-portfolio-public .student-late td { background: #fffbeb !important; color: #92400e; border-color: #fde68a; }
            .live-portfolio-public .row-report td { background: #eff6ff; }
            .live-portfolio-public .row-warning td { background: #fffbeb; color: #92400e; }
            .live-portfolio-public .row-danger td { background: #fef2f2; color: #991b1b; }
            .live-portfolio-public .row-done td { background: #ecfdf5; color: #065f46; }
            @media (max-width: 760px) {
              .live-portfolio-public { padding: 10px; }
              .live-portfolio-public .portfolio-page { zoom: 0.5; min-height: auto; padding: 22px 14px 54px; border-radius: 18px; overflow-x: auto; }
              .live-portfolio-public .cover-page { min-height: 720px; padding: 24px 14px; }
              .live-portfolio-public .cover-signature-footer { position: static; width: 100%; grid-template-columns: 1fr; gap: 18px; margin-top: 28px; }
              .live-portfolio-public .official-report-header { grid-template-columns: 1fr; text-align: center; gap: 10px; }
              .live-portfolio-public .official-side, .live-portfolio-public .official-side-left, .live-portfolio-public .official-side-right { text-align: center; }
              .live-portfolio-public .stats-grid { grid-template-columns: 1fr; }
              .live-portfolio-public .student-table-container, .live-portfolio-public .committee-proctor-strip { grid-template-columns: 1fr; }
              .live-portfolio-public .data-table { min-width: 680px; }
            }
          }
        `}} />

        {/* الغلاف */}
        {(activeTab === 'ALL' || activeTab === 'COVER') && (
          <>
            <div className="portfolio-page cover-page">
               <img src={APP_CONFIG.LOGO_URL} alt="الشعار" className="logo-large" />
               <h1 className="cover-title">ملف إنجاز أعمال الاختبارات</h1>
               <h2 className="cover-subtitle">نظام الكنترول الرقمي الموحد</h2>
             <div className="cover-details">
              <p>المملكة العربية السعودية</p>
              <p>وزارة التعليم</p>
              <p>إدارة التعليم بمحافظة جدة</p>
              <p>مدرسة عماد الدين زنكي المتوسطة</p>
              <p style={{marginTop: '40px', fontSize: '24px', color: '#0f172a'}}>العام الدراسي: {systemConfig.academic_year || '1446 / 1447'}</p>
           </div>
           <div className="cover-signature-footer">
             <div>
               <p className="role">مُعد التقرير</p>
               <p className="name">ياسر محفوظ الحميدي</p>
             </div>
             <div>
               <p className="role">مدير المدرسة</p>
               <p className="name">{schoolManagerName}</p>
             </div>
           </div>
        </div>

        {/* الفهرس وإحصائيات عامة */}
        <div className="portfolio-page">
          <OfficialPortfolioHeader title="إحصائيات الكنترول العامة" />
          
          <div className="stats-grid">
            <div className="stat-box">
               <div className="stat-value">{students.length}</div>
               <div className="stat-label">إجمالي الطلاب</div>
            </div>
            <div className="stat-box">
               <div className="stat-value">{committeesList.length}</div>
               <div className="stat-label">إجمالي اللجان الميدانية</div>
            </div>
            <div className="stat-box">
               <div className="stat-value">{users.length}</div>
               <div className="stat-label">أعضاء الكادر التعليمي</div>
            </div>
            <div className="stat-box">
               <div className="stat-value">{activeProctors.length}</div>
               <div className="stat-label">المراقبين المكلفين</div>
            </div>
            <div className="stat-box">
               <div className="stat-value">{absences.filter(a => a.type === 'ABSENT').length}</div>
               <div className="stat-label">إجمالي حالات الغياب المسجلة</div>
            </div>
            <div className="stat-box">
               <div className="stat-value">{absences.filter(a => a.type === 'LATE').length}</div>
               <div className="stat-label">إجمالي حالات التأخير المسجلة</div>
            </div>
            <div className="stat-box">
               <div className="stat-value">{committeeReports.length}</div>
               <div className="stat-label">التقارير الميدانية المرفوعة</div>
            </div>
          </div>

          <h3 style={{fontSize: '20px', fontWeight: '900', marginTop: '40px', marginBottom: '20px'}}>محتويات الملف:</h3>
          <ul style={{listStyle: 'none', padding: 0, margin: 0, fontSize: '18px', lineHeight: 2, fontWeight: 'bold'}}>
            <li>1. الغلاف الرسمي</li>
            <li>2. الإحصائيات العامة</li>
            <li>3. كشف حالات الغياب الكلي</li>
            <li>4. سجل التقارير الميدانية للملاحظين</li>
            <li>5. تقارير المواد (المراقبون، التسليم، وكشوف الطلاب لكل مادة)</li>
          </ul>
          
          <div className="footer">تم إنشاء هذا الملف آلياً عبر نظام الكنترول الرقمي - مدرسة عماد الدين زنكي - بواسطة ياسر الحميدي</div>
        </div>

        {/* كشف الغياب */}
        <div className="portfolio-page">
          <OfficialPortfolioHeader title="كشف حالات الغياب والتأخير الكلي" />
          
          <table className="data-table">
            <thead>
              <tr>
                <th>م</th>
                <th>اسم الطالب</th>
                <th>اللجنة</th>
                <th>المادة</th>
                <th>الوقت</th>
                <th>اسم المراقب</th>
                <th>نوع الحالة</th>
              </tr>
            </thead>
            <tbody>
              {absences.map((abs, idx) => {
                // Try period match first, then fall back to date-only match
                const absSubject = (
                  examSchedule.find(e => matchesDate(abs.date, e.exam_date) && String(e.period) === String(abs.period))
                  || examSchedule.find(e => matchesDate(abs.date, e.exam_date))
                )?.subject || '-';
                const assignedProctors = getCommitteeProctors(abs.committee_number, abs.date, abs.period);
                const absProctor = getProctorName(abs.proctor_id) || assignedProctors.join(' - ') || '-';
                return (
                  <tr key={abs.id}>
                    <td>{idx + 1}</td>
                    <td>{abs.student_name}</td>
                    <td>{abs.committee_number}</td>
                    <td>{absSubject}</td>
                    <td style={{fontFamily: 'monospace'}}>{safeTime(abs.date)}</td>
                    <td>{absProctor}</td>
                    <td>{abs.type === 'ABSENT' ? 'غياب' : 'تأخر'}</td>
                  </tr>
                );
              })}
              {absences.length === 0 && (
                <tr><td colSpan={7}>لا توجد حالات غياب مسجلة.</td></tr>
              )}
            </tbody>
          </table>
          <div className="footer">تم إنشاء هذا الملف آلياً عبر نظام الكنترول الرقمي - مدرسة عماد الدين زنكي - بواسطة ياسر الحميدي</div>
        </div>
        
        {/* التقارير الميدانية */}
        <div className="portfolio-page">
          <OfficialPortfolioHeader title="سجل التقارير والبلاغات الميدانية للمراقبين" />
          
          <table className="data-table field-log-table">
            <thead>
              <tr>
                <th>م</th>
                <th>النوع</th>
                <th>اللجنة</th>
                <th>المراقب / المرسل</th>
                <th>وقت البلاغ / التقرير</th>
                <th>الملاحظة أو البلاغ</th>
                <th>الحالة / الإجراء</th>
              </tr>
            </thead>
            <tbody>
              {fieldLogRows.map((row, idx) => (
                <tr key={row.id} className={`row-${row.tone}`}>
                  <td>{idx + 1}</td>
                  <td>{row.kind}</td>
                  <td>{row.committee}</td>
                  <td>{row.person}</td>
                  <td>
                    {new Date(row.time).toLocaleDateString('ar-SA')}
                    <br />
                    <span style={{fontFamily: 'monospace'}}>{safeTime(row.time)}</span>
                  </td>
                  <td>{row.detail}</td>
                  <td>{row.action}</td>
                </tr>
              ))}
              {fieldLogRows.length === 0 && (
                <tr><td colSpan={7}>لا توجد تقارير أو بلاغات ميدانية مسجلة.</td></tr>
              )}
            </tbody>
          </table>
          
          <SignatureFooter />
        </div>
          </>
        )}

        {/* تقارير المواد وكشوف الطلاب */}
        {examSchedule.map((exam, examIdx) => {
           if (activeTab !== 'ALL' && activeTab !== exam.id) return null;
           const examGrades = exam.grades || [];
           const schedCommittees = exam.committees || [];
           // committees from students matching grades (if grades specified)
           const studCommittees = students
             .filter(s => s.committee_number && (examGrades.length === 0 || examGrades.includes(s.grade)))
             .map(s => String(s.committee_number));
           // committees from supervisions on this exam date+period
           const supvCommittees = supervisions
             .filter(s => matchesDate(s.date, exam.exam_date) && String(s.period) === String(exam.period))
             .map(s => String(s.committee_number));
           // all unique committees for this exam
           const examCommittees = Array.from(new Set([
             ...schedCommittees.map(String),
             ...studCommittees,
             ...supvCommittees
           ])).filter(Boolean).sort((a,b)=>Number(a)-Number(b));
           // students belonging to this exam's committees and grades
           const examStudents = students.filter(s => {
             if (!s.committee_number) return false;
             if (!examCommittees.includes(String(s.committee_number))) return false;
             if (examGrades.length > 0) return examGrades.includes(s.grade);
             return true;
           });

           return (
             <React.Fragment key={exam.id}>
               {/* تقرير المادة العام (التقرير اليومي للمادة) */}
               <div className="portfolio-page material-summary-page">
                 <OfficialPortfolioHeader
                   title="التقرير الشامل للجان المادة"
                   meta={<>{exam.subject}<br />{new Date(exam.exam_date).toLocaleDateString('ar-SA')}</>}
                 />
                 
                 <div className="material-summary-title">
                    <span>المادة: {exam.subject}</span>
                    <span>الصف / الصفوف: {examGrades.length ? examGrades.join(' ، ') : 'كل الصفوف'}</span>
                    <span>الفترة: {exam.period}</span>
                    <span>عدد اللجان: {examCommittees.length}</span>
                 </div>

                 <table className="data-table">
                   <thead>
                     <tr>
                       <th>اللجنة</th>
                       <th>اسم المراقب</th>
                       <th>تسجيل الدخول</th>
                       <th>وقت الاغلاق</th>
                       <th>وقت التسليم</th>
                       <th>البلاغات</th>
                       <th>الحضور</th>
                       <th>الغياب</th>
                       <th>التأخير</th>
                     </tr>
                   </thead>
                   <tbody>
                     {examCommittees.map(cNum => {
                        const supvs = supervisions.filter(s => eqCom(s.committee_number, cNum) && matchesDate(s.date, exam.exam_date) && String(s.period) === String(exam.period));
                        const proctors = supvs.map(s => getProctorName(s.teacher_id));
                        const loginTime = getActualSupervisionStart(supvs);
                        const closeLog = deliveryLogs.find(l => eqCom(l?.committee_number, cNum) && matchesDate(l?.time, exam.exam_date) && l?.type === 'RECEIVE');
                        const receiptLog = deliveryLogs.find(l => eqCom(l?.committee_number, cNum) && matchesDate(l?.time, exam.exam_date) && l?.status === 'CONFIRMED');
                        const comAbsences = absences.filter(a => eqCom(a.committee_number, cNum) && matchesDate(a.date, exam.exam_date) && a.type === 'ABSENT');
                        const comLates = absences.filter(a => eqCom(a.committee_number, cNum) && matchesDate(a.date, exam.exam_date) && a.type === 'LATE');
                        const comRequests = controlRequests.filter(r => eqCom(r.committee, cNum) && matchesDate(r.time, exam.exam_date));
                        const comStudents = examStudents.filter(s => eqCom(s.committee_number, cNum));
                        const absentIds = new Set(comAbsences.map(a => a.student_id));
                        const presentCount = Math.max(comStudents.length - absentIds.size, 0);

                        return (
                          <tr key={cNum}>
                            <td>{cNum}</td>
                            <td>{proctors.length ? proctors.join(' - ') : 'غير محدد'}</td>
                            <td style={{fontFamily: 'monospace'}}>{safeLoginTime(loginTime)}</td>
                            <td style={{fontFamily: 'monospace'}}>{safeTime(closeLog?.time)}</td>
                            <td style={{fontFamily: 'monospace'}}>{safeTime(receiptLog?.time)}</td>
                            <td>{comRequests.length}</td>
                            <td className="count-present">{presentCount}</td>
                            <td className="count-absent">{comAbsences.length}</td>
                            <td className="count-late">{comLates.length}</td>
                          </tr>
                        );
                     })}
                     {examCommittees.length === 0 && (
                       <tr><td colSpan={9}>لا توجد لجان مسجلة لهذه المادة.</td></tr>
                     )}
                   </tbody>
                 </table>

                 <SignatureFooter />
               </div>

                {/* كشوف الطلاب لكل لجنة داخل هذه المادة */}
                {examCommittees.map(cNum => {
                  const comStudents = examStudents.filter(s => eqCom(s.committee_number, cNum)).sort((a,b)=> a.name.localeCompare(b.name, 'ar'));
                  const timeline = getCommitteeTimeline(cNum, exam.exam_date, exam.period);
                  
                  // Split into two columns for the page layout
                  const half = Math.ceil(comStudents.length / 2);
                 const col1 = comStudents.slice(0, half);
                 const col2 = comStudents.slice(half);

                 return (
                   <div className="portfolio-page" key={`${exam.id}-students-${cNum}`}>
                     <OfficialPortfolioHeader
                       title="كشف مناداة ومطابقة الطلاب"
                       meta={<>لجنة: {cNum}<br />المادة: {exam.subject}</>}
                     />

                     <div className="committee-proctor-strip">
                       <div className="operation-card">
                         <p className="label">اسم المراقب</p>
                         <p className="value">{timeline.proctors.length ? timeline.proctors.join(' - ') : 'غير محدد'}</p>
                       </div>
                       <div className="operation-card">
                         <p className="label">دخول المراقب</p>
                         <p className="value">{safeLoginTime(timeline.loginTime)}</p>
                       </div>
                       <div className="operation-card">
                         <p className="label">إغلاق اللجنة</p>
                         <p className="value">{safeTime(timeline.closeLog?.time)}</p>
                       </div>
                     </div>
                      
                      <div className="student-table-container">
                        <table className="data-table" style={{marginTop: 0}}>
                          <thead>
                           <tr>
                             <th style={{width: '28px'}}>م</th>
                             <th>اسم الطالب</th>
                             <th style={{width: '50px'}}>الصف</th>
                             <th style={{width: '36px'}}>الفصل</th>
                             <th style={{width: '58px'}}>المقعد</th>
                             <th style={{width: '56px'}}>الحالة</th>
                           </tr>
                         </thead>
                         <tbody>
                          {col1.map((st, i) => {
                            const status = getStudentExamStatus(st, cNum, exam.exam_date, exam.period);
                            const rowClass = status?.type === 'ABSENT' ? 'student-absent' : status?.type === 'LATE' ? 'student-late' : '';
                            const statusClass = status?.type === 'ABSENT' ? 'status-absent' : status?.type === 'LATE' ? 'status-late' : 'status-present';
                            const statusText = status?.type === 'ABSENT' ? 'غائب' : status?.type === 'LATE' ? 'متأخر' : 'حاضر';
                            return (
                              <tr key={st.id} className={rowClass}>
                                 <td>{i + 1}</td>
                                 <td>{st.name}</td>
                                 <td>{st.grade}</td>
                                 <td>{st.section || '-'}</td>
                                 <td>{st.seating_number || '-'}</td>
                                 <td><span className={`status-pill ${statusClass}`}>{statusText}</span></td>
                               </tr>
                            );
                          })}
                        </tbody>
                      </table>

                       {col2.length > 0 ? (
                         <table className="data-table" style={{marginTop: 0}}>
                           <thead>
                             <tr>
                               <th style={{width: '28px'}}>م</th>
                               <th>اسم الطالب</th>
                               <th style={{width: '50px'}}>الصف</th>
                               <th style={{width: '36px'}}>الفصل</th>
                               <th style={{width: '58px'}}>المقعد</th>
                               <th style={{width: '56px'}}>الحالة</th>
                             </tr>
                           </thead>
                           <tbody>
                             {col2.map((st, i) => {
                               const status = getStudentExamStatus(st, cNum, exam.exam_date, exam.period);
                               const rowClass = status?.type === 'ABSENT' ? 'student-absent' : status?.type === 'LATE' ? 'student-late' : '';
                               const statusClass = status?.type === 'ABSENT' ? 'status-absent' : status?.type === 'LATE' ? 'status-late' : 'status-present';
                               const statusText = status?.type === 'ABSENT' ? 'غائب' : status?.type === 'LATE' ? 'متأخر' : 'حاضر';
                               return (
                                 <tr key={st.id} className={rowClass}>
                                   <td>{i + 1 + half}</td>
                                   <td>{st.name}</td>
                                   <td>{st.grade}</td>
                                   <td>{st.section || '-'}</td>
                                   <td>{st.seating_number || '-'}</td>
                                   <td><span className={`status-pill ${statusClass}`}>{statusText}</span></td>
                                 </tr>
                               );
                             })}
                           </tbody>
                         </table>
                       ) : <div></div>}
                      </div>

                     <div className="committee-receivers-strip">
                       {timeline.receiverNames.length ? timeline.receiverNames.map((name, idx) => (
                         <div className="receiver-card" key={`${name}-${idx}`}>
                           <p className="label">المستلم في الكنترول</p>
                           <p className="name">{name}</p>
                           <p className="time">وقت الاستلام: {timeline.receiptTimes[idx] || timeline.receiptTimes[0] || safeTime(timeline.receiptLog?.time)}</p>
                         </div>
                       )) : (
                         <div className="receiver-card">
                           <p className="label">المستلم في الكنترول</p>
                           <p className="name">---</p>
                           <p className="time">وقت الاستلام: ---</p>
                         </div>
                       )}
                     </div>

                     <div className="footer">تم إنشاء هذا الكشف آلياً عبر نظام الكنترول الرقمي - مدرسة عماد الدين زنكي - بواسطة ياسر الحميدي</div>
                   </div>
                 );
               })}
             </React.Fragment>
           );
        })}

      </div>
      
      {/* عرض المعاينة في الشاشة */}
      {!publicMode && <div className="bg-white rounded-[3rem] p-10 shadow-xl border border-slate-100 flex flex-col items-center justify-center py-20">
         <FileText size={80} className="text-slate-200 mb-6" />
         <h3 className="text-2xl font-black text-slate-800 mb-2">الملف جاهز للطباعة والتصدير</h3>
         <p className="text-slate-500 font-bold mb-8 max-w-md text-center leading-relaxed">
           اضغط على زر (طباعة / تصدير PDF) في الأعلى، وقم باختيار "حفظ كـ PDF" من خيارات الطباعة في متصفحك للحصول على نسختك الرقمية المعتمدة!
         </p>
         <button onClick={handlePrint} className="bg-slate-950 text-white px-8 py-4 rounded-[2rem] font-black flex items-center gap-3 hover:bg-slate-800 transition-all shadow-xl active:scale-95">
           <Download size={20}/> تحميل نسخة PDF
         </button>
      </div>}
    </div>
  );
};
