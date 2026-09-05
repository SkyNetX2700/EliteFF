import { useState, useRef, useEffect } from "react";
import { X, Plus, ImagePlus, CheckCircle, Trash2, AlertCircle, ShieldCheck, CalendarDays, Users, CircleDollarSign } from "lucide-react";
import { useCreateTournament, type Tournament } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatDateTime12 } from "@/lib/dateFormat";
import { apiFetch } from "@/lib/auth";
import QRCode from "qrcode";

interface Props { open: boolean; onClose: () => void; }

const TYPES = ["Battle Royale", "Clash Squad", "Custom"];
const MODES = ["Squad", "Duo", "Solo"];

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

const SETUP_QUOTES = [
  "Every great lobby starts with a host who pays attention to the details.",
  "Set the room. Set the pace. Let the best squad win.",
  "A clear format makes every clutch moment count.",
  "Good hosts create fair games players want to return to.",
  "Build the match you would want to play in.",
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
  if (!response.ok || !body.uploadURL || !body.objectPath) {
    throw new Error(body.message || `Unable to prepare tournament poster upload (${response.status})`);
  }
  const uploadResponse = await fetch(body.uploadURL, {
    method: body.uploadMethod || "PUT",
    headers: { "Content-Type": contentType, ...(body.uploadHeaders || {}) },
    body: file,
  });
  if (!uploadResponse.ok) {
    const uploadError = await uploadResponse.text().catch(() => "");
    throw new Error(uploadError || `Tournament poster upload failed (${uploadResponse.status})`);
  }
  return body.objectPath as string;
}

