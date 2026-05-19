
import React, { useState, useMemo, useEffect } from 'react';
import { GraduationCap, UserCheck, AlertCircle, Users, ArrowUpRight, Send, Radio, Activity, Search, ShieldAlert, Timer, UserX, Clock, UserCircle, CheckCircle2, AlertTriangle, PackageCheck, Bookmark, Info, ShieldCheck, Map, Truck } from 'lucide-react';
import { Supervision, Absence, DeliveryLog, User, Student, UserRole, SystemConfig } from '../../types';
import { ROLES_ARABIC } from '../../constants';

interface AdminDashboardProps {
  stats: { students: number; users: number; activeSupervisions: number };
  absences?: Absence[];
  supervisions?: Supervision[];
  users?: User[];
  deliveryLogs?: DeliveryLog[];
  studentsList?: Student[];
  onBroadcast: (msg: string, target: UserRole | 'ALL') => void;
  systemConfig: SystemConfig;
}

interface CommitteeStatus {
  num: string;
  proctor?: User;
  absences: number;
  lates: number;
  totalStudents: number;
  status: 'IDLE' | 'ACTIVE' | 'PROBLEM' | 'DONE' | 'SUBMITTED';
  isAnomaly: boolean;
  receivedGrades: { grade: string, receiver: string }[];
}

const StatCard = ({ title, value, icon, color, bgColor, textColor }: any) => (
  <div className={`group p-5 md:p-8 rounded-[2rem] border-2 ${color} bg-white shadow-xl flex items-center gap-4 md:gap-8 transition-all hover:scale-[1.02] text-right relative overflow-hidden`}>
    <div className={`p-4 md:p-6 ${bgColor} ${textColor} rounded-2xl md:rounded-3xl shadow-inner shrink-0 group-hover:rotate-6 transition-transform`}>{icon}</div>
    <div className="flex-1">
      <p className="text-slate-400 text-[10px] font-black uppercase mb-1 flex items-center gap-2">{title}</p>
      <p className="text-2xl md:text-4xl font-black text-slate-900 leading-none tabular-nums">{value}</p>
    </div>
  </div>
);

