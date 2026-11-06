import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import rrulePlugin from "@fullcalendar/rrule";
import "./calendar.css";

const PLUGINS = [dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin, rrulePlugin];
const DEFAULT_COLOR = "#4776E6";
const CATEGORIES = [
  { value: "general", label: "General", color: "#4776E6" },
  { value: "meeting", label: "Meeting", color: "#14A38B" },
  { value: "task", label: "Task", color: "#E49A36" },
  { value: "deadline", label: "Deadline", color: "#D95C5C" },
  { value: "personal", label: "Personal", color: "#8D6AD8" },
];

function localInputValue(date) {
  const d = new Date(date);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}
function dateOnlyValue(date) {
  const d = new Date(date);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}
function plusMinutes(value, minutes) {
  return new Date(new Date(value).getTime() + minutes * 60000);
}
function mapActaEvent(row) {
  const source = row.source || "acta";
  const recurringRule = row.recurrence_rule ? String(row.recurrence_rule).replace(/^RRULE:/i, "") : "";
  const freq = recurringRule.match(/FREQ=([A-Z]+)/i)?.[1]?.toLowerCase();
  const interval = Number(recurringRule.match(/INTERVAL=(\d+)/i)?.[1] || 1);
  const startDate = row.start_at;
  const startTime = new Date(row.start_at);
  const endTime = new Date(row.end_at);
  const durationMs = Math.max(1, endTime.getTime() - startTime.getTime());
  const duration = row.all_day ? { days: Math.max(1, Math.round(durationMs / 86400000)) } : { milliseconds: durationMs };
  const recurrence = freq ? { freq, interval, dtstart: startDate } : null;
  return {
    id: `${source === "task" ? "task" : source === "meeting" ? "meeting" : "acta"}:${row.id}`,
    title: row.title,
    ...(recurrence ? { rrule: recurrence, duration } : { start: row.start_at, end: row.end_at }),
    allDay: Boolean(row.all_day),
    backgroundColor: row.color || DEFAULT_COLOR,
    borderColor: row.color || DEFAULT_COLOR,
    extendedProps: { source, raw: row },
  };
}
function mapGoogleEvent(row) {
  const source = row.linked_acta_id ? "acta" : "google";
  return {
    id: row.linked_acta_id ? `acta:${row.linked_acta_id}` : `google:${row.google_event_id || row.id}`,
    title: row.title,
    start: row.start_at,
    end: row.end_at,
    allDay: Boolean(row.all_day),
    backgroundColor: source === "acta" ? (row.color || DEFAULT_COLOR) : "#4285F4",
    borderColor: source === "acta" ? (row.color || DEFAULT_COLOR) : "#4285F4",
    extendedProps: { source, raw: row, googleEventId: row.google_event_id },
  };
}

