
import { createClient } from '@supabase/supabase-js';
import { User, Student, Absence, Supervision, ControlRequest, DeliveryLog, SystemConfig, CommitteeReport, EnvelopeOpening, ExamSchedule } from './types';

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
      const { error } = await supabase.from('absences').upsert([absence], { onConflict: 'student_id' });
      const err = handleError(error, "absences.upsert");
      if (err) throw new Error(err);
    },
    delete: async (studentId: string) => {
      const { error } = await supabase.from('absences').delete().eq('student_id', studentId);
      const err = handleError(error, "absences.delete");
      if (err) throw new Error(err);
    }
  },

  supervision: {
    getAll: async () => {
      const { data, error } = await supabase.from('supervision').select('*');
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
    broadcast: async (message: string, target: string, sender: string) => {
      const { error } = await supabase.from('notifications').insert([{
        message,
        target,
        sender,
        created_at: new Date().toISOString()
      }]);
      const err = handleError(error, "notifications.broadcast");
      if (err) throw new Error(err);
    }
  },

  envelopeOpenings: {
    getAll: async () => {
      const { data, error } = await supabase.from('envelope_openings').select('*');
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
