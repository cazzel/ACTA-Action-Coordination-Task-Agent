-- ACTA Calendar + Google Calendar bridge + Telegram Daily Digest
-- Additive migration. Run only AFTER the existing ACTA schema migrations.
-- All access is server-side through the Supabase service role. Do NOT expose
-- SUPABASE_SERVICE_ROLE_KEY to the React client.

begin;

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references public.companies(id) on delete cascade,
  title text not null,
  description text not null default '',
  start_at timestamptz not null,
  end_at timestamptz not null,
  timezone_name text not null default 'Asia/Jakarta',
  all_day boolean not null default false,
  category text not null default 'general',
  color text not null default '#4776E6',
  location text not null default '',
  meeting_link text not null default '',
  recurrence_rule text null,
  linked_entity_type text null check (linked_entity_type in ('meeting','task')),
  linked_entity_id text null,
  google_event_id text null,
  google_calendar_id text null,
  sync_status text not null default 'acta_only'
    check (sync_status in ('acta_only','synced','pending','error','remote_deleted')),
  sync_error text null,
  created_by text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendar_events_valid_range check (end_at > start_at)
);

create index if not exists idx_calendar_events_company_start
  on public.calendar_events(company_id, start_at, end_at);
create index if not exists idx_calendar_events_google_event
  on public.calendar_events(google_event_id)
  where google_event_id is not null;
create index if not exists idx_calendar_events_linked_entity
  on public.calendar_events(linked_entity_type, linked_entity_id)
  where linked_entity_id is not null;

-- Scheduled meeting dates are already accepted by the ACTA API; ensure the
-- existing meetings table has the corresponding column for storage and calendar overlays.
alter table public.meetings
  add column if not exists meeting_date timestamptz null;
create index if not exists idx_meetings_company_meeting_date
  on public.meetings(company_id, meeting_date)
  where meeting_date is not null;

-- A typed deadline avoids guessing from free-text deadline_text in reminders.
alter table public.action_items
  add column if not exists deadline_at timestamptz null;

create index if not exists idx_action_items_company_deadline
  on public.action_items(company_id, deadline_at)
  where deadline_at is not null;

create table if not exists public.telegram_digest_preferences (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references public.companies(id) on delete cascade,
  chat_id text not null,
  enabled boolean not null default false,
  send_time time not null default '07:00',
  timezone_name text not null default 'Asia/Jakarta',
  include_overdue boolean not null default true,
  include_due_today boolean not null default true,
  include_due_soon boolean not null default true,
  due_soon_days integer not null default 7 check (due_soon_days between 1 and 30),
  include_pending_review boolean not null default true,
  include_in_progress boolean not null default true,
  include_approved boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, chat_id)
);

alter table public.telegram_digest_preferences
  add column if not exists include_due_soon boolean not null default true;
alter table public.telegram_digest_preferences
  add column if not exists due_soon_days integer not null default 7;

create table if not exists public.telegram_digest_runs (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references public.companies(id) on delete cascade,
  chat_id text not null,
  digest_date date not null,
  status text not null default 'pending'
    check (status in ('pending','sent','failed','skipped')),
  message_id bigint null,
  task_count integer not null default 0,
  error_message text null,
  started_at timestamptz not null default now(),
  sent_at timestamptz null,
  unique(company_id, chat_id, digest_date)
);

create index if not exists idx_telegram_digest_preferences_enabled
  on public.telegram_digest_preferences(enabled, send_time)
  where enabled = true;
create index if not exists idx_telegram_digest_runs_date
  on public.telegram_digest_runs(digest_date, status);

-- No Telegram destination is seeded. The digest remains disabled until
-- an administrator configures a destination and explicitly enables it.

alter table public.calendar_events enable row level security;
alter table public.telegram_digest_preferences enable row level security;
alter table public.telegram_digest_runs enable row level security;

commit;

-- Verify after migration:
-- select count(*) from public.calendar_events;
-- select company_id, enabled, send_time, timezone_name from public.telegram_digest_preferences;
-- select column_name, data_type from information_schema.columns
--  where table_schema='public' and table_name='action_items' and column_name='deadline_at';
