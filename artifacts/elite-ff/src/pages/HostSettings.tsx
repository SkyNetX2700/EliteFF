import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Upload, RotateCcw, Bell, PanelTop, Settings, Timer, Trophy, Skull, Plus, Trash2, ChevronUp, ChevronDown, BarChart2, Users, Zap, Crown, Gift, Sparkles, Star, MessageSquare } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useAppContext } from "@/contexts/AppContext";
import { useGetTournaments } from "@workspace/api-client-react";
import { apiFetch } from "@/lib/auth";

const SETTINGS_KEY = "eliteff_host_settings";
const NOTIF_EVENTS_KEY = "eliteff_notif_events";

type NotifStyle = "in-app" | "push" | "both";

interface KillEntry { name: string; kills: number; }

interface HostSettingsData {
  autoSlotAssign: boolean;
  autoTeamRivalry: boolean;
  compactView: boolean;
  timerEnabled: boolean;
  timerDuration: number;
  defaultPrizeTemplate: string;
  notifStyle: NotifStyle;
  showKillRankings: boolean;
}

const DEFAULT_SETTINGS: HostSettingsData = {
  autoSlotAssign: true,
  autoTeamRivalry: false,
  compactView: false,
  timerEnabled: false,
  timerDuration: 30,
  defaultPrizeTemplate: "50/30/20 Split",
  notifStyle: "in-app",
  showKillRankings: true,
};

const NOTIF_EVENTS_DEFAULT = {
  verificationPending: true,
  roomIdReleased: true,
  matchCompleted: true,
  tournamentDelayed: true,
  tournamentCancelled: true,
  notifyOnPayment: true,
};

const PRIZE_TEMPLATES = ["50/30/20 Split", "70/30 Split", "500/250/100", "Custom"];

const NOTIF_EVENT_LABELS: Record<string, string> = {
  verificationPending: "Alert when a player submits a registration form for your tournament",
  roomIdReleased: "Alert when you upload match credentials for a tournament",
  matchCompleted: "Alert when a match result is finalised and uploaded",
  tournamentDelayed: "Alert when a tournament start time is pushed back",
  tournamentCancelled: "Alert when a tournament is marked as cancelled",
  notifyOnPayment: "Get notified when a UTR/payment is confirmed.",
};

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="relative w-12 h-6 rounded-full transition-all duration-300 flex-shrink-0"
      style={{ background: checked ? "linear-gradient(135deg, #ff6b35, #ff4500)" : "var(--th-border2)" }}
    >
      <span
        className="absolute top-0.5 w-5 h-5 rounded-full transition-all duration-300"
        style={{
          background: "white",
          left: checked ? "26px" : "2px",
          boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
        }}
      />
    </button>
  );
}

