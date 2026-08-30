import { GoogleLogin } from "@react-oauth/google";
import type { GarminMetrics } from "../../types";
import React from "react";

function trainingStatusStyle(status: string | null): React.CSSProperties {
  const s = (status ?? "").toLowerCase();
  if (s === "productive")   return { background: "var(--stat-good-bg)", color: "var(--stat-good-fg)" };
  if (s === "peaking")      return { background: "var(--stat-info-bg)", color: "var(--stat-info-fg)" };
  if (s === "maintaining")  return { background: "var(--stat-neutral-bg)", color: "var(--stat-neutral-fg)" };
  if (s === "recovery")     return { background: "var(--stat-cool-bg)", color: "var(--stat-cool-fg)" };
  if (s === "unproductive") return { background: "var(--stat-warn-bg)", color: "var(--stat-warn-fg)" };
  if (s === "strained")     return { background: "var(--stat-warn-bg)", color: "var(--stat-warn-fg)" };
  if (s === "overreaching") return { background: "var(--stat-danger-bg)", color: "var(--stat-danger-fg)" };
  return { background: "var(--stat-neutral-bg)", color: "var(--stat-neutral-fg)" };
}

function hrvStatusStyle(status: string | null): React.CSSProperties {
  const s = (status ?? "").toLowerCase();
  if (s === "balanced")    return { background: "var(--stat-good-bg)", color: "var(--stat-good-fg)" };
  if (s === "unbalanced")  return { background: "var(--stat-warn-bg)", color: "var(--stat-warn-fg)" };
  return { background: "var(--stat-neutral-bg)", color: "var(--stat-neutral-fg)" };
}

function acwrFeedbackStyle(v: string | null): React.CSSProperties {
  const s = (v ?? "").toLowerCase();
  if (s === "very good") return { background: "var(--stat-good-bg)", color: "var(--stat-good-fg)" };
  if (s === "good")      return { background: "var(--stat-good-bg)", color: "var(--stat-good-fg)" };
  if (s === "moderate" || s === "fair") return { background: "var(--stat-info-bg)", color: "var(--stat-info-fg)" };
  if (s === "poor")      return { background: "var(--stat-warn-bg)", color: "var(--stat-warn-fg)" };
  if (s === "very poor") return { background: "var(--stat-danger-bg)", color: "var(--stat-danger-fg)" };
  return { background: "var(--stat-neutral-bg)", color: "var(--stat-neutral-fg)" };
}

function readinessLabel(v: number): string {
  if (v <= 25)  return "low";
  if (v <= 50)  return "fair";
  if (v <= 75)  return "good";
  return "high";
}

function readinessStyle(v: number): React.CSSProperties {
  if (v <= 25)  return { background: "var(--stat-danger-bg)", color: "var(--stat-danger-fg)" };
  if (v <= 50)  return { background: "var(--stat-warn-bg)", color: "var(--stat-warn-fg)" };
  if (v <= 75)  return { background: "var(--stat-info-bg)", color: "var(--stat-info-fg)" };
  return { background: "var(--stat-good-bg)", color: "var(--stat-good-fg)" };
}

function feedbackStyle(v: string | null): React.CSSProperties {
  const s = (v ?? "").toLowerCase();
  if (s === "very good") return { background: "var(--stat-good-bg)", color: "var(--stat-good-fg)" };
  if (s === "good")      return { background: "var(--stat-good-bg)", color: "var(--stat-good-fg)" };
  if (s === "moderate")  return { background: "var(--stat-info-bg)", color: "var(--stat-info-fg)" };
  if (s === "fair")      return { background: "var(--stat-warn-bg)", color: "var(--stat-warn-fg)" };
  if (s === "poor")      return { background: "var(--stat-warn-bg)", color: "var(--stat-warn-fg)" };
  if (s === "very poor") return { background: "var(--stat-danger-bg)", color: "var(--stat-danger-fg)" };
  return { background: "var(--stat-neutral-bg)", color: "var(--stat-neutral-fg)" };
}

function stressStyle(avg: number): React.CSSProperties {
  if (avg <= 25) return { background: "var(--stat-good-bg)", color: "var(--stat-good-fg)" };
  if (avg <= 50) return { background: "var(--stat-info-bg)", color: "var(--stat-info-fg)" };
  if (avg <= 75) return { background: "var(--stat-warn-bg)", color: "var(--stat-warn-fg)" };
  return { background: "var(--stat-danger-bg)", color: "var(--stat-danger-fg)" };
}

function stressLabel(avg: number): string {
  if (avg <= 25) return "Low";
  if (avg <= 50) return "Moderate";
  if (avg <= 75) return "High";
  return "Very High";
}

function enduranceStyle(label: string | null): React.CSSProperties {
  const s = (label ?? "").toLowerCase();
  if (s === "elite" || s === "superior") return { background: "var(--stat-good-bg)", color: "var(--stat-good-fg)" };
  if (s === "expert" || s === "well trained") return { background: "var(--stat-info-bg)", color: "var(--stat-info-fg)" };
  if (s === "trained") return { background: "var(--stat-neutral-bg)", color: "var(--stat-neutral-fg)" };
  return { background: "var(--stat-warn-bg)", color: "var(--stat-warn-fg)" };
}

