import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Trophy, Crown, Star, Skull, Gift } from "lucide-react";
import { apiFetch } from "@/lib/auth";

const RANK_COLORS: Record<string, string> = {
  Blaze: "#ff6b35", Striker: "#f59e0b", Predator: "#dc2626",
  Phantom: "#818cf8", Nexus: "#a855f7", Nova: "#ec4899",
  Supreme: "#fbbf24", Legend: "#f59e0b", Apex: "#22c55e", Elite: "#38bdf8",
};

export default function Leaderboard() {
  const [, navigate] = useLocation();
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/stats/leaderboard").then(r => r.ok ? r.json() : []).then(data => {
      setPlayers(data); setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col pb-8">
      <div className="px-4 pt-4 pb-2">
        <button onClick={() => navigate("/")} className="flex items-center gap-2 text-muted-foreground text-sm transition-smooth hover:text-foreground">
          <ArrowLeft size={16} /> Back to Home
        </button>
      </div>
      <div className="px-4 pb-4">
        <div className="font-display font-black text-2xl text-foreground">Leaderboard</div>
        <p className="text-xs mt-1" style={{ color: "var(--th-muted)" }}>Top 50 players ranked by points</p>
        <div className="mt-2 rounded-xl p-2.5" style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)" }}>
          <p className="text-[11px] leading-relaxed" style={{ color: "var(--th-muted)" }}>
            <span className="font-bold" style={{ color: "#fbbf24" }}>How to rank up:</span> Win = +50 pts, 2nd = +30, 3rd = +20, Participation = +5. Avoid penalties for no-shows, 3-loss streaks, or disqualification. Reach Elite (2000+) for prestige loop rewards.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2 px-4">
          {[0,1,2,3,4].map(i => <div key={i} className="rounded-2xl h-16 animate-pulse" style={{ background: "var(--th-card)" }} />)}
        </div>
      ) : players.length === 0 ? (
        <div className="px-4 text-center py-12">
          <Trophy size={32} className="mx-auto mb-3" style={{ color: "var(--th-dimmer)" }} />
          <p className="text-sm" style={{ color: "var(--th-muted)" }}>No players on the leaderboard yet</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 px-4">
          {players.map((p, i) => (
            <div key={p.id} className="rounded-2xl p-3 flex items-center gap-3" style={{ background: "var(--th-card)", border: "1px solid var(--th-border)" }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm flex-shrink-0"
                style={{ background: i < 3 ? "rgba(251,191,36,0.12)" : "var(--th-card2)", color: i < 3 ? "#fbbf24" : "var(--th-muted)" }}>
                {i + 1}
              </div>
              <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0" style={{ background: RANK_COLORS[p.rank] || "var(--th-card2)" }}>
                {p.profilePic ? (
                  <img src={p.profilePic} alt={p.username} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-bold text-xs" style={{ color: "#0a0e27" }}>{(p.username || "?").slice(0,2).toUpperCase()}</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display font-bold text-sm text-foreground">{p.username}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs font-bold" style={{ color: RANK_COLORS[p.rank] || "#ff6b35" }}>{p.rank}</span>
                  {p.prestigeStars > 0 && (
                    <span className="text-xs font-bold flex items-center gap-0.5" style={{ color: "#ff6b35" }}><Star size={8} /> {p.prestigeStars}</span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-black text-foreground">{p.points ?? 0} <span className="text-xs font-bold" style={{ color: "var(--th-dim)" }}>pts</span></div>
                <div className="text-xs" style={{ color: "var(--th-dim)" }}>{p.tournamentsPlayed ?? 0} tournaments</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
