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

export default function HomeTab({ allTimeData, allTimeLoading }: HomeTabProps) {
  const [logoIdx, setLogoIdx] = useState(0);
  const cycleLogo = () => setLogoIdx((i) => (i + 1) % LOGOS.length);

  const today = new Date();
  const thisWeekStart = isoWeekStart(today);
  const thisMonthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;

  let weekKm = 0, monthKm = 0;
  if (allTimeData) {
    for (const a of allTimeData.activities) {
      const d = a.date;
      if (d >= thisWeekStart) weekKm += a.km;
      if (d >= thisMonthStart) monthKm += a.km;
    }
  }

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
            </div>
            <div className="home-stat-card">
              <div className="home-stat-label">This month</div>
              <div className="home-stat-value">{monthKm.toFixed(1)} km</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
