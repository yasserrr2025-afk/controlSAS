-- =============================================================
-- إصلاح وتطوير نظام كنترول الاختبارات
-- Run in Supabase SQL Editor - Safe to run multiple times
-- =============================================================

-- 1. إضافة جدول استبعاد المراقبين (إذا لم يكن موجوداً)
CREATE TABLE IF NOT EXISTS public.proctor_exclusions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL,
  exam_date text NOT NULL,
  period integer NOT NULL DEFAULT 1,
  subject text NOT NULL DEFAULT 'اختبار',
  reason text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (tenant_id, teacher_id, exam_date, period, subject)
);

CREATE INDEX IF NOT EXISTS proctor_exclusions_tenant_idx
  ON public.proctor_exclusions(tenant_id, exam_date);

-- 2. جدول exam_schedule - إضافة unique constraint لمنع التكرار
-- أولاً احذف المكررات إذا وجدت
DELETE FROM public.exam_schedule a
  USING public.exam_schedule b
  WHERE a.id > b.id
    AND a.tenant_id = b.tenant_id
    AND a.exam_date = b.exam_date
    AND a.subject = b.subject
    AND a.period = b.period;

-- أضف الـ constraint
ALTER TABLE public.exam_schedule
  DROP CONSTRAINT IF EXISTS exam_schedule_tenant_date_subject_period_unique;

ALTER TABLE public.exam_schedule
  ADD CONSTRAINT exam_schedule_tenant_date_subject_period_unique
  UNIQUE (tenant_id, exam_date, subject, period);

-- 3. إضافة exam_schedule إذا لم تكن موجودة أصلاً
CREATE TABLE IF NOT EXISTS public.exam_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  exam_date text NOT NULL,
  day_name text,
  subject text NOT NULL,
  period integer NOT NULL DEFAULT 1,
  start_time text NOT NULL DEFAULT '08:00',
  end_time text,
  grades text[] DEFAULT '{}',
  committees text[] DEFAULT '{}',
  notes text,
  status text DEFAULT 'READY',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (tenant_id, exam_date, subject, period)
);

CREATE INDEX IF NOT EXISTS exam_schedule_tenant_date_idx
  ON public.exam_schedule(tenant_id, exam_date, period);

-- 4. تفعيل RLS لجدول proctor_exclusions
ALTER TABLE public.proctor_exclusions ENABLE ROW LEVEL SECURITY;

-- سياسة عزل المستأجر
DROP POLICY IF EXISTS "tenant isolated proctor exclusions" ON public.proctor_exclusions;
CREATE POLICY "tenant isolated proctor exclusions"
ON public.proctor_exclusions FOR ALL
USING (tenant_id::text = current_setting('app.tenant_id', true))
WITH CHECK (tenant_id::text = current_setting('app.tenant_id', true));

-- صلاحيات الوصول
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proctor_exclusions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proctor_exclusions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_schedule TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_schedule TO authenticated;

-- 5. إضافة index للـ supervision للبحث السريع
CREATE INDEX IF NOT EXISTS supervision_teacher_date_idx
  ON public.supervision(tenant_id, teacher_id, date);

-- تم بنجاح ✓
