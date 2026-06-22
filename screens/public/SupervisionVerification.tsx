import React, { useMemo } from 'react';
import { CheckCircle2, Clock3, DoorOpen, FileCheck2, HeartHandshake, ShieldCheck } from 'lucide-react';
import { Absence, DeliveryLog, Student, Supervision, User } from '../../types';
import { formatActualProctorStart, isPlaceholderProctorStart } from '../../utils/proctorTime';

interface Props {
  supervisions: Supervision[];
  users: User[];
  students: Student[];
  absences: Absence[];
  deliveryLogs: DeliveryLog[];
}

const formatDate = (value?: string) => {
  if (!value) return 'غير محدد';
  return new Intl.DateTimeFormat('ar-SA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(value));
};

const formatTime = (value?: string) => {
  if (!value) return 'لم يسجل';
  return new Intl.DateTimeFormat('ar-SA', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
};

const formatProctorTime = (value?: string) => formatActualProctorStart(value, 'لم يسجل');

const sameDay = (value: string | undefined, date: string) => Boolean(value && value.startsWith(date));

const SupervisionVerification: React.FC<Props> = ({ supervisions, users, students, absences, deliveryLogs }) => {
  const params = new URLSearchParams(window.location.search);
  const committee = params.get('committee') || params.get('c') || '';
  const grade = params.get('grade') || params.get('g') || '';
  const date = params.get('date') || params.get('d') || new Date().toISOString().slice(0, 10);
  const typeParam = params.get('type') || params.get('t');
  const type = typeParam === 'proctor' || typeParam === 'p' ? 'proctor' : 'receiver';

  const record = useMemo(() => {
    const supervision = supervisions.find(item => item.committee_number === committee && sameDay(item.date, date));
    const proctor = users.find(user => user.id === supervision?.teacher_id);
    const gradeStudents = students.filter(student => student.committee_number === committee && student.grade === grade);
    const absent = absences.filter(item =>
      sameDay(item.date, date) &&
      item.committee_number === committee &&
      item.type === 'ABSENT' &&
      gradeStudents.some(student => student.national_id === item.student_id)
    );
    const late = absences.filter(item =>
      sameDay(item.date, date) &&
      item.committee_number === committee &&
      item.type === 'LATE' &&
      gradeStudents.some(student => student.national_id === item.student_id)
    );
    const closeLog = deliveryLogs.find(item =>
      sameDay(item.time, date) &&
      item.committee_number === committee &&
      item.status === 'PENDING' &&
      (item.grade === grade || item.grade.includes(grade))
    );
    const receiptLog = deliveryLogs.find(item =>
      sameDay(item.time, date) &&
      item.committee_number === committee &&
      item.status === 'CONFIRMED' &&
      (item.grade === grade || item.grade.includes(grade))
    );

    return {
      supervision,
      proctorName: (proctor && !isPlaceholderProctorStart(supervision?.date)) ? proctor.full_name : receiptLog?.proctor_name || 'لم يسجل',
      receiverName: receiptLog?.teacher_name || 'لم يتم الاستلام بعد',
      total: gradeStudents.length,
      present: Math.max(gradeStudents.length - absent.length, 0),
      absent: absent.length,
      late: late.length,
      startTime: supervision?.date,
      closeTime: closeLog?.time,
      receiptTime: receiptLog?.time,
      isReceived: Boolean(receiptLog),
    };
  }, [absences, committee, date, deliveryLogs, grade, students, supervisions, users]);

  const signerLabel = type === 'receiver' ? 'المستلم' : 'المراقب';
  const signerName = type === 'receiver' ? record.receiverName : record.proctorName;
  const verificationHint = type === 'receiver'
    ? 'هذا الرمز يخص خانة توقيع المستلم ويثبت بيانات استلام الكنترول للمظروف.'
    : 'هذا الرمز يخص خانة توقيع المراقب ويثبت بيانات مراقب اللجنة وإغلاقها.';

  const timeline = [
    { label: 'وقت دخول اللجنة', value: formatProctorTime(record.startTime), icon: DoorOpen, tone: 'bg-blue-50 text-blue-700 border-blue-100' },
    { label: 'وقت إغلاق اللجنة', value: formatTime(record.closeTime), icon: Clock3, tone: 'bg-orange-50 text-orange-700 border-orange-100' },
    { label: 'وقت استلام الكنترول', value: formatTime(record.receiptTime), icon: FileCheck2, tone: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  ];

  return (
    <div className="min-h-screen bg-[#f4f7fb] font-['Tajawal'] text-right text-slate-900 overflow-hidden" dir="rtl">
      <div className="absolute inset-x-0 top-0 h-72 bg-slate-950" />
      <main className="relative max-w-5xl mx-auto px-4 py-8 md:py-12 space-y-6">
        <section className="bg-white rounded-[2.5rem] md:rounded-[3.5rem] shadow-2xl overflow-hidden border border-slate-100">
          <div className="bg-slate-950 text-white p-8 md:p-10 relative overflow-hidden">
            <div className="absolute -top-20 -left-20 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl" />
            <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/15 border border-emerald-400/20 text-emerald-100 text-xs font-black">
                  <ShieldCheck size={16} />
                  تحقق رقمي من مسير المراقبة
                </div>
                <h1 className="text-3xl md:text-5xl font-black tracking-tight">لجنة {committee || '-'}</h1>
                <p className="text-slate-300 font-bold">مسير المراقبة واستلام المظاريف - {formatDate(date)}</p>
              </div>
              <div className="bg-white/10 border border-white/10 rounded-[2rem] p-5 min-w-52">
                <p className="text-xs text-slate-300 font-black mb-2">الرمز يخص</p>
                <p className="text-2xl font-black">{signerLabel}</p>
                <p className="text-[11px] font-bold text-slate-300 mt-2 leading-5">{verificationHint}</p>
              </div>
            </div>
          </div>

          <div className="p-6 md:p-10 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-6 rounded-[2rem] bg-slate-50 border border-slate-100">
                <p className="text-xs font-black text-slate-400 mb-2">المراقب</p>
                <p className="text-xl font-black text-slate-900">{record.proctorName}</p>
              </div>
              <div className="p-6 rounded-[2rem] bg-slate-50 border border-slate-100">
                <p className="text-xs font-black text-slate-400 mb-2">المستلم</p>
                <p className="text-xl font-black text-slate-900">{record.receiverName}</p>
              </div>
            </div>

            <div className="rounded-[2rem] border border-emerald-100 bg-emerald-50 p-6 flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <HeartHandshake size={24} />
              </div>
              <div>
                <h2 className="text-xl font-black text-emerald-900">شكر وتقدير</h2>
                <p className="mt-2 font-bold text-emerald-800 leading-8">
                  شكرًا للمراقب <span className="font-black">{record.proctorName}</span> وللمستلم <span className="font-black">{record.receiverName}</span> على توثيق عملية الرصد والاستلام بصورة نظامية.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {timeline.map(item => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className={`rounded-[2rem] p-5 border ${item.tone}`}>
                    <Icon size={28} />
                    <p className="text-xs font-black mt-4 opacity-70">{item.label}</p>
                    <p className="text-2xl font-black mt-1">{item.value}</p>
                  </div>
                );
              })}
            </div>

            <div className="overflow-hidden rounded-[2rem] border border-slate-200">
              <table className="w-full text-right">
                <tbody className="divide-y divide-slate-100">
                  {[
                    ['الصف', grade || '-'],
                    ['إجمالي الطلاب', record.total],
                    ['حاضر', record.present],
                    ['غائب', record.absent],
                    ['متأخر', record.late],
                    ['حالة الاستلام', record.isReceived ? 'تم الاستلام نظاميًا' : 'بانتظار استلام الكنترول'],
                    [`توقيع ${signerLabel}`, signerName],
                  ].map(([label, value]) => (
                    <tr key={String(label)} className="bg-white">
                      <th className="w-44 p-4 bg-slate-50 text-slate-500 text-sm font-black">{label}</th>
                      <td className="p-4 text-slate-900 font-black">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-center gap-3 text-emerald-700 font-black bg-white">
              <CheckCircle2 size={22} />
              <span>تم فتح هذا الرابط من رمز التحقق الخاص بتقرير المسير.</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default SupervisionVerification;
