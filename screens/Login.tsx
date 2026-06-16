import React, { useEffect, useState } from 'react';
import { Download, Fingerprint, KeyRound, Share, ShieldCheck, Smartphone } from 'lucide-react';
import { User, UserRole } from '../types';
import { APP_CONFIG } from '../constants';
import { db } from '../supabase';

interface Props {
  users: User[];
  onLogin: (user: User) => void;
  onAlert: (msg: string, type: any) => void;
}

const validRoles: UserRole[] = ['ADMIN', 'CONTROL_MANAGER', 'PROCTOR', 'CONTROL', 'ASSISTANT_CONTROL', 'COUNSELOR'];

const normalizeNationalId = (value: string) =>
  value
    .replace(/[\u0660-\u0669]/g, digit => String(digit.charCodeAt(0) - 1632))
    .replace(/[\u06f0-\u06f9]/g, digit => String(digit.charCodeAt(0) - 1776))
    .replace(/\D/g, '');

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

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
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
    const id = normalizeNationalId(loginId);
    if (!id) {
      onAlert('يرجى إدخال رقم الهوية', 'warning');
      return;
    }
    setIsLoading(true);
    try {
      const user = await db.users.getById(id);
      if (user && validRoles.includes(user.role)) {
        onAlert(`أهلاً بك، ${user.full_name}`, 'success');
        onLogin(user);
      } else if (user) {
        onAlert('تم العثور على المستخدم لكن صلاحية الدخول غير معروفة.', 'error');
      } else {
        onAlert('عذراً! رقم الهوية غير مسجل.', 'error');
      }
    } catch (err: any) {
      onAlert(err.message || 'خطأ في الاتصال بقاعدة البيانات.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center p-4 font-['Tajawal'] relative overflow-hidden"
      dir="rtl"
      style={{
        background: 'linear-gradient(135deg, #020917 0%, #060f22 40%, #0a1530 70%, #020917 100%)',
      }}
    >
      {/* خلفية متحركة */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* توهجات خلفية */}
        <div className="absolute top-[-15%] right-[-5%] w-[65%] h-[65%] rounded-full blur-[200px]"
          style={{ background: 'radial-gradient(circle, rgba(37,99,235,0.18) 0%, transparent 70%)' }} />
        <div className="absolute bottom-[-15%] left-[-5%] w-[55%] h-[55%] rounded-full blur-[180px]"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[45%] h-[45%] rounded-full blur-[150px]"
          style={{ background: 'radial-gradient(circle, rgba(14,165,233,0.08) 0%, transparent 70%)' }} />
        {/* شبكة */}
        <div className="absolute inset-0 bg-grid-dark opacity-40" />
        {/* خط أفقي */}
        <div className="absolute top-1/2 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.15), transparent)' }} />
      </div>

      {/* الهيدر */}
      <div className="relative z-10 text-center mb-8 space-y-3 animate-slide-up">
        <div className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full font-black text-[10px] uppercase tracking-[0.35em] text-blue-300 mb-4"
          style={{
            background: 'rgba(59,130,246,0.1)',
            border: '1px solid rgba(59,130,246,0.2)',
            boxShadow: '0 0 20px rgba(59,130,246,0.1)',
          }}>
          <ShieldCheck size={12} />
          بوابة الدخول الآمن
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter leading-tight">
          الكنترول{' '}
          <span style={{
            background: 'linear-gradient(135deg, #60a5fa, #818cf8)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>المطور</span>
        </h1>
        <p className="text-slate-500 font-bold text-xs uppercase tracking-[0.25em]">
          Smart Exam Control System
        </p>
      </div>

      {/* بطاقة الدخول */}
      <div className="relative z-10 w-full max-w-sm animate-slide-up delay-100">
        {/* إطار توهج خارجي */}
        <div className="absolute -inset-px rounded-[2.5rem] pointer-events-none"
          style={{
            background: 'linear-gradient(135deg, rgba(59,130,246,0.3), transparent 40%, rgba(99,102,241,0.15) 80%, transparent)',
          }} />

        <div
          className="relative rounded-[2.5rem] p-8 overflow-hidden"
          style={{
            background: 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.09)',
            boxShadow: '0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.07)',
          }}
        >
          {/* توهج داخلي */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-20 blur-3xl rounded-full pointer-events-none"
            style={{ background: 'rgba(59,130,246,0.12)' }} />

          {/* قسم المعلومات */}
          <div className="flex flex-col items-center mb-8">
            {/* الشعار */}
            <div className="relative mb-5">
              <div className="absolute inset-0 rounded-[1.6rem] blur-xl scale-125 pointer-events-none"
                style={{ background: 'rgba(59,130,246,0.25)' }} />
              <div
                className="relative rounded-[1.6rem] p-2.5 shadow-2xl"
                style={{
                  background: 'white',
                  width: '86px',
                  height: '86px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.15)',
                }}
              >
                <img src={APP_CONFIG.LOGO_URL} alt="وزارة التعليم" className="w-full h-full object-contain" />
              </div>
              {/* نقطة التحقق */}
              <div
                className="absolute -bottom-1.5 -left-1.5 w-7 h-7 rounded-xl flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  border: '2px solid #020917',
                  boxShadow: '0 0 12px rgba(16,185,129,0.5)',
                }}
              >
                <ShieldCheck size={13} className="text-white" />
              </div>
            </div>

            {/* معلومات المدرسة */}
            <div className="text-center space-y-1">
              <p className="text-white/35 font-black text-[9px] uppercase tracking-[0.35em]">المملكة العربية السعودية</p>
              <p className="text-white/75 font-black text-sm">وزارة التعليم</p>
              <p className="text-white/50 font-bold text-xs">إدارة التعليم بمحافظة جدة</p>
              <p className="font-black text-xs mt-0.5"
                style={{
                  background: 'linear-gradient(135deg, #60a5fa, #818cf8)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}>
                مدرسة عماد الدين زنكي المتوسطة
              </p>
            </div>
          </div>

          {/* نموذج الدخول */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* حقل الهوية */}
            <div className="relative">
              <div
                className="absolute inset-0 rounded-[1.5rem] transition-all duration-300"
                style={{
                  background: focused ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.04)',
                  border: focused ? '1.5px solid rgba(59,130,246,0.5)' : '1.5px solid rgba(255,255,255,0.08)',
                  boxShadow: focused ? '0 0 0 4px rgba(59,130,246,0.12), 0 0 20px rgba(59,130,246,0.08)' : 'none',
                }}
              />
              <div className="relative flex items-center">
                <div className={`absolute right-5 transition-all duration-200 ${focused ? 'text-blue-400' : 'text-white/20'}`}>
                  <Fingerprint size={21} />
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  placeholder="أدخل رقم الهوية الوطنية"
                  className="w-full pr-14 pl-6 py-5 bg-transparent text-white text-center text-lg font-black placeholder:text-white/20 outline-none tracking-widest border-0"
                  style={{ caretColor: '#3b82f6' }}
                />
              </div>
            </div>

            {/* زر الدخول */}
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full relative py-5 rounded-[1.5rem] font-black text-lg transition-all duration-300 overflow-hidden ${
                isLoading
                  ? 'cursor-wait opacity-70'
                  : 'active:scale-[0.97]'
              }`}
              style={isLoading ? {
                background: 'rgba(37,99,235,0.4)',
                color: 'rgba(255,255,255,0.5)',
              } : {
                background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                color: 'white',
                boxShadow: '0 8px 32px rgba(37,99,235,0.4), inset 0 1px 0 rgba(255,255,255,0.15)',
              }}
            >
              {/* تأثير اللمع */}
              {!isLoading && (
                <div className="absolute inset-0 -translate-x-full hover:translate-x-full transition-transform duration-700"
                  style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)' }} />
              )}
              <span className="relative flex items-center justify-center gap-3">
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 rounded-full animate-spin"
                      style={{ borderWidth: '3px', borderStyle: 'solid', borderColor: 'rgba(255,255,255,0.2)', borderTopColor: 'white' }} />
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

          {/* زر التثبيت */}
          {deferredPrompt && (
            <button
              onClick={handleInstallClick}
              className="mt-4 w-full p-4 rounded-[1.4rem] font-black text-sm flex items-center justify-center gap-3 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: 'rgba(16,185,129,0.1)',
                border: '1px solid rgba(16,185,129,0.25)',
                color: '#34d399',
              }}
            >
              <Download size={18} />
              تثبيت الكنترول المطور على جوالك
            </button>
          )}

          {/* تلميح iOS */}
          {showIosHint && (
            <div
              className="mt-4 p-5 rounded-[1.4rem] text-right"
              style={{
                background: 'rgba(59,130,246,0.08)',
                border: '1px solid rgba(59,130,246,0.18)',
              }}
            >
              <div className="flex items-center gap-2 text-blue-400 mb-2">
                <Smartphone size={17} />
                <h4 className="font-black text-sm">تثبيت على iPhone</h4>
              </div>
              <p className="text-[11px] font-bold text-slate-400 leading-relaxed">
                اضغط زر المشاركة <Share size={12} className="inline mx-1" /> ثم اختر
                <span className="text-blue-400 font-black"> إضافة إلى الشاشة الرئيسية</span>
              </p>
            </div>
          )}

          {/* الفوتر */}
          <div className="mt-8 pt-5 flex items-center justify-between"
            style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <p className="text-[9px] text-white/12 font-black tracking-[0.3em] uppercase">V 8.0 SECURE</p>
            <div className="flex items-center gap-1.5">
              <div className="live-dot" style={{ width: '6px', height: '6px' }} />
              <p className="text-[9px] text-emerald-500/50 font-black uppercase tracking-wider">LIVE</p>
            </div>
            <p className="text-[9px] text-white/12 font-black tracking-[0.2em] uppercase">Supabase</p>
          </div>
        </div>
      </div>

      {/* نص سفلي */}
      <p className="relative z-10 mt-8 text-[10px] text-white/12 font-bold text-center tracking-[0.25em] animate-fade-in delay-300">
        مدرسة عماد الدين زنكي المتوسطة · نظام كنترول الاختبارات الموحد
      </p>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .animate-slide-up  { animation: slideUp 0.6s cubic-bezier(0.16,1,0.3,1) both; }
        .animate-fade-in   { animation: fadeIn  0.6s ease-out both; }
        .delay-100 { animation-delay: 100ms; }
        .delay-300 { animation-delay: 300ms; }
        .bg-grid-dark {
          background-image:
            linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
          background-size: 48px 48px;
        }
        .live-dot {
          border-radius: 50%;
          background: #10b981;
          animation: livePulse 1.8s ease-in-out infinite;
        }
        @keyframes livePulse {
          0%   { box-shadow: 0 0 0 0 rgba(16,185,129,0.5); }
          70%  { box-shadow: 0 0 0 6px rgba(16,185,129,0); }
          100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); }
        }
      `}</style>
    </div>
  );
};

export default Login;
