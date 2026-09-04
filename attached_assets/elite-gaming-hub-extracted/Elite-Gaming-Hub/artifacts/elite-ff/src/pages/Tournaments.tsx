import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Trophy, RefreshCw, ChevronRight, Users, Skull, History, Search, X, BookOpen, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAppContext } from "@/contexts/AppContext";
import { useGetTournaments } from "@workspace/api-client-react";
import { getToken } from "@/lib/auth";

type Tab = "all" | "my" | "history" | "kills" | "rules";

const RULES = [
  {
    emoji: "⚖️",
    title: "Fair Play Policy",
    color: "#818cf8",
    bg: "rgba(129,140,248,0.10)",
    border: "rgba(129,140,248,0.25)",
    desc: "No hacks, scripts, or third-party apps allowed. Use of any unfair means will result in an immediate and permanent ban.",
  },
  {
    emoji: "⏰",
    title: "Punctuality",
    color: "#fbbf24",
    bg: "rgba(251,191,36,0.10)",
    border: "rgba(251,191,36,0.25)",
    desc: "Room ID & Password will be shared 10–15 minutes before the match. The match will start exactly at the scheduled time.",
  },
  {
    emoji: "💸",
    title: "Payment Verification",
    color: "#4ade80",
    bg: "rgba(74,222,128,0.10)",
    border: "rgba(74,222,128,0.25)",
    desc: "UTR number must match your screenshot. Fake screenshots or edited receipts will lead to immediate disqualification.",
  },
  {
    emoji: "🪪",
    title: "Player Identity",
    color: "#60a5fa",
    bg: "rgba(96,165,250,0.10)",
    border: "rgba(96,165,250,0.25)",
    desc: "Only registered In-Game Names (IGNs) are allowed. If someone else joins with your ID, they will be kicked from the match.",
  },
  {
    emoji: "🚫",
    title: "No Refunds",
    color: "#ff6b35",
    bg: "rgba(255,107,53,0.10)",
    border: "rgba(255,107,53,0.25)",
    desc: "Entry fee is non-refundable for no-shows or if you are disqualified for breaking any rules. Tournament cancellations by host are refunded.",
  },
];

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; color: string; label: string }> = {
    live:      { bg: "rgba(34,197,94,0.15)",  color: "#4ade80",  label: "Live" },
    upcoming:  { bg: "rgba(255,107,53,0.15)", color: "#ff6b35",  label: "Upcoming" },
    completed: { bg: "rgba(255,255,255,0.08)", color: "var(--th-muted)", label: "Completed" },
    cancelled: { bg: "rgba(255,69,0,0.12)",   color: "#ff4500",  label: "Cancelled" },
    delayed:   { bg: "rgba(251,191,36,0.15)", color: "#fbbf24",  label: "Delayed" },
  };
  const c = cfg[status] ?? cfg.upcoming;
  return (
    <span className="text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0" style={{ background: c.bg, color: c.color }}>
      {c.label}
    </span>
  );
}

