import { useState, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import {
  ArrowLeft, Camera, CheckCircle, Trophy, Plus, Trash2,
  X, ChevronRight, Pencil, Upload
} from "lucide-react";
import { useGetTournament, useGetRegistrations, useCreateResult } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAppContext } from "@/contexts/AppContext";
import { apiFetch } from "@/lib/auth";

interface TeamEntry {
  registrationId?: number;
  squadName: string;
  placement: string;
  kills: string;
  outcome: "won" | "completed" | "lost";
  prize: string;
}

interface MatchData {
  matchNumber: number;
  screenshotUrl: string;
  uploadedAt: number;
  entries: TeamEntry[];
}

export interface TournamentResultStore {
  tournamentId: number;
  tournamentName: string;
  matchCount: number;
  matches: MatchData[];
}

export function storeKey(id: number) { return `eliteff_match_results_${id}`; }

export function loadResultStore(id: number): TournamentResultStore | null {
  try { const r = localStorage.getItem(storeKey(id)); return r ? JSON.parse(r) : null; } catch { return null; }
}

async function uploadResultScreenshot(file: File) {
  const contentType = file.type || "image/jpeg";
  const response = await apiFetch("/api/storage/uploads/request-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name || "match-result.jpg", size: file.size, contentType }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.uploadURL || !body.objectPath) {
    throw new Error(body.message || `Unable to prepare result screenshot upload (${response.status})`);
  }
  const uploaded = await fetch(body.uploadURL, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  });
  if (!uploaded.ok) throw new Error(`Result screenshot upload failed (${uploaded.status})`);
  return body.objectPath as string;
}

function saveResultStore(s: TournamentResultStore) {
  localStorage.setItem(storeKey(s.tournamentId), JSON.stringify(s));
}

const inpStyle = {
  background: "var(--th-card2)",
  border: "1px solid var(--th-border2)",
  color: "var(--th-text)",
};

