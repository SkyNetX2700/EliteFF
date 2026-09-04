import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { apiFetch } from "@/lib/auth";

const DEFAULT_APP_NAME = "ELITE FF";
const DEFAULT_LOGO_URL = "/Elite_1777629983897.png";
const HV_KEY = "eliteff_hv";
const IDENTITY_KEY = "eliteff_app_identity";

export type AlertType =
  | "verified"
  | "congratulations"
  | "betterLuckNext"
  | "declined"
  | "tournamentCancelled"
  | "tournamentDelayed"
  | "roomIdReleased"
  | "verificationPending"
  | "matchCompleted"
  | "registrationSubmitted"
  | "paymentUpdated";

export interface Alert {
  id: string;
  type: AlertType;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  extra?: Record<string, string>;
  tournamentId?: number;
}

interface AppContextType {
  humanVerified: boolean;
  setHumanVerified: (v: boolean) => void;
  alerts: Alert[];
  addAlert: (a: Omit<Alert, "id" | "timestamp" | "read">) => void;
  markAlertRead: (id: string) => void;
  markAllRead: () => void;
  deleteAlert: (id: string) => void;
  clearAlerts: () => void;
  unreadCount: number;
  appName: string;
  logoUrl: string;
  setAppIdentity: (name: string, url: string) => Promise<void>;
  whatsappUrl: string;
  instagramUrl: string;
  setSocialLinks: (whatsapp: string, instagram: string) => void;
  theme: "dark" | "light";
  setTheme: (t: "dark" | "light") => void;
}

const AppContext = createContext<AppContextType>({
  humanVerified: false,
  setHumanVerified: () => {},
  alerts: [],
  addAlert: () => {},
  markAlertRead: () => {},
  markAllRead: () => {},
  deleteAlert: () => {},
  clearAlerts: () => {},
  unreadCount: 0,
  appName: DEFAULT_APP_NAME,
  logoUrl: DEFAULT_LOGO_URL,
  setAppIdentity: async () => {},
  whatsappUrl: "https://wa.me/",
  instagramUrl: "https://instagram.com/",
  setSocialLinks: () => {},
  theme: "dark",
  setTheme: () => {},
});

function genId() { return Math.random().toString(36).slice(2, 10); }

function getCurrentUsername(): string | null {
  try {
    const raw = localStorage.getItem("eliteff_active_user");
    if (!raw) return null;
    return JSON.parse(raw)?.username ?? null;
  } catch { return null; }
}

function alertsKey(username: string | null): string {
  return username ? `eliteff_alerts_${username}` : "eliteff_alerts_guest";
}

function loadAlerts(username: string | null): Alert[] {
  try {
    const raw = localStorage.getItem(alertsKey(username));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [humanVerified, setHumanVerifiedState] = useState(() => {
    try { return localStorage.getItem(HV_KEY) === "1"; } catch { return false; }
  });

  const [currentUsername, setCurrentUsername] = useState<string | null>(getCurrentUsername);

  const [alerts, setAlertsState] = useState<Alert[]>(() => loadAlerts(getCurrentUsername()));

  const [identity, setIdentity] = useState<{ name: string; url: string }>(() => {
    try {
      const raw = localStorage.getItem(IDENTITY_KEY);
      return raw ? JSON.parse(raw) : { name: DEFAULT_APP_NAME, url: DEFAULT_LOGO_URL };
    } catch { return { name: DEFAULT_APP_NAME, url: DEFAULT_LOGO_URL }; }
  });

  useEffect(() => {
    let active = true;
    apiFetch("/api/settings/public")
      .then(response => response.ok ? response.json() : null)
      .then(shared => {
        if (!active || !shared?.name || !shared?.logoUrl) return;
        const next = { name: String(shared.name), url: String(shared.logoUrl) };
        setIdentity(next);
        try { localStorage.setItem(IDENTITY_KEY, JSON.stringify(next)); } catch {}
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);
  const [socialLinks, setSocialLinksState] = useState(() => ({
    whatsapp: localStorage.getItem("eliteff_whatsapp_url") || "https://wa.me/",
    instagram: localStorage.getItem("eliteff_instagram_url") || "https://instagram.com/",
  }));

  const [theme, setThemeState] = useState<"dark" | "light">(() => {
    try { return (localStorage.getItem("eliteff_theme") as "dark" | "light") || "dark"; } catch { return "dark"; }
  });

  useEffect(() => {
    document.documentElement.classList.toggle("theme-light", theme === "light");
    localStorage.setItem("eliteff_theme", theme);
  }, [theme]);

  // Apply theme on mount
  useEffect(() => {
    document.documentElement.classList.toggle("theme-light", theme === "light");
  }, []);

  function setTheme(t: "dark" | "light") { setThemeState(t); }

  // Persist alerts to correct per-user key whenever they change
  useEffect(() => {
    localStorage.setItem(alertsKey(currentUsername), JSON.stringify(alerts));
  }, [alerts, currentUsername]);

  // Listen for user switches dispatched by AuthContext
  useEffect(() => {
    function handleUserChanged(e: Event) {
      const username = (e as CustomEvent<{ username: string | null }>).detail?.username ?? null;
      setCurrentUsername(username);
      setAlertsState(loadAlerts(username));
    }
    window.addEventListener("eliteff_user_changed", handleUserChanged);
    return () => window.removeEventListener("eliteff_user_changed", handleUserChanged);
  }, []);

  function setHumanVerified(v: boolean) {
    setHumanVerifiedState(v);
    if (v) localStorage.setItem(HV_KEY, "1");
  }

  const addAlert = useCallback((a: Omit<Alert, "id" | "timestamp" | "read">) => {
    setAlertsState(prev => [{ ...a, id: genId(), timestamp: Date.now(), read: false }, ...prev]);
  }, []);

  function markAlertRead(id: string) {
    setAlertsState(prev => prev.map(a => a.id === id ? { ...a, read: true } : a));
  }

  function markAllRead() {
    setAlertsState(prev => prev.map(a => ({ ...a, read: true })));
  }

  function deleteAlert(id: string) {
    setAlertsState(prev => prev.filter(a => a.id !== id));
  }

  function clearAlerts() { setAlertsState([]); }

  async function setAppIdentity(name: string, url: string) {
    const val = { name, url };
    setIdentity(val);
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(val));
    try {
      await apiFetch("/api/settings/branding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, logoUrl: url }),
      });
    } catch {
      // Keep the optimistic local value; the shared endpoint remains the
      // source of truth for other browsers once the database is migrated.
    }
  }

  function setSocialLinks(whatsapp: string, instagram: string) {
    const next = { whatsapp, instagram };
    setSocialLinksState(next);
    localStorage.setItem("eliteff_whatsapp_url", whatsapp);
    localStorage.setItem("eliteff_instagram_url", instagram);
  }

  const unreadCount = alerts.filter(a => !a.read).length;

  return (
    <AppContext.Provider value={{
      humanVerified, setHumanVerified,
      alerts, addAlert, markAlertRead, markAllRead, deleteAlert, clearAlerts,
      unreadCount,
      appName: identity.name,
      logoUrl: identity.url,
      setAppIdentity,
      whatsappUrl: socialLinks.whatsapp,
      instagramUrl: socialLinks.instagram,
      setSocialLinks,
      theme, setTheme,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() { return useContext(AppContext); }
