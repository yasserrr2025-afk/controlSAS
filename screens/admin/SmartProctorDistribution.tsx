import React, { useState, useMemo, useEffect } from 'react';
import {
  CalendarDays,
  Check,
  Printer,
  RefreshCcw,
  Search,
  Trash2,
  Users,
  Wand2,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  GripVertical
} from 'lucide-react';
import { ExamSchedule, Student, Supervision, User } from '../../types';
import { supabase } from '../../supabase';
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
}

type WizardStep = 'SELECT_EXAM' | 'EXCLUDE_PROCTORS' | 'PREVIEW';

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
  const [selectedExam, setSelectedExam] = useState<ExamSchedule | null>(null);
  const [excludedProctorIds, setExcludedProctorIds] = useState<string[]>([]);
  const [distribution, setDistribution] = useState<SmartDistributionItem[]>([]);
  const [searchProctor, setSearchProctor] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  
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
  const committees = useMemo(() => {
    const unique = Array.from(new Set(students.map(s => s.committee_number).filter(Boolean)));
    return unique.sort((a, b) => Number(a) - Number(b));
  }, [students]);

  // View Past Distributions
  const pastDistributions = useMemo(() => {
    const groups = new Map<string, Supervision[]>();
    supervisions.forEach(s => {
      const key = `${s.date}__${s.period}__${s.subject}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(s);
    });
    return Array.from(groups.entries()).map(([key, items]) => {
      const [date, period, subject] = key.split('__');
      return { key, date, period: Number(period), subject, count: items.length, items };
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [supervisions]);

  // Handlers for Drag and Drop
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedItemId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

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

      // Swap roles and committees
      const tempCommittee = sourceItem.committeeNumber;
      const tempType = sourceItem.assignmentType;

      sourceItem.committeeNumber = targetItem.committeeNumber;
      sourceItem.assignmentType = targetItem.assignmentType;

      targetItem.committeeNumber = tempCommittee;
      targetItem.assignmentType = tempType;

      newDist[sourceIdx] = sourceItem;
      newDist[targetIdx] = targetItem;

      return newDist;
    });
    setDraggedItemId(null);
  };

  const runDistributionAlgorithm = () => {
    if (!selectedExam) return;

    // 1. Calculate previous load for each proctor before this exam date
    const previousLoads = proctors.map(p => {
      const pastSupervisions = supervisions.filter(s => s.teacher_id === p.id && s.date < selectedExam.exam_date);
      const primaryCount = pastSupervisions.filter(s => s.assignment_type !== 'RESERVE').length;
      const reserveCount = pastSupervisions.filter(s => s.assignment_type === 'RESERVE').length;
      return { 
        id: p.id, 
        name: p.full_name, 
        primaryCount, 
        reserveCount, 
        // Weight: Primary is heavier than Reserve
        weight: (primaryCount * 2) + reserveCount + Math.random() // Math.random() for tie-breaking
      };
    });

    // 2. Filter out excluded
    const available = previousLoads.filter(p => !excludedProctorIds.includes(p.id));

    // 3. Sort by weight ascending (Least loaded first)
    available.sort((a, b) => a.weight - b.weight);

    const neededPrimary = committees.length;
    const draftedPrimary = available.slice(0, neededPrimary);
    const draftedReserve = available.slice(neededPrimary);

    // Shuffle committees to avoid assigning the same proctor to the same committee number always if loads match
    const shuffledCommittees = [...committees].sort(() => Math.random() - 0.5);

    const newDistribution: SmartDistributionItem[] = [];

    draftedPrimary.forEach((proctor, index) => {
      newDistribution.push({
        id: crypto.randomUUID(),
        teacherId: proctor.id,
        teacherName: proctor.name,
        committeeNumber: shuffledCommittees[index] || String(index + 1),
        assignmentType: 'PRIMARY',
        previousPrimaryCount: proctor.primaryCount,
        previousReserveCount: proctor.reserveCount
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
        previousReserveCount: proctor.reserveCount
      });
    });

    // Sort the final distribution by committee number for Primary, then Reserve
    newDistribution.sort((a, b) => {
      if (a.assignmentType !== b.assignmentType) return a.assignmentType === 'PRIMARY' ? -1 : 1;
      return Number(a.committeeNumber) - Number(b.committeeNumber);
    });

    setDistribution(newDistribution);
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

  const handleCommit = async () => {
    if (!selectedExam || !distribution.length) return;
    setIsCommitting(true);
    
    try {
      // Delete existing supervisions for this exam to replace them
      const existingIds = supervisions
        .filter(s => s.date === selectedExam.exam_date && Number(s.period) === Number(selectedExam.period) && s.subject === selectedExam.subject)
        .map(s => s.id);
        
      if (existingIds.length > 0 && onDeleteSupervisions) {
        await onDeleteSupervisions(existingIds);
      }

      const payload = distribution.map(d => ({
        teacher_id: d.teacherId,
        committee_number: d.committeeNumber,
        date: selectedExam.exam_date,
        period: selectedExam.period,
        subject: selectedExam.subject,
        assignment_type: d.assignmentType
      }));

      const { error } = await supabase.from('supervision').insert(payload);
      if (error) throw error;
      
      alert('تم الحفظ بنجاح!');
      setStep('SELECT_EXAM');
      setSelectedExam(null);
      setDistribution([]);
      setExcludedProctorIds([]);
    } catch (err: any) {
      alert('حدث خطأ أثناء الحفظ: ' + err.message);
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

  const printOfficialReport = (dist: {date: string, period: number, subject: string, items: Supervision[]}) => {
    // Generate an invisible printable area, print it, and remove it
    const printWindow = window.open('', '_blank');
    if (!printWindow) return alert('يرجى السماح بالنوافذ المنبثقة للطباعة');

    const dayName = new Date(dist.date).toLocaleDateString('ar-SA', { weekday: 'long' });
    
    const primary = dist.items.filter(i => i.assignment_type !== 'RESERVE').sort((a,b) => Number(a.committee_number) - Number(b.committee_number));
    const reserve = dist.items.filter(i => i.assignment_type === 'RESERVE');

    const getTeacherName = (id: string) => users.find(u => u.id === id)?.full_name || 'غير معروف';

    const html = `
      <html dir="rtl">
        <head>
          <title>تقرير المراقبين - ${dist.subject}</title>
          <style>
            body { font-family: 'Arial', sans-serif; padding: 20px; color: #000; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
            .header-text { text-align: center; line-height: 1.5; font-size: 14px; }
            .logo { width: 80px; height: 80px; object-fit: contain; }
            .title { text-align: center; font-size: 20px; font-weight: bold; margin-bottom: 20px; }
            .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th, td { border: 1px solid #000; padding: 10px; text-align: center; }
            th { background-color: #f0f0f0; font-weight: bold; }
            @media print {
              @page { size: A4 portrait; margin: 10mm; }
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="header-text">
              المملكة العربية السعودية<br/>
              وزارة التعليم<br/>
              إدارة التعليم<br/>
              مدرسة عماد الدين زنكي المتوسطة
            </div>
            <img src="${APP_CONFIG.LOGO_URL}" class="logo" />
            <div class="header-text">
              العام الدراسي<br/>
              ${systemConfig?.academic_year || '1446 / 1447'}<br/>
              الفصل الدراسي<br/>
              نظام كنترول الاختبارات
            </div>
          </div>
          
          <div class="title">بيان بأسماء السادة الملاحظين (المراقبين)</div>
          
          <div class="info-grid">
            <div>اليوم: ${dayName}</div>
            <div>التاريخ: ${dist.date}</div>
            <div>الفترة: ${dist.period}</div>
            <div>المادة: ${dist.subject}</div>
          </div>

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

          <div class="title" style="font-size: 16px;">المراقبين الاحتياط</div>
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
          
          <div style="display: flex; justify-content: space-between; margin-top: 50px;">
            <div>مدير المدرسة: ${users.find(u => u.role === 'ADMIN')?.full_name || '....................'}</div>
            <div>رئيس الكنترول: ${users.find(u => u.role === 'CONTROL_MANAGER')?.full_name || '....................'}</div>
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
            onClick={() => { setStep('SELECT_EXAM'); setSelectedExam(null); }}
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
              <button onClick={saveExamSchedule} disabled={!onUpsertExamSchedule || !newExam.subject?.trim()} className="w-full rounded-xl bg-blue-600 p-3 text-sm font-black text-white shadow-lg shadow-blue-200 disabled:opacity-40 hover:bg-blue-700 transition-all h-[46px] flex items-center justify-center gap-2">
                 حفظ وإضافة للجدول
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
                {examSchedule.length === 0 ? (
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
                      {examSchedule.map(exam => {
                        const hasDistribution = pastDistributions.some(p => p.date === exam.exam_date && p.period === exam.period && p.subject === exam.subject);
                        return (
                          <tr key={exam.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4 text-slate-900">{exam.subject}</td>
                            <td className="p-4">
                              <div className="flex flex-col gap-1">
                                <span className="text-xs text-slate-500">{exam.exam_date}</span>
                                <span className="text-xs text-blue-600 bg-blue-50 w-fit px-2 py-0.5 rounded-md">فترة {exam.period}</span>
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
                                onClick={() => { setSelectedExam(exam); setStep('EXCLUDE_PROCTORS'); }}
                                className={`p-2 rounded-lg transition-all ${hasDistribution ? 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600' : 'bg-blue-100 text-blue-600 hover:bg-blue-200 shadow-sm'}`}
                                title={hasDistribution ? "إعادة التوزيع" : "بدء التوزيع"}
                              >
                                <Wand2 size={16} />
                              </button>
                              {onDeleteExamSchedule && (
                                <button 
                                  onClick={async () => {
                                    if(confirm('هل أنت متأكد من حذف هذا الاختبار من الجدول بالكامل؟')) {
                                      await onDeleteExamSchedule(exam.id);
                                    }
                                  }}
                                  className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-all"
                                  title="حذف الاختبار"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
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

      {step === 'EXCLUDE_PROCTORS' && selectedExam && (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 max-w-3xl mx-auto">
          <div className="text-center mb-6 border-b pb-6">
            <h3 className="text-2xl font-black text-slate-800 mb-2">تحديد المستبعدين</h3>
            <p className="text-slate-500 font-bold">
              لاختبار مادة <span className="text-blue-600">{selectedExam.subject}</span> يوم {selectedExam.exam_date} فترة {selectedExam.period}
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
                <label key={proctor.id} className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${isExcluded ? 'bg-red-50 border border-red-200' : 'hover:bg-white border border-transparent'}`}>
                  <input 
                    type="checkbox" 
                    checked={isExcluded}
                    onChange={(e) => {
                      if (e.target.checked) setExcludedProctorIds(prev => [...prev, proctor.id]);
                      else setExcludedProctorIds(prev => prev.filter(id => id !== proctor.id));
                    }}
                    className="w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                  />
                  <div>
                    <div className={`font-black ${isExcluded ? 'text-red-700' : 'text-slate-800'}`}>{proctor.full_name}</div>
                    {isExcluded && <div className="text-[10px] text-red-500 font-bold">مستبعد من هذا التوزيع</div>}
                  </div>
                </label>
              );
            })}
          </div>

          <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl">
            <div className="font-bold text-slate-600">
              إجمالي المراقبين: {proctors.length} | المتاحين: <span className="text-emerald-600 font-black">{proctors.length - excludedProctorIds.length}</span>
            </div>
            <button 
              onClick={runDistributionAlgorithm}
              className="bg-blue-600 text-white px-8 py-3 rounded-xl font-black flex items-center gap-2 hover:bg-blue-700 shadow-lg shadow-blue-200"
            >
              <Wand2 size={20} /> توزيع اللجان الآن
            </button>
          </div>
        </div>
      )}

      {step === 'PREVIEW' && selectedExam && (
        <div className="space-y-6">
          <div className="bg-orange-50 border border-orange-200 p-4 rounded-xl flex gap-3 text-orange-800 font-bold items-start">
            <AlertTriangle size={24} className="shrink-0" />
            <div>
              <h4 className="font-black text-lg">معاينة التوزيع الذكي</h4>
              <p className="text-sm mt-1">قم بمراجعة التوزيع ويمكنك سحب المراقب وإفلاته فوق مراقب آخر لتبديل المهام بينهم. بعد الانتهاء اضغط على زر الحفظ.</p>
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
                {distribution.filter(d => d.assignmentType === 'PRIMARY').map(item => (
                  <div 
                    key={item.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, item.id)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, item.id)}
                    className={`bg-white border-2 rounded-2xl p-4 transition-all shadow-sm cursor-grab ${draggedItemId === item.id ? 'opacity-50 border-blue-400 border-dashed' : 'border-slate-100 hover:border-blue-300'}`}
                  >
                    <div className="flex justify-between items-center mb-3">
                      <span className="bg-blue-100 text-blue-800 font-black px-3 py-1 rounded-lg text-sm">لجنة {item.committeeNumber}</span>
                      <GripVertical size={16} className="text-slate-300" />
                    </div>
                    <div className="font-black text-slate-800 text-lg">{item.teacherName}</div>
                    <div className="mt-2 flex gap-2 text-[10px] font-bold">
                      <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded">أساسي سابقاً: {item.previousPrimaryCount}</span>
                      <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded">احتياط سابقاً: {item.previousReserveCount}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Reserves */}
            <div className="xl:col-span-1 space-y-4">
              <h4 className="font-black text-slate-800 text-xl flex items-center gap-2">
                <Users size={24} className="text-emerald-600" /> الاحتياط
              </h4>
              <div className="space-y-3">
                {distribution.filter(d => d.assignmentType === 'RESERVE').map((item, idx) => (
                  <div 
                    key={item.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, item.id)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, item.id)}
                    className={`bg-emerald-50 border-2 rounded-xl p-3 transition-all cursor-grab ${draggedItemId === item.id ? 'opacity-50 border-emerald-400 border-dashed' : 'border-emerald-100 hover:border-emerald-300'}`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-emerald-800 font-black text-xs">احتياط {idx + 1}</span>
                      <GripVertical size={14} className="text-emerald-300" />
                    </div>
                    <div className="font-black text-slate-800 text-sm">{item.teacherName}</div>
                    <div className="mt-1 text-[10px] text-slate-500 font-bold flex gap-2">
                      <span>أساسي: {item.previousPrimaryCount}</span>
                      <span>احتياط: {item.previousReserveCount}</span>
                    </div>
                  </div>
                ))}
                {distribution.filter(d => d.assignmentType === 'RESERVE').length === 0 && (
                  <div className="text-center p-6 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 font-bold text-sm">
                    لا يوجد مراقبين احتياط (العدد يكفي اللجان فقط)
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
