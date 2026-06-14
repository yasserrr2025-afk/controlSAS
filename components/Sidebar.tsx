
import React from 'react';
import { 
  LayoutDashboard, Users, GraduationCap, ClipboardList, LogOut, LayoutGrid,
  ShieldAlert, Inbox, FileText, Settings, X, ChevronRight, ChevronLeft,
  History, IdCard, UserCircle, ShieldCheck, ShieldHalf, Bell, Shield,
  Monitor, Fingerprint, MonitorPlay, Award, LayoutPanelTop, QrCode,
  FileSpreadsheet, MessageSquareQuote, CalendarDays, BrainCircuit, BookOpen, PackageSearch, BarChart3
} from 'lucide-react';
import { UserRole, User, ControlRequest } from '../types';
import { APP_CONFIG, ROLES_ARABIC } from '../constants';

interface SidebarLink {
  id: string;
  label: string;
  icon: any;
  badge?: number | null;
}

interface SidebarProps {
  user: User;
  onLogout: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  controlRequests?: ControlRequest[];
}

const Sidebar: React.FC<SidebarProps> = ({ 
  user, onLogout, activeTab, setActiveTab, isOpen, setIsOpen, isCollapsed, setIsCollapsed, controlRequests = []
}) => {
  const role = user?.role || 'PROCTOR';
  
  const pendingCount = controlRequests.filter(r => 
    (role === 'PROCTOR' ? r.from === user.full_name : user.assigned_committees?.includes(r.committee)) && 
    (r.status === 'PENDING' || r.status === 'IN_PROGRESS')
  ).length;

  const adminLinks: SidebarLink[] = [
    { id: 'print-sheets', label: 'كشوف', icon: FileSpreadsheet },
    { id: 'head-dash', label: 'غرفة العمليات', icon: LayoutPanelTop },
    { id: 'dashboard', label: 'الإحصائيات العامة', icon: LayoutDashboard },
    { id: 'control-monitor', label: 'لوحة العرض (TV)', icon: MonitorPlay },
    { id: 'control-monitor-2', label: 'لوحة العرض (TV2)', icon: Monitor },
    { id: 'control-manager', label: 'مركز القيادة', icon: ShieldHalf },
    { id: 'ai-insights', label: 'المحلل الذكي (AI)', icon: BrainCircuit },
    { id: 'comprehensive-stats', label: 'إحصائيات شاملة', icon: BarChart3 },
    { id: 'master-portfolio', label: 'ملف الإنجاز', icon: BookOpen },
    { id: 'proctor-excellence', label: 'سجل التميز', icon: Award },
    { id: 'archive-boxes', label: 'أرشيف الصناديق', icon: PackageSearch },
    { id: 'committee-labels', label: 'ملصقات اللجان (QR)', icon: QrCode },
    { id: 'door-labels', label: 'ملصقات الأبواب', icon: QrCode },
    { id: 'teachers', label: 'الصلاحيات', icon: Users },
    { id: 'students', label: 'الطلاب', icon: GraduationCap },
    { id: 'seating-planner', label: 'توزيع المقاعد', icon: LayoutGrid },
    { id: 'committees', label: 'المراقبة', icon: ClipboardList },
    { id: 'daily-reports', label: 'التقارير اليومية', icon: FileSpreadsheet },
    { id: 'official-forms', label: 'النماذج (الغياب والتأخير)', icon: FileText },
    { id: 'envelope-opening', label: 'فتح المظاريف', icon: Inbox },
    { id: 'paper-logs', label: 'استلام المظاريف', icon: Inbox },
    { id: 'envelope-labels', label: 'ملصقات المظاريف', icon: QrCode },
    { id: 'settings', label: 'إعدادات النظام', icon: Settings },
  ];

  const controlManagerLinks: SidebarLink[] = [
    { id: 'head-dash', label: 'غرفة العمليات', icon: LayoutPanelTop },
    { id: 'control-manager', label: 'مركز القيادة', icon: ShieldHalf },
    { id: 'envelope-opening', label: 'فتح المظاريف', icon: Inbox },
    { id: 'paper-logs', label: 'استلام المظاريف', icon: Inbox },
    { id: 'receipt-history', label: 'سجل العمليات', icon: History },
  ];

  const proctorLinks: SidebarLink[] = [
    { id: 'my-tasks', label: 'رصد اللجنة', icon: ClipboardList },
    { id: 'my-schedule', label: 'جدول مراقبتي', icon: CalendarDays },
    { id: 'proctor-alerts', label: 'سجل البلاغات', icon: MessageSquareQuote, badge: pendingCount > 0 ? pendingCount : null },
    { id: 'digital-id', label: 'الهوية الرقمية', icon: Fingerprint },
  ];

  const counselorLinks: SidebarLink[] = [
    { id: 'student-absences', label: 'متابعة الغياب', icon: Users },
  ];

  const controlLinks: SidebarLink[] = [
    { id: 'envelope-opening', label: 'فتح المظاريف', icon: Inbox },
    { id: 'paper-logs', label: 'استلام المظاريف', icon: Inbox },
    { id: 'receipt-history', label: 'سجل العمليات', icon: History },
  ];

  const assistantControlLinks: SidebarLink[] = [
    { id: 'assigned-requests', label: 'بلاغات اللجان', icon: ShieldAlert, badge: pendingCount > 0 ? pendingCount : null },
  ];

  const links = role === 'ADMIN' ? adminLinks : 
                role === 'CONTROL_MANAGER' ? controlManagerLinks :
                role === 'PROCTOR' ? proctorLinks : 
                role === 'COUNSELOR' ? counselorLinks : 
                role === 'ASSISTANT_CONTROL' ? assistantControlLinks :
                controlLinks;

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] lg:hidden" onClick={() => setIsOpen(false)}/>
      )}

      <div
        style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
        className={`fixed right-0 top-0 h-full bg-gradient-to-b from-[#020817] via-[#0a1628] to-[#020617] text-white shadow-2xl z-[110] flex flex-col transition-all duration-300 ${isOpen ? 'translate-x-0 w-80' : 'translate-x-full lg:translate-x-0'} ${!isOpen && isCollapsed ? 'lg:w-24' : 'lg:w-80'}`}
      >
        <div className="p-6 border-b border-white/[0.06] bg-white/[0.02] flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center p-1 shrink-0 shadow-[0_0_15px_rgba(255,255,255,0.1)] ring-2 ring-white/10">
               <img src={APP_CONFIG.LOGO_URL} alt="Logo" className="w-full h-full object-contain" />
            </div>
            {(!isCollapsed || isOpen) && (
              <div className="animate-fade-in whitespace-nowrap text-right">
                <h1 className="text-lg font-black text-blue-400 leading-none tracking-tighter uppercase">كنترول الاختبارات</h1>
                <p className="text-[9px] text-slate-500 font-bold mt-1 uppercase tracking-widest">Smart Control System</p>
              </div>
            )}
          </div>
          <button onClick={() => setIsCollapsed(!isCollapsed)} className="hidden lg:flex p-2 bg-white/5 text-slate-400 hover:text-white rounded-xl transition-colors">
            {isCollapsed ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto custom-scrollbar">
          {links.map((link) => (
            <button
              key={link.id}
              onClick={() => { setActiveTab(link.id); setIsOpen(false); }}
              className={`w-full flex items-center px-4 py-3.5 rounded-2xl transition-all duration-200 group relative ${isCollapsed && !isOpen ? 'justify-center' : 'gap-3.5 flex-row-reverse'} ${activeTab === link.id ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-[0_4px_20px_rgba(37,99,235,0.35)]' : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-100'}`}
            >
              <link.icon size={22} className={activeTab === link.id ? 'animate-pulse' : 'shrink-0 group-hover:scale-110 transition-transform'} />
              {(!isCollapsed || isOpen) && <span className="font-bold text-sm flex-1 text-right">{link.label}</span>}
              {link.badge && (
                <span className={`absolute ${isCollapsed && !isOpen ? 'top-2 right-2' : 'left-4'} bg-red-600 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center animate-bounce border-2 border-[#020817]`}>
                  {link.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {(!isCollapsed || isOpen) && (
          <div className="px-4 pb-4">
            <div className="relative rounded-[1.8rem] overflow-hidden">
              {/* خلفية الكارت */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#0f1e35] to-[#0a1525] border border-blue-500/20 rounded-[1.8rem] shadow-[0_0_30px_rgba(37,99,235,0.15)]" />
              {/* توهج أزرق علوي */}
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-32 h-12 bg-blue-600/30 blur-2xl rounded-full" />

              <div className="relative z-10 p-5 flex flex-col items-center gap-0">
                {/* الشعار مع إطار ضوئي */}
                <div className="relative mb-3">
                  <div className="absolute inset-0 bg-blue-500/20 rounded-2xl blur-md scale-110" />
                  <div className="relative w-16 h-16 bg-white rounded-2xl p-2 shadow-[0_4px_24px_rgba(37,99,235,0.25)] border border-white/20">
                    <img src={APP_CONFIG.LOGO_URL} alt="Logo" className="w-full h-full object-contain" />
                  </div>
                  {/* نقطة أون لاين */}
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-[#0f1729] shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
                </div>

                {/* الاسم كاملاً */}
                <h4 className="text-white font-black text-center text-sm leading-snug break-words w-full px-1 mb-3">
                  {user.full_name}
                </h4>

                {/* الدور */}
                <div className="inline-flex items-center gap-1.5 bg-blue-600/20 border border-blue-500/30 text-blue-300 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">
                  <ShieldCheck size={11} />
                  {ROLES_ARABIC[user.role]}
                </div>

                {/* شريط الحالة */}
                <div className="mt-4 w-full border-t border-white/5 pt-3 flex items-center justify-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em]">متصل الآن · Smart Control</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="p-4 border-t border-white/5">
          <button onClick={onLogout} className={`w-full flex items-center px-4 py-4 text-red-400 hover:bg-red-500/15 hover:text-red-400 rounded-2xl transition-all duration-200 font-bold text-sm ${isCollapsed && !isOpen ? 'justify-center' : 'gap-4 flex-row-reverse'}`}>
            <LogOut size={20} className="shrink-0" />
            {(!isCollapsed || isOpen) && <span className="flex-1 text-right">تسجيل الخروج</span>}
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
