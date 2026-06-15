
import React, { useState, useEffect, useCallback } from 'react';
import { User, Student, Absence, Supervision, ControlRequest, DeliveryLog, SystemConfig, CommitteeReport, ExamSchedule } from './types';
import Sidebar from './components/Sidebar';
import Login from './screens/Login';
import AdminDashboardOverview from './screens/admin/DashboardOverview';
import AdminUsersManager from './screens/admin/UsersManager';
import AdminStudentsManager from './screens/admin/StudentsManager';
import AdminSupervisionMonitor from './screens/admin/SupervisionMonitor';
import AdminDailyReports from './screens/admin/DailyReports';
import AdminOfficialForms from './screens/admin/OfficialForms';
import AdminSystemSettings from './screens/admin/SystemSettings';
import AdminProctorPerformance from './screens/admin/ProctorPerformance';
import PrintSheets from './screens/admin/PrintSheets';
import SeatingPlanner from './screens/admin/SeatingPlanner';
import { ArchiveBoxesManager } from './screens/admin/ArchiveBoxesManager';
import { MasterPortfolio } from './screens/admin/MasterPortfolio';
import AiDashboard from './screens/admin/AiDashboard';
import ComprehensiveStats from './screens/admin/ComprehensiveStats';
import CommitteeLabelsPrint from './screens/admin/CommitteeLabelsPrint';
import ControlHeadDashboard from './screens/admin/ControlHeadDashboard';
import ControlManager from './screens/admin/ControlManager';
import { SmartDistributionItem } from './screens/admin/SmartProctorDistribution';
import ControlRoomMonitor from './screens/admin/ControlRoomMonitor';
import ControlRoomMonitor2 from './screens/admin/ControlRoomMonitor2';
import ProctorDailyAssignmentFlow from './screens/proctor/DailyAssignmentFlow';
import ProctorAlertsHistory from './screens/proctor/ProctorAlertsHistory';
import ProctorScheduleView from './screens/proctor/ProctorScheduleView';
import TeacherBadgeView from './screens/proctor/TeacherBadgeView';
import CounselorAbsenceMonitor from './screens/counselor/AbsenceMonitor';
import ControlReceiptView from './screens/control/ReceiptView';
import ReceiptLogsView from './screens/control/ReceiptLogsView';
import AssistantControlView from './screens/control/AssistantControlView';
import EnvelopeOpeningView from './screens/control/EnvelopeOpeningView';
import EnvelopeLabelsPrint from './screens/admin/EnvelopeLabelsPrint';
import DoorLabelsPrint from './screens/admin/DoorLabelsPrint';
import CommitteePublicView from './screens/public/CommitteePublicView';
import StudentLookupView from './screens/public/StudentLookupView';
import StudentCommitteeInquiry from './screens/public/StudentCommitteeInquiry';
import SupervisionVerification from './screens/public/SupervisionVerification';
import { PublicBoxReport } from './screens/public/PublicBoxReport';
import { buildAbsenceReceiptNote, getAbsenceKindLabel } from './services/absenceReceipt';
import {
  BrowserNotificationPermission,
  getBrowserNotificationPermission,
  registerAppServiceWorker,
  requestBrowserNotificationPermission,
  showBrowserNotification
} from './services/browserNotifications';
import GlobalQRScanner from './components/GlobalQRScanner';
import { BellRing, Menu, X, CheckCircle2, AlertCircle, Info, AlertTriangle, Loader2 } from 'lucide-react';
import { db, getActiveTenantId, getSupabaseConfigStatus, setActiveTenant, supabase } from './supabase';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<string>(localStorage.getItem('activeTab') || '');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(window.innerWidth < 1024);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  
  const [users, setUsers] = useState<User[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [supervisions, setSupervisions] = useState<Supervision[]>([]);
  const [allSupervisions, setAllSupervisions] = useState<Supervision[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [notifications, setNotifications] = useState<{id: string, text: string, type: 'success' | 'error' | 'info' | 'warning'}[]>([]);
  const [browserNotificationPermission, setBrowserNotificationPermission] = useState<BrowserNotificationPermission>('unsupported');
  const [controlRequests, setControlRequests] = useState<ControlRequest[]>([]);
  const [deliveryLogs, setDeliveryLogs] = useState<DeliveryLog[]>([]);
  const [committeeReports, setCommitteeReports] = useState<CommitteeReport[]>([]);
  const [examSchedule, setExamSchedule] = useState<ExamSchedule[]>([]);
  const [systemConfig, setSystemConfig] = useState<SystemConfig>({ 
    id: 'main_config', 
    exam_start_time: '08:00', 
    exam_date: '',
    active_exam_date: new Date().toISOString().split('T')[0],
    allow_manual_join: false
  });

  const addLocalNotification = (input: any, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    const msg = typeof input === 'string' ? input : (input?.message || "تنبيه جديد من النظام");
    setNotifications(prev => [{ id, text: msg, type }, ...prev]);
    if (type === 'error' || type === 'warning' || type === 'info') {
      showBrowserNotification('كنترول الاختبارات', msg);
    }
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 5000);
  };

  useEffect(() => {
    registerAppServiceWorker();
    setBrowserNotificationPermission(getBrowserNotificationPermission());
  }, []);

  const enableBrowserNotifications = async () => {
    const permission = await requestBrowserNotificationPermission();
    setBrowserNotificationPermission(permission);
    if (permission === 'granted') {
      await showBrowserNotification('تم تفعيل الإشعارات', 'ستظهر التنبيهات المهمة على شاشة الجهاز.');
      addLocalNotification('تم تفعيل إشعارات الجوال والتنبيهات بنجاح.', 'success');
    } else if (permission === 'denied') {
      addLocalNotification('تم منع الإشعارات من المتصفح. فعلها من إعدادات الموقع.', 'warning');
    }
  };

  const fetchData = useCallback(async () => {
    try {
      const publicTenantSlug = new URLSearchParams(window.location.search).get('tenant');
      if (publicTenantSlug) await db.tenants.resolveBySlug(publicTenantSlug);
      if (!getActiveTenantId()) {
        setIsInitialLoading(false);
        return;
      }
      const cfg = await db.config.get();
      let filterDate = systemConfig.active_exam_date;
      if (cfg) {
        setSystemConfig(prev => ({ ...prev, ...cfg }));
        filterDate = cfg.active_exam_date || filterDate;
      }
      const [u, s, sv, ab, cr, dl, reports, exams] = await Promise.all([
        db.users.getAll(),
        db.students.getAll(),
        db.supervision.getAll(),
        db.absences.getAll(),
        db.controlRequests.getAll(),
        db.deliveryLogs.getAll(),
        db.committeeReports.getAll(),
        db.examSchedule.getAll(),
      ]);
      setUsers(u);
      const savedUser = localStorage.getItem('currentUser');
      if (savedUser) {
        try {
          const cachedUser = JSON.parse(savedUser) as User;
          const freshUser = u.find(user => user.id === cachedUser.id || user.national_id === cachedUser.national_id);
          if (freshUser) {
            setCurrentUser(freshUser);
            localStorage.setItem('currentUser', JSON.stringify(freshUser));
            if (freshUser.tenant_id && freshUser.tenant_slug) {
              setActiveTenant({ id: freshUser.tenant_id, slug: freshUser.tenant_slug });
            }
          } else {
            setCurrentUser(null);
            localStorage.removeItem('currentUser');
            localStorage.removeItem('activeTab');
            setActiveTab('');
          }
        } catch {
          setCurrentUser(null);
          localStorage.removeItem('currentUser');
          localStorage.removeItem('activeTab');
          setActiveTab('');
        }
      }
      setStudents(s);
      setAllSupervisions(sv);
      setExamSchedule(exams);
      
      if (filterDate) {
        setSupervisions(sv.filter(i => i.date && i.date.startsWith(filterDate))); 
        setAbsences(ab.filter(i => i.date && i.date.startsWith(filterDate))); 
        setDeliveryLogs(dl.filter(i => i.time && i.time.startsWith(filterDate)));
        setControlRequests(cr.filter(i => i.time && i.time.startsWith(filterDate)));
        setCommitteeReports(reports.filter(r => r.date && r.date.startsWith(filterDate)));
      }
    } catch (err: any) {
      console.warn("Sync Warning:", err.message);
    } finally {
      setIsInitialLoading(false);
    }
  }, [systemConfig.active_exam_date]);

  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try { 
        const user = JSON.parse(savedUser);
        if (user.tenant_id && user.tenant_slug) setActiveTenant({ id: user.tenant_id, slug: user.tenant_slug });
        setCurrentUser(user);
        if (!activeTab) {
          const defaultTab = 
            user.role === 'ADMIN'             ? 'dashboard' :
            user.role === 'CONTROL_MANAGER'   ? 'head-dash' :
            user.role === 'ASSISTANT_CONTROL' ? 'assigned-requests' :
            user.role === 'CONTROL'           ? 'paper-logs' :
            user.role === 'COUNSELOR'         ? 'student-absences' :
            'my-tasks';
          setActiveTab(defaultTab);
        }
      } catch (e) { 
        localStorage.removeItem('currentUser'); 
      }
    }
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleLogout = () => {
    setCurrentUser(null);
    setActiveTenant(null);
    localStorage.removeItem('currentUser');
    localStorage.removeItem('activeTab');
    setActiveTab('');
  };

  const handleLoginSuccess = (u: User) => {
    setCurrentUser(u);
    if (u.tenant_id && u.tenant_slug) setActiveTenant({ id: u.tenant_id, slug: u.tenant_slug });
    localStorage.setItem('currentUser', JSON.stringify(u));
    const defaultTab =
      u.role === 'ADMIN'             ? 'dashboard' :
      u.role === 'CONTROL_MANAGER'   ? 'head-dash' :
      u.role === 'ASSISTANT_CONTROL' ? 'assigned-requests' :
      u.role === 'CONTROL'           ? 'paper-logs' :
      u.role === 'COUNSELOR'         ? 'student-absences' :
      'my-tasks';
    setActiveTab(defaultTab);
    localStorage.setItem('activeTab', defaultTab);
  };

  const upsertUsersOptimistically = async (input: any) => {
    const previous = users;
    const nextUsers = typeof input === 'function' ? input(users) : input;
    const nextList = Array.isArray(nextUsers) ? nextUsers : users.map(user => user.id === nextUsers.id ? nextUsers : user);
    const previousById = new Map(previous.map(user => [user.id, user]));
    const changedUsers = nextList.filter(user => JSON.stringify(previousById.get(user.id)) !== JSON.stringify(user));

    setUsers(nextList);
    const refreshedCurrentUser = currentUser ? nextList.find(user => user.id === currentUser.id) : null;
    if (refreshedCurrentUser) {
      setCurrentUser(refreshedCurrentUser);
      localStorage.setItem('currentUser', JSON.stringify(refreshedCurrentUser));
    }
    try {
      if (changedUsers.length > 0) await db.users.upsert(changedUsers);
      await fetchData();
    } catch (err) {
      setUsers(previous);
      if (currentUser) {
        setCurrentUser(currentUser);
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
      }
      throw err;
    }
  };

  const upsertStudentsOptimistically = async (input: any) => {
    const previous = students;
    const next = typeof input === 'function' ? input(students) : input;
    const nextList = Array.isArray(next) ? next : [next];
    setStudents(nextList);
    try {
      await db.students.upsert(nextList);
      await fetchData();
    } catch (err) {
      setStudents(previous);
      throw err;
    }
  };

  const handleSmartAssignProctors = async (assignments: { teacherId: string; committeeNumber: string; date: string; period: number; subject: string }[], replaceExisting: boolean) => {
    const deleteAssignmentScope = async (item: { teacherId: string; committeeNumber: string; date: string; period: number }) => {
      const nextDay = new Date(item.date);
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDate = nextDay.toISOString().split('T')[0];
      const tenantId = getActiveTenantId();

      let committeeQuery = supabase
        .from('supervision')
        .delete()
        .eq('committee_number', item.committeeNumber)
        .eq('period', item.period)
        .gte('date', `${item.date}T00:00:00`)
        .lt('date', `${nextDate}T00:00:00`);
      if (tenantId) committeeQuery = committeeQuery.eq('tenant_id', tenantId);
      await committeeQuery;

      let teacherQuery = supabase
        .from('supervision')
        .delete()
        .eq('teacher_id', item.teacherId)
        .gte('date', `${item.date}T00:00:00`)
        .lt('date', `${nextDate}T00:00:00`);
      if (tenantId) teacherQuery = teacherQuery.eq('tenant_id', tenantId);
      await teacherQuery;
    };

    for (const item of assignments) {
      const existingSlot = supervisions.filter(s => s.date?.startsWith(item.date) && Number(s.period || 1) === Number(item.period));
      const existingDay = supervisions.filter(s => s.date?.startsWith(item.date));
      const hasCommittee = existingSlot.some(s => s.committee_number === item.committeeNumber);
      const hasTeacher = existingDay.some(s => s.teacher_id === item.teacherId);
      if (replaceExisting) {
        await deleteAssignmentScope(item);
      } else if (hasCommittee || hasTeacher) {
        continue;
      }

      await db.supervision.insert({
        id: crypto.randomUUID(),
        teacher_id: item.teacherId,
        committee_number: item.committeeNumber,
        date: `${item.date}T${new Date().toTimeString().slice(0, 8)}`,
        period: item.period,
        subject: item.subject || 'اختبار'
      });
    }

    await fetchData();
  };

  const dayEnd = (date: string) => {
    const [year, month, day] = date.split('-').map(Number);
    const d = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString();
  };

  const deleteSameDayTeacherAssignment = async (teacherId: string, date: string, period = 1) => {
    const tenantId = getActiveTenantId();
    let query = supabase
      .from('supervision')
      .delete()
      .eq('teacher_id', teacherId)
      .gte('date', `${date}T00:00:00`)
      .lt('date', dayEnd(date))
      .eq('period', period);
    if (tenantId) query = query.eq('tenant_id', tenantId);
    const { error } = await query;
    if (error) throw new Error(error.message);
  };

  const deleteSameDayCommitteeAssignment = async (committeeNumber: string, date: string, period = 1) => {
    const tenantId = getActiveTenantId();
    let query = supabase
      .from('supervision')
      .delete()
      .eq('committee_number', committeeNumber)
      .gte('date', `${date}T00:00:00`)
      .lt('date', dayEnd(date))
      .eq('period', period);
    if (tenantId) query = query.eq('tenant_id', tenantId);
    const { error } = await query;
    if (error) throw new Error(error.message);
  };

  const handleCommitSmartDistribution = async (items: SmartDistributionItem[], replaceExisting: boolean) => {
    if (!items.length) return;
    const tenantId = getActiveTenantId();
    const groupedSlots = Array.from(new Set(items.map(item => `${item.date}__${item.period}`)))
      .map(key => {
        const [date, period] = key.split('__');
        return { date, period: Number(period) || 1 };
      });

    if (replaceExisting) {
      for (const slot of groupedSlots) {
        let query = supabase
          .from('supervision')
          .delete()
          .gte('date', `${slot.date}T00:00:00`)
          .lt('date', dayEnd(slot.date))
          .eq('period', slot.period);
        if (tenantId) query = query.eq('tenant_id', tenantId);
        const { error } = await query;
        if (error) throw new Error(error.message);
      }
    }

    const existingKeys = new Set(
      allSupervisions.map(s => `${s.date?.slice(0, 10)}__${s.period || 1}__${s.committee_number}`)
    );
    const existingTeacherKeys = new Set(
      allSupervisions.map(s => `${s.date?.slice(0, 10)}__${s.period || 1}__${s.teacher_id}`)
    );

    const rows = items
      .filter(item => {
        if (replaceExisting) return true;
        const committeeKey = `${item.date}__${item.period}__${item.committeeNumber}`;
        const teacherKey = `${item.date}__${item.period}__${item.teacherId}`;
        return !existingKeys.has(committeeKey) && !existingTeacherKeys.has(teacherKey);
      })
      .map(item => ({
        id: crypto.randomUUID(),
        teacher_id: item.teacherId,
        committee_number: item.committeeNumber,
        date: `${item.date}T00:00:00.000Z`,
        period: item.period,
        subject: item.subject || 'اختبار',
        ...(tenantId ? { tenant_id: tenantId } : {})
      }));

    if (!rows.length) {
      addLocalNotification('لم يتم ربط أي لجنة جديدة لأن اللجان أو المراقبين مرتبطون مسبقاً.', 'warning');
      return;
    }

    const { error } = await supabase.from('supervision').insert(rows);
    if (error) throw new Error(error.message);
    await fetchData();
    addLocalNotification(`تم اعتماد ${rows.length} ربط للمراقبين بنجاح.`, 'success');
  };

  const acknowledgeAbsenceReceipt = async (absence: Absence, receiver: User) => {
    const note = buildAbsenceReceiptNote(
      receiver.full_name,
      receiver.role === 'COUNSELOR' ? 'الموجه الطلابي' : 'مساعد الكنترول'
    );
    const cleanAbsence: Absence = {
      id: absence.id,
      date: absence.date,
      student_id: absence.student_id,
      student_name: absence.student_name,
      committee_number: absence.committee_number,
      period: absence.period,
      type: absence.type,
      proctor_id: absence.proctor_id,
      note,
    };

    const previousAbsences = absences;
    setAbsences(prev => prev.map(item => item.id === absence.id ? { ...item, note } : item));

    try {
      await db.absences.upsert(cleanAbsence);
      await fetchData();
      addLocalNotification(`تم تأكيد استلام ${getAbsenceKindLabel(absence.type)} للطالب ${absence.student_name}`, 'success');
    } catch (error: any) {
      setAbsences(previousAbsences);
      addLocalNotification(error.message || `تعذر تأكيد استلام ${getAbsenceKindLabel(absence.type)}.`, 'error');
      throw error;
    }
  };

  const renderContent = () => {
    if (!currentUser) return null;

    const defaultTab =
      currentUser.role === 'ADMIN'             ? 'dashboard' :
      currentUser.role === 'CONTROL_MANAGER'   ? 'head-dash' :
      currentUser.role === 'ASSISTANT_CONTROL' ? 'assigned-requests' :
      currentUser.role === 'CONTROL'           ? 'paper-logs' :
      currentUser.role === 'COUNSELOR'         ? 'student-absences' :
      'my-tasks';

    const allowedTabsByRole: Record<string, string[]> = {
      ADMIN: ['head-dash', 'dashboard', 'control-monitor', 'control-monitor-2', 'control-manager', 'ai-insights', 'comprehensive-stats', 'master-portfolio', 'archive-boxes', 'proctor-excellence', 'committee-labels', 'door-labels', 'teachers', 'students', 'seating-planner', 'print-sheets', 'committees', 'daily-reports', 'official-forms', 'envelope-opening', 'envelope-labels', 'paper-logs', 'receipt-history', 'settings'],
      CONTROL_MANAGER: ['head-dash', 'control-manager', 'committees', 'daily-reports', 'official-forms', 'envelope-opening', 'paper-logs', 'receipt-history'],
      PROCTOR: ['my-tasks', 'my-schedule', 'proctor-alerts', 'digital-id'],
      COUNSELOR: ['student-absences'],
      ASSISTANT_CONTROL: ['assigned-requests'],
      CONTROL: ['envelope-opening', 'paper-logs', 'receipt-history']
    };

    const allowedTabs = allowedTabsByRole[currentUser.role] || [];
    const requestedTab = activeTab || defaultTab;
    const tabToRender = allowedTabs.includes(requestedTab) ? requestedTab : defaultTab;

    switch (tabToRender) {
      case 'dashboard': return <AdminDashboardOverview stats={{ students: students.length, users: users.length, activeSupervisions: supervisions.length }} absences={absences} supervisions={supervisions} users={users} deliveryLogs={deliveryLogs} studentsList={students} onBroadcast={(m, t) => db.notifications.broadcast(m, t, currentUser.full_name)} systemConfig={systemConfig} />;
      case 'head-dash': return <ControlHeadDashboard users={users} students={students} absences={absences} deliveryLogs={deliveryLogs} requests={controlRequests} supervisions={supervisions} systemConfig={systemConfig} onBroadcast={(m, t) => db.notifications.broadcast(m, t, currentUser.full_name)} />;
      case 'control-monitor': return (
        <div className="fixed inset-0 z-[200] bg-slate-950 no-print">
           <button onClick={() => setActiveTab('dashboard')} className="fixed top-6 left-6 z-[210] bg-white/10 text-white p-3 rounded-full hover:bg-white/20">
              <X size={32} />
           </button>
           <ControlRoomMonitor absences={absences} supervisions={supervisions} users={users} deliveryLogs={deliveryLogs} students={students} requests={controlRequests} />
        </div>
      );
      case 'control-monitor-2': return (
        <div className="fixed inset-0 z-[200] bg-slate-950 no-print">
           <button onClick={() => setActiveTab('dashboard')} className="fixed top-6 left-6 z-[230] bg-white/10 text-white p-3 rounded-full hover:bg-white/20">
              <X size={32} />
           </button>
           <ControlRoomMonitor2 absences={absences} supervisions={supervisions} users={users} deliveryLogs={deliveryLogs} students={students} requests={controlRequests} />
        </div>
      );
      case 'ai-insights': return <AiDashboard systemConfig={systemConfig} />;
      case 'comprehensive-stats': return <ComprehensiveStats students={students} users={users} supervisions={allSupervisions} absences={absences} deliveryLogs={deliveryLogs} controlRequests={controlRequests} committeeReports={committeeReports} examSchedule={examSchedule} systemConfig={systemConfig} />;
      case 'master-portfolio': return <MasterPortfolio students={students} users={users} supervisions={allSupervisions} systemConfig={systemConfig} absences={absences} committeeReports={committeeReports} examSchedule={examSchedule} deliveryLogs={deliveryLogs} controlRequests={controlRequests} />;
      case 'archive-boxes': return <ArchiveBoxesManager students={students} examSchedule={examSchedule} deliveryLogs={deliveryLogs} supervisions={allSupervisions} users={users} absences={absences} />;
      case 'proctor-excellence': return <AdminProctorPerformance users={users} supervisions={supervisions} deliveryLogs={deliveryLogs} absences={absences} systemConfig={systemConfig} />;
      case 'committee-labels': return <CommitteeLabelsPrint students={students} />;
      case 'control-manager': return <ControlManager users={users} deliveryLogs={deliveryLogs} students={students} requests={controlRequests} onBroadcast={(m, t) => db.notifications.broadcast(m, t, currentUser.full_name)} onUpdateUserGrades={async (userId, grades) => { const uMatch = users.find(u => u.id === userId); if (uMatch) { await db.users.upsert([{ ...uMatch, assigned_grades: grades }]); await fetchData(); } }} systemConfig={systemConfig} absences={absences} supervisions={supervisions} smartSupervisions={allSupervisions} setDeliveryLogs={async (log) => { await db.deliveryLogs.upsert(log); await fetchData(); }} setSystemConfig={async (cfg) => { await db.config.upsert(cfg); await fetchData(); }} onRemoveSupervision={async (id) => { await deleteSameDayTeacherAssignment(id, systemConfig.active_exam_date || new Date().toISOString().slice(0, 10)); await fetchData(); }} onAssignProctor={async (tid, cid) => { const date = systemConfig.active_exam_date || new Date().toISOString().slice(0, 10); await deleteSameDayTeacherAssignment(tid, date); await deleteSameDayCommitteeAssignment(cid, date); await db.supervision.insert({ id: crypto.randomUUID(), teacher_id: tid, committee_number: cid, date: `${date}T${new Date().toTimeString().slice(0, 8)}`, period: 1, subject: 'اختبار' }); await fetchData(); }} onCommitSmartDistribution={handleCommitSmartDistribution} />;
      case 'teachers': return <AdminUsersManager users={users} setUsers={upsertUsersOptimistically} students={students} onDeleteUser={async (id: string) => { if(confirm('حذف؟')) { await db.users.delete(id); await fetchData(); } }} onAlert={addLocalNotification} />;
      case 'students': return <AdminStudentsManager students={students} setStudents={upsertStudentsOptimistically} onDeleteStudent={async (id: string) => { if(confirm('حذف؟')) { await db.students.delete(id); await fetchData(); } }} onAlert={addLocalNotification} />;
      case 'seating-planner': return <SeatingPlanner systemConfig={systemConfig} />;
      case 'print-sheets': return <PrintSheets students={students} examSchedule={examSchedule} systemConfig={systemConfig} users={users} supervisions={allSupervisions} deliveryLogs={deliveryLogs} controlRequests={controlRequests} absences={absences} />;
      case 'committees': return <AdminSupervisionMonitor supervisions={supervisions} users={users} students={students} absences={absences} deliveryLogs={deliveryLogs} />;
      case 'daily-reports': return <AdminDailyReports supervisions={supervisions} users={users} students={students} deliveryLogs={deliveryLogs} systemConfig={systemConfig} committeeReports={committeeReports} absences={absences} controlRequests={controlRequests} />;
      case 'official-forms': return <AdminOfficialForms absences={absences} students={students} supervisions={supervisions} users={users} />;
      case 'settings': return <AdminSystemSettings systemConfig={systemConfig} setSystemConfig={async (cfg) => { await db.config.upsert(cfg); await fetchData(); }} resetFunctions={{ students: async () => { if(confirm('حذف الطلاب؟')) { let q = supabase.from('students').delete().neq('id', '0'); const tenantId = getActiveTenantId(); if (tenantId) q = q.eq('tenant_id', tenantId); await q; await fetchData(); } }, teachers: async () => { if(confirm('حذف المعلمين؟')) { let q = supabase.from('users').delete().neq('role', 'ADMIN'); const tenantId = getActiveTenantId(); if (tenantId) q = q.eq('tenant_id', tenantId); await q; await fetchData(); } }, operations: async () => { if(confirm('تصفير سجلات اليوم؟')) { const tenantId = getActiveTenantId(); let absQ = supabase.from('absences').delete().gte('date', systemConfig.active_exam_date); let logsQ = supabase.from('delivery_logs').delete().gte('time', systemConfig.active_exam_date); if (tenantId) { absQ = absQ.eq('tenant_id', tenantId); logsQ = logsQ.eq('tenant_id', tenantId); } await absQ; await logsQ; await fetchData(); } }, fullReset: () => {} }} onAlert={addLocalNotification} />;
      case 'assigned-requests': return <AssistantControlView user={currentUser} requests={controlRequests} setRequests={fetchData} absences={absences} students={students} users={users} onAlert={addLocalNotification} onAcknowledgeAbsence={(absence) => acknowledgeAbsenceReceipt(absence, currentUser)} />;
      case 'paper-logs': return <ControlReceiptView user={currentUser} students={students} absences={absences} deliveryLogs={deliveryLogs} setDeliveryLogs={async (log) => { await db.deliveryLogs.upsert(log); await fetchData(); }} supervisions={supervisions} users={users} controlRequests={controlRequests} setControlRequests={fetchData} systemConfig={systemConfig} onAlert={addLocalNotification} />;
      case 'receipt-history': return <ReceiptLogsView deliveryLogs={deliveryLogs} users={users} />;
      case 'digital-id': return <TeacherBadgeView user={currentUser} />;
      case 'my-schedule': return <ProctorScheduleView user={currentUser} supervisions={allSupervisions} systemConfig={systemConfig} />;
      case 'proctor-alerts': return <ProctorAlertsHistory requests={controlRequests} userFullName={currentUser.full_name} deliveryLogs={deliveryLogs} supervisions={supervisions} systemConfig={systemConfig} />;
      case 'student-absences': return <CounselorAbsenceMonitor user={currentUser} absences={absences} students={students} supervisions={supervisions} users={users} onAcknowledgeAbsence={(absence) => acknowledgeAbsenceReceipt(absence, currentUser)} />;
      case 'my-tasks': return <ProctorDailyAssignmentFlow user={currentUser} supervisions={supervisions} setSupervisions={fetchData} students={students} absences={absences} setAbsences={fetchData} deliveryLogs={deliveryLogs} setDeliveryLogs={async (log) => { await db.deliveryLogs.upsert(log); await fetchData(); }} sendRequest={async (txt, com) => { await db.controlRequests.insert({ from: currentUser.full_name, committee: com, text: txt, time: new Date().toISOString(), status: 'PENDING' }); await fetchData(); }} controlRequests={controlRequests} users={users} systemConfig={systemConfig} committeeReports={committeeReports} onReportUpsert={async (report) => { await db.committeeReports.upsert(report); await fetchData(); }} onAlert={addLocalNotification} examSchedule={examSchedule} />;
      case 'envelope-opening': return <EnvelopeOpeningView user={currentUser} systemConfig={systemConfig} users={users} />;
      case 'envelope-labels': return <EnvelopeLabelsPrint students={students} />;
      case 'door-labels': return <DoorLabelsPrint students={students} />;
      default: return <div className="p-20 text-center animate-pulse text-slate-400 font-bold">جاري تحميل المحتوى المخصص...</div>;
    }
  };

  if (isInitialLoading) {
    const params = new URLSearchParams(window.location.search);
    if (params.get('public_committee') || params.get('student_lookup') || params.get('student_inquiry') || params.get('public_box') || params.get('supervision_verify') || params.get('sv') || params.get('tv2')) {
       return (
         <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-6 font-['Tajawal']" dir="rtl">
           <Loader2 size={48} className="text-blue-600 animate-spin" />
           <p className="font-bold text-slate-500 text-sm">جاري جلب بيانات اللجنة...</p>
         </div>
       );
    } else if (currentUser) {
       return (
         <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-6">
           <Loader2 size={64} className="text-blue-600 animate-spin" />
           <p className="font-black text-slate-500 italic">جاري تهيئة مركز العمليات...</p>
         </div>
       );
    }
  }

  const publicCommitteeId = new URLSearchParams(window.location.search).get('public_committee');
  if (publicCommitteeId) {
    return <CommitteePublicView committeeNumber={publicCommitteeId} students={students} supervisions={supervisions} absences={absences} users={users} />;
  }

  const isStudentLookup = new URLSearchParams(window.location.search).get('student_lookup');
  if (isStudentLookup) {
    return <StudentLookupView students={students} />;
  }

  const isTv2Public = new URLSearchParams(window.location.search).get('tv2');
  if (isTv2Public) {
    return <ControlRoomMonitor2 absences={absences} supervisions={supervisions} users={users} deliveryLogs={deliveryLogs} students={students} requests={controlRequests} />;
  }

  const isStudentInquiry = new URLSearchParams(window.location.search).get('student_inquiry');
  if (isStudentInquiry) {
    return <StudentCommitteeInquiry students={students} />;
  }

  const publicBoxId = new URLSearchParams(window.location.search).get('public_box');
  if (publicBoxId) {
    return <PublicBoxReport boxId={publicBoxId} students={students} supervisions={allSupervisions} deliveryLogs={deliveryLogs} users={users} examSchedule={examSchedule} absences={absences} systemConfig={systemConfig} />;
  }

  const publicParams = new URLSearchParams(window.location.search);
  const isSupervisionVerification = publicParams.get('supervision_verify') || publicParams.get('sv');
  if (isSupervisionVerification) {
    return <SupervisionVerification supervisions={supervisions} users={users} students={students} absences={absences} deliveryLogs={deliveryLogs} />;
  }

  const isEnvDebug = new URLSearchParams(window.location.search).get('env_debug');
  if (isEnvDebug) {
    const status = getSupabaseConfigStatus();
    return (
      <div className="min-h-screen bg-slate-950 text-white font-['Tajawal'] p-6 flex items-center justify-center" dir="rtl">
        <div className="w-full max-w-xl bg-white/10 border border-white/10 rounded-[2rem] p-8 space-y-5">
          <h1 className="text-2xl font-black">فحص إعدادات Supabase</h1>
          <div className="grid grid-cols-1 gap-3 text-sm font-bold">
            <div className="bg-white/5 rounded-2xl p-4 flex justify-between"><span>VITE_SUPABASE_URL</span><span>{status.hasUrl ? 'موجود' : 'غير موجود'}</span></div>
            <div className="bg-white/5 rounded-2xl p-4 flex justify-between"><span>VITE_SUPABASE_ANON_KEY</span><span>{status.hasAnonKey ? 'موجود' : 'غير موجود'}</span></div>
            <div className="bg-white/5 rounded-2xl p-4 flex justify-between"><span>Supabase Host</span><span dir="ltr">{status.urlHost || '-'}</span></div>
            <div className="bg-white/5 rounded-2xl p-4 flex justify-between"><span>Default Tenant</span><span dir="ltr">{status.defaultTenantSlug || '-'}</span></div>
            <div className="bg-white/5 rounded-2xl p-4 flex justify-between"><span>Mode</span><span dir="ltr">{status.mode} / {status.prod ? 'prod' : 'dev'}</span></div>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            لا يتم عرض قيمة المفتاح حفاظًا على الأمان. إذا ظهر أي متغير غير موجود في Vercel، فهذا يعني أن آخر build لم يستلم المتغيرات.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div id="app-root" className="min-h-screen w-full max-w-[100vw] bg-[#f8fafc] font-['Tajawal'] overflow-x-hidden text-right selection:bg-blue-100" dir="rtl">
      {/* التنبيهات الذكية */}
      <div className="fixed top-24 left-6 right-6 lg:right-auto lg:left-8 z-[1000] flex flex-col gap-3 max-w-sm pointer-events-none no-print">
        {currentUser && browserNotificationPermission === 'default' && (
          <button
            onClick={enableBrowserNotifications}
            className="pointer-events-auto p-4 rounded-2xl shadow-2xl flex items-center gap-4 bg-slate-950 text-white border-r-[6px] border-blue-500 text-right"
          >
            <BellRing size={22} className="text-blue-300 shrink-0" />
            <span className="font-black text-[11px] lg:text-sm">تفعيل إشعارات الجوال والتنبيهات</span>
          </button>
        )}
        {currentUser && browserNotificationPermission === 'denied' && (
          <div className="pointer-events-auto p-4 rounded-2xl shadow-2xl flex items-center gap-4 bg-amber-50 text-amber-900 border-r-[6px] border-amber-500">
            <AlertTriangle size={22} className="shrink-0" />
            <p className="font-black text-[11px] lg:text-sm">الإشعارات ممنوعة من إعدادات المتصفح.</p>
          </div>
        )}
        {notifications.map(n => (
          <div key={n.id} className={`p-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-slide-in pointer-events-auto border-r-[6px] ${
            n.type === 'success' ? 'bg-emerald-50 border-emerald-500 text-emerald-900' :
            n.type === 'error' ? 'bg-rose-50 border-rose-500 text-rose-900' :
            n.type === 'warning' ? 'bg-amber-50 border-amber-500 text-amber-900' :
            'bg-blue-50 border-blue-500 text-blue-900'
          }`}>
            <div className="shrink-0">
              {n.type === 'success' ? <CheckCircle2 size={24} /> :
               n.type === 'error' ? <AlertCircle size={24} /> :
               n.type === 'warning' ? <AlertTriangle size={24} /> :
               <Info size={24} />}
            </div>
            <p className="font-black text-[11px] lg:text-sm">{n.text}</p>
            <button onClick={() => setNotifications(prev => prev.filter(item => item.id !== n.id))} className="mr-auto opacity-40 hover:opacity-100"><X size={16}/></button>
          </div>
        ))}
      </div>

      {currentUser && (
        <>
          <header
            style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}
            className="fixed top-0 right-0 left-0 bg-white/90 backdrop-blur-md z-[90] lg:hidden border-b px-4 sm:px-6 pb-4 flex justify-between items-center no-print shadow-sm"
          >
             <button onClick={() => setIsSidebarOpen(true)} className="p-2 bg-slate-100 rounded-xl hover:bg-blue-50 transition-colors">
                <Menu size={24} className="text-slate-700" />
             </button>
             <h1 className="font-black text-slate-900 text-base sm:text-lg truncate px-3">كنترول الاختبارات</h1>
             <div className="w-10"></div>
          </header>
          <div className="no-print">
            <Sidebar 
              user={currentUser} 
              onLogout={handleLogout} 
              activeTab={activeTab} 
              setActiveTab={(t) => { setActiveTab(t); localStorage.setItem('activeTab', t); }} 
              isOpen={isSidebarOpen} 
              setIsOpen={setIsSidebarOpen} 
              isCollapsed={isSidebarCollapsed} 
              setIsCollapsed={setIsSidebarCollapsed} 
              controlRequests={controlRequests} 
            />
          </div>
        </>
      )}

      <main
        style={{ paddingTop: currentUser ? 'calc(env(safe-area-inset-top) + 80px)' : undefined }}
        className={`transition-all duration-300 min-h-screen ${currentUser ? (isSidebarCollapsed ? 'lg:mr-24' : 'lg:mr-80') : ''} ${currentUser ? 'safe-page-x pb-6 lg:p-10 lg:pt-10' : ''}`}
      >
        {currentUser ? renderContent() : <Login users={users} onLogin={handleLoginSuccess} onAlert={addLocalNotification} />}
      </main>

      {/* 
      {currentUser && ['ADMIN', 'CONTROL_MANAGER', 'ASSISTANT_CONTROL', 'COUNSELOR'].includes(currentUser.role) && (
         <GlobalQRScanner 
           students={students} 
           absences={absences} 
           activeDate={systemConfig.active_exam_date || new Date().toISOString().split('T')[0]} 
           onRefreshData={fetchData} 
         />
      )}
      */}

      <style>{`
        @keyframes slideIn { from { transform: translateX(-100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .animate-slide-in { animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        body { -webkit-tap-highlight-color: transparent; }
        input, select, button { outline: none !important; }
        /* iOS Safe Area Fix */
        :root {
          --sat: env(safe-area-inset-top);
          --sab: env(safe-area-inset-bottom);
          --sal: env(safe-area-inset-left);
          --sar: env(safe-area-inset-right);
        }
      `}</style>
    </div>
  );
};

export default App;
