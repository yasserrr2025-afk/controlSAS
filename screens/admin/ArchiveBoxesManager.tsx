import React, { useState, useEffect, useMemo } from 'react';
import { PackageSearch, Plus, Search, Printer, Calendar, Tag, Layers, UserCircle, Save, Trash2, X, RefreshCw, Archive, CheckSquare, Square } from 'lucide-react';
import { ArchiveBox, Student, ExamSchedule, DeliveryLog, Supervision, User, Absence } from '../../types';
import { db } from '../../supabase';

interface Props {
  students: Student[];
  examSchedule?: ExamSchedule[];
  deliveryLogs?: DeliveryLog[];
  supervisions?: Supervision[];
  users?: User[];
  absences?: Absence[];
}

export const ArchiveBoxesManager: React.FC<Props> = ({
  students,
  examSchedule = [],
  deliveryLogs = [],
  supervisions = [],
  users = [],
  absences = [],
}) => {
  const [boxes, setBoxes] = useState<ArchiveBox[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [selectedBox, setSelectedBox] = useState<ArchiveBox | null>(null);
  const [alert, setAlert] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Form state
  const [form, setForm] = useState<Partial<ArchiveBox>>({
    box_number: '',
    grade: '',
    subject: '',
    exam_date: new Date().toISOString().split('T')[0],
    committees: [],
  });

  // All unique grades from students
  const allGrades = useMemo(() =>
    [...new Set(students.map(s => s.grade).filter(Boolean))].sort(),
    [students]
  );

  // All unique dates from exam schedule for the date picker
  const examDates = useMemo(() =>
    [...new Set(examSchedule.map(e => e.exam_date).filter(Boolean))].sort(),
    [examSchedule]
  );

  // Subjects available on the selected date (for auto-fill)
  const subjectsOnDate = useMemo(() => {
    if (!form.exam_date) return [];
    return examSchedule.filter(e => {
      if (!e.exam_date) return false;
      return e.exam_date === form.exam_date ||
        e.exam_date.startsWith(form.exam_date) ||
        form.exam_date.startsWith(e.exam_date.slice(0, 10));
    });
  }, [examSchedule, form.exam_date]);

  // Committees available for the selected grade
  const availableCommittees = useMemo(() => {
    if (!form.grade) return [];
    const gradeStudents = students.filter(s => s.grade === form.grade && s.committee_number);
    return [...new Set(gradeStudents.map(s => String(s.committee_number)))].sort((a, b) => Number(a) - Number(b));
  }, [students, form.grade]);

  // Auto-fill subject when grade + date selected
  useEffect(() => {
    if (form.grade && form.exam_date && subjectsOnDate.length > 0) {
      const matchingExam = subjectsOnDate.find(e =>
        !e.grades || e.grades.length === 0 || e.grades.includes(form.grade || '')
      ) || subjectsOnDate[0];
      if (matchingExam) {
        setForm(prev => ({ ...prev, subject: matchingExam.subject }));
      }
    }
  }, [form.grade, form.exam_date, subjectsOnDate]);

  // Students inside selected box
  const boxStudents = useMemo(() => {
    if (!selectedBox) return [];
    return students.filter(s =>
      s.grade === selectedBox.grade &&
      s.committee_number &&
      selectedBox.committees.includes(String(s.committee_number))
    ).sort((a, b) => {
      const ca = Number(a.committee_number), cb = Number(b.committee_number);
      if (ca !== cb) return ca - cb;
      return a.name.localeCompare(b.name, 'ar');
    });
  }, [selectedBox, students]);

  const eqCom = (a: any, b: any) => String(a) === String(b);

  const matchesDate = (iso: string | undefined | null, date: string) => {
    if (!iso || !date) return false;
    const s = String(iso);
    if (s.startsWith(date)) return true;
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return false;
      const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return local === date;
    } catch {
      return false;
    }
  };

  const getBoxStats = (box: ArchiveBox) => {
    const scopedStudents = students.filter(s =>
      s.grade === box.grade && box.committees.some(c => eqCom(s.committee_number, c))
    );
    const scopedAbsences = absences.filter(a =>
      box.committees.some(c => eqCom(a.committee_number, c)) && matchesDate(a.date, box.exam_date)
    );
    const absentIds = new Set(scopedAbsences.filter(a => a.type === 'ABSENT').map(a => a.student_id));
    const lateIds = new Set(scopedAbsences.filter(a => a.type === 'LATE').map(a => a.student_id));
    const present = Math.max(scopedStudents.length - absentIds.size, 0);
    const rate = scopedStudents.length > 0 ? Math.round((present / scopedStudents.length) * 100) : 0;
    return {
      total: scopedStudents.length,
      present,
      absent: absentIds.size,
      late: lateIds.size,
      rate,
    };
  };

  const getBoxProctorNames = (box: ArchiveBox) => {
    const names = supervisions
      .filter(s => box.committees.some(c => eqCom(s.committee_number, c)) && matchesDate(s.date, box.exam_date))
      .map(s => users.find(u => u.id === s.teacher_id || u.national_id === s.teacher_id)?.full_name || s.teacher_id)
      .filter(Boolean);
    return Array.from(new Set(names));
  };

  const showAlert = (msg: string, type: 'success' | 'error' = 'success') => {
    setAlert({ msg, type });
    setTimeout(() => setAlert(null), 3500);
  };

  const loadBoxes = async () => {
    setLoading(true);
    try {
      const data = await db.archiveBoxes.getAll();
      setBoxes(data as ArchiveBox[]);

      // Auto-migrate localStorage data to Supabase if Supabase is empty
      if ((data as any[]).length === 0) {
        try {
          const local = localStorage.getItem('control_archive_boxes');
          if (local) {
            const localBoxes: ArchiveBox[] = JSON.parse(local);
            if (localBoxes.length > 0) {
              for (const box of localBoxes) {
                await db.archiveBoxes.upsert(box);
              }
              showAlert(`✅ تم نقل ${localBoxes.length} صندوق من الجهاز إلى قاعدة البيانات`);
              setBoxes(localBoxes);
            }
          }
        } catch {}
      }
    } catch (e: any) {
      showAlert('فشل تحميل الصناديق: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Manual migrate button handler
  const handleMigrateFromLocal = async () => {
    try {
      const local = localStorage.getItem('control_archive_boxes');
      if (!local) { showAlert('لا توجد صناديق محلية للنقل', 'error'); return; }
      const localBoxes: ArchiveBox[] = JSON.parse(local);
      if (localBoxes.length === 0) { showAlert('لا توجد صناديق محلية للنقل', 'error'); return; }
      setSaving(true);
      for (const box of localBoxes) {
        await db.archiveBoxes.upsert(box);
      }
      await loadBoxes();
      showAlert(`✅ تم رفع ${localBoxes.length} صندوق إلى قاعدة البيانات بنجاح`);
    } catch (e: any) {
      showAlert('فشل النقل: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => { loadBoxes(); }, []);


  const handleAddBox = async () => {
    if (!form.box_number || !form.grade || !form.subject || !form.exam_date) {
      showAlert('يرجى تعبئة جميع الحقول المطلوبة', 'error');
      return;
    }
    setSaving(true);
    const box: ArchiveBox = {
      id: crypto.randomUUID(),
      box_number: form.box_number!,
      grade: form.grade!,
      subject: form.subject!,
      exam_date: form.exam_date!,
      committees: form.committees || [],
      created_at: new Date().toISOString(),
    };
    try {
      await db.archiveBoxes.upsert(box);
      setBoxes(prev => [box, ...prev]);
      setIsAdding(false);
      setForm({
        box_number: '',
        grade: '',
        subject: '',
        exam_date: new Date().toISOString().split('T')[0],
        committees: [],
      });
      showAlert('✅ تم حفظ الصندوق بنجاح');
    } catch (e: any) {
      showAlert('فشل الحفظ: ' + e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBox = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الصندوق؟')) return;
    try {
      await db.archiveBoxes.delete(id);
      setBoxes(prev => prev.filter(b => b.id !== id));
      if (selectedBox?.id === id) setSelectedBox(null);
      showAlert('تم حذف الصندوق');
    } catch (e: any) {
      showAlert('فشل الحذف: ' + e.message, 'error');
    }
  };

  const toggleCommittee = (c: string) => {
    const current = form.committees || [];
    if (current.includes(c)) {
      setForm({ ...form, committees: current.filter(x => x !== c) });
    } else {
      setForm({ ...form, committees: [...current, c].sort((a, b) => Number(a) - Number(b)) });
    }
  };

  const handleSelectAll = () => {
    setForm({ ...form, committees: [...availableCommittees] });
  };

  const handlePrintLabel = (box: ArchiveBox) => {
    const printWindow = window.open('', '', 'width=900,height=1100');
    if (!printWindow) return;

    const reportUrl = `${window.location.origin}/?box_report=${box.id}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(reportUrl)}&color=1e1b4b&bgcolor=f8f7ff`;
    const dateStr = new Date(box.exam_date).toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const LOGO = 'https://www.raed.net/img?id=1488645';

    const boxStudents = students.filter(s =>
      s.grade === box.grade && box.committees.some(c => eqCom(s.committee_number, c))
    );
    const totalStudents = boxStudents.length;
    const labelStats = getBoxStats(box);

    printWindow.document.write(`<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8"/>
  <title>ملصق الصندوق ${box.box_number}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet"/>
  <style>
    @page{size:A4 portrait;margin:10mm;}
    *{margin:0;padding:0;box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
    html{background:#fff;}
    body{
      font-family:'Cairo',sans-serif;
      background:#e5e7eb;
      display:flex; align-items:center; justify-content:center;
      min-height:100vh; padding:14mm;
    }
    .card{
      width:186mm;
      max-width:100%;
      min-height:265mm;
      background:#fff;
      border-radius:18px;
      overflow:hidden;
      box-shadow:0 25px 60px rgba(30,27,75,0.18);
      border:3px solid #1e1b4b;
      outline:1.5px solid #c7d2fe;
      outline-offset:-8px;
      display:flex;
      flex-direction:column;
    }

    /* ── HEADER ── */
    .hdr{
      background:linear-gradient(135deg,#1e1b4b 0%,#3730a3 50%,#4f46e5 100%);
      padding:18px 24px;
      display:flex; align-items:center; justify-content:space-between;
      position:relative; overflow:hidden;
    }
    .hdr::before{
      content:'';position:absolute;top:-40px;left:-40px;
      width:200px;height:200px;border-radius:50%;
      background:radial-gradient(circle,rgba(255,255,255,0.07),transparent);
    }
    .hdr-left{display:flex;align-items:center;gap:14px;}
    .logo-wrap{
      width:48px;height:48px;background:white;border-radius:14px;
      display:flex;align-items:center;justify-content:center;
      padding:4px; box-shadow:0 4px 12px rgba(0,0,0,0.2);
      flex-shrink:0;
    }
    .logo-wrap img{width:100%;height:100%;object-fit:contain;}
    .school-name{color:rgba(255,255,255,0.95);font-weight:900;font-size:13px;line-height:1.3;}
    .ministry{color:rgba(199,210,254,0.8);font-size:10px;font-weight:600;}
    .box-badge{
      background:rgba(255,255,255,0.15);
      border:1px solid rgba(255,255,255,0.2);
      border-radius:14px; padding:8px 16px; text-align:left;
    }
    .box-badge-label{color:rgba(199,210,254,0.7);font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;}
    .box-badge-num{color:white;font-size:22px;font-weight:900;line-height:1.2;}

    /* ── BIG NUMBER ── */
    .big-num-section{
      text-align:center;
      padding:22px 24px 12px;
      border-bottom:2px dashed #e0e7ff;
    }
    .big-num-label{font-size:12px;color:#94a3b8;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;}
    .big-num{
      font-size:76px;font-weight:900;line-height:1;
      color:#1e1b4b;letter-spacing:-3px;
      background:linear-gradient(135deg,#1e1b4b,#4338ca);
      -webkit-background-clip:text;-webkit-text-fill-color:transparent;
      background-clip:text;
    }

    /* ── INFO GRID ── */
    .info-grid{
      display:grid;grid-template-columns:1fr 1fr;gap:12px;
      padding:16px 24px 0;
    }
    .info-card{
      background:#f8faff;border:1.5px solid #e0e7ff;border-radius:14px;
      padding:11px 14px;
    }
    .info-card.full{grid-column:span 2;}
    .info-label{font-size:10px;color:#94a3b8;font-weight:700;margin-bottom:4px;letter-spacing:0.5px;}
    .info-value{font-size:15px;font-weight:900;color:#1e1b4b;}

    /* ── STATS ── */
    .stats-section{padding:16px 24px 0;}
    .stats-title{font-size:11px;color:#6366f1;font-weight:700;letter-spacing:1px;margin-bottom:10px;text-align:center;}
    .stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;}
    .stat-card{border-radius:14px;padding:10px 8px;text-align:center;}
    .stat-card.blue  {background:#eff6ff;border:1.5px solid #bfdbfe;}
    .stat-card.green {background:#f0fdf4;border:1.5px solid #bbf7d0;}
    .stat-card.red   {background:#fef2f2;border:1.5px solid #fecaca;}
    .stat-card.amber {background:#fffbeb;border:1.5px solid #fde68a;}
    .stat-num{font-size:26px;font-weight:900;line-height:1;}
    .stat-num.blue  {color:#1d4ed8;}
    .stat-num.green {color:#16a34a;}
    .stat-num.red   {color:#dc2626;}
    .stat-num.amber {color:#d97706;}
    .stat-lbl{font-size:10px;font-weight:700;color:#64748b;margin-top:3px;}

    /* ── ATTENDANCE BAR ── */
    .att-bar-wrap{padding:0 24px;margin-top:12px;}
    .att-bar-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;}
    .att-bar-label{font-size:11px;color:#64748b;font-weight:700;}
    .att-bar-pct{font-size:13px;font-weight:900;color:#4338ca;}
    .att-bar-bg{height:8px;background:#e0e7ff;border-radius:99px;overflow:hidden;}
    .att-bar-fill{height:100%;border-radius:99px;}
    .att-note{font-size:10px;color:#94a3b8;font-weight:600;margin-top:4px;text-align:left;}

    /* ── COMMITTEES ── */
    .committees{
      margin:14px 24px 0;
      background:linear-gradient(135deg,#4338ca,#7c3aed);
      border-radius:14px;padding:12px 18px;
      color:white;font-weight:900;font-size:14px;text-align:center;
      line-height:1.6;
    }

    /* ── QR SECTION ── */
    .qr-section{
      display:flex;flex-direction:column;align-items:center;
      padding:18px 24px 20px; margin-top:14px;
      border-top:2px dashed #e0e7ff;
      flex:1;
      justify-content:center;
    }
    .qr-wrap{
      width:44mm;height:44mm;background:#f8f7ff;
      border:2px solid #e0e7ff;border-radius:20px;
      padding:10px;display:flex;align-items:center;justify-content:center;
    }
    .qr-wrap img{width:100%;height:100%;object-fit:contain;border-radius:8px;}
    .qr-hint{font-size:11px;color:#94a3b8;font-weight:600;margin-top:10px;text-align:center;}
    .qr-url{font-size:9px;color:#cbd5e1;margin-top:3px;font-family:monospace;word-break:break-all;text-align:center;max-width:300px;}

    /* ── FOOTER ── */
    .footer-bar{
      background:#f8faff;border-top:1px solid #e0e7ff;
      padding:10px 28px;display:flex;align-items:center;justify-content:center;gap:8px;
      margin-top:auto;
    }
    .footer-bar img{width:20px;height:20px;object-fit:contain;opacity:0.4;}
    .footer-txt{font-size:10px;color:#94a3b8;font-weight:600;}

    @media print{
      html,body{width:210mm;min-height:297mm;background:white;padding:0;}
      body{align-items:flex-start;justify-content:center;}
      .card{
        width:186mm;
        min-height:275mm;
        box-shadow:none;
        border:3px solid #1e1b4b !important;
        outline:1.5px solid #c7d2fe !important;
        outline-offset:-8px;
        break-inside:avoid;
        page-break-inside:avoid;
      }
    }
  </style>
</head>
<body>
  <div class="card">
    <!-- HEADER -->
    <div class="hdr">
      <div class="hdr-left">
        <div class="logo-wrap"><img src="${LOGO}" alt="شعار"/></div>
        <div>
          <div class="ministry">وزارة التعليم — المملكة العربية السعودية</div>
          <div class="school-name">مدرسة عماد الدين زنكي المتوسطة</div>
        </div>
      </div>
      <div class="box-badge">
        <div class="box-badge-label">صندوق</div>
        <div class="box-badge-num">${box.box_number}</div>
      </div>
    </div>

    <!-- BIG NUMBER -->
    <div class="big-num-section">
      <div class="big-num-label">رقم الصندوق</div>
      <div class="big-num">${box.box_number}</div>
    </div>

    <!-- INFO GRID -->
    <div class="info-grid">
      <div class="info-card"><div class="info-label">📚 المادة</div><div class="info-value">${box.subject}</div></div>
      <div class="info-card"><div class="info-label">🎓 الصف الدراسي</div><div class="info-value">${box.grade}</div></div>
      <div class="info-card full"><div class="info-label">📅 تاريخ الاختبار</div><div class="info-value">${dateStr}</div></div>
    </div>

    <!-- STATS -->
    <div class="stats-section">
      <div class="stats-title">📊 إحصائيات الصف — جميع اللجان في الصندوق</div>
      <div class="stats-grid" id="stats-grid">
        <div class="stat-card blue"><div class="stat-num blue" id="s-total">${totalStudents}</div><div class="stat-lbl">إجمالي الطلاب</div></div>
        <div class="stat-card green"><div class="stat-num green" id="s-present">${labelStats.present}</div><div class="stat-lbl">إجمالي الحضور</div></div>
        <div class="stat-card red"><div class="stat-num red" id="s-absent">${labelStats.absent}</div><div class="stat-lbl">إجمالي الغياب</div></div>
        <div class="stat-card amber"><div class="stat-num amber" id="s-late">${labelStats.late}</div><div class="stat-lbl">التأخير (من الحضور)</div></div>
      </div>
    </div>

    <!-- ATTENDANCE BAR -->
    <div class="att-bar-wrap">
      <div class="att-bar-row">
        <span class="att-bar-label">نسبة الحضور</span>
        <span class="att-bar-pct" id="s-pct">${labelStats.rate}%</span>
      </div>
      <div class="att-bar-bg"><div class="att-bar-fill" id="att-fill" style="width:${labelStats.rate}%;background:linear-gradient(90deg,#16a34a,#4ade80)"></div></div>
      <div class="att-note">* التأخير محسوب ضمن الحضور</div>
    </div>

    <!-- COMMITTEES -->
    <div class="committees">
      اللجان داخل الصندوق: ${box.committees.length ? box.committees.join(' ، ') : 'لا يوجد'}
    </div>

    <!-- QR -->
    <div class="qr-section">
      <div class="qr-wrap">
        <img src="${qrUrl}" alt="QR Code" onload="setTimeout(()=>{window.print();},600);"/>
      </div>
      <div class="qr-hint">امسح رمز QR للاطلاع على التقرير الكامل</div>
      <div class="qr-url">${reportUrl}</div>
    </div>

    <!-- FOOTER -->
    <div class="footer-bar">
      <img src="${LOGO}" alt=""/>
      <span class="footer-txt">نظام الكنترول الرقمي — مدرسة عماد الدين زنكي المتوسطة</span>
    </div>
  </div>

</body>
</html>`);
    printWindow.document.close();
  };


  const filteredBoxes = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return boxes;
    return boxes.filter(b =>
      b.box_number.toLowerCase().includes(q) ||
      b.grade.toLowerCase().includes(q) ||
      b.subject.toLowerCase().includes(q) ||
      b.exam_date.includes(q)
    );
  }, [boxes, searchTerm]);

  return (
    <div className="space-y-8 animate-fade-in text-right">
      {/* Alert */}
      {alert && (
        <div className={`fixed top-6 right-6 z-[9999] px-8 py-4 rounded-2xl font-black text-white shadow-2xl animate-fade-in ${alert.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {alert.msg}
        </div>
      )}

      {/* Header */}
      <div className="bg-slate-950 p-10 rounded-[3.5rem] shadow-2xl relative overflow-hidden text-white flex flex-col md:flex-row items-center justify-between gap-6 border-b-8 border-indigo-500">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 blur-[100px] rounded-full" />
        <div className="flex items-center gap-6 relative z-10">
          <div className="bg-indigo-500 p-5 rounded-3xl shadow-xl"><PackageSearch size={40} /></div>
          <div>
            <h2 className="text-4xl font-black tracking-tighter">أرشيف الصناديق</h2>
            <p className="text-indigo-200 font-bold mt-1">نظام إدارة أوراق الاختبارات الميدانية والصناديق</p>
          </div>
        </div>
        <div className="flex items-center gap-4 relative z-10">
          <button onClick={loadBoxes} className="p-4 bg-white/10 hover:bg-white/20 rounded-2xl transition-all" title="تحديث">
            <RefreshCw size={22} />
          </button>
          <button onClick={handleMigrateFromLocal} className="p-4 bg-amber-500/20 hover:bg-amber-500/40 rounded-2xl transition-all text-amber-200 font-bold text-sm flex items-center gap-2" title="نقل البيانات القديمة من هذا الجهاز إلى قاعدة البيانات">
            <Archive size={20} /> رفع القديم
          </button>
          <button onClick={() => setIsAdding(true)} className="bg-white text-slate-950 px-8 py-4 rounded-[2rem] font-black flex items-center gap-3 hover:bg-indigo-50 transition-all shadow-xl active:scale-95">
            <Plus size={24} /> إضافة صندوق جديد
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'إجمالي الصناديق', value: boxes.length, color: 'indigo' },
          { label: 'عدد المواد', value: new Set(boxes.map(b => b.subject)).size, color: 'violet' },
          { label: 'عدد الصفوف', value: new Set(boxes.map(b => b.grade)).size, color: 'blue' },
          { label: 'إجمالي اللجان المؤرشفة', value: boxes.reduce((s, b) => s + b.committees.length, 0), color: 'emerald' },
        ].map(stat => (
          <div key={stat.label} className={`bg-white rounded-3xl p-6 shadow-lg border border-slate-100 text-center`}>
            <div className={`text-4xl font-black text-${stat.color}-600 mb-1`}>{stat.value}</div>
            <div className="text-sm font-bold text-slate-500">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-col xl:flex-row gap-8">
        {/* Left: List */}
        <div className="flex-1 space-y-6">
          {/* Search */}
          <div className="bg-white p-4 rounded-[2.5rem] shadow-xl border border-slate-100 relative">
            <Search size={22} className="absolute right-10 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="ابحث برقم الصندوق، المادة، الصف، أو التاريخ..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-6 pr-16 py-4 bg-slate-50 border-2 border-slate-100 rounded-[2rem] font-black text-lg outline-none focus:border-indigo-500 transition-all"
            />
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-indigo-400">
              <RefreshCw size={40} className="animate-spin mb-4" />
              <p className="font-black text-lg">جاري تحميل الصناديق...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredBoxes.map(box => (
                <div
                  key={box.id}
                  onClick={() => setSelectedBox(box)}
                  className={`bg-white rounded-[2.5rem] p-6 border-2 transition-all cursor-pointer shadow-xl hover:shadow-2xl hover:-translate-y-1 ${selectedBox?.id === box.id ? 'border-indigo-500 shadow-indigo-100' : 'border-slate-100 hover:border-indigo-300'}`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="bg-slate-950 text-white w-16 h-16 rounded-2xl flex items-center justify-center font-black text-xl shadow-lg">
                      {box.box_number}
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); handlePrintLabel(box); }}
                      className="p-3 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-xl transition-all"
                      title="طباعة ملصق"
                    >
                      <Printer size={20} />
                    </button>
                  </div>
                  <h3 className="text-xl font-black text-slate-900 mb-2 truncate">{box.subject}</h3>
                  <div className="space-y-1.5 mb-4">
                    <p className="text-sm font-bold text-slate-600 flex items-center gap-2"><Layers size={15} className="text-indigo-400" /> {box.grade}</p>
                    <p className="text-sm font-bold text-slate-600 flex items-center gap-2">
                      <Calendar size={15} className="text-indigo-400" />
                      {new Date(box.exam_date).toLocaleDateString('ar-SA', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  <div className="pt-3 border-t border-slate-100 flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-black text-slate-400 uppercase">اللجان:</span>
                    {box.committees.slice(0, 6).map(c => (
                      <span key={c} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-black">{c}</span>
                    ))}
                    {box.committees.length > 6 && <span className="text-xs text-slate-400 font-bold">+{box.committees.length - 6}</span>}
                    {box.committees.length === 0 && <span className="text-xs text-slate-400 font-bold">غير محدد</span>}
                  </div>
                </div>
              ))}
              {filteredBoxes.length === 0 && (
                <div className="col-span-full py-20 text-center text-slate-400 font-black">
                  <Archive size={64} className="mx-auto mb-4 opacity-20" />
                  <p className="text-xl">لا توجد صناديق مسجلة بعد.</p>
                  <p className="text-sm font-bold mt-2 opacity-60">اضغط على "إضافة صندوق جديد" لبدء الأرشفة</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Detail panel */}
        {selectedBox && (() => {
          const selectedStats = getBoxStats(selectedBox);
          const selectedProctors = getBoxProctorNames(selectedBox);
          return (
          <div className="w-full xl:w-[420px] shrink-0">
            <div className="bg-white rounded-[3rem] shadow-2xl border border-slate-100 overflow-hidden sticky top-8">
              <div className="bg-indigo-600 p-8 text-white relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
                <div className="flex justify-between items-start relative z-10">
                  <div>
                    <span className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-3 inline-block">تفاصيل الصندوق</span>
                    <h3 className="text-3xl font-black">صندوق {selectedBox.box_number}</h3>
                    <p className="text-indigo-200 font-bold mt-1 text-sm">{selectedBox.subject} — {selectedBox.grade}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handlePrintLabel(selectedBox)} className="p-3 bg-white/20 hover:bg-white/30 rounded-xl transition-all" title="طباعة"><Printer size={18} /></button>
                    <button onClick={() => handleDeleteBox(selectedBox.id)} className="p-3 bg-red-500/20 hover:bg-red-500 rounded-xl transition-all"><Trash2 size={18} /></button>
                    <button onClick={() => setSelectedBox(null)} className="p-3 bg-white/20 hover:bg-white/30 rounded-xl transition-all"><X size={18} /></button>
                  </div>
                </div>
              </div>

              <div className="p-8">
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-indigo-50 rounded-2xl p-4 text-center">
                    <div className="text-3xl font-black text-indigo-700">{boxStudents.length}</div>
                    <div className="text-xs font-bold text-indigo-500 mt-1">عدد الطلاب</div>
                  </div>
                  <div className="bg-slate-50 rounded-2xl p-4 text-center">
                    <div className="text-3xl font-black text-slate-800">{selectedBox.committees.length}</div>
                    <div className="text-xs font-bold text-slate-500 mt-1">عدد اللجان</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-6">
                  <div className="bg-emerald-50 rounded-2xl p-3 text-center border border-emerald-100">
                    <div className="text-2xl font-black text-emerald-700">{selectedStats.present}</div>
                    <div className="text-[10px] font-black text-emerald-500 mt-1">الحضور</div>
                  </div>
                  <div className="bg-red-50 rounded-2xl p-3 text-center border border-red-100">
                    <div className="text-2xl font-black text-red-600">{selectedStats.absent}</div>
                    <div className="text-[10px] font-black text-red-400 mt-1">الغياب</div>
                  </div>
                  <div className="bg-amber-50 rounded-2xl p-3 text-center border border-amber-100">
                    <div className="text-2xl font-black text-amber-600">{selectedStats.late}</div>
                    <div className="text-[10px] font-black text-amber-500 mt-1">التأخير</div>
                  </div>
                </div>

                <div className="mb-4 pb-4 border-b border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 mb-2">المراقبون المرتبطون بالصندوق</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedProctors.map(name => (
                      <span key={name} className="px-3 py-1.5 bg-slate-100 text-slate-800 rounded-xl text-xs font-black">{name}</span>
                    ))}
                    {selectedProctors.length === 0 && <span className="text-sm text-slate-400 font-bold">لا توجد تكليفات مراقبين مرتبطة بتاريخ الصندوق.</span>}
                  </div>
                </div>

                <div className="mb-4 pb-4 border-b border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 mb-2">اللجان داخل الصندوق</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedBox.committees.map(c => (
                      <span key={c} className="px-3 py-1.5 bg-indigo-100 text-indigo-800 rounded-xl text-sm font-black">لجنة {c}</span>
                    ))}
                    {selectedBox.committees.length === 0 && <span className="text-sm text-slate-400 font-bold">لا توجد لجان</span>}
                  </div>
                </div>

                <h4 className="font-black text-slate-900 flex items-center gap-2 mb-3">
                  <UserCircle size={18} className="text-indigo-500" /> أسماء الطلاب داخل الصندوق
                </h4>
                <div className="max-h-[350px] overflow-y-auto space-y-2 pr-1">
                  {boxStudents.map(student => (
                    <div key={student.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100 hover:bg-indigo-50 hover:border-indigo-100 transition-colors">
                      <span className="font-black text-sm text-slate-800">{student.name}</span>
                      <span className="text-[10px] font-black text-white bg-indigo-700 px-2 py-1 rounded-lg">لجنة {student.committee_number}</span>
                    </div>
                  ))}
                  {boxStudents.length === 0 && (
                    <p className="text-center text-slate-400 font-bold py-6 text-sm">لم يُعثر على طلاب للجان المحددة.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
          );
        })()}
      </div>

      {/* Add Box Modal */}
      {isAdding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[3rem] p-8 md:p-12 w-full max-w-2xl shadow-2xl relative animate-slide-up border-b-[12px] border-indigo-600 max-h-[90vh] overflow-y-auto">
            <button onClick={() => setIsAdding(false)} className="absolute top-6 left-6 p-3 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-full transition-all">
              <X size={24} />
            </button>

            <h3 className="text-3xl font-black text-slate-900 mb-8 flex items-center gap-3">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><Plus size={28} /></div>
              تسجيل صندوق جديد
            </h3>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Box number */}
                <div>
                  <label className="block text-sm font-black text-slate-700 mb-2">رقم الصندوق / الكود *</label>
                  <input
                    type="text"
                    value={form.box_number}
                    onChange={e => setForm({ ...form, box_number: e.target.value })}
                    className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-black focus:border-indigo-500 outline-none transition-all"
                    placeholder="مثال: A-1"
                  />
                </div>

                {/* Date */}
                <div>
                  <label className="block text-sm font-black text-slate-700 mb-2">تاريخ الاختبار *</label>
                  {examDates.length > 0 ? (
                    <select
                      value={form.exam_date}
                      onChange={e => setForm({ ...form, exam_date: e.target.value, subject: '', committees: [] })}
                      className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-black focus:border-indigo-500 outline-none"
                    >
                      <option value="">اختر التاريخ...</option>
                      {examDates.map(d => (
                        <option key={d} value={d}>{new Date(d).toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="date"
                      value={form.exam_date}
                      onChange={e => setForm({ ...form, exam_date: e.target.value, subject: '', committees: [] })}
                      className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-black focus:border-indigo-500 outline-none"
                    />
                  )}
                </div>

                {/* Subject */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-black text-slate-700 mb-2">اسم المادة *</label>
                  {subjectsOnDate.length > 0 ? (
                    <div className="flex flex-wrap gap-3">
                      {subjectsOnDate.map(e => (
                        <button
                          key={e.id}
                          onClick={() => setForm({ ...form, subject: e.subject })}
                          className={`px-5 py-3 rounded-2xl font-black text-sm transition-all border-2 ${form.subject === e.subject ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}
                        >
                          {e.subject}
                          {e.grades && e.grades.length > 0 && <span className="mr-2 text-[10px] opacity-70">({e.grades.join(', ')})</span>}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={form.subject}
                      onChange={e => setForm({ ...form, subject: e.target.value })}
                      className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-black focus:border-indigo-500 outline-none"
                      placeholder="أدخل اسم المادة يدوياً..."
                    />
                  )}
                </div>

                {/* Grade */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-black text-slate-700 mb-2">الصف الدراسي *</label>
                  <div className="flex flex-wrap gap-3">
                    {allGrades.map(g => (
                      <button
                        key={g}
                        onClick={() => setForm({ ...form, grade: g, committees: [] })}
                        className={`px-5 py-3 rounded-2xl font-black text-sm transition-all border-2 ${form.grade === g ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}
                      >
                        {g}
                      </button>
                    ))}
                    {allGrades.length === 0 && <p className="text-sm text-slate-400 font-bold">لا توجد صفوف دراسية مسجلة في بيانات الطلاب.</p>}
                  </div>
                </div>
              </div>

              {/* Committees */}
              {form.grade && (
                <div className="border-t border-slate-100 pt-6 animate-fade-in">
                  <div className="flex justify-between items-center mb-4">
                    <label className="text-sm font-black text-slate-700">
                      اللجان التابعة للصف ({form.grade}) الموجودة بالصندوق:
                    </label>
                    <button
                      onClick={handleSelectAll}
                      className="text-xs font-black text-indigo-600 hover:underline flex items-center gap-1"
                    >
                      <CheckSquare size={14} /> تحديد الكل
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {availableCommittees.map(c => {
                      const isSelected = form.committees?.includes(c);
                      return (
                        <button
                          key={c}
                          onClick={() => toggleCommittee(c)}
                          className={`px-5 py-3 rounded-2xl font-black text-sm transition-all border-2 flex items-center gap-2 ${isSelected ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}
                        >
                          {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                          لجنة {c}
                        </button>
                      );
                    })}
                    {availableCommittees.length === 0 && (
                      <p className="text-sm font-bold text-red-400">⚠️ لا توجد لجان مسجلة لهذا الصف في بيانات الطلاب.</p>
                    )}
                  </div>
                </div>
              )}

              <button
                onClick={handleAddBox}
                disabled={saving || !form.box_number || !form.grade || !form.subject || !form.exam_date}
                className="w-full py-5 rounded-[2rem] bg-indigo-600 text-white font-black text-xl flex items-center justify-center gap-3 shadow-xl hover:bg-indigo-700 disabled:opacity-50 transition-all mt-4 active:scale-95"
              >
                {saving ? <RefreshCw size={24} className="animate-spin" /> : <Save size={24} />}
                {saving ? 'جاري الحفظ...' : 'حفظ بيانات الصندوق'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
