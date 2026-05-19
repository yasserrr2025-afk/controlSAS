import React, { useEffect, useMemo, useState } from 'react';
import { Search, ShieldCheck, GraduationCap, Hash, MapPinned, TicketCheck, UserRound, Sparkles } from 'lucide-react';
import { Student } from '../../types';
import { APP_CONFIG } from '../../constants';
import { db } from '../../supabase';

interface Props {
  students: Student[];
}

const StudentLookupView: React.FC<Props> = ({ students }) => {
  const [schoolName, setSchoolName] = useState('');
  const [query, setQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    db.tenants.getActive()
      .then((tenant) => setSchoolName(tenant?.name || ''))
      .catch(() => setSchoolName(''));
  }, []);

  const normalizedQuery = query.trim();

  const result = useMemo(() => {
    if (!hasSearched || !normalizedQuery) return null;
    return students.find((student) => {
      const values = [
        student.national_id,
        student.seating_number,
        student.id,
      ].filter(Boolean).map((value) => String(value).trim());
      return values.includes(normalizedQuery);
    }) || null;
  }, [students, normalizedQuery, hasSearched]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setHasSearched(true);
  };

  return (
    <div className="min-h-[100dvh] bg-[#061126] font-['Tajawal'] text-right relative overflow-hidden" dir="rtl">
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{ backgroundImage: 'linear-gradient(#93c5fd 1px, transparent 1px), linear-gradient(90deg, #93c5fd 1px, transparent 1px)', backgroundSize: '58px 58px' }} />
      <div className="absolute -top-32 right-[-10%] w-[70%] h-[55%] bg-blue-500/20 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute -bottom-32 left-[-10%] w-[60%] h-[50%] bg-emerald-500/10 blur-[150px] rounded-full pointer-events-none" />

      <main className="relative z-10 max-w-3xl mx-auto px-5 py-10 md:py-14">
        <section className="text-center text-white mb-8">
          <div className="mx-auto w-24 h-24 bg-white rounded-[2rem] p-3 shadow-2xl border border-white/30 mb-6">
            <img src={APP_CONFIG.LOGO_URL} alt="وزارة التعليم" className="w-full h-full object-contain" />
          </div>
          <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white/10 border border-white/10 text-blue-200 text-[10px] font-black tracking-[0.25em] mb-5">
            <ShieldCheck size={14} />
            بوابة استعلام الطلاب
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-tight">
            {schoolName || 'استعلام اللجنة ورقم الجلوس'}
          </h1>
          <p className="text-blue-100/60 font-bold mt-3">
            أدخل الهوية أو السجل المدني أو الرقم المسجل لمعرفة بيانات اللجنة.
          </p>
        </section>

        <section className="bg-white/10 backdrop-blur-2xl border border-white/15 rounded-[3rem] p-5 md:p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-white/35" size={22} />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setHasSearched(false);
                }}
                placeholder="رقم الهوية أو السجل المدني أو رقم الطالب"
                inputMode="numeric"
                className="w-full bg-white/10 border border-white/10 rounded-[1.8rem] pr-14 pl-5 py-5 text-white placeholder:text-white/35 font-black text-center outline-none focus:border-blue-300 focus:bg-white/15 transition-all"
              />
            </div>
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-5 rounded-[1.8rem] font-black flex items-center justify-center gap-3 shadow-xl shadow-blue-900/30 active:scale-[0.98] transition-all"
            >
              <Sparkles size={20} />
              بحث
            </button>
          </form>
        </section>

        {hasSearched && result && (
          <section className="mt-8 bg-white rounded-[3rem] p-7 md:p-9 shadow-2xl border-b-[10px] border-blue-600 animate-slide-up">
            <div className="flex flex-col md:flex-row md:items-center gap-6 mb-8">
              <div className="w-20 h-20 bg-blue-600 text-white rounded-[2rem] flex items-center justify-center shadow-xl">
                <GraduationCap size={42} />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-black text-blue-600 tracking-[0.25em] mb-2">بطاقة الطالب الاختبارية</p>
                <h2 className="text-3xl font-black text-slate-950 leading-tight">{result.name}</h2>
                <p className="text-slate-400 font-bold mt-1">{schoolName || 'مدرستك'}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoTile icon={MapPinned} label="رقم اللجنة" value={result.committee_number || 'غير محدد'} color="blue" />
              <InfoTile icon={TicketCheck} label="رقم الجلوس" value={result.seating_number || 'غير محدد'} color="emerald" />
              <InfoTile icon={UserRound} label="اسم الطالب" value={result.name} color="slate" />
              <InfoTile icon={Hash} label="الصف / الفصل" value={`${result.grade || '-'} ${result.section ? `- فصل ${result.section}` : ''}`} color="amber" />
            </div>
          </section>
        )}

        {hasSearched && !result && (
          <section className="mt-8 bg-white rounded-[3rem] p-10 text-center shadow-2xl animate-slide-up">
            <div className="w-20 h-20 mx-auto bg-amber-50 text-amber-600 rounded-[2rem] flex items-center justify-center mb-5">
              <Search size={38} />
            </div>
            <h2 className="text-2xl font-black text-slate-900">لم يتم العثور على الطالب</h2>
            <p className="text-slate-400 font-bold mt-2">تأكد من الرقم المدخل كما هو مسجل في المدرسة.</p>
          </section>
        )}

        <p className="text-center text-white/25 text-[10px] font-black tracking-[0.25em] mt-10">
          SMART EXAM CONTROL SYSTEM
        </p>
      </main>
    </div>
  );
};

const InfoTile = ({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: string;
  color: 'blue' | 'emerald' | 'slate' | 'amber';
}) => {
  const styles = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    slate: 'bg-slate-50 text-slate-700 border-slate-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
  }[color];

  return (
    <div className={`p-5 rounded-[2rem] border ${styles}`}>
      <div className="flex items-center gap-3 mb-3">
        <Icon size={22} />
        <span className="text-[10px] font-black tracking-[0.2em]">{label}</span>
      </div>
      <p className="text-2xl font-black text-slate-950 break-words">{value}</p>
    </div>
  );
};

export default StudentLookupView;
