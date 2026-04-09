import { GoogleLogin } from "@react-oauth/google";
import { FaTrophy, FaArrowsRotate, FaRightFromBracket, FaBullseye } from "react-icons/fa6";
import type { Tab } from "../types";
import { TAB_META, NAV_TABS } from "../constants";

interface DrawerProps {
  open: boolean;
  activeTab: Tab;
  googleCredential: string | null;
  syncLoading: Record<string, boolean>;
  syncError: string;
  onClose: () => void;
  onTabClick: (tab: Tab) => void;
  onSync: (source: "strava" | "garmin") => void;
  onGoCompetitions: () => void;
  onGoGoals: () => void;
  onLogout: () => void;
  onGoogleSuccess: (resp: { credential?: string }) => void;
  syncLabel: (src: "strava" | "garmin") => string;
}

export default function Drawer({
  open,
  activeTab,
  googleCredential,
  syncLoading,
  syncError,
  onClose,
  onTabClick,
  onSync,
  onGoCompetitions,
  onGoGoals,
  onLogout,
  onGoogleSuccess,
  syncLabel,
}: DrawerProps) {
  if (!open) return null;

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        {NAV_TABS.map((tab) => (
          <button
            key={tab}
            className={`drawer-item${activeTab === tab ? " active" : ""}`}
            onClick={() => { onTabClick(tab); onClose(); }}
          >
            {TAB_META[tab].icon}
            {TAB_META[tab].label}
          </button>
        ))}

        <div className="drawer-divider" />

        {googleCredential ? (
          <>
            {syncError && <p className="profile-error" style={{ padding: "0 1.5rem" }}>{syncError}</p>}
            {(["strava"] as const).map((src) => (
              <button key={src} className="drawer-item" disabled={syncLoading[src]}
                onClick={() => onSync(src)}>
                <FaArrowsRotate className={syncLoading[src] ? "spin" : ""} />
                {syncLabel(src)}
              </button>
            ))}
            <button className="drawer-item" disabled={syncLoading["garmin"]}
              onClick={() => onSync("garmin")}>
              <FaArrowsRotate className={syncLoading["garmin"] ? "spin" : ""} />
              {syncLabel("garmin")}
            </button>
            <button
              className={`drawer-item${activeTab === "competitions" ? " active" : ""}`}
              onClick={() => { onGoCompetitions(); onClose(); }}
            >
              <FaTrophy />Competitions
            </button>
            <button
              className={`drawer-item${activeTab === "goals" ? " active" : ""}`}
              onClick={() => { onGoGoals(); onClose(); }}
            >
              <FaBullseye />Goals
            </button>
            <button className="drawer-item drawer-signout" onClick={() => { onLogout(); onClose(); }}>
              <FaRightFromBracket />Sign out
            </button>
          </>
        ) : (
          <div className="drawer-login">
            <p>Sign in to sync data</p>
            <GoogleLogin onSuccess={(c) => { onGoogleSuccess(c); onClose(); }} onError={() => {/* handled by parent */}} />
          </div>
        )}
      </div>
    </div>
  );
}
