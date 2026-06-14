import React, { useMemo, useState } from 'react';
import {
  Activity,
  Award,
  BarChart3,
  CheckCircle2,
  Clock3,
  Gauge,
  Medal,
  MessageSquareWarning,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  UserCheck,
  UserCog,
  UserRoundCheck,
  UserX,
  Users,
} from 'lucide-react';
import { Absence, CommitteeReport, ControlRequest, DeliveryLog, ExamSchedule, Student, Supervision, SystemConfig, User, UserRole } from '../../types';
import { getActualSupervisionStart } from '../../utils/proctorTime';
import { cleanControlRequestText, isInternalSignatureRecord } from '../../services/signatures';

interface Props {
  students: Student[];
  users: User[];
  supervisions: Supervision[];
  absences: Absence[];
  deliveryLogs: DeliveryLog[];
  controlRequests: ControlRequest[];
  committeeReports: CommitteeReport[];
  examSchedule: ExamSchedule[];
  systemConfig: SystemConfig;
  publicMode?: boolean;
}

type PeopleTab = 'PROCTOR' | 'CONTROL' | 'ASSISTANT_CONTROL' | 'COUNSELOR';

const LIVE_URL = 'https://control-exam.vercel.app/?portfolio_live=1';

const tabMeta: Record<PeopleTab, { label: string; subtitle: string; role: UserRole; icon: any }> = {
  PROCTOR: { label: 'المراقبون', subtitle: 'الانضباط، البلاغات، الرصد، وأثر كل مراقب', role: 'PROCTOR', icon: UserRoundCheck },
  CONTROL: { label: 'استلام الكنترول', subtitle: 'الاستلامات المكتملة والمعلقة وسرعة التعامل', role: 'CONTROL', icon: ShieldCheck },
  ASSISTANT_CONTROL: { label: 'مساعدو الكنترول', subtitle: 'التعامل مع البلاغات، سرعة الإغلاق، وتغطية اللجان', role: 'ASSISTANT_CONTROL', icon: UserCog },
  COUNSELOR: { label: 'الموجهون', subtitle: 'متابعة الغياب والتأخير والصفوف المسندة', role: 'COUNSELOR', icon: Users },
};

