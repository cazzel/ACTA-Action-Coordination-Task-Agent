# ACTA Backend

FastAPI backend for ACTA: team context, task extraction and approval, coordination agent, meeting uploads/analysis, Telegram notifications, and Google Calendar integration.

## Run locally (Windows PowerShell)

```powershell
cd C:\Users\USER\Desktop\ACTA\ACTA_step5_backend\backend
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Create `.env` from `.env.example`, then fill in your own credentials. Do not commit `.env`.

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

API docs: http://127.0.0.1:8000/docs

## Integrations

- Telegram: set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`.
- Google Calendar: set the OAuth client variables and register the exact redirect URI in Google Cloud Console.
- Audio transcription: set `ACTA_TRANSCRIPTION_PROVIDER=groq` with `GROQ_API_KEY`, or select `openai` with `OPENAI_API_KEY`.

Secrets and the Google OAuth token file stay on the backend.