export default function CalendarPage({ apiBaseUrl }) {
  const calendarRef = useRef(null);
  const [source, setSource] = useState("all");
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [googleConnected, setGoogleConnected] = useState(false);
  const [range, setRange] = useState(() => {
    const now = new Date();
    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 2, 1) };
  });
  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(() => makeBlankForm());

  function makeBlankForm(startDate = new Date()) {
    const start = new Date(startDate);
    start.setSeconds(0, 0);
    if (start.getMinutes() !== 0 && start.getMinutes() !== 30) start.setMinutes(0);
    const end = plusMinutes(start, 60);
    return {
      title: "", description: "", startAt: localInputValue(start), endAt: localInputValue(end),
      allDay: false, category: "general", color: DEFAULT_COLOR, location: "", meetingLink: "",
      destination: "acta", recurrence: "none",
    };
  }

  const loadCalendar = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const statusResponse = await fetch(`${apiBaseUrl}/api/integrations/status`);
      const statusData = await statusResponse.json().catch(() => ({}));
      setGoogleConnected(Boolean(statusData?.google_calendar?.authorized));

      const start = range.start.toISOString();
      const end = range.end.toISOString();
      const requests = [];
      if (source !== "google") {
        requests.push({ kind: "ACTA", promise: fetch(`${apiBaseUrl}/api/calendar/events?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`)
          .then(async (r) => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.detail || `ACTA Calendar HTTP ${r.status}`); return (d.data || []).map(mapActaEvent); }) });
      }
      if (source !== "acta" && statusData?.google_calendar?.authorized) {
        requests.push({ kind: "Google", promise: fetch(`${apiBaseUrl}/api/calendar/google/events?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`)
          .then(async (r) => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.detail || `Google Calendar HTTP ${r.status}`); return (d.data || []).map(mapGoogleEvent); }) });
      }
      const settled = await Promise.allSettled(requests.map((item) => item.promise));
      const results = [];
      const failures = [];
      settled.forEach((item, index) => {
        if (item.status === "fulfilled") results.push(item.value);
        else failures.push(`${requests[index].kind}: ${item.reason instanceof Error ? item.reason.message : "request failed"}`);
      });
      if (failures.length) setError(failures.join(" · "));
      let merged = results.flat();
      if (source === "all") {
        const seen = new Set();
        merged = merged.filter((event) => {
          const key = event.id;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }
      setEvents(merged);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load calendar events.");
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, range.start, range.end, source]);

  useEffect(() => { loadCalendar(); }, [loadCalendar]);

  const calendarEventCount = useMemo(() => ({
    acta: events.filter((e) => e.extendedProps.source === "acta").length,
    google: events.filter((e) => e.extendedProps.source === "google").length,
  }), [events]);

  function openNewEvent(startDate = new Date()) {
    setEditing(null);
    setForm(makeBlankForm(startDate));
    setError("");
    setNotice("");
    setShowEditor(true);
  }

  function openEditEvent(info) {
    const raw = info.event.extendedProps.raw || {};
    if (info.event.extendedProps.source === "task") {
      setNotice(`Task deadline: ${raw.title || info.event.title}. Manage this task from the Tasks page.`);
      return;
    }
    if (info.event.extendedProps.source === "meeting") {
      setNotice("Scheduled meetings are shown from ACTA Meetings. Edit meeting details from the Meetings workspace.");
      return;
    }
    const allDay = Boolean(info.event.allDay);
    setEditing({ id: raw.id, source: info.event.extendedProps.source, googleEventId: raw.google_event_id || info.event.extendedProps.googleEventId || raw.id });
    setForm({
      title: info.event.title || "",
      description: raw.description || "",
      startAt: allDay ? dateOnlyValue(info.event.start) : localInputValue(info.event.start),
      endAt: allDay ? dateOnlyValue(info.event.end || plusMinutes(info.event.start, 1440)) : localInputValue(info.event.end || plusMinutes(info.event.start, 60)),
      allDay,
      category: raw.category || "general",
      color: raw.color || (info.event.extendedProps.source === "google" ? "#4285F4" : DEFAULT_COLOR),
      location: raw.location || "",
      meetingLink: raw.meeting_link || "",
      destination: info.event.extendedProps.source === "google" ? "google" : (raw.google_event_id ? "both" : "acta"),
      recurrence: raw.recurrence_rule ? String(raw.recurrence_rule).toUpperCase().includes("DAILY") ? "daily" : String(raw.recurrence_rule).toUpperCase().includes("WEEKLY") ? "weekly" : "monthly" : "none",
    });
    setError("");
    setNotice("");
    setShowEditor(true);
  }

  function buildPayload() {
    const toISO = (value) => new Date(value).toISOString();
    let startAt;
    let endAt;
    if (form.allDay) {
      startAt = toISO(`${form.startAt}T00:00:00`);
      endAt = toISO(`${form.endAt}T00:00:00`);
      if (new Date(endAt) <= new Date(startAt)) endAt = new Date(new Date(startAt).getTime() + 86400000).toISOString();
    } else {
      startAt = toISO(form.startAt);
      endAt = toISO(form.endAt);
    }
    const cat = CATEGORIES.find((item) => item.value === form.category);
    let recurrenceRule = null;
    if (form.recurrence !== "none") recurrenceRule = `RRULE:FREQ=${form.recurrence.toUpperCase()};INTERVAL=1`;
    return {
      company_id: "nova", title: form.title.trim(), description: form.description,
      start_at: startAt, end_at: endAt, timezone_name: "Asia/Jakarta", all_day: form.allDay,
      category: form.category, color: cat?.color || form.color || DEFAULT_COLOR,
      location: form.location, meeting_link: form.meetingLink, recurrence_rule: recurrenceRule,
      destination: editing ? (editing.source === "google" ? "google" : (editing.destination || form.destination)) : form.destination,
    };
  }

  async function saveEvent(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload = buildPayload();
      const url = editing
        ? (editing.source === "google" ? `${apiBaseUrl}/api/calendar/google/events/${encodeURIComponent(editing.googleEventId)}` : `${apiBaseUrl}/api/calendar/events/${encodeURIComponent(editing.id)}`)
        : (payload.destination === "google" ? `${apiBaseUrl}/api/calendar/google/events` : `${apiBaseUrl}/api/calendar/events`);
      const method = editing ? "PATCH" : "POST";
      const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || `Could not save event (HTTP ${response.status}).`);
      setShowEditor(false);
      setNotice(result.warning || result.message || "Calendar event saved.");
      await loadCalendar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save event.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteEvent() {
    if (!editing || !window.confirm("Delete this calendar event?")) return;
    setSaving(true);
    setError("");
    try {
      const url = editing.source === "google"
        ? `${apiBaseUrl}/api/calendar/google/events/${encodeURIComponent(editing.googleEventId)}`
        : `${apiBaseUrl}/api/calendar/events/${encodeURIComponent(editing.id)}`;
      const response = await fetch(url, { method: "DELETE" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || "Could not delete event.");
      setShowEditor(false);
      setNotice("Calendar event deleted.");
      await loadCalendar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete event.");
    } finally {
      setSaving(false);
    }
  }

  async function moveEvent(info) {
    const raw = info.event.extendedProps.raw || {};
    const sourceType = info.event.extendedProps.source;
    if (sourceType === "task") {
      info.revert();
      setError("Task deadline cards are read-only in Calendar. Update the deadline from Tasks.");
      return;
    }
    if (sourceType === "meeting") {
      info.revert();
      setError("Meeting schedule overlays are read-only in Calendar. Update meeting details from Meetings.");
      return;
    }
    const startAt = info.event.start?.toISOString();
    const endAt = (info.event.end || plusMinutes(info.event.start, 60)).toISOString();
    const payload = {
      company_id: "nova", title: info.event.title, description: raw.description || "",
      start_at: startAt, end_at: endAt, timezone_name: raw.timezone_name || "Asia/Jakarta",
      all_day: info.event.allDay, category: raw.category || "general", color: raw.color || DEFAULT_COLOR,
      location: raw.location || "", meeting_link: raw.meeting_link || "", recurrence_rule: raw.recurrence_rule || null,
    };
    const url = sourceType === "google"
      ? `${apiBaseUrl}/api/calendar/google/events/${encodeURIComponent(raw.google_event_id || raw.id)}`
      : `${apiBaseUrl}/api/calendar/events/${encodeURIComponent(raw.id)}`;
    try {
      const response = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || "Could not move event.");
      setNotice("Event schedule updated.");
      await loadCalendar();
    } catch (err) {
      info.revert();
      setError(err instanceof Error ? err.message : "Could not move event.");
    }
  }

  async function connectGoogle() {
    setError("");
    try {
      const response = await fetch(`${apiBaseUrl}/api/integrations/google-calendar/auth-url`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.auth_url) throw new Error(data.detail || "Could not start Google Calendar authorization.");
      window.location.assign(data.auth_url);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not connect Google Calendar."); }
  }

  async function syncGoogle() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`${apiBaseUrl}/api/calendar/google/sync?start=${encodeURIComponent(range.start.toISOString())}&end=${encodeURIComponent(range.end.toISOString())}`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Google sync failed.");
      setNotice(`Google Calendar sync completed. ${data.updated || 0} linked event(s) updated.`);
      await loadCalendar();
    } catch (err) { setError(err instanceof Error ? err.message : "Google sync failed."); }
    finally { setSaving(false); }
  }

  return (
    <section className="acta-calendar-page">
      <div className="calendar-page-heading">
        <div>
          <span className="calendar-eyebrow">SCHEDULE &amp; WORK MANAGEMENT</span>
          <h2>Calendar</h2>
          <p>Manage ACTA schedules and Google Calendar events in one workspace.</p>
        </div>
        <div className="calendar-heading-actions">
          <button type="button" className="calendar-secondary-button" onClick={loadCalendar} disabled={loading}>↻ Refresh</button>
          <button type="button" className="calendar-primary-button" onClick={() => openNewEvent()}>＋ Create event</button>
        </div>
      </div>

      <div className="calendar-source-bar">
        <div className="calendar-source-tabs" role="tablist" aria-label="Calendar source">
          {[['all','Combined'],['acta','ACTA Calendar'],['google','Google Calendar']].map(([value,label]) => (
            <button key={value} type="button" role="tab" aria-selected={source === value} className={source === value ? "active" : ""} onClick={() => setSource(value)}>{label}</button>
          ))}
        </div>
        <div className="calendar-source-meta">
          <span className="calendar-source-key"><i className="acta-dot"/> ACTA</span>
          <span className="calendar-source-key"><i className="google-dot"/> Google</span>
          {!googleConnected ? <button className="calendar-link-button" type="button" onClick={connectGoogle}>Connect Google Calendar</button> : <button className="calendar-link-button" type="button" onClick={syncGoogle} disabled={saving}>Sync Google changes</button>}
        </div>
      </div>

      {error && <div className="calendar-alert calendar-alert-error" role="alert">{error}</div>}
      {notice && <div className="calendar-alert calendar-alert-success" role="status">{notice}</div>}
      {!googleConnected && source !== "acta" && <div className="calendar-connect-note"><strong>Google Calendar belum terhubung.</strong> ACTA Calendar tetap bisa digunakan sekarang. Hubungkan Google untuk menampilkan dan mengelola event Google dari halaman ini.</div>}

      <div className="calendar-stat-strip">
        <div><span className="acta-dot"/><strong>{calendarEventCount.acta}</strong><small>ACTA events</small></div>
        <div><span className="google-dot"/><strong>{calendarEventCount.google}</strong><small>Google events</small></div>
        <div><strong>{events.length}</strong><small>Visible events</small></div>
      </div>

      <div className="panel acta-calendar-panel">
        {loading && <div className="calendar-loading">Loading calendar…</div>}
        <FullCalendar
          ref={calendarRef}
          plugins={PLUGINS}
          initialView="dayGridMonth"
          headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay,listMonth" }}
          buttonText={{ today: "Today", month: "Month", week: "Week", day: "Day", list: "Agenda" }}
          events={events}
          height="auto"
          expandRows
          dayMaxEvents={3}
          nowIndicator
          selectable
          editable
          droppable={false}
          eventStartEditable
          eventDurationEditable
          eventClick={openEditEvent}
          dateClick={(info) => openNewEvent(info.date)}
          eventDrop={moveEvent}
          eventResize={moveEvent}
          datesSet={(info) => setRange({ start: info.start, end: info.end })}
          eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
          dayHeaderFormat={{ weekday: "short" }}
          displayEventEnd
          noEventsContent="No events in this period. Select a date or create an event."
        />
      </div>
      <div className="calendar-bottom-note">Timezone: Asia/Jakarta (WIB). ACTA events are stored in ACTA; Google events are managed in the connected Google account. Linked events created in both calendars are kept together when edited in ACTA.</div>

      {showEditor && (
        <div className="calendar-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowEditor(false); }}>
          <section className="calendar-modal" role="dialog" aria-modal="true" aria-labelledby="calendar-event-title">
            <div className="calendar-modal-heading">
              <div><span className="calendar-eyebrow">{editing ? "EDIT SCHEDULE" : "NEW SCHEDULE"}</span><h3 id="calendar-event-title">{editing ? "Edit event" : "Create event"}</h3></div>
              <button type="button" className="calendar-close-button" onClick={() => setShowEditor(false)} aria-label="Close">×</button>
            </div>
            <form onSubmit={saveEvent} className="calendar-event-form">
              <label>Event title<input autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={200} required placeholder="e.g. Weekly product review"/></label>
              <div className="calendar-form-row">
                <label>Category<select value={form.category} onChange={(e) => { const cat = CATEGORIES.find((x) => x.value === e.target.value); setForm({ ...form, category: e.target.value, color: cat?.color || DEFAULT_COLOR }); }}>{CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
                <label>Save to<select value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} disabled={Boolean(editing)}><option value="acta">ACTA Calendar</option><option value="google" disabled={!googleConnected}>Google Calendar</option><option value="both" disabled={!googleConnected}>Both calendars</option></select></label>
              </div>
              <label className="calendar-checkbox-label"><input type="checkbox" checked={form.allDay} onChange={(e) => setForm({ ...form, allDay: e.target.checked })}/> All-day event</label>
              {form.allDay ? (
                <div className="calendar-form-row"><label>Start date<input type="date" value={form.startAt.slice(0,10)} onChange={(e) => setForm({ ...form, startAt: e.target.value, endAt: e.target.value })} required/></label><label>End date (exclusive)<input type="date" value={form.endAt.slice(0,10)} onChange={(e) => setForm({ ...form, endAt: e.target.value })} required/></label></div>
              ) : (
                <div className="calendar-form-row"><label>Start<input type="datetime-local" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} required/></label><label>End<input type="datetime-local" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} required/></label></div>
              )}
              <div className="calendar-form-row"><label>Repeat<select value={form.recurrence} onChange={(e) => setForm({ ...form, recurrence: e.target.value })}><option value="none">Does not repeat</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label><label>Location<input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} maxLength={500} placeholder="Office / meeting room"/></label></div>
              <label>Meeting link<input value={form.meetingLink} onChange={(e) => setForm({ ...form, meetingLink: e.target.value })} maxLength={1000} placeholder="https://…"/></label>
              <label>Description<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={8000} rows={3} placeholder="Agenda, notes, or context"/></label>
              {error && <div className="calendar-alert calendar-alert-error">{error}</div>}
              <div className="calendar-modal-actions">
                {editing && <button type="button" className="calendar-delete-button" onClick={deleteEvent} disabled={saving}>Delete</button>}
                <span className="calendar-actions-spacer"/>
                <button type="button" className="calendar-secondary-button" onClick={() => setShowEditor(false)} disabled={saving}>Cancel</button>
                <button type="submit" className="calendar-primary-button" disabled={saving || !form.title.trim()}>{saving ? "Saving…" : editing ? "Save changes" : "Create event"}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
