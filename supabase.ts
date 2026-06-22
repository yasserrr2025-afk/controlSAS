
import { createClient } from '@supabase/supabase-js';
import { User, Student, Absence, Supervision, ControlRequest, DeliveryLog, SystemConfig, CommitteeReport, EnvelopeOpening, ExamSchedule, SupervisorVisit, AppNotification, PushSubscriptionRecord, ExamEnvelope } from './types';

const supabaseUrl = 'https://yronlodrolzaefebqwyn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlyb25sb2Ryb2x6YWVmZWJxd3luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMTU0MzksImV4cCI6MjA5NDc5MTQzOX0.ARvRLaB1amQhPUzl8rq1peAO3sw8LVgR8pBGtpDBT-8';

export const supabase = createClient(supabaseUrl, supabaseKey);

const handleError = (error: any, context: string) => {
  if (error) {
    // استخراج الرسالة النصية للخطأ بدقة
    const message = error.message || error.details || (typeof error === 'string' ? error : JSON.stringify(error));
    console.error(`Supabase Error [${context}]:`, message);
    return message;
  }
  return null;
};

export const db = {
  users: {
    getAll: async () => {
      const { data, error } = await supabase.from('users').select('*');
      const err = handleError(error, "users.getAll");
      if (err) throw new Error(err);
      return (data || []) as User[];
    },
    getById: async (nationalId: string) => {
      const cleanId = String(nationalId || '').replace(/\D/g, '');
      const { data, error } = await supabase.rpc('login_by_national_id', {
        p_national_id: cleanId,
        p_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      }).maybeSingle();
      const err = handleError(error, "users.getById");
      if (err) throw new Error(err);
      if (data) return data as User;

      const direct = await supabase
        .from('users')
        .select('*')
        .eq('national_id', cleanId)
        .maybeSingle();
      const directErr = handleError(direct.error, "users.getById.direct");
      if (directErr) throw new Error(directErr);
      return direct.data as User;
    },
    upsert: async (users: any[]) => {
      for (const user of users) {
        if (user.id) {
          const existing = await supabase
            .from('users')
            .select('id')
            .eq('id', user.id)
            .maybeSingle();
          const existingErr = handleError(existing.error, "users.exists");
          if (existingErr) throw new Error(existingErr);

          if (existing.data?.id) {
            const { error } = await supabase.from('users').update(user).eq('id', user.id);
            const err = handleError(error, "users.update");
            if (err) throw new Error(err);
            continue;
          }
        }

        const { error } = await supabase.from('users').insert(user);
        const err = handleError(error, "users.insert");
        if (err) throw new Error(err);
      }
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('users').delete().eq('id', id);
      const err = handleError(error, "users.delete");
      if (err) throw new Error(err);
    }
  },

  students: {
    getAll: async () => {
      const { data, error } = await supabase.from('students').select('*');
      const err = handleError(error, "students.getAll");
      if (err) throw new Error(err);
      return (data || []) as Student[];
    },
    upsert: async (students: any[]) => {
      const { error } = await supabase.from('students').upsert(students, { onConflict: 'id' });
      const err = handleError(error, "students.upsert");
      if (err) throw new Error(err);
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('students').delete().eq('id', id);
      const err = handleError(error, "students.delete");
      if (err) throw new Error(err);
    }
  },

  committeeReports: {
    getAll: async () => {
      const { data, error } = await supabase.from('committee_reports').select('*').order('created_at', { ascending: false });
      const err = handleError(error, "committeeReports.getAll");
      if (err) throw new Error(err);
      return (data || []) as CommitteeReport[];
    },
    upsert: async (report: Partial<CommitteeReport>) => {
      const { error } = await supabase.from('committee_reports').upsert([report], { onConflict: 'id' });
      const err = handleError(error, "committeeReports.upsert");
      if (err) throw new Error(err);
    }
  },

  controlRequests: {
    getAll: async () => {
      const { data, error } = await supabase.from('control_requests').select('*').order('id', { ascending: false });
      const err = handleError(error, "controlRequests.getAll");
      if (err) throw new Error(err);
      return (data || []).map((d: any) => ({
        id: d.id,
        from: d.from_user_name,
        committee: d.committee_number,
        text: d.text,
        time: d.time,
        status: d.status,
        assistant_name: d.assistant_name
      })) as ControlRequest[];
    },
    insert: async (req: Partial<ControlRequest>) => {
      const { error } = await supabase.from('control_requests').insert([{
        from_user_name: req.from,
        committee_number: req.committee,
        text: req.text,
        time: req.time,
        status: req.status || 'PENDING'
      }]);
      const err = handleError(error, "controlRequests.insert");
      if (err) throw new Error(err);
    },
    updateStatus: async (id: string, status: string, assistantName?: string) => {
      const updateData: any = { status };
      if (assistantName) updateData.assistant_name = assistantName;
      const { error } = await supabase.from('control_requests').update(updateData).eq('id', id);
      const err = handleError(error, "controlRequests.updateStatus");
      if (err) throw new Error(err);
    },
    deleteByCommittees: async (committeeNumbers: string[]) => {
      const cleanNumbers = committeeNumbers.filter(Boolean);
      if (!cleanNumbers.length) return;
      const { error } = await supabase.from('control_requests').delete().in('committee_number', cleanNumbers);
      const err = handleError(error, "controlRequests.deleteByCommittees");
      if (err) throw new Error(err);
    }
  },

  absences: {
    getAll: async () => {
      const { data, error } = await supabase.from('absences').select('*');
      const err = handleError(error, "absences.getAll");
      if (err) throw new Error(err);
      return (data || []) as Absence[];
    },
    upsert: async (absence: Partial<Absence>) => {
      const { error } = await supabase.from('absences').upsert([absence], { onConflict: 'id' });
      if (error?.code === '23505' && String(error.message || '').includes('absences_student_id_key')) {
        const { error: fallbackError } = await supabase
          .from('absences')
          .upsert([absence], { onConflict: 'student_id' });
        const fallbackErr = handleError(fallbackError, "absences.upsertByStudent");
        if (fallbackErr) throw new Error(fallbackErr);
        return;
      }
      const err = handleError(error, "absences.upsert");
      if (err) throw new Error(err);
    },
    delete: async (studentId: string, period?: number, date?: string) => {
      let query = supabase.from('absences').delete().eq('student_id', studentId);
      if (period !== undefined) query = query.eq('period', period);
      if (date) query = query.gte('date', `${date}T00:00:00`).lt('date', `${date}T23:59:59.999Z`);
      const { error } = await query;
      const err = handleError(error, "absences.delete");
      if (err) throw new Error(err);
    }
  },

  supervision: {
    getAll: async () => {
      const { data, error } = await supabase
        .from('supervision')
        .select('*')
        .order('date', { ascending: false })
        .limit(5000);
      const err = handleError(error, "supervision.getAll");
      if (err) throw new Error(err);
      return (data || []) as Supervision[];
    },
    insert: async (sv: Partial<Supervision>) => {
      const { error } = await supabase.from('supervision').insert([sv]);
      const err = handleError(error, "supervision.insert");
      if (err) throw new Error(err);
    },
    deleteByTeacherId: async (teacherId: string) => {
      const { error } = await supabase.from('supervision').delete().eq('teacher_id', teacherId);
      const err = handleError(error, "supervision.delete");
      if (err) throw new Error(err);
    }
  },

  examSchedule: {
    getAll: async () => {
      const { data, error } = await supabase
        .from('exam_schedule')
        .select('*')
        .order('exam_date', { ascending: true })
        .order('period', { ascending: true });
      const err = handleError(error, "examSchedule.getAll");
      if (err) throw new Error(err);
      return (data || []) as ExamSchedule[];
    },
    upsert: async (item: Partial<ExamSchedule>) => {
      const { error } = await supabase.from('exam_schedule').upsert([item], { onConflict: 'id' });
      const err = handleError(error, "examSchedule.upsert");
      if (err) throw new Error(err);
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('exam_schedule').delete().eq('id', id);
      const err = handleError(error, "examSchedule.delete");
      if (err) throw new Error(err);
    }
  },

  deliveryLogs: {
    getAll: async () => {
      const { data, error } = await supabase.from('delivery_logs').select('*');
      const err = handleError(error, "deliveryLogs.getAll");
      if (err) throw new Error(err);
      return (data || []) as DeliveryLog[];
    },
    upsert: async (log: Partial<DeliveryLog>) => {
      const { error } = await supabase.from('delivery_logs').upsert([log], { onConflict: 'id' });
      const err = handleError(error, "deliveryLogs.upsert");
      if (err) throw new Error(err);
    }
  },

  config: {
    get: async () => {
      const { data, error } = await supabase.from('system_config').select('*').maybeSingle();
      handleError(error, "config.get");
      return data as SystemConfig;
    },
    upsert: async (config: Partial<SystemConfig>) => {
      const { error } = await supabase.from('system_config').upsert([{ ...config, id: 'main_config' }], { onConflict: 'id' });
      const err = handleError(error, "config.upsert");
      if (err) throw new Error(err);
    }
  },

  notifications: {
    getRecent: async (sinceIso?: string) => {
      let query = supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (sinceIso) query = query.gte('created_at', sinceIso);
      const { data, error } = await query;
      const err = handleError(error, "notifications.getRecent");
      if (err) throw new Error(err);
      return (data || []) as AppNotification[];
    },
    broadcast: async (message: string, target: string, sender: string) => {
      const { error } = await supabase.from('notifications').insert([{
        message,
        target,
        sender,
        created_at: new Date().toISOString()
      }]);
      const err = handleError(error, "notifications.broadcast");
      if (err) throw new Error(err);

      const pushResult = await supabase.functions.invoke('send-push-notification', {
        body: { message, target, sender },
      });
      if (pushResult.error) {
        console.warn('Push notification function warning:', pushResult.error.message);
      }
    }
  },

  pushSubscriptions: {
    upsert: async (user: User, subscription: any) => {
      const endpoint = subscription?.endpoint;
      if (!endpoint) throw new Error('تعذر قراءة معرف اشتراك الجهاز.');
      const record: PushSubscriptionRecord = {
        user_id: user.id,
        user_role: user.role,
        endpoint,
        subscription,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert([record], { onConflict: 'endpoint' });
      const err = handleError(error, "pushSubscriptions.upsert");
      if (err) throw new Error(err);
    },
  },

  envelopeOpenings: {
    getAll: async () => {
      const { data, error } = await supabase
        .from('envelope_openings')
        .select('*')
        .order('time', { ascending: false })
        .limit(500);
      const err = handleError(error, "envelopeOpenings.getAll");
      if (err) throw new Error(err);
      return (data || []) as EnvelopeOpening[];
    },
    upsert: async (envelope: Partial<EnvelopeOpening>) => {
      const { error } = await supabase.from('envelope_openings').upsert([envelope], { onConflict: 'id' });
      const err = handleError(error, "envelopeOpenings.upsert");
      if (err) throw new Error(err);
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('envelope_openings').delete().eq('id', id);
      const err = handleError(error, "envelopeOpenings.delete");
      if (err) throw new Error(err);
    }
  },

  examEnvelopes: {
    getAll: async () => {
      const { data, error } = await supabase
        .from('exam_envelopes')
        .select('*')
        .order('created_at', { ascending: false });
      const err = handleError(error, "examEnvelopes.getAll");
      if (err) throw new Error(err);
      return (data || []) as ExamEnvelope[];
    },
    getById: async (id: string) => {
      const { data, error } = await supabase
        .from('exam_envelopes')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      const err = handleError(error, "examEnvelopes.getById");
      if (err) throw new Error(err);
      return data as ExamEnvelope | null;
    },
    upsert: async (envelope: Partial<ExamEnvelope>) => {
      const { error } = await supabase
        .from('exam_envelopes')
        .upsert([{ ...envelope, updated_at: new Date().toISOString() }], { onConflict: 'id' });
      const err = handleError(error, "examEnvelopes.upsert");
      if (err) throw new Error(err);
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('exam_envelopes').delete().eq('id', id);
      const err = handleError(error, "examEnvelopes.delete");
      if (err) throw new Error(err);
    },
    deleteMany: async (ids: string[]) => {
      if (!ids.length) return;
      const { error } = await supabase.from('exam_envelopes').delete().in('id', ids);
      const err = handleError(error, "examEnvelopes.deleteMany");
      if (err) throw new Error(err);
    },
    markOpened: async (id: string, openingId: string, openedBy: string) => {
      const { data, error } = await supabase
        .from('exam_envelopes')
        .update({
          status: 'OPENED',
          opening_id: openingId,
          opened_by: openedBy,
          opened_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('status', 'READY')
        .is('opening_id', null)
        .select('id')
        .maybeSingle();
      const err = handleError(error, "examEnvelopes.markOpened");
      if (err) throw new Error(err);
      if (!data?.id) throw new Error('هذا المظروف تم فتحه مسبقاً ولا يمكن تكرار فتحه.');
    }
  },

  supervisorVisits: {
    getAll: async () => {
      const { data, error } = await supabase.from('supervisor_visits').select('*').order('created_at', { ascending: false });
      const err = handleError(error, "supervisorVisits.getAll");
      if (err) throw new Error(err);
      return (data || []) as SupervisorVisit[];
    },
    getById: async (id: string) => {
      const { data, error } = await supabase.from('supervisor_visits').select('*').eq('id', id).maybeSingle();
      const err = handleError(error, "supervisorVisits.getById");
      if (err) throw new Error(err);
      return data as SupervisorVisit | null;
    },
    getByPortfolioToken: async (token: string) => {
      const { data, error } = await supabase.from('supervisor_visits').select('*').eq('portfolio_token', token).maybeSingle();
      const err = handleError(error, "supervisorVisits.getByPortfolioToken");
      if (err) throw new Error(err);
      return data as SupervisorVisit | null;
    },
    upsert: async (visit: Partial<SupervisorVisit>) => {
      const { error } = await supabase.from('supervisor_visits').upsert([visit], { onConflict: 'id' });
      const err = handleError(error, "supervisorVisits.upsert");
      if (err) throw new Error(err);
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('supervisor_visits').delete().eq('id', id);
      const err = handleError(error, "supervisorVisits.delete");
      if (err) throw new Error(err);
    }
  },

  archiveBoxes: {
    getAll: async () => {
      const { data, error } = await supabase.from('archive_boxes').select('*').order('created_at', { ascending: false });
      if (error) {
        // Table might not exist yet — return empty
        console.warn('archive_boxes table not found, using localStorage fallback');
        try { return JSON.parse(localStorage.getItem('control_archive_boxes') || '[]'); } catch { return []; }
      }
      return data || [];
    },
    upsert: async (box: any) => {
      const { error } = await supabase.from('archive_boxes').upsert([box], { onConflict: 'id' });
      if (error) {
        console.warn('archive_boxes upsert failed, saving to localStorage', error.message);
        try {
          const all = JSON.parse(localStorage.getItem('control_archive_boxes') || '[]');
          const idx = all.findIndex((b: any) => b.id === box.id);
          if (idx >= 0) all[idx] = box; else all.unshift(box);
          localStorage.setItem('control_archive_boxes', JSON.stringify(all));
        } catch {}
      }
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('archive_boxes').delete().eq('id', id);
      if (error) {
        try {
          const all = JSON.parse(localStorage.getItem('control_archive_boxes') || '[]');
          localStorage.setItem('control_archive_boxes', JSON.stringify(all.filter((b: any) => b.id !== id)));
        } catch {}
      }
    }
  }
};
