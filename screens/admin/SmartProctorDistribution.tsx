import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  CalendarPlus,
  Check,
  FileText,
  Loader2,
  Printer,
  RefreshCcw,
  Search,
  Shuffle,
  Sparkles,
  Trash2,
  UserMinus,
  Users,
  Wand2,
  X,
} from 'lucide-react';
import { ExamSchedule, ProctorExclusion, Student, Supervision, User } from '../../types';
import { db, getActiveTenantId, supabase } from '../../supabase';
import { APP_CONFIG } from '../../constants';

export interface SmartExamSlot {
  id: string;
  date: string;
  subject: string;
  period: number;
}

export interface SmartDistributionItem {
  id: string;
  slotId: string;
  date: string;
  subject: string;
  period: number;
  committeeNumber: string;
  teacherId: string;
  teacherName: string;
  assignedCount: number;
  reserveCount: number;
  previousCount: number;
  forcedRepeat: boolean;
  assignmentType?: 'PRIMARY' | 'RESERVE';
  reserveOrder?: number;
  reserveReason?: string;
}

interface Props {
  users: User[];
  students: Student[];
  supervisions: Supervision[];
  activeDate?: string;
  examSchedule?: ExamSchedule[];
  onUpsertExamSchedule?: (item: Partial<ExamSchedule>) => Promise<void>;
  onDeleteExamSchedule?: (id: string) => Promise<void>;
  onCommit: (items: SmartDistributionItem[], replaceExisting: boolean) => Promise<void>;
  onDeleteSupervisions?: (ids: string[]) => Promise<void>;
  onUpdateSupervision?: (id: string, teacherId: string) => Promise<void>;
  systemConfig?: { academic_year?: string; [key: string]: any };
}

const isReserveSupervision = (item: Supervision) => String(item.subject || '').includes('[RESERVE]');
const examScopeKey = (date: string, period: number | string = 1, subject = 'اختبار') =>
  `${date || today()}__${Number(period) || 1}__${String(subject || 'اختبار').trim() || 'اختبار'}`;
const cleanSubject = (subject?: string) => String(subject || 'اختبار').replace('[RESERVE]', '').trim() || 'اختبار';

const today = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (type: string) => parts.find(part => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
};

