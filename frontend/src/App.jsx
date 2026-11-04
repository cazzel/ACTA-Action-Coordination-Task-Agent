
import { useEffect, useRef, useState } from "react";
import "./index.css";

const API_BASE_URL = "http://127.0.0.1:8000";

function normalizeTask(item) {
  const owners = Array.isArray(item.suggested_owners)
    ? item.suggested_owners
    : [];

  const selectedOwner = owners.find(
    (owner) => owner.employee_id === item.selected_owner_id
  );

  const ownerName =
    selectedOwner?.name ||
    item.owner_mentioned ||
    "Unassigned";

  const rawStatus = String(
    item.status || "pending_review"
  ).toLowerCase();

  const statusLabels = {
    pending_review: "Pending review",
    approved: "Approved",
    in_progress: "In progress",
    done: "Completed",
    rejected: "Rejected",
  };

  const statusColors = {
    pending_review: "purple",
    approved: "green",
    in_progress: "blue",
    done: "green",
    rejected: "orange",
  };

  const division =
    selectedOwner?.division_name ||
    owners[0]?.division_name ||
    item.company_id ||
    "ACTA";

  return {
    id: item.id,
    title: item.task || "Untitled task",
    project: division,
    owner: ownerName,
    initials: ownerName
      .split(/\s+/)
      .map((part) => part[0] || "")
      .join("")
      .slice(0, 2)
      .toUpperCase(),
    status: statusLabels[rawStatus] || rawStatus,
    rawStatus,
    color: statusColors[rawStatus] || "blue",
    due: item.deadline_text || "Not set",
    suggestedOwners: owners,
    selectedOwnerId: item.selected_owner_id,
  };
}


const navItems = [
  { icon: "▦", label: "Overview" },
  { icon: "⚷", label: "Tasks" },
  { icon: "✳", label: "AI Assistant" },
  { icon: "▣", label: "Meetings" },
  { icon: "♧", label: "Team" },
  { icon: "↗", label: "Integrations" },
];

function localDateTimeAfter(minutesFromNow) {
  const date = new Date(Date.now() + minutesFromNow * 60 * 1000);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
}

function App() {

const [activeNav, setActiveNav] = useState("Overview");
const [backendHealth, setBackendHealth] = useState("checking");
const [isCommandOpen, setIsCommandOpen] = useState(false);
const [commandQuery, setCommandQuery] = useState("");
const [commandActiveIndex, setCommandActiveIndex] = useState(0);
const [search, setSearch] = useState("");
const [taskStatusFilter, setTaskStatusFilter] = useState("all");
const [tasks, setTasks] = useState([]);
const [isLoading, setIsLoading] = useState(true);
const [loadError, setLoadError] = useState("");
const [transcript, setTranscript] = useState("");
const [isSubmitting, setIsSubmitting] = useState(false);
const [submitError, setSubmitError] = useState("");
// Meeting audio recording
const [recordingStatus, setRecordingStatus] = useState("idle");
const [recordingSeconds, setRecordingSeconds] = useState(0);
const [recordingUrl, setRecordingUrl] = useState("");
const [recordingFileName, setRecordingFileName] = useState("");
const [recordingError, setRecordingError] = useState("");
const [recordingBlob, setRecordingBlob] = useState(null);
const [isUploadingRecording, setIsUploadingRecording] = useState(false);
const [recordingUploadResult, setRecordingUploadResult] = useState("");
const [recordingUploadError, setRecordingUploadError] = useState("");
// Upload external meeting files
const [selectedMeetingFiles, setSelectedMeetingFiles] = useState([]);
const [isMeetingFileDragOver, setIsMeetingFileDragOver] = useState(false);
const [isUploadingMeetingFile, setIsUploadingMeetingFile] = useState(false);
const [meetingFileUploadResult, setMeetingFileUploadResult] = useState("");
const [meetingFileUploadError, setMeetingFileUploadError] = useState("");
// Meeting workspace data
const [meetings, setMeetings] = useState([]);
const [isLoadingMeetings, setIsLoadingMeetings] = useState(false);
const [meetingListError, setMeetingListError] = useState("");
const [meetingTitle, setMeetingTitle] = useState("");
const [isCreatingMeeting, setIsCreatingMeeting] = useState(false);
const [meetingCreateError, setMeetingCreateError] = useState("");
const [meetingCreateResult, setMeetingCreateResult] = useState("");
// Google Calendar scheduling fields for the Meetings creation form.
const [addMeetingToCalendar, setAddMeetingToCalendar] = useState(false);
const [meetingStart, setMeetingStart] = useState(() => localDateTimeAfter(60));
const [meetingEnd, setMeetingEnd] = useState(() => localDateTimeAfter(90));
const [meetingDescription, setMeetingDescription] = useState("");
const [meetingLocation, setMeetingLocation] = useState("");
const [selectedMeetingId, setSelectedMeetingId] = useState("");
const [meetingFiles, setMeetingFiles] = useState([]);
const [isLoadingMeetingFiles, setIsLoadingMeetingFiles] = useState(false);
const [meetingFilesError, setMeetingFilesError] = useState("");
const [isProcessingMeeting, setIsProcessingMeeting] = useState(false);
const [meetingProcessingError, setMeetingProcessingError] = useState("");
const [meetingProcessingMessage, setMeetingProcessingMessage] = useState("");
const [meetingAnalysis, setMeetingAnalysis] = useState(null);
const [meetingTranscriptPreview, setMeetingTranscriptPreview] = useState("");
// External integrations
const [integrationStatus, setIntegrationStatus] = useState(null);
const [isLoadingIntegrations, setIsLoadingIntegrations] = useState(false);
const [integrationError, setIntegrationError] = useState("");
const [integrationNotice, setIntegrationNotice] = useState("");
const [isTestingTelegram, setIsTestingTelegram] = useState(false);
const [isConnectingCalendar, setIsConnectingCalendar] = useState(false);
const [calendarStart, setCalendarStart] = useState(() => localDateTimeAfter(60));
const [calendarEnd, setCalendarEnd] = useState(() => localDateTimeAfter(90));
const [calendarDescription, setCalendarDescription] = useState("");
const [calendarLocation, setCalendarLocation] = useState("");
const [isCreatingCalendarEvent, setIsCreatingCalendarEvent] = useState(false);
const [calendarEventLink, setCalendarEventLink] = useState("");
// Team directory and employee profile management.
const [teamMembers, setTeamMembers] = useState([]);
const [teamDivisions, setTeamDivisions] = useState([]);
const [isLoadingTeam, setIsLoadingTeam] = useState(false);
const [teamError, setTeamError] = useState("");
const [teamNotice, setTeamNotice] = useState("");
const [teamSearch, setTeamSearch] = useState("");
const [teamStatusFilter, setTeamStatusFilter] = useState("all");
const [editingEmployee, setEditingEmployee] = useState(null);
const [isSavingEmployee, setIsSavingEmployee] = useState(false);
const [employeeForm, setEmployeeForm] = useState({
  name: "",
  role: "",
  division_id: "",
  job_description: "",
  specialization: "",
  skills: "",
  current_open_tasks: "0",
  max_concurrent_tasks: "5",
  availability_status: "available",
});
const [refreshingTaskId, setRefreshingTaskId] = useState("");

useEffect(() => {
  const handleGlobalShortcut = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      setIsCommandOpen((open) => !open);
      setCommandQuery("");
      setCommandActiveIndex(0);
    }
    if (event.key === "Escape") {
      setIsCommandOpen(false);
      setCommandQuery("");
      setCommandActiveIndex(0);
    }
  };
  window.addEventListener("keydown", handleGlobalShortcut);
  return () => window.removeEventListener("keydown", handleGlobalShortcut);
}, []);

useEffect(() => {
  let active = true;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 5000);

  fetch(`${API_BASE_URL}/health`, { signal: controller.signal })
    .then((response) => {
      if (!response.ok) throw new Error(`Health check returned HTTP ${response.status}`);
      if (active) setBackendHealth("online");
    })
    .catch(() => {
      if (active) setBackendHealth("offline");
    })
    .finally(() => window.clearTimeout(timeoutId));

  return () => {
    active = false;
    controller.abort();
    window.clearTimeout(timeoutId);
  };
}, []);

const mediaRecorderRef = useRef(null);
const mediaStreamRef = useRef(null);
const recordingChunksRef = useRef([]);
const recordingTimerRef = useRef(null);
const recordingUrlRef = useRef("");

useEffect(() => {
  let cancelled = false;

  async function loadTasks() {
    try {
      setIsLoading(true);
      setLoadError("");

      const response = await fetch(
        `${API_BASE_URL}/api/action-items`
      );

      if (!response.ok) {
        throw new Error(`Backend returned HTTP ${response.status}`);
      }

      const result = await response.json();
      const items = Array.isArray(result.data) ? result.data : [];

      if (!cancelled) {
        setTasks(items.map(normalizeTask));
      }
    } catch (error) {
      if (!cancelled) {
        setLoadError(
          error instanceof Error
            ? error.message
            : "Could not load tasks from ACTA."
        );
      }
    } finally {
      if (!cancelled) {
        setIsLoading(false);
      }
    }
  }

  loadTasks();

  return () => {
    cancelled = true;
  };
}, []);

useEffect(() => {
  if (activeNav === "Meetings" || activeNav === "Integrations") {
    refreshMeetings(selectedMeetingId);
  }
}, [activeNav]);

useEffect(() => {
  if (activeNav === "Integrations") {
    loadIntegrationStatus();
  }
}, [activeNav]);

useEffect(() => {
  if (activeNav === "Team") {
    loadTeamData();
  }
}, [activeNav]);

useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get("integration") === "google_calendar_connected") {
    setActiveNav("Integrations");
    setIntegrationNotice("Google Calendar berhasil dihubungkan.");
    window.history.replaceState({}, document.title, window.location.pathname);
  } else if (params.has("integration_error")) {
    setActiveNav("Integrations");
    const reason = params.get("integration_error");
    setIntegrationNotice(`Google Calendar belum berhasil terhubung (${reason}). Periksa konfigurasi OAuth lalu coba lagi.`);
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}, []);

useEffect(() => {
  if (activeNav === "Meetings" && selectedMeetingId) {
    refreshMeetingFiles(selectedMeetingId);
  } else if (!selectedMeetingId) {
    setMeetingFiles([]);
  }
}, [activeNav, selectedMeetingId]);

useEffect(() => {
  return () => {
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
    }

    const recorder = mediaRecorderRef.current;

    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.ondataavailable = null;

      try {
        recorder.stop();
      } catch {
        // Recorder may already have stopped.
      }
    }

    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());

    if (recordingUrlRef.current) {
      URL.revokeObjectURL(recordingUrlRef.current);
    }
  };
}, []);

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch = `${task.title} ${task.owner} ${task.project}`
      .toLowerCase().includes(search.toLowerCase());
    const matchesStatus = taskStatusFilter === "all" || task.rawStatus === taskStatusFilter;
    return matchesSearch && matchesStatus;
  });

  
const inProgressCount = tasks.filter(
  (task) => task.rawStatus === "in_progress"
).length;

const pendingReviewCount = tasks.filter(
  (task) => task.rawStatus === "pending_review"
).length;

const completedCount = tasks.filter(
  (task) => task.rawStatus === "done"
).length;

const currentHour = new Date().getHours();
const greeting = currentHour < 12 ? "Good morning" : currentHour < 18 ? "Good afternoon" : "Good evening";

const selectedMeeting = meetings.find(
  (meeting) => meeting.id === selectedMeetingId
) || null;

const filteredTeamMembers = teamMembers.filter((member) => {
  const haystack = `${member.name || ""} ${member.role || ""} ${member.division_name || ""} ${member.job_description || ""}`.toLowerCase();
  const matchesSearch = haystack.includes(teamSearch.toLowerCase());
  const status = String(member.availability_status || "").toLowerCase();
  const matchesStatus = teamStatusFilter === "all" || status === teamStatusFilter;
  return matchesSearch && matchesStatus;
});

const commandItems = [
  { label: "Overview", detail: "Workspace pulse and recent activity", icon: "▦", keywords: "home dashboard summary" },
  { label: "Tasks", detail: "Review owners, approve and track work", icon: "✓", keywords: "action items approvals work" },
  { label: "AI Assistant", detail: "Turn meeting conversations into action", icon: "✳", keywords: "transcribe analyze extract ai" },
  { label: "Meetings", detail: "Record, upload and process meeting files", icon: "▣", keywords: "record audio video upload" },
  { label: "Team", detail: "Manage people, capacity and skills", icon: "♧", keywords: "employees members workload" },
  { label: "Integrations", detail: "Connect Telegram and Google Calendar", icon: "↗", keywords: "telegram calendar connect" },
];
const filteredCommandItems = commandItems.filter((item) =>
  `${item.label} ${item.detail} ${item.keywords}`.toLowerCase().includes(commandQuery.toLowerCase().trim())
);

