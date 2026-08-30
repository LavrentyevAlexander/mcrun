import { GoogleLogin } from "@react-oauth/google";
import { FaTrophy, FaUser, FaArrowsRotate, FaRightFromBracket, FaBullseye, FaHeartPulse, FaSun, FaMoon } from "react-icons/fa6";
import type { Tab } from "../types";
import { TAB_META, NAV_TABS } from "../constants";
import { decodeJwt } from "../utils";

interface NavbarProps {
  activeTab: Tab;
  googleCredential: string | null;
  profileOpen: boolean;
  syncLoading: Record<string, boolean>;
  syncError: string;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onTabClick: (tab: Tab) => void;
  onProfileToggle: () => void;
  onSync: (source: "strava" | "garmin") => void;
  onGoCompetitions: () => void;
  onGoGoals: () => void;
  onGoHealth: () => void;
  onLogout: () => void;
  onGoogleSuccess: (resp: { credential?: string }) => void;
  syncLabel: (src: "strava" | "garmin") => string;
  onLogoClick: () => void;
  onMenuOpen: () => void;
}

export default function Navbar({
  activeTab,
  googleCredential,
  profileOpen,
  syncLoading,
  syncError,
  theme,
  onToggleTheme,
  onTabClick,
  onProfileToggle,
  onSync,
  onGoCompetitions,
  onGoGoals,
  onGoHealth,
  onLogout,
  onGoogleSuccess,
  syncLabel,
  onLogoClick,
  onMenuOpen,
}: NavbarProps) {
  const avatar = googleCredential ? decodeJwt(googleCredential).picture : null;

  return (
    <>
      <nav className="navbar">
        <img src="/sneaker.png" alt="McRun" className="logo logo--link" onClick={onLogoClick} />
        <div className="nav-tabs">
          {NAV_TABS.map((tab) => (
            <button
              key={tab}
              className={`nav-tab${activeTab === tab ? " active" : ""}`}
              onClick={() => onTabClick(tab)}
            >
              {TAB_META[tab].icon}
              {TAB_META[tab].label}
            </button>
          ))}
        </div>

        {/* Profile button — desktop */}
        <div className="profile-wrap">
          <button
            className={`profile-btn${profileOpen ? " active" : ""}`}
            onClick={onProfileToggle}
            aria-label="Account"
          >
            {avatar
              ? <img src={avatar} className="profile-avatar" alt="profile" referrerPolicy="no-referrer" />
              : <FaUser />}
          </button>
          {profileOpen && (
            <div className="profile-dropdown">
              <button
                type="button"
                className="profile-action theme-row"
                role="switch"
                aria-checked={theme === "dark"}
                aria-label="Dark mode"
                onClick={onToggleTheme}
              >
                {theme === "dark" ? <FaMoon /> : <FaSun />}
                <span>Dark mode</span>
                <span className={`theme-switch${theme === "dark" ? " on" : ""}`} aria-hidden="true">
                  <span className="theme-switch-knob" />
                </span>
              </button>
              <div className="profile-divider" />
              {googleCredential ? (
                <>
                  {syncError && <p className="profile-error">{syncError}</p>}
                  {(["strava"] as const).map((src) => (
                    <button key={src} className="profile-action" disabled={syncLoading[src]}
                      onClick={() => onSync(src)}>
                      <FaArrowsRotate className={syncLoading[src] ? "spin" : ""} />
                      <span>{syncLabel(src)}</span>
                    </button>
                  ))}
                  <button className="profile-action" disabled={syncLoading["garmin"]}
                    onClick={() => onSync("garmin")}>
                    <FaArrowsRotate className={syncLoading["garmin"] ? "spin" : ""} />
                    <span>{syncLabel("garmin")}</span>
                  </button>
                  <div className="profile-divider" />
                  <button className="profile-action" onClick={() => { onGoHealth(); onProfileToggle(); }}>
                    <FaHeartPulse /><span>Health</span>
                  </button>
                  <button className="profile-action" onClick={() => { onGoCompetitions(); onProfileToggle(); }}>
                    <FaTrophy /><span>Competitions</span>
                  </button>
                  <button className="profile-action" onClick={() => { onGoGoals(); onProfileToggle(); }}>
                    <FaBullseye /><span>Goals</span>
                  </button>
                  <div className="profile-divider" />
                  <button className="profile-action profile-signout" onClick={() => { onLogout(); onProfileToggle(); }}>
                    <FaRightFromBracket /><span>Sign out</span>
                  </button>
                </>
              ) : (
                <div className="profile-login">
                  <p>Sign in to sync data</p>
                  <GoogleLogin onSuccess={onGoogleSuccess} onError={() => {/* handled by parent */}} />
                </div>
              )}
            </div>
          )}
        </div>

        <button className="hamburger" onClick={onMenuOpen} aria-label="Open menu">
          <span /><span /><span />
        </button>
      </nav>

      {profileOpen && <div className="profile-overlay" onClick={onProfileToggle} />}
    </>
  );
}
