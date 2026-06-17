import React, { useState, useMemo, useEffect } from 'react';
import {
  CalendarDays,
  Check,
  Edit2,
  Printer,
  RefreshCcw,
  Search,
  Trash2,
  UserX,
  Users,
  Wand2,
  ArrowRight,
  AlertTriangle,
  GripVertical
} from 'lucide-react';
import { ExamSchedule, Student, Supervision, User } from '../../types';
import { APP_CONFIG } from '../../constants';

interface Props {
  users: User[];
  students: Student[];
  supervisions: Supervision[];
  examSchedule?: ExamSchedule[];
  onUpsertExamSchedule?: (item: Partial<ExamSchedule>) => Promise<void>;
  onDeleteExamSchedule?: (id: string) => Promise<void>;
  onCommit?: (items: any[], replaceExisting: boolean) => Promise<void>;
  onDeleteSupervisions?: (ids: string[]) => Promise<void>;
  systemConfig?: { academic_year?: string; [key: string]: any };
}

export interface SmartDistributionItem {
  id: string; // temp unique ID for dragging
  teacherId: string;
  teacherName: string;
  committeeNumber: string; // 'احتياط' for reserves
  assignmentType: 'PRIMARY' | 'RESERVE';
  previousPrimaryCount: number;
  previousReserveCount: number;
  date: string;
  period: number;
  subject: string;
}

type DistributionPeriod = {
  date: string;
  period: number;
  subjects: string[];
  grades: string[];
  scheduleIds: string[];
};

type WizardStep = 'SELECT_EXAM' | 'EXCLUDE_PROCTORS' | 'PREVIEW';
type DistributionMode = 'AUTO' | 'MANUAL';

