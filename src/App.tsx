import { useState, useEffect } from "react";
import { GoogleLogin, googleLogout } from "@react-oauth/google";
import { FaHouse, FaPersonRunning, FaCalendarDays, FaTrophy, FaBolt, FaUser, FaArrowsRotate, FaRightFromBracket, FaHeartPulse, FaArrowUpRightFromSquare, FaCalendarCheck, FaBullseye } from "react-icons/fa6";
import { GiRunningShoe } from "react-icons/gi";
import "./App.css";

const TAB_META: Record<string, { label: string; icon: React.ReactNode }> = {
  home:         { label: "Home",           icon: <FaHouse /> },
  runs:         { label: "Run History",    icon: <FaPersonRunning /> },
  yearly:       { label: "Mileage",         icon: <FaCalendarDays /> },
  gear:         { label: "Gear",           icon: <GiRunningShoe /> },
  health:       { label: "Health",         icon: <FaHeartPulse /> },
  calendar:     { label: "Calendar",       icon: <FaCalendarCheck /> },
  competitions: { label: "Competitions",   icon: <FaTrophy /> },
  goals:        { label: "Goals",          icon: <FaBullseye /> },
  records:      { label: "Records",        icon: <FaBolt /> },
};

interface Activity {
  date: string;
  name: string;
  strava_id: number;
  km: number;
  elapsed_sec: number;
  avg_pace: string | null;
  avg_hr: number | null;
  elevation: number | null;
  relative_effort: number | null;
  gear: string;
}

interface GearInfo {
  id: number;
  total_km: number;
  limit_km: number | null;
  image_url: string | null;
}

interface GarminRecord {
  label: string;
  distance_m: number;
  time: string;
  pace: string;
  date: string;
  activity_id: number;
  activity_name: string;
}

interface GarminMetrics {
  vo2_max: number | null;
  fitness_age: number | null;
  training_status: string | null;
  training_load: number | null;
  acute_load: number | null;
  hrv_last_night: number | null;
  hrv_weekly_avg: number | null;
  hrv_status: string | null;
  training_readiness: number | null;
  readiness_level: string | null;
  readiness_feedback: string | null;
  sleep_score: number | null;
  recovery_time: number | null;
  acwr_feedback: string | null;
  resting_hr: number | null;
  resting_hr_7day: string | null; // JSON string: [{date, value}]
  race_5k: string | null;
  race_10k: string | null;
  race_hm: string | null;
  race_marathon: string | null;
  synced_at: string | null;
}

interface StatsResponse {
  activities: Activity[];
  gear_summary: Record<string, GearInfo>;
  error?: string;
}

interface Competition {
  id: number;
  competition: string;
  location: string | null;
  date: string;
  distance: string;
  time: string | null;
  rank: string | null;
  link: string | null;
}

interface Goal {
  id: number;
  year: number;
  description: string;
  achieved: boolean;
  result: string | null;
  sort_order: number;
}

type Tab = "home" | "runs" | "yearly" | "gear" | "health" | "calendar" | "competitions" | "goals" | "records";

interface GarminActivity {
  id: string;
  date: string;
  name: string;
  activity_type: string;
  distance_km: number;
  duration_sec: number;
  calories: number | null;
  aerobic_te: number | null;
  anaerobic_te: number | null;
}

function formatDuration(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function friendlyError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("token expired") || m.includes("exp") && m.includes("<"))
    return "Session expired. Please sign in again.";
  if (m.includes("unauthorized") || m.includes("forbidden"))
    return "Access denied.";
  if (m.includes("429") || m.includes("rate limit") || m.includes("too many requests"))
    return "Rate limit reached. Please try again in 15 minutes.";
  if (m.includes("postgres") || m.includes("database") || m.includes("socket"))
    return "Database connection error. Please try again later.";
  if (m.includes("failed to fetch") || m.includes("networkerror") || m.includes("load failed"))
    return "Network error. Check your connection and try again.";
  return msg;
}

function defaultDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-01-01`;
}

function YearlyChart({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return null;

  const W = 620, H = 320;
  const PAD = { top: 32, right: 24, bottom: 56, left: 64 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const maxKm = Math.max(...entries.map(([, km]) => km));
  const yMax = Math.ceil(maxKm / 500) * 500 || 500;

  const axisBottom = PAD.top + plotH;
  const slotW = plotW / entries.length;
  const barW = Math.min(slotW * 0.7, 80);
  const toBarX = (i: number) => PAD.left + slotW * i + (slotW - barW) / 2;
  const toBarH = (km: number) => (km / yMax) * plotH;
  const toBarY = (km: number) => PAD.top + plotH - toBarH(km);

  const gridSteps = 5;
  const gridLines = Array.from({ length: gridSteps + 1 }, (_, i) => {
    const km = Math.round((yMax / gridSteps) * i);
    return { km, y: toBarY(km) };
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="yearly-chart">
      <defs>
        <marker id="arr-x" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#ccc" />
        </marker>
        <marker id="arr-y" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#ccc" />
        </marker>
      </defs>

      {/* Horizontal grid lines + Y labels */}
      {gridLines.map(({ km, y }) => (
        <g key={km}>
          <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
            stroke={km === 0 ? "transparent" : "#e8e8e8"} strokeWidth="1" strokeDasharray="4 3" />
          <text x={PAD.left - 8} y={y} textAnchor="end" dominantBaseline="middle" fontSize="11" fill="#aaa">
            {km}
          </text>
        </g>
      ))}

      {/* Y axis */}
      <line x1={PAD.left} y1={axisBottom} x2={PAD.left} y2={PAD.top - 8}
        stroke="#ccc" strokeWidth="1.5" markerEnd="url(#arr-y)" />
      {/* X axis */}
      <line x1={PAD.left} y1={axisBottom} x2={W - PAD.right + 8} y2={axisBottom}
        stroke="#ccc" strokeWidth="1.5" markerEnd="url(#arr-x)" />

      {/* Y axis label */}
      <text transform="rotate(-90)" x={-(PAD.top + plotH / 2)} y={18}
        textAnchor="middle" fontSize="12" fill="#aaa">km</text>

      {/* Bars */}
      {entries.map(([year, km], i) => {
        const bx = toBarX(i);
        const bh = toBarH(km);
        const by = toBarY(km);
        const cx = bx + barW / 2;
        return (
          <g key={year}>
            <rect x={bx} y={by} width={barW} height={bh} fill="#fc4c02" rx="4" />
            <text x={cx} y={by - 8} textAnchor="middle" fontSize="12" fontWeight="600" fill="#555">
              {Math.round(km)}
            </text>
            <text x={cx} y={axisBottom + 18} textAnchor="middle" fontSize="12" fill="#aaa">
              {year}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function MonthlyChart({ data, year }: { data: Record<string, number>; year: number }) {
  const values = MONTH_LABELS.map((_, i) => {
    const key = `${year}-${String(i + 1).padStart(2, "0")}`;
    return data[key] ?? 0;
  });

  const W = 620, H = 300;
  const PAD = { top: 32, right: 24, bottom: 56, left: 60 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const maxKm = Math.max(...values, 1);
  const yMax = Math.ceil(maxKm / 100) * 100 || 100;

  const slotW = plotW / 12;
  const barW = slotW * 0.6;
  const toBarX = (i: number) => PAD.left + slotW * i + (slotW - barW) / 2;
  const toBarH = (km: number) => (km / yMax) * plotH;
  const toBarY = (km: number) => PAD.top + plotH - toBarH(km);
  const axisBottom = PAD.top + plotH;

  const gridSteps = 4;
  const gridLines = Array.from({ length: gridSteps + 1 }, (_, i) => {
    const km = Math.round((yMax / gridSteps) * i);
    return { km, y: toBarY(km) };
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="yearly-chart">
      <defs>
        <marker id="arr-mx" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#ccc" />
        </marker>
        <marker id="arr-my" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#ccc" />
        </marker>
      </defs>

      {/* Horizontal grid lines + Y labels */}
      {gridLines.map(({ km, y }) => (
        <g key={km}>
          <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
            stroke={km === 0 ? "transparent" : "#e8e8e8"} strokeWidth="1" strokeDasharray="4 3" />
          <text x={PAD.left - 8} y={y} textAnchor="end" dominantBaseline="middle" fontSize="11" fill="#aaa">
            {km}
          </text>
        </g>
      ))}

      {/* Y axis */}
      <line x1={PAD.left} y1={axisBottom} x2={PAD.left} y2={PAD.top - 8}
        stroke="#ccc" strokeWidth="1.5" markerEnd="url(#arr-my)" />
      {/* X axis */}
      <line x1={PAD.left} y1={axisBottom} x2={W - PAD.right + 8} y2={axisBottom}
        stroke="#ccc" strokeWidth="1.5" markerEnd="url(#arr-mx)" />

      {/* Y axis label */}
      <text transform="rotate(-90)" x={-(PAD.top + plotH / 2)} y={18}
        textAnchor="middle" fontSize="12" fill="#aaa">km</text>

      {/* Bars */}
      {values.map((km, i) => {
        const bx = toBarX(i);
        const bh = toBarH(km);
        const by = toBarY(km);
        const cx = bx + barW / 2;
        return (
          <g key={i}>
            <rect x={bx} y={km === 0 ? axisBottom - 2 : by}
              width={barW} height={km === 0 ? 2 : bh}
              fill={km === 0 ? "#ececec" : "#fc4c02"} rx="3" />
            {km > 0 && (
              <text x={cx} y={by - 6} textAnchor="middle" fontSize="10" fontWeight="600" fill="#555">
                {Math.round(km)}
              </text>
            )}
            <text x={cx} y={axisBottom + 16} textAnchor="middle" fontSize="11" fill="#aaa">
              {MONTH_LABELS[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function decodeJwt(token: string): { picture?: string; name?: string } {
  try {
    return JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return {};
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const LOGOS = ["/logo.png", "/logo-2.png", "/logo-3.jpg", "/logo-4.png"];
  const [logoIdx, setLogoIdx] = useState(0);
  const [logoFading, setLogoFading] = useState(false);
  const cycleLogo = () => {
    setLogoFading(true);
    setTimeout(() => {
      setLogoIdx((i) => (i + 1) % LOGOS.length);
      setLogoFading(false);
    }, 300);
  };
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  // Garmin fitness metrics (home page)
  const [garminMetrics, setGarminMetrics] = useState<GarminMetrics | null>(null);

  // All-time data: Gear + Yearly
  const [allTimeData, setAllTimeData] = useState<StatsResponse | null>(null);
  const [allTimeLoading, setAllTimeLoading] = useState(false);
  const [allTimeError, setAllTimeError] = useState("");

  // Runs data: date-filtered
  const [afterDate, setAfterDate] = useState(defaultDate);
  const [allTime, setAllTime] = useState(false);
  const [runsData, setRunsData] = useState<StatsResponse | null>(null);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runsError, setRunsError] = useState("");

  // Records
  const [records, setRecords] = useState<GarminRecord[] | null>(null);
  const [recordsLoading, setRecordsLoading] = useState(false);

  // Sync
  const [syncStatus, setSyncStatus] = useState<Record<string, { status: string; records_synced: number | null; finished_at: string | null }>>({});
  const [syncLoading, setSyncLoading] = useState<Record<string, boolean>>({});
  const [syncError, setSyncError] = useState("");
  const [pendingSync, setPendingSync] = useState<"strava" | "garmin" | null>(null);

  // Competitions
  const [googleCredential, setGoogleCredential] = useState<string | null>(
    () => localStorage.getItem("google_credential")
  );
  const [competitions, setCompetitions] = useState<Competition[] | null>(null);
  const [competitionsLoading, setCompetitionsLoading] = useState(false);
  const [addForm, setAddForm] = useState({ competition: "", location: "", date: "", distance: "", time: "", rank: "", link: "" });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ competition: "", location: "", date: "", distance: "", time: "", rank: "", link: "" });

  // Goals
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [goalsLoading, setGoalsLoading] = useState(false);
  const [goalsError, setGoalsError] = useState("");
  const [goalsEditingId, setGoalsEditingId] = useState<number | null>(null);
  const [goalsEditForm, setGoalsEditForm] = useState({ description: "", achieved: false, result: "" });
  const [goalsAddForm, setGoalsAddForm] = useState({ year: String(new Date().getFullYear()), description: "", achieved: false, result: "" });
  const [goalsAddLoading, setGoalsAddLoading] = useState(false);

  // Calendar
  const [calendarDate, setCalendarDate] = useState<Date>(() => { const d = new Date(); d.setDate(1); return d; });
  const [calendarEvents, setCalendarEvents] = useState<GarminActivity[] | null>(null);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState("");

  // Gear management
  const [gearEditingId, setGearEditingId] = useState<number | null>(null);
  const [gearEditForm, setGearEditForm] = useState({ name: "", limit_km: "", image_url: "" });
  const [gearAddForm, setGearAddForm] = useState({ name: "", limit_km: "", image_url: "" });
  const [gearAddLoading, setGearAddLoading] = useState(false);
  const [gearError, setGearError] = useState("");

  useEffect(() => {
    if (activeTab === "calendar") {
      fetchCalendarEvents(calendarDate.getFullYear(), calendarDate.getMonth() + 1);
    }
  }, [calendarDate]);

  // Preload all data on mount
  useEffect(() => {
    fetchAllTime();
    fetchSyncStatus();
    fetchRuns();
    fetchRecords();
    fetchGarminMetrics();
    if (googleCredential) fetchCompetitions();
    fetchGoals();
  }, []);

  async function fetchGarminMetrics() {
    try {
      const res = await fetch("/api/garmin_metrics");
      if (res.ok) {
        const json = await res.json();
        if (json) setGarminMetrics(json);
      }
    } catch {
      // non-critical
    }
  }

  async function fetchSyncStatus() {
    try {
      const res = await fetch("/api/sync_status");
      if (res.ok) setSyncStatus(await res.json());
    } catch {
      // non-critical
    }
  }

  async function triggerSync(source: "strava" | "garmin", tokenOverride?: string) {
    const token = tokenOverride ?? googleCredential;
    if (!token) return;
    setSyncLoading((s) => ({ ...s, [source]: true }));
    setSyncError("");
    try {
      const res = await fetch(`/api/sync_${source}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      let json: { error?: string; synced?: number } = {};
      try { json = await res.json(); } catch { /* non-JSON response */ }
      if (res.status === 401 || res.status === 403) { handleLogout(); setPendingSync(source); openLoginPanel(); return; }
      if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`);
      await fetchSyncStatus();
      // Refresh data after sync
      fetchAllTime();
      if (source === "strava") { setRunsData(null); }
      if (source === "garmin") { setRecords(null); fetchGarminMetrics(); }
    } catch (e: unknown) {
      setSyncError(e instanceof Error ? friendlyError(e.message) : "Sync failed");
    } finally {
      setSyncLoading((s) => ({ ...s, [source]: false }));
    }
  }

  async function fetchAllTime() {
    if (allTimeLoading) return;
    setAllTimeLoading(true);
    setAllTimeError("");
    try {
      const res = await fetch("/api/stats?after_date=1970-01-01");
      const json: StatsResponse = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`);
      setAllTimeData(json);
    } catch (e: unknown) {
      setAllTimeError(e instanceof Error ? friendlyError(e.message) : "Unknown error");
    } finally {
      setAllTimeLoading(false);
    }
  }

  async function fetchRuns() {
    setRunsLoading(true);
    setRunsError("");
    setRunsData(null);
    try {
      const date = allTime ? "1970-01-01" : afterDate;
      const res = await fetch(`/api/stats?after_date=${date}`);
      const json: StatsResponse = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`);
      setRunsData(json);
    } catch (e: unknown) {
      setRunsError(e instanceof Error ? friendlyError(e.message) : "Unknown error");
    } finally {
      setRunsLoading(false);
    }
  }

  async function fetchCalendarEvents(year: number, month: number) {
    setCalendarLoading(true);
    setCalendarError("");
    try {
      const res = await fetch(`/api/garmin_calendar?year=${year}&month=${month}`);
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`);
      setCalendarEvents(json);
    } catch (e: unknown) {
      setCalendarError(e instanceof Error ? friendlyError(e.message) : "Unknown error");
      setCalendarEvents(null);
    } finally {
      setCalendarLoading(false);
    }
  }

  async function fetchRecords() {
    setRecordsLoading(true);
    try {
      const res = await fetch("/api/records");
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`);
      setRecords(json);
    } catch (e: unknown) {
      setAllTimeError(e instanceof Error ? friendlyError(e.message) : "Unknown error");
    } finally {
      setRecordsLoading(false);
    }
  }

  function openLoginPanel() {
    if (window.innerWidth < 1024) {
      setMenuOpen(true);
    } else {
      setProfileOpen(true);
    }
  }

  function handleGoogleSuccess(credentialResponse: { credential?: string }) {
    const token = credentialResponse.credential ?? null;
    setGoogleCredential(token);
    setAddError("");
    setSyncError("");
    if (token) localStorage.setItem("google_credential", token);
    if (!competitions && !competitionsLoading) fetchCompetitions(token);
    if (token && pendingSync) {
      const src = pendingSync;
      setPendingSync(null);
      setProfileOpen(false);
      setMenuOpen(false);
      triggerSync(src, token);
    }
  }

  function handleLogout() {
    googleLogout();
    setGoogleCredential(null);
    setCompetitions(null);
    localStorage.removeItem("google_credential");
  }

  function handle401(res: Response): boolean {
    if (res.status === 401 || res.status === 403) {
      handleLogout();
      openLoginPanel();
      return true;
    }
    return false;
  }

  async function fetchCompetitions(token?: string | null) {
    const t = token ?? googleCredential;
    setCompetitionsLoading(true);
    try {
      const res = await fetch("/api/competitions", {
        headers: { Authorization: `Bearer ${t}` },
      });
      const json = await res.json();
      if (handle401(res)) return;
      if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`);
      setCompetitions(json);
    } catch (e: unknown) {
      setAddError(e instanceof Error ? friendlyError(e.message) : "Unknown error");
    } finally {
      setCompetitionsLoading(false);
    }
  }

  async function addCompetition(e: React.FormEvent) {
    e.preventDefault();
    setAddLoading(true);
    setAddError("");
    try {
      const res = await fetch("/api/competitions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${googleCredential}`,
        },
        body: JSON.stringify(addForm),
      });
      const json = await res.json();
      if (handle401(res)) return;
      if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`);
      setCompetitions((prev) => [...(prev ?? []), json]);
      setAddForm({ competition: "", location: "", date: "", distance: "", time: "", rank: "", link: "" });
    } catch (e: unknown) {
      setAddError(e instanceof Error ? friendlyError(e.message) : "Unknown error");
    } finally {
      setAddLoading(false);
    }
  }

  async function saveEdit(id: number) {
    setAddError("");
    try {
      const res = await fetch("/api/competitions", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${googleCredential}`,
        },
        body: JSON.stringify({ id, ...editForm }),
      });
      const json = await res.json();
      if (handle401(res)) return;
      if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`);
      setCompetitions((prev) => prev?.map((c) => c.id === id ? json : c) ?? null);
      setEditingId(null);
    } catch (e: unknown) {
      setAddError(e instanceof Error ? friendlyError(e.message) : "Unknown error");
    }
  }

  async function saveGearEdit(id: number) {
    setGearError("");
    try {
      const res = await fetch("/api/gear", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${googleCredential}` },
        body: JSON.stringify({
          id,
          name: gearEditForm.name || undefined,
          limit_km: gearEditForm.limit_km ? Number(gearEditForm.limit_km) : null,
          image_url: gearEditForm.image_url || null,
        }),
      });
      const json = await res.json();
      if (handle401(res)) return;
      if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`);
      setGearEditingId(null);
      fetchAllTime();
    } catch (e: unknown) {
      setGearError(e instanceof Error ? friendlyError(e.message) : "Unknown error");
    }
  }

  async function addGear(e: React.FormEvent) {
    e.preventDefault();
    setGearAddLoading(true);
    setGearError("");
    try {
      const res = await fetch("/api/gear", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${googleCredential}` },
        body: JSON.stringify({
          name: gearAddForm.name,
          limit_km: gearAddForm.limit_km ? Number(gearAddForm.limit_km) : null,
          image_url: gearAddForm.image_url || null,
        }),
      });
      const json = await res.json();
      if (handle401(res)) return;
      if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`);
      setGearAddForm({ name: "", limit_km: "", image_url: "" });
      fetchAllTime();
    } catch (e: unknown) {
      setGearError(e instanceof Error ? friendlyError(e.message) : "Unknown error");
    } finally {
      setGearAddLoading(false);
    }
  }

  async function fetchGoals() {
    setGoalsLoading(true);
    setGoalsError("");
    try {
      const res = await fetch("/api/goals");
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`);
      setGoals(json);
    } catch (e: unknown) {
      setGoalsError(e instanceof Error ? friendlyError(e.message) : "Unknown error");
    } finally {
      setGoalsLoading(false);
    }
  }

  async function addGoal(e: React.FormEvent) {
    e.preventDefault();
    setGoalsAddLoading(true);
    setGoalsError("");
    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${googleCredential}` },
        body: JSON.stringify({
          year: Number(goalsAddForm.year),
          description: goalsAddForm.description,
          achieved: goalsAddForm.achieved,
          result: goalsAddForm.result || null,
        }),
      });
      const json = await res.json();
      if (handle401(res)) return;
      if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`);
      setGoals((prev) => {
        const updated = [...(prev ?? []), json as Goal];
        return updated.sort((a, b) => b.year - a.year || a.sort_order - b.sort_order);
      });
      setGoalsAddForm({ year: String(new Date().getFullYear()), description: "", achieved: false, result: "" });
    } catch (e: unknown) {
      setGoalsError(e instanceof Error ? friendlyError(e.message) : "Unknown error");
    } finally {
      setGoalsAddLoading(false);
    }
  }

  async function saveGoalEdit(id: number) {
    setGoalsError("");
    try {
      const res = await fetch("/api/goals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${googleCredential}` },
        body: JSON.stringify({ id, ...goalsEditForm }),
      });
      const json = await res.json();
      if (handle401(res)) return;
      if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`);
      setGoals((prev) => prev?.map((g) => g.id === id ? (json as Goal) : g) ?? null);
      setGoalsEditingId(null);
    } catch (e: unknown) {
      setGoalsError(e instanceof Error ? friendlyError(e.message) : "Unknown error");
    }
  }

  // Mileage tab
  const [mileageView, setMileageView] = useState<"yearly" | "monthly">("yearly");
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const yearlyKm: Record<string, number> = {};
  const monthlyKm: Record<string, number> = {};
  if (allTimeData) {
    for (const a of allTimeData.activities) {
      const year = a.date.slice(0, 4);
      const ym = a.date.slice(0, 7);
      yearlyKm[year] = (yearlyKm[year] || 0) + a.km;
      monthlyKm[ym] = (monthlyKm[ym] || 0) + a.km;
    }
  }
  const availableYears = Object.keys(yearlyKm).map(Number).sort((a, b) => b - a);

  // Runs tab
  const totalKm = runsData ? runsData.activities.reduce((sum, a) => sum + a.km, 0) : 0;
  const totalSec = runsData ? runsData.activities.reduce((sum, a) => sum + a.elapsed_sec, 0) : 0;
  const sortedActivities = runsData ? [...runsData.activities].sort((a, b) => b.date.localeCompare(a.date)) : [];

  const effortAvgMap = new Map<number, number | null>();
  if (runsData) {
    const withEffort = runsData.activities
      .filter((a) => a.relative_effort !== null)
      .map((a) => ({ date: a.date, effort: a.relative_effort as number, strava_id: a.strava_id }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const globalAvg = withEffort.length
      ? withEffort.reduce((s, x) => s + x.effort, 0) / withEffort.length
      : null;

    for (const act of withEffort) {
      const d = new Date(act.date);
      const cutoff = new Date(d);
      cutoff.setDate(cutoff.getDate() - 28);
      const window = withEffort.filter(
        (x) => x.strava_id !== act.strava_id && x.date > cutoff.toISOString().slice(0, 10) && x.date < act.date
      );
      const avg = window.length >= 2
        ? window.reduce((s, x) => s + x.effort, 0) / window.length
        : globalAvg;
      effortAvgMap.set(act.strava_id, avg);
    }
  }

  function effortColor(effort: number | null, avg: number | null): string | undefined {
    if (effort === null || avg === null) return undefined;
    const pct = (effort - avg) / avg * 100;
    if (pct <= -30) return "#1565c0";
    if (pct <= -15) return "#42a5f5";
    if (pct < 15) return undefined;
    if (pct < 35) return "#f9a825";
    if (pct < 55) return "#e65100";
    return "#c62828";
  }

  function trainingStatusStyle(status: string | null): React.CSSProperties {
    const s = (status ?? "").toLowerCase();
    if (s === "productive")   return { background: "#e8f5e9", color: "#2e7d32" };
    if (s === "peaking")      return { background: "#e3f2fd", color: "#1565c0" };
    if (s === "maintaining")  return { background: "#f5f5f5", color: "#555" };
    if (s === "recovery")     return { background: "#e0f7fa", color: "#00838f" };
    if (s === "unproductive") return { background: "#fff3e0", color: "#e65100" };
    if (s === "strained")     return { background: "#fff3e0", color: "#e65100" };
    if (s === "overreaching") return { background: "#ffebee", color: "#c62828" };
    return { background: "#f5f5f5", color: "#555" };
  }

  function hrvStatusStyle(status: string | null): React.CSSProperties {
    const s = (status ?? "").toLowerCase();
    if (s === "balanced")    return { background: "#e8f5e9", color: "#2e7d32" };
    if (s === "unbalanced")  return { background: "#fff3e0", color: "#e65100" };
    return { background: "#f5f5f5", color: "#555" };
  }

  function acwrFeedbackStyle(v: string | null): React.CSSProperties {
    const s = (v ?? "").toLowerCase();
    if (s === "very good") return { background: "#e8f5e9", color: "#2e7d32" };
    if (s === "good")      return { background: "#e8f5e9", color: "#2e7d32" };
    if (s === "moderate" || s === "fair") return { background: "#e3f2fd", color: "#1565c0" };
    if (s === "poor")      return { background: "#fff3e0", color: "#e65100" };
    if (s === "very poor") return { background: "#ffebee", color: "#c62828" };
    return { background: "#f5f5f5", color: "#555" };
  }

  function readinessLabel(v: number): string {
    if (v <= 25)  return "low";
    if (v <= 50)  return "fair";
    if (v <= 75)  return "good";
    return "high";
  }

  function readinessStyle(v: number): React.CSSProperties {
    if (v <= 25)  return { background: "#ffebee", color: "#c62828" };
    if (v <= 50)  return { background: "#fff3e0", color: "#e65100" };
    if (v <= 75)  return { background: "#e3f2fd", color: "#1565c0" };
    return { background: "#e8f5e9", color: "#2e7d32" };
  }

  const NAV_TABS = (["home", "runs", "yearly", "gear", "health", "calendar", "records"] as Tab[]);

  const [gearTooltip, setGearTooltip] = useState<{ name: string; imageUrl: string; top: number; left: number } | null>(null);

  function goTab(tab: Tab) {
    setActiveTab(tab);
    if (tab === "records" && !records && !recordsLoading) fetchRecords();
    if (tab === "competitions" && googleCredential && !competitions && !competitionsLoading) fetchCompetitions();
    if (tab === "goals" && !goals && !goalsLoading) fetchGoals();
    if (tab === "calendar") fetchCalendarEvents(calendarDate.getFullYear(), calendarDate.getMonth() + 1);
  }

  function syncLabel(src: "strava" | "garmin") {
    const s = syncStatus[src];
    if (syncLoading[src]) return "Syncing\u2026";
    if (!s) return `Sync ${src.charAt(0).toUpperCase() + src.slice(1)}`;
    if (s.status === "error") return `Sync ${src.charAt(0).toUpperCase() + src.slice(1)} \u2014 Error`;
    const ago = s.finished_at ? new Date(s.finished_at).toLocaleString() : "";
    return `Sync ${src.charAt(0).toUpperCase() + src.slice(1)}${ago ? ` \u00b7 ${ago}` : ""}`;
  }

  return (
    <>
      <nav className="navbar">
        <img src={LOGOS[logoIdx]} alt="McRun" className={`logo logo--link${logoFading ? " logo--fading" : ""}`} onClick={() => { setActiveTab("home"); cycleLogo(); }} />
        <div className="nav-tabs">
          {NAV_TABS.map((tab) => (
            <button
              key={tab}
              className={`nav-tab${activeTab === tab ? " active" : ""}`}
              onClick={() => goTab(tab)}
            >
              {TAB_META[tab].icon}
              {TAB_META[tab].label}
            </button>
          ))}
        </div>

        {/* Profile button — desktop */}
        <div className="profile-wrap">
          {(() => {
            const avatar = googleCredential ? decodeJwt(googleCredential).picture : null;
            return (
              <button
                className={`profile-btn${profileOpen ? " active" : ""}`}
                onClick={() => setProfileOpen((o) => !o)}
                aria-label="Account"
              >
                {avatar
                  ? <img src={avatar} className="profile-avatar" alt="profile" referrerPolicy="no-referrer" />
                  : <FaUser />}
              </button>
            );
          })()}
          {profileOpen && (
            <div className="profile-dropdown">
              {googleCredential ? (
                <>
                  {syncError && <p className="profile-error">{syncError}</p>}
                  {(["strava", "garmin"] as const).map((src) => (
                    <button key={src} className="profile-action" disabled={syncLoading[src]}
                      onClick={() => triggerSync(src)}>
                      <FaArrowsRotate className={syncLoading[src] ? "spin" : ""} />
                      <span>{syncLabel(src)}</span>
                    </button>
                  ))}
                  <div className="profile-divider" />
                  <button className="profile-action" onClick={() => { goTab("competitions"); setProfileOpen(false); }}>
                    <FaTrophy /><span>Competitions</span>
                  </button>
                  <button className="profile-action" onClick={() => { goTab("goals"); setProfileOpen(false); }}>
                    <FaBullseye /><span>Goals</span>
                  </button>
                  <div className="profile-divider" />
                  <button className="profile-action profile-signout" onClick={() => { handleLogout(); setProfileOpen(false); }}>
                    <FaRightFromBracket /><span>Sign out</span>
                  </button>
                </>
              ) : (
                <div className="profile-login">
                  <p>Sign in to sync data</p>
                  <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => setSyncError("Google sign-in failed")} />
                </div>
              )}
            </div>
          )}
        </div>

        <button className="hamburger" onClick={() => setMenuOpen(true)} aria-label="Open menu">
          <span /><span /><span />
        </button>
      </nav>

      {profileOpen && <div className="profile-overlay" onClick={() => setProfileOpen(false)} />}

      {menuOpen && (
        <div className="drawer-overlay" onClick={() => setMenuOpen(false)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            {NAV_TABS.map((tab) => (
              <button
                key={tab}
                className={`drawer-item${activeTab === tab ? " active" : ""}`}
                onClick={() => { goTab(tab); setMenuOpen(false); }}
              >
                {TAB_META[tab].icon}
                {TAB_META[tab].label}
              </button>
            ))}

            <div className="drawer-divider" />

            {googleCredential ? (
              <>
                {syncError && <p className="profile-error" style={{ padding: "0 1.5rem" }}>{syncError}</p>}
                {(["strava", "garmin"] as const).map((src) => (
                  <button key={src} className="drawer-item" disabled={syncLoading[src]}
                    onClick={() => triggerSync(src)}>
                    <FaArrowsRotate className={syncLoading[src] ? "spin" : ""} />
                    {syncLabel(src)}
                  </button>
                ))}
                <button
                  className={`drawer-item${activeTab === "competitions" ? " active" : ""}`}
                  onClick={() => { goTab("competitions"); setMenuOpen(false); }}
                >
                  <FaTrophy />Competitions
                </button>
                <button
                  className={`drawer-item${activeTab === "goals" ? " active" : ""}`}
                  onClick={() => { goTab("goals"); setMenuOpen(false); }}
                >
                  <FaBullseye />Goals
                </button>
                <button className="drawer-item drawer-signout" onClick={() => { handleLogout(); setMenuOpen(false); }}>
                  <FaRightFromBracket />Sign out
                </button>
              </>
            ) : (
              <div className="drawer-login">
                <p>Sign in to sync data</p>
                <GoogleLogin onSuccess={(c) => { handleGoogleSuccess(c); setMenuOpen(false); }} onError={() => setSyncError("Google sign-in failed")} />
              </div>
            )}
          </div>
        </div>
      )}

      <div className="container">
        <div className="tab-content" key={activeTab}>

          {/* ── HOME ── */}
          {activeTab === "home" && (
            <div className="home">
              <div className="home-card">
                <img src={LOGOS[logoIdx]} alt="McRun" className={`home-photo home-photo--clickable${logoFading ? " logo--fading" : ""}`} onClick={cycleLogo} />
                <blockquote className="home-quote">
                  <p className="home-quote-text">&ldquo;Pain is inevitable.<br />Suffering is optional.&rdquo;</p>
                  <footer className="home-quote-author">&mdash; Haruki Murakami</footer>
                </blockquote>
              </div>
            </div>
          )}

          {/* ── HEALTH ── */}
          {activeTab === "health" && (
            <div className="health-tiles">
              {!garminMetrics && <p className="health-empty">No data yet — sync Garmin to populate.</p>}
              {garminMetrics && (<>
                <div className="metric-card">
                  <span className="metric-label">VO₂ Max</span>
                  <span className="metric-value">{garminMetrics.vo2_max ?? "—"}</span>
                </div>
                {garminMetrics.fitness_age !== null && (
                  <div className="metric-card">
                    <span className="metric-label">Fitness age</span>
                    <span className="metric-value">{garminMetrics.fitness_age}</span>
                  </div>
                )}
                {garminMetrics.training_status && (
                  <div className="metric-card">
                    <span className="metric-label">Training status</span>
                    <span className="metric-badge" style={trainingStatusStyle(garminMetrics.training_status)}>
                      {garminMetrics.training_status}
                    </span>
                  </div>
                )}
                {garminMetrics.training_load !== null && (
                  <div className="metric-card">
                    <span className="metric-label">Chronic load</span>
                    <span className="metric-value">{Math.round(garminMetrics.training_load)}</span>
                  </div>
                )}
                {garminMetrics.acute_load !== null && (
                  <div className="metric-card">
                    <span className="metric-label">Acute load</span>
                    <span className="metric-value">{Math.round(garminMetrics.acute_load)}</span>
                  </div>
                )}
                {garminMetrics.acwr_feedback !== null && (
                  <div className="metric-card">
                    <span className="metric-label">Load balance</span>
                    <span className="metric-badge" style={acwrFeedbackStyle(garminMetrics.acwr_feedback)}>
                      {garminMetrics.acwr_feedback}
                    </span>
                    <span className="metric-sub">acute / chronic</span>
                  </div>
                )}
                {garminMetrics.hrv_last_night !== null && (
                  <div className="metric-card">
                    <span className="metric-label">HRV last night</span>
                    <span className="metric-value">{garminMetrics.hrv_last_night}</span>
                    {garminMetrics.hrv_weekly_avg !== null && (
                      <span className="metric-sub">Weekly avg {garminMetrics.hrv_weekly_avg}</span>
                    )}
                    {garminMetrics.hrv_status && (
                      <span className="metric-badge" style={hrvStatusStyle(garminMetrics.hrv_status)}>
                        {garminMetrics.hrv_status.toLowerCase()}
                      </span>
                    )}
                  </div>
                )}
                {garminMetrics.training_readiness !== null && (
                  <div className="metric-card">
                    <span className="metric-label">Training readiness</span>
                    <span className="metric-value">{garminMetrics.training_readiness}</span>
                    <span className="metric-sub">out of 100</span>
                    <span className="metric-badge" style={readinessStyle(garminMetrics.training_readiness)}>
                      {garminMetrics.readiness_level
                        ? garminMetrics.readiness_level.toLowerCase()
                        : readinessLabel(garminMetrics.training_readiness)}
                    </span>
                    {garminMetrics.readiness_feedback && (
                      <span className="metric-sub">{garminMetrics.readiness_feedback}</span>
                    )}
                  </div>
                )}
                {garminMetrics.sleep_score !== null && (
                  <div className="metric-card">
                    <span className="metric-label">Sleep score</span>
                    <span className="metric-value">{garminMetrics.sleep_score}</span>
                    <span className="metric-sub">out of 100</span>
                  </div>
                )}
                {garminMetrics.recovery_time !== null && garminMetrics.recovery_time > 0 && (
                  <div className="metric-card">
                    <span className="metric-label">Recovery time</span>
                    {(() => {
                      const totalMin = garminMetrics.recovery_time!;
                      const h = Math.floor(totalMin / 60);
                      const m = totalMin % 60;
                      return (
                        <span className="metric-value">
                          {h > 0 ? <>{h}<span style={{ fontSize: "0.6em", opacity: 0.7 }}>h</span>{m > 0 ? <> {m}<span style={{ fontSize: "0.6em", opacity: 0.7 }}>m</span></> : null}</> : <>{m}<span style={{ fontSize: "0.6em", opacity: 0.7 }}>m</span></>}
                        </span>
                      );
                    })()}
                  </div>
                )}
                {garminMetrics.resting_hr !== null && (
                  <div className="metric-card">
                    <span className="metric-label">Resting HR</span>
                    <span className="metric-value">{garminMetrics.resting_hr} <span style={{ fontSize: "0.6em", opacity: 0.7 }}>bpm</span></span>
                    {garminMetrics.resting_hr_7day && (() => {
                      const trend: { date: string; value: number | null }[] = (() => {
                        try { return JSON.parse(garminMetrics.resting_hr_7day!); } catch { return []; }
                      })();
                      const vals = trend.map(p => p.value).filter((v): v is number => v !== null);
                      if (vals.length < 2) return null;
                      const min = Math.min(...vals), max = Math.max(...vals);
                      const W = 80, H = 28, pad = 2;
                      const x = (i: number) => pad + (i / (vals.length - 1)) * (W - pad * 2);
                      const y = (v: number) => H - pad - ((v - min) / (max - min || 1)) * (H - pad * 2);
                      const points = vals.map((v, i) => `${x(i)},${y(v)}`).join(" ");
                      return (
                        <svg width={W} height={H} style={{ display: "block", margin: "6px auto 0" }}>
                          <polyline points={points} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
                        </svg>
                      );
                    })()}
                  </div>
                )}
                {(garminMetrics.race_5k || garminMetrics.race_10k || garminMetrics.race_hm || garminMetrics.race_marathon) && (
                  <div className="metric-card metric-card--wide">
                    <span className="metric-label">Race predictions</span>
                    <div className="predictions-grid">
                      {garminMetrics.race_5k && (
                        <div className="prediction-block">
                          <span className="prediction-dist">5K</span>
                          <span className="prediction-time">{garminMetrics.race_5k}</span>
                        </div>
                      )}
                      {garminMetrics.race_10k && (
                        <div className="prediction-block">
                          <span className="prediction-dist">10K</span>
                          <span className="prediction-time">{garminMetrics.race_10k}</span>
                        </div>
                      )}
                      {garminMetrics.race_hm && (
                        <div className="prediction-block">
                          <span className="prediction-dist">HM</span>
                          <span className="prediction-time">{garminMetrics.race_hm}</span>
                        </div>
                      )}
                      {garminMetrics.race_marathon && (
                        <div className="prediction-block">
                          <span className="prediction-dist">Marathon</span>
                          <span className="prediction-time">{garminMetrics.race_marathon}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div className="metric-card metric-card--muted">
                  <span className="metric-label">Last synced</span>
                  <span className="metric-sub">{garminMetrics.synced_at ? new Date(garminMetrics.synced_at).toLocaleString() : "—"}</span>
                </div>
              </>)}
            </div>
          )}

          {/* ── GEAR ── */}
          {activeTab === "gear" && (
            <>
              {allTimeError && <p className="error">{allTimeError}</p>}
              {allTimeLoading && <div className="loading-box">Loading…</div>}
              {!allTimeLoading && allTimeData && (
                <div className="table-compact">
                  {gearError && <p className="error">{gearError}</p>}
                  <table>
                    <thead>
                      <tr>
                        <th>Shoe</th>
                        <th>Total km</th>
                        <th>Limit km</th>
                        <th>Wear</th>
                        {googleCredential && <th></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(allTimeData.gear_summary)
                        .sort(([, a], [, b]) => b.total_km - a.total_km)
                        .map(([name, info]) => {
                          const wear = info.limit_km ? Math.round((info.total_km / info.limit_km) * 100) : null;
                          const wearColor = wear === null ? undefined
                            : wear < 50 ? "#2e7d32"
                            : wear < 70 ? "#f9a825"
                            : wear < 80 ? "#e65100"
                            : "#c62828";

                          if (googleCredential && gearEditingId === info.id) {
                            return (
                              <tr key={name}>
                                <td><input value={gearEditForm.name} onChange={(e) => setGearEditForm((f) => ({ ...f, name: e.target.value }))} style={{ width: "100%" }} /></td>
                                <td>{info.total_km.toFixed(2)}</td>
                                <td><input type="number" value={gearEditForm.limit_km} onChange={(e) => setGearEditForm((f) => ({ ...f, limit_km: e.target.value }))} style={{ width: 80 }} /></td>
                                <td>—</td>
                                <td style={{ display: "flex", gap: "0.4rem" }}>
                                  <button onClick={() => saveGearEdit(info.id)} style={{ padding: "0.25rem 0.6rem", fontSize: "0.8rem" }}>Save</button>
                                  <button onClick={() => setGearEditingId(null)} style={{ padding: "0.25rem 0.6rem", fontSize: "0.8rem", background: "#888" }}>✕</button>
                                </td>
                              </tr>
                            );
                          }

                          return (
                            <tr
                              key={name}
                              onMouseEnter={info.image_url ? (e) => {
                                const r = e.currentTarget.getBoundingClientRect();
                                setGearTooltip({ name, imageUrl: info.image_url!, top: r.top, left: r.right + 12 });
                              } : undefined}
                              onMouseLeave={info.image_url ? () => setGearTooltip(null) : undefined}
                              style={info.image_url ? { cursor: "default" } : undefined}
                            >
                              <td data-label="">{name}</td>
                              <td data-label="Total, km">{info.total_km.toFixed(2)}</td>
                              <td data-label="Limit, km">{info.limit_km ?? "—"}</td>
                              <td data-label="Wear" style={wearColor ? { color: wearColor, fontWeight: 600 } : {}}>
                                {wear !== null ? `${wear}%` : "—"}
                              </td>
                              {googleCredential && (
                                <td>
                                  <button
                                    onClick={() => { setGearEditingId(info.id); setGearEditForm({ name, limit_km: String(info.limit_km ?? ""), image_url: info.image_url ?? "" }); }}
                                    style={{ padding: "0.25rem 0.6rem", fontSize: "0.8rem", background: "transparent", color: "#888", border: "1px solid #ddd" }}
                                  >✎</button>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>

                  {googleCredential && (
                    <details style={{ marginTop: "1.5rem" }}>
                      <summary style={{ cursor: "pointer", marginBottom: "0.75rem" }}>Add shoe</summary>
                      <form onSubmit={addGear} style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxWidth: 420 }}>
                        <input placeholder="Shoe name" required value={gearAddForm.name} onChange={(e) => setGearAddForm((f) => ({ ...f, name: e.target.value }))} />
                        <input type="number" placeholder="Limit km (optional)" value={gearAddForm.limit_km} onChange={(e) => setGearAddForm((f) => ({ ...f, limit_km: e.target.value }))} />
                        <input placeholder="Image URL (optional)" value={gearAddForm.image_url} onChange={(e) => setGearAddForm((f) => ({ ...f, image_url: e.target.value }))} />
                        <button type="submit" disabled={gearAddLoading}>{gearAddLoading ? "Saving…" : "Add"}</button>
                      </form>
                    </details>
                  )}
                </div>
              )}
              {gearTooltip && (
                <div
                  className="gear-tooltip"
                  style={{ top: gearTooltip.top, left: gearTooltip.left }}
                >
                  <img src={gearTooltip.imageUrl} alt={gearTooltip.name} />
                  <span>{gearTooltip.name}</span>
                </div>
              )}
            </>
          )}

          {/* ── RUNS ── */}
          {activeTab === "runs" && (
            <>
              <div className="controls">
                <label>
                  Start date:
                  <input
                    type="date"
                    value={afterDate}
                    onChange={(e) => setAfterDate(e.target.value)}
                    disabled={allTime}
                  />
                </label>
                <label className="all-time-label">
                  <input
                    type="checkbox"
                    checked={allTime}
                    onChange={(e) => setAllTime(e.target.checked)}
                  />
                  All time
                </label>
                <button onClick={fetchRuns} disabled={runsLoading}>
                  {runsLoading ? "Loading…" : "Load"}
                </button>
              </div>
              {runsError && <p className="error">{runsError}</p>}
              {runsLoading && <div className="loading-box">Loading…</div>}
              {runsData && (
                <>
                  <p className="runs-summary">
                    {totalKm.toFixed(2)} km &mdash; {formatDuration(totalSec)}
                  </p>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Name</th>
                          <th>Dist / km</th>
                          <th>Time</th>
                          <th>Pace / min/km</th>
                          <th>HR / bpm</th>
                          <th>Elev / m</th>
                          <th>Effort</th>
                          <th>Gear</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedActivities.map((a, i) => (
                          <tr key={i}>
                            <td data-label="Date">{a.date.split("-").reverse().join(".")}</td>
                            <td data-label="Name">
                              <a href={`https://www.strava.com/activities/${a.strava_id}`} target="_blank" rel="noopener noreferrer">
                                {a.name}
                              </a>
                            </td>
                            <td data-label="Dist / km">{a.km.toFixed(2)}</td>
                            <td data-label="Time">{formatDuration(a.elapsed_sec)}</td>
                            <td data-label="Pace / min/km">{a.avg_pace ?? "—"}</td>
                            <td data-label="HR / bpm">{a.avg_hr ?? "—"}</td>
                            <td data-label="Elev / m">{a.elevation ?? "—"}</td>
                            <td
                              data-label="Effort"
                              style={{
                                color: effortColor(a.relative_effort, effortAvgMap.get(a.strava_id) ?? null),
                                fontWeight: effortColor(a.relative_effort, effortAvgMap.get(a.strava_id) ?? null) ? 600 : undefined,
                              }}
                            >
                              {a.relative_effort ?? "—"}
                            </td>
                            <td data-label="Gear">{a.gear}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}

          {/* ── YEARLY ── */}
          {activeTab === "yearly" && (
            <>
              {allTimeError && <p className="error">{allTimeError}</p>}
              {allTimeLoading && <div className="loading-box">Loading…</div>}
              {!allTimeLoading && allTimeData && (
                <>
                  <div className="mileage-controls">
                    <div className="view-toggle">
                      <button
                        className={mileageView === "yearly" ? "active" : ""}
                        onClick={() => setMileageView("yearly")}
                      >Yearly</button>
                      <button
                        className={mileageView === "monthly" ? "active" : ""}
                        onClick={() => setMileageView("monthly")}
                      >Monthly</button>
                    </div>
                    {mileageView === "monthly" && (
                      <div className="year-selector">
                        {availableYears.map(y => (
                          <button
                            key={y}
                            className={selectedYear === y ? "active" : ""}
                            onClick={() => setSelectedYear(y)}
                          >{y}</button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="yearly-chart-wrap">
                    {mileageView === "yearly"
                      ? <YearlyChart data={yearlyKm} />
                      : <MonthlyChart data={monthlyKm} year={selectedYear} />
                    }
                  </div>
                </>
              )}
            </>
          )}

          {/* ── RECORDS ── */}
          {activeTab === "records" && (
            <div className="table-compact">
              {recordsLoading && <div className="loading-box">Loading…</div>}
              {!recordsLoading && records && (
                <table>
                  <thead>
                    <tr>
                      <th>Distance</th>
                      <th>Time</th>
                      <th>Pace / min/km</th>
                      <th>Date</th>
                      <th>Activity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r) => (
                      <tr key={r.label}>
                        <td data-label="Distance">{r.label}</td>
                        <td data-label="Time">{r.time}</td>
                        <td data-label="Pace / min/km">{r.pace}</td>
                        <td data-label="Date">{r.date.split("-").reverse().join(".")}</td>
                        <td data-label="Activity">
                          <a href={`https://connect.garmin.com/modern/activity/${r.activity_id}`} target="_blank" rel="noopener noreferrer">
                            {r.activity_name || "Garmin"}
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── COMPETITIONS ── */}
          {activeTab === "competitions" && (
            <div>
              {!googleCredential ? (
                <div style={{ textAlign: "center", padding: "2rem" }}>
                  <p style={{ marginBottom: "1rem" }}>Sign in to view competitions</p>
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => setAddError("Google sign-in failed")}
                  />
                </div>
              ) : (
                <>
                  {competitionsLoading && <div className="loading-box">Loading…</div>}
                  {addError && <p className="error">{addError}</p>}
                  {!competitionsLoading && competitions && (
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Competition</th>
                            <th>Location</th>
                            <th>Date</th>
                            <th>Distance</th>
                            <th>Time</th>
                            <th>Rank</th>
                            <th>Results</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {competitions.map((c, i) => editingId === c.id ? (
                            <tr key={c.id}>
                              <td>{i + 1}</td>
                              <td><input value={editForm.competition} onChange={(e) => setEditForm((f) => ({ ...f, competition: e.target.value }))} style={{ width: "100%" }} /></td>
                              <td><input value={editForm.location} onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))} style={{ width: "100%" }} /></td>
                              <td><input type="date" value={editForm.date} onChange={(e) => setEditForm((f) => ({ ...f, date: e.target.value }))} /></td>
                              <td><input value={editForm.distance} onChange={(e) => setEditForm((f) => ({ ...f, distance: e.target.value }))} style={{ width: 80 }} /></td>
                              <td><input value={editForm.time} onChange={(e) => setEditForm((f) => ({ ...f, time: e.target.value }))} style={{ width: 80 }} /></td>
                              <td><input value={editForm.rank} onChange={(e) => setEditForm((f) => ({ ...f, rank: e.target.value }))} style={{ width: 90 }} /></td>
                              <td><input value={editForm.link} onChange={(e) => setEditForm((f) => ({ ...f, link: e.target.value }))} style={{ width: 120 }} /></td>
                              <td style={{ display: "flex", gap: "0.4rem" }}>
                                <button onClick={() => saveEdit(c.id)} style={{ padding: "0.25rem 0.6rem", fontSize: "0.8rem" }}>Save</button>
                                <button onClick={() => setEditingId(null)} style={{ padding: "0.25rem 0.6rem", fontSize: "0.8rem", background: "#888" }}>✕</button>
                              </td>
                            </tr>
                          ) : (
                            <tr key={c.id}>
                              <td data-label="#">{i + 1}</td>
                              <td data-label="Competition">{c.competition}</td>
                              <td data-label="Location">{c.location ?? "—"}</td>
                              <td data-label="Date">{c.date.split("-").reverse().join(".")}</td>
                              <td data-label="Distance">{c.distance}</td>
                              <td data-label="Time">{c.time ?? "—"}</td>
                              <td data-label="Rank">{c.rank ?? "—"}</td>
                              <td data-label="Results">
                                {c.link ? (
                                  <a href={c.link} target="_blank" rel="noopener noreferrer"><FaArrowUpRightFromSquare /></a>
                                ) : "—"}
                              </td>
                              <td>
                                <button
                                  onClick={() => { setEditingId(c.id); setEditForm({ competition: c.competition, location: c.location ?? "", date: c.date, distance: c.distance, time: c.time ?? "", rank: c.rank ?? "", link: c.link ?? "" }); }}
                                  style={{ padding: "0.25rem 0.6rem", fontSize: "0.8rem", background: "transparent", color: "#888", border: "1px solid #ddd" }}
                                >✎</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <details style={{ marginTop: "1.5rem" }}>
                    <summary style={{ cursor: "pointer", marginBottom: "0.75rem" }}>Add competition</summary>
                    <form onSubmit={addCompetition} style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxWidth: 420 }}>
                      <input placeholder="Competition name" required value={addForm.competition} onChange={(e) => setAddForm((f) => ({ ...f, competition: e.target.value }))} />
                      <input placeholder="Location (e.g. Moscow)" value={addForm.location} onChange={(e) => setAddForm((f) => ({ ...f, location: e.target.value }))} />
                      <input type="date" required value={addForm.date} onChange={(e) => setAddForm((f) => ({ ...f, date: e.target.value }))} />
                      <input placeholder="Distance (e.g. 10 km)" required value={addForm.distance} onChange={(e) => setAddForm((f) => ({ ...f, distance: e.target.value }))} />
                      <input placeholder="Time (e.g. 0:58:34)" value={addForm.time} onChange={(e) => setAddForm((f) => ({ ...f, time: e.target.value }))} />
                      <input placeholder="Rank (e.g. 136 (191))" value={addForm.rank} onChange={(e) => setAddForm((f) => ({ ...f, rank: e.target.value }))} />
                      <input placeholder="Link (optional)" value={addForm.link} onChange={(e) => setAddForm((f) => ({ ...f, link: e.target.value }))} />
                      <button type="submit" disabled={addLoading}>{addLoading ? "Saving…" : "Add"}</button>
                    </form>
                  </details>
                </>
              )}
            </div>
          )}

          {/* ── GOALS ── */}
          {activeTab === "goals" && (() => {
            const yearGroups: Record<number, Goal[]> = {};
            (goals ?? []).forEach((g) => {
              if (!yearGroups[g.year]) yearGroups[g.year] = [];
              yearGroups[g.year].push(g);
            });
            const sortedYears = Object.keys(yearGroups).map(Number).sort((a, b) => b - a);
            return (
              <div className="goals-wrap">
                {goalsLoading && <div className="loading-box">Loading…</div>}
                {goalsError && <p className="error">{goalsError}</p>}
                {sortedYears.map((yr) => {
                  const items = yearGroups[yr];
                  const doneCount = items.filter((g) => g.achieved).length;
                  const pct = items.length ? Math.round((doneCount / items.length) * 100) : 0;
                  const allDone = doneCount === items.length;
                  return (
                    <div key={yr} className="goals-year">
                      <div className="goals-year-header">
                        <span className="goals-year-label">{yr}</span>
                        <div className="goals-progress">
                          <div className="goals-progress-fill" style={{ width: `${pct}%`, background: allDone ? "var(--clr-green)" : "var(--clr-accent)" }} />
                        </div>
                        <span className="goals-year-count">{doneCount}/{items.length}</span>
                      </div>
                      <div className="goals-list">
                        {items.map((g) => goalsEditingId === g.id ? (
                          <div key={g.id} className="goal-card goal-card--editing">
                            <label className="goal-check-wrap">
                              <input type="checkbox" checked={goalsEditForm.achieved}
                                onChange={(e) => setGoalsEditForm((f) => ({ ...f, achieved: e.target.checked }))} />
                            </label>
                            <div className="goal-edit-fields">
                              <input value={goalsEditForm.description}
                                onChange={(e) => setGoalsEditForm((f) => ({ ...f, description: e.target.value }))}
                                style={{ flex: 1 }} placeholder="Description" />
                              <input value={goalsEditForm.result}
                                onChange={(e) => setGoalsEditForm((f) => ({ ...f, result: e.target.value }))}
                                style={{ width: 90 }} placeholder="Result" />
                            </div>
                            <div style={{ display: "flex", gap: "0.4rem" }}>
                              <button onClick={() => saveGoalEdit(g.id)} style={{ padding: "0.25rem 0.6rem", fontSize: "0.8rem" }}>Save</button>
                              <button onClick={() => setGoalsEditingId(null)} style={{ padding: "0.25rem 0.6rem", fontSize: "0.8rem", background: "#888" }}>✕</button>
                            </div>
                          </div>
                        ) : (
                          <div key={g.id} className={`goal-card${g.achieved ? " goal-card--done" : ""}`}>
                            <div className={`goal-check${g.achieved ? " goal-check--done" : ""}`}>
                              {g.achieved ? "✓" : ""}
                            </div>
                            <span className="goal-desc">{g.description}</span>
                            {g.result && <span className="goal-result">{g.result}</span>}
                            {googleCredential && (
                              <button className="goal-edit-btn" onClick={() => {
                                setGoalsEditingId(g.id);
                                setGoalsEditForm({ description: g.description, achieved: g.achieved, result: g.result ?? "" });
                              }}>✎</button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {googleCredential && (
                  <details style={{ marginTop: "1.5rem" }}>
                    <summary style={{ cursor: "pointer", marginBottom: "0.75rem" }}>Add goal</summary>
                    <form onSubmit={addGoal} style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxWidth: 420 }}>
                      <input type="number" placeholder="Year" required value={goalsAddForm.year}
                        onChange={(e) => setGoalsAddForm((f) => ({ ...f, year: e.target.value }))} />
                      <input placeholder="Description" required value={goalsAddForm.description}
                        onChange={(e) => setGoalsAddForm((f) => ({ ...f, description: e.target.value }))} />
                      <input placeholder="Result (optional, e.g. 49:03)" value={goalsAddForm.result}
                        onChange={(e) => setGoalsAddForm((f) => ({ ...f, result: e.target.value }))} />
                      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem" }}>
                        <input type="checkbox" checked={goalsAddForm.achieved}
                          onChange={(e) => setGoalsAddForm((f) => ({ ...f, achieved: e.target.checked }))} />
                        Achieved
                      </label>
                      <button type="submit" disabled={goalsAddLoading}>{goalsAddLoading ? "Saving…" : "Add"}</button>
                    </form>
                  </details>
                )}
              </div>
            );
          })()}

          {/* ── CALENDAR ── */}
          {activeTab === "calendar" && (() => {
            const year = calendarDate.getFullYear();
            const month = calendarDate.getMonth(); // 0-based
            const firstDow = new Date(year, month, 1).getDay(); // 0=Sun
            const startOffset = (firstDow + 6) % 7; // convert to Mon-first
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const cells: (number | null)[] = [...Array(startOffset).fill(null)];
            for (let d = 1; d <= daysInMonth; d++) cells.push(d);
            const todayStr = new Date().toISOString().slice(0, 10);

            // Group events by date
            const eventsByDate: Record<string, GarminActivity[]> = {};
            (calendarEvents || []).forEach((e) => {
              if (!eventsByDate[e.date]) eventsByDate[e.date] = [];
              eventsByDate[e.date].push(e);
            });

            function activityColor(type: string) {
              if (type.includes("running") || type === "run") return "cal-run";
              if (type.includes("cycling") || type.includes("bike")) return "cal-bike";
              if (type.includes("swimming") || type === "swim") return "cal-swim";
              if (type.includes("strength") || type.includes("training")) return "cal-strength";
              return "cal-other";
            }

            return (
              <div className="calendar-wrap">
                <div className="calendar-nav">
                  <button className="calendar-nav-btn" onClick={() => {
                    const d = new Date(calendarDate);
                    d.setMonth(d.getMonth() - 1);
                    setCalendarDate(new Date(d));
                  }}>‹</button>
                  <span className="calendar-title">
                    {calendarDate.toLocaleString("default", { month: "long" })} {year}
                  </span>
                  <button className="calendar-nav-btn" onClick={() => {
                    const d = new Date(calendarDate);
                    d.setMonth(d.getMonth() + 1);
                    setCalendarDate(new Date(d));
                  }}>›</button>
                </div>
                {calendarLoading && <div className="loading-box">Loading…</div>}
                {calendarError && <p className="error">{calendarError}</p>}
                {!calendarLoading && (
                  <>
                    {(calendarEvents === null || calendarEvents.length === 0) && (
                      <p className="health-empty" style={{ textAlign: "center", marginBottom: "1rem" }}>
                        {calendarEvents === null ? "No data — sync Garmin to populate." : "No planned workouts this month."}
                      </p>
                    )}
                    <div className="calendar-grid">
                      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                        <div key={d} className="calendar-dow">{d}</div>
                      ))}
                      {cells.map((day, i) => {
                        if (day === null) return <div key={i} className="calendar-cell calendar-cell--empty" />;
                        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                        const events = eventsByDate[dateStr] || [];
                        const isToday = dateStr === todayStr;
                        return (
                          <div key={i} className={`calendar-cell${isToday ? " calendar-cell--today" : ""}${events.length ? " calendar-cell--has-events" : ""}`}>
                            <span className="calendar-day-num">{day}</span>
                            {events.map((ev, j) => (
                              <span key={j} className={`calendar-event ${activityColor(ev.activity_type)}`} title={ev.name}>
                                {ev.distance_km > 0 ? `${ev.distance_km.toFixed(1)}` : "·"}
                                {ev.aerobic_te !== null && <span className="cal-te">↑{ev.aerobic_te.toFixed(1)}</span>}
                              </span>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            );
          })()}

        </div>
      </div>

<footer className="site-footer">
        &copy; 2026 McWay.
      </footer>
    </>
  );
}