const dateLabel = (date: string) =>
  new Date(`${date || today()}T12:00:00`).toLocaleDateString('ar-SA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

const isStarted = (value: string) => {
  const d = new Date(value);
  return value && !Number.isNaN(d.getTime()) && !(d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0);
};

const OfficialDistributionHeader: React.FC<{ date: string, systemConfig?: { academic_year?: string } }> = ({ date, systemConfig }) => (
  <div className="distribution-official-header">
    <div className="official-side official-right">
      <div>المملكة العربية السعودية</div>
      <div>وزارة التعليم</div>
      <div>إدارة التعليم بمحافظة جدة</div>
      <div>مدرسة عماد الدين زنكي المتوسطة</div>
    </div>
    <div className="official-logo">
      <img src={APP_CONFIG.LOGO_URL} alt="وزارة التعليم" />
      <div>نظام كنترول الاختبارات</div>
    </div>
    <div className="official-side official-left">
      <div>التاريخ: {date}</div>
      <div>اليوم: {new Date(`${date}T12:00:00`).toLocaleDateString('ar-SA', { weekday: 'long' })}</div>
      <div>العام الدراسي: {systemConfig?.academic_year || '1446 / 1447'}</div>
    </div>
  </div>
);

const SmartProctorDistribution: React.FC<Props> = ({
  users,
  students,
  supervisions,
  activeDate,
  examSchedule = [],
  onUpsertExamSchedule,
  onDeleteExamSchedule,
  onCommit,
  onDeleteSupervisions,
  onUpdateSupervision,
  systemConfig,
}) => {
  const defaultDate = activeDate || today();
  const committees = useMemo(
    () => Array.from(new Set(students.map(s => s.committee_number).filter(Boolean))).sort((a, b) => Number(a) - Number(b)),
    [students],
  );
  const proctors = useMemo(() => users.filter(u => u.role === 'PROCTOR'), [users]);

  const [slots, setSlots] = useState<SmartExamSlot[]>([
    { id: crypto.randomUUID(), date: defaultDate, subject: 'اختبار', period: 1 },
  ]);
  const [selectedExclusionDate, setSelectedExclusionDate] = useState(defaultDate);
  const [selectedExclusionScope, setSelectedExclusionScope] = useState(examScopeKey(defaultDate, 1, 'اختبار'));
  const [exclusionSearch, setExclusionSearch] = useState('');
  // الاستبعاد من قاعدة البيانات بدلاً من localStorage
  const [excludedByDate, setExcludedByDate] = useState<Record<string, string[]>>({});
  const [isLoadingExclusions, setIsLoadingExclusions] = useState(false);
  const [exclusionSaving, setExclusionSaving] = useState(false);
  const [examSaving, setExamSaving] = useState(false);
  const [examSaveMsg, setExamSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [preview, setPreview] = useState<SmartDistributionItem[]>([]);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [distributionDateFilter, setDistributionDateFilter] = useState(defaultDate);
  const [distributionSubjectFilter, setDistributionSubjectFilter] = useState('');
  const [previewDateFilter, setPreviewDateFilter] = useState('');
  const [previewSubjectFilter, setPreviewSubjectFilter] = useState('');
  const [previewPeriodFilter, setPreviewPeriodFilter] = useState('');
  const [previewCommitteeFilter, setPreviewCommitteeFilter] = useState('');
  const [previewTeacherFilter, setPreviewTeacherFilter] = useState('');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);
  const [isPrintingDistribution, setIsPrintingDistribution] = useState(false);
  const [deletingGroupKey, setDeletingGroupKey] = useState<string | null>(null);
  const [newExam, setNewExam] = useState<Partial<ExamSchedule>>({
    exam_date: defaultDate,
    subject: '',
    period: 1,
    start_time: '08:00',
    end_time: '',
    grades: [],
    status: 'READY',
  });

  // جلب المستبعدين من قاعدة البيانات عند التحميل
  const loadExclusionsFromDB = useCallback(async () => {
    setIsLoadingExclusions(true);
    try {
      const exclusions = await db.proctorExclusions.getAll();
      const grouped: Record<string, string[]> = {};
      exclusions.forEach((exc: ProctorExclusion) => {
        const key = examScopeKey(exc.exam_date, exc.period, exc.subject);
        if (!grouped[key]) grouped[key] = [];
        if (!grouped[key].includes(exc.teacher_id)) grouped[key].push(exc.teacher_id);
      });
      setExcludedByDate(grouped);
    } catch (err) {
      console.warn('تعذر تحميل المستبعدين من قاعدة البيانات، تحميل من localStorage كبديل', err);
      try {
        const local = JSON.parse(localStorage.getItem('smart_proctor_exclusions_by_date') || '{}');
        setExcludedByDate(local);
      } catch {}
    } finally {
      setIsLoadingExclusions(false);
    }
  }, []);

  useEffect(() => {
    loadExclusionsFromDB();
  }, [loadExclusionsFromDB]);


  const primarySupervisions = useMemo(() => supervisions.filter(s => !isReserveSupervision(s)), [supervisions]);
  const reserveSupervisions = useMemo(() => supervisions.filter(isReserveSupervision), [supervisions]);

  const assignedCounts = useMemo(() => {
    return primarySupervisions.reduce<Record<string, number>>((acc, item) => {
      acc[item.teacher_id] = (acc[item.teacher_id] || 0) + 1;
      return acc;
    }, {});
  }, [primarySupervisions]);

  const reserveCounts = useMemo(() => {
    return reserveSupervisions.reduce<Record<string, number>>((acc, item) => {
      acc[item.teacher_id] = (acc[item.teacher_id] || 0) + 1;
      return acc;
    }, {});
  }, [reserveSupervisions]);

  const previousCounts = useMemo(() => {
    return primarySupervisions.reduce<Record<string, number>>((acc, item) => {
      if (isStarted(item.date)) acc[item.teacher_id] = (acc[item.teacher_id] || 0) + 1;
      return acc;
    }, {});
  }, [primarySupervisions]);

  const slotDates = useMemo(
    () => Array.from(new Set(slots.map(slot => slot.date || defaultDate))).sort(),
    [slots, defaultDate],
  );

  const slotScopes = useMemo(
    () => slots
      .map(slot => ({
        key: examScopeKey(slot.date || defaultDate, slot.period || 1, slot.subject || 'اختبار'),
        label: `${slot.date || defaultDate} | ${slot.subject || 'اختبار'} | فترة ${slot.period || 1}`,
        slot,
      }))
      .sort((a, b) => {
        const byDate = a.slot.date.localeCompare(b.slot.date);
        if (byDate !== 0) return byDate;
        const bySubject = a.slot.subject.localeCompare(b.slot.subject, 'ar');
        if (bySubject !== 0) return bySubject;
        return Number(a.slot.period) - Number(b.slot.period);
      }),
    [slots, defaultDate],
  );

  const selectedScopeSlot = slotScopes.find(scope => scope.key === selectedExclusionScope)?.slot || slots[0];
  const excludedIdsForSelectedScope = excludedByDate[selectedExclusionScope] || [];
  const sortedProctors = useMemo(() => [...proctors].sort((a, b) => a.full_name.localeCompare(b.full_name, 'ar')), [proctors]);
  const filteredProctors = useMemo(() => {
    const q = exclusionSearch.trim().toLowerCase();
    if (!q) return sortedProctors;
    return sortedProctors.filter(p => p.full_name.toLowerCase().includes(q) || String(p.national_id || '').includes(q));
  }, [sortedProctors, exclusionSearch]);

  const getEligibleProctors = (slotOrDate: SmartExamSlot | string) => {
    const slot = typeof slotOrDate === 'string'
      ? { date: slotOrDate, period: 1, subject: 'اختبار' }
      : slotOrDate;
    const scoped = excludedByDate[examScopeKey(slot.date, slot.period, slot.subject)] || [];
    const legacyDateWide = excludedByDate[slot.date] || [];
    const excluded = new Set([...scoped, ...legacyDateWide]);
    return proctors.filter(p => !excluded.has(p.id));
  };

  const eligibleProctors = selectedScopeSlot ? getEligibleProctors(selectedScopeSlot) : proctors;

  const subjectOptions = useMemo(
    () => (Array.from(new Set(primarySupervisions.map(s => cleanSubject(s.subject)).filter(Boolean))) as string[]).sort((a, b) => a.localeCompare(b, 'ar')),
    [primarySupervisions],
  );

  const committedRows = useMemo(() => {
    return primarySupervisions
      .filter(s => !distributionDateFilter || s.date?.slice(0, 10) === distributionDateFilter)
      .filter(s => !distributionSubjectFilter || cleanSubject(s.subject) === distributionSubjectFilter)
      .map(s => {
        const teacher = users.find(u => u.id === s.teacher_id);
        const assignedCount = primarySupervisions.filter(x => x.teacher_id === s.teacher_id).length;
        const previousCount = primarySupervisions.filter(x => x.teacher_id === s.teacher_id && isStarted(x.date)).length;
        return {
          id: s.id,
          date: s.date?.slice(0, 10) || '',
          subject: cleanSubject(s.subject),
          period: s.period || 1,
          committeeNumber: s.committee_number,
          teacherId: s.teacher_id,
          teacherName: teacher?.full_name || 'مراقب غير معروف',
          assignedCount,
          previousCount,
        };
      })
      .sort((a, b) => {
        const byDate = a.date.localeCompare(b.date);
        if (byDate !== 0) return byDate;
        const bySubject = a.subject.localeCompare(b.subject, 'ar');
        if (bySubject !== 0) return bySubject;
        const byPeriod = a.period - b.period;
        if (byPeriod !== 0) return byPeriod;
        return Number(a.committeeNumber) - Number(b.committeeNumber);
      });
  }, [primarySupervisions, users, distributionDateFilter, distributionSubjectFilter]);

  const reserveCommittedRows = useMemo(() => {
    return reserveSupervisions
      .filter(s => !distributionDateFilter || s.date?.slice(0, 10) === distributionDateFilter)
      .filter(s => !distributionSubjectFilter || cleanSubject(s.subject) === distributionSubjectFilter)
      .map(s => ({
        id: s.id,
        date: s.date?.slice(0, 10) || '',
        subject: cleanSubject(s.subject),
        period: s.period || 1,
        committeeNumber: s.committee_number,
        teacherId: s.teacher_id,
        teacherName: users.find(u => u.id === s.teacher_id)?.full_name || 'مراقب غير معروف',
      }))
      .sort((a, b) => {
        const byDate = a.date.localeCompare(b.date);
        if (byDate !== 0) return byDate;
        const byPeriod = a.period - b.period;
        if (byPeriod !== 0) return byPeriod;
        return Number(a.committeeNumber) - Number(b.committeeNumber);
      });
  }, [reserveSupervisions, users, distributionDateFilter, distributionSubjectFilter]);

  const approvedRows = useMemo(
    () => [
      ...committedRows.map(row => ({ ...row, kind: 'PRIMARY' as const, kindLabel: 'أساسي' })),
      ...reserveCommittedRows.map(row => ({ ...row, kind: 'RESERVE' as const, kindLabel: 'احتياط', assignedCount: 0, previousCount: 0 })),
    ],
    [committedRows, reserveCommittedRows],
  );

  const approvedGroups = useMemo(() => {
    const groups = new Map<string, { key: string; date: string; subject: string; period: number; rows: typeof approvedRows }>();
    approvedRows.forEach(row => {
      const key = examScopeKey(row.date, row.period, row.subject);
      if (!groups.has(key)) groups.set(key, { key, date: row.date, subject: row.subject, period: row.period, rows: [] as typeof approvedRows });
      groups.get(key)!.rows.push(row);
    });
    return Array.from(groups.values())
      .map(group => ({
        ...group,
        rows: [...group.rows].sort((a, b) => {
          if (a.kind !== b.kind) return a.kind === 'PRIMARY' ? -1 : 1;
          return Number(a.committeeNumber) - Number(b.committeeNumber);
        }),
      }))
      .sort((a, b) => {
        const byDate = a.date.localeCompare(b.date);
        if (byDate !== 0) return byDate;
        const bySubject = a.subject.localeCompare(b.subject, 'ar');
        if (bySubject !== 0) return bySubject;
        return Number(a.period) - Number(b.period);
      });
  }, [approvedRows]);

  const approvedLoadRows = useMemo(() => {
    return proctors
      .map(p => {
        const primary = primarySupervisions.filter(s => s.teacher_id === p.id).length;
        const reserve = reserveSupervisions.filter(s => s.teacher_id === p.id).length;
        return { id: p.id, name: p.full_name, primary, reserve, total: primary + reserve };
      })
      .sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        if (b.primary !== a.primary) return b.primary - a.primary;
        return a.name.localeCompare(b.name, 'ar');
      });
  }, [proctors, primarySupervisions, reserveSupervisions]);

  const approvedLoadById = useMemo(
    () => Object.fromEntries(approvedLoadRows.map(row => [row.id, row])),
    [approvedLoadRows],
  );

  const sortedPreview = useMemo(() => {
    const q = previewTeacherFilter.trim().toLowerCase();
    return preview
      .filter(item => !previewDateFilter || item.date === previewDateFilter)
      .filter(item => !previewSubjectFilter || item.subject === previewSubjectFilter)
      .filter(item => !previewPeriodFilter || String(item.period) === previewPeriodFilter)
      .filter(item => !previewCommitteeFilter || String(item.committeeNumber).includes(previewCommitteeFilter.trim()))
      .filter(item => !q || item.teacherName.toLowerCase().includes(q))
      .sort((a, b) => {
        const byDate = a.date.localeCompare(b.date);
        if (byDate !== 0) return byDate;
        const bySubject = a.subject.localeCompare(b.subject, 'ar');
        if (bySubject !== 0) return bySubject;
        const byPeriod = a.period - b.period;
        if (byPeriod !== 0) return byPeriod;
        if (a.assignmentType !== b.assignmentType) return a.assignmentType === 'PRIMARY' ? -1 : 1;
        return Number(a.committeeNumber) - Number(b.committeeNumber);
      });
  }, [preview, previewDateFilter, previewSubjectFilter, previewPeriodFilter, previewCommitteeFilter, previewTeacherFilter]);

  const previewDates = useMemo(() => Array.from(new Set(preview.map(item => item.date))).sort(), [preview]);
  const previewSubjects = useMemo(() => (Array.from(new Set(preview.map(item => item.subject))) as string[]).sort((a, b) => a.localeCompare(b, 'ar')), [preview]);
  const previewPeriods = useMemo(() => Array.from(new Set(preview.map(item => String(item.period)))).sort((a, b) => Number(a) - Number(b)), [preview]);

  const fairnessRows = useMemo(() => {
    const primaryAdditions = preview.filter(item => item.assignmentType !== 'RESERVE').reduce<Record<string, number>>((acc, item) => {
      acc[item.teacherId] = (acc[item.teacherId] || 0) + 1;
      return acc;
    }, {});
    const reserveAdditions = preview.filter(item => item.assignmentType === 'RESERVE').reduce<Record<string, number>>((acc, item) => {
      acc[item.teacherId] = (acc[item.teacherId] || 0) + 1;
      return acc;
    }, {});

    return proctors
      .map(p => {
        const before = assignedCounts[p.id] || 0;
        const added = primaryAdditions[p.id] || 0;
        const reserveBefore = reserveCounts[p.id] || 0;
        const reserveAdded = reserveAdditions[p.id] || 0;
        return {
          id: p.id,
          name: p.full_name,
          before,
          added,
          after: before + added,
          reserveBefore,
          reserveAdded,
          reserveAfter: reserveBefore + reserveAdded,
        };
      })
      .sort((a, b) => {
        if (b.added !== a.added) return b.added - a.added;
        if (b.reserveAdded !== a.reserveAdded) return b.reserveAdded - a.reserveAdded;
        if (b.after !== a.after) return b.after - a.after;
        return a.name.localeCompare(b.name, 'ar');
      });
  }, [preview, proctors, assignedCounts, reserveCounts]);

  const fairnessSummary = useMemo(() => {
    if (!fairnessRows.length) return { min: 0, max: 0, diff: 0, status: 'لا توجد بيانات' };
    const activeRows = fairnessRows.filter(row => row.added > 0 || row.before > 0);
    const source = activeRows.length ? activeRows : fairnessRows;
    const values = source.map(row => row.after);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const diff = max - min;
    return {
      min,
      max,
      diff,
      status: diff <= 1 ? 'متوازن' : diff === 2 ? 'يحتاج مراجعة بسيطة' : 'غير متوازن',
    };
  }, [fairnessRows]);

  const fairnessAfterById = useMemo(
    () => Object.fromEntries(fairnessRows.map(row => [row.id, row.after])),
    [fairnessRows],
  );

  const controlHeadName = users.find(u => u.role === 'CONTROL_MANAGER')?.full_name || 'رئيس الكنترول';
  const schoolManagerName = users.find(u => u.role === 'ADMIN')?.full_name || 'مدير المدرسة';

  const printPages = useMemo(() => {
    const pageSize = 28;
    const pages = [];
    for (let i = 0; i < committedRows.length; i += pageSize) pages.push(committedRows.slice(i, i + pageSize));
    return pages.length ? pages : [[]];
  }, [committedRows]);

  const toggleExcluded = async (scopeKey: string, userId: string) => {
    const scopeSlot = slotScopes.find(s => s.key === scopeKey);
    const examDate = scopeSlot?.slot.date || selectedExclusionDate || defaultDate;
    const period = scopeSlot?.slot.period || 1;
    const subject = scopeSlot?.slot.subject || 'اختبار';

    const isCurrentlyExcluded = (excludedByDate[scopeKey] || []).includes(userId);
    setExclusionSaving(true);
    try {
      if (isCurrentlyExcluded) {
        // حذف الاستبعاد من DB
        await db.proctorExclusions.deleteByScope(userId, examDate, Number(period), subject);
      } else {
        // إضافة استبعاد جديد في DB (upsert يتجنب التكرار بفضل unique constraint)
        await db.proctorExclusions.upsert({
          id: crypto.randomUUID(),
          teacher_id: userId,
          exam_date: examDate,
          period: Number(period),
          subject: subject,
          reason: '',
        });
      }
      // تحديث الحالة محلياً
      setExcludedByDate(prev => {
        const current = prev[scopeKey] || [];
        const nextIds = isCurrentlyExcluded
          ? current.filter(id => id !== userId)
          : [...current, userId];
        return { ...prev, [scopeKey]: nextIds };
      });
    } catch (err: any) {
      console.error('تعذر تحديث الاستبعاد', err);
    } finally {
      setExclusionSaving(false);
    }
  };

  const addSlot = () => {
    setSlots(prev => [...prev, { id: crypto.randomUUID(), date: defaultDate, subject: 'اختبار', period: 1 }]);
  };

  const addSlotFromExam = (exam: ExamSchedule) => {
    setSlots(prev => {
      const exists = prev.some(slot => slot.date === exam.exam_date && Number(slot.period) === Number(exam.period) && slot.subject === exam.subject);
      if (exists) return prev;
      return [...prev, { id: crypto.randomUUID(), date: exam.exam_date, subject: exam.subject || 'اختبار', period: Number(exam.period) || 1 }];
    });
    setSelectedExclusionDate(exam.exam_date);
    setSelectedExclusionScope(examScopeKey(exam.exam_date, exam.period || 1, exam.subject || 'اختبار'));
  };

  const saveExamSchedule = async () => {
    if (!onUpsertExamSchedule || !newExam.exam_date || !newExam.subject?.trim()) {
      setExamSaveMsg({ type: 'error', text: 'يرجى إدخال تاريخ ومادة الاختبار أولاً' });
      return;
    }
    const payload: Partial<ExamSchedule> = {
      ...newExam,
      id: newExam.id || crypto.randomUUID(),
      subject: newExam.subject.trim(),
      period: Number(newExam.period) || 1,
      start_time: newExam.start_time || '08:00',
      status: newExam.status || 'READY',
    };
    setExamSaving(true);
    setExamSaveMsg(null);
    try {
      await onUpsertExamSchedule(payload);
      setNewExam({ exam_date: payload.exam_date, subject: '', period: (Number(payload.period) + 1) > 3 ? 1 : (Number(payload.period) + 1), start_time: payload.start_time || '08:00', end_time: '', grades: [], status: 'READY' });
      setExamSaveMsg({ type: 'success', text: `تم حفظ اختبار "${payload.subject}" بنجاح لتاريخ ${payload.exam_date}` });
      setTimeout(() => setExamSaveMsg(null), 4000);
    } catch (err: any) {
      setExamSaveMsg({ type: 'error', text: err?.message || 'تعذر حفظ الاختبار، يرجى التحقق من خاصية unique constraint في قاعدة البيانات' });
    } finally {
      setExamSaving(false);
    }
  };

  const updateSlot = (id: string, patch: Partial<SmartExamSlot>) => {
    if (patch.date) setSelectedExclusionDate(patch.date);
    const current = slots.find(slot => slot.id === id);
    if (current) {
      const next = { ...current, ...patch };
      setSelectedExclusionScope(examScopeKey(next.date, next.period, next.subject));
    }
    setSlots(prev => prev.map(slot => slot.id === id ? { ...slot, ...patch } : slot));
  };

  const removeSlot = (id: string) => {
    setSlots(prev => prev.filter(slot => slot.id !== id));
    setPreview(prev => prev.filter(item => item.slotId !== id));
  };

  const generateDistribution = () => {
    if (!committees.length || !slots.length) {
      setPreview([]);
      return;
    }

    const runningPrimaryCounts = { ...assignedCounts };
    const runningReserveCounts = { ...reserveCounts };
    const draft: SmartDistributionItem[] = [];
    const orderedSlots = [...slots].sort((a, b) => {
      const byDate = a.date.localeCompare(b.date);
      if (byDate !== 0) return byDate;
      const bySubject = a.subject.localeCompare(b.subject, 'ar');
      if (bySubject !== 0) return bySubject;
      return Number(a.period) - Number(b.period);
    });

    orderedSlots.forEach(slot => {
      const eligible = getEligibleProctors(slot);
      if (!eligible.length) return;

      const usedThisSlot = new Set(
        primarySupervisions
          .filter(s => s.date?.slice(0, 10) === slot.date && Number(s.period || 1) === Number(slot.period || 1))
          .map(s => s.teacher_id),
      );
      const randomizedCommittees = [...committees].sort(() => Math.random() - 0.5);
      const primaryByCommittee = new Map<string, { teacherId: string; teacherName: string; loadAfter: number; forcedRepeat: boolean; studentCount: number }>();

      randomizedCommittees.forEach(committeeNumber => {
        const selected = eligible
          .map(p => ({
            user: p,
            count: runningPrimaryCounts[p.id] || 0,
            usedThisSlot: usedThisSlot.has(p.id),
            sameCommittee: primarySupervisions.some(s => s.teacher_id === p.id && s.committee_number === committeeNumber),
            random: Math.random(),
          }))
          .sort((a, b) => {
            if (a.count !== b.count) return a.count - b.count;
            if (a.usedThisSlot !== b.usedThisSlot) return a.usedThisSlot ? 1 : -1;
            if (a.sameCommittee !== b.sameCommittee) return a.sameCommittee ? 1 : -1;
            return a.random - b.random;
          })[0];

        if (!selected) return;
        draft.push({
          id: crypto.randomUUID(),
          slotId: slot.id,
          date: slot.date,
          subject: slot.subject || 'اختبار',
          period: Number(slot.period) || 1,
          committeeNumber,
          teacherId: selected.user.id,
          teacherName: selected.user.full_name,
          assignedCount: assignedCounts[selected.user.id] || 0,
          reserveCount: reserveCounts[selected.user.id] || 0,
          previousCount: previousCounts[selected.user.id] || 0,
          forcedRepeat: selected.usedThisSlot || selected.sameCommittee,
          assignmentType: 'PRIMARY',
        });
        usedThisSlot.add(selected.user.id);
        runningPrimaryCounts[selected.user.id] = (runningPrimaryCounts[selected.user.id] || 0) + 1;
        primaryByCommittee.set(committeeNumber, {
          teacherId: selected.user.id,
          teacherName: selected.user.full_name,
          loadAfter: runningPrimaryCounts[selected.user.id] || 0,
          forcedRepeat: selected.usedThisSlot || selected.sameCommittee,
          studentCount: students.filter(s => s.committee_number === committeeNumber).length,
        });
      });

      const rankedReserveCommittees = committees
        .map(committeeNumber => {
          const primary = primaryByCommittee.get(committeeNumber);
          const studentCount = primary?.studentCount ?? students.filter(s => s.committee_number === committeeNumber).length;
          const primaryLoad = primary?.loadAfter ?? 0;
          const repeatRisk = primary?.forcedRepeat ? 1 : 0;
          const score = studentCount + (primaryLoad * 7) + (repeatRisk * 18) + Math.random();
          const reasonParts = [
            `حجم اللجنة ${studentCount} طالب`,
            primary ? `مراقبها الأساسي لديه ${primaryLoad} إسناد` : 'لا يوجد مراقب أساسي واضح',
            repeatRisk ? 'يوجد تكرار يستحق دعم احتياطي' : 'دعم احتياطي متوازن',
          ];
          return { committeeNumber, score, reason: reasonParts.join(' - ') };
        })
        .sort((a, b) => b.score - a.score);

      const remaining = eligible
        .filter(p => !usedThisSlot.has(p.id))
        .map(p => ({
          user: p,
          reserveCount: runningReserveCounts[p.id] || 0,
          primaryCount: runningPrimaryCounts[p.id] || 0,
          random: Math.random(),
        }))
        .sort((a, b) => {
          if (a.reserveCount !== b.reserveCount) return a.reserveCount - b.reserveCount;
          if (a.primaryCount !== b.primaryCount) return a.primaryCount - b.primaryCount;
          return a.random - b.random;
        });

      remaining.forEach((candidate, index) => {
        const reserveTarget = rankedReserveCommittees[index % rankedReserveCommittees.length];
        const committeeNumber = reserveTarget?.committeeNumber || committees[index % committees.length];
        draft.push({
          id: crypto.randomUUID(),
          slotId: slot.id,
          date: slot.date,
          subject: slot.subject || 'اختبار',
          period: Number(slot.period) || 1,
          committeeNumber,
          teacherId: candidate.user.id,
          teacherName: candidate.user.full_name,
          assignedCount: assignedCounts[candidate.user.id] || 0,
          reserveCount: reserveCounts[candidate.user.id] || 0,
          previousCount: previousCounts[candidate.user.id] || 0,
          forcedRepeat: false,
          assignmentType: 'RESERVE',
          reserveOrder: index + 1,
          reserveReason: reserveTarget?.reason || 'احتياط موزع تلقائياً بعد التوزيع الأساسي',
        });
        runningReserveCounts[candidate.user.id] = (runningReserveCounts[candidate.user.id] || 0) + 1;
      });
    });

    setPreview(draft);
  };

  const swapItems = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    setPreview(prev => {
      const source = prev.find(item => item.id === sourceId);
      const target = prev.find(item => item.id === targetId);
      if (!source || !target || source.assignmentType !== target.assignmentType) return prev;
      return prev.map(item => {
        if (item.id === sourceId) {
          return { ...item, teacherId: target.teacherId, teacherName: target.teacherName, assignedCount: target.assignedCount, reserveCount: target.reserveCount, previousCount: target.previousCount };
        }
        if (item.id === targetId) {
          return { ...item, teacherId: source.teacherId, teacherName: source.teacherName, assignedCount: source.assignedCount, reserveCount: source.reserveCount, previousCount: source.previousCount };
        }
        return item;
      });
    });
  };

  const replaceOne = (item: SmartDistributionItem) => {
    const usedInSlot = new Set(
      preview
        .filter(p => p.slotId === item.slotId && p.id !== item.id)
        .map(p => p.teacherId),
    );
    const candidate = getEligibleProctors({ id: item.slotId, date: item.date, subject: item.subject, period: item.period })
      .filter(p => p.id !== item.teacherId)
      .map(p => ({
        user: p,
        primary: assignedCounts[p.id] || 0,
        reserve: reserveCounts[p.id] || 0,
        previous: previousCounts[p.id] || 0,
        used: usedInSlot.has(p.id),
        random: Math.random(),
      }))
      .sort((a, b) => {
        if (a.used !== b.used) return a.used ? 1 : -1;
        if (item.assignmentType === 'RESERVE' && a.reserve !== b.reserve) return a.reserve - b.reserve;
        if (a.primary !== b.primary) return a.primary - b.primary;
        return a.random - b.random;
      })[0];

    if (!candidate) return;
    setPreview(prev => prev.map(p => p.id === item.id ? {
      ...p,
      teacherId: candidate.user.id,
      teacherName: candidate.user.full_name,
      assignedCount: candidate.primary,
      reserveCount: candidate.reserve,
      previousCount: candidate.previous,
      forcedRepeat: candidate.used,
    } : p));
  };

  const commitPreview = async () => {
    if (!preview.length) return;
    setIsCommitting(true);
    try {
      await onCommit(preview, replaceExisting);
    } finally {
      setIsCommitting(false);
    }
  };

  const deleteSupervisionRows = async (ids: string[]) => {
    if (!ids.length) return;
    if (onDeleteSupervisions) {
      await onDeleteSupervisions(ids);
      return;
    }
    const tenantId = getActiveTenantId();
    let query = supabase.from('supervision').delete().in('id', ids);
    if (tenantId) query = query.eq('tenant_id', tenantId);
    const { error } = await query;
    if (error) alert(error.message);
  };

  // حذف كل توزيع مجموعة كاملة (date + period + subject) من قاعدة البيانات
  const deleteGroupFromDB = async (group: { date: string; period: number; subject: string }) => {
    const groupKey = examScopeKey(group.date, group.period, group.subject);
    if (deletingGroupKey === groupKey) return; // منع التكرار
    const confirmed = window.confirm(
      `هل تريد حذف كل التوزيع لـ:\nالتاريخ: ${group.date}\nالمادة: ${group.subject}\nالفترة: ${group.period}\n\nسيتم حذف جميع الإسنادات لهذه المجموعة. هذا الإجراء لا يمكن التراجع عنه.`
    );
    if (!confirmed) return;

    setDeletingGroupKey(groupKey);
    try {
      const tenantId = getActiveTenantId();
      const dayStart = `${group.date}T00:00:00`;
      const dayEnd = `${group.date}T23:59:59.999Z`;
      // حذف الإسنادات الأساسية والاحتياط لهذه الفترة
      let query = supabase.from('supervision')
        .delete()
        .gte('date', dayStart)
        .lt('date', dayEnd)
        .eq('period', group.period);
      if (tenantId) query = query.eq('tenant_id', tenantId);
      const { error } = await query;
      if (error) throw new Error(error.message);
      window.alert(`تم حذف توزيع ${group.subject} - الفترة ${group.period} بتاريخ ${group.date} بنجاح.`);
    } catch (err: any) {
      window.alert('خطأ في الحذف: ' + (err?.message || 'تعذر الحذف'));
    } finally {
      setDeletingGroupKey(null);
    }
  };


  const updateApprovedTeacher = async (row: { id: string; committeeNumber: string; teacherId: string; kindLabel: string }, teacherId: string) => {
    if (!teacherId || teacherId === row.teacherId) return;
    const teacher = users.find(u => u.id === teacherId);
    if (!teacher) return;
    const currentLoad = approvedLoadById[teacherId] || { primary: 0, reserve: 0, total: 0 };
    const message = [
      `سيتم نقل ${row.kindLabel} لجنة ${row.committeeNumber} إلى: ${teacher.full_name}`,
      `إسناداته الحالية: ${currentLoad.primary} أساسي، ${currentLoad.reserve} احتياط، الإجمالي ${currentLoad.total}.`,
      'هل تريد اعتماد النقل؟',
    ].join('\n');
    if (!confirm(message)) return;

    if (onUpdateSupervision) {
      await onUpdateSupervision(row.id, teacherId);
      return;
    }

    const tenantId = getActiveTenantId();
    let query = supabase.from('supervision').update({ teacher_id: teacherId }).eq('id', row.id);
    if (tenantId) query = query.eq('tenant_id', tenantId);
    const { error } = await query;
    if (error) alert(error.message);
  };

  const printOfficialDistribution = () => {
    if (!committedRows.length) return;
    setIsPrintingDistribution(true);
    requestAnimationFrame(() => setTimeout(() => window.print(), 500));
  };

  useEffect(() => {
    const cleanup = () => setIsPrintingDistribution(false);
    window.addEventListener('afterprint', cleanup);
    return () => window.removeEventListener('afterprint', cleanup);
  }, []);

  useEffect(() => {
    document.body.classList.toggle('printing-proctor-distribution', isPrintingDistribution);
    return () => document.body.classList.remove('printing-proctor-distribution');
  }, [isPrintingDistribution]);

  useEffect(() => {
    if (slotScopes.length && !slotScopes.some(scope => scope.key === selectedExclusionScope)) {
      setSelectedExclusionScope(slotScopes[0].key);
      setSelectedExclusionDate(slotScopes[0].slot.date || defaultDate);
    }
  }, [slotScopes, selectedExclusionScope, defaultDate]);

  const primaryPreviewCount = preview.filter(item => item.assignmentType !== 'RESERVE').length;
  const reservePreviewCount = preview.filter(item => item.assignmentType === 'RESERVE').length;
  const forcedRepeatCount = preview.filter(item => item.forcedRepeat).length;

  return (
    <div className="space-y-8">
      <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-100">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 mb-8">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl"><Wand2 size={28} /></div>
            <div>
              <h3 className="text-2xl font-black text-slate-900">التوزيع الذكي للمراقبين</h3>
              <p className="text-xs font-bold text-slate-400 mt-1">
                يوزع المراقبين على اللجان بعدل، ثم يوزع كل المراقبين المتبقين كاحتياط على اللجان مع استثناء مستبعدي ذلك اليوم.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={addSlot} className="px-5 py-3 rounded-2xl bg-slate-100 text-slate-700 font-black text-xs flex items-center gap-2 hover:bg-slate-200">
              <CalendarPlus size={18} /> إضافة يوم
            </button>
            <button onClick={generateDistribution} className="px-6 py-3 rounded-2xl bg-blue-600 text-white font-black text-xs flex items-center gap-2 shadow-lg hover:bg-blue-700">
              <Sparkles size={18} /> توليد
            </button>
            <button onClick={commitPreview} disabled={!preview.length || isCommitting} className="px-6 py-3 rounded-2xl bg-emerald-600 text-white font-black text-xs flex items-center gap-2 shadow-lg hover:bg-emerald-700 disabled:opacity-40">
              {isCommitting ? <RefreshCcw size={18} className="animate-spin" /> : <Check size={18} />} ربط باللجان
            </button>
            <button onClick={printOfficialDistribution} disabled={!committedRows.length} className="px-6 py-3 rounded-2xl bg-slate-950 text-white font-black text-xs flex items-center gap-2 shadow-lg disabled:opacity-40">
              <Printer size={18} /> طباعة التقرير
            </button>
          </div>
        </div>

        <div className="mb-6 rounded-[2rem] border border-blue-100 bg-blue-50/60 p-5 no-print">
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h4 className="text-lg font-black text-slate-900">جدول الاختبارات</h4>
              <p className="text-xs font-bold text-slate-500">اختر الاختبار من الجدول ليبنى عليه التوزيع والاستبعاد بدل الإدخال اليدوي.</p>
            </div>
            <span className="rounded-full bg-white px-4 py-2 text-[10px] font-black text-blue-600">{examSchedule.length} اختبار</span>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[160px_1fr_100px_120px_120px_120px]">
            <input type="date" value={newExam.exam_date || defaultDate} onChange={e => setNewExam(prev => ({ ...prev, exam_date: e.target.value }))} className="rounded-xl border border-blue-100 bg-white p-3 text-sm font-black outline-none" />
            <input value={newExam.subject || ''} onChange={e => setNewExam(prev => ({ ...prev, subject: e.target.value }))} placeholder="اسم المادة" className="rounded-xl border border-blue-100 bg-white p-3 text-sm font-black outline-none" />
            <input type="number" min={1} value={newExam.period || 1} onChange={e => setNewExam(prev => ({ ...prev, period: Number(e.target.value) || 1 }))} className="rounded-xl border border-blue-100 bg-white p-3 text-sm font-black outline-none" />
            <input type="time" value={newExam.start_time || '08:00'} onChange={e => setNewExam(prev => ({ ...prev, start_time: e.target.value }))} className="rounded-xl border border-blue-100 bg-white p-3 text-sm font-black outline-none" />
            <input type="time" value={newExam.end_time || ''} onChange={e => setNewExam(prev => ({ ...prev, end_time: e.target.value }))} className="rounded-xl border border-blue-100 bg-white p-3 text-sm font-black outline-none" />
            <button
              onClick={saveExamSchedule}
              disabled={!onUpsertExamSchedule || !newExam.subject?.trim() || examSaving}
              className="rounded-xl bg-blue-600 p-3 text-xs font-black text-white shadow-lg disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {examSaving ? <><Loader2 size={14} className="animate-spin" /> جاري...</> : 'حفظ الاختبار'}
            </button>
          </div>
          {examSaveMsg && (
            <div className={`mt-3 p-3 rounded-xl text-xs font-black flex items-center gap-2 ${
              examSaveMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {examSaveMsg.type === 'success' ? <Check size={14} /> : <AlertTriangle size={14} />}
              {examSaveMsg.text}
            </div>
          )}

          <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
            {examSchedule.length ? examSchedule.map(exam => (
              <div key={exam.id} className="flex flex-col gap-3 rounded-2xl border border-blue-100 bg-white p-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black text-slate-600">{exam.exam_date}</span>
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-[10px] font-black text-blue-700">فترة {exam.period}</span>
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black text-emerald-700">{exam.start_time}</span>
                  </div>
                  <p className="mt-2 truncate text-base font-black text-slate-900">{exam.subject}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => addSlotFromExam(exam)} className="rounded-xl bg-slate-950 px-4 py-3 text-[10px] font-black text-white">استخدام في التوزيع</button>
                  {onDeleteExamSchedule && <button onClick={() => confirm('حذف هذا الاختبار من الجدول؟') && onDeleteExamSchedule(exam.id)} className="rounded-xl bg-red-50 px-4 py-3 text-[10px] font-black text-red-600">حذف</button>}
                </div>
              </div>
            )) : (
              <div className="rounded-2xl border border-dashed border-blue-200 bg-white/70 p-6 text-center text-sm font-black text-slate-400 xl:col-span-2">لم يتم إضافة جدول اختبارات بعد.</div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_.8fr] gap-6">
          <div className="space-y-3">
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100">
              <p className="font-black text-slate-900">احتياط المراقبين تلقائي</p>
              <p className="text-xs font-bold text-slate-500 mt-1">
                بعد توزيع اللجان الأساسية، كل مراقب متبقٍ وغير مستبعد في نفس التاريخ سيضاف احتياطاً على إحدى اللجان. الاحتياط لا يظهر في تقرير الطباعة الرسمي.
              </p>
            </div>
            {slots.map(slot => (
              <div key={slot.id} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_120px_48px] gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <input type="date" value={slot.date} onChange={e => updateSlot(slot.id, { date: e.target.value })} className="p-3 rounded-xl bg-white border border-slate-100 font-black text-sm" />
                <input value={slot.subject} onChange={e => updateSlot(slot.id, { subject: e.target.value })} placeholder="المادة" className="p-3 rounded-xl bg-white border border-slate-100 font-black text-sm" />
                <input type="number" min={1} value={slot.period} onChange={e => updateSlot(slot.id, { period: Number(e.target.value) || 1 })} className="p-3 rounded-xl bg-white border border-slate-100 font-black text-sm" />
                <button onClick={() => removeSlot(slot.id)} className="h-12 rounded-xl bg-white text-red-500 border border-red-100 flex items-center justify-center"><Trash2 size={18} /></button>
              </div>
            ))}
          </div>

          <div className="p-5 rounded-2xl bg-slate-950 text-white">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h4 className="font-black flex items-center gap-2"><UserMinus size={18} /> المستبعدون حسب تاريخ الاختبار</h4>
              <span className="text-[10px] font-black text-slate-400">{excludedIdsForSelectedScope.length} / {proctors.length}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.2fr] gap-2 mb-3">
              <select value={selectedExclusionScope} onChange={e => {
                const scope = slotScopes.find(item => item.key === e.target.value);
                setSelectedExclusionScope(e.target.value);
                if (scope) setSelectedExclusionDate(scope.slot.date);
              }} className="w-full p-3 rounded-xl bg-white/10 border border-white/10 text-xs font-black outline-none">
                {slotScopes.map(scope => <option key={scope.key} value={scope.key} className="text-slate-900">{scope.label}</option>)}
              </select>
              <div className="relative">
                <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={exclusionSearch} onChange={e => setExclusionSearch(e.target.value)} placeholder="بحث سريع بالاسم أو الهوية" className="w-full pr-9 pl-3 py-3 rounded-xl bg-white/10 border border-white/10 text-xs font-black outline-none placeholder:text-slate-500" />
              </div>
            </div>
            <div className="max-h-52 overflow-y-auto custom-scrollbar space-y-2">
              {filteredProctors.map(p => {
                const excluded = excludedIdsForSelectedScope.includes(p.id);
                return (
                  <button key={p.id} onClick={() => toggleExcluded(selectedExclusionScope, p.id)} className={`w-full p-3 rounded-xl text-right text-xs font-black border transition-all ${excluded ? 'bg-red-500/15 border-red-400/30 text-red-100' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'}`}>
                    <span className="block">{p.full_name}</span>
                    <span className="block text-[9px] mt-1 opacity-60">{p.national_id}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <label className="mt-6 flex items-center gap-3 text-sm font-black text-slate-600 cursor-pointer">
          <input type="checkbox" checked={replaceExisting} onChange={e => setReplaceExisting(e.target.checked)} className="w-5 h-5 accent-blue-600" />
          إعادة توزيع اللجان المرتبطة لنفس التاريخ والفترة عند الاعتماد
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 no-print">
        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm"><p className="text-[10px] font-black text-slate-400">اللجان</p><p className="text-3xl font-black">{committees.length}</p></div>
        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm"><p className="text-[10px] font-black text-slate-400">المراقبون المتاحون</p><p className="text-3xl font-black">{eligibleProctors.length}</p></div>
        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm"><p className="text-[10px] font-black text-slate-400">أساسي في المعاينة</p><p className="text-3xl font-black">{primaryPreviewCount}</p></div>
        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm"><p className="text-[10px] font-black text-slate-400">احتياط في المعاينة</p><p className="text-3xl font-black text-violet-600">{reservePreviewCount}</p></div>
        <div className="p-5 rounded-2xl bg-white border border-slate-100 shadow-sm"><p className="text-[10px] font-black text-slate-400">تكرار اضطراري</p><p className="text-3xl font-black text-amber-600">{forcedRepeatCount}</p></div>
      </div>

      <div className="bg-white rounded-[3rem] border border-slate-100 shadow-xl overflow-hidden no-print">
        <div className="p-6 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-black text-slate-950">ميزان العدالة قبل الاعتماد</h3>
            <p className="text-xs font-bold text-slate-400 mt-1">يوضح نصيب كل مراقب من اللجان الأساسية والاحتياط.</p>
          </div>
          <div className={`px-5 py-3 rounded-2xl text-xs font-black ${fairnessSummary.diff <= 1 ? 'bg-emerald-50 text-emerald-700' : fairnessSummary.diff === 2 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
            الحالة: {fairnessSummary.status} | الأقل {fairnessSummary.min} | الأعلى {fairnessSummary.max} | الفرق {fairnessSummary.diff}
          </div>
        </div>
        <div className="overflow-x-auto max-h-[360px]">
          <table className="w-full text-right border-collapse">
            <thead className="sticky top-0 bg-slate-50 z-10">
              <tr className="text-[10px] font-black text-slate-500">
                <th className="p-4 border-b">المراقب</th>
                <th className="p-4 border-b">أساسي قبل</th>
                <th className="p-4 border-b">أساسي مضاف</th>
                <th className="p-4 border-b">أساسي بعد</th>
                <th className="p-4 border-b">احتياط قبل</th>
                <th className="p-4 border-b">احتياط مضاف</th>
                <th className="p-4 border-b">احتياط بعد</th>
              </tr>
            </thead>
            <tbody>
              {fairnessRows.map(row => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="p-4 font-black text-slate-900">{row.name}</td>
                  <td className="p-4 font-black tabular-nums">{row.before}</td>
                  <td className={`p-4 font-black tabular-nums ${row.added ? 'text-blue-600' : 'text-slate-300'}`}>{row.added}</td>
                  <td className="p-4 font-black tabular-nums">{row.after}</td>
                  <td className="p-4 font-black tabular-nums">{row.reserveBefore}</td>
                  <td className={`p-4 font-black tabular-nums ${row.reserveAdded ? 'text-violet-600' : 'text-slate-300'}`}>{row.reserveAdded}</td>
                  <td className="p-4 font-black tabular-nums">{row.reserveAfter}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-[3rem] border border-slate-100 shadow-xl overflow-hidden no-print">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between gap-4">
          <h3 className="text-xl font-black flex items-center gap-2"><Users size={22} /> معاينة التوزيع</h3>
          <p className="text-xs font-bold text-slate-400">يمكن سحب بطاقة على أخرى لتبديل مراقبين من نفس النوع.</p>
        </div>
        <div className="p-4 border-b border-slate-100 grid grid-cols-1 md:grid-cols-5 gap-3">
          <select value={previewDateFilter} onChange={e => setPreviewDateFilter(e.target.value)} className="p-3 rounded-xl bg-slate-50 border border-slate-100 font-black text-xs">
            <option value="">كل التواريخ</option>
            {previewDates.map(date => <option key={date} value={date}>{date}</option>)}
          </select>
          <select value={previewSubjectFilter} onChange={e => setPreviewSubjectFilter(e.target.value)} className="p-3 rounded-xl bg-slate-50 border border-slate-100 font-black text-xs">
            <option value="">كل المواد</option>
            {previewSubjects.map(subject => <option key={subject} value={subject}>{subject}</option>)}
          </select>
          <select value={previewPeriodFilter} onChange={e => setPreviewPeriodFilter(e.target.value)} className="p-3 rounded-xl bg-slate-50 border border-slate-100 font-black text-xs">
            <option value="">كل الفترات</option>
            {previewPeriods.map(period => <option key={period} value={period}>{period}</option>)}
          </select>
          <input value={previewCommitteeFilter} onChange={e => setPreviewCommitteeFilter(e.target.value)} placeholder="فلتر اللجنة" className="p-3 rounded-xl bg-slate-50 border border-slate-100 font-black text-xs outline-none" />
          <input value={previewTeacherFilter} onChange={e => setPreviewTeacherFilter(e.target.value)} placeholder="فلتر المراقب" className="p-3 rounded-xl bg-slate-50 border border-slate-100 font-black text-xs outline-none" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-black text-slate-500">
                <th className="p-4 border-b">النوع</th>
                <th className="p-4 border-b">التاريخ</th>
                <th className="p-4 border-b">المادة</th>
                <th className="p-4 border-b">الفترة</th>
                <th className="p-4 border-b">اللجنة</th>
                <th className="p-4 border-b">اسم المراقب</th>
                <th className="p-4 border-b">مسند له</th>
                <th className="p-4 border-b">بعد التوزيع</th>
                <th className="p-4 border-b">احتياط له</th>
                <th className="p-4 border-b">سبب الاختيار</th>
                <th className="p-4 border-b">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {sortedPreview.length ? sortedPreview.map(item => (
                <tr
                  key={item.id}
                  draggable
                  onDragStart={() => setDraggedId(item.id)}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => {
                    if (draggedId) swapItems(draggedId, item.id);
                    setDraggedId(null);
                  }}
                  className={`border-b border-slate-100 ${item.assignmentType === 'RESERVE' ? 'bg-violet-50/50' : 'hover:bg-blue-50/40'}`}
                >
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black ${item.assignmentType === 'RESERVE' ? 'bg-violet-600 text-white' : 'bg-blue-600 text-white'}`}>
                      {item.assignmentType === 'RESERVE' ? 'احتياط' : 'أساسي'}
                    </span>
                  </td>
                  <td className="p-4 font-bold">{item.date}</td>
                  <td className="p-4 font-bold">{item.subject}</td>
                  <td className="p-4 font-bold tabular-nums">{item.period}</td>
                  <td className="p-4 font-black tabular-nums">{item.committeeNumber}</td>
                  <td className="p-4 font-black">{item.teacherName}</td>
                  <td className="p-4 font-black tabular-nums">{item.assignedCount}</td>
                  <td className="p-4 font-black tabular-nums text-blue-600">{fairnessAfterById[item.teacherId] ?? item.assignedCount + 1}</td>
                  <td className="p-4 font-black tabular-nums text-violet-600">{item.reserveCount}</td>
                  <td className="p-4 text-[11px] font-bold text-slate-500 max-w-[260px]">
                    {item.assignmentType === 'RESERVE' ? (item.reserveReason || 'احتياط موزع تلقائياً') : (item.forcedRepeat ? 'إسناد للضرورة مع مراعاة العدالة' : 'إسناد أساسي متوازن')}
                  </td>
                  <td className="p-4">
                    <button onClick={() => replaceOne(item)} className="px-3 py-2 rounded-xl bg-slate-900 text-white text-[10px] font-black flex items-center gap-2">
                      <Shuffle size={14} /> استبدال
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={11} className="p-12 text-center text-slate-400 font-black">لم يتم توليد توزيع بعد.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[.85fr_1.15fr] gap-6 no-print">
        <div className="bg-white rounded-[3rem] border border-slate-100 shadow-xl overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h3 className="text-xl font-black text-slate-950">إحصائية الإسناد لكل مراقب</h3>
            <p className="text-xs font-bold text-slate-400 mt-1">توضح عدد اللجان الأساسية والاحتياط بعد الاعتماد والمعاينة حتى تظهر العدالة قبل أي قرار.</p>
          </div>
          <div className="overflow-x-auto max-h-[460px]">
            <table className="w-full text-right border-collapse">
              <thead className="sticky top-0 bg-slate-50 z-10">
                <tr className="text-[10px] font-black text-slate-500">
                  <th className="p-4 border-b">المراقب</th>
                  <th className="p-4 border-b">أساسي</th>
                  <th className="p-4 border-b">احتياط</th>
                  <th className="p-4 border-b">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {approvedLoadRows.map(row => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="p-4 font-black text-slate-900">{row.name}</td>
                    <td className="p-4 font-black tabular-nums text-blue-600">{row.primary}</td>
                    <td className="p-4 font-black tabular-nums text-violet-600">{row.reserve}</td>
                    <td className="p-4 font-black tabular-nums">{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-[3rem] border border-slate-100 shadow-xl overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <h3 className="text-xl font-black text-slate-950">لوحة التحكم بعد الاعتماد</h3>
            <p className="text-xs font-bold text-slate-400 mt-1">يمكن نقل المراقب أو تغييره حتى بعد الربط. قبل النقل يظهر تنبيه بعدد إسنادات المراقب الجديد.</p>
          </div>
          <div className="p-5 space-y-5 max-h-[520px] overflow-y-auto custom-scrollbar">
            {approvedGroups.length ? approvedGroups.map(group => (
              <div key={group.key} className="rounded-[2rem] border border-slate-100 bg-slate-50/70 p-4">
                <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-black text-slate-950">{group.subject}</p>
                    <p className="text-[10px] font-black text-slate-400">{group.date} | فترة {group.period}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="rounded-full bg-white px-4 py-2 text-[10px] font-black text-slate-600">{group.rows.length} إسناد</span>
                    <button
                      onClick={() => deleteGroupFromDB({ date: group.date, period: group.period, subject: group.subject })}
                      disabled={deletingGroupKey === examScopeKey(group.date, group.period, group.subject)}
                      className="rounded-full bg-red-50 border border-red-100 px-4 py-2 text-[10px] font-black text-red-600 hover:bg-red-600 hover:text-white transition-all disabled:opacity-50 flex items-center gap-1"
                      title="حذف كل التوزيع لهذه المجموعة وإعادة التوزيع"
                    >
                      {deletingGroupKey === examScopeKey(group.date, group.period, group.subject)
                        ? <><Loader2 size={12} className="animate-spin" /> جاري الحذف...</>
                        : <><Trash2 size={12} /> حذف كل التوزيع</>}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {group.rows.map(row => {
                    const load = approvedLoadById[row.teacherId] || { primary: 0, reserve: 0, total: 0 };
                    return (
                      <div key={`${row.kind}-${row.id}`} className={`rounded-2xl border p-4 ${row.kind === 'RESERVE' ? 'border-violet-100 bg-violet-50/70' : 'border-blue-100 bg-white'}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black text-white ${row.kind === 'RESERVE' ? 'bg-violet-600' : 'bg-blue-600'}`}>{row.kindLabel}</span>
                            <p className="mt-2 text-xl font-black text-slate-950">لجنة {row.committeeNumber}</p>
                            <p className="text-[10px] font-black text-slate-400">حمله الحالي: {load.primary} أساسي، {load.reserve} احتياط</p>
                          </div>
                          <button onClick={() => confirm(`حذف إسناد لجنة ${row.committeeNumber}؟`) && deleteSupervisionRows([row.id])} className="rounded-xl bg-red-50 p-3 text-red-600">
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <select
                          value={row.teacherId}
                          onChange={e => updateApprovedTeacher(row, e.target.value)}
                          className="mt-4 w-full rounded-2xl border border-slate-200 bg-white p-3 text-xs font-black text-slate-900 outline-none"
                        >
                          {sortedProctors.map(p => {
                            const pLoad = approvedLoadById[p.id] || { primary: 0, reserve: 0, total: 0 };
                            return (
                              <option key={p.id} value={p.id}>
                                {p.full_name} - {pLoad.primary} أساسي / {pLoad.reserve} احتياط
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>
            )) : (
              <div className="rounded-[2rem] border border-dashed border-slate-200 p-10 text-center font-black text-slate-400">
                لا توجد توزيعات معتمدة ضمن الفلتر الحالي.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[3rem] border border-slate-100 shadow-xl overflow-hidden print:shadow-none print:rounded-none print:border-black">
        <div className="p-6 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-4 no-print">
          <div>
            <h3 className="text-xl font-black flex items-center gap-2"><FileText size={22} /> التوزيعات المعتمدة</h3>
            <p className="text-xs font-bold text-slate-400 mt-1">الطباعة الرسمية تعرض الأساسي فقط، والاحتياط يظهر هنا وفي جدول مراقبتي.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <input type="date" value={distributionDateFilter} onChange={e => setDistributionDateFilter(e.target.value)} className="p-3 rounded-xl bg-slate-50 border border-slate-100 font-black text-sm" />
            <select value={distributionSubjectFilter} onChange={e => setDistributionSubjectFilter(e.target.value)} className="p-3 rounded-xl bg-slate-50 border border-slate-100 font-black text-sm min-w-[180px]">
              <option value="">كل المواد</option>
              {subjectOptions.map(subject => <option key={subject} value={subject}>{subject}</option>)}
            </select>
            <button onClick={printOfficialDistribution} disabled={!committedRows.length} className="px-5 py-3 rounded-2xl bg-slate-950 text-white font-black text-xs flex items-center gap-2 disabled:opacity-40"><Printer size={18} /> طباعة التقرير</button>
            <button
              onClick={() => {
                const ids = [...committedRows.map(r => r.id), ...reserveCommittedRows.map(r => r.id)];
                if (ids.length && confirm('هل تريد حذف كل التوزيعات الظاهرة، بما فيها الاحتياط؟')) deleteSupervisionRows(ids);
              }}
              disabled={!committedRows.length && !reserveCommittedRows.length}
              className="px-5 py-3 rounded-2xl bg-red-50 text-red-600 font-black text-xs flex items-center gap-2 disabled:opacity-40"
            >
              <Trash2 size={18} /> حذف الظاهر
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-black text-slate-500 print:text-black">
                <th className="p-4 border-b">التاريخ</th>
                <th className="p-4 border-b">المادة</th>
                <th className="p-4 border-b">الفترة</th>
                <th className="p-4 border-b">اللجنة</th>
                <th className="p-4 border-b">اسم المراقب</th>
                <th className="p-4 border-b no-print">النوع</th>
                <th className="p-4 border-b no-print">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {[...committedRows.map(row => ({ ...row, kind: 'أساسي' })), ...reserveCommittedRows.map(row => ({ ...row, kind: 'احتياط' }))].length ? (
                [...committedRows.map(row => ({ ...row, kind: 'أساسي' })), ...reserveCommittedRows.map(row => ({ ...row, kind: 'احتياط' }))].map(row => (
                  <tr key={`${row.kind}-${row.id}`} className={`border-b border-slate-100 print:border-black ${row.kind === 'احتياط' ? 'bg-violet-50/60 no-print' : ''}`}>
                    <td className="p-4 font-bold">{row.date}</td>
                    <td className="p-4 font-bold">{row.subject}</td>
                    <td className="p-4 font-bold tabular-nums">{row.period}</td>
                    <td className="p-4 font-black tabular-nums">{row.committeeNumber}</td>
                    <td className="p-4 font-black">{row.teacherName}</td>
                    <td className="p-4 no-print">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black ${row.kind === 'احتياط' ? 'bg-violet-600 text-white' : 'bg-blue-600 text-white'}`}>{row.kind}</span>
                    </td>
                    <td className="p-4 no-print">
                      <button onClick={() => confirm(`حذف توزيع لجنة ${row.committeeNumber}؟`) && deleteSupervisionRows([row.id])} className="px-3 py-2 rounded-xl bg-red-50 text-red-600 text-[10px] font-black flex items-center gap-2">
                        <Trash2 size={14} /> حذف
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400 font-black">لا توجد توزيعات معتمدة حسب الفلتر الحالي.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isPrintingDistribution && createPortal(
        <div id="proctor-distribution-print">
          <style>{`
            @media screen { #proctor-distribution-print { display: none !important; } }
            @media print {
              @page { size: A4 portrait; margin: 8mm; }
              body { background: white !important; margin: 0 !important; padding: 0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              body.printing-proctor-distribution > *:not(#proctor-distribution-print) { display: none !important; }
              #root, #app-root, header, nav, main, aside, .no-print { display: none !important; }
              #proctor-distribution-print { display: block !important; position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; direction: rtl; color: #000; font-family: 'Tajawal', Arial, sans-serif; background: white !important; z-index: 999999 !important; }
              #proctor-distribution-print * { box-shadow: none !important; }
              .distribution-print-page { min-height: 281mm; page-break-after: always; display: flex; flex-direction: column; padding: 0; box-sizing: border-box; }
              .distribution-official-header { display: grid; grid-template-columns: 1fr 1fr 1fr; align-items: start; border-bottom: 4px double #000; padding: 0 0 4mm; margin-bottom: 5mm; min-height: 26mm; }
              .official-side { font-size: 10pt; line-height: 1.65; font-weight: 900; color: #000; }
              .official-right { text-align: right; }
              .official-left { text-align: left; direction: rtl; }
              .official-logo { display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 1mm; font-size: 8pt; font-weight: 800; color: #475569; }
              .official-logo img { width: 31mm; height: 18mm; object-fit: contain; }
              .distribution-print-table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 9pt; }
              .distribution-print-table th, .distribution-print-table td { border: 1px solid #000; padding: 6px 5px; text-align: center; vertical-align: middle; }
              .distribution-print-table th { background: #f1f5f9; font-weight: 900; }
              .distribution-print-table td.name-cell { text-align: right; font-weight: 800; }
              .distribution-meta-table { width: 100%; border-collapse: collapse; table-layout: fixed; margin: 4mm 0 5mm; font-size: 9pt; }
              .distribution-meta-table th, .distribution-meta-table td { border: 1px solid #000; padding: 5px 4px; text-align: center; vertical-align: middle; }
              .distribution-meta-table th { background: #f1f5f9; font-weight: 900; width: 10%; }
              .distribution-meta-table td { font-weight: 800; width: 15%; }
              .distribution-print-footer { margin-top: auto; display: grid; grid-template-columns: 1fr 1fr; gap: 28mm; padding-top: 14mm; break-inside: avoid; page-break-inside: avoid; font-size: 10pt; font-weight: 900; }
              .signature-box { text-align: center; border-top: 1px solid #000; padding-top: 4mm; min-height: 28mm; }
            }
          `}</style>
          {printPages.map((pageRows, pageIndex) => (
            <div key={pageIndex} className="distribution-print-page">
              <OfficialDistributionHeader date={distributionDateFilter || today()} />
              <div style={{ textAlign: 'center', margin: '5mm 0 4mm' }}>
                <h1 style={{ display: 'inline-block', margin: 0, padding: '0 26mm 2mm', borderBottom: '2px solid #000', fontSize: '15pt', fontWeight: 900 }}>
                  توزيع المراقبين على اللجان
                </h1>
              </div>
              <table className="distribution-meta-table">
                <tbody>
                  <tr>
                    <th>اليوم</th>
                    <td>{new Date(`${distributionDateFilter || today()}T12:00:00`).toLocaleDateString('ar-SA', { weekday: 'long' })}</td>
                    <th>التاريخ</th>
                    <td>{distributionDateFilter || today()}</td>
                    <th>المادة</th>
                    <td>{distributionSubjectFilter || 'الكل'}</td>
                    <th>الفترة</th>
                    <td>{pageRows[0]?.period || slots[0]?.period || 1}</td>
                  </tr>
                </tbody>
              </table>
              <table className="distribution-print-table">
                <thead>
                  <tr>
                    <th style={{ width: '12%' }}>رقم اللجنة</th>
                    <th style={{ width: '58%' }}>اسم المعلم</th>
                    <th style={{ width: '30%' }}>التوقيع</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map(row => (
                    <tr key={row.id}>
                      <td style={{ fontWeight: 900 }}>{row.committeeNumber}</td>
                      <td className="name-cell">{row.teacherName}</td>
                      <td>&nbsp;</td>
                    </tr>
                  ))}
                  {Array.from({ length: Math.max(0, 18 - pageRows.length) }).map((_, idx) => (
                    <tr key={`empty-${pageIndex}-${idx}`}>
                      <td>&nbsp;</td>
                      <td>&nbsp;</td>
                      <td>&nbsp;</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="distribution-print-footer">
                <div className="signature-box">
                  <div>وكيل الشؤون التعليمية</div>
                  <div style={{ marginTop: '8mm', fontWeight: 800 }}>{controlHeadName}</div>
                </div>
                <div className="signature-box">
                  <div>مدير المدرسة</div>
                  <div style={{ marginTop: '8mm', fontWeight: 800 }}>{schoolManagerName}</div>
                </div>
              </div>
            </div>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
};

export default SmartProctorDistribution;
