export default function YearlyChart({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data).sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return null;

  const W = 620, H = 320;
  const PAD = { top: 32, right: 24, bottom: 56, left: 64 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const maxKm = Math.max(...entries.map(([, km]) => km));
  const yMax = Math.ceil(maxKm / 500) * 500 || 500;

  const axisBottom = PAD.top + plotH;
  const slotW = plotW / entries.length;
  const barW = Math.min(slotW * 0.7, 80);
  const toBarX = (i: number) => PAD.left + slotW * i + (slotW - barW) / 2;
  const toBarH = (km: number) => (km / yMax) * plotH;
  const toBarY = (km: number) => PAD.top + plotH - toBarH(km);

  const gridSteps = 5;
  const gridLines = Array.from({ length: gridSteps + 1 }, (_, i) => {
    const km = Math.round((yMax / gridSteps) * i);
    return { km, y: toBarY(km) };
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="yearly-chart">
      <defs>
        <marker id="arr-x" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#ccc" />
        </marker>
        <marker id="arr-y" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#ccc" />
        </marker>
      </defs>

      {/* Horizontal grid lines + Y labels */}
      {gridLines.map(({ km, y }) => (
        <g key={km}>
          <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
            stroke={km === 0 ? "transparent" : "#e8e8e8"} strokeWidth="1" strokeDasharray="4 3" />
          <text x={PAD.left - 8} y={y} textAnchor="end" dominantBaseline="middle" fontSize="11" fill="#aaa">
            {km}
          </text>
        </g>
      ))}

      {/* Y axis */}
      <line x1={PAD.left} y1={axisBottom} x2={PAD.left} y2={PAD.top - 8}
        stroke="#ccc" strokeWidth="1.5" markerEnd="url(#arr-y)" />
      {/* X axis */}
      <line x1={PAD.left} y1={axisBottom} x2={W - PAD.right + 8} y2={axisBottom}
        stroke="#ccc" strokeWidth="1.5" markerEnd="url(#arr-x)" />

      {/* Y axis label */}
      <text transform="rotate(-90)" x={-(PAD.top + plotH / 2)} y={18}
        textAnchor="middle" fontSize="12" fill="#aaa">km</text>

      {/* Bars */}
      {entries.map(([year, km], i) => {
        const bx = toBarX(i);
        const bh = toBarH(km);
        const by = toBarY(km);
        const cx = bx + barW / 2;
        return (
          <g key={year}>
            <rect x={bx} y={by} width={barW} height={bh} fill="#fc4c02" rx="4" />
            <text x={cx} y={by - 8} textAnchor="middle" fontSize="12" fontWeight="600" fill="#555">
              {Math.round(km)}
            </text>
            <text x={cx} y={axisBottom + 18} textAnchor="middle" fontSize="12" fill="#aaa">
              {year}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
