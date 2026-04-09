import { FaHouse, FaPersonRunning, FaCalendarDays, FaTrophy, FaBolt, FaHeartPulse, FaCalendarCheck, FaBullseye } from "react-icons/fa6";
import { GiRunningShoe } from "react-icons/gi";
import type { Tab } from "./types";

export const TAB_META: Record<string, { label: string; icon: React.ReactNode }> = {
  home:         { label: "Home",           icon: <FaHouse /> },
  runs:         { label: "Run History",    icon: <FaPersonRunning /> },
  yearly:       { label: "Mileage",        icon: <FaCalendarDays /> },
  gear:         { label: "Gear",           icon: <GiRunningShoe /> },
  health:       { label: "Health",         icon: <FaHeartPulse /> },
  calendar:     { label: "Calendar",       icon: <FaCalendarCheck /> },
  competitions: { label: "Competitions",   icon: <FaTrophy /> },
  goals:        { label: "Goals",          icon: <FaBullseye /> },
  records:      { label: "Records",        icon: <FaBolt /> },
};

export const NAV_TABS: Tab[] = ["home", "runs", "yearly", "gear", "health", "calendar", "records"];

export const LOGOS = ["/logo.png", "/logo-2.png", "/logo-3.jpg", "/logo-4.png"];
