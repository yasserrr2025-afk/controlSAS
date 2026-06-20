import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Award, CheckCircle2, ClipboardList, FileText, Loader2, PenLine, Sparkles, Star, UserRoundCheck } from 'lucide-react';
import { Absence, CommitteeReport, ControlRequest, DeliveryLog, ExamSchedule, Student, Supervision, SupervisorVisit, SystemConfig, User } from '../../types';
import { APP_CONFIG } from '../../constants';
import { db } from '../../supabase';
import { isInternalSignatureRecord, isSignatureRequest } from '../../services/signatures';

interface SharedProps {
  systemConfig: SystemConfig;
  students: Student[];
  users: User[];
  supervisions: Supervision[];
  absences: Absence[];
  deliveryLogs: DeliveryLog[];
  controlRequests: ControlRequest[];
  committeeReports: CommitteeReport[];
  examSchedule: ExamSchedule[];
}

interface VisitFormProps extends SharedProps {
  visitId: string;
}

interface PortfolioProps extends SharedProps {
  token: string;
}

const roleOptions = ['مشرف تربوي', 'مدير مدرسة', 'وكيل مدرسة', 'مشرف إدارة', 'عضو لجنة متابعة', 'أخرى'];
const reasonOptions = ['زيارة متابعة', 'زيارة إشرافية', 'اعتماد أعمال الاختبارات', 'زيارة مفاجئة', 'دعم ومساندة', 'أخرى'];
const ratingOptions = ['ممتاز', 'جيد جداً', 'جيد', 'يحتاج متابعة'];

const formatDateTimeLocal = (value?: string) => {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  const pad = (num: number) => String(num).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const toIsoFromLocal = (value: string) => value ? new Date(value).toISOString() : new Date().toISOString();

const PublicShell: React.FC<{ children: React.ReactNode; title: string; subtitle: string }> = ({ children, title, subtitle }) => (
  <div className="min-h-screen bg-[#f6f8fb] text-right font-['Tajawal']" dir="rtl">
    <div className="relative overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,.28),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,.22),transparent_30%)]" />
      <div className="relative z-10 mx-auto max-w-5xl px-5 py-10 md:py-14">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-5">
            <div className="h-20 w-20 rounded-[2rem] bg-white p-3 shadow-xl">
              <img src={APP_CONFIG.LOGO_URL} className="h-full w-full object-contain" alt="الشعار" />
            </div>
            <div>
              <p className="text-sm font-black text-emerald-300">{subtitle}</p>
              <h1 className="mt-2 text-3xl md:text-5xl font-black tracking-tight">{title}</h1>
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-4 text-center">
            <p className="text-xs font-black text-slate-300">توثيق إلكتروني رسمي</p>
            <p className="mt-1 text-sm font-bold text-white">زيارة مشرف / إدارة</p>
          </div>
        </div>
      </div>
    </div>
    <main className="mx-auto max-w-5xl px-4 py-8 md:px-6">{children}</main>
  </div>
);

const SignaturePad: React.FC<{ value: string; onChange: (value: string) => void }> = ({ value, onChange }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);

  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawing.current = true;
    canvas.setPointerCapture(event.pointerId);
    const ctx = canvas.getContext('2d');
    const point = getPoint(event);
    ctx?.beginPath();
    ctx?.moveTo(point.x, point.y);
  };

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const point = getPoint(event);
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  };

  const stop = () => {
    if (!drawing.current || !canvasRef.current) return;
    drawing.current = false;
    onChange(canvasRef.current.toDataURL('image/png'));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    onChange('');
  };

  useEffect(() => {
    if (!value || !canvasRef.current) return;
    const img = new Image();
    img.onload = () => canvasRef.current?.getContext('2d')?.drawImage(img, 0, 0, canvasRef.current.width, canvasRef.current.height);
    img.src = value;
  }, [value]);

  return (
    <div className="rounded-[2rem] border-2 border-dashed border-slate-200 bg-slate-50 p-3">
      <canvas
        ref={canvasRef}
        width={900}
        height={280}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={stop}
        onPointerCancel={stop}
        className="h-44 w-full touch-none rounded-[1.5rem] bg-white shadow-inner"
      />
      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs font-bold text-slate-400">يرجى التوقيع داخل المساحة البيضاء.</p>
        <button type="button" onClick={clear} className="rounded-xl bg-white px-4 py-2 text-xs font-black text-slate-600 border border-slate-200">مسح التوقيع</button>
      </div>
    </div>
  );
};

