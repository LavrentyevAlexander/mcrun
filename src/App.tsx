import { useState } from "react";
import { GoogleLogin, googleLogout } from "@react-oauth/google";
import "./App.css";

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
  km: number;
  total_km: number;
  limit_km: number | null;
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
  time: string;
  rank: string;
  link: string | null;
}

type Tab = "gear" | "runs" | "yearly" | "records" | "competitions";


function formatDuration(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function defaultDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-01-01`;
}

export default function App() {
  const [afterDate, setAfterDate] = useState(defaultDate);
  const [allTime, setAllTime] = useState(false);
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("gear");
  const [records, setRecords] = useState<GarminRecord[] | null>(null);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [googleCredential, setGoogleCredential] = useState<string | null>(
    () => localStorage.getItem("google_credential")
  );
  const [competitions, setCompetitions] = useState<Competition[] | null>(null);
  const [competitionsLoading, setCompetitionsLoading] = useState(false);
  const [addForm, setAddForm] = useState({ competition: "", date: "", distance: "", time: "", rank: "", link: "" });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");

  function handleGoogleSuccess(credentialResponse: { credential?: string }) {
    const token = credentialResponse.credential ?? null;
    setGoogleCredential(token);
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
        throw new Error("Session expired, please sign in again");
      }
      if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`);
      setCompetitions(json);
    } catch (e: unknown) {
      setAddError(e instanceof Error ? e.message : "Unknown error");
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
      setAddError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setAddLoading(false);
    }
  }

  async function fetchRecords() {
    setRecordsLoading(true);
    try {
      const res = await fetch("/api/records");
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      setRecords(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setRecordsLoading(false);
    }
  }

  async function fetchStats() {
    setLoading(true);
    setError("");
    setData(null);
    try {
      const date = allTime ? "1970-01-01" : afterDate;
      const res = await fetch(`/api/stats?after_date=${date}`);
      const json: StatsResponse = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      setData(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  const totalKm = data
    ? data.activities.reduce((sum, a) => sum + a.km, 0)
    : 0;
  const totalSec = data
    ? data.activities.reduce((sum, a) => sum + a.elapsed_sec, 0)
    : 0;

  const yearlyKm: Record<string, number> = {};
  if (data) {
    for (const a of data.activities) {
      const year = a.date.slice(0, 4);
      yearlyKm[year] = (yearlyKm[year] || 0) + a.km;
    }
  }

  const sortedActivities = data
    ? [...data.activities].sort((a, b) => b.date.localeCompare(a.date))
    : [];

  // Rolling 28-day average effort (excluding the run itself)
  const effortAvgMap = new Map<number, number | null>();
  if (data) {
    const withEffort = data.activities
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
    if (pct <= -30) return "#1565c0";       // blue — very easy
    if (pct <= -15) return "#42a5f5";       // light blue — easy
    if (pct < 15) return undefined;          // neutral
    if (pct < 35) return "#f9a825";         // yellow — somewhat hard
    if (pct < 55) return "#e65100";         // orange — hard
    return "#c62828";                        // red — very hard
  }

  return (
    <div className="container">
      <img src="/logo.png" alt="McRun" className="logo" />

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
        <button onClick={fetchStats} disabled={loading}>
          {loading ? "Loading…" : "Load"}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {data && (
        <>
          <div className="tabs">
            <button
              className={`tab${activeTab === "gear" ? " active" : ""}`}
              onClick={() => setActiveTab("gear")}
            >
              Gear
            </button>
            <button
              className={`tab${activeTab === "runs" ? " active" : ""}`}
              onClick={() => setActiveTab("runs")}
            >
              Runs ({data.activities.length})
            </button>
            <button
              className={`tab${activeTab === "yearly" ? " active" : ""}`}
              onClick={() => setActiveTab("yearly")}
            >
              Yearly
            </button>
            <button
              className={`tab${activeTab === "records" ? " active" : ""}`}
              onClick={() => {
                setActiveTab("records");
                if (!records && !recordsLoading) fetchRecords();
              }}
            >
              Records
            </button>
            <button
              className={`tab${activeTab === "competitions" ? " active" : ""}`}
              onClick={() => {
                setActiveTab("competitions");
                if (googleCredential && !competitions && !competitionsLoading) fetchCompetitions();
              }}
            >
              Competitions
            </button>
          </div>

          <div className="tab-content">
            {activeTab === "gear" && (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Shoe</th>
                      <th>Period km</th>
                      <th>Total km</th>
                      <th>Wear</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(data.gear_summary)
                      .sort(([, a], [, b]) => b.km - a.km)
                      .map(([name, info]) => {
                        const wear = info.limit_km
                          ? Math.round((info.total_km / info.limit_km) * 100)
                          : null;
                        const wearColor =
                          wear === null
                            ? undefined
                            : wear < 50
                            ? "#2e7d32"
                            : wear < 70
                            ? "#f9a825"
                            : wear < 80
                            ? "#e65100"
                            : "#c62828";
                        return (
                          <tr key={name}>
                            <td data-label="">{name}</td>
                            <td data-label="Period, km">{info.km.toFixed(2)}</td>
                            <td data-label="Total, km">{info.total_km.toFixed(2)}</td>
                            <td
                              data-label="Wear"
                              style={
                                wearColor
                                  ? { color: wearColor, fontWeight: 600 }
                                  : {}
                              }
                            >
                              {wear !== null ? `${wear}%` : "—"}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === "runs" && (
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
                            <a
                              href={`https://www.strava.com/activities/${a.strava_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
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

            {activeTab === "records" && (
              <div className="table-wrap">
                {recordsLoading && <p>Loading…</p>}
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
                            <a
                              href={`https://connect.garmin.com/modern/activity/${r.activity_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
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
                    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.75rem" }}>
                      <button onClick={handleLogout} style={{ fontSize: "0.8rem" }}>Sign out</button>
                    </div>
                    {competitionsLoading && <p>Loading…</p>}
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
                            </tr>
                          </thead>
                          <tbody>
                            {competitions.map((c, i) => (
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

            {activeTab === "yearly" && (
              <table>
                <thead>
                  <tr>
                    <th>Year</th>
                    <th>Km</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(yearlyKm)
                    .sort(([a], [b]) => b.localeCompare(a))
                    .map(([year, km]) => (
                      <tr key={year}>
                        <td>{year}</td>
                        <td>{km.toFixed(2)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
