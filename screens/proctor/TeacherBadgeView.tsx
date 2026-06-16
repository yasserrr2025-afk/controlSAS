
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
    <div className="flex flex-col items-center justify-center py-12 animate-fade-in no-print bg-slate-50 min-h-screen">
      <div className="relative group max-w-sm w-full perspective-2000">
        {/* Glow Background Effect */}
        <div className="absolute -inset-6 bg-gradient-to-tr from-blue-600/40 via-indigo-500/20 to-blue-400/30 rounded-[4.5rem] blur-3xl opacity-60 group-hover:opacity-100 transition-opacity duration-700"></div>
        <div className="absolute -inset-2 bg-gradient-to-br from-blue-500/10 via-transparent to-indigo-500/10 rounded-[4.5rem] blur-xl"></div>
        
        {/* Main Card Container */}
        <div className="bg-gradient-to-br from-[#020817] via-[#0a1628] to-[#0d1f3c] rounded-[4rem] shadow-[0_32px_80px_-8px_rgba(59,130,246,0.35),0_8px_32px_rgba(0,0,0,0.6)] border border-blue-500/30 overflow-hidden text-center relative z-10 transition-all duration-700 hover:rotate-y-12 hover:-translate-y-2">
          
          {/* Premium Header Segment */}
          <div className="bg-gradient-to-br from-[#010c1a] via-[#020f22] to-[#030e1e] p-10 pb-20 text-white relative overflow-hidden border-b border-blue-500/20">
            {/* Dynamic Light Streaks */}
            <div className="absolute top-0 right-0 w-72 h-72 bg-blue-500/30 rounded-full blur-[120px] -mr-36 -mt-36 animate-pulse"></div>
            <div className="absolute bottom-0 left-0 w-56 h-56 bg-indigo-500/20 rounded-full blur-[90px] -ml-28 -mb-28"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-blue-400/10 rounded-full blur-[60px]"></div>
            
            <div className="relative z-10 flex flex-col items-center">
              <div className="bg-white/10 backdrop-blur-md w-24 h-24 rounded-[2rem] flex items-center justify-center p-3 mb-6 shadow-[0_0_30px_rgba(59,130,246,0.4)] border border-blue-400/30 ring-4 ring-blue-500/10">
                <img src={APP_CONFIG.LOGO_URL} className="w-full h-full object-contain" alt="Logo" />
              </div>
              <h3 className="text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-300 via-indigo-300 to-blue-200 drop-shadow-[0_0_20px_rgba(99,179,237,0.5)]">كنترول الاختبارات</h3>
              <div className="flex items-center gap-2 mt-3 opacity-60">
                 <div className="h-[1px] w-4 bg-white/30"></div>
                 <p className="text-[8px] font-black uppercase tracking-[0.5em]">Staff Identity Card</p>
                 <div className="h-[1px] w-4 bg-white/30"></div>
              </div>
            </div>
          </div>

          {/* Identity Body Segment */}
          <div className="p-10 -mt-14 bg-gradient-to-b from-[#0d1f3c] via-[#0a1628] to-[#08142a] rounded-t-[4.5rem] relative z-20 space-y-8 border-t border-blue-500/10">
            <div className="flex flex-col items-center">
              {/* Profile Image Frame */}
              <div className="relative">
                <div className="w-40 h-40 bg-gradient-to-br from-[#0d1f3c] to-[#1a3355] rounded-[3.5rem] p-1.5 border-2 border-blue-500/40 shadow-[0_0_40px_rgba(59,130,246,0.3),0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden mb-6 flex items-center justify-center transition-transform duration-500 hover:scale-105 hover:shadow-[0_0_60px_rgba(59,130,246,0.5)]">
                  <div className="w-full h-full bg-gradient-to-br from-[#1a3355]/80 to-[#0d1f3c] rounded-[3rem] flex items-center justify-center relative overflow-hidden">
                     <img src={APP_CONFIG.LOGO_URL} alt="Staff" className="w-24 h-24 object-contain opacity-10" />
                     <UserCircle className="absolute inset-0 w-full h-full text-blue-400/40 stroke-[0.8]" />
                  </div>
                </div>
                <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-3 rounded-[1.4rem] shadow-[0_0_20px_rgba(16,185,129,0.5)] border-2 border-emerald-400/50 animate-bounce-subtle">
                  <ShieldCheck size={26} />
                </div>
                {user.role === 'ADMIN' && (
                  <div className="absolute -top-3 -left-3 bg-amber-400 text-white p-2.5 rounded-2xl shadow-[0_0_20px_rgba(245,158,11,0.5)] border-2 border-amber-300/50 rotate-[-15deg]">
                    <Crown size={20} />
                  </div>
                )}
              </div>
              
              {/* Name & Role */}
              <div className="space-y-3">
                <h4 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-white tracking-tighter leading-none px-4 drop-shadow-[0_0_20px_rgba(147,197,253,0.4)]">{user.full_name}</h4>
                <div className="inline-flex items-center gap-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-2.5 rounded-full font-black text-[11px] shadow-[0_4px_20px_rgba(59,130,246,0.5)] border border-blue-400/30">
                  <Briefcase size={14} className="text-blue-200" />
                  {ROLES_ARABIC[user.role] || user.role}
                </div>
              </div>
            </div>

            {/* Credential Data Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 backdrop-blur-sm p-5 rounded-[2rem] border border-blue-500/20 text-center hover:bg-white/10 hover:border-blue-400/40 hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] transition-all duration-300">
                <p className="text-[9px] font-black text-blue-400/70 uppercase tracking-widest mb-1.5 flex items-center justify-center gap-1">
                   <Hash size={10} /> الرقم المدني
                </p>
                <p className="font-black text-blue-100 text-base font-mono tracking-wider tabular-nums">{user.national_id}</p>
              </div>
              <div className="bg-white/5 backdrop-blur-sm p-5 rounded-[2rem] border border-blue-500/20 text-center hover:bg-white/10 hover:border-blue-400/40 hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] transition-all duration-300">
                <p className="text-[9px] font-black text-blue-400/70 uppercase tracking-widest mb-1.5 flex items-center justify-center gap-1">
                   <ShieldCheck size={10} /> حالة التوثيق
                </p>
                <p className="font-black text-emerald-400 text-base flex items-center justify-center gap-1.5">
                   <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></div>
                   نشط
                </p>
              </div>
            </div>

            {/* Smart Verification QR Code */}
            <div className="p-8 bg-gradient-to-br from-[#051020] to-[#0a1a30] rounded-[3.5rem] border border-blue-500/30 shadow-[inset_0_0_30px_rgba(59,130,246,0.05),0_0_40px_rgba(59,130,246,0.1)] flex flex-col items-center gap-5 relative group/qr overflow-hidden">
               <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover/qr:opacity-100 transition-opacity duration-500"></div>
               <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent blur-sm"></div>
               <div className="bg-white p-4 rounded-[2.5rem] shadow-[0_0_40px_rgba(59,130,246,0.4),0_0_80px_rgba(59,130,246,0.2)] border-2 border-blue-400/30 relative">
                 <div className="absolute inset-0 rounded-[2.5rem] bg-blue-400/5"></div>
                 <img src={qrUrl} alt="QR ID" className="w-40 h-40 relative z-10" />
               </div>
               <div className="space-y-1">
                  <p className="text-[8px] font-black text-blue-400/70 uppercase tracking-[0.5em] relative z-10">Scan for cloud validation</p>
                  <p className="text-[7px] font-bold text-blue-300/40 italic">256-BIT ENCRYPTED SYSTEM ACCESS</p>
               </div>
            </div>
          </div>
          
          {/* Professional Footer */}
          <div className="bg-gradient-to-r from-[#020c1a] via-[#051428] to-[#020c1a] py-5 border-t border-blue-500/20">
             <div className="flex items-center justify-center gap-4">
                <div className="h-[1px] w-8 bg-gradient-to-r from-transparent to-blue-500/40"></div>
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-blue-400/50">Verified Education Personnel</p>
                <div className="h-[1px] w-8 bg-gradient-to-l from-transparent to-blue-500/40"></div>
             </div>
          </div>
        </div>
      </div>
      
      {/* Modern Action Buttons */}
      <div className="flex flex-col md:flex-row gap-4 mt-12 no-print">
        <button 
          onClick={() => window.print()}
          className="bg-gradient-to-r from-blue-700 to-indigo-700 text-white px-10 py-5 rounded-[2rem] font-black text-lg shadow-[0_8px_30px_rgba(59,130,246,0.4),0_0_60px_rgba(59,130,246,0.15)] hover:from-blue-600 hover:to-indigo-600 hover:shadow-[0_8px_40px_rgba(59,130,246,0.6)] hover:-translate-y-0.5 transition-all duration-300 active:scale-95 flex items-center gap-4 group border border-blue-400/30"
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
          className="bg-gradient-to-r from-slate-800 to-slate-900 text-white px-10 py-5 rounded-[2rem] font-black text-lg shadow-[0_8px_30px_rgba(0,0,0,0.4)] hover:from-slate-700 hover:to-slate-800 hover:shadow-[0_8px_40px_rgba(0,0,0,0.5)] hover:-translate-y-0.5 transition-all duration-300 active:scale-95 flex items-center gap-4 group border border-white/10"
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
