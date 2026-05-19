
import React from 'react';
import { User } from '../../types';
import { ROLES_ARABIC, APP_CONFIG } from '../../constants';
import { ShieldCheck, UserCircle, Briefcase, Hash, Phone, MapPin, QrCode, Crown } from 'lucide-react';

interface Props {
  user: User;
}

const TeacherBadgeView: React.FC<Props> = ({ user }) => {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${user.national_id}`;
  
  return (
    <div className="flex flex-col items-center justify-center py-12 animate-fade-in no-print bg-slate-50/30 min-h-[80vh] rounded-[4rem]">
      <div className="relative group max-w-sm w-full perspective-2000">
        {/* Glow Background Effect */}
        <div className="absolute -inset-4 bg-gradient-to-tr from-blue-600/20 via-indigo-500/10 to-emerald-400/20 rounded-[4.5rem] blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
        
        {/* Main Card Container */}
        <div className="bg-white rounded-[4rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] border-[12px] border-white overflow-hidden text-center relative z-10 transition-all duration-700 hover:rotate-y-12 hover:-translate-y-2">
          
          {/* Premium Header Segment */}
          <div className="bg-[#020617] p-10 pb-20 text-white relative overflow-hidden">
            {/* Dynamic Light Streaks */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 rounded-full blur-[100px] -mr-32 -mt-32 animate-pulse"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-[80px] -ml-24 -mb-24"></div>
            
            <div className="relative z-10 flex flex-col items-center">
              <div className="bg-white/10 backdrop-blur-md w-24 h-24 rounded-[2rem] flex items-center justify-center p-3 mb-6 shadow-2xl border border-white/20 ring-4 ring-white/5">
                <img src={APP_CONFIG.LOGO_URL} className="w-full h-full object-contain" alt="Logo" />
              </div>
              <h3 className="text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-300">كنترول الاختبارات</h3>
              <div className="flex items-center gap-2 mt-3 opacity-60">
                 <div className="h-[1px] w-4 bg-white/30"></div>
                 <p className="text-[8px] font-black uppercase tracking-[0.5em]">Staff Identity Card</p>
                 <div className="h-[1px] w-4 bg-white/30"></div>
              </div>
            </div>
          </div>

          {/* Identity Body Segment */}
          <div className="p-10 -mt-14 bg-white rounded-t-[4.5rem] relative z-20 space-y-8">
            <div className="flex flex-col items-center">
              {/* Profile Image Frame */}
              <div className="relative">
                <div className="w-40 h-40 bg-white rounded-[3.5rem] p-1.5 border-4 border-slate-50 shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden mb-6 flex items-center justify-center transition-transform duration-500 hover:scale-105 group-hover:shadow-blue-200">
                  <div className="w-full h-full bg-slate-50 rounded-[3rem] flex items-center justify-center relative overflow-hidden">
                     <img src={APP_CONFIG.LOGO_URL} alt="Staff" className="w-24 h-24 object-contain opacity-20" />
                     <UserCircle className="absolute inset-0 w-full h-full text-slate-200 stroke-[1]" />
                  </div>
                </div>
                <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-3 rounded-[1.4rem] shadow-2xl border-4 border-white animate-bounce-subtle">
                  <ShieldCheck size={26} />
                </div>
                {user.role === 'ADMIN' && (
                  <div className="absolute -top-3 -left-3 bg-amber-400 text-white p-2.5 rounded-2xl shadow-xl border-4 border-white rotate-[-15deg]">
                    <Crown size={20} />
                  </div>
                )}
              </div>
              
              {/* Name & Role */}
              <div className="space-y-3">
                <h4 className="text-4xl font-black text-slate-900 tracking-tighter leading-none px-4">{user.full_name}</h4>
                <div className="inline-flex items-center gap-3 bg-blue-600 text-white px-8 py-2.5 rounded-full font-black text-[11px] shadow-lg shadow-blue-200 border-2 border-blue-400/30">
                  <Briefcase size={14} className="text-blue-200" />
                  {ROLES_ARABIC[user.role] || user.role}
                </div>
              </div>
            </div>

            {/* Credential Data Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50/80 p-5 rounded-[2rem] border border-slate-100/50 text-center shadow-inner group/data hover:bg-white hover:shadow-xl transition-all">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center justify-center gap-1">
                   <Hash size={10} /> الرقم المدني
                </p>
                <p className="font-black text-slate-800 text-base font-mono tracking-wider tabular-nums">{user.national_id}</p>
              </div>
              <div className="bg-slate-50/80 p-5 rounded-[2rem] border border-slate-100/50 text-center shadow-inner group/data hover:bg-white hover:shadow-xl transition-all">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center justify-center gap-1">
                   <ShieldCheck size={10} /> حالة التوثيق
                </p>
                <p className="font-black text-emerald-600 text-base flex items-center justify-center gap-1.5">
                   <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></div>
                   نشط
                </p>
              </div>
            </div>

            {/* Smart Verification QR Code */}
            <div className="p-8 bg-slate-50 rounded-[3.5rem] border-2 border-slate-100/50 shadow-inner flex flex-col items-center gap-5 relative group/qr overflow-hidden">
               <div className="absolute inset-0 bg-blue-600 opacity-0 group-hover/qr:opacity-[0.03] transition-opacity"></div>
               <div className="bg-white p-4 rounded-[2.5rem] shadow-2xl border-4 border-white">
                 <img src={qrUrl} alt="QR ID" className="w-40 h-40 mix-blend-multiply relative z-10" />
               </div>
               <div className="space-y-1">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.5em] relative z-10">Scan for cloud validation</p>
                  <p className="text-[7px] font-bold text-slate-300 italic">256-BIT ENCRYPTED SYSTEM ACCESS</p>
               </div>
            </div>
          </div>
          
          {/* Professional Footer */}
          <div className="bg-slate-50/50 py-5 border-t border-slate-100">
             <div className="flex items-center justify-center gap-4 text-slate-300">
                <div className="h-[1px] w-8 bg-slate-200"></div>
                <p className="text-[9px] font-bold tracking-tighter uppercase tracking-[0.2em]">Verified Education Personnel</p>
                <div className="h-[1px] w-8 bg-slate-200"></div>
             </div>
          </div>
        </div>
      </div>
      
      {/* Modern Action Buttons */}
      <div className="flex flex-col md:flex-row gap-4 mt-12 no-print">
        <button 
          onClick={() => window.print()}
          className="bg-slate-900 text-white px-10 py-5 rounded-[2rem] font-black text-lg shadow-2xl hover:bg-black transition-all active:scale-95 flex items-center gap-4 group"
        >
          <div className="bg-white/10 p-2 rounded-xl group-hover:bg-white/20 transition-colors">
            <Hash size={20}/>
          </div>
          طباعة البطاقة الورقية
        </button>
        
        <button 
          onClick={() => {
            if(navigator.share) {
              navigator.share({
                title: 'هويتي الرقمية - كنترول الاختبارات',
                text: `بطاقة المراقب: ${user.full_name}`,
                url: window.location.href
              });
            }
          }}
          className="bg-blue-600 text-white px-10 py-5 rounded-[2rem] font-black text-lg shadow-2xl hover:bg-blue-700 transition-all active:scale-95 flex items-center gap-4 group"
        >
          <div className="bg-white/10 p-2 rounded-xl group-hover:bg-white/20 transition-colors">
            <QrCode size={20}/>
          </div>
          مشاركة الهوية
        </button>
      </div>

      <style>{`
        .perspective-2000 { perspective: 2000px; }
        .rotate-y-12:hover { transform: rotateY(12deg); }
        @keyframes bounce-subtle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        .animate-bounce-subtle {
          animation: bounce-subtle 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default TeacherBadgeView;
