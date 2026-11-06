# ACTA — Action Coordination & Task Agent

**AI-powered Action Coordination & Task Agent** that transforms meeting discussions into actionable tasks, coordinates team execution, and integrates with Telegram and Google Calendar.

ACTA helps teams turn meeting outcomes into structured work, assign responsibilities, review AI-generated recommendations, and track execution through a centralized workspace.

---

## 1. Project Overview

ACTA is designed to streamline the workflow between meetings and task execution.

The platform combines an AI-powered coordination agent, team management, meeting processing, task management, and external integrations.

### Core Features

- **Overview** — Centralized dashboard for monitoring projects, tasks, meetings, and team activity.
- **Tasks** — Manage action items, review AI-generated owner recommendations, approve assignments, and track task statuses.
- **AI Assistant** — Generate structured work packages and actionable tasks from user instructions or meeting discussions.
- **Meetings** — Upload meeting materials, record meetings, extract text, transcribe audio/video, and generate AI-powered meeting analysis.
- **Team** — Manage employee profiles, roles, skills, divisions, workload, and availability.
- **Integrations** — Connect Telegram for task notifications and Google Calendar for meeting scheduling.

### ACTA Workflow

**Capture → Understand → Approve → Execute**

1. Capture meeting discussions and supporting documents.
2. Understand the discussion using AI-powered analysis.
3. Review and approve suggested tasks and responsible team members.
4. Execute and monitor tasks through the ACTA workspace.

---

## 2. Project Structure

```text
ACTA/
│
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx
│       ├── index.css
│       └── main.jsx
│
├── ACTA_step5_backend/
│   └── backend/
│       ├── .env.example
│       ├── requirements.txt
│       └── app/
│           ├── main.py
│           ├── agent.py
│           ├── integrations.py
│           ├── meeting_processing.py
│           ├── core/
│           │   └── config.py
│           └── db/
│               └── supabase.py
│
├── database/
│   └── ACTA_FULL_SUPABASE_SETUP.sql
│
├── docs/
│   ├── ACTA_DESIGN_RESEARCH_AND_UX_SYSTEM.md
│   └── ACTA_FINAL_QUALITY_GATE.md
│
├── scripts/
│   └── ACTA_Final_Verification.ps1
│
├── .gitignore
└── README.md
```

---

## 3. Technology Stack

| Component | Technology |
|---|---|
| Frontend | React |
| Frontend tooling | Vite |
| Backend | Python, FastAPI |
| Database | Supabase |
| AI coordination | OpenRouter |
| Notifications | Telegram Bot API |
| Calendar integration | Google Calendar API |
| Speech-to-text | Groq or OpenAI |
| Styling | CSS |

---

## 4. Getting Started

### Prerequisites

Install the following before setting up ACTA:

- Python 3.11 or compatible version
- Node.js and npm
- Git
- A Supabase project
- API credentials for the integrations you intend to use

### Clone the Repository

```powershell
git clone https://github.com/cazzel/ACTA-Action-Coordination-Task-Agent.git

cd ACTA-Action-Coordination-Task-Agent
```

### 4.1. Set Up Supabase

1. Open your Supabase Dashboard.
2. Select the Supabase project intended for ACTA.
3. Open SQL Editor.
4. Run the SQL script:

```text
database/ACTA_FULL_SUPABASE_SETUP.sql
```

5. Confirm that the required tables are available.
6. Ensure the Storage bucket `acta-meeting-files` exists and is configured as private.

The backend uses `SUPABASE_SERVICE_ROLE_KEY` for privileged database operations. Never expose this key in frontend code or public repositories.

The SQL setup script covers the main ACTA database structures, including organization-related data, action items, meetings, meeting files, work packages, and work artifacts.

Always verify that you are using the correct Supabase project before executing SQL.

### 4.2. Set Up the Backend

Open PowerShell and navigate to the backend directory:

```powershell
cd ACTA_step5_backend\backend
```

Create a virtual environment:

