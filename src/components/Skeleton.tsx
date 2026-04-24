interface SkeletonProps {
  variant?: "lines" | "table";
  rows?: number;
}

export default function Skeleton({ variant = "lines", rows = 5 }: SkeletonProps) {
  if (variant === "table") {
    return (
      <div className="skeleton-table">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="skeleton skeleton-row" style={{ opacity: 1 - i * 0.12 }} />
        ))}
      </div>
    );
  }
  const widths = ["75%", "90%", "60%", "80%", "55%", "70%", "85%"];
  return (
    <div className="skeleton-lines">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="skeleton skeleton-line"
          style={{ width: widths[i % widths.length] }}
        />
      ))}
    </div>
  );
}
