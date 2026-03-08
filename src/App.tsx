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

interface StatsResponse {
  activities: Activity[];
  gear_summary: Record<string, GearInfo>;
  error?: string;
}

type Tab = "gear" | "runs" | "yearly" | "records";

const RECORD_DISTANCES = [
  { label: "400 m",          min: 0.37,  max: 0.43  },
  { label: "1/2 mile",       min: 0.77,  max: 0.84  },
  { label: "1 km",           min: 0.95,  max: 1.05  },
  { label: "1 mile",         min: 1.55,  max: 1.67  },
  { label: "2 miles",        min: 3.07,  max: 3.37  },
  { label: "5 km",           min: 4.75,  max: 5.25  },
  { label: "10 km",          min: 9.5,   max: 10.5  },
  { label: "15 km",          min: 14.25, max: 15.74 },
  { label: "10 miles",       min: 15.75, max: 16.5  },
  { label: "20 km",          min: 19.0,  max: 20.49 },
  { label: "Half marathon",  min: 20.5,  max: 21.8  },
  { label: "30 km",          min: 28.5,  max: 31.5  },
  { label: "Marathon",       min: 41.5,  max: 43.0  },
];

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

  const records = RECORD_DISTANCES.map(({ label, min, max }) => {
    const candidates = data
      ? data.activities.filter((a) => a.km >= min && a.km <= max)
      : [];
    if (candidates.length === 0) return { label, best: null, count: 0 };
    // Best = lowest pace in sec/km (fastest run)
    const best = candidates.reduce((a, b) => {
      const paceA = a.km > 0 ? a.elapsed_sec / a.km : Infinity;
      const paceB = b.km > 0 ? b.elapsed_sec / b.km : Infinity;
      return paceA <= paceB ? a : b;
    });
    return { label, best, count: candidates.length };
  });

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
              onClick={() => setActiveTab("records")}
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
                <table>
                  <thead>
                    <tr>
                      <th>Distance</th>
                      <th>Candidates</th>
                      <th>Time</th>
                      <th>Actual km</th>
                      <th>Pace / min/km</th>
                      <th>Date</th>
                      <th>Run</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map(({ label, best, count }) => (
                      <tr key={label}>
                        <td>{label}</td>
                        <td>{count}</td>
                        <td>{best ? formatDuration(best.elapsed_sec) : "—"}</td>
                        <td>{best ? best.km.toFixed(2) : "—"}</td>
                        <td>{best?.avg_pace ?? "—"}</td>
                        <td>{best?.date ?? "—"}</td>
                        <td>
                          {best ? (
                            <a
                              href={`https://www.strava.com/activities/${best.strava_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {best.name}
                            </a>
                          ) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