export const SupervisorVisitForm: React.FC<VisitFormProps> = (props) => {
  const { visitId, systemConfig } = props;
  const [visit, setVisit] = useState<SupervisorVisit | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    visitor_name: '',
    visitor_role: 'مشرف تربوي',
    visitor_contact: '',
    visit_reason: 'زيارة متابعة',
    visit_time: formatDateTimeLocal(),
    notes: '',
    recommendations: '',
    rating: 'ممتاز',
    signature: '',
  });

  useEffect(() => {
    db.supervisorVisits.getById(visitId)
      .then(data => {
        setVisit(data);
        if (data) {
          setForm(prev => ({
            ...prev,
            visitor_name: data.visitor_name || '',
            visitor_role: data.visitor_role || prev.visitor_role,
            visitor_contact: data.visitor_contact || '',
            visit_reason: data.visit_reason || prev.visit_reason,
            visit_time: formatDateTimeLocal(data.visit_time),
            notes: data.notes || '',
            recommendations: data.recommendations || '',
            rating: data.rating || prev.rating,
            signature: data.signature || '',
          }));
        }
      })
      .catch((err: any) => setError(err.message || 'تعذر فتح رابط الزيارة.'))
      .finally(() => setLoading(false));
  }, [visitId]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!visit) return;
    if (!form.visitor_name.trim() || !form.signature) {
      setError('يلزم إدخال اسم الزائر والتوقيع الإلكتروني قبل الاعتماد.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await db.supervisorVisits.upsert({
        ...visit,
        ...form,
        visitor_name: form.visitor_name.trim(),
        status: 'SUBMITTED',
        visit_time: toIsoFromLocal(form.visit_time),
        signature: form.signature,
        submitted_at: new Date().toISOString(),
      });
      const fresh = await db.supervisorVisits.getById(visit.id);
      setVisit(fresh);
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setError(err.message || 'تعذر اعتماد الزيارة.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <PublicShell title="توثيق زيارة مشرف" subtitle={systemConfig?.school_name || 'نظام الكنترول'}><div className="py-24 text-center"><Loader2 className="mx-auto animate-spin text-blue-600" size={48} /></div></PublicShell>;
  }

  if (!visit) {
    return <PublicShell title="رابط غير متاح" subtitle="تعذر العثور على الزيارة"><div className="rounded-[2rem] bg-white p-10 text-center shadow-xl font-black text-red-600">{error || 'الرابط غير صحيح أو تم حذفه.'}</div></PublicShell>;
  }

  if (submitted || visit.status === 'SUBMITTED') {
    const portfolioUrl = `${window.location.origin}${window.location.pathname}?supervisor_portfolio=${visit.portfolio_token}`;
    return (
      <PublicShell title="تم توثيق الزيارة" subtitle={systemConfig?.school_name || 'نظام الكنترول'}>
        <div className="mx-auto max-w-3xl rounded-[3rem] bg-white p-8 md:p-12 shadow-2xl border border-emerald-100 text-center">
          <div className="mx-auto mb-6 grid h-24 w-24 place-items-center rounded-[2rem] bg-emerald-100 text-emerald-700">
            <CheckCircle2 size={54} />
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-slate-950">شكر وتقدير</h2>
          <p className="mt-5 text-lg md:text-xl font-bold leading-9 text-slate-700">
            تتقدم إدارة المدرسة وفريق الكنترول بخالص الشكر والتقدير لسعادتكم على زيارتكم الكريمة، وما تفضلتم به من ملاحظات وتوجيهات مهنية تسهم في تطوير أعمال الاختبارات وتعزيز جودة الأداء المؤسسي.
          </p>
          <div className="mt-8 rounded-[2rem] bg-slate-50 p-5 text-right">
            <p className="font-black text-slate-900">{visit.visitor_name || form.visitor_name}</p>
            <p className="text-sm font-bold text-slate-500 mt-1">{visit.visitor_role || form.visitor_role} - {visit.rating || form.rating}</p>
          </div>
          <a href={portfolioUrl} className="mt-8 inline-flex items-center justify-center gap-3 rounded-2xl bg-slate-950 px-7 py-4 font-black text-white shadow-xl hover:bg-slate-800 transition-all">
            <FileText size={22} />
            عرض ملف الإنجاز المصغر
          </a>
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell title="توثيق زيارة مشرف" subtitle={systemConfig?.school_name || 'نظام الكنترول'}>
      <form onSubmit={submit} className="mx-auto max-w-4xl rounded-[3rem] bg-white p-5 md:p-9 shadow-2xl border border-slate-100">
        <div className="mb-8 rounded-[2rem] bg-emerald-50 p-5 border border-emerald-100">
          <h2 className="text-2xl font-black text-slate-950">نموذج زيارة إلكتروني</h2>
          <p className="mt-2 text-sm font-bold leading-7 text-slate-600">نأمل تعبئة البيانات التالية، ثم اعتماد الزيارة بالتوقيع الإلكتروني. التاريخ والوقت مسجلان تلقائياً وقابلان للتعديل عند الحاجة.</p>
        </div>

        {error && <div className="mb-5 rounded-2xl bg-red-50 p-4 text-sm font-black text-red-700 border border-red-100">{error}</div>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <label className="space-y-2">
            <span className="text-xs font-black text-slate-400">اسم المشرف / الزائر</span>
            <input value={form.visitor_name} onChange={e => setForm({ ...form, visitor_name: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-bold outline-none focus:border-emerald-500" placeholder="الاسم الثلاثي" />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-black text-slate-400">الصفة / الجهة</span>
            <select value={form.visitor_role} onChange={e => setForm({ ...form, visitor_role: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-bold outline-none focus:border-emerald-500">
              {roleOptions.map(option => <option key={option}>{option}</option>)}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs font-black text-slate-400">رقم الجوال / وسيلة التواصل</span>
            <input value={form.visitor_contact} onChange={e => setForm({ ...form, visitor_contact: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-bold outline-none focus:border-emerald-500" placeholder="اختياري" />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-black text-slate-400">تاريخ ووقت الزيارة</span>
            <input type="datetime-local" value={form.visit_time} onChange={e => setForm({ ...form, visit_time: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-bold outline-none focus:border-emerald-500" />
          </label>
          <label className="space-y-2">
            <span className="text-xs font-black text-slate-400">نوع الزيارة</span>
            <select value={form.visit_reason} onChange={e => setForm({ ...form, visit_reason: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-bold outline-none focus:border-emerald-500">
              {reasonOptions.map(option => <option key={option}>{option}</option>)}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-xs font-black text-slate-400">التقييم العام</span>
            <select value={form.rating} onChange={e => setForm({ ...form, rating: e.target.value })} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-bold outline-none focus:border-emerald-500">
              {ratingOptions.map(option => <option key={option}>{option}</option>)}
            </select>
          </label>
          <label className="md:col-span-2 space-y-2">
            <span className="text-xs font-black text-slate-400">الملاحظات</span>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={4} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-bold outline-none focus:border-emerald-500" placeholder="اكتب ملاحظاتكم حول أعمال الاختبارات..." />
          </label>
          <label className="md:col-span-2 space-y-2">
            <span className="text-xs font-black text-slate-400">التوصيات</span>
            <textarea value={form.recommendations} onChange={e => setForm({ ...form, recommendations: e.target.value })} rows={3} className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 font-bold outline-none focus:border-emerald-500" placeholder="توصياتكم التطويرية..." />
          </label>
        </div>

        <div className="mt-7">
          <div className="mb-3 flex items-center gap-2 text-slate-900">
            <PenLine size={22} />
            <h3 className="font-black text-lg">التوقيع الإلكتروني</h3>
          </div>
          <SignaturePad value={form.signature} onChange={signature => setForm({ ...form, signature })} />
        </div>

        <button disabled={saving} className="mt-8 w-full rounded-[2rem] bg-slate-950 py-5 text-xl font-black text-white shadow-xl hover:bg-slate-800 transition-all disabled:opacity-60">
          {saving ? 'جاري اعتماد الزيارة...' : 'اعتماد الزيارة والتوقيع'}
        </button>
      </form>
    </PublicShell>
  );
};

export const SupervisorMiniPortfolio: React.FC<PortfolioProps> = (props) => {
  const { token, systemConfig, students, supervisions, absences, deliveryLogs, controlRequests, committeeReports, examSchedule } = props;
  const [visit, setVisit] = useState<SupervisorVisit | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    db.supervisorVisits.getByPortfolioToken(token)
      .then(setVisit)
      .finally(() => setLoading(false));
  }, [token]);

  const activeDate = systemConfig.active_exam_date || new Date().toISOString().slice(0, 10);
  const metrics = useMemo(() => ({
    students: students.length,
    committees: new Set(students.map(s => s.committee_number).filter(Boolean)).size,
    proctors: new Set(supervisions.map(s => s.teacher_id)).size,
    absences: absences.filter(a => String(a.date).startsWith(activeDate)).length,
    receipts: deliveryLogs.filter(l => l.status === 'CONFIRMED' && String(l.time).startsWith(activeDate)).length,
    requests: controlRequests.filter(r => !isInternalSignatureRecord(r) && !isSignatureRequest(r) && String(r.time).startsWith(activeDate)).length,
    reports: committeeReports.length,
    exams: examSchedule.filter(e => e.exam_date === activeDate).length,
  }), [students, supervisions, absences, deliveryLogs, controlRequests, committeeReports, examSchedule, activeDate]);

  if (loading) {
    return <PublicShell title="ملف الإنجاز المصغر" subtitle={systemConfig?.school_name || 'نظام الكنترول'}><div className="py-24 text-center"><Loader2 className="mx-auto animate-spin text-blue-600" size={48} /></div></PublicShell>;
  }

  if (!visit || visit.status !== 'SUBMITTED') {
    return <PublicShell title="ملف غير متاح" subtitle="لم يتم اعتماد الزيارة بعد"><div className="rounded-[2rem] bg-white p-10 text-center shadow-xl font-black text-slate-600">هذا الملف يظهر بعد اعتماد زيارة المشرف وتوقيعه.</div></PublicShell>;
  }

  return (
    <PublicShell title="ملف الإنجاز المصغر" subtitle={systemConfig?.school_name || 'نظام الكنترول'}>
      <div className="space-y-6">
        <div className="rounded-[3rem] bg-white p-7 md:p-10 shadow-2xl border border-slate-100">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <p className="text-sm font-black text-emerald-600">زيارة موثقة إلكترونياً</p>
              <h2 className="mt-2 text-3xl font-black text-slate-950">{visit.visitor_name}</h2>
              <p className="mt-1 font-bold text-slate-500">{visit.visitor_role} - {new Date(visit.visit_time).toLocaleString('ar-SA')}</p>
            </div>
            <div className="rounded-2xl bg-emerald-50 px-5 py-4 text-center text-emerald-700 border border-emerald-100">
              <Star className="mx-auto mb-1" />
              <p className="font-black">{visit.rating}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            ['الطلاب', metrics.students, Award],
            ['اللجان', metrics.committees, ClipboardList],
            ['المراقبون', metrics.proctors, UserRoundCheck],
            ['بلاغات اليوم', metrics.requests, Sparkles],
            ['الغياب/التأخير', metrics.absences, FileText],
            ['استلام مؤكد', metrics.receipts, CheckCircle2],
            ['تقارير ميدانية', metrics.reports, FileText],
            ['اختبارات اليوم', metrics.exams, ClipboardList],
          ].map(([label, value, Icon]: any) => (
            <div key={label} className="rounded-[2rem] bg-white p-5 border border-slate-100 shadow-md">
              <Icon className="text-blue-600 mb-3" size={26} />
              <p className="text-3xl font-black text-slate-950">{value}</p>
              <p className="text-xs font-black text-slate-400 mt-1">{label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="rounded-[2rem] bg-white p-6 border border-slate-100 shadow-md">
            <h3 className="font-black text-xl text-slate-900 mb-3">ملاحظات الزيارة</h3>
            <p className="font-bold leading-8 text-slate-600 whitespace-pre-wrap">{visit.notes || 'لا توجد ملاحظات.'}</p>
          </div>
          <div className="rounded-[2rem] bg-white p-6 border border-slate-100 shadow-md">
            <h3 className="font-black text-xl text-slate-900 mb-3">التوصيات</h3>
            <p className="font-bold leading-8 text-slate-600 whitespace-pre-wrap">{visit.recommendations || 'لا توجد توصيات.'}</p>
          </div>
        </div>

        <div className="rounded-[2rem] bg-white p-6 border border-slate-100 shadow-md text-center">
          <p className="text-xs font-black text-slate-400 mb-3">توقيع المشرف</p>
          {visit.signature && <img src={visit.signature} alt="توقيع المشرف" className="mx-auto h-24 object-contain" />}
        </div>
      </div>
    </PublicShell>
  );
};
