
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { APP_CONFIG } from '../constants';
import { db } from '../supabase';
import { ShieldCheck, Download, Smartphone, Share, KeyRound, Fingerprint, Sparkles, School, UserPlus, ArrowRight, Building2 } from 'lucide-react';

interface Props {
  users: User[];
  onLogin: (user: User) => void;
  onAlert: (msg: string, type: any) => void;
}

const Login: React.FC<Props> = ({ onLogin, onAlert }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loginId, setLoginId] = useState('');
  const [schoolCode, setSchoolCode] = useState(localStorage.getItem('activeTenantSlug') || '');
  const [resolvedSchoolName, setResolvedSchoolName] = useState('');
  const [isResolvingSchool, setIsResolvingSchool] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registration, setRegistration] = useState({
    schoolName: '',
    slug: '',
    adminName: '',
    adminNationalId: '',
    adminPhone: ''
  });
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [focused, setFocused] = useState(false);
  const [isSchoolCodeFocused, setIsSchoolCodeFocused] = useState(false);
  const tenantFromUrl = new URLSearchParams(window.location.search).get('tenant') || '';
  const isSchoolLink = !!tenantFromUrl;

  const normalizeSlug = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

  const resolveSchoolName = async (value = schoolCode, options: { silent?: boolean } = {}) => {
    const slug = normalizeSlug(value);
    if (!slug) {
      setResolvedSchoolName('');
      return null;
    }
    setIsResolvingSchool(true);
    try {
      const tenant = await db.tenants.resolveBySlug(slug);
      if (tenant?.name) {
        setResolvedSchoolName(tenant.name);
        setSchoolCode(tenant.slug);
        return tenant;
      }
      setResolvedSchoolName('');
      if (!options.silent) onAlert('رمز المدرسة غير موجود', 'warning');
      return null;
    } catch (err: any) {
      setResolvedSchoolName('');
      if (!options.silent) onAlert(err.message || 'تعذر التحقق من رمز المدرسة', 'error');
      return null;
    } finally {
      setIsResolvingSchool(false);
    }
  };

  useEffect(() => {
    if (tenantFromUrl) {
      const normalized = tenantFromUrl.trim().toLowerCase();
      setMode('login');
      setSchoolCode(normalized);
      localStorage.setItem('activeTenantSlug', normalized);
      resolveSchoolName(normalized, { silent: true });
    }

    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (isIos && !isStandalone) setShowIosHint(true);

    const handler = (e: any) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [tenantFromUrl]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = loginId.trim();
    const tenantSlug = schoolCode.trim().toLowerCase();
    if (!id) { onAlert('يرجى إدخال رقم الهوية', 'warning'); return; }
    if (!tenantSlug) { onAlert('يرجى إدخال رمز المدرسة أو الجهة', 'warning'); return; }
    setIsLoading(true);
    try {
      const user = await db.users.getById(id, tenantSlug);
      if (user) { onAlert(`أهلاً بك، ${user.full_name}`, 'success'); onLogin(user); }
      else onAlert('عذراً! رقم الهوية غير مسجل.', 'error');
    } catch (err: any) {
      onAlert(err.message || 'خطأ في الاتصال بقاعدة البيانات.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegistrationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const schoolName = registration.schoolName.trim();
    const slug = normalizeSlug(registration.slug || registration.schoolName);
    const adminName = registration.adminName.trim();
    const adminNationalId = registration.adminNationalId.trim();

    if (!schoolName) { onAlert('يرجى إدخال اسم المدرسة', 'warning'); return; }
    if (!slug || slug.length < 3) { onAlert('رمز المدرسة يجب أن يكون بالإنجليزية ولا يقل عن 3 أحرف', 'warning'); return; }
    if (!adminName) { onAlert('يرجى إدخال اسم مدير المدرسة', 'warning'); return; }
    if (!adminNationalId) { onAlert('يرجى إدخال رقم هوية المدير', 'warning'); return; }

    setIsRegistering(true);
    try {
      const result = await db.tenants.createSchool({
        schoolName,
        slug,
        adminName,
        adminNationalId,
        adminPhone: registration.adminPhone
      });
      localStorage.setItem('activeTab', 'dashboard');
      window.history.replaceState(null, '', `${window.location.pathname}?tenant=${result.tenant.slug}`);
      onAlert('تم إنشاء المدرسة بنجاح. أهلاً بك في لوحة الإدارة.', 'success');
      onLogin(result.user);
    } catch (err: any) {
      onAlert(err.message || 'تعذر تسجيل المدرسة. تحقق من البيانات وحاول مرة أخرى.', 'error');
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="login-screen min-h-[100dvh] w-full flex flex-col items-center justify-start lg:justify-center bg-[#020917] p-3 sm:p-4 py-4 sm:py-6 font-['Tajawal'] relative overflow-x-hidden overflow-y-auto" dir="rtl">

      {/* ── طبقة خلفية ── */}
      {/* دوائر ضوئية */}
      <div className="absolute top-[-20%] right-[-10%] w-[70%] h-[70%] bg-blue-700/20 rounded-full blur-[180px] pointer-events-none" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-700/15 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40%] h-[40%] bg-blue-900/20 rounded-full blur-[120px] pointer-events-none" />

      {/* شبكة أفقية خفيفة */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{ backgroundImage: 'linear-gradient(#6366f1 1px, transparent 1px), linear-gradient(90deg, #6366f1 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

      {/* ── نص ترحيبي علوي ── */}
      <div className="login-hero relative z-10 text-center mb-3 sm:mb-4 space-y-2 animate-fade-in">
        <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 px-4 sm:px-5 py-2 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] mb-3 sm:mb-4">
          <ShieldCheck size={13} />
          بوابة الدخول الآمن
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tighter leading-tight">
          الكنترول المطور
        </h1>
        <p className="text-slate-500 font-bold text-[10px] sm:text-sm uppercase tracking-[0.18em] sm:tracking-widest">
          Smart Exam Control System
        </p>
      </div>

      {/* ── الكارت الرئيسي ── */}
      <div className="login-card-shell relative z-10 w-full max-w-sm mx-auto animate-slide-up">

        {/* إطار ضوئي خارجي */}
        <div className="absolute -inset-px bg-gradient-to-b from-white/10 via-transparent to-blue-500/20 rounded-[3rem] pointer-events-none" />

        <div className="relative bg-white/[0.04] backdrop-blur-2xl border border-white/10 rounded-[2rem] sm:rounded-[3rem] p-5 sm:p-6 shadow-2xl overflow-hidden">

          {/* توهج داخلي أعلى */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-16 bg-blue-500/10 blur-2xl rounded-full pointer-events-none" />

          {/* ── شعار الوزارة ── */}
          <div className="flex flex-col items-center mb-5">
            <div className="relative mb-3 sm:mb-5">
              {/* هالة ضوئية خلف الشعار */}
              <div className="absolute inset-0 bg-blue-500/20 rounded-[1.8rem] blur-xl scale-125 pointer-events-none" />
              <div className="relative w-18 h-18 bg-white rounded-[1.5rem] p-2.5 shadow-2xl border border-white/20"
                style={{ width: '72px', height: '72px' }}>
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
              {resolvedSchoolName && (
                <p className="text-blue-400/80 font-black text-xs animate-fade-in">
                  {resolvedSchoolName}
                </p>
              )}
            </div>
          </div>

          {/* ── نموذج الدخول ── */}
          <div className={`grid ${isSchoolLink ? 'grid-cols-1' : 'grid-cols-2'} gap-2 bg-white/5 p-1.5 rounded-[1.7rem] mb-5`}>
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`py-3 rounded-[1.3rem] font-black text-xs transition-all flex items-center justify-center gap-2 ${
                mode === 'login' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25' : 'text-white/40 hover:text-white'
              }`}
            >
              <KeyRound size={15} />
              دخول
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`py-3 rounded-[1.3rem] font-black text-xs transition-all ${isSchoolLink ? 'hidden' : 'flex'} items-center justify-center gap-2 ${
                mode === 'register' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-white/40 hover:text-white'
              }`}
            >
              <School size={15} />
              مدرسة جديدة
            </button>
          </div>

          {mode === 'login' ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isSchoolLink && (
              <div className="relative">
                <div className="absolute inset-0 rounded-[1.8rem] bg-white/5 transition-all duration-300" />
                <div className="relative flex items-center">
                  <div className="absolute right-5 text-white/25">
                    <Sparkles size={20} />
                  </div>
                  <input
                    type="text"
                    value={!isSchoolCodeFocused && resolvedSchoolName ? resolvedSchoolName : schoolCode}
                    onChange={(e) => {
                      setSchoolCode(normalizeSlug(e.target.value));
                      setResolvedSchoolName('');
                    }}
                    onFocus={() => setIsSchoolCodeFocused(true)}
                    onBlur={() => {
                      setIsSchoolCodeFocused(false);
                      resolveSchoolName();
                    }}
                    placeholder="رمز المدرسة أو الجهة"
                    className="w-full pr-14 pl-6 py-4 bg-transparent text-white text-center text-base font-black placeholder:text-white/25 outline-none tracking-widest border-0"
                    autoCapitalize="none"
                    dir="ltr"
                  />
                </div>
              </div>
            )}

            {!isSchoolLink && (resolvedSchoolName || isResolvingSchool) && (
              <div className="bg-blue-500/10 border border-blue-500/20 text-blue-300 px-5 py-3 rounded-[1.5rem] text-center">
                <p className="text-[10px] font-black uppercase tracking-widest">
                  {isResolvingSchool ? 'جاري التحقق من المدرسة...' : 'تم التعرف على المدرسة'}
                </p>
                {resolvedSchoolName && (
                  <p className="font-black text-sm mt-1">{resolvedSchoolName}</p>
                )}
              </div>
            )}

            {isSchoolLink && (
              <div className="bg-blue-500/10 border border-blue-500/20 text-blue-300 px-5 py-3 rounded-[1.5rem] text-center">
                <p className="text-[10px] font-black uppercase tracking-widest">رابط دخول المدرسة</p>
                <p className="font-black text-sm mt-1">
                  {resolvedSchoolName || (isResolvingSchool ? 'جاري التحقق...' : schoolCode)}
                </p>
              </div>
            )}

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
                  className="w-full pr-14 pl-6 py-4 bg-transparent text-white text-center text-base font-black placeholder:text-white/25 outline-none tracking-widest border-0"
                  style={{ caretColor: '#3b82f6' }}
                />
              </div>
            </div>

            {/* زر الدخول */}
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full relative py-4 rounded-[1.8rem] font-black text-base transition-all duration-300 overflow-hidden group
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
          ) : (
          <form onSubmit={handleRegistrationSubmit} className="space-y-4">
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 px-5 py-4 rounded-[1.6rem] text-center">
              <p className="font-black text-sm">تسجيل مدرسة جديدة</p>
              <p className="text-[10px] text-emerald-100/70 font-bold mt-1">
                سيتم إنشاء رابط مستقل للمدرسة ومدير نظام أول.
              </p>
            </div>

            <div className="relative">
              <div className="absolute inset-0 rounded-[1.8rem] bg-white/5 transition-all duration-300" />
              <div className="relative flex items-center">
                <div className="absolute right-5 text-white/25">
                  <Building2 size={20} />
                </div>
                <input
                  type="text"
                  value={registration.schoolName}
                  onChange={(e) => {
                    const schoolName = e.target.value;
                    setRegistration((prev) => ({
                      ...prev,
                      schoolName,
                      slug: prev.slug ? prev.slug : normalizeSlug(schoolName)
                    }));
                  }}
                  placeholder="اسم المدرسة"
                  className="w-full pr-14 pl-6 py-4 bg-transparent text-white text-right text-base font-black placeholder:text-white/25 outline-none border-0"
                />
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 rounded-[1.8rem] bg-white/5 transition-all duration-300" />
              <div className="relative flex items-center">
                <div className="absolute right-5 text-white/25">
                  <Sparkles size={20} />
                </div>
                <input
                  type="text"
                  value={registration.slug}
                  onChange={(e) => setRegistration((prev) => ({ ...prev, slug: normalizeSlug(e.target.value) }))}
                  placeholder="رابط المدرسة بالإنجليزية مثل: alnoor-school"
                  className="w-full pr-14 pl-6 py-4 bg-transparent text-white text-center text-sm font-black placeholder:text-white/25 outline-none tracking-widest border-0"
                  autoCapitalize="none"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 rounded-[1.8rem] bg-white/5 transition-all duration-300" />
              <div className="relative flex items-center">
                <div className="absolute right-5 text-white/25">
                  <UserPlus size={20} />
                </div>
                <input
                  type="text"
                  value={registration.adminName}
                  onChange={(e) => setRegistration((prev) => ({ ...prev, adminName: e.target.value }))}
                  placeholder="اسم مدير المدرسة"
                  className="w-full pr-14 pl-6 py-4 bg-transparent text-white text-right text-base font-black placeholder:text-white/25 outline-none border-0"
                />
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 rounded-[1.8rem] bg-white/5 transition-all duration-300" />
              <div className="relative flex items-center">
                <div className="absolute right-5 text-white/25">
                  <Fingerprint size={20} />
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  value={registration.adminNationalId}
                  onChange={(e) => setRegistration((prev) => ({ ...prev, adminNationalId: e.target.value }))}
                  placeholder="هوية المدير للدخول"
                  className="w-full pr-14 pl-6 py-4 bg-transparent text-white text-center text-base font-black placeholder:text-white/25 outline-none tracking-widest border-0"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 rounded-[1.8rem] bg-white/5 transition-all duration-300" />
              <div className="relative flex items-center">
                <div className="absolute right-5 text-white/25">
                  <Smartphone size={20} />
                </div>
                <input
                  type="text"
                  inputMode="tel"
                  value={registration.adminPhone}
                  onChange={(e) => setRegistration((prev) => ({ ...prev, adminPhone: e.target.value }))}
                  placeholder="جوال المدير اختياري"
                  className="w-full pr-14 pl-6 py-4 bg-transparent text-white text-center text-base font-black placeholder:text-white/25 outline-none tracking-widest border-0"
                  dir="ltr"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isRegistering}
              className={`w-full relative py-4 rounded-[1.8rem] font-black text-base transition-all duration-300 overflow-hidden group ${
                isRegistering
                  ? 'bg-emerald-600/50 text-white/50 cursor-wait'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-white active:scale-[0.98] shadow-2xl shadow-emerald-600/20'
              }`}
            >
              <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              <span className="relative flex items-center justify-center gap-3">
                {isRegistering ? (
                  <>
                    <div className="w-5 h-5 border-3 border-white/20 border-t-white rounded-full animate-spin" style={{ borderWidth: '3px' }} />
                    جاري إنشاء المدرسة...
                  </>
                ) : (
                  <>
                    <ArrowRight size={20} />
                    إنشاء المدرسة والدخول
                  </>
                )}
              </span>
            </button>
          </form>
          )}

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
          <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between">
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
        نظام كنترول الاختبارات الموحد
      </p>

      <style>{`
        @keyframes fade-in  { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideUp  { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in    { animation: fade-in  0.6s ease-out both; }
        .animate-slide-up   { animation: slideUp  0.7s ease-out both; }
      `}</style>
    </div>
  );
};

export default Login;