```powershell
py -3.11 -m venv .venv
```

Install dependencies:

```powershell
.\.venv\Scripts\python.exe -m pip install --upgrade pip

.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Create a `.env` file based on `.env.example`.

Configure the required environment variables:

```env
SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY

OPENROUTER_API_KEY=YOUR_OPENROUTER_API_KEY
OPENROUTER_MODEL=openrouter/free
```

Additional variables are required to enable Telegram, Google Calendar, and automatic transcription.

**Important:** The actual `.env` file must remain private and must never be committed to GitHub.

Start the backend:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Backend URL:

```text
http://127.0.0.1:8000
```

API documentation:

```text
http://127.0.0.1:8000/docs
```

### 4.3. Set Up the Frontend

Open a second PowerShell terminal.

Navigate to the frontend directory:

```powershell
cd frontend
```

Install dependencies:

```powershell
npm install
```

Start the development server:

```powershell
npm run dev
```

Open the application:

```text
http://localhost:5173/
```

To generate a production build:

```powershell
npm run build
```

The production output is generated in the `frontend/dist` directory.

---

## 5. External Integrations

### 5.1. Telegram

ACTA integrates with Telegram to send task lifecycle notifications.

Configure the following variables in the backend `.env` file:

```env
TELEGRAM_BOT_TOKEN=YOUR_TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID=YOUR_TELEGRAM_CHAT_ID
```

Setup:

1. Create a Telegram bot using BotFather.
2. Obtain the bot token.
3. Obtain the target chat ID.
4. Make sure the bot has been started by the intended user or added to the target group.
5. Configure the environment variables.
6. Restart the backend.
7. Open ACTA → Integrations.
8. Use the test notification feature.

Telegram notifications support task lifecycle events, including:

- Approved
- In Progress
- Done
- Rejected

The integration status indicator checks configuration availability. It does not expose the underlying credentials.

### 5.2. Google Calendar

ACTA supports Google Calendar OAuth authorization and meeting event creation.

Setup:

1. Open Google Cloud Console.
2. Create or select a project.
3. Enable the Google Calendar API.
4. Configure an OAuth consent screen.
5. Create an OAuth Client ID with the Web application type.
6. Add the following authorized redirect URI:

```text
http://localhost:8000/api/integrations/google-calendar/callback
```

7. Configure the following backend environment variables:

```env
GOOGLE_CALENDAR_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
GOOGLE_CALENDAR_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET
GOOGLE_CALENDAR_REDIRECT_URI=http://localhost:8000/api/integrations/google-calendar/callback
```

8. Restart the backend.
9. Open ACTA → Integrations.
10. Select Connect Google Calendar and complete the authorization process.

After authorization, ACTA can create and update calendar events associated with meetings.

The local OAuth token is stored in:

```text
ACTA_step5_backend/backend/.acta_google_calendar_token.json
```

This file must remain private and is ignored by Git.

**Deployment note:** When deploying ACTA to a public hosting environment, update the Google OAuth redirect URI to the deployed backend callback URL and configure the corresponding environment variables.

### 5.3. Automatic Transcription

ACTA supports automatic transcription through a configured speech-to-text provider.

Choose one of the supported providers.

**Groq:**

```env
ACTA_TRANSCRIPTION_PROVIDER=groq
GROQ_API_KEY=YOUR_GROQ_API_KEY
```

**OpenAI:**

```env
ACTA_TRANSCRIPTION_PROVIDER=openai
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
```

The OpenRouter API key does not replace the speech-to-text provider key.

Supported automatic transcription formats include:

- MP3
- M4A
- WAV
- OGG
- WEBM
- MP4

MOV files can be uploaded for storage, but are not included in the listed automatic transcription formats.

---

## 6. Meeting Processing

ACTA provides a meeting processing workflow that transforms meeting materials into actionable information.

### Processing Workflow

1. Upload meeting files or record a meeting.
2. Store uploaded files in private Supabase Storage.
3. Extract text from supported documents.
4. Transcribe supported audio and video files.
5. Send the extracted meeting content for AI analysis.
6. Generate structured work packages and action items.
7. Review the suggested tasks and responsible employees.
8. Approve assignments and track execution.

### Supported Document Extraction

- PDF text
- DOCX
- PPTX
- TXT

Audio and video transcription depends on the configured speech-to-text provider.

### AI Meeting Analysis

The Coordination Agent uses OpenRouter to analyze meeting discussions and generate:

- Work packages
- Action items
- Suggested task owners
- Internal artifact drafts

AI-generated outputs are intended to be reviewed by humans before execution.

---

## 7. Team Management and Task Ownership

ACTA includes a Team directory to manage employee information used by its owner recommendation system.

Employee profiles include:

- Name
- Role
- Skills
- Division
- Workload
- Availability

Users can add employees and edit existing employee profiles.

### Owner Recommendation

ACTA uses stored employee profile information to generate task owner recommendations.

To improve recommendation accuracy:

1. Open Team.
2. Review employee roles, skills, divisions, workload, and availability.
3. Update incorrect employee information.
4. Open Tasks.
5. Use Refresh owners on pending action items to recalculate recommendations.

Existing action items store recommendations generated during their analysis. Refresh owners recalculates and saves recommendations using the current Team directory.

### Approval Rules

Employees with `available` and `limited` availability may be selected if they still have task capacity.

Employees marked `unavailable` cannot be approved as task owners.

Human review remains part of the assignment workflow.

---

## 8. Main Backend API Endpoints

The following are the main API routes provided by the backend.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/divisions` | Retrieve divisions |
| GET | `/api/employees` | Retrieve employees |
| POST | `/api/employees` | Create an employee |
| PATCH | `/api/employees/{employee_id}` | Update an employee |
| GET | `/api/projects` | Retrieve projects |
| POST | `/api/agent/coordinate` | Run AI coordination |
| GET | `/api/action-items` | Retrieve action items |
| POST | `/api/action-items/{id}/refresh-recommendations` | Refresh owner recommendations |
| PATCH | `/api/action-items/{id}/approve` | Approve an action item |
| PATCH | `/api/action-items/{id}/status` | Update task status |
| POST | `/api/meetings` | Create a meeting |
| GET | `/api/meetings` | Retrieve meetings |
| POST | `/api/meeting-files/upload` | Upload meeting files |
| GET | `/api/meetings/{id}/files` | Retrieve meeting files |
| POST | `/api/meetings/{id}/extract-text` | Extract meeting text |
| PATCH | `/api/meetings/{id}/analysis` | Update meeting analysis |
| GET | `/api/integrations/status` | Check integration status |
| POST | `/api/integrations/telegram/test` | Send a Telegram test notification |
| GET | `/api/integrations/google-calendar/auth-url` | Generate Google OAuth authorization URL |
| POST | `/api/integrations/google-calendar/events` | Create or update calendar events |

