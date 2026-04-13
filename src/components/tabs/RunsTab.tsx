import type { StatsResponse } from "../../types";
import { formatDuration, localDateStr } from "../../utils";

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

interface RunsTabProps {
  runsData: StatsResponse | null;
  runsLoading: boolean;
  runsError: string;
  afterDate: string;
  allTime: boolean;
  onAfterDateChange: (d: string) => void;
  onAllTimeChange: (v: boolean) => void;
  onLoad: () => void;
}

export default function RunsTab({
  runsData,
  runsLoading,
  runsError,
  afterDate,
  allTime,
  onAfterDateChange,
  onAllTimeChange,
  onLoad,
}: RunsTabProps) {
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
        (x) => x.strava_id !== act.strava_id && x.date > localDateStr(cutoff) && x.date < act.date
      );
      const avg = window.length >= 2
        ? window.reduce((s, x) => s + x.effort, 0) / window.length
        : globalAvg;
      effortAvgMap.set(act.strava_id, avg);
    }
  }

  return (
    <>
      <div className="controls">
        <label>
          Start date:
          <input
            type="date"
            value={afterDate}
            onChange={(e) => onAfterDateChange(e.target.value)}
            disabled={allTime}
          />
        </label>
        <label className="all-time-label">
          <input
            type="checkbox"
            checked={allTime}
            onChange={(e) => onAllTimeChange(e.target.checked)}
          />
          All time
        </label>
        <button onClick={onLoad} disabled={runsLoading}>
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
                  <th>Fitness</th>
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
                    <td data-label="Fitness">
                      {a.fitness_score !== null ? (
                        <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                          <span style={{ fontWeight: 600 }}>{a.fitness_score}</span>
                          {a.fitness_delta !== null && a.fitness_delta !== 0 && (
                            <span style={{
                              fontSize: "0.75em",
                              color: a.fitness_delta > 0 ? "#2e7d32" : "#c62828",
                              fontWeight: 600,
                            }}>
                              {a.fitness_delta > 0 ? "+" : ""}{a.fitness_delta}
                            </span>
                          )}
                        </span>
                      ) : "—"}
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
  );
}
