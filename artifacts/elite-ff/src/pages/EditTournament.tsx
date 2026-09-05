import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { ArrowLeft, Save, ImagePlus, CheckCircle, Plus, Trash2 } from "lucide-react";
import { useGetTournament, useUpdateTournament } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { formatDateTime12 } from "@/lib/dateFormat";
import { apiFetch } from "@/lib/auth";
import QRCode from "qrcode";

const TYPES = ["Battle Royale", "Clash Squad", "Custom"];
const MODES = ["Squad", "Duo", "Solo"];
const STATUSES = ["upcoming", "live", "completed", "cancelled", "delayed"];

const PRESETS: Record<string, { killPoints: number; placements: number[] }> = {
  standard:   { killPoints: 1, placements: [12, 9, 7, 5, 4, 3, 2, 2, 2, 2, 1, 1] },
  aggressive: { killPoints: 2, placements: [10, 7, 5, 4, 3, 2, 2, 1, 1, 1, 0, 0] },
  kills:      { killPoints: 3, placements: [6,  4, 3, 2, 2, 1, 1, 1, 0, 0, 0, 0] },
};

const FF_MAPS = [
  { name: "Bermuda",    emoji: "🏝️", color: "#22c55e" },
  { name: "Purgatory",  emoji: "❄️",  color: "#60a5fa" },
  { name: "Kalahari",   emoji: "🏜️", color: "#f59e0b" },
  { name: "Alpine",     emoji: "⛰️",  color: "#818cf8" },
  { name: "Nexterra",   emoji: "🌌", color: "#a855f7" },
  { name: "Bermuda R.", emoji: "🌴", color: "#16a34a" },
];

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX = 800;
        const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.75));
      };
      img.onerror = reject;
      img.src = ev.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function uploadTournamentPoster(file: File) {
  const contentType = file.type || "image/jpeg";
  if (!contentType.startsWith("image/")) throw new Error("Choose an image file for the tournament poster");
  if (file.size <= 0 || file.size > 10 * 1024 * 1024) throw new Error("Tournament poster must be 10MB or smaller");
  const response = await apiFetch("/api/storage/uploads/request-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name || "tournament-poster.jpg", size: file.size, contentType, purpose: "tournament-poster" }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.uploadURL || !body.objectPath) throw new Error(body.message || `Unable to prepare poster upload (${response.status})`);
  const uploaded = await fetch(body.uploadURL, {
    method: body.uploadMethod || "PUT",
    headers: { "Content-Type": contentType, ...(body.uploadHeaders || {}) },
    body: file,
  });
  if (!uploaded.ok) throw new Error(`Tournament poster upload failed (${uploaded.status})`);
  return body.objectPath as string;
}

function divider() {
  return <div style={{ height: 1, background: "var(--th-card2)" }} />;
}

function sectionLabel(text: string) {
  return <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{text}</label>;
}

const inputStyle = { background: "var(--th-card2)", border: "1px solid var(--th-border2)", color: "var(--th-text)" };

export default function EditTournament() {
  const [, params] = useRoute("/tournaments/:id/edit");
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const id = parseInt(params?.id || "0");
  const qc = useQueryClient();
  const posterRef = useRef<HTMLInputElement>(null);

  const { data: tournament, isLoading } = useGetTournament(id, { query: { queryKey: ["getTournament", id] } as any });
  const [hostTournament, setHostTournament] = useState<any>(null);

  useEffect(() => {
    if (!id || !user?.isHost) return;
    let active = true;
    apiFetch(`/api/tournaments/${id}/full`)
      .then(async response => response.ok ? response.json() : null)
      .then(data => { if (active && data) setHostTournament(data); })
      .catch(() => {});
    return () => { active = false; };
  }, [id, user?.isHost]);

  /* ── Core form ───────────────────────────────────────── */
  const [form, setForm] = useState({
    name: "", type: "Battle Royale", mode: "Squad", teamSize: "4",
    entryFee: "", prizePool: "", maxSlots: "12",
    upiId: "", scheduledAt: "", rules: "", roomId: "", roomPassword: "",
    isPaid: true, timerEnabled: false, status: "upcoming",
  });

  /* ── localStorage-backed config ─────────────────────── */
  const [posterBase64, setPosterBase64] = useState("");
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [uploadingPoster, setUploadingPoster] = useState(false);
  const [matchCount, setMatchCount] = useState(3);
  const [maps, setMaps] = useState<string[]>(Array(10).fill("Bermuda"));
  const [pointPreset, setPointPreset] = useState<"standard" | "aggressive" | "kills" | "custom">("standard");
  const [killPoints, setKillPoints] = useState(1);
  const [placements, setPlacements] = useState<number[]>([...PRESETS.standard.placements]);
  const [prizeRanks, setPrizeRanks] = useState([
    { rank: 1, label: "🏆 Booyah! Winner", amount: "" },
    { rank: 2, label: "🥈 Runner-up",      amount: "" },
    { rank: 3, label: "🥉 Third Place",    amount: "" },
  ]);

  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  /* Populate form from API + localStorage once tournament loads */
  useEffect(() => {
    const source = hostTournament ?? tournament;
    if (!source) return;

    setForm({
      name: source.name ?? "",
      type: source.type ?? "Battle Royale",
      mode: source.mode ?? "Squad",
      teamSize: String(source.teamSize ?? "4"),
      entryFee: source.entryFee != null ? String(source.entryFee) : "",
      prizePool: source.prizePool != null ? String(source.prizePool) : "",
      maxSlots: String(source.maxSlots ?? 12),
      upiId: source.upiId ?? "",
      scheduledAt: source.scheduledAt ? new Date(source.scheduledAt).toISOString().slice(0, 16) : "",
      rules: source.rules ?? "",
      roomId: source.roomId ?? "",
      roomPassword: source.roomPassword ?? "",
      isPaid: source.isPaid ?? true,
      timerEnabled: source.timerEnabled ?? false,
      status: source.status ?? "upcoming",
    });

    /* Poster */
    const poster = source.posterUrl || localStorage.getItem(`eliteff_tournament_poster_${id}`);
    if (poster) setPosterBase64(poster);

    /* Shared match config, with localStorage fallback for older tournaments */
    try {
      const storedMaps = typeof source.maps === "string"
        ? JSON.parse(source.maps)
        : source.maps;
      const cfg = source.matchCount || storedMaps
        ? { matchCount: source.matchCount, maps: storedMaps }
        : JSON.parse(localStorage.getItem(`eliteff_tournament_config_${id}`) || "null");
      if (cfg) {
        setMatchCount(cfg.matchCount ?? 3);
        const base = Array(10).fill("Bermuda");
        (cfg.maps ?? []).forEach((m: string, i: number) => { base[i] = m; });
        setMaps(base);
      }
    } catch { /* ignore */ }

    /* Point system */
    try {
      const serverPlacements = typeof source.placements === "string"
        ? JSON.parse(source.placements)
        : source.placements;
      const pts = (serverPlacements || source.killPoints != null)
        ? { killPoints: source.killPoints, placements: serverPlacements }
        : JSON.parse(localStorage.getItem(`eliteff_tournament_points_${id}`) || "null");
      if (pts) {
        setKillPoints(pts.killPoints ?? 1);
        if (Array.isArray(pts.placements)) setPlacements(pts.placements);
        setPointPreset("custom");
      }
    } catch { /* ignore */ }

    /* Prize distribution */
    try {
      const serverPrizes = typeof source.prizeDistribution === "string"
        ? JSON.parse(source.prizeDistribution)
        : source.prizeDistribution;
      const priz = serverPrizes
        ? { ranks: serverPrizes }
        : JSON.parse(localStorage.getItem(`eliteff_tournament_prizes_${id}`) || "null");
      if (priz?.ranks?.length) {
        setPrizeRanks(priz.ranks.map((r: { rank: number; label: string; amount: number }) => ({
          rank: r.rank, label: r.label, amount: String(r.amount),
        })));
      }
    } catch { /* ignore */ }
  }, [tournament, hostTournament, id]);

  const update = useUpdateTournament({
    mutation: {
      onSuccess: () => {
        /* Save localStorage-backed sections */
        if (posterBase64) {
          localStorage.setItem(`eliteff_tournament_poster_${id}`, posterBase64);
        } else {
          localStorage.removeItem(`eliteff_tournament_poster_${id}`);
        }
        localStorage.setItem(`eliteff_tournament_config_${id}`, JSON.stringify({
          matchCount, maps: maps.slice(0, matchCount),
        }));
        localStorage.setItem(`eliteff_tournament_points_${id}`, JSON.stringify({
          killPoints, placements,
        }));
        const filledPrizes = prizeRanks.filter(r => Number(r.amount) > 0);
        if (filledPrizes.length > 0) {
          localStorage.setItem(`eliteff_tournament_prizes_${id}`, JSON.stringify({
            ranks: filledPrizes.map(r => ({ rank: r.rank, label: r.label, amount: Number(r.amount) })),
          }));
        } else {
          localStorage.removeItem(`eliteff_tournament_prizes_${id}`);
        }

        qc.invalidateQueries({ queryKey: ["getTournament", id] });
        qc.invalidateQueries({ queryKey: ["getTournaments"] });
        setSaved(true);
        setTimeout(() => { setSaved(false); navigate(`/tournaments/${id}`); }, 1200);
      },
      onError: (e: any) => setError(e.message || "Failed to update"),
    },
  });

  async function handlePosterPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Choose an image file for the poster"); return; }
    if (file.size > 10 * 1024 * 1024) { setError("Tournament poster must be 10MB or smaller"); return; }
    try {
      setPosterFile(file);
      setPosterBase64(await compressImage(file));
    }
    catch { setError("Failed to process image"); }
  }

  async function handleSubmit() {
    if (!form.name.trim()) { setError("Tournament name is required"); return; }
    setError("");
    setUploadingPoster(Boolean(posterFile));
    try {
      const posterUrl = posterFile ? await uploadTournamentPoster(posterFile) : (posterBase64.startsWith("http") ? posterBase64 : null);
      const qrUrl = form.isPaid
        ? await QRCode.toDataURL(
            `upi://pay?pa=${encodeURIComponent(form.upiId.trim())}&pn=EliteFF&am=${Number(form.entryFee || 0)}&tn=${encodeURIComponent(`Entry: ${form.name.trim()}`)}`,
            { width: 320, margin: 2, errorCorrectionLevel: "M", color: { dark: "#0a0e27", light: "#ffffff" } },
          )
        : null;
      update.mutate({
        id,
        data: {
          name: form.name.trim(),
          type: form.type,
          mode: form.mode,
          teamSize: form.teamSize,
          matchCount,
          maps: maps.slice(0, matchCount),
          killPoints,
          placements,
          prizeDistribution: prizeRanks
            .filter(r => Number(r.amount) > 0)
            .map(r => ({ rank: r.rank, label: r.label, amount: Number(r.amount) })),
          entryFee: form.entryFee ? Number(form.entryFee) : null,
          prizePool: form.prizePool ? Number(form.prizePool) : null,
          maxSlots: parseInt(form.maxSlots) || 12,
          upiId: form.upiId || null,
          qrUrl,
          scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : undefined,
          rules: form.rules || null,
          posterUrl,
          roomId: form.roomId || null,
          roomPassword: form.roomPassword || null,
          isPaid: form.isPaid,
          timerEnabled: form.timerEnabled,
        } as any,
      });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Unable to upload tournament poster");
    } finally {
      setUploadingPoster(false);
    }
  }

  function autoSplit(splits: number[]) {
    const pool = Number(form.prizePool) || 0;
    if (!pool) return;
    setPrizeRanks(prev => {
      const base = prev.length >= splits.length ? prev : [
        ...prev,
        ...Array.from({ length: splits.length - prev.length }, (_, i) => ({
          rank: prev.length + i + 1,
          label: `#${prev.length + i + 1} Place`,
          amount: "",
        })),
      ];
      return base.slice(0, splits.length).map((r, i) => ({
        ...r, amount: String(Math.floor(pool * splits[i])),
      }));
    });
  }

  const inp = (label: string, key: keyof typeof form, type = "text", ph = "") => (
    <div key={key}>
      <label className="text-xs font-bold text-muted-foreground mb-1 block">{label}</label>
      <input
        type={type} placeholder={ph || label} value={String(form[key])}
        onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
        className="w-full h-10 rounded-xl px-3 text-sm" style={inputStyle}
      />
    </div>
  );

  if (!user?.isHost) {
    return (
      <div className="flex items-center justify-center py-20 px-6 text-center">
        <p className="text-muted-foreground">Host access required</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="px-4 py-6 flex flex-col gap-4 animate-pulse">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-10 rounded-xl" style={{ background: "var(--th-card2)" }} />
        ))}
      </div>
    );
  }

  const pool = Number(form.prizePool) || 0;
  const totalDistributed = prizeRanks.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const remaining = pool - totalDistributed;

  return (
    <div className="px-4 py-4 flex flex-col gap-5 pb-10" data-testid="edit-tournament">
      {/* Back */}
      <button onClick={() => navigate(`/tournaments/${id}`)} className="flex items-center gap-2 text-muted-foreground text-sm transition-smooth hover:text-foreground self-start">
        <ArrowLeft size={16} /> Back to Tournament
      </button>

      <div className="font-display font-black text-2xl text-foreground">Edit Tournament</div>

      {/* ── POSTER ─────────────────────────────────────── */}
      <div className="flex flex-col gap-2">
        {sectionLabel("Tournament Poster")}
        <input ref={posterRef} type="file" accept="image/*" className="hidden" onChange={handlePosterPick} />
        <button
          onClick={() => posterRef.current?.click()}
          className="w-full rounded-2xl overflow-hidden flex items-center justify-center transition-smooth active:scale-98 relative"
          style={{ height: posterBase64 ? 160 : 110, background: posterBase64 ? "transparent" : "var(--th-card)", border: `2px dashed ${posterBase64 ? "transparent" : "var(--th-border2)"}` }}
        >
          {posterBase64 ? (
            <>
              <img src={posterBase64} alt="poster" className="w-full h-full object-cover" />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-all duration-200" style={{ background: "rgba(0,0,0,0.55)" }}>
                <span className="text-xs font-bold text-white flex items-center gap-1.5"><ImagePlus size={14} /> Change Poster</span>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,107,53,0.12)" }}>
                <ImagePlus size={18} style={{ color: "#ff6b35" }} />
              </div>
              <span className="text-xs font-semibold" style={{ color: "var(--th-muted)" }}>Tap to upload poster / banner</span>
            </div>
          )}
        </button>
        {posterBase64 && (
          <button onClick={() => setPosterBase64("")} className="self-start text-xs font-bold px-3 py-1.5 rounded-lg transition-smooth hover:bg-red-500/15" style={{ color: "#ff4500" }}>
            Remove poster
          </button>
        )}
      </div>

      {divider()}

      {/* ── BASIC INFO ─────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        {sectionLabel("Basic Info")}
        {inp("Tournament Name *", "name")}
        <div>
          <label className="text-xs font-bold text-muted-foreground mb-1 block">Status</label>
          <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
            className="w-full h-10 rounded-xl px-3 text-sm capitalize" style={inputStyle}>
            {STATUSES.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
          </select>
        </div>
        {/* Type chips */}
        <div>
          <label className="text-xs font-bold text-muted-foreground mb-2 block">Type</label>
          <div className="grid grid-cols-3 gap-2">
            {([
              { value: "Battle Royale", emoji: "🏆", short: "Battle Royale" },
              { value: "Clash Squad",   emoji: "⚔️",  short: "Clash Squad" },
              { value: "Custom",        emoji: "🎯",  short: "Custom" },
            ] as const).map(t => (
              <button key={t.value} type="button"
                onClick={() => setForm(p => ({ ...p, type: t.value }))}
                className="flex flex-col items-center justify-center gap-1 py-2.5 px-1 rounded-xl text-center transition-smooth active:scale-95"
                style={form.type === t.value
                  ? { background: "rgba(255,107,53,0.15)", border: "1.5px solid rgba(255,107,53,0.55)", color: "#ff6b35" }
                  : { background: "var(--th-input)", border: "1px solid var(--th-border2)", color: "var(--th-muted)" }}>
                <span className="text-base leading-none">{t.emoji}</span>
                <span className="text-[11px] font-black leading-tight">{t.short}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Mode chips */}
        <div>
          <label className="text-xs font-bold text-muted-foreground mb-2 block">Mode</label>
          <div className="grid grid-cols-3 gap-2">
            {([
              { value: "Squad", label: "Squad", sub: "4 players" },
              { value: "Duo",   label: "Duo",   sub: "2 players" },
              { value: "Solo",  label: "Solo",  sub: "1 player"  },
            ] as const).map(m => (
              <button key={m.value} type="button"
                onClick={() => {
                  const ts = m.value === "Squad" ? "4" : m.value === "Duo" ? "2" : "1";
                  setForm(p => ({ ...p, mode: m.value, teamSize: ts }));
                }}
                className="flex flex-col items-center justify-center gap-0.5 py-2.5 px-1 rounded-xl text-center transition-smooth active:scale-95"
                style={form.mode === m.value
                  ? { background: "rgba(255,107,53,0.15)", border: "1.5px solid rgba(255,107,53,0.55)", color: "#ff6b35" }
                  : { background: "var(--th-input)", border: "1px solid var(--th-border2)", color: "var(--th-muted)" }}>
                <span className="text-xs font-black">{m.label}</span>
                <span className="text-[10px] leading-tight" style={{ color: form.mode === m.value ? "rgba(255,107,53,0.7)" : "var(--th-dim)" }}>{m.sub}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Max slots + Prize Pool */}
        <div className="grid grid-cols-2 gap-3">
          {inp("Max Teams", "maxSlots", "number")}
          {inp("Prize Pool (₹)", "prizePool", "number", "0")}
        </div>

        {/* Paid / Free toggle */}
        <div className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: "var(--th-input)", border: "1px solid var(--th-border2)" }}>
          <div>
            <div className="text-sm font-bold text-foreground">Entry Type</div>
            <div className="text-[11px] mt-0.5" style={{ color: "var(--th-dim)" }}>{form.isPaid ? "Players must pay to enter" : "Free for all players"}</div>
          </div>
          <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid var(--th-border2)" }}>
            <button type="button" onClick={() => setForm(p => ({ ...p, isPaid: false }))}
              className="px-3 py-1.5 text-xs font-black transition-smooth"
              style={!form.isPaid ? { background: "linear-gradient(135deg,#22c55e,#16a34a)", color: "#fff" } : { background: "var(--th-card2)", color: "var(--th-dim)" }}>
              Free
            </button>
            <button type="button" onClick={() => setForm(p => ({ ...p, isPaid: true }))}
              className="px-3 py-1.5 text-xs font-black transition-smooth"
              style={form.isPaid ? { background: "linear-gradient(135deg,#ff6b35,#ff4500)", color: "#fff" } : { background: "var(--th-card2)", color: "var(--th-dim)" }}>
              Paid
            </button>
          </div>
        </div>

        {/* Entry fee + UPI — paid only */}
        {form.isPaid && (
          <div className="flex flex-col gap-3 rounded-xl p-3" style={{ background: "rgba(255,107,53,0.05)", border: "1px solid rgba(255,107,53,0.15)" }}>
            <div className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,107,53,0.7)" }}>Paid Entry Details</div>
            {inp("Entry Fee (₹) *", "entryFee", "number", "e.g. 50")}
            {inp("UPI ID *", "upiId", "text", "yourname@bank")}
          </div>
        )}

        {inp("Scheduled At", "scheduledAt", "datetime-local")}
        <div className="rounded-xl px-3 py-2.5 flex items-center justify-between" style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.16)" }}>
          <span className="text-[11px] font-bold" style={{ color: "var(--th-muted)" }}>Players will see</span>
          <span className="text-xs font-black" style={{ color: "#4ade80" }}>{form.scheduledAt ? formatDateTime12(form.scheduledAt) : "Choose a date and time"}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {inp("Room ID", "roomId", "text", "123456789")}
          {inp("Room Password", "roomPassword", "text", "Pass@123")}
        </div>
        <div>
          <label className="text-xs font-bold text-muted-foreground mb-1 block">Rules</label>
          <textarea value={form.rules} onChange={e => setForm(p => ({ ...p, rules: e.target.value }))}
            placeholder="Tournament rules, tiebreakers, etc." rows={3}
            className="w-full rounded-xl px-3 py-2 text-sm resize-none" style={inputStyle} />
        </div>
        <label className="flex items-center gap-2 cursor-pointer self-start">
          <input type="checkbox" checked={form.timerEnabled} onChange={e => setForm(p => ({ ...p, timerEnabled: e.target.checked }))} className="w-4 h-4 accent-orange-500" />
          <span className="text-sm text-foreground font-semibold">Countdown Timer</span>
        </label>
      </div>

      {divider()}

      {/* ── MATCH FORMAT ───────────────────────────────── */}
      <div className="flex flex-col gap-4">
        {sectionLabel("Match Format")}

        <div>
          <div className="text-sm font-bold text-foreground mb-2">Number of Matches</div>
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
              <button key={n} type="button" onClick={() => setMatchCount(n)}
                className="h-11 rounded-xl font-black text-base transition-smooth active:scale-90"
                style={matchCount === n
                  ? { background: "linear-gradient(135deg, #ff6b35, #ff4500)", color: "#0a0e27" }
                  : { background: "var(--th-card2)", color: "var(--th-muted)" }}>
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="text-sm font-bold text-foreground">Map per Match</div>
          {Array.from({ length: matchCount }, (_, i) => i).map(i => (
            <div key={i} className="rounded-2xl p-3 flex flex-col gap-2" style={{ background: "var(--th-card)", border: "1px solid var(--th-border)" }}>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-black" style={{ background: "rgba(255,107,53,0.15)", color: "#ff6b35" }}>{i + 1}</div>
                <span className="text-xs font-bold text-foreground">Match {i + 1}</span>
                <span className="ml-auto text-xs font-semibold" style={{ color: "var(--th-muted)" }}>
                  {FF_MAPS.find(m => m.name === maps[i])?.emoji ?? "🏝️"} {maps[i]}
                </span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {FF_MAPS.map(map => {
                  const selected = maps[i] === map.name;
                  return (
                    <button key={map.name} type="button"
                      onClick={() => setMaps(prev => { const n = [...prev]; n[i] = map.name; return n; })}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-smooth active:scale-95"
                      style={selected
                        ? { background: `${map.color}22`, color: map.color, border: `1.5px solid ${map.color}55` }
                        : { background: "var(--th-card2)", color: "var(--th-muted)", border: "1px solid var(--th-border2)" }}>
                      {map.emoji} {map.name}
                      {selected && <CheckCircle size={10} style={{ marginLeft: 2 }} />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {divider()}

      {/* ── POINT SYSTEM ───────────────────────────────── */}
      <div className="flex flex-col gap-4">
        {sectionLabel("Point System")}

        <div>
          <div className="text-sm font-bold text-foreground mb-2">Preset</div>
          <div className="grid grid-cols-2 gap-2">
            {([
              { key: "standard",   label: "Standard",   desc: "Kill=1pt · #1=12pts" },
              { key: "aggressive", label: "Aggressive", desc: "Kill=2pt · #1=10pts" },
              { key: "kills",      label: "Kill-Heavy",  desc: "Kill=3pt · #1=6pts"  },
              { key: "custom",     label: "Custom",     desc: "Edit manually below"  },
            ] as const).map(p => (
              <button key={p.key} type="button"
                onClick={() => {
                  setPointPreset(p.key);
                  if (p.key !== "custom") {
                    setKillPoints(PRESETS[p.key].killPoints);
                    setPlacements([...PRESETS[p.key].placements]);
                  }
                }}
                className="rounded-xl p-3 text-left transition-smooth active:scale-95"
                style={pointPreset === p.key
                  ? { background: "rgba(255,107,53,0.12)", border: "1.5px solid rgba(255,107,53,0.5)" }
                  : { background: "var(--th-input)", border: "1px solid var(--th-border2)" }}>
                <div className="text-xs font-black" style={{ color: pointPreset === p.key ? "#ff6b35" : "var(--th-muted)" }}>{p.label}</div>
                <div className="text-[10px] mt-0.5" style={{ color: "var(--th-dim)" }}>{p.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-2xl px-4 py-3" style={{ background: "var(--th-card)", border: "1px solid var(--th-border)" }}>
          <div>
            <div className="text-sm font-bold text-foreground">💀 Kill Points</div>
            <div className="text-[11px] mt-0.5" style={{ color: "var(--th-dim)" }}>Points awarded per kill</div>
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => { setKillPoints(v => Math.max(1, v - 1)); setPointPreset("custom"); }}
              className="w-8 h-8 rounded-xl flex items-center justify-center font-black transition-smooth active:scale-90"
              style={{ background: "var(--th-border)", color: "var(--th-muted)" }}>−</button>
            <span className="w-8 text-center font-black text-foreground text-base">{killPoints}</span>
            <button type="button" onClick={() => { setKillPoints(v => Math.min(10, v + 1)); setPointPreset("custom"); }}
              className="w-8 h-8 rounded-xl flex items-center justify-center font-black transition-smooth active:scale-90"
              style={{ background: "var(--th-border)", color: "var(--th-muted)" }}>+</button>
          </div>
        </div>

        <div>
          <div className="text-sm font-bold text-foreground mb-2">
            Placement Points <span className="text-[11px] font-normal" style={{ color: "var(--th-dim)" }}>(Ranks 1–12 · Rank 13+ = 0)</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {placements.map((pts, i) => (
              <div key={i} className="rounded-xl overflow-hidden" style={{ background: "var(--th-card)", border: "1px solid var(--th-border)" }}>
                <div className="text-[9px] font-black text-center pt-1.5"
                  style={{ color: i === 0 ? "#fbbf24" : i === 1 ? "#9ca3af" : i === 2 ? "#b45309" : "var(--th-dimmer)" }}>
                  #{i + 1}
                </div>
                <input type="number" min={0} max={99} value={pts}
                  onChange={e => {
                    const v = Math.max(0, Math.min(99, parseInt(e.target.value) || 0));
                    setPlacements(prev => { const n = [...prev]; n[i] = v; return n; });
                    setPointPreset("custom");
                  }}
                  className="w-full text-center text-sm font-black pb-1.5 pt-0.5 bg-transparent outline-none"
                  style={{ color: "var(--th-text)" }} />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl px-3 py-2.5 text-xs" style={{ background: "rgba(255,107,53,0.05)", border: "1px solid rgba(255,107,53,0.15)" }}>
          <span className="font-bold" style={{ color: "#ff6b35" }}>Score formula: </span>
          <span style={{ color: "var(--th-muted)" }}>
            (Kills × {killPoints}pt) + Placement pts · Example: 5 kills + #1 = {5 * killPoints + placements[0]}pts
          </span>
        </div>
      </div>

      {divider()}

      {/* ── PRIZE DISTRIBUTION ─────────────────────────── */}
      <div className="flex flex-col gap-4">
        {sectionLabel("Prize Distribution")}

        <div>
          <div className="text-sm font-bold text-foreground mb-2">
            Quick Split {!pool && <span className="text-[11px] font-normal" style={{ color: "var(--th-dim)" }}>(enter Prize Pool first)</span>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {([
              { label: "🥇 Winner All", splits: [1] },
              { label: "60 / 30 / 10",  splits: [0.6, 0.3, 0.1] },
              { label: "50 / 30 / 20",  splits: [0.5, 0.3, 0.2] },
              { label: "Equal 3-way",   splits: [1/3, 1/3, 1/3] },
            ]).map(p => (
              <button key={p.label} type="button" disabled={!pool} onClick={() => autoSplit(p.splits)}
                className="rounded-xl py-2.5 px-3 text-xs font-bold transition-smooth active:scale-95 disabled:opacity-40"
                style={{ background: "var(--th-input)", border: "1px solid var(--th-border2)", color: "var(--th-muted)" }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {prizeRanks.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black flex-shrink-0"
                style={i === 0 ? { background: "rgba(251,191,36,0.18)", color: "#fbbf24" } : i === 1 ? { background: "rgba(156,163,175,0.15)", color: "#9ca3af" } : i === 2 ? { background: "rgba(180,83,9,0.15)", color: "#b45309" } : { background: "var(--th-border)", color: "var(--th-dim)" }}>
                #{r.rank}
              </div>
              <input value={r.label}
                onChange={e => setPrizeRanks(prev => prev.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}
                placeholder={`#${r.rank} label`}
                className="flex-1 h-9 rounded-xl px-2.5 text-xs min-w-0"
                style={{ background: "var(--th-card2)", border: "1px solid var(--th-border2)", color: "var(--th-text)" }} />
              <div className="relative flex-shrink-0">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold" style={{ color: "#fbbf24" }}>₹</span>
                <input type="number" min={0} value={r.amount}
                  onChange={e => setPrizeRanks(prev => prev.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))}
                  placeholder="0"
                  className="w-24 h-9 rounded-xl pl-6 pr-2 text-xs font-bold text-right"
                  style={{ background: "var(--th-card2)", border: "1px solid var(--th-border2)", color: "var(--th-text)" }} />
              </div>
              {prizeRanks.length > 1 && (
                <button type="button"
                  onClick={() => setPrizeRanks(prev => prev.filter((_, j) => j !== i).map((x, j) => ({ ...x, rank: j + 1 })))}
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-smooth hover:bg-red-500/15">
                  <Trash2 size={12} style={{ color: "#ff4500" }} />
                </button>
              )}
            </div>
          ))}
        </div>

        {prizeRanks.length < 10 && (
          <button type="button"
            onClick={() => setPrizeRanks(prev => [...prev, { rank: prev.length + 1, label: `#${prev.length + 1} Place`, amount: "" }])}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl transition-smooth active:scale-95 self-start"
            style={{ background: "var(--th-input)", border: "1px solid var(--th-border2)", color: "var(--th-muted)" }}>
            <Plus size={12} /> Add Rank
          </button>
        )}

        <div className="rounded-xl px-4 py-3 flex items-center justify-between"
          style={{
            background: pool && remaining < 0 ? "rgba(255,69,0,0.08)" : pool && remaining === 0 ? "rgba(34,197,94,0.07)" : "var(--th-card)",
            border: pool && remaining < 0 ? "1px solid rgba(255,69,0,0.3)" : pool && remaining === 0 ? "1px solid rgba(34,197,94,0.3)" : "1px solid var(--th-border)",
          }}>
          <div className="text-xs" style={{ color: "var(--th-muted)" }}>
            Distributed: <span className="font-black text-foreground">₹{totalDistributed.toLocaleString("en-IN")}</span>
            {pool > 0 && <> / ₹{pool.toLocaleString("en-IN")}</>}
          </div>
          {pool > 0 && (
            <div className="text-xs font-bold" style={{ color: remaining < 0 ? "#ff4500" : remaining === 0 ? "#22c55e" : "var(--th-muted)" }}>
              {remaining < 0 ? `₹${Math.abs(remaining).toLocaleString("en-IN")} over` : remaining === 0 ? "✓ Fully split" : `₹${remaining.toLocaleString("en-IN")} left`}
            </div>
          )}
        </div>
      </div>

      {error && <p className="text-xs font-semibold" style={{ color: "#ff4500" }}>{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={update.isPending || uploadingPoster}
        className="w-full h-12 rounded-2xl font-black text-base flex items-center justify-center gap-2 transition-smooth active:scale-95 disabled:opacity-50"
        style={{
          background: saved ? "rgba(34,197,94,0.2)" : "linear-gradient(135deg, #ff6b35, #ff4500)",
          color: saved ? "#22c55e" : "#0a0e27",
          border: saved ? "1px solid rgba(34,197,94,0.4)" : "none",
        }}
        data-testid="edit.submit_button"
      >
        {uploadingPoster
          ? <div className="w-5 h-5 rounded-full border-2 border-current border-t-transparent animate-spin" />
          : update.isPending
          ? <div className="w-5 h-5 rounded-full border-2 border-current border-t-transparent animate-spin" />
          : <Save size={18} />}
        {uploadingPoster ? "Uploading poster..." : update.isPending ? "Saving..." : saved ? "✓ Changes Saved!" : "Save Changes"}
      </button>
    </div>
  );
}