export default function UploadResults() {
  const [, params] = useRoute("/tournaments/:id/results");
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { addAlert } = useAppContext();
  const id = parseInt(params?.id || "0");

  const { data: tournament } = useGetTournament(id, { query: { queryKey: ["getTournament", id] } as any });
  const { data: registrations = [] } = useGetRegistrations(
    { tournamentId: id },
    { query: { enabled: true, queryKey: ["getRegistrations", id] } as any },
  );
  const createResult = useCreateResult();

  const tourneyConfig: { matchCount: number; maps: string[] } | null = (() => {
    try { const c = localStorage.getItem(`eliteff_tournament_config_${id}`); return c ? JSON.parse(c) : null; } catch { return null; }
  })();

  const MAP_META: Record<string, { emoji: string; color: string }> = {
    "Bermuda":    { emoji: "🏝️", color: "#22c55e" },
    "Purgatory":  { emoji: "❄️",  color: "#60a5fa" },
    "Kalahari":   { emoji: "🏜️", color: "#f59e0b" },
    "Alpine":     { emoji: "⛰️",  color: "#818cf8" },
    "Nexterra":   { emoji: "🌌", color: "#a855f7" },
    "Bermuda R.": { emoji: "🌴", color: "#16a34a" },
  };

  const [store, setStore] = useState<TournamentResultStore | null>(() => loadResultStore(id));
  const [matchCount, setMatchCount] = useState<number>(loadResultStore(id)?.matchCount ?? 1);
  const [phase, setPhase] = useState<"pick" | "upload">(loadResultStore(id) ? "upload" : "pick");

  const [editingMatch, setEditingMatch] = useState<number | null>(null);
  const [screenshot, setScreenshot] = useState("");
  const [entries, setEntries] = useState<TeamEntry[]>([]);
  const [formError, setFormError] = useState("");
  const [published, setPublished] = useState(false);
  const [savingMatch, setSavingMatch] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);

  if (!user?.isHost) {
    return (
      <div className="flex items-center justify-center py-20 px-6 text-center">
        <p className="text-muted-foreground">Host access required</p>
      </div>
    );
  }

  const approvedRegs = (registrations as any[]).filter((r: any) => r.status === "verified" || r.status === "approved");

  function startEditing(n: number) {
    const existing = store?.matches.find(m => m.matchNumber === n);
    setEditingMatch(n);
    setScreenshot(existing?.screenshotUrl ?? "");
    if (existing?.entries.length) {
      setEntries(existing.entries.map(entry => {
        const registration = approvedRegs.find((r: any) =>
          String(r.id) === String(entry.registrationId) ||
          (r.squadName || r.playerName || "").trim() === entry.squadName.trim()
        );
        return { ...entry, registrationId: registration?.id };
      }));
    } else if (approvedRegs.length) {
      setEntries(approvedRegs.map((r: any) => ({
        registrationId: r.id,
        squadName: r.squadName || r.playerName || "",
        placement: "",
        kills: "",
        outcome: "completed" as const,
        prize: "",
      })));
    } else {
      setEntries([{ squadName: "", placement: "", kills: "", outcome: "completed", prize: "" }]);
    }
    setFormError("");
  }

  function handleScreenshot(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { setFormError("Screenshot must be under 3 MB"); return; }
    const reader = new FileReader();
    reader.onload = ev => { setScreenshot(ev.target?.result as string); setFormError(""); };
    reader.readAsDataURL(file);
  }

  function updateEntry(i: number, field: keyof TeamEntry, val: string) {
    setEntries(prev => prev.map((e, idx) => idx === i ? { ...e, [field]: val } : e));
  }

  async function saveMatch() {
    if (!screenshot) { setFormError("Upload a screenshot for this match — it is required"); return; }
    if (entries.length === 0) { setFormError("Add at least one team entry"); return; }
    if (entries.some(e => !e.registrationId || !e.squadName.trim())) {
      setFormError("Select a registered team for every result entry");
      return;
    }
    setFormError("");

    const approvedIds = new Set(approvedRegs.map((r: any) => Number(r.id)));
    const missing = entries.find(entry => !entry.registrationId || !approvedIds.has(Number(entry.registrationId)));
    if (missing) {
      setFormError(`"${missing.squadName || "This entry"}" is not an approved registration`);
      return;
    }

    setSavingMatch(true);
    try {
      let screenshotUrl = screenshot;
      if (screenshot.startsWith("data:")) {
        const blob = await (await fetch(screenshot)).blob();
        screenshotUrl = await uploadResultScreenshot(new File([blob], `match-${editingMatch}.jpg`, { type: blob.type || "image/jpeg" }));
      }
      await Promise.all(entries.map((entry) => createResult.mutateAsync({
        data: {
          tournamentId: id,
          registrationId: entry.registrationId,
          matchNumber: editingMatch!,
          squadName: entry.squadName.trim(),
          placement: entry.placement || null,
          outcome: entry.outcome,
          kills: entry.kills ? Number(entry.kills) : null,
          prize: entry.prize ? Number(entry.prize) : null,
          prizeType: null,
          screenshotUrl,
          paymentScreenshotUrl: null,
          utrNumber: null,
          description: null,
        },
      } as any)));

      const matchData: MatchData = { matchNumber: editingMatch!, screenshotUrl, uploadedAt: Date.now(), entries };
      const existing = store?.matches ?? [];
      const updated: TournamentResultStore = {
        tournamentId: id,
        tournamentName: tournament?.name ?? `Tournament #${id}`,
        matchCount: store?.matchCount ?? matchCount,
        matches: [...existing.filter(m => m.matchNumber !== editingMatch), matchData].sort((a, b) => a.matchNumber - b.matchNumber),
      };
      setStore(updated);
      saveResultStore(updated);
      setEditingMatch(null);
      setScreenshot("");
      setEntries([]);
    } catch (error: any) {
      setFormError(error?.message || "Could not save this match. Please try again.");
    } finally {
      setSavingMatch(false);
    }
  }

  function confirmMatchCount() {
    const updated: TournamentResultStore = {
      tournamentId: id,
      tournamentName: tournament?.name ?? `Tournament #${id}`,
      matchCount,
      matches: store?.matches.filter(m => m.matchNumber <= matchCount) ?? [],
    };
    setStore(updated);
    saveResultStore(updated);
    setPhase("upload");
  }

  async function publishResults() {
    if (!store) return;
    setFormError("");
    try {
      const title = "🏆 Results Are Live!";
      const message = `Results for "${store.tournamentName}" (${store.matchCount} ${store.matchCount === 1 ? "match" : "matches"}) are now posted. Go check your Results tab!`;
      const response = await apiFetch("/api/notifications/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournamentId: id, title, message, type: "matchCompleted" }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "Could not notify registered players");
      addAlert({ type: "matchCompleted", title, message, extra: { tournamentName: store.tournamentName, tournamentId: String(id) } });
      const completeResponse = await apiFetch(`/api/tournaments/${id}/complete`, { method: "POST" });
      if (!completeResponse.ok) {
        const completeBody = await completeResponse.json().catch(() => ({}));
        throw new Error(completeBody.message || "Results were posted, but tournament completion failed");
      }
      setPublished(true);
    } catch (error: any) {
      setFormError(error?.message || "Could not publish results. Please try again.");
      return;
    }
    setTimeout(() => navigate(`/tournaments/${id}`), 2000);
  }

  const mc = store?.matchCount ?? matchCount;
  const uploadedNums = new Set(store?.matches.map(m => m.matchNumber) ?? []);
  const allDone = store && store.matches.length >= mc;

  /* ─── PHASE: PICK MATCH COUNT ─────────────────────────────── */
  if (phase === "pick") {
    return (
      <div className="px-4 py-4 flex flex-col gap-5 pb-10">
        <button onClick={() => navigate(`/tournaments/${id}`)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-smooth">
          <ArrowLeft size={16} /> Back
        </button>
        <div className="font-display font-black text-2xl text-foreground">Upload Results</div>

        {tournament && (
          <div className="rounded-2xl px-4 py-3" style={{ background: "var(--th-card)", border: "1px solid var(--th-border)" }}>
            <div className="text-xs font-bold mb-0.5" style={{ color: "var(--th-dim)" }}>Tournament</div>
            <div className="font-display font-bold text-foreground">{tournament.name}</div>
          </div>
        )}

        <div className="rounded-2xl p-5 flex flex-col gap-5" style={{ background: "var(--th-card)", border: "1px solid var(--th-border)" }}>
          <div>
            <div className="font-display font-bold text-xl text-foreground mb-1">How many matches?</div>
            <p className="text-sm leading-relaxed" style={{ color: "var(--th-muted)" }}>
              Choose the total number of matches played. You must upload a result screenshot for <span className="font-bold text-foreground">each match</span> before publishing.
            </p>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
              <button
                key={n}
                onClick={() => setMatchCount(n)}
                className="h-12 rounded-xl font-black text-base transition-smooth active:scale-90"
                style={matchCount === n
                  ? { background: "linear-gradient(135deg, #ff6b35, #ff4500)", color: "#0a0e27" }
                  : { background: "var(--th-border)", color: "var(--th-muted)" }}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: matchCount > 1 ? "rgba(255,107,53,0.06)" : "rgba(255,255,255,0.03)", border: "1px solid var(--th-border)" }}>
            <span className="text-sm font-semibold text-foreground">{matchCount} {matchCount === 1 ? "match" : "matches"}</span>
            <span className="text-sm" style={{ color: "var(--th-muted)" }}> — you will upload {matchCount} screenshot{matchCount > 1 ? "s" : ""}</span>
          </div>
          <button
            onClick={confirmMatchCount}
            className="w-full h-12 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-smooth active:scale-95"
            style={{ background: "linear-gradient(135deg, #ff6b35, #ff4500)", color: "#0a0e27" }}
          >
            <ChevronRight size={18} /> Start Uploading Results
          </button>
        </div>
      </div>
    );
  }

  /* ─── PHASE: UPLOAD PER MATCH ─────────────────────────────── */
  return (
    <div className="px-4 py-4 flex flex-col gap-4 pb-10">
      <button onClick={() => navigate(`/tournaments/${id}`)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-smooth">
        <ArrowLeft size={16} /> Back to Tournament
      </button>

      <div className="flex items-center justify-between">
        <div className="font-display font-black text-2xl text-foreground">Upload Results</div>
        <button
          onClick={() => setPhase("pick")}
          className="text-xs font-semibold px-3 py-1.5 rounded-xl transition-smooth"
          style={{ background: "var(--th-border)", color: "var(--th-muted)" }}
        >
          {mc} {mc === 1 ? "match" : "matches"} · Change
        </button>
      </div>

      {tournament && (
        <div className="rounded-2xl px-4 py-3" style={{ background: "var(--th-card)", border: "1px solid var(--th-border)" }}>
          <div className="text-xs font-bold mb-0.5" style={{ color: "var(--th-dim)" }}>Tournament</div>
          <div className="font-display font-bold text-foreground text-sm">{tournament.name}</div>
        </div>
      )}

      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between text-xs font-bold mb-2" style={{ color: "var(--th-dim)" }}>
          <span className="uppercase tracking-widest">Progress</span>
          <span style={{ color: uploadedNums.size === mc ? "#22c55e" : "#ff6b35" }}>
            {uploadedNums.size}/{mc} uploaded
          </span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--th-border)" }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${(uploadedNums.size / mc) * 100}%`,
              background: uploadedNums.size === mc ? "linear-gradient(90deg,#22c55e,#16a34a)" : "linear-gradient(90deg,#ff6b35,#ff4500)",
            }}
          />
        </div>
      </div>

      {/* Match tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {Array.from({ length: mc }, (_, i) => i + 1).map(n => {
          const done = uploadedNums.has(n);
          const active = editingMatch === n;
          const mapName = tourneyConfig?.maps?.[n - 1];
          const mapMeta = mapName ? MAP_META[mapName] : null;
          return (
            <button
              key={n}
              onClick={() => startEditing(n)}
              className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-xs font-bold flex-shrink-0 transition-smooth active:scale-95"
              style={active
                ? { background: "linear-gradient(135deg, #ff6b35, #ff4500)", color: "#0a0e27" }
                : done
                ? { background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" }
                : { background: "var(--th-card2)", color: "var(--th-muted)", border: "1px solid var(--th-border2)" }}
            >
              <span className="flex items-center gap-1">
                {done && !active && <CheckCircle size={11} />}
                Match {n}
              </span>
              {mapMeta && mapName && (
                <span className="text-[9px] font-semibold opacity-80">{mapMeta.emoji} {mapName}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Edit form */}
      {editingMatch !== null ? (
        <div className="rounded-2xl p-4 flex flex-col gap-4" style={{ background: "var(--th-card)", border: "1px solid var(--th-border)" }}>
          <div className="flex items-center justify-between">
            <div className="font-display font-bold text-foreground">Match {editingMatch} Results</div>
            <button onClick={() => { setEditingMatch(null); setScreenshot(""); setEntries([]); }}
              className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white/10 transition-smooth">
              <X size={14} className="text-muted-foreground" />
            </button>
          </div>

          {/* Screenshot */}
          <div>
            <div className="text-xs font-bold text-muted-foreground mb-2">Match Screenshot <span style={{ color: "#ff4500" }}>*</span></div>
            <label className="block cursor-pointer">
              <div
                className="w-full rounded-2xl border-2 border-dashed flex flex-col items-center justify-center transition-smooth overflow-hidden"
                style={{ borderColor: screenshot ? "rgba(34,197,94,0.5)" : "var(--th-border2)", minHeight: screenshot ? 0 : "120px" }}
              >
                {screenshot ? (
                  <img src={screenshot} alt="Match screenshot" className="w-full max-h-52 object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-2 py-8">
                    <Camera size={28} style={{ color: "var(--th-dimmer)" }} />
                    <span className="text-sm font-semibold" style={{ color: "var(--th-dim)" }}>Tap to upload screenshot</span>
                    <span className="text-xs" style={{ color: "var(--th-dimmer)" }}>PNG, JPG — max 3 MB · Required for every match</span>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleScreenshot} />
            </label>
            {screenshot && (
              <div className="flex items-center gap-2 mt-1.5">
                <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1 text-xs font-bold" style={{ color: "#ff6b35" }}>
                  <Upload size={11} /> Replace
                </button>
                <span style={{ color: "var(--th-dimmer)" }}>·</span>
                <button onClick={() => setScreenshot("")} className="text-xs font-bold" style={{ color: "#ff4500" }}>Remove</button>
              </div>
            )}
          </div>

          {/* Team entries */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-bold text-muted-foreground">
                Team Results <span style={{ color: "var(--th-dim)" }}>({entries.length})</span>
              </div>
              <button
                 onClick={() => setEntries(prev => [...prev, { squadName: "", placement: "", kills: "", outcome: "completed", prize: "" }])}
                disabled={approvedRegs.length === 0 || entries.length >= approvedRegs.length}
                className="flex items-center gap-1 text-xs font-bold transition-smooth"
                style={{ color: "#ff6b35" }}
              >
                <Plus size={12} /> Add Team
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {entries.map((entry, i) => (
                <div key={i} className="rounded-xl p-3 flex flex-col gap-2" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--th-border)" }}>
                  {/* Row 1: number + squad name + delete */}
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-black flex-shrink-0"
                      style={{ background: "rgba(255,107,53,0.12)", color: "#ff6b35" }}>
                      {i + 1}
                    </div>
                    <select
                      value={entry.registrationId ? String(entry.registrationId) : ""}
                      onChange={e => {
                        const registration = approvedRegs.find((r: any) => String(r.id) === e.target.value);
                        setEntries(prev => prev.map((item, index) => index === i
                          ? { ...item, registrationId: registration?.id, squadName: registration?.squadName || registration?.playerName || "" }
                          : item));
                      }}
                      className="flex-1 h-9 rounded-lg px-3 text-xs font-semibold"
                      style={inpStyle}
                    >
                      <option value="">Select registered team</option>
                      {approvedRegs.map((r: any) => (
                        <option
                          key={r.id}
                          value={String(r.id)}
                          disabled={entries.some((other, otherIndex) => otherIndex !== i && String(other.registrationId) === String(r.id))}
                        >
                          {r.squadName || r.playerName || `Registration #${r.id}`}
                        </option>
                      ))}
                    </select>
                    <button onClick={() => setEntries(p => p.filter((_, x) => x !== i))}
                      className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-500/15 transition-smooth flex-shrink-0">
                      <Trash2 size={12} style={{ color: "#ff4500" }} />
                    </button>
                  </div>
                  {/* Row 2: placement + kills */}
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={entry.placement}
                      onChange={e => updateEntry(i, "placement", e.target.value)}
                      placeholder="Placement (#1, #2...)"
                      className="h-9 rounded-lg px-3 text-xs"
                      style={inpStyle}
                    />
                    <input
                      value={entry.kills}
                      onChange={e => updateEntry(i, "kills", e.target.value)}
                      placeholder="Kills"
                      type="number"
                      min={0}
                      className="h-9 rounded-lg px-3 text-xs"
                      style={inpStyle}
                    />
                  </div>
                  {/* Row 3: outcome + prize */}
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={entry.outcome}
                      onChange={e => updateEntry(i, "outcome", e.target.value as TeamEntry["outcome"])}
                      className="h-9 rounded-lg px-3 text-xs font-semibold"
                      style={{
                        ...inpStyle,
                        color: entry.outcome === "won" ? "#22c55e" : entry.outcome === "lost" ? "#ff4500" : "#ff6b35",
                      }}
                    >
                      <option value="won">🏆 Won</option>
                      <option value="completed">⚔️ Completed</option>
                      <option value="lost">💀 Lost</option>
                    </select>
                    <input
                      value={entry.prize}
                      onChange={e => updateEntry(i, "prize", e.target.value)}
                      placeholder="Prize (₹ optional)"
                      className="h-9 rounded-lg px-3 text-xs"
                      style={inpStyle}
                    />
                  </div>
                </div>
              ))}

              {entries.length === 0 && (
                <div className="rounded-xl py-6 text-center" style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed var(--th-border2)" }}>
                  <p className="text-xs" style={{ color: "var(--th-dim)" }}>
                    {approvedRegs.length ? 'Tap "Add Team" above, then select a registered team.' : "No approved teams are available for this tournament yet."}
                  </p>
                </div>
              )}
            </div>
          </div>

          {formError && <p className="text-xs font-semibold" style={{ color: "#ff4500" }}>{formError}</p>}

            <button
            onClick={saveMatch}
             disabled={savingMatch}
             className="w-full h-11 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-smooth active:scale-95 disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, #ff6b35, #ff4500)", color: "#0a0e27" }}
          >
             {savingMatch ? <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" /> : <CheckCircle size={16} />}
             {savingMatch ? "Saving…" : `Save Match ${editingMatch} Results`}
          </button>
        </div>
      ) : (
        /* Idle state — show tap prompt or uploaded previews */
        <div className="rounded-2xl p-5 text-center" style={{ background: "var(--th-card)", border: "1px solid var(--th-border)" }}>
          <Trophy size={28} className="mx-auto mb-2" style={{ color: "var(--th-dimmer)" }} />
          <p className="text-sm" style={{ color: "var(--th-muted)" }}>
            {uploadedNums.size === 0
              ? "Tap a match tab above to start uploading"
              : `${uploadedNums.size} of ${mc} ${mc === 1 ? "match" : "matches"} uploaded. Tap any match to edit.`}
          </p>
        </div>
      )}

      {/* Uploaded match cards */}
      {store && store.matches.length > 0 && editingMatch === null && (
        <div className="flex flex-col gap-3">
          <div className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--th-dim)" }}>Uploaded Matches</div>
          {store.matches.map(m => (
            <div key={m.matchNumber} className="rounded-2xl overflow-hidden" style={{ background: "var(--th-card)", border: "1px solid rgba(34,197,94,0.25)" }}>
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <CheckCircle size={15} style={{ color: "#22c55e" }} />
                  <span className="font-display font-bold text-foreground text-sm">Match {m.matchNumber}</span>
                  <span className="text-xs" style={{ color: "var(--th-dim)" }}>{m.entries.length} team{m.entries.length !== 1 ? "s" : ""}</span>
                </div>
                <button onClick={() => startEditing(m.matchNumber)} className="flex items-center gap-1 text-xs font-bold transition-smooth" style={{ color: "#ff6b35" }}>
                  <Pencil size={11} /> Edit
                </button>
              </div>
              {m.screenshotUrl && (
                <img src={m.screenshotUrl} alt={`Match ${m.matchNumber}`} className="w-full max-h-28 object-cover" />
              )}
              <div className="px-4 py-2 flex flex-col gap-1">
                {m.entries.map((e, i) => (
                  <div key={i} className="flex items-center justify-between text-xs py-1" style={{ borderTop: i > 0 ? "1px solid var(--th-card2)" : "none" }}>
                    <span className="font-semibold text-foreground truncate flex-1">{e.squadName}</span>
                    <span className="ml-2 flex-shrink-0" style={{ color: e.outcome === "won" ? "#22c55e" : e.outcome === "lost" ? "#ff4500" : "#ff6b35" }}>
                      {e.outcome === "won" ? "🏆" : e.outcome === "lost" ? "💀" : "⚔️"}
                      {e.placement ? ` #${e.placement}` : ""}
                      {e.kills ? ` · ${e.kills}K` : ""}
                      {e.prize ? ` · ₹${e.prize}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Publish All */}
      {allDone && !published && editingMatch === null && (
        <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.25)" }}>
          <div className="flex items-center gap-2">
            <CheckCircle size={17} style={{ color: "#22c55e" }} />
            <span className="font-display font-bold text-foreground text-sm">
              All {mc} {mc === 1 ? "match" : "matches"} uploaded!
            </span>
          </div>
          <p className="text-xs" style={{ color: "var(--th-muted)" }}>
            Tap Publish to notify all registered players that results are live in their Results tab.
          </p>
          <button
            onClick={publishResults}
            className="w-full h-12 rounded-2xl font-black text-base flex items-center justify-center gap-2 transition-smooth active:scale-95"
            style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)", color: "#fff" }}
          >
            <Trophy size={18} /> Publish All Results
          </button>
        </div>
      )}

      {published && (
        <div className="rounded-2xl p-6 text-center" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" }}>
          <CheckCircle size={36} className="mx-auto mb-3" style={{ color: "#22c55e" }} />
          <div className="font-display font-bold text-foreground text-lg">Results Published!</div>
          <p className="text-xs mt-1" style={{ color: "var(--th-muted)" }}>Players have been notified. Redirecting…</p>
        </div>
      )}
    </div>
  );
}
