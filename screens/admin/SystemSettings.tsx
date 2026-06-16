
import React, { useState } from 'react';
import { Trash2, ShieldAlert, RefreshCcw, AlertTriangle, Database, Users2, History, Clock, Save, Code, Copy, Check, ShieldCheck, Calendar, Settings2, MonitorPlay, ExternalLink, BrainCircuit } from 'lucide-react';
import { SystemConfig } from '../../types';

interface Props {
  systemConfig: SystemConfig & { active_exam_date?: string };
  setSystemConfig: (cfg: Partial<SystemConfig>) => Promise<void>;
  resetFunctions: {
    students: () => void;
    teachers: () => void;
    operations: () => void;
    fullReset: () => void;
  };
  onAlert: (msg: string, type: any) => void;
}

const AdminSystemSettings: React.FC<Props> = ({ systemConfig, setSystemConfig, resetFunctions, onAlert }) => {
  const [tempStartTime, setTempStartTime] = useState(systemConfig.exam_start_time || '08:00');
  const [tempActiveDate, setTempActiveDate] = useState(systemConfig.active_exam_date || new Date().toISOString().split('T')[0]);
  const [tempAcademicYear, setTempAcademicYear] = useState(systemConfig.academic_year || '1446 / 1447');
  const [tempApiKey, setTempApiKey] = useState(systemConfig.openrouter_api_key || '');
  const [isSavingCfg, setIsSavingCfg] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const tv2Url = `${window.location.origin}${window.location.pathname}?tv2=1`;

  const sqlManualJoinFix = `-- إصلاح وتحديث قاعدة البيانات بالكامل (نسخة الميدان المحدثة V6)
-- 1. جدول إعدادات النظام
DROP TABLE IF EXISTS system_config;
CREATE TABLE system_config (
  id TEXT PRIMARY KEY DEFAULT 'main_config',
  exam_start_time TEXT DEFAULT '08:00',
  exam_date TEXT,
  active_exam_date TEXT DEFAULT CURRENT_DATE::text,
  academic_year TEXT DEFAULT '1446 / 1447',
  allow_manual_join BOOLEAN DEFAULT false,
  openrouter_api_key TEXT
);

INSERT INTO system_config (id, active_exam_date) VALUES ('main_config', CURRENT_DATE::text);

-- 2. جدول التقارير الميدانية التفصيلية
CREATE TABLE IF NOT EXISTS committee_reports (
  id UUID PRIMARY KEY,
  committee_number TEXT NOT NULL,
  proctor_id UUID NOT NULL,
  proctor_name TEXT NOT NULL,
  date TEXT NOT NULL,
  observations TEXT DEFAULT '',
  issues TEXT DEFAULT '',
  resolutions TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. تحديث جدول المستخدمين
ALTER TABLE users ADD COLUMN IF NOT EXISTS assigned_committees TEXT[] DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS assigned_grades TEXT[] DEFAULT '{}';

-- 4. تحديث جدول الطلاب
ALTER TABLE students ADD COLUMN IF NOT EXISTS seating_number TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS committee_number TEXT;

-- 5. تحديث جدول التكليفات
ALTER TABLE supervision ALTER COLUMN date TYPE TEXT;

-- 6. تحديث جدول سجلات الاستلام
ALTER TABLE delivery_logs ADD COLUMN IF NOT EXISTS proctor_name TEXT;
ALTER TABLE delivery_logs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDING';

-- 7. تحديث جدول البلاغات
ALTER TABLE control_requests ADD COLUMN IF NOT EXISTS assistant_name TEXT;`;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    onAlert(id === 'tv2' ? 'تم نسخ رابط TV2 إلى الحافظة' : 'تم نسخ الكود إلى الحافظة', 'success');
    setTimeout(() => setCopied(null), 2000);
  };

  const handleSaveConfig = async () => {
    setIsSavingCfg(true);
    try {
      await setSystemConfig({ 
        exam_start_time: tempStartTime,
        active_exam_date: tempActiveDate,
        academic_year: tempAcademicYear,
        openrouter_api_key: tempApiKey
      } as any);
      onAlert('تم حفظ إعدادات النظام وتحديث التاريخ النشط بنجاح.', 'success');
    } catch (err: any) {
      onAlert('خطأ أثناء الحفظ: ' + err.message, 'error');
    } finally {
      setIsSavingCfg(false);
    }
  };

  return (
    <div className="space-y-10 animate-slide-up text-right pb-20">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">مركز صيانة الهيكل البرمجي</h2>
          <p className="text-slate-400 font-bold italic mt-1 text-lg">إدارة قواعد البيانات وضبط التوقيت الميداني</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-gradient-to-br from-[#0d1117] via-[#161b27] to-[#0d1117] p-8 md:p-10 rounded-[2.5rem] text-white shadow-2xl space-y-6 relative overflow-hidden border border-orange-500/20 lg:col-span-2">
          <div className="absolute -top-20 -left-20 h-60 w-60 rounded-full bg-orange-500/10 blur-[80px]" />
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8 items-center">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-orange-500/90 text-slate-950 rounded-[1.5rem] shadow-[0_0_30px_rgba(249,115,22,0.3)]">
                  <MonitorPlay size={38} />
                </div>
                <div>
                  <h3 className="text-3xl font-black">رابط شاشة العرض TV2</h3>
                  <p className="text-slate-400 font-bold mt-1">رابط عام ديناميكي حسب الاستضافة الحالية، يفتح TV2 مباشرة بدون القائمة الجانبية.</p>
                </div>
              </div>
              <div className="bg-black/40 border border-white/[0.07] rounded-[1.5rem] p-5 text-left dir-ltr overflow-x-auto">
                <code className="text-orange-200 font-mono text-sm whitespace-nowrap">{tv2Url}</code>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
              <button
                onClick={() => handleCopy(tv2Url, 'tv2')}
                className="bg-orange-500 hover:bg-orange-400 text-slate-950 px-7 py-4 rounded-[1.5rem] transition-all flex items-center justify-center gap-3 text-sm font-black shadow-xl shadow-orange-500/20 active:scale-95"
              >
                {copied === 'tv2' ? <Check size={22} /> : <Copy size={22} />}
                {copied === 'tv2' ? 'تم النسخ' : 'نسخ رابط TV2'}
              </button>
              <button
                onClick={() => window.open(tv2Url, '_blank', 'noopener,noreferrer')}
                className="bg-white/[0.07] hover:bg-white/[0.12] text-white px-7 py-4 rounded-[1.5rem] transition-all flex items-center justify-center gap-3 text-sm font-black border border-white/[0.08] active:scale-95"
              >
                <ExternalLink size={22} />
                فتح TV2
              </button>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#0a1a0a] to-[#111c11] p-8 rounded-[2.5rem] text-white shadow-xl space-y-5 relative overflow-hidden border border-emerald-900/30">
          <div className="flex items-center justify-between">
             <h3 className="text-2xl font-black flex items-center gap-4 text-emerald-400"><Code size={32} /> حقن كود SQL الإصلاحي</h3>
             <button 
              onClick={() => handleCopy(sqlManualJoinFix, 'sql')}
              className="bg-white/[0.07] hover:bg-white/[0.12] p-3.5 rounded-xl transition-all flex items-center gap-2 text-sm font-black border border-white/[0.06]"
            >
              {copied === 'sql' ? <Check size={20} className="text-emerald-400"/> : <Copy size={20} />}
              {copied === 'sql' ? 'تم النسخ' : 'نسخ الكود'}
            </button>
          </div>
          <p className="text-sm text-slate-400 leading-relaxed">انسخ الكود التالي ونفذه في SQL Editor داخل Supabase لدعم ميزة التقارير التفصيلية وإصلاح قواعد البيانات.</p>
          <div className="relative group">
            <pre className="bg-black/50 p-8 rounded-3xl font-mono text-[11px] text-blue-300 border border-white/10 overflow-x-auto text-left dir-ltr custom-scrollbar h-64">
              {sqlManualJoinFix}
            </pre>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] shadow-md border border-slate-100 space-y-8 flex flex-col justify-center">
          <div className="flex items-center gap-6">
             <div className="p-4 bg-blue-50 text-blue-600 rounded-[1.5rem] shadow-inner"><Settings2 size={40} /></div>
             <h3 className="text-3xl font-black text-slate-900">الضبط الزمني للدورة</h3>
          </div>
          <div className="space-y-8">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                   <label className="text-[10px] font-black text-slate-400 mr-2 uppercase flex items-center gap-2 tracking-widest"><Clock size={12}/> ساعة بدء الجلسة</label>
                   <input type="time" value={tempStartTime} onChange={(e) => setTempStartTime(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] p-4 font-black text-xl text-center outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 shadow-sm transition-all" />
                </div>
                <div className="space-y-3">
                   <label className="text-[10px] font-black text-slate-400 mr-2 uppercase flex items-center gap-2 tracking-widest"><Calendar size={12}/> تاريخ اليوم النشط</label>
                   <input type="date" value={tempActiveDate} onChange={(e) => setTempActiveDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] p-4 font-black text-xl text-center outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 shadow-sm transition-all" />
                </div>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-slate-100 pt-6">
                <div className="space-y-3">
                   <label className="text-[10px] font-black text-slate-400 mr-2 uppercase flex items-center gap-2 tracking-widest"><BrainCircuit size={12}/> العام الدراسي</label>
                   <input type="text" value={tempAcademicYear} onChange={(e) => setTempAcademicYear(e.target.value)} placeholder="مثال: 1446 / 1447" className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] p-4 font-black text-xl text-center outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 shadow-sm transition-all" />
                </div>
                <div className="space-y-3">
                   <label className="text-[10px] font-black text-slate-400 mr-2 uppercase flex items-center gap-2 tracking-widest"><BrainCircuit size={12}/> مفتاح OpenRouter API (للذكاء الاصطناعي)</label>
                   <input type="password" placeholder="sk-or-v1-..." value={tempApiKey} onChange={(e) => setTempApiKey(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-[1.5rem] p-4 font-bold text-center outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 shadow-sm transition-all" />
                </div>
             </div>
             <button onClick={handleSaveConfig} disabled={isSavingCfg} className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white py-5 rounded-[1.8rem] font-black text-xl shadow-lg shadow-blue-600/20 hover:shadow-blue-600/35 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-4 active:scale-[0.98] disabled:opacity-50">
               {isSavingCfg ? <RefreshCcw className="animate-spin" /> : <Save size={32} />} حفظ الإعدادات المركزية
             </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 px-4 md:px-0">
         {[
           {id: 'ops', title: 'تصفير العمليات', action: resetFunctions.operations, icon: History, sub: 'حذف غياب واستلامات اليوم فقط'},
           {id: 'stud', title: 'إفراغ الطلاب', action: resetFunctions.students, icon: Database, sub: 'حذف قاعدة بيانات الطلاب نهائياً'},
           {id: 'teach', title: 'حذف الطاقم', action: resetFunctions.teachers, icon: Users2, sub: 'حذف المعلمين (باستثناء الإدارة)'}
         ].map(item => (
           <button key={item.id} onClick={() => { if(confirm('تحذير: سيتم حذف البيانات المختارة نهائياً. هل أنت متأكد؟')) item.action(); }} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col items-center gap-4 hover:border-red-400 hover:text-red-600 hover:shadow-red-100/50 transition-all group hover:-translate-y-2 duration-300">
              <div className="p-5 bg-slate-50 rounded-[2rem] group-hover:bg-red-50 transition-colors shadow-inner"><item.icon size={44} className="opacity-30 group-hover:opacity-100 transition-all" /></div>
              <div className="text-center">
                 <span className="font-black text-xl block leading-none">{item.title}</span>
                 <span className="text-[10px] font-bold text-slate-400 block mt-2 uppercase tracking-widest leading-relaxed px-4">{item.sub}</span>
              </div>
           </button>
         ))}
      </div>
    </div>
  );
};

export default AdminSystemSettings;
