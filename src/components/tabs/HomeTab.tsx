import { useState } from "react";
import { LOGOS } from "../../constants";
import type { StatsResponse } from "../../types";
import Skeleton from "../Skeleton";

interface HomeTabProps {
  allTimeData: StatsResponse | null;
  allTimeLoading: boolean;
}

function isoWeekStart(d: Date): string {
  const dt = new Date(d);
  const day = dt.getDay() || 7;
  dt.setDate(dt.getDate() - day + 1);
  return dt.toISOString().slice(0, 10);
}

function deltaLabel(curr: number, prev: number): { text: string; cls: string } {
  if (prev === 0) return { text: "no data last period", cls: "neu" };
  const pct = Math.round(((curr - prev) / prev) * 100);
  if (pct > 0) return { text: `+${pct}% vs prev`, cls: "pos" };
  if (pct < 0) return { text: `${pct}% vs prev`, cls: "neg" };
  return { text: "same as prev", cls: "neu" };
}

export default function HomeTab({ allTimeData, allTimeLoading }: HomeTabProps) {
  const [logoIdx, setLogoIdx] = useState(0);
  const cycleLogo = () => setLogoIdx((i) => (i + 1) % LOGOS.length);

  const today = new Date();
  const thisWeekStart = isoWeekStart(today);
  const lastWeekStart = isoWeekStart(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7));
  const thisMonthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthStart = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}-01`;
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().slice(0, 10);

  let weekKm = 0, lastWeekKm = 0, monthKm = 0, lastMonthKm = 0;
  if (allTimeData) {
    for (const a of allTimeData.activities) {
      const d = a.date;
      if (d >= thisWeekStart) weekKm += a.km;
      else if (d >= lastWeekStart && d < thisWeekStart) lastWeekKm += a.km;
      if (d >= thisMonthStart) monthKm += a.km;
      else if (d >= lastMonthStart && d <= lastMonthEnd) lastMonthKm += a.km;
    }
  }

  const weekDelta = deltaLabel(weekKm, lastWeekKm);
  const monthDelta = deltaLabel(monthKm, lastMonthKm);

  return (
    <div className="home">
      <div className="home-card">
        <div className="photo-carousel" onClick={cycleLogo}>
          {LOGOS.map((src, i) => (
            <img key={src} src={src} alt="McRun"
              className={`home-photo${i === logoIdx ? " home-photo--active" : ""}`} />
          ))}
        </div>
        <blockquote className="home-quote">
          <p className="home-quote-text">&ldquo;Pain is inevitable.<br />Suffering is optional.&rdquo;</p>
          <footer className="home-quote-author">&mdash; Haruki Murakami</footer>
        </blockquote>

        {allTimeLoading && <Skeleton variant="lines" rows={2} />}
        {!allTimeLoading && allTimeData && (
          <div className="home-stats">
            <div className="home-stat-card">
              <div className="home-stat-label">This week</div>
              <div className="home-stat-value">{weekKm.toFixed(1)} km</div>
              <div className={`home-stat-delta ${weekDelta.cls}`}>{weekDelta.text}</div>
            </div>
            <div className="home-stat-card">
              <div className="home-stat-label">This month</div>
              <div className="home-stat-value">{monthKm.toFixed(1)} km</div>
              <div className={`home-stat-delta ${monthDelta.cls}`}>{monthDelta.text}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
