# ACTA Calendar, Google Calendar, and Telegram Daily Recap

This integration is added to the existing ACTA frontend and FastAPI backend. It is not a separate demo application.

## Included

- A Calendar workspace with month, week, day, and agenda/list views.
- Native ACTA event create, edit, delete, drag/drop rescheduling, all-day events, categories, colors, locations, meeting links, and simple daily/weekly/monthly recurrence.
- Read-only overlays for ACTA task deadlines and scheduled meetings. Update tasks in Tasks and meeting details in Meetings; the Calendar overlay is intentionally not a duplicate editable record.
- Google Calendar OAuth and event listing, creation, update, deletion, and manual pull sync for ACTA-linked events. When an ACTA event is created with destination `both`, ACTA stores its Google event ID and private `actaEventId` mapping to avoid creating another Google copy on later updates.
- Telegram Daily Recap preferences, preview, test send, delivery history, and scheduled delivery with local timezone and once-per-local-day tracking.
- Configurable due-soon horizon (1–30 days); default is 7 days. Default scheduled send time is 07:00 Asia/Jakarta.

## 1. Apply the database migration

1. Make a backup of your Supabase project.
2. Confirm the existing ACTA schema has already been installed, including `companies`, `meetings`, `action_items`, and `employees`.
3. Run `database/03_calendar_and_digest.sql` in Supabase SQL Editor.

The migration is additive and can be run again. It creates `calendar_events`, Telegram preferences and delivery logs, adds `action_items.deadline_at`, and adds `meetings.meeting_date` (the meeting API already accepts this field).

## 2. Backend configuration

Copy `ACTA_step5_backend/backend/.env.example` to `.env` in the backend directory and fill the values privately. At minimum:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` for Telegram delivery
- `ACTA_CRON_SECRET` with a long random secret
- `ACTA_CORS_ORIGINS` with the exact deployed frontend origin(s), comma-separated

For Google Calendar also configure `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`, `GOOGLE_CALENDAR_REDIRECT_URI`, `GOOGLE_CALENDAR_ID`, and `ACTA_FRONTEND_URL`.

The Google OAuth client must be a Web application. Add the exact backend callback URL to its Authorized redirect URIs. For local development this is normally `http://localhost:8000/api/integrations/google-calendar/callback`; production must use the deployed HTTPS API URL. Add the corresponding frontend domain to Authorized JavaScript origins only if the selected Google setup requires it.

Keep `.env`, OAuth refresh tokens, service-role keys, bot tokens, and cron secrets out of GitHub. The Google refresh token is stored server-side in `ACTA_step5_backend/backend/.acta_google_calendar_token.json`; `.gitignore` excludes it. Re-authorize Google Calendar after moving to another server or removing the existing token file.

Install and run the backend from `ACTA_step5_backend/backend`:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

If PowerShell blocks activation, run the virtual-environment Python directly:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

## 3. Frontend configuration

In `frontend`, copy `.env.example` to `.env` and set `VITE_API_BASE_URL` to the backend URL. Then install/build:

```powershell
npm install
npm run dev
```

For a production bundle:

```powershell
npm run build
```

The FullCalendar dependencies are declared in `package.json`. This repository does not include `node_modules` or a committed frontend lockfile in this package; run `npm install` once in your environment to resolve dependencies and generate `package-lock.json` before CI/deployment.

## 4. Schedule Telegram Daily Recap

The backend endpoint checks each workspace's timezone and configured `send_time`; it does not run its own background scheduler. A Cloudflare Worker in `scheduler/` is supplied to call the protected backend endpoint every 15 minutes.

1. Install Wrangler and authenticate to your Cloudflare account.
2. From `scheduler/`, set the backend base URL and cron secret as Worker secrets:

```bash
npx wrangler secret put ACTA_API_BASE_URL
npx wrangler secret put ACTA_CRON_SECRET
npx wrangler deploy
```

For `ACTA_API_BASE_URL`, enter the deployed backend API origin (for example `https://api.example.com`), without a trailing slash. For `ACTA_CRON_SECRET`, use exactly the same random secret configured in the backend environment. Do not expose this secret in frontend environment variables.

The Worker schedule is `*/15 * * * *`. It checks the preference time per workspace timezone and sends once after the configured time. Delivery rows are unique by company, chat, and local date. A failed or stale pending run can be retried; Telegram network ambiguity can still mean a remote message may have been accepted even when the backend did not receive its acknowledgement.

## 5. Verify the integrations

- Open `http://127.0.0.1:8000/health` and check that the API responds.
- Open `http://127.0.0.1:8000/docs` and confirm `/api/calendar` and `/api/notifications/daily-digest` routes are registered.
- Open Calendar in ACTA. Create an ACTA-only event, then create another event with destination `both` after authorizing Google Calendar.
- Use the Calendar manual Google sync action to pull Google-side changes to mirrored ACTA events.
- Open Integrations > Telegram Daily Recap. Preview, save the schedule, and use Send test only with a dedicated test group/chat.
- Confirm scheduler logs and the Recent delivery history table after the Worker has run.

## Important scope and deployment limitations

- Google synchronization is user-triggered/manual for pull operations; it is not a Google push notification/webhook or a continuous real-time sync service. ACTA-originated changes are pushed to the linked Google event when saved.
- The OAuth flow stores a single server-side Google token file and its temporary OAuth state is in backend process memory. Run a single backend instance for the current implementation; multi-instance OAuth state/token storage needs a shared secure store before horizontal scaling.
- The existing ACTA app's other API endpoints are not protected by workspace/user authentication in this source snapshot. Do not expose this build as a public multi-tenant production app until authentication and per-workspace authorization are added to all read/write routes. The `run-due` scheduler endpoint is separately protected by `ACTA_CRON_SECRET`, but preview/preferences/test endpoints rely on the app's current access model.
- Actual Google and Telegram delivery can only be verified after configuring real credentials and authorizing a dedicated test account/group. Do not use a personal or production group for first tests.
