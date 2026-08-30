import { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { FaArrowUpRightFromSquare } from "react-icons/fa6";
import type { Competition } from "../../types";
import { localDateStr, googleBtnTheme } from "../../utils";
import Skeleton from "../Skeleton";

type CompFormData = { competition: string; location: string; date: string; distance: string; time: string; rank: string; link: string };

const emptyForm: CompFormData = { competition: "", location: "", date: "", distance: "", time: "", rank: "", link: "" };

interface CompetitionsTabProps {
  googleCredential: string | null;
  competitions: Competition[] | null;
  competitionsLoading: boolean;
  addError: string;
  addLoading: boolean;
  onAddCompetition: (data: CompFormData) => Promise<void>;
  onSaveEdit: (id: number, data: CompFormData) => Promise<void>;
  onGoogleSuccess: (resp: { credential?: string }) => void;
}

export default function CompetitionsTab({
  googleCredential,
  competitions,
  competitionsLoading,
  addError,
  addLoading,
  onAddCompetition,
  onSaveEdit,
  onGoogleSuccess,
}: CompetitionsTabProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<CompFormData>(emptyForm);
  const [addForm, setAddForm] = useState<CompFormData>(emptyForm);

  const todayStr = localDateStr(new Date());

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    await onAddCompetition(addForm);
    setAddForm(emptyForm);
  }

  async function handleSaveEdit(id: number) {
    await onSaveEdit(id, editForm);
    setEditingId(null);
  }

  return (
    <div>
      {!googleCredential ? (
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <p style={{ marginBottom: "1rem" }}>Sign in to view competitions</p>
          <GoogleLogin
            key={googleBtnTheme()}
            theme={googleBtnTheme()}
            onSuccess={onGoogleSuccess}
            onError={() => {/* error handled by parent */}}
          />
        </div>
      ) : (
        <>
          {competitionsLoading && <Skeleton variant="table" rows={6} />}
          {addError && <p className="error">{addError}</p>}
          {!competitionsLoading && competitions && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Competition</th>
                    <th>Location</th>
                    <th>Date</th>
                    <th>Distance</th>
                    <th>Time</th>
                    <th>Rank</th>
                    <th>Results</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {competitions.map((c, i) => editingId === c.id ? (
                    <tr key={c.id}>
                      <td data-label="#">{i + 1}</td>
                      <td data-label="Competition"><input value={editForm.competition} onChange={(e) => setEditForm((f) => ({ ...f, competition: e.target.value }))} style={{ width: "100%" }} /></td>
                      <td data-label="Location"><input value={editForm.location} onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))} style={{ width: "100%" }} /></td>
                      <td data-label="Date"><input type="date" value={editForm.date} onChange={(e) => setEditForm((f) => ({ ...f, date: e.target.value }))} /></td>
                      <td data-label="Distance"><input value={editForm.distance} onChange={(e) => setEditForm((f) => ({ ...f, distance: e.target.value }))} style={{ width: 80 }} /></td>
                      <td data-label="Time"><input value={editForm.time} onChange={(e) => setEditForm((f) => ({ ...f, time: e.target.value }))} style={{ width: 80 }} /></td>
                      <td data-label="Rank"><input value={editForm.rank} onChange={(e) => setEditForm((f) => ({ ...f, rank: e.target.value }))} style={{ width: 90 }} /></td>
                      <td data-label="Results"><input value={editForm.link} onChange={(e) => setEditForm((f) => ({ ...f, link: e.target.value }))} style={{ width: 120 }} /></td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <button onClick={() => handleSaveEdit(c.id)} style={{ padding: "0.25rem 0.6rem", fontSize: "0.8rem", marginRight: "0.3rem" }}>Save</button>
                        <button onClick={() => setEditingId(null)} style={{ padding: "0.25rem 0.6rem", fontSize: "0.8rem", background: "var(--clr-muted)" }}>✕</button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={c.id} className={c.date < todayStr ? "comp-past" : ""}>
                      <td data-label="#">{i + 1}</td>
                      <td data-label="Competition">{c.competition}</td>
                      <td data-label="Location">{c.location ?? "—"}</td>
                      <td data-label="Date">{c.date.split("-").reverse().join(".")}</td>
                      <td data-label="Distance">{c.distance}</td>
                      <td data-label="Time">{c.time ?? "—"}</td>
                      <td data-label="Rank">{c.rank ?? "—"}</td>
                      <td data-label="Results">
                        {c.link ? (
                          <a href={c.link} target="_blank" rel="noopener noreferrer"><FaArrowUpRightFromSquare /></a>
                        ) : "—"}
                      </td>
                      <td>
                        <button
                          onClick={() => { setEditingId(c.id); setEditForm({ competition: c.competition, location: c.location ?? "", date: c.date, distance: c.distance, time: c.time ?? "", rank: c.rank ?? "", link: c.link ?? "" }); }}
                          style={{ padding: "0.25rem 0.6rem", fontSize: "0.8rem", background: "transparent", color: "var(--clr-muted)", border: "1px solid var(--clr-border-strong)" }}
                        >✎</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <details style={{ marginTop: "1.5rem" }}>
            <summary style={{ cursor: "pointer", marginBottom: "0.75rem" }}>Add competition</summary>
            <form onSubmit={handleAdd} style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxWidth: 420 }}>
              <input placeholder="Competition name" required value={addForm.competition} onChange={(e) => setAddForm((f) => ({ ...f, competition: e.target.value }))} />
              <input placeholder="Location (e.g. Moscow)" value={addForm.location} onChange={(e) => setAddForm((f) => ({ ...f, location: e.target.value }))} />
              <input type="date" required value={addForm.date} onChange={(e) => setAddForm((f) => ({ ...f, date: e.target.value }))} />
              <input placeholder="Distance (e.g. 10 km)" required value={addForm.distance} onChange={(e) => setAddForm((f) => ({ ...f, distance: e.target.value }))} />
              <input placeholder="Time (e.g. 0:58:34)" value={addForm.time} onChange={(e) => setAddForm((f) => ({ ...f, time: e.target.value }))} />
              <input placeholder="Rank (e.g. 136 (191))" value={addForm.rank} onChange={(e) => setAddForm((f) => ({ ...f, rank: e.target.value }))} />
              <input placeholder="Link (optional)" value={addForm.link} onChange={(e) => setAddForm((f) => ({ ...f, link: e.target.value }))} />
              <button type="submit" disabled={addLoading}>{addLoading ? "Saving…" : "Add"}</button>
            </form>
          </details>
        </>
      )}
    </div>
  );
}