export default function HostSettings() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { appName, logoUrl, setAppIdentity } = useAppContext();

  const [settings, setSettings] = useState<HostSettingsData>(() => {
    try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") }; }
    catch { return DEFAULT_SETTINGS; }
  });

  const [notifEvents, setNotifEvents] = useState<Record<string, boolean>>(() => {
    try { return { ...NOTIF_EVENTS_DEFAULT, ...JSON.parse(localStorage.getItem(NOTIF_EVENTS_KEY) || "{}") }; }
    catch { return NOTIF_EVENTS_DEFAULT; }
  });

  const [editName, setEditName] = useState(appName);
  const [customPrize, setCustomPrize] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [logoErr, setLogoErr] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [killRankings, setKillRankings] = useState<KillEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem("eliteff_kill_rankings") || "[]"); } catch { return []; }
  });
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerKills, setNewPlayerKills] = useState("");
  const [killError, setKillError] = useState("");
  const [bestPlayers, setBestPlayers] = useState<any[]>([]);
  const [bestPlayersLoading, setBestPlayersLoading] = useState(false);
  const [bestPlayersError, setBestPlayersError] = useState("");
  const [clearDataOpen, setClearDataOpen] = useState(false);
  const [clearDataLoading, setClearDataLoading] = useState(false);
  const [clearDataError, setClearDataError] = useState("");

  useEffect(() => {
    if (!user?.isHost) return;
    let active = true;
    setBestPlayersLoading(true);
    apiFetch("/api/stats/best-player")
      .then(r => r.ok ? r.json() : Promise.reject(new Error("Unable to load best players")))
      .then(data => {
        if (active) setBestPlayers(Array.isArray(data) ? data : []);
      })
      .catch(error => {
        if (active) setBestPlayersError(error instanceof Error ? error.message : "Unable to load best players");
      })
      .finally(() => {
        if (active) setBestPlayersLoading(false);
      });
    return () => { active = false; };
  }, [user?.isHost]);

  function saveKillRankings(updated: KillEntry[]) {
    const sorted = [...updated].sort((a, b) => b.kills - a.kills);
    setKillRankings(sorted);
    localStorage.setItem("eliteff_kill_rankings", JSON.stringify(sorted));
  }

  function addKillEntry() {
    if (!newPlayerName.trim()) { setKillError("Player name is required"); return; }
    const kills = parseInt(newPlayerKills);
    if (isNaN(kills) || kills < 0) { setKillError("Enter a valid kill count"); return; }
    if (killRankings.find(e => e.name.toLowerCase() === newPlayerName.trim().toLowerCase())) {
      setKillError("Player already exists — delete the old entry first"); return;
    }
    setKillError("");
    saveKillRankings([...killRankings, { name: newPlayerName.trim(), kills }]);
    setNewPlayerName("");
    setNewPlayerKills("");
  }

  function removeKillEntry(name: string) {
    saveKillRankings(killRankings.filter(e => e.name !== name));
  }

  function updateKills(name: string, delta: number) {
    saveKillRankings(killRankings.map(e => e.name === name ? { ...e, kills: Math.max(0, e.kills + delta) } : e));
  }

  const { data: allTournaments = [] } = useGetTournaments(undefined, {
    query: { queryKey: ["getTournaments"] } as any,
  });

  const stats = (() => {
    const totalTournaments = (allTournaments as any[]).length;
    let totalPlayers = 0;
    let totalPrize = 0;
    for (const t of allTournaments as any[]) {
      totalPlayers += t.filledSlots ?? 0;
      totalPrize += t.prizePool ?? 0;
    }
    const live = (allTournaments as any[]).filter((t: any) => t.status === "live").length;
    return { totalTournaments, totalPlayers, totalPrize, live };
  })();

  if (!user?.isHost) {
    return (
      <div className="flex items-center justify-center py-20 px-6 text-center">
        <p className="text-muted-foreground">Host access required</p>
      </div>
    );
  }

  function update<K extends keyof HostSettingsData>(k: K, v: HostSettingsData[K]) {
    setSettings(prev => ({ ...prev, [k]: v }));
  }

  async function handleSave() {
    setConfirmOpen(false);
    setSaving(true);
    await new Promise(r => setTimeout(r, 500));
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    localStorage.setItem(NOTIF_EVENTS_KEY, JSON.stringify(notifEvents));
    await setAppIdentity(editName || appName, logoUrl);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function removeBestPlayer(resultId: number) {
    setBestPlayersError("");
    try {
      const response = await apiFetch(`/api/stats/best-player/${resultId}`, { method: "DELETE" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "Unable to remove this best player");
      setBestPlayers(current => current.filter(player => player.id !== resultId));
    } catch (error) {
      setBestPlayersError(error instanceof Error ? error.message : "Unable to remove this best player");
    }
  }

  async function clearAllAppData() {
    setClearDataLoading(true);
    setClearDataError("");
    try {
      const response = await apiFetch("/api/admin/clear-all-data", { method: "DELETE" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "Unable to clear app data");
      for (let i = localStorage.length - 1; i >= 0; i -= 1) {
        const key = localStorage.key(i);
        if (key?.startsWith("eliteff_") && key !== "eliteff_supabase_session") localStorage.removeItem(key);
      }
      window.location.reload();
    } catch (error) {
      setClearDataError(error instanceof Error ? error.message : "Unable to clear app data");
      setClearDataLoading(false);
    }
  }

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setLogoErr("Please upload an image file."); return; }
    if (file.size > 5 * 1024 * 1024) { setLogoErr("Logo upload failed. Please try again."); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      const url = ev.target?.result as string;
      setAppIdentity(editName || appName, url);
      setLogoErr("");
    };
    reader.readAsDataURL(file);
  }

  function Section({ icon: Icon, title, children }: any) {
    return (
      <div className="rounded-2xl p-5 flex flex-col gap-4" style={{ background: "var(--th-card)", border: "1px solid var(--th-border)" }}>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,107,53,0.12)" }}>
            <Icon size={18} style={{ color: "#ff6b35" }} />
          </div>
          <div className="font-display font-bold text-sm tracking-wide text-foreground uppercase">{title}</div>
        </div>
        {children}
      </div>
    );
  }

  function ToggleRow({ label, sublabel, checked, onChange }: any) {
    return (
      <div className="flex items-start justify-between gap-4" style={{ borderTop: "1px solid var(--th-card2)", paddingTop: "14px" }}>
        <div className="flex-1 min-w-0 pr-1">
          <div className="text-sm font-semibold text-foreground break-words">{label}</div>
          {sublabel && <div className="text-xs mt-0.5 leading-relaxed break-words" style={{ color: "var(--th-muted)" }}>{sublabel}</div>}
        </div>
        <Toggle checked={checked} onChange={onChange} />
      </div>
    );
  }

  return (
    <div className="px-4 py-4 flex flex-col gap-4 pb-8" data-testid="host_settings.page">
      <button onClick={() => navigate("/settings")} className="flex items-center gap-2 text-muted-foreground text-sm transition-smooth hover:text-foreground" data-testid="host_settings.back_button">
        <ArrowLeft size={16} /> Back to Settings
      </button>

      <div className="font-display font-black text-3xl text-foreground">Advanced Settings</div>
      <p className="text-sm -mt-2" style={{ color: "var(--th-muted)" }}>Host-only configuration</p>

      {/* Platform Stats */}
      <div className="rounded-2xl p-5 flex flex-col gap-4" style={{ background: "var(--th-card)", border: "1px solid var(--th-border)" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,107,53,0.12)" }}>
            <BarChart2 size={18} style={{ color: "#ff6b35" }} />
          </div>
          <div className="font-display font-bold text-sm tracking-wide text-foreground uppercase">Platform Stats</div>
          {stats.live > 0 && (
            <span className="ml-auto flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: "rgba(34,197,94,0.15)", color: "#4ade80" }}>
              <Zap size={10} /> {stats.live} Live
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl p-3 text-center" style={{ background: "var(--th-card2)", border: "1px solid var(--th-border2)" }}>
            <div className="text-2xl font-black text-foreground">{stats.totalTournaments}</div>
            <div className="text-[10px] font-bold uppercase mt-0.5 leading-tight" style={{ color: "var(--th-dim)" }}>Events</div>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: "var(--th-card2)", border: "1px solid var(--th-border2)" }}>
            <div className="text-2xl font-black text-foreground flex items-center justify-center gap-1">
              <Users size={16} style={{ color: "#ff6b35" }} />{stats.totalPlayers}
            </div>
            <div className="text-[10px] font-bold uppercase mt-0.5 leading-tight" style={{ color: "var(--th-dim)" }}>Players</div>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: "var(--th-card2)", border: "1px solid var(--th-border2)" }}>
            <div className="text-xl font-black leading-tight" style={{ color: "#fbbf24" }}>
              {stats.totalPrize >= 1000 ? `₹${(stats.totalPrize / 1000).toFixed(1)}k` : `₹${stats.totalPrize}`}
            </div>
            <div className="text-[10px] font-bold uppercase mt-0.5 leading-tight" style={{ color: "var(--th-dim)" }}>Prize</div>
          </div>
        </div>
      </div>

      {/* Host Rank Card */}
      <div className="rounded-2xl p-4 mb-2" style={{ background: "var(--th-card)" }}>
        <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "var(--th-dim)" }}>Your Rank</div>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center font-display font-black text-lg" style={{ background: "linear-gradient(135deg, #ff6b35, #ff4500)", color: "#0a0e27" }}>
            {(user?.rank ?? "Blaze").slice(0,2).toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="font-display font-bold text-foreground flex items-center gap-1">
              <Crown size={12} style={{ color: "#fbbf24" }} /> {user?.rank ?? "Blaze"}
            </div>
            <div className="text-xs" style={{ color: "var(--th-muted)" }}>{user?.points ?? 0} pts</div>
          </div>
          <div className="flex flex-col gap-1 text-right">
            {(user?.prestigeStars ?? 0) > 0 && (
              <span className="text-xs font-bold" style={{ color: "#ff6b35" }}>
                <Sparkles size={10} className="inline mr-0.5" />{user?.prestigeStars}
              </span>
            )}
            {(user?.totalEarnings ?? 0) > 0 && (
              <span className="text-xs font-bold" style={{ color: "#fbbf24" }}>
                <Gift size={10} className="inline mr-0.5" />₹{(user?.totalEarnings ?? 0).toLocaleString("en-IN")}
              </span>
            )}
          </div>
        </div>
        {/* Point shifts */}
        {user?.pointShifts && (() => {
          try {
            const shifts = JSON.parse(user.pointShifts);
            if (!shifts.length) return null;
            return (
              <div className="mt-3 flex flex-col gap-1">
                <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--th-dimmer)" }}>Recent Shifts</div>
                {shifts.slice(0, 5).map((s: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg px-2 py-1" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <span className={`text-[10px] font-black ${s.delta >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {s.delta >= 0 ? "↑" : "↓"} {s.delta > 0 ? "+" : ""}{s.delta}
                    </span>
                    <span className="text-[11px] flex-1 truncate" style={{ color: "var(--th-muted)" }}>{s.reason}</span>
                    <span className="text-[10px]" style={{ color: "var(--th-dimmer)" }}>{new Date(s.at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                  </div>
                ))}
              </div>
            );
          } catch { return null; }
        })()}
      </div>

      {/* App Identity */}
      <Section icon={Settings} title="App Identity">
        <p className="text-xs -mt-2 leading-relaxed" style={{ color: "var(--th-muted)" }}>
          Customize the app name and logo shown to all players across the entire app.
        </p>
        <div>
          <label className="text-xs font-bold text-muted-foreground mb-1.5 block">App Name</label>
          <input
            value={editName}
            onChange={e => setEditName(e.target.value)}
            className="w-full h-10 rounded-xl px-4 text-sm"
            style={{ background: "var(--th-card2)", border: "1px solid var(--th-border2)", color: "var(--th-text)" }}
            data-testid="host_settings.app_name_input"
          />
        </div>
        {/* Logo */}
        <div>
          <label className="text-xs font-bold text-muted-foreground mb-1.5 block">Logo</label>
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0" style={{ background: "var(--th-card2)" }}>
              <img src={logoUrl} alt="logo" className="w-16 h-16 rounded-2xl object-cover" />
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-smooth active:scale-95"
                style={{ background: "rgba(255,107,53,0.12)", color: "#ff6b35", border: "1px solid rgba(255,107,53,0.2)" }}
                data-testid="host_settings.logo_upload_button"
              >
                <Upload size={12} /> Upload logo
              </button>
              <button
                onClick={() => setAppIdentity(editName || appName, "/Elite_1777629983897.png")}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-smooth active:scale-95"
                style={{ background: "var(--th-border)", color: "var(--th-muted)" }}
                data-testid="host_settings.logo_reset_button"
              >
                <RotateCcw size={12} /> Reset
              </button>
            </div>
          </div>
          {logoErr && <p className="text-xs mt-1" style={{ color: "#ff4500" }}>{logoErr}</p>}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
        </div>
        {/* UPI */}
        <div>
          <label className="text-xs font-bold text-muted-foreground mb-1.5 block">Main UPI ID</label>
          <input
            defaultValue={localStorage.getItem("eliteff_main_upi_id") || ""}
            onBlur={e => localStorage.setItem("eliteff_main_upi_id", e.target.value)}
            placeholder="yourname@bank"
            className="w-full h-10 rounded-xl px-4 text-sm"
            style={{ background: "var(--th-card2)", border: "1px solid var(--th-border2)", color: "var(--th-text)" }}
            data-testid="host_settings.main_upi_input"
          />
          <p className="text-xs mt-1" style={{ color: "var(--th-dim)" }}>
            Changing this will notify all players to refresh and see the updated QR code.
          </p>
        </div>
      </Section>

      {/* Auto Settings */}
      <Section icon={PanelTop} title="Auto Settings">
        <ToggleRow
          label="Auto-Slot Assignment"
          sublabel="Verified registrations automatically receive a slot number in order of registration."
          checked={settings.autoSlotAssign}
          onChange={(v: boolean) => update("autoSlotAssign", v)}
          data-testid="host_settings.auto_slot.toggle"
        />
        <ToggleRow
          label="Auto Team Rivalry"
          sublabel="When enabled, teams are automatically paired as opponents when an even number of teams register."
          checked={settings.autoTeamRivalry}
          onChange={(v: boolean) => update("autoTeamRivalry", v)}
          data-testid="host_settings.auto_team_rivalry.toggle"
        />
        <ToggleRow
          label="Compact View"
          sublabel="Show smaller tournament cards to fit more on screen."
          checked={settings.compactView}
          onChange={(v: boolean) => update("compactView", v)}
          data-testid="host_settings.compact_view.toggle"
        />
      </Section>

      {/* Timer */}
      <Section icon={Timer} title="Tournament Timer">
        <ToggleRow
          label="Enable Countdown Timer"
          sublabel="Show a live countdown to players on the tournament detail page."
          checked={settings.timerEnabled}
          onChange={(v: boolean) => update("timerEnabled", v)}
          data-testid="host_settings.timer_enabled.toggle"
        />
        {settings.timerEnabled && (
          <div>
            <label className="text-xs font-bold text-muted-foreground mb-1.5 block">
              When a tournament starts, players will see a
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={settings.timerDuration}
                onChange={e => update("timerDuration", Number(e.target.value))}
                min={1}
                className="h-10 w-24 rounded-xl px-3 text-sm"
                style={{ background: "var(--th-card2)", border: "1px solid var(--th-border2)", color: "var(--th-text)" }}
                data-testid="host_settings.timer_duration.input"
              />
              <span className="text-sm text-muted-foreground">minute countdown</span>
            </div>
          </div>
        )}
      </Section>

      {/* Prize Templates */}
      <Section icon={Trophy} title="Prize Templates">
        <p className="text-xs -mt-2" style={{ color: "var(--th-muted)" }}>
          Set the default prize split applied when creating new tournaments.
        </p>
        <div className="grid grid-cols-2 gap-2" data-testid="host_settings.prize_template.list">
          {PRIZE_TEMPLATES.map(t => (
            <button
              key={t}
              onClick={() => update("defaultPrizeTemplate", t)}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-smooth active:scale-95"
              style={settings.defaultPrizeTemplate === t
                ? { background: "linear-gradient(135deg, #ff6b35, #ff4500)", color: "#0a0e27" }
                : { background: "var(--th-border)", color: "var(--th-muted)" }}
            >
              {t}
            </button>
          ))}
        </div>
        {settings.defaultPrizeTemplate === "Custom" && (
          <input
            value={customPrize}
            onChange={e => setCustomPrize(e.target.value)}
            placeholder="e.g. 60/25/15"
            className="w-full h-10 rounded-xl px-4 text-sm"
            style={{ background: "var(--th-card2)", border: "1px solid var(--th-border2)", color: "var(--th-text)" }}
            data-testid="host_settings.custom_prize_input"
          />
        )}
      </Section>

      {/* Kill Rankings */}
      <Section icon={Skull} title="Kill Rankings">
        <p className="text-xs -mt-2 leading-relaxed" style={{ color: "var(--th-muted)" }}>
          Manage the global kill leaderboard shown to all players on the Tournaments page.
        </p>
        <ToggleRow
          label="Show Kill Rankings Tab"
          sublabel="Display the Kill Rankings tab on the Tournaments page for all users."
          checked={settings.showKillRankings}
          onChange={(v: boolean) => update("showKillRankings", v)}
        />

        {/* Add entry form */}
        <div className="flex flex-col gap-2 pt-1">
          <div className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--th-dim)" }}>Add / Update Player</div>
          <div className="flex gap-2">
            <input
              value={newPlayerName}
              onChange={e => setNewPlayerName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addKillEntry()}
              placeholder="Player name"
              className="flex-1 h-10 rounded-xl px-3 text-sm"
              style={{ background: "var(--th-card2)", border: "1px solid var(--th-border2)", color: "var(--th-text)" }}
            />
            <input
              value={newPlayerKills}
              onChange={e => setNewPlayerKills(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addKillEntry()}
              placeholder="Kills"
              type="number"
              min={0}
              className="w-20 h-10 rounded-xl px-3 text-sm"
              style={{ background: "var(--th-card2)", border: "1px solid var(--th-border2)", color: "var(--th-text)" }}
            />
            <button
              onClick={addKillEntry}
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-smooth active:scale-90"
              style={{ background: "linear-gradient(135deg, #ff6b35, #ff4500)", color: "#0a0e27" }}
              title="Add player"
            >
              <Plus size={16} />
            </button>
          </div>
          {killError && <p className="text-xs font-semibold" style={{ color: "#ff4500" }}>{killError}</p>}
        </div>

        {/* Current rankings list */}
        {killRankings.length > 0 ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--th-dim)" }}>
                Leaderboard ({killRankings.length} players)
              </div>
              <button
                onClick={() => saveKillRankings([])}
                className="text-xs font-semibold flex items-center gap-1 transition-smooth hover:opacity-80"
                style={{ color: "#ff4500" }}
              >
                <Trash2 size={11} /> Clear All
              </button>
            </div>
            {killRankings.map((entry, i) => (
              <div
                key={entry.name}
                className="flex items-center gap-2 rounded-xl px-3 py-2.5"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--th-border)" }}
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0"
                  style={i === 0
                    ? { background: "rgba(251,191,36,0.2)", color: "#fbbf24" }
                    : i === 1
                    ? { background: "rgba(156,163,175,0.15)", color: "#9ca3af" }
                    : i === 2
                    ? { background: "rgba(180,83,9,0.15)", color: "#b45309" }
                    : { background: "var(--th-border)", color: "var(--th-dim)" }}
                >
                  #{i + 1}
                </div>
                <span className="flex-1 text-sm font-semibold text-foreground truncate">{entry.name}</span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => updateKills(entry.name, -1)} className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-white/10 transition-smooth" title="Decrease">
                    <ChevronDown size={13} className="text-muted-foreground" />
                  </button>
                  <span className="text-sm font-black w-8 text-center" style={{ color: "#ff4500" }}>{entry.kills}</span>
                  <button onClick={() => updateKills(entry.name, 1)} className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-white/10 transition-smooth" title="Increase">
                    <ChevronUp size={13} className="text-muted-foreground" />
                  </button>
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0">kills</span>
                <button
                  onClick={() => removeKillEntry(entry.name)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-smooth hover:bg-red-500/15 flex-shrink-0"
                  style={{ color: "#ff4500" }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl py-5 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed var(--th-border2)" }}>
            <Skull size={24} className="mx-auto mb-2" style={{ color: "var(--th-dimmer)" }} />
            <p className="text-xs" style={{ color: "var(--th-dim)" }}>No players yet. Add the first entry above.</p>
          </div>
        )}
      </Section>

      {/* Public best players */}
      <Section icon={Crown} title="24h Best Players">
        <p className="text-xs -mt-2" style={{ color: "var(--th-muted)" }}>
          Completed results appear here for 24 hours. Remove any player from the public showcase at any time without deleting the tournament result.
        </p>
        {bestPlayersLoading ? (
          <div className="rounded-xl p-4 text-sm" style={{ color: "var(--th-muted)", background: "rgba(255,255,255,0.03)" }}>Loading recent best players...</div>
        ) : bestPlayers.length === 0 ? (
          <div className="rounded-xl p-4 text-sm" style={{ color: "var(--th-dim)", background: "rgba(255,255,255,0.03)" }}>No best players in the last 24 hours.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {bestPlayers.map((player, index) => (
              <div key={player.id} className="flex items-center gap-3 rounded-xl p-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--th-border)" }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs" style={{ background: "rgba(251,191,36,0.14)", color: "#fbbf24" }}>#{index + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-foreground truncate">{player.username || "Unknown player"}</div>
                  <div className="text-xs truncate" style={{ color: "var(--th-muted)" }}>{player.tournamentName || "Tournament"}{player.prize > 0 ? ` · ₹${player.prize}` : ""}{player.kills > 0 ? ` · ${player.kills} kills` : ""}</div>
                </div>
                <button
                  onClick={() => removeBestPlayer(Number(player.id))}
                  className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-500/15 transition-smooth"
                  style={{ color: "#ff4500" }}
                  title="Remove from public best players"
                  aria-label={`Remove ${player.username || "player"} from public best players`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
        {bestPlayersError && <p className="text-xs font-semibold" style={{ color: "#ff4500" }}>{bestPlayersError}</p>}
      </Section>

      {/* Notification Preferences */}
      <Section icon={Bell} title="Notification Preferences">
        <p className="text-xs -mt-2" style={{ color: "var(--th-muted)" }}>
          Choose how you receive your notifications.
        </p>
        <div className="flex flex-col gap-3 divide-y divide-white/5" data-testid="host_settings.notif_events.list">
          {Object.entries(NOTIF_EVENT_LABELS).map(([key, label]) => (
            <div key={key} className="flex items-start gap-2 rounded-xl p-3 mt-1" style={{ background: "rgba(255,255,255,0.03)" }}>
              <Toggle
                checked={notifEvents[key] ?? true}
                onChange={(v: boolean) => setNotifEvents(prev => ({ ...prev, [key]: v }))}
              />
              <span className="text-xs text-muted-foreground leading-relaxed mt-0.5">{label}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Danger zone */}
      <Section icon={Trash2} title="Danger Zone">
        <p className="text-xs -mt-2 leading-relaxed" style={{ color: "var(--th-muted)" }}>
          Clear all tournament, registration, result, scoreboard, notification, feedback, contact, and player ranking data. Your host account and login will remain available.
        </p>
        {clearDataError && <p className="text-xs font-semibold" style={{ color: "#ff4500" }}>{clearDataError}</p>}
        <button
          onClick={() => { setClearDataError(""); setClearDataOpen(true); }}
          disabled={clearDataLoading}
          className="w-full rounded-xl py-3 flex items-center justify-center gap-2 text-sm font-bold disabled:opacity-50"
          style={{ background: "rgba(255,69,0,0.12)", color: "#ff4500", border: "1px solid rgba(255,69,0,0.3)" }}
          data-testid="host_settings.clear_all_data_button"
        >
          <Trash2 size={15} /> {clearDataLoading ? "Clearing app data..." : "Clear All App Data"}
        </button>
      </Section>

      {/* Save button */}
      <button
        onClick={() => setConfirmOpen(true)}
        disabled={saving}
        className="w-full h-12 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-smooth active:scale-95 disabled:opacity-50"
        style={{ background: "linear-gradient(135deg, #ff6b35, #ff4500)", color: "#0a0e27" }}
        data-testid="host_settings.save_button"
      >
        {saving ? <div className="w-5 h-5 rounded-full border-2 border-current border-t-transparent animate-spin" /> : null}
        {saving ? "Saving..." : saved ? "✓ Advanced settings saved!" : "Save Settings"}
      </button>

      {/* Confirm modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4" style={{ background: "var(--th-card)" }}>
            <div className="font-display font-bold text-xl text-foreground">Update Settings?</div>
            <p className="text-sm" style={{ color: "var(--th-muted)" }}>Your advanced host settings will be saved and applied immediately across the app.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmOpen(false)} className="flex-1 py-3 rounded-xl font-semibold text-sm" style={{ background: "var(--th-border)", color: "var(--th-muted)" }}>Cancel</button>
              <button onClick={handleSave} className="flex-1 py-3 rounded-xl font-bold text-sm" style={{ background: "linear-gradient(135deg, #ff6b35, #ff4500)", color: "#0a0e27" }}>Save</button>
            </div>
          </div>
        </div>
      )}
      {clearDataOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.78)" }}>
          <div className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4" style={{ background: "var(--th-card)", border: "1px solid rgba(255,69,0,0.4)" }}>
            <div className="flex items-center gap-2 font-display font-bold text-xl text-foreground"><Trash2 size={20} style={{ color: "#ff4500" }} /> Clear all app data?</div>
            <p className="text-sm leading-relaxed" style={{ color: "var(--th-muted)" }}>
              This permanently removes all tournaments, registrations, results, scoreboards, notifications, feedback, contacts, and player rank history. Your host login will not be removed.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setClearDataOpen(false)} disabled={clearDataLoading} className="flex-1 py-3 rounded-xl font-semibold text-sm" style={{ background: "var(--th-border)", color: "var(--th-muted)" }}>Cancel</button>
              <button onClick={clearAllAppData} disabled={clearDataLoading} className="flex-1 py-3 rounded-xl font-bold text-sm disabled:opacity-50" style={{ background: "#ff4500", color: "#0a0e27" }}>{clearDataLoading ? "Clearing..." : "Yes, Clear Data"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