useEffect(() => {
  if (!isCommandOpen) return undefined;
  const handleCommandKeys = (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCommandActiveIndex((index) => filteredCommandItems.length ? (index + 1) % filteredCommandItems.length : 0);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCommandActiveIndex((index) => filteredCommandItems.length ? (index - 1 + filteredCommandItems.length) % filteredCommandItems.length : 0);
    } else if (event.key === "Enter" && filteredCommandItems[commandActiveIndex]) {
      event.preventDefault();
      goToPage(filteredCommandItems[commandActiveIndex].label);
    }
  };
  window.addEventListener("keydown", handleCommandKeys);
  return () => window.removeEventListener("keydown", handleCommandKeys);
}, [isCommandOpen, commandQuery, filteredCommandItems.length, commandActiveIndex]);

function goToPage(label) {
  setActiveNav(label);
  setIsCommandOpen(false);
  setCommandQuery("");
  setCommandActiveIndex(0);
}

async function refreshMeetings(preferredMeetingId = "") {
  try {
    setIsLoadingMeetings(true);
    setMeetingListError("");

    const response = await fetch(`${API_BASE_URL}/api/meetings`);
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        typeof result.detail === "string"
          ? result.detail
          : `Could not load meetings (HTTP ${response.status}).`
      );
    }

    const rows = Array.isArray(result)
      ? result
      : Array.isArray(result.data)
        ? result.data
        : Array.isArray(result.meetings)
          ? result.meetings
          : [];

    setMeetings(rows);
    setSelectedMeetingId((currentId) => {
      const desiredId = preferredMeetingId || currentId;
      if (desiredId && rows.some((meeting) => meeting.id === desiredId)) {
        return desiredId;
      }
      return rows[0]?.id || "";
    });
  } catch (error) {
    console.error("Load meetings error:", error);
    setMeetingListError(
      error instanceof Error ? error.message : "Could not load meetings."
    );
  } finally {
    setIsLoadingMeetings(false);
  }
}

async function refreshMeetingFiles(meetingId) {
  if (!meetingId) {
    setMeetingFiles([]);
    return;
  }

  try {
    setIsLoadingMeetingFiles(true);
    setMeetingFilesError("");

    const response = await fetch(
      `${API_BASE_URL}/api/meetings/${encodeURIComponent(meetingId)}/files`
    );
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        typeof result.detail === "string"
          ? result.detail
          : `Could not load meeting files (HTTP ${response.status}).`
      );
    }

    const rows = Array.isArray(result)
      ? result
      : Array.isArray(result.data)
        ? result.data
        : Array.isArray(result.files)
          ? result.files
          : [];
    setMeetingFiles(rows);
  } catch (error) {
    console.error("Load meeting files error:", error);
    setMeetingFilesError(
      error instanceof Error ? error.message : "Could not load meeting files."
    );
    setMeetingFiles([]);
  } finally {
    setIsLoadingMeetingFiles(false);
  }
}

async function processSelectedMeeting() {
  if (!selectedMeetingId) {
    setMeetingProcessingError("Pilih meeting terlebih dahulu.");
    return;
  }
  if (!meetingFiles.length) {
    setMeetingProcessingError("Upload setidaknya satu file ke meeting ini terlebih dahulu.");
    return;
  }
  if (isProcessingMeeting) return;

  try {
    setIsProcessingMeeting(true);
    setMeetingProcessingError("");
    setMeetingProcessingMessage("Mengekstrak teks dari file meeting...");
    setMeetingAnalysis(null);
    setMeetingTranscriptPreview("");

    const extractionResponse = await fetch(
      `${API_BASE_URL}/api/meetings/${encodeURIComponent(selectedMeetingId)}/extract-text`,
      { method: "POST" }
    );
    const extractionResult = await extractionResponse.json().catch(() => ({}));
    if (!extractionResponse.ok) {
      throw new Error(
        typeof extractionResult.detail === "string"
          ? extractionResult.detail
          : JSON.stringify(extractionResult.detail || `Text extraction failed (HTTP ${extractionResponse.status}).`)
      );
    }

    const extractedTranscript = String(extractionResult.transcript_text || "").trim();
    if (extractedTranscript.length < 20) {
      throw new Error("ACTA belum menemukan teks yang cukup untuk dianalisis.");
    }
    setMeetingTranscriptPreview(extractedTranscript);
    setMeetingProcessingMessage(
      `Teks berhasil diambil dari ${extractionResult.files_processed || 0} file. ACTA sedang menganalisis meeting...`
    );

    const agentResponse = await fetch(`${API_BASE_URL}/api/agent/coordinate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company_id: selectedMeeting?.company_id || "nova",
        project_id: null,
        transcript: extractedTranscript,
      }),
    });
    const agentResult = await agentResponse.json().catch(() => ({}));
    if (!agentResponse.ok) {
      throw new Error(
        typeof agentResult.detail === "string"
          ? agentResult.detail
          : JSON.stringify(agentResult.detail || `ACTA analysis failed (HTTP ${agentResponse.status}).`)
      );
    }
    if (!agentResult.saved || !agentResult.work_package) {
      throw new Error(
        agentResult.assistant_message ||
        "AI belum berhasil menyimpan work package. Periksa model OpenRouter dan coba lagi."
      );
    }

    const workPackage = agentResult.work_package;
    const summaryParts = [`Summary\n${workPackage.summary || "No summary returned."}`];
    if (Array.isArray(workPackage.decisions) && workPackage.decisions.length) {
      summaryParts.push(`Decisions\n${workPackage.decisions.map((item) => `• ${item}`).join("\n")}`);
    }
    if (Array.isArray(workPackage.next_steps) && workPackage.next_steps.length) {
      summaryParts.push(`Next steps\n${workPackage.next_steps.map((item) => `• ${item}`).join("\n")}`);
    }
    if (Array.isArray(workPackage.risks) && workPackage.risks.length) {
      summaryParts.push(`Risks\n${workPackage.risks.map((item) => `• ${item}`).join("\n")}`);
    }
    if (Array.isArray(workPackage.open_questions) && workPackage.open_questions.length) {
      summaryParts.push(`Open questions\n${workPackage.open_questions.map((item) => `• ${item}`).join("\n")}`);
    }
    const savedSummary = summaryParts.join("\n\n").slice(0, 12000);

    const saveResponse = await fetch(
      `${API_BASE_URL}/api/meetings/${encodeURIComponent(selectedMeetingId)}/analysis`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript_text: extractedTranscript,
          summary: savedSummary,
          status: "ready",
        }),
      }
    );
    const saveResult = await saveResponse.json().catch(() => ({}));
    if (!saveResponse.ok) {
      throw new Error(
        typeof saveResult.detail === "string"
          ? saveResult.detail
          : JSON.stringify(saveResult.detail || `Could not save meeting analysis (HTTP ${saveResponse.status}).`)
      );
    }

    setMeetingAnalysis({
      ...workPackage,
      processedFiles: extractionResult.processed_files || [],
      skippedFiles: extractionResult.skipped_files || [],
      truncated: Boolean(extractionResult.truncated),
      transcript_text: extractedTranscript,
    });
    setMeetingProcessingMessage(
      `Selesai. ${workPackage.task_count || 0} action item disimpan untuk ditinjau. Ringkasan meeting juga tersimpan.`
    );

    await refreshMeetings(selectedMeetingId);
    await refreshMeetingFiles(selectedMeetingId);
    try {
      const taskResponse = await fetch(`${API_BASE_URL}/api/action-items`);
      if (taskResponse.ok) {
        const taskResult = await taskResponse.json();
        setTasks((Array.isArray(taskResult.data) ? taskResult.data : []).map(normalizeTask));
      }
    } catch (refreshError) {
      console.warn("Could not refresh the task list after meeting analysis:", refreshError);
    }
  } catch (error) {
    console.error("Meeting processing error:", error);
    setMeetingProcessingError(
      error instanceof Error ? error.message : "ACTA could not process this meeting."
    );
    setMeetingProcessingMessage("");
  } finally {
    setIsProcessingMeeting(false);
  }
}

async function createMeeting(event) {
  event.preventDefault();
  const title = meetingTitle.trim();
  if (!title) {
    setMeetingCreateError("Masukkan judul meeting terlebih dahulu.");
    return;
  }

  try {
    setIsCreatingMeeting(true);
    setMeetingCreateError("");
    setMeetingCreateResult("");

    if (addMeetingToCalendar && (!meetingStart || !meetingEnd || new Date(meetingEnd) <= new Date(meetingStart))) {
      throw new Error("Waktu selesai harus setelah waktu mulai.");
    }

    // datetime-local values are local browser time. ACTA's workspace uses Asia/Jakarta.
    const toJakartaIso = (value) => value ? `${value}:00+07:00` : null;
    const response = await fetch(`${API_BASE_URL}/api/meetings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        company_id: "nova",
        source_type: "external_upload",
        meeting_date: addMeetingToCalendar ? toJakartaIso(meetingStart) : undefined,
      }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        typeof result.detail === "string"
          ? result.detail
          : `Could not create meeting (HTTP ${response.status}).`
      );
    }

    const createdMeeting = result.data || result.meeting || result;
    if (!createdMeeting.id) {
      throw new Error("Meeting was created, but the response did not include its ID.");
    }

    setMeetingTitle("");
    setSelectedMeetingId(createdMeeting.id);

    let successMessage = `Meeting “${createdMeeting.title || title}” berhasil dibuat.`;
    if (addMeetingToCalendar) {
      try {
        const calendarResponse = await fetch(`${API_BASE_URL}/api/integrations/google-calendar/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            meeting_id: createdMeeting.id,
            start_time: toJakartaIso(meetingStart),
            end_time: toJakartaIso(meetingEnd),
            timezone: "Asia/Jakarta",
            description: meetingDescription,
            location: meetingLocation,
          }),
        });
        const calendarResult = await calendarResponse.json().catch(() => ({}));
        if (!calendarResponse.ok) {
          throw new Error(typeof calendarResult.detail === "string" ? calendarResult.detail : `Google Calendar gagal (HTTP ${calendarResponse.status}).`);
        }
        successMessage += " Event juga berhasil ditambahkan ke Google Calendar.";
        if (calendarResult.data?.htmlLink) {
          setCalendarEventLink(calendarResult.data.htmlLink);
        }
      } catch (calendarError) {
        successMessage += ` Meeting tersimpan, tetapi sinkronisasi Calendar gagal: ${calendarError instanceof Error ? calendarError.message : "coba lagi dari Integrations."}`;
      }
    }
    setMeetingCreateResult(successMessage);
    await refreshMeetings(createdMeeting.id);
    await refreshMeetingFiles(createdMeeting.id);
  } catch (error) {
    console.error("Create meeting error:", error);
    setMeetingCreateError(
      error instanceof Error ? error.message : "Could not create meeting."
    );
  } finally {
    setIsCreatingMeeting(false);
  }
}

async function handleExtractAndSave(event) {
  event.preventDefault();

  if (transcript.trim().length < 20) {
    setSubmitError("Please enter at least 20 characters.");
    return;
  }

  try {
    setIsSubmitting(true);
    setSubmitError("");

    const response = await fetch(
      `${API_BASE_URL}/api/action-items/extract-and-save`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          company_id: "nova",
          transcript: transcript.trim(),
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        typeof result.detail === "string"
          ? result.detail
          : JSON.stringify(result.detail || "Failed to process transcript.")
      );
    }

    if (result.count === 0) {
      alert(result.message || "No actionable tasks were found.");
      return;
    }

    alert(
      `${result.count} task(s) extracted and saved for review!`
    );

    window.location.reload();
  } catch (error) {
    console.error("AI extraction error:", error);
    setSubmitError(
      error instanceof Error
        ? error.message
        : "Could not connect to ACTA backend."
    );
  } finally {
    setIsSubmitting(false);
  }
}

async function approveTask(task) {
  const select = document.getElementById(
    `owner-select-${task.id}`
  );
  const selectedOwnerId = select?.value;

  if (!selectedOwnerId) {
    alert("Please select an owner first.");
    return;
  }

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/action-items/${task.id}/approve`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          selected_owner_id: selectedOwnerId,
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        typeof result.detail === "string"
          ? result.detail
          : JSON.stringify(result.detail || "Approval failed.")
      );
    }

    alert("Task approved successfully!");
    window.location.reload();
  } catch (error) {
    console.error("Approve error:", error);
    alert(error.message || "Could not connect to backend.");
  }
}