interface HealthTabProps {
  garminMetrics: GarminMetrics | null;
  googleCredential: string | null;
  onGoogleSuccess: (resp: { credential?: string }) => void;
}

export default function HealthTab({ garminMetrics, googleCredential, onGoogleSuccess }: HealthTabProps) {
  if (!googleCredential) {
    return (
      <div style={{ textAlign: "center", padding: "2rem" }}>
        <p style={{ marginBottom: "1rem" }}>Sign in to view health metrics</p>
        <GoogleLogin
          onSuccess={onGoogleSuccess}
          onError={() => {/* error handled by parent */}}
        />
      </div>
    );
  }

  return (
    <div className="health-tiles">
      {!garminMetrics && <p className="health-empty">No data yet — sync Garmin to populate.</p>}
      {garminMetrics && (<>
        <div className="metric-card">
          <span className="metric-label">VO₂ Max</span>
          <span className="metric-value">{garminMetrics.vo2_max ?? "—"}</span>
          {garminMetrics.vo2_max_label && (
            <span className="metric-badge" style={feedbackStyle(garminMetrics.vo2_max_label === "Good" || garminMetrics.vo2_max_label === "Excellent" || garminMetrics.vo2_max_label === "Superior" ? "good" : garminMetrics.vo2_max_label === "Average" || garminMetrics.vo2_max_label === "Above Average" ? "moderate" : "poor")}>
              {garminMetrics.vo2_max_label}
            </span>
          )}
        </div>
        {garminMetrics.fitness_age !== null && (
          <div className="metric-card">
            <span className="metric-label">Fitness age</span>
            <span className="metric-value">{garminMetrics.fitness_age}</span>
          </div>
        )}
        {garminMetrics.training_status && (
          <div className="metric-card">
            <span className="metric-label">Training status</span>
            <span className="metric-badge" style={trainingStatusStyle(garminMetrics.training_status)}>
              {garminMetrics.training_status}
            </span>
          </div>
        )}
        {garminMetrics.training_load !== null && (
          <div className="metric-card">
            <span className="metric-label">Chronic load</span>
            <span className="metric-value">{Math.round(garminMetrics.training_load)}</span>
          </div>
        )}
        {garminMetrics.acute_load !== null && (
          <div className="metric-card">
            <span className="metric-label">Acute load</span>
            <span className="metric-value">{Math.round(garminMetrics.acute_load)}</span>
            {garminMetrics.acwr_feedback && (
              <span className="metric-badge" style={acwrFeedbackStyle(garminMetrics.acwr_feedback)}>
                {garminMetrics.acwr_feedback}
              </span>
            )}
          </div>
        )}
        {garminMetrics.hrv_last_night !== null && (
          <div className="metric-card">
            <span className="metric-label">HRV last night</span>
            <span className="metric-value">{garminMetrics.hrv_last_night}</span>
            {garminMetrics.hrv_weekly_avg !== null && (
              <span className="metric-sub">Weekly avg {garminMetrics.hrv_weekly_avg}</span>
            )}
            {garminMetrics.hrv_status && (
              <span className="metric-badge" style={hrvStatusStyle(garminMetrics.hrv_status)}>
                {garminMetrics.hrv_status.toLowerCase()}
              </span>
            )}
          </div>
        )}
        {garminMetrics.training_readiness !== null && (
          <div className="metric-card">
            <span className="metric-label">Training readiness</span>
            <span className="metric-value">{garminMetrics.training_readiness}</span>
            <span className="metric-sub">out of 100</span>
            <span className="metric-badge" style={readinessStyle(garminMetrics.training_readiness)}>
              {garminMetrics.readiness_level
                ? garminMetrics.readiness_level.toLowerCase()
                : readinessLabel(garminMetrics.training_readiness)}
            </span>
            {garminMetrics.readiness_feedback && (
              <span className="metric-sub">{garminMetrics.readiness_feedback}</span>
            )}
          </div>
        )}
        {garminMetrics.sleep_score !== null && (
          <div className="metric-card">
            <span className="metric-label">Sleep score</span>
            <span className="metric-value">{garminMetrics.sleep_score}</span>
            <span className="metric-sub">out of 100</span>
            {garminMetrics.sleep_score_feedback && (
              <span className="metric-badge" style={feedbackStyle(garminMetrics.sleep_score_feedback)}>
                {garminMetrics.sleep_score_feedback}
              </span>
            )}
          </div>
        )}
        {garminMetrics.recovery_time !== null && garminMetrics.recovery_time > 0 && (
          <div className="metric-card">
            <span className="metric-label">Recovery time</span>
            {(() => {
              const totalMin = garminMetrics.recovery_time!;
              const h = Math.floor(totalMin / 60);
              const m = totalMin % 60;
              return (
                <span className="metric-value">
                  {h > 0 ? <>{h}<span style={{ fontSize: "0.6em", opacity: 0.7 }}>h</span>{m > 0 ? <> {m}<span style={{ fontSize: "0.6em", opacity: 0.7 }}>m</span></> : null}</> : <>{m}<span style={{ fontSize: "0.6em", opacity: 0.7 }}>m</span></>}
                </span>
              );
            })()}
            {garminMetrics.recovery_time_feedback && (
              <span className="metric-badge" style={feedbackStyle(garminMetrics.recovery_time_feedback)}>
                {garminMetrics.recovery_time_feedback}
              </span>
            )}
          </div>
        )}
        {garminMetrics.resting_hr !== null && (
          <div className="metric-card">
            <span className="metric-label">Resting HR</span>
            <span className="metric-value">{garminMetrics.resting_hr} <span style={{ fontSize: "0.6em", opacity: 0.7 }}>bpm</span></span>
            {garminMetrics.resting_hr_7day && (() => {
              const trend: { date: string; value: number | null }[] = (() => {
                try { return JSON.parse(garminMetrics.resting_hr_7day!); } catch { return []; }
              })();
              const vals = trend.map(p => p.value).filter((v): v is number => v !== null);
              if (vals.length < 2) return null;
              const min = Math.min(...vals), max = Math.max(...vals);
              const W = 80, H = 28, pad = 2;
              const x = (i: number) => pad + (i / (vals.length - 1)) * (W - pad * 2);
              const y = (v: number) => H - pad - ((v - min) / (max - min || 1)) * (H - pad * 2);
              const points = vals.map((v, i) => `${x(i)},${y(v)}`).join(" ");
              return (
                <svg width={W} height={H} style={{ display: "block", margin: "6px auto 0" }}>
                  <polyline points={points} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
                </svg>
              );
            })()}
          </div>
        )}
        {(garminMetrics.race_5k || garminMetrics.race_10k || garminMetrics.race_hm || garminMetrics.race_marathon) && (
          <div className="metric-card metric-card--wide">
            <span className="metric-label">Race predictions</span>
            <div className="predictions-grid">
              {garminMetrics.race_5k && (
                <div className="prediction-block">
                  <span className="prediction-dist">5K</span>
                  <span className="prediction-time">{garminMetrics.race_5k}</span>
                </div>
              )}
              {garminMetrics.race_10k && (
                <div className="prediction-block">
                  <span className="prediction-dist">10K</span>
                  <span className="prediction-time">{garminMetrics.race_10k}</span>
                </div>
              )}
              {garminMetrics.race_hm && (
                <div className="prediction-block">
                  <span className="prediction-dist">HM</span>
                  <span className="prediction-time">{garminMetrics.race_hm}</span>
                </div>
              )}
              {garminMetrics.race_marathon && (
                <div className="prediction-block">
                  <span className="prediction-dist">Marathon</span>
                  <span className="prediction-time">{garminMetrics.race_marathon}</span>
                </div>
              )}
            </div>
          </div>
        )}
        {(garminMetrics.lt_hr || garminMetrics.lt_pace) && (
          <div className="metric-card">
            <span className="metric-label">Lactate Threshold</span>
            {garminMetrics.lt_pace && (
              <span className="metric-value">
                {garminMetrics.lt_pace}
                <span style={{ fontSize: "0.55em", opacity: 0.7 }}> /km</span>
              </span>
            )}
            {garminMetrics.lt_hr && (
              <span className="metric-sub">{garminMetrics.lt_hr} bpm</span>
            )}
          </div>
        )}
        {garminMetrics.endurance_score !== null && (
          <div className="metric-card">
            <span className="metric-label">Endurance Score</span>
            <span className="metric-value">{garminMetrics.endurance_score}</span>
            {garminMetrics.endurance_label && (
              <span className="metric-badge" style={enduranceStyle(garminMetrics.endurance_label)}>
                {garminMetrics.endurance_label}
              </span>
            )}
          </div>
        )}
        {garminMetrics.avg_stress !== null && garminMetrics.avg_stress >= 0 && (
          <div className="metric-card">
            <span className="metric-label">Stress</span>
            <span className="metric-value">{garminMetrics.avg_stress}</span>
            <span className="metric-sub">avg today</span>
            <span className="metric-badge" style={stressStyle(garminMetrics.avg_stress)}>
              {stressLabel(garminMetrics.avg_stress)}
            </span>
          </div>
        )}
        {garminMetrics.heat_acclim_level && (
          <div className="metric-card">
            <span className="metric-label">Heat Acclimation</span>
            <span className="metric-value">{garminMetrics.heat_acclim_level}</span>
          </div>
        )}
        <div className="metric-card metric-card--muted">
          <span className="metric-label">Last synced</span>
          <span className="metric-sub">{garminMetrics.synced_at ? new Date(garminMetrics.synced_at).toLocaleString() : "—"}</span>
        </div>
      </>)}
    </div>
  );
}
