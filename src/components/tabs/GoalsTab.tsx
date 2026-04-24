import { useState } from "react";
import type { Goal } from "../../types";
import Skeleton from "../Skeleton";

type GoalEditData = { description: string; achieved: boolean; result: string };
type GoalAddData = { year: string; description: string; achieved: boolean; result: string };

interface GoalsTabProps {
  goals: Goal[] | null;
  goalsLoading: boolean;
  goalsError: string;
  googleCredential: string | null;
  goalsAddLoading: boolean;
  onAddGoal: (data: GoalAddData) => Promise<void>;
  onSaveGoalEdit: (id: number, data: GoalEditData) => Promise<void>;
}

export default function GoalsTab({
  goals,
  goalsLoading,
  goalsError,
  googleCredential,
  goalsAddLoading,
  onAddGoal,
  onSaveGoalEdit,
}: GoalsTabProps) {
  const [goalsEditingId, setGoalsEditingId] = useState<number | null>(null);
  const [goalsEditForm, setGoalsEditForm] = useState<GoalEditData>({ description: "", achieved: false, result: "" });
  const [goalsAddForm, setGoalsAddForm] = useState<GoalAddData>({ year: String(new Date().getFullYear()), description: "", achieved: false, result: "" });

  const yearGroups: Record<number, Goal[]> = {};
  (goals ?? []).forEach((g) => {
    if (!yearGroups[g.year]) yearGroups[g.year] = [];
    yearGroups[g.year].push(g);
  });
  const sortedYears = Object.keys(yearGroups).map(Number).sort((a, b) => b - a);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    await onAddGoal(goalsAddForm);
    setGoalsAddForm({ year: String(new Date().getFullYear()), description: "", achieved: false, result: "" });
  }

  async function handleSaveEdit(id: number) {
    await onSaveGoalEdit(id, goalsEditForm);
    setGoalsEditingId(null);
  }

  return (
    <div className="goals-wrap">
      {goalsLoading && <Skeleton variant="lines" rows={4} />}
      {goalsError && <p className="error">{goalsError}</p>}
      {sortedYears.map((yr) => {
        const items = yearGroups[yr];
        const doneCount = items.filter((g) => g.achieved).length;
        const pct = items.length ? Math.round((doneCount / items.length) * 100) : 0;
        const allDone = doneCount === items.length;
        return (
          <div key={yr} className="goals-year">
            <div className="goals-year-header">
              <span className="goals-year-label">{yr}</span>
              <div className="goals-progress">
                <div className="goals-progress-fill" style={{ width: `${pct}%`, background: allDone ? "var(--clr-green)" : "var(--clr-accent)" }} />
              </div>
              <span className="goals-year-count">{doneCount}/{items.length}</span>
            </div>
            <div className="goals-list">
              {items.map((g) => goalsEditingId === g.id ? (
                <div key={g.id} className="goal-card goal-card--editing">
                  <label className="goal-check-wrap">
                    <input type="checkbox" checked={goalsEditForm.achieved}
                      onChange={(e) => setGoalsEditForm((f) => ({ ...f, achieved: e.target.checked }))} />
                  </label>
                  <div className="goal-edit-fields">
                    <input value={goalsEditForm.description}
                      onChange={(e) => setGoalsEditForm((f) => ({ ...f, description: e.target.value }))}
                      style={{ flex: 1 }} placeholder="Description" />
                    <input value={goalsEditForm.result}
                      onChange={(e) => setGoalsEditForm((f) => ({ ...f, result: e.target.value }))}
                      style={{ width: 90 }} placeholder="Result" />
                  </div>
                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    <button onClick={() => handleSaveEdit(g.id)} style={{ padding: "0.25rem 0.6rem", fontSize: "0.8rem" }}>Save</button>
                    <button onClick={() => setGoalsEditingId(null)} style={{ padding: "0.25rem 0.6rem", fontSize: "0.8rem", background: "#888" }}>✕</button>
                  </div>
                </div>
              ) : (
                <div key={g.id} className={`goal-card${g.achieved ? " goal-card--done" : ""}`}>
                  <div className={`goal-check${g.achieved ? " goal-check--done" : ""}`}>
                    {g.achieved ? "✓" : ""}
                  </div>
                  <span className="goal-desc">{g.description}</span>
                  {g.result && <span className="goal-result">{g.result}</span>}
                  {googleCredential && (
                    <button className="goal-edit-btn" onClick={() => {
                      setGoalsEditingId(g.id);
                      setGoalsEditForm({ description: g.description, achieved: g.achieved, result: g.result ?? "" });
                    }}>✎</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {googleCredential && (
        <details style={{ marginTop: "1.5rem" }}>
          <summary style={{ cursor: "pointer", marginBottom: "0.75rem" }}>Add goal</summary>
          <form onSubmit={handleAdd} style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxWidth: 420 }}>
            <input type="number" placeholder="Year" required value={goalsAddForm.year}
              onChange={(e) => setGoalsAddForm((f) => ({ ...f, year: e.target.value }))} />
            <input placeholder="Description" required value={goalsAddForm.description}
              onChange={(e) => setGoalsAddForm((f) => ({ ...f, description: e.target.value }))} />
            <input placeholder="Result (optional, e.g. 49:03)" value={goalsAddForm.result}
              onChange={(e) => setGoalsAddForm((f) => ({ ...f, result: e.target.value }))} />
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem" }}>
              <input type="checkbox" checked={goalsAddForm.achieved}
                onChange={(e) => setGoalsAddForm((f) => ({ ...f, achieved: e.target.checked }))} />
              Achieved
            </label>
            <button type="submit" disabled={goalsAddLoading}>{goalsAddLoading ? "Saving…" : "Add"}</button>
          </form>
        </details>
      )}
    </div>
  );
}
