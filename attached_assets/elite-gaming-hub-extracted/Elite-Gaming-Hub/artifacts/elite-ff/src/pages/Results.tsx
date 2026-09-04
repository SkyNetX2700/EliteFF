import { useState, useEffect } from "react";
import { ChartNoAxesColumn, RefreshCw, Trash2, LogIn, Trophy, Skull, ChevronDown, ChevronUp, Image } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { loadResultStore, TournamentResultStore } from "@/pages/UploadResults";

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

interface MatchCardProps {
  store: TournamentResultStore;
  matchNumber: number;
  onDeleteMatch: (tournamentId: number, matchNumber: number) => void;
  deleted: Set<string>;
}

function MatchCard({ store, matchNumber, onDeleteMatch, deleted }: MatchCardProps) {
  const match = store.matches.find(m => m.matchNumber === matchNumber);
  const [expanded, setExpanded] = useState(false);
  const [imgOpen, setImgOpen] = useState(false);

  if (!match) return null;
  const key = `${store.tournamentId}_${matchNumber}`;
  if (deleted.has(key)) return null;

  const prizeConfig = loadPrizeConfig(store.tournamentId);

  const topEntry = match.entries.reduce((best, e) => {
    const p = parseInt(e.placement) || 999;
    const bp = parseInt(best.placement) || 999;
    return p < bp ? e : best;
  }, match.entries[0]);

  const mapConfig: { matchCount: number; maps: string[] } | null = (() => {
    try { const c = localStorage.getItem(`eliteff_tournament_config_${store.tournamentId}`); return c ? JSON.parse(c) : null; } catch { return null; }
  })();
  const mapName = mapConfig?.maps?.[matchNumber - 1];
  const MAP_EMOJI: Record<string, string> = { "Bermuda": "🏝️", "Purgatory": "❄️", "Kalahari": "🏜️", "Alpine": "⛰️", "Nexterra": "🌌", "Bermuda R.": "🌴" };

  return (
    <>
      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--th-card)", border: "1px solid var(--th-border)" }}>
        {/* Screenshot thumbnail */}
        {match.screenshotUrl && (
          <div className="relative">
            <img
              src={match.screenshotUrl}
              alt={`Match ${matchNumber} screenshot`}
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

        {/* Header */}
        <div className="px-4 pt-3 pb-2 flex items-center justify-between">
          <div>
            <div className="font-display font-bold text-foreground text-sm">{store.tournamentName}</div>
            <div className="text-xs mt-0.5 flex items-center gap-1.5 flex-wrap" style={{ color: "var(--th-dim)" }}>
              <span>Match {matchNumber} of {store.matchCount}</span>
              {mapName && <span className="flex items-center gap-0.5">{MAP_EMOJI[mapName] ?? "🏝️"} {mapName}</span>}
              {match.uploadedAt ? <span>· {new Date(match.uploadedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span> : null}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onDeleteMatch(store.tournamentId, matchNumber)}
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

        {/* Top result summary (always visible) */}
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
                {(() => {
                  const prize = topEntry.prize ? Number(topEntry.prize) : getPrizeForPlacement(prizeConfig, topEntry.placement);
                  return prize ? <span className="font-bold" style={{ color: "#fbbf24" }}>₹{prize.toLocaleString("en-IN")}</span> : null;
                })()}
              </div>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0"
              style={{ background: `${outcomeColor(topEntry.outcome)}20`, color: outcomeColor(topEntry.outcome) }}>
              {outcomeLabel(topEntry.outcome)}
            </span>
          </div>
        )}

        {/* Expanded: all entries */}
        {expanded && (
          <div className="px-4 pb-4 flex flex-col gap-2">
            {match.entries.map((entry, i) => {
              const pl = parseInt(entry.placement);
              const prize = entry.prize ? Number(entry.prize) : getPrizeForPlacement(prizeConfig, entry.placement);
              const hasPrize = prize && prize > 0;
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
                          🏆 ₹{prize!.toLocaleString("en-IN")}
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

      {/* Full-screen image modal */}
      {imgOpen && match.screenshotUrl && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.92)" }}
          onClick={() => setImgOpen(false)}
        >
          <img
            src={match.screenshotUrl}
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
  const [myTournamentIds, setMyTournamentIds] = useState<number[]>([]);

  useEffect(() => {
    if (!user) { setMyTournamentIds([]); return; }
    fetch("/api/registrations/mine", { credentials: "include" })
      .then(r => r.ok ? r.json() : [])
      .then((data: { tournamentId: number }[]) => setMyTournamentIds(data.map(d => d.tournamentId)))
      .catch(() => {});
  }, [user, refreshKey]);

  function clearAllHistory() {
    const allKeys: string[] = [];
    for (const tid of myTournamentIds) {
      const store = loadResultStore(tid);
      if (!store) continue;
      for (const m of store.matches) allKeys.push(`${tid}_${m.matchNumber}`);
    }
    const combined = Array.from(new Set([...getDeleted(), ...allKeys]));
    localStorage.setItem(DELETED_KEY, JSON.stringify(combined));
    setDeleted(new Set(combined));
  }

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

  /* Build a flat list of {store, matchNumber} for each uploaded match */
  interface MatchRef { store: TournamentResultStore; matchNumber: number; uploadedAt: number; }
  const allMatchRefs: MatchRef[] = [];

  for (const tid of myTournamentIds) {
    const store = loadResultStore(tid);
    if (!store) continue;
    for (const m of store.matches) {
      const key = `${tid}_${m.matchNumber}`;
      if (!deleted.has(key)) {
        allMatchRefs.push({ store, matchNumber: m.matchNumber, uploadedAt: m.uploadedAt });
      }
    }
  }

  allMatchRefs.sort((a, b) => b.uploadedAt - a.uploadedAt);

  function handleDeleteMatch(tournamentId: number, matchNumber: number) {
    const key = `${tournamentId}_${matchNumber}`;
    const raw = getDeleted();
    raw.push(key);
    localStorage.setItem(DELETED_KEY, JSON.stringify(raw));
    setDeleted(prev => new Set([...prev, key]));
  }

  /* Suppress TS unused-var warning for refreshKey */
  void refreshKey;

  return (
    <div className="px-4 py-4 flex flex-col gap-4" data-testid="results.page">
      <div className="flex items-center justify-between px-1">
        <div className="font-display font-black text-2xl text-foreground">My Matches</div>
        <div className="flex items-center gap-2">
          {allMatchRefs.length > 0 && (
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

      {allMatchRefs.length === 0 ? (
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
          {allMatchRefs.map(({ store, matchNumber }) => (
            <MatchCard
              key={`${store.tournamentId}_${matchNumber}`}
              store={store}
              matchNumber={matchNumber}
              onDeleteMatch={handleDeleteMatch}
              deleted={deleted}
            />
          ))}
        </div>
      )}
    </div>
  );
}