function TournamentCard({ t, onClick, compact, registered, onRegister, isHost }: {
  t: any; onClick: () => void; compact?: boolean;
  registered?: boolean; onRegister?: () => void; isHost?: boolean;
}) {
  const canRegister = !isHost && t.status === "upcoming";
  const isFull = t.status === "upcoming" && (t.filledSlots ?? 0) >= (t.maxSlots ?? 1);
  return (
    <div
      className="w-full text-left rounded-2xl p-4 transition-smooth"
      style={{ background: "var(--th-card)", border: "1px solid var(--th-border)" }}
    >
      <button onClick={onClick} className="w-full text-left">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="font-display font-bold text-foreground text-base leading-tight truncate">{t.name}</div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs text-muted-foreground">{t.type}</span>
              <span className="text-xs" style={{ color: "var(--th-dimmer)" }}>·</span>
              <span className="text-xs text-muted-foreground">{t.mode}</span>
              {t.teamSize && (
                <>
                  <span className="text-xs" style={{ color: "var(--th-dimmer)" }}>·</span>
                  <span className="text-xs text-muted-foreground">{t.teamSize}v{t.teamSize}</span>
                </>
              )}
            </div>
          </div>
          <StatusBadge status={t.status} />
        </div>

        <div className="flex items-center gap-3 flex-wrap mb-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#ff6b35" }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            </div>
            <span className="text-xs font-semibold text-foreground">
              {t.scheduledAt ? new Date(t.scheduledAt).toLocaleString("en-IN", { day: "numeric", month: "short", year: undefined, hour: "2-digit", minute: "2-digit", hour12: true }) : "TBD"}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Users size={14} style={{ color: "var(--th-muted)" }} className="flex-shrink-0" />
            <span className="text-xs text-muted-foreground">
              {t.filledSlots ?? 0}/{t.maxSlots} slots
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between mb-0">
          <div className="flex items-center gap-3">
            <div>
              <div className="text-xs uppercase tracking-widest font-bold" style={{ color: "var(--th-dim)" }}>Entry</div>
              <div className="text-sm font-bold text-foreground">
                {t.isPaid && t.entryFee ? `₹${t.entryFee}` : "Free Entry"}
              </div>
            </div>
            {t.prizePool && (
              <div>
                <div className="text-xs uppercase tracking-widest font-bold" style={{ color: "var(--th-dim)" }}>Prize</div>
                <div className="text-sm font-bold" style={{ color: "#fbbf24" }}>₹{t.prizePool}</div>
              </div>
            )}
          </div>
          <div
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-smooth active:scale-95"
            style={{ background: "rgba(255,107,53,0.12)", color: "#ff6b35" }}
          >
            {isHost ? "Manage" : "View Details"} <ChevronRight size={12} />
          </div>
        </div>
      </button>

      {canRegister && (
        <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--th-border)" }}>
          {isFull ? (
            <div className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold"
              style={{ background: "rgba(255,69,0,0.08)", color: "#ff4500", border: "1px solid rgba(255,69,0,0.2)" }}>
              🔒 Tournament Full — No slots available
            </div>
          ) : registered ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 text-xs font-bold rounded-xl px-3 py-2" style={{ background: "rgba(34,197,94,0.08)", color: "#22c55e" }}>
                <CheckCircle size={13} /> Already Registered
              </div>
              <button
                onClick={e => { e.stopPropagation(); onRegister?.(); }}
                className="text-xs font-bold px-3 py-2 rounded-xl transition-smooth active:scale-95"
                style={{ background: "var(--th-card2)", color: "var(--th-muted)", border: "1px solid var(--th-border2)" }}
              >
                Register Again
              </button>
            </div>
          ) : (
            <button
              onClick={e => { e.stopPropagation(); onRegister?.(); }}
              className="w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-smooth active:scale-95"
              style={{ background: "linear-gradient(135deg, #ff6b35, #ff4500)", color: "#0a0e27" }}
            >
              <Trophy size={14} /> Register Now
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function RegStatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; color: string; label: string; icon: any }> = {
    pending:  { bg: "rgba(255,107,53,0.12)", color: "#ff6b35",  label: "Pending Review", icon: Clock },
    verified: { bg: "rgba(34,197,94,0.12)",  color: "#22c55e",  label: "Approved",        icon: CheckCircle },
    declined: { bg: "rgba(255,69,0,0.12)",   color: "#ff4500",  label: "Declined",         icon: AlertCircle },
    cancelled:{ bg: "rgba(255,255,255,0.06)",color: "var(--th-dim)", label: "Cancelled", icon: AlertCircle },
  };
  const c = cfg[status] ?? cfg.pending;
  const Icon = c.icon;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: c.bg, color: c.color }}>
      <Icon size={11} /> {c.label}
    </span>
  );
}

interface MyReg {
  id: number;
  tournamentId: number;
  squadName: string;
  status: string;
  slotNumber: number | null;
  createdAt: string;
  tournament: { id: number; name: string; type: string; mode: string; status: string; scheduledAt: string | null } | null;
}

