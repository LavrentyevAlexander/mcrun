import { useState } from "react";
import type { StatsResponse } from "../../types";
import YearlyChart from "../YearlyChart";
import MonthlyChart from "../MonthlyChart";

interface YearlyTabProps {
  allTimeData: StatsResponse | null;
  allTimeLoading: boolean;
  allTimeError: string;
}

export default function YearlyTab({ allTimeData, allTimeLoading, allTimeError }: YearlyTabProps) {
  const [mileageView, setMileageView] = useState<"yearly" | "monthly">("yearly");
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const yearlyKm: Record<string, number> = {};
  const monthlyKm: Record<string, number> = {};
  if (allTimeData) {
    for (const a of allTimeData.activities) {
      const year = a.date.slice(0, 4);
      const ym = a.date.slice(0, 7);
      yearlyKm[year] = (yearlyKm[year] || 0) + a.km;
      monthlyKm[ym] = (monthlyKm[ym] || 0) + a.km;
    }
  }
  const availableYears = Object.keys(yearlyKm).map(Number).sort((a, b) => b - a);

  return (
    <>
      {allTimeError && <p className="error">{allTimeError}</p>}
      {allTimeLoading && <div className="loading-box">Loading…</div>}
      {!allTimeLoading && allTimeData && (
        <>
          <div className="mileage-controls">
            <div className="view-toggle">
              <button
                className={mileageView === "yearly" ? "active" : ""}
                onClick={() => setMileageView("yearly")}
              >Yearly</button>
              <button
                className={mileageView === "monthly" ? "active" : ""}
                onClick={() => setMileageView("monthly")}
              >Monthly</button>
            </div>
            {mileageView === "monthly" && (
              <div className="year-selector">
                {availableYears.map(y => (
                  <button
                    key={y}
                    className={selectedYear === y ? "active" : ""}
                    onClick={() => setSelectedYear(y)}
                  >{y}</button>
                ))}
              </div>
            )}
          </div>
          <div className="yearly-chart-wrap">
            {mileageView === "yearly"
              ? <YearlyChart data={yearlyKm} />
              : <MonthlyChart data={monthlyKm} year={selectedYear} />
            }
          </div>
        </>
      )}
    </>
  );
}
