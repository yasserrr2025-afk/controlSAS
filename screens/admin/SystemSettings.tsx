
import React, { useState } from 'react';
import { RefreshCcw, Database, Users2, History, Clock, Save, Check, Calendar, Settings2, MonitorPlay, ExternalLink, BrainCircuit, Copy, School, ShieldCheck, BookOpen, KeyRound, Trash2 } from 'lucide-react';
import { SystemConfig } from '../../types';

interface Props {
  systemConfig: SystemConfig & { active_exam_date?: string };
  users?: any[];
  setSystemConfig: (cfg: Partial<SystemConfig>) => Promise<void>;
  resetFunctions: {
    students: () => void;
    teachers: () => void;
    operations: () => void;
    fullReset: () => void;
  };
  onAlert: (msg: string, type: any) => void;
}

const FieldLabel = ({ icon: Icon, label }: { icon: any; label: string }) => (
  <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2 tracking-widest mb-2">
    <Icon size={11} />
    {label}
  </label>
);

const AdminSystemSettings: React.FC<Props> = ({ systemConfig, setSystemConfig, resetFunctions, onAlert, users }) => {
  const [tempStartTime, setTempStartTime] = useState(systemConfig.exam_start_time || '08:00');
  const [tempActiveDate, setTempActiveDate] = useState(systemConfig.active_exam_date || new Date().toISOString().split('T')[0]);
  const [tempAcademicYear, setTempAcademicYear] = useState(systemConfig.academic_year || '1446 / 1447');
  const [tempApiKey, setTempApiKey] = useState(systemConfig.openrouter_api_key || '');
  const [tempSchoolName, setTempSchoolName] = useState(systemConfig.school_name || '');
  const [tempDirectorate, setTempDirectorate] = useState(systemConfig.directorate_name || '');
  const [tempPrincipal, setTempPrincipal] = useState(systemConfig.principal_name || '');
  const [tempControlChief, setTempControlChief] = useState(systemConfig.control_chief_id || '');
  const [isSavingCfg, setIsSavingCfg] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const tv2Url = window.location.origin + window.location.pathname + '?tv2=1';

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied('tv2');
    onAlert('تم نسخ الرابط إلى الحافظة', 'success');
    setTimeout(() => setCopied(null), 2000);
  };

  const handleSaveConfig = async () => {
    setIsSavingCfg(true);
    try {
      await setSystemConfig({
        exam_start_time: tempStartTime,
        active_exam_date: tempActiveDate,
        academic_year: tempAcademicYear,
        openrouter_api_key: tempApiKey,
        school_name: tempSchoolName,
        directorate_name: tempDirectorate,
        principal_name: tempPrincipal,
        control_chief_id: tempControlChief
      } as any);
      onAlert('تم حفظ الإعدادات بنجاح', 'success');
    } catch (err: any) {
      onAlert('خطأ أثناء الحفظ: ' + err.message, 'error');
    } finally {
      setIsSavingCfg(false);
    }
  };

  const inputClass = 'w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 font-bold text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 shadow-sm transition-all placeholder:text-slate-300 text-right';

  return (
    <div className="space-y-8 animate-slide-up text-right pb-24">

      {/* Page Header */}
      <div className="flex items-center gap-5">
        <div className="p-4 bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-3xl shadow-lg shadow-blue-500/20">
          <Settings2 size={32} />
        </div>
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">إعدادات النظام</h2>
          <p className="text-slate-400 font-bold mt-1">ضبط بيانات المؤسسة والدورة الاختبارية</p>
        </div>
      </div>

      {/* Section 1: School Identity */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-5 flex items-center gap-4">
          <div className="p-2.5 bg-white/20 rounded-xl"><School size={22} className="text-white" /></div>
          <div>
            <h3 className="text-xl font-black text-white">هوية المؤسسة</h3>
            <p className="text-blue-100 text-xs font-bold mt-0.5">تُغذّي جميع التقارير الرسمية تلقائياً</p>
          </div>
        </div>
        <div className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <FieldLabel icon={School} label="اسم المدرسة" />
              <input type="text" value={tempSchoolName} onChange={(e) => setTempSchoolName(e.target.value)} placeholder="مثال: ثانوية الفضيلة الأولى" className={inputClass} />
            </div>
            <div>
              <FieldLabel icon={BookOpen} label="الإدارة التعليمية" />
              <div className="flex">
                <span className="bg-slate-100 text-slate-500 px-4 flex items-center rounded-r-2xl border border-l-0 border-slate-200 font-bold text-sm shrink-0 whitespace-nowrap">إدارة التعليم بـ</span>
                <input type="text" value={tempDirectorate} onChange={(e) => setTempDirectorate(e.target.value)} placeholder="جدة" className="w-full bg-slate-50 border border-slate-200 border-r-0 rounded-l-2xl px-4 py-4 font-bold text-slate-800 outline-none focus:border-blue-500 transition-all" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
            <div>
              <FieldLabel icon={Users2} label="مدير المدرسة" />
              <input type="text" value={tempPrincipal} onChange={(e) => setTempPrincipal(e.target.value)} placeholder="الاسم الكامل لمدير المدرسة" className={inputClass} />
            </div>
            <div>
              <FieldLabel icon={ShieldCheck} label="رئيس الكنترول" />
              <select value={tempControlChief} onChange={(e) => setTempControlChief(e.target.value)} className={inputClass + ' cursor-pointer appearance-none'}>
                <option value="">— الافتراضي (حسب الصلاحيات) —</option>
                {users && users.filter((u: any) => ['ADMIN', 'CONTROL_MANAGER', 'CONTROL'].includes(u.role)).map((u: any) => (
                  <option key={u.id} value={u.id}>{u.full_name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Exam Session */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-8 py-5 flex items-center gap-4">
          <div className="p-2.5 bg-white/20 rounded-xl"><Calendar size={22} className="text-white" /></div>
          <div>
            <h3 className="text-xl font-black text-white">الدورة الاختبارية</h3>
            <p className="text-emerald-100 text-xs font-bold mt-0.5">ضبط توقيت الجلسات والعام الدراسي</p>
          </div>
        </div>
        <div className="p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <FieldLabel icon={Clock} label="ساعة بدء الجلسة" />
              <input type="time" value={tempStartTime} onChange={(e) => setTempStartTime(e.target.value)} className={inputClass + ' text-center text-xl font-black'} />
            </div>
            <div>
              <FieldLabel icon={Calendar} label="تاريخ اليوم النشط" />
              <input type="date" value={tempActiveDate} onChange={(e) => setTempActiveDate(e.target.value)} className={inputClass + ' text-center font-black'} />
            </div>
            <div>
              <FieldLabel icon={BrainCircuit} label="العام الدراسي" />
              <input type="text" value={tempAcademicYear} onChange={(e) => setTempAcademicYear(e.target.value)} placeholder="1446 / 1447" className={inputClass + ' text-center text-xl font-black'} />
            </div>
          </div>
          <div className="pt-4 border-t border-slate-100">
            <FieldLabel icon={KeyRound} label="مفتاح OpenRouter API — اختياري" />
            <input type="password" placeholder="sk-or-v1-..." value={tempApiKey} onChange={(e) => setTempApiKey(e.target.value)} className={inputClass + ' font-mono'} />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <button onClick={handleSaveConfig} disabled={isSavingCfg} className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-6 rounded-[2rem] font-black text-xl shadow-xl shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-4 active:scale-[0.98] disabled:opacity-60">
        {isSavingCfg ? <RefreshCcw className="animate-spin" size={28} /> : <Save size={28} />}
        {isSavingCfg ? 'جاري الحفظ...' : 'حفظ جميع الإعدادات'}
      </button>

      {/* Section 3: TV2 Link */}
      <div className="bg-gradient-to-br from-[#0d1117] via-[#161b27] to-[#0d1117] rounded-[2.5rem] border border-orange-500/20 shadow-2xl overflow-hidden">
        <div className="px-8 py-5 flex items-center gap-4 border-b border-white/5">
          <div className="p-2.5 bg-orange-500/20 rounded-xl"><MonitorPlay size={22} className="text-orange-400" /></div>
          <div>
            <h3 className="text-xl font-black text-white">شاشة العرض TV2</h3>
            <p className="text-slate-400 text-xs font-bold mt-0.5">رابط عام للعرض الميداني بدون قائمة جانبية</p>
          </div>
        </div>
        <div className="p-8 space-y-4">
          <div className="bg-black/40 border border-white/[0.07] rounded-2xl p-4 text-left dir-ltr overflow-x-auto">
            <code className="text-orange-300 font-mono text-sm whitespace-nowrap">{tv2Url}</code>
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => handleCopy(tv2Url)} className="flex-1 bg-orange-500 hover:bg-orange-400 text-slate-950 px-6 py-3.5 rounded-2xl transition-all flex items-center justify-center gap-3 text-sm font-black shadow-lg shadow-orange-500/20 active:scale-95">
              {copied === 'tv2' ? <Check size={18} /> : <Copy size={18} />}
              {copied === 'tv2' ? 'تم النسخ!' : 'نسخ الرابط'}
            </button>
            <button onClick={() => window.open(tv2Url, '_blank', 'noopener,noreferrer')} className="flex-1 bg-white/[0.07] hover:bg-white/[0.12] text-white px-6 py-3.5 rounded-2xl transition-all flex items-center justify-center gap-3 text-sm font-black border border-white/[0.08] active:scale-95">
              <ExternalLink size={18} />
              فتح TV2
            </button>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-red-100"></div>
          <span className="text-red-400 font-black text-xs uppercase tracking-widest flex items-center gap-2"><Trash2 size={13} /> منطقة الخطر</span>
          <div className="h-px flex-1 bg-red-100"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { id: 'ops', title: 'تصفير العمليات', action: resetFunctions.operations, icon: History, sub: 'حذف غياب واستلامات اليوم النشط فقط' },
            { id: 'stud', title: 'إفراغ الطلاب', action: resetFunctions.students, icon: Database, sub: 'حذف قاعدة بيانات الطلاب نهائياً' },
            { id: 'teach', title: 'حذف الطاقم', action: resetFunctions.teachers, icon: Users2, sub: 'حذف المعلمين باستثناء الإدارة' },
          ].map(item => (
            <button key={item.id} onClick={() => { if (confirm('تحذير: سيتم حذف البيانات المختارة نهائياً. هل أنت متأكد؟')) item.action(); }} className="group bg-white border-2 border-slate-100 p-6 rounded-3xl shadow-sm flex flex-col items-center gap-4 transition-all hover:-translate-y-1 hover:border-red-300 hover:shadow-red-50 duration-300">
              <div className="p-4 bg-slate-50 rounded-2xl group-hover:bg-red-50 transition-colors">
                <item.icon size={36} className="text-slate-300 group-hover:text-red-500 transition-all" />
              </div>
              <div className="text-center">
                <span className="font-black text-lg block text-slate-800">{item.title}</span>
                <span className="text-[10px] font-bold text-slate-400 block mt-1 leading-relaxed px-2">{item.sub}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

    </div>
  );
};

export default AdminSystemSettings;
