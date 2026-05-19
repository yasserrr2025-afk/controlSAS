
import React, { useState, useMemo } from 'react';
import { Student } from '../../types';
import { parseExcel } from '../../services/excelService';
import {
  Upload, Phone, Search, Hash, AlertTriangle, Edit2, Trash2,
  UserPlus, X, Download, FileSpreadsheet, Users, CheckCircle2,
  Smartphone, ChevronDown, Table
} from 'lucide-react';

interface Props {
  students: Student[];
  setStudents: any;
  onAlert: any;
  onDeleteStudent: (id: string) => void;
}

/* ── تنزيل ملف Excel من الصفر (بدون مكتبة خارجية) ── */
function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const BOM = '\uFEFF'; // لدعم العربية في Excel
  const csv = BOM + [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function downloadStudentsTemplate() {
  downloadCSV('قالب_بيانات_الطلاب.csv',
    ['رقم الهوية', 'الاسم', 'الصف', 'الفصل', 'رقم اللجنة', 'رقم الجلوس'],
    [
      ['1234567890', 'محمد أحمد العمري', 'الأول المتوسط', '1', '1', '101'],
      ['0987654321', 'عبدالله سعد القحطاني', 'الثاني المتوسط', '2', '2', '205'],
    ]
  );
}

function downloadPhonesTemplate() {
  downloadCSV('قالب_أرقام_الجوالات.csv',
    ['رقم الهوية', 'الاسم', 'الجوال'],
    [
      ['1234567890', 'محمد أحمد العمري', '0501234567'],
      ['0987654321', 'عبدالله سعد القحطاني', '0559876543'],
    ]
  );
}

const AdminStudentsManager: React.FC<Props> = ({ students, setStudents, onAlert, onDeleteStudent }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isMerging, setIsMerging] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [gradeFilter, setGradeFilter] = useState('');

  const [formData, setFormData] = useState<Partial<Student>>({
    national_id: '', name: '', grade: '', section: '',
    committee_number: '', seating_number: '', parent_phone: ''
  });

  const normalizeText = (text: string) => {
    if (!text) return '';
    return text.trim().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ');
  };

  const grades = useMemo(() => [...new Set(students.map(s => s.grade))].filter(Boolean).sort(), [students]);

  const filtered = useMemo(() => students.filter(s => {
    const matchSearch = !searchTerm || s.name.includes(searchTerm) || s.national_id.includes(searchTerm);
    const matchGrade = !gradeFilter || s.grade === gradeFilter;
    return matchSearch && matchGrade;
  }), [students, searchTerm, gradeFilter]);

  const openModal = (student: Student | null = null) => {
    if (student) { setEditingStudent(student); setFormData(student); }
    else { setEditingStudent(null); setFormData({ national_id: '', name: '', grade: '', section: '', committee_number: '', seating_number: '', parent_phone: '' }); }
    setIsModalOpen(true);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.national_id || !formData.name) { onAlert('يرجى إكمال البيانات الأساسية', 'warning'); return; }
    const studentData: Student = {
      id: editingStudent?.id || crypto.randomUUID(),
      national_id: formData.national_id!, name: formData.name!, grade: formData.grade || '',
      section: formData.section || '', committee_number: formData.committee_number || '',
      seating_number: formData.seating_number || '', parent_phone: formData.parent_phone || ''
    };
    setStudents((prev: Student[]) => editingStudent ? prev.map(s => s.id === editingStudent.id ? studentData : s) : [...prev, studentData]);
    onAlert(editingStudent ? 'تم تحديث بيانات الطالب' : 'تمت إضافة الطالب بنجاح', 'success');
    setIsModalOpen(false);
  };

  const handlePrimaryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const data = await parseExcel(file);
        const newStudents: Student[] = data.map((row: any) => {
          const nId = String(row['رقم الهوية'] || row['الهوية'] || row['السجل المدني'] || '').trim();
          const existingStudent = students.find(s => s.national_id === nId);
          return {
            id: existingStudent?.id || crypto.randomUUID(),
            national_id: nId,
            name: String(row['الاسم'] || row['اسم الطالب'] || '').trim(),
            grade: String(row['الصف'] || row['المرحلة'] || ''),
            section: String(row['الفصل'] || row['الشعبة'] || ''),
            committee_number: String(row['اللجنة'] || row['رقم اللجنة'] || ''),
            seating_number: String(row['رقم الجلوس'] || row['رقم جلوس'] || row['جلوس'] || '').trim(),
            parent_phone: existingStudent?.parent_phone || '',
          };
        });
        setStudents(newStudents);
        onAlert(`✅ تم تحديث بيانات ${newStudents.length} طالب بنجاح.`, 'success');
      } catch (err: any) { onAlert(err.message || 'خطأ في قراءة الملف', 'error'); }
    }
    e.target.value = '';
  };

  const handlePhoneMerge = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (students.length === 0) { onAlert('يرجى رفع كشوف اللجان أولاً', 'warning'); return; }
    setIsMerging(true);
    try {
      const phoneData = await parseExcel(file);
      let matchCount = 0;
      const updated = students.map((s: Student) => {
        const sId = s.national_id.replace(/\D/g, '');
        const sNameNorm = normalizeText(s.name);
        const match = phoneData.find((p: any) => {
          const pId = String(p['رقم الهوية'] || p['الهوية'] || p['السجل المدني'] || '').replace(/\D/g, '');
          const pName = normalizeText(String(p['الاسم'] || p['اسم الطالب'] || ''));
          return (sId !== '' && pId === sId) || (sNameNorm.split(' ').length >= 2 && pName === sNameNorm);
        });
        if (match) {
          matchCount++;
          const phone = String(match['الجوال'] || match['رقم جوال'] || match['رقم الجوال'] || match['جوال ولي الامر'] || '').trim();
          return { ...s, parent_phone: phone };
        }
        return s;
      });
      setStudents(updated);
      onAlert(`✅ اكتمل الدمج! تم ربط ${matchCount} رقم جوال بنجاح.`, 'success');
    } catch (err: any) { onAlert(err.message || 'خطأ في الدمج', 'error'); } finally { setIsMerging(false); }
    e.target.value = '';
  };

  const withPhone = students.filter(s => s.parent_phone).length;
  const withSeating = students.filter(s => s.seating_number).length;

  return (
    <div className="space-y-8 animate-fade-in text-right pb-24" dir="rtl">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">إدارة بيانات الطلاب</h2>
          <p className="text-slate-400 font-bold text-sm mt-1">رفع الكشوف ودمج أرقام الجوالات</p>
        </div>
        <button onClick={() => openModal()} className="bg-blue-600 text-white px-6 py-3.5 rounded-2xl flex items-center gap-2 shadow-lg hover:bg-blue-700 transition-all font-black text-sm">
          <UserPlus size={18} /> إضافة يدوية
        </button>
      </div>

      {/* ── بطاقات الإحصائيات ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'إجمالي الطلاب', value: students.length, color: 'from-blue-600 to-blue-700', icon: Users },
          { label: 'برقم جلوس', value: withSeating, color: 'from-indigo-500 to-indigo-700', icon: Hash },
          { label: 'برقم جوال', value: withPhone, color: 'from-emerald-500 to-emerald-700', icon: Smartphone },
          { label: 'بدون جوال', value: students.length - withPhone, color: 'from-amber-500 to-orange-600', icon: AlertTriangle },
        ].map(stat => (
          <div key={stat.label} className={`bg-gradient-to-br ${stat.color} text-white p-5 rounded-3xl shadow-lg`}>
            <stat.icon size={24} className="opacity-70 mb-2" />
            <p className="text-4xl font-black tabular-nums">{stat.value}</p>
            <p className="text-[10px] font-black uppercase tracking-wider opacity-70 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* ── قسم الرفع والقوالب ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* رفع بيانات الطلاب */}
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-lg p-7 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-slate-900 rounded-2xl flex items-center justify-center shrink-0">
              <FileSpreadsheet size={20} className="text-white" />
            </div>
            <div>
              <h3 className="font-black text-slate-800 text-base">كشف بيانات الطلاب</h3>
              <p className="text-slate-400 text-[11px] font-bold">رقم هوية · اسم · صف · فصل · لجنة · جلوس</p>
            </div>
          </div>

          {/* تحذير */}
          <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 flex items-start gap-3">
            <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-[11px] font-bold text-amber-700 leading-relaxed">
              الرفع الجديد سيُحدّث الكشوف ويحذف الطلاب غير الموجودين في الملف.
            </p>
          </div>

          <div className="flex gap-3">
            <label className="flex-1 bg-slate-900 text-white py-3.5 px-5 rounded-2xl cursor-pointer flex items-center justify-center gap-2 font-black text-sm hover:bg-black transition-all shadow-lg">
              <Upload size={16} /> رفع الكشف
              <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handlePrimaryUpload} />
            </label>
            <button
              onClick={downloadStudentsTemplate}
              className="bg-slate-50 border border-slate-200 text-slate-600 py-3.5 px-4 rounded-2xl flex items-center gap-2 text-sm font-black hover:bg-slate-100 transition-all"
              title="تنزيل قالب Excel"
            >
              <Download size={16} />
              <span className="hidden md:inline">قالب</span>
            </button>
          </div>
        </div>

        {/* دمج أرقام الجوالات */}
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-lg p-7 space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-emerald-600 rounded-2xl flex items-center justify-center shrink-0">
              <Phone size={20} className="text-white" />
            </div>
            <div>
              <h3 className="font-black text-slate-800 text-base">دمج أرقام الجوالات</h3>
              <p className="text-slate-400 text-[11px] font-bold">مطابقة يتم عبر رقم الهوية أو الاسم</p>
            </div>
          </div>

          {/* تقدم الدمج */}
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[11px] font-black text-emerald-700">نسبة التغطية</span>
              <span className="text-[11px] font-black text-emerald-700">
                {students.length > 0 ? Math.round(withPhone / students.length * 100) : 0}%
              </span>
            </div>
            <div className="h-2 bg-emerald-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                style={{ width: students.length > 0 ? `${(withPhone / students.length) * 100}%` : '0%' }}
              />
            </div>
            <p className="text-[10px] text-emerald-600 font-bold mt-1">
              {withPhone} من {students.length} طالب لديهم رقم جوال
            </p>
          </div>

          <div className="flex gap-3">
            <label className={`flex-1 text-white py-3.5 px-5 rounded-2xl cursor-pointer flex items-center justify-center gap-2 font-black text-sm transition-all shadow-lg ${isMerging ? 'bg-emerald-400 animate-pulse cursor-wait' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
              {isMerging ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> جاري الدمج...</> : <><Smartphone size={16} /> رفع ملف الجوالات</>}
              <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handlePhoneMerge} disabled={isMerging} />
            </label>
            <button
              onClick={downloadPhonesTemplate}
              className="bg-slate-50 border border-slate-200 text-slate-600 py-3.5 px-4 rounded-2xl flex items-center gap-2 text-sm font-black hover:bg-slate-100 transition-all"
              title="تنزيل قالب الجوالات"
            >
              <Download size={16} />
              <span className="hidden md:inline">قالب</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── الجدول ── */}
      <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
        {/* رأس الجدول */}
        <div className="p-6 border-b bg-slate-50 flex flex-col md:flex-row items-center gap-4">
          {/* بحث */}
          <div className="relative flex-1 w-full">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="بحث بالاسم أو رقم الهوية..."
              className="w-full pr-11 py-3 bg-white border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-blue-500 transition-colors text-sm"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          {/* فلتر الصف */}
          <div className="relative">
            <select
              value={gradeFilter}
              onChange={e => setGradeFilter(e.target.value)}
              className="appearance-none bg-white border-2 border-slate-100 rounded-2xl px-4 py-3 pr-10 font-bold text-sm text-slate-700 outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="">كل الصفوف</option>
              {grades.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <ChevronDown size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
          <div className="text-slate-400 font-black text-sm whitespace-nowrap">
            {filtered.length} طالب
          </div>
        </div>

        {/* الجدول */}
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-slate-50 border-b">
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {['الطالب', 'الصف / الفصل', 'رقم الجلوس', 'اللجنة', 'رقم الجوال', ''].map(h => (
                  <th key={h} className="px-6 py-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-24 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Table size={48} className="text-slate-200" />
                      <p className="text-slate-300 font-black text-lg">لا يوجد طلاب</p>
                      <p className="text-slate-300 text-sm font-bold">ارفع كشف بيانات الطلاب أو غيّر معايير البحث</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="px-6 py-4">
                      <p className="font-black text-slate-800 text-sm">{s.name}</p>
                      <p className="text-[10px] font-mono text-slate-400 mt-0.5">{s.national_id}</p>
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-bold text-sm">{s.grade} · {s.section}</td>
                    <td className="px-6 py-4">
                      {s.seating_number ? (
                        <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1 rounded-xl text-xs font-black border border-blue-100">
                          <Hash size={11} /> {s.seating_number}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-[10px] italic">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-black text-slate-600 text-sm">لجنة {s.committee_number}</td>
                    <td className="px-6 py-4">
                      {s.parent_phone ? (
                        <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-xl text-xs font-bold border border-emerald-100">
                          <CheckCircle2 size={11} /> {s.parent_phone}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 bg-red-50 text-red-400 px-3 py-1 rounded-xl text-[10px] font-bold border border-red-100">
                          <Phone size={10} /> بانتظار الدمج
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openModal(s)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-xl transition-all"><Edit2 size={16} /></button>
                        <button onClick={() => onDeleteStudent(s.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal إضافة/تعديل ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden animate-slide-up">
            {/* رأس النافذة */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-7 text-white flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black">{editingStudent ? 'تعديل بيانات الطالب' : 'إضافة طالب جديد'}</h3>
                <p className="text-slate-400 text-xs font-bold mt-1">أدخل جميع البيانات المطلوبة</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-2xl transition-all"><X size={22} /></button>
            </div>
            {/* النموذج */}
            <form onSubmit={handleManualSubmit} className="p-7 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { label: 'رقم الهوية *', key: 'national_id', mode: 'numeric' as const, required: true },
                  { label: 'اسم الطالب كاملاً *', key: 'name', mode: 'text' as const, required: true },
                  { label: 'الصف', key: 'grade', mode: 'text' as const },
                  { label: 'الفصل', key: 'section', mode: 'text' as const },
                  { label: 'رقم اللجنة', key: 'committee_number', mode: 'numeric' as const },
                  { label: 'رقم الجلوس', key: 'seating_number', mode: 'numeric' as const },
                ].map(field => (
                  <div key={field.key} className="space-y-1.5">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider">{field.label}</label>
                    <input
                      type="text"
                      inputMode={field.mode}
                      value={(formData as any)[field.key] ?? ''}
                      onChange={e => setFormData({ ...formData, [field.key]: e.target.value })}
                      required={field.required}
                      className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-sm outline-none focus:border-blue-500 focus:bg-white transition-all"
                    />
                  </div>
                ))}
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider">جوال ولي الأمر</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formData.parent_phone ?? ''}
                    onChange={e => setFormData({ ...formData, parent_phone: e.target.value })}
                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-sm outline-none focus:border-blue-500 focus:bg-white transition-all"
                    placeholder="05xxxxxxxx"
                  />
                </div>
              </div>
              <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-[1.5rem] font-black text-base shadow-xl hover:bg-blue-700 transition-all">
                {editingStudent ? 'حفظ التعديلات' : 'إضافة الطالب للنظام'}
              </button>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fade-in  { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes slide-up { from { opacity:0; transform:translateY(30px); } to { opacity:1; transform:translateY(0); } }
        .animate-fade-in  { animation: fade-in  0.4s ease-out; }
        .animate-slide-up { animation: slide-up 0.35s ease-out; }
      `}</style>
    </div>
  );
};

export default AdminStudentsManager;
