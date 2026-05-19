-- Enable this only after implementing Supabase Auth or a backend/Edge Function
-- that issues JWTs containing a tenant_id claim.

alter table public.tenants enable row level security;
alter table public.users enable row level security;
alter table public.students enable row level security;
alter table public.supervision enable row level security;
alter table public.absences enable row level security;
alter table public.delivery_logs enable row level security;
alter table public.control_requests enable row level security;
alter table public.committee_reports enable row level security;
alter table public.system_config enable row level security;
alter table public.notifications enable row level security;
alter table public.envelope_openings enable row level security;

create policy "tenant can read own tenant"
on public.tenants for select
using (id = public.current_tenant_id());

create policy "tenant isolated users"
on public.users for all
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

create policy "tenant isolated students"
on public.students for all
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

create policy "tenant isolated supervision"
on public.supervision for all
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

create policy "tenant isolated absences"
on public.absences for all
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

create policy "tenant isolated delivery logs"
on public.delivery_logs for all
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

create policy "tenant isolated control requests"
on public.control_requests for all
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

create policy "tenant isolated committee reports"
on public.committee_reports for all
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

create policy "tenant isolated system config"
on public.system_config for all
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

create policy "tenant isolated notifications"
on public.notifications for all
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

create policy "tenant isolated envelope openings"
on public.envelope_openings for all
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());
