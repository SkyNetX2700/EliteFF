import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import {
  ArrowLeft, Zap, CheckCircle, Minus, Plus,
  Megaphone, RefreshCw, Skull, Trophy, Wifi
} from "lucide-react";
import {
  useGetTournament, useGetRegistrations,
  useGetScoreboard, useUpdateScoreboard,
} from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAppContext } from "@/contexts/AppContext";
import { useQueryClient } from "@tanstack/react-query";

interface TeamRow {
  registrationId: number;
  squadName: string;
  kills: number;
  rank: number | null;
  points: number;
  dirty: boolean;
}

interface PointConfig {
  killPoints: number;
  placements: number[];
}

const inpStyle = {
  background: "var(--th-card2)",
  border: "1px solid var(--th-border2)",
  color: "var(--th-text)",
} as const;

function loadPointConfig(id: number): PointConfig {
  try {
    const raw = localStorage.getItem(`eliteff_tournament_points_${id}`);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { killPoints: 1, placements: [12, 9, 7, 5, 4, 3, 2, 2, 2, 2, 1, 1] };
}

function calcTotal(kills: number, rank: number | null, cfg: PointConfig): number {
  const placementPts = rank !== null ? (cfg.placements[rank - 1] ?? 0) : 0;
  return kills * cfg.killPoints + placementPts;
}

function Stepper({ value, onChange, min = 0, max = 9999 }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white/10 transition-smooth active:scale-90"
        style={{ background: "var(--th-border)" }}
      >
        <Minus size={13} className="text-muted-foreground" />
      </button>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v))); }}
        className="w-14 h-8 rounded-xl text-center text-sm font-black"
        style={inpStyle}
      />
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white/10 transition-smooth active:scale-90"
        style={{ background: "var(--th-border)" }}
      >
        <Plus size={13} className="text-muted-foreground" />
      </button>
    </div>
  );
}

function rankBadgeStyle(i: number) {
  if (i === 0) return { background: "rgba(251,191,36,0.2)", color: "#fbbf24" };
  if (i === 1) return { background: "rgba(156,163,175,0.15)", color: "#9ca3af" };
  if (i === 2) return { background: "rgba(180,83,9,0.15)", color: "#b45309" };
  return { background: "var(--th-border)", color: "var(--th-dim)" };
}

