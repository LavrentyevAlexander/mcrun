import { useState, useEffect, useRef } from "react";
import { GoogleLogin, googleLogout } from "@react-oauth/google";
import { FaHouse, FaPersonRunning, FaCalendarDays, FaTrophy, FaBolt, FaUser, FaArrowsRotate, FaRightFromBracket } from "react-icons/fa6";
import { GiRunningShoe } from "react-icons/gi";
import "./App.css";

const TAB_META: Record<string, { label: string; icon: React.ReactNode }> = {
  home:         { label: "Home",           icon: <FaHouse /> },
  runs:         { label: "Run History",    icon: <FaPersonRunning /> },
  yearly:       { label: "Yearly Mileage", icon: <FaCalendarDays /> },
  gear:         { label: "Gear",           icon: <GiRunningShoe /> },
  competitions: { label: "Competitions",   icon: <FaTrophy /> },
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
  date: string;
  distance: string;
  time: string | null;
  rank: string | null;
  link: string | null;
}

type Tab = "home" | "runs" | "yearly" | "gear" | "competitions" | "records";

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
    return "Strava rate limit reached. Please try again in 15 minutes.";
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
  const PAD = { top: 28, right: 40, bottom: 64, left: 72 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const maxKm = Math.max(...entries.map(([, km]) => km));
  const yMax = Math.ceil(maxKm / 500) * 500 || 500;

  const toX = (i: number) => PAD.left + (entries.length > 1 ? (i / (entries.length - 1)) * plotW : plotW / 2);
  const toY = (km: number) => PAD.top + plotH - (km / yMax) * plotH;

  const axisBottom = PAD.top + plotH;
  const points = entries.map(([year, km], i) => ({ year, km, x: toX(i), y: toY(km) }));
  const polyline = points.map(p => `${p.x},${p.y}`).join(" ");

  const gridSteps = 5;
  const gridLines = Array.from({ length: gridSteps + 1 }, (_, i) => {
    const km = Math.round((yMax / gridSteps) * i);
    return { km, y: toY(km) };
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="yearly-chart">
      <defs>
        {/* Arrowhead pointing right (X axis) */}
        <marker id="arr-x" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#ccc" />
        </marker>
        {/* Arrowhead pointing up (Y axis) */}
        <marker id="arr-y" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#ccc" />
        </marker>
      </defs>

      {/* Horizontal grid lines + Y tick labels */}
      {gridLines.map(({ km, y }) => (
        <g key={km}>
          <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
            stroke={km === 0 ? "transparent" : "#e8e8e8"} strokeWidth="1" strokeDasharray={km === 0 ? undefined : "4 3"} />
          <text x={PAD.left - 10} y={y} textAnchor="end" dominantBaseline="middle" fontSize="11" fill="#aaa">
            {km}
          </text>
        </g>
      ))}

      {/* Vertical grid lines at each data point */}
      {points.map(({ year, x }) => (
        <line key={`vg-${year}`}
          x1={x} y1={PAD.top} x2={x} y2={axisBottom}
          stroke="#e8e8e8" strokeWidth="1" strokeDasharray="4 3"
        />
      ))}

      {/* Y axis */}
      <line
        x1={PAD.left} y1={axisBottom}
        x2={PAD.left} y2={PAD.top - 8}
        stroke="#ccc" strokeWidth="1.5"
        markerEnd="url(#arr-y)"
      />
      {/* X axis */}
      <line
        x1={PAD.left} y1={axisBottom}
        x2={W - PAD.right + 8} y2={axisBottom}
        stroke="#ccc" strokeWidth="1.5"
        markerEnd="url(#arr-x)"
      />

      {/* Y axis label */}
      <text
        transform={`rotate(-90)`}
        x={-(PAD.top + plotH / 2)}
        y={18}
        textAnchor="middle"
        fontSize="12"
        fill="#aaa"
      >
        km
      </text>

      {/* X axis label */}
      <text
        x={PAD.left + plotW / 2}
        y={H - 8}
        textAnchor="middle"
        fontSize="12"
        fill="#aaa"
      >
        Year
      </text>

      {/* Data line */}
      <polyline points={polyline} fill="none" stroke="#fc4c02" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

      {/* Data points + labels */}
      {points.map(({ year, km, x, y }) => (
        <g key={year}>
          <circle cx={x} cy={y} r="5" fill="#fc4c02" />
          <text x={x} y={y - 13} textAnchor="middle" fontSize="12" fontWeight="600" fill="#555">
            {Math.round(km)}
          </text>
          {/* X tick */}
          <line x1={x} y1={axisBottom} x2={x} y2={axisBottom + 4} stroke="#ccc" strokeWidth="1" />
          <text x={x} y={axisBottom + 18} textAnchor="middle" fontSize="11" fill="#aaa">
            {year}
          </text>
        </g>
      ))}
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

  // Competitions
  const [googleCredential, setGoogleCredential] = useState<string | null>(
    () => localStorage.getItem("google_credential")
  );
  const [competitions, setCompetitions] = useState<Competition[] | null>(null);
  const [competitionsLoading, setCompetitionsLoading] = useState(false);
  const [addForm, setAddForm] = useState({ competition: "", date: "", distance: "", time: "", rank: "", link: "" });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ competition: "", date: "", distance: "", time: "", rank: "", link: "" });

  // Gear management
  const [gearEditingId, setGearEditingId] = useState<number | null>(null);
  const [gearEditForm, setGearEditForm] = useState({ name: "", limit_km: "", image_url: "" });
  const [gearAddForm, setGearAddForm] = useState({ name: "", limit_km: "", image_url: "" });
  const [gearAddLoading, setGearAddLoading] = useState(false);
  const [gearError, setGearError] = useState("");

  // Preload all data on mount
  useEffect(() => {
    fetchAllTime();
    fetchSyncStatus();
    fetchRuns();
    fetchRecords();
    fetchGarminMetrics();
    if (googleCredential) fetchCompetitions();
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

  async function triggerSync(source: "strava" | "garmin") {
    if (!googleCredential) return;
    setSyncLoading((s) => ({ ...s, [source]: true }));
    setSyncError("");
    try {
      const res = await fetch(`/api/sync_${source}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${googleCredential}` },
      });
      let json: { error?: string; synced?: number } = {};
      try { json = await res.json(); } catch { /* non-JSON response */ }
      if (res.status === 401 || res.status === 403) { handleLogout(); throw new Error("Session expired. Please sign in again."); }
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

  function handleGoogleSuccess(credentialResponse: { credential?: string }) {
    const token = credentialResponse.credential ?? null;
    setGoogleCredential(token);
    setAddError("");
    setSyncError("");
    if (token) localStorage.setItem("google_credential", token);
    if (!competitions && !competitionsLoading) fetchCompetitions(token);
  }

  function handleLogout() {
    googleLogout();
    setGoogleCredential(null);
    setCompetitions(null);
    localStorage.removeItem("google_credential");
  }

  async function fetchCompetitions(token?: string | null) {
    const t = token ?? googleCredential;
    setCompetitionsLoading(true);
    try {
      const res = await fetch("/api/competitions", {
        headers: { Authorization: `Bearer ${t}` },
      });
      const json = await res.json();
      if (res.status === 401 || res.status === 403) {
        handleLogout();
        throw new Error("Session expired. Please sign in again.");
      }
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
      if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`);
      setCompetitions((prev) => [...(prev ?? []), json]);
      setAddForm({ competition: "", date: "", distance: "", time: "", rank: "", link: "" });
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
      if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`);
      setGearAddForm({ name: "", limit_km: "", image_url: "" });
      fetchAllTime();
    } catch (e: unknown) {
      setGearError(e instanceof Error ? friendlyError(e.message) : "Unknown error");
    } finally {
      setGearAddLoading(false);
    }
  }

  // Yearly km from all-time data
  const yearlyKm: Record<string, number> = {};
  if (allTimeData) {
    for (const a of allTimeData.activities) {
      const year = a.date.slice(0, 4);
      yearlyKm[year] = (yearlyKm[year] || 0) + a.km;
    }
  }

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

    for (const act of withEffort) {
      const d = new Date(act.date);
      const cutoff = new Date(d);
      cutoff.setDate(cutoff.getDate() - 28);
      const window = withEffort.filter(
        (x) => x.strava_id !== act.strava_id && x.date > cutoff.toISOString().slice(0, 10) && x.date < act.date
      );
      effortAvgMap.set(act.strava_id, window.length >= 2 ? window.reduce((s, x) => s + x.effort, 0) / window.length : null);
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

  const NAV_TABS = (["home", "runs", "yearly", "gear", "records"] as Tab[]);

  const [gearTooltip, setGearTooltip] = useState<{ name: string; imageUrl: string; top: number; left: number } | null>(null);

  function goTab(tab: Tab) {
    setActiveTab(tab);
    if (tab === "records" && !records && !recordsLoading) fetchRecords();
    if (tab === "competitions" && googleCredential && !competitions && !competitionsLoading) fetchCompetitions();
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
        <img src="/logo.png" alt="McRun" className="logo logo--link" onClick={() => setActiveTab("home")} />
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
              {garminMetrics && (
                <div className="home-metrics">
                  {garminMetrics.vo2_max !== null && (
                    <div className="metric-card">
                      <span className="metric-label">VO₂ Max</span>
                      <span className="metric-value">{garminMetrics.vo2_max}</span>
                      {garminMetrics.fitness_age !== null && (
                        <span className="metric-sub">Fitness age {garminMetrics.fitness_age}</span>
                      )}
                    </div>
                  )}
                  {garminMetrics.training_status && (
                    <div className="metric-card">
                      <span className="metric-label">Status</span>
                      <span className="metric-badge" style={trainingStatusStyle(garminMetrics.training_status)}>
                        {garminMetrics.training_status.toLowerCase()}
                      </span>
                    </div>
                  )}
                  {(garminMetrics.training_load !== null || garminMetrics.acute_load !== null) && (
                    <div className="metric-card">
                      <span className="metric-label">Load</span>
                      <span className="metric-value">{garminMetrics.training_load !== null ? Math.round(garminMetrics.training_load) : "—"}</span>
                      {garminMetrics.acute_load !== null && (
                        <span className="metric-sub">Acute {Math.round(garminMetrics.acute_load)}</span>
                      )}
                    </div>
                  )}
                  {garminMetrics.hrv_last_night !== null && (
                    <div className="metric-card">
                      <span className="metric-label">HRV</span>
                      <span className="metric-value">{garminMetrics.hrv_last_night}</span>
                      {garminMetrics.hrv_status && (
                        <span className="metric-badge" style={hrvStatusStyle(garminMetrics.hrv_status)}>
                          {garminMetrics.hrv_status.toLowerCase()}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="home-card">
                <img src="/logo.png" alt="McRun" className="home-photo" />
                <blockquote className="home-quote">
                  <p className="home-quote-text">&ldquo;Pain is inevitable.<br />Suffering is optional.&rdquo;</p>
                  <footer className="home-quote-author">&mdash; Haruki Murakami</footer>
                </blockquote>
              </div>
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
                              <td data-label="Total km">{info.total_km.toFixed(2)}</td>
                              <td data-label="Limit km">{info.limit_km ?? "—"}</td>
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
                            <td data-label="Date">{a.date}</td>
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
                <div className="yearly-chart-wrap">
                  <YearlyChart data={yearlyKm} />
                </div>
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
                        <td data-label="Date">{r.date}</td>
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
                              <td data-label="Date">{c.date}</td>
                              <td data-label="Distance">{c.distance}</td>
                              <td data-label="Time">{c.time ?? "—"}</td>
                              <td data-label="Rank">{c.rank ?? "—"}</td>
                              <td data-label="Results">
                                {c.link ? (
                                  <a href={c.link} target="_blank" rel="noopener noreferrer">link</a>
                                ) : "—"}
                              </td>
                              <td>
                                <button
                                  onClick={() => { setEditingId(c.id); setEditForm({ competition: c.competition, date: c.date, distance: c.distance, time: c.time ?? "", rank: c.rank ?? "", link: c.link ?? "" }); }}
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

        </div>
      </div>

<footer className="site-footer">
        &copy; 2026 McWay.
      </footer>
    </>
  );
}
