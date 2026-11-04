-- ACTA core database additions: meetings, meeting files, tasks and agent artifacts.
-- Idempotent: safe to apply after the original organization setup.
begin;

create table if not exists public.action_items (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references public.companies(id) on delete cascade,
  project_id text null references public.projects(id) on delete set null,
  task text not null,
  deadline_text text null,
  owner_mentioned text null,
  evidence text null,
  suggested_owners jsonb not null default '[]'::jsonb,
  selected_owner_id text null,
  status text not null default 'pending_review',
  source_transcript text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Add columns used by current ACTA code if an older action_items table exists.
alter table public.action_items add column if not exists project_id text;
alter table public.action_items add column if not exists deadline_text text;
alter table public.action_items add column if not exists owner_mentioned text;
alter table public.action_items add column if not exists evidence text;
alter table public.action_items add column if not exists suggested_owners jsonb not null default '[]'::jsonb;
alter table public.action_items add column if not exists selected_owner_id text;
alter table public.action_items add column if not exists source_transcript text not null default '';
alter table public.action_items add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_action_items_company_created
  on public.action_items(company_id, created_at desc);
create index if not exists idx_action_items_status
  on public.action_items(status);
create index if not exists idx_action_items_selected_owner
  on public.action_items(selected_owner_id);

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  company_id text not null default 'nova' references public.companies(id) on delete cascade,
  title text not null default 'Untitled meeting',
  source_type text not null default 'external_upload',
  status text not null default 'draft',
  transcript_text text null,
  summary text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.meeting_files (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  company_id text not null references public.companies(id) on delete cascade,
  original_file_name text not null,
  storage_bucket text not null default 'acta-meeting-files',
  storage_path text not null,
  mime_type text not null default 'application/octet-stream',
  size_bytes bigint not null default 0,
  file_kind text not null default 'other',
  processing_status text not null default 'uploaded',
  created_at timestamptz not null default now()
);

create index if not exists idx_meetings_company_created
  on public.meetings(company_id, created_at desc);
create index if not exists idx_meeting_files_meeting_created
  on public.meeting_files(meeting_id, created_at);
create unique index if not exists idx_meeting_files_storage_location
  on public.meeting_files(storage_bucket, storage_path);

-- Tables used by the Coordination Agent (internal drafts only).
create table if not exists public.work_packages (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references public.companies(id) on delete cascade,
  project_id text null references public.projects(id) on delete set null,
  title text not null,
  summary text not null default '',
  decisions jsonb not null default '[]'::jsonb,
  risks jsonb not null default '[]'::jsonb,
  open_questions jsonb not null default '[]'::jsonb,
  next_steps jsonb not null default '[]'::jsonb,
  source_transcript text not null,
  action_item_ids jsonb not null default '[]'::jsonb,
  tool_trace jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft','reviewed','executed','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.work_artifacts (
  id uuid primary key default gen_random_uuid(),
  work_package_id uuid not null references public.work_packages(id) on delete cascade,
  company_id text not null references public.companies(id) on delete cascade,
  artifact_type text not null check (artifact_type in ('task_brief','spreadsheet_draft','handoff_message','checklist','decision_log')),
  title text not null,
  audience text not null default 'ACTA reviewer',
  content jsonb not null default '{}'::jsonb,
  external_provider text null,
  external_url text null,
  sharing_status text not null default 'internal_draft' check (sharing_status in ('internal_draft','ready_to_publish','published','failed')),
  created_at timestamptz not null default now()
);

create index if not exists idx_work_packages_company_created
  on public.work_packages(company_id, created_at desc);
create index if not exists idx_work_artifacts_package
  on public.work_artifacts(work_package_id, created_at);
create index if not exists idx_work_artifacts_company
  on public.work_artifacts(company_id, created_at desc);

-- Keep browser access closed. FastAPI uses the server-side service_role key.
alter table public.action_items enable row level security;
alter table public.meetings enable row level security;
alter table public.meeting_files enable row level security;
alter table public.work_packages enable row level security;
alter table public.work_artifacts enable row level security;

grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;

-- Private meeting-file bucket. The FastAPI backend accesses it with service_role.
insert into storage.buckets (id, name, public)
values ('acta-meeting-files', 'acta-meeting-files', false)
on conflict (id) do update set public = false;

commit;
