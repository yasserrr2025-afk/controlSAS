
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { User, UserRole, Student, Absence, Supervision, ControlRequest, DeliveryLog, SystemConfig, CommitteeReport, ExamSchedule, SupervisorVisit, AppNotification } from './types';
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
import { PublicBoxReport } from './screens/public/PublicBoxReport';
import { SupervisorMiniPortfolio, SupervisorVisitForm } from './screens/public/SupervisorVisitPublic';
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
import StudentCommitteeInquiry from './screens/public/StudentCommitteeInquiry';
import SupervisionVerification from './screens/public/SupervisionVerification';
import { buildAbsenceContactNote, buildAbsenceReceiptNote, getAbsenceKindLabel } from './services/absenceReceipt';
import {
  BrowserNotificationPermission,
  getBrowserNotificationPermission,
  registerAppServiceWorker,
  requestBrowserNotificationPermission,
  showBrowserNotification
} from './services/browserNotifications';
import { registerExternalPush } from './services/pushNotifications';
import { isSignatureRequest } from './services/signatures';
import GlobalQRScanner from './components/GlobalQRScanner';
import { BellRing, Menu, X, CheckCircle2, AlertCircle, Info, AlertTriangle, Loader2 } from 'lucide-react';
import { db, supabase } from './supabase';

const ROLE_TABS: Record<UserRole, string[]> = {
  ADMIN: [
    'head-dash',
    'dashboard',
    'control-monitor',
    'control-monitor-2',
    'control-manager',
    'comprehensive-stats',
    'master-portfolio',
    'archive-boxes',
    'proctor-excellence',
    'committee-labels',
    'door-labels',
    'teachers',
    'students',
    'seating-planner',
    'print-sheets',
    'committees',
    'daily-reports',
    'official-forms',
    'envelope-opening',
    'paper-logs',
    'receipt-history',
    'envelope-labels',
    'proctor-alerts',
    'settings',
    'ai-insights',
  ],
  CONTROL_MANAGER: ['head-dash', 'control-manager', 'envelope-opening', 'paper-logs', 'receipt-history', 'proctor-alerts'],
  PROCTOR: ['my-tasks', 'proctor-alerts', 'digital-id'],
  CONTROL: ['envelope-opening', 'paper-logs', 'receipt-history', 'proctor-alerts'],
  ASSISTANT_CONTROL: ['assigned-requests', 'proctor-alerts'],
  COUNSELOR: ['student-absences', 'proctor-alerts'],
};

const getDefaultTab = (role: UserRole) => {
  const defaults: Record<UserRole, string> = {
    ADMIN: 'dashboard',
    CONTROL_MANAGER: 'head-dash',
    PROCTOR: 'my-tasks',
    CONTROL: 'paper-logs',
    ASSISTANT_CONTROL: 'assigned-requests',
    COUNSELOR: 'student-absences',
  };
  return defaults[role] || 'my-tasks';
};

const canOpenTab = (user: User, tab: string) => ROLE_TABS[user.role]?.includes(tab) ?? false;
const isReserveSupervision = (item: Supervision) => String(item.subject || '').includes('[RESERVE]');
const getRiyadhDateKey = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (type: string) => parts.find(part => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
};

const getRiyadhDateKeyFromValue = (value?: string | null) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const get = (type: string) => parts.find(part => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
};

const matchesExamDate = (value: string | undefined | null, examDate: string) => {
  if (!value || !examDate) return false;
  return String(value).startsWith(examDate) || getRiyadhDateKeyFromValue(value) === examDate;
};

const buildExamDateTimestamp = (examDate: string) => {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${examDate}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
};

const notificationMatchesUser = (notification: AppNotification, user: User) => {
  const target = String(notification.target || 'ALL').toUpperCase();
  return target === 'ALL' || target === user.role || target === user.id || target === user.national_id;
};

