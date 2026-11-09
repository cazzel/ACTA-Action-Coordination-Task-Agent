import { useCallback, useEffect, useMemo, useState } from "react";
import { demoFetch } from "./api.js";

const SAMPLE_BRIEF = "/demo-assets/NOVA_Q4_Product_Launch_Brief.pptx";
const SAMPLE_AUDIO = "/demo-assets/NOVA_Q4_Kickoff_Meeting_Demo_Audio.mp3";

async function readResponse(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || `Request failed (HTTP ${response.status})`);
  return data;
}

function ResourceCard({ icon, title, detail, href, type }) {
  return <article className="demo-resource-card"><div className={`demo-resource-icon ${type}`}>{icon}</div><div className="demo-resource-copy"><strong>{title}</strong><span>{detail}</span></div><a href={href} target="_blank" rel="noreferrer">Open ↗</a></article>;
}

export default function DemoWorkspace({ onExit }) {
  const [workspace, setWorkspace] = useState(null);
  const [page, setPage] = useState("Overview");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [audioFile, setAudioFile] = useState(null);
  const [briefFile, setBriefFile] = useState(null);
  const [prompt, setPrompt] = useState("Review the NOVA Q4 Product Launch project and kickoff meeting. Analyze existing tasks, employee skills, workload, dependencies, and deadlines. Prepare an execution plan, recommend owners, identify bottlenecks and unresolved decisions, and save a work package for human review. Do not approve assignments, spending, or the launch date automatically.");
  const [ownerChoices, setOwnerChoices] = useState({});
  const [useSampleBusy, setUseSampleBusy] = useState(false);

  const refresh = useCallback(async () => {
    const response = await demoFetch("/api/demo/workspace");
    const data = await readResponse(response);
    setWorkspace(data.workspace);
  }, []);

  useEffect(() => {
    let alive = true;
    demoFetch("/api/demo/workspace")
      .then(readResponse)
      .then((data) => { if (alive) setWorkspace(data.workspace); })
      .catch((err) => { if (alive) setError(err.message || "Could not load the demo workspace."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const counts = useMemo(() => {
    const tasks = workspace?.tasks || [];
    return {
      total: tasks.length,
      pending: tasks.filter((t) => t.status === "pending_review").length,
      approved: tasks.filter((t) => t.status === "approved").length,
      progress: tasks.filter((t) => t.status === "in_progress").length,
      done: tasks.filter((t) => t.status === "done").length,
    };
  }, [workspace]);

  async function loadSampleFiles() {
    setUseSampleBusy(true); setError(""); setNotice("");
    try {
      const [audioResponse, briefResponse] = await Promise.all([fetch(SAMPLE_AUDIO), fetch(SAMPLE_BRIEF)]);
      if (!audioResponse.ok || !briefResponse.ok) throw new Error("Sample files are not on the website yet. Put the existing MP3 and PPTX in frontend/public/demo-assets/ and try again, or select the files manually below.");
      const [audioBlob, briefBlob] = await Promise.all([audioResponse.blob(), briefResponse.blob()]);
      setAudioFile(new File([audioBlob], "NOVA_Q4_Kickoff_Meeting_Demo_Audio.mp3", { type: "audio/mpeg" }));
      setBriefFile(new File([briefBlob], "NOVA_Q4_Product_Launch_Brief.pptx", { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" }));
      setNotice("Sample audio and project brief loaded. You can now run the analysis.");
    } catch (err) { setError(err.message || "Could not load sample files."); }
    finally { setUseSampleBusy(false); }
  }

  async function analyze() {
    if (!audioFile || !briefFile) { setError("Select both the kickoff audio and project brief before analysis."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const form = new FormData(); form.append("audio_file", audioFile); form.append("brief_file", briefFile);
      const response = await demoFetch("/api/demo/analyze", { method: "POST", body: form });
      const data = await readResponse(response);
      await refresh(); setPage("Meeting Intelligence");
      setNotice(`${data.task_count} draft task(s) extracted. All items remain pending human review.`);
    } catch (err) { setError(err.message || "Meeting analysis failed."); }
    finally { setBusy(false); }
  }

  async function coordinate() {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await demoFetch("/api/demo/coordinate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }) });
      const data = await readResponse(response); await refresh(); setPage("AI Agent");
      setNotice(data.message || "Work package draft saved.");
    } catch (err) { setError(err.message || "AI coordination failed."); }
    finally { setBusy(false); }
  }

  async function updateTask(task, status) {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await demoFetch(`/api/demo/tasks/${task.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, selected_owner_id: ownerChoices[task.id] || null }) });
      const data = await readResponse(response); await refresh(); setNotice(data.message || "Task updated.");
    } catch (err) { setError(err.message || "Could not update task."); }
    finally { setBusy(false); }
  }

  async function resetWorkspace() {
    if (!window.confirm("Reset this demo workspace to the original NOVA data? Your demo changes will be discarded.")) return;
    setBusy(true); setError(""); setNotice("");
    try { const response = await demoFetch("/api/demo/reset", { method: "POST" }); const data = await readResponse(response); setWorkspace(data.workspace); setPage("Overview"); setOwnerChoices({}); setNotice(data.message); }
    catch (err) { setError(err.message || "Could not reset demo workspace."); }
    finally { setBusy(false); }
  }

  if (loading) return <div className="demo-loading">Loading NOVA demo workspace…</div>;
  if (!workspace) return <div className="demo-loading"><p>{error || "Demo workspace could not be loaded."}</p><button onClick={onExit}>Exit demo</button></div>;

  const company = workspace.company || {};
  const tasks = workspace.tasks || [];
  const employees = workspace.employees || [];
  const analysis = workspace.analysis;
  const workPackage = workspace.work_package;
  const nav = ["Overview", "Resources", "Meeting Intelligence", "AI Agent", "Tasks & Team"];

  return (
    <div className="demo-app">
      <aside className="demo-sidebar">
        <div className="demo-brand"><div className="demo-brand-mark">A</div><div><b>ACTA</b><small>INTERACTIVE DEMO</small></div></div>
        <div className="demo-company-switch"><span>N</span><div><b>{company.name || "NOVA"}</b><small>Fictional company workspace</small></div></div>
        <small className="demo-nav-label">DEMO WORKSPACE</small>
        <nav>{nav.map((item, index) => <button key={item} className={page === item ? "active" : ""} onClick={() => setPage(item)}><span>{["▦", "▤", "◉", "✦", "✓"][index]}</span>{item}</button>)}</nav>
        <div className="demo-sidebar-bottom"><div className="demo-synthetic-note">Synthetic dataset<br/><b>All records are fictional.</b></div><button className="demo-exit" onClick={onExit}>← Exit demo</button></div>
      </aside>
      <main className="demo-main">
        <header className="demo-topbar"><div><small>WORKSPACE / NOVA / {page.toUpperCase()}</small><h1>{page}</h1></div><div className="demo-top-actions"><span className="demo-session-pill"><i/> Isolated demo session</span><button onClick={resetWorkspace} disabled={busy}>↻ Reset demo</button></div></header>
        {error && <div className="demo-alert error">{error}</div>}{notice && <div className="demo-alert success">{notice}</div>}

        {page === "Overview" && <>
          <section className="demo-welcome"><div><span className="demo-eyebrow">NOVA · B2B SAAS</span><h2>From meetings to execution.</h2><p>Explore how ACTA turns project context and meeting conversations into coordinated, reviewable work.</p><button onClick={() => setPage("Resources")}>Start with demo resources <b>→</b></button></div><div className="demo-welcome-symbol">N</div></section>
          <section className="demo-stat-grid"><div><small>TEAM MEMBERS</small><strong>{employees.length}</strong><span>Across {workspace.divisions?.length || 0} divisions</span></div><div><small>DRAFT TASKS</small><strong>{counts.total}</strong><span>Extracted by ACTA</span></div><div><small>AWAITING REVIEW</small><strong>{counts.pending}</strong><span>Human approval required</span></div><div><small>COMPLETED</small><strong>{counts.done}</strong><span>In this demo session</span></div></section>
          <section className="demo-two-column"><article className="demo-panel"><div className="demo-panel-heading"><div><small>ACTIVE PROJECT</small><h3>{workspace.projects?.[0]?.name || "Q4 Product Launch"}</h3></div><span className="demo-active-tag">ACTIVE</span></div><p>{workspace.projects?.[0]?.description}</p><div className="demo-project-facts"><div><small>BASELINE LAUNCH</small><b>18 November 2026</b></div><div><small>BUDGET CAP</small><b>Rp75.0 million</b></div></div><button className="demo-text-button" onClick={() => setPage("Resources")}>Open project materials →</button></article><article className="demo-panel"><div className="demo-panel-heading"><div><small>DEMO JOURNEY</small><h3>Try ACTA in 4 steps</h3></div></div><ol className="demo-journey"><li><b>01</b><span>Upload the meeting audio and project brief</span></li><li><b>02</b><span>Analyze tasks, owners, risks and dependencies</span></li><li><b>03</b><span>Ask the AI Agent to prepare an execution plan</span></li><li><b>04</b><span>Review and approve tasks manually</span></li></ol></article></section>
        </>}

        {page === "Resources" && <section className="demo-panel demo-resources"><div className="demo-section-heading"><div><small>PRELOADED SAMPLE LIBRARY</small><h2>Project materials</h2><p>Use the supplied NOVA files as source material for the ACTA analysis.</p></div><button className="demo-outline-button" disabled={useSampleBusy} onClick={loadSampleFiles}>{useSampleBusy ? "Loading…" : "Load sample files"}</button></div><div className="demo-resource-grid"><ResourceCard icon="PPT" title="NOVA Q4 Product Launch Brief" detail="8-slide project context, ownership, budget, milestones and risks · PPTX" href={SAMPLE_BRIEF} type="ppt"/><ResourceCard icon="MP3" title="NOVA Kickoff Meeting" detail="Synthetic cross-functional meeting recording · MP3" href={SAMPLE_AUDIO} type="audio"/></div><div className="demo-upload-panel"><div><span className="demo-eyebrow">RUN MEETING INTELLIGENCE</span><h3>Analyze the brief and meeting together</h3><p>Choose both source files. ACTA will transcribe the recording, extract the brief, and compare the evidence.</p></div><label className="demo-file-input">Meeting recording (MP3 / WAV / M4A)<input type="file" accept="audio/*,video/mp4" onChange={(e) => setAudioFile(e.target.files?.[0] || null)}/><span>{audioFile?.name || "Choose audio file"}</span></label><label className="demo-file-input">Project brief (PPTX / PDF / DOCX / TXT)<input type="file" accept=".pptx,.pdf,.docx,.txt" onChange={(e) => setBriefFile(e.target.files?.[0] || null)}/><span>{briefFile?.name || "Choose project brief"}</span></label><button className="demo-primary-button" disabled={busy || !audioFile || !briefFile} onClick={analyze}>{busy ? "Analyzing files…" : "Analyze meeting + brief →"}</button><small className="demo-upload-note">Audio transcription requires GROQ_API_KEY or OPENAI_API_KEY on the backend. AI analysis requires OPENROUTER_API_KEY.</small></div></section>}

        {page === "Meeting Intelligence" && <section className="demo-panel"><div className="demo-section-heading"><div><small>MEETING ANALYSIS</small><h2>{analysis ? "NOVA Kickoff Meeting" : "No meeting analyzed yet"}</h2><p>{analysis ? `Processed ${analysis.audio_file_name} and ${analysis.brief_file_name}` : "Go to Demo Resources and upload the sample audio and project brief."}</p></div><button className="demo-outline-button" onClick={() => setPage("Resources")}>Open resources</button></div>{analysis && <><div className="demo-analysis-summary"><small>AI SUMMARY</small><p>{analysis.summary}</p></div><div className="demo-analysis-grid"><article><h3>Risks detected</h3>{(analysis.risks || []).map((risk, i) => <div className="demo-insight" key={i}><b>{risk.title || risk.risk || `Risk ${i+1}`}</b><span>{risk.evidence || risk.description || ""}</span><em>{risk.severity || "Review"}</em></div>)}</article><article><h3>Open questions & date conflicts</h3>{(analysis.open_questions || []).map((item, i) => <p className="demo-question" key={`q${i}`}>? {typeof item === "string" ? item : JSON.stringify(item)}</p>)}{(analysis.date_conflicts || []).map((item, i) => <p className="demo-question" key={`d${i}`}>⚑ {item.claim_a || item.date_a} ↔ {item.claim_b || item.date_b} — {item.status || "Unresolved"}</p>)}</article></div><div className="demo-transcript-box"><h3>Transcribed meeting</h3><pre>{analysis.transcript}</pre></div></>}</section>}

        {page === "AI Agent" && <section className="demo-panel"><div className="demo-section-heading"><div><small>AI COORDINATION AGENT</small><h2>Prepare an execution plan</h2><p>ACTA will use the analyzed meeting, NOVA team skills, current workloads and project brief.</p></div><span className="demo-active-tag">HUMAN REVIEW</span></div>{!analysis && <div className="demo-empty">Analyze the sample meeting and project brief first. <button onClick={() => setPage("Resources")}>Go to resources →</button></div>}<label className="demo-prompt-label">Instruction to ACTA<textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={5}/></label><button className="demo-primary-button" disabled={busy || !analysis} onClick={coordinate}>{busy ? "Preparing work package…" : "Run coordination agent →"}</button>{workPackage && <div className="demo-work-package"><div className="demo-package-status">DRAFT · NOT EXECUTED</div><h3>{workPackage.title || "NOVA Execution Work Package"}</h3><p>{workPackage.summary}</p><div className="demo-analysis-grid"><article><h4>Recommended sequence</h4><ul>{(workPackage.recommended_sequence || []).map((x,i)=><li key={i}>{typeof x === "string" ? x : JSON.stringify(x)}</li>)}</ul></article><article><h4>Bottlenecks & risks</h4><ul>{[...(workPackage.bottlenecks || []), ...(workPackage.risks || [])].map((x,i)=><li key={i}>{typeof x === "string" ? x : JSON.stringify(x)}</li>)}</ul></article></div><h4>Open decisions</h4><ul>{(workPackage.open_decisions || []).map((x,i)=><li key={i}>{typeof x === "string" ? x : JSON.stringify(x)}</li>)}</ul></div>}</section>}

        {page === "Tasks & Team" && <><section className="demo-stat-grid compact"><div><small>PENDING REVIEW</small><strong>{counts.pending}</strong></div><div><small>APPROVED</small><strong>{counts.approved}</strong></div><div><small>IN PROGRESS</small><strong>{counts.progress}</strong></div><div><small>DONE</small><strong>{counts.done}</strong></div></section><section className="demo-panel"><div className="demo-section-heading"><div><small>HUMAN REVIEW QUEUE</small><h2>Extracted action items</h2><p>Choose an owner and approve each item explicitly. AI recommendations are suggestions only.</p></div></div>{!tasks.length ? <div className="demo-empty">No tasks yet. Run Meeting Intelligence to extract draft action items.</div> : <div className="demo-task-list">{tasks.map((task) => { const owner = employees.find((e) => String(e.id) === String(task.selected_owner_id)); const recommended = employees.find((e) => String(e.id) === String(task.recommended_owner_id)); return <article className="demo-task-card" key={task.id}><div className="demo-task-main"><div className="demo-task-title"><b>{task.task}</b><span className={`demo-task-status ${task.status}`}>{task.status.replaceAll("_", " ")}</span></div><p>{task.evidence ? `Evidence: “${task.evidence}”` : "No exact evidence quote was returned."}</p><div className="demo-task-meta"><span>Due: {task.deadline_text || "Not specified"}</span><span>Mentioned: {task.owner_mentioned || "No owner named"}</span>{task.dependency && <span>Dependency: {task.dependency}</span>}</div>{recommended && <small className="demo-recommendation">Suggested candidate: {recommended.name} — {task.recommendation_reason || "Validate skills and capacity before approval."}</small>}</div><div className="demo-task-actions">{task.status === "pending_review" && <><select value={ownerChoices[task.id] || ""} onChange={(e) => setOwnerChoices((old) => ({ ...old, [task.id]: e.target.value }))}><option value="">Choose owner…</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.name} · {e.role} ({e.current_open_tasks}/{e.max_concurrent_tasks})</option>)}</select><button disabled={busy || !ownerChoices[task.id]} onClick={() => updateTask(task, "approved")}>Approve</button><button className="reject" disabled={busy} onClick={() => updateTask(task, "rejected")}>Reject</button></>}{task.status === "approved" && <button disabled={busy} onClick={() => updateTask(task, "in_progress")}>Start task</button>}{task.status === "in_progress" && <button disabled={busy} onClick={() => updateTask(task, "done")}>Mark done</button>}{owner && <small>Owner: {owner.name}</small>}</div></article>; })}</div>}</section><section className="demo-panel"><div className="demo-section-heading"><div><small>NOVA TEAM</small><h2>Team & workload</h2><p>Seeded synthetic employee capability and capacity data.</p></div><span className="demo-active-tag">{employees.length} MEMBERS</span></div><div className="demo-team-grid">{employees.map((member) => { const pct = Math.min(100, Math.round((Number(member.current_open_tasks || 0) / Math.max(1, Number(member.max_concurrent_tasks || 1))) * 100)); return <article key={member.id}><div className="demo-member-avatar">{String(member.name || "?").slice(0,1)}</div><div className="demo-member-info"><b>{member.name}</b><span>{member.role}</span></div><div className="demo-capacity"><div><small>CAPACITY</small><b>{member.current_open_tasks}/{member.max_concurrent_tasks}</b></div><div className="demo-capacity-track"><i style={{ width: `${pct}%` }}/></div><small>{member.availability_status}</small></div></article>; })}</div></section></>}

        <footer className="demo-footer">ACTA Interactive Demo · NOVA is a fictional company. AI results are drafts and require human review.</footer>
      </main>
    </div>
  );
}
