import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Trophy, Skull, Swords, Star, ChevronRight, ShieldCheck, CalendarDays, Clock, CheckCircle, XCircle, AlertCircle, Crown, Sparkles, Gift, Shield, HandHeart } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/auth";
import { loadResultStore } from "@/pages/UploadResults";

interface PrizeRank { rank: number; label: string; amount: number; }
interface PrizeConfig { ranks: PrizeRank[]; }

function loadPrizeConfig(tid: number): PrizeConfig | null {
  try { const c = localStorage.getItem(`eliteff_tournament_prizes_${tid}`); return c ? JSON.parse(c) : null; } catch { return null; }
}
function getPrizeForPlacement(cfg: PrizeConfig | null, placement: string): number | null {
  if (!cfg) return null;
  const p = parseInt(placement);
  if (isNaN(p)) return null;
  const found = cfg.ranks.find(r => r.rank === p);
  return found ? found.amount : null;
}

const STATUS_STYLE: Record<string, { color: string; label: string }> = {
  live:      { color: "#4ade80",  label: "🔴 Live" },
  upcoming:  { color: "#ff6b35",  label: "Upcoming" },
  completed: { color: "var(--th-muted)", label: "Completed" },
  cancelled: { color: "#ff4500",  label: "Cancelled" },
  delayed:   { color: "#fbbf24",  label: "Delayed" },
};

const REG_STATUS: Record<string, { color: string; bg: string; icon: typeof CheckCircle; label: string }> = {
  verified:  { color: "#4ade80", bg: "rgba(74,222,128,0.12)",  icon: CheckCircle, label: "Verified" },
  pending:   { color: "#fbbf24", bg: "rgba(251,191,36,0.12)",  icon: Clock,        label: "Pending" },
  declined:  { color: "#ff4500", bg: "rgba(255,69,0,0.12)",    icon: XCircle,      label: "Declined" },
  cancelled: { color: "var(--th-muted)", bg: "rgba(255,255,255,0.06)", icon: AlertCircle, label: "Cancelled" },
};

interface MyReg {
  id: number;
  tournamentId: number;
  squadName: string;
  playerNames: string;
  paymentScreenshotUrl: string | null;
  upiId: string | null;
  utrNumber: string;
  status: string;
  slotNumber: number | null;
  declineReason: string | null;
  approvedAt: string | null;
  createdAt: string;
  tournament: {
    id: number;
    name: string;
    type: string;
    mode: string;
    status: string;
    scheduledAt: string | null;
    entryFee: number | null;
    prizePool: number | null;
    booyahPrize: number | null;
  } | null;
}

