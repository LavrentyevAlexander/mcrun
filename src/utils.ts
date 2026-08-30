export function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function formatDuration(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function friendlyError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("token expired") || m.includes("certificate for key id"))
    return "Session expired. Please sign in again.";
  if (m.includes("unauthorized") || m.includes("forbidden"))
    return "Access denied.";
  if (m.includes("429") || m.includes("rate limit") || m.includes("too many requests"))
    return "Rate limit reached. Please try again in 15 minutes.";
  if (m.includes("postgres") || m.includes("database") || m.includes("socket"))
    return "Database connection error. Please try again later.";
  if (m.includes("failed to fetch") || m.includes("networkerror") || m.includes("load failed"))
    return "Network error. Check your connection and try again.";
  return msg;
}

export function defaultDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-01-01`;
}

export function decodeJwt(token: string): { picture?: string; name?: string; exp?: number } {
  try {
    return JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return {};
  }
}

/** `theme` for @react-oauth/google's <GoogleLogin>, matched to the app theme.
 *  Reads the attribute set on <html> (pre-paint + on every toggle). */
export function googleBtnTheme(): "outline" | "filled_black" {
  return document.documentElement.dataset.theme === "dark" ? "filled_black" : "outline";
}

/** True if the JWT is missing/malformed or its `exp` claim is in the past.
 *  `skewSec` treats a token expiring very soon as already expired. */
export function isTokenExpired(token: string | null | undefined, skewSec = 30): boolean {
  if (!token) return true;
  const { exp } = decodeJwt(token);
  if (!exp) return true;
  return Date.now() / 1000 >= exp - skewSec;
}