const AdminDashboardOverview = ({ 
  stats, 
  absences = [], 
  supervisions = [], 
  users = [], 
  deliveryLogs = [], 
  studentsList = [], 
  onBroadcast, 
  systemConfig 
}: AdminDashboardProps) => {
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [targetRole, setTargetRole] = useState<UserRole | 'ALL'>('ALL');
  const [liveSearch, setLiveSearch] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  const liveCommittees = useMemo<CommitteeStatus[]>(() => {
    const committeeNums = Array.from(new Set(studentsList.map((s: Student) => s.committee_number))).filter(Boolean).sort((a: any, b: any) => Number(a) - Number(b));
    const now = new Date();
    const [startHour, startMin] = (systemConfig.exam_start_time || '08:00').split(':').map(Number);
    const examStartTimeDate = new Date();
    examStartTimeDate.setHours(startHour, startMin, 0);
    const isAfterGrace = now > new Date(examStartTimeDate.getTime() + 10 * 60 * 1000);

    return committeeNums.map(num => {
      const sv = supervisions.find((s: Supervision) => s.committee_number === num);
      const proctor = users.find((u: User) => u.id === sv?.teacher_id);
      const committeeStudents = studentsList.filter(s => s.committee_number === num);
      const committeeAbsences = absences.filter((a: Absence) => a.committee_number === num && a.type === 'ABSENT');
      const committeeLates = absences.filter((a: Absence) => a.committee_number === num && a.type === 'LATE');
      
      const allLogs = deliveryLogs.filter(l => l.committee_number === num);
      const confirmedLogs = allLogs.filter(l => l.status === 'CONFIRMED');
      const pendingLogs = allLogs.filter(l => l.status === 'PENDING');
      
      const receivedGrades = confirmedLogs.map(l => ({ grade: l.grade, receiver: l.teacher_name }));
      
      let status: 'IDLE' | 'ACTIVE' | 'PROBLEM' | 'DONE' | 'SUBMITTED' = 'IDLE';
      
      if (confirmedLogs.length > 0 && confirmedLogs.length >= Array.from(new Set(committeeStudents.map(s => s.grade))).length) {
        status = 'DONE';
      } else if (pendingLogs.length > 0) {
        status = 'SUBMITTED';
      } else if (committeeAbsences.length > 0 || committeeLates.length > 0) {
        status = 'PROBLEM';
      } else if (sv) {
        status = 'ACTIVE';
      }

      return { 
        num, proctor, absences: committeeAbsences.length, lates: committeeLates.length,
        totalStudents: committeeStudents.length, status, isAnomaly: isAfterGrace && !sv && status !== 'DONE' && status !== 'SUBMITTED',
        receivedGrades
      };
    });
  }, [studentsList, supervisions, users, absences, deliveryLogs, systemConfig, currentTime]);

  const filteredCommittees = liveCommittees.filter(c => 
    c.num.includes(liveSearch) || (c.proctor?.full_name && c.proctor.full_name.includes(liveSearch))
  );

  return (
    <div className="space-y-8 animate-slide-up text-right">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter">مركز القيادة </h2>
          <p className="text-slate-400 font-bold text-sm italic mt-2 flex items-center gap-2">
            <Activity size={16} className="text-blue-600 animate-pulse"/> إدارة اللجان والتوثيق المركزي المباشر
          </p>
        </div>
        <div className="bg-slate-950 p-1.5 rounded-[2rem] flex items-center gap-1 shadow-2xl">
           <div className="bg-blue-600 text-white px-5 py-2.5 rounded-full font-black text-xs flex items-center gap-2">
              <Clock size={14}/> {currentTime.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
           </div>
           <div className="text-slate-500 px-4 py-2.5 font-bold text-[10px]">البداية: {systemConfig.exam_start_time}</div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
         <StatCard title="إجمالي الطلاب" value={stats.students} icon={<GraduationCap size={24} />} color="border-blue-50" bgColor="bg-blue-600" textColor="text-white" />
         <StatCard title="لجان نشطة" value={liveCommittees.filter(c => c.status === 'ACTIVE' || c.status === 'PROBLEM').length} icon={<UserCheck size={24} />} color="border-emerald-50" bgColor="bg-emerald-600" textColor="text-white" />
         <StatCard title="متجه للكنترول" value={liveCommittees.filter(c => c.status === 'SUBMITTED').length} icon={<Truck size={24} />} color="border-orange-50" bgColor="bg-orange-500" textColor="text-white" />
         <StatCard title="إجمالي الغياب" value={absences.filter(a => a.type === 'ABSENT').length} icon={<UserX size={24} />} color="border-red-50" bgColor="bg-red-600" textColor="text-white" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 space-y-6">
           <div className="bg-white p-6 rounded-[2.5rem] border shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-3"><Radio size={20} className="text-blue-600"/> حائط اللجان المباشر</h3>
              <div className="relative w-full md:w-64">
                <Search size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" placeholder="رقم اللجنة أو المراقب..." className="w-full pr-10 py-3 bg-slate-50 border rounded-2xl font-bold text-xs outline-none focus:border-blue-500" value={liveSearch} onChange={e => setLiveSearch(e.target.value)} />
              </div>
           </div>

           <div className="bg-slate-50 p-6 rounded-[2.5rem] border-2 border-slate-100 flex flex-wrap gap-6 justify-center shadow-inner text-right">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-emerald-500 shadow-lg shadow-emerald-200"></div>
                <span className="text-[10px] font-black text-slate-600">مكتملة (تم الاستلام)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-orange-500 shadow-lg shadow-orange-200 animate-pulse"></div>
                <span className="text-[10px] font-black text-slate-600">متجه للكنترول (انتظار مطابقة)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-blue-600 shadow-lg shadow-blue-200"></div>
                <span className="text-[10px] font-black text-slate-600">نشطة (قيد المراقبة)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-rose-500 shadow-lg shadow-rose-200"></div>
                <span className="text-[10px] font-black text-slate-600">رصد (غياب أو تأخر)</span>
              </div>
           </div>
           
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCommittees.map(committee => {
                let cardStyle = "bg-white border-slate-100";
                let statusLabel = "قيد العمل";
                let statusIcon = <Timer size={14} className="animate-spin-slow" />;
                let statusColor = "bg-slate-100 text-slate-500";

                if (committee.isAnomaly) {
                  cardStyle = "bg-red-50 border-red-500 animate-pulse shadow-red-100";
                  statusLabel = "خطر: لا يوجد مراقب";
                  statusIcon = <AlertTriangle size={14} />;
                  statusColor = "bg-red-600 text-white";
                } else if (committee.status === 'DONE') {
                  cardStyle = "bg-emerald-50/30 border-emerald-500 shadow-emerald-100";
                  statusLabel = "تم التسليم للكنترول";
                  statusIcon = <ShieldCheck size={14} />;
                  statusColor = "bg-emerald-500 text-white";
                } else if (committee.status === 'SUBMITTED') {
                  cardStyle = "bg-orange-50 border-orange-500 shadow-orange-100 animate-pulse";
                  statusLabel = "متجه للكنترول";
                  statusIcon = <Truck size={14} />;
                  statusColor = "bg-orange-500 text-white";
                } else if (committee.status === 'PROBLEM') {
                  cardStyle = "bg-rose-50/50 border-rose-400 shadow-rose-100";
                  statusLabel = "تنبيه: رصد حالات";
                  statusIcon = <AlertCircle size={14} />;
                  statusColor = "bg-rose-500 text-white";
                } else if (committee.status === 'ACTIVE') {
                  cardStyle = "bg-blue-50/30 border-blue-600 shadow-blue-100";
                  statusLabel = "قيد المراقبة";
                  statusIcon = <UserCheck size={14} />;
                  statusColor = "bg-blue-600 text-white";
                }

                return (
                  <div key={committee.num} className={`p-6 rounded-[3rem] border-2 transition-all flex flex-col gap-4 relative overflow-hidden min-h-[340px] shadow-xl hover:scale-[1.02] ${cardStyle}`}>
                    <div className={`absolute -top-10 -right-10 w-32 h-32 blur-[60px] opacity-20 ${committee.status === 'DONE' ? 'bg-emerald-500' : committee.status === 'SUBMITTED' ? 'bg-orange-500' : committee.status === 'PROBLEM' ? 'bg-rose-500' : 'bg-blue-600'}`}></div>
                    <div className="flex justify-between items-start relative z-10">
                      <div className="flex flex-col">
                          <span className="text-4xl font-black text-slate-950 tracking-tighter">{committee.num}</span>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">رقم اللجنة</span>
                      </div>
                      <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-2 ${statusColor}`}>
                          {statusIcon} {statusLabel}
                      </div>
                    </div>
                    <div className="bg-slate-900 text-white p-4 rounded-2xl space-y-1 border-b-4 border-blue-500 relative z-10">
                        <p className="text-[11px] font-black leading-tight break-words">{committee.proctor?.full_name || (committee.isAnomaly ? '--- لا يوجد ---' : 'بانتظار المراقب...')}</p>
                    </div>
                    {committee.receivedGrades.length > 0 ? (
                      <div className="space-y-2 flex-1 relative z-10">
                          {committee.receivedGrades.map((rg, idx) => (
                            <div key={idx} className="bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20 flex items-center gap-3">
                                <PackageCheck size={14} className="text-emerald-600 shrink-0" />
                                <div className="min-w-0 flex-1 text-right">
                                  <p className="text-[10px] font-black text-emerald-800 leading-none">{rg.grade}</p>
                                </div>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2 flex-1 items-end relative z-10">
                          <div className="bg-white/50 backdrop-blur-sm p-3 rounded-2xl text-center border"><p className="text-[8px] font-black text-slate-400 uppercase mb-1">طلاب</p><p className="text-lg font-black">{committee.totalStudents}</p></div>
                          <div className={`p-3 rounded-2xl text-center border ${committee.absences > 0 ? 'bg-red-500 text-white' : 'bg-white/50 text-slate-400'}`}><p className="text-[8px] font-black uppercase mb-1">غياب</p><p className="text-lg font-black">{committee.absences}</p></div>
                          <div className={`p-3 rounded-2xl text-center border ${committee.lates > 0 ? 'bg-amber-500 text-white' : 'bg-white/50 text-slate-400'}`}><p className="text-[8px] font-black uppercase mb-1">تأخر</p><p className="text-lg font-black">{committee.lates}</p></div>
                      </div>
                    )}
                  </div>
                );
              })}
           </div>
        </div>

        <div className="space-y-6">
           <div className="bg-slate-950 p-8 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 blur-3xl rounded-full"></div>
              <h3 className="text-xl font-black mb-6 flex items-center gap-3"><Send size={20} className="text-blue-400"/> بث تعليمات فورية</h3>
              <div className="space-y-4 relative z-10 text-right">
                <select value={targetRole} onChange={e => setTargetRole(e.target.value as any)} className="w-full bg-white/10 border border-white/10 rounded-2xl p-4 font-bold text-xs outline-none focus:border-blue-400">
                  <option value="ALL">البث للجميع</option>
                  {Object.entries(ROLES_ARABIC).map(([key, val]) => <option key={key} value={key} className="text-slate-900">{val}</option>)}
                </select>
                <textarea value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)} placeholder="اكتب التنبيه هنا..." className="w-full bg-white/10 border border-white/10 rounded-2xl p-4 font-bold text-xs h-32 outline-none focus:border-blue-400 resize-none" />
                <button onClick={() => { if(broadcastMsg) { onBroadcast(broadcastMsg, targetRole); setBroadcastMsg(''); } }} disabled={!broadcastMsg} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-lg hover:bg-blue-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50">إرسال الآن</button>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardOverview;
