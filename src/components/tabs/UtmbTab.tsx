import { GoogleLogin } from "@react-oauth/google";
import type { UtmbStats } from "../../types";
import { googleBtnTheme } from "../../utils";

const PI_CATEGORIES: { key: "general_index" | "index_20k" | "index_50k" | "index_100k" | "index_100m"; label: string }[] = [
  { key: "general_index", label: "General" },
  { key: "index_20k",     label: "20K" },
  { key: "index_50k",     label: "50K" },
  { key: "index_100k",    label: "100K" },
  { key: "index_100m",    label: "100 Miles" },
];

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const min = Math.min(...values), max = Math.max(...values);
  const W = 80, H = 28, pad = 2;
  const x = (i: number) => pad + (i / (values.length - 1)) * (W - pad * 2);
  const y = (v: number) => H - pad - ((v - min) / (max - min || 1)) * (H - pad * 2);
  const points = values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  return (
    <svg width={W} height={H} style={{ display: "block", margin: "6px auto 0" }}>
      <polyline points={points} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

interface UtmbTabProps {
  utmbStats: UtmbStats | null;
  googleCredential: string | null;
  onGoogleSuccess: (resp: { credential?: string }) => void;
}

export default function UtmbTab({ utmbStats, googleCredential, onGoogleSuccess }: UtmbTabProps) {
  if (!googleCredential) {
    return (
      <div style={{ textAlign: "center", padding: "2rem" }}>
        <p style={{ marginBottom: "1rem" }}>Sign in to view UTMB Index</p>
        <GoogleLogin
          key={googleBtnTheme()}
          theme={googleBtnTheme()}
          onSuccess={onGoogleSuccess}
          onError={() => {/* error handled by parent */}}
        />
      </div>
    );
  }

  const current = utmbStats?.current ?? null;
  const history = utmbStats?.history ?? [];
  const races = utmbStats?.races ?? [];

  return (
    <div>
      {!current && races.length === 0 && (
        <p className="health-empty">No data yet — sync UTMB to populate.</p>
      )}

      {current && (
        <div className="health-tiles">
          {PI_CATEGORIES.map(({ key, label }) => {
            const value = current[key];
            if (value === null) return null;
            const trend = history.map((h) => h[key]).filter((v): v is number => v !== null);
            return (
              <div className="metric-card" key={key}>
                <span className="metric-label">{label}</span>
                <span className="metric-value">{value}</span>
                <Sparkline values={trend} />
              </div>
            );
          })}
          <div className="metric-card metric-card--muted">
            <span className="metric-label">Last synced</span>
            <span className="metric-sub">{current.synced_at ? new Date(current.synced_at).toLocaleString() : "—"}</span>
          </div>
        </div>
      )}

      {races.length > 0 && (
        <div className="table-wrap" style={{ marginTop: "1.5rem" }}>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Race</th>
                <th>Category</th>
                <th>Distance</th>
                <th>Time</th>
                <th>Rank</th>
              </tr>
            </thead>
            <tbody>
              {races.map((r, i) => (
                <tr key={i}>
                  <td data-label="Date">{r.date.split("-").reverse().join(".")}</td>
                  <td data-label="Race">{r.event_name}{r.race_name && r.race_name !== r.event_name ? ` — ${r.race_name}` : ""}</td>
                  <td data-label="Category">{r.pi_category ?? "—"}</td>
                  <td data-label="Distance">{r.distance_km != null ? `${r.distance_km} km` : "—"}</td>
                  <td data-label="Time">{r.is_dnf ? "DNF" : (r.time ?? "—")}</td>
                  <td data-label="Rank">{r.rank != null ? `${r.rank}${r.total_ranked != null ? ` / ${r.total_ranked}` : ""}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
