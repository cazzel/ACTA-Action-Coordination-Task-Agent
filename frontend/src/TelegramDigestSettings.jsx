import { useCallback, useEffect, useState } from "react";

const DEFAULTS = {
  company_id: "nova",
  enabled: false,
  send_time: "07:00",
  timezone_name: "Asia/Jakarta",
  include_overdue: true,
  include_due_today: true,
  include_due_soon: true,
  due_soon_days: 7,
  include_pending_review: true,
  include_in_progress: true,
  include_approved: true,
};

async function readJson(response, fallbackMessage) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || `${fallbackMessage} (HTTP ${response.status})`);
  return data;
}

function formatTimestamp(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

export default function TelegramDigestSettings({ apiBaseUrl }) {
  const [form, setForm] = useState(DEFAULTS);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState("");
  const [runs, setRuns] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [settingsResponse, runsResponse] = await Promise.all([
        fetch(`${apiBaseUrl}/api/notifications/daily-digest/preferences?company_id=nova`),
        fetch(`${apiBaseUrl}/api/notifications/daily-digest/runs?company_id=nova&limit=15`),
      ]);
      const data = await readJson(settingsResponse, "Could not load digest settings");
      setConfigured(Boolean(data.configured));
      const preferences = data.preferences || {};
      setForm({
        ...DEFAULTS,
        ...preferences,
        send_time: String(preferences.send_time || DEFAULTS.send_time).slice(0, 5),
      });
      if (runsResponse.ok) {
        const history = await runsResponse.json().catch(() => ({}));
        setRuns(Array.isArray(history.data) ? history.data : []);
      } else {
        setRuns([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load digest settings.");
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => { load(); }, [load]);

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload = {
        ...form,
        due_soon_days: Math.max(1, Math.min(30, Number(form.due_soon_days) || 7)),
      };
      const response = await fetch(`${apiBaseUrl}/api/notifications/daily-digest/preferences`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await readJson(response, "Could not save digest settings");
      setMessage(data.message || "Daily recap settings saved.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save digest settings.");
    } finally {
      setSaving(false);
    }
  }

  async function showPreview() {
    setError("");
    setMessage("");
    try {
      const url = `${apiBaseUrl}/api/notifications/daily-digest/preview?company_id=nova&timezone_name=${encodeURIComponent(form.timezone_name)}`;
      const response = await fetch(url);
      const data = await readJson(response, "Could not create preview");
      setPreview(data.message_preview || "No preview content.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create preview.");
    }
  }

  async function sendTest() {
    setSending(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`${apiBaseUrl}/api/notifications/daily-digest/send-test?company_id=nova`, { method: "POST" });
      const data = await readJson(response, "Could not send test digest");
      setMessage(`Test recap sent to Telegram. ${data.task_count || 0} task(s) included.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send test digest.");
    } finally {
      setSending(false);
    }
  }

  const fields = [
    ["include_overdue", "Overdue tasks"],
    ["include_due_today", "Tasks due today"],
    ["include_due_soon", "Upcoming deadlines"],
    ["include_pending_review", "Tasks waiting for approval"],
    ["include_in_progress", "Tasks in progress"],
    ["include_approved", "Approved / upcoming tasks"],
  ];

  return (
    <section className="panel digest-settings-card">
      <div className="digest-heading">
        <div className="integration-logo telegram-logo">✈</div>
        <div>
          <span className="ai-label">DAILY WORK SUMMARY</span>
          <h2>Telegram Daily Recap</h2>
          <p>Send one organized task summary to your team’s Telegram group every day.</p>
        </div>
        <span className={`integration-state ${form.enabled ? "is-connected" : "is-disconnected"}`}>
          {form.enabled ? "Enabled" : "Disabled"}
        </span>
      </div>

      {loading ? <p className="digest-muted">Loading settings…</p> : (
        <form onSubmit={save} className="digest-form">
          <label className="digest-enable">
            <input type="checkbox" checked={Boolean(form.enabled)} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
            <span>
              <strong>Enable daily Telegram recap</strong>
              <small>At most one automatic recap is sent per configured chat and local date.</small>
            </span>
          </label>

          <div className="digest-fields">
            <label>Send time
              <input type="time" value={form.send_time || "07:00"} onChange={(e) => setForm({ ...form, send_time: e.target.value })} />
            </label>
            <label>Timezone
              <select value={form.timezone_name || "Asia/Jakarta"} onChange={(e) => setForm({ ...form, timezone_name: e.target.value })}>
                <option value="Asia/Jakarta">Asia/Jakarta (WIB)</option>
                <option value="Asia/Makassar">Asia/Makassar (WITA)</option>
                <option value="Asia/Jayapura">Asia/Jayapura (WIT)</option>
                <option value="UTC">UTC</option>
              </select>
            </label>
            <label>Upcoming deadline window
              <input type="number" min="1" max="30" value={form.due_soon_days} onChange={(e) => setForm({ ...form, due_soon_days: e.target.value })} />
            </label>
          </div>

          <div className="digest-checks">
            <span>Include in recap</span>
            {fields.map(([key, label]) => (
              <label key={key}>
                <input type="checkbox" checked={Boolean(form[key])} onChange={(e) => setForm({ ...form, [key]: e.target.checked })} />
                {label}
              </label>
            ))}
          </div>

          {!configured && (
            <p className="digest-warning">
              Telegram is not fully configured. Set <code>TELEGRAM_BOT_TOKEN</code> and <code>TELEGRAM_CHAT_ID</code> in the backend environment before enabling delivery.
            </p>
          )}
          {error && <p className="digest-error" role="alert">{error}</p>}
          {message && <p className="digest-success" role="status">{message}</p>}

          <div className="digest-actions">
            <button type="submit" className="action-button" disabled={saving}>{saving ? "Saving…" : "Save daily recap settings"}</button>
            <button type="button" className="filter-button" onClick={showPreview}>Preview message</button>
            <button type="button" className="filter-button" onClick={sendTest} disabled={sending || !configured}>{sending ? "Sending…" : "Send test to Telegram"}</button>
            <button type="button" className="filter-button" onClick={load}>↻ Refresh history</button>
          </div>

          {preview && <pre className="digest-preview">{preview}</pre>}
          <p className="digest-muted">Automatic delivery requires the scheduled Worker in <code>scheduler/</code>. It calls the protected backend endpoint every 15 minutes; backend preferences determine each workspace’s local send time.</p>

          <div className="digest-history">
            <div className="digest-history-heading"><strong>Recent delivery history</strong><span>{runs.length} records</span></div>
            {runs.length === 0 ? <p className="digest-muted">No automatic delivery attempts have been recorded yet.</p> : (
              <div className="digest-history-table-wrap">
                <table className="digest-history-table">
                  <thead><tr><th>Date</th><th>Status</th><th>Tasks</th><th>Updated</th><th>Details</th></tr></thead>
                  <tbody>
                    {runs.map((run) => (
                      <tr key={run.id}>
                        <td>{run.digest_date || "—"}</td>
                        <td><span className={`digest-run-status status-${run.status}`}>{run.status}</span></td>
                        <td>{run.task_count ?? 0}</td>
                        <td>{formatTimestamp(run.sent_at || run.started_at)}</td>
                        <td>{run.error_message || (run.message_id ? `Message #${run.message_id}` : "—")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
