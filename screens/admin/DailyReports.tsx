
import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Supervision, User, Student, DeliveryLog, SystemConfig, CommitteeReport, Absence, ControlRequest } from '../../types';
import {
  Printer, FileSpreadsheet, Search, CheckCircle2, Download,
  ClipboardList, Package, AlertTriangle, Trophy, Timer, BellRing, UserRoundCheck
} from 'lucide-react';
import { APP_CONFIG } from '../../constants';

interface Props {
  supervisions?: Supervision[];
  users?: User[];
  students?: Student[];
  deliveryLogs?: DeliveryLog[];
  systemConfig: SystemConfig;
  committeeReports?: CommitteeReport[];
  absences?: Absence[];
  controlRequests?: ControlRequest[];
}

/* ── تصدير CSV ── */
function exportCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const BOM = '\uFEFF';
  const csv = BOM + [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/* ── قراءة الوقت بأمان ── */
function safeTime(isoStr?: string) {
  if (!isoStr) return '---';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '---';
    return d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
  } catch { return '---'; }
}

/* ── مطابقة التاريخ بمرونة ── */
function matchesDate(isoStr: string | undefined | null, date: string): boolean {
  if (!isoStr || !date) return false;
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return String(isoStr).startsWith(date);
    return d.toISOString().startsWith(date);
  } catch { return String(isoStr).startsWith(date); }
}

/* ══════════════════════════════════════════════
   مكوّن الكليشة الرسمية للطباعة
══════════════════════════════════════════════ */
const PrintHeader: React.FC<{ date: string; subject?: string }> = ({ date, subject }) => (
  <div className="w-full border-b-4 border-double border-slate-900 pb-3 mb-4">
    <div className="grid grid-cols-3 items-center gap-2">
      {/* يمين: البيانات الرسمية */}
      <div className="text-[9pt] font-black text-right leading-relaxed space-y-0.5">
        <p>المملكة العربية السعودية</p>
        <p>وزارة التعليم</p>
        <p>إدارة التعليم بمحافظة جدة</p>
        <p>مدرسة عماد الدين زنكي المتوسطة</p>
      </div>
      {/* وسط: شعار */}
      <div className="flex flex-col items-center justify-center">
        <img src={APP_CONFIG.LOGO_URL} alt="شعار" className="w-16 h-16 object-contain" />
        <p className="text-[7pt] text-slate-500 font-black mt-1 text-center">نظام كنترول الاختبارات</p>
      </div>
      {/* يسار: التاريخ والمادة */}
      <div className="text-[9pt] font-bold text-left leading-relaxed space-y-0.5">
        <p>التاريخ: <span className="font-black tabular-nums">{new Date(date).toLocaleDateString('ar-SA')}</span></p>
        <p>اليوم: <span className="font-black">{new Intl.DateTimeFormat('ar-SA', { weekday: 'long' }).format(new Date(date))}</span></p>
        {subject && <p>المادة: <span className="font-black">{subject}</span></p>}
        <p>العام الدراسي: <span className="font-black">1446 / 1447</span></p>
      </div>
    </div>
  </div>
);

