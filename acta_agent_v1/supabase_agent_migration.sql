-- ACTA Coordination Agent: work packages and internal artifact drafts.
-- Run in Supabase Dashboard > SQL Editor. Does not modify existing action_items rows.

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

create index if not exists idx_work_packages_company_created
  on public.work_packages(company_id, created_at desc);

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

create index if not exists idx_work_artifacts_package
  on public.work_artifacts(work_package_id, created_at);
create index if not exists idx_work_artifacts_company
  on public.work_artifacts(company_id, created_at desc);

-- Backend access should use the existing server-side Supabase service role.
-- Do not expose the service-role key in React/Vite code.
