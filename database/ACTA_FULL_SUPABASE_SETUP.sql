-- ACTA / NOVA demo database bootstrap
-- Run this file once in Supabase Dashboard > SQL Editor > New query.
-- All organization records are fictional demo data.
-- RLS is enabled with no client-facing policies. The backend should access
-- these tables using a server-side secret key only; never expose it in the frontend.

begin;

create table if not exists public.companies (
  id text primary key,
  name text not null,
  industry text,
  description text,
  is_fictional_demo_data boolean not null default true,
  schema_version text not null default '1.0.0',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.divisions (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  name text not null,
  description text,
  responsibilities jsonb not null default '[]'::jsonb,
  keywords jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.employees (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  division_id text not null references public.divisions(id) on delete restrict,
  name text not null,
  role text not null,
  job_description text,
  specialization jsonb not null default '[]'::jsonb,
  skills jsonb not null default '[]'::jsonb,
  current_open_tasks integer not null default 0 check (current_open_tasks >= 0),
  max_concurrent_tasks integer not null default 1 check (max_concurrent_tasks >= 1),
  availability_status text not null default 'available' check (availability_status in ('available', 'limited', 'unavailable')),
  previous_assignments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.projects (
  id text primary key,
  company_id text not null references public.companies(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'active',
  project_context_keywords jsonb not null default '[]'::jsonb,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.project_divisions (
  project_id text not null references public.projects(id) on delete cascade,
  division_id text not null references public.divisions(id) on delete cascade,
  primary key (project_id, division_id)
);
create index if not exists idx_divisions_company_id on public.divisions(company_id);
create index if not exists idx_employees_company_id on public.employees(company_id);
create index if not exists idx_employees_division_id on public.employees(division_id);
create index if not exists idx_projects_company_id on public.projects(company_id);

-- Seed company
insert into public.companies (id, name, industry, description, is_fictional_demo_data, schema_version)
values ('nova', 'NOVA', 'B2B SaaS', 'A fictional B2B SaaS company used to test ACTA''s meeting-to-execution workflow.', true, '1.0.0')
on conflict (id) do update set
  name = excluded.name,
  industry = excluded.industry,
  description = excluded.description,
  is_fictional_demo_data = excluded.is_fictional_demo_data,
  schema_version = excluded.schema_version,
  updated_at = now();

-- Seed divisions
insert into public.divisions (id, company_id, name, description, responsibilities, keywords) values ('product_strategy', 'nova', 'Product & Strategy', 'Owns product direction, requirements, prioritization, and alignment between stakeholders.', '["product roadmap","requirements","product specification","prioritization","feature planning","product launch","stakeholder alignment"]'::jsonb, '["product","roadmap","requirement","feature","PRD","launch","specification","priority","product strategy"]'::jsonb)
on conflict (id) do update set company_id=excluded.company_id, name=excluded.name, description=excluded.description, responsibilities=excluded.responsibilities, keywords=excluded.keywords, updated_at=now();
insert into public.divisions (id, company_id, name, description, responsibilities, keywords) values ('engineering', 'nova', 'Engineering', 'Builds, integrates, deploys, and maintains the company''s software systems.', '["frontend development","backend development","API integration","database","deployment","infrastructure","software implementation","analytics instrumentation"]'::jsonb, '["frontend","backend","API","database","deploy","coding","integration","website","implementation","analytics","checkout","payment gateway"]'::jsonb)
on conflict (id) do update set company_id=excluded.company_id, name=excluded.name, description=excluded.description, responsibilities=excluded.responsibilities, keywords=excluded.keywords, updated_at=now();
insert into public.divisions (id, company_id, name, description, responsibilities, keywords) values ('ui_ux', 'nova', 'UI/UX', 'Researches user needs and designs usable interfaces, flows, and design systems.', '["user research","wireframes","prototypes","interface design","usability","design system","user flow"]'::jsonb, '["UI","UX","interface","prototype","wireframe","Figma","user research","usability","design system","checkout design"]'::jsonb)
on conflict (id) do update set company_id=excluded.company_id, name=excluded.name, description=excluded.description, responsibilities=excluded.responsibilities, keywords=excluded.keywords, updated_at=now();
insert into public.divisions (id, company_id, name, description, responsibilities, keywords) values ('marketing', 'nova', 'Marketing', 'Plans and delivers campaigns, content, branding, advertising, and promotional communications.', '["campaign strategy","social media","content creation","branding","email marketing","advertising","promotion"]'::jsonb, '["campaign","content","social media","branding","promotion","ads","email","marketing","launch campaign"]'::jsonb)
on conflict (id) do update set company_id=excluded.company_id, name=excluded.name, description=excluded.description, responsibilities=excluded.responsibilities, keywords=excluded.keywords, updated_at=now();
insert into public.divisions (id, company_id, name, description, responsibilities, keywords) values ('sales_business_development', 'nova', 'Sales & Business Development', 'Develops pipeline, manages client communication, and builds commercial partnerships.', '["lead generation","sales demos","proposals","client communication","partnerships","negotiation","sales pipeline"]'::jsonb, '["lead","client","demo","sales","proposal","partnership","deal","negotiation","pipeline"]'::jsonb)
on conflict (id) do update set company_id=excluded.company_id, name=excluded.name, description=excluded.description, responsibilities=excluded.responsibilities, keywords=excluded.keywords, updated_at=now();
insert into public.divisions (id, company_id, name, description, responsibilities, keywords) values ('finance', 'nova', 'Finance', 'Manages budgeting, invoices, payments, financial analysis, procurement approval, and cost control.', '["budgeting","invoicing","payments","financial analysis","procurement approval","cost control","expense tracking"]'::jsonb, '["budget","invoice","payment","cost","expense","finance","procurement","approval","financial analysis"]'::jsonb)
on conflict (id) do update set company_id=excluded.company_id, name=excluded.name, description=excluded.description, responsibilities=excluded.responsibilities, keywords=excluded.keywords, updated_at=now();
insert into public.divisions (id, company_id, name, description, responsibilities, keywords) values ('people_operations', 'nova', 'People & Operations', 'Coordinates people processes and internal operations, including hiring, scheduling, policies, and administration.', '["HR","internal operations","scheduling","policy","hiring","employee administration","internal events"]'::jsonb, '["HR","employee","hiring","schedule","policy","internal","operations","staff","administration"]'::jsonb)
on conflict (id) do update set company_id=excluded.company_id, name=excluded.name, description=excluded.description, responsibilities=excluded.responsibilities, keywords=excluded.keywords, updated_at=now();
insert into public.divisions (id, company_id, name, description, responsibilities, keywords) values ('customer_success', 'nova', 'Customer Success', 'Supports customer onboarding, training, feedback, retention, and account health.', '["customer onboarding","customer support","customer feedback","retention","customer issues","account health","training"]'::jsonb, '["customer","onboarding","support","feedback","retention","account","training","customer issue","account health"]'::jsonb)
on conflict (id) do update set company_id=excluded.company_id, name=excluded.name, description=excluded.description, responsibilities=excluded.responsibilities, keywords=excluded.keywords, updated_at=now();

-- Seed employees
insert into public.employees (id, company_id, division_id, name, role, job_description, specialization, skills, current_open_tasks, max_concurrent_tasks, availability_status, previous_assignments) values ('emp_nadia', 'nova', 'product_strategy', 'Nadia', 'Product Manager', 'Leads product roadmap planning, gathers requirements, and aligns product decisions with stakeholders.', '["product roadmap","requirements","stakeholder alignment"]'::jsonb, '["product management","roadmap planning","requirements analysis","prioritization"]'::jsonb, 3, 8, 'available', '["Product roadmap review"]'::jsonb)
on conflict (id) do update set company_id=excluded.company_id, division_id=excluded.division_id, name=excluded.name, role=excluded.role, job_description=excluded.job_description, specialization=excluded.specialization, skills=excluded.skills, current_open_tasks=excluded.current_open_tasks, max_concurrent_tasks=excluded.max_concurrent_tasks, availability_status=excluded.availability_status, previous_assignments=excluded.previous_assignments, updated_at=now();
insert into public.employees (id, company_id, division_id, name, role, job_description, specialization, skills, current_open_tasks, max_concurrent_tasks, availability_status, previous_assignments) values ('emp_farhan', 'nova', 'product_strategy', 'Farhan', 'Product Analyst', 'Researches product opportunities, analyzes product data, and supports evidence-based product decisions.', '["product research","data analysis"]'::jsonb, '["product research","data analysis","market analysis","requirements documentation"]'::jsonb, 2, 7, 'available', '["Product usage analysis"]'::jsonb)
on conflict (id) do update set company_id=excluded.company_id, division_id=excluded.division_id, name=excluded.name, role=excluded.role, job_description=excluded.job_description, specialization=excluded.specialization, skills=excluded.skills, current_open_tasks=excluded.current_open_tasks, max_concurrent_tasks=excluded.max_concurrent_tasks, availability_status=excluded.availability_status, previous_assignments=excluded.previous_assignments, updated_at=now();
insert into public.employees (id, company_id, division_id, name, role, job_description, specialization, skills, current_open_tasks, max_concurrent_tasks, availability_status, previous_assignments) values ('emp_budi', 'nova', 'engineering', 'Budi', 'Frontend Engineer', 'Implements web interfaces and frontend behavior using React and related web technologies.', '["React","frontend","web implementation"]'::jsonb, '["React","JavaScript","frontend development","landing pages","web analytics implementation"]'::jsonb, 6, 8, 'limited', '["Campaign A landing page","Dashboard interface"]'::jsonb)
on conflict (id) do update set company_id=excluded.company_id, division_id=excluded.division_id, name=excluded.name, role=excluded.role, job_description=excluded.job_description, specialization=excluded.specialization, skills=excluded.skills, current_open_tasks=excluded.current_open_tasks, max_concurrent_tasks=excluded.max_concurrent_tasks, availability_status=excluded.availability_status, previous_assignments=excluded.previous_assignments, updated_at=now();
insert into public.employees (id, company_id, division_id, name, role, job_description, specialization, skills, current_open_tasks, max_concurrent_tasks, availability_status, previous_assignments) values ('emp_raka', 'nova', 'engineering', 'Raka', 'Backend Engineer', 'Builds backend services, APIs, database integrations, and payment or third-party service integrations.', '["API","database","backend","payment integration"]'::jsonb, '["Python","REST API","PostgreSQL","backend development","payment gateway integration"]'::jsonb, 3, 8, 'available', '["Payment service integration","Customer data API"]'::jsonb)
on conflict (id) do update set company_id=excluded.company_id, division_id=excluded.division_id, name=excluded.name, role=excluded.role, job_description=excluded.job_description, specialization=excluded.specialization, skills=excluded.skills, current_open_tasks=excluded.current_open_tasks, max_concurrent_tasks=excluded.max_concurrent_tasks, availability_status=excluded.availability_status, previous_assignments=excluded.previous_assignments, updated_at=now();
insert into public.employees (id, company_id, division_id, name, role, job_description, specialization, skills, current_open_tasks, max_concurrent_tasks, availability_status, previous_assignments) values ('emp_sinta', 'nova', 'ui_ux', 'Sinta', 'Product Designer', 'Designs product interfaces and design systems, including checkout and other key user flows.', '["UI design","design systems","prototyping"]'::jsonb, '["Figma","interface design","prototyping","design systems","checkout UX"]'::jsonb, 3, 7, 'available', '["Checkout redesign"]'::jsonb)
on conflict (id) do update set company_id=excluded.company_id, division_id=excluded.division_id, name=excluded.name, role=excluded.role, job_description=excluded.job_description, specialization=excluded.specialization, skills=excluded.skills, current_open_tasks=excluded.current_open_tasks, max_concurrent_tasks=excluded.max_concurrent_tasks, availability_status=excluded.availability_status, previous_assignments=excluded.previous_assignments, updated_at=now();
insert into public.employees (id, company_id, division_id, name, role, job_description, specialization, skills, current_open_tasks, max_concurrent_tasks, availability_status, previous_assignments) values ('emp_kevin', 'nova', 'ui_ux', 'Kevin', 'UX Researcher', 'Conducts user research and usability studies to identify customer needs and interface problems.', '["user research","usability testing"]'::jsonb, '["user interviews","usability testing","research synthesis","user journey mapping"]'::jsonb, 2, 7, 'available', '["Enterprise onboarding research"]'::jsonb)
on conflict (id) do update set company_id=excluded.company_id, division_id=excluded.division_id, name=excluded.name, role=excluded.role, job_description=excluded.job_description, specialization=excluded.specialization, skills=excluded.skills, current_open_tasks=excluded.current_open_tasks, max_concurrent_tasks=excluded.max_concurrent_tasks, availability_status=excluded.availability_status, previous_assignments=excluded.previous_assignments, updated_at=now();
insert into public.employees (id, company_id, division_id, name, role, job_description, specialization, skills, current_open_tasks, max_concurrent_tasks, availability_status, previous_assignments) values ('emp_alya', 'nova', 'marketing', 'Alya', 'Marketing Lead', 'Leads campaign strategy, promotion planning, and coordination of marketing deliverables.', '["campaign strategy","marketing planning"]'::jsonb, '["campaign planning","marketing strategy","branding","performance marketing"]'::jsonb, 4, 8, 'available', '["Product launch campaign"]'::jsonb)
on conflict (id) do update set company_id=excluded.company_id, division_id=excluded.division_id, name=excluded.name, role=excluded.role, job_description=excluded.job_description, specialization=excluded.specialization, skills=excluded.skills, current_open_tasks=excluded.current_open_tasks, max_concurrent_tasks=excluded.max_concurrent_tasks, availability_status=excluded.availability_status, previous_assignments=excluded.previous_assignments, updated_at=now();
insert into public.employees (id, company_id, division_id, name, role, job_description, specialization, skills, current_open_tasks, max_concurrent_tasks, availability_status, previous_assignments) values ('emp_dimas', 'nova', 'marketing', 'Dimas', 'Content Specialist', 'Produces marketing content for social media, email, and campaign communication channels.', '["content","social media"]'::jsonb, '["copywriting","social media content","email marketing","content calendar"]'::jsonb, 3, 8, 'available', '["Feature announcement content"]'::jsonb)
on conflict (id) do update set company_id=excluded.company_id, division_id=excluded.division_id, name=excluded.name, role=excluded.role, job_description=excluded.job_description, specialization=excluded.specialization, skills=excluded.skills, current_open_tasks=excluded.current_open_tasks, max_concurrent_tasks=excluded.max_concurrent_tasks, availability_status=excluded.availability_status, previous_assignments=excluded.previous_assignments, updated_at=now();
insert into public.employees (id, company_id, division_id, name, role, job_description, specialization, skills, current_open_tasks, max_concurrent_tasks, availability_status, previous_assignments) values ('emp_reza', 'nova', 'sales_business_development', 'Reza', 'Account Executive', 'Manages prospects and clients, conducts sales demos, and advances opportunities through the sales pipeline.', '["client communication","sales demos","deals"]'::jsonb, '["sales","account management","client presentations","pipeline management"]'::jsonb, 5, 8, 'available', '["Enterprise customer demo"]'::jsonb)
on conflict (id) do update set company_id=excluded.company_id, division_id=excluded.division_id, name=excluded.name, role=excluded.role, job_description=excluded.job_description, specialization=excluded.specialization, skills=excluded.skills, current_open_tasks=excluded.current_open_tasks, max_concurrent_tasks=excluded.max_concurrent_tasks, availability_status=excluded.availability_status, previous_assignments=excluded.previous_assignments, updated_at=now();
insert into public.employees (id, company_id, division_id, name, role, job_description, specialization, skills, current_open_tasks, max_concurrent_tasks, availability_status, previous_assignments) values ('emp_citra', 'nova', 'sales_business_development', 'Citra', 'Business Development Specialist', 'Develops partnerships, identifies business opportunities, and supports commercial negotiations.', '["partnerships","business development"]'::jsonb, '["partnership development","negotiation","lead generation","proposal writing"]'::jsonb, 2, 7, 'available', '["Technology partner outreach"]'::jsonb)
on conflict (id) do update set company_id=excluded.company_id, division_id=excluded.division_id, name=excluded.name, role=excluded.role, job_description=excluded.job_description, specialization=excluded.specialization, skills=excluded.skills, current_open_tasks=excluded.current_open_tasks, max_concurrent_tasks=excluded.max_concurrent_tasks, availability_status=excluded.availability_status, previous_assignments=excluded.previous_assignments, updated_at=now();
insert into public.employees (id, company_id, division_id, name, role, job_description, specialization, skills, current_open_tasks, max_concurrent_tasks, availability_status, previous_assignments) values ('emp_fajar', 'nova', 'finance', 'Fajar', 'Finance Analyst', 'Analyzes budgets and costs, prepares financial insights, and supports spending decisions.', '["budget","cost analysis"]'::jsonb, '["budget analysis","financial analysis","cost control","forecasting"]'::jsonb, 3, 7, 'available', '["Product launch budget analysis"]'::jsonb)
on conflict (id) do update set company_id=excluded.company_id, division_id=excluded.division_id, name=excluded.name, role=excluded.role, job_description=excluded.job_description, specialization=excluded.specialization, skills=excluded.skills, current_open_tasks=excluded.current_open_tasks, max_concurrent_tasks=excluded.max_concurrent_tasks, availability_status=excluded.availability_status, previous_assignments=excluded.previous_assignments, updated_at=now();
insert into public.employees (id, company_id, division_id, name, role, job_description, specialization, skills, current_open_tasks, max_concurrent_tasks, availability_status, previous_assignments) values ('emp_nisa', 'nova', 'finance', 'Nisa', 'Finance Officer', 'Processes invoices and payments and supports procurement and payment administration.', '["invoice","payment","procurement"]'::jsonb, '["invoice processing","payment administration","procurement records","expense tracking"]'::jsonb, 4, 8, 'available', '["Vendor invoice processing"]'::jsonb)
on conflict (id) do update set company_id=excluded.company_id, division_id=excluded.division_id, name=excluded.name, role=excluded.role, job_description=excluded.job_description, specialization=excluded.specialization, skills=excluded.skills, current_open_tasks=excluded.current_open_tasks, max_concurrent_tasks=excluded.max_concurrent_tasks, availability_status=excluded.availability_status, previous_assignments=excluded.previous_assignments, updated_at=now();
insert into public.employees (id, company_id, division_id, name, role, job_description, specialization, skills, current_open_tasks, max_concurrent_tasks, availability_status, previous_assignments) values ('emp_putri', 'nova', 'people_operations', 'Putri', 'HR & Operations Specialist', 'Handles employee administration, hiring coordination, internal policies, and people operations.', '["people operations","HR","policy"]'::jsonb, '["HR administration","hiring coordination","policy documentation","employee onboarding"]'::jsonb, 3, 7, 'available', '["Internal onboarding checklist"]'::jsonb)
on conflict (id) do update set company_id=excluded.company_id, division_id=excluded.division_id, name=excluded.name, role=excluded.role, job_description=excluded.job_description, specialization=excluded.specialization, skills=excluded.skills, current_open_tasks=excluded.current_open_tasks, max_concurrent_tasks=excluded.max_concurrent_tasks, availability_status=excluded.availability_status, previous_assignments=excluded.previous_assignments, updated_at=now();
insert into public.employees (id, company_id, division_id, name, role, job_description, specialization, skills, current_open_tasks, max_concurrent_tasks, availability_status, previous_assignments) values ('emp_andi', 'nova', 'people_operations', 'Andi', 'Operations Specialist', 'Coordinates internal schedules, operational processes, and cross-team logistics.', '["scheduling","internal operations"]'::jsonb, '["schedule coordination","process documentation","event logistics","operations"]'::jsonb, 2, 7, 'available', '["Quarterly planning schedule"]'::jsonb)
on conflict (id) do update set company_id=excluded.company_id, division_id=excluded.division_id, name=excluded.name, role=excluded.role, job_description=excluded.job_description, specialization=excluded.specialization, skills=excluded.skills, current_open_tasks=excluded.current_open_tasks, max_concurrent_tasks=excluded.max_concurrent_tasks, availability_status=excluded.availability_status, previous_assignments=excluded.previous_assignments, updated_at=now();
insert into public.employees (id, company_id, division_id, name, role, job_description, specialization, skills, current_open_tasks, max_concurrent_tasks, availability_status, previous_assignments) values ('emp_tio', 'nova', 'customer_success', 'Tio', 'Customer Success Manager', 'Manages customer onboarding, account health, retention, and customer training plans.', '["enterprise accounts","onboarding","retention"]'::jsonb, '["customer success","enterprise onboarding","account health","customer training","retention"]'::jsonb, 4, 8, 'available', '["Acme enterprise onboarding"]'::jsonb)
on conflict (id) do update set company_id=excluded.company_id, division_id=excluded.division_id, name=excluded.name, role=excluded.role, job_description=excluded.job_description, specialization=excluded.specialization, skills=excluded.skills, current_open_tasks=excluded.current_open_tasks, max_concurrent_tasks=excluded.max_concurrent_tasks, availability_status=excluded.availability_status, previous_assignments=excluded.previous_assignments, updated_at=now();
insert into public.employees (id, company_id, division_id, name, role, job_description, specialization, skills, current_open_tasks, max_concurrent_tasks, availability_status, previous_assignments) values ('emp_maya', 'nova', 'customer_success', 'Maya', 'Customer Support Specialist', 'Handles customer support requests, documents recurring issues, and helps customers use the product.', '["customer support","product guidance"]'::jsonb, '["customer support","issue triage","product training","support documentation"]'::jsonb, 5, 8, 'available', '["Customer help-center updates"]'::jsonb)
on conflict (id) do update set company_id=excluded.company_id, division_id=excluded.division_id, name=excluded.name, role=excluded.role, job_description=excluded.job_description, specialization=excluded.specialization, skills=excluded.skills, current_open_tasks=excluded.current_open_tasks, max_concurrent_tasks=excluded.max_concurrent_tasks, availability_status=excluded.availability_status, previous_assignments=excluded.previous_assignments, updated_at=now();

-- Seed projects
insert into public.projects (id, company_id, name, description, status, project_context_keywords, note) values ('project_q4_product_launch', 'nova', 'Q4 Product Launch', 'NOVA''s fictional cross-functional launch project used in ACTA''s demo scenarios.', 'active', '["Q4","product launch","landing page","checkout","campaign","budget","launch date"]'::jsonb, 'Project-specific dates and authoritative deadlines should be taken from the meeting transcript and project documents during testing; disagreement between sources should trigger conflict review rather than silent resolution.')
on conflict (id) do update set company_id=excluded.company_id, name=excluded.name, description=excluded.description, status=excluded.status, project_context_keywords=excluded.project_context_keywords, note=excluded.note, updated_at=now();

-- Seed project/division relationships
insert into public.project_divisions (project_id, division_id) values ('project_q4_product_launch', 'product_strategy') on conflict do nothing;
insert into public.project_divisions (project_id, division_id) values ('project_q4_product_launch', 'engineering') on conflict do nothing;
insert into public.project_divisions (project_id, division_id) values ('project_q4_product_launch', 'ui_ux') on conflict do nothing;
insert into public.project_divisions (project_id, division_id) values ('project_q4_product_launch', 'marketing') on conflict do nothing;
insert into public.project_divisions (project_id, division_id) values ('project_q4_product_launch', 'finance') on conflict do nothing;
insert into public.project_divisions (project_id, division_id) values ('project_q4_product_launch', 'customer_success') on conflict do nothing;

-- Keep the demo tables protected from browser/client access until explicit policies are designed.
alter table public.companies enable row level security;
alter table public.divisions enable row level security;
alter table public.employees enable row level security;
alter table public.projects enable row level security;
alter table public.project_divisions enable row level security;

commit;

-- Verification queries (run separately after the script if needed):
-- select count(*) as companies from public.companies;
-- select count(*) as divisions from public.divisions;
-- select count(*) as employees from public.employees;
-- select count(*) as projects from public.projects;
-- select count(*) as project_division_links from public.project_divisions;
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
