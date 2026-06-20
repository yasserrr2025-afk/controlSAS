import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Database, Package, Printer, Trash2 } from 'lucide-react';
import { APP_CONFIG } from '../../constants';
import { db, supabase } from '../../supabase';
import { ExamEnvelope, SystemConfig, User } from '../../types';

interface Props {
  students: any[];
  users: User[];
  currentUser?: User;
  systemConfig?: SystemConfig;
  onAlert?: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

const EnvelopeLabelsPrint: React.FC<Props> = ({ students, users, currentUser, systemConfig, onAlert }) => {
  const [isPrinting, setIsPrinting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [subject, setSubject] = useState('');
  const [grade, setGrade] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [envelopeItems, setEnvelopeItems] = useState<ExamEnvelope[]>([]);

  const activeDate = systemConfig?.active_exam_date || new Date().toISOString().split('T')[0];
  const selectedTeacher = useMemo(() => users.find(user => user.id === teacherId), [users, teacherId]);
  const uniqueGrades = useMemo(() => Array.from(new Set(students.map(s => s.grade))).filter(Boolean), [students]);
  const labels = envelopeItems;

  const fetchEnvelopes = async () => {
    setIsLoading(true);
    try {
      const data = await db.examEnvelopes.getAll();
      setEnvelopeItems(data.filter(item => item.exam_date === activeDate && item.status !== 'CANCELLED'));
    } catch (error: any) {
      console.error(error);
      onAlert?.(error.message || 'تعذر تحميل مظاريف الأسئلة. تأكد من تنفيذ SQL جدول المظاريف.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEnvelopes();
    const channel = supabase
      .channel(`exam-envelopes-labels-${activeDate}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exam_envelopes' }, () => fetchEnvelopes())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeDate]);

  const handleAddEnvelope = async () => {
    if (!subject.trim() || !grade || !selectedTeacher) return;
    try {
      const newEnvelope: ExamEnvelope = {
        id: crypto.randomUUID(),
        exam_date: activeDate,
        period: 1,
        subject: subject.trim(),
        grade,
        subject_teacher_id: selectedTeacher.id,
        subject_teacher_name: selectedTeacher.full_name,
        status: 'READY',
        created_by: currentUser?.full_name,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await db.examEnvelopes.upsert(newEnvelope);
      setEnvelopeItems(prev => [newEnvelope, ...prev.filter(item => item.id !== newEnvelope.id)]);
      setSubject('');
      setGrade('');
      setTeacherId('');
      await fetchEnvelopes();
      onAlert?.('تم حفظ المظروف في قاعدة البيانات.', 'success');
    } catch (error: any) {
      console.error('Failed to save exam envelope', error);
      const message = error?.message || error?.details || JSON.stringify(error);
      onAlert?.(`تعذر حفظ المظروف في قاعدة البيانات: ${message}`, 'error');
    }
  };

  const handleDeleteEnvelope = async (id: string) => {
    if (!confirm('حذف هذا المظروف؟')) return;
    await db.examEnvelopes.delete(id);
    await fetchEnvelopes();
    onAlert?.('تم حذف المظروف.', 'success');
  };

  const handleDeleteAll = async () => {
    if (!labels.length || !confirm('حذف جميع ملصقات المظاريف لهذا اليوم؟')) return;
    await db.examEnvelopes.deleteMany(labels.map(item => item.id));
    await fetchEnvelopes();
    onAlert?.('تم حذف جميع مظاريف اليوم.', 'success');
  };

  const chunkedLabels = useMemo(() => {
    const pages: ExamEnvelope[][] = [];
    for (let i = 0; i < labels.length; i += 21) pages.push(labels.slice(i, i + 21));
    return pages;
  }, [labels]);

  const handlePrint = async () => {
    setIsPrinting(true);
    const urls = labels.map(label => {
      const data = `ENV2|${label.id}`;
      return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(data)}&color=000000`;
    });
    await Promise.allSettled(urls.map(url => new Promise<void>(resolve => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.src = url;
    })));
    setTimeout(() => window.print(), 500);
  };

  useEffect(() => {
    const handleAfterPrint = () => setIsPrinting(false);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  return (
    <div className="space-y-8 animate-fade-in text-right">
      <div className="bg-slate-950 p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden border-b-[8px] border-blue-600 no-print">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <h2 className="text-4xl font-black mb-2 flex items-center gap-4">
              <Package className="text-blue-400" size={40} />
              ملصقات مظاريف الأسئلة
            </h2>
            <p className="text-slate-400 font-bold max-w-lg">
              تنشأ المظاريف الآن في قاعدة البيانات، ويحتوي QR على رقم المظروف لضمان دقة اسم معلم المادة ومنع الخلط.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-400/30 text-emerald-200 px-4 py-2 text-xs font-black">
              <Database size={16} />
              مصدر ملصقات المظاريف: public.exam_envelopes
            </div>
          </div>
          <button
            onClick={handlePrint}
            disabled={isPrinting || labels.length === 0}
            className={`px-8 py-5 rounded-[2rem] font-black text-xl flex items-center gap-4 transition-all shadow-xl active:scale-95 whitespace-nowrap ${isPrinting || labels.length === 0 ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-500 hover:-translate-y-1 hover:shadow-blue-600/20'}`}
          >
            <Printer size={28} />
            {isPrinting ? 'جاري التجهيز...' : `طباعة ${labels.length} ملصق`}
          </button>
        </div>
      </div>

      <div className="no-print bg-white rounded-[2rem] border border-slate-100 shadow-md p-6 grid grid-cols-1 lg:grid-cols-5 gap-4 items-end">
        <div>
          <label className="block text-xs font-black text-slate-400 mb-2">اسم المادة</label>
          <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="مثال: الرياضيات" className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 font-bold outline-none focus:border-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-black text-slate-400 mb-2">الصف</label>
          <select value={grade} onChange={e => setGrade(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 font-bold outline-none focus:border-blue-500">
            <option value="">اختر الصف</option>
            {uniqueGrades.map(item => <option key={String(item)} value={String(item)}>{String(item)}</option>)}
          </select>
        </div>
        <div className="lg:col-span-2">
          <label className="block text-xs font-black text-slate-400 mb-2">معلم المادة</label>
          <select value={teacherId} onChange={e => setTeacherId(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 font-bold outline-none focus:border-blue-500">
            <option value="">اختر من جميع الأسماء</option>
            {users.slice().sort((a, b) => String(a.full_name).localeCompare(String(b.full_name), 'ar')).map(user => (
              <option key={user.id} value={user.id}>{user.full_name}</option>
            ))}
          </select>
        </div>
        <button
          onClick={handleAddEnvelope}
          disabled={!subject.trim() || !grade || !selectedTeacher}
          className={`rounded-xl p-3 font-black transition-all ${!subject.trim() || !grade || !selectedTeacher ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-600/20'}`}
        >
          إضافة مظروف
        </button>
      </div>

      <div className="no-print">
        {isLoading ? (
          <div className="bg-white rounded-[2rem] p-10 text-center font-black text-slate-400">جاري تحميل المظاريف...</div>
        ) : envelopeItems.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-200 rounded-[2rem] p-10 text-center shadow-sm">
            <Package className="mx-auto text-slate-200 mb-4" size={54} />
            <p className="font-black text-slate-400">أضف المظاريف التي تريد طباعتها كملصقات</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-900 text-xl">المظاريف المحفوظة ({envelopeItems.length})</h3>
              <button onClick={handleDeleteAll} className="text-xs font-black text-red-500 bg-red-50 px-4 py-2 rounded-xl hover:bg-red-100 transition-all">مسح الكل</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {envelopeItems.map((item, index) => (
                <div key={item.id} className="bg-white border border-slate-100 rounded-[2rem] p-5 shadow-md hover:shadow-xl hover:-translate-y-1 transition-all overflow-hidden relative">
                  <div className={`absolute top-0 right-0 left-0 h-1.5 ${item.status === 'OPENED' ? 'bg-gradient-to-l from-emerald-600 via-emerald-400 to-lime-400' : 'bg-gradient-to-l from-blue-600 via-sky-400 to-emerald-400'}`} />
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 font-black flex items-center justify-center shrink-0">{index + 1}</div>
                      <div className="min-w-0">
                        <p className="font-black text-slate-900 text-lg truncate">{item.subject}</p>
                        <p className="text-xs font-black text-slate-400 mt-1">{item.grade}</p>
                        <p className={`text-[10px] font-black mt-2 ${item.status === 'OPENED' ? 'text-emerald-600' : 'text-blue-600'}`}>{item.status === 'OPENED' ? 'تم الفتح' : 'جاهز للطباعة'}</p>
                      </div>
                    </div>
                    <button onClick={() => handleDeleteEnvelope(item.id)} className="p-3 text-red-500 bg-red-50 rounded-xl hover:bg-red-100 transition-all shrink-0">
                      <Trash2 size={18} />
                    </button>
                  </div>
                  <div className="mt-5 rounded-2xl bg-slate-50 border border-slate-100 p-4">
                    <p className="text-[10px] font-black text-slate-400 mb-1">معلم المادة</p>
                    <p className="font-black text-slate-800 leading-relaxed">{item.subject_teacher_name}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {isPrinting && createPortal(
        <div id="labels-print-portal">
          <style>{`
            @media screen { #labels-print-portal { display: none !important; } }
            @media print {
              @page { size: A4 portrait; margin: 0; }
              body { background: white !important; margin: 0; padding: 0; -webkit-print-color-adjust: exact; color: black !important; }
              #root, #app-root, header, nav, .no-print { display: none !important; }
              #labels-print-portal { display: block !important; position: absolute; top: 0; left: 0; width: 100%; direction: rtl; }
              .gs-1021-sheet { width: 210mm; height: 297mm; display: grid; grid-template-columns: repeat(3, 65mm); grid-template-rows: repeat(7, 37mm); column-gap: 4mm; row-gap: 4mm; page-break-after: always; box-sizing: border-box; padding: 7mm 3.5mm; margin: 0; }
              .gs-1021-label { width: 65mm; height: 37mm; box-sizing: border-box; border: 0.2pt solid #000; display: flex; align-items: center; justify-content: center; overflow: hidden; position: relative; background: white; }
              .committee-label-content { width: 100%; height: 100%; display: flex; align-items: center; justify-content: space-between; padding: 0 5mm; }
              .text-black-bold { color: #000 !important; font-weight: 900 !important; }
            }
          `}</style>
          <div className="print-only-labels" dir="rtl">
            {chunkedLabels.map((pageLabels, pageIndex) => (
              <div key={`page-${pageIndex}`} className="gs-1021-sheet bg-white">
                {pageLabels.map(label => {
                  const data = `ENV2|${label.id}`;
                  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data)}&color=000000`;
                  return (
                    <div key={label.id} className="gs-1021-label">
                      <div className="committee-label-content">
                        <div className="w-[40%] flex items-center justify-center">
                          <img src={qrUrl} alt="QR" className="w-20 h-20" style={{ imageRendering: 'pixelated' }} crossOrigin="anonymous" />
                        </div>
                        <div className="flex-1 flex flex-col items-center justify-center gap-1 border-r border-black h-[85%] relative">
                          <img src={APP_CONFIG.LOGO_URL} alt="Logo" className="w-10 h-10 object-contain mb-1" />
                          <span className="text-[8pt] font-black text-black-bold uppercase tracking-widest leading-none mb-1">مظروف أسئلة</span>
                          <span className="text-[12pt] font-black text-black-bold leading-none tabular-nums text-center" style={{ color: '#000' }}>{label.subject}</span>
                          <span className="text-[8pt] font-black text-black-bold mt-1 uppercase tracking-tighter text-center">{label.grade}</span>
                          <span className="text-[6pt] font-black text-black-bold mt-1 text-center">{label.subject_teacher_name}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {Array.from({ length: 21 - pageLabels.length }).map((_, emptyIndex) => (
                  <div key={`empty-${pageIndex}-${emptyIndex}`} className="gs-1021-label" />
                ))}
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default EnvelopeLabelsPrint;
