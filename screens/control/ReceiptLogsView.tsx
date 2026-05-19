
import React, { useMemo, useState } from 'react';
import { DeliveryLog, User } from '../../types';
import { History, Calendar, Search, Filter, CheckCircle2, UserCircle, PackageCheck, Clock, Download, ChevronDown, ListFilter, LayoutGrid, Globe } from 'lucide-react';

interface Props {
  deliveryLogs: DeliveryLog[];
  users: User[];
}

const ReceiptLogsView: React.FC<Props> = ({ deliveryLogs, users }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showFullLogs, setShowFullLogs] = useState(false);

  const filteredLogs = useMemo(() => {
    return deliveryLogs
      .filter(log => log.type === 'RECEIVE')
      .filter(log => {
        const matchesSearch = 
          log.committee_number.includes(searchTerm) || 
          log.proctor_name?.includes(searchTerm) || 
          log.grade.includes(searchTerm) ||
          log.teacher_name.includes(searchTerm);
        
        const matchesDate = showFullLogs ? true : log.time.startsWith(selectedDate);
        
        return matchesSearch && matchesDate;
      })
      .sort((a, b) => b.time.localeCompare(a.time));
  }, [deliveryLogs, searchTerm, selectedDate, showFullLogs]);

  const stats = useMemo(() => {
    const daily = deliveryLogs.filter(l => l.type === 'RECEIVE' && l.time.startsWith(selectedDate));
    return {
      dailyCount: daily.length,
      totalCount: deliveryLogs.filter(l => l.type === 'RECEIVE').length
    };
  }, [deliveryLogs, selectedDate]);

  return (
    <div className="space-y-10 animate-fade-in text-right pb-32">
      <div className="flex flex-col md:flex-row justify-between items-end gap-6 border-b pb-8">
        <div className="flex flex-col gap-2">
          <div className="bg-blue-600 text-white px-6 py-1.5 rounded-full text-[10px] font-black w-fit shadow-lg uppercase tracking-widest">سجلات التوثيق المركزية</div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter">سجل عمليات الاستلام</h2>
        </div>
        <div className="flex gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 custom-scrollbar">
           <div className="bg-emerald-50 text-emerald-600 px-6 py-4 rounded-[2rem] border border-emerald-100 flex flex-col items-center min-w-[130px] shrink-0 shadow-sm">
             <span className="text-[10px] font-black uppercase mb-1 opacity-60">استلام اليوم</span>
             <span className="text-3xl font-black tabular-nums">{stats.dailyCount}</span>
           </div>
           <div className="bg-slate-950 text-white px-6 py-4 rounded-[2rem] flex flex-col items-center min-w-[130px] shrink-0 shadow-xl">
             <span className="text-[10px] font-black uppercase opacity-40 mb-1">الإجمالي الشامل</span>
             <span className="text-3xl font-black tabular-nums">{stats.totalCount}</span>
           </div>
        </div>
      </div>

      {/* Segmented Control - مبدل السجلات العصري */}
      <div className="bg-slate-200/50 p-1.5 rounded-[1.8rem] flex gap-1 shadow-inner max-w-md mx-auto no-print">
        <button 
          onClick={() => setShowFullLogs(false)}
          className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-[1.5rem] font-black text-sm transition-all ${!showFullLogs ? 'bg-white text-slate-900 shadow-md' : 'text-slate-500 hover:bg-slate-300/50'}`}
        >
          <Calendar size={18} />
          السجل اليومي
        </button>
        <button 
          onClick={() => setShowFullLogs(true)}
          className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-[1.5rem] font-black text-sm transition-all ${showFullLogs ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-300/50'}`}
        >
          <Globe size={18} />
          السجل الشامل
        </button>
      </div>

      <div className="bg-white p-6 md:p-8 rounded-[3rem] shadow-xl border border-slate-100 flex flex-col lg:flex-row gap-6 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400" size={22} />
          <input 
            type="text" 
            placeholder="بحث في السجل..." 
            className="w-full pr-14 pl-6 py-5 bg-slate-50 border-2 border-slate-50 rounded-[2rem] font-bold outline-none focus:border-blue-600 transition-all shadow-inner text-slate-800 placeholder:text-slate-300"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        {!showFullLogs && (
          <div className="relative flex-1 w-full lg:w-64">
            <Calendar className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="date" 
              className="w-full pr-14 pl-6 py-5 bg-slate-50 border-2 border-slate-50 rounded-[2rem] font-bold outline-none focus:border-blue-600 transition-all shadow-inner text-slate-800"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="space-y-6">
        {filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-40 bg-white/50 backdrop-blur-xl rounded-[4rem] border-2 border-dashed border-slate-200 text-slate-300 gap-8">
            <div className="w-28 h-28 bg-slate-100 rounded-full flex items-center justify-center shadow-inner">
              <History size={64} className="opacity-40 animate-pulse" />
            </div>
            <p className="text-3xl font-black italic">لا توجد سجلات مطابقة</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {filteredLogs.map((log) => (
              <div key={log.id} className="bg-white p-6 md:p-10 rounded-[3.5rem] border border-slate-100 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all group relative overflow-hidden flex flex-col gap-6 md:gap-0 md:flex-row md:items-center">
                <div className="absolute top-0 right-0 w-2 h-full bg-emerald-500 opacity-40 group-hover:opacity-100 transition-opacity"></div>
                
                <div className="flex items-center gap-5 md:gap-8 flex-1 min-w-0">
                  <div className="w-16 h-16 md:w-24 md:h-24 bg-slate-950 text-white rounded-[1.8rem] md:rounded-[2.5rem] flex flex-col items-center justify-center shadow-xl shrink-0 group-hover:bg-blue-600 transition-colors">
                    <span className="text-[9px] opacity-40 uppercase mb-1 font-black leading-none">لجنة</span>
                    <span className="text-2xl md:text-4xl font-black tabular-nums leading-none">{log.committee_number}</span>
                  </div>
                  
                  <div className="flex-1 min-w-0 space-y-4">
                    <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                      <h5 className="text-xl md:text-3xl font-black text-slate-900 whitespace-normal break-words leading-tight">{log.grade}</h5>
                      <div className="flex items-center gap-2 text-emerald-600 font-black text-[9px] uppercase bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 w-fit shrink-0">
                        <CheckCircle2 size={10}/> موثق نظامياً
                      </div>
                    </div>
                    
                    <div className="flex flex-col lg:flex-row gap-3 md:gap-4 pt-4 border-t border-slate-50">
                      <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100 flex-1 min-w-0">
                        <UserCircle size={18} className="text-slate-400 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[8px] font-black text-slate-400 uppercase leading-none mb-1">المراقب المسلم</p>
                          <p className="text-[11px] md:text-xs font-black text-slate-700 whitespace-normal break-words">{log.proctor_name}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 bg-blue-50/50 p-3 rounded-2xl border border-blue-100 flex-1 min-w-0">
                        <PackageCheck size={18} className="text-blue-500 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[8px] font-black text-blue-400 uppercase leading-none mb-1">عضو الكنترول</p>
                          <p className="text-[11px] md:text-xs font-black text-blue-900 whitespace-normal break-words">{log.teacher_name}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center border-t md:border-t-0 md:border-r border-slate-100 pt-5 md:pt-0 md:pr-10 shrink-0">
                  <div className="flex flex-col items-end">
                    <div className="text-3xl md:text-5xl font-black text-slate-900 tabular-nums flex items-center gap-2">
                      <Clock size={28} className="text-slate-300" />
                      {new Date(log.time).toLocaleTimeString('ar-SA', {hour:'2-digit', minute:'2-digit'})}
                    </div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">وقت التوثيق</p>
                  </div>
                  {(showFullLogs || true) && (
                    <div className="text-[10px] font-black text-slate-400 bg-slate-100 px-4 py-1.5 rounded-full mt-2 md:mt-4 shadow-sm border border-slate-200">
                      {new Date(log.time).toLocaleDateString('ar-SA')}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-slate-950 p-8 md:p-14 rounded-[4rem] text-white flex flex-col md:flex-row justify-between items-center gap-8 relative overflow-hidden group shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 blur-[100px] rounded-full -mr-32 -mt-32 transition-all group-hover:bg-blue-600/30"></div>
        <div className="relative z-10 text-center md:text-right space-y-3">
          <h4 className="text-xl md:text-3xl font-black flex items-center gap-4 justify-center md:justify-start">
             تصدير أرشيف العمليات <Download className="text-blue-400 animate-bounce" size={28}/>
          </h4>
          <p className="text-slate-400 text-[11px] md:text-sm font-bold leading-relaxed max-w-lg">استخراج التقارير الرسمية بصيغة إكسل لمراجعة أعمال الكنترول النهائية.</p>
        </div>
        <button className="bg-white text-slate-950 px-12 py-5 rounded-[2rem] font-black text-lg shadow-2xl hover:bg-blue-50 transition-all active:scale-95 shrink-0">
          تحميل كشف (XLSX)
        </button>
      </div>
    </div>
  );
};

export default ReceiptLogsView;
