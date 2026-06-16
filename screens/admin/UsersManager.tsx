
import React, { useState, useMemo } from 'react';
import { User, UserRole, Student } from '../../types';
import { ROLES_ARABIC, APP_CONFIG } from '../../constants';
import { parseExcel } from '../../services/excelService';
import { Upload, Search, Trash2, Layers, Check, Plus, Edit2, UserPlus, X } from 'lucide-react';

interface Props {
  users: User[];
  setUsers: any;
  onAlert: any;
  students: Student[];
  onDeleteUser: (id: string) => void;
  onSaveUser?: (user: User) => Promise<void>;
}

const AdminUsersManager: React.FC<Props> = ({ users, setUsers, onAlert, students, onDeleteUser, onSaveUser }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  // Form State
  const [formData, setFormData] = useState<Partial<User>>({
    national_id: '',
    full_name: '',
    phone: '',
    role: 'PROCTOR'
  });

  const availableGrades = useMemo(() => Array.from(new Set(students.map(s => s.grade))).filter(Boolean).sort(), [students]);
  const availableCommittees = useMemo(() => Array.from(new Set(students.map(s => s.committee_number))).filter(Boolean).sort((a,b) => Number(a)-Number(b)), [students]);

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
      onAlert('يرجى إكمال البيانات الأساسية');
      return;
    }

    const userData: User = {
      id: editingUser?.id || crypto.randomUUID(),
      national_id: formData.national_id!,
      full_name: formData.full_name!,
      phone: formData.phone || '',
      role: formData.role as UserRole || 'PROCTOR',
      assigned_committees: editingUser?.assigned_committees || [],
      assigned_grades: editingUser?.assigned_grades || []
    };

    try {
      if (onSaveUser) {
        await onSaveUser(userData);
      } else {
        await setUsers((prev: User[]) => {
          if (editingUser) return prev.map(u => u.id === editingUser.id ? userData : u);
          return [...prev, userData];
        });
      }

      onAlert(editingUser ? 'تم تحديث البيانات' : 'تمت الإضافة بنجاح');
      setIsModalOpen(false);
    } catch (err: any) {
      onAlert(err?.message || 'تعذر حفظ بيانات المستخدم');
    }
  };

  const updateRole = (userId: string, role: UserRole) => {
    setUsers((prev: User[]) => prev.map(u => u.id === userId ? { ...u, role } : u));
    onAlert(`تم تحديث الدور الوظيفي بنجاح`);
  };

  const handleStaffUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const data = await parseExcel(file);
        const processedUsers: User[] = data.map((row: any) => {
          const nId = String(row['رقم الهوية'] || row['الهوية'] || row['السجل المدني'] || '').trim();
          const existingUser = users.find(u => u.national_id === nId);
          return {
            id: existingUser?.id || crypto.randomUUID(),
            national_id: nId,
            full_name: String(row['الاسم'] || row['اسم المعلم'] || row['الاسم الكامل'] || '').trim(),
            phone: String(row['الجوال'] || row['رقم الجوال'] || '').trim(),
            role: (row['الدور'] || existingUser?.role || 'PROCTOR') as UserRole,
            assigned_committees: row['اللجان'] ? String(row['اللجان']).split(',') : (existingUser?.assigned_committees || []),
            assigned_grades: row['الصفوف'] ? String(row['الصفوف']).split(',') : (existingUser?.assigned_grades || []),
          };
        });
        const validUsers = processedUsers.filter(u => u.national_id.length > 5);
        if (validUsers.length > 0) {
          setUsers(validUsers);
          onAlert(`تم استيراد وتحديث بيانات ${validUsers.length} من الهيئة التعليمية بنجاح.`);
        }
      } catch (err: any) { onAlert(err); }
    }
    e.target.value = '';
  };

  const toggleGrade = (userId: string, grade: string) => {
    setUsers((prev: User[]) => prev.map(u => {
      if (u.id === userId) {
        const current = u.assigned_grades || [];
        const updated = current.includes(grade) ? current.filter(g => g !== grade) : [...current, grade];
        return { ...u, assigned_grades: updated };
      }
      return u;
    }));
  };

  const toggleCommittee = (userId: string, committee: string) => {
    setUsers((prev: User[]) => prev.map(u => {
      if (u.id === userId) {
        const current = u.assigned_committees || [];
        const updated = current.includes(committee) ? current.filter(c => c !== committee) : [...current, committee];
        return { ...u, assigned_committees: updated };
      }
      return u;
    }));
  };

  const filtered = users.filter((u: any) => u.full_name.includes(searchTerm) || u.national_id.includes(searchTerm));

  return (
    <div className="space-y-8 animate-fade-in text-right pb-20">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6">
        <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">إدارة الهيئة التعليمية والصلاحيات</h2>
        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
          <button onClick={() => openModal()} className="bg-gradient-to-r from-blue-600 to-blue-500 text-white px-5 py-3.5 rounded-xl flex items-center gap-3 shadow-lg shadow-blue-600/20 hover:shadow-blue-600/35 hover:-translate-y-0.5 transition-all duration-200 font-black text-sm">
            <UserPlus size={20}/> إضافة يدوية
          </button>
          <label className="bg-slate-900 text-white px-5 py-3.5 rounded-xl cursor-pointer flex items-center gap-3 shadow-lg hover:bg-slate-800 hover:-translate-y-0.5 transition-all duration-200">
            <Upload size={20}/> 
            <span className="font-black text-sm">رفع Excel</span>
            <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleStaffUpload} />
          </label>
          <div className="relative w-full md:w-80">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input type="text" placeholder="بحث..." className="w-full pr-12 pl-4 py-3.5 bg-white border border-slate-200 rounded-xl font-bold shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all" value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {filtered.map((u: User) => (
          <div key={u.id} className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-md border border-slate-100/80 flex flex-col items-stretch gap-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
            <div className="flex flex-col lg:flex-row justify-between items-center gap-10">
              <div className="flex items-center gap-8 text-right flex-1">
                <div className="w-16 h-16 bg-gradient-to-br from-slate-800 to-slate-900 text-white rounded-[1.2rem] flex items-center justify-center shadow-lg shrink-0">
                  <img src={APP_CONFIG.LOGO_URL} alt="User" className="w-12 h-12 object-contain invert" />
                </div>
                <div className="flex-1">
                  <h4 className="text-2xl font-black text-slate-900 mb-1">{u.full_name}</h4>
                  <div className="flex flex-wrap gap-4 text-xs font-bold text-slate-400 italic">
                    <span>الهوية: {u.national_id}</span>
                    <span className="text-blue-700 bg-blue-50 px-3 py-0.5 rounded-full font-black text-xs not-italic border border-blue-100">{ROLES_ARABIC[u.role] || u.role}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 justify-center lg:w-80 p-2.5 bg-slate-50 rounded-2xl border border-slate-200">
                {Object.keys(ROLES_ARABIC).map(role => (
                  <button key={role} onClick={() => updateRole(u.id, role as UserRole)} className={`px-3.5 py-2 rounded-xl font-black text-[10px] transition-all ${u.role === role ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-sm' : 'bg-white text-slate-400 hover:bg-blue-50 hover:text-blue-600 border border-slate-100'}`}>{ROLES_ARABIC[role]}</button>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => openModal(u)} className="p-3 bg-slate-50 text-slate-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all duration-200 border border-slate-100">
                  <Edit2 size={20}/>
                </button>
                <button onClick={() => onDeleteUser(u.id)} className="p-3 bg-slate-50 text-red-400 rounded-xl hover:bg-red-500 hover:text-white transition-all duration-200 border border-red-100">
                  <Trash2 size={20}/>
                </button>
              </div>
            </div>
            {(u.role === 'ASSISTANT_CONTROL' || u.role === 'CONTROL' || u.role === 'COUNSELOR') && (
              <div className="bg-gradient-to-br from-blue-50/60 to-indigo-50/40 p-6 rounded-[2rem] border border-blue-100/60">
                <h5 className="font-black text-slate-800 text-xl mb-6 flex items-center gap-3"><Layers size={20} className="text-blue-600"/> {u.role === 'ASSISTANT_CONTROL' ? 'إسناد لجان المساعد' : u.role === 'COUNSELOR' ? 'إسناد صفوف الموجه الطلابي' : 'إسناد صفوف الكنترول'}</h5>
                <div className="flex flex-wrap gap-3">
                  {(u.role === 'CONTROL' || u.role === 'COUNSELOR') ? (
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

      {/* Manual Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 no-print">
          <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-md" onClick={() => setIsModalOpen(false)}></div>
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden animate-scale-in border border-slate-100">
            <div className="bg-gradient-to-br from-[#0a1628] to-[#0f172a] p-7 text-white flex justify-between items-center">
              <h3 className="text-2xl font-black">{editingUser ? 'تعديل بيانات معلم' : 'إضافة معلم جديد'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-all"><X size={24}/></button>
            </div>
            <form onSubmit={handleManualSubmit} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 mr-2 uppercase">رقم الهوية</label>
                  <input type="text" value={formData.national_id} onChange={e => setFormData({...formData, national_id: e.target.value})} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-sm" required />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 mr-2 uppercase">الاسم الكامل</label>
                  <input type="text" value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-sm" required />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 mr-2 uppercase">رقم الجوال</label>
                  <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-sm" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 mr-2 uppercase">الدور الوظيفي</label>
                  <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as UserRole})} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all text-sm appearance-none">
                    {Object.entries(ROLES_ARABIC).map(([key, val]) => <option key={key} value={key}>{val}</option>)}
                  </select>
                </div>
              </div>
              <button type="submit" className="w-full bg-gradient-to-r from-slate-900 to-slate-800 text-white py-4 rounded-xl font-black text-base shadow-lg hover:from-slate-800 hover:to-slate-700 transition-all active:scale-[0.98]">
                {editingUser ? 'حفظ التعديلات' : 'إضافة المعلم للنظام'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsersManager;
