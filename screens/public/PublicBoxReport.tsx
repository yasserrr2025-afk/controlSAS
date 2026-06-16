import React, { useState, useEffect } from 'react';
import {
  Package, AlertCircle, Clock, Users, Loader2, CheckCircle,
  XCircle, Timer, TrendingUp, Award, ShieldCheck
} from 'lucide-react';
import { ArchiveBox, Student, Supervision, DeliveryLog, User, ExamSchedule, Absence } from '../../types';
import { supabase } from '../../supabase';
import { formatActualProctorStart, getActualSupervisionStart } from '../../utils/proctorTime';

const LOGO_URL = 'https://www.raed.net/img?id=1488645';

interface Props {
  boxId: string;
  students: Student[];
  supervisions?: Supervision[];
  deliveryLogs?: DeliveryLog[];
  users?: User[];
  examSchedule?: ExamSchedule[];
  absences?: Absence[];
  systemConfig?: any;
}

export const PublicBoxReport: React.FC<Props> = ({
  boxId, students, supervisions = [], deliveryLogs = [], users = [],
  examSchedule = [], absences = [],
}) => {
  const [box, setBox] = useState<ArchiveBox | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true); setError('');
      try {
        const { data, error: dbErr } = await supabase
          .from('archive_boxes').select('*').eq('id', boxId).maybeSingle();
        if (!dbErr && data) {
          const committees = Array.isArray(data.committees)
            ? data.committees.map(String)
            : (typeof data.committees === 'string' ? JSON.parse(data.committees) : []);
          setBox({ ...data, committees });
          return;
        }
        const stored = localStorage.getItem('control_archive_boxes');
        if (stored) {
          const found = (JSON.parse(stored) as ArchiveBox[]).find(b => b.id === boxId);
          if (found) { setBox(found); return; }
        }
        setError('الصندوق غير موجود أو تم حذفه.');
      } catch { setError('فشل الاتصال بقاعدة البيانات.'); }
      finally { setLoading(false); }
    };
    if (boxId) load().finally(() => setLoading(false));
  }, [boxId]);

  const eqCom = (a: any, b: any) => String(a) === String(b);
  const matchesDate = (iso: string | null | undefined, date: string) => {
    if (!iso || !date) return false;
    const s = String(iso);
    if (s.startsWith(date)) return true;
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return false;
      const local = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      return local === date;
    } catch { return false; }
  };
  const safeTime = (iso?: string | null) => {
    if (!iso) return '---';
    try { const d = new Date(iso); return isNaN(d.getTime()) ? '---' : d.toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'}); }
    catch { return '---'; }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0f172a] to-[#1e1b4b]" dir="rtl">
      <div className="text-center space-y-5">
        <div className="w-24 h-24 mx-auto rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center">
          <Loader2 size={44} className="text-indigo-400 animate-spin" />
        </div>
        <p className="text-indigo-300 font-black text-lg tracking-wide">جاري تحميل بيانات الصندوق…</p>
      </div>
    </div>
  );

  if (error || !box) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0f172a] to-[#450a0a]" dir="rtl">
      <div className="text-center space-y-5 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-14 max-w-sm mx-4">
        <XCircle size={56} className="mx-auto text-red-400" />
        <h2 className="text-2xl font-black text-white">الصندوق غير موجود</h2>
        <p className="text-slate-300 font-bold text-sm leading-relaxed">{error || 'تأكد من صحة رمز QR أو أن الصندوق لم يُحذف.'}</p>
      </div>
    </div>
  );

  // ── Global stats ──────────────────────────────────────────────────────────
  const allComStudents = students.filter(s =>
    s.grade === box.grade && box.committees.some(c => eqCom(s.committee_number, c))
  );
  const allAbsences = absences.filter(a =>
    box.committees.some(c => eqCom(a.committee_number, c)) && matchesDate(a.date, box.exam_date)
  );
  const totalStudents = allComStudents.length;
  const totalAbsent = new Set(allAbsences.filter(a => a.type === 'ABSENT').map(a => a.student_id)).size;
  const totalLate   = new Set(allAbsences.filter(a => a.type === 'LATE').map(a => a.student_id)).size;
  // التأخير يُحسب من الحضور (الحاضر = كل من ليس غائباً، والمتأخر ضمن الحاضرين)
  const totalPresent = totalStudents - totalAbsent; // يشمل المتأخرين
  const attendanceRate = totalStudents > 0 ? Math.round((totalPresent / totalStudents) * 100) : 0;

  const dateStr = new Date(box.exam_date).toLocaleDateString('ar-SA',{weekday:'long',year:'numeric',month:'long',day:'numeric'});

  return (
    <div className="min-h-screen bg-[#f0f4ff] font-['Tajawal'] text-right" dir="rtl" style={{fontFamily:"'Tajawal',sans-serif"}}>

      {/* ══════════════════ HERO HEADER ══════════════════ */}
      <div className="relative overflow-hidden" style={{background:'linear-gradient(135deg,#1e1b4b 0%,#312e81 40%,#4338ca 100%)'}}>
        {/* Decorative circles */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full opacity-10" style={{background:'radial-gradient(circle,#818cf8,transparent)'}}/>
        <div className="absolute -bottom-16 -right-16 w-80 h-80 rounded-full opacity-10" style={{background:'radial-gradient(circle,#c7d2fe,transparent)'}}/>
        <div className="absolute top-8 right-1/2 w-64 h-64 rounded-full opacity-5" style={{background:'radial-gradient(circle,#fff,transparent)'}}/>

        <div className="relative z-10 max-w-4xl mx-auto px-6 pt-10 pb-6">
          {/* Top bar: logo + school name */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 bg-white rounded-2xl shadow-xl flex items-center justify-center p-1.5">
                <img src={LOGO_URL} alt="شعار" className="w-full h-full object-contain" />
              </div>
              <div>
                <p className="text-indigo-200 text-xs font-black tracking-wider">وزارة التعليم</p>
                <p className="text-white font-black text-sm leading-tight">مدرسة عماد الدين زنكي المتوسطة</p>
              </div>
            </div>
            <div className="text-left">
              <p className="text-indigo-300 text-[10px] font-black tracking-widest uppercase mb-0.5">صندوق أرشيف</p>
              <p className="text-white font-black text-2xl leading-tight">{box.box_number}</p>
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur rounded-2xl px-6 py-3 border border-white/20 mb-4">
              <Package size={22} className="text-indigo-200" />
              <span className="text-white font-black text-lg">تقرير صندوق الاختبارات</span>
            </div>
            <div className="flex flex-wrap justify-center gap-4 text-sm">
              <span className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-indigo-100 font-bold">📚 {box.subject}</span>
              <span className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-indigo-100 font-bold">🎓 {box.grade}</span>
              <span className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-indigo-100 font-bold">📅 {dateStr}</span>
            </div>
          </div>
        </div>

        {/* ── GLOBAL STATS STRIP ── */}
        <div className="relative z-10 max-w-4xl mx-auto px-4 pb-8">
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-[2rem] p-6">
            <p className="text-indigo-200 text-xs font-black tracking-widest text-center mb-5 uppercase">إحصائيات الصف الإجمالية — جميع اللجان</p>

            {/* Big 4 stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
              {[
                { label:'إجمالي الطلاب',    value: totalStudents, icon:'👥', color:'from-blue-400/30 to-blue-600/20',   border:'border-blue-400/30', text:'text-blue-100' },
                { label:'إجمالي الحضور',    value: totalPresent,  icon:'✅', color:'from-emerald-400/30 to-emerald-600/20', border:'border-emerald-400/30', text:'text-emerald-100' },
                { label:'إجمالي الغياب',    value: totalAbsent,   icon:'❌', color:'from-red-400/30 to-red-600/20',    border:'border-red-400/30',  text:'text-red-100' },
                { label:'إجمالي التأخير',   value: totalLate,     icon:'⏰', color:'from-amber-400/30 to-amber-600/20', border:'border-amber-400/30', text:'text-amber-100' },
              ].map(s => (
                <div key={s.label} className={`bg-gradient-to-br ${s.color} border ${s.border} rounded-2xl p-4 text-center backdrop-blur`}>
                  <div className="text-3xl mb-1">{s.icon}</div>
                  <div className={`text-3xl font-black ${s.text}`}>{s.value}</div>
                  <div className="text-white/60 text-[11px] font-bold mt-1">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Attendance bar */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-white/70 text-xs font-bold">نسبة الحضور (شامل المتأخرين)</span>
                <span className="text-white font-black text-lg">{attendanceRate}%</span>
              </div>
              <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{
                    width:`${attendanceRate}%`,
                    background: attendanceRate >= 90
                      ? 'linear-gradient(90deg,#10b981,#34d399)'
                      : attendanceRate >= 70
                        ? 'linear-gradient(90deg,#f59e0b,#fbbf24)'
                        : 'linear-gradient(90deg,#ef4444,#f87171)'
                  }}
                />
              </div>
              {totalLate > 0 && (
                <p className="text-amber-300/80 text-[11px] font-bold text-left">
                  * المتأخرون ({totalLate}) محسوبون ضمن الحضور
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Wave */}
        <svg viewBox="0 0 1440 40" className="w-full block" style={{marginBottom:'-2px'}}>
          <path d="M0,40 C360,0 1080,0 1440,40 L1440,40 L0,40 Z" fill="#f0f4ff"/>
        </svg>
      </div>

      {/* ══════════════════ COMMITTEES ══════════════════ */}
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 pb-24">
        <h2 className="text-2xl font-black text-slate-700 flex items-center gap-3">
          <span className="w-1 h-8 bg-indigo-500 rounded-full inline-block"/>
          تفاصيل اللجان ({box.committees.length} لجنة)
        </h2>

        {box.committees.length > 0 ? box.committees.map((committeeNum, comIdx) => {
          // proctors
          const supvsForCom = supervisions.filter(s =>
            eqCom(s.committee_number, committeeNum) && matchesDate(s.date, box.exam_date)
          );
          const proctorNames = [...new Set(supvsForCom.map(s => {
            const u = users.find(u => u.national_id === s.teacher_id || u.id === s.teacher_id);
            return u ? u.full_name : s.teacher_id;
          }))];
          const loginTime = getActualSupervisionStart(supvsForCom);

          // logs
          const closeLog  = deliveryLogs.find(l => eqCom(l.committee_number, committeeNum) && matchesDate(l.time, box.exam_date) && l.type === 'RECEIVE');
          const receiptLog = deliveryLogs.find(l => eqCom(l.committee_number, committeeNum) && matchesDate(l.time, box.exam_date) && l.status === 'CONFIRMED');

          // students
          const comStudents = students
            .filter(s => s.grade === box.grade && eqCom(s.committee_number, committeeNum))
            .sort((a,b) => a.name.localeCompare(b.name,'ar'));

          // absences
          const comAbs = absences.filter(a => eqCom(a.committee_number, committeeNum) && matchesDate(a.date, box.exam_date));
          const absentSet = new Set(comAbs.filter(a => a.type === 'ABSENT').map(a => a.student_id));
          const lateSet   = new Set(comAbs.filter(a => a.type === 'LATE').map(a => a.student_id));
          const comAbsent  = absentSet.size;
          const comLate    = lateSet.size;
          const comPresent = comStudents.length - comAbsent; // متأخرون ضمن الحضور
          const comRate    = comStudents.length > 0 ? Math.round((comPresent/comStudents.length)*100) : 0;

          return (
            <div key={committeeNum} className="rounded-[2rem] overflow-hidden shadow-xl border border-slate-200/60 bg-white">

              {/* Committee header */}
              <div className="relative overflow-hidden" style={{background:'linear-gradient(135deg,#0f172a 0%,#1e293b 60%,#334155 100%)'}}>
                <div className="absolute inset-0 opacity-20" style={{backgroundImage:`url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`}}/>
                <div className="relative z-10 p-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center font-black text-2xl shadow-lg"
                          style={{background:'linear-gradient(135deg,#4f46e5,#7c3aed)'}}>
                          <span className="text-white">{committeeNum}</span>
                        </div>
                        <div className="absolute -top-1 -right-1 w-5 h-5 bg-indigo-400 rounded-full flex items-center justify-center text-[9px] font-black text-white">
                          {comIdx+1}
                        </div>
                      </div>
                      <div>
                        <h3 className="text-2xl font-black text-white">لجنة {committeeNum}</h3>
                        <p className="text-slate-400 text-sm font-bold">{comStudents.length} طالب مسجل</p>
                      </div>
                    </div>
                    {/* Time chips */}
                    <div className="flex flex-wrap gap-2">
                      {loginTime && (
                        <div className="flex items-center gap-2 bg-emerald-500/20 border border-emerald-400/30 rounded-xl px-3 py-2 text-emerald-200 font-bold">
                          <Clock size={14} className="shrink-0"/>
                          <div className="leading-tight">
                            <p className="text-[9px] text-emerald-100/70 font-black">دخول المراقب</p>
                            <p className="text-xs tabular-nums">{formatActualProctorStart(loginTime)}</p>
                          </div>
                        </div>
                      )}
                      {closeLog && (
                        <div className="flex items-center gap-2 bg-amber-500/20 border border-amber-400/30 rounded-xl px-3 py-2 text-amber-200 font-bold">
                          <Clock size={14} className="shrink-0"/>
                          <div className="leading-tight">
                            <p className="text-[9px] text-amber-100/70 font-black">إغلاق اللجنة</p>
                            <p className="text-xs tabular-nums">{safeTime(closeLog.time)}</p>
                          </div>
                        </div>
                      )}
                      {receiptLog && (
                        <div className="flex items-center gap-2 bg-blue-500/20 border border-blue-400/30 rounded-xl px-3 py-2 text-blue-200 font-bold">
                          <CheckCircle size={14} className="shrink-0"/>
                          <div className="leading-tight">
                            <p className="text-[9px] text-blue-100/70 font-black">استلام الكنترول</p>
                            <p className="text-xs tabular-nums">{safeTime(receiptLog.time)}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Mini 3 stats */}
                  <div className="grid grid-cols-3 gap-3 mt-5">
                    <div className="bg-emerald-500/15 border border-emerald-400/20 rounded-xl p-3 text-center">
                      <p className="text-2xl font-black text-emerald-300">{comPresent}</p>
                      <p className="text-emerald-400/70 text-[10px] font-bold mt-0.5">حاضر</p>
                    </div>
                    <div className="bg-red-500/15 border border-red-400/20 rounded-xl p-3 text-center">
                      <p className="text-2xl font-black text-red-300">{comAbsent}</p>
                      <p className="text-red-400/70 text-[10px] font-bold mt-0.5">غائب</p>
                    </div>
                    <div className="bg-amber-500/15 border border-amber-400/20 rounded-xl p-3 text-center">
                      <p className="text-2xl font-black text-amber-300">{comLate}</p>
                      <p className="text-amber-400/70 text-[10px] font-bold mt-0.5">متأخر</p>
                    </div>
                  </div>

                  {/* Attendance mini bar */}
                  <div className="mt-4">
                    <div className="flex justify-between text-[11px] font-bold text-slate-400 mb-1.5">
                      <span>نسبة الحضور</span><span className="text-white">{comRate}%</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{width:`${comRate}%`,background:comRate>=90?'linear-gradient(90deg,#10b981,#34d399)':comRate>=70?'linear-gradient(90deg,#f59e0b,#fbbf24)':'linear-gradient(90deg,#ef4444,#f87171)'}}/>
                    </div>
                  </div>
                </div>
              </div>

              {/* Proctors strip */}
              <div className="flex items-center gap-4 px-6 py-4 bg-slate-50 border-b border-slate-100">
                <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
                  <Users size={18} className="text-indigo-500"/>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 mb-1.5">الملاحظون المكلفون</p>
                  <div className="flex flex-wrap gap-2">
                    {proctorNames.length > 0
                      ? proctorNames.map((n,i) => (
                          <span key={i} className="bg-white border border-slate-200 shadow-sm px-3 py-1 rounded-lg text-sm font-bold text-slate-700">{n}</span>
                        ))
                      : <span className="text-slate-400 text-sm font-bold italic">لم يُسجَّل ملاحظون</span>
                    }
                  </div>
                </div>
              </div>

              {/* Students */}
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-black text-slate-700 flex items-center gap-2">
                    <span className="bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-lg text-sm">{comStudents.length}</span>
                    كشف الطلاب
                  </h4>
                  {(comAbsent > 0 || comLate > 0) && (
                    <div className="flex gap-2">
                      {comAbsent > 0 && <span className="flex items-center gap-1 text-[11px] font-black text-red-600 bg-red-50 border border-red-100 px-2.5 py-1 rounded-full"><XCircle size={11}/>{comAbsent} غائب</span>}
                      {comLate > 0 && <span className="flex items-center gap-1 text-[11px] font-black text-amber-600 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full"><Timer size={11}/>{comLate} متأخر</span>}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {comStudents.map((st, idx) => {
                    const isAbsent = absentSet.has(st.national_id);
                    const isLate   = lateSet.has(st.national_id);

                    const bg     = isAbsent ? 'bg-red-50 border-red-200'   : isLate ? 'bg-amber-50 border-amber-200'   : 'bg-slate-50 border-slate-100 hover:bg-indigo-50 hover:border-indigo-100';
                    const numBg  = isAbsent ? 'bg-red-500 text-white'       : isLate ? 'bg-amber-500 text-white'         : 'bg-slate-200 text-slate-600';
                    const badge  = isAbsent
                      ? <span className="flex items-center gap-0.5 text-[10px] font-black text-white bg-red-500 px-2 py-0.5 rounded-full whitespace-nowrap shrink-0"><XCircle size={9}/> غائب</span>
                      : isLate
                        ? <span className="flex items-center gap-0.5 text-[10px] font-black text-white bg-amber-500 px-2 py-0.5 rounded-full whitespace-nowrap shrink-0"><Timer size={9}/> متأخر</span>
                        : null;

                    return (
                      <div key={st.id} className={`border rounded-xl p-3 flex items-center gap-3 transition-colors ${bg}`}>
                        <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black shrink-0 ${numBg}`}>{idx+1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-800 truncate">{st.name}</p>
                          <p className="text-[10px] font-bold text-slate-400">مقعد: {st.seating_number || '—'}</p>
                        </div>
                        {badge}
                      </div>
                    );
                  })}
                  {comStudents.length === 0 && (
                    <p className="col-span-full text-center text-slate-400 text-sm font-bold py-6">لا يوجد طلاب مسجلون لهذه اللجنة.</p>
                  )}
                </div>

                {/* Legend */}
                {comStudents.length > 0 && (
                  <div className="flex gap-5 mt-5 pt-4 border-t border-slate-100 text-xs font-bold text-slate-500">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-200 inline-block"/>حاضر</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-500 inline-block"/>غائب</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-500 inline-block"/>متأخر</span>
                  </div>
                )}
              </div>
            </div>
          );
        }) : (
          <div className="text-center py-20 text-slate-400">
            <Package size={64} className="mx-auto mb-4 opacity-20"/>
            <p className="font-black text-lg">لا توجد لجان مسجلة في هذا الصندوق.</p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-6 border-t border-slate-200 space-y-3">
          <img src={LOGO_URL} alt="شعار" className="w-12 h-12 object-contain mx-auto opacity-40"/>
          <p className="text-slate-400 text-sm font-bold">
            تم إنشاء هذا التقرير آلياً عبر نظام الكنترول الرقمي<br/>
            <span className="text-slate-300">مدرسة عماد الدين زنكي المتوسطة — وزارة التعليم</span>
          </p>
        </div>
      </div>
    </div>
  );
};