For the complete interactive API documentation, run the backend and open:

```text
http://127.0.0.1:8000/docs
```

---

## 9. Frontend Design and User Experience

ACTA uses a modern workspace interface designed to make coordination and task execution easier to understand.

### ACTA Signal Workspace

The frontend uses Inter typography and a visual system built around:

- Dark forest navigation
- Warm neutral canvas
- Signal-lime primary actions
- Clear typography hierarchy
- Consistent interactive surfaces
- Responsive layouts
- Motion and loading feedback
- Visible keyboard focus
- Reduced-motion support

### Key UX Features

**ACTA Loop**

The Overview page presents the Capture → Understand → Approve → Execute workflow, with approval and execution counts based on the currently loaded task state.

**Command Palette**

Users can open quick navigation by clicking Jump to or pressing:

```text
Ctrl + K
```

On macOS:

```text
Cmd + K
```

Keyboard navigation:

- Arrow keys: Move between options.
- Enter: Open the selected destination.
- Escape: Close the command palette.

**Task Filtering**

The Tasks page supports searching and filtering by task status.

**Overview Navigation**

The Overview page provides shortcuts to relevant workspace areas, including Meetings and Tasks.

**Responsive Interface**

The frontend is designed to adapt to different screen sizes, including desktop and mobile layouts.

