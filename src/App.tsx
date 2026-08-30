import { useState, useEffect, useRef } from "react";
import { googleLogout } from "@react-oauth/google";
import "./App.css";
import type { GarminActivity, GarminMetrics, GarminRecord, Competition, Goal, GoalStatus, StatsResponse, Tab } from "./types";
import { localDateStr, friendlyError, defaultDate } from "./utils";

import HomeTab from "./components/tabs/HomeTab";
import RecordsTab from "./components/tabs/RecordsTab";
import HealthTab from "./components/tabs/HealthTab";
import CalendarTab from "./components/tabs/CalendarTab";
import YearlyTab from "./components/tabs/YearlyTab";
import RunsTab from "./components/tabs/RunsTab";
import GearTab from "./components/tabs/GearTab";
import CompetitionsTab from "./components/tabs/CompetitionsTab";
import GoalsTab from "./components/tabs/GoalsTab";
import Drawer from "./components/Drawer";
import Navbar from "./components/Navbar";

const VALID_TABS = new Set<Tab>(["home", "runs", "yearly", "gear", "health", "calendar", "competitions", "goals", "records"]);

function tabFromHash(): Tab {
  const hash = window.location.hash.slice(1) as Tab;
  return VALID_TABS.has(hash) ? hash : "home";
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>(tabFromHash);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  // Garmin fitness metrics (home page)
  const [garminMetrics, setGarminMetrics] = useState<GarminMetrics | null>(null);

  // All-time data: Gear + Yearly + Home stats
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
  const pendingSyncRef = useRef<"strava" | "garmin" | null>(null);

  // Competitions
  const [googleCredential, setGoogleCredential] = useState<string | null>(
    () => localStorage.getItem("google_credential")
  );
  const [competitions, setCompetitions] = useState<Competition[] | null>(null);
  const [competitionsLoading, setCompetitionsLoading] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");

  // Goals
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [goalsLoading, setGoalsLoading] = useState(false);
  const [goalsError, setGoalsError] = useState("");
  const [goalsAddLoading, setGoalsAddLoading] = useState(false);

  // Calendar
  const [calendarEvents, setCalendarEvents] = useState<GarminActivity[] | null>(null);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState("");

  const [gearError, setGearError] = useState("");

  // Track which tabs have been initialized to avoid redundant fetches
  const initializedTabs = useRef<Set<Tab>>(new Set());

  // Sync URL hash when tab changes
  useEffect(() => {
    window.location.hash = activeTab;
  }, [activeTab]);

  // Handle browser back/forward navigation
  useEffect(() => {
    const onHashChange = () => {
      const tab = tabFromHash();
      setActiveTab(tab);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // Always-needed data fetched on mount
  useEffect(() => {
    fetchSyncStatus();
    fetchGarminMetrics();
    fetchAllTime();
  }, []);

  // Lazy-initialize the initial tab's data on mount
  useEffect(() => {
    initTab(activeTab);
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
      if (res.status === 401 || res.status === 403) { pendingSyncRef.current = source; handleAuthExpired(); return; }
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

  async function fetchCalendarEvents() {
    setCalendarLoading(true);
    setCalendarError("");
    try {
      const from = new Date();
      const to = new Date();
      to.setDate(to.getDate() + 13);
      const fmt = localDateStr;
      const res = await fetch(`/api/garmin_calendar?from=${fmt(from)}&to=${fmt(to)}`);
      if (res.ok) setCalendarEvents(await res.json());
    } catch (e) {
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

  function handleAuthExpired() {
    handleLogout();
    openLoginPanel();
  }

  function isAuthMsg(msg: string): boolean {
    const m = friendlyError(msg);
    return m === "Session expired. Please sign in again." || m === "Access denied.";
  }

  function handleGoogleSuccess(credentialResponse: { credential?: string }) {
    const token = credentialResponse.credential ?? null;
    setGoogleCredential(token);
    setAddError("");
    setSyncError("");
    if (token) localStorage.setItem("google_credential", token);
    if (!competitions && !competitionsLoading) fetchCompetitions(token);
    const pending = pendingSyncRef.current;
    if (token && pending) {
      pendingSyncRef.current = null;
      setProfileOpen(false);
      setMenuOpen(false);
      triggerSync(pending, token);
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
      handleAuthExpired();
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
      const msg = e instanceof Error ? e.message : "Unknown error";
      if (isAuthMsg(msg)) { handleAuthExpired(); return; }
      setAddError(friendlyError(msg));
    } finally {
      setCompetitionsLoading(false);
    }
  }

  async function addCompetition(data: { competition: string; location: string; date: string; distance: string; time: string; rank: string; link: string }) {
    setAddLoading(true);
    setAddError("");
    try {
      const res = await fetch("/api/competitions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${googleCredential}`,
        },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (handle401(res)) return;
      if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`);
      setCompetitions((prev) => [...(prev ?? []), json].sort((a, b) => a.date.localeCompare(b.date)));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      if (isAuthMsg(msg)) { handleAuthExpired(); return; }
      setAddError(friendlyError(msg));
    } finally {
      setAddLoading(false);
    }
  }

  async function saveEdit(id: number, data: { competition: string; location: string; date: string; distance: string; time: string; rank: string; link: string }) {
    setAddError("");
    try {
      const res = await fetch("/api/competitions", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${googleCredential}`,
        },
        body: JSON.stringify({ id, ...data }),
      });
      const json = await res.json();
      if (handle401(res)) return;
      if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`);
      setCompetitions((prev) => prev?.map((c) => c.id === id ? json : c).sort((a, b) => a.date.localeCompare(b.date)) ?? null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      if (isAuthMsg(msg)) { handleAuthExpired(); return; }
      setAddError(friendlyError(msg));
    }
  }

  async function saveGearEdit(id: number, name: string, limit_km: string, image_url: string) {
    setGearError("");
    try {
      const res = await fetch("/api/gear", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${googleCredential}` },
        body: JSON.stringify({
          id,
          name: name || undefined,
          limit_km: limit_km ? Number(limit_km) : null,
          image_url: image_url || null,
        }),
      });
      const json = await res.json();
      if (handle401(res)) return;
      if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`);
      fetchAllTime();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      if (isAuthMsg(msg)) { handleAuthExpired(); return; }
      setGearError(friendlyError(msg));
    }
  }

  async function addGear(name: string, limit_km: string, image_url: string) {
    setGearError("");
    try {
      const res = await fetch("/api/gear", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${googleCredential}` },
        body: JSON.stringify({
          name,
          limit_km: limit_km ? Number(limit_km) : null,
          image_url: image_url || null,
        }),
      });
      const json = await res.json();
      if (handle401(res)) return;
      if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`);
      fetchAllTime();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      if (isAuthMsg(msg)) { handleAuthExpired(); return; }
      setGearError(friendlyError(msg));
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

  async function addGoal(data: { year: string; description: string; status: GoalStatus; result: string }) {
    setGoalsAddLoading(true);
    setGoalsError("");
    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${googleCredential}` },
        body: JSON.stringify({
          year: Number(data.year),
          description: data.description,
          status: data.status,
          result: data.result || null,
        }),
      });
      const json = await res.json();
      if (handle401(res)) return;
      if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`);
      setGoals((prev) => {
        const updated = [...(prev ?? []), json as Goal];
        return updated.sort((a, b) => b.year - a.year || a.sort_order - b.sort_order);
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      if (isAuthMsg(msg)) { handleAuthExpired(); return; }
      setGoalsError(friendlyError(msg));
    } finally {
      setGoalsAddLoading(false);
    }
  }

  async function saveGoalEdit(id: number, data: { description: string; status: GoalStatus; result: string }) {
    setGoalsError("");
    try {
      const res = await fetch("/api/goals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${googleCredential}` },
        body: JSON.stringify({ id, ...data }),
      });
      const json = await res.json();
      if (handle401(res)) return;
      if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`);
      setGoals((prev) => prev?.map((g) => g.id === id ? (json as Goal) : g) ?? null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      if (isAuthMsg(msg)) { handleAuthExpired(); return; }
      setGoalsError(friendlyError(msg));
    }
  }

  // Fetch tab-specific data the first time a tab is opened
  function initTab(tab: Tab) {
    if (initializedTabs.current.has(tab)) return;
    initializedTabs.current.add(tab);

    if (tab === "runs") fetchRuns();
    if (tab === "records") fetchRecords();
    if (tab === "goals") fetchGoals();
    if (tab === "calendar") fetchCalendarEvents();
    if (tab === "competitions" && googleCredential) fetchCompetitions();
  }

  function goTab(tab: Tab) {
    setActiveTab(tab);
    initTab(tab);
  }

  function syncLabel(src: "strava" | "garmin") {
    const s = syncStatus[src];
    if (syncLoading[src]) return "Syncing…";
    if (!s) return `Sync ${src.charAt(0).toUpperCase() + src.slice(1)}`;
    if (s.status === "error") return `Sync ${src.charAt(0).toUpperCase() + src.slice(1)} — Error`;
    const ago = s.finished_at ? new Date(s.finished_at).toLocaleString() : "";
    return `Sync ${src.charAt(0).toUpperCase() + src.slice(1)}${ago ? ` · ${ago}` : ""}`;
  }

  return (
    <>
      <Navbar
        activeTab={activeTab}
        googleCredential={googleCredential}
        profileOpen={profileOpen}
        syncLoading={syncLoading}
        syncError={syncError}
        onTabClick={goTab}
        onProfileToggle={() => setProfileOpen((o) => !o)}
        onSync={triggerSync}
        onGoCompetitions={() => goTab("competitions")}
        onGoGoals={() => goTab("goals")}
        onGoHealth={() => goTab("health")}
        onLogout={handleLogout}
        onGoogleSuccess={handleGoogleSuccess}
        syncLabel={syncLabel}
        onLogoClick={() => goTab("home")}
        onMenuOpen={() => setMenuOpen(true)}
      />

      <Drawer
        open={menuOpen}
        activeTab={activeTab}
        googleCredential={googleCredential}
        syncLoading={syncLoading}
        syncError={syncError}
        onClose={() => setMenuOpen(false)}
        onTabClick={goTab}
        onSync={triggerSync}
        onGoCompetitions={() => goTab("competitions")}
        onGoGoals={() => goTab("goals")}
        onGoHealth={() => goTab("health")}
        onLogout={handleLogout}
        onGoogleSuccess={handleGoogleSuccess}
        syncLabel={syncLabel}
      />

      <div className="container">
        <div className="tab-content" key={activeTab}>

          {/* ── HOME ── */}
          {activeTab === "home" && (
            <HomeTab />
          )}

          {/* ── HEALTH ── */}
          {activeTab === "health" && (
            <HealthTab
              garminMetrics={garminMetrics}
              googleCredential={googleCredential}
              onGoogleSuccess={handleGoogleSuccess}
            />
          )}

          {/* ── GEAR ── */}
          {activeTab === "gear" && (
            <GearTab
              allTimeData={allTimeData}
              allTimeLoading={allTimeLoading}
              allTimeError={allTimeError}
              googleCredential={googleCredential}
              gearError={gearError}
              onSaveGearEdit={saveGearEdit}
              onAddGear={addGear}
            />
          )}

          {/* ── RUNS ── */}
          {activeTab === "runs" && (
            <RunsTab
              runsData={runsData}
              runsLoading={runsLoading}
              runsError={runsError}
              afterDate={afterDate}
              allTime={allTime}
              googleCredential={googleCredential}
              onAfterDateChange={setAfterDate}
              onAllTimeChange={setAllTime}
              onLoad={fetchRuns}
            />
          )}

          {/* ── YEARLY ── */}
          {activeTab === "yearly" && (
            <YearlyTab allTimeData={allTimeData} allTimeLoading={allTimeLoading} allTimeError={allTimeError} />
          )}

          {/* ── RECORDS ── */}
          {activeTab === "records" && (
            <RecordsTab records={records} recordsLoading={recordsLoading} />
          )}

          {/* ── COMPETITIONS ── */}
          {activeTab === "competitions" && (
            <CompetitionsTab
              googleCredential={googleCredential}
              competitions={competitions}
              competitionsLoading={competitionsLoading}
              addError={addError}
              addLoading={addLoading}
              onAddCompetition={addCompetition}
              onSaveEdit={saveEdit}
              onGoogleSuccess={handleGoogleSuccess}
            />
          )}

          {/* ── GOALS ── */}
          {activeTab === "goals" && (
            <GoalsTab
              goals={goals}
              goalsLoading={goalsLoading}
              goalsError={goalsError}
              googleCredential={googleCredential}
              goalsAddLoading={goalsAddLoading}
              onAddGoal={addGoal}
              onSaveGoalEdit={saveGoalEdit}
            />
          )}

          {/* ── CALENDAR ── */}
          {activeTab === "calendar" && (
            <CalendarTab calendarEvents={calendarEvents} calendarLoading={calendarLoading} calendarError={calendarError} />
          )}

        </div>
      </div>

<footer className="site-footer">
        &copy; 2026 McWay.
      </footer>
    </>
  );
}