function MyRegisteredTab({ myRegs, loading }: { myRegs: MyReg[]; loading: boolean }) {
  const [, navigate] = useLocation();

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[0,1,2].map(i => <div key={i} className="rounded-2xl h-24 animate-pulse" style={{ background: "var(--th-card)" }} />)}
      </div>
    );
  }

  if (!myRegs.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl" style={{ background: "var(--th-card2)" }}>🎮</div>
        <div>
          <div className="font-display font-bold text-foreground text-base">No registrations yet</div>
          <p className="text-xs mt-1" style={{ color: "var(--th-muted)" }}>Register for a tournament to track your status, slot, and squad here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {myRegs.map((reg) => {
        const status = reg.status || "pending";
        const slot = reg.slotNumber;
        return (
          <div
            key={reg.id}
            className="rounded-2xl p-4 transition-smooth active:scale-[0.99] cursor-pointer"
            style={{ background: "var(--th-card)", border: "1px solid var(--th-border)" }}
            onClick={() => navigate(`/tournaments/${reg.tournamentId}`)}
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex-1 min-w-0">
                <div className="font-display font-bold text-foreground text-base leading-tight truncate">
                  {reg.tournament?.name ?? `Tournament #${reg.tournamentId}`}
                </div>
                <div className="text-xs mt-0.5" style={{ color: "var(--th-dim)" }}>
                  Registered {new Date(reg.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </div>
              </div>
              <RegStatusBadge status={status} />
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--th-muted)" }}>
                <Users size={12} style={{ color: "#ff6b35" }} />
                <span className="font-bold text-foreground">{reg.squadName}</span>
              </div>
              {slot && (
                <div className="flex items-center gap-1.5 text-xs font-black px-2.5 py-1 rounded-lg" style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}>
                  <CheckCircle size={11} /> Slot #{slot}
                </div>
              )}
            </div>

            {status === "pending" && (
              <div className="mt-3 text-xs px-3 py-2 rounded-xl" style={{ background: "rgba(255,107,53,0.08)", color: "#ff6b35" }}>
                ⏳ Awaiting host verification. You'll be notified once approved.
              </div>
            )}
            {status === "verified" && (
              <div className="mt-3 text-xs px-3 py-2 rounded-xl flex items-center gap-1.5" style={{ background: "rgba(34,197,94,0.08)", color: "#22c55e" }}>
                <CheckCircle size={12} /> Your spot is confirmed! Check notifications for room ID before match.
              </div>
            )}
            {status === "declined" && (
              <div className="mt-3 text-xs px-3 py-2 rounded-xl" style={{ background: "rgba(255,69,0,0.08)", color: "#ff4500" }}>
                ❌ Registration declined by host. You may register again.
              </div>
            )}

            <div className="mt-3 flex items-center justify-end">
              <span className="text-xs font-bold flex items-center gap-1" style={{ color: "#ff6b35" }}>
                View Tournament <ChevronRight size={12} />
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KillRankingCard({ rank, name, kills }: { rank: number; name: string; kills: number }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl p-4" style={{ background: "var(--th-card)", border: "1px solid var(--th-border)" }}>
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0"
        style={rank === 1
          ? { background: "rgba(251,191,36,0.2)", color: "#fbbf24" }
          : rank === 2
          ? { background: "rgba(156,163,175,0.15)", color: "#9ca3af" }
          : { background: "rgba(180,83,9,0.15)", color: "#b45309" }
        }
      >
        #{rank}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-display font-bold text-foreground text-sm truncate">{name}</div>
      </div>
      <div className="flex items-center gap-1.5 text-xs font-bold" style={{ color: "#ff4500" }}>
        <Skull size={14} />
        {kills} kills
      </div>
    </div>
  );
}

const STATUS_FILTERS = [
  { id: "all",       label: "All",       color: "" },
  { id: "live",      label: "🔴 Live",   color: "#4ade80" },
  { id: "upcoming",  label: "Upcoming",  color: "#ff6b35" },
  { id: "completed", label: "Completed", color: "var(--th-muted)" },
  { id: "free",      label: "Free",      color: "#60a5fa" },
  { id: "paid",      label: "Paid",      color: "#fbbf24" },
];

export default function Tournaments() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { addAlert: _addAlert } = useAppContext(); // ensure context available
  const [tab, setTab] = useState<Tab>("all");
  const [refreshKey, setRefreshKey] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [myRegs, setMyRegs] = useState<MyReg[]>([]);
  const [myRegsLoading, setMyRegsLoading] = useState(false);

  const { data: tournaments = [], isLoading, error } = useGetTournaments(
    undefined,
    { query: { queryKey: ["getTournaments", refreshKey] } as any },
  );

  // Fetch user's registrations from server when logged in
  useEffect(() => {
    if (!user) { setMyRegs([]); return; }
    setMyRegsLoading(true);
    fetch("/api/registrations/mine", { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then((data: MyReg[]) => { setMyRegs(data); setMyRegsLoading(false); })
      .catch(() => setMyRegsLoading(false));
  }, [user, refreshKey]);

  const myTournamentIds = new Set(myRegs.map(r => r.tournamentId));

  const hostSettings = (() => {
    try { return JSON.parse(localStorage.getItem("eliteff_host_settings") || "{}"); } catch { return {}; }
  })();
  const compact = hostSettings.compactView === true;
  const showKillRankings = hostSettings.showKillRankings !== false;

  // Tab filter
  const tabFiltered = (() => {
    if (tab === "all") return tournaments;
    if (tab === "my") {
      return (tournaments as any[]).filter((t: any) => myTournamentIds.has(t.id));
    }
    if (tab === "history") {
      return (tournaments as any[]).filter((t: any) => myTournamentIds.has(t.id) && ["completed", "cancelled"].includes(t.status));
    }
    return tournaments;
  })();

  // Search + status chip filter
  const filtered = tabFiltered.filter((t: any) => {
    const q = search.trim().toLowerCase();
    if (q && !t.name?.toLowerCase().includes(q) && !t.type?.toLowerCase().includes(q) && !t.mode?.toLowerCase().includes(q)) return false;
    if (statusFilter === "live" && t.status !== "live") return false;
    if (statusFilter === "upcoming" && t.status !== "upcoming") return false;
    if (statusFilter === "completed" && !["completed", "cancelled"].includes(t.status)) return false;
    if (statusFilter === "free" && t.isPaid) return false;
    if (statusFilter === "paid" && !t.isPaid) return false;
    return true;
  });

  // Kill rankings (from local storage)
  const killRankings: any[] = (() => {
    try { return JSON.parse(localStorage.getItem("eliteff_kill_rankings") || "[]"); } catch { return []; }
  })();

  const TABS = [
    { id: "all" as Tab, label: "Tournaments", icon: Trophy },
    { id: "my" as Tab, label: "My Registered", icon: Users },
    { id: "history" as Tab, label: "My History", icon: History },
    ...(showKillRankings ? [{ id: "kills" as Tab, label: "Kill Rankings", icon: Skull }] : []),
  ];

  return (
    <div className="flex flex-col gap-4" data-testid="tournaments-page">
      {/* Header */}
      <div className="px-4 pt-4 flex items-center justify-between">
        <div className="font-display font-black text-2xl text-foreground">Tournaments</div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTab(tab === "rules" ? "all" : "rules")}
            className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-bold transition-smooth active:scale-90"
            style={tab === "rules"
              ? { background: "linear-gradient(135deg, #ff6b35, #ff4500)", color: "#0a0e27" }
              : { background: "var(--th-card2)", color: "var(--th-muted)", border: "1px solid var(--th-border2)" }}
            title="Tournament Rules"
          >
            <BookOpen size={14} />
            Rules
          </button>
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-smooth hover:bg-white/10 active:scale-90"
            data-testid="tournaments.refresh_button"
          >
            <RefreshCw size={16} className={`text-muted-foreground ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="px-4">
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tournaments…"
            className="w-full h-10 rounded-xl pl-9 pr-9 text-sm"
            style={{ background: "var(--th-input)", border: "1px solid var(--th-border2)", color: "var(--th-text)" }}
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full hover:bg-white/10 transition-smooth">
              <X size={12} className="text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Status filter chips */}
      <div className="px-4 flex flex-wrap gap-2">
        {STATUS_FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setStatusFilter(f.id)}
            className="text-xs font-bold px-3 py-1.5 rounded-xl transition-all duration-200 active:scale-95"
            style={statusFilter === f.id
              ? { background: f.id === "all" ? "linear-gradient(135deg,#ff6b35,#ff4500)" : `${f.color}22`, color: f.id === "all" ? "#0a0e27" : f.color, border: f.id === "all" ? "none" : `1px solid ${f.color}44` }
              : { background: "var(--th-input)", color: "var(--th-dim)", border: "1px solid var(--th-border)" }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="px-4 flex flex-wrap gap-2">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl transition-all duration-200 active:scale-95"
            style={tab === t.id
              ? { background: "linear-gradient(135deg, #ff6b35, #ff4500)", color: "#0a0e27" }
              : { background: "var(--th-card2)", color: "var(--th-muted)" }}
          >
            <t.icon size={12} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="px-4 pb-6">
        {tab === "rules" ? (
          <div className="flex flex-col gap-3">
            <div className="rounded-2xl p-4" style={{ background: "rgba(255,107,53,0.06)", border: "1px solid rgba(255,107,53,0.18)" }}>
              <div className="flex items-center gap-2 mb-1">
                <BookOpen size={14} style={{ color: "#ff6b35" }} />
                <span className="text-xs font-black uppercase tracking-widest" style={{ color: "#ff6b35" }}>Tournament Rules</span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: "var(--th-muted)" }}>
                All participants must follow these rules. Violations may lead to disqualification or a permanent ban.
              </p>
            </div>
            {RULES.map((rule, i) => (
              <div key={i} className="rounded-2xl p-4 flex gap-4" style={{ background: rule.bg, border: `1px solid ${rule.border}` }}>
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl flex-shrink-0"
                  style={{ background: `${rule.border}`, fontSize: 22 }}
                >
                  {rule.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-display font-black text-sm mb-1 break-words" style={{ color: rule.color }}>
                    {rule.title}
                  </div>
                  <p className="text-xs leading-relaxed break-words" style={{ color: "var(--th-muted)" }}>
                    {rule.desc}
                  </p>
                </div>
              </div>
            ))}
            <div className="rounded-xl py-3 px-4 text-center mt-1" style={{ background: "var(--th-card)", border: "1px solid var(--th-border)" }}>
              <p className="text-xs" style={{ color: "var(--th-dim)" }}>
                By registering for any tournament, you agree to abide by all the rules above.
              </p>
            </div>
          </div>
        ) : tab === "kills" ? (
          killRankings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl" style={{ background: "var(--th-card2)" }}>💀</div>
              <div>
                <div className="font-display font-bold text-foreground text-base">No kill data yet</div>
                <p className="text-xs mt-1" style={{ color: "var(--th-muted)" }}>Kill rankings will appear here once the Host submits match results with kill counts.</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between mb-1">
                <div className="font-display font-bold text-foreground text-base">Kill Rankings</div>
                <button onClick={() => setRefreshKey(k => k + 1)} className="text-xs text-muted-foreground flex items-center gap-1">
                  <RefreshCw size={12} /> Refresh kill leaderboard
                </button>
              </div>
              {killRankings.map((k: any, i: number) => (
                <KillRankingCard key={i} rank={i + 1} name={k.name} kills={k.kills} />
              ))}
            </div>
          )
        ) : tab === "my" && user ? (
          <MyRegisteredTab myRegs={myRegs} loading={myRegsLoading} />
        ) : isLoading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-2xl p-4 animate-pulse" style={{ background: "var(--th-card)" }}>
                <div className="flex justify-between mb-3">
                  <div className="h-5 w-36 rounded" style={{ background: "var(--th-border)" }} />
                  <div className="h-5 w-20 rounded-full" style={{ background: "var(--th-border)" }} />
                </div>
                <div className="h-4 w-24 rounded mb-3" style={{ background: "var(--th-border)" }} />
                <div className="flex justify-between">
                  <div className="h-5 w-16 rounded" style={{ background: "var(--th-border)" }} />
                  <div className="h-5 w-24 rounded-lg" style={{ background: "var(--th-border)" }} />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center py-12 gap-4 text-center">
            <div className="text-muted-foreground text-sm">Failed to load tournaments. Please try again.</div>
            <button
              onClick={() => setRefreshKey(k => k + 1)}
              className="text-xs font-bold px-4 py-2 rounded-xl"
              style={{ background: "rgba(255,107,53,0.12)", color: "#ff6b35" }}
            >
              Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl" style={{ background: "var(--th-card2)" }}>🏆</div>
            <div>
              <div className="font-display font-bold text-foreground text-base">
                {tab === "all" ? "No tournaments available" : tab === "my" ? "No registrations yet" : tab === "history" ? "No completed tournaments" : "Nothing here yet"}
              </div>
              <p className="text-xs mt-1" style={{ color: "var(--th-muted)" }}>
                {tab === "all"
                  ? user?.isHost ? "Create a tournament first to start receiving registrations." : "Check back soon!"
                  : tab === "history"
                  ? "Tournaments you participated in that are completed or cancelled will appear here."
                  : "Register for a tournament to track your registrations here."}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((t: any) => (
              <TournamentCard
                key={t.id}
                t={t}
                onClick={() => navigate(`/tournaments/${t.id}`)}
                compact={compact}
                isHost={user?.isHost}
                registered={myTournamentIds.has(t.id)}
                onRegister={() => navigate(`/tournaments/${t.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
