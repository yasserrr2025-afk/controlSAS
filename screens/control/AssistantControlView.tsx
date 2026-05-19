
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { User, ControlRequest, Absence, Student } from '../../types';
import { 
  Check, ShieldCheck, Loader2, ArrowRightCircle, UserCheck, 
  BellRing, History, Clock, UserX, Activity, CheckCircle, 
  ChevronLeft, MapPin, Fingerprint, ShieldAlert, PhoneOutgoing,
  QrCode, X, Search, Navigation, AlertOctagon, Users, Phone,
  CircleDot, HelpCircle, Volume2, VolumeX
} from 'lucide-react';
import { db } from '../../supabase';
import TeacherBadgeView from '../proctor/TeacherBadgeView';
import { useNotificationSound } from '../../hooks/useNotificationSound';

interface Props {
  user: User;
  requests?: ControlRequest[];
  setRequests: () => Promise<void>;
  absences?: Absence[];
  students?: Student[];
  onAlert: (msg: string, type: string) => void;
  users?: User[];
}

const AssistantControlView: React.FC<Props> = ({ 
  user, 
  requests = [], 
  setRequests, 
  absences = [], 
  students = [], 
  onAlert, 
  users = [] 
}) => {
  const [activeTab, setActiveTab] = useState<'MISSION_CONTROL' | 'FIELD_LOGS' | 'TEAM_RADAR'>('MISSION_CONTROL');
  const [showBadge, setShowBadge] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const prevUrgentCount = useRef(0);
  const { playAlert } = useNotificationSound();

  const teamStatus = useMemo(() => {
    const fieldStaff = users.filter(u => 
      (u.role === 'ASSISTANT_CONTROL' || u.role === 'CONTROL') && u.id !== user.id
    );

    return fieldStaff.map(member => {
      const activeTask = requests.find(r => r.assistant_name === member.full_name && r.status === 'IN_PROGRESS');
      return {
        ...member,
        isBusy: !!activeTask,
        currentCommittee: activeTask?.committee || null,
        currentTask: activeTask?.text || null
      };
    });
  }, [users, requests, user.id]);

  const myRequests = useMemo(() => 
    requests.filter((r: ControlRequest) => user.assigned_committees?.includes(r.committee)), 
  [requests, user]);

  const activeRequests = useMemo(() => 
    myRequests.filter(r => r.status !== 'DONE').sort((a,b) => (b.time || '').localeCompare(a.time || '')),
  [myRequests]);

  const urgentCount = activeRequests.filter(r => r.status === 'PENDING').length;

  /* ── إشعار صوتي عند وصول بلاغ جديد ── */
  useEffect(() => {
    if (!soundEnabled) return;
    if (urgentCount > prevUrgentCount.current) {
      playAlert('alert');
    }
    prevUrgentCount.current = urgentCount;
  }, [urgentCount, soundEnabled]);

  const myCommitteeAbsences = useMemo(() => {
    return absences.filter(a => user.assigned_committees?.includes(a.committee_number));
  }, [absences, user]);

  const updateRequestStatus = async (requestId: string, newStatus: 'IN_PROGRESS' | 'DONE', committee: string) => {
    try {
      await db.controlRequests.updateStatus(requestId, newStatus, user.full_name);
      await setRequests();
      onAlert(`تم تحديث حالة اللجنة ${committee} بنجاح.`, 'success');
    } catch (err: any) {
      onAlert(`خطأ في التحديث: ${err.message}`, 'error');
    }
  };

  if (showBadge) {
    return (
      <div className="animate-fade-in pb-40 text-right">
        <div className="flex items-center justify-between mb-8 px-6 no-print">
          <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
            <Fingerprint className="text-blue-600" /> الهوية الرقمية للمساعد
          </h2>
          <button onClick={() => setShowBadge(false)} className="p-4 bg-slate-900 text-white rounded-[1.5rem] shadow-xl active:scale-95 transition-all flex items-center gap-2 font-black">
            <ChevronLeft size={20}/> رجوع للمهام
          </button>
        </div>
        <TeacherBadgeView user={user} />
      </div>
    );
  }
  
  return (
    <div className="space-y-8 animate-fade-in text-right pb-48 max-w-7xl mx-auto px-4">
       <div className="bg-slate-950 p-10 md:p-14 rounded-[4rem] text-white shadow-2xl relative overflow-hidden group border-b-[12px] border-blue-600">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/10 blur-[150px] rounded-full -mr-48 -mt-48"></div>
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-10">
             <div className="space-y-6 flex-1">
                <div className="flex items-center gap-6">
                   <div className="bg-blue-600 p-5 rounded-[2.2rem] shadow-2xl animate-pulse ring-4 ring-blue-500/20">
                      <Navigation size={40} className="text-white" />
                   </div>
                   <div>
                      <h2 className="text-4xl md:text-6xl font-black tracking-tighter">وحدة التدخل الميداني</h2>
                      <p className="text-blue-400 font-bold text-base tracking-widest uppercase mt-2">Field Ops Division</p>
                   </div>
                </div>
                <div className="flex flex-wrap gap-3">
                   {user.assigned_committees?.map((c: string) => (
                     <div key={c} className="bg-white/5 border border-white/10 px-6 py-3 rounded-2xl flex items-center gap-3 hover:bg-white/10 transition-colors">
                        <MapPin size={16} className="text-blue-500"/>
                        <span className="text-sm font-black">نطاق عمل: لجنة {c}</span>
                     </div>
                   ))}
                </div>
             </div>
             <div className="flex gap-4">
             <div className="flex gap-4 items-center">
              <button
                onClick={() => setSoundEnabled(p => !p)}
                title={soundEnabled ? 'كتم الإشعارات الصوتية' : 'تفعيل الإشعارات الصوتية'}
                className={`p-4 rounded-2xl transition-all border ${soundEnabled ? 'bg-white/10 border-white/10 text-white hover:bg-white/20' : 'bg-red-500/20 border-red-500/30 text-red-400'}`}
              >
                {soundEnabled ? <Volume2 size={22} /> : <VolumeX size={22} />}
              </button>
              <div className="bg-white/5 border border-white/10 p-8 rounded-[3rem] text-center min-w-[160px] shadow-inner relative overflow-hidden group">
                 {urgentCount > 0 && <div className="absolute top-0 left-0 w-full h-1 bg-red-500 animate-pulse"></div>}
                 <p className="text-[10px] font-black uppercase text-slate-500 mb-2">طلبات معلقة</p>
                 <p className={`text-6xl font-black tabular-nums ${urgentCount > 0 ? 'text-red-500' : 'text-white'}`}>{urgentCount}</p>
                 {urgentCount > 0 && <div className="absolute inset-0 rounded-[3rem] ring-2 ring-red-500/50 animate-ping pointer-events-none" />}
              </div>
           </div>
             </div>
          </div>
       </div>

       <div className="flex justify-center mb-10 overflow-x-auto custom-scrollbar pb-2">
          <div className="bg-white p-2 rounded-[2.5rem] shadow-xl border flex gap-2 w-full max-w-xl shrink-0">
             <button onClick={() => setActiveTab('MISSION_CONTROL')} className={`flex-1 py-4 px-6 rounded-[1.8rem] font-black text-sm flex items-center justify-center gap-3 transition-all ${activeTab === 'MISSION_CONTROL' ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-50'}`}>
                <BellRing size={20} /> البلاغات
             </button>
             <button onClick={() => setActiveTab('TEAM_RADAR')} className={`flex-1 py-4 px-6 rounded-[1.8rem] font-black text-sm flex items-center justify-center gap-3 transition-all ${activeTab === 'TEAM_RADAR' ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-50'}`}>
                <Activity size={20} /> رادار الفريق
             </button>
             <button onClick={() => setActiveTab('FIELD_LOGS')} className={`flex-1 py-4 px-6 rounded-[1.8rem] font-black text-sm flex items-center justify-center gap-3 transition-all ${activeTab === 'FIELD_LOGS' ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-50'}`}>
                <UserX size={20} /> الغياب
             </button>
          </div>
       </div>

       {activeTab === 'TEAM_RADAR' && (
         <div className="animate-slide-up space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {teamStatus.length === 0 ? (
                 <div className="col-span-full py-40 text-center text-slate-300">
                    <HelpCircle size={80} className="mx-auto opacity-20 mb-4" />
                    <p className="text-2xl font-black italic">لا يوجد أعضاء فريق ميداني مسجلين حالياً</p>
                 </div>
               ) : (
                 teamStatus.map(member => (
                   <div key={member.id} className={`bg-white p-8 rounded-[3.5rem] border-2 shadow-xl transition-all relative group ${member.isBusy ? 'border-blue-400 bg-blue-50/10' : 'border-slate-50'}`}>
                      <div className="flex justify-between items-start mb-6">
                         <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg ${member.isBusy ? 'bg-blue-600 text-white' : 'bg-slate-900 text-white'}`}>
                            <UserCheck size={32} />
                         </div>
                         <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase flex items-center gap-2 ${member.isBusy ? 'bg-blue-100 text-blue-600 animate-pulse' : 'bg-emerald-100 text-emerald-600'}`}>
                            <CircleDot size={12} fill="currentColor" /> {member.isBusy ? 'في مهمة عمل' : 'متاح حالياً'}
                         </div>
                      </div>
                      <div className="space-y-4 mb-8">
                         <div>
                            <h4 className="text-xl font-black text-slate-900 leading-tight">{member.full_name}</h4>
                         </div>
                         {member.isBusy ? (
                           <div className="p-4 bg-white rounded-2xl border border-blue-100 shadow-sm space-y-2">
                              <div className="flex items-center gap-2">
                                 <MapPin size={14} className="text-blue-600" />
                                 <span className="text-sm font-black text-slate-800">لجنة رقم {member.currentCommittee}</span>
                              </div>
                              <p className="text-[10px] text-slate-500 font-bold truncate">المهمة: {member.currentTask}</p>
                           </div>
                         ) : <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-center"><p className="text-[10px] font-black text-emerald-600">جاهز لاستلام بلاغات جديدة</p></div>}
                      </div>
                      <button onClick={() => member.phone && window.open(`tel:${member.phone}`)} disabled={!member.phone} className={`w-full py-5 rounded-2xl font-black text-xs flex items-center justify-center gap-3 shadow-xl ${member.phone ? 'bg-slate-950 text-white hover:bg-black' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}><Phone size={18} /> اتصال</button>
                   </div>
                 ))
               )}
            </div>
         </div>
       )}

       {activeTab === 'MISSION_CONTROL' ? (
          <div className="space-y-8 animate-slide-up">
             {activeRequests.length === 0 ? (
               <div className="py-40 text-center bg-white rounded-[5rem] border-2 border-dashed border-slate-200 flex flex-col items-center gap-8 shadow-inner">
                  <div className="bg-slate-50 p-10 rounded-full text-slate-100 shadow-inner"><ShieldCheck size={120} /></div>
                  <p className="text-3xl font-black text-slate-300 italic">لا يوجد بلاغات نشطة حالياً</p>
               </div>
             ) : (
               <div className="grid grid-cols-1 gap-6">
                 {activeRequests.map(req => (
                   <div key={req.id} className={`bg-white p-8 md:p-12 rounded-[4rem] border-2 shadow-2xl flex flex-col lg:flex-row justify-between items-center gap-10 transition-all relative overflow-hidden ${req.status === 'IN_PROGRESS' ? 'border-blue-400 bg-blue-50/10' : 'border-red-100'}`}>
                      <div className="flex items-start gap-8 w-full">
                         <div className={`w-28 h-28 rounded-[2.5rem] flex flex-col items-center justify-center font-black shadow-2xl shrink-0 ${req.status === 'IN_PROGRESS' ? 'bg-blue-600 text-white' : 'bg-slate-950 text-white'}`}>
                            <span className="text-xs opacity-50 uppercase mb-1">لجنة</span>
                            <span className="text-5xl">{req.committee}</span>
                         </div>
                         <div className="flex-1 space-y-4">
                            <div className="flex items-center gap-5">
                               <h4 className="text-2xl font-black text-slate-900">{req.from}</h4>
                               <span className="bg-slate-100 text-slate-500 px-4 py-1.5 rounded-full text-[10px] font-black font-mono"><Clock size={14} className="inline ml-2"/> {new Date(req.time).toLocaleTimeString('ar-SA')}</span>
                            </div>
                            <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                               <p className="text-2xl font-black text-slate-700 leading-relaxed text-right">{req.text}</p>
                            </div>
                         </div>
                      </div>
                      <div className="shrink-0 w-full lg:w-auto flex flex-col gap-3">
                         {req.status === 'PENDING' ? (
                            <button onClick={() => updateRequestStatus(req.id, 'IN_PROGRESS', req.committee)} className="w-full lg:w-72 bg-blue-600 text-white py-8 rounded-[2.5rem] font-black text-2xl shadow-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-4 active:scale-95"><ArrowRightCircle size={40} /> مباشرة الطلب</button>
                         ) : (
                            <button onClick={() => updateRequestStatus(req.id, 'DONE', req.committee)} className="w-full lg:w-72 bg-emerald-600 text-white py-8 rounded-[2.5rem] font-black text-2xl shadow-xl hover:bg-emerald-700 transition-all flex items-center justify-center gap-4 active:scale-95"><CheckCircle size={40} /> إغلاق البلاغ</button>
                         )}
                      </div>
                   </div>
                 ))}
               </div>
             )}
          </div>
       ) : activeTab === 'FIELD_LOGS' ? (
          <div className="animate-slide-up space-y-8">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {myCommitteeAbsences.length === 0 ? (
                  <div className="col-span-full py-40 text-center text-slate-300 flex flex-col items-center gap-8">
                     <CheckCircle size={100} className="opacity-10" />
                     <p className="text-2xl font-black italic">لا يوجد حالات غياب مسجلة</p>
                  </div>
                ) : (
                  myCommitteeAbsences.map(a => {
                    const student = students.find(s => s.national_id === a.student_id);
                    return (
                      <div key={a.id} className="bg-white rounded-[3.5rem] border-2 border-slate-50 p-8 shadow-xl flex flex-col justify-between hover:shadow-2xl transition-all group">
                         <div className="flex justify-between items-start mb-8">
                            <div className="bg-slate-950 text-white w-16 h-16 rounded-2xl flex flex-col items-center justify-center font-black">
                               <span className="text-[8px] opacity-40 leading-none mb-1">لجنة</span>
                               <span className="text-2xl leading-none">{a.committee_number}</span>
                            </div>
                            <span className={`px-5 py-2 rounded-full text-[10px] font-black uppercase shadow-sm ${a.type === 'ABSENT' ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'}`}>{a.type === 'ABSENT' ? 'غياب' : 'تأخر'}</span>
                         </div>
                         <div className="space-y-5 text-right mb-8">
                            <h4 className="text-2xl font-black text-slate-900 leading-tight truncate">{a.student_name}</h4>
                            <div className="flex flex-wrap gap-2 justify-end">
                               <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-xl text-[10px] font-black border border-blue-100">{student?.grade}</span>
                               {student?.section && <span className="bg-slate-50 text-slate-500 px-3 py-1 rounded-xl text-[10px] font-black border border-slate-100">فصل {student.section}</span>}
                            </div>
                         </div>
                         <button
                           disabled={!student?.parent_phone}
                           onClick={() => student?.parent_phone && window.open(`tel:${student.parent_phone}`)}
                           className={`w-full py-5 rounded-2xl font-black text-xs flex items-center justify-center gap-3 shadow-xl transition-all ${student?.parent_phone ? 'bg-slate-950 text-white hover:bg-black' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}
                         >
                           <Phone size={18} /> اتصال بولي الأمر
                         </button>
                      </div>
                    );
                  })
                )}
             </div>
          </div>
       ) : null}
    </div>
  );
};

export default AssistantControlView;
