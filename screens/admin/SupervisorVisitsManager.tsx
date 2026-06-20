import React, { useMemo, useState } from 'react';
import { CheckCircle2, ClipboardCopy, ExternalLink, Loader2, Plus, Printer, QrCode, RefreshCw, Trash2, UserRoundCheck, X } from 'lucide-react';
import { SupervisorVisit, User } from '../../types';
import { db } from '../../supabase';

interface Props {
  visits: SupervisorVisit[];
  currentUser: User;
  onRefresh: () => Promise<void>;
  onAlert?: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

const buildVisitUrl = (id: string) => `${window.location.origin}${window.location.pathname}?supervisor_visit=${id}`;
const buildPortfolioUrl = (token?: string) => `${window.location.origin}${window.location.pathname}?supervisor_portfolio=${token || ''}`;

const SupervisorVisitsManager: React.FC<Props> = ({ visits, currentUser, onRefresh, onAlert }) => {
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [qrVisit, setQrVisit] = useState<SupervisorVisit | null>(null);

  const stats = useMemo(() => ({
    total: visits.length,
    pending: visits.filter(v => v.status !== 'SUBMITTED').length,
    submitted: visits.filter(v => v.status === 'SUBMITTED').length,
  }), [visits]);

  const createVisit = async () => {
    setCreating(true);
    try {
      const id = crypto.randomUUID();
      const token = crypto.randomUUID();
      await db.supervisorVisits.upsert({
        id,
        status: 'PENDING',
        visit_time: new Date().toISOString(),
        portfolio_token: token,
        created_by: currentUser.full_name,
        created_at: new Date().toISOString(),
      });
      await onRefresh();
      await navigator.clipboard.writeText(buildVisitUrl(id));
      setCopiedId(id);
      onAlert?.('تم إنشاء رابط زيارة المشرف ونسخه.', 'success');
    } catch (error: any) {
      onAlert?.(error.message || 'تعذر إنشاء رابط الزيارة. تأكد من إضافة جدول supervisor_visits.', 'error');
    } finally {
      setCreating(false);
    }
  };

  const copy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const removeVisit = async (id: string) => {
    if (!confirm('حذف سجل الزيارة؟')) return;
    await db.supervisorVisits.delete(id);
    await onRefresh();
    onAlert?.('تم حذف سجل الزيارة.', 'success');
  };

  const printVisitReport = (visit: SupervisorVisit) => {
    const reportWindow = window.open('', '_blank');
    if (!reportWindow) return;
    const submitted = visit.status === 'SUBMITTED';
    const html = `
      <html dir="rtl">
        <head>
          <title>تقرير زيارة مشرف</title>
          <style>
            @page { size: A4 portrait; margin: 12mm; }
            body { font-family: Arial, sans-serif; color: #0f172a; margin: 0; }
            .page { border: 1.5pt solid #0f172a; padding: 10mm; min-height: 260mm; box-sizing: border-box; }
            .header { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 3px double #0f172a; padding-bottom: 7mm; margin-bottom: 8mm; }
            .side { font-size: 11pt; font-weight: 800; line-height: 1.7; }
            .left { text-align: left; color: #334155; }
            h1 { text-align: center; font-size: 20pt; margin: 0 0 8mm; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 7mm; }
            th, td { border: 1px solid #0f172a; padding: 9px; font-size: 12pt; vertical-align: top; }
            th { background: #f1f5f9; width: 28%; font-weight: 900; }
            .section-title { background: #0f172a; color: white; padding: 8px 12px; font-weight: 900; margin: 8mm 0 3mm; }
            .signature { text-align: center; padding: 8mm; border: 1px solid #cbd5e1; min-height: 30mm; }
            .signature img { max-height: 26mm; max-width: 75mm; object-fit: contain; }
            .footer { margin-top: 12mm; display: flex; justify-content: space-between; font-size: 11pt; font-weight: 900; }
            .muted { color: #64748b; }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="header">
              <div class="side">المملكة العربية السعودية<br/>وزارة التعليم<br/>تقرير زيارة إلكترونية</div>
              <div class="side left">تاريخ الطباعة: ${new Date().toLocaleDateString('ar-SA')}<br/>حالة الزيارة: ${submitted ? 'مكتملة وموقعة' : 'بانتظار تعبئة المشرف'}</div>
            </div>
            <h1>تقرير زيارة مشرف / إدارة</h1>
            <table>
              <tr><th>اسم الزائر</th><td>${visit.visitor_name || 'لم يتم الإدخال بعد'}</td></tr>
              <tr><th>الصفة / الجهة</th><td>${visit.visitor_role || 'لم يتم الإدخال بعد'}</td></tr>
              <tr><th>وسيلة التواصل</th><td>${visit.visitor_contact || '---'}</td></tr>
              <tr><th>وقت الزيارة</th><td>${new Date(visit.visit_time).toLocaleString('ar-SA')}</td></tr>
              <tr><th>نوع الزيارة</th><td>${visit.visit_reason || '---'}</td></tr>
              <tr><th>التقييم العام</th><td>${visit.rating || '---'}</td></tr>
            </table>
            <div class="section-title">الملاحظات</div>
            <table><tr><td>${visit.notes || 'لا توجد ملاحظات مدخلة.'}</td></tr></table>
            <div class="section-title">التوصيات</div>
            <table><tr><td>${visit.recommendations || 'لا توجد توصيات مدخلة.'}</td></tr></table>
            <div class="section-title">التوقيع الإلكتروني</div>
            <div class="signature">${visit.signature ? `<img src="${visit.signature}" />` : '<span class="muted">لم يتم توقيع الزيارة بعد.</span>'}</div>
            <div class="footer">
              <div>أنشئ الرابط بواسطة: ${visit.created_by || currentUser.full_name}</div>
              <div>رقم السجل: ${visit.id}</div>
            </div>
          </div>
          <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 500); }</script>
        </body>
      </html>
    `;
    reportWindow.document.write(html);
    reportWindow.document.close();
  };

  return (
    <div className="space-y-8 animate-fade-in text-right">
      {qrVisit && (
        <div className="fixed inset-0 z-[500] bg-slate-950/70 backdrop-blur-md p-4 flex items-center justify-center">
          <div className="w-full max-w-xl rounded-[3rem] bg-white p-6 md:p-8 shadow-2xl text-center relative">
            <button onClick={() => setQrVisit(null)} className="absolute left-5 top-5 rounded-full bg-slate-100 p-3 text-slate-500 hover:bg-slate-200">
              <X size={22} />
            </button>
            <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
              <QrCode size={34} />
            </div>
            <h3 className="text-2xl md:text-3xl font-black text-slate-950">رمز زيارة المشرف</h3>
            <p className="mt-2 text-sm font-bold text-slate-500">يمكن للمشرف مسح الرمز لتعبئة الزيارة والتوقيع إلكترونياً.</p>
            <div className="my-7 rounded-[2rem] bg-slate-50 p-5 border border-slate-100">
              <img
                alt="QR"
                className="mx-auto h-72 w-72 max-w-full rounded-2xl bg-white p-3 shadow-inner"
                src={`https://api.qrserver.com/v1/create-qr-code/?size=420x420&data=${encodeURIComponent(buildVisitUrl(qrVisit.id))}&color=0f172a`}
              />
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 text-xs font-bold text-slate-500 break-all text-left" dir="ltr">
              {buildVisitUrl(qrVisit.id)}
            </div>
            <button onClick={() => copy(buildVisitUrl(qrVisit.id), `${qrVisit.id}-qr`)} className="mt-5 w-full rounded-2xl bg-slate-950 py-4 font-black text-white flex items-center justify-center gap-3">
              {copiedId === `${qrVisit.id}-qr` ? <CheckCircle2 size={22} /> : <ClipboardCopy size={22} />}
              نسخ الرابط
            </button>
          </div>
        </div>
      )}
      <div className="bg-slate-950 text-white rounded-[3rem] p-8 shadow-2xl border-b-[8px] border-emerald-500 overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,.22),transparent_34%)]" />
        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500 text-slate-950 flex items-center justify-center shadow-xl">
              <UserRoundCheck size={34} />
            </div>
            <div>
              <h2 className="text-3xl font-black tracking-tight">زيارات المشرفين</h2>
              <p className="text-slate-300 font-bold mt-2">أنشئ رابطاً إلكترونياً للمشرف لتوثيق الزيارة والتوقيع من جهازه.</p>
            </div>
          </div>
          <button
            onClick={createVisit}
            disabled={creating}
            className="w-full lg:w-auto bg-emerald-500 text-slate-950 px-7 py-4 rounded-2xl font-black shadow-xl hover:bg-emerald-400 transition-all flex items-center justify-center gap-3 disabled:opacity-60"
          >
            {creating ? <Loader2 className="animate-spin" /> : <Plus />}
            إنشاء رابط زيارة
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[
          ['إجمالي الروابط', stats.total, 'bg-blue-50 text-blue-700'],
          ['بانتظار التعبئة', stats.pending, 'bg-amber-50 text-amber-700'],
          ['مكتملة وموقعة', stats.submitted, 'bg-emerald-50 text-emerald-700'],
        ].map(([label, value, tone]) => (
          <div key={String(label)} className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-md">
            <p className="text-xs font-black text-slate-400 mb-2">{label}</p>
            <p className={`inline-flex min-w-16 items-center justify-center rounded-2xl px-4 py-2 text-3xl font-black ${tone}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xl font-black text-slate-900">سجل روابط الزيارات</h3>
          <button onClick={onRefresh} className="p-3 rounded-xl bg-slate-50 text-slate-500 hover:bg-slate-100">
            <RefreshCw size={18} />
          </button>
        </div>
        <div className="divide-y divide-slate-100">
          {visits.length ? visits.map(visit => {
            const visitUrl = buildVisitUrl(visit.id);
            const portfolioUrl = buildPortfolioUrl(visit.portfolio_token);
            const submitted = visit.status === 'SUBMITTED';
            return (
              <div key={visit.id} className="p-6 flex flex-col xl:flex-row xl:items-center justify-between gap-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black ${submitted ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {submitted ? 'مكتملة وموقعة' : 'بانتظار المشرف'}
                    </span>
                    {submitted && <span className="px-3 py-1 rounded-full text-[10px] font-black bg-slate-100 text-slate-600">{visit.rating || 'بدون تقييم'}</span>}
                  </div>
                  <h4 className="text-xl font-black text-slate-900">{visit.visitor_name || 'رابط زيارة جديد'}</h4>
                  <p className="text-sm font-bold text-slate-500 mt-1">{visit.visitor_role || 'لم يتم إدخال بيانات المشرف بعد'} - {new Date(visit.visit_time).toLocaleString('ar-SA')}</p>
                  {visit.notes && <p className="mt-3 text-sm font-bold text-slate-600 bg-slate-50 rounded-2xl p-3 leading-7">{visit.notes}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => copy(visitUrl, visit.id)} className="px-4 py-3 rounded-xl bg-slate-950 text-white font-black text-sm flex items-center gap-2">
                    {copiedId === visit.id ? <CheckCircle2 size={18} /> : <ClipboardCopy size={18} />}
                    رابط التعبئة
                  </button>
                  <button onClick={() => setQrVisit(visit)} className="px-4 py-3 rounded-xl bg-violet-50 text-violet-700 font-black text-sm flex items-center gap-2">
                    <QrCode size={18} />
                    QR
                  </button>
                  <button onClick={() => printVisitReport(visit)} className="px-4 py-3 rounded-xl bg-slate-100 text-slate-700 font-black text-sm flex items-center gap-2">
                    <Printer size={18} />
                    طباعة التقرير
                  </button>
                  {submitted && (
                    <button onClick={() => copy(portfolioUrl, `${visit.id}-portfolio`)} className="px-4 py-3 rounded-xl bg-emerald-600 text-white font-black text-sm flex items-center gap-2">
                      <QrCode size={18} />
                      رابط الإنجاز
                    </button>
                  )}
                  <a href={submitted ? portfolioUrl : visitUrl} target="_blank" rel="noreferrer" className="px-4 py-3 rounded-xl bg-blue-50 text-blue-700 font-black text-sm flex items-center gap-2">
                    <ExternalLink size={18} />
                    فتح
                  </a>
                  <button onClick={() => removeVisit(visit.id)} className="px-4 py-3 rounded-xl bg-red-50 text-red-600 font-black text-sm">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            );
          }) : (
            <div className="p-14 text-center">
              <UserRoundCheck className="mx-auto text-slate-200 mb-4" size={60} />
              <p className="font-black text-slate-400">لم يتم إنشاء روابط زيارات بعد.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SupervisorVisitsManager;