const normalizePersonKey = (value?: string | null) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const controlRequestTargetsUser = (request: ControlRequest, user: User) => {
  const from = normalizePersonKey(request.from);
  const fullName = normalizePersonKey(user.full_name);
  const id = normalizePersonKey(user.id);
  const nationalId = normalizePersonKey(user.national_id);
  return Boolean(
    from &&
    (
      from === fullName ||
      from === id ||
      from === nationalId ||
      (fullName && (from.includes(fullName) || fullName.includes(from)))
    )
  );
};

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
  const [allAbsences, setAllAbsences] = useState<Absence[]>([]);
  const [notifications, setNotifications] = useState<{id: string, text: string, type: 'success' | 'error' | 'info' | 'warning', persistent?: boolean}[]>([]);
  const [browserNotificationPermission, setBrowserNotificationPermission] = useState<BrowserNotificationPermission>('unsupported');
  const [controlRequests, setControlRequests] = useState<ControlRequest[]>([]);
  const [allControlRequests, setAllControlRequests] = useState<ControlRequest[]>([]);
  const [deliveryLogs, setDeliveryLogs] = useState<DeliveryLog[]>([]);
  const [allDeliveryLogs, setAllDeliveryLogs] = useState<DeliveryLog[]>([]);
  const [committeeReports, setCommitteeReports] = useState<CommitteeReport[]>([]);
  const [allCommitteeReports, setAllCommitteeReports] = useState<CommitteeReport[]>([]);
  const [examSchedule, setExamSchedule] = useState<ExamSchedule[]>([]);
  const [supervisorVisits, setSupervisorVisits] = useState<SupervisorVisit[]>([]);
  const [systemConfig, setSystemConfig] = useState<SystemConfig>({ 
    id: 'main_config', 
    exam_start_time: '08:00', 
    exam_date: '',
    active_exam_date: getRiyadhDateKey(),
    allow_manual_join: false
  });
  const todayKey = () => getRiyadhDateKey();

  const pendingEnvelopeSignatureRequests = useMemo(() => {
    if (!currentUser) return [];
    return controlRequests
      .filter(request =>
        request.status !== 'DONE' &&
        isSignatureRequest(request) &&
        String(request.committee || '').startsWith('ENV:') &&
        controlRequestTargetsUser(request, currentUser)
      )
      .sort((a, b) => b.time.localeCompare(a.time));
  }, [controlRequests, currentUser]);

  const openSignatureCenter = () => {
    if (!currentUser || !canOpenTab(currentUser, 'proctor-alerts')) return;
    setActiveTab('proctor-alerts');
    localStorage.setItem('activeTab', 'proctor-alerts');
    setIsSidebarOpen(false);
  };

  const addLocalNotification = (input: any, type: 'success' | 'error' | 'info' | 'warning' = 'info', options?: { persistent?: boolean }) => {
    const id = Math.random().toString(36).substr(2, 9);
    const msg = typeof input === 'string' ? input : (input?.message || "تنبيه جديد من النظام");
    setNotifications(prev => [{ id, text: msg, type, persistent: options?.persistent }, ...prev]);
    if (type === 'error' || type === 'warning' || type === 'info') {
      showBrowserNotification('كنترول الاختبارات', msg);
    }
    if (!options?.persistent) {
      setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 5000);
    }
  };

  useEffect(() => {
    registerAppServiceWorker();
    setBrowserNotificationPermission(getBrowserNotificationPermission());
  }, []);

  const enableBrowserNotifications = async () => {
    const permission = await requestBrowserNotificationPermission();
    setBrowserNotificationPermission(permission);
    if (permission === 'granted') {
      try {
        if (currentUser) await registerExternalPush(currentUser);
        await showBrowserNotification('تم تفعيل الإشعارات', 'ستظهر التنبيهات المهمة على شاشة الجهاز عند فتح التطبيق أو عمله في الخلفية.');
        addLocalNotification('تم تفعيل إشعارات الجوال الخارجية بنجاح.', 'success');
      } catch (error: any) {
        addLocalNotification(error.message || 'تم تفعيل إشعارات المتصفح، لكن تعذر تسجيل الجهاز للإشعارات الخارجية.', 'warning');
      }
    } else if (permission === 'denied') {
      addLocalNotification('تم منع الإشعارات من المتصفح. فعّلها من إعدادات الموقع.', 'warning');
    }
  };

  const fetchData = useCallback(async () => {
    try {
      const cfg = await db.config.get();
      const currentToday = todayKey();
      let filterDate = currentToday;
      if (cfg) {
        if (cfg.active_exam_date !== currentToday) {
          const nextCfg = { ...cfg, active_exam_date: currentToday };
          const lastAutoActiveDate = localStorage.getItem('last_auto_active_exam_date');
          if (lastAutoActiveDate !== currentToday) {
            await db.config.upsert(nextCfg);
            localStorage.setItem('last_auto_active_exam_date', currentToday);
          }
          setSystemConfig(prev => ({ ...prev, ...nextCfg }));
          filterDate = currentToday;
        } else {
          setSystemConfig(prev => ({ ...prev, ...cfg }));
          filterDate = cfg.active_exam_date || currentToday;
        }
      }
      const [u, s, sv, ab, cr, dl, reports, exams, visits] = await Promise.all([
        db.users.getAll(),
        db.students.getAll(),
        db.supervision.getAll(),
        db.absences.getAll(),
        db.controlRequests.getAll(),
        db.deliveryLogs.getAll(),
        db.committeeReports.getAll(),
        db.examSchedule.getAll(),
        db.supervisorVisits.getAll().catch(() => []),
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
            const storedTab = localStorage.getItem('activeTab') || '';
            if (!storedTab || !canOpenTab(freshUser, storedTab)) {
              const defaultTab = getDefaultTab(freshUser.role);
              setActiveTab(defaultTab);
              localStorage.setItem('activeTab', defaultTab);
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
      setAllAbsences(ab);
      setAllDeliveryLogs(dl);
      setAllControlRequests(cr);
      setAllCommitteeReports(reports);
      setExamSchedule(exams);
      setSupervisorVisits(visits as SupervisorVisit[]);
      
      if (filterDate) {
        setSupervisions(sv.filter(i => matchesExamDate(i.date, filterDate) && !isReserveSupervision(i))); 
        setAbsences(ab.filter(i => matchesExamDate(i.date, filterDate))); 
        setDeliveryLogs(dl.filter(i => matchesExamDate(i.time, filterDate)));
        setControlRequests(cr.filter(i => matchesExamDate(i.time, filterDate)));
        setCommitteeReports(reports.filter(r => matchesExamDate(r.date, filterDate)));
      }
    } catch (err: any) {
      console.warn("Sync Warning:", err.message);
    } finally {
      setIsInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try { 
        const user = JSON.parse(savedUser) as User;
        setCurrentUser(user);
        if (!activeTab || !canOpenTab(user, activeTab)) {
          const defaultTab = getDefaultTab(user.role);
          setActiveTab(defaultTab);
          localStorage.setItem('activeTab', defaultTab);
        }
      } catch (e) { 
        localStorage.removeItem('currentUser'); 
        localStorage.removeItem('activeTab');
      }
    }
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    if (!currentUser) return;

    const seenKey = `seen_notifications_${currentUser.id || currentUser.national_id}`;
    const getSeen = () => {
      try { return new Set<string>(JSON.parse(localStorage.getItem(seenKey) || '[]')); }
      catch { return new Set<string>(); }
    };
    const saveSeen = (seen: Set<string>) => {
      localStorage.setItem(seenKey, JSON.stringify(Array.from(seen).slice(-80)));
    };
    const showIncoming = (notification: AppNotification, type: 'info' | 'warning' = 'info') => {
      if (!notification?.id || !notificationMatchesUser(notification, currentUser)) return;
      const seen = getSeen();
      if (seen.has(notification.id)) return;
      seen.add(notification.id);
      saveSeen(seen);
      const sender = notification.sender ? `من ${notification.sender}: ` : '';
      addLocalNotification(`${sender}${notification.message}`, type, { persistent: true });
    };

    const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    db.notifications.getRecent(since)
      .then(items => {
        items.reverse().forEach(item => showIncoming(item, 'info'));
      })
      .catch(() => {});

    const channel = supabase
      .channel(`notifications-${currentUser.id || currentUser.national_id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        payload => showIncoming(payload.new as AppNotification, 'warning'),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser]);

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
    localStorage.removeItem('activeTab');
    setActiveTab('');
  };

  const handleLoginSuccess = (u: User) => {
    setCurrentUser(u);
    localStorage.setItem('currentUser', JSON.stringify(u));
    const defaultTab = getDefaultTab(u.role);
    setActiveTab(defaultTab);
    localStorage.setItem('activeTab', defaultTab);
  };

  const dayEnd = (date: string) => {
    const [year, month, day] = date.split('-').map(Number);
    const d = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10) + 'T00:00:00';
  };

  const handleCommitSmartDistribution = async (items: SmartDistributionItem[], replaceExisting: boolean) => {
    if (!items.length) return;
    const groupedSlots = Array.from(new Set(items.map(item => `${item.date}__${item.period}`)))
      .map(key => {
        const [date, period] = key.split('__');
        return { date, period: Number(period) || 1 };
      });

    if (replaceExisting) {
      for (const slot of groupedSlots) {
        const { error } = await supabase
          .from('supervision')
          .delete()
          .gte('date', `${slot.date}T00:00:00`)
          .lt('date', dayEnd(slot.date))
          .eq('period', slot.period);
        if (error) throw new Error(error.message);
      }
    }

    const existingKeys = new Set(
      allSupervisions.filter(s => !isReserveSupervision(s)).map(s => {
        const date = s.date?.slice(0, 10);
        return `${date}__${s.period || 1}__${s.committee_number}`;
      }),
    );
    const existingTeacherKeys = new Set(
      allSupervisions.map(s => {
        const date = s.date?.slice(0, 10);
        const type = isReserveSupervision(s) ? 'RESERVE' : 'PRIMARY';
        return `${date}__${s.period || 1}__${type}__${s.teacher_id}`;
      }),
    );

    const rows = items
      .filter(item => {
        if (replaceExisting) return true;
        const isReserve = item.assignmentType === 'RESERVE';
        const committeeKey = `${item.date}__${item.period}__${item.committeeNumber}`;
        const teacherKey = `${item.date}__${item.period}__${isReserve ? 'RESERVE' : 'PRIMARY'}__${item.teacherId}`;
        return (isReserve || !existingKeys.has(committeeKey)) && !existingTeacherKeys.has(teacherKey);
      })
      .map(item => ({
        id: crypto.randomUUID(),
        teacher_id: item.teacherId,
        committee_number: item.committeeNumber,
        date: `${item.date}T00:00:00`,
        period: item.period,
        subject: item.assignmentType === 'RESERVE'
          ? `[RESERVE] ${item.subject || 'اختبار'}`
          : item.subject || 'اختبار',
      }));

    if (!rows.length) {
      addLocalNotification('لم يتم ربط أي لجنة جديدة لأن اللجان أو المراقبين مرتبطون مسبقاً. فعّل خيار إعادة التوزيع إذا أردت الاستبدال.', 'warning');
      return;
    }

    const { error } = await supabase.from('supervision').insert(rows);
    if (error) throw new Error(error.message);
    await fetchData();
    addLocalNotification(`تم اعتماد ${rows.length} ربط للمراقبين بنجاح.`, 'success');
  };

  const deleteSmartDistributions = async (ids: string[]) => {
    if (!ids.length) return;
    const { error } = await supabase.from('supervision').delete().in('id', ids);
    if (error) throw new Error(error.message);
    await fetchData();
    addLocalNotification(`تم حذف ${ids.length} توزيع بنجاح.`, 'success');
  };

  const cleanEmergencySubject = (subject?: string) =>
    String(subject || '')
      .replace('[RESERVE]', '')
      .replace(/\s*-\s*بديل طارئ\s*/g, '')
      .trim();

  const handleEmergencyProctorAssignment = async (teacherId: string, committeeNumber: string) => {
    const date = systemConfig.active_exam_date || new Date().toISOString().slice(0, 10);
    const existingCommitteeAssignment = allSupervisions
      .filter(s => !isReserveSupervision(s))
      .find(s => s.committee_number === committeeNumber && matchesExamDate(s.date, date));
    const period = Number(existingCommitteeAssignment?.period || examSchedule.find(exam => exam.exam_date === date)?.period || 1);
    const scheduledExam = examSchedule.find(exam => exam.exam_date === date && Number(exam.period || 1) === period)
      || examSchedule.find(exam => exam.exam_date === date);
    const subject = cleanEmergencySubject(existingCommitteeAssignment?.subject)
      || cleanEmergencySubject(scheduledExam?.subject)
      || 'اختبار';

    await deleteSameDayTeacherAssignment(teacherId, date, period);
    await deleteSameDayCommitteeAssignment(committeeNumber, date, period);
    await db.supervision.insert({
      id: crypto.randomUUID(),
      teacher_id: teacherId,
      committee_number: committeeNumber,
      date: buildExamDateTimestamp(date),
      period,
      subject,
    });
    await fetchData();
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

  const updateAbsenceContactNote = async (
    absence: Absence,
    contact: { status: 'CONTACTED' | 'NO_ANSWER' | 'CUSTOM'; note: string },
    counselor: User,
  ) => {
    const note = buildAbsenceContactNote(absence, {
      status: contact.status,
      note: contact.note,
      by: counselor.full_name,
    });
    const cleanAbsence: Absence = { ...absence, note };
    setAbsences(prev => prev.map(item => item.id === absence.id ? { ...item, note } : item));
    await db.absences.upsert(cleanAbsence);
    await fetchData();
    addLocalNotification('تم حفظ ملاحظة الاتصال لولي الأمر.', 'success');
  };

  const saveUsersOptimistic = async (nextOrUpdater: User[] | ((prev: User[]) => User[])) => {
    const previousUsers = users;
    const nextUsers = typeof nextOrUpdater === 'function'
      ? nextOrUpdater(previousUsers)
      : nextOrUpdater;

    const previousById = new Map(previousUsers.map(user => [user.id, user]));
    const changedUsers = nextUsers.filter(next => previousById.get(next.id) !== next);

    setUsers(nextUsers);

    const refreshedCurrentUser = currentUser
      ? nextUsers.find(user => user.id === currentUser.id) || currentUser
      : null;

    if (refreshedCurrentUser && currentUser && refreshedCurrentUser !== currentUser) {
      setCurrentUser(refreshedCurrentUser);
      localStorage.setItem('currentUser', JSON.stringify(refreshedCurrentUser));
    }

    try {
      if (changedUsers.length > 0) {
        await db.users.upsert(changedUsers);
      }
    } catch (error: any) {
      setUsers(previousUsers);
      if (currentUser) {
        setCurrentUser(currentUser);
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
      }
      addLocalNotification(error.message || 'تعذر حفظ الصلاحيات، تمت إعادة الحالة السابقة.', 'error');
    }
  };

  const saveSingleUser = async (user: User) => {
    const previousUsers = users;
    const nextUsers = previousUsers.some(item => item.id === user.id)
      ? previousUsers.map(item => item.id === user.id ? user : item)
      : [...previousUsers, user];

    setUsers(nextUsers);
    try {
      const exists = previousUsers.some(item => item.id === user.id);
      const result = exists
        ? await supabase.from('users').update(user).eq('id', user.id)
        : await supabase.from('users').insert(user);
      if (result.error) throw new Error(result.error.message);
      await fetchData();
    } catch (error) {
      setUsers(previousUsers);
      throw error;
    }
  };

  const deleteSameDayTeacherAssignment = async (teacherId: string, date: string, period = 1) => {
    const ids = allSupervisions
      .filter(s => s.teacher_id === teacherId)
      .filter(s => matchesExamDate(s.date, date))
      .filter(s => Number(s.period || 1) === Number(period))
      .map(s => s.id);

    if (ids.length) {
      const { error } = await supabase.from('supervision').delete().in('id', ids);
      if (error) throw new Error(error.message);
      return;
    }

    const { error } = await supabase
      .from('supervision')
      .delete()
      .eq('teacher_id', teacherId)
      .gte('date', `${date}T00:00:00`)
      .lt('date', dayEnd(date))
      .eq('period', period);
    if (error) throw new Error(error.message);
  };

  const deleteSameDayCommitteeAssignment = async (committeeNumber: string, date: string, period = 1) => {
    const ids = allSupervisions
      .filter(s => s.committee_number === committeeNumber)
      .filter(s => !isReserveSupervision(s))
      .filter(s => matchesExamDate(s.date, date))
      .filter(s => Number(s.period || 1) === Number(period))
      .map(s => s.id);

    if (ids.length) {
      const { error } = await supabase.from('supervision').delete().in('id', ids);
      if (error) throw new Error(error.message);
      return;
    }

    const { error } = await supabase
      .from('supervision')
      .delete()
      .eq('committee_number', committeeNumber)
      .gte('date', `${date}T00:00:00`)
      .lt('date', dayEnd(date))
      .eq('period', period);
    if (error) throw new Error(error.message);
  };

  const renderContent = () => {
    if (!currentUser) return null;
    
    const tabToRender = activeTab && canOpenTab(currentUser, activeTab)
      ? activeTab
      : getDefaultTab(currentUser.role);

    switch (tabToRender) {
      case 'master-portfolio': return <MasterPortfolio students={students} users={users} supervisions={allSupervisions.filter(i => !isReserveSupervision(i))} systemConfig={systemConfig} absences={allAbsences} committeeReports={allCommitteeReports} examSchedule={examSchedule} deliveryLogs={allDeliveryLogs} controlRequests={allControlRequests} supervisorVisits={supervisorVisits} currentUser={currentUser} onRefresh={fetchData} onAlert={addLocalNotification} />;
      case 'archive-boxes': return <ArchiveBoxesManager students={students} examSchedule={examSchedule} deliveryLogs={allDeliveryLogs} supervisions={allSupervisions.filter(i => !isReserveSupervision(i))} users={users} absences={allAbsences} />;
      case 'seating-planner': return <SeatingPlanner systemConfig={systemConfig} />;
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
      case 'comprehensive-stats': return <ComprehensiveStats students={students} users={users} supervisions={allSupervisions.filter(i => !isReserveSupervision(i))} systemConfig={systemConfig} absences={allAbsences} deliveryLogs={allDeliveryLogs} controlRequests={allControlRequests} committeeReports={allCommitteeReports} examSchedule={examSchedule} />;
      case 'proctor-excellence': return <AdminProctorPerformance users={users} supervisions={supervisions} deliveryLogs={deliveryLogs} absences={absences} systemConfig={systemConfig} />;
      case 'committee-labels': return <CommitteeLabelsPrint students={students} />;
      case 'control-manager': return <ControlManager users={users} deliveryLogs={deliveryLogs} students={students} requests={controlRequests} onBroadcast={(m, t) => db.notifications.broadcast(m, t, currentUser.full_name)} onUpdateUserGrades={async (userId, grades) => { const uMatch = users.find(u => u.id === userId); if (uMatch) { await db.users.upsert([{ ...uMatch, assigned_grades: grades }]); await fetchData(); } }} systemConfig={systemConfig} absences={absences} supervisions={supervisions} smartSupervisions={allSupervisions} examSchedule={examSchedule} onUpsertExamSchedule={async (item) => { await db.examSchedule.upsert(item); await fetchData(); }} onDeleteExamSchedule={async (id) => { await db.examSchedule.delete(id); await fetchData(); }} setDeliveryLogs={async (log) => { await db.deliveryLogs.upsert(log); await fetchData(); }} setSystemConfig={async (cfg) => { await db.config.upsert(cfg); await fetchData(); }} onRemoveSupervision={async (id) => { await deleteSameDayTeacherAssignment(id, systemConfig.active_exam_date || new Date().toISOString().slice(0, 10)); await fetchData(); }} onAssignProctor={handleEmergencyProctorAssignment} onUpdateSmartDistribution={async (id, teacherId) => { const { error } = await supabase.from('supervision').update({ teacher_id: teacherId }).eq('id', id); if (error) throw new Error(error.message); await fetchData(); }} onCommitSmartDistribution={handleCommitSmartDistribution} onDeleteSmartDistributions={deleteSmartDistributions} />;
      case 'teachers': return <AdminUsersManager users={users} setUsers={saveUsersOptimistic} students={students} onSaveUser={saveSingleUser} onDeleteUser={async (id: string) => { if(confirm('حذف؟')) { await db.users.delete(id); await fetchData(); } }} onAlert={addLocalNotification} />;
      case 'students': return <AdminStudentsManager students={students} setStudents={async (s: any) => { await db.students.upsert(typeof s === 'function' ? s(students) : s); await fetchData(); }} onDeleteStudent={async (id: string) => { if(confirm('حذف؟')) { await db.students.delete(id); await fetchData(); } }} onAlert={addLocalNotification} />;
      case 'print-sheets': return <PrintSheets students={students} examSchedule={examSchedule} systemConfig={systemConfig} users={users} supervisions={allSupervisions.filter(i => !isReserveSupervision(i))} deliveryLogs={allDeliveryLogs} controlRequests={allControlRequests} absences={allAbsences} />;
      case 'committees': return <AdminSupervisionMonitor supervisions={allSupervisions.filter(i => !isReserveSupervision(i))} users={users} students={students} absences={allAbsences} deliveryLogs={allDeliveryLogs} controlRequests={allControlRequests} />;
      case 'daily-reports': return <AdminDailyReports supervisions={allSupervisions.filter(i => !isReserveSupervision(i))} users={users} students={students} deliveryLogs={allDeliveryLogs} systemConfig={systemConfig} committeeReports={allCommitteeReports} absences={allAbsences} controlRequests={allControlRequests} examSchedule={examSchedule} />;
      case 'official-forms': return <AdminOfficialForms absences={absences} students={students} supervisions={supervisions} users={users} />;
      case 'settings': return <AdminSystemSettings users={users} systemConfig={systemConfig} setSystemConfig={async (cfg) => { await db.config.upsert(cfg); await fetchData(); }} resetFunctions={{ students: async () => { if(confirm('حذف الطلاب؟')) { await supabase.from('students').delete().neq('id', '0'); await fetchData(); } }, teachers: async () => { if(confirm('حذف المعلمين؟')) { await supabase.from('users').delete().neq('role', 'ADMIN'); await fetchData(); } }, operations: async () => { if(confirm('تصفير سجلات اليوم؟')) { await supabase.from('absences').delete().gte('date', systemConfig.active_exam_date); await supabase.from('delivery_logs').delete().gte('time', systemConfig.active_exam_date); await fetchData(); } }, fullReset: () => {} }} onAlert={addLocalNotification} />;
      case 'ai-insights': return <AiDashboard systemConfig={systemConfig} />;
      case 'assigned-requests': return <AssistantControlView user={currentUser} requests={controlRequests} setRequests={fetchData} absences={absences} students={students} users={users} onAlert={addLocalNotification} onAcknowledgeAbsence={(absence) => acknowledgeAbsenceReceipt(absence, currentUser)} />;
      case 'paper-logs': return <ControlReceiptView user={currentUser} students={students} absences={absences} deliveryLogs={deliveryLogs} setDeliveryLogs={async (log) => { await db.deliveryLogs.upsert(log); await fetchData(); }} supervisions={supervisions} users={users} controlRequests={controlRequests} setControlRequests={fetchData} systemConfig={systemConfig} onAlert={addLocalNotification} />;
      case 'receipt-history': return <ReceiptLogsView deliveryLogs={deliveryLogs} users={users} />;
      case 'digital-id': return <TeacherBadgeView user={currentUser} />;
      case 'proctor-alerts': return <ProctorAlertsHistory requests={controlRequests} userFullName={currentUser.full_name} currentUser={currentUser} deliveryLogs={deliveryLogs} supervisions={supervisions} systemConfig={systemConfig} setRequests={fetchData} />;
      case 'my-schedule': return <ProctorScheduleView user={currentUser} supervisions={allSupervisions} systemConfig={systemConfig} />;
      case 'student-absences': return <CounselorAbsenceMonitor user={currentUser} absences={absences} students={students} supervisions={supervisions} users={users} onAcknowledgeAbsence={(absence) => acknowledgeAbsenceReceipt(absence, currentUser)} onUpdateContactNote={(absence, contact) => updateAbsenceContactNote(absence, contact, currentUser)} />;
      case 'my-tasks': return <ProctorDailyAssignmentFlow user={currentUser} supervisions={supervisions} setSupervisions={fetchData} students={students} absences={absences} setAbsences={fetchData} deliveryLogs={deliveryLogs} setDeliveryLogs={async (log) => { await db.deliveryLogs.upsert(log); await fetchData(); }} sendRequest={async (txt, com) => { await db.controlRequests.insert({ from: currentUser.full_name, committee: com, text: txt, time: new Date().toISOString(), status: 'PENDING' }); await fetchData(); }} controlRequests={controlRequests} users={users} systemConfig={systemConfig} committeeReports={committeeReports} onReportUpsert={async (report) => { await db.committeeReports.upsert(report); await fetchData(); }} onAlert={addLocalNotification} />;
      case 'envelope-opening': return <EnvelopeOpeningView user={currentUser} systemConfig={systemConfig} users={users} controlRequests={allControlRequests} onRefresh={fetchData} onAlert={addLocalNotification} />;
      case 'envelope-labels': return <EnvelopeLabelsPrint students={students} users={users} />;
      case 'door-labels': return <DoorLabelsPrint students={students} systemConfig={systemConfig} />;
      default: return <div className="p-20 text-center animate-pulse text-slate-400 font-bold">جاري تحميل المحتوى المخصص...</div>;
    }
  };

  if (isInitialLoading) {
    const params = new URLSearchParams(window.location.search);
    if (params.get('public_committee') || params.get('student_inquiry') || params.get('supervision_verify') || params.get('sv') || params.get('tv2') || params.get('box_report') || params.get('portfolio_live') || params.get('portfolio_book_live') || params.get('supervisor_visit') || params.get('supervisor_portfolio')) {
       return (
         <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-6 font-['Tajawal']" dir="rtl">
           <Loader2 size={48} className="text-blue-600 animate-spin" />
           <p className="font-bold text-slate-500 text-sm">جاري جلب بيانات الصفحة...</p>
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

  const params = new URLSearchParams(window.location.search);

  const publicCommitteeId = params.get('public_committee');
  if (publicCommitteeId) {
    return <CommitteePublicView committeeNumber={publicCommitteeId} students={students} supervisions={supervisions} absences={absences} users={users} />;
  }

  const boxReportId = params.get('box_report');
  if (boxReportId) {
    return <PublicBoxReport boxId={boxReportId} students={students} supervisions={allSupervisions.filter(i => !isReserveSupervision(i))} deliveryLogs={allDeliveryLogs} users={users} examSchedule={examSchedule} systemConfig={systemConfig} absences={allAbsences} />;
  }

  const portfolioLive = params.get('portfolio_live');
  if (portfolioLive) {
    return <ComprehensiveStats publicMode students={students} users={users} supervisions={allSupervisions.filter(i => !isReserveSupervision(i))} systemConfig={systemConfig} absences={allAbsences} deliveryLogs={allDeliveryLogs} controlRequests={allControlRequests} committeeReports={allCommitteeReports} examSchedule={examSchedule} />;
  }

  const portfolioBookLive = params.get('portfolio_book_live');
  if (portfolioBookLive) {
    return <MasterPortfolio publicMode students={students} users={users} supervisions={allSupervisions.filter(i => !isReserveSupervision(i))} systemConfig={systemConfig} absences={allAbsences} committeeReports={allCommitteeReports} examSchedule={examSchedule} deliveryLogs={allDeliveryLogs} controlRequests={allControlRequests} supervisorVisits={supervisorVisits} />;
  }

  const supervisorVisitId = params.get('supervisor_visit');
  if (supervisorVisitId) {
    return <SupervisorVisitForm visitId={supervisorVisitId} systemConfig={systemConfig} students={students} users={users} supervisions={allSupervisions.filter(i => !isReserveSupervision(i))} absences={allAbsences} deliveryLogs={allDeliveryLogs} controlRequests={allControlRequests} committeeReports={allCommitteeReports} examSchedule={examSchedule} />;
  }

  const supervisorPortfolioToken = params.get('supervisor_portfolio');
  if (supervisorPortfolioToken) {
    return <SupervisorMiniPortfolio token={supervisorPortfolioToken} systemConfig={systemConfig} students={students} users={users} supervisions={allSupervisions.filter(i => !isReserveSupervision(i))} absences={allAbsences} deliveryLogs={allDeliveryLogs} controlRequests={allControlRequests} committeeReports={allCommitteeReports} examSchedule={examSchedule} />;
  }

  const isTv2Public = params.get('tv2');
  if (isTv2Public) {
    return <ControlRoomMonitor2 absences={absences} supervisions={supervisions} users={users} deliveryLogs={deliveryLogs} students={students} requests={controlRequests} />;
  }

  const isStudentInquiry = params.get('student_inquiry');
  if (isStudentInquiry) {
    return <StudentCommitteeInquiry students={students} />;
  }

  const isSupervisionVerification = params.get('supervision_verify') || params.get('sv');
  if (isSupervisionVerification) {
    return <SupervisionVerification supervisions={supervisions} users={users} students={students} absences={absences} deliveryLogs={deliveryLogs} />;
  }

  return (
    <div id="app-root" className="min-h-screen bg-[#f8fafc] font-['Tajawal'] overflow-x-hidden text-right selection:bg-blue-100" dir="rtl">
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
        {pendingEnvelopeSignatureRequests.length > 0 && (
          <div className="pointer-events-auto overflow-hidden rounded-3xl bg-gradient-to-br from-amber-50 via-white to-emerald-50 text-slate-950 shadow-2xl border border-amber-200 animate-slide-in">
            <div className="border-r-[7px] border-amber-500 p-5">
              <div className="flex items-start gap-4">
                <div className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-lg shadow-amber-500/25">
                  <BellRing size={24} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black text-amber-700">تنبيه توقيع رسمي</p>
                  <h3 className="mt-1 text-sm font-black leading-6 text-slate-950">
                    لديك محضر فتح مظروف بانتظار توقيعك
                  </h3>
                  <p className="mt-1 text-[11px] font-bold leading-5 text-slate-500">
                    يرجى توقيع محضر فتح مظروف الأسئلة حتى يكتمل التقرير الرسمي.
                  </p>
                  <button
                    onClick={openSignatureCenter}
                    className="mt-4 w-full rounded-2xl bg-slate-950 px-4 py-3 text-xs font-black text-white shadow-lg hover:bg-slate-800"
                  >
                    فتح شاشة التوقيع
                  </button>
                </div>
              </div>
            </div>
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
            <div className="flex-1">
              <p className="font-black text-[11px] lg:text-sm leading-6">{n.text}</p>
              {n.persistent && (
                <button
                  onClick={() => setNotifications(prev => prev.filter(item => item.id !== n.id))}
                  className="mt-3 rounded-xl bg-white/80 px-4 py-2 text-[10px] font-black shadow-sm hover:bg-white"
                >
                  تم الاطلاع
                </button>
              )}
            </div>
            {!n.persistent && (
              <button onClick={() => setNotifications(prev => prev.filter(item => item.id !== n.id))} className="mr-auto opacity-40 hover:opacity-100"><X size={16}/></button>
            )}
          </div>
        ))}
      </div>

      {currentUser && (
        <>
          <header
            style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}
            className="fixed top-0 right-0 left-0 bg-white/90 backdrop-blur-md z-[90] lg:hidden border-b px-6 pb-4 flex justify-between items-center no-print shadow-sm"
          >
             <button onClick={() => setIsSidebarOpen(true)} className="p-2 bg-slate-100 rounded-xl hover:bg-blue-50 transition-colors">
                <Menu size={24} className="text-slate-700" />
             </button>
             <h1 className="font-black text-slate-900 text-lg">كنترول الاختبارات</h1>
             <div className="w-10"></div>
          </header>
          <div className="no-print">
            <Sidebar 
              user={currentUser} 
              onLogout={handleLogout} 
              activeTab={activeTab} 
              setActiveTab={(t) => {
                if (!canOpenTab(currentUser, t)) {
                  const defaultTab = getDefaultTab(currentUser.role);
                  setActiveTab(defaultTab);
                  localStorage.setItem('activeTab', defaultTab);
                  return;
                }
                setActiveTab(t);
                localStorage.setItem('activeTab', t);
              }} 
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
        className={`transition-all duration-300 min-h-screen ${currentUser ? (isSidebarCollapsed ? 'lg:mr-24' : 'lg:mr-80') : ''} ${currentUser ? 'px-4 pb-6 lg:p-10 lg:pt-10' : ''}`}
      >
        {currentUser ? renderContent() : <Login users={users} systemConfig={systemConfig} onLogin={handleLoginSuccess} onAlert={addLocalNotification} />}
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
