import React, { useMemo, useState } from 'react';
import { Student } from '../../types';
import { exportToExcel, parseExcel } from '../../services/excelService';
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

const AdminStudentsManager: React.FC<Props> = ({ students, setStudents, onAlert, onDeleteStudent }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isMerging, setIsMerging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [gradeFilter, setGradeFilter] = useState('');
  const [formData, setFormData] = useState<Partial<Student>>({
    national_id: '', name: '', grade: '', section: '',
    committee_number: '', seating_number: '', parent_phone: ''
  });

  const getCell = (row: any, names: string[]) => {
    for (const name of names) {
      const value = row[name];
      if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim();
    }
    return '';
  };

  const normalizeText = (text: string) =>
    String(text || '').trim().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ');

  const grades = useMemo(() => [...new Set(students.map(s => s.grade))].filter(Boolean).sort(), [students]);
  const filtered = useMemo(() => students.filter(s => {
    const matchSearch = !searchTerm || (s.name || '').includes(searchTerm) || (s.national_id || '').includes(searchTerm);
    const matchGrade = !gradeFilter || s.grade === gradeFilter;
    return matchSearch && matchGrade;
  }), [students, searchTerm, gradeFilter]);

  const withPhone = students.filter(s => s.parent_phone).length;
  const withSeating = students.filter(s => s.seating_number).length;

  const openModal = (student: Student | null = null) => {
    setEditingStudent(student);
    setFormData(student || { national_id: '', name: '', grade: '', section: '', committee_number: '', seating_number: '', parent_phone: '' });
    setIsModalOpen(true);
  };

  const downloadStudentsTemplate = () => {
    exportToExcel([
      {
        'رقم الهوية': '1234567890',
        'الاسم': 'اسم الطالب',
        'الصف': 'الأول المتوسط',
        'الفصل': '1',
        'رقم اللجنة': '1',
        'رقم الجلوس': '101',
        'جوال ولي الأمر': '0500000000'
      }
    ], 'نموذج_بيانات_الطلاب');
  };

  const downloadPhonesTemplate = () => {
    exportToExcel([
      { 'رقم الهوية': '1234567890', 'الاسم': 'اسم الطالب', 'الجوال': '0500000000' }
    ], 'نموذج_أرقام_الجوالات');
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.national_id?.trim() || !formData.name?.trim()) {
      onAlert('يرجى إدخال رقم الهوية واسم الطالب', 'warning');
      return;
    }

    const studentData: Student = {
      id: editingStudent?.id || crypto.randomUUID(),
      national_id: formData.national_id.trim(),
      name: formData.name.trim(),
      grade: formData.grade?.trim() || '',
      section: formData.section?.trim() || '',
      committee_number: formData.committee_number?.trim() || '',
      seating_number: formData.seating_number?.trim() || '',
      parent_phone: formData.parent_phone?.trim() || ''
    };

    const duplicate = students.find(s => s.national_id === studentData.national_id && s.id !== editingStudent?.id);
    if (duplicate) {
      onAlert(`الطالب موجود مسبقاً: ${duplicate.name}`, 'warning');
      return;
    }

    try {
      await setStudents((prev: Student[]) => editingStudent ? prev.map(s => s.id === editingStudent.id ? studentData : s) : [...prev, studentData]);
      onAlert(editingStudent ? 'تم تحديث بيانات الطالب' : 'تمت إضافة الطالب بنجاح', 'success');
      setIsModalOpen(false);
    } catch (err: any) {
      onAlert(err?.message || 'تعذر حفظ بيانات الطالب', 'error');
    }
  };

  const handlePrimaryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const data = await parseExcel(file);
      const parsed: Student[] = data.map((row: any) => {
        const nId = getCell(row, ['رقم الهوية', 'الهوية', 'السجل المدني', 'national_id', 'id']);
        const existing = students.find(s => s.national_id === nId);
        return {
          id: existing?.id || crypto.randomUUID(),
          national_id: nId,
          name: getCell(row, ['الاسم', 'اسم الطالب', 'الاسم الكامل', 'name']) || existing?.name || '',
          grade: getCell(row, ['الصف', 'المرحلة', 'grade']) || existing?.grade || '',
          section: getCell(row, ['الفصل', 'الشعبة', 'section']) || existing?.section || '',
          committee_number: getCell(row, ['اللجنة', 'رقم اللجنة', 'committee_number']) || existing?.committee_number || '',
          seating_number: getCell(row, ['رقم الجلوس', 'جلوس', 'seating_number']) || existing?.seating_number || '',
          parent_phone: getCell(row, ['جوال ولي الأمر', 'الجوال', 'رقم الجوال', 'parent_phone']) || existing?.parent_phone || ''
        };
      }).filter(s => s.national_id.length > 5 && s.name);

      if (parsed.length === 0) {
        onAlert('لم يتم العثور على طلاب صالحين في الملف. تأكد من وجود رقم الهوية والاسم.', 'warning');
        return;
      }

      await setStudents((prev: Student[]) => {
        const byNationalId = new Map(prev.map(s => [s.national_id, s]));
        parsed.forEach(s => byNationalId.set(s.national_id, s));
        return Array.from(byNationalId.values());
      });
      onAlert(`تمت إضافة/تحديث ${parsed.length} طالب بنجاح`, 'success');
    } catch (err: any) {
      onAlert(err?.message || 'خطأ في قراءة ملف الطلاب', 'error');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handlePhoneMerge = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (students.length === 0) {
      onAlert('يرجى رفع كشف الطلاب أولاً', 'warning');
      return;
    }
    setIsMerging(true);
    try {
      const phoneData = await parseExcel(file);
      let matchCount = 0;
      const updated = students.map((s: Student) => {
        const match = phoneData.find((row: any) => {
          const rowId = getCell(row, ['رقم الهوية', 'الهوية', 'السجل المدني', 'national_id', 'id']).replace(/\D/g, '');
          const rowName = normalizeText(getCell(row, ['الاسم', 'اسم الطالب', 'الاسم الكامل', 'name']));
          return rowId === s.national_id.replace(/\D/g, '') || (rowName && rowName === normalizeText(s.name));
        });
        if (!match) return s;
        const phone = getCell(match, ['الجوال', 'رقم الجوال', 'جوال ولي الأمر', 'parent_phone', 'phone']);
        if (!phone) return s;
        matchCount++;
        return { ...s, parent_phone: phone };
      });
      await setStudents(updated);
      onAlert(`تم ربط ${matchCount} رقم جوال بنجاح`, 'success');
    } catch (err: any) {
      onAlert(err?.message || 'خطأ في دمج أرقام الجوال', 'error');
    } finally {
      setIsMerging(false);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-8 animate-fade-in text-right pb-24" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">إدارة بيانات الطلاب</h2>
          <p className="text-slate-400 font-bold text-sm mt-1">رفع الكشوف ودمج أرقام الجوالات</p>
        </div>
        <button onClick={() => openModal()} className="bg-blue-600 text-white px-6 py-3.5 rounded-2xl flex items-center gap-2 shadow-lg hover:bg-blue-700 transition-all font-black text-sm">
          <UserPlus size={18} /> إضافة يدوية
        </button>
      </div>

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-lg p-7 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-900 rounded-2xl flex items-center justify-center shrink-0">
              <FileSpreadsheet size={20} className="text-white" />
            </div>
            <div>
              <h3 className="font-black text-slate-800 text-base">كشف بيانات الطلاب</h3>
              <p className="text-slate-400 text-[11px] font-bold">رقم هوية، اسم، صف، فصل، لجنة، جلوس</p>
            </div>
          </div>
          <div className="flex gap-3">
            <label className={`flex-1 text-white py-3.5 px-5 rounded-2xl cursor-pointer flex items-center justify-center gap-2 font-black text-sm transition-all shadow-lg ${isUploading ? 'bg-slate-500 cursor-wait' : 'bg-slate-900 hover:bg-black'}`}>
              <Upload size={16} /> {isUploading ? 'جاري الرفع...' : 'رفع الكشف'}
              <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handlePrimaryUpload} disabled={isUploading} />
            </label>
            <button onClick={downloadStudentsTemplate} className="bg-slate-50 border border-slate-200 text-slate-600 py-3.5 px-4 rounded-2xl flex items-center gap-2 text-sm font-black hover:bg-slate-100 transition-all">
              <Download size={16} /><span className="hidden md:inline">قالب</span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-lg p-7 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-2xl flex items-center justify-center shrink-0">
              <Phone size={20} className="text-white" />
            </div>
            <div>
              <h3 className="font-black text-slate-800 text-base">دمج أرقام الجوالات</h3>
              <p className="text-slate-400 text-[11px] font-bold">مطابقة عبر رقم الهوية أو الاسم</p>
            </div>
          </div>
          <div className="flex gap-3">
            <label className={`flex-1 text-white py-3.5 px-5 rounded-2xl cursor-pointer flex items-center justify-center gap-2 font-black text-sm transition-all shadow-lg ${isMerging ? 'bg-emerald-400 cursor-wait' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
              <Smartphone size={16} /> {isMerging ? 'جاري الدمج...' : 'رفع ملف الجوالات'}
              <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handlePhoneMerge} disabled={isMerging} />
            </label>
            <button onClick={downloadPhonesTemplate} className="bg-slate-50 border border-slate-200 text-slate-600 py-3.5 px-4 rounded-2xl flex items-center gap-2 text-sm font-black hover:bg-slate-100 transition-all">
              <Download size={16} /><span className="hidden md:inline">قالب</span>
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
        <div className="p-6 border-b bg-slate-50 flex flex-col md:flex-row items-center gap-4">
          <div className="relative flex-1 w-full">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input type="text" placeholder="بحث بالاسم أو رقم الهوية..." className="w-full pr-11 py-3 bg-white border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-blue-500 transition-colors text-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <div className="relative">
            <select value={gradeFilter} onChange={e => setGradeFilter(e.target.value)} className="appearance-none bg-white border-2 border-slate-100 rounded-2xl px-4 py-3 pr-10 font-bold text-sm text-slate-700 outline-none focus:border-blue-500 cursor-pointer">
              <option value="">كل الصفوف</option>
              {grades.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <ChevronDown size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
          <div className="text-slate-400 font-black text-sm whitespace-nowrap">{filtered.length} طالب</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-slate-50 border-b">
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {['الطالب', 'الصف / الفصل', 'رقم الجلوس', 'اللجنة', 'رقم الجوال', ''].map(h => <th key={h} className="px-6 py-4">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-24 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Table size={48} className="text-slate-200" />
                      <p className="text-slate-300 font-black text-lg">لا يوجد طلاب</p>
                    </div>
                  </td>
                </tr>
              ) : filtered.map(s => (
                <tr key={s.id} className="hover:bg-blue-50/30 transition-colors group">
                  <td className="px-6 py-4">
                    <p className="font-black text-slate-800 text-sm">{s.name || 'بدون اسم'}</p>
                    <p className="text-[10px] font-mono text-slate-400 mt-0.5">{s.national_id}</p>
                  </td>
                  <td className="px-6 py-4 text-slate-500 font-bold text-sm">{s.grade} - {s.section}</td>
                  <td className="px-6 py-4">{s.seating_number ? <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1 rounded-xl text-xs font-black border border-blue-100"><Hash size={11} /> {s.seating_number}</span> : <span className="text-slate-300 text-[10px]">---</span>}</td>
                  <td className="px-6 py-4 font-black text-slate-600 text-sm">لجنة {s.committee_number || '---'}</td>
                  <td className="px-6 py-4">{s.parent_phone ? <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-xl text-xs font-bold border border-emerald-100"><CheckCircle2 size={11} /> {s.parent_phone}</span> : <span className="inline-flex items-center gap-1.5 bg-red-50 text-red-400 px-3 py-1 rounded-xl text-[10px] font-bold border border-red-100"><Phone size={10} /> بانتظار الدمج</span>}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openModal(s)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-xl transition-all"><Edit2 size={16} /></button>
                      <button onClick={() => onDeleteStudent(s.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center p-4 no-print">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden animate-slide-up">
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-7 text-white flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black">{editingStudent ? 'تعديل بيانات الطالب' : 'إضافة طالب جديد'}</h3>
                <p className="text-slate-400 text-xs font-bold mt-1">أدخل بيانات الطالب الأساسية</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-2xl transition-all"><X size={22} /></button>
            </div>
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
                    <input type="text" inputMode={field.mode} value={(formData as any)[field.key] ?? ''} onChange={e => setFormData({ ...formData, [field.key]: e.target.value })} required={field.required} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-sm outline-none focus:border-blue-500 focus:bg-white transition-all" />
                  </div>
                ))}
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider">جوال ولي الأمر</label>
                  <input type="text" inputMode="numeric" value={formData.parent_phone ?? ''} onChange={e => setFormData({ ...formData, parent_phone: e.target.value })} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-sm outline-none focus:border-blue-500 focus:bg-white transition-all" placeholder="05xxxxxxxx" />
                </div>
              </div>
              <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-[1.5rem] font-black text-base shadow-xl hover:bg-blue-700 transition-all">
                {editingStudent ? 'حفظ التعديلات' : 'إضافة الطالب للنظام'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminStudentsManager;
