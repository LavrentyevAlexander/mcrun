import { useState } from "react";
import type { StatsResponse } from "../../types";

interface GearTabProps {
  allTimeData: StatsResponse | null;
  allTimeLoading: boolean;
  allTimeError: string;
  googleCredential: string | null;
  gearError: string;
  onSaveGearEdit: (id: number, name: string, limit_km: string, image_url: string) => Promise<void>;
  onAddGear: (name: string, limit_km: string, image_url: string) => Promise<void>;
}

export default function GearTab({
  allTimeData,
  allTimeLoading,
  allTimeError,
  googleCredential,
  gearError,
  onSaveGearEdit,
  onAddGear,
}: GearTabProps) {
  const [gearEditingId, setGearEditingId] = useState<number | null>(null);
  const [gearEditForm, setGearEditForm] = useState({ name: "", limit_km: "", image_url: "" });
  const [gearAddForm, setGearAddForm] = useState({ name: "", limit_km: "", image_url: "" });
  const [gearAddLoading, setGearAddLoading] = useState(false);
  const [gearTooltip, setGearTooltip] = useState<{ name: string; imageUrl: string; top: number; left: number } | null>(null);

  async function handleAddGear(e: React.FormEvent) {
    e.preventDefault();
    setGearAddLoading(true);
    await onAddGear(gearAddForm.name, gearAddForm.limit_km, gearAddForm.image_url);
    setGearAddForm({ name: "", limit_km: "", image_url: "" });
    setGearAddLoading(false);
  }

  async function handleSaveGearEdit(id: number) {
    await onSaveGearEdit(id, gearEditForm.name, gearEditForm.limit_km, gearEditForm.image_url);
    setGearEditingId(null);
  }

  return (
    <>
      {allTimeError && <p className="error">{allTimeError}</p>}
      {allTimeLoading && <div className="loading-box">Loading…</div>}
      {!allTimeLoading && allTimeData && (
        <div className="table-compact">
          {gearError && <p className="error">{gearError}</p>}
          <table>
            <thead>
              <tr>
                <th>Shoe</th>
                <th>Total km</th>
                <th>Limit km</th>
                <th>Wear</th>
                <th>Status</th>
                {googleCredential && <th></th>}
              </tr>
            </thead>
            <tbody>
              {Object.entries(allTimeData.gear_summary)
                .sort(([, a], [, b]) => b.total_km - a.total_km)
                .map(([name, info]) => {
                  const wear = info.limit_km ? Math.round((info.total_km / info.limit_km) * 100) : null;
                  const wearColor = wear === null ? undefined
                    : wear < 50 ? "#2e7d32"
                    : wear < 70 ? "#f9a825"
                    : wear < 80 ? "#e65100"
                    : "#c62828";

                  if (googleCredential && gearEditingId === info.id) {
                    return (
                      <tr key={name}>
                        <td><input value={gearEditForm.name} onChange={(e) => setGearEditForm((f) => ({ ...f, name: e.target.value }))} style={{ width: "100%" }} /></td>
                        <td>{info.total_km.toFixed(2)}</td>
                        <td><input type="number" value={gearEditForm.limit_km} onChange={(e) => setGearEditForm((f) => ({ ...f, limit_km: e.target.value }))} style={{ width: 80 }} /></td>
                        <td>—</td>
                        <td>—</td>
                        <td style={{ display: "flex", gap: "0.4rem" }}>
                          <button onClick={() => handleSaveGearEdit(info.id)} style={{ padding: "0.25rem 0.6rem", fontSize: "0.8rem" }}>Save</button>
                          <button onClick={() => setGearEditingId(null)} style={{ padding: "0.25rem 0.6rem", fontSize: "0.8rem", background: "#888" }}>✕</button>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr
                      key={name}
                      onMouseEnter={info.image_url ? (e) => {
                        const r = e.currentTarget.getBoundingClientRect();
                        setGearTooltip({ name, imageUrl: info.image_url!, top: r.top, left: r.right + 12 });
                      } : undefined}
                      onMouseLeave={info.image_url ? () => setGearTooltip(null) : undefined}
                      style={info.image_url ? { cursor: "default" } : undefined}
                    >
                      <td data-label="">{name}</td>
                      <td data-label="Total, km">{info.total_km.toFixed(2)}</td>
                      <td data-label="Limit, km">{info.limit_km ?? "—"}</td>
                      <td data-label="Wear" style={wearColor ? { color: wearColor, fontWeight: 600 } : {}}>
                        {wear !== null ? `${wear}%` : "—"}
                      </td>
                      <td data-label="Status">
                        {wear !== null && wear >= 100 ? (
                          <span style={{ background: "#c62828", color: "#fff", borderRadius: 4, padding: "0.15rem 0.5rem", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.04em" }}>Retired</span>
                        ) : "—"}
                      </td>
                      {googleCredential && (
                        <td>
                          <button
                            onClick={() => { setGearEditingId(info.id); setGearEditForm({ name, limit_km: String(info.limit_km ?? ""), image_url: info.image_url ?? "" }); }}
                            style={{ padding: "0.25rem 0.6rem", fontSize: "0.8rem", background: "transparent", color: "#888", border: "1px solid #ddd" }}
                          >✎</button>
                        </td>
                      )}
                    </tr>
                  );
                })}
            </tbody>
          </table>

          {googleCredential && (
            <details style={{ marginTop: "1.5rem" }}>
              <summary style={{ cursor: "pointer", marginBottom: "0.75rem" }}>Add shoe</summary>
              <form onSubmit={handleAddGear} style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxWidth: 420 }}>
                <input placeholder="Shoe name" required value={gearAddForm.name} onChange={(e) => setGearAddForm((f) => ({ ...f, name: e.target.value }))} />
                <input type="number" placeholder="Limit km (optional)" value={gearAddForm.limit_km} onChange={(e) => setGearAddForm((f) => ({ ...f, limit_km: e.target.value }))} />
                <input placeholder="Image URL (optional)" value={gearAddForm.image_url} onChange={(e) => setGearAddForm((f) => ({ ...f, image_url: e.target.value }))} />
                <button type="submit" disabled={gearAddLoading}>{gearAddLoading ? "Saving…" : "Add"}</button>
              </form>
            </details>
          )}
        </div>
      )}
      {gearTooltip && (
        <div
          className="gear-tooltip"
          style={{ top: gearTooltip.top, left: gearTooltip.left }}
        >
          <img src={gearTooltip.imageUrl} alt={gearTooltip.name} />
          <span>{gearTooltip.name}</span>
        </div>
      )}
    </>
  );
}