const cleanDistributionSubject = (subject?: string) =>
  String(subject || '')
    .replace(/\[RESERVE\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const SmartProctorDistribution: React.FC<Props> = ({
  users,
  students,
  supervisions,
  examSchedule = [],
  systemConfig,
  onUpsertExamSchedule,
  onDeleteExamSchedule,
  onCommit,
  onDeleteSupervisions,
}) => {
  const [step, setStep] = useState<WizardStep>('SELECT_EXAM');
  const [selectedPeriod, setSelectedPeriod] = useState<DistributionPeriod | null>(null);
  const [excludedProctorIds, setExcludedProctorIds] = useState<string[]>([]);
  const [distribution, setDistribution] = useState<SmartDistributionItem[]>([]);
  const [searchProctor, setSearchProctor] = useState('');
  const [reserveSearch, setReserveSearch] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [distributionMode, setDistributionMode] = useState<DistributionMode>('AUTO');
  const [expandedPeriodKey, setExpandedPeriodKey] = useState<string | null>(null);
  
  const [distributionFilter, setDistributionFilter] = useState(''); // Used to view past distributions
  
  const today = new Date().toISOString().split('T')[0];
  const [newExam, setNewExam] = useState<Partial<ExamSchedule>>({
    exam_date: today,
    subject: '',
    period: 1,
    start_time: '08:00',
    end_time: '',
    grades: [],
    status: 'READY',
  });

  const proctors = useMemo(() => users.filter(u => u.role === 'PROCTOR'), [users]);
  const allGrades = useMemo(() => {
    const unique = Array.from(new Set(students.map(s => s.grade).filter(Boolean)));
    return unique.sort();
  }, [students]);

  // View Past Distributions
  const pastDistributions = useMemo(() => {
    const groups = new Map<string, Supervision[]>();
    supervisions.forEach(s => {
      const dateKey = String(s.date || '').slice(0, 10);
      const key = `${dateKey}__${s.period || 1}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(s);
    });
    return Array.from(groups.entries()).map(([key, items]) => {
      const [date, period] = key.split('__');
      const subject = Array.from(new Set(
        items
          .map(i => cleanDistributionSubject(i.subject))
          .filter(Boolean)
      )).join('، ');
      return { key, date, period: Number(period), subject, count: items.length, items };
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [supervisions]);

  const availablePeriods = useMemo(() => {
    const groups = new Map<string, DistributionPeriod>();
    examSchedule.forEach(e => {
      const key = `${e.exam_date}__${e.period}`;
      if (!groups.has(key)) {
        groups.set(key, { date: e.exam_date, period: e.period, subjects: [], grades: [], scheduleIds: [] });
      }
      const g = groups.get(key)!;
      if (e.id && !g.scheduleIds.includes(e.id)) g.scheduleIds.push(e.id);
      if (e.subject && !g.subjects.includes(e.subject)) g.subjects.push(e.subject);
      if (e.grades) {
        e.grades.forEach(gr => {
          if (!g.grades.includes(gr)) g.grades.push(gr);
        });
      }
    });
    return Array.from(groups.values()).sort((a, b) => a.date.localeCompare(b.date) || a.period - b.period);
  }, [examSchedule]);

  // Handlers for Drag and Drop
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedItemId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const getActiveCommittees = (period: DistributionPeriod) => {
    const involvedStudents = period.grades.length
      ? students.filter(s => period.grades.includes(s.grade))
      : students;
    return (Array.from(new Set(involvedStudents.map(s => s.committee_number).filter(Boolean))) as string[])
      .sort((a, b) => Number(a) - Number(b));
  };

  const getProctorLoads = (period: DistributionPeriod) => proctors.map(p => {
    const pastSupervisions = supervisions.filter(s =>
      s.teacher_id === p.id &&
      (s.date < period.date || (s.date === period.date && Number(s.period) < period.period))
    );
    const primaryCount = pastSupervisions.filter(s => s.assignment_type !== 'RESERVE').length;
    const reserveCount = pastSupervisions.filter(s => s.assignment_type === 'RESERVE').length;
    return {
      id: p.id,
      name: p.full_name,
      primaryCount,
      reserveCount,
      weight: (primaryCount * 2) + reserveCount + Math.random(),
    };
  });

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedItemId || draggedItemId === targetId) return;

    setDistribution(prev => {
      const sourceIdx = prev.findIndex(item => item.id === draggedItemId);
      const targetIdx = prev.findIndex(item => item.id === targetId);
      if (sourceIdx === -1 || targetIdx === -1) return prev;

      const newDist = [...prev];
      const sourceItem = { ...newDist[sourceIdx] };
      const targetItem = { ...newDist[targetIdx] };

      const sourceTeacher = {
        teacherId: sourceItem.teacherId,
        teacherName: sourceItem.teacherName,
        previousPrimaryCount: sourceItem.previousPrimaryCount,
        previousReserveCount: sourceItem.previousReserveCount,
      };

      sourceItem.teacherId = targetItem.teacherId;
      sourceItem.teacherName = targetItem.teacherName;
      sourceItem.previousPrimaryCount = targetItem.previousPrimaryCount;
      sourceItem.previousReserveCount = targetItem.previousReserveCount;

      targetItem.teacherId = sourceTeacher.teacherId;
      targetItem.teacherName = sourceTeacher.teacherName;
      targetItem.previousPrimaryCount = sourceTeacher.previousPrimaryCount;
      targetItem.previousReserveCount = sourceTeacher.previousReserveCount;

      newDist[sourceIdx] = sourceItem;
      newDist[targetIdx] = targetItem;

      return newDist;
    });
    setDraggedItemId(null);
  };

  const handleDropToReserve = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedItemId || distributionMode !== 'MANUAL') return;

    setDistribution(prev => {
      const sourceIdx = prev.findIndex(item => item.id === draggedItemId);
      if (sourceIdx === -1) return prev;

      const sourceItem = prev[sourceIdx];
      if (sourceItem.assignmentType !== 'PRIMARY' || !sourceItem.teacherId) return prev;

      const returnedTeacher = {
        teacherId: sourceItem.teacherId,
        teacherName: sourceItem.teacherName,
        previousPrimaryCount: sourceItem.previousPrimaryCount,
        previousReserveCount: sourceItem.previousReserveCount,
      };

      return [
        ...prev.map((item, idx) => idx === sourceIdx ? {
          ...item,
          teacherId: '',
          teacherName: '',
          previousPrimaryCount: 0,
          previousReserveCount: 0,
        } : item),
        {
          ...sourceItem,
          id: crypto.randomUUID(),
          ...returnedTeacher,
          committeeNumber: 'احتياط',
          assignmentType: 'RESERVE' as const,
        },
      ];
    });
    setDraggedItemId(null);
  };

  const runDistributionAlgorithm = () => {
    if (!selectedPeriod) return;

    const activeCommittees = getActiveCommittees(selectedPeriod);
    const previousLoads = getProctorLoads(selectedPeriod);

    // 2. Filter out excluded
    const available = previousLoads.filter(p => !excludedProctorIds.includes(p.id));

    // 3. Sort by weight ascending (Least loaded first)
    available.sort((a, b) => a.weight - b.weight);

    const neededPrimary = activeCommittees.length;
    const draftedPrimary = available.slice(0, neededPrimary);
    const draftedReserve = available.slice(neededPrimary);

    // Shuffle committees to avoid assigning the same proctor to the same committee number always if loads match
    const shuffledCommittees = [...activeCommittees].sort(() => Math.random() - 0.5);

    const newDistribution: SmartDistributionItem[] = [];

    draftedPrimary.forEach((proctor, index) => {
      newDistribution.push({
        id: crypto.randomUUID(),
        teacherId: proctor.id,
        teacherName: proctor.name,
        committeeNumber: shuffledCommittees[index] || String(index + 1),
        assignmentType: 'PRIMARY',
        previousPrimaryCount: proctor.primaryCount,
        previousReserveCount: proctor.reserveCount,
        date: selectedPeriod.date,
        period: selectedPeriod.period,
        subject: selectedPeriod.subjects.join('، ')
      });
    });

    draftedReserve.forEach((proctor) => {
      newDistribution.push({
        id: crypto.randomUUID(),
        teacherId: proctor.id,
        teacherName: proctor.name,
        committeeNumber: 'احتياط',
        assignmentType: 'RESERVE',
        previousPrimaryCount: proctor.primaryCount,
        previousReserveCount: proctor.reserveCount,
        date: selectedPeriod.date,
        period: selectedPeriod.period,
        subject: selectedPeriod.subjects.join('، ')
      });
    });

    // Sort the final distribution by committee number for Primary, then Reserve
    newDistribution.sort((a, b) => {
      if (a.assignmentType !== b.assignmentType) return a.assignmentType === 'PRIMARY' ? -1 : 1;
      return Number(a.committeeNumber) - Number(b.committeeNumber);
    });

    setDistribution(newDistribution);
    setDistributionMode('AUTO');
    setReserveSearch('');
    setDraggedItemId(null);
    setStep('PREVIEW');
  };

  const runManualDistribution = () => {
    if (!selectedPeriod) return;

    const activeCommittees = getActiveCommittees(selectedPeriod);
    const available = getProctorLoads(selectedPeriod)
      .filter(p => !excludedProctorIds.includes(p.id))
      .sort((a, b) => a.name.localeCompare(b.name, 'ar'));

    const subject = selectedPeriod.subjects.join('، ');
    const primarySlots: SmartDistributionItem[] = activeCommittees.map(committeeNumber => ({
      id: crypto.randomUUID(),
      teacherId: '',
      teacherName: '',
      committeeNumber,
      assignmentType: 'PRIMARY',
      previousPrimaryCount: 0,
      previousReserveCount: 0,
      date: selectedPeriod.date,
      period: selectedPeriod.period,
      subject,
    }));

    const reserveList: SmartDistributionItem[] = available.map(proctor => ({
      id: crypto.randomUUID(),
      teacherId: proctor.id,
      teacherName: proctor.name,
      committeeNumber: 'احتياط',
      assignmentType: 'RESERVE',
      previousPrimaryCount: proctor.primaryCount,
      previousReserveCount: proctor.reserveCount,
      date: selectedPeriod.date,
      period: selectedPeriod.period,
      subject,
    }));

    setDistribution([...primarySlots, ...reserveList]);
    setDistributionMode('MANUAL');
    setReserveSearch('');
    setDraggedItemId(null);
    setStep('PREVIEW');
  };

  const saveExamSchedule = async () => {
    if (!onUpsertExamSchedule || !newExam.exam_date || !newExam.subject?.trim()) return;
    const payload: Partial<ExamSchedule> = {
      ...newExam,
      id: newExam.id || crypto.randomUUID(),
      subject: newExam.subject.trim(),
      period: Number(newExam.period) || 1,
      start_time: newExam.start_time || '08:00',
      status: newExam.status || 'READY',
    };
    await onUpsertExamSchedule(payload);
    setNewExam({ exam_date: payload.exam_date, subject: '', period: 1, start_time: payload.start_time || '08:00', end_time: '', grades: [], status: 'READY' });
  };

  const editExamScheduleItem = (schedule: ExamSchedule) => {
    setNewExam({
      id: schedule.id,
      exam_date: schedule.exam_date,
      subject: schedule.subject || '',
      period: schedule.period || 1,
      start_time: schedule.start_time || '08:00',
      end_time: schedule.end_time || '',
      grades: schedule.grades || [],
      status: schedule.status || 'READY',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteExamScheduleItem = async (schedule: ExamSchedule) => {
    if (!onDeleteExamSchedule || !schedule.id) return;
    if (!confirm(`هل تريد حذف مادة ${schedule.subject || 'هذا الاختبار'} من قائمة الاختبارات المتاحة؟`)) return;
    await onDeleteExamSchedule(schedule.id);
  };

  const getPeriodScheduleItems = (period: DistributionPeriod) =>
    examSchedule.filter(item => period.scheduleIds.includes(item.id));

  const editPeriod = (period: DistributionPeriod) => {
    const key = `${period.date}_${period.period}`;
    setExpandedPeriodKey(prev => prev === key ? null : key);
  };

  const deletePeriod = async (period: DistributionPeriod) => {
    if (!onDeleteExamSchedule || period.scheduleIds.length === 0) return;
    if (!confirm('هل تريد حذف كل مواد هذا التاريخ والفترة من قائمة الاختبارات المتاحة؟')) return;
    await Promise.all(period.scheduleIds.map(id => onDeleteExamSchedule(id)));
  };

  const handleCommit = async () => {
    if (!selectedPeriod || !distribution.length) return;
    const emptyPrimaryCount = distribution.filter(d => d.assignmentType === 'PRIMARY' && !d.teacherId).length;
    if (emptyPrimaryCount > 0) {
      alert(`تبقى ${emptyPrimaryCount} لجنة بدون مراقب. أكمل السحب والإفلات قبل اعتماد التوزيع.`);
      return;
    }
    const committedDistribution = distribution.filter(d => d.teacherId);
    if (!committedDistribution.length) {
      alert('لا يوجد مراقبون لاعتمادهم في هذا التوزيع.');
      return;
    }
    setIsCommitting(true);
    
    try {
      if (!onCommit) throw new Error('لا توجد دالة اعتماد للتوزيع.');
      const combinedSubject = selectedPeriod.subjects.join('، ');
      await onCommit?.(
        committedDistribution.map(d => ({
          ...d,
          date: selectedPeriod.date,
          period: selectedPeriod.period,
          subject: combinedSubject,
        })),
        true,
      );
      setStep('SELECT_EXAM');
      setSelectedPeriod(null);
      setDistribution([]);
      setExcludedProctorIds([]);
    } catch (err: any) {
      alert('تعذر حفظ التوزيع: ' + err.message);
    } finally {
      setIsCommitting(false);
    }
  };

  const handleDeleteDistribution = async (key: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا التوزيع بالكامل؟')) return;
    const items = pastDistributions.find(p => p.key === key)?.items || [];
    const ids = items.map(i => i.id);
    if (onDeleteSupervisions && ids.length) {
      await onDeleteSupervisions(ids);
    }
  };

  const startEditDistribution = (dist: { date: string; period: number; subject: string; items: Supervision[] }) => {
    const editedItems: SmartDistributionItem[] = dist.items
      .map(item => {
        const isReserve = item.assignment_type === 'RESERVE'
          || String(item.subject || '').includes('[RESERVE]')
          || item.committee_number === 'احتياط';
        const teacher = users.find(u => u.id === item.teacher_id || u.national_id === item.teacher_id);
        const pastTeacherSupervisions = supervisions.filter(s => s.teacher_id === item.teacher_id);
        return {
          id: crypto.randomUUID(),
          teacherId: item.teacher_id,
          teacherName: teacher?.full_name || item.teacher_id,
          committeeNumber: isReserve ? 'احتياط' : item.committee_number,
          assignmentType: isReserve ? 'RESERVE' as const : 'PRIMARY' as const,
          previousPrimaryCount: pastTeacherSupervisions.filter(s => s.id !== item.id && s.assignment_type !== 'RESERVE' && !String(s.subject || '').includes('[RESERVE]')).length,
          previousReserveCount: pastTeacherSupervisions.filter(s => s.id !== item.id && (s.assignment_type === 'RESERVE' || String(s.subject || '').includes('[RESERVE]'))).length,
          date: dist.date,
          period: dist.period,
          subject: dist.subject,
        };
      })
      .sort((a, b) => {
        if (a.assignmentType !== b.assignmentType) return a.assignmentType === 'PRIMARY' ? -1 : 1;
        if (a.assignmentType === 'PRIMARY') return Number(a.committeeNumber) - Number(b.committeeNumber);
        return a.teacherName.localeCompare(b.teacherName, 'ar');
      });

    setSelectedPeriod({
      date: dist.date,
      period: dist.period,
      subjects: dist.subject ? [dist.subject] : ['اختبار'],
      grades: [],
      scheduleIds: [],
    });
    setDistribution(editedItems);
    setDistributionMode('AUTO');
    setReserveSearch('');
    setDraggedItemId(null);
    setStep('PREVIEW');
  };

  const printOfficialReport = (dist: {date: string, period: number, subject: string, items: Supervision[]}) => {
    // Generate an invisible printable area, print it, and remove it
    const printWindow = window.open('', '_blank');
    if (!printWindow) return alert('يرجى السماح بالنوافذ المنبثقة للطباعة');

    const dayName = new Date(dist.date).toLocaleDateString('ar-SA', { weekday: 'long' });
    
    const primary = dist.items.filter(i => i.assignment_type !== 'RESERVE').sort((a,b) => Number(a.committee_number) - Number(b.committee_number));
    const reserve = dist.items.filter(i => i.assignment_type === 'RESERVE');

    const getTeacherName = (id: string) => users.find(u => u.id === id)?.full_name || 'غير معروف';

    const schoolName = systemConfig?.school_name || 'مدرسة عماد الدين زنكي المتوسطة';
    const directorateName = systemConfig?.directorate_name || 'إدارة التعليم';

    const html = `
      <html dir="rtl">
        <head>
          <title>بيان اسماء الملاحظين - ${dist.subject}</title>
          <style>
            body { font-family: 'Arial', sans-serif; padding: 10px; color: #000; font-size: 9pt; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 5px; margin-bottom: 10px; }
            .header-text { text-align: center; line-height: 1.3; font-size: 10pt; font-weight: bold; }
            .logo { width: 60px; height: 60px; object-fit: contain; }
            .title { text-align: center; font-size: 14pt; font-weight: bold; margin-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
            th, td { border: 1px solid #000; padding: 4px; text-align: center; }
            th { background-color: #f0f0f0; font-weight: bold; }
            .info-table th { width: 10%; }
            .info-table td { width: 15%; font-weight: bold; }
            @media print {
              @page { size: A4 portrait; margin: 5mm; }
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; font-size: 8pt; }
              .title { font-size: 12pt; }
              th, td { padding: 3px; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="header-text">
              المملكة العربية السعودية<br/>
              وزارة التعليم<br/>
              ${directorateName}<br/>
              ${schoolName}
            </div>
            <img src="${APP_CONFIG.LOGO_URL}" class="logo" />
            <div class="header-text">
              العام الدراسي<br/>
              ${systemConfig?.academic_year || '1446 / 1447'}<br/>
              الفصل الدراسي<br/>
              نظام كنترول الاختبارات
            </div>
          </div>
          
          <div class="title">بيان اسماء الملاحظين</div>
          
          <table class="info-table">
            <tr>
              <th>اليوم</th>
              <td>${dayName}</td>
              <th>التاريخ</th>
              <td>${dist.date}</td>
              <th>المادة</th>
              <td>${dist.subject}</td>
              <th>الفترة</th>
              <td>${dist.period}</td>
            </tr>
          </table>

          <table>
            <thead>
              <tr>
                <th>رقم اللجنة</th>
                <th>اسم المراقب (أساسي)</th>
                <th>التوقيع</th>
              </tr>
            </thead>
            <tbody>
              ${primary.map(item => `
                <tr>
                  <td>${item.committee_number}</td>
                  <td>${getTeacherName(item.teacher_id)}</td>
                  <td></td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="title" style="font-size: 12pt; margin-top: -5px;">المراقبين الاحتياط</div>
          <table>
            <thead>
              <tr>
                <th>م</th>
                <th>اسم المراقب (احتياط)</th>
                <th>التوقيع</th>
              </tr>
            </thead>
            <tbody>
              ${reserve.map((item, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td>${getTeacherName(item.teacher_id)}</td>
                  <td></td>
                </tr>
              `).join('')}
              ${reserve.length === 0 ? '<tr><td colspan="3">لا يوجد احتياط</td></tr>' : ''}
            </tbody>
          </table>
          
          <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 50px; font-size: 10pt;">
            <div style="text-align: center;">
              <div style="font-weight: bold; font-size: 10pt; margin-bottom: 6px;">رئيس الكنترول</div>
              <div style="font-size: 10pt;">${
                systemConfig?.control_chief_id
                  ? users.find(u => u.id === systemConfig.control_chief_id)?.full_name
                  : users.find(u => u.role === 'CONTROL_MANAGER' || u.role === 'CONTROL')?.full_name || '....................'
              }</div>
            </div>
            <div style="text-align: center;">
              <div style="font-weight: bold; font-size: 10pt; margin-bottom: 6px;">مدير المدرسة</div>
              <div style="font-size: 10pt;">${systemConfig?.principal_name || '....................'}</div>
            </div>
          </div>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  const primaryDistribution = distribution.filter(d => d.assignmentType === 'PRIMARY');
  const reserveDistribution = distribution
    .filter(d => d.assignmentType === 'RESERVE' && d.teacherId)
    .sort((a, b) => a.teacherName.localeCompare(b.teacherName, 'ar'));
  const visibleReserveDistribution = reserveDistribution.filter(item =>
    item.teacherName.includes(reserveSearch.trim())
  );
  const emptyPrimaryCount = primaryDistribution.filter(item => !item.teacherId).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><Wand2 size={24} /></div>
          <div>
            <h3 className="text-xl font-black text-slate-900">إدارة وتوزيع المراقبين</h3>
            <p className="text-sm font-bold text-slate-500 mt-1">
              نظام ذكي لضمان التوزيع العادل للمراقبين على اللجان حسب الأكثر حاجة.
            </p>
          </div>
        </div>
        {step !== 'SELECT_EXAM' && (
          <button 
            onClick={() => { setStep('SELECT_EXAM'); setSelectedPeriod(null); }}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-800 font-bold text-sm bg-slate-50 px-4 py-2 rounded-xl"
          >
            <ArrowRight size={16} /> العودة للقائمة
          </button>
        )}
      </div>

      {step === 'SELECT_EXAM' && (
        <div className="space-y-8">
          
          {/* Add Exam Form */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <h4 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
              <CalendarDays className="text-blue-600" size={24} /> إضافة اختبار للجدول
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <label className="text-xs font-bold text-slate-500 mb-2 block">تاريخ الاختبار</label>
                <input type="date" value={newExam.exam_date || ''} onChange={e => setNewExam(prev => ({ ...prev, exam_date: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold outline-none focus:border-blue-500 focus:bg-white transition-all" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-2 block">المادة</label>
                <input value={newExam.subject || ''} onChange={e => setNewExam(prev => ({ ...prev, subject: e.target.value }))} placeholder="مثال: الرياضيات" className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold outline-none focus:border-blue-500 focus:bg-white transition-all" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-2 block">الفترة</label>
                  <input type="number" min={1} value={newExam.period || 1} onChange={e => setNewExam(prev => ({ ...prev, period: Number(e.target.value) || 1 }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold outline-none focus:border-blue-500 focus:bg-white transition-all" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-2 block">البداية</label>
                  <input type="time" value={newExam.start_time || '08:00'} onChange={e => setNewExam(prev => ({ ...prev, start_time: e.target.value }))} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold outline-none focus:border-blue-500 focus:bg-white transition-all" />
                </div>
              </div>
              <div className="md:col-span-4">
                <label className="text-xs font-bold text-slate-500 mb-2 block">الصفوف المستهدفة (لهذه المادة)</label>
                <div className="flex flex-wrap gap-2">
                  {allGrades.map(g => {
                    const isSelected = newExam.grades?.includes(g);
                    return (
                      <button
                        key={g}
                        onClick={() => {
                          setNewExam(prev => ({
                            ...prev,
                            grades: isSelected 
                              ? (prev.grades || []).filter(x => x !== g)
                              : [...(prev.grades || []), g]
                          }));
                        }}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border ${isSelected ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                      >
                        {g}
                      </button>
                    )
                  })}
                  {allGrades.length === 0 && <span className="text-xs text-amber-600 font-bold">يرجى إضافة طلاب أولاً لتظهر الصفوف هنا.</span>}
                </div>
              </div>
              <button onClick={saveExamSchedule} disabled={!onUpsertExamSchedule || !newExam.subject?.trim()} className="md:col-span-4 w-full rounded-xl bg-blue-600 p-3 text-sm font-black text-white shadow-lg shadow-blue-200 disabled:opacity-40 hover:bg-blue-700 transition-all h-[46px] flex items-center justify-center gap-2">
                 {newExam.id ? 'حفظ تعديل الاختبار' : 'حفظ وإضافة للجدول'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Exam Schedule Table */}
            <div className="space-y-4">
              <h4 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <CalendarDays className="text-blue-600" size={24} /> الاختبارات المتاحة للتوزيع
              </h4>
              <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                {availablePeriods.length === 0 ? (
                  <div className="text-center text-slate-500 py-12 font-bold">لا توجد اختبارات مجدولة. الرجاء إضافتها من الأعلى.</div>
                ) : (
                  <table className="w-full text-right text-sm">
                    <thead className="bg-slate-50 border-b border-slate-100 text-slate-600 font-black">
                      <tr>
                        <th className="p-4">المادة</th>
                        <th className="p-4">التاريخ والفترة</th>
                        <th className="p-4">الحالة</th>
                        <th className="p-4 text-center">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-bold text-slate-800">
                      {availablePeriods.map(period => {
                        const hasDistribution = pastDistributions.some(p => p.date === period.date && p.period === period.period);
                        const combinedSubject = period.subjects.join('، ') || 'متعدد';
                        const periodKey = `${period.date}_${period.period}`;
                        const scheduleItems = getPeriodScheduleItems(period);
                        return (
                          <tr key={`${period.date}_${period.period}`} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4 text-slate-900">
                              <div className="font-black">{combinedSubject}</div>
                              {expandedPeriodKey === periodKey && (
                                <div className="mt-3 space-y-2">
                                  {scheduleItems.map(item => (
                                    <div key={item.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-2">
                                      <div>
                                        <p className="text-xs font-black text-slate-800">{item.subject}</p>
                                        <p className="text-[10px] font-bold text-slate-400">{(item.grades || []).join('، ') || 'كل الصفوف'}</p>
                                      </div>
                                      <div className="flex gap-1">
                                        <button onClick={() => editExamScheduleItem(item)} className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100" title="تعديل المادة">
                                          <Edit2 size={14} />
                                        </button>
                                        <button onClick={() => deleteExamScheduleItem(item)} className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100" title="حذف المادة">
                                          <Trash2 size={14} />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="p-4">
                              <div className="flex flex-col gap-1">
                                <span className="text-xs text-slate-500">{period.date}</span>
                                <span className="text-xs text-blue-600 bg-blue-50 w-fit px-2 py-0.5 rounded-md">فترة {period.period}</span>
                              </div>
                            </td>
                            <td className="p-4">
                              {hasDistribution ? (
                                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg flex items-center gap-1 w-fit">
                                  <Check size={14}/> تم التوزيع
                                </span>
                              ) : (
                                <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg w-fit block">
                                  بانتظار التوزيع
                                </span>
                              )}
                            </td>
                            <td className="p-4 flex items-center justify-center gap-2">
                              <button 
                                onClick={() => editPeriod(period)}
                                className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition-all"
                                title="تعديل الاختبار"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button 
                                onClick={() => { setSelectedPeriod(period); setStep('EXCLUDE_PROCTORS'); }}
                                className={`p-2 rounded-lg transition-all ${hasDistribution ? 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600' : 'bg-blue-100 text-blue-600 hover:bg-blue-200 shadow-sm'}`}
                                title={hasDistribution ? "إعادة التوزيع" : "بدء التوزيع"}
                              >
                                <Wand2 size={16} />
                              </button>
                              <button 
                                onClick={() => deletePeriod(period)}
                                className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-all"
                                title="حذف الاختبار"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Past Distributions */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-black text-slate-800 flex items-center gap-2">
                  <Check className="text-emerald-600" size={24} /> التوزيعات المعتمدة
                </h4>
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="text"
                    placeholder="ابحث بالتاريخ أو المادة..."
                    value={distributionFilter}
                    onChange={e => setDistributionFilter(e.target.value)}
                    className="pl-4 pr-10 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-500 w-56"
                  />
                </div>
              </div>
              
              <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                {pastDistributions.filter(p => p.date.includes(distributionFilter) || p.subject.includes(distributionFilter)).length === 0 ? (
                  <div className="text-center text-slate-500 py-12 font-bold">لا توجد توزيعات.</div>
                ) : (
                  <table className="w-full text-right text-sm">
                    <thead className="bg-slate-50 border-b border-slate-100 text-slate-600 font-black">
                      <tr>
                        <th className="p-4">التاريخ والمادة</th>
                        <th className="p-4">العدد</th>
                        <th className="p-4 text-center">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-bold text-slate-800">
                      {pastDistributions.filter(p => p.date.includes(distributionFilter) || p.subject.includes(distributionFilter)).map(dist => (
                        <tr key={dist.key} className="hover:bg-slate-50 transition-colors">
                          <td className="p-4">
                            <div className="flex flex-col gap-1">
                              <span className="text-slate-900">{dist.subject}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-slate-500">{dist.date}</span>
                                <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">فترة {dist.period}</span>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-emerald-600">{dist.count} مراقب</td>
                          <td className="p-4 flex items-center justify-center gap-2">
                            <button onClick={() => startEditDistribution(dist)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-all" title="تعديل التوزيع">
                              <Edit2 size={16} />
                            </button>
                            <button onClick={() => printOfficialReport(dist)} className="p-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-all" title="طباعة التقرير">
                              <Printer size={16} />
                            </button>
                            <button onClick={() => handleDeleteDistribution(dist.key)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-all" title="حذف التوزيع">
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {step === 'EXCLUDE_PROCTORS' && selectedPeriod && (
        <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
          <div className="mb-8">
            <h3 className="text-xl font-black text-slate-800 mb-2">استثناء معلمين من التوزيع</h3>
            <p className="text-sm font-bold text-slate-500">
              لاختبار <span className="text-blue-600">{selectedPeriod.subjects.join('، ')}</span> يوم {selectedPeriod.date} فترة {selectedPeriod.period}
            </p>
          </div>

          <div className="mb-4 relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder="ابحث عن اسم المراقب..."
              value={searchProctor}
              onChange={e => setSearchProctor(e.target.value)}
              className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>

          <div className="h-96 overflow-y-auto border border-slate-100 rounded-xl p-2 mb-6 space-y-1 bg-slate-50">
            {proctors.filter(p => p.full_name.includes(searchProctor)).map(proctor => {
              const isExcluded = excludedProctorIds.includes(proctor.id);
              return (
                <button
                  key={proctor.id}
                  type="button"
                  onClick={() => {
                    setExcludedProctorIds(prev => (
                      prev.includes(proctor.id)
                        ? prev.filter(id => id !== proctor.id)
                        : [...prev, proctor.id]
                    ));
                  }}
                  className={`w-full text-right flex items-center justify-between gap-3 p-3 rounded-xl cursor-pointer transition-all border ${isExcluded ? 'bg-red-950/10 border-red-900/20 shadow-sm' : 'bg-white/70 hover:bg-white border-transparent hover:border-slate-200'}`}
                >
                  <div>
                    <div className={`font-black ${isExcluded ? 'text-red-900' : 'text-slate-800'}`}>{proctor.full_name}</div>
                    {isExcluded && <div className="text-[10px] text-red-800/80 font-bold">مستبعد من هذا التوزيع</div>}
                  </div>
                  {isExcluded && <UserX size={18} className="text-red-900 shrink-0" />}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col lg:flex-row justify-between items-center gap-4 bg-slate-50 p-4 rounded-xl">
            <div className="font-bold text-slate-600">
              إجمالي المراقبين: {proctors.length} | المتاحين: <span className="text-emerald-600 font-black">{proctors.length - excludedProctorIds.length}</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <button 
                onClick={runManualDistribution}
                className="bg-slate-900 text-white px-8 py-3 rounded-xl font-black flex items-center justify-center gap-2 hover:bg-slate-800 shadow-lg shadow-slate-200"
              >
                <Users size={20} /> توزيع يدوي
              </button>
              <button 
                onClick={runDistributionAlgorithm}
                className="bg-blue-600 text-white px-8 py-3 rounded-xl font-black flex items-center justify-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-200"
              >
                <Wand2 size={20} /> توزيع آلي
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'PREVIEW' && selectedPeriod && (
        <div className="space-y-6">
          <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl flex gap-3 text-orange-800 font-bold items-start">
            <AlertTriangle size={24} className="shrink-0" />
            <div>
              <h4 className="font-black text-lg">{distributionMode === 'MANUAL' ? 'معاينة التوزيع اليدوي' : 'معاينة التوزيع الذكي'}</h4>
              <p className="text-sm mt-1">
                {distributionMode === 'MANUAL'
                  ? `اسحب اسم المراقب من قائمة الاحتياط إلى اللجنة المطلوبة. اللجان الفارغة المتبقية: ${emptyPrimaryCount}.`
                  : 'قم بمراجعة التوزيع ويمكنك سحب المراقب وإفلاته فوق مراقب آخر لتبديل المهام بينهم. بعد الانتهاء اضغط على زر الحفظ.'}
              </p>
            </div>
            <div className="mr-auto">
              <button 
                onClick={handleCommit}
                disabled={isCommitting}
                className="bg-emerald-600 text-white px-6 py-2 rounded-xl font-black flex items-center gap-2 hover:bg-emerald-700 disabled:opacity-50"
              >
                {isCommitting ? <RefreshCcw size={18} className="animate-spin" /> : <Check size={18} />}
                حفظ واعتماد التوزيع
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            {/* Primary Committees */}
            <div className="xl:col-span-3 space-y-4">
              <h4 className="font-black text-slate-800 text-xl flex items-center gap-2">
                <Users size={24} className="text-blue-600" /> اللجان (أساسي)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {primaryDistribution.map(item => (
                  <div 
                    key={item.id}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, item.id)}
                    className={`bg-white border-2 rounded-2xl p-4 transition-all shadow-sm ${
                      draggedItemId && draggedItemId !== item.id
                        ? 'border-blue-300 bg-blue-50 border-dashed scale-[1.01]'
                        : 'border-slate-100 hover:border-blue-200'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-3">
                      <span className="bg-blue-100 text-blue-800 font-black px-3 py-1 rounded-lg text-sm">لجنة {item.committeeNumber}</span>
                    </div>
                    {/* فقط اسم المراقب هو القابل للسحب */}
                    <div
                      draggable={!!item.teacherId}
                      onDragStart={(e) => handleDragStart(e, item.id)}
                      className={`flex items-center gap-2 font-black text-lg select-none py-2 px-3 rounded-xl transition-all ${
                        draggedItemId === item.id
                          ? 'opacity-40 bg-slate-100'
                          : item.teacherId
                          ? 'text-slate-800 cursor-grab hover:bg-slate-50 hover:shadow-sm'
                          : 'min-h-[48px] border-2 border-dashed border-slate-200 bg-slate-50 text-slate-400 justify-center'
                      }`}
                    >
                      {item.teacherId && <GripVertical size={16} className="text-slate-400 shrink-0" />}
                      <span>{item.teacherName || 'اسحب مراقباً هنا'}</span>
                    </div>
                    {item.teacherId && (
                      <div className="mt-2 flex gap-2 text-[10px] font-bold">
                        <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded">أساسي سابقاً: {item.previousPrimaryCount}</span>
                        <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded">احتياط سابقاً: {item.previousReserveCount}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Reserves */}
            <div className="xl:col-span-1 space-y-4">
              <h4 className="font-black text-slate-800 text-xl flex items-center gap-2">
                <Users size={24} className="text-emerald-600" /> الاحتياط
              </h4>
              {distributionMode === 'MANUAL' && (
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    value={reserveSearch}
                    onChange={e => setReserveSearch(e.target.value)}
                    placeholder="ابحث في الاحتياط..."
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-3 pr-9 text-sm font-bold outline-none focus:border-emerald-500"
                  />
                </div>
              )}
              <div
                onDragOver={handleDragOver}
                onDrop={handleDropToReserve}
                className={`space-y-3 rounded-2xl ${distributionMode === 'MANUAL' ? 'min-h-[260px] border-2 border-dashed border-emerald-100 bg-emerald-50/30 p-2' : ''}`}
              >
                {visibleReserveDistribution.map((item, idx) => (
                  <div 
                    key={item.id}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, item.id)}
                    className={`bg-emerald-50 border-2 rounded-xl p-3 transition-all ${
                      draggedItemId && draggedItemId !== item.id
                        ? 'border-emerald-400 bg-emerald-100 border-dashed'
                        : 'border-emerald-100 hover:border-emerald-300'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-emerald-800 font-black text-xs">احتياط {idx + 1}</span>
                    </div>
                    {/* فقط اسم المراقب هو القابل للسحب */}
                    <div
                      draggable
                      onDragStart={(e) => handleDragStart(e, item.id)}
                      className={`flex items-center gap-2 font-black text-slate-800 text-sm cursor-grab select-none py-1.5 px-2 rounded-lg transition-all ${
                        draggedItemId === item.id
                          ? 'opacity-40 bg-emerald-100'
                          : 'hover:bg-emerald-100'
                      }`}
                    >
                      <GripVertical size={14} className="text-emerald-400 shrink-0" />
                      <span>{item.teacherName}</span>
                    </div>
                    <div className="mt-1 text-[10px] text-slate-500 font-bold flex gap-2">
                      <span>أساسي: {item.previousPrimaryCount}</span>
                      <span>احتياط: {item.previousReserveCount}</span>
                    </div>
                  </div>
                ))}
                {visibleReserveDistribution.length === 0 && (
                  <div className="text-center p-6 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 font-bold text-sm">
                    {distributionMode === 'MANUAL' ? 'لا توجد أسماء مطابقة في قائمة الاحتياط.' : 'لا يوجد مراقبين احتياط (العدد يكفي اللجان فقط)'}
                  </div>
                )}
                {distributionMode === 'MANUAL' && visibleReserveDistribution.length > 0 && (
                  <div className="text-center text-[10px] font-black text-emerald-700/70 pt-1">
                    اسحب أي اسم إلى بطاقة اللجنة، أو أعده هنا من اللجنة.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartProctorDistribution;
