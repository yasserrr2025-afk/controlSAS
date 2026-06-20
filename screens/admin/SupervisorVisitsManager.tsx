import React, { useMemo, useState } from 'react';
import { CheckCircle2, ClipboardCopy, ExternalLink, Loader2, Plus, QrCode, RefreshCw, Trash2, UserRoundCheck } from 'lucide-react';
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

  return (
    <div className="space-y-8 animate-fade-in text-right">
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
