import type { GarminActivity } from "../../types";
import { localDateStr, formatDuration } from "../../utils";

function guessType(name: string, type: string): string {
  if (type && type !== "") return type;
  const n = name.toLowerCase();
  if (n.includes("бег") || n.includes("run") || n.includes("темп") || /\d\s*[хx]\s*\d/.test(n) || n.includes("интервал") || n.includes("кросс")) return "running";
  if (n.includes("upper") || n.includes("lower") || n.includes("push") || n.includes("pull") || n.includes("strength") || n.includes("силов")) return "strength";
  if (n.includes("bike") || n.includes("велос") || n.includes("cycling")) return "cycling";
  if (n.includes("swim") || n.includes("плав")) return "swimming";
  return "other";
}

function typeEmoji(type: string): string {
  if (type === "running") return "🏃";
  if (type === "cycling") return "🚴";
  if (type === "swimming") return "🏊";
  if (type === "strength") return "💪";
  return "⚡";
}

function typeClass(type: string): string {
  if (type === "running") return "cal-run";
  if (type === "cycling") return "cal-bike";
  if (type === "swimming") return "cal-swim";
  if (type === "strength") return "cal-strength";
  return "cal-other";
}

const DOW_RU: Record<string, string> = { Mon: "Пн", Tue: "Вт", Wed: "Ср", Thu: "Чт", Fri: "Пт", Sat: "Сб", Sun: "Вс" };
const MON_RU: Record<string, string> = { Jan: "янв", Feb: "фев", Mar: "мар", Apr: "апр", May: "май", Jun: "июн", Jul: "июл", Aug: "авг", Sep: "сен", Oct: "окт", Nov: "ноя", Dec: "дек" };

function fmtDow(d: Date): string {
  const en = d.toLocaleString("en", { weekday: "short" });
  return DOW_RU[en] ?? en;
}

function fmtMonthDay(d: Date): string {
  const m = d.toLocaleString("en", { month: "short" });
  return `${d.getDate()} ${MON_RU[m] ?? m}`;
}

interface CalendarTabProps {
  calendarEvents: GarminActivity[] | null;
  calendarLoading: boolean;
  calendarError: string;
}

export default function CalendarTab({ calendarEvents, calendarLoading, calendarError }: CalendarTabProps) {
  const today = new Date();
  const todayStr = localDateStr(today);
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });

  const eventsByDate: Record<string, GarminActivity[]> = {};
  (calendarEvents || []).forEach((e) => {
    if (!eventsByDate[e.date]) eventsByDate[e.date] = [];
    eventsByDate[e.date].push(e);
  });

  return (
    <div className="cal-agenda-wrap">
      {calendarLoading && <div className="loading-box">Loading…</div>}
      {calendarError && <p className="error">{calendarError}</p>}
      {!calendarLoading && calendarEvents === null && (
        <p className="health-empty" style={{ textAlign: "center" }}>No data — sync Garmin to populate.</p>
      )}
      {!calendarLoading && (
        <div className="cal-agenda">
          {days.map((d) => {
            const dateStr = localDateStr(d);
            const events = eventsByDate[dateStr] || [];
            const isToday = dateStr === todayStr;
            return (
              <div key={dateStr} className={`cal-row${isToday ? " cal-row--today" : ""}${events.length === 0 ? " cal-row--rest" : ""}`}>
                <div className="cal-row-label">
                  <span className="cal-row-dow">{isToday ? "сегодня" : fmtDow(d)}</span>
                  <span className="cal-row-date">{fmtMonthDay(d)}</span>
                </div>
                <div className="cal-row-events">
                  {events.length === 0 ? (
                    <span className="cal-rest-label">—</span>
                  ) : (
                    events.map((ev, j) => {
                      const t = guessType(ev.name, ev.activity_type);
                      return (
                        <div key={j} className={`cal-card ${typeClass(t)}`}>
                          <div className="cal-card-top">
                            <span className="cal-card-emoji">{typeEmoji(t)}</span>
                            <span className="cal-card-name">{ev.name || t}</span>
                          </div>
                          {(ev.distance_km > 0 || ev.duration_sec > 0) && (
                            <div className="cal-card-meta">
                              {ev.distance_km > 0 && <span>{ev.distance_km.toFixed(1)} км</span>}
                              {ev.duration_sec > 0 && <span>{formatDuration(ev.duration_sec)}</span>}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
