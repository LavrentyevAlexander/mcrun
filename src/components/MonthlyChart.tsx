const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function MonthlyChart({ data, year }: { data: Record<string, number>; year: number }) {
  const values = MONTH_LABELS.map((_, i) => {
    const key = `${year}-${String(i + 1).padStart(2, "0")}`;
    return data[key] ?? 0;
  });

  const W = 620, H = 300;
  const PAD = { top: 32, right: 24, bottom: 56, left: 60 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const maxKm = Math.max(...values, 1);
  const yMax = Math.ceil(maxKm / 100) * 100 || 100;

  const slotW = plotW / 12;
  const barW = slotW * 0.6;
  const toBarX = (i: number) => PAD.left + slotW * i + (slotW - barW) / 2;
  const toBarH = (km: number) => (km / yMax) * plotH;
  const toBarY = (km: number) => PAD.top + plotH - toBarH(km);
  const axisBottom = PAD.top + plotH;

  const gridSteps = 4;
  const gridLines = Array.from({ length: gridSteps + 1 }, (_, i) => {
    const km = Math.round((yMax / gridSteps) * i);
    return { km, y: toBarY(km) };
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="yearly-chart">
      <defs>
        <marker id="arr-mx" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" className="chart-arrow" />
        </marker>
        <marker id="arr-my" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" className="chart-arrow" />
        </marker>
      </defs>

      {/* Horizontal grid lines + Y labels */}
      {gridLines.map(({ km, y }) => (
        <g key={km}>
          <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
            className="chart-grid" style={km === 0 ? { stroke: "transparent" } : undefined}
            strokeWidth="1" strokeDasharray="4 3" />
          <text x={PAD.left - 8} y={y} textAnchor="end" dominantBaseline="middle" fontSize="11" className="chart-label">
            {km}
          </text>
        </g>
      ))}

      {/* Y axis */}
      <line x1={PAD.left} y1={axisBottom} x2={PAD.left} y2={PAD.top - 8}
        className="chart-axis" strokeWidth="1.5" markerEnd="url(#arr-my)" />
      {/* X axis */}
      <line x1={PAD.left} y1={axisBottom} x2={W - PAD.right + 8} y2={axisBottom}
        className="chart-axis" strokeWidth="1.5" markerEnd="url(#arr-mx)" />

      {/* Y axis label */}
      <text transform="rotate(-90)" x={-(PAD.top + plotH / 2)} y={18}
        textAnchor="middle" fontSize="12" className="chart-label">km</text>

      {/* Bars */}
      {values.map((km, i) => {
        const bx = toBarX(i);
        const bh = toBarH(km);
        const by = toBarY(km);
        const cx = bx + barW / 2;
        return (
          <g key={i}>
            <rect x={bx} y={km === 0 ? axisBottom - 2 : by}
              width={barW} height={km === 0 ? 2 : bh}
              className={km === 0 ? "chart-bar--zero" : "chart-bar"} rx="3" />
            {km > 0 && (
              <text x={cx} y={by - 6} textAnchor="middle" fontSize="10" fontWeight="600" className="chart-value">
                {Math.round(km)}
              </text>
            )}
            <text x={cx} y={axisBottom + 16} textAnchor="middle" fontSize="11" className="chart-label">
              {MONTH_LABELS[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