const dateKey = (value?: string | null) => {
  if (!value) return '';
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return text.slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const sameDate = (value: string | undefined | null, date: string) => dateKey(value) === date;
const sameCommittee = (a: unknown, b: unknown) => String(a || '') === String(b || '');

const safeTime = (value?: string | null) => {
  if (!value) return '---';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '---';
  return d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
};

const minutesBetween = (start?: string | null, end?: string | null) => {
  if (!start || !end) return null;
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.max(0, Math.round((b - a) / 60000));
};

const avg = (values: Array<number | null>) => {
  const valid = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (!valid.length) return null;
  return Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
};

const formatMins = (value: number | null) => value === null ? '---' : `${value} د`;

const statusDone = (status?: string) => status === 'DONE' || status === 'CONFIRMED';

const getRiyadhToday = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (type: string) => parts.find(part => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
};

const pickDefaultDate = (dates: string[], activeDate?: string) => {
  const sorted = [...dates].filter(Boolean).sort();
  const today = getRiyadhToday();
  if (sorted.includes(today)) return today;
  if (sorted.length) {
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    if (today > last) return last;
    if (today < first) return first;
    return [...sorted].reverse().find(day => day <= today) || first;
  }
  return activeDate || today;
};

export const ComprehensiveStats: React.FC<Props> = ({
  students,
  users,
  supervisions,
  absences,
  deliveryLogs,
  controlRequests,
  committeeReports,
  examSchedule,
  systemConfig,
  publicMode = false,
}) => {
  const allDates = useMemo(() => {
    return Array.from(new Set([
      ...examSchedule.map(item => dateKey(item.exam_date)),
      ...supervisions.map(item => dateKey(item.date)),
      ...absences.map(item => dateKey(item.date)),
      ...deliveryLogs.map(item => dateKey(item.time)),
      ...controlRequests.map(item => dateKey(item.time)),
    ].filter(Boolean))).sort();
  }, [absences, controlRequests, deliveryLogs, examSchedule, supervisions]);

  const defaultDate = pickDefaultDate(allDates, systemConfig.active_exam_date);
  const [selectedDate, setSelectedDate] = useState(defaultDate);
  const [activeTab, setActiveTab] = useState<PeopleTab>('PROCTOR');

  const data = useMemo(() => {
    const dayExams = examSchedule.filter(item => sameDate(item.exam_date, selectedDate));
    const gradeScope = new Set(dayExams.flatMap(item => item.grades || []));
    const committeeScope = new Set<string>([
      ...dayExams.flatMap(item => (item.committees || []).map(String)),
      ...supervisions.filter(item => sameDate(item.date, selectedDate)).map(item => String(item.committee_number)),
    ]);

    const dayStudents = students.filter(student => {
      if (gradeScope.size && !gradeScope.has(student.grade)) return false;
      if (committeeScope.size && !committeeScope.has(String(student.committee_number))) return false;
      return true;
    });

    const dayAbsences = absences.filter(item => sameDate(item.date, selectedDate));
    const dayLogs = deliveryLogs.filter(item => sameDate(item.time, selectedDate));
    const dayRequests = controlRequests.filter(item => sameDate(item.time, selectedDate) && !isInternalSignatureRecord(item));
    const daySupervisions = supervisions.filter(item => sameDate(item.date, selectedDate));
    const dayReports = committeeReports.filter(item => sameDate(item.date, selectedDate));

    const committees = Array.from(new Set([
      ...dayStudents.map(item => String(item.committee_number)).filter(Boolean),
      ...daySupervisions.map(item => String(item.committee_number)),
      ...dayLogs.map(item => String(item.committee_number)),
      ...dayRequests.map(item => String(item.committee)),
    ])).sort((a, b) => Number(a) - Number(b));

    const committeeStats = committees.map(num => {
      const cStudents = dayStudents.filter(student => sameCommittee(student.committee_number, num));
      const cAbsences = dayAbsences.filter(item => sameCommittee(item.committee_number, num));
      const cRequests = dayRequests.filter(item => sameCommittee(item.committee, num));
      const cLogs = dayLogs.filter(item => sameCommittee(item.committee_number, num));
      const cSupervisions = daySupervisions.filter(item => sameCommittee(item.committee_number, num));
      const proctors = Array.from(new Set(cSupervisions.map(item => users.find(user => user.id === item.teacher_id || user.national_id === item.teacher_id)?.full_name || item.teacher_id).filter(Boolean)));
      const joinTime = getActualSupervisionStart(cSupervisions);
      const issueLog = cLogs.filter(item => item.type === 'ISSUE').sort((a, b) => String(a.time).localeCompare(String(b.time)))[0];
      const receiveLogs = cLogs.filter(item => item.type === 'RECEIVE').sort((a, b) => String(a.time).localeCompare(String(b.time)));
      const confirmedReceipts = receiveLogs.filter(item => item.status === 'CONFIRMED');
      const firstReceipt = confirmedReceipts[0] || receiveLogs[0];
      const absent = cAbsences.filter(item => item.type === 'ABSENT').length;
      const late = cAbsences.filter(item => item.type === 'LATE').length;
      const openRequests = cRequests.filter(item => !statusDone(item.status)).length;
      const sessionMins = minutesBetween(joinTime, firstReceipt?.time);
      const receiptMins = minutesBetween(issueLog?.time || joinTime, firstReceipt?.time);
      const reports = dayReports.filter(item => sameCommittee(item.committee_number, num)).length;
      const disciplineScore = Math.max(0, 100 - absent * 8 - late * 5 - openRequests * 9 - (!firstReceipt ? 10 : 0) + (reports ? 4 : 0));

      return {
        num,
        students: cStudents.length,
        present: Math.max(cStudents.length - absent, 0),
        absent,
        late,
        requests: cRequests.length,
        openRequests,
        doneRequests: cRequests.filter(item => statusDone(item.status)).length,
        proctors,
        joinTime,
        issueTime: issueLog?.time,
        receiptTime: firstReceipt?.time,
        receivers: Array.from(new Set(receiveLogs.map(item => `${item.teacher_name}${item.grade ? ` (${item.grade})` : ''}`).filter(Boolean))),
        sessionMins,
        receiptMins,
        received: Boolean(firstReceipt),
        reports,
        disciplineScore,
        followScore: absent * 4 + late * 2 + openRequests * 5 + (!firstReceipt ? 4 : 0),
      };
    });

    const absentIds = new Set(dayAbsences.filter(item => item.type === 'ABSENT').map(item => item.student_id));
    const lateIds = new Set(dayAbsences.filter(item => item.type === 'LATE').map(item => item.student_id));
    const present = Math.max(dayStudents.length - absentIds.size, 0);
    const attendanceRate = dayStudents.length ? Math.round((present / dayStudents.length) * 100) : 0;
    const received = committeeStats.filter(item => item.received).length;
    const completionRate = committeeStats.length ? Math.round((received / committeeStats.length) * 100) : 0;
    const unresolvedRate = dayRequests.length ? Math.round((dayRequests.filter(item => !statusDone(item.status)).length / dayRequests.length) * 100) : 0;
    const avgReceipt = avg(committeeStats.map(item => item.receiptMins));
    const qualityScore = Math.max(0, Math.min(100, Math.round(
      completionRate * 0.32 +
      attendanceRate * 0.25 +
      (100 - unresolvedRate) * 0.2 +
      (avgReceipt === null ? 12 : Math.max(0, 12 - Math.min(12, avgReceipt / 4))) +
      (committeeStats.length ? Math.min(11, (dayReports.length / committeeStats.length) * 11) : 0)
    )));

    const materialRecords = examSchedule.map(exam => {
      const examDate = dateKey(exam.exam_date);
      const examSupervisions = supervisions.filter(item => sameDate(item.date, examDate) && String(item.period) === String(exam.period) && item.subject === exam.subject);
      const examCommittees = Array.from(new Set([
        ...(exam.committees || []).map(String),
        ...examSupervisions.map(item => String(item.committee_number)),
      ])).filter(Boolean);
      const examStudents = students.filter(student => {
        if (exam.grades?.length && !exam.grades.includes(student.grade)) return false;
        if (examCommittees.length && !examCommittees.includes(String(student.committee_number))) return false;
        return true;
      });
      const examAbsences = absences.filter(item => sameDate(item.date, examDate) && String(item.period) === String(exam.period));
      const examLogs = deliveryLogs.filter(item => sameDate(item.time, examDate) && String(item.period) === String(exam.period));
      const examRequests = controlRequests.filter(item => sameDate(item.time, examDate) && !isInternalSignatureRecord(item) && (!examCommittees.length || examCommittees.includes(String(item.committee))));
      const examReports = committeeReports.filter(item => sameDate(item.date, examDate) && (!examCommittees.length || examCommittees.includes(String(item.committee_number))));
      const absent = examAbsences.filter(item => item.type === 'ABSENT').length;
      const late = examAbsences.filter(item => item.type === 'LATE').length;
      const receiveLogs = examLogs.filter(item => item.type === 'RECEIVE');
      return {
        id: exam.id,
        date: examDate,
        subject: exam.subject,
        period: exam.period,
        grades: exam.grades || [],
        committees: examCommittees.length,
        students: examStudents.length,
        present: Math.max(examStudents.length - absent, 0),
        absent,
        late,
        proctors: Array.from(new Set(examSupervisions.map(item => users.find(user => user.id === item.teacher_id || user.national_id === item.teacher_id)?.full_name || item.teacher_id))).slice(0, 8),
        receiptRate: examCommittees.length ? Math.round((new Set(receiveLogs.map(item => String(item.committee_number))).size / examCommittees.length) * 100) : 0,
        requests: examRequests.length,
        openRequests: examRequests.filter(item => !statusDone(item.status)).length,
        reports: examReports.length,
      };
    }).sort((a, b) => `${a.date}-${a.period}`.localeCompare(`${b.date}-${b.period}`));

    const peopleStats = (tab: PeopleTab) => {
      const meta = tabMeta[tab];
      const members = users.filter(user => user.role === meta.role);
      return members.map(user => {
        const nameMatch = (value?: string) => String(value || '').trim() === user.full_name;
        const assignedCommittees = new Set((user.assigned_committees || []).map(String));
        const assignedGrades = new Set((user.assigned_grades || []).map(String));
        const userSupervisions = daySupervisions.filter(item => item.teacher_id === user.id || item.teacher_id === user.national_id);
        const userCommittees = committeeStats.filter(item => {
          if (tab === 'PROCTOR') return userSupervisions.some(sv => sameCommittee(sv.committee_number, item.num));
          if (assignedCommittees.size) return assignedCommittees.has(item.num);
          return false;
        });
        const userReceipts = dayLogs.filter(item => item.type === 'RECEIVE' && nameMatch(item.teacher_name));
        const userRequests = dayRequests.filter(item => nameMatch(item.from) || nameMatch(item.assistant_name));
        const userAbsences = dayAbsences.filter(item => {
          if (tab === 'PROCTOR') return item.proctor_id === user.id || item.proctor_id === user.national_id;
          if (tab === 'COUNSELOR' && assignedGrades.size) {
            const student = students.find(s => s.id === item.student_id);
            return student ? assignedGrades.has(student.grade) : false;
          }
          return false;
        });
        const handled = userRequests.filter(item => statusDone(item.status)).length;
        const avgHandling = avg(userRequests.map(item => {
          const relatedReceipt = dayLogs.find(log => sameCommittee(log.committee_number, item.committee) && log.type === 'RECEIVE');
          return minutesBetween(item.time, relatedReceipt?.time);
        }));
        const assignedCount = tab === 'CONTROL' ? assignedGrades.size : tab === 'ASSISTANT_CONTROL' ? assignedCommittees.size : tab === 'PROCTOR' ? userSupervisions.length : assignedGrades.size;
        const score = Math.min(100, Math.round(
          (assignedCount ? 18 : 8) +
          (userReceipts.length ? 24 : tab === 'CONTROL' ? 8 : 16) +
          (userRequests.length ? Math.min(20, handled * 6 + 6) : 18) +
          (userAbsences.length ? 15 : tab === 'COUNSELOR' ? 8 : 14) +
          (avgHandling === null ? 10 : Math.max(4, 20 - Math.min(16, avgHandling / 3)))
        ));
        return {
          id: user.id,
          name: user.full_name,
          assignedCount,
          committees: Array.from(new Set([...userCommittees.map(item => item.num), ...userReceipts.map(item => String(item.committee_number))])),
          receipts: userReceipts.length,
          confirmedReceipts: userReceipts.filter(item => item.status === 'CONFIRMED').length,
          requests: userRequests.length,
          handled,
          absences: userAbsences.filter(item => item.type === 'ABSENT').length,
          late: userAbsences.filter(item => item.type === 'LATE').length,
          avgHandling,
          score,
          rating: score >= 85 ? 'متميز' : score >= 70 ? 'منضبط' : score >= 55 ? 'جيد' : 'يحتاج متابعة',
        };
      }).filter(item => item.assignedCount || item.receipts || item.requests || item.absences || item.late).sort((a, b) => b.score - a.score);
    };

    const committeeComparison = [...committeeStats].sort((a, b) => {
      if (a.openRequests !== b.openRequests) return a.openRequests - b.openRequests;
      if (b.disciplineScore !== a.disciplineScore) return b.disciplineScore - a.disciplineScore;
      return a.followScore - b.followScore;
    });

    const timeline = [
      ...dayExams.map(item => ({ time: `${selectedDate}T${item.start_time || '00:00'}`, title: `بداية اختبار ${item.subject}`, tone: 'blue' })),
      ...committeeStats.filter(item => item.joinTime).map(item => ({ time: item.joinTime!, title: `دخول مراقب لجنة ${item.num}`, tone: 'emerald' })),
      ...committeeStats.filter(item => item.receiptTime).map(item => ({ time: item.receiptTime!, title: `استلام كنترول لجنة ${item.num}`, tone: 'indigo' })),
      ...dayRequests.map(item => ({ time: item.time, title: `بلاغ لجنة ${item.committee}: ${cleanControlRequestText(item.text)}`, tone: statusDone(item.status) ? 'slate' : 'red' })),
    ].sort((a, b) => String(a.time).localeCompare(String(b.time)));

    return {
      dayExams,
      dayStudents,
      dayAbsences,
      dayLogs,
      dayRequests,
      dayReports,
      committeeStats,
      committeeComparison,
      present,
      absent: absentIds.size,
      late: lateIds.size,
      attendanceRate,
      received,
      completionRate,
      openRequests: dayRequests.filter(item => !statusDone(item.status)).length,
      doneRequests: dayRequests.filter(item => statusDone(item.status)).length,
      criticalCommittees: [...committeeStats].sort((a, b) => b.followScore - a.followScore).slice(0, 6),
      materialRecords,
      peopleStats,
      timeline,
      qualityScore,
      avgReceipt,
    };
  }, [absences, committeeReports, controlRequests, deliveryLogs, examSchedule, selectedDate, students, supervisions, users]);

  const activePeople = data.peopleStats(activeTab);
  const activeMeta = tabMeta[activeTab];
  const ActiveIcon = activeMeta.icon;

  return (
    <div className={`min-h-screen text-right ${publicMode ? 'bg-slate-50 px-3 py-4 sm:px-5' : 'space-y-8 pb-20'}`} dir="rtl">
      <div className="overflow-hidden rounded-[1.6rem] bg-slate-950 text-white shadow-2xl md:rounded-[2rem]">
        <div className="grid gap-5 p-5 md:p-7 lg:grid-cols-[1.35fr_0.65fr] lg:items-center">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-black text-blue-100">
              <Sparkles size={14} /> ملف الإنجاز الحي
            </div>
            <h2 className="text-2xl font-black tracking-tight sm:text-4xl md:text-5xl">إحصائيات شاملة ومباشرة</h2>
            <p className="mt-3 max-w-3xl text-sm font-bold leading-7 text-slate-300">
              لوحة متابعة لحظية تجمع إنجاز المواد، جودة اليوم، مقارنة اللجان، وتحليل فرق العمل: المراقبين، استلام الكنترول، المساعدين، والموجهين.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            {!publicMode && (
              <>
                <p className="text-xs font-black text-slate-400">رابط المتابعة الحية للجوال</p>
                <div className="mt-3 rounded-xl bg-white p-3 text-left text-xs font-bold text-slate-950" dir="ltr">{LIVE_URL}</div>
              </>
            )}
            <p className={`text-xs font-black text-slate-400 ${publicMode ? '' : 'mt-4'}`}>فلترة التاريخ</p>
            <select value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="mt-3 w-full rounded-xl bg-white/10 px-3 py-3 text-xs font-black text-white outline-none">
                {allDates.map(day => <option key={day} value={day} className="text-slate-900">{day}</option>)}
            </select>
            <p className="mt-3 text-[11px] font-bold leading-5 text-slate-400">الافتراضي حسب تاريخ اليوم، وإذا انتهت الاختبارات يعرض آخر اختبار تلقائيًا.</p>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Metric title="مؤشر جودة اليوم" value={`${data.qualityScore}%`} icon={Gauge} tone="bg-emerald-50 text-emerald-700" />
        <Metric title="إجمالي اللجان" value={data.committeeStats.length} icon={Target} tone="bg-blue-50 text-blue-700" />
        <Metric title="الحضور" value={`${data.attendanceRate}%`} icon={UserCheck} tone="bg-teal-50 text-teal-700" />
        <Metric title="الاستلام المكتمل" value={`${data.completionRate}%`} icon={CheckCircle2} tone="bg-indigo-50 text-indigo-700" />
        <Metric title="بلاغات مفتوحة" value={data.openRequests} icon={MessageSquareWarning} tone="bg-rose-50 text-rose-700" />
      </div>

      <section className="mt-5 rounded-[1.6rem] border border-slate-200 bg-white p-4 shadow-sm md:rounded-[2rem] md:p-6">
        <SectionTitle icon={BarChart3} title="سجل إنجاز المواد" subtitle="مقارنة تراكمية للمواد والفترات طوال الاختبارات، وليست مقيدة باليوم المحدد" />
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100 text-slate-600">
                {['التاريخ', 'المادة', 'الفترة', 'اللجان', 'الطلاب', 'الحضور', 'الغياب', 'التأخير', 'اكتمال الاستلام', 'بلاغات', 'مفتوحة', 'تقارير'].map(head => (
                  <th key={head} className="border border-slate-200 p-3 font-black">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.materialRecords.map(item => (
                <tr key={item.id} className="font-bold text-slate-700">
                  <td className="border border-slate-100 p-3 text-center">{item.date}</td>
                  <td className="border border-slate-100 p-3 font-black text-slate-950">{item.subject}</td>
                  <td className="border border-slate-100 p-3 text-center">{item.period}</td>
                  <td className="border border-slate-100 p-3 text-center">{item.committees}</td>
                  <td className="border border-slate-100 p-3 text-center">{item.students}</td>
                  <td className="border border-slate-100 bg-emerald-50 p-3 text-center text-emerald-700">{item.present}</td>
                  <td className="border border-slate-100 bg-rose-50 p-3 text-center text-rose-700">{item.absent}</td>
                  <td className="border border-slate-100 bg-amber-50 p-3 text-center text-amber-700">{item.late}</td>
                  <td className="border border-slate-100 p-3 text-center">{item.receiptRate}%</td>
                  <td className="border border-slate-100 p-3 text-center">{item.requests}</td>
                  <td className="border border-slate-100 p-3 text-center">{item.openRequests}</td>
                  <td className="border border-slate-100 p-3 text-center">{item.reports}</td>
                </tr>
              ))}
              {!data.materialRecords.length && <tr><td colSpan={12} className="p-8 text-center font-bold text-slate-400">لا توجد مواد مسجلة.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <section className="rounded-[1.6rem] border border-slate-200 bg-white p-4 shadow-sm md:rounded-[2rem] md:p-6">
          <SectionTitle icon={Trophy} title="مقارنة لجان اليوم الحالي" subtitle="الأقل بلاغات، الأعلى انضباطية، واكتمال الاستلام والرصد" />
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="bg-slate-100 text-slate-600">
                  {['الترتيب', 'اللجنة', 'انضباطية', 'بلاغات مفتوحة', 'غياب', 'تأخير', 'استلام', 'المراقبون'].map(head => (
                    <th key={head} className="border border-slate-200 p-3 font-black">{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.committeeComparison.map((item, index) => (
                  <tr key={item.num} className="font-bold text-slate-700">
                    <td className="border border-slate-100 p-3 text-center">{index + 1}</td>
                    <td className="border border-slate-100 p-3 text-center font-black text-slate-950">لجنة {item.num}</td>
                    <td className="border border-slate-100 p-3 text-center text-emerald-700">{item.disciplineScore}%</td>
                    <td className="border border-slate-100 p-3 text-center text-rose-700">{item.openRequests}</td>
                    <td className="border border-slate-100 p-3 text-center">{item.absent}</td>
                    <td className="border border-slate-100 p-3 text-center">{item.late}</td>
                    <td className="border border-slate-100 p-3 text-center">{item.received ? 'مكتمل' : 'معلق'}</td>
                    <td className="border border-slate-100 p-3 text-xs">{item.proctors.join('، ') || 'غير مسند'}</td>
                  </tr>
                ))}
                {!data.committeeComparison.length && <tr><td colSpan={8} className="p-8 text-center font-bold text-slate-400">لا توجد لجان في اليوم الحالي.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-[1.6rem] border border-slate-200 bg-white p-4 shadow-sm md:rounded-[2rem] md:p-6">
          <SectionTitle icon={Activity} title="خريطة اليوم الزمنية" subtitle="أبرز الأحداث مرتبة حسب الوقت في اليوم المحدد" />
          <div className="mt-5 max-h-[430px] space-y-3 overflow-y-auto pr-1">
            {data.timeline.slice(0, 28).map((item, idx) => (
              <div key={`${item.time}-${idx}`} className="flex gap-3 rounded-2xl bg-slate-50 p-4">
                <div className="w-20 shrink-0 rounded-xl bg-white px-3 py-2 text-center text-xs font-black text-slate-600">{safeTime(item.time)}</div>
                <p className="text-sm font-bold leading-7 text-slate-700">{item.title}</p>
              </div>
            ))}
            {!data.timeline.length && <p className="py-10 text-center text-sm font-bold text-slate-400">لا توجد أحداث زمنية مسجلة.</p>}
          </div>
        </section>
      </div>

      <section className="mt-5 rounded-[1.6rem] border border-slate-200 bg-white p-4 shadow-sm md:rounded-[2rem] md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <SectionTitle icon={ActiveIcon} title={`تحليل ${activeMeta.label}`} subtitle={activeMeta.subtitle} />
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-2 sm:flex">
            {(Object.keys(tabMeta) as PeopleTab[]).map(tab => {
              const MetaIcon = tabMeta[tab].icon;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-xs font-black transition ${activeTab === tab ? 'bg-slate-950 text-white shadow-lg' : 'text-slate-500 hover:bg-white'}`}
                >
                  <MetaIcon size={15} /> {tabMeta[tab].label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {activePeople.map(item => (
            <div key={item.id} className="rounded-[1.4rem] border border-slate-100 bg-slate-50 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-slate-950">{item.name}</p>
                  <p className="mt-1 text-xs font-bold text-slate-400">{item.rating} · لجان: {item.committees.join('، ') || '---'}</p>
                </div>
                <div className="rounded-2xl bg-white p-3 text-center">
                  <p className="text-2xl font-black text-blue-700">{item.score}</p>
                  <p className="text-[10px] font-black text-slate-400">نقطة</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold text-slate-600">
                <Mini label="الإسنادات" value={item.assignedCount} />
                <Mini label="استلامات" value={item.receipts} tone="text-indigo-700" />
                <Mini label="بلاغات" value={item.requests} tone="text-blue-700" />
                <Mini label="منجزة" value={item.handled} tone="text-emerald-700" />
                <Mini label="غياب متابع" value={item.absences} tone="text-rose-700" />
                <Mini label="تأخير متابع" value={item.late} tone="text-amber-700" />
              </div>
              <div className="mt-4 rounded-2xl bg-white p-3 text-center text-xs font-black text-slate-500">
                متوسط التعامل: {formatMins(item.avgHandling)}
              </div>
            </div>
          ))}
          {!activePeople.length && <p className="col-span-full py-10 text-center text-sm font-bold text-slate-400">لا توجد بيانات كافية لهذا التبويب في اليوم المحدد.</p>}
        </div>
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[0.9fr_1fr]">
        <section className="rounded-[1.6rem] border border-slate-200 bg-white p-4 shadow-sm md:rounded-[2rem] md:p-6">
          <SectionTitle icon={UserX} title="اللجان الأكثر احتياجًا للمتابعة" subtitle="حسب الغياب والتأخير والبلاغات والاستلام" />
          <div className="mt-5 space-y-3">
            {data.criticalCommittees.map(item => (
              <div key={item.num} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-lg font-black text-slate-950">لجنة {item.num}</p>
                  <span className={`rounded-full px-3 py-1 text-xs font-black ${item.followScore >= 8 ? 'bg-rose-100 text-rose-700' : item.followScore > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>مؤشر {item.followScore}</span>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                  <Mini label="طلاب" value={item.students} />
                  <Mini label="غياب" value={item.absent} tone="text-rose-700" />
                  <Mini label="تأخير" value={item.late} tone="text-amber-700" />
                  <Mini label="بلاغ" value={item.openRequests} tone="text-blue-700" />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[1.6rem] border border-slate-200 bg-white p-4 shadow-sm md:rounded-[2rem] md:p-6">
          <SectionTitle icon={Award} title="لوحة الشغف والتميز" subtitle="إشارات تحفيزية للفريق حسب بيانات اليوم" />
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {activePeople.slice(0, 6).map(item => (
              <div key={`award-${item.id}`} className="rounded-2xl bg-gradient-to-br from-amber-50 to-white p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700"><Medal size={22} /></span>
                  <div>
                    <p className="font-black text-slate-950">{item.name}</p>
                    <p className="text-xs font-bold text-amber-700">{item.score >= 85 ? 'وسام التميز اليومي' : item.receipts ? 'وسام سرعة الاستلام' : item.requests ? 'وسام متابعة البلاغات' : 'وسام الانضباط'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

const Metric = ({ title, value, icon: Icon, tone }: { title: string; value: string | number; icon: any; tone: string }) => (
  <div className={`rounded-[1.25rem] border border-slate-100 p-4 shadow-sm md:rounded-[1.5rem] md:p-5 ${tone}`}>
    <div className="flex items-center justify-between gap-3">
      <Icon size={22} />
      <span className="text-[11px] font-black md:text-xs">{title}</span>
    </div>
    <p className="mt-3 text-3xl font-black tabular-nums md:text-4xl">{value}</p>
  </div>
);

const SectionTitle = ({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle: string }) => (
  <div className="flex items-center gap-3">
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white"><Icon size={22} /></div>
    <div>
      <h3 className="text-lg font-black text-slate-950 md:text-xl">{title}</h3>
      <p className="mt-1 text-xs font-bold leading-5 text-slate-400">{subtitle}</p>
    </div>
  </div>
);

const Mini = ({ label, value, tone = 'text-slate-700' }: { label: string; value: string | number; tone?: string }) => (
  <div className="rounded-xl bg-white p-3 text-center">
    <p className={`text-lg font-black ${tone}`}>{value}</p>
    <p className="text-[10px] font-black text-slate-400">{label}</p>
  </div>
);

export default ComprehensiveStats;
