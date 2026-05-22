
import React, { useState, useEffect } from 'react';
import { User, EnvelopeLog } from '../../types';
import { db } from '../../supabase';
import { APP_CONFIG } from '../../constants';
import { 
    PackageOpen, ShieldCheck, Clock, UserCheck, 
    ArrowRight, Loader2, CheckCircle, AlertTriangle,
    CheckCircle2, Fingerprint, Lock, ShieldAlert
} from 'lucide-react';

interface Props {
    grade: string;
    subject: string;
    period: string;
    currentUser: User | null;
    onBack: () => void;
    onAlert: (m: string, t: any) => void;
}

const EnvelopeOpeningAction: React.FC<Props> = ({ grade, subject, period, currentUser, onBack, onAlert }) => {
    const [isSaving, setIsSaving] = useState(false);
    const [isDone, setIsDone] = useState(false);
    const [envStatus, setEnvStatus] = useState<'INTACT' | 'DAMAGED'>('INTACT');

    const handleConfirm = async () => {
        if (!currentUser) return;
        setIsSaving(true);
        try {
            await db.envelopeLogs.insert({
                id: crypto.randomUUID(),
                grade,
                subject,
                period,
                opened_by_id: currentUser.id,
                opened_by_name: currentUser.full_name,
                time: new Date().toISOString(),
                status: envStatus
            });
            setIsDone(true);
            onAlert(`تم توثيق فتح مظروف (${grade}) بنجاح.`, 'success');
        } catch (e: any) {
            onAlert(e.message, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    if (isDone) {
        return (
            <div className="max-w-md mx-auto py-20 px-6 text-center animate-fade-in">
                <div className="bg-emerald-500 w-32 h-32 rounded-[2.5rem] flex items-center justify-center mx-auto mb-10 shadow-2xl border-8 border-white animate-bounce-subtle">
                    <CheckCircle2 size={64} className="text-white" />
                </div>
                <h2 className="text-4xl font-black text-slate-900 tracking-tighter mb-4">تم التوثيق الرقمي</h2>
                <p className="text-slate-500 font-bold mb-10 leading-relaxed italic">شكراً لك، تم تسجيل عملية فتح المظروف بالاسم والوقت في غرفة العمليات.</p>
                <button onClick={onBack} className="w-full bg-slate-900 text-white py-6 rounded-[2rem] font-black text-xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-4">
                    <ArrowRight size={24}/> العودة للرئيسية
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto py-10 px-4 animate-fade-in text-right">
            <div className="bg-slate-950 p-10 rounded-[4rem] text-white shadow-2xl relative overflow-hidden border-b-[12px] border-emerald-500 mb-10">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[100px] rounded-full"></div>
                <div className="relative z-10 flex flex-col items-center gap-6">
                    <div className="bg-white/10 w-24 h-24 rounded-3xl p-4 backdrop-blur-md border border-white/20 shadow-2xl">
                        <PackageOpen size={64} className="text-emerald-400" />
                    </div>
                    <div className="text-center">
                        <h2 className="text-[10px] font-black uppercase tracking-[0.5em] text-emerald-400 mb-2 leading-none">Security Protocol: Open Envelope</h2>
                        <h1 className="text-4xl font-black tracking-tighter">محضر فتح مظروف أسئلة</h1>
                    </div>
                </div>
            </div>

            {!currentUser ? (
                <div className="bg-white p-12 rounded-[3.5rem] shadow-xl border-2 border-red-50 text-center space-y-8">
                    <div className="bg-red-50 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto text-red-500 shadow-inner">
                        <ShieldAlert size={40} />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-slate-900">يرجى تسجيل الدخول أولاً</h3>
                        <p className="text-slate-400 font-bold mt-2">لا يمكن توثيق فتح المظروف دون تحديد هوية الموظف المسؤول.</p>
                    </div>
                    <button onClick={() => window.location.hash = ''} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black shadow-lg">التوجه لصفحة الدخول</button>
                </div>
            ) : (
                <div className="space-y-8">
                    <div className="bg-white p-10 rounded-[4rem] shadow-xl border-2 border-slate-50 space-y-8">
                        <div className="grid grid-cols-2 gap-6">
                            <div className="bg-slate-50 p-6 rounded-[2rem] border text-center">
                                <p className="text-[10px] font-black text-slate-400 uppercase mb-2">الصف الدراسي</p>
                                <p className="text-3xl font-black text-slate-900">{grade}</p>
                            </div>
                            <div className="bg-slate-50 p-6 rounded-[2rem] border text-center">
                                <p className="text-[10px] font-black text-slate-400 uppercase mb-2">الفترة</p>
                                <p className="text-3xl font-black text-slate-900">{period}</p>
                            </div>
                            <div className="col-span-2 bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 blur-3xl rounded-full"></div>
                                <div className="relative z-10">
                                    <p className="text-[10px] font-black text-slate-500 uppercase mb-2">المادة الدراسية</p>
                                    <p className="text-4xl font-black italic">{subject}</p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t">
                            <h4 className="font-black text-slate-800 flex items-center gap-3"><AlertTriangle className="text-amber-500"/> حالة المظروف عند الاستلام:</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <button onClick={() => setEnvStatus('INTACT')} className={`p-6 rounded-[2rem] border-2 font-black transition-all flex flex-col items-center gap-3 ${envStatus === 'INTACT' ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-lg' : 'bg-white border-slate-100 text-slate-400'}`}>
                                    <CheckCircle size={32} />
                                    سليم ومحكم الإغلاق
                                </button>
                                <button onClick={() => setEnvStatus('DAMAGED')} className={`p-6 rounded-[2rem] border-2 font-black transition-all flex flex-col items-center gap-3 ${envStatus === 'DAMAGED' ? 'bg-red-50 border-red-500 text-red-700 shadow-lg' : 'bg-white border-slate-100 text-slate-400'}`}>
                                    <ShieldAlert size={32} />
                                    غير سليم / به فتحات
                                </button>
                            </div>
                        </div>

                        <div className="bg-blue-50/50 p-8 rounded-[3rem] border border-blue-100 flex items-center gap-6">
                            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-lg"><UserCheck size={32} className="text-blue-600"/></div>
                            <div className="flex-1">
                                <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1 italic">الموظف المسؤول عن الفتح</p>
                                <h5 className="text-2xl font-black text-slate-800">{currentUser.full_name}</h5>
                            </div>
                        </div>

                        <button 
                            onClick={handleConfirm}
                            disabled={isSaving}
                            className="w-full py-10 bg-slate-950 text-white rounded-[3rem] font-black text-3xl shadow-2xl hover:bg-emerald-600 transition-all active:scale-95 flex items-center justify-center gap-6 border-b-[10px] border-slate-800"
                        >
                            {isSaving ? <Loader2 className="animate-spin" size={40} /> : <Fingerprint size={48} />}
                            {isSaving ? 'جاري الحفظ...' : 'توثيق وبدء الفتح'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EnvelopeOpeningAction;
