import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, CheckCircle2, Clock, AlertTriangle, UserSearch, Target, Maximize, UserCheck, ShieldAlert } from 'lucide-react';
import { Student, Absence } from '../types';
import { db } from '../supabase';
import { Html5Qrcode } from 'html5-qrcode';

interface Props {
  students: Student[];
  absences: Absence[];
  activeDate: string;
  onRefreshData: () => Promise<void>;
}

const GlobalQRScanner: React.FC<Props> = ({ students, absences, activeDate, onRefreshData }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scannedStudent, setScannedStudent] = useState<Student | null>(null);
  const qrScannerRef = useRef<any>(null);

  const startScanner = async () => {
    setIsScanning(true);
    setScannedStudent(null);
    setIsOpen(true);
    setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode("admin-global-scanner");
        qrScannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 15, qrbox: { width: 250, height: 250 } },
          (decodedText: string) => {
            handleScanResult(decodedText);
            stopScanner();
          },
          () => {}
        );
      } catch (err) {
        setIsScanning(false);
        console.error("Camera error:", err);
      }
    }, 300);
  };

  const stopScanner = async () => {
    if (qrScannerRef.current) {
      try {
        await qrScannerRef.current.stop();
        qrScannerRef.current.clear();
      } catch (err) { }
    }
    setIsScanning(false);
  };

  const closeAll = async () => {
    await stopScanner();
    setIsOpen(false);
    setScannedStudent(null);
  };

  const handleScanResult = (text: string) => {
    // Search student by national_id, parent_phone, or ID
    const student = students.find(st => st.national_id === text || st.parent_phone === text || st.id === text || st.committee_number === text);
    
    if (student) {
      setScannedStudent(student);
    } else {
      alert(`عذراً، لم يتم العثور على سجل يطابق هذا الرمز: ${text}`);
      closeAll();
    }
  };

  const handleToggleStatus = async (type: 'ABSENT' | 'LATE') => {
    if (!scannedStudent) return;
    try {
      const existing = absences.find(a => a.student_id === scannedStudent.national_id && a.date.startsWith(activeDate));
      
      if (existing) {
        if (existing.type === type) {
          await db.absences.delete(existing.id);
        } else {
          await db.absences.upsert({ ...existing, type });
        }
      } else {
        await db.absences.upsert({
          id: crypto.randomUUID(),
          student_id: scannedStudent.national_id,
          student_name: scannedStudent.name,
          committee_number: scannedStudent.committee_number,
          type,
          date: new Date().toISOString()
        });
      }
      await onRefreshData();
      alert(`تم تحديث حالة الطالب ${scannedStudent.name} بنجاح.`);
      closeAll();
    } catch (err: any) {
       alert(err.message);
    }
  };

  // Status for the popup
  const currentStatus = scannedStudent ? absences.find(a => a.student_id === scannedStudent.national_id && a.date.startsWith(activeDate)) : null;

  return (
    <>
      <button 
        onClick={startScanner}
        className="fixed bottom-6 left-6 z-[200] w-16 h-16 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-[0_10px_40px_-10px_rgba(37,99,235,0.8)] hover:scale-110 active:scale-95 transition-all outline-none border-4 border-white print:hidden group"
        title="البحث السريع الميداني (QR Scanner)"
      >
         <div className="absolute inset-0 rounded-full border border-blue-400 animate-ping opacity-50"></div>
         <Camera size={26} className="group-hover:rotate-12 transition-transform"/>
      </button>

      {isOpen && (
         <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/98 backdrop-blur-3xl animate-fade-in no-print text-white">
            <button onClick={closeAll} className="absolute top-6 left-6 bg-white/10 p-4 rounded-full hover:bg-white/20 transition-all text-white"><X size={32}/></button>
            <div className="w-full max-w-lg mx-auto flex flex-col items-center">
               
               {isScanning ? (
                  <div className="space-y-10 w-full text-center">
                     <div className="space-y-4">
                        <div className="w-24 h-24 bg-blue-600/20 text-blue-400 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl"><Maximize size={48} className="animate-pulse"/></div>
                        <h2 className="text-4xl font-black tracking-tighter">الماسح الإداري الذكي</h2>
                        <p className="text-blue-200 font-bold uppercase tracking-widest text-sm">وجه الكاميرا نحو كود الطالب للبحث الفوري</p>
                     </div>
                     <div className="relative mx-auto w-full max-w-xs overflow-hidden rounded-[4rem] border-[10px] border-white/10 shadow-2xl bg-black">
                        <div id="admin-global-scanner" className="aspect-square w-full"></div>
                        <div className="absolute inset-x-0 h-1 bg-blue-500/50 shadow-[0_0_20px_10px_rgba(59,130,246,0.5)] animate-scan"></div>
                     </div>
                     <button onClick={closeAll} className="px-10 py-5 bg-white/5 border-2 border-white/10 text-white rounded-[2rem] font-black text-xl hover:bg-white/10 transition-all">إلغاء المسح</button>
                  </div>
               ) : scannedStudent ? (
                  <div className="bg-white text-slate-900 w-full rounded-[3.5rem] p-10 shadow-[0_0_100px_rgba(59,130,246,0.3)] animate-slide-up relative overflow-hidden text-right border-b-[12px] border-blue-600">
                     <div className="absolute top-0 right-0 w-48 h-48 bg-blue-600/5 blur-[50px] rounded-full"></div>
                     <div className="relative z-10 space-y-8">
                        <div className="flex justify-between items-start">
                           <div className="flex items-center gap-6">
                              <div className="w-20 h-20 bg-blue-600 rounded-[2rem] text-white flex items-center justify-center shadow-2xl mb-2"><UserSearch size={40}/></div>
                              <div>
                                 <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1">النتيجة الحية</p>
                                 <h3 className="text-3xl font-black">{scannedStudent.name}</h3>
                              </div>
                           </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                           <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 flex items-center gap-4">
                              <div className="bg-white p-3 rounded-2xl shadow-sm text-blue-600"><Target size={24}/></div>
                              <div>
                                 <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">اللجنة المكلف بها</p>
                                 <p className="font-black text-2xl">{scannedStudent.committee_number}</p>
                              </div>
                           </div>
                           <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 flex items-center gap-4">
                              <div className="bg-white p-3 rounded-2xl shadow-sm text-blue-600"><UserCheck size={24}/></div>
                              <div>
                                 <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">الصف والفصل</p>
                                 <p className="font-bold text-sm tracking-tight">{scannedStudent.grade} ({scannedStudent.section})</p>
                              </div>
                           </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t-2 border-slate-50">
                           <p className="text-xs font-black uppercase tracking-widest text-slate-400">الإجراء الإداري المباشر:</p>
                           <div className="grid grid-cols-2 gap-4">
                              <button onClick={() => handleToggleStatus('ABSENT')} className={`py-6 flex flex-col items-center justify-center gap-2 rounded-[2.5rem] font-black text-xl transition-all shadow-xl active:scale-95 ${currentStatus?.type === 'ABSENT' ? 'bg-red-600 text-white' : 'bg-white border-2 border-red-100 text-red-500 hover:bg-red-50'}`}>
                                 <ShieldAlert size={28}/> {currentStatus?.type === 'ABSENT' ? 'حالة مؤكدة: غائب' : 'اعتماد الغياب'}
                              </button>
                              <button onClick={() => handleToggleStatus('LATE')} className={`py-6 flex flex-col items-center justify-center gap-2 rounded-[2.5rem] font-black text-xl transition-all shadow-xl active:scale-95 ${currentStatus?.type === 'LATE' ? 'bg-amber-500 text-white' : 'bg-white border-2 border-amber-100 text-amber-500 hover:bg-amber-50'}`}>
                                 <Clock size={28}/> {currentStatus?.type === 'LATE' ? 'حالة مؤكدة: متأخر' : 'اعتماد التأخر'}
                              </button>
                           </div>
                           {(currentStatus?.type === 'ABSENT' || currentStatus?.type === 'LATE') && (
                              <button onClick={() => handleToggleStatus(currentStatus.type)} className="w-full py-5 rounded-[2rem] bg-slate-100 text-slate-500 font-black hover:bg-emerald-50 hover:text-emerald-600 transition-all flex items-center justify-center gap-3 mt-4 active:scale-95">
                                 <CheckCircle2 size={24}/> إلغاء الرصد وإعادته كحاضر
                              </button>
                           )}
                        </div>
                     </div>
                  </div>
               ) : null}
            </div>
         </div>
      )}
      <style>{`
         @keyframes scan {
           0%, 100% { top: 0; }
           50% { top: 100%; }
         }
         .animate-scan { animation: scan 3s ease-in-out infinite; }
      `}</style>
    </>
  );
};

export default GlobalQRScanner;