The UI refinements do not require a database migration and were designed to preserve the existing backend APIs and integrations.

For design references, rationale, and validation notes, see:

```text
docs/ACTA_DESIGN_RESEARCH_AND_UX_SYSTEM.md
```

---

## 10. Final Quality Gate and Verification

ACTA includes a PowerShell verification script for release checks.

With the backend and frontend dependencies installed, open PowerShell in the project root:

```powershell
cd C:\Users\USER\Desktop\ACTA
```

Run:

```powershell
.\scripts\ACTA_Final_Verification.ps1
```

The verification script checks:

- Frontend production build
- Backend Python syntax compilation
- Backend health endpoint
- Divisions API
- Employees API
- Action items API
- Meetings API
- Integration status endpoint
- Telegram configuration
- Google Calendar configuration and authorization
- Transcription configuration
- Frontend development server response

The previously reported final quality gate completed with:

```text
12 passed | 0 warnings | 0 failed
```

This result refers to the recorded verification run. It does not mean that every possible browser workflow or external integration is automatically tested by the script.

The script performs read-only API smoke checks and configuration checks. It does not intentionally create or modify database records, send external notifications, create calendar events, or upload files.

For detailed release checks and browser acceptance criteria, see:

```text
docs/ACTA_FINAL_QUALITY_GATE.md
```

---

## 11. Security Notes

Keep the following files and credentials private:

- Backend `.env`
- Supabase service-role key
- OpenRouter API key
- Telegram bot token
- Google OAuth client secret
- Groq or OpenAI API key
- Google Calendar OAuth token file
- Other private credentials and certificates

The root `.gitignore` and backend `.gitignore` are configured to exclude environment files, virtual environments, dependencies, build outputs, and other local development files.

Never place private API keys or service-role credentials in frontend source code.

For public deployment, configure credentials using the hosting provider's environment variable settings.

---

## 12. Deployment Considerations

ACTA consists of a frontend and a backend that need to be deployed separately.

### Frontend

The React/Vite frontend can be deployed using a static hosting provider such as Netlify.

Typical build settings:

| Setting | Value |
|---|---|
| Base directory | `frontend` |
| Build command | `npm run build` |
| Publish directory | `dist` |

The frontend must be configured to communicate with the deployed backend API rather than the local development URL.

### Backend

The FastAPI backend requires a Python-compatible hosting environment, such as Render or Railway.

Configure the backend environment variables securely in the hosting provider.

Additional deployment considerations:

- Update CORS allowed origins.
- Configure the production API base URL in the frontend.
- Update Google OAuth redirect URIs.
- Verify Telegram connectivity.
- Verify Supabase connectivity and Storage permissions.
- Verify transcription and AI provider credentials.
- Ensure OAuth token storage is handled appropriately in the deployed environment.

The local development configuration is not automatically a production deployment configuration.

---

## 13. Project Status

ACTA's defined local final quality gate was previously reported as passing with 12 successful checks and no warnings or failures.

The project includes the core workspace, meeting processing, AI coordination, task management, team management, Telegram integration, and Google Calendar integration.

External services still depend on valid credentials, provider availability, and correct production configuration.

---

## License

No license has been specified for this repository yet. All rights and permissions should be clarified before reuse or redistribution.


## Calendar, Google Calendar, and Telegram Daily Recap

The Calendar workspace and Telegram Daily Recap are integrated into the ACTA frontend and FastAPI backend. See [`docs/ACTA_CALENDAR_TELEGRAM_SETUP.md`](docs/ACTA_CALENDAR_TELEGRAM_SETUP.md) for the database migration, environment variables, Google OAuth, Cloudflare scheduled Worker, verification steps, and production limitations.
