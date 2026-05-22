
import React, { useState } from 'react';
import { Trash2, ShieldAlert, RefreshCcw, AlertTriangle, Database, Users2, History, Clock, Save, Code, Copy, Check, ShieldCheck, Calendar, Settings2, MonitorPlay, ExternalLink } from 'lucide-react';
import { SystemConfig } from '../../types';
import { getActiveTenantSlug } from '../../supabase';

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
  const [isSavingCfg, setIsSavingCfg] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const tv2Url = (() => {
    const url = new URL(`${window.location.origin}${window.location.pathname}`);
    url.searchParams.set('tv2', '1');
    const tenantSlug = getActiveTenantSlug();
    if (tenantSlug) url.searchParams.set('tenant', tenantSlug);
    return url.toString();
  })();

  const sqlManualJoinFix = `-- إصلاح وتحديث قاعدة البيانات بالكامل (نسخة الميدان المحدثة V6)
-- 1. جدول إعدادات النظام
DROP TABLE IF EXISTS system_config;
CREATE TABLE system_config (
  id TEXT PRIMARY KEY DEFAULT 'main_config',
  exam_start_time TEXT DEFAULT '08:00',
  exam_date TEXT,
  active_exam_date TEXT DEFAULT CURRENT_DATE::text,
  allow_manual_join BOOLEAN DEFAULT false
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
        active_exam_date: tempActiveDate
      } as any);
      onAlert('تم حفظ إعدادات النظام وتحديث التاريخ النشط بنجاح.', 'success');
    } catch (err: any) {
      onAlert('خطأ أثناء الحفظ: ' + err.message, 'error');
    } finally {
      setIsSavingCfg(false);
    }
  };

  return (
    <div className="space-y-12 animate-slide-up text-right pb-20">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-800 tracking-tighter">مركز صيانة الهيكل البرمجي</h2>
          <p className="text-slate-400 font-bold italic mt-1 text-lg">إدارة قواعد البيانات وضبط التوقيت الميداني</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-gradient-to-br from-slate-950 to-slate-900 p-10 rounded-[4rem] text-white shadow-2xl space-y-8 relative overflow-hidden border-t-8 border-orange-500 lg:col-span-2">
          <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-orange-500/20 blur-[90px]" />
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8 items-center">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="p-5 bg-orange-500 text-slate-950 rounded-[2rem] shadow-[0_0_35px_rgba(249,115,22,0.35)]">
                  <MonitorPlay size={38} />
                </div>
                <div>
                  <h3 className="text-3xl font-black">رابط شاشة العرض TV2</h3>
                  <p className="text-slate-400 font-bold mt-1">رابط عام ديناميكي حسب الاستضافة الحالية، يفتح TV2 مباشرة بدون القائمة الجانبية.</p>
                </div>
              </div>
              <div className="bg-black/30 border border-white/10 rounded-[2rem] p-5 text-left dir-ltr overflow-x-auto">
                <code className="text-orange-200 font-mono text-sm whitespace-nowrap">{tv2Url}</code>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
              <button
                onClick={() => handleCopy(tv2Url, 'tv2')}
                className="bg-orange-500 hover:bg-orange-400 text-slate-950 px-8 py-5 rounded-[2rem] transition-all flex items-center justify-center gap-3 text-sm font-black shadow-xl active:scale-95"
              >
                {copied === 'tv2' ? <Check size={22} /> : <Copy size={22} />}
                {copied === 'tv2' ? 'تم النسخ' : 'نسخ رابط TV2'}
              </button>
              <button
                onClick={() => window.open(tv2Url, '_blank', 'noopener,noreferrer')}
                className="bg-white/10 hover:bg-white/20 text-white px-8 py-5 rounded-[2rem] transition-all flex items-center justify-center gap-3 text-sm font-black border border-white/10 active:scale-95"
              >
                <ExternalLink size={22} />
                فتح TV2
              </button>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 p-10 rounded-[4rem] text-white shadow-2xl space-y-8 relative overflow-hidden border-t-8 border-emerald-500">
          <div className="flex items-center justify-between">
             <h3 className="text-2xl font-black flex items-center gap-4 text-emerald-400"><Code size={32} /> حقن كود SQL الإصلاحي</h3>
             <button 
              onClick={() => handleCopy(sqlManualJoinFix, 'sql')}
              className="bg-white/10 hover:bg-white/20 p-4 rounded-2xl transition-all flex items-center gap-3 text-sm font-black"
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

        <div className="bg-white p-12 rounded-[4rem] shadow-2xl border-2 border-slate-50 space-y-10 flex flex-col justify-center">
          <div className="flex items-center gap-6">
             <div className="p-5 bg-blue-50 text-blue-600 rounded-[2rem] shadow-inner"><Settings2 size={40} /></div>
             <h3 className="text-3xl font-black text-slate-900">الضبط الزمني للدورة</h3>
          </div>
          <div className="space-y-8">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                   <label className="text-[10px] font-black text-slate-400 mr-2 uppercase flex items-center gap-2 tracking-widest"><Clock size={12}/> ساعة بدء الجلسة</label>
                   <input type="time" value={tempStartTime} onChange={(e) => setTempStartTime(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-[1.8rem] p-6 font-black text-2xl text-center outline-none focus:border-blue-600 shadow-inner" />
                </div>
                <div className="space-y-3">
                   <label className="text-[10px] font-black text-slate-400 mr-2 uppercase flex items-center gap-2 tracking-widest"><Calendar size={12}/> تاريخ اليوم النشط</label>
                   <input type="date" value={tempActiveDate} onChange={(e) => setTempActiveDate(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-[1.8rem] p-6 font-black text-2xl text-center outline-none focus:border-blue-600 shadow-inner" />
                </div>
             </div>
             <button onClick={handleSaveConfig} disabled={isSavingCfg} className="w-full bg-blue-600 text-white py-7 rounded-[2.2rem] font-black text-2xl shadow-2xl shadow-blue-200 hover:bg-blue-700 transition-all flex items-center justify-center gap-5 active:scale-95 disabled:opacity-50">
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
           <button key={item.id} onClick={() => { if(confirm('تحذير: سيتم حذف البيانات المختارة نهائياً. هل أنت متأكد؟')) item.action(); }} className="bg-white p-10 rounded-[3.5rem] border-2 border-slate-50 shadow-lg flex flex-col items-center gap-5 hover:border-red-500 hover:text-red-600 transition-all group hover:-translate-y-2">
              <div className="p-6 bg-slate-50 rounded-[2.5rem] group-hover:bg-red-50 transition-colors shadow-inner"><item.icon size={44} className="opacity-30 group-hover:opacity-100 transition-all" /></div>
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
