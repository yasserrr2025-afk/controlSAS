
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { APP_CONFIG } from '../constants';
import { db } from '../supabase';
import { ShieldCheck, Download, Smartphone, Share, KeyRound, Fingerprint, Sparkles } from 'lucide-react';

interface Props {
  users: User[];
  onLogin: (user: User) => void;
  onAlert: (msg: string, type: any) => void;
}

const Login: React.FC<Props> = ({ onLogin, onAlert }) => {
  const [loginId, setLoginId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (isIos && !isStandalone) setShowIosHint(true);

    const handler = (e: any) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = loginId.trim();
    if (!id) { onAlert('يرجى إدخال رقم الهوية', 'warning'); return; }
    setIsLoading(true);
    try {
      const user = await db.users.getById(id);
      if (user) { onAlert(`أهلاً بك، ${user.full_name}`, 'success'); onLogin(user); }
      else onAlert('عذراً! رقم الهوية غير مسجل.', 'error');
    } catch (err: any) {
      onAlert(err.message || 'خطأ في الاتصال بقاعدة البيانات.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#020917] p-4 font-['Tajawal'] relative overflow-hidden" dir="rtl">

      {/* ── طبقة خلفية ── */}
      {/* دوائر ضوئية */}
      <div className="absolute top-[-20%] right-[-10%] w-[70%] h-[70%] bg-blue-700/20 rounded-full blur-[180px] pointer-events-none" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-700/15 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40%] h-[40%] bg-blue-900/20 rounded-full blur-[120px] pointer-events-none" />

      {/* شبكة أفقية خفيفة */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{ backgroundImage: 'linear-gradient(#6366f1 1px, transparent 1px), linear-gradient(90deg, #6366f1 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

      {/* ── نص ترحيبي علوي ── */}
      <div className="relative z-10 text-center mb-8 space-y-2 animate-fade-in">
        <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 px-5 py-2 rounded-full text-xs font-black uppercase tracking-[0.3em] mb-4">
          <ShieldCheck size={13} />
          بوابة الدخول الآمن
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter leading-tight">
          الكنترول المطور
        </h1>
        <p className="text-slate-500 font-bold text-sm uppercase tracking-widest">
          Smart Exam Control System
        </p>
      </div>

      {/* ── الكارت الرئيسي ── */}
      <div className="relative z-10 w-full max-w-sm animate-slide-up">

        {/* إطار ضوئي خارجي */}
        <div className="absolute -inset-px bg-gradient-to-b from-white/10 via-transparent to-blue-500/20 rounded-[3rem] pointer-events-none" />

        <div className="relative bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-[3rem] p-8 shadow-2xl overflow-hidden">

          {/* توهج داخلي أعلى */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-16 bg-blue-500/10 blur-2xl rounded-full pointer-events-none" />

          {/* ── شعار الوزارة ── */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative mb-5">
              {/* هالة ضوئية خلف الشعار */}
              <div className="absolute inset-0 bg-blue-500/20 rounded-[1.8rem] blur-xl scale-125 pointer-events-none" />
              <div className="relative w-22 h-22 bg-white rounded-[1.8rem] p-3 shadow-2xl border border-white/20"
                style={{ width: '88px', height: '88px' }}>
                <img src={APP_CONFIG.LOGO_URL} alt="وزارة التعليم" className="w-full h-full object-contain" />
              </div>
              {/* نقطة تحقق */}
              <div className="absolute -bottom-1.5 -left-1.5 w-7 h-7 bg-emerald-500 rounded-xl border-2 border-[#020917] flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <ShieldCheck size={14} className="text-white" />
              </div>
            </div>

            {/* النص تحت الشعار */}
            <div className="text-center space-y-1.5">
              <p className="text-white/40 font-bold text-[10px] uppercase tracking-[0.3em]">المملكة العربية السعودية</p>
              <p className="text-white/70 font-black text-sm">وزارة التعليم</p>
              <p className="text-white/55 font-bold text-xs">إدارة التعليم بمحافظة جدة</p>
              <p className="text-blue-400/80 font-black text-xs">مدرسة عماد الدين زنكي المتوسطة</p>
            </div>
          </div>

          {/* ── نموذج الدخول ── */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* حقل الهوية */}
            <div className="relative">
              <div className={`absolute inset-0 rounded-[1.8rem] transition-all duration-300 ${focused ? 'bg-blue-500/10 shadow-[0_0_0_2px_rgba(59,130,246,0.5)]' : 'bg-white/5'} rounded-[1.8rem]`} />
              <div className="relative flex items-center">
                <div className={`absolute right-5 transition-colors duration-200 ${focused ? 'text-blue-400' : 'text-white/25'}`}>
                  <Fingerprint size={22} />
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  placeholder="أدخل رقم الهوية الوطنية"
                  className="w-full pr-14 pl-6 py-5 bg-transparent text-white text-center text-lg font-black placeholder:text-white/25 outline-none tracking-widest border-0"
                  style={{ caretColor: '#3b82f6' }}
                />
              </div>
            </div>

            {/* زر الدخول */}
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full relative py-5 rounded-[1.8rem] font-black text-lg transition-all duration-300 overflow-hidden group
                ${isLoading
                  ? 'bg-blue-600/50 text-white/50 cursor-wait'
                  : 'bg-blue-600 hover:bg-blue-500 text-white active:scale-[0.98] shadow-2xl shadow-blue-600/30'
                }`}
            >
              {/* shimmer effect */}
              <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent" />

              <span className="relative flex items-center justify-center gap-3">
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-3 border-white/20 border-t-white rounded-full animate-spin" style={{ borderWidth: '3px' }} />
                    جاري التحقق...
                  </>
                ) : (
                  <>
                    <KeyRound size={20} />
                    دخول النظام
                  </>
                )}
              </span>
            </button>
          </form>

          {/* ── تثبيت التطبيق (Android) ── */}
          {deferredPrompt && (
            <button
              onClick={handleInstallClick}
              className="mt-4 w-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-4 rounded-[1.5rem] font-black text-sm flex items-center justify-center gap-3 hover:bg-emerald-500/20 transition-all"
            >
              <Download size={18} />
              تثبيت الكنترول المطور على جوالك
            </button>
          )}

          {/* ── تعليمات iOS ── */}
          {showIosHint && (
            <div className="mt-4 p-5 bg-blue-500/10 border border-blue-500/20 rounded-[1.5rem] text-right">
              <div className="flex items-center gap-2 text-blue-400 mb-2">
                <Smartphone size={18} />
                <h4 className="font-black text-sm">تثبيت على iPhone</h4>
              </div>
              <p className="text-[11px] font-bold text-slate-400 leading-relaxed">
                اضغط زر المشاركة <Share size={12} className="inline mx-1" /> في الأسفل ثم
                <span className="text-blue-400 font-black"> "إضافة إلى الشاشة الرئيسية"</span>
              </p>
            </div>
          )}

          {/* ── Footer ── */}
          <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
            <p className="text-[9px] text-white/15 font-black tracking-[0.3em] uppercase">V 8.0 SECURE</p>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <p className="text-[9px] text-emerald-500/60 font-black uppercase tracking-wider">LIVE</p>
            </div>
            <p className="text-[9px] text-white/15 font-black tracking-[0.2em] uppercase">Powered by Supabase</p>
          </div>
        </div>
      </div>

      {/* ── نص سفلي ── */}
      <p className="relative z-10 mt-8 text-[10px] text-white/15 font-bold text-center tracking-[0.3em] animate-fade-in">
        مدرسة عماد الدين زنكي المتوسطة · نظام كنترول الاختبارات الموحد
      </p>

      <style>{`
        @keyframes fade-in  { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideUp  { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in    { animation: fade-in  0.6s ease-out both; }
        .animate-slide-up   { animation: slideUp  0.7s ease-out 0.15s both; }
      `}</style>
    </div>
  );
};

export default Login;