async function updateTaskStatus(task, status) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/action-items/${task.id}/status`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        typeof result.detail === "string"
          ? result.detail
          : JSON.stringify(result.detail || "Status update failed.")
      );
    }

    alert("Task status updated successfully!");
    window.location.reload();
  } catch (error) {
    console.error("Status update error:", error);
    alert(error.message || "Could not connect to backend.");
  }
}

async function startMeetingRecording() {
  setRecordingError("");

  if (
    !navigator.mediaDevices?.getUserMedia ||
    typeof window.MediaRecorder !== "function"
  ) {
    setRecordingError(
      "Browser ini tidak mendukung perekaman audio. Coba Chrome atau Edge versi terbaru."
    );
    return;
  }

  if (recordingTimerRef.current) {
    window.clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = null;
  }

  if (recordingUrlRef.current) {
    URL.revokeObjectURL(recordingUrlRef.current);
    recordingUrlRef.current = "";
  }

setRecordingUrl("");
setRecordingFileName("");
setRecordingSeconds(0);
setRecordingBlob(null);
setRecordingUploadResult("");
setRecordingUploadError("");
setRecordingStatus("processing");

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });

    mediaStreamRef.current = stream;

    const supportedTypes = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
    ];

    const mimeType = supportedTypes.find((type) =>
      window.MediaRecorder.isTypeSupported(type)
    );

    const recorder = mimeType
      ? new window.MediaRecorder(stream, { mimeType })
      : new window.MediaRecorder(stream);

    mediaRecorderRef.current = recorder;
    recordingChunksRef.current = [];

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordingChunksRef.current.push(event.data);
      }
    };

    recorder.onerror = (event) => {
      setRecordingError(
        event.error?.message || "Terjadi masalah saat merekam audio."
      );
    };

    recorder.onstop = () => {
      if (recordingTimerRef.current) {
        window.clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }

      const finalMimeType = recorder.mimeType || "audio/webm";
      const blob = new Blob(recordingChunksRef.current, {
        type: finalMimeType,
      });

      stream.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      mediaRecorderRef.current = null;

      if (blob.size === 0) {
        setRecordingStatus("idle");
        setRecordingError(
          "File rekaman kosong. Pastikan mikrofon berfungsi, lalu coba lagi."
        );
        return;
      }

      const extension = finalMimeType.includes("mp4")
        ? "m4a"
        : finalMimeType.includes("ogg")
          ? "ogg"
          : "webm";

      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-");

      const fileName = `ACTA-meeting-${timestamp}.${extension}`;
      const url = URL.createObjectURL(blob);

      recordingUrlRef.current = url;
setRecordingUrl(url);
setRecordingFileName(fileName);
setRecordingBlob(blob);

setRecordingUploadResult("");
setRecordingUploadError("");
setRecordingStatus("ready");
    };

    recorder.start(1000);

    setRecordingStatus("recording");
    recordingTimerRef.current = window.setInterval(() => {
      setRecordingSeconds((seconds) => seconds + 1);
    }, 1000);
  } catch (error) {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    mediaRecorderRef.current = null;
    setRecordingStatus("idle");

    if (
      error.name === "NotAllowedError" ||
      error.name === "PermissionDeniedError"
    ) {
      setRecordingError(
        "Akses mikrofon ditolak. Izinkan penggunaan mikrofon untuk localhost, lalu coba lagi."
      );
    } else if (error.name === "NotFoundError") {
      setRecordingError(
        "Mikrofon tidak ditemukan. Sambungkan atau aktifkan mikrofon terlebih dahulu."
      );
    } else {
      setRecordingError(
        error instanceof Error
          ? error.message
          : "Tidak dapat memulai rekaman."
      );
    }
  }
}

function stopMeetingRecording() {
  const recorder = mediaRecorderRef.current;

  if (!recorder || recorder.state === "inactive") {
    return;
  }

  if (recordingTimerRef.current) {
    window.clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = null;
  }

  setRecordingStatus("processing");
  recorder.stop();
}

async function uploadMeetingRecording() {
  if (!recordingBlob) {
    setRecordingUploadError(
      "No recording is available. Record audio first."
    );
    return;
  }

  if (isUploadingRecording) {
    return;
  }

  try {
    setIsUploadingRecording(true);
    setRecordingUploadError("");
    setRecordingUploadResult("");

    const formData = new FormData();

    const audioFile = new File(
      [recordingBlob],
      recordingFileName || `ACTA-meeting-${Date.now()}.webm`,
      {
        type: recordingBlob.type || "audio/webm",
      }
    );

    if (!selectedMeetingId) {
      throw new Error("Buat atau pilih meeting terlebih dahulu sebelum upload rekaman.");
    }

    formData.append("file", audioFile);
    formData.append("meeting_id", selectedMeetingId);
    formData.append("source_type", "browser_recording");

    const response = await fetch(
      `${API_BASE_URL}/api/meeting-files/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        typeof result.detail === "string"
          ? result.detail
          : `Upload failed (HTTP ${response.status}).`
      );
    }

    const uploadedName =
      result.original_file_name || result.file_name || audioFile.name;
    setRecordingUploadResult(`${uploadedName} uploaded to the selected meeting.`);
    await refreshMeetingFiles(selectedMeetingId);
    await refreshMeetings(selectedMeetingId);
  } catch (error) {
    console.error("Meeting recording upload error:", error);

    setRecordingUploadError(
      error instanceof Error
        ? error.message
        : "Could not upload the recording to ACTA."
    );
  } finally {
    setIsUploadingRecording(false);
  }
}

function addMeetingFiles(fileList) {
  const incomingFiles = Array.from(fileList || []);
  if (!incomingFiles.length) return;

  setSelectedMeetingFiles((currentFiles) => {
    const knownFiles = new Set(
      currentFiles.map((file) => `${file.name}:${file.size}:${file.lastModified}`)
    );
    const additions = incomingFiles.filter((file) => {
      const key = `${file.name}:${file.size}:${file.lastModified}`;
      if (knownFiles.has(key)) return false;
      knownFiles.add(key);
      return true;
    });
    return [...currentFiles, ...additions];
  });
  setMeetingFileUploadResult("");
  setMeetingFileUploadError("");
}

async function uploadExternalMeetingFile() {
  if (!selectedMeetingFiles.length) {
    setMeetingFileUploadError("Please choose one or more files first.");
    return;
  }

  if (isUploadingMeetingFile) return;

  const allowedExtensions = [
    "webm", "wav", "mp3", "m4a", "ogg", "mp4", "mov",
    "pdf", "ppt", "pptx", "docx", "txt",
  ];
  const maxSizeBytes = 20 * 1024 * 1024;

  const invalidFiles = selectedMeetingFiles.filter((file) => {
    const extension = file.name.split(".").pop().toLowerCase();
    return !allowedExtensions.includes(extension) || file.size > maxSizeBytes;
  });

  if (invalidFiles.length) {
    setMeetingFileUploadError(
      invalidFiles.map((file) => {
        const extension = file.name.split(".").pop().toLowerCase();
        return !allowedExtensions.includes(extension)
          ? `${file.name}: unsupported file type.`
          : `${file.name}: exceeds the 20 MB limit.`;
      }).join(" ") + " Supported types: audio, video, PDF, PowerPoint, DOCX, or TXT."
    );
    return;
  }

  if (!selectedMeetingId) {
    setMeetingFileUploadError("Buat atau pilih meeting terlebih dahulu sebelum upload file.");
    return;
  }

  try {
    setIsUploadingMeetingFile(true);
    setMeetingFileUploadError("");
    setMeetingFileUploadResult("");

    const uploadedNames = [];
    const failedFiles = [];

    // Upload sequentially so each file gets its own metadata row and errors are easier to identify.
    for (const file of selectedMeetingFiles) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("meeting_id", selectedMeetingId);
      formData.append("source_type", "external_upload");

      try {
        const response = await fetch(`${API_BASE_URL}/api/meeting-files/upload`, {
          method: "POST",
          body: formData,
        });
        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(typeof result.detail === "string"
            ? result.detail
            : `Upload failed (HTTP ${response.status}).`);
        }
        uploadedNames.push(result.original_file_name || result.file_name || file.name);
      } catch (error) {
        failedFiles.push(`${file.name}: ${error instanceof Error ? error.message : "upload failed"}`);
      }
    }

    if (uploadedNames.length) {
      setMeetingFileUploadResult(
        `${uploadedNames.length} file(s) uploaded: ${uploadedNames.join(", ")}`
      );
      await refreshMeetingFiles(selectedMeetingId);
      await refreshMeetings(selectedMeetingId);
      const remainingFiles = failedFiles.length ? selectedMeetingFiles.filter((file) =>
        failedFiles.some((message) => message.startsWith(`${file.name}:`))
      ) : [];
      setSelectedMeetingFiles(remainingFiles);
      if (!remainingFiles.length) {
        const fileInput = document.getElementById("meeting-file-input");
        if (fileInput) fileInput.value = "";
      }
    }

    if (failedFiles.length) {
      setMeetingFileUploadError(`Some files could not be uploaded: ${failedFiles.join(" | ")}`);
    } else if (!uploadedNames.length) {
      setMeetingFileUploadError("No files were uploaded. Please try again.");
    }
  } catch (error) {
    console.error("External meeting file upload error:", error);
    setMeetingFileUploadError(error instanceof Error ? error.message : "Could not upload the meeting files.");
  } finally {
    setIsUploadingMeetingFile(false);
  }
}

async function loadIntegrationStatus() {
  try {
    setIsLoadingIntegrations(true);
    setIntegrationError("");
    const response = await fetch(`${API_BASE_URL}/api/integrations/status`);
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(typeof result.detail === "string" ? result.detail : `Could not load integrations (HTTP ${response.status}).`);
    }
    setIntegrationStatus(result);
  } catch (error) {
    setIntegrationError(error instanceof Error ? error.message : "Could not load integration status.");
  } finally {
    setIsLoadingIntegrations(false);
  }
}

async function testTelegramIntegration() {
  try {
    setIsTestingTelegram(true);
    setIntegrationError("");
    setIntegrationNotice("");
    const response = await fetch(`${API_BASE_URL}/api/integrations/telegram/test`, { method: "POST" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(typeof result.detail === "string" ? result.detail : `Telegram test failed (HTTP ${response.status}).`);
    }
    setIntegrationNotice(result.message || "Telegram test message sent.");
    await loadIntegrationStatus();
  } catch (error) {
    setIntegrationError(error instanceof Error ? error.message : "Telegram test failed.");
  } finally {
    setIsTestingTelegram(false);
  }
}

async function connectGoogleCalendar() {
  try {
    setIsConnectingCalendar(true);
    setIntegrationError("");
    setIntegrationNotice("");
    const response = await fetch(`${API_BASE_URL}/api/integrations/google-calendar/auth-url`);
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.auth_url) {
      throw new Error(typeof result.detail === "string" ? result.detail : `Could not start Google Calendar authorization (HTTP ${response.status}).`);
    }
    window.location.assign(result.auth_url);
  } catch (error) {
    setIntegrationError(error instanceof Error ? error.message : "Could not connect Google Calendar.");
    setIsConnectingCalendar(false);
  }
}