export default function LiveScoreboard() {
  const [, params] = useRoute("/tournaments/:id/scoreboard");
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { addAlert } = useAppContext();
  const qc = useQueryClient();
  const id = parseInt(params?.id || "0");

  const pointCfg = loadPointConfig(id);

  const { data: tournament } = useGetTournament(id, { query: { queryKey: ["getTournament", id] } as any });
  const { data: registrations = [] } = useGetRegistrations(
    { tournamentId: id },
    { query: { enabled: true, queryKey: ["getRegistrations", id] } as any },
  );
  const { data: scoreboard = [], refetch, dataUpdatedAt } = useGetScoreboard(id, {
    query: { queryKey: ["getScoreboard", id], refetchInterval: 15000 } as any,
  });

  const [rows, setRows] = useState<Record<number, TeamRow>>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());

  const updateMutation = useUpdateScoreboard({
    mutation: {
      onSuccess: (_, vars) => {
        qc.invalidateQueries({ queryKey: ["getScoreboard", id] });
        const regId = vars.data.registrationId;
        setSavedIds(prev => new Set([...prev, regId]));
        setSavingId(null);
        setTimeout(() => setSavedIds(prev => { const n = new Set(prev); n.delete(regId); return n; }), 2500);
      },
      onError: () => setSavingId(null),
    },
  });

  useEffect(() => {
    const approvedRegs = (registrations as any[]).filter((r: any) => r.status === "approved");
    const sbMap = new Map((scoreboard as any[]).map((e: any) => [e.registrationId, e]));

    setRows(prev => {
      const next = { ...prev };
      for (const reg of approvedRegs) {
        const sb = sbMap.get(reg.id);
        if (!next[reg.id] || !next[reg.id].dirty) {
          next[reg.id] = {
            registrationId: reg.id,
            squadName: reg.squadName || reg.playerName || `Team ${reg.id}`,
            kills: sb?.kills ?? 0,
            rank: sb?.rank ?? null,
            points: sb?.points ?? 0,
            dirty: false,
          };
        }
      }
      for (const entry of (scoreboard as any[])) {
        if (!next[entry.registrationId]) {
          next[entry.registrationId] = {
            registrationId: entry.registrationId,
            squadName: entry.squadName,
            kills: entry.kills ?? 0,
            rank: entry.rank ?? null,
            points: entry.points ?? 0,
            dirty: false,
          };
        }
      }
      return next;
    });
  }, [registrations, scoreboard]);

  function updateKills(regId: number, kills: number) {
    setRows(prev => {
      const row = prev[regId];
      if (!row) return prev;
      const points = calcTotal(kills, row.rank, pointCfg);
      return { ...prev, [regId]: { ...row, kills, points, dirty: true } };
    });
  }

  function updateRank(regId: number, rank: number | null) {
    setRows(prev => {
      const row = prev[regId];
      if (!row) return prev;
      const points = calcTotal(row.kills, rank, pointCfg);
      return { ...prev, [regId]: { ...row, rank, points, dirty: true } };
    });
  }

  function updatePoints(regId: number, points: number) {
    setRows(prev => ({ ...prev, [regId]: { ...prev[regId], points, dirty: true } }));
  }

  function saveRow(regId: number) {
    const row = rows[regId];
    if (!row || savingId !== null) return;
    setSavingId(regId);
    setRows(prev => ({ ...prev, [regId]: { ...prev[regId], dirty: false } }));
    updateMutation.mutate({
      id,
      data: {
        registrationId: row.registrationId,
        squadName: row.squadName,
        kills: row.kills,
        rank: row.rank ?? undefined,
        points: row.points,
      } as any,
    });
  }

  function broadcastUpdate() {
    const sorted = Object.values(rows).sort((a, b) => b.points - a.points);
    const leader = sorted[0];
    addAlert({
      type: "matchCompleted",
      title: "📊 Scoreboard Updated!",
      message: leader
        ? `Live scoreboard updated for "${tournament?.name}". ${leader.squadName} leads with ${leader.points} pts!`
        : `Live scoreboard for "${tournament?.name}" has been updated. Check it now!`,
      extra: { tournamentId: String(id) },
    });
  }

  if (!user?.isHost) {
    return (
      <div className="flex items-center justify-center py-20 px-6 text-center">
        <p className="text-muted-foreground">Host access required</p>
      </div>
    );
  }

  const sortedRows = Object.values(rows).sort((a, b) => {
    if (a.rank !== null && b.rank !== null) return a.rank - b.rank;
    if (a.rank !== null) return -1;
    if (b.rank !== null) return 1;
    return b.points - a.points || b.kills - a.kills;
  });

  const isLive = tournament?.status === "live";
  const lastSynced = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";
  const dirtyCount = Object.values(rows).filter(r => r.dirty).length;

  return (
    <div className="px-4 py-4 flex flex-col gap-4 pb-10">
      {/* Header */}
      <button onClick={() => navigate(`/tournaments/${id}`)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-smooth">
        <ArrowLeft size={16} /> Back to Tournament
      </button>

      <div className="flex items-center justify-between">
        <div className="font-display font-black text-2xl text-foreground">Live Scoreboard</div>
        <button onClick={() => refetch()} className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-white/10 transition-smooth active:scale-90">
          <RefreshCw size={15} className="text-muted-foreground" />
        </button>
      </div>

      {/* Tournament info + live badge */}
      {tournament && (
        <div className="rounded-2xl px-4 py-3 flex items-center gap-3" style={{ background: "var(--th-card)", border: "1px solid var(--th-border)" }}>
          <div className="flex-1 min-w-0">
            <div className="font-display font-bold text-foreground text-sm truncate">{tournament.name}</div>
            {lastSynced && (
              <div className="text-xs mt-0.5 flex items-center gap-1" style={{ color: "var(--th-dim)" }}>
                <Wifi size={10} /> Auto-syncs every 15s · {lastSynced}
              </div>
            )}
          </div>
          {isLive ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full flex-shrink-0" style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)" }}>
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#22c55e" }} />
              <span className="text-xs font-black" style={{ color: "#22c55e" }}>LIVE</span>
            </div>
          ) : (
            <span className="text-xs font-bold px-2.5 py-1 rounded-full capitalize" style={{ background: "var(--th-border)", color: "var(--th-muted)" }}>
              {tournament.status}
            </span>
          )}
        </div>
      )}

      {/* Point system info card */}
      <div className="rounded-2xl px-4 py-3 flex items-center gap-3" style={{ background: "var(--th-card)", border: "1px solid var(--th-border)" }}>
        <div className="flex-1">
          <div className="text-xs font-black uppercase tracking-widest mb-1.5" style={{ color: "var(--th-dim)" }}>Point System</div>
          <div className="flex flex-wrap gap-2">
            <span className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg" style={{ background: "rgba(255,69,0,0.12)", color: "#ff6b35" }}>
              💀 Kill = {pointCfg.killPoints}pt
            </span>
            {pointCfg.placements.slice(0, 5).map((pts, i) => (
              <span key={i} className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg" style={{
                background: i === 0 ? "rgba(251,191,36,0.12)" : "var(--th-card2)",
                color: i === 0 ? "#fbbf24" : "var(--th-muted)"
              }}>
                #{i + 1} = {pts}
              </span>
            ))}
            <span className="text-xs px-2 py-1 rounded-lg" style={{ background: "var(--th-card2)", color: "var(--th-dim)" }}>
              #6+ ···
            </span>
          </div>
        </div>
        <div className="text-xs text-right flex-shrink-0" style={{ color: "var(--th-dimmer)" }}>
          <div className="font-bold text-foreground text-sm">Auto-calc</div>
          <div>rank change → pts</div>
        </div>
      </div>

      {/* Broadcast */}
      <button
        onClick={broadcastUpdate}
        className="w-full h-10 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-smooth active:scale-95"
        style={{ background: "rgba(129,140,248,0.12)", color: "#818cf8", border: "1px solid rgba(129,140,248,0.25)" }}
      >
        <Megaphone size={15} /> Broadcast Scoreboard Update to All Players
      </button>

      {/* Unsaved hint */}
      {dirtyCount > 0 && (
        <div className="text-center text-xs font-semibold py-1.5 rounded-xl" style={{ background: "rgba(251,191,36,0.08)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.2)" }}>
          ⚠️ {dirtyCount} unsaved change{dirtyCount > 1 ? "s" : ""} — tap "Update Score" on each row to push live
        </div>
      )}

      {/* Team rows */}
      {sortedRows.length === 0 ? (
        <div className="rounded-2xl p-8 flex flex-col items-center gap-4 text-center" style={{ background: "var(--th-card)", border: "1px solid var(--th-border)" }}>
          <Trophy size={32} style={{ color: "var(--th-dimmer)" }} />
          <div>
            <div className="font-display font-bold text-foreground mb-1">No Approved Teams Yet</div>
            <p className="text-sm" style={{ color: "var(--th-muted)" }}>
              Approve player registrations first, then come back to manage the scoreboard.
            </p>
          </div>
          <button
            onClick={() => navigate(`/tournaments/${id}`)}
            className="px-5 py-2 rounded-xl text-sm font-bold transition-smooth active:scale-95"
            style={{ background: "rgba(255,107,53,0.12)", color: "#ff6b35", border: "1px solid rgba(255,107,53,0.2)" }}
          >
            View Registrations
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--th-dim)" }}>
              {sortedRows.length} Team{sortedRows.length !== 1 ? "s" : ""}
            </div>
            <div className="text-xs" style={{ color: "var(--th-dimmer)" }}>Kills · Points · Rank</div>
          </div>

          {sortedRows.map((row, i) => {
            const isSaving = savingId === row.registrationId;
            const isSaved = savedIds.has(row.registrationId);
            const autoTotal = calcTotal(row.kills, row.rank, pointCfg);
            const isAutoMatch = row.points === autoTotal;
            return (
              <div
                key={row.registrationId}
                className="rounded-2xl p-4 flex flex-col gap-3 transition-all duration-300"
                style={{
                  background: isSaved ? "rgba(34,197,94,0.06)" : "var(--th-card)",
                  border: isSaved
                    ? "1px solid rgba(34,197,94,0.35)"
                    : row.dirty
                    ? "1px solid rgba(255,107,53,0.35)"
                    : "1px solid var(--th-border)",
                }}
              >
                {/* Team name + rank badge */}
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0" style={rankBadgeStyle(i)}>
                    #{i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-display font-bold text-foreground text-sm truncate">{row.squadName}</div>
                    <div className="text-xs flex items-center gap-2 mt-0.5" style={{ color: "var(--th-dim)" }}>
                      <span className="flex items-center gap-0.5">
                        <Skull size={9} style={{ color: "#ff4500" }} /> {row.kills}K
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Zap size={9} style={{ color: "#fbbf24" }} /> {row.points}pts
                      </span>
                      {row.rank ? <span>#{row.rank} place</span> : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {isSaved && <CheckCircle size={15} style={{ color: "#22c55e" }} />}
                    {row.dirty && !isSaved && !isSaving && (
                      <div className="w-2 h-2 rounded-full" style={{ background: "#fbbf24" }} title="Unsaved changes" />
                    )}
                  </div>
                </div>

                {/* Kills stepper */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Skull size={14} style={{ color: "#ff4500" }} />
                    <div>
                      <div className="text-xs font-bold text-foreground">Kills</div>
                      <div className="text-[10px]" style={{ color: "var(--th-dim)" }}>×{pointCfg.killPoints}pt each</div>
                    </div>
                  </div>
                  <Stepper value={row.kills} onChange={v => updateKills(row.registrationId, v)} />
                </div>

                {/* Rank selector — auto-computes points */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Trophy size={14} style={{ color: "#fbbf24" }} />
                    <div>
                      <div className="text-xs font-bold text-foreground">Placement Rank</div>
                      <div className="text-[10px]" style={{ color: "var(--th-dim)" }}>Auto-fills placement pts</div>
                    </div>
                  </div>
                  <select
                    value={row.rank ?? ""}
                    onChange={e => updateRank(row.registrationId, e.target.value === "" ? null : parseInt(e.target.value))}
                    className="h-8 rounded-xl px-2 text-xs font-bold"
                    style={inpStyle}
                  >
                    <option value="">— Not set —</option>
                    {Array.from({ length: 25 }, (_, i) => i + 1).map(n => (
                      <option key={n} value={n}>#{n} place (+{pointCfg.placements[n - 1] ?? 0}pts)</option>
                    ))}
                  </select>
                </div>

                {/* Total score display + manual override */}
                <div className="rounded-xl p-3 flex items-center justify-between" style={{ background: isAutoMatch ? "rgba(251,191,36,0.06)" : "rgba(129,140,248,0.06)", border: `1px solid ${isAutoMatch ? "rgba(251,191,36,0.2)" : "rgba(129,140,248,0.2)"}` }}>
                  <div>
                    <div className="text-xs font-bold" style={{ color: isAutoMatch ? "#fbbf24" : "#818cf8" }}>
                      {isAutoMatch ? "⚡ Total Score (auto)" : "⚡ Total Score (manual)"}
                    </div>
                    <div className="text-[10px] mt-0.5" style={{ color: "var(--th-dim)" }}>
                      {row.kills}×{pointCfg.killPoints} + {row.rank ? (pointCfg.placements[row.rank - 1] ?? 0) : 0} = {autoTotal}pts
                    </div>
                  </div>
                  <Stepper value={row.points} onChange={v => updatePoints(row.registrationId, v)} />
                </div>

                {/* Save button */}
                <button
                  onClick={() => saveRow(row.registrationId)}
                  disabled={isSaving || savingId !== null}
                  className="w-full h-10 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-smooth active:scale-95 disabled:opacity-50"
                  style={isSaved
                    ? { background: "rgba(34,197,94,0.15)", color: "#22c55e" }
                    : { background: "linear-gradient(135deg, #ff6b35, #ff4500)", color: "#0a0e27" }}
                >
                  {isSaving
                    ? <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                    : isSaved
                    ? <><CheckCircle size={14} /> Saved!</>
                    : <><Zap size={14} /> Update Score</>}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
