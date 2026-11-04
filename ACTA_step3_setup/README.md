# ACTA — Action Coordination & Task Agent

**Tagline:** From Meeting Decisions to Executed Work.

ACTA is a prototype AI agent that turns meeting recordings and project documents into structured action items, recommends responsible divisions/employees using organizational context, flags ambiguity or conflicting deadlines, and executes approved tasks through external tools.

## MVP workflow

1. Upload meeting audio and project documents.
2. Transcribe audio and extract project context.
3. Extract decisions, action items, owners, deadlines, and project references.
4. Match tasks to the fictional NOVA organization and show evidence/confidence.
5. Ask for human review when assignments are uncertain or deadlines conflict.
6. Execute approved tasks in Trello and notify through Slack; verify actual API responses.

## Repository layout

- `backend/` — planned Python + FastAPI agent/API.
- `frontend/` — planned Next.js user interface.
- `data/organization.json` — fictional NOVA organization dataset for development and demos.
- `docs/` — product requirements and technical decisions.
- `samples/` — sanitized demo input files, when prepared.

## Current status

Initial repository setup. No production integrations are configured yet. See [`docs/ACTA_PRD_Step1.md`](docs/ACTA_PRD_Step1.md) for the draft MVP scope.

## Security

Never commit API keys, access tokens, passwords, private meeting recordings, or real employee data. Use environment variables for secrets and only fictional/sanitized sample data in this public repository.
