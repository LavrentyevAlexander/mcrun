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

function defaultDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-01-01`;
}

export default function App() {
  const [afterDate, setAfterDate] = useState(defaultDate);
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function fetchStats(date?: string) {
    setLoading(true);
    setError("");
    setData(null);
    try {
      const url = date
        ? `/api/stats?after_date=${date}`
        : "/api/stats?after_date=1970-01-01";
      const res = await fetch(url);
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
          />
        </label>
        <button onClick={() => fetchStats(afterDate)} disabled={loading}>
          {loading ? "Loading…" : "Load"}
        </button>
        <button onClick={() => fetchStats()} disabled={loading}>
          All time
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {data && (
        <>
          <section className="gear-summary">
            <h2>Gear Summary</h2>
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
                    const wear =
                      info.limit_km
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
          </section>

          <div className="main-layout">
            <section className="activities">
              <h2>
                Runs ({data.activities.length}) &mdash; {totalKm.toFixed(2)} km,{" "}
                {totalMin} min
              </h2>
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
                    {data.activities.map((a, i) => (
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
            </section>

            {Object.keys(yearlyKm).length > 0 && (
              <section className="yearly-summary">
                <h2>Yearly Km</h2>
                <table>
                  <thead>
                    <tr>
                      <th>Year</th>
                      <th>Km</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(yearlyKm)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([year, km]) => (
                        <tr key={year}>
                          <td>{year}</td>
                          <td>{km.toFixed(2)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </section>
            )}
          </div>
        </>
      )}
    </div>
  );
}
