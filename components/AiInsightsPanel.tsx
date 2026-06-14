import React, { useState } from 'react';
import { BrainCircuit, Users, Clock, PackageCheck, AlertOctagon, Loader2, Info, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { fetchAIAnalysis, AiInsightsResult } from '../services/aiService';

interface Props {
  apiKey: string;
  dataContext: any;
}

const AiInsightsPanel: React.FC<Props> = ({ apiKey, dataContext }) => {
  const [loading, setLoading] = useState(false);
  const [activeAnalysis, setActiveAnalysis] = useState<string | null>(null);
  const [insights, setInsights] = useState<AiInsightsResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalysis = async (type: 'absence' | 'proctor' | 'receipt' | 'errors') => {
    if (!apiKey) {
      setError('يرجى إضافة مفتاح OpenRouter API في إعدادات النظام أولاً ليتمكن الذكاء الاصطناعي من العمل.');
      return;
    }

    setLoading(true);
    setError(null);
    setActiveAnalysis(type);
    
    let contextToSend = {};
    if (type === 'absence') contextToSend = dataContext.students?.filter((s:any) => s.status === 'ABSENT' || s.status === 'LATE') || [];
    if (type === 'proctor') contextToSend = dataContext.supervision || [];
    if (type === 'receipt') contextToSend = dataContext.deliveryLogs || [];
    if (type === 'errors') contextToSend = dataContext.requests?.filter((r:any) => r.status !== 'CLOSED') || [];

    try {
      const result = await fetchAIAnalysis(apiKey, contextToSend, type);
      setInsights(result);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء الاتصال بالذكاء الاصطناعي.');
      setInsights(null);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle2 className="w-6 h-6 text-emerald-500" />;
      case 'warning': return <AlertTriangle className="w-6 h-6 text-amber-500" />;
      case 'danger': return <XCircle className="w-6 h-6 text-red-500" />;
      default: return <Info className="w-6 h-6 text-blue-500" />;
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'success': return 'bg-emerald-50 border-emerald-100';
      case 'warning': return 'bg-amber-50 border-amber-100';
      case 'danger': return 'bg-red-50 border-red-100';
      default: return 'bg-blue-50 border-blue-100';
    }
  };

  return (
    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-md p-6 lg:p-8 space-y-8 relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-500/10 to-fuchsia-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />
      
      <div className="flex items-center gap-4 border-b border-slate-100 pb-6">
        <div className="p-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg shadow-indigo-500/20 text-white animate-pulse">
          <BrainCircuit className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">محلل البيانات الذكي (AI)</h2>
          <p className="text-slate-500 text-sm font-bold mt-1">اضغط على أحد القطاعات لتوليد تقرير وتقييم فوري</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button 
          onClick={() => handleAnalysis('absence')}
          disabled={loading}
          className={`flex flex-col items-center gap-3 p-5 rounded-2xl border transition-all duration-300 disabled:opacity-50 ${activeAnalysis === 'absence' ? 'bg-indigo-50 border-indigo-300 shadow-inner' : 'border-slate-200 bg-slate-50 hover:bg-white hover:border-indigo-300 hover:shadow-lg hover:-translate-y-1'}`}
        >
          <div className="p-3 bg-blue-100 text-blue-600 rounded-xl"><Users className="w-6 h-6" /></div>
          <span className="font-black text-sm text-center text-slate-700">الغياب والتأخر</span>
        </button>

        <button 
          onClick={() => handleAnalysis('proctor')}
          disabled={loading}
          className={`flex flex-col items-center gap-3 p-5 rounded-2xl border transition-all duration-300 disabled:opacity-50 ${activeAnalysis === 'proctor' ? 'bg-indigo-50 border-indigo-300 shadow-inner' : 'border-slate-200 bg-slate-50 hover:bg-white hover:border-indigo-300 hover:shadow-lg hover:-translate-y-1'}`}
        >
          <div className="p-3 bg-amber-100 text-amber-600 rounded-xl"><Clock className="w-6 h-6" /></div>
          <span className="font-black text-sm text-center text-slate-700">انضباط المراقبين</span>
        </button>

        <button 
          onClick={() => handleAnalysis('receipt')}
          disabled={loading}
          className={`flex flex-col items-center gap-3 p-5 rounded-2xl border transition-all duration-300 disabled:opacity-50 ${activeAnalysis === 'receipt' ? 'bg-indigo-50 border-indigo-300 shadow-inner' : 'border-slate-200 bg-slate-50 hover:bg-white hover:border-indigo-300 hover:shadow-lg hover:-translate-y-1'}`}
        >
          <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl"><PackageCheck className="w-6 h-6" /></div>
          <span className="font-black text-sm text-center text-slate-700">سرعة الاستلام</span>
        </button>

        <button 
          onClick={() => handleAnalysis('errors')}
          disabled={loading}
          className={`flex flex-col items-center gap-3 p-5 rounded-2xl border transition-all duration-300 disabled:opacity-50 ${activeAnalysis === 'errors' ? 'bg-indigo-50 border-indigo-300 shadow-inner' : 'border-slate-200 bg-slate-50 hover:bg-white hover:border-indigo-300 hover:shadow-lg hover:-translate-y-1'}`}
        >
          <div className="p-3 bg-red-100 text-red-600 rounded-xl"><AlertOctagon className="w-6 h-6" /></div>
          <span className="font-black text-sm text-center text-slate-700">ملخص الأخطاء</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 border border-red-200 rounded-2xl font-bold flex items-center gap-3 animate-fade-in">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-12 gap-4 animate-fade-in">
          <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
          <p className="text-slate-500 font-bold animate-pulse">يقوم الذكاء الاصطناعي ببناء لوحة القياس المعقدة...</p>
        </div>
      )}

      {!loading && insights && (
        <div className="space-y-6 animate-fade-in border-t border-slate-100 pt-8">
          <h3 className="text-xl font-black text-slate-800">مؤشرات الأداء المستخرجة</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {insights.metrics.map((metric, idx) => (
              <div key={idx} className={`p-5 rounded-[1.5rem] border flex items-center justify-between shadow-sm transition-all hover:shadow-md ${getStatusBg(metric.status)}`}>
                <div>
                  <p className="text-slate-600 font-bold text-sm mb-1">{metric.title}</p>
                  <p className="text-2xl font-black text-slate-900">{metric.value}</p>
                </div>
                <div className="shrink-0">{getStatusIcon(metric.status)}</div>
              </div>
            ))}
          </div>

          <div className="bg-gradient-to-br from-[#0a1628] to-[#0f172a] text-white p-6 lg:p-8 rounded-[1.5rem] shadow-xl mt-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl -z-10" />
            <h3 className="text-lg font-black mb-5 flex items-center gap-2">
              <BrainCircuit className="w-5 h-5 text-indigo-400" />
              الاستنتاجات والتوصيات الذكية
            </h3>
            <ul className="space-y-4">
              {insights.insights.map((insight, idx) => (
                <li key={idx} className="flex gap-4 items-start">
                  <div className="w-2 h-2 rounded-full bg-indigo-500 mt-2 shrink-0 shadow-[0_0_10px_rgba(99,102,241,0.8)]" />
                  <span className="text-slate-300 leading-relaxed font-medium text-sm md:text-base">{insight}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default AiInsightsPanel;
