import React, { useMemo, useState } from 'react';
import { User, UserRole, Student } from '../../types';
import { ROLES_ARABIC, APP_CONFIG } from '../../constants';
import { exportToExcel, parseExcel } from '../../services/excelService';
import { Upload, Search, Trash2, Layers, Check, Plus, Edit2, UserPlus, X, Download } from 'lucide-react';

interface Props {
  users: User[];
  setUsers: any;
  onAlert: any;
  students: Student[];
  onDeleteUser: (id: string) => void;
}

const AdminUsersManager: React.FC<Props> = ({ users, setUsers, onAlert, students, onDeleteUser }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [formData, setFormData] = useState<Partial<User>>({
    national_id: '',
    full_name: '',
    phone: '',
    role: 'PROCTOR'
  });

  const availableGrades = useMemo(() => Array.from(new Set(students.map(s => s.grade))).filter(Boolean).sort(), [students]);
  const availableCommittees = useMemo(() => Array.from(new Set(students.map(s => s.committee_number))).filter(Boolean).sort((a, b) => Number(a) - Number(b)), [students]);
  const roleKeys = useMemo(() => Object.keys(ROLES_ARABIC) as UserRole[], []);

  const getCell = (row: any, names: string[]) => {
    for (const name of names) {
      const value = row[name];
      if (value !== undefined && value !== null && String(value).trim() !== '') return String(value).trim();
    }
    return '';
  };

  const splitList = (value: string) => value ? value.split(/[,،]/).map(item => item.trim()).filter(Boolean) : [];

  const normalizeRole = (value: any): UserRole => {
    const text = String(value || '').trim();
    const exactRole = roleKeys.find(role => role === text || ROLES_ARABIC[role] === text);
    if (exactRole) return exactRole;
    if (text.includes('مدير')) return 'ADMIN';
    if (text.includes('رئيس')) return 'CONTROL_MANAGER';
    if (text.includes('مساعد')) return 'ASSISTANT_CONTROL';
    if (text.includes('مرشد') || text.includes('موجه')) return 'COUNSELOR';
    if (text.includes('كنترول')) return 'CONTROL';
    return 'PROCTOR';
  };

  const downloadStaffTemplate = () => {
    exportToExcel([
      {
        'رقم الهوية': '1234567890',
        'الاسم': 'اسم المعلم',
        'الجوال': '0500000000',
        'الصلاحية': ROLES_ARABIC.PROCTOR,
        'اللجان': '1,2',
        'الصفوف': 'أول ثانوي,ثاني ثانوي'
      }
    ], 'نموذج_المعلمين_والصلاحيات');
  };

  const openModal = (user: User | null = null) => {
    if (user) {
      setEditingUser(user);
      setFormData(user);
    } else {
      setEditingUser(null);
      setFormData({ national_id: '', full_name: '', phone: '', role: 'PROCTOR' });
    }
    setIsModalOpen(true);
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.national_id || !formData.full_name) {
      onAlert('يرجى إكمال البيانات الأساسية', 'warning');
      return;
    }

    const userData: User = {
      id: editingUser?.id || crypto.randomUUID(),
      national_id: formData.national_id.trim(),
      full_name: formData.full_name.trim(),
      phone: formData.phone || '',
      role: formData.role as UserRole || 'PROCTOR',
      assigned_committees: editingUser?.assigned_committees || [],
      assigned_grades: editingUser?.assigned_grades || []
    };

    const duplicateUser = users.find(u => u.national_id === userData.national_id && u.id !== editingUser?.id);
    if (duplicateUser) {
      onAlert(`المعلم موجود مسبقاً: ${duplicateUser.full_name || userData.full_name}`, 'warning');
      return;
    }

    setIsSaving(true);
    try {
      await setUsers((prev: User[]) => {
        if (editingUser) return prev.map(u => u.id === editingUser.id ? userData : u);
        return [...prev, userData];
      });
      onAlert(editingUser ? 'تم تحديث بيانات المعلم' : 'تمت إضافة المعلم بنجاح', 'success');
      setIsModalOpen(false);
    } catch (err: any) {
      onAlert(err?.message || 'تعذر حفظ بيانات المعلم', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const updateRole = async (userId: string, role: UserRole) => {
    try {
      await setUsers((prev: User[]) => prev.map(u => u.id === userId ? { ...u, role } : u));
      onAlert('تم تحديث الصلاحية بنجاح', 'success');
    } catch (err: any) {
      onAlert(err?.message || 'تعذر تحديث الصلاحية', 'error');
    }
  };

  const handleStaffUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const data = await parseExcel(file);
      const processedUsers: User[] = data.map((row: any) => {
        const nId = getCell(row, ['رقم الهوية', 'الهوية', 'السجل المدني', 'national_id', 'id']);
        const existingUser = users.find(u => u.national_id === nId);
        const committees = getCell(row, ['اللجان', 'لجان', 'committees']);
        const grades = getCell(row, ['الصفوف', 'صفوف', 'grades']);

        return {
          id: existingUser?.id || crypto.randomUUID(),
          national_id: nId,
          full_name: getCell(row, ['الاسم', 'اسم المعلم', 'الاسم الكامل', 'full_name', 'name']) || existingUser?.full_name || '',
          phone: getCell(row, ['الجوال', 'رقم الجوال', 'phone']) || existingUser?.phone || '',
          role: normalizeRole(getCell(row, ['الصلاحية', 'الدور', 'role']) || existingUser?.role || 'PROCTOR'),
          assigned_committees: committees ? splitList(committees) : (existingUser?.assigned_committees || []),
          assigned_grades: grades ? splitList(grades) : (existingUser?.assigned_grades || [])
        };
      });

      const validUsers = processedUsers.filter(u => u.national_id.length > 5 && u.full_name);
      if (validUsers.length === 0) {
        onAlert('لم يتم العثور على معلمين صالحين في الملف. تأكد من وجود رقم الهوية والاسم.', 'warning');
        return;
      }

      const existingNationalIds = new Set(users.map(user => user.national_id));
      const uniqueNewUsers: User[] = [];
      const skippedUsers: User[] = [];
      const seenInFile = new Set<string>();

      validUsers.forEach(user => {
        if (existingNationalIds.has(user.national_id) || seenInFile.has(user.national_id)) {
          skippedUsers.push(user);
          return;
        }
        seenInFile.add(user.national_id);
        uniqueNewUsers.push(user);
      });

      if (uniqueNewUsers.length === 0) {
        const skippedNames = skippedUsers.map(user => user.full_name).filter(Boolean).join('، ');
        onAlert(`لم تتم إضافة معلمين جدد. تم استبعاد ${skippedUsers.length} موجود مسبقاً: ${skippedNames}`, 'warning');
        return;
      }

      await setUsers((prev: User[]) => {
        return [...prev, ...uniqueNewUsers];
      });

      const addedNames = uniqueNewUsers.map(user => user.full_name).filter(Boolean).join('، ');
      const skippedNames = skippedUsers.map(user => user.full_name).filter(Boolean).join('، ');
      const skippedDetails = skippedUsers.length > 0 ? ` واستبعاد ${skippedUsers.length}: ${skippedNames}` : '';
      onAlert(`تمت إضافة ${uniqueNewUsers.length}: ${addedNames}${skippedDetails}`, 'success');
    } catch (err: any) {
      onAlert(err?.message || 'تعذر قراءة ملف Excel', 'error');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const toggleGrade = async (userId: string, grade: string) => {
    try {
      await setUsers((prev: User[]) => prev.map(u => {
        if (u.id === userId) {
          const current = u.assigned_grades || [];
          const updated = current.includes(grade) ? current.filter(g => g !== grade) : [...current, grade];
          return { ...u, assigned_grades: updated };
        }
        return u;
      }));
    } catch (err: any) {
      onAlert(err?.message || 'تعذر تحديث الصفوف المسندة', 'error');
    }
  };

  const toggleCommittee = async (userId: string, committee: string) => {
    try {
      await setUsers((prev: User[]) => prev.map(u => {
        if (u.id === userId) {
          const current = u.assigned_committees || [];
          const updated = current.includes(committee) ? current.filter(c => c !== committee) : [...current, committee];
          return { ...u, assigned_committees: updated };
        }
        return u;
      }));
    } catch (err: any) {
      onAlert(err?.message || 'تعذر تحديث اللجان المسندة', 'error');
    }
  };

  const filtered = users.filter((u: any) =>
    (u.full_name || '').includes(searchTerm) || (u.national_id || '').includes(searchTerm)
  );

  return (
    <div className="space-y-10 animate-fade-in text-right pb-20">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6">
        <h2 className="text-3xl font-black text-slate-800 tracking-tight">إدارة الهيئة التعليمية والصلاحيات</h2>
        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
          <button onClick={() => openModal()} className="bg-blue-600 text-white px-6 py-4 rounded-2xl flex items-center gap-3 shadow-xl hover:bg-blue-700 transition-all font-black text-sm">
            <UserPlus size={20}/> إضافة يدوية
          </button>
          <button onClick={downloadStaffTemplate} className="bg-emerald-600 text-white px-6 py-4 rounded-2xl flex items-center gap-3 shadow-xl hover:bg-emerald-700 transition-all font-black text-sm">
            <Download size={20}/> نموذج Excel
          </button>
          <label className={`bg-slate-900 text-white px-6 py-4 rounded-2xl flex items-center gap-3 shadow-xl transition-all ${isUploading ? 'opacity-70 cursor-wait' : 'cursor-pointer hover:bg-black'}`}>
            <Upload size={20}/>
            <span className="font-black text-sm">{isUploading ? 'جاري الرفع...' : 'رفع Excel'}</span>
            <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleStaffUpload} disabled={isUploading} />
          </label>
          <div className="relative w-full md:w-80">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input type="text" placeholder="بحث..." className="w-full pr-12 pl-4 py-4 bg-white border-2 border-slate-100 rounded-2xl font-bold shadow-sm outline-none focus:border-blue-600" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {filtered.map((u: User) => (
          <div key={u.id} className="bg-white p-10 rounded-[3rem] shadow-2xl border-2 border-slate-50 flex flex-col items-stretch gap-10 transition-all group">
            <div className="flex flex-col lg:flex-row justify-between items-center gap-10">
              <div className="flex items-center gap-8 text-right flex-1">
                <div className="w-20 h-20 bg-slate-900 text-white rounded-[1.5rem] flex items-center justify-center shadow-xl shrink-0">
                  <img src={APP_CONFIG.LOGO_URL} alt="User" className="w-12 h-12 object-contain invert" />
                </div>
                <div className="flex-1">
                  <h4 className="text-2xl font-black text-slate-900 mb-1">{u.full_name || 'بدون اسم'}</h4>
                  <div className="flex flex-wrap gap-4 text-xs font-bold text-slate-400 italic">
                    <span>الهوية: {u.national_id}</span>
                    <span className="text-blue-600 bg-blue-50 px-3 py-0.5 rounded-full font-black not-italic">{ROLES_ARABIC[u.role] || u.role}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 justify-center lg:w-96 p-2 bg-slate-50 rounded-2xl border border-dashed">
                {roleKeys.map(role => (
                  <button key={role} onClick={() => updateRole(u.id, role)} className={`px-4 py-2.5 rounded-xl font-black text-[10px] transition-all ${u.role === role ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-400 hover:bg-blue-50'}`}>{ROLES_ARABIC[role]}</button>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => openModal(u)} className="p-4 bg-slate-100 text-slate-600 rounded-2xl hover:bg-blue-600 hover:text-white transition-all">
                  <Edit2 size={20}/>
                </button>
                <button onClick={() => onDeleteUser(u.id)} className="p-4 bg-slate-100 text-red-400 rounded-2xl hover:bg-red-600 hover:text-white transition-all">
                  <Trash2 size={20}/>
                </button>
              </div>
            </div>

            {(u.role === 'ASSISTANT_CONTROL' || u.role === 'CONTROL') && (
              <div className="bg-blue-50/30 p-8 rounded-[2.5rem] border border-blue-100/50">
                <h5 className="font-black text-slate-800 text-xl mb-6 flex items-center gap-3"><Layers size={20} className="text-blue-600"/> {u.role === 'ASSISTANT_CONTROL' ? 'إسناد لجان المساعد' : 'إسناد صفوف الكنترول'}</h5>
                <div className="flex flex-wrap gap-3">
                  {u.role === 'CONTROL' ? (
                    availableGrades.map(grade => {
                      const isAssigned = u.assigned_grades?.includes(grade);
                      return <button key={grade} onClick={() => toggleGrade(u.id, grade)} className={`px-6 py-3 rounded-2xl font-black text-sm transition-all border-2 ${isAssigned ? 'bg-emerald-600 text-white border-emerald-600 shadow-xl' : 'bg-white text-slate-400 border-slate-100 hover:border-emerald-200'}`}>{isAssigned ? <Check size={16} className="inline ml-2"/> : <Plus size={16} className="inline ml-2"/>}{grade}</button>;
                    })
                  ) : (
                    availableCommittees.map(committee => {
                      const isAssigned = u.assigned_committees?.includes(committee);
                      return <button key={committee} onClick={() => toggleCommittee(u.id, committee)} className={`px-5 py-3 rounded-2xl font-black text-sm transition-all border-2 ${isAssigned ? 'bg-indigo-600 text-white border-indigo-600 shadow-xl' : 'bg-white text-slate-400 border-slate-100 hover:border-indigo-200'}`}>{isAssigned ? <Check size={16} className="inline ml-2"/> : <Plus size={16} className="inline ml-2"/>}لجنة {committee}</button>;
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 no-print">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className="bg-white w-full max-w-xl rounded-[3rem] shadow-2xl relative z-10 overflow-hidden animate-slide-up">
            <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
              <h3 className="text-2xl font-black">{editingUser ? 'تعديل بيانات معلم' : 'إضافة معلم جديد'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-all"><X size={24}/></button>
            </div>
            <form onSubmit={handleManualSubmit} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 mr-2 uppercase">رقم الهوية</label>
                  <input type="text" value={formData.national_id} onChange={e => setFormData({...formData, national_id: e.target.value})} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-blue-600" required />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 mr-2 uppercase">الاسم الكامل</label>
                  <input type="text" value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-blue-600" required />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 mr-2 uppercase">رقم الجوال</label>
                  <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-blue-600" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 mr-2 uppercase">الصلاحية</label>
                  <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as UserRole})} className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold outline-none focus:border-blue-600 appearance-none">
                    {roleKeys.map(role => <option key={role} value={role}>{ROLES_ARABIC[role]}</option>)}
                  </select>
                </div>
              </div>
              <button type="submit" disabled={isSaving} className="w-full bg-slate-900 text-white py-5 rounded-[1.5rem] font-black text-lg shadow-xl hover:bg-black transition-all disabled:opacity-60 disabled:cursor-wait">
                {isSaving ? 'جاري الحفظ...' : editingUser ? 'حفظ التعديلات' : 'إضافة المعلم للنظام'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsersManager;
