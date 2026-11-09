import { useEffect, useState } from "react";
import App from "./App.jsx";
import { apiFetch, apiUrl, clearAuthSession, saveAuthSession } from "./api.js";
import "./auth-demo.css";

export default function AuthGate() {
  const [mode, setMode] = useState("checking");
  const [tab, setTab] = useState(new URLSearchParams(window.location.search).has("invite") ? "signup" : "login");
  const [form, setForm] = useState({ email: "", password: "", company_name: "", invite_code: new URLSearchParams(window.location.search).get("invite") || "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let alive = true;
    async function restore() {
      const demoToken = sessionStorage.getItem("acta_demo_token");
      if (demoToken) {
        try {
          const check = await fetch(apiUrl("/api/demo/workspace"), { headers: { "X-ACTA-DEMO-TOKEN": demoToken } });
          if (check.ok) {
            const payload = await check.json().catch(() => ({}));
            const companyName = payload.workspace?.company?.name || "NOVA";
            sessionStorage.setItem("acta_company_name", companyName);
            if (alive) setMode("demo");
            return;
          }
        } catch { /* continue to user session check */ }
        sessionStorage.removeItem("acta_demo_token");
      }
      if (sessionStorage.getItem("acta_access_token")) {
        try {
          const response = await apiFetch("/api/auth/me");
          if (response.ok) { if (alive) setMode("user"); return; }
        } catch { /* show sign-in */ }
      }
      if (alive) setMode("landing");
    }
    restore();
    return () => { alive = false; };
  }, []);

  function changeField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function submitAuth(event) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const endpoint = tab === "login" ? "/api/auth/login" : "/api/auth/signup";
      const response = await fetch(apiUrl(endpoint), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tab === "login"
          ? { email: form.email, password: form.password }
          : { email: form.email, password: form.password, company_name: form.company_name || undefined, invite_code: form.invite_code || undefined }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Authentication failed.");
      if (data.requires_email_confirmation) {
        setNotice(data.message || "Check your email to confirm your account, then sign in.");
        window.history.replaceState({}, "", window.location.pathname);
        setTab("login");
        return;
      }
      saveAuthSession(data);
      sessionStorage.removeItem("acta_demo_token");
      window.history.replaceState({}, "", window.location.pathname);
      setMode("user");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect to ACTA.");
    } finally { setBusy(false); }
  }

  async function startDemo() {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(apiUrl("/api/demo/sessions"), { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Could not start the demo workspace.");
      clearAuthSession();
      sessionStorage.setItem("acta_demo_token", data.session_token);
      const workspaceResponse = await fetch(apiUrl("/api/demo/workspace"), { headers: { "X-ACTA-DEMO-TOKEN": data.session_token } });
      const workspaceData = await workspaceResponse.json().catch(() => ({}));
      if (!workspaceResponse.ok) throw new Error(workspaceData.detail || "Demo session started, but its workspace could not be loaded.");
      sessionStorage.setItem("acta_company_name", workspaceData.workspace?.company?.name || "NOVA");
      sessionStorage.setItem("acta_user_email", "demo-visitor@acta.local");
      sessionStorage.setItem("acta_role", "demo");
      setMode("demo");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start demo.");
    } finally { setBusy(false); }
  }

  function signOut() {
    const token = sessionStorage.getItem("acta_access_token");
    if (token) fetch(apiUrl("/api/auth/logout"), { method: "POST", headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    clearAuthSession(); sessionStorage.removeItem("acta_demo_token"); setMode("landing");
  }

  if (mode === "checking") return <div className="acta-gate-loading"><div className="acta-brand-mark">A</div><span>Preparing ACTA workspace…</span></div>;
  if (mode === "user") return <App onLogout={signOut} isDemo={false} />;
  if (mode === "demo") return <App onLogout={signOut} isDemo />;

  return (
    <main className="acta-gate">
      <section className="acta-gate-hero">
        <div className="acta-gate-top"><div className="acta-brand-lockup"><div className="acta-brand-mark">A</div><div><strong>ACTA</strong><small>ACTION COORDINATION & TASK AGENT</small></div></div><span className="acta-public-label">AI WORKSPACE</span></div>
        <div className="acta-gate-copy">
          <span className="acta-eyebrow">FROM MEETINGS TO EXECUTION</span>
          <h1>Turn conversations<br/>into coordinated work.</h1>
          <p>ACTA helps teams transform meeting discussions into actionable tasks, balanced assignments, and reviewable execution plans.</p>
          <div className="acta-gate-benefits"><span>✦ Meeting intelligence</span><span>↗ Team coordination</span><span>✓ Human-approved execution</span></div>
        </div>
        <div className="acta-hero-visual"><div className="visual-card visual-card-main"><div className="visual-card-head"><span>MEETING ANALYSIS</span><i>● LIVE WORKFLOW</i></div><div className="visual-line long"/><div className="visual-line medium"/><div className="visual-task"><b>✓</b><span>Payment API integration</span><em>Raka · Nov 10</em></div><div className="visual-task"><b>↗</b><span>Campaign strategy</span><em>Alya · Nov 11</em></div><div className="visual-risk">⚑ One unresolved decision requires review</div></div><div className="visual-card visual-card-float"><small>TEAM CAPACITY</small><strong>6 / 8</strong><span>Budi · Limited availability</span></div></div>
        <div className="acta-gate-footer">ACTA · Secure team workspace · Interactive demo available</div>
      </section>
      <section className="acta-gate-panel">
        <div className="acta-auth-card">
          <span className="acta-eyebrow">GET STARTED</span>
          <h2>{tab === "login" ? "Welcome back." : "Create your workspace."}</h2>
          <p className="acta-auth-subtitle">{tab === "login" ? "Sign in to continue to your company workspace." : "Start a private ACTA workspace for your organization."}</p>
          <div className="acta-auth-tabs"><button className={tab === "login" ? "active" : ""} onClick={() => { setTab("login"); setError(""); setNotice(""); }}>Sign in</button><button className={tab === "signup" ? "active" : ""} onClick={() => { setTab("signup"); setError(""); setNotice(""); }}>Create account</button></div>
          <form className="acta-auth-form" onSubmit={submitAuth}>
            {tab === "signup" && <><label>Company or workspace name<input name="company_name" value={form.company_name} onChange={changeField} placeholder="e.g. Acme Studio" minLength={2} required={!form.invite_code}/></label><label>Workspace invitation code <span className="acta-optional-label">optional — use this to join an existing team</span><input name="invite_code" value={form.invite_code} onChange={changeField} placeholder="Paste invitation code or open invite link" /></label></>}
            <label>Work email<input name="email" type="email" value={form.email} onChange={changeField} placeholder="you@company.com" required autoComplete="email"/></label>
            <label>Password<input name="password" type="password" value={form.password} onChange={changeField} placeholder="At least 8 characters" minLength={8} required autoComplete={tab === "login" ? "current-password" : "new-password"}/></label>
            {error && <div className="acta-form-alert error">{error}</div>}{notice && <div className="acta-form-alert success">{notice}</div>}
            <button className="acta-primary-button" disabled={busy}>{busy ? "Please wait…" : tab === "login" ? "Sign in to ACTA" : "Create workspace"}<span>→</span></button>
          </form>
          <div className="acta-auth-divider"><span>OR</span></div>
          <button className="acta-demo-button" onClick={startDemo} disabled={busy}><span className="demo-spark">✦</span><span><b>Explore interactive demo</b><small>Try ACTA using the fictional NOVA company dataset.</small></span><strong>→</strong></button>
          <p className="acta-auth-footnote">The NOVA demo is isolated from real customer workspaces. Demo data is synthetic.</p>
        </div>
      </section>
    </main>
  );
}
