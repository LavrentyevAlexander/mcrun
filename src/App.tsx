import { useState } from "react";
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
}

interface StatsResponse {
  activities: Activity[];
  gear_summary: Record<string, GearInfo>;
  error?: string;
}

type Tab = "gear" | "runs" | "yearly" | "records";


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
                          <td data-label="Effort">{a.relative_effort ?? "—"}</td>
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
                              Garmin
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
