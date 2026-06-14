
import { createClient } from '@supabase/supabase-js';
import { User, Student, Absence, Supervision, ControlRequest, DeliveryLog, SystemConfig, CommitteeReport, EnvelopeOpening, Tenant, ExamSchedule, ArchiveBox } from './types';

const env = import.meta.env;
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;
const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

export const getSupabaseConfigStatus = () => {
  let urlHost = '';
  try {
    urlHost = supabaseUrl ? new URL(supabaseUrl).host : '';
  } catch {
    urlHost = 'INVALID_URL';
  }
  return {
    hasUrl: Boolean(supabaseUrl),
    hasAnonKey: Boolean(supabaseKey),
    urlHost,
    defaultTenantSlug: env.VITE_DEFAULT_TENANT_SLUG || '',
    mode: env.MODE || '',
    prod: Boolean(env.PROD),
  };
};

if (!supabaseUrl || !supabaseKey) {
  console.warn('Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

export const supabase = createClient(supabaseUrl || 'https://missing-supabase-url.invalid', supabaseKey || 'missing-key');

const ACTIVE_TENANT_KEY = 'activeTenantId';
const ACTIVE_TENANT_SLUG_KEY = 'activeTenantSlug';

export const getActiveTenantId = () => localStorage.getItem(ACTIVE_TENANT_KEY) || env.VITE_DEFAULT_TENANT_ID || '';
export const getActiveTenantSlug = () => localStorage.getItem(ACTIVE_TENANT_SLUG_KEY) || env.VITE_DEFAULT_TENANT_SLUG || '';

export const setActiveTenant = (tenant: Pick<Tenant, 'id' | 'slug'> | null) => {
  if (!tenant) {
    localStorage.removeItem(ACTIVE_TENANT_KEY);
    localStorage.removeItem(ACTIVE_TENANT_SLUG_KEY);
    return;
  }
  localStorage.setItem(ACTIVE_TENANT_KEY, tenant.id);
  localStorage.setItem(ACTIVE_TENANT_SLUG_KEY, tenant.slug);
};

const scopeToTenant = (query: any) => {
  const tenantId = getActiveTenantId();
  return tenantId ? query.eq('tenant_id', tenantId) : query.limit(0);
};

const withTenant = <T extends Record<string, any>>(row: T): T => {
  const tenantId = getActiveTenantId();
  return tenantId ? { ...row, tenant_id: row.tenant_id || tenantId } : row;
};

const withTenantList = <T extends Record<string, any>>(rows: T[]) => rows.map(withTenant);

const resolveTenantBySlug = async (slug?: string) => {
  if (!isSupabaseConfigured) {
    throw new Error('متغيرات Supabase غير موجودة في الاستضافة. أضف VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY في Vercel ثم أعد النشر.');
  }
  const normalizedSlug = (slug || getActiveTenantSlug()).trim().toLowerCase();
  if (!normalizedSlug) return null;
  const { data, error } = await supabase
    .from('tenants')
    .select('id,name,slug,status,plan,logo_url')
    .eq('slug', normalizedSlug)
    .maybeSingle();
  const err = handleError(error, 'tenants.resolveBySlug');
  if (err) throw new Error(err);
  if (data) setActiveTenant({ id: data.id, slug: data.slug });
  return data as Tenant | null;
};

const handleError = (error: any, context: string) => {
  if (error) {
    // استخراج الرسالة النصية للخطأ بدقة
    const message = error.message || error.details || (typeof error === 'string' ? error : JSON.stringify(error));
    console.error(`Supabase Error [${context}]:`, message);
    return message;
  }
  return null;
};

const supabaseRest = async <T = any>(path: string, options: RequestInit = {}) => {
  if (!isSupabaseConfigured) {
    throw new Error('متغيرات Supabase غير موجودة في الاستضافة. أضف VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY في Vercel ثم أعد النشر.');
  }
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json; charset=utf-8',
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = body?.message || body?.details || body?.hint || `Supabase REST ${response.status}`;
    throw new Error(message);
  }
  return body as T;
};

export const db = {
  tenants: {
    resolveBySlug: resolveTenantBySlug,
    getActive: async () => {
      const tenantId = getActiveTenantId();
      if (!tenantId) return null;
      const { data, error } = await supabase.from('tenants').select('*').eq('id', tenantId).maybeSingle();
      const err = handleError(error, 'tenants.getActive');
      if (err) throw new Error(err);
      return data as Tenant | null;
    },
    createSchool: async (input: {
      schoolName: string;
      slug: string;
      adminName: string;
      adminNationalId: string;
      adminPhone?: string;
    }) => {
      const slug = input.slug.trim().toLowerCase();
      try {
        const existing = await supabaseRest<any[]>(
          `tenants?select=id&slug=eq.${encodeURIComponent(slug)}`,
        );
        if (existing?.length) throw new Error('رمز المدرسة مستخدم مسبقًا. اختر رمزًا آخر.');

        const tenantRows = await supabaseRest<any[]>('tenants?select=id,name,slug,status,plan,logo_url', {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify([{
            name: input.schoolName.trim(),
            slug,
            status: 'TRIAL',
            plan: 'starter'
          }]),
        });
        const tenant = tenantRows?.[0];
        if (!tenant?.id) throw new Error('تعذر إنشاء سجل المدرسة.');

        const tenantId = tenant.id;
        const adminUser = {
          id: crypto.randomUUID(),
          tenant_id: tenantId,
          national_id: input.adminNationalId.trim(),
          full_name: input.adminName.trim(),
          role: 'ADMIN',
          phone: input.adminPhone?.trim() || '',
          assigned_committees: [],
          assigned_grades: []
        };

        try {
          await supabaseRest('system_config', {
            method: 'POST',
            headers: { Prefer: 'return=minimal' },
            body: JSON.stringify([{
              tenant_id: tenantId,
              id: 'main_config',
              exam_start_time: '08:00',
              active_exam_date: new Date().toISOString().split('T')[0],
              academic_year: '1446 / 1447',
              allow_manual_join: false
            }]),
          });

          const userRows = await supabaseRest<any[]>('users?select=*', {
            method: 'POST',
            headers: { Prefer: 'return=representation' },
            body: JSON.stringify([adminUser]),
          });
          const user = userRows?.[0];
          if (!user?.id) throw new Error('تعذر إنشاء مدير المدرسة.');

          setActiveTenant({ id: tenantId, slug });
          return {
            tenant: tenant as Tenant,
            user: { ...(user as User), tenant_name: tenant.name, tenant_slug: tenant.slug } as User
          };
        } catch (err) {
          await supabaseRest(`tenants?id=eq.${encodeURIComponent(tenantId)}`, {
            method: 'DELETE',
          }).catch(() => {});
          throw err;
        }
      } catch (err: any) {
        if (err?.message === 'Failed to fetch') {
          throw new Error('تعذر الاتصال بقاعدة Supabase. تحقق من الاتصال أو إعدادات VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY.');
        }
        throw err;
      }
    }
  },

  users: {
    getAll: async () => {
      const { data, error } = await scopeToTenant(supabase.from('users').select('*'));
      const err = handleError(error, "users.getAll");
      if (err) throw new Error(err);
      return (data || []) as User[];
    },
    getById: async (nationalId: string, tenantSlug?: string) => {
      const tenant = tenantSlug ? await resolveTenantBySlug(tenantSlug) : null;
      const tenantId = tenant?.id || getActiveTenantId();
      let query = supabase.from('users').select('*').eq('national_id', nationalId);
      if (tenantId) query = query.eq('tenant_id', tenantId);
      const { data, error } = await query.maybeSingle();
      const err = handleError(error, "users.getById");
      if (err) throw new Error(err);
      if (data?.tenant_id && data?.tenant_slug) setActiveTenant({ id: data.tenant_id, slug: data.tenant_slug });
      if (data?.tenant_id && !data?.tenant_slug && tenant) setActiveTenant({ id: data.tenant_id, slug: tenant.slug });
      return { ...(data || {}), tenant_name: tenant?.name, tenant_slug: tenant?.slug } as User;
    },
    upsert: async (users: any[]) => {
      const onConflict = getActiveTenantId() ? 'tenant_id,national_id' : 'national_id';
      const { error } = await supabase.from('users').upsert(withTenantList(users), { onConflict });
      const err = handleError(error, "users.upsert");
      if (err) throw new Error(err);
    },
    delete: async (id: string) => {
      const tenantId = getActiveTenantId();
      let query = supabase.from('users').delete().eq('id', id);
      if (tenantId) query = query.eq('tenant_id', tenantId);
      const { error } = await query;
      const err = handleError(error, "users.delete");
      if (err) throw new Error(err);
    }
  },

  students: {
    getAll: async () => {
      const { data, error } = await scopeToTenant(supabase.from('students').select('*'));
      const err = handleError(error, "students.getAll");
      if (err) throw new Error(err);
      return (data || []) as Student[];
    },
    upsert: async (students: any[]) => {
      const onConflict = getActiveTenantId() ? 'tenant_id,national_id' : 'national_id';
      const { error } = await supabase.from('students').upsert(withTenantList(students), { onConflict });
      const err = handleError(error, "students.upsert");
      if (err) throw new Error(err);
    },
    delete: async (id: string) => {
      const tenantId = getActiveTenantId();
      let query = supabase.from('students').delete().eq('id', id);
      if (tenantId) query = query.eq('tenant_id', tenantId);
      const { error } = await query;
      const err = handleError(error, "students.delete");
      if (err) throw new Error(err);
    }
  },

  committeeReports: {
    getAll: async () => {
      const { data, error } = await scopeToTenant(supabase.from('committee_reports').select('*')).order('created_at', { ascending: false });
      const err = handleError(error, "committeeReports.getAll");
      if (err) throw new Error(err);
      return (data || []) as CommitteeReport[];
    },
    upsert: async (report: Partial<CommitteeReport>) => {
      const { error } = await supabase.from('committee_reports').upsert([withTenant(report)], { onConflict: 'id' });
      const err = handleError(error, "committeeReports.upsert");
      if (err) throw new Error(err);
    }
  },

  controlRequests: {
    getAll: async () => {
      const { data, error } = await scopeToTenant(supabase.from('control_requests').select('*')).order('id', { ascending: false });
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
      const { error } = await supabase.from('control_requests').insert([withTenant({
        from_user_name: req.from,
        committee_number: req.committee,
        text: req.text,
        time: req.time,
        status: req.status || 'PENDING'
      })]);
      const err = handleError(error, "controlRequests.insert");
      if (err) throw new Error(err);
    },
    updateStatus: async (id: string, status: string, assistantName?: string) => {
      const updateData: any = { status };
      if (assistantName) updateData.assistant_name = assistantName;
      const tenantId = getActiveTenantId();
      let query = supabase.from('control_requests').update(updateData).eq('id', id);
      if (tenantId) query = query.eq('tenant_id', tenantId);
      const { error } = await query;
      const err = handleError(error, "controlRequests.updateStatus");
      if (err) throw new Error(err);
    }
  },

  absences: {
    getAll: async () => {
      const { data, error } = await scopeToTenant(supabase.from('absences').select('*'));
      const err = handleError(error, "absences.getAll");
      if (err) throw new Error(err);
      return (data || []) as Absence[];
    },
    upsert: async (absence: Partial<Absence>) => {
      const onConflict = getActiveTenantId() ? 'tenant_id,student_id,date,period' : 'student_id';
      const { error } = await supabase.from('absences').upsert([withTenant(absence)], { onConflict });
      const err = handleError(error, "absences.upsert");
      if (err) throw new Error(err);
    },
    delete: async (studentId: string) => {
      const tenantId = getActiveTenantId();
      let query = supabase.from('absences').delete().eq('student_id', studentId);
      if (tenantId) query = query.eq('tenant_id', tenantId);
      const { error } = await query;
      const err = handleError(error, "absences.delete");
      if (err) throw new Error(err);
    }
  },

  supervision: {
    getAll: async () => {
      const { data, error } = await scopeToTenant(supabase.from('supervision').select('*'));
      const err = handleError(error, "supervision.getAll");
      if (err) throw new Error(err);
      return (data || []) as Supervision[];
    },
    insert: async (sv: Partial<Supervision>) => {
      const { error } = await supabase.from('supervision').insert([withTenant(sv)]);
      const err = handleError(error, "supervision.insert");
      if (err) throw new Error(err);
    },
    deleteByTeacherId: async (teacherId: string) => {
      const tenantId = getActiveTenantId();
      let query = supabase.from('supervision').delete().eq('teacher_id', teacherId);
      if (tenantId) query = query.eq('tenant_id', tenantId);
      const { error } = await query;
      const err = handleError(error, "supervision.delete");
      if (err) throw new Error(err);
    },
    deleteByCommittee: async (committeeNumber: string) => {
      const tenantId = getActiveTenantId();
      let query = supabase.from('supervision').delete().eq('committee_number', committeeNumber);
      if (tenantId) query = query.eq('tenant_id', tenantId);
      const { error } = await query;
      const err = handleError(error, "supervision.deleteByCommittee");
      if (err) throw new Error(err);
    }
  },

  examSchedule: {
    getAll: async () => {
      const { data, error } = await scopeToTenant(
        supabase
          .from('exam_schedule')
          .select('*')
          .order('exam_date', { ascending: true })
          .order('period', { ascending: true })
      );
      if (error) {
        console.warn('exam_schedule table not found or unavailable, using empty list');
        return [] as ExamSchedule[];
      }
      return (data || []) as ExamSchedule[];
    },
    upsert: async (item: Partial<ExamSchedule>) => {
      const { error } = await supabase.from('exam_schedule').upsert([withTenant(item)], { onConflict: 'id' });
      const err = handleError(error, "examSchedule.upsert");
      if (err) throw new Error(err);
    },
    delete: async (id: string) => {
      const tenantId = getActiveTenantId();
      let query = supabase.from('exam_schedule').delete().eq('id', id);
      if (tenantId) query = query.eq('tenant_id', tenantId);
      const { error } = await query;
      const err = handleError(error, "examSchedule.delete");
      if (err) throw new Error(err);
    }
  },

  deliveryLogs: {
    getAll: async () => {
      const { data, error } = await scopeToTenant(supabase.from('delivery_logs').select('*'));
      const err = handleError(error, "deliveryLogs.getAll");
      if (err) throw new Error(err);
      return (data || []) as DeliveryLog[];
    },
    upsert: async (log: Partial<DeliveryLog>) => {
      const { error } = await supabase.from('delivery_logs').upsert([withTenant(log)], { onConflict: 'id' });
      const err = handleError(error, "deliveryLogs.upsert");
      if (err) throw new Error(err);
    }
  },

  config: {
    get: async () => {
      const { data, error } = await scopeToTenant(supabase.from('system_config').select('*')).maybeSingle();
      handleError(error, "config.get");
      return data as SystemConfig;
    },
    upsert: async (config: Partial<SystemConfig>) => {
      const onConflict = getActiveTenantId() ? 'tenant_id,id' : 'id';
      const { error } = await supabase.from('system_config').upsert([withTenant({ ...config, id: 'main_config' })], { onConflict });
      const err = handleError(error, "config.upsert");
      if (err) throw new Error(err);
    }
  },

  notifications: {
    broadcast: async (message: string, target: string, sender: string) => {
      const { error } = await supabase.from('notifications').insert([withTenant({
        message,
        target,
        sender,
        created_at: new Date().toISOString()
      })]);
      const err = handleError(error, "notifications.broadcast");
      if (err) throw new Error(err);
    }
  },

  envelopeOpenings: {
    getAll: async () => {
      const { data, error } = await scopeToTenant(supabase.from('envelope_openings').select('*'));
      const err = handleError(error, "envelopeOpenings.getAll");
      if (err) throw new Error(err);
      return (data || []) as EnvelopeOpening[];
    },
    upsert: async (envelope: Partial<EnvelopeOpening>) => {
      const { error } = await supabase.from('envelope_openings').upsert([withTenant(envelope)], { onConflict: 'id' });
      const err = handleError(error, "envelopeOpenings.upsert");
      if (err) throw new Error(err);
    },
    delete: async (id: string) => {
      const tenantId = getActiveTenantId();
      let query = supabase.from('envelope_openings').delete().eq('id', id);
      if (tenantId) query = query.eq('tenant_id', tenantId);
      const { error } = await query;
      const err = handleError(error, "envelopeOpenings.delete");
      if (err) throw new Error(err);
    }
  },

  archiveBoxes: {
    getAll: async () => {
      const { data, error } = await scopeToTenant(
        supabase.from('archive_boxes').select('*').order('created_at', { ascending: false })
      );
      if (error) {
        console.warn('archive_boxes table not found, using empty list');
        return [] as ArchiveBox[];
      }
      return (data || []) as ArchiveBox[];
    },
    upsert: async (box: Partial<ArchiveBox>) => {
      const { error } = await supabase.from('archive_boxes').upsert([withTenant(box)], { onConflict: 'id' });
      const err = handleError(error, "archiveBoxes.upsert");
      if (err) throw new Error(err);
    },
    delete: async (id: string) => {
      const tenantId = getActiveTenantId();
      let query = supabase.from('archive_boxes').delete().eq('id', id);
      if (tenantId) query = query.eq('tenant_id', tenantId);
      const { error } = await query;
      const err = handleError(error, "archiveBoxes.delete");
      if (err) throw new Error(err);
    }
  }
};
