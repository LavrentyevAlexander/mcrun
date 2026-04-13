export interface Activity {
  date: string;
  name: string;
  strava_id: number;
  km: number;
  elapsed_sec: number;
  avg_pace: string | null;
  avg_hr: number | null;
  elevation: number | null;
  relative_effort: number | null;
  gear: string;
}

export interface GearInfo {
  id: number;
  total_km: number;
  limit_km: number | null;
  image_url: string | null;
}

export interface GarminRecord {
  label: string;
  distance_m: number;
  time: string;
  pace: string;
  date: string;
  activity_id: number;
  activity_name: string;
}

export interface GarminMetrics {
  vo2_max: number | null;
  vo2_max_label: string | null;
  fitness_age: number | null;
  training_status: string | null;
  training_load: number | null;
  acute_load: number | null;
  hrv_last_night: number | null;
  hrv_weekly_avg: number | null;
  hrv_status: string | null;
  training_readiness: number | null;
  readiness_level: string | null;
  readiness_feedback: string | null;
  sleep_score: number | null;
  sleep_score_feedback: string | null;
  recovery_time: number | null;
  recovery_time_feedback: string | null;
  acwr_feedback: string | null;
  resting_hr: number | null;
  resting_hr_7day: string | null; // JSON string: [{date, value}]
  race_5k: string | null;
  race_10k: string | null;
  race_hm: string | null;
  race_marathon: string | null;
  lt_hr: number | null;
  lt_pace: string | null;
  endurance_score: number | null;
  endurance_label: string | null;
  avg_stress: number | null;
  heat_acclim_level: string | null;
  synced_at: string | null;
}

export interface StatsResponse {
  activities: Activity[];
  gear_summary: Record<string, GearInfo>;
  error?: string;
}

export interface Competition {
  id: number;
  competition: string;
  location: string | null;
  date: string;
  distance: string;
  time: string | null;
  rank: string | null;
  link: string | null;
}

export interface Goal {
  id: number;
  year: number;
  description: string;
  achieved: boolean;
  result: string | null;
  sort_order: number;
}

export interface GarminActivity {
  id: string;
  date: string;
  name: string;
  activity_type: string;
  distance_km: number;
  duration_sec: number;
  calories: number | null;
  aerobic_te: number | null;
  anaerobic_te: number | null;
}

export type Tab = "home" | "runs" | "yearly" | "gear" | "health" | "calendar" | "competitions" | "goals" | "records";
