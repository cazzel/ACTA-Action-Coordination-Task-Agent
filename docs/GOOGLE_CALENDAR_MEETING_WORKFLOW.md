# Google Calendar scheduling from Meetings

The Meetings form now has an optional **Add to Google Calendar** toggle.

When enabled, the form collects a start time, end time, location/meeting link, and optional description. It creates the ACTA meeting first, stores the selected start time in `meetings.meeting_date`, and then calls `POST /api/integrations/google-calendar/events` using the newly created meeting ID. Times entered in the form are interpreted as Asia/Jakarta (WIB).

If Calendar sync fails, the ACTA meeting remains saved and the UI reports that Calendar sync needs attention. It does not roll back the meeting record.

## Files updated

- `frontend/src/App.jsx`
- `frontend/src/index.css`
- `ACTA_step5_backend/backend/app/main.py`

The backend accepts optional `meeting_date` in `POST /api/meetings`. Existing clients that omit it continue to work.
