# Smart Exam Control SaaS

منصة SaaS لإدارة الاختبارات واللجان لعدة مدارس أو جهات، مبنية بـ React وVite وSupabase.

## التشغيل المحلي

1. ثبت الحزم:
   `npm install`

2. أنشئ ملف `.env.local` من `.env.example` وضع بيانات Supabase:
   `VITE_SUPABASE_URL`
   `VITE_SUPABASE_ANON_KEY`

3. نفذ مخطط قاعدة البيانات من:
   `supabase/saas_schema.sql`

4. شغل المشروع:
   `npm run dev`

## ملاحظات SaaS

- تسجيل الدخول يحتاج رمز الجهة/المدرسة `tenant slug` مع رقم الهوية.
- كل الجداول الأساسية أصبحت تدعم `tenant_id` لعزل بيانات العملاء.
- سياسات RLS في `supabase/saas_schema.sql` جاهزة لنموذج الإنتاج، لكنها تحتاج Supabase Auth أو Backend يصدر JWT يحتوي `tenant_id`.

## الفحص

- `npm run typecheck`
- `npm run build`
