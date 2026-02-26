import { useState } from "react";
import "./App.css";
import logo from "../icon.png";

interface Activity {
  date: string;
  name: string;
  km: number;
  min: number;
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

type Tab = "gear" | "runs" | "yearly";

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
  const totalMin = data
    ? data.activities.reduce((sum, a) => sum + a.min, 0)
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
      <img src={logo} alt="McRun" className="logo" />

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
          </div>

          <div className="tab-content">
            {activeTab === "gear" && (
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
                          <td>{name}</td>
                          <td>{info.km.toFixed(2)}</td>
                          <td>{info.total_km.toFixed(2)}</td>
                          <td
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
            )}

            {activeTab === "runs" && (
              <>
                <p className="runs-summary">
                  {totalKm.toFixed(2)} km &mdash; {totalMin} min
                </p>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Name</th>
                        <th>Km</th>
                        <th>Min</th>
                        <th>Gear</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedActivities.map((a, i) => (
                        <tr key={i}>
                          <td data-label="Date">{a.date}</td>
                          <td data-label="Name">{a.name}</td>
                          <td data-label="Km">{a.km.toFixed(2)}</td>
                          <td data-label="Min">{a.min}</td>
                          <td data-label="Gear">{a.gear}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
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
