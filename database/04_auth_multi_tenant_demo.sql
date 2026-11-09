-- ACTA Auth + tenant isolation + per-visitor NOVA demo sessions.
-- Run after ACTA_FULL_SUPABASE_SETUP.sql and 03_calendar_and_digest.sql.
-- acta_core_schema.sql is the older standalone core-schema alternative, not an extra step when the full setup has run.
-- This migration is additive. It does not delete or overwrite existing organization data.

begin;

create table if not exists public.company_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id text not null references public.companies(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','admin','member')),
  status text not null default 'active' check (status in ('active','invited','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_memberships_one_workspace_per_user unique (user_id)
);
create index if not exists idx_company_memberships_company on public.company_memberships(company_id);


-- Workspace invitations allow multiple real users to join the same company.
create table if not exists public.company_invitations (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references public.companies(id) on delete cascade,
  invite_token_hash text not null unique,
  invited_email text,
  role text not null default 'member' check (role in ('admin','member')),
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  expires_at timestamptz not null,
  created_by uuid references auth.users(id) on delete set null,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_company_invitations_company on public.company_invitations(company_id, status);
create index if not exists idx_company_invitations_expiry on public.company_invitations(expires_at);

-- A separate JSON workspace is created for each public demo visitor. The browser only receives
-- a random bearer token; only its SHA-256 hash is stored here.
create table if not exists public.acta_demo_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  client_key_hash text,
  workspace_state jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active','expired','revoked')),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.acta_demo_sessions add column if not exists client_key_hash text;
create index if not exists idx_acta_demo_sessions_expiry on public.acta_demo_sessions(expires_at);
create index if not exists idx_acta_demo_sessions_client_created on public.acta_demo_sessions(client_key_hash, created_at);

-- Per-company OAuth credentials belong in Supabase, never in one shared local token file.
create table if not exists public.company_integrations (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references public.companies(id) on delete cascade,
  provider text not null check (provider in ('google_calendar','telegram')),
  config jsonb not null default '{}'::jsonb,
  status text not null default 'connected' check (status in ('connected','disconnected','error')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, provider)
);
create index if not exists idx_company_integrations_company on public.company_integrations(company_id);

create table if not exists public.acta_oauth_states (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('google_calendar')),
  state_hash text not null unique,
  company_id text not null references public.companies(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_acta_oauth_states_expiry on public.acta_oauth_states(expires_at);

create or replace function public.acta_is_company_member(target_company_id text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.company_memberships m
    where m.user_id = auth.uid()
      and m.company_id = target_company_id
      and m.status = 'active'
  );
$$;

create or replace function public.acta_is_company_admin(target_company_id text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.company_memberships m
    where m.user_id = auth.uid()
      and m.company_id = target_company_id
      and m.status = 'active'
      and m.role in ('owner','admin')
  );
$$;

revoke all on function public.acta_is_company_member(text) from public;
revoke all on function public.acta_is_company_admin(text) from public;
grant execute on function public.acta_is_company_member(text) to authenticated;
grant execute on function public.acta_is_company_admin(text) to authenticated;

alter table public.company_memberships enable row level security;
alter table public.company_invitations enable row level security;
alter table public.acta_demo_sessions enable row level security;
alter table public.company_integrations enable row level security;
alter table public.acta_oauth_states enable row level security;

-- Membership rows are visible only to their own user, or an owner/admin in the same company.
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname='public' and tablename='company_memberships' loop
    execute format('drop policy if exists %I on public.company_memberships', pol.policyname);
  end loop;
end $$;
drop policy if exists acta_membership_read_self_or_admin on public.company_memberships;
create policy acta_membership_read_self_or_admin on public.company_memberships
for select to authenticated
using (user_id = auth.uid() or public.acta_is_company_admin(company_id));

-- Invitation tokens are managed only by trusted backend endpoints.
revoke all on public.company_invitations from anon, authenticated;
grant all on public.company_invitations to service_role;

-- User-created demo-session rows are never directly accessible from anon/authenticated clients.
revoke all on public.acta_demo_sessions from anon, authenticated;
grant all on public.acta_demo_sessions to service_role;
revoke all on public.acta_oauth_states from anon, authenticated;
grant all on public.acta_oauth_states to service_role;
-- OAuth refresh/access tokens are confidential: only the backend service role may access them.
revoke all on public.company_integrations from anon, authenticated;
grant all on public.company_integrations to service_role;

-- Companies: remove legacy policies before applying tenant restrictions.
alter table public.companies enable row level security;
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname='public' and tablename='companies' loop
    execute format('drop policy if exists %I on public.companies', pol.policyname);
  end loop;
end $$;
-- Companies: members may read their company; only owners/admins may update it.
drop policy if exists acta_company_member_select on public.companies;
create policy acta_company_member_select on public.companies
for select to authenticated using (public.acta_is_company_member(id));
drop policy if exists acta_company_admin_update on public.companies;
create policy acta_company_admin_update on public.companies
for update to authenticated using (public.acta_is_company_admin(id)) with check (public.acta_is_company_admin(id));

-- Tenant-owned tables use company_id. RLS remains the final isolation boundary even if a client
-- attempts to submit another company's ID or guesses a record UUID.
do $$
declare
  t text;
  pol record;
begin
  foreach t in array array[
    'divisions','employees','projects','action_items','meetings','meeting_files',
    'work_packages','work_artifacts','calendar_events','telegram_digest_preferences'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    -- Remove any earlier permissive policies so they cannot OR-bypass tenant membership.
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy if exists %I on public.%I', pol.policyname, t);
    end loop;
    execute format('drop policy if exists acta_company_member_all on public.%I', t);
    execute format(
      'create policy acta_company_member_all on public.%I for all to authenticated using (public.acta_is_company_member(company_id)) with check (public.acta_is_company_member(company_id))',
      t
    );
  end loop;
end $$;

-- Digest delivery history is readable but only the trusted backend scheduler may create/update it.
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname='public' and tablename='telegram_digest_runs' loop
    execute format('drop policy if exists %I on public.telegram_digest_runs', pol.policyname);
  end loop;
end $$;
alter table public.telegram_digest_runs enable row level security;
drop policy if exists acta_digest_runs_member_read on public.telegram_digest_runs;
create policy acta_digest_runs_member_read on public.telegram_digest_runs
for select to authenticated using (public.acta_is_company_member(company_id));

-- project_divisions has no company_id; scope through its parent project.
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where schemaname='public' and tablename='project_divisions' loop
    execute format('drop policy if exists %I on public.project_divisions', pol.policyname);
  end loop;
end $$;
alter table public.project_divisions enable row level security;
drop policy if exists acta_project_divisions_member_all on public.project_divisions;
create policy acta_project_divisions_member_all on public.project_divisions
for all to authenticated
using (exists (select 1 from public.projects p where p.id = project_id and public.acta_is_company_member(p.company_id)))
with check (exists (select 1 from public.projects p where p.id = project_id and public.acta_is_company_member(p.company_id)));

-- Grant only what authenticated workspace users need; the policies above still constrain each row.
grant select, insert, update, delete on
  public.companies, public.company_memberships, public.divisions, public.employees,
  public.projects, public.project_divisions, public.action_items, public.meetings,
  public.meeting_files, public.work_packages, public.work_artifacts,
  public.calendar_events, public.telegram_digest_preferences,
  public.telegram_digest_runs
 to authenticated;

grant usage on schema public to authenticated;

-- Keep demo rows out of API browser access. Backend uses the service-role key only after a
-- random demo token has been validated and only mutates that session's workspace_state JSON.

commit;

-- Optional maintenance: delete expired demo sessions periodically (service_role only).
-- delete from public.acta_demo_sessions where expires_at < now() - interval '7 days';