export default function Profile() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [regs, setRegs] = useState<MyReg[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    apiFetch("/api/registrations/mine", { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then((data: MyReg[]) => { setRegs(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [user]);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6 text-center gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "var(--th-input)" }}>
          <ShieldCheck size={28} style={{ color: "#ff6b35" }} />
        </div>
        <div className="font-display font-black text-xl text-foreground">Sign in to view your profile</div>
        <p className="text-sm" style={{ color: "var(--th-muted)" }}>Track your tournament history, kills, and prize winnings</p>
        <button
          onClick={() => navigate("/settings")}
          className="px-6 py-3 rounded-2xl font-black text-sm"
          style={{ background: "linear-gradient(135deg, #ff6b35, #ff4500)", color: "#0a0e27" }}
        >
          Sign In
        </button>
      </div>
    );
  }

  const entries = regs.map(reg => {
    const tid = reg.tournamentId;
    const store = loadResultStore(tid);
    const prizeConfig = loadPrizeConfig(tid);

    let totalKills = 0;
    let bestPlacement: number | null = null;
    let wins = 0;
    let prizeWon = 0;
    let matchCount = 0;

    if (store) {
      matchCount = store.matches.length;
      for (const match of store.matches) {
        for (const entry of match.entries) {
          const k = parseInt(entry.kills);
          if (!isNaN(k)) totalKills += k;
          const p = parseInt(entry.placement);
          if (!isNaN(p)) {
            if (bestPlacement === null || p < bestPlacement) bestPlacement = p;
            if (p === 1) wins++;
            const prize = getPrizeForPlacement(prizeConfig, entry.placement);
            if (prize) prizeWon += prize;
          }
        }
      }
    }

    return { reg, totalKills, bestPlacement, wins, prizeWon, matchCount, hasResults: !!store };
  });

  const aggStats = entries.reduce(
    (acc, e) => ({
      tournaments: acc.tournaments + 1,
      wins: acc.wins + e.wins,
      kills: acc.kills + e.totalKills,
      prize: acc.prize + e.prizeWon,
    }),
    { tournaments: 0, wins: 0, kills: 0, prize: 0 }
  );

  const verifiedCount = regs.filter(r => r.status === "verified").length;
  const initials = user.username.slice(0, 2).toUpperCase();

  return (
    <div className="flex flex-col pb-8">
      {/* Back */}
      <div className="px-4 pt-4 pb-2">
        <button onClick={() => navigate("/settings")} className="flex items-center gap-2 text-muted-foreground text-sm transition-smooth hover:text-foreground">
          <ArrowLeft size={16} /> Back to Settings
        </button>
      </div>

      {/* Avatar + Name */}
      <div className="px-4 pb-5">
        <div className="rounded-2xl p-5 flex flex-col gap-4" style={{ background: "var(--th-card)", border: "1px solid var(--th-border)" }}>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0" style={!user.profileImageUrl ? { background: "linear-gradient(135deg, #ff6b35, #ff4500)" } : {}}>
              {user.profileImageUrl ? (
                <img src={user.profileImageUrl} alt={user.username} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-display font-black text-2xl" style={{ color: "#0a0e27" }}>{initials}</div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-display font-black text-2xl text-foreground leading-none truncate">{user.username}</div>
              {user.email && <div className="text-xs mt-0.5 truncate" style={{ color: "var(--th-muted)" }}>{user.email}</div>}
              <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black px-2.5 py-1 rounded-full"
                  style={{ background: user.isHost ? "rgba(129,140,248,0.15)" : "rgba(255,107,53,0.12)", color: user.isHost ? "#818cf8" : "#ff6b35" }}>
                  {user.isHost ? "Host" : "Player"}
                </span>
                {verifiedCount > 0 && (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1" style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80" }}>
                    <CheckCircle size={10} /> {verifiedCount} Verified
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Rank / Prestige badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-black px-2.5 py-1 rounded-full" style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24" }}>
              <Crown size={10} className="inline mr-1" /> {user.rank ?? "Blaze"}
            </span>
            {(user.points ?? 0) > 0 && (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80" }}>
                {user.points} pts
              </span>
            )}
            {(user.prestigeStars ?? 0) > 0 && (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: "rgba(255,107,53,0.12)", color: "#ff6b35" }}>
                <Sparkles size={10} className="inline mr-1" /> {(user.prestigeStars ?? 0)} Star{(user.prestigeStars ?? 0) > 1 ? "s" : ""}
              </span>
            )}
            {(user.totalEarnings ?? 0) > 0 && (
              <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: "rgba(129,140,248,0.12)", color: "#818cf8" }}>
                <Gift size={10} className="inline mr-1" /> ₹{(user.totalEarnings ?? 0).toLocaleString("en-IN")} earned
              </span>
            )}
          </div>

          {/* Fair Play Bonus */}
          {!user.isHost && (
            <div className="rounded-xl p-3 flex items-center justify-between" style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)" }}>
              <div className="flex items-center gap-2">
                <Shield size={14} style={{ color: "#4ade80" }} />
                <span className="text-xs font-bold text-foreground">Weekly Fair Play Bonus</span>
              </div>
              <button
                onClick={() => apiFetch("/api/stats/fair-play", { method: "POST", credentials: "include" }).then(r => r.ok ? window.location.reload() : null)}
                className="text-xs font-black px-3 py-1.5 rounded-lg transition-smooth active:scale-95"
                style={{ background: "rgba(34,197,94,0.12)", color: "#4ade80" }}
              >
                Claim +20 pts
              </button>
            </div>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "Entered", value: aggStats.tournaments, icon: CalendarDays, color: "#ff6b35" },
              { label: "Wins", value: aggStats.wins, icon: Trophy, color: "#fbbf24" },
              { label: "Kills", value: aggStats.kills, icon: Skull, color: "#4ade80" },
              { label: "Prize", value: aggStats.prize > 0 ? (aggStats.prize >= 1000 ? `₹${(aggStats.prize / 1000).toFixed(1)}k` : `₹${aggStats.prize}`) : "—", icon: Star, color: "#818cf8" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="rounded-xl p-2.5 text-center" style={{ background: "var(--th-card2)" }}>
                <Icon size={14} className="mx-auto mb-1" style={{ color }} />
                <div className="text-base font-black text-foreground leading-none">{value}</div>
                <div className="text-[9px] font-bold uppercase tracking-widest mt-0.5" style={{ color: "var(--th-dim)" }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tournament history */}
      <div className="px-4 flex flex-col gap-3">
        <div className="font-display font-bold text-base text-foreground">My Registrations</div>

        {loading ? (
          <div className="flex flex-col gap-3">
            {[0,1,2].map(i => (
              <div key={i} className="rounded-2xl h-24 animate-pulse" style={{ background: "var(--th-card)" }} />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="rounded-2xl p-8 text-center" style={{ background: "var(--th-card)", border: "1px solid var(--th-border)" }}>
            <Swords size={32} className="mx-auto mb-3" style={{ color: "var(--th-dimmer)" }} />
            <div className="font-display font-bold text-foreground mb-1">No registrations yet</div>
            <p className="text-xs" style={{ color: "var(--th-dim)" }}>Register for a tournament to start tracking your history</p>
            <button
              onClick={() => navigate("/tournaments")}
              className="mt-4 px-5 py-2.5 rounded-xl font-black text-sm"
              style={{ background: "linear-gradient(135deg, #ff6b35, #ff4500)", color: "#0a0e27" }}
            >
              Browse Tournaments
            </button>
          </div>
        ) : (
          entries.map(({ reg, totalKills, bestPlacement, wins, prizeWon, matchCount, hasResults }) => {
            const t = reg.tournament;
            const tStatus = STATUS_STYLE[t?.status ?? ""] ?? { color: "var(--th-dim)", label: t?.status ?? "Unknown" };
            const rStatus = REG_STATUS[reg.status] ?? REG_STATUS.pending;
            const RIcon = rStatus.icon;
            return (
              <button
                key={reg.id}
                onClick={() => navigate(`/tournaments/${reg.tournamentId}`)}
                className="w-full rounded-2xl p-4 flex items-start gap-4 text-left transition-smooth active:scale-[0.98]"
                style={{ background: "var(--th-card)", border: "1px solid var(--th-border)" }}
              >
                {/* Left accent */}
                <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ background: tStatus.color, opacity: 0.7 }} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="font-display font-bold text-sm text-foreground leading-snug truncate flex-1">
                      {t?.name ?? `Tournament #${reg.tournamentId}`}
                    </div>
                    <span className="text-[10px] font-bold flex-shrink-0" style={{ color: tStatus.color }}>{tStatus.label}</span>
                  </div>

                  {/* Squad + slot */}
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg" style={{ background: "rgba(255,107,53,0.1)", color: "#ff6b35" }}>
                      {reg.squadName}
                    </span>
                    {t?.type && <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg" style={{ background: "var(--th-card2)", color: "var(--th-muted)" }}>{t.type}</span>}
                    {t?.scheduledAt && (
                      <span className="text-[10px]" style={{ color: "var(--th-dim)" }}>
                        {new Date(t.scheduledAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </span>
                    )}
                  </div>

                  {/* Registration status row */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: rStatus.bg, color: rStatus.color }}>
                      <RIcon size={9} />
                      {rStatus.label}{reg.status === "verified" && reg.slotNumber ? ` · Slot #${reg.slotNumber}` : ""}
                    </span>
                    {reg.status === "verified" && reg.approvedAt && (
                      <span className="text-[10px]" style={{ color: "var(--th-dimmer)" }}>
                        Approved {new Date(reg.approvedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </span>
                    )}
                  </div>

                  {/* Registration details (read-only) */}
                  <div className="mt-2 rounded-lg p-2.5 text-xs flex flex-col gap-1" style={{ background: "var(--th-card2)", border: "1px solid var(--th-border2)" }}>
                    {reg.playerNames && (
                      <div className="flex items-start gap-2">
                        <span className="flex-shrink-0" style={{ color: "var(--th-dim)", minWidth: 55 }}>Players:</span>
                        <span className="font-semibold text-foreground">{reg.playerNames}</span>
                      </div>
                    )}
                    {reg.utrNumber && reg.utrNumber !== "-" && (
                      <div className="flex items-center gap-2">
                        <span className="flex-shrink-0" style={{ color: "var(--th-dim)", minWidth: 55 }}>UTR:</span>
                        <span className="font-mono text-foreground">{reg.utrNumber}</span>
                      </div>
                    )}
                    {reg.approvedAt && (
                      <div className="flex items-center gap-2">
                        <span className="flex-shrink-0" style={{ color: "var(--th-dim)", minWidth: 55 }}>Approved:</span>
                        <span style={{ color: "var(--th-muted)" }}>
                          {new Date(reg.approvedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </div>
                    )}

                    {hasResults && matchCount > 0 && (
                      <div className="flex items-center gap-1 text-xs" style={{ color: "var(--th-muted)" }}>
                        <Swords size={11} style={{ color: "#ff6b35" }} />
                        <span>{matchCount} match{matchCount > 1 ? "es" : ""}</span>
                      </div>
                    )}
                    {totalKills > 0 && (
                      <div className="flex items-center gap-1 text-xs" style={{ color: "var(--th-muted)" }}>
                        <Skull size={11} style={{ color: "#4ade80" }} />
                        <span>{totalKills} kills</span>
                      </div>
                    )}
                    {bestPlacement !== null && (
                      <div className="flex items-center gap-1 text-xs font-bold" style={{ color: bestPlacement === 1 ? "#fbbf24" : "var(--th-muted)" }}>
                        <Trophy size={11} style={{ color: bestPlacement === 1 ? "#fbbf24" : "var(--th-dim)" }} />
                        <span>#{bestPlacement}</span>
                      </div>
                    )}
                    {prizeWon > 0 && (
                      <div className="flex items-center gap-1 text-xs font-bold" style={{ color: "#818cf8" }}>
                        <Star size={11} style={{ color: "#818cf8" }} />
                        <span>₹{prizeWon.toLocaleString("en-IN")}</span>
                      </div>
                    )}
                  </div>
                </div>

                <ChevronRight size={14} className="flex-shrink-0 mt-1" style={{ color: "var(--th-dimmer)" }} />
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