/* ══════════════════════════════════════════════
   مكوّن الطباعة: مسير المراقبة والاستلام الميداني
══════════════════════════════════════════════ */
const PrintableMonitorSheet: React.FC<{
  rows: any[];
  date: string;
  subject: string;
}> = ({ rows, date, subject }) => (
  <div className="print-page" style={{ fontFamily: "'Tajawal', Arial", direction: 'rtl', padding: '8mm', color: '#000' }}>
    <PrintHeader date={date} subject={subject} />

    {/* عنوان المستند */}
    <div style={{ textAlign: 'center', marginBottom: '6mm' }}>
      <h2 style={{ fontSize: '13pt', fontWeight: 900, borderBottom: '2px solid #000', display: 'inline-block', padding: '0 20mm', marginBottom: '2mm' }}>
        مسير المراقبة والاستلام الميداني
      </h2>
      <p style={{ fontSize: '8pt', color: '#555' }}>بيان شامل بمواعيد وتوقيعات المراقبين وموظفي الكنترول</p>
    </div>

    {/* الجدول الرئيسي */}
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8pt' }}>
      <thead>
        <tr style={{ background: '#f1f5f9' }}>
          {[
            { label: 'م', w: '5%' },
            { label: 'اللجنة', w: '7%' },
            { label: 'اسم المراقب', w: '18%' },
            { label: 'الصنف', w: '12%' },
            { label: 'وقت الدخول', w: '9%' },
            { label: 'وقت الإغلاق', w: '9%' },
            { label: 'وقت الاستلام', w: '9%' },
            { label: 'المستلم بالكنترول', w: '16%' },
            { label: 'توقيع المراقب', w: '8%' },
            { label: 'توقيع المستلم', w: '8%' },
          ].map(h => (
            <th key={h.label} style={{ border: '1px solid #000', padding: '5px 4px', fontWeight: 900, textAlign: 'center', width: h.w }}>
              {h.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, idx) => (
          <tr key={idx} style={{ height: '22px', background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
            <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'center', fontWeight: 700 }}>{idx + 1}</td>
            <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'center', fontWeight: 900 }}>{row.committee}</td>
            <td style={{ border: '1px solid #000', padding: '3px 6px', fontWeight: 700 }}>{row.proctorName}</td>
            <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'center', fontSize: '7pt', fontWeight: 700 }}>{row.grades > 1 ? `${row.grades} صفوف` : 'صف واحد'}</td>
            <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 700 }}>{row.joinTime}</td>
            <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 700 }}>{row.closeTime}</td>
            <td style={{ border: '1px solid #000', padding: '3px', textAlign: 'center', fontFamily: 'monospace', fontWeight: 700 }}>{row.receiptTime}</td>
            <td style={{ border: '1px solid #000', padding: '3px 6px', fontWeight: row.receiverName !== '—' ? 900 : 400, color: row.receiverName !== '—' ? '#000' : '#999' }}>
              {row.receiverName !== '—' ? row.receiverName : '.....................'}
            </td>
            {/* خانة توقيع المراقب */}
            <td style={{ border: '1px solid #000', padding: '3px' }}>&nbsp;</td>
            {/* خانة توقيع المستلم */}
            <td style={{ border: '1px solid #000', padding: '3px' }}>&nbsp;</td>
          </tr>
        ))}
        {/* صفوف فارغة للاحتياط */}
        {Array.from({ length: Math.max(0, 4 - rows.length) }).map((_, i) => (
          <tr key={`empty-${i}`} style={{ height: '22px' }}>
            {Array.from({ length: 10 }).map((__, j) => (
              <td key={j} style={{ border: '1px solid #000', padding: '3px' }}>&nbsp;</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>

    {/* ملخص إحصائي */}
    <div style={{ marginTop: '6mm', border: '1px solid #000', padding: '4mm', fontSize: '8pt' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', textAlign: 'center' }}>
        {[
          { label: 'إجمالي اللجان', value: rows.length },
          { label: 'مستلمة نظامياً', value: rows.filter(r => r.status === 'CONFIRMED').length },
          { label: 'منتهية (بانتظار)', value: rows.filter(r => r.status === 'CLOSED').length },
          { label: 'لم تُسلَّم بعد', value: rows.filter(r => r.status === 'NOT_STARTED' || r.status === 'ACTIVE').length },
        ].map(s => (
          <div key={s.label} style={{ border: '1px solid #ddd', padding: '4px', borderRadius: '4px' }}>
            <p style={{ fontWeight: 900, fontSize: '14pt', margin: 0 }}>{s.value}</p>
            <p style={{ fontSize: '7pt', color: '#555', margin: 0 }}>{s.label}</p>
          </div>
        ))}
      </div>
    </div>

    {/* خانات التوقيع الرسمية */}
    <div style={{ marginTop: '10mm', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10mm', textAlign: 'center', fontSize: '9pt' }}>
      {[
        { title: 'رئيس لجنة الكنترول', sub: '.............................' },
        { title: 'وكيل شؤون الطلاب', sub: '.............................' },
        { title: 'مدير المدرسة', sub: '(الختم الرسمي)' },
      ].map(sig => (
        <div key={sig.title} style={{ borderTop: '1px solid #000', paddingTop: '10mm' }}>
          <p style={{ fontWeight: 900 }}>{sig.title}</p>
          <p style={{ marginTop: '12mm', color: '#777', fontSize: '8pt' }}>{sig.sub}</p>
        </div>
      ))}
    </div>

    {/* فوتر */}
    <div style={{ marginTop: '8mm', borderTop: '1px dashed #ccc', paddingTop: '3mm', display: 'flex', justifyContent: 'space-between', fontSize: '7pt', color: '#777' }}>
      <span>نظام الكنترول المطور — مدرسة عماد الدين زنكي المتوسطة</span>
      <span>طُبع بتاريخ: {new Date().toLocaleString('ar-SA')}</span>
    </div>
  </div>
);

/* ══════════════════════════════════════════════
   المكوّن الرئيسي
══════════════════════════════════════════════ */
const AdminDailyReports: React.FC<Props> = ({
  supervisions = [], users = [], students = [],
  deliveryLogs = [], systemConfig, committeeReports = [],
  absences = [], controlRequests = []
}) => {
  const [reportDate, setReportDate] = useState(systemConfig.active_exam_date || new Date().toISOString().split('T')[0]);
  const [subject, setSubject] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'SUMMARY' | 'NOTES'>('SUMMARY');
  const [isPrinting, setIsPrinting] = useState(false);

  /* ── بناء بيانات التقرير ── */
  const reportData = useMemo(() => {
    if (!students.length) return [];
    const committees = Array.from(new Set(students.map(s => s?.committee_number)))
      .filter(Boolean).sort((a, b) => Number(a) - Number(b)) as string[];

    return committees.map(num => {
      const sv = supervisions.find(s => String(s?.committee_number) === String(num) && matchesDate(s?.date, reportDate));
      const proctor = users.find(u => u?.id === sv?.teacher_id);
      const closeLog = deliveryLogs.find(l => String(l?.committee_number) === String(num) && matchesDate(l?.time, reportDate) && l?.type === 'RECEIVE');
      const receiptLog = deliveryLogs.find(l => String(l?.committee_number) === String(num) && matchesDate(l?.time, reportDate) && l?.status === 'CONFIRMED');
      const detailedReport = committeeReports.find(r => String(r?.committee_number) === String(num) && r?.date === reportDate);
      const committeeStudents = students.filter(s => String(s.committee_number) === String(num));
      const gradeSet = Array.from(new Set(committeeStudents.map(s => s.grade)));

      return {
        committee: String(num),
        proctorName: proctor?.full_name || '—',
        joinTime: safeTime(sv?.date),
        closeTime: safeTime(closeLog?.time),
        receiptTime: safeTime(receiptLog?.time),
        receiverName: receiptLog?.teacher_name || '—',
        joinAt: sv?.date || '',
        closeAt: closeLog?.time || '',
        receiptAt: receiptLog?.time || '',
        status: receiptLog ? 'CONFIRMED' : closeLog ? 'CLOSED' : sv ? 'ACTIVE' : 'NOT_STARTED',
        totalStudents: committeeStudents.length,
        grades: gradeSet.length,
        observations: detailedReport?.observations || '',
        resolutions: detailedReport?.resolutions || '',
      };
    }).filter(row => {
      if (!searchTerm) return true;
      const s = searchTerm.toLowerCase();
      return row.committee.includes(s) || row.proctorName.toLowerCase().includes(s);
    });
  }, [students, supervisions, users, deliveryLogs, reportDate, searchTerm, committeeReports]);

  const stats = useMemo(() => ({
    total: reportData.length,
    confirmed: reportData.filter(r => r.status === 'CONFIRMED').length,
    closed: reportData.filter(r => r.status === 'CLOSED').length,
    active: reportData.filter(r => r.status === 'ACTIVE').length,
    notStarted: reportData.filter(r => r.status === 'NOT_STARTED').length,
  }), [reportData]);

  const endOfDayInsights = useMemo(() => {
    const minutesBetween = (start?: string, end?: string) => {
      if (!start || !end) return null;
      const diff = new Date(end).getTime() - new Date(start).getTime();
      return Number.isFinite(diff) && diff >= 0 ? Math.round(diff / 60000) : null;
    };

    const completedRows = reportData.filter(r => r.status === 'CONFIRMED');
    const rowsWithReceiptDelay = completedRows
      .map(r => ({
        ...r,
        receiptDelay: minutesBetween(r.closeAt || r.joinAt, r.receiptAt),
        totalDuration: minutesBetween(r.joinAt, r.receiptAt),
      }))
      .filter(r => r.receiptDelay !== null) as Array<any>;

    const fastestReceipt = [...rowsWithReceiptDelay].sort((a, b) => a.receiptDelay - b.receiptDelay)[0];
    const delayedCommittees = [
      ...rowsWithReceiptDelay.filter(r => r.receiptDelay > 10).sort((a, b) => b.receiptDelay - a.receiptDelay).slice(0, 3),
      ...reportData.filter(r => r.status === 'CLOSED').map(r => ({ ...r, receiptDelay: null })).slice(0, 3),
    ].slice(0, 3);

    const alertsByCommittee = controlRequests
      .filter(r => matchesDate(r.time, reportDate))
      .reduce((acc, req) => {
        const key = String(req.committee || 'غير محدد');
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    const topAlertCommittee = Object.entries(alertsByCommittee)
      .sort((a, b) => b[1] - a[1])
      .map(([committee, count]) => ({ committee, count }))[0];

    const absencesByCommittee = absences
      .filter(a => matchesDate(a.date, reportDate))
      .reduce((acc, item) => {
        const key = String(item.committee_number || 'غير محدد');
        if (!acc[key]) acc[key] = { absent: 0, late: 0 };
        if (item.type === 'ABSENT') acc[key].absent += 1;
        if (item.type === 'LATE') acc[key].late += 1;
        return acc;
      }, {} as Record<string, { absent: number; late: number }>);

    const topAttendanceIssue = Object.entries(absencesByCommittee)
      .map(([committee, v]) => ({ committee, total: v.absent + v.late, ...v }))
      .sort((a, b) => b.total - a.total)[0];

    const proctorScores = Object.values(reportData.reduce((acc, row) => {
      if (!row.proctorName || row.proctorName === '—') return acc;
      if (!acc[row.proctorName]) {
        acc[row.proctorName] = { name: row.proctorName, committees: 0, confirmed: 0, totalReceiptDelay: 0, delaySamples: 0, score: 0 };
      }
      const item = acc[row.proctorName];
      item.committees += 1;
      if (row.status === 'CONFIRMED') item.confirmed += 1;
      const delay = minutesBetween(row.closeAt || row.joinAt, row.receiptAt);
      if (delay !== null) {
        item.totalReceiptDelay += delay;
        item.delaySamples += 1;
      }
      item.score = item.confirmed * 30 + Math.max(0, 30 - (item.delaySamples ? item.totalReceiptDelay / item.delaySamples : 30));
      return acc;
    }, {} as Record<string, any>)).sort((a: any, b: any) => b.score - a.score)[0] as any;

    const followUps = [
      ...reportData.filter(r => r.status === 'CLOSED').map(r => `لجنة ${r.committee} أغلقت ولم تستلم نهائياً.`),
      ...reportData.filter(r => r.status === 'NOT_STARTED').map(r => `لجنة ${r.committee} لم تبدأ أو لا يوجد لها إسناد.`),
      ...(topAlertCommittee ? [`لجنة ${topAlertCommittee.committee} لديها أعلى عدد بلاغات (${topAlertCommittee.count}).`] : []),
      ...(topAttendanceIssue ? [`لجنة ${topAttendanceIssue.committee} لديها أكثر حالات حضور تحتاج مراجعة (${topAttendanceIssue.total}).`] : []),
    ].slice(0, 4);

    return {
      fastestReceipt,
      delayedCommittees,
      topAlertCommittee,
      topAttendanceIssue,
      bestProctor: proctorScores,
      followUps,
    };
  }, [absences, controlRequests, reportData, reportDate]);

  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => { window.print(); }, 600);
    window.addEventListener('afterprint', () => setIsPrinting(false), { once: true });
  };

  const handleExport = () => {
    exportCSV(`مسير_مراقبة_${reportDate}.csv`,
      ['اللجنة', 'المراقب', 'وقت الدخول', 'وقت الإغلاق', 'وقت الاستلام', 'المستلم', 'الحالة'],
      reportData.map(r => [
        `لجنة ${r.committee}`, r.proctorName, r.joinTime, r.closeTime,
        r.receiptTime, r.receiverName,
        r.status === 'CONFIRMED' ? 'مستلمة' : r.status === 'CLOSED' ? 'منتهية' : r.status === 'ACTIVE' ? 'نشطة' : 'لم تبدأ',
      ])
    );
  };

  const statusBadge = (s: string) => ({
    CONFIRMED:   { text: 'مستلمة ✓', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    CLOSED:      { text: 'منتهية ⏳', cls: 'bg-amber-100  text-amber-700  border-amber-200'  },
    ACTIVE:      { text: 'نشطة 🟢',  cls: 'bg-blue-100   text-blue-700   border-blue-200'   },
    NOT_STARTED: { text: 'لم تبدأ',  cls: 'bg-slate-100  text-slate-500  border-slate-200'  },
  }[s] || { text: s, cls: 'bg-slate-100 text-slate-400 border-slate-200' });

  return (
    <div className="space-y-8 animate-fade-in text-right pb-32" dir="rtl">

      {/* ── Header البري ── */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-8 rounded-[3rem] shadow-2xl text-white no-print relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 blur-[100px] rounded-full pointer-events-none" />
        <div className="relative z-10 space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-blue-600 p-3.5 rounded-2xl shadow-xl"><FileSpreadsheet size={28} /></div>
              <div>
                <h3 className="text-2xl font-black">مسير المراقبة والاستلام الميداني</h3>
                <p className="text-slate-400 text-xs font-bold mt-0.5">كشف شامل بالتوقيتات وبيانات الاستلام لجميع اللجان</p>
              </div>
            </div>
            <div className="bg-white/10 p-1 rounded-2xl flex gap-1 border border-white/5">
              <button onClick={() => setViewMode('SUMMARY')} className={`px-5 py-2 rounded-xl text-xs font-black transition-all ${viewMode === 'SUMMARY' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-white/5'}`}>
                السجل الزمني
              </button>
              <button onClick={() => setViewMode('NOTES')} className={`px-5 py-2 rounded-xl text-xs font-black transition-all ${viewMode === 'NOTES' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-white/5'}`}>
                الملاحظات
              </button>
            </div>
          </div>

          {/* فلاتر */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input type="date" className="p-4 bg-white/5 border border-white/10 rounded-2xl font-black outline-none focus:border-blue-500 text-white" value={reportDate} onChange={e => setReportDate(e.target.value)} />
            <input type="text" placeholder="اسم المادة (للطباعة)..." className="p-4 bg-white/5 border border-white/10 rounded-2xl font-bold outline-none focus:border-blue-500 text-white placeholder:text-slate-500" value={subject} onChange={e => setSubject(e.target.value)} />
            <div className="relative">
              <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input type="text" placeholder="بحث بمراقب أو لجنة..." className="w-full p-4 pr-11 bg-white/5 border border-white/10 rounded-2xl font-bold outline-none focus:border-blue-500 text-white placeholder:text-slate-500" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
          </div>

          {/* أزرار الإجراء */}
          <div className="flex gap-3 flex-wrap">
            <button onClick={handlePrint} disabled={reportData.length === 0} className="flex-1 md:flex-none bg-blue-600 text-white py-4 px-8 rounded-2xl font-black text-sm shadow-xl flex items-center justify-center gap-2 hover:bg-blue-700 transition-all disabled:opacity-40">
              <Printer size={18} /> {isPrinting ? 'جاري التجهيز...' : 'طباعة المسير (A4)'}
            </button>
            <button onClick={handleExport} disabled={reportData.length === 0} className="flex-1 md:flex-none bg-emerald-600 text-white py-4 px-8 rounded-2xl font-black text-sm shadow-xl flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all disabled:opacity-40">
              <Download size={18} /> تصدير Excel
            </button>
          </div>
        </div>
      </div>

      {/* ── بطاقات الإحصائيات ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 no-print">
        {[
          { label: 'إجمالي اللجان', value: stats.total,      color: 'from-slate-700 to-slate-800', icon: ClipboardList },
          { label: 'مستلمة نظامياً',value: stats.confirmed,  color: 'from-emerald-600 to-emerald-700', icon: CheckCircle2 },
          { label: 'منتهية ⏳',     value: stats.closed,     color: 'from-amber-500 to-orange-600',    icon: Package },
          { label: 'لم تبدأ',      value: stats.notStarted, color: 'from-rose-500 to-rose-700',        icon: AlertTriangle },
        ].map(s => (
          <div key={s.label} className={`bg-gradient-to-br ${s.color} text-white p-5 rounded-3xl shadow-lg`}>
            <s.icon size={22} className="opacity-70 mb-2" />
            <p className="text-4xl font-black tabular-nums">{s.value}</p>
            <p className="text-[10px] font-black uppercase tracking-wider opacity-70 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── إحصاءات نهاية اليوم ── */}
      <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden no-print">
        <div className="p-6 md:p-8 border-b border-slate-100 bg-slate-50/60 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h4 className="text-2xl font-black text-slate-900 flex items-center gap-3">
              <Trophy size={24} className="text-amber-500" />
              إحصاءات نهاية اليوم
            </h4>
            <p className="text-slate-400 font-bold text-xs mt-1">قراءة سريعة تساعد الإدارة على معرفة نقاط التميز والمتابعة.</p>
          </div>
          <span className="bg-slate-900 text-white px-4 py-2 rounded-2xl text-[10px] font-black tabular-nums">{reportDate}</span>
        </div>

        <div className="p-6 md:p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="p-5 rounded-[2rem] bg-amber-50 border border-amber-100">
              <UserRoundCheck size={26} className="text-amber-600 mb-4" />
              <p className="text-[10px] font-black text-amber-700 mb-1">أفضل مراقب</p>
              <p className="text-lg font-black text-slate-900 leading-tight">{endOfDayInsights.bestProctor?.name || 'لا توجد بيانات كافية'}</p>
              <p className="text-[11px] font-bold text-slate-500 mt-2">
                {endOfDayInsights.bestProctor ? `${endOfDayInsights.bestProctor.confirmed} لجنة مستلمة` : 'يظهر بعد اكتمال الاستلامات'}
              </p>
            </div>

            <div className="p-5 rounded-[2rem] bg-emerald-50 border border-emerald-100">
              <Timer size={26} className="text-emerald-600 mb-4" />
              <p className="text-[10px] font-black text-emerald-700 mb-1">أسرع استلام</p>
              <p className="text-lg font-black text-slate-900 leading-tight">
                {endOfDayInsights.fastestReceipt ? `لجنة ${endOfDayInsights.fastestReceipt.committee}` : 'لا توجد بيانات'}
              </p>
              <p className="text-[11px] font-bold text-slate-500 mt-2">
                {endOfDayInsights.fastestReceipt ? `${endOfDayInsights.fastestReceipt.receiptDelay} دقيقة من الإغلاق للاستلام` : 'بانتظار سجلات الاستلام'}
              </p>
            </div>

            <div className="p-5 rounded-[2rem] bg-red-50 border border-red-100">
              <BellRing size={26} className="text-red-600 mb-4" />
              <p className="text-[10px] font-black text-red-700 mb-1">أكثر لجنة بلاغات</p>
              <p className="text-lg font-black text-slate-900 leading-tight">
                {endOfDayInsights.topAlertCommittee ? `لجنة ${endOfDayInsights.topAlertCommittee.committee}` : 'لا توجد بلاغات'}
              </p>
              <p className="text-[11px] font-bold text-slate-500 mt-2">
                {endOfDayInsights.topAlertCommittee ? `${endOfDayInsights.topAlertCommittee.count} بلاغ` : 'الوضع مستقر'}
              </p>
            </div>

            <div className="p-5 rounded-[2rem] bg-blue-50 border border-blue-100">
              <AlertTriangle size={26} className="text-blue-600 mb-4" />
              <p className="text-[10px] font-black text-blue-700 mb-1">أعلى حالات حضور</p>
              <p className="text-lg font-black text-slate-900 leading-tight">
                {endOfDayInsights.topAttendanceIssue ? `لجنة ${endOfDayInsights.topAttendanceIssue.committee}` : 'لا توجد حالات'}
              </p>
              <p className="text-[11px] font-bold text-slate-500 mt-2">
                {endOfDayInsights.topAttendanceIssue ? `${endOfDayInsights.topAttendanceIssue.absent} غياب · ${endOfDayInsights.topAttendanceIssue.late} تأخير` : 'لا يوجد غياب أو تأخير'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-[2rem] border border-slate-100 bg-slate-50/60 p-6">
              <h5 className="font-black text-slate-900 mb-4 flex items-center gap-2"><Package size={18} className="text-orange-500" /> اللجان المتأخرة في الاستلام</h5>
              {endOfDayInsights.delayedCommittees.length ? (
                <div className="space-y-3">
                  {endOfDayInsights.delayedCommittees.map((row: any) => (
                    <div key={`${row.committee}-${row.grade || row.proctorName}`} className="flex items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-100">
                      <div>
                        <p className="font-black text-slate-900">لجنة {row.committee}</p>
                        <p className="text-[11px] font-bold text-slate-400">{row.proctorName}</p>
                      </div>
                      <span className="bg-orange-100 text-orange-700 px-3 py-1.5 rounded-xl text-[10px] font-black">
                        {row.receiptDelay === null ? 'بانتظار الاستلام' : `${row.receiptDelay} دقيقة`}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 font-bold text-sm">لا توجد لجان متأخرة حسب بيانات اليوم.</p>
              )}
            </div>

            <div className="rounded-[2rem] border border-slate-100 bg-slate-50/60 p-6">
              <h5 className="font-black text-slate-900 mb-4 flex items-center gap-2"><ClipboardList size={18} className="text-blue-600" /> نقاط تحتاج متابعة</h5>
              {endOfDayInsights.followUps.length ? (
                <div className="space-y-3">
                  {endOfDayInsights.followUps.map((text, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-100 text-sm font-bold text-slate-700 leading-7">
                      {text}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-emerald-600 font-black text-sm">لا توجد نقاط حرجة مسجلة لهذا اليوم.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── جدول الشاشة ── */}
      <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden no-print">
        {reportData.length === 0 ? (
          <div className="py-32 flex flex-col items-center gap-4">
            <ClipboardList size={56} className="text-slate-200" />
            <p className="text-slate-400 font-black text-xl">لا توجد بيانات لهذا اليوم</p>
            <p className="text-slate-300 text-sm font-bold">
              {students.length === 0 ? 'يرجى رفع بيانات الطلاب أولاً' : `لم يُسجَّل أي نشاط بتاريخ ${reportDate}`}
            </p>
          </div>
        ) : viewMode === 'SUMMARY' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-right min-w-[750px]">
              <thead className="bg-slate-50 border-b">
                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="px-5 py-4">اللجنة</th>
                  <th className="px-5 py-4">المراقب</th>
                  <th className="px-5 py-4 text-center">dخول</th>
                  <th className="px-5 py-4 text-center">إغلاق</th>
                  <th className="px-5 py-4 text-center">استلام</th>
                  <th className="px-5 py-4">المستلم</th>
                  <th className="px-5 py-4 text-center">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {reportData.map((row, idx) => {
                  const st = statusBadge(row.status);
                  return (
                    <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-4">
                        <span className="bg-slate-900 text-white px-3 py-1.5 rounded-xl text-xs font-black">لجنة {row.committee}</span>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-black text-slate-800 text-sm">{row.proctorName}</p>
                        <p className="text-[10px] text-slate-400 font-bold mt-0.5">{row.totalStudents} طالب · {row.grades} {row.grades > 1 ? 'صفوف' : 'صف'}</p>
                      </td>
                      <td className="px-5 py-4 text-center font-black tabular-nums text-blue-600 text-sm">{row.joinTime}</td>
                      <td className="px-5 py-4 text-center font-black tabular-nums text-amber-600 text-sm">{row.closeTime}</td>
                      <td className="px-5 py-4 text-center font-black tabular-nums text-emerald-600 text-sm">{row.receiptTime}</td>
                      <td className="px-5 py-4">
                        <p className="font-black text-slate-700 text-sm">{row.receiverName !== '—' ? row.receiverName : <span className="text-slate-300 italic text-xs">—</span>}</p>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={`inline-block px-3 py-1.5 rounded-xl text-[10px] font-black border ${st.cls}`}>{st.text}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right min-w-[600px]">
              <thead className="bg-slate-50 border-b">
                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="px-6 py-4">اللجنة</th><th className="px-6 py-4">المراقب</th>
                  <th className="px-6 py-4">الملاحظات</th><th className="px-6 py-4">الإجراء المتخذ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {reportData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60">
                    <td className="px-6 py-4"><span className="bg-slate-900 text-white px-3 py-1.5 rounded-xl text-xs font-black">لجنة {row.committee}</span></td>
                    <td className="px-6 py-4 font-black text-slate-700 text-sm">{row.proctorName}</td>
                    <td className="px-6 py-4 text-red-600 font-bold text-sm max-w-xs">{row.observations || <span className="text-slate-300 italic text-xs">لا توجد ملاحظات</span>}</td>
                    <td className="px-6 py-4 text-blue-600 font-bold text-sm max-w-xs">{row.resolutions || <span className="text-slate-300 italic text-xs">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Print Portal ── */}
      {isPrinting && createPortal(
        <div id="daily-report-print">
          <style>{`
            @media print {
              @page { size: A4 landscape; margin: 8mm; }
              body * { visibility: hidden; }
              #daily-report-print, #daily-report-print * { visibility: visible; }
              #daily-report-print { position: absolute; top: 0; left: 0; width: 100%; }
              .print-page { page-break-after: always; }
            }
          `}</style>
          <PrintableMonitorSheet rows={reportData} date={reportDate} subject={subject} />
        </div>,
        document.body
      )}

      <style>{`
        @keyframes fade-in { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .animate-fade-in { animation: fade-in 0.4s ease-out; }
      `}</style>
    </div>
  );
};

export default AdminDailyReports;