export default function CreateTournamentModal({ open, onClose }: Props) {
  const qc = useQueryClient();
  const posterRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: "", type: "Battle Royale", mode: "Squad", teamSize: "4",
    entryFee: "", prizePool: "", maxSlots: "12",
    upiId: "", scheduledAt: "", rules: "",
    isPaid: true, timerEnabled: false, isPrivate: false,
  });
  const [posterBase64, setPosterBase64] = useState<string>("");
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
  const [quoteIndex, setQuoteIndex] = useState(0);

  useEffect(() => {
    if (!open) return;
    setQuoteIndex(Math.floor(Math.random() * SETUP_QUOTES.length));
    const interval = window.setInterval(() => {
      setQuoteIndex(index => (index + 1) % SETUP_QUOTES.length);
    }, 7000);
    return () => window.clearInterval(interval);
  }, [open]);

  const setupSteps = [
    Boolean(form.name.trim()),
    Boolean(form.scheduledAt),
    Boolean(matchCount > 0 && maps[0]),
    form.isPaid ? Boolean(form.entryFee && form.upiId.trim()) : true,
  ];
  const completedSteps = setupSteps.filter(Boolean).length;

  const create = useCreateTournament({
    mutation: {
      onSuccess: (data: Tournament) => {
        const tid = data.id;
        if (tid) {
          localStorage.setItem(`eliteff_tournament_config_${tid}`, JSON.stringify({
            matchCount,
            maps: maps.slice(0, matchCount),
          }));
          localStorage.setItem(`eliteff_tournament_points_${tid}`, JSON.stringify({
            killPoints,
            placements,
          }));
          const filledPrizes = prizeRanks.filter(r => Number(r.amount) > 0);
          if (filledPrizes.length > 0) {
            localStorage.setItem(`eliteff_tournament_prizes_${tid}`, JSON.stringify({
              ranks: filledPrizes.map(r => ({ rank: r.rank, label: r.label, amount: Number(r.amount) })),
            }));
          }
        }
        // Update the current player-facing list immediately, then invalidate
        // every matching query so other screens and sessions refetch fresh data.
        qc.setQueriesData({ queryKey: ["getTournaments"] }, (current: unknown) => {
          if (!Array.isArray(current)) return current;
          return [data, ...current.filter((item: any) => item?.id !== data.id)];
        });
        qc.invalidateQueries({ queryKey: ["getTournaments"] });
         reset();
        onClose();
      },
      onError: (e: any) => {
        const message = e?.message || "Unable to create the tournament.";
        setError(
          message.includes("FUNCTION_INVOCATION_FAILED") || message.includes("API server could not be started")
            ? "The tournament service is unavailable. Confirm the deployed API has DATABASE_URL and the Supabase schema, then try again."
            : message,
        );
      },
    },
  });

  function reset() {
    setForm({ name: "", type: "Battle Royale", mode: "Squad", teamSize: "4", entryFee: "", prizePool: "", maxSlots: "12", upiId: "", scheduledAt: "", rules: "", isPaid: true, timerEnabled: false, isPrivate: false });
    setPosterBase64("");
    setPosterFile(null);
    setUploadingPoster(false);
    setMatchCount(3);
    setMaps(Array(10).fill("Bermuda"));
    setPointPreset("standard");
    setKillPoints(1);
    setPlacements([...PRESETS.standard.placements]);
    setPrizeRanks([
      { rank: 1, label: "🏆 Booyah! Winner", amount: "" },
      { rank: 2, label: "🥈 Runner-up",      amount: "" },
      { rank: 3, label: "🥉 Third Place",    amount: "" },
    ]);
    setError("");
  }

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
    if (!form.name.trim() || !form.scheduledAt) { setError("Fill in name and schedule time"); return; }
    const hostUpiId = form.upiId.trim();
    if (form.isPaid && (!form.entryFee || Number(form.entryFee) < 0 || !hostUpiId)) {
      setError("Paid tournaments need an entry fee and the host payment UPI ID");
      return;
    }
    if (form.isPaid && !/^[^@\s]+@[A-Za-z0-9._-]+$/.test(hostUpiId)) {
      setError("Enter a valid host payment UPI ID, such as name@bank");
      return;
    }
    if (form.entryFee && !Number.isInteger(Number(form.entryFee))) {
      setError("Entry fee must be a whole number");
      return;
    }
    if (form.prizePool && !Number.isInteger(Number(form.prizePool))) {
      setError("Prize pool must be a whole number");
      return;
    }
    const maxSlots = Number(form.maxSlots);
    if (!Number.isInteger(maxSlots) || maxSlots < 1) {
      setError("Max teams must be a whole number greater than 0");
      return;
    }
    if (form.entryFee && Number(form.entryFee) < 0) {
      setError("Entry fee cannot be negative");
      return;
    }
    if (form.prizePool && Number(form.prizePool) < 0) {
      setError("Prize pool cannot be negative");
      return;
    }
    const scheduledAt = new Date(form.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      setError("Choose a valid schedule time");
      return;
    }
    setError("");
    setUploadingPoster(Boolean(posterFile));
    try {
      const posterUrl = posterFile ? await uploadTournamentPoster(posterFile) : null;
      const qrUrl = form.isPaid
        ? await QRCode.toDataURL(
            `upi://pay?pa=${encodeURIComponent(hostUpiId)}&pn=EliteFF&am=${Number(form.entryFee)}&tn=${encodeURIComponent(`Entry: ${form.name.trim()}`)}`,
            { width: 320, margin: 2, errorCorrectionLevel: "M", color: { dark: "#0a0e27", light: "#ffffff" } },
          )
        : null;
      create.mutate({
        data: {
          name: form.name.trim(),
          type: form.type,
          mode: form.mode,
          mapName: maps[0] || "Bermuda",
          matchCount,
          maps: maps.slice(0, matchCount),
          killPoints,
          placements,
          prizeDistribution: prizeRanks
            .filter(r => Number(r.amount) > 0)
            .map(r => ({ rank: r.rank, label: r.label, amount: Number(r.amount) })),
          teamSize: form.teamSize,
          entryFee: form.entryFee ? Number(form.entryFee) : null,
          prizePool: form.prizePool ? Number(form.prizePool) : null,
          maxSlots,
          upiId: form.isPaid ? hostUpiId : null,
          qrUrl,
          scheduledAt: scheduledAt.toISOString(),
          rules: form.rules || null,
          posterUrl,
          isPaid: form.isPaid,
          timerEnabled: form.timerEnabled,
          isPrivate: form.isPrivate,
        },
      });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Unable to upload tournament poster");
    } finally {
      setUploadingPoster(false);
    }
  }

  const inp = (label: string, key: keyof typeof form, type = "text", ph = "") => (
    <div key={key}>
      <label className="text-xs font-bold text-muted-foreground mb-1 block">{label}</label>
      <input
        type={type}
        placeholder={ph || label}
        value={String(form[key])}
        onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
        className="w-full h-10 rounded-xl px-3 text-sm"
        style={{ background: "var(--th-card2)", border: "1px solid var(--th-border2)", color: "var(--th-text)" }}
      />
    </div>
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center" style={{ background: "rgba(2,6,23,0.86)", backdropFilter: "blur(8px)" }}>
        <div
         className="w-full max-w-lg rounded-t-[2rem] flex flex-col animate-in slide-in-from-bottom duration-300 overflow-hidden"
         style={{ background: "linear-gradient(180deg, rgba(15,23,42,0.99) 0%, var(--th-card3) 220px)", border: "1px solid rgba(255,107,53,0.22)", maxHeight: "96dvh", overflowY: "auto", boxShadow: "0 -18px 60px rgba(0,0,0,0.42)" }}
      >
        {/* Header */}
         <div className="px-5 pt-4 pb-4 sticky top-0 z-10" style={{ background: "rgba(15,23,42,0.96)", borderBottom: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(14px)" }}>
           <div className="flex items-start gap-3">
             <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg, rgba(255,107,53,0.2), rgba(34,197,94,0.16))", border: "1px solid rgba(255,255,255,0.12)" }}>
               <TrophyMark />
             </div>
             <div className="flex-1 min-w-0">
               <div className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: "#fb923c" }}>Host console</div>
               <div className="font-display font-black text-xl text-foreground leading-tight">Build your tournament</div>
               <div className="text-[11px] mt-0.5" style={{ color: "var(--th-muted)" }}>A clean room setup players can trust</div>
             </div>
             <div className="flex items-center gap-2">
               <div className="hidden sm:flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black" style={{ color: "#4ade80", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)" }}>
                 <ShieldCheck size={12} /> Draft
               </div>
               <button aria-label="Close create tournament" onClick={() => { reset(); onClose(); }} className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-white/10 transition-smooth">
                 <X size={16} className="text-muted-foreground" />
               </button>
             </div>
          </div>
           <div className="grid grid-cols-4 gap-1.5 mt-4">
             {[
               { label: "Basics", icon: Users },
               { label: "Schedule", icon: CalendarDays },
               { label: "Matches", icon: ShieldCheck },
               { label: "Entry", icon: CircleDollarSign },
             ].map((step, index) => {
               const Icon = step.icon;
               const complete = setupSteps[index];
               return (
                 <div key={step.label} className="rounded-xl px-2 py-2" style={{ background: complete ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.04)", border: `1px solid ${complete ? "rgba(34,197,94,0.25)" : "rgba(255,255,255,0.06)"}` }}>
                   <div className="flex items-center gap-1.5">
                     <Icon size={11} style={{ color: complete ? "#4ade80" : "var(--th-dim)" }} />
                     <span className="text-[9px] font-black truncate" style={{ color: complete ? "#86efac" : "var(--th-muted)" }}>{step.label}</span>
                   </div>
                 </div>
               );
             })}
          </div>
           <div className="flex items-center gap-2 mt-3">
             <div className="h-1.5 flex-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
               <div className="h-full rounded-full transition-all duration-300" style={{ width: `${(completedSteps / setupSteps.length) * 100}%`, background: "linear-gradient(90deg, #ff6b35, #4ade80)" }} />
             </div>
             <span className="text-[10px] font-bold whitespace-nowrap" style={{ color: "var(--th-muted)" }}>{completedSteps}/{setupSteps.length} ready</span>
           </div>
        </div>

         <div className="p-4 sm:p-5 flex flex-col gap-5">
           <div className="rounded-2xl p-4 flex items-center gap-3 transition-all duration-500" style={{ background: "linear-gradient(135deg, rgba(34,197,94,0.12), rgba(34,197,94,0.03))", border: "1px solid rgba(34,197,94,0.2)" }}>
            <div className="flex-1">
               <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: "#4ade80" }}>Host note</div>
               <div className="text-sm font-black text-foreground mt-1 leading-snug" aria-live="polite">{SETUP_QUOTES[quoteIndex]}</div>
               <div className="text-xs mt-1" style={{ color: "var(--th-muted)" }}>Add the essentials first, then fine-tune matches, scoring, and prizes.</div>
            </div>
            <div className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-lg flex-shrink-0" style={{ background: "rgba(34,197,94,0.16)", color: "#4ade80" }}>Host setup</div>
          </div>

          {/* ── POSTER ─────────────────────────────────────── */}
          <div>
            <label className="text-xs font-bold text-muted-foreground mb-2 block uppercase tracking-widest">Tournament Poster</label>
            <input ref={posterRef} type="file" accept="image/*" className="hidden" onChange={handlePosterPick} />
            <button
              onClick={() => posterRef.current?.click()}
              className="w-full rounded-2xl overflow-hidden flex items-center justify-center transition-smooth active:scale-98 relative"
              style={{
                height: posterBase64 ? 160 : 110,
                background: posterBase64 ? "transparent" : "var(--th-card)",
                border: `2px dashed ${posterBase64 ? "transparent" : "var(--th-border2)"}`,
              }}
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
                  <span className="text-[10px]" style={{ color: "var(--th-dimmer)" }}>JPG, PNG · auto-compressed</span>
                </div>
              )}
            </button>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: "var(--th-card2)" }} />

          {/* ── BASIC INFO ─────────────────────────────────── */}
          <div className="flex flex-col gap-3">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Basic Info</label>
            {inp("Tournament Name *", "name", "text", "e.g. Elite FF Season 1")}

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

            {/* Max Teams + Schedule */}
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

            {/* Public / Private toggle */}
            <div className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: "var(--th-input)", border: "1px solid var(--th-border2)" }}>
              <div>
                <div className="text-sm font-bold text-foreground">Visibility</div>
                <div className="text-[11px] mt-0.5" style={{ color: "var(--th-dim)" }}>{form.isPrivate ? "Invite-only tournament" : "Open to all players"}</div>
              </div>
              <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid var(--th-border2)" }}>
                <button type="button" onClick={() => setForm(p => ({ ...p, isPrivate: false }))}
                  className="px-3 py-1.5 text-xs font-black transition-smooth"
                  style={!form.isPrivate ? { background: "linear-gradient(135deg,#ff6b35,#ff4500)", color: "#fff" } : { background: "var(--th-card2)", color: "var(--th-dim)" }}>
                  Public
                </button>
                <button type="button" onClick={() => setForm(p => ({ ...p, isPrivate: true }))}
                  className="px-3 py-1.5 text-xs font-black transition-smooth"
                  style={form.isPrivate ? { background: "linear-gradient(135deg,#fbbf24,#f59e0b)", color: "#0a0e27" } : { background: "var(--th-card2)", color: "var(--th-dim)" }}>
                  Private
                </button>
              </div>
            </div>

            {/* Entry fee + UPI — paid only */}
            {form.isPaid && (
              <div className="flex flex-col gap-3 rounded-xl p-3" style={{ background: "rgba(255,107,53,0.05)", border: "1px solid rgba(255,107,53,0.15)" }}>
                <div className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,107,53,0.7)" }}>Paid Entry Details</div>
                {inp("Entry Fee (₹) *", "entryFee", "number", "e.g. 50")}
                <div>
                  {inp("Host payment UPI ID *", "upiId", "text", "yourname@bank")}
                  <p className="text-[11px] mt-1.5 leading-relaxed" style={{ color: "var(--th-dim)" }}>
                    Used only to generate the player payment QR. This identifier stays in host settings and is not shown to players.
                  </p>
                </div>
              </div>
            )}

            {inp("Scheduled At *", "scheduledAt", "datetime-local")}
            <div className="rounded-xl px-3 py-2.5 flex items-center justify-between" style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.16)" }}>
              <span className="text-[11px] font-bold" style={{ color: "var(--th-muted)" }}>Players will see</span>
              <span className="text-xs font-black" style={{ color: "#4ade80" }}>{form.scheduledAt ? formatDateTime12(form.scheduledAt) : "Choose a date and time"}</span>
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: "var(--th-card2)" }} />

          {/* ── MATCH FORMAT ───────────────────────────────── */}
          <div className="flex flex-col gap-4">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Match Format</label>

            <div>
              <div className="text-sm font-bold text-foreground mb-2">Number of Matches</div>
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setMatchCount(n)}
                    className="h-11 rounded-xl font-black text-base transition-smooth active:scale-90"
                    style={matchCount === n
                      ? { background: "linear-gradient(135deg, #ff6b35, #ff4500)", color: "#0a0e27" }
                      : { background: "var(--th-card2)", color: "var(--th-muted)" }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="text-sm font-bold text-foreground">Map per Match</div>
              <p className="text-xs" style={{ color: "var(--th-dim)" }}>Pick the map that will be played in each match.</p>
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
                        <button
                          key={map.name}
                          type="button"
                          onClick={() => setMaps(prev => { const n = [...prev]; n[i] = map.name; return n; })}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-smooth active:scale-95"
                          style={selected
                            ? { background: `${map.color}22`, color: map.color, border: `1.5px solid ${map.color}55` }
                            : { background: "var(--th-card2)", color: "var(--th-muted)", border: "1px solid var(--th-border2)" }}
                        >
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

          {/* Divider */}
          <div style={{ height: 1, background: "var(--th-card2)" }} />

          {/* ── POINT SYSTEM ───────────────────────────────── */}
          <div className="flex flex-col gap-4">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Point System</label>

            {/* Presets */}
            <div>
              <div className="text-sm font-bold text-foreground mb-2">Preset</div>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { key: "standard",   label: "Standard",   desc: "Kill=1pt · #1=12pts" },
                  { key: "aggressive", label: "Aggressive", desc: "Kill=2pt · #1=10pts" },
                  { key: "kills",      label: "Kill-Heavy",  desc: "Kill=3pt · #1=6pts"  },
                  { key: "custom",     label: "Custom",     desc: "Edit manually below"  },
                ] as const).map(p => (
                  <button
                    key={p.key}
                    type="button"
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
                      : { background: "var(--th-input)", border: "1px solid var(--th-border2)" }}
                  >
                    <div className="text-xs font-black" style={{ color: pointPreset === p.key ? "#ff6b35" : "var(--th-muted)" }}>{p.label}</div>
                    <div className="text-[10px] mt-0.5" style={{ color: "var(--th-dim)" }}>{p.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Kill Points */}
            <div className="flex items-center justify-between rounded-2xl px-4 py-3" style={{ background: "var(--th-card)", border: "1px solid var(--th-border)" }}>
              <div>
                <div className="text-sm font-bold text-foreground flex items-center gap-1.5">💀 Kill Points</div>
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

            {/* Placement Points Grid */}
            <div>
              <div className="text-sm font-bold text-foreground mb-2">Placement Points <span className="text-[11px] font-normal" style={{ color: "var(--th-dim)" }}>(Ranks 1–12 · Rank 13+ = 0)</span></div>
              <div className="grid grid-cols-4 gap-1.5">
                {placements.map((pts, i) => (
                  <div key={i} className="rounded-xl overflow-hidden" style={{ background: "var(--th-card)", border: "1px solid var(--th-border)" }}>
                    <div className="text-[9px] font-black text-center pt-1.5" style={{ color: i === 0 ? "#fbbf24" : i === 1 ? "#9ca3af" : i === 2 ? "#b45309" : "var(--th-dimmer)" }}>
                      #{i + 1}
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={99}
                      value={pts}
                      onChange={e => {
                        const v = Math.max(0, Math.min(99, parseInt(e.target.value) || 0));
                        setPlacements(prev => { const n = [...prev]; n[i] = v; return n; });
                        setPointPreset("custom");
                      }}
                      className="w-full text-center text-sm font-black pb-1.5 pt-0.5 bg-transparent outline-none"
                      style={{ color: "var(--th-text)" }}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div className="rounded-xl px-3 py-2.5 text-xs" style={{ background: "rgba(255,107,53,0.05)", border: "1px solid rgba(255,107,53,0.15)" }}>
              <span className="font-bold" style={{ color: "#ff6b35" }}>Score formula: </span>
              <span style={{ color: "var(--th-muted)" }}>
                (Kills × {killPoints}pt) + Placement pts · Example: 5 kills + #1 = {5 * killPoints + placements[0]}pts
              </span>
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: "var(--th-card2)" }} />

          {/* ── PRIZE DISTRIBUTION ─────────────────────────── */}
          {(() => {
            const pool = Number(form.prizePool) || 0;
            const totalDistributed = prizeRanks.reduce((s, r) => s + (Number(r.amount) || 0), 0);
            const remaining = pool - totalDistributed;

            function autoSplit(splits: number[]) {
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
                  ...r,
                  amount: String(Math.floor(pool * splits[i])),
                }));
              });
            }

            return (
              <div className="flex flex-col gap-4">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Prize Distribution</label>

                {/* Quick-split presets */}
                <div>
                  <div className="text-sm font-bold text-foreground mb-2">Quick Split {!pool && <span className="text-[11px] font-normal" style={{ color: "var(--th-dim)" }}>(enter Prize Pool first)</span>}</div>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { label: "🥇 Winner All",  splits: [1] },
                      { label: "60 / 30 / 10",   splits: [0.6, 0.3, 0.1] },
                      { label: "50 / 30 / 20",   splits: [0.5, 0.3, 0.2] },
                      { label: "Equal 3-way",    splits: [1/3, 1/3, 1/3] },
                    ]).map(p => (
                      <button
                        key={p.label}
                        type="button"
                        disabled={!pool}
                        onClick={() => autoSplit(p.splits)}
                        className="rounded-xl py-2.5 px-3 text-xs font-bold transition-smooth active:scale-95 disabled:opacity-40"
                        style={{ background: "var(--th-input)", border: "1px solid var(--th-border2)", color: "var(--th-muted)" }}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Per-rank rows */}
                <div className="flex flex-col gap-2">
                  {prizeRanks.map((r, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black flex-shrink-0"
                        style={i === 0 ? { background: "rgba(251,191,36,0.18)", color: "#fbbf24" } : i === 1 ? { background: "rgba(156,163,175,0.15)", color: "#9ca3af" } : i === 2 ? { background: "rgba(180,83,9,0.15)", color: "#b45309" } : { background: "var(--th-border)", color: "var(--th-dim)" }}
                      >#{r.rank}</div>
                      <input
                        value={r.label}
                        onChange={e => setPrizeRanks(prev => prev.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}
                        placeholder={`#${r.rank} label`}
                        className="flex-1 h-9 rounded-xl px-2.5 text-xs min-w-0"
                        style={{ background: "var(--th-card2)", border: "1px solid var(--th-border2)", color: "var(--th-text)" }}
                      />
                      <div className="relative flex-shrink-0">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold" style={{ color: "#fbbf24" }}>₹</span>
                        <input
                          type="number"
                          min={0}
                          value={r.amount}
                          onChange={e => setPrizeRanks(prev => prev.map((x, j) => j === i ? { ...x, amount: e.target.value } : x))}
                          placeholder="0"
                          className="w-24 h-9 rounded-xl pl-6 pr-2 text-xs font-bold text-right"
                          style={{ background: "var(--th-card2)", border: "1px solid var(--th-border2)", color: "var(--th-text)" }}
                        />
                      </div>
                      {prizeRanks.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setPrizeRanks(prev => prev.filter((_, j) => j !== i).map((x, j) => ({ ...x, rank: j + 1 })))}
                          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-smooth hover:bg-red-500/15"
                        >
                          <Trash2 size={12} style={{ color: "#ff4500" }} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Add rank */}
                {prizeRanks.length < 10 && (
                  <button
                    type="button"
                    onClick={() => setPrizeRanks(prev => [...prev, { rank: prev.length + 1, label: `#${prev.length + 1} Place`, amount: "" }])}
                    className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl transition-smooth active:scale-95 self-start"
                    style={{ background: "var(--th-input)", border: "1px solid var(--th-border2)", color: "var(--th-muted)" }}
                  >
                    <Plus size={12} /> Add Rank
                  </button>
                )}

                {/* Total tracker */}
                <div
                  className="rounded-xl px-4 py-3 flex items-center justify-between"
                  style={{
                    background: pool && remaining < 0 ? "rgba(255,69,0,0.08)" : pool && remaining === 0 ? "rgba(34,197,94,0.07)" : "var(--th-card)",
                    border: pool && remaining < 0 ? "1px solid rgba(255,69,0,0.3)" : pool && remaining === 0 ? "1px solid rgba(34,197,94,0.3)" : "1px solid var(--th-border)",
                  }}
                >
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
            );
          })()}

          {/* Divider */}
          <div style={{ height: 1, background: "var(--th-card2)" }} />

          {/* ── RULES & SETTINGS ───────────────────────────── */}
          <div className="flex flex-col gap-3">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Rules & Settings</label>
            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1 block">Rules (optional)</label>
              <textarea value={form.rules} onChange={e => setForm(p => ({ ...p, rules: e.target.value }))}
                placeholder="Tournament rules, point system, tiebreaker, etc." rows={3}
                className="w-full rounded-xl px-3 py-2 text-sm resize-none"
                style={{ background: "var(--th-card2)", border: "1px solid var(--th-border2)", color: "var(--th-text)" }}
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer self-start">
              <input type="checkbox" checked={form.timerEnabled} onChange={e => setForm(p => ({ ...p, timerEnabled: e.target.checked }))} className="w-4 h-4 accent-orange-500" />
              <span className="text-sm text-foreground font-semibold">Countdown Timer</span>
            </label>
          </div>

           {error && (
             <div
               role="alert"
               className="rounded-2xl px-3.5 py-3 flex items-start gap-2.5"
               style={{ background: "rgba(255,69,0,0.10)", border: "1px solid rgba(255,69,0,0.28)" }}
             >
               <AlertCircle size={16} className="flex-shrink-0 mt-0.5" style={{ color: "#ff6b35" }} />
               <p className="text-xs font-semibold leading-relaxed" style={{ color: "#ff8a65" }}>{error}</p>
             </div>
           )}

          <div className="sticky bottom-0 -mx-5 -mb-5 p-5 pt-3" style={{ background: "linear-gradient(to bottom, transparent, var(--th-card3) 22%)" }}>
            <button
              onClick={handleSubmit}
               disabled={create.isPending || uploadingPoster}
              className="w-full h-13 rounded-2xl font-black text-base flex items-center justify-center gap-2 transition-smooth active:scale-95 disabled:opacity-50 shadow-lg"
              style={{ background: "linear-gradient(135deg, #4ade80, #16a34a)", color: "#052e16", boxShadow: "0 10px 28px rgba(34,197,94,0.22)" }}
              data-testid="create-tournament.submit_button"
            >
               {create.isPending || uploadingPoster ? <div className="w-5 h-5 rounded-full border-2 border-current border-t-transparent animate-spin" /> : <Plus size={18} />}
               {uploadingPoster ? "Uploading poster..." : create.isPending ? "Creating..." : "Create Tournament"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TrophyMark() {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="#4ade80" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3" />
    </svg>
  );
}
