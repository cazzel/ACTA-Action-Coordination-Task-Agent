# ACTA Coordination Agent v1 — setup

This is an additive patch for the existing ACTA FastAPI backend. It does not replace the currently working task endpoints.

## What it adds

- A bounded tool-calling loop at `POST /api/agent/coordinate`.
- Read-only tools for team/project context and related tasks.
- A save tool that creates tasks in `pending_review`, plus a work package and internal artifact drafts in Supabase.
- A trace of tool calls and actual results.
- It does **not** create or share real Google Sheets, Google Docs, Trello cards, or Slack messages yet. External URLs remain null until the relevant integration is configured and verified.

## Step 1 — Add the new file

Copy `app/agent.py` into:

`C:\Users\USER\Desktop\ACTA\ACTA_step5_backend\backend\app\agent.py`

Do not replace `app/main.py`.

## Step 2 — Run the SQL migration

Open Supabase Dashboard → SQL Editor → New query. Open `supabase_agent_migration.sql`, copy all contents, paste into SQL Editor, and click Run. The migration creates `work_packages` and `work_artifacts`; it does not delete existing tables or rows.

## Step 3 — Register the route in `app/main.py`

Scroll to the very bottom of `app/main.py`, after the existing endpoint functions. Add these two lines:

```python
from app.agent import build_agent_router
app.include_router(build_agent_router(recommend_owner, RecommendOwnerRequest))
```

The route registration must be at the bottom so `recommend_owner` and `RecommendOwnerRequest` already exist. Save the file.

## Step 4 — Verify backend starts

Restart Uvicorn if needed:

```powershell
cd C:\Users\USER\Desktop\ACTA\ACTA_step5_backend\backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Open `http://127.0.0.1:8000/docs` and look for `POST /api/agent/coordinate`.

## Step 5 — First API test in Swagger

Open `POST /api/agent/coordinate` → Try it out → use this body:

```json
{
  "company_id": "nova",
  "project_id": null,
  "transcript": "During the marketing meeting, Dimas will prepare the social media campaign draft by October 25, 2026. Alya will review the content by October 27, 2026. The team lead will approve the final campaign before October 30, 2026."
}
```

The response should include `assistant_message`, `tool_trace`, and `work_package`. The work package can contain newly saved tasks and internal artifacts. Check Supabase tables `work_packages`, `work_artifacts`, and the existing `action_items` table. Re-running the same example skips exact duplicate task titles in `action_items`, but a separate work package draft is still recorded for each run.

## Notes

- This relies on the existing `settings.openrouter_api_key` and `settings.openrouter_model` values already used by the current `/api/extract-actions` endpoint.
- The configured OpenRouter model/provider must support function/tool calling. If it does not, use a model that supports tool calling and retry.
- Owner recommendations remain suggestions. The tool does not automatically set `selected_owner_id` and does not approve tasks.
- Google Sheets/Docs sharing is a separate external integration requiring Google authorization and recipient permissions. This patch deliberately does not manufacture fake links or claim external sharing succeeded.