async function createGoogleCalendarEvent(event) {
  event.preventDefault();
  if (!selectedMeetingId) {
    setIntegrationError("Pilih meeting ACTA yang akan dijadwalkan terlebih dahulu.");
    return;
  }
  if (!calendarStart || !calendarEnd || new Date(calendarEnd) <= new Date(calendarStart)) {
    setIntegrationError("Waktu selesai harus setelah waktu mulai.");
    return;
  }

  try {
    setIsCreatingCalendarEvent(true);
    setIntegrationError("");
    setIntegrationNotice("");
    setCalendarEventLink("");
    const response = await fetch(`${API_BASE_URL}/api/integrations/google-calendar/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        meeting_id: selectedMeetingId,
        start_time: calendarStart,
        end_time: calendarEnd,
        timezone: "Asia/Jakarta",
        description: calendarDescription,
        location: calendarLocation,
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(typeof result.detail === "string" ? result.detail : `Calendar event creation failed (HTTP ${response.status}).`);
    }
    setIntegrationNotice(result.message || "Google Calendar event saved.");
    setCalendarEventLink(result.data?.htmlLink || "");
    await loadIntegrationStatus();
  } catch (error) {
    setIntegrationError(error instanceof Error ? error.message : "Could not create the Google Calendar event.");
  } finally {
    setIsCreatingCalendarEvent(false);
  }
}

async function loadTeamData() {
  try {
    setIsLoadingTeam(true);
    setTeamError("");
    const [employeeResponse, divisionResponse] = await Promise.all([
      fetch(`${API_BASE_URL}/api/employees`),
      fetch(`${API_BASE_URL}/api/divisions`),
    ]);
    const [employeeResult, divisionResult] = await Promise.all([
      employeeResponse.json().catch(() => ({})),
      divisionResponse.json().catch(() => ({})),
    ]);
    if (!employeeResponse.ok) {
      throw new Error(typeof employeeResult.detail === "string" ? employeeResult.detail : `Could not load employees (HTTP ${employeeResponse.status}).`);
    }
    if (!divisionResponse.ok) {
      throw new Error(typeof divisionResult.detail === "string" ? divisionResult.detail : `Could not load divisions (HTTP ${divisionResponse.status}).`);
    }
    const members = Array.isArray(employeeResult.data) ? employeeResult.data : [];
    const divisions = Array.isArray(divisionResult.data) ? divisionResult.data : [];
    const divisionMap = new Map(divisions.map((division) => [division.id, division.name]));
    setTeamDivisions(divisions);
    setTeamMembers(members.map((member) => ({
      ...member,
      division_name: divisionMap.get(member.division_id) || member.division_id || "Unassigned",
    })));
    setEmployeeForm((current) => ({
      ...current,
      division_id: current.division_id || divisions[0]?.id || "",
    }));
  } catch (error) {
    setTeamError(error instanceof Error ? error.message : "Could not load Team directory.");
    setTeamMembers([]);
  } finally {
    setIsLoadingTeam(false);
  }
}

function openEmployeeEditor(member = null) {
  setTeamError("");
  setTeamNotice("");
  setEditingEmployee(member ? member.id : "new");
  setEmployeeForm({
    name: member?.name || "",
    role: member?.role || "",
    division_id: member?.division_id || teamDivisions[0]?.id || "",
    job_description: member?.job_description || "",
    specialization: Array.isArray(member?.specialization) ? member.specialization.join(", ") : "",
    skills: Array.isArray(member?.skills) ? member.skills.join(", ") : "",
    current_open_tasks: String(member?.current_open_tasks ?? 0),
    max_concurrent_tasks: String(member?.max_concurrent_tasks ?? 5),
    availability_status: member?.availability_status || "available",
  });
}

async function saveEmployee(event) {
  event.preventDefault();
  const isNew = editingEmployee === "new";
  const splitTerms = (value) => value.split(",").map((item) => item.trim()).filter(Boolean);
  const payload = {
    name: employeeForm.name.trim(),
    role: employeeForm.role.trim(),
    division_id: employeeForm.division_id,
    job_description: employeeForm.job_description.trim(),
    specialization: splitTerms(employeeForm.specialization),
    skills: splitTerms(employeeForm.skills),
    current_open_tasks: Number(employeeForm.current_open_tasks),
    max_concurrent_tasks: Number(employeeForm.max_concurrent_tasks),
    availability_status: employeeForm.availability_status,
  };
  if (!payload.name || !payload.role || !payload.division_id) {
    setTeamError("Name, role, and division are required.");
    return;
  }
  if (!Number.isInteger(payload.current_open_tasks) || payload.current_open_tasks < 0 || !Number.isInteger(payload.max_concurrent_tasks) || payload.max_concurrent_tasks < 1) {
    setTeamError("Workload must use whole numbers; maximum tasks must be at least 1.");
    return;
  }
  try {
    setIsSavingEmployee(true);
    setTeamError("");
    setTeamNotice("");
    const response = await fetch(
      isNew ? `${API_BASE_URL}/api/employees` : `${API_BASE_URL}/api/employees/${encodeURIComponent(editingEmployee)}`,
      {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(typeof result.detail === "string" ? result.detail : `Could not save employee (HTTP ${response.status}).`);
    }
    setEditingEmployee(null);
    setTeamNotice(result.message || "Team member saved.");
    await loadTeamData();
  } catch (error) {
    setTeamError(error instanceof Error ? error.message : "Could not save employee.");
  } finally {
    setIsSavingEmployee(false);
  }
}

async function refreshTaskRecommendations(task) {
  try {
    setRefreshingTaskId(task.id);
    const response = await fetch(`${API_BASE_URL}/api/action-items/${encodeURIComponent(task.id)}/refresh-recommendations`, { method: "POST" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(typeof result.detail === "string" ? result.detail : `Could not refresh owner suggestions (HTTP ${response.status}).`);
    }
    const tasksResponse = await fetch(`${API_BASE_URL}/api/action-items`);
    const tasksResult = await tasksResponse.json().catch(() => ({}));
    if (!tasksResponse.ok) {
      throw new Error(typeof tasksResult.detail === "string" ? tasksResult.detail : "Suggestions refreshed, but task list could not be reloaded.");
    }
    setTasks((Array.isArray(tasksResult.data) ? tasksResult.data : []).map(normalizeTask));
  } catch (error) {
    alert(error instanceof Error ? error.message : "Could not refresh owner suggestions.");
  } finally {
    setRefreshingTaskId("");
  }
}

  return (
    <div className="app-shell" data-page={activeNav.toLowerCase().replaceAll(" ", "-")}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">A</div>
          <div>
            <div className="brand-name">ACTA</div>
            <div className="brand-subtitle">ACTION INTELLIGENCE</div>
          </div>
        </div>

        <div className="workspace-label">WORKSPACE</div>
        <div className="workspace">
          <div className="workspace-avatar">N</div>
          <div className="workspace-info">
            <strong>Nova Company</strong>
            <span>Team workspace</span>
          </div>
          <span className="chevron">⌄</span>
        </div>

        <div className="nav-label">MENU</div>
        <nav className="navigation">
          {navItems.map((item) => (
            <button
              key={item.label}
              className={`nav-item ${
                activeNav === item.label ? "active" : ""
              }`}
              onClick={() => goToPage(item.label)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
              {item.label === "Tasks" && pendingReviewCount > 0 && (
                <span className="nav-count">{pendingReviewCount}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon">✦</div>
            <strong>Work smarter with AI</strong>
            <p>Turn meeting conversations into clear actions.</p>
            <button onClick={() => setActiveNav("AI Assistant")}>
              Explore AI <span>→</span>
            </button>
          </div>
          <div className="profile">
            <div className="profile-avatar">AD</div>
            <div className="profile-info">
              <strong>Admin</strong>
              <span>Workspace admin</span>
            </div>
            <span className="chevron">•••</span>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span> <strong>{activeNav}</strong>
          </div>
          <div className="topbar-right">
            <button className="command-trigger" type="button" onClick={() => { setIsCommandOpen(true); setCommandQuery(""); setCommandActiveIndex(0); }} aria-label="Open quick navigation">
              <span className="command-trigger-icon">⌕</span><span>Jump to</span><kbd>Ctrl K</kbd>
            </button>
            <div className={`system-status status-${backendHealth}`} role="status" aria-live="polite">
              <span className="status-dot" />
              {backendHealth === "checking" ? "Checking API" : backendHealth === "online" ? "API online" : "API unreachable"}
            </div>
            <button
              className="icon-button notification-button"
              type="button"
              aria-label={`Review ${pendingReviewCount} pending action items`}
              title="Open review queue"
              onClick={() => { setSearch(""); setTaskStatusFilter("pending_review"); goToPage("Tasks"); }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="notification-icon" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
                <path d="M10 21h4" />
              </svg>
              {pendingReviewCount > 0 && <span className="notification-count">{pendingReviewCount > 99 ? "99+" : pendingReviewCount}</span>}
            </button>
            <div className="top-avatar">AD</div>
          </div>
        </header>

        <div className="page-content" key={activeNav}>
          <section className="welcome-row">
            
            <div>
              <div className="eyebrow">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).toUpperCase()}</div>
              <h1>
                {activeNav === "Overview"
                  ? `${greeting}, Admin`
                  : activeNav}
                <span className="wave"> ✦</span>
              </h1>
              <p className="page-description">
                {activeNav === "Overview"
                  ? "Here's what's happening across your workspace today."
                  : `Manage your workspace ${activeNav.toLowerCase()} in one place.`}
              </p>
            </div>
            <button
              className="primary-button"
              onClick={() => goToPage("Meetings")}
            >
              <span>＋</span> New meeting
            </button>
          </section>
{activeNav === "Integrations" && (
  <section className="integrations-page">
    <div className="panel integrations-intro">
      <div className="meetings-intro-icon">↗</div>
      <div>
        <span className="ai-label">CONNECTED WORKFLOW</span>
        <h2>Connect ACTA to where your team works.</h2>
        <p>Send verified task updates to Telegram and create calendar events for ACTA meetings. Credentials stay on the backend, not in the browser.</p>
      </div>
      <button className="filter-button integrations-refresh" type="button" onClick={loadIntegrationStatus} disabled={isLoadingIntegrations}>
        {isLoadingIntegrations ? "Checking..." : "↻ Refresh status"}
      </button>
    </div>

    {integrationError && <div className="meeting-feedback-error" role="alert">{integrationError}</div>}
    {integrationNotice && <div className="meeting-feedback-success" role="status">{integrationNotice}</div>}

    <div className="integrations-grid">
      <article className="panel integration-card">
        <div className="integration-card-top">
          <div className="integration-logo telegram-logo">✈</div>
          <div className="integration-card-title"><h2>Telegram</h2><p>Task status notifications</p></div>
          <span className={`integration-state ${integrationStatus?.telegram?.configured ? "is-connected" : "is-disconnected"}`}>
            {integrationStatus?.telegram?.configured ? "Configured" : "Setup required"}
          </span>
        </div>
        <p className="integration-description">ACTA can send a test message and notify the configured Telegram chat when tasks are approved, started, rejected, or completed. Notification failures will not undo saved task changes.</p>
        <div className="integration-checklist">
          <div><span className={integrationStatus?.telegram?.configured ? "check-dot complete" : "check-dot"}>{integrationStatus?.telegram?.configured ? "✓" : "·"}</span>Bot token and chat ID configured on backend</div>
          <div><span className="check-dot">✓</span>Task lifecycle notification hooks installed</div>
        </div>
        <button className="action-button integration-action" type="button" onClick={testTelegramIntegration} disabled={isTestingTelegram || !integrationStatus?.telegram?.configured}>
          {isTestingTelegram ? "Sending test..." : "Send test notification"}
        </button>
        {!integrationStatus?.telegram?.configured && <p className="integration-setup-hint">Add <code>TELEGRAM_BOT_TOKEN</code> and <code>TELEGRAM_CHAT_ID</code> to the backend <code>.env</code>, restart FastAPI, then refresh status.</p>}
      </article>

      <article className="panel integration-card">
        <div className="integration-card-top">
          <div className="integration-logo calendar-logo">▦</div>
          <div className="integration-card-title"><h2>Google Calendar</h2><p>Meeting scheduling</p></div>
          <span className={`integration-state ${integrationStatus?.google_calendar?.authorized ? "is-connected" : "is-disconnected"}`}>
            {integrationStatus?.google_calendar?.authorized ? "Connected" : "Not connected"}
          </span>
        </div>
        <p className="integration-description">Authorize a Google account once, then create or update a Calendar event for a selected ACTA meeting. Repeating the action updates the matching event instead of intentionally creating a duplicate.</p>
        <div className="integration-checklist">
          <div><span className={integrationStatus?.google_calendar?.configured ? "check-dot complete" : "check-dot"}>{integrationStatus?.google_calendar?.configured ? "✓" : "·"}</span>OAuth client credentials configured</div>
          <div><span className={integrationStatus?.google_calendar?.authorized ? "check-dot complete" : "check-dot"}>{integrationStatus?.google_calendar?.authorized ? "✓" : "·"}</span>Google account authorized</div>
        </div>
        <button className="action-button integration-action" type="button" onClick={connectGoogleCalendar} disabled={isConnectingCalendar}>
          {isConnectingCalendar ? "Opening Google..." : integrationStatus?.google_calendar?.authorized ? "Reconnect Google Calendar" : "Connect Google Calendar"}
        </button>
        {!integrationStatus?.google_calendar?.configured && <p className="integration-setup-hint">Add <code>GOOGLE_CALENDAR_CLIENT_ID</code> and <code>GOOGLE_CALENDAR_CLIENT_SECRET</code> to the backend <code>.env</code> and register the redirect URI shown in the install guide.</p>}
      </article>
    </div>

    <section className="panel calendar-event-panel">
      <div className="meeting-manager-heading">
        <div className="meeting-manager-heading-icon">▦</div>
        <div><span className="meeting-section-eyebrow">SCHEDULE A MEETING</span><h2>Create Google Calendar event</h2><p>Choose an existing ACTA meeting and set the schedule. Calendar events are tied to the ACTA meeting ID so updates can target the same event.</p></div>
      </div>
      <form className="integration-event-form" onSubmit={createGoogleCalendarEvent}>
        <div className="integration-form-field integration-field-wide">
          <label htmlFor="calendar-meeting-select">ACTA meeting</label>
          <select id="calendar-meeting-select" value={selectedMeetingId} onChange={(event) => setSelectedMeetingId(event.target.value)} required disabled={isLoadingMeetings || meetings.length === 0}>
            <option value="">{isLoadingMeetings ? "Loading meetings..." : "Select a meeting"}</option>
            {meetings.map((meeting) => <option key={meeting.id} value={meeting.id}>{meeting.title || "Untitled meeting"}</option>)}
          </select>
        </div>
        <div className="integration-form-field"><label htmlFor="calendar-start">Start time (WIB)</label><input id="calendar-start" type="datetime-local" value={calendarStart} onChange={(event) => setCalendarStart(event.target.value)} required /></div>
        <div className="integration-form-field"><label htmlFor="calendar-end">End time (WIB)</label><input id="calendar-end" type="datetime-local" value={calendarEnd} onChange={(event) => setCalendarEnd(event.target.value)} required /></div>
        <div className="integration-form-field"><label htmlFor="calendar-location">Location (optional)</label><input id="calendar-location" type="text" value={calendarLocation} onChange={(event) => setCalendarLocation(event.target.value)} maxLength={500} placeholder="Meeting room or video call link" /></div>
        <div className="integration-form-field integration-field-wide"><label htmlFor="calendar-description">Description (optional)</label><textarea id="calendar-description" value={calendarDescription} onChange={(event) => setCalendarDescription(event.target.value)} maxLength={4000} rows={3} placeholder="Agenda or short meeting notes. Do not include sensitive details unless appropriate for your calendar." /></div>
        <div className="integration-form-actions integration-field-wide">
          <button className="action-button" type="submit" disabled={isCreatingCalendarEvent || !integrationStatus?.google_calendar?.authorized || !selectedMeetingId}>
            {isCreatingCalendarEvent ? "Saving event..." : "Create / update Calendar event"}
          </button>
          {!integrationStatus?.google_calendar?.authorized && <span>Connect Google Calendar above before creating an event.</span>}
        </div>
      </form>
      {calendarEventLink && <a className="calendar-event-link" href={calendarEventLink} target="_blank" rel="noreferrer">Open event in Google Calendar ↗</a>}
    </section>
    <p className="integration-privacy-note">ACTA displays connection status only; it never sends API tokens to the frontend. Provider credentials must remain in the backend <code>.env</code> file.</p>
  </section>
)}

{activeNav === "Meetings" && (
  <section className="meetings-page">
    <div className="panel meetings-intro">
      <div className="meetings-intro-icon">▣</div>

      <div>
        <span className="ai-label">MEETING WORKSPACE</span>
        <h2>Bring every meeting into one place.</h2>
        <p>
          Record conversations, upload existing recordings,
          and add meeting documents. ACTA will help turn
          them into organized decisions and action items.
        </p>
      </div>
    </div>

    <section className="panel meeting-manager-panel">
      <div className="meeting-manager-heading">
        <div className="meeting-manager-heading-icon">＋</div>
        <div>
          <span className="meeting-section-eyebrow">MEETING DETAILS</span>
          <h2>Create or select a meeting</h2>
          <p>Create one meeting first, then upload multiple recordings and documents into the same record.</p>
        </div>
      </div>

      <form className="meeting-create-form" onSubmit={createMeeting}>
        <label className="meeting-field-label" htmlFor="meeting-title-input">New meeting title</label>
        <div className="meeting-create-controls">
          <input
            id="meeting-title-input"
            type="text"
            value={meetingTitle}
            onChange={(event) => setMeetingTitle(event.target.value)}
            placeholder="e.g. Weekly product sync"
            maxLength={160}
            required
            disabled={isCreatingMeeting}
          />
          <button className="action-button" type="submit" disabled={isCreatingMeeting}>
            {isCreatingMeeting ? "Creating..." : "＋ Create meeting"}
          </button>
        </div>

        <label className="meeting-calendar-toggle">
          <input
            type="checkbox"
            checked={addMeetingToCalendar}
            onChange={(event) => setAddMeetingToCalendar(event.target.checked)}
            disabled={isCreatingMeeting}
          />
          <span><strong>Add to Google Calendar</strong><small>Schedule this meeting and create its calendar event automatically.</small></span>
        </label>

        {addMeetingToCalendar && (
          <div className="meeting-schedule-fields">
            <div className="meeting-schedule-field">
              <label className="meeting-field-label" htmlFor="meeting-start">Start date &amp; time (WIB)</label>
              <input id="meeting-start" type="datetime-local" value={meetingStart} onChange={(event) => setMeetingStart(event.target.value)} required disabled={isCreatingMeeting} />
            </div>
            <div className="meeting-schedule-field">
              <label className="meeting-field-label" htmlFor="meeting-end">End date &amp; time (WIB)</label>
              <input id="meeting-end" type="datetime-local" value={meetingEnd} onChange={(event) => setMeetingEnd(event.target.value)} required disabled={isCreatingMeeting} />
            </div>
            <div className="meeting-schedule-field">
              <label className="meeting-field-label" htmlFor="meeting-location">Location / meeting link</label>
              <input id="meeting-location" type="text" value={meetingLocation} onChange={(event) => setMeetingLocation(event.target.value)} placeholder="e.g. Google Meet link or Meeting Room A" maxLength={500} disabled={isCreatingMeeting} />
            </div>
            <div className="meeting-schedule-field">
              <label className="meeting-field-label" htmlFor="meeting-description">Description (optional)</label>
              <input id="meeting-description" type="text" value={meetingDescription} onChange={(event) => setMeetingDescription(event.target.value)} placeholder="Agenda or meeting notes" maxLength={1000} disabled={isCreatingMeeting} />
            </div>
            <p className="meeting-timezone-note">Timezone: Asia/Jakarta (WIB). Calendar event will be created after the ACTA meeting is saved.</p>
          </div>
        )}
      </form>

      {meetingCreateError && <div className="meeting-feedback-error" role="alert">{meetingCreateError}</div>}
      {meetingCreateResult && <div className="meeting-feedback-success" role="status">{meetingCreateResult}</div>}
      {meetingListError && (
        <div className="meeting-feedback-error" role="alert">
          <span>{meetingListError}</span>
          <button className="text-button" type="button" onClick={() => refreshMeetings()}>Retry</button>
        </div>
      )}

      <div className="meeting-select-row">
        <label className="meeting-field-label" htmlFor="existing-meeting-select">Current meeting</label>
        <select
          id="existing-meeting-select"
          value={selectedMeetingId}
          onChange={(event) => {
            setSelectedMeetingId(event.target.value);
            setMeetingCreateResult("");
            setRecordingUploadResult("");
            setRecordingUploadError("");
            setMeetingFileUploadResult("");
            setMeetingFileUploadError("");
            setMeetingProcessingError("");
            setMeetingProcessingMessage("");
            setMeetingAnalysis(null);
            setMeetingTranscriptPreview("");
          }}
          disabled={isLoadingMeetings || meetings.length === 0}
        >
          <option value="">{isLoadingMeetings ? "Loading meetings..." : "Select a meeting"}</option>
          {meetings.map((meeting) => (
            <option key={meeting.id} value={meeting.id}>
              {meeting.title || "Untitled meeting"}
            </option>
          ))}
        </select>
        <button className="filter-button" type="button" onClick={() => refreshMeetings(selectedMeetingId)} disabled={isLoadingMeetings}>
          {isLoadingMeetings ? "Refreshing..." : "↻ Refresh"}
        </button>
      </div>

      {selectedMeeting && (
        <div className="selected-meeting-summary">
          <div className="selected-meeting-mark">▣</div>
          <div className="selected-meeting-copy">
            <strong>{selectedMeeting.title || "Untitled meeting"}</strong>
            <span>
              {selectedMeeting.meeting_date
                ? new Date(selectedMeeting.meeting_date).toLocaleString()
                : "Meeting date not set"}
              {selectedMeeting.status ? ` · ${String(selectedMeeting.status).replaceAll("_", " ")}` : ""}
            </span>
          </div>
          <span className="selected-meeting-file-count">{meetingFiles.length} {meetingFiles.length === 1 ? "file" : "files"}</span>
        </div>
      )}
      {!isLoadingMeetings && meetings.length === 0 && !meetingListError && (
        <p className="meeting-hint">Belum ada meeting. Buat meeting pertama di atas untuk mulai mengunggah file.</p>
      )}
      {!selectedMeetingId && meetings.length > 0 && (
        <p className="meeting-hint">Pilih meeting sebelum mengunggah rekaman atau dokumen.</p>
      )}
    </section>

    <div className="meeting-options-grid">
      
<div className="panel meeting-option-card recording-option-card">
  <div className="meeting-option-icon">●</div>

  <h2>Record a meeting</h2>

  <p>
    Record an in-person conversation using your device's
    microphone. Listen to the recording and download it when finished.
  </p>

  <div
    className={`recording-status-row ${
      recordingStatus === "recording" ? "is-recording" : ""
    }`}
  >
    {recordingStatus === "recording" ? (
      <>
        <span className="recording-live-dot" />
        <span>Recording in progress</span>
        <strong className="recording-timer">
          {String(Math.floor(recordingSeconds / 60)).padStart(2, "0")}:
          {String(recordingSeconds % 60).padStart(2, "0")}
        </strong>
      </>
    ) : recordingStatus === "processing" ? (
      <>
        <span className="recording-processing-dot" />
        <span>Preparing your recording...</span>
      </>
    ) : recordingStatus === "ready" ? (
      <>
        <span className="recording-ready-dot" />
        <span>Recording ready</span>
      </>
    ) : (
      <>
        <span className="recording-idle-dot" />
        <span>Microphone ready when you are</span>
      </>
    )}
  </div>

  {recordingError && (
    <div className="recording-error" role="alert">
      {recordingError}
    </div>
  )}

  {recordingStatus === "recording" ? (
    <button
      type="button"
      className="recording-button recording-button-stop"
      onClick={stopMeetingRecording}
    >
      <span className="recording-stop-square" />
      Stop recording
    </button>
  ) : recordingStatus === "ready" && recordingUrl ? (
    <div className="recording-result">
      <audio className="recording-audio" controls src={recordingUrl} />
      {recordingUploadError && (
  <div className="recording-upload-error" role="alert">
    {recordingUploadError}
  </div>
)}

{recordingUploadResult && (
  <div className="recording-upload-success" role="status">
    <strong>✓ Uploaded to Supabase</strong>
    <span>{recordingUploadResult}</span>
  </div>
)}

<button
  type="button"
  className="recording-button recording-upload-button"
  onClick={uploadMeetingRecording}
  disabled={
    !selectedMeetingId || isUploadingRecording || Boolean(recordingUploadResult)
  }
>
  {isUploadingRecording
    ? "Uploading recording..."
    : recordingUploadResult
      ? "Uploaded to ACTA ✓"
      : "Upload to ACTA"}
  {!isUploadingRecording && !recordingUploadResult && (
    <span>↑</span>
  )}
</button>

      <a
        className="recording-button recording-download-button"
        href={recordingUrl}
        download={recordingFileName}
      >
        Download recording <span>↓</span>
      </a>

      <button
        type="button"
        className="recording-button recording-button-secondary"
        onClick={startMeetingRecording}
      >
        Record again
      </button>
    </div>
  ) : (
    <button
      type="button"
      className="recording-button"
      onClick={startMeetingRecording}
      disabled={recordingStatus === "processing"}
    >
      {recordingStatus === "processing"
        ? "Preparing recording..."
        : "Start recording"}
      <span>→</span>
    </button>
  )}

  <div className="recording-privacy-note">
    <span>ⓘ</span>
    Recording stays in your browser until you upload it. Uploading requires a meeting selected above.
  </div>
</div>

<div className="panel meeting-option-card external-upload-card">
  <div className="meeting-option-icon">↑</div>

  <h2>Upload meeting files</h2>

  <p>
    Choose an existing recording, transcript, PDF, or
    PowerPoint file from your device.
  </p>

  <input
    id="meeting-file-input"
    className="meeting-file-input"
    type="file"
    accept=".webm,.wav,.mp3,.m4a,.ogg,.mp4,.mov,.pdf,.ppt,.pptx,.docx,.txt"
    multiple
    onChange={(event) => {
      addMeetingFiles(event.target.files);
      // Allow selecting the same file again later, if necessary.
      event.target.value = "";
    }}
    disabled={isUploadingMeetingFile}
  />

  <div
    className={`meeting-file-dropzone ${isMeetingFileDragOver ? "is-dragging" : ""} ${isUploadingMeetingFile ? "is-disabled" : ""}`}
    onDragEnter={(event) => {
      event.preventDefault();
      if (!isUploadingMeetingFile) setIsMeetingFileDragOver(true);
    }}
    onDragOver={(event) => {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
      if (!isUploadingMeetingFile) setIsMeetingFileDragOver(true);
    }}
    onDragLeave={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) {
        setIsMeetingFileDragOver(false);
      }
    }}
    onDrop={(event) => {
      event.preventDefault();
      setIsMeetingFileDragOver(false);
      if (isUploadingMeetingFile) return;
      addMeetingFiles(event.dataTransfer?.files);
    }}
    onClick={(event) => {
      if (event.target.closest("button")) return;
      if (!isUploadingMeetingFile) document.getElementById("meeting-file-input")?.click();
    }}
    aria-label="Drag and drop meeting files here, or browse files"
  >
    <span className="meeting-file-upload-icon" aria-hidden="true">↑</span>
    <strong>{isMeetingFileDragOver ? "Drop files to add them" : "Drag & drop files here"}</strong>
    <span className="meeting-file-dropzone-or">or choose files from your device</span>
    <button
      type="button"
      className="browse-files-button"
      onClick={(event) => {
        event.stopPropagation();
        document.getElementById("meeting-file-input")?.click();
      }}
      disabled={isUploadingMeetingFile}
    >
      Browse files
    </button>
    <span className="meeting-file-dropzone-support">Audio · Video · PDF · PPT/PPTX · DOCX · TXT</span>
    {selectedMeetingFiles.length > 0 && (
      <span className="meeting-file-selected-count">{selectedMeetingFiles.length} {selectedMeetingFiles.length === 1 ? "file" : "files"} selected · You can add more</span>
    )}
  </div>

  {selectedMeetingFiles.length > 0 && (
    <div className="meeting-selected-file-list">
      {selectedMeetingFiles.map((file, index) => (
        <div className="meeting-selected-file" key={`${file.name}-${file.size}-${index}`}>
          <div className="meeting-selected-file-icon">▤</div>
          <div className="meeting-selected-file-info">
            <strong>{file.name}</strong>
            <span>{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
          </div>
        </div>
      ))}
    </div>
  )}

  {meetingFileUploadError && (
    <div className="recording-upload-error" role="alert">
      {meetingFileUploadError}
    </div>
  )}

  {meetingFileUploadResult && (
    <div className="recording-upload-success" role="status">
      <strong>✓ Uploaded to Supabase</strong>
      <span>{meetingFileUploadResult}</span>
    </div>
  )}

  <button
    type="button"
    className="recording-button recording-upload-button"
    onClick={uploadExternalMeetingFile}
    disabled={
      selectedMeetingFiles.length === 0 ||
      !selectedMeetingId ||
      isUploadingMeetingFile ||
      (Boolean(meetingFileUploadResult) && selectedMeetingFiles.length === 0)
    }
  >
    {isUploadingMeetingFile
      ? `Uploading ${selectedMeetingFiles.length} file(s)...`
      : meetingFileUploadResult && selectedMeetingFiles.length === 0
        ? "Uploaded to ACTA ✓"
        : "Upload to ACTA"}
    {!isUploadingMeetingFile && !(meetingFileUploadResult && selectedMeetingFiles.length === 0) && (
      <span>↑</span>
    )}
  </button>

  <div className="recording-privacy-note">
    <span>ⓘ</span>
    Files are stored in private Supabase Storage.
    Each file is limited to 20 MB.
  </div>
</div>

      <div className="panel meeting-option-card">
        <div className="meeting-option-icon">✳</div>
        <h2>Analyze meeting notes</h2>
        <p>
          Already have a transcript? Use ACTA's existing
          AI Assistant to extract tasks for review.
        </p>
        <button
          className="action-button"
          onClick={() => setActiveNav("AI Assistant")}
        >
          Open AI Assistant →
        </button>
      </div>
    </div>

    <section className="panel meetings-files-panel">
      <div className="meetings-files-heading">
        <div>
          <span className="meeting-section-eyebrow">MEETING MATERIALS</span>
          <h2>Files in this meeting</h2>
          <p>{selectedMeeting ? `Materials attached to “${selectedMeeting.title || "Untitled meeting"}”.` : "Select a meeting to see its uploaded files."}</p>
        </div>
        <div className="meeting-header-actions">
          <button
            className="filter-button"
            type="button"
            onClick={() => selectedMeetingId && refreshMeetingFiles(selectedMeetingId)}
            disabled={!selectedMeetingId || isLoadingMeetingFiles}
          >
            {isLoadingMeetingFiles ? "Loading..." : "↻ Refresh files"}
          </button>
          <button
            className="action-button meeting-process-button"
            type="button"
            onClick={processSelectedMeeting}
            disabled={!selectedMeetingId || meetingFiles.length === 0 || isLoadingMeetingFiles || isProcessingMeeting}
          >
            {isProcessingMeeting ? "Processing meeting..." : "✳ Extract text & analyze"}
          </button>
        </div>
      </div>

      {meetingFilesError && <div className="meeting-feedback-error" role="alert">{meetingFilesError}</div>}
      {isLoadingMeetingFiles && <div className="meeting-files-empty loading-state">Loading files for this meeting...</div>}
      {!isLoadingMeetingFiles && selectedMeetingId && meetingFiles.length === 0 && !meetingFilesError && (
        <div className="meeting-files-empty">
          <div className="meeting-files-empty-icon">▤</div>
          <strong>No files attached yet</strong>
          <span>Upload a recording, transcript, or document above. New uploads will be attached to this meeting.</span>
        </div>
      )}
      {!isLoadingMeetingFiles && !selectedMeetingId && (
        <div className="meeting-files-empty">
          <div className="meeting-files-empty-icon">▣</div>
          <strong>No meeting selected</strong>
          <span>Create or select a meeting above to manage its files.</span>
        </div>
      )}
      {!isLoadingMeetingFiles && meetingFiles.length > 0 && (
        <div className="meeting-files-list">
          {meetingFiles.map((file) => {
            const fileName = file.original_file_name || file.file_name || file.name || (file.storage_path ? file.storage_path.split("/").pop() : "Meeting file");
            const fileSize = Number(file.size_bytes || file.size || 0);
            const fileDate = file.created_at ? new Date(file.created_at).toLocaleString() : "Upload date unavailable";
            return (
              <article className="meeting-file-row" key={file.id || file.storage_path || fileName}>
                <div className="meeting-file-row-icon">{String(file.file_kind || "document").toLowerCase() === "audio" ? "♫" : String(file.file_kind || "").toLowerCase() === "video" ? "▶" : "▤"}</div>
                <div className="meeting-file-row-main">
                  <strong title={fileName}>{fileName}</strong>
                  <span>{fileDate}{fileSize > 0 ? ` · ${(fileSize / (1024 * 1024)).toFixed(2)} MB` : ""}</span>
                </div>
                <div className="meeting-file-row-meta">
                  <span className="meeting-file-kind">{file.file_kind || "file"}</span>
                  {file.processing_status && <span className="meeting-file-status">{String(file.processing_status).replaceAll("_", " ")}</span>}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <p className="meeting-processing-note">
        Text extraction supports TXT, searchable PDF, DOCX, and PPTX. Audio/video files are transcribed automatically when the configured speech-to-text provider is available. Scanned PDFs and legacy PPT files may not yield text.
      </p>
      {meetingProcessingError && (
        <div className="meeting-feedback-error" role="alert">{meetingProcessingError}</div>
      )}
      {meetingProcessingMessage && (
        <div className="meeting-feedback-success" role="status">{meetingProcessingMessage}</div>
      )}

      {(meetingAnalysis || selectedMeeting?.summary) && (
        <div className="meeting-analysis-result">
          <div className="meeting-analysis-heading">
            <span className="meeting-section-eyebrow">ACTA ANALYSIS</span>
            <h3>{meetingAnalysis?.title || "Saved meeting summary"}</h3>
          </div>
          <p className="meeting-analysis-summary">
            {meetingAnalysis?.summary || selectedMeeting?.summary || "No summary available."}
          </p>
          {meetingAnalysis?.decisions?.length > 0 && (
            <div className="meeting-analysis-section">
              <strong>Decisions</strong>
              <ul>{meetingAnalysis.decisions.map((item, index) => <li key={`decision-${index}`}>{item}</li>)}</ul>
            </div>
          )}
          {meetingAnalysis?.next_steps?.length > 0 && (
            <div className="meeting-analysis-section">
              <strong>Next steps</strong>
              <ul>{meetingAnalysis.next_steps.map((item, index) => <li key={`next-${index}`}>{item}</li>)}</ul>
            </div>
          )}
          {meetingAnalysis?.risks?.length > 0 && (
            <div className="meeting-analysis-section">
              <strong>Risks</strong>
              <ul>{meetingAnalysis.risks.map((item, index) => <li key={`risk-${index}`}>{item}</li>)}</ul>
            </div>
          )}
          {meetingAnalysis?.open_questions?.length > 0 && (
            <div className="meeting-analysis-section">
              <strong>Open questions</strong>
              <ul>{meetingAnalysis.open_questions.map((item, index) => <li key={`question-${index}`}>{item}</li>)}</ul>
            </div>
          )}
          {meetingAnalysis && (
            <div className="meeting-analysis-section">
              <strong>Action items saved for review: {meetingAnalysis.task_count || 0}</strong>
              {meetingAnalysis.tasks?.length > 0 && (
                <ul>{meetingAnalysis.tasks.map((item, index) => <li key={`task-${item.id || index}`}>{item.task || item.title || "Action item"}{item.deadline_text ? ` — ${item.deadline_text}` : ""}</li>)}</ul>
              )}
            </div>
          )}
          {meetingAnalysis?.processedFiles?.length > 0 && (
            <div className="meeting-analysis-section">
              <strong>Files processed</strong>
              <ul>{meetingAnalysis.processedFiles.map((item, index) => <li key={`processed-${index}`}>{item}</li>)}</ul>
            </div>
          )}
          {meetingAnalysis?.skippedFiles?.length > 0 && (
            <div className="meeting-analysis-section">
              <strong>Files not processed</strong>
              <ul>{meetingAnalysis.skippedFiles.map((item, index) => <li key={`skipped-${index}`}>{item.file_name}: {item.reason}</li>)}</ul>
            </div>
          )}
          {meetingAnalysis?.truncated && (
            <p className="meeting-processing-note">The extracted transcript reached the 12,000-character AI input limit; remaining text was omitted from this analysis.</p>
          )}
          {(meetingAnalysis?.transcript_text || meetingTranscriptPreview || selectedMeeting?.transcript_text) && (
            <details className="meeting-transcript-preview">
              <summary>View extracted transcript</summary>
              <pre>{meetingAnalysis?.transcript_text || meetingTranscriptPreview || selectedMeeting?.transcript_text}</pre>
            </details>
          )}
        </div>
      )}
    </section>
  </section>
)}

{activeNav === "Tasks" && (
  <section className="workspace-page tasks-workspace-page">
    <div className="panel page-intro-panel">
      <div>
        <span className="ai-label">WORK MANAGEMENT</span>
        <h2>All action items</h2>
        <p>Review suggested owners, approve tasks, and follow progress across the workspace.</p>
      </div>
      <div className="page-intro-metrics">
        <strong>{tasks.length}</strong><span>Total tasks</span>
      </div>
    </div>

    <div className="stats-grid task-page-stats">
      <StatCard label="Pending review" value={String(pendingReviewCount)} detail="Awaiting owner approval" icon="◎" tone="orange" />
      <StatCard label="In progress" value={String(inProgressCount)} detail="Currently being worked on" icon="◷" tone="purple" />
      <StatCard label="Completed" value={String(completedCount)} detail="Tasks finished" icon="✓" tone="green" />
      <StatCard label="Other statuses" value={String(tasks.filter((task) => !["pending_review", "in_progress", "done"].includes(task.rawStatus)).length)} detail="Approved or rejected" icon="☷" tone="blue" />
    </div>

    <div className="panel tasks-directory-panel">
      <div className="panel-heading">
        <div><h2>Task register</h2><p>Use the owner selector to choose a recommended team member before approval.</p></div>
        <button className="filter-button" type="button" onClick={() => window.location.reload()}>↻ Refresh</button>
      </div>
      <div className="task-toolbar task-toolbar-enhanced">
        <div className="search-box"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tasks, owners, or teams..." aria-label="Search tasks" /></div>
        <label className="task-filter-control"><span>Status</span><select value={taskStatusFilter} onChange={(event) => setTaskStatusFilter(event.target.value)} aria-label="Filter tasks by status"><option value="all">All statuses</option><option value="pending_review">Pending review</option><option value="approved">Approved</option><option value="in_progress">In progress</option><option value="done">Completed</option><option value="rejected">Rejected</option></select></label>
        {(search || taskStatusFilter !== "all") && <button className="filter-button" type="button" onClick={() => { setSearch(""); setTaskStatusFilter("all"); }}>Clear filters</button>}
        <span className="task-result-count">{filteredTasks.length} of {tasks.length} tasks</span>
      </div>
      <div className="task-list">
        {isLoading && <div className="empty-state loading-state">Loading tasks...</div>}
        {!isLoading && loadError && <div className="empty-state"><p>We couldn't load your tasks.</p><p>{loadError}</p><button className="filter-button" onClick={() => window.location.reload()}>Retry</button></div>}
        {!isLoading && !loadError && filteredTasks.length === 0 && <div className="empty-state">{search ? "No tasks match your search." : "No tasks have been saved yet."}</div>}
        {!isLoading && !loadError && filteredTasks.map((task) => (
          <div className="task-row task-row-expanded" key={task.id}>
            <div className={`task-symbol ${task.color}`}>✓</div>
            <div className="task-details"><strong>{task.title}</strong><span>{task.project} · Due {task.due}</span></div>
            <div className="task-owner"><div className="owner-avatar">{task.initials}</div><span>{task.owner}</span></div>
            <span className={`status-pill ${task.color}`}>{task.status}</span>
            <div className="task-actions">
              {task.rawStatus === "pending_review" && (
                <>
                  <select id={`owner-select-${task.id}`} className="owner-select" defaultValue={task.suggestedOwners?.find((owner) => owner.employee_id === task.selectedOwnerId)?.employee_id || task.suggestedOwners?.[0]?.employee_id || ""} disabled={!task.suggestedOwners?.length}>
                    {!task.suggestedOwners?.length && <option value="">No owner matches</option>}
                    {(task.suggestedOwners || []).map((owner) => (
                      <option key={owner.employee_id} value={owner.employee_id}>
                        {owner.name} · {owner.match_score}% · {owner.availability_status === "limited" ? "Limited" : "Available"}
                      </option>
                    ))}
                  </select>
                  <button className="filter-button" type="button" onClick={() => refreshTaskRecommendations(task)} disabled={refreshingTaskId === task.id}>{refreshingTaskId === task.id ? "Refreshing..." : "Refresh owners"}</button>
                  <button className="action-button" onClick={() => approveTask(task)} disabled={!task.suggestedOwners?.length}>Approve</button>
                  <button className="action-button reject-button" onClick={() => updateTaskStatus(task, "rejected")}>Reject</button>
                </>
              )}
              {task.rawStatus === "approved" && <button className="action-button" onClick={() => updateTaskStatus(task, "in_progress")}>Start task</button>}
              {task.rawStatus === "in_progress" && <button className="action-button" onClick={() => updateTaskStatus(task, "done")}>Mark completed</button>}
            </div>
          </div>
        ))}
      </div>
      <div className="panel-footer">Showing {filteredTasks.length} of {tasks.length} tasks</div>
    </div>
  </section>
)}

{activeNav === "Team" && (
  <section className="workspace-page team-workspace-page">
    <div className="panel page-intro-panel team-intro-panel">
      <div>
        <span className="ai-label">TEAM DIRECTORY</span>
        <h2>People behind the work.</h2>
        <p>Manage employee roles, skills, divisions, workload, and availability. ACTA uses these profiles to recommend owners for meeting action items.</p>
      </div>
      <button className="action-button team-add-button" type="button" onClick={() => openEmployeeEditor()}>＋ Add team member</button>
    </div>

    {teamError && <div className="team-feedback-error" role="alert">{teamError}</div>}
    {teamNotice && <div className="team-feedback-success" role="status">{teamNotice}</div>}

    <div className="stats-grid team-stats-grid">
      <StatCard label="Team members" value={String(teamMembers.length)} detail="Registered employees" icon="♧" tone="blue" />
      <StatCard label="Available" value={String(teamMembers.filter((member) => member.availability_status === "available").length)} detail="Ready for assignment" icon="✓" tone="green" />
      <StatCard label="Limited" value={String(teamMembers.filter((member) => member.availability_status === "limited").length)} detail="Can take work within capacity" icon="◷" tone="orange" />
      <StatCard label="Divisions" value={String(new Set(teamMembers.map((member) => member.division_id).filter(Boolean)).size)} detail="Teams represented" icon="▦" tone="purple" />
    </div>

    {editingEmployee && (
      <form className="panel employee-editor-panel" onSubmit={saveEmployee}>
        <div className="employee-editor-heading"><div><span className="ai-label">EMPLOYEE PROFILE</span><h2>{editingEmployee === "new" ? "Add team member" : "Edit team member"}</h2><p>Use accurate role and skill details so owner recommendations match the real responsibilities.</p></div><button className="filter-button" type="button" onClick={() => setEditingEmployee(null)}>Close</button></div>
        <div className="employee-form-grid">
          <label>Name<input value={employeeForm.name} onChange={(event) => setEmployeeForm((current) => ({ ...current, name: event.target.value }))} required maxLength={120} placeholder="e.g. Andi" /></label>
          <label>Role / Job title<input value={employeeForm.role} onChange={(event) => setEmployeeForm((current) => ({ ...current, role: event.target.value }))} required maxLength={120} placeholder="e.g. Frontend Engineer" /></label>
          <label>Division<select value={employeeForm.division_id} onChange={(event) => setEmployeeForm((current) => ({ ...current, division_id: event.target.value }))} required><option value="">Select division</option>{teamDivisions.map((division) => <option key={division.id} value={division.id}>{division.name}</option>)}</select></label>
          <label>Availability<select value={employeeForm.availability_status} onChange={(event) => setEmployeeForm((current) => ({ ...current, availability_status: event.target.value }))}><option value="available">Available</option><option value="limited">Limited</option><option value="unavailable">Unavailable</option></select></label>
          <label className="employee-form-wide">Job description<textarea value={employeeForm.job_description} onChange={(event) => setEmployeeForm((current) => ({ ...current, job_description: event.target.value }))} rows={2} maxLength={2000} placeholder="Describe the employee's responsibilities." /></label>
          <label>Specialization <small>Separate with commas</small><input value={employeeForm.specialization} onChange={(event) => setEmployeeForm((current) => ({ ...current, specialization: event.target.value }))} placeholder="frontend, React, web interface" /></label>
          <label>Skills <small>Separate with commas</small><input value={employeeForm.skills} onChange={(event) => setEmployeeForm((current) => ({ ...current, skills: event.target.value }))} placeholder="JavaScript, React, CSS" /></label>
          <label>Current open tasks<input type="number" min="0" step="1" value={employeeForm.current_open_tasks} onChange={(event) => setEmployeeForm((current) => ({ ...current, current_open_tasks: event.target.value }))} required /></label>
          <label>Maximum concurrent tasks<input type="number" min="1" step="1" value={employeeForm.max_concurrent_tasks} onChange={(event) => setEmployeeForm((current) => ({ ...current, max_concurrent_tasks: event.target.value }))} required /></label>
        </div>
        <div className="employee-editor-actions"><button className="filter-button" type="button" onClick={() => setEditingEmployee(null)}>Cancel</button><button className="action-button" type="submit" disabled={isSavingEmployee}>{isSavingEmployee ? "Saving..." : "Save profile"}</button></div>
      </form>
    )}

    <div className="panel team-directory-panel">
      <div className="panel-heading"><div><h2>Team directory</h2><p>Employee profiles currently stored in your ACTA workspace.</p></div><button className="filter-button" type="button" onClick={loadTeamData} disabled={isLoadingTeam}>{isLoadingTeam ? "Loading..." : "↻ Refresh"}</button></div>
      <div className="team-toolbar">
        <div className="search-box"><span>⌕</span><input value={teamSearch} onChange={(event) => setTeamSearch(event.target.value)} placeholder="Search name, role, or division..." aria-label="Search team members" /></div>
        <select value={teamStatusFilter} onChange={(event) => setTeamStatusFilter(event.target.value)} aria-label="Filter by availability"><option value="all">All availability</option><option value="available">Available</option><option value="limited">Limited</option><option value="unavailable">Unavailable</option></select>
      </div>
      {isLoadingTeam && <div className="empty-state loading-state">Loading team directory...</div>}
      {!isLoadingTeam && !teamError && filteredTeamMembers.length === 0 && <div className="empty-state">{teamMembers.length ? "No team members match this filter." : "No employee records found. Add a team member to get started."}</div>}
      {!isLoadingTeam && filteredTeamMembers.length > 0 && (
        <div className="team-member-list">
          {filteredTeamMembers.map((member) => (
            <article className="team-member-row" key={member.id}>
              <div className="team-member-avatar">{String(member.name || "?").split(/\s+/).map((part) => part[0] || "").join("").slice(0, 2).toUpperCase()}</div>
              <div className="team-member-main"><strong>{member.name}</strong><span>{member.role || "Role not set"} · {member.division_name}</span><small>{Array.isArray(member.skills) && member.skills.length ? member.skills.join(" · ") : "No skills recorded"}</small></div>
              <div className="team-member-workload"><strong>{Number(member.current_open_tasks || 0)} / {Number(member.max_concurrent_tasks || 0)}</strong><span>Open tasks</span></div>
              <span className={`team-availability ${member.availability_status || "unknown"}`}>{member.availability_status || "Unknown"}</span>
              <button className="filter-button" type="button" onClick={() => openEmployeeEditor(member)}>Edit</button>
            </article>
          ))}
        </div>
      )}
      <div className="panel-footer">Showing {filteredTeamMembers.length} of {teamMembers.length} team members</div>
    </div>
    <p className="team-directory-note">Before approving tasks, keep employee role, skills, workload, and availability up to date. After editing a profile, return to Tasks and use <strong>Refresh owners</strong> on pending items to recalculate their recommendations.</p>
  </section>
)}

{activeNav === "AI Assistant" && (
  <section className="assistant-workspace">
    <div className="assistant-hero">
      <div className="assistant-hero-copy">
        <div className="assistant-kicker">
          <span className="assistant-kicker-dot" />
          ACTA INTELLIGENCE
        </div>

        <h2>
          From meeting notes
          <br />
          to <span>meaningful action.</span>
        </h2>

        <p>
          Turn conversations into clear tasks, identify potential
          owners, and bring important decisions into focus.
          You stay in control of every approval.
        </p>

        <div className="assistant-benefits">
          <span><b>✓</b> Action items</span>
          <span><b>✓</b> Owner suggestions</span>
          <span><b>✓</b> Human review</span>
        </div>
      </div>

      <div className="assistant-hero-visual" aria-hidden="true">
        <div className="assistant-visual-ring assistant-ring-one" />
        <div className="assistant-visual-ring assistant-ring-two" />

        <div className="assistant-visual-card">
          <div className="assistant-visual-spark">✳</div>
          <span className="assistant-visual-label">MEETING</span>
          <div className="assistant-visual-line assistant-line-long" />
          <div className="assistant-visual-line assistant-line-medium" />
          <div className="assistant-visual-line assistant-line-short" />
          <div className="assistant-visual-divider" />
          <div className="assistant-visual-task">
            <span>✓</span>
            <div>
              <i />
              <i />
            </div>
          </div>
          <div className="assistant-visual-task">
            <span>✓</span>
            <div>
              <i />
              <i />
            </div>
          </div>
        </div>

        <div className="assistant-floating-badge">
          <span>✦</span> AI powered
        </div>
      </div>
    </div>

    <section className="panel assistant-input-panel">
      <div className="assistant-panel-heading">
        <div className="assistant-step-number">01</div>

        <div className="assistant-panel-title">
          <span className="assistant-section-eyebrow">
            START WITH YOUR NOTES
          </span>
          <h3>Meeting transcript</h3>
          <p>
            Paste your transcript below to get started.
            Longer notes are welcome.
          </p>
        </div>

        <div className="assistant-input-type">
          <span>≡</span>
          Text input
        </div>
      </div>

      <form
        className="assistant-transcript-form"
        onSubmit={handleExtractAndSave}
      >
        <label
          className="assistant-field-label"
          htmlFor="meeting-transcript"
        >
          Transcript content
          <span>Required</span>
        </label>

        <textarea
          id="meeting-transcript"
          className="assistant-transcript-input"
          value={transcript}
          onChange={(event) => setTranscript(event.target.value)}
          placeholder={`Paste your meeting transcript here...

For example:
"The marketing team will prepare the launch campaign by Friday. Dimas will draft the campaign content, and Alya will review the strategy."`}
          required
          minLength={20}
          maxLength={12000}
          rows={10}
          disabled={isSubmitting}
        />

        <div className="assistant-textarea-meta">
          <span className="assistant-input-tip">
            <span>ⓘ</span>
            Include decisions, deadlines, and names when available.
          </span>

          <span
            className={
              transcript.length > 11000
                ? "assistant-char-count near-limit"
                : "assistant-char-count"
            }
          >
            {transcript.length.toLocaleString("en-US")} / 12,000
          </span>
        </div>

        {submitError && (
          <div className="assistant-submit-error" role="alert">
            <span>!</span>
            <div>
              <strong>Analysis could not be started</strong>
              <p>{submitError}</p>
            </div>
          </div>
        )}

        <div className="assistant-form-footer">
          <div className="assistant-review-note">
            <span className="assistant-review-icon">✓</span>
            <div>
              <strong>You remain in control</strong>
              <p>Review suggested tasks before approving them.</p>
            </div>
          </div>

          <button
            type="submit"
            className="assistant-submit-button"
            disabled={isSubmitting}
          >
            <span className="assistant-submit-icon">✳</span>
            {isSubmitting
              ? "Analyzing transcript..."
              : "Analyze with ACTA"}
            {!isSubmitting && <span className="assistant-submit-arrow">→</span>}
          </button>
        </div>
      </form>
    </section>

    <div className="assistant-process-heading">
      <div>
        <h3>What ACTA helps you do</h3>
        <p>From unstructured conversations to organized work.</p>
      </div>
    </div>

    <div className="assistant-capabilities">
      <article className="assistant-capability-card">
        <div className="assistant-capability-icon capability-purple">
          <span>≡</span>
        </div>
        <div>
          <h4>Extract action items</h4>
          <p>
            Turn meeting discussions into actionable tasks
            that your team can follow up on.
          </p>
        </div>
      </article>

      <article className="assistant-capability-card">
        <div className="assistant-capability-icon capability-blue">
          <span>◎</span>
        </div>
        <div>
          <h4>Recommend task owners</h4>
          <p>
            Review suggested owners and available team
            information before making an assignment.
          </p>
        </div>
      </article>

      <article className="assistant-capability-card">
        <div className="assistant-capability-icon capability-green">
          <span>✓</span>
        </div>
        <div>
          <h4>Keep decisions accountable</h4>
          <p>
            Review proposed actions before they become
            approved work for your team.
          </p>
        </div>
      </article>
    </div>
  </section>
)}

{activeNav === "Overview" && (
  <>
    <section className="stats-grid">
            <StatCard
              label="Total tasks"
              value={String(tasks.length)}
              detail="Across your workspace"
              icon="☷"
              tone="blue"
            />
            <StatCard
              label="In progress"
              value={String(inProgressCount)}
              detail="Currently being worked on"
              icon="◷"
              tone="purple"
            />
            <StatCard
              label="Pending review"
              value={String(pendingReviewCount)}
              detail="Awaiting your approval"
              icon="◎"
              tone="orange"
            />
            <StatCard
              label="Completed"
              value={String(completedCount)}
              detail="Tasks finished"
              icon="✓"
              tone="green"
            />
          </section>

          <section className="acta-loop-panel" aria-label="ACTA workflow">
            <div className="acta-loop-heading">
              <div>
                <span className="acta-loop-kicker">THE ACTA LOOP</span>
                <h2>From conversation to completion.</h2>
                <p>One continuous workflow. Your team stays in control at every step.</p>
              </div>
              <span className="loop-live"><span></span> WORKFLOW OVERVIEW</span>
            </div>
            <div className="acta-loop-track">
              <button type="button" className="loop-step" onClick={() => goToPage("Meetings")}>
                <span className="loop-step-top"><span className="loop-step-number">01</span><span className="loop-step-icon">▣</span></span>
                <strong>Capture</strong><span className="loop-step-detail">Record or upload a meeting</span><span className="loop-step-link">Open meetings <b>↗</b></span>
              </button>
              <span className="loop-connector" aria-hidden="true"><i></i></span>
              <button type="button" className="loop-step" onClick={() => goToPage("AI Assistant")}>
                <span className="loop-step-top"><span className="loop-step-number">02</span><span className="loop-step-icon">✳</span></span>
                <strong>Understand</strong><span className="loop-step-detail">AI extracts decisions and tasks</span><span className="loop-step-link">Open AI assistant <b>↗</b></span>
              </button>
              <span className="loop-connector" aria-hidden="true"><i></i></span>
              <button type="button" className="loop-step loop-step-review" onClick={() => goToPage("Tasks")}>
                <span className="loop-step-top"><span className="loop-step-number">03</span><span className="loop-step-icon">◎</span></span>
                <strong>Approve</strong><span className="loop-step-detail">{pendingReviewCount} action {pendingReviewCount === 1 ? "item" : "items"} awaiting review</span><span className="loop-step-link">Review tasks <b>↗</b></span>
                {pendingReviewCount > 0 && <span className="loop-step-badge">{pendingReviewCount} pending</span>}
              </button>
              <span className="loop-connector" aria-hidden="true"><i></i></span>
              <button type="button" className="loop-step loop-step-execute" onClick={() => goToPage("Tasks")}>
                <span className="loop-step-top"><span className="loop-step-number">04</span><span className="loop-step-icon">↗</span></span>
                <strong>Execute</strong><span className="loop-step-detail">{inProgressCount} active · {completedCount} completed</span><span className="loop-step-link">Track progress <b>↗</b></span>
              </button>
            </div>
          </section>

          <section className="content-grid">
            <div className="panel tasks-panel">
              <div className="panel-heading">
                <div>
                  <h2>Recent tasks</h2>
                  <p>Keep track of your team's action items.</p>
                </div>
                <button
                  className="text-button"
                  onClick={() => setActiveNav("Tasks")}
                >
                  View all <span>→</span>
                </button>
              </div>

              
<div className="task-toolbar">
  <div className="search-box">
    <span>⌕</span>
    <input
      value={search}
      onChange={(event) => setSearch(event.target.value)}
      placeholder="Search tasks..."
      aria-label="Search tasks"
    />
  </div>
  <button className="filter-button" type="button" onClick={() => goToPage("Tasks")}>☷ More filters</button>
</div>

<div className="task-list">
  {isLoading && (
    <div className="empty-state loading-state">
      Loading tasks from ACTA...
    </div>
  )}

  {!isLoading && loadError && (
    <div className="empty-state">
      <p>We couldn't load your tasks.</p>
      <p>{loadError}</p>
      <button
        className="filter-button"
        onClick={() => window.location.reload()}
      >
        Retry
      </button>
    </div>
  )}

  {!isLoading && !loadError && filteredTasks.length === 0 && (
    <div className="empty-state">
      {search
        ? "No tasks match your search."
        : "No tasks have been saved yet."}
    </div>
  )}

  {!isLoading &&
    !loadError &&
    filteredTasks.slice(0, 5).map((task) => (
      <div className="task-row" key={task.id}>
        <div className={`task-symbol ${task.color}`}>✓</div>

        <div className="task-details">
          <strong>{task.title}</strong>
          <span>
            {task.project} · Due {task.due}
          </span>
        </div>

        <div className="task-owner">
          <div className="owner-avatar">{task.initials}</div>
          <span>{task.owner}</span>
        </div>

        <span className={`status-pill ${task.color}`}>
          {task.status}
        </span>

        <div className="task-actions">
          {task.rawStatus === "pending_review" && (
            <>
              <select
                id={`owner-select-${task.id}`}
                className="owner-select"
                defaultValue={
                  task.suggestedOwners?.[0]?.employee_id || ""
                }
              >
                {(task.suggestedOwners || []).map((owner) => (
                  <option
                    key={owner.employee_id}
                    value={owner.employee_id}
                  >
                    {owner.name} — {owner.match_score}% · {owner.availability_status === "limited" ? "Limited" : "Available"}
                  </option>
                ))}
              </select>

              <button
                className="action-button"
                onClick={() => approveTask(task)}
              >
                Approve
              </button>

              <button
                className="action-button reject-button"
                onClick={() =>
                  updateTaskStatus(task, "rejected")
                }
              >
                Reject
              </button>
            </>
          )}

          {task.rawStatus === "approved" && (
            <button
              className="action-button"
              onClick={() =>
                updateTaskStatus(task, "in_progress")
              }
            >
              Start task
            </button>
          )}

          {task.rawStatus === "in_progress" && (
            <button
              className="action-button"
              onClick={() => updateTaskStatus(task, "done")}
            >
              Mark completed
            </button>
          )}
        </div>
      </div>
    ))}
</div>

<div className="panel-footer">
  Showing {Math.min(filteredTasks.length, 5)} recent of {tasks.length} total tasks
</div>
</div>

            <div className="right-column">
              <div className="panel ai-panel">
                <div className="ai-heading">
                  <div className="ai-symbol">✳</div>
                  <span className="ai-label">ACTA INTELLIGENCE</span>
                </div>
                <h2>Meetings into action.</h2>
                <p>
                  Let AI identify tasks, deadlines, and the right people from
                  your meeting notes.
                </p>
                <div className="ai-feature">
                  <span>✓</span> Automatic task extraction
                </div>
                <div className="ai-feature">
                  <span>✓</span> Intelligent owner suggestions
                </div>
                <button
                  className="ai-button"
                  onClick={() => setActiveNav("AI Assistant")}
                >
                  Open AI Assistant <span>→</span>
                </button>
              </div>

              <div className="panel attention-panel">
                <div className="attention-title">
                  <div className="attention-icon">!</div>
                  <h3>Needs your attention</h3>
                </div>
                <div className="attention-number">
  {pendingReviewCount}{" "}
  {pendingReviewCount === 1 ? "task" : "tasks"}
</div>
                <p>
                  {pendingReviewCount === 0
                    ? "You're all caught up. No action items are waiting for approval."
                    : `${pendingReviewCount} action ${pendingReviewCount === 1 ? "item is" : "items are"} waiting for owner approval.`}
                </p>
                <button
                  className="text-button"
                  onClick={() => { setSearch(""); setTaskStatusFilter("pending_review"); goToPage("Tasks"); }}
                >
                  Review queue <span>→</span>
                </button>
              </div>
            </div>
          </section>
  </>
)}
          <footer className="page-footer">
            <span>ACTA · Action Coordination &amp; Task Agent</span>
            <span>Built for better teamwork.</span>
          </footer>
        </div>
      </main>
      {isCommandOpen && (
        <div className="command-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsCommandOpen(false); }}>
          <section className="command-dialog" role="dialog" aria-modal="true" aria-label="Quick navigation">
            <div className="command-search-row">
              <span className="command-search-icon">⌕</span>
              <input autoFocus value={commandQuery} onChange={(event) => { setCommandQuery(event.target.value); setCommandActiveIndex(0); }} placeholder="Where would you like to go?" aria-label="Search ACTA pages" />
              <kbd>ESC</kbd>
            </div>
            <div className="command-section-label">QUICK NAVIGATION</div>
            <div className="command-results">
              {filteredCommandItems.map((item, index) => (
                <button type="button" className={`command-result ${index === commandActiveIndex ? "is-active" : ""}`} key={item.label} onClick={() => goToPage(item.label)}>
                  <span className="command-result-icon">{item.icon}</span>
                  <span className="command-result-copy"><strong>{item.label}</strong><small>{item.detail}</small></span>
                  <kbd>{index < 6 ? `0${index + 1}` : "↵"}</kbd>
                </button>
              ))}
              {filteredCommandItems.length === 0 && <div className="command-empty">No matching destination. Try “tasks”, “team”, or “meetings”.</div>}
            </div>
            <div className="command-footer"><span><kbd>↑</kbd> <kbd>↓</kbd> Move</span><span><kbd>↵</kbd> Open</span><span>ACTA COMMAND</span></div>
          </section>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, detail, icon, tone }) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <div className={`stat-icon ${tone}`}>{icon}</div>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-detail">{detail}</div>
    </div>
  );
}

export default App;
