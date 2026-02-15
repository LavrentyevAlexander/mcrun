import { useState } from "react";
import "./App.css";

interface Activity {
  date: string;
  name: string;
  km: number;
  min: number;
  gear: string;
}

interface StatsResponse {
  activities: Activity[];
  gear_summary: Record<string, number>;
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

  async function load() {
    setLoading(true);
    setError("");
    setData(null);
    try {
      const res = await fetch(`/api/stats?after_date=${afterDate}`);
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

  return (
    <div className="container">
      <h1>McRun Strava Stats</h1>

      <div className="controls">
        <label>
          Start date:
          <input
            type="date"
            value={afterDate}
            onChange={(e) => setAfterDate(e.target.value)}
          />
        </label>
        <button onClick={load} disabled={loading}>
          {loading ? "Loading…" : "Load"}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {data && (
        <>
          <section className="gear-summary">
            <h2>Gear Summary</h2>
            <ul>
              {Object.entries(data.gear_summary).map(([name, km]) => (
                <li key={name}>
                  <strong>{name}</strong>: {km.toFixed(2)} km
                </li>
              ))}
            </ul>
          </section>

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
                      <td>{a.date}</td>
                      <td>{a.name}</td>
                      <td>{a.km.toFixed(2)}</td>
                      <td>{a.min}</td>
                      <td>{a.gear}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
