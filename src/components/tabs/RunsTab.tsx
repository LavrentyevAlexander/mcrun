import type { StatsResponse } from "../../types";
import { formatDuration, localDateStr } from "../../utils";
import Skeleton from "../Skeleton";

function effortColor(effort: number | null, avg: number | null): string | undefined {
  if (effort === null || avg === null) return undefined;
  const pct = (effort - avg) / avg * 100;
  if (pct <= -30) return "var(--scale-1)";
  if (pct <= -15) return "var(--scale-2)";
  if (pct < 15) return undefined;
  if (pct < 35) return "var(--scale-4)";
  if (pct < 55) return "var(--scale-5)";
  return "var(--scale-6)";
}

const HR_ZONES = [
  { label: "Z1 Recovery",  max: 130, color: "#64b5f6" },
  { label: "Z2 Aerobic",   max: 148, color: "#81c784" },
  { label: "Z3 Tempo",     max: 162, color: "#ffb74d" },
  { label: "Z4 Threshold", max: 174, color: "#ef6c00" },
  { label: "Z5 Max",       max: Infinity, color: "#c62828" },
];

interface RunsTabProps {
  runsData: StatsResponse | null;
  runsLoading: boolean;
  runsError: string;
  afterDate: string;
  allTime: boolean;
  googleCredential: string | null;
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
  googleCredential,
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

  // HR zone distribution
  const zoneCounts = HR_ZONES.map(() => 0);
  let totalWithHr = 0;
  if (runsData) {
    for (const a of runsData.activities) {
      if (a.avg_hr == null) continue;
      totalWithHr++;
      for (let i = 0; i < HR_ZONES.length; i++) {
        if (a.avg_hr < HR_ZONES[i].max) { zoneCounts[i]++; break; }
      }
    }
  }
  const maxZoneCount = Math.max(...zoneCounts, 1);

  function handleExport() {
    const date = allTime ? "1970-01-01" : afterDate;
    const url = `/api/stats?after_date=${date}&format=csv`;
    const a = document.createElement("a");
    a.href = url;
    fetch(url, { headers: { Authorization: `Bearer ${googleCredential ?? ""}` } })
      .then((res) => res.blob())
      .then((blob) => {
        const objectUrl = URL.createObjectURL(blob);
        a.href = objectUrl;
        a.download = "activities.csv";
        a.click();
        URL.revokeObjectURL(objectUrl);
      });
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
        {googleCredential && runsData && (
          <button onClick={handleExport} title="Download CSV">
            Export CSV
          </button>
        )}
      </div>
      {runsError && <p className="error">{runsError}</p>}
      {runsLoading && <Skeleton variant="table" rows={8} />}
      {runsData && (
        <>
          <p className="runs-summary">
            {totalKm.toFixed(2)} km &mdash; {formatDuration(totalSec)}
          </p>

          {totalWithHr > 0 && (
            <div className="hr-zones">
              <div className="hr-zones-title">HR zone distribution ({totalWithHr} runs)</div>
              {HR_ZONES.map((z, i) => (
                <div key={z.label} className="hr-zone-row">
                  <span className="hr-zone-label">{z.label}</span>
                  <div className="hr-zone-bar-wrap">
                    <div
                      className="hr-zone-bar"
                      style={{
                        width: `${Math.round((zoneCounts[i] / maxZoneCount) * 100)}%`,
                        background: z.color,
                      }}
                    />
                  </div>
                  <span className="hr-zone-count">{zoneCounts[i]}</span>
                </div>
              ))}
            </div>
          )}

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
  );
}
