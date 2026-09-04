import { useState, useEffect } from "react";
import {
  ChartNoAxesColumn, RefreshCw, Trash2, LogIn, Trophy,
  Skull, ChevronDown, ChevronUp, Image
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { useGetResults } from "@workspace/api-client-react";

const DELETED_KEY = "eliteff_deleted_history";

function getDeleted(): string[] {
  try { return JSON.parse(localStorage.getItem(DELETED_KEY) || "[]"); } catch { return []; }
}

function outcomeColor(o: string) {
  if (o === "won") return "#22c55e";
  if (o === "lost") return "#ff4500";
  return "#ff6b35";
}
function outcomeEmoji(o: string) {
  if (o === "won") return "🏆";
  if (o === "lost") return "💀";
  return "⚔️";
}
function outcomeLabel(o: string) {
  if (o === "won") return "Won!";
  if (o === "lost") return "Lost";
  return "Completed";
}

/* Group raw DB results by (tournamentId, matchNumber) */
function groupResults(raw: any[]) {
  const map = new Map<string, { tournamentId: number; matchNumber: number; screenshotUrl: string | null; createdAt: string; entries: any[] }>();
  for (const r of raw) {
    const key = `${r.tournamentId}_${r.matchNumber}`;
    if (!map.has(key)) {
      map.set(key, {
        tournamentId: r.tournamentId,
        matchNumber: r.matchNumber,
        screenshotUrl: r.screenshotUrl ?? null,
        createdAt: r.createdAt,
        entries: [],
      });
    }
    map.get(key)!.entries.push(r);
    if (r.screenshotUrl && !map.get(key)!.screenshotUrl) {
      map.get(key)!.screenshotUrl = r.screenshotUrl;
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

interface MatchCardProps {
  group: ReturnType<typeof groupResults>[number];
  tournamentName: string;
  onDeleteMatch: (tournamentId: number, matchNumber: number) => void;
  deleted: Set<string>;
}

function MatchCard({ group, tournamentName, onDeleteMatch, deleted }: MatchCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [imgOpen, setImgOpen] = useState(false);
  const key = `${group.tournamentId}_${group.matchNumber}`;
  if (deleted.has(key)) return null;

  const entries = group.entries;
  if (!entries.length) return null;

  const topEntry = entries.reduce((best, e) => {
    const p = parseInt(e.placement) || 999;
    const bp = parseInt(best.placement) || 999;
    return p < bp ? e : best;
  }, entries[0]);

  return (
    <>
      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--th-card)", border: "1px solid var(--th-border)" }}>
        {group.screenshotUrl && (
          <div className="relative">
            <img
              src={group.screenshotUrl}
              alt={`Match ${group.matchNumber} screenshot`}
              className="w-full object-cover cursor-pointer"
              style={{ maxHeight: expanded ? "none" : "120px" }}
              onClick={() => setImgOpen(true)}
            />
            <button
              onClick={() => setImgOpen(true)}
              className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold"
              style={{ background: "rgba(0,0,0,0.6)", color: "#fff" }}
            >
              <Image size={11} /> View
            </button>
          </div>
        )}

        {/* Proof of Rewards */}
        {entries.some((e: any) => e.proofOfRewardUrl) && (
          <div className="px-4 pt-2 pb-1">
            <div className="rounded-xl p-2.5 flex items-center gap-2" style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)" }}>
              <span className="text-xs font-bold" style={{ color: "#4ade80" }}>Proof of Reward</span>
              <button
                onClick={() => setImgOpen(true)}
                className="text-[10px] font-bold px-2 py-1 rounded-md"
                style={{ background: "rgba(34,197,94,0.12)", color: "#4ade80" }}
              >
                View Receipt
              </button>
            </div>
          </div>
        )}

        <div className="px-4 pt-3 pb-2 flex items-center justify-between">
          <div>
            <div className="font-display font-bold text-foreground text-sm">{tournamentName}</div>
            <div className="text-xs mt-0.5 flex items-center gap-1.5 flex-wrap" style={{ color: "var(--th-dim)" }}>
              <span>Match {group.matchNumber}</span>
              <span>· {new Date(group.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onDeleteMatch(group.tournamentId, group.matchNumber)}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-smooth hover:bg-red-500/15"
            >
              <Trash2 size={13} style={{ color: "#ff4500" }} />
            </button>
            <button
              onClick={() => setExpanded(v => !v)}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-smooth"
            >
              {expanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
            </button>
          </div>
        </div>

        {topEntry && !expanded && (
          <div className="px-4 pb-3 flex items-center gap-3">
            <div className="text-xl" style={{ color: outcomeColor(topEntry.outcome) }}>
              {outcomeEmoji(topEntry.outcome)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-foreground truncate">{topEntry.squadName}</div>
              <div className="text-xs flex items-center gap-2 flex-wrap" style={{ color: "var(--th-muted)" }}>
                {topEntry.placement ? <span>#{topEntry.placement} place</span> : null}
                {topEntry.kills ? <span>{topEntry.kills} kills</span> : null}
                {topEntry.prize ? <span className="font-bold" style={{ color: "#fbbf24" }}>₹{Number(topEntry.prize).toLocaleString("en-IN")}</span> : null}
              </div>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0"
              style={{ background: `${outcomeColor(topEntry.outcome)}20`, color: outcomeColor(topEntry.outcome) }}>
              {outcomeLabel(topEntry.outcome)}
            </span>
          </div>
        )}

        {expanded && (
          <div className="px-4 pb-4 flex flex-col gap-2">
            {entries.map((entry: any, i: number) => {
              const pl = parseInt(entry.placement);
              const hasPrize = entry.prize && entry.prize > 0;
              const badgeStyle = pl === 1
                ? { background: "rgba(251,191,36,0.2)", color: "#fbbf24" }
                : pl === 2
                ? { background: "rgba(156,163,175,0.15)", color: "#9ca3af" }
                : pl === 3
                ? { background: "rgba(180,83,9,0.15)", color: "#b45309" }
                : { background: "var(--th-border)", color: "var(--th-dim)" };
              return (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                  style={{
                    background: hasPrize ? "rgba(251,191,36,0.05)" : "rgba(255,255,255,0.04)",
                    border: hasPrize ? "1px solid rgba(251,191,36,0.18)" : "1px solid var(--th-card2)",
                  }}
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0" style={badgeStyle}>
                    {entry.placement ? `#${entry.placement}` : `${i + 1}`}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-foreground truncate">{entry.squadName}</div>
                    <div className="text-xs mt-0.5 flex items-center gap-2" style={{ color: "var(--th-muted)" }}>
                      {entry.kills ? (
                        <span className="flex items-center gap-1">
                          <Skull size={10} style={{ color: "#ff4500" }} />{entry.kills}K
                        </span>
                      ) : null}
                      {hasPrize && (
                        <span className="font-bold flex items-center gap-0.5" style={{ color: "#fbbf24" }}>
                          🏆 ₹{Number(entry.prize).toLocaleString("en-IN")}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs font-bold px-2 py-1 rounded-lg flex-shrink-0"
                    style={{ background: `${outcomeColor(entry.outcome)}15`, color: outcomeColor(entry.outcome) }}>
                    {outcomeEmoji(entry.outcome)} {outcomeLabel(entry.outcome)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {imgOpen && group.screenshotUrl && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.92)" }}
          onClick={() => setImgOpen(false)}
        >
          <img
            src={group.screenshotUrl}
            alt="Match screenshot"
            className="max-w-full max-h-full rounded-2xl object-contain"
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setImgOpen(false)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.12)" }}
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}

export default function Results() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [deleted, setDeleted] = useState<Set<string>>(() => new Set(getDeleted()));
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: rawResults = [], isLoading } = useGetResults(
    { mine: true },
    { query: { enabled: !!user, queryKey: ["getMyResults", refreshKey] } as any },
  );

  function clearAllHistory() {
    const allKeys = grouped.map(g => `${g.tournamentId}_${g.matchNumber}`);
    const combined = Array.from(new Set([...getDeleted(), ...allKeys]));
    localStorage.setItem(DELETED_KEY, JSON.stringify(combined));
    setDeleted(new Set(combined));
  }

  function handleDeleteMatch(tournamentId: number, matchNumber: number) {
    const key = `${tournamentId}_${matchNumber}`;
    const raw = getDeleted();
    raw.push(key);
    localStorage.setItem(DELETED_KEY, JSON.stringify(raw));
    setDeleted(prev => new Set([...prev, key]));
  }

  const grouped = groupResults(rawResults as any[]);
  const visibleGroups = grouped.filter(g => !deleted.has(`${g.tournamentId}_${g.matchNumber}`));

  // Fetch tournament names from registrations or cache
  const tournamentNames = useTournamentNames(visibleGroups.map(g => g.tournamentId));

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-5 text-center px-6" data-testid="results.login_prompt">
        <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: "var(--th-card2)" }}>
          <ChartNoAxesColumn size={36} style={{ color: "var(--th-dimmer)" }} />
        </div>
        <div>
          <div className="font-display font-black text-2xl text-foreground">My Matches</div>
          <p className="text-sm mt-2 max-w-xs" style={{ color: "var(--th-muted)" }}>
            Log in to see your tournament results and match history.
          </p>
        </div>
        <button
          onClick={() => navigate("/settings")}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-smooth active:scale-95"
          style={{ background: "linear-gradient(135deg, #ff6b35, #ff4500)", color: "#0a0e27" }}
          data-testid="results.login_button"
        >
          <LogIn size={16} /> Go to Login
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 flex flex-col gap-4" data-testid="results.page">
      <div className="flex items-center justify-between px-1">
        <div className="font-display font-black text-2xl text-foreground">My Matches</div>
        <div className="flex items-center gap-2">
          {visibleGroups.length > 0 && (
            <button
              onClick={() => { if (confirm("Clear all match history? This cannot be undone.")) clearAllHistory(); }}
              className="flex items-center gap-1 h-9 px-3 rounded-xl text-xs font-bold transition-smooth active:scale-90"
              style={{ background: "rgba(255,69,0,0.08)", color: "#ff4500", border: "1px solid rgba(255,69,0,0.2)" }}
            >
              <Trash2 size={12} /> Clear All
            </button>
          )}
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-smooth hover:bg-white/10 active:scale-90"
            data-testid="results.refresh_button"
          >
            <RefreshCw size={16} className="text-muted-foreground" />
          </button>
        </div>
      </div>

      <p className="text-xs px-1" style={{ color: "var(--th-dim)" }}>
        Showing results from your registered tournaments · Tap a card to expand all team scores
      </p>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : visibleGroups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-5 text-center" data-testid="results.empty_state">
          <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: "var(--th-card2)" }}>
            <Trophy size={36} style={{ color: "var(--th-dimmer)" }} />
          </div>
          <div>
            <div className="font-display font-bold text-foreground text-lg mb-2">No results yet</div>
            <p className="text-sm max-w-xs" style={{ color: "var(--th-muted)" }}>
              Your tournament results will appear here once the host uploads match results.
            </p>
          </div>
          <button
            onClick={() => navigate("/tournaments")}
            className="px-6 py-2.5 rounded-xl text-sm font-bold transition-smooth active:scale-95"
            style={{ background: "rgba(255,107,53,0.12)", color: "#ff6b35", border: "1px solid rgba(255,107,53,0.2)" }}
          >
            Browse Tournaments
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {visibleGroups.map(group => (
            <MatchCard
              key={`${group.tournamentId}_${group.matchNumber}`}
              group={group}
              tournamentName={tournamentNames[group.tournamentId] || `Tournament #${group.tournamentId}`}
              onDeleteMatch={handleDeleteMatch}
              deleted={deleted}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* Simple hook to fetch tournament names for result groups */
function useTournamentNames(tournamentIds: number[]): Record<number, string> {
  const [names, setNames] = useState<Record<number, string>>({});
  useEffect(() => {
    const cache: Record<number, string> = {};
    for (const tid of tournamentIds) {
      try {
        const s = localStorage.getItem(`eliteff_tournament_name_${tid}`);
        if (s) cache[tid] = s;
      } catch {}
    }
    setNames(cache);
  }, [tournamentIds.join(",")]);
  return names;
}
