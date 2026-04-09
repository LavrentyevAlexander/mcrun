import type { GarminRecord } from "../../types";

interface RecordsTabProps {
  records: GarminRecord[] | null;
  recordsLoading: boolean;
}

export default function RecordsTab({ records, recordsLoading }: RecordsTabProps) {
  return (
    <div className="table-compact">
      {recordsLoading && <div className="loading-box">Loading…</div>}
      {!recordsLoading && records && (
        <table>
          <thead>
            <tr>
              <th>Distance</th>
              <th>Time</th>
              <th>Pace / min/km</th>
              <th>Date</th>
              <th>Activity</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.label}>
                <td data-label="Distance">{r.label}</td>
                <td data-label="Time">{r.time}</td>
                <td data-label="Pace / min/km">{r.pace}</td>
                <td data-label="Date">{r.date.split("-").reverse().join(".")}</td>
                <td data-label="Activity">
                  <a href={`https://connect.garmin.com/modern/activity/${r.activity_id}`} target="_blank" rel="noopener noreferrer">
                    {r.activity_name || "Garmin"}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
