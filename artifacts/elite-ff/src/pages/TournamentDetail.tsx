import { useState, useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import {
  ArrowLeft, Trophy, Users, Clock, Shield, Key, Copy, QrCode, Download,
  CheckCircle, XCircle, Pencil, Trash2, AlertTriangle, RotateCcw,
  Upload, Camera, ChartNoAxesColumn, RefreshCw, Swords, Megaphone,
  Radio, CalendarClock, Ban, MessageSquarePlus, CreditCard, Share2
} from "lucide-react";
import {
  useGetTournament,
  useDeleteTournament,
  useUpdateTournament,
  useCancelTournament,
  useDelayTournament,
  useGetRegistrations,
  useCreateRegistration,
  useVerifyRegistration,
  useDeclineRegistration,
  useGetScoreboard,
} from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAppContext } from "@/contexts/AppContext";
import { apiFetch } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { formatDateTime12, formatTime12 } from "@/lib/dateFormat";
import QRCode from "qrcode";

async function uploadPaymentScreenshot(file: File) {
  const contentType = file.type || "image/jpeg";
  if (!contentType.startsWith("image/")) {
    throw new Error("Choose an image file for the payment screenshot");
  }
  if (file.size <= 0 || file.size > 10 * 1024 * 1024) {
    throw new Error("Payment screenshot must be between 1 byte and 10MB");
  }

  const response = await apiFetch("/api/storage/uploads/request-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name || "payment-screenshot.jpg", size: file.size, contentType }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.uploadURL || !body.objectPath) {
    throw new Error(body.message || `Unable to prepare payment screenshot upload (${response.status})`);
  }
  const uploadResponse = await fetch(body.uploadURL, {
    method: body.uploadMethod || "PUT",
    headers: { "Content-Type": contentType, ...(body.uploadHeaders || {}) },
    body: file,
  });
  if (!uploadResponse.ok) {
    const uploadError = await uploadResponse.text().catch(() => "");
    throw new Error(uploadError || `Payment screenshot upload failed (${uploadResponse.status})`);
  }
  return body.objectPath as string;
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; color: string; label: string }> = {
    live:      { bg: "rgba(34,197,94,0.15)",  color: "#4ade80",  label: "🔴 Live" },
    upcoming:  { bg: "rgba(255,107,53,0.15)", color: "#ff6b35",  label: "Upcoming" },
    completed: { bg: "rgba(255,255,255,0.08)", color: "var(--th-muted)", label: "Completed" },
    cancelled: { bg: "rgba(255,69,0,0.12)",   color: "#ff4500",  label: "Cancelled" },
    delayed:   { bg: "rgba(251,191,36,0.15)", color: "#fbbf24",  label: "Delayed" },
  };
  const c = cfg[status] ?? cfg.upcoming;
  return (
    <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: c.bg, color: c.color }}>
      {c.label}
    </span>
  );
}

function Countdown({ scheduledAt, onExpire, variant = "normal" }: {
  scheduledAt: string;
  onExpire?: () => void;
  variant?: "normal" | "delayed";
}) {
  const [, setTick] = useState(0);
  const firedRef = useRef(false);

  useEffect(() => {
    const id = setInterval(() => {
      setTick(t => t + 1);
      const remaining = new Date(scheduledAt).getTime() - Date.now();
      if (remaining <= 0 && !firedRef.current && onExpire) {
        firedRef.current = true;
        onExpire();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [scheduledAt, onExpire]);

  const diff = new Date(scheduledAt).getTime() - Date.now();
  if (diff <= 0) return null;

  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);

  const accent = variant === "delayed" ? "#fbbf24" : "#ff6b35";
  const bg = variant === "delayed" ? "rgba(251,191,36,0.08)" : "rgba(255,107,53,0.08)";
  const border = variant === "delayed" ? "1px solid rgba(251,191,36,0.25)" : "1px solid rgba(255,107,53,0.2)";
  const label = variant === "delayed" ? "⏳ Delayed — New Start In" : "Starts In";

  return (
    <div className="rounded-2xl p-4 text-center" style={{ background: bg, border }}>
      <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: accent }}>{label}</div>
      <div className="font-display font-black text-2xl text-foreground">
        {days > 0 && `${days}d `}{String(hours).padStart(2, "0")}:{String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
      </div>
      {variant !== "delayed" && (
        <div className="text-xs mt-1" style={{ color: "var(--th-muted)" }}>Closing in {days > 0 ? `${days}d ` : ""}{String(hours).padStart(2, "0")}:{String(mins).padStart(2, "0")}</div>
      )}
    </div>
  );
}

function UPIQRCode({ upiId, amount, tournamentName, prizePool }: { upiId: string; amount: number; tournamentName: string; prizePool?: number | null }) {
  const upiLink = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=EliteFF&am=${amount}&tn=${encodeURIComponent(`Entry: ${tournamentName}`)}`;
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrError, setQrError] = useState("");
  const [shared, setShared] = useState(false);

  useEffect(() => {
    let active = true;
    setQrDataUrl("");
    setQrError("");
    QRCode.toDataURL(upiLink, {
      width: 320,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#0a0e27", light: "#ffffff" },
    }).then(dataUrl => {
      if (active) setQrDataUrl(dataUrl);
    }).catch(() => {
      if (active) setQrError("Unable to generate the payment QR code.");
    });
    return () => { active = false; };
  }, [upiLink]);

  function copy(text: string) {
    navigator.clipboard.writeText(text).catch(() => {});
  }

  function downloadQr() {
    if (!qrDataUrl) return;
    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `${tournamentName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "elite-ff"}-upi-qr.png`;
    link.click();
  }

  async function shareQr() {
    if (!qrDataUrl) return;
    const shareText = `Pay ₹${amount.toLocaleString("en-IN")} entry fee for ${tournamentName}.`;
    try {
      const response = await fetch(qrDataUrl);
      const blob = await response.blob();
      const file = new File([blob], "elite-ff-upi-qr.png", { type: "image/png" });
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({ title: `${tournamentName} payment QR`, text: shareText, files: [file] });
      } else if (navigator.share) {
        await navigator.share({ title: `${tournamentName} payment details`, text: shareText });
      } else {
        await navigator.clipboard.writeText(shareText);
      }
      setShared(true);
      window.setTimeout(() => setShared(false), 2000);
    } catch {
      // Sharing can be cancelled by the user; it should not interrupt registration.
    }
  }

  return (
    <div className="rounded-2xl p-5 flex flex-col items-center gap-4" style={{ background: "var(--th-card)", border: "1px solid var(--th-border)" }}>
      <div className="flex items-center gap-2">
        <QrCode size={16} style={{ color: "#ff6b35" }} />
        <span className="font-display font-bold text-sm text-foreground">Scan to Pay Entry Fee</span>
      </div>
      <div className="rounded-2xl overflow-hidden p-2" style={{ background: "white" }}>
        {qrDataUrl ? (
          <img src={qrDataUrl} alt={`UPI payment QR for ₹${amount}`} className="w-40 h-40" />
        ) : (
          <div className="w-40 h-40 flex items-center justify-center text-center text-xs text-slate-500">
            {qrError || "Generating QR…"}
          </div>
        )}
      </div>
      <p className="text-xs text-center" style={{ color: "var(--th-muted)" }}>
        Scan with PhonePe, GPay, Paytm, or any UPI app to pay exactly ₹{amount.toLocaleString("en-IN")}
      </p>
      {prizePool && prizePool > 0 && (
        <p className="text-xs text-center font-bold" style={{ color: "#fbbf24" }}>
          Prize Pool: ₹{prizePool.toLocaleString("en-IN")}
        </p>
      )}
      <button
        onClick={() => copy(`Pay ₹${amount.toLocaleString("en-IN")} entry fee for ${tournamentName}`)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-smooth active:scale-95"
        style={{ background: "rgba(255,107,53,0.12)", color: "#ff6b35", border: "1px solid rgba(255,107,53,0.2)" }}
      >
        <Copy size={12} /> Copy payment details
      </button>
      <div className="flex w-full gap-2">
        <button
          onClick={downloadQr}
          disabled={!qrDataUrl}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-smooth active:scale-95 disabled:opacity-50"
          style={{ background: "var(--th-card2)", color: "var(--th-text)", border: "1px solid var(--th-border2)" }}
        >
          <Download size={13} /> Download QR
        </button>
        <button
          onClick={shareQr}
          disabled={!qrDataUrl}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-smooth active:scale-95 disabled:opacity-50"
          style={{ background: "rgba(34,197,94,0.12)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.2)" }}
        >
          <Share2 size={13} /> {shared ? "Copied" : "Share QR"}
        </button>
      </div>
    </div>
  );
}

function RefundCountdown({ tournamentId }: { tournamentId: number }) {
  const [seconds, setSeconds] = useState(300);
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    const key = `eliteff_refund_timer_${tournamentId}`;
    const stored = localStorage.getItem(key);
    let end = stored ? parseInt(stored) : Date.now() + 300000;
    if (!stored) localStorage.setItem(key, String(end));
    const id = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setSeconds(remaining);
      if (remaining <= 0) { setExpired(true); clearInterval(id); }
    }, 1000);
    return () => clearInterval(id);
  }, [tournamentId]);
  if (expired) return (
    <div className="rounded-xl p-3 text-center" style={{ background: "rgba(255,69,0,0.06)", border: "1px solid rgba(255,69,0,0.15)" }}>
      <p className="text-xs font-bold" style={{ color: "#ff4500" }}>Refund window closed</p>
    </div>
  );
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return (
    <div className="rounded-xl p-3 text-center" style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)" }}>
      <p className="text-xs font-bold" style={{ color: "#fbbf24" }}>
        <Clock size={12} className="inline mr-1" />
        5-min refund window: {m}:{s.toString().padStart(2, "0")}
      </p>
    </div>
  );
}

type MainTab = "info" | "scoreboard" | "room";

export default function TournamentDetail() {
  const [, params] = useRoute("/tournaments/:id");
  const [, navigate] = useLocation();
  const id = parseInt(params?.id || "0");
  const { user } = useAuth();
  const { addAlert } = useAppContext();
  const qc = useQueryClient();
  const isHost = user?.role === "host";

  const [tab, setTab] = useState<MainTab>("info");
  const [regOpen, setRegOpen] = useState(false);
  const [delayOpen, setDelayOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState<{ id: number } | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [newDelayDate, setNewDelayDate] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastType, setBroadcastType] = useState<"roomIdReleased" | "tournamentDelayed" | "tournamentCancelled" | "matchCompleted" | "custom">("roomIdReleased");
  const [bcRoomId, setBcRoomId] = useState("");
  const [bcRoomPass, setBcRoomPass] = useState("");
  const [bcDelayTime, setBcDelayTime] = useState("");
  const [bcReason, setBcReason] = useState("");
  const [bcTitle, setBcTitle] = useState("");
  const [bcMessage, setBcMessage] = useState("");
  const [bcSent, setBcSent] = useState(false);
  const [broadcastError, setBroadcastError] = useState("");
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [registrationActionError, setRegistrationActionError] = useState("");
  const [shareCopied, setShareCopied] = useState(false);

  // Registration form state
  const [teamName, setTeamName] = useState("");
  const [ignNames, setIgnNames] = useState<string[]>([""]);
  const [utr, setUtr] = useState("");
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState("");
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false);
  const [regError, setRegError] = useState("");
  const [regSuccess, setRegSuccess] = useState(false);
  const [playerRegStatus, setPlayerRegStatus] = useState<{ status: string; slotNumber: number | null; squadName: string; declineReason?: string } | null>(null);
  const [previewImg, setPreviewImg] = useState<string | null>(null);

  const { data: tournament, isLoading } = useGetTournament(id, { query: { queryKey: ["getTournament", id, refreshKey] } as any });
  useEffect(() => {
    if (tournament?.name && id) {
      try { localStorage.setItem(`eliteff_tournament_name_${id}`, tournament.name); } catch {}
    }
  }, [tournament?.name, id]);
  const { data: registrations = [] } = useGetRegistrations(
    { tournamentId: id },
    { query: { enabled: Boolean(user), queryKey: ["getRegistrations", id, refreshKey], refetchInterval: user ? 5000 : false } as any },
  );
  const { data: scoreboard = [], dataUpdatedAt: sbUpdatedAt } = useGetScoreboard(id, {
    query: { queryKey: ["getScoreboard", id, refreshKey], refetchInterval: tournament?.status === "live" ? 15000 : false } as any,
  });

  const verifyReg = useVerifyRegistration({
    mutation: {
      onSuccess: (data: any) => {
        setRegistrationActionError("");
        qc.invalidateQueries({ queryKey: ["getRegistrations", id] });
        // Notify the player via localStorage so they see it when they open their account
        const playerKey = `eliteff_player_notif_${(data.squadName || "").toLowerCase().trim()}`;
        const existing = JSON.parse(localStorage.getItem(playerKey) || "[]");
        existing.unshift({
          type: "verified",
          slot: data.slotNumber,
          tournamentId: data.tournamentId,
          tournamentName: tournament?.name || `Tournament #${data.tournamentId}`,
          squadName: data.squadName,
          timestamp: Date.now(),
          read: false,
        });
        localStorage.setItem(playerKey, JSON.stringify(existing));
        addAlert({
          type: "verified",
          title: "Player Approved",
          message: `${data.squadName} verified — Slot #${data.slotNumber} assigned`,
          tournamentId: data.tournamentId,
        });
      },
      onError: (error: any) => setRegistrationActionError(error?.message || "Approval failed. Refresh and try again."),
    },
  });
  const declineReg = useDeclineRegistration({
    mutation: {
      onSuccess: (data: any) => {
        setRegistrationActionError("");
        qc.invalidateQueries({ queryKey: ["getRegistrations", id] });
        setDeclineOpen(null);
        setDeclineReason("");
        addAlert({
          type: "declined",
          title: "Registration Declined",
          message: `${data.squadName || "Player"} was declined${data.declineReason ? ": " + data.declineReason : ""}`,
          tournamentId: data.tournamentId,
        });
      },
      onError: (error: any) => setRegistrationActionError(error?.message || "Decline failed. Refresh and try again."),
    },
  });
  const deleteTournament = useDeleteTournament({
    mutation: {
      onSuccess: () => {
        for (const key of [
          `eliteff_tournament_poster_${id}`,
          `eliteff_tournament_config_${id}`,
          `eliteff_tournament_points_${id}`,
          `eliteff_tournament_prizes_${id}`,
        ]) localStorage.removeItem(key);
        qc.invalidateQueries({ queryKey: ["getTournaments"] });
        navigate("/tournaments");
      },
      onError: (error: any) => setRegistrationActionError(error?.message || "Delete failed. Refresh and try again."),
    },
  });
  const updateTournament = useUpdateTournament({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: ["getTournament", id] }); setDelayOpen(false); setDeleteOpen(false); } } });
  const cancelTournament = useCancelTournament({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: ["getTournament", id] }); } } });
  const delayTournament = useDelayTournament({ mutation: { onSuccess: () => { qc.invalidateQueries({ queryKey: ["getTournament", id] }); setDelayOpen(false); } } });
  const createReg = useCreateRegistration({
    mutation: {
      onSuccess: (data: any) => {
        setRegSuccess(true);
        setRegOpen(false);
        setRegError("");
        setPlayerRegStatus({
          status: data?.status || "pending",
          slotNumber: data?.slotNumber ?? null,
          squadName: data?.squadName || teamName.trim(),
          declineReason: data?.declineReason,
        });
        // Track tournament IDs for quick lookup
        const key = `eliteff_my_tournaments_${user?.username}`;
        const existing = JSON.parse(localStorage.getItem(key) || "[]");
        if (!existing.includes(id)) { existing.push(id); localStorage.setItem(key, JSON.stringify(existing)); }
        // Store full registration details for "My Registered" tab
        const regsKey = `eliteff_my_regs_${user?.username}`;
        const existingRegs = JSON.parse(localStorage.getItem(regsKey) || "[]");
        const already = existingRegs.findIndex((r: any) => r.regId === data.id);
        const regEntry = {
          regId: data.id,
          tournamentId: id,
          tournamentName: tournament?.name || `Tournament #${id}`,
          squadName: data?.squadName || teamName.trim(),
          playerNames: data?.playerNames || `${teamName.trim()} | ${ignNames.join(", ")}`,
          utrNumber: data?.utrNumber || utr.trim() || "-",
          paymentScreenshotUrl: data?.paymentScreenshotUrl || null,
          status: data?.status || "pending",
          slotNumber: data?.slotNumber ?? null,
          approvedAt: data?.approvedAt || null,
          timestamp: Date.now(),
        };
        if (already >= 0) { existingRegs[already] = regEntry; } else { existingRegs.unshift(regEntry); }
        localStorage.setItem(regsKey, JSON.stringify(existingRegs));
        addAlert({ type: "verificationPending", title: "Verification Pending", message: `Your registration for "${tournament?.name}" is awaiting host review.`, tournamentId: id });
        qc.invalidateQueries({ queryKey: ["getRegistrations", id] });
        qc.invalidateQueries({ queryKey: ["getTournament", id] });
      },
      onError: (e: any) => setRegError(e.message || "Submission failed. Please try again."),
    },
  });

  function handleScreenshot(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setRegError("Choose an image file"); return; }
    if (file.size > 10 * 1024 * 1024) { setRegError("Payment screenshot must be 10MB or smaller"); return; }
    setScreenshotFile(file);
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX = 600;
        const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        setScreenshotPreview(canvas.toDataURL("image/jpeg", 0.6));
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  const teamSize = (tournament?.teamSize || "squad") as "solo" | "duo" | "squad";
  const requiredIgnCount = teamSize === "solo" ? 1 : teamSize === "duo" ? 2 : 4;

  function updateIgnCount() {
    setIgnNames(prev => {
      if (prev.length === requiredIgnCount) return prev;
      const next = [...prev];
      while (next.length < requiredIgnCount) next.push("");
      while (next.length > requiredIgnCount) next.pop();
      return next;
    });
  }

  useEffect(() => {
    if (tournament) updateIgnCount();
  }, [tournament?.teamSize]);

  async function submitRegistration() {
    if (!teamName.trim()) { setRegError("Team name is required"); return; }
    const emptyIgn = ignNames.findIndex(n => !n.trim());
    if (emptyIgn >= 0) { setRegError(`Player ${emptyIgn + 1} IGN is required`); return; }
    if (tournament?.isPaid && !utr.trim()) { setRegError("Enter UTR or transaction ID"); return; }
    if (tournament?.isPaid && !screenshotFile) { setRegError("Payment screenshot is required"); return; }

    // UTR duplicate check
    if (tournament?.isPaid && utr.trim()) {
      const utrVal = utr.trim().toUpperCase().replace(/\s+/g, "");
      const duplicate = (registrations as any[]).find(
        (r: any) => r.utrNumber && r.utrNumber.trim().toUpperCase().replace(/\s+/g, "") === utrVal
      );
      if (duplicate) {
        setRegError("This UTR / Transaction ID has already been used. Each UTR can only be submitted once.");
        return;
      }
    }

    setRegError("");

    const playerNames = `${teamName.trim()} | ${ignNames.join(", ")}`;

    setUploadingScreenshot(true);
    try {
      const paymentScreenshotUrl = screenshotFile ? await uploadPaymentScreenshot(screenshotFile) : null;
      await createReg.mutateAsync({
        data: {
          tournamentId: id,
          squadName: teamName.trim(),
          playerNames,
          utrNumber: utr.trim().toUpperCase().replace(/\s+/g, "") || "-",
          paymentScreenshotUrl,
          guestUsername: user?.username || null,
        } as any,
      });
      setTeamName("");
      setIgnNames(new Array(requiredIgnCount).fill(""));
      setUtr("");
      setScreenshotFile(null);
      setScreenshotPreview("");
    } catch (error: any) {
      setRegError(error?.message || "Registration failed. Please try again.");
    } finally {
      setUploadingScreenshot(false);
    }
  }

  function shareTournament() {
    const url = `${window.location.origin}/tournaments/${id}`;
    const shareData = {
      title: tournament?.name ?? "Elite FF Tournament",
      text: `🎮 Join me at "${tournament?.name}" on Elite FF! ${tournament?.isPaid ? `Entry: ₹${tournament.entryFee}` : "Free Entry"} · Prize: ₹${tournament?.prizePool ?? 0}`,
      url,
    };
    if (navigator.share) {
      navigator.share(shareData).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).catch(() => {});
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }
  }

  function openBroadcast() {
    setBcRoomId(tournament?.roomId || "");
    setBcRoomPass(tournament?.roomPassword || "");
    setBcDelayTime("");
    setBcReason("");
    setBcTitle("");
    setBcMessage("");
    setBcSent(false);
    setBroadcastType("roomIdReleased");
    setBroadcastOpen(true);
  }

  async function sendBroadcast() {
    const name = tournament?.name ?? `Tournament #${id}`;
    let title = "";
    let message = "";
    let type = broadcastType;
    if (broadcastType === "roomIdReleased") {
      if (!bcRoomId.trim()) return;
      title = "🔑 Room ID Released";
      message = `Room ID for "${name}" is now live! Join the room now.`;
    } else if (broadcastType === "tournamentDelayed") {
      if (!bcDelayTime) return;
      title = "⏳ Tournament Delayed";
      message = `"${name}" has been rescheduled.${bcReason ? ` Reason: ${bcReason}` : ""}`;
    } else if (broadcastType === "tournamentCancelled") {
      title = "❌ Tournament Cancelled";
      message = `"${name}" has been cancelled.${bcReason ? ` Reason: ${bcReason}` : ""}`;
    } else if (broadcastType === "matchCompleted") {
      title = "🏆 Match Completed";
      message = bcMessage || `The match for "${name}" is now complete. Check Results!`;
    } else {
      if (!bcTitle.trim() || !bcMessage.trim()) return;
      title = bcTitle.trim();
      message = bcMessage.trim();
      type = "custom";
    }
    setBroadcastError("");
    setBroadcastSending(true);
    try {
      const response = await apiFetch("/api/notifications/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournamentId: id, title, message, type }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || "Unable to send broadcast");
      addAlert({ type: broadcastType === "custom" ? "registrationSubmitted" : broadcastType, title, message, tournamentId: id });
    } catch (error: any) {
      setBroadcastError(error?.message || "Unable to send broadcast. Please try again.");
      setBroadcastSending(false);
      return;
    }
    // Save to broadcast history
    const histKey = `eliteff_broadcasts_${id}`;
    const hist = (() => { try { return JSON.parse(localStorage.getItem(histKey) || "[]"); } catch { return []; } })();
    const histEntry = {
      type: broadcastType,
      label: broadcastType === "roomIdReleased" ? "Room ID Released" : broadcastType === "tournamentDelayed" ? "Match Delayed" : broadcastType === "tournamentCancelled" ? "Match Cancelled" : broadcastType === "matchCompleted" ? "Match Completed" : (bcTitle || "Custom"),
      preview: broadcastType === "roomIdReleased" ? `ID: ${bcRoomId}` : broadcastType === "tournamentDelayed" ? `New time: ${bcDelayTime ? formatDateTime12(bcDelayTime, false) : "—"}` : bcMessage || bcReason || `"${name}" update`,
      sentAt: Date.now(),
    };
    localStorage.setItem(histKey, JSON.stringify([histEntry, ...hist].slice(0, 10)));

    setBcSent(true);
    setBroadcastSending(false);
    setTimeout(() => { setBroadcastOpen(false); setBcSent(false); }, 1500);
  }

  function handleCancel() {
    cancelTournament.mutate({ id, data: { reason: "Cancelled by host" } });
    addAlert({ type: "tournamentCancelled", title: "Tournament Cancelled", message: `${tournament?.name} has been cancelled.` });
  }

  function handleDelay() {
    if (!newDelayDate) return;
    delayTournament.mutate({ id, data: { newScheduledAt: new Date(newDelayDate).toISOString(), reason: "Rescheduled by host" } });
    addAlert({ type: "tournamentDelayed", title: "Tournament Delayed", message: `${tournament?.name} has been delayed.`, extra: { newTime: formatDateTime12(newDelayDate) } });
  }

  useEffect(() => {
    if (isHost || !user || !id) return;
    const serverReg = (registrations as any[])[0];
    if (serverReg) {
      setPlayerRegStatus({
        status: serverReg.status,
        slotNumber: serverReg.slotNumber,
        squadName: serverReg.squadName || "",
        declineReason: serverReg.declineReason,
      });
      return;
    }
    if (!createReg.isPending) setPlayerRegStatus(null);
  }, [id, user?.id, user?.username, isHost, registrations, createReg.isPending]);

  if (isLoading) {
    return (
      <div className="px-4 py-4 animate-pulse">
        <div className="h-6 w-32 rounded mb-4" style={{ background: "var(--th-card2)" }} />
        <div className="h-8 w-48 rounded mb-2" style={{ background: "var(--th-card2)" }} />
        <div className="h-4 w-24 rounded" style={{ background: "var(--th-card2)" }} />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-muted-foreground">Tournament not found</p>
        <button onClick={() => navigate("/tournaments")} className="mt-4 text-sm" style={{ color: "#ff6b35" }}>← Back</button>
      </div>
    );
  }

  const pendingRegs = registrations.filter((r: any) => r.status === "pending");
  const verifiedRegs = (registrations as any[]).filter((r: any) => r.status === "verified" || r.status === "approved");
  const declinedRegs = (registrations as any[]).filter((r: any) => r.status === "declined");

  const isApproved = playerRegStatus?.status === "verified" || playerRegStatus?.status === "approved";
  const isFull = !!tournament && (tournament.filledSlots ?? 0) >= (tournament.maxSlots ?? 0);

  const posterUrl = tournament?.posterUrl || (id ? localStorage.getItem(`eliteff_tournament_poster_${id}`) ?? "" : "");
  const tourneyConfig: { matchCount: number; maps: string[] } | null = (() => {
    try {
      const serverMaps = typeof (tournament as any).maps === "string" ? JSON.parse((tournament as any).maps) : (tournament as any).maps;
      if ((tournament as any).matchCount || Array.isArray(serverMaps)) {
        return { matchCount: Number((tournament as any).matchCount) || 1, maps: serverMaps ?? [] };
      }
      const c = id ? localStorage.getItem(`eliteff_tournament_config_${id}`) : null;
      return c ? JSON.parse(c) : null;
    } catch { return null; }
  })();

  const MAP_META: Record<string, { emoji: string; color: string }> = {
    "Bermuda":    { emoji: "🏝️", color: "#22c55e" },
    "Purgatory":  { emoji: "❄️",  color: "#60a5fa" },
    "Kalahari":   { emoji: "🏜️", color: "#f59e0b" },
    "Alpine":     { emoji: "⛰️",  color: "#818cf8" },
    "Nexterra":   { emoji: "🌌", color: "#a855f7" },
    "Bermuda R.": { emoji: "🌴", color: "#16a34a" },
  };

  function copy(text: string) { navigator.clipboard.writeText(text).catch(() => {}); }

  return (
    <div className="pb-8" data-testid="tournament-detail">
      {/* Poster Banner */}
      {posterUrl ? (
        <div className="relative w-full overflow-hidden" style={{ height: 190 }}>
          <button type="button" onClick={() => setPreviewImg(posterUrl)} className="w-full h-full block cursor-zoom-in">
            <img src={posterUrl} alt="Tournament poster — tap to view full size" className="w-full h-full object-cover" />
          </button>
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, var(--th-bg) 100%)" }} />
          <div className="absolute top-0 left-0 right-0 px-4 pt-3">
            <button onClick={() => navigate("/tournaments")} className="flex items-center gap-2 text-white/90 text-sm transition-smooth hover:text-white drop-shadow-sm">
              <ArrowLeft size={16} /> Back to Tournaments
            </button>
          </div>
        </div>
      ) : (
        <div className="px-4 py-3">
          <button onClick={() => navigate("/tournaments")} className="flex items-center gap-2 text-muted-foreground text-sm transition-smooth hover:text-foreground">
            <ArrowLeft size={16} /> Back to Tournaments
          </button>
        </div>
      )}

      {/* Header */}
      <div className="px-4 mb-4" style={{ marginTop: posterUrl ? -8 : 0 }}>
        <div className="flex items-start justify-between gap-3 mb-2">
          <h1 className="font-display font-black text-2xl text-foreground leading-tight flex-1">{tournament.name}</h1>
          <div className="flex items-center gap-2 flex-shrink-0">
            <StatusBadge status={tournament.status} />
            <button
              onClick={shareTournament}
              title="Share tournament"
              className="w-8 h-8 rounded-xl flex items-center justify-center transition-smooth active:scale-90"
              style={shareCopied
                ? { background: "rgba(34,197,94,0.15)", color: "#22c55e" }
                : { background: "var(--th-card2)", color: "var(--th-muted)" }}
            >
              {shareCopied ? <CheckCircle size={15} /> : <Share2 size={15} />}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
          <span>{tournament.type}</span>
          <span>·</span>
          <span>{tournament.mode}</span>
          {tournament.teamSize && <><span>·</span><span>{tournament.teamSize}v{tournament.teamSize}</span></>}
          <span>·</span>
          <div className="flex items-center gap-1">
            <Users size={12} />
            <span>{tournament.filledSlots ?? 0}/{tournament.maxSlots}</span>
          </div>
          {isFull && tournament.status === "upcoming" && (
            <span className="font-bold px-2 py-0.5 rounded-full text-[11px]" style={{ background: "rgba(255,69,0,0.15)", color: "#ff4500" }}>
              🔒 FULL
            </span>
          )}
        </div>
        {/* Private invite link */}
        {tournament?.isPrivate && isHost && tournament?.inviteLink && (
          <div className="mt-2 rounded-xl p-2.5 flex items-center gap-2" style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)" }}>
            <span className="text-xs font-bold" style={{ color: "#fbbf24" }}>Invite Link</span>
            <span className="text-xs truncate flex-1" style={{ color: "var(--th-muted)" }}>{tournament.inviteLink}</span>
            <button
              onClick={() => { navigator.clipboard.writeText(tournament.inviteLink!); setShareCopied(true); setTimeout(() => setShareCopied(false), 2000); }}
              className="text-[10px] font-bold px-2 py-1 rounded-md transition-smooth"
              style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24" }}
            >
              {shareCopied ? "Copied!" : "Copy"}
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="px-4 flex gap-2 mb-4">
        {([["info", "Info", Trophy], ["scoreboard", "Scoreboard", ChartNoAxesColumn], ["room", "Room", Key]] as const).map(([t, label, Icon]) => (
          <button key={t} onClick={() => setTab(t)}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl transition-all duration-200 active:scale-95 flex-shrink-0"
            style={tab === t
              ? { background: "linear-gradient(135deg, #ff6b35, #ff4500)", color: "#0a0e27" }
              : { background: "var(--th-card2)", color: "var(--th-muted)" }}
          >
            <Icon size={12} /> {label}
          </button>
        ))}
        <button onClick={() => setRefreshKey(k => k + 1)} className="ml-auto w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white/10 transition-smooth">
          <RefreshCw size={14} className="text-muted-foreground" />
        </button>
      </div>

      {/* Info Tab */}
      {tab === "info" && (
        <div className="px-4 flex flex-col gap-4">
          {registrationActionError && (
            <div className="rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: "rgba(255,69,0,0.1)", color: "#ff8066", border: "1px solid rgba(255,69,0,0.25)" }}>
              {registrationActionError}
            </div>
          )}
          {/* Timer — upcoming: auto-sets live when it hits zero */}
          {tournament.timerEnabled && tournament.scheduledAt && tournament.status === "upcoming" && (
            <Countdown
              scheduledAt={tournament.scheduledAt}
              onExpire={isHost ? () => {
                updateTournament.mutate({ id, data: { status: "live" } as any }, {
                  onSuccess: () => {
                    qc.invalidateQueries({ queryKey: ["getTournament", id] });
                    addAlert({ type: "roomIdReleased", title: "🔴 Tournament is LIVE!", message: `${tournament.name} has started. The match is now live!` });
                  },
                });
              } : undefined}
            />
          )}

          {/* Timer — delayed: show countdown to new time */}
          {tournament.scheduledAt && tournament.status === "delayed" && (
            <Countdown
              scheduledAt={tournament.scheduledAt}
              variant="delayed"
              onExpire={isHost ? () => {
                updateTournament.mutate({ id, data: { status: "live" } as any }, {
                  onSuccess: () => {
                    qc.invalidateQueries({ queryKey: ["getTournament", id] });
                    addAlert({ type: "roomIdReleased", title: "🔴 Tournament is LIVE!", message: `${tournament.name} delayed match has started!` });
                  },
                });
              } : undefined}
            />
          )}

          {/* Room ID notice for players on upcoming/delayed tournaments */}
          {!isHost && (tournament.status === "upcoming" || tournament.status === "delayed") && (
            <div className="rounded-2xl px-4 py-3 flex items-center gap-3" style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)" }}>
              <Key size={15} style={{ color: "#fbbf24", flexShrink: 0 }} />
              <p className="text-xs leading-relaxed" style={{ color: "#fbbf24" }}>
                Room ID &amp; Password will be shared <strong>10 minutes before</strong> the match starts. Check the Room tab.
              </p>
            </div>
          )}

          {/* Datetime */}
          <div className="rounded-2xl p-4 flex items-center gap-4" style={{ background: "var(--th-card)", border: "1px solid var(--th-border)" }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,107,53,0.12)" }}>
              <Clock size={18} style={{ color: "#ff6b35" }} />
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest font-bold" style={{ color: "var(--th-dim)" }}>Scheduled At</div>
              <div className="text-sm font-bold text-foreground">
                {formatDateTime12(tournament.scheduledAt)}
              </div>
            </div>
          </div>

          {/* Entry + Prize */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl p-4" style={{ background: "var(--th-card)", border: "1px solid var(--th-border)" }}>
              <div className="text-xs uppercase tracking-widest font-bold mb-1" style={{ color: "var(--th-dim)" }}>Entry Fee</div>
              <div className="text-xl font-black text-foreground">
                {tournament.isPaid && tournament.entryFee ? `₹${tournament.entryFee}` : "Free"}
              </div>
            </div>
            <div className="rounded-2xl p-4" style={{ background: "var(--th-card)", border: "1px solid var(--th-border)" }}>
              <div className="text-xs uppercase tracking-widest font-bold mb-1" style={{ color: "var(--th-dim)" }}>Prize Pool</div>
              <div className="text-xl font-black" style={{ color: "#fbbf24" }}>
                {tournament.prizePool ? `₹${tournament.prizePool}` : "—"}
              </div>
            </div>
          </div>

          {/* Prize Distribution */}
          {(() => {
             const prizes: { ranks: { rank: number; label: string; amount: number }[] } | null = (() => {
               try {
                 const server = (tournament as any).prizeDistribution;
                 const parsedServer = typeof server === "string" ? JSON.parse(server) : server;
                 if (Array.isArray(parsedServer)) return { ranks: parsedServer };
                 if (parsedServer?.ranks?.length) return parsedServer;
                 const c = id ? localStorage.getItem(`eliteff_tournament_prizes_${id}`) : null;
                 return c ? JSON.parse(c) : null;
               } catch { return null; }
            })();
            if (!prizes || prizes.ranks.length === 0) return null;
            return (
              <div className="rounded-2xl p-4" style={{ background: "var(--th-card)", border: "1px solid var(--th-border)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <Trophy size={14} style={{ color: "#fbbf24" }} />
                  <span className="font-display font-bold text-sm text-foreground">Prize Distribution</span>
                </div>
                <div className="flex flex-col gap-2">
                  {prizes.ranks.map((r: { rank: number; label: string; amount: number }) => (
                    <div key={r.rank} className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                      style={{
                        background: r.rank === 1 ? "rgba(251,191,36,0.07)" : r.rank === 2 ? "rgba(156,163,175,0.05)" : r.rank === 3 ? "rgba(180,83,9,0.06)" : "rgba(255,255,255,0.03)",
                        border: r.rank === 1 ? "1px solid rgba(251,191,36,0.2)" : "1px solid var(--th-border)",
                      }}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black flex-shrink-0"
                        style={r.rank === 1 ? { background: "rgba(251,191,36,0.2)", color: "#fbbf24" } : r.rank === 2 ? { background: "rgba(156,163,175,0.15)", color: "#9ca3af" } : r.rank === 3 ? { background: "rgba(180,83,9,0.15)", color: "#b45309" } : { background: "var(--th-border)", color: "var(--th-dim)" }}>
                        #{r.rank}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-foreground">{r.label}</div>
                      </div>
                      <div className="text-base font-black flex-shrink-0" style={{ color: r.rank === 1 ? "#fbbf24" : r.rank <= 3 ? "#ff6b35" : "var(--th-muted)" }}>
                        ₹{r.amount.toLocaleString("en-IN")}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

           {/* Match Schedule */}
          {tourneyConfig && (
            <div className="rounded-2xl p-4" style={{ background: "var(--th-card)", border: "1px solid var(--th-border)" }}>
              <div className="flex items-center gap-2 mb-3">
                <Swords size={14} style={{ color: "#ff6b35" }} />
                <span className="font-display font-bold text-sm text-foreground">
                  {tourneyConfig.matchCount} {tourneyConfig.matchCount === 1 ? "Match" : "Matches"}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {tourneyConfig.maps.map((map: string, i: number) => {
                  const meta = MAP_META[map] ?? { emoji: "🏝️", color: "#ff6b35" };
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs font-bold w-14 flex-shrink-0" style={{ color: "var(--th-dim)" }}>Match {i + 1}</span>
                      <span
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold"
                        style={{ background: `${meta.color}1a`, color: meta.color, border: `1px solid ${meta.color}30` }}
                      >
                        {meta.emoji} {map}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Rules */}
          {tournament.rules && (
            <div className="rounded-2xl p-4" style={{ background: "var(--th-card)", border: "1px solid var(--th-border)" }}>
              <div className="flex items-center gap-2 mb-3">
                <Shield size={14} style={{ color: "#ff6b35" }} />
                <span className="font-display font-bold text-sm text-foreground">Rules</span>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: "var(--th-muted)" }}>{tournament.rules}</p>
            </div>
          )}

          {/* Player's own registration details (read-only) */}
          {!isHost && playerRegStatus && (
            <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: playerRegStatus.status === "verified" ? "rgba(34,197,94,0.06)" : "rgba(255,107,53,0.06)", border: `1px solid ${playerRegStatus.status === "verified" ? "rgba(34,197,94,0.2)" : "rgba(255,107,53,0.2)"}` } }>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {playerRegStatus.status === "verified" ? <CheckCircle size={16} style={{ color: "#22c55e" }} /> : <Clock size={16} style={{ color: "#ff6b35" }} />}
                  <span className="font-display font-bold text-sm text-foreground">
                    {playerRegStatus.status === "verified" ? "Registration Verified" : "Registration Pending"}
                  </span>
                </div>
                {playerRegStatus.status === "verified" && playerRegStatus.slotNumber && (
                  <span className="text-xs font-black px-2.5 py-1 rounded-lg" style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}>
                    Slot #{playerRegStatus.slotNumber}
                  </span>
                )}
              </div>
              {/* Find the player's registration details from the registrations list */}
              {(() => {
                const myReg = registrations.find((r: any) => r.squadName && playerRegStatus?.squadName && r.squadName.toLowerCase() === playerRegStatus.squadName.toLowerCase());
                if (!myReg) return null;
                return (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span style={{ color: "var(--th-dim)" }}>Team:</span>
                      <span className="font-bold text-foreground">{myReg.squadName}</span>
                    </div>
                    {myReg.playerNames && (
                      <div className="flex items-center gap-2 text-xs">
                        <span style={{ color: "var(--th-dim)" }}>Players:</span>
                        <span className="font-semibold text-foreground">{myReg.playerNames}</span>
                      </div>
                    )}
                    {myReg.utrNumber && myReg.utrNumber !== "-" && (
                      <div className="flex items-center gap-2 text-xs">
                        <span style={{ color: "var(--th-dim)" }}>UTR:</span>
                        <span className="font-mono text-foreground">{myReg.utrNumber}</span>
                      </div>
                    )}
                    {myReg.paymentScreenshotUrl && (
                      <div className="flex flex-col gap-1">
                        <span className="text-xs" style={{ color: "var(--th-dim)" }}>Payment Screenshot:</span>
                        <button onClick={() => setPreviewImg(myReg.paymentScreenshotUrl || null)} className="self-start">
                          <img src={myReg.paymentScreenshotUrl} alt="Payment" className="w-20 h-20 rounded-lg object-cover border" style={{ borderColor: "var(--th-border)" }} />
                        </button>
                      </div>
                    )}
                    {myReg.approvedAt && (
                      <div className="text-xs" style={{ color: "var(--th-dimmer)" }}>
                        Approved on {new Date(myReg.approvedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Registration button */}
          {!isHost && tournament.status === "upcoming" && (() => {
            const alreadyRegistered = !!playerRegStatus;
            if (alreadyRegistered && playerRegStatus?.status === "declined") return (
              <div className="flex flex-col gap-2">
                <div className="rounded-2xl p-4 text-center flex flex-col items-center gap-1" style={{ background: "rgba(255,69,0,0.08)", border: "1px solid rgba(255,69,0,0.2)" }}>
                  <XCircle size={22} style={{ color: "#ff4500" }} />
                  <div className="font-display font-bold text-foreground text-sm">Registration Declined</div>
                  {playerRegStatus?.squadName && <p className="text-xs" style={{ color: "var(--th-muted)" }}>{playerRegStatus.squadName} — {playerRegStatus.declineReason || "No reason given"}</p>}
                  <button onClick={() => setRegOpen(true)} className="mt-1 px-4 py-2 rounded-xl text-xs font-bold" style={{ background: "rgba(255,107,53,0.12)", color: "#ff6b35" }}>
                    Re-submit Registration
                  </button>
                </div>
              </div>
            );
            if (alreadyRegistered) return (
              <div className="flex flex-col gap-2">
                <div className="rounded-2xl p-4 text-center flex flex-col items-center gap-1" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
                  <CheckCircle size={22} style={{ color: "#22c55e" }} />
                  <div className="font-display font-bold text-foreground text-sm">Already Registered</div>
                  <p className="text-xs" style={{ color: "var(--th-muted)" }}>Your registration is pending host verification</p>
                </div>
              </div>
            );
            if (isFull) return (
              <div className="w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2"
                style={{ background: "rgba(255,69,0,0.08)", color: "#ff4500", border: "1px solid rgba(255,69,0,0.2)" }}>
                🔒 Tournament Full — No Slots Available
              </div>
            );
            return (
              <button
                onClick={() => { if (!user) { navigate("/settings"); return; } setRegOpen(true); }}
                className="w-full py-4 rounded-2xl font-black text-base text-white flex items-center justify-center gap-2 transition-smooth active:scale-95"
                style={{ background: "linear-gradient(135deg, #ff6b35 0%, #ff4500 100%)" }}
              >
                <Trophy size={18} /> Register Now
              </button>
            );
          })()}

          {/* Host controls */}
          {isHost && (
            <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: "var(--th-card)", border: "1px solid var(--th-border)" }}>
              <div className="flex items-center gap-2 mb-1">
                <Shield size={14} style={{ color: "#ff6b35" }} />
                <span className="font-display font-bold text-sm text-foreground">Host Controls</span>
              </div>

              {/* Pending */}
              {pendingRegs.length > 0 && (
                <div>
                  <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "var(--th-dim)" }}>
                    Pending Verification ({pendingRegs.length})
                  </div>
                  <div className="flex flex-col gap-2">
                    {pendingRegs.map((reg: any) => (
                      <div key={reg.id} className="rounded-xl p-3" style={{ background: "var(--th-row)" }}>
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-foreground">{reg.squadName}</div>
                            {reg.playerNames && <div className="text-xs text-muted-foreground truncate">{reg.playerNames}</div>}
                          </div>
                          {reg.paymentScreenshotUrl && (
                            <button onClick={() => setPreviewImg(reg.paymentScreenshotUrl)} className="flex-shrink-0">
                              <img src={reg.paymentScreenshotUrl} alt="Payment" className="w-14 h-14 rounded-lg object-cover border border-white/10" />
                            </button>
                          )}
                        </div>
                        {/* Full registration details for host */}
                        <div className="rounded-lg p-2.5 mb-2 text-xs flex flex-col gap-1.5" style={{ background: "var(--th-card2)", border: "1px solid var(--th-border2)" }}>
                          {reg.playerNames && (
                            <div className="flex items-start gap-2">
                              <span className="flex-shrink-0" style={{ color: "var(--th-dim)", minWidth: 70 }}>Players:</span>
                              <span className="font-semibold text-foreground">{reg.playerNames}</span>
                            </div>
                          )}
                          {reg.utrNumber && reg.utrNumber !== "-" && (
                            <div className="flex items-center gap-2">
                              <span className="flex-shrink-0" style={{ color: "var(--th-dim)", minWidth: 70 }}>UTR:</span>
                              <span className="font-mono text-foreground">{reg.utrNumber}</span>
                            </div>
                          )}
                          {reg.user?.mobile && (
                            <div className="flex items-center gap-2">
                              <span className="flex-shrink-0" style={{ color: "var(--th-dim)", minWidth: 70 }}>Phone:</span>
                              <span className="text-foreground">{reg.user.mobile}</span>
                            </div>
                          )}
                          {reg.upiId && (
                            <div className="flex items-center gap-2">
                              <span className="flex-shrink-0" style={{ color: "var(--th-dim)", minWidth: 70 }}>UPI:</span>
                              <span className="text-foreground">{reg.upiId}</span>
                            </div>
                          )}
                          {reg.paymentScreenshotUrl && (
                            <div className="flex items-start gap-2">
                              <span className="flex-shrink-0" style={{ color: "var(--th-dim)", minWidth: 70 }}>Screenshot:</span>
                              <button onClick={() => setPreviewImg(reg.paymentScreenshotUrl)} className="self-start">
                                <img src={reg.paymentScreenshotUrl} alt="Payment" className="w-16 h-16 rounded-lg object-cover border" style={{ borderColor: "var(--th-border)" }} />
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => verifyReg.mutate({ id: reg.id, data: {} })}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-smooth active:scale-95"
                            style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)" }}
                          >
                            <CheckCircle size={12} /> Approve
                          </button>
                          <button
                            onClick={() => { setDeclineOpen({ id: reg.id }); setDeclineReason(""); }}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-smooth active:scale-95"
                            style={{ background: "rgba(255,69,0,0.12)", color: "#ff4500", border: "1px solid rgba(255,69,0,0.25)" }}
                          >
                            <XCircle size={12} /> Decline
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {pendingRegs.length === 0 && verifiedRegs.length === 0 && (
                <p className="text-xs text-muted-foreground">No registrations yet.</p>
              )}

              {/* Approved / Verified */}
              {verifiedRegs.length > 0 && (
                <div>
                  <div className="text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5" style={{ color: "#22c55e" }}>
                    <CheckCircle size={11} /> Approved ({verifiedRegs.length})
                  </div>
                  <div className="flex flex-col gap-2">
                    {verifiedRegs.map((reg: any) => (
                      <div key={reg.id} className="rounded-xl p-3 flex items-center justify-between gap-2" style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.18)" }}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black px-2 py-0.5 rounded-lg" style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}>
                              Slot #{reg.slotNumber}
                            </span>
                            <span className="text-sm font-bold text-foreground truncate">{reg.squadName}</span>
                          </div>
                          {reg.user?.mobile && <div className="text-xs mt-0.5" style={{ color: "var(--th-dim)" }}>{reg.user.mobile}</div>}
                          {reg.utrNumber && reg.utrNumber !== "-" && (
                            <div className="text-xs mt-0.5" style={{ color: "var(--th-dim)" }}>UTR: {reg.utrNumber}</div>
                          )}
                        </div>
                        {reg.paymentScreenshotUrl && (
                          <img src={reg.paymentScreenshotUrl} alt="Payment" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Declined */}
              {declinedRegs.length > 0 && (
                <div>
                  <div className="text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5" style={{ color: "#ff4500" }}>
                    <XCircle size={11} /> Declined ({declinedRegs.length})
                  </div>
                  <div className="flex flex-col gap-2">
                    {declinedRegs.map((reg: any) => (
                      <div key={reg.id} className="rounded-xl p-3 flex items-center justify-between gap-2" style={{ background: "rgba(255,69,0,0.06)", border: "1px solid rgba(255,69,0,0.18)" }}>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-foreground truncate">{reg.squadName}</div>
                          {reg.user?.mobile && <div className="text-xs mt-0.5" style={{ color: "var(--th-dim)" }}>{reg.user.mobile}</div>}
                          {reg.declineReason && (
                            <div className="text-xs mt-0.5 italic" style={{ color: "#ff4500" }}>Reason: {reg.declineReason}</div>
                          )}
                        </div>
                        <button
                          onClick={() => verifyReg.mutate({ id: reg.id, data: {} })}
                          className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition-smooth active:scale-95 flex-shrink-0"
                          style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)" }}
                        >
                          <CheckCircle size={11} /> Re-Approve
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Edit / Complete / Broadcast / Delay / Cancel / Delete */}
              <div className="flex gap-2 pt-2 flex-wrap">
                <button
                  onClick={() => navigate(`/tournaments/${id}/edit`)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-smooth active:scale-95"
                  style={{ background: "rgba(255,107,53,0.12)", color: "#ff6b35", border: "1px solid rgba(255,107,53,0.2)" }}
                >
                  <Pencil size={12} /> Edit
                </button>
                {tournament.status !== "completed" && tournament.status !== "cancelled" && (
                  <button
                    onClick={() => {
                      if (confirm("Mark this tournament as Completed? This will close all registrations.")) {
                        updateTournament.mutate({ id, data: { status: "completed" } as any }, {
                          onSuccess: () => {
                            qc.invalidateQueries({ queryKey: ["getTournament", id] });
                            addAlert({ type: "matchCompleted", title: "Tournament Completed", message: `${tournament.name} has been marked as completed.` });
                          },
                        });
                      }
                    }}
                    disabled={updateTournament.isPending}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-smooth active:scale-95 disabled:opacity-50"
                    style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)" }}
                  >
                    <CheckCircle size={12} /> Complete
                  </button>
                )}
                <button
                  onClick={openBroadcast}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-smooth active:scale-95"
                  style={{ background: "rgba(129,140,248,0.12)", color: "#818cf8", border: "1px solid rgba(129,140,248,0.25)" }}
                >
                  <Megaphone size={12} /> Broadcast
                </button>
                <button
                  onClick={() => navigate(`/tournaments/${id}/results`)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-smooth active:scale-95"
                  style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)" }}
                >
                  <ChartNoAxesColumn size={12} /> Upload Results
                </button>
                <button
                  onClick={() => navigate(`/tournaments/${id}/scoreboard`)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-smooth active:scale-95"
                  style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.25)" }}
                >
                  <Swords size={12} /> Scoreboard
                </button>
                <button
                  onClick={() => navigate(`/tournaments/${id}/payments`)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-smooth active:scale-95 relative"
                  style={{ background: "rgba(99,102,241,0.12)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.25)" }}
                >
                  <CreditCard size={12} /> Verify Payments
                  {pendingRegs.length > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black" style={{ background: "#ff4500", color: "#fff" }}>
                      {pendingRegs.length}
                    </span>
                  )}
                </button>
                {tournament.status !== "cancelled" && (
                  <button
                    onClick={() => setDelayOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-smooth active:scale-95"
                    style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.2)" }}
                  >
                    <Clock size={12} /> Delay
                  </button>
                )}
                {tournament.status !== "cancelled" && (
                  <button
                    onClick={() => { if (confirm(`Cancel this tournament? All players will be notified.`)) handleCancel(); }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-smooth active:scale-95"
                    style={{ background: "rgba(255,69,0,0.1)", color: "#ff4500", border: "1px solid rgba(255,69,0,0.2)" }}
                  >
                    <AlertTriangle size={12} /> Cancel
                  </button>
                )}
                <button
                  onClick={() => setDeleteOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-smooth active:scale-95"
                  style={{ background: "rgba(255,69,0,0.08)", color: "#ff4500" }}
                >
                  <Trash2 size={12} /> Delete
                </button>
              </div>

              {/* Broadcast history */}
              {(() => {
                const hist: { type: string; label: string; preview: string; sentAt: number }[] = (() => {
                  try { return JSON.parse(localStorage.getItem(`eliteff_broadcasts_${id}`) || "[]"); } catch { return []; }
                })();
                if (hist.length === 0) return null;
                const TYPE_COLOR: Record<string, string> = {
                  roomIdReleased: "#22c55e",
                  tournamentDelayed: "#fbbf24",
                  tournamentCancelled: "#ff4500",
                  matchCompleted: "#818cf8",
                  custom: "#ff6b35",
                };
                const timeAgo = (ts: number) => {
                  const d = Date.now() - ts;
                  if (d < 60000) return "just now";
                  if (d < 3600000) return `${Math.floor(d / 60000)}m ago`;
                  if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`;
                  return `${Math.floor(d / 86400000)}d ago`;
                };
                return (
                  <div className="pt-2">
                    <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "var(--th-dimmer)" }}>
                      Broadcast History
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {hist.slice(0, 5).map((h, i) => {
                        const color = TYPE_COLOR[h.type] ?? "#ff6b35";
                        return (
                          <div key={i} className="flex items-start gap-3 rounded-xl px-3 py-2.5"
                            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--th-border)" }}>
                            <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: color }} />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-bold text-foreground truncate">{h.label}</div>
                              <div className="text-xs truncate" style={{ color: "var(--th-dim)" }}>{h.preview}</div>
                            </div>
                            <div className="text-[10px] flex-shrink-0 pt-0.5" style={{ color: "var(--th-dimmer)" }}>{timeAgo(h.sentAt)}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* Scoreboard Tab */}
      {tab === "scoreboard" && (
        <div className="px-4 flex flex-col gap-3">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {tournament?.status === "live" ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)" }}>
                  <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#22c55e" }} />
                  <span className="text-xs font-black" style={{ color: "#22c55e" }}>LIVE</span>
                </div>
              ) : null}
              <p className="text-xs text-muted-foreground">
                {tournament?.status === "live" ? "Auto-refreshes every 15s" : "Scoreboard updates live during the match"}
              </p>
            </div>
            {sbUpdatedAt ? (
              <span className="text-xs" style={{ color: "var(--th-dimmer)" }}>
                {formatTime12(sbUpdatedAt)}
              </span>
            ) : null}
          </div>

          {isHost && (
            <button
              onClick={() => navigate(`/tournaments/${id}/scoreboard`)}
              className="w-full h-10 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-smooth active:scale-95"
              style={{ background: "rgba(251,191,36,0.10)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.25)" }}
            >
              <Swords size={15} /> Manage Scoreboard (Host)
            </button>
          )}

          {/* Point system info */}
          {(() => {
            const pts: { killPoints: number; placements: number[] } | null = (() => {
              try { const c = localStorage.getItem(`eliteff_tournament_points_${id}`); return c ? JSON.parse(c) : null; } catch { return null; }
            })();
            if (!pts) return null;
            return (
              <div className="rounded-2xl px-4 py-3 flex items-center gap-2 flex-wrap" style={{ background: "var(--th-card)", border: "1px solid var(--th-border)" }}>
                <span className="text-[10px] font-black uppercase tracking-widest mr-1" style={{ color: "var(--th-dimmer)" }}>Points:</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-lg" style={{ background: "rgba(255,69,0,0.10)", color: "#ff6b35" }}>💀 Kill={pts.killPoints}pt</span>
                {pts.placements.slice(0, 6).map((p: number, i: number) => (
                  <span key={i} className="text-xs font-semibold px-2 py-0.5 rounded-lg" style={{ background: i === 0 ? "rgba(251,191,36,0.10)" : "var(--th-card2)", color: i === 0 ? "#fbbf24" : "var(--th-muted)" }}>
                    #{i + 1}={p}
                  </span>
                ))}
                <span className="text-[10px]" style={{ color: "var(--th-dimmer)" }}>···</span>
              </div>
            );
          })()}

          {scoreboard.length === 0 ? (
            <div className="flex flex-col items-center py-12 gap-4 text-center">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl" style={{ background: "var(--th-card2)" }}>📊</div>
              <div>
                <div className="font-display font-bold text-foreground text-base">No scores yet</div>
                <p className="text-xs mt-1 max-w-xs" style={{ color: "var(--th-muted)" }}>
                  {isHost ? "Use the Manage Scoreboard button above to enter team scores." : "The host hasn't posted any scores yet. Check back during or after the match."}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {(scoreboard as any[]).map((team: any, i: number) => {
                const badgeStyle = i === 0
                  ? { background: "rgba(251,191,36,0.2)", color: "#fbbf24" }
                  : i === 1
                  ? { background: "rgba(156,163,175,0.15)", color: "#9ca3af" }
                  : i === 2
                  ? { background: "rgba(180,83,9,0.15)", color: "#b45309" }
                  : { background: "var(--th-border)", color: "var(--th-muted)" };
                return (
                  <div key={team.id ?? i} className="flex items-center gap-3 rounded-2xl px-4 py-3" style={{ background: "var(--th-card)", border: "1px solid var(--th-border)" }}>
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0" style={badgeStyle}>
                      #{team.rank ?? i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-foreground truncate">{team.squadName}</div>
                      {(team.kills != null || team.points != null) && (
                        <div className="flex items-center gap-2 mt-0.5">
                          {team.kills != null && (
                            <span className="text-xs font-semibold flex items-center gap-0.5" style={{ color: "#ff4500" }}>
                              💀 {team.kills}K
                            </span>
                          )}
                          {team.points != null && (
                            <span className="text-xs font-bold" style={{ color: "#fbbf24" }}>⚡ {team.points} pts</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Room Tab */}
      {tab === "room" && (
        <div className="px-4 flex flex-col gap-3">
          {isHost || isApproved ? (
            <>
              {tournament.roomId || tournament.roomPassword ? (
                <div className="rounded-2xl p-4" style={{ background: "var(--th-card)", border: "1px solid var(--th-border)" }}>
                  <div className="flex items-center gap-2 mb-4">
                    <Key size={14} style={{ color: "#ff6b35" }} />
                    <span className="font-display font-bold text-sm text-foreground">Room Credentials</span>
                  </div>
                  {tournament.roomId && (
                    <div className="mb-3">
                      <div className="text-xs uppercase tracking-widest font-bold mb-1" style={{ color: "var(--th-dim)" }}>Room ID</div>
                      <div className="flex items-center justify-between rounded-xl px-4 py-2.5" style={{ background: "var(--th-card2)" }}>
                        <span className="font-mono font-bold text-foreground">{tournament.roomId}</span>
                        <button onClick={() => copy(tournament.roomId!)} className="text-xs" style={{ color: "#ff6b35" }}>
                          <Copy size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                  {tournament.roomPassword && (
                    <div>
                      <div className="text-xs uppercase tracking-widest font-bold mb-1" style={{ color: "var(--th-dim)" }}>Password</div>
                      <div className="flex items-center justify-between rounded-xl px-4 py-2.5" style={{ background: "var(--th-card2)" }}>
                        <span className="font-mono font-bold text-foreground">{tournament.roomPassword}</span>
                        <button onClick={() => copy(tournament.roomPassword!)} className="text-xs" style={{ color: "#ff6b35" }}>
                          <Copy size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center py-12 gap-4 text-center">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl" style={{ background: "var(--th-card2)" }}>🔑</div>
                  <div>
                    <div className="font-display font-bold text-foreground text-base">Room Credentials</div>
                    <p className="text-xs mt-1" style={{ color: "var(--th-muted)" }}>Host will upload room details before the match starts.</p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center py-12 gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl" style={{ background: "var(--th-card2)" }}>🔒</div>
              <div>
                <div className="font-display font-bold text-foreground text-base">Verified Player Only</div>
                <p className="text-xs mt-1" style={{ color: "var(--th-muted)" }}>
                  {user ? "Your registration must be verified to see room credentials." : "Register and get verified to access room credentials."}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Registration Modal */}
      {regOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center" style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}>
          <div className="w-full max-w-md rounded-t-3xl p-6 flex flex-col gap-4 animate-in slide-in-from-bottom duration-300" style={{ background: "var(--th-card3)", maxHeight: "90dvh", overflowY: "auto" }}>
            <div className="flex items-center justify-between">
              <div className="font-display font-black text-xl text-foreground">Register Now</div>
              <button onClick={() => setRegOpen(false)} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white/10 transition-smooth">
                <XCircle size={16} className="text-muted-foreground" />
              </button>
            </div>

            <div className="rounded-xl p-3" style={{ background: "rgba(255,107,53,0.08)", border: "1px solid rgba(255,107,53,0.2)" }}>
              <div className="text-xs font-bold text-foreground">{tournament.name}</div>
              <div className="text-xs mt-0.5" style={{ color: "#ff6b35" }}>
                Entry: {tournament.isPaid && tournament.entryFee ? `₹${tournament.entryFee}` : "Free"}
              </div>
            </div>

            {tournament.isPaid && tournament.upiId && tournament.entryFee && (
              <UPIQRCode upiId={tournament.upiId} amount={tournament.entryFee} tournamentName={tournament.name} prizePool={tournament.prizePool} />
            )}

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-bold text-muted-foreground mb-1 block">Team Name *</label>
                <input value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="Team Name"
                  className="w-full h-11 rounded-xl px-4 text-sm"
                  style={{ background: "var(--th-card2)", border: "1px solid var(--th-border2)", color: "var(--th-text)" }} />
              </div>
              {ignNames.map((ign, i) => (
                <div key={i}>
                  <label className="text-xs font-bold text-muted-foreground mb-1 block">
                    {teamSize === "solo" ? "IGN (In-Game Name) *" : `Player ${i + 1} IGN *`}
                  </label>
                  <input value={ign} onChange={e => {
                    const next = [...ignNames];
                    next[i] = e.target.value;
                    setIgnNames(next);
                  }} placeholder="Enter in-game name"
                    className="w-full h-11 rounded-xl px-4 text-sm"
                    style={{ background: "var(--th-card2)", border: "1px solid var(--th-border2)", color: "var(--th-text)" }} />
                </div>
              ))}
              {tournament.isPaid && (
                <>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground mb-1 block">UTR / Transaction ID *</label>
                    <input value={utr} onChange={e => setUtr(e.target.value)} placeholder="Enter 12-digit UTR number"
                      className="w-full h-11 rounded-xl px-4 text-sm"
                      style={{ background: "var(--th-card2)", border: "1px solid var(--th-border2)", color: "var(--th-text)" }} />
                    <p className="text-xs mt-1" style={{ color: "var(--th-dim)" }}>Find UTR in your payment app under transaction details.</p>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground mb-1 block">Payment Screenshot *</label>
                    <label className="block cursor-pointer">
                      <div className="w-full rounded-xl border-2 border-dashed flex flex-col items-center justify-center py-6 gap-2 transition-smooth hover:border-orange-500/50"
                        style={{ borderColor: screenshotPreview ? "rgba(34,197,94,0.4)" : "var(--th-border2)" }}>
                        {screenshotPreview ? (
                          <img src={screenshotPreview} alt="Payment screenshot preview" className="max-h-40 object-contain rounded-lg" />
                        ) : (
                          <>
                            <Camera size={24} style={{ color: "var(--th-dim)" }} />
                             <span className="text-xs text-muted-foreground">PNG, JPG up to 10MB</span>
                          </>
                        )}
                      </div>
                      <input type="file" accept="image/*" className="hidden" onChange={handleScreenshot} />
                    </label>
                    {screenshotPreview && (
                      <button onClick={() => { setScreenshotFile(null); setScreenshotPreview(""); }}
                        className="text-xs mt-1" style={{ color: "#ff4500" }}>Remove image</button>
                    )}
                  </div>
                </>
              )}
            </div>

            {regError && <p className="text-xs font-semibold" style={{ color: "#ff4500" }}>{regError}</p>}

            {tournament.isPaid && (
              <div className="rounded-xl p-3 text-center" style={{ background: "rgba(255,69,0,0.06)", border: "1px solid rgba(255,69,0,0.15)" }}>
                <p className="text-xs" style={{ color: "var(--th-muted)" }}>
                  <span className="font-bold" style={{ color: "#ff4500" }}>No Refund Policy: </span>
                  Entry fees are non-refundable. Ensure your UTR is correct before submitting.
                </p>
              </div>
            )}

            {/* 5-min refund countdown when tournament is full */}
            {tournament.isPaid && isFull && tournament.status === "upcoming" && (
              <RefundCountdown tournamentId={id} />
            )}

            <button onClick={submitRegistration} disabled={createReg.isPending || uploadingScreenshot}
              className="w-full h-12 rounded-2xl font-black text-base flex items-center justify-center gap-2 transition-smooth active:scale-95 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #ff6b35, #ff4500)", color: "#0a0e27" }}>
              {createReg.isPending || uploadingScreenshot ? <div className="w-5 h-5 rounded-full border-2 border-current border-t-transparent animate-spin" /> : null}
              {uploadingScreenshot ? "Uploading screenshot..." : createReg.isPending ? "Submitting..." : "Submit Registration"}
            </button>
          </div>
        </div>
      )}

      {/* Decline modal */}
      {declineOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)" }}>
          <div className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4" style={{ background: "var(--th-card)" }}>
            <div className="font-display font-bold text-xl text-foreground">Confirm Decline</div>
            <p className="text-sm" style={{ color: "var(--th-muted)" }}>Reason for declining (required)</p>
            <textarea
              value={declineReason}
              onChange={e => setDeclineReason(e.target.value)}
              placeholder="e.g. Invalid UTR screenshot, Payment not received..."
              rows={3}
              className="w-full rounded-xl px-4 py-3 text-sm resize-none"
              style={{ background: "var(--th-card2)", border: "1px solid var(--th-border2)", color: "var(--th-text)" }}
            />
            <div className="flex gap-2">
              <button onClick={() => setDeclineOpen(null)} className="flex-1 py-3 rounded-xl font-semibold text-sm" style={{ background: "var(--th-border)", color: "var(--th-muted)" }}>
                Cancel
              </button>
              <button
                onClick={() => declineOpen && declineReg.mutate({ id: declineOpen.id, data: { reason: declineReason || "No reason given" } })}
                disabled={!declineReason.trim()}
                className="flex-1 py-3 rounded-xl font-bold text-sm disabled:opacity-50"
                style={{ background: "rgba(255,69,0,0.2)", color: "#ff4500" }}
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delay modal */}
      {delayOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)" }}>
          <div className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4" style={{ background: "var(--th-card)" }}>
            <div className="font-display font-bold text-xl text-foreground">Delay Tournament</div>
            <p className="text-sm" style={{ color: "var(--th-muted)" }}>Select the new date and time for {tournament.name}</p>
            <input
              type="datetime-local"
              value={newDelayDate}
              onChange={e => setNewDelayDate(e.target.value)}
              className="w-full h-11 rounded-xl px-4 text-sm"
              style={{ background: "var(--th-card2)", border: "1px solid var(--th-border2)", color: "var(--th-text)" }}
            />
            <div className="flex gap-2">
              <button onClick={() => setDelayOpen(false)} className="flex-1 py-3 rounded-xl font-semibold text-sm" style={{ background: "var(--th-border)", color: "var(--th-muted)" }}>
                Cancel
              </button>
              <button onClick={handleDelay} disabled={!newDelayDate} className="flex-1 py-3 rounded-xl font-bold text-sm disabled:opacity-50"
                style={{ background: "rgba(251,191,36,0.2)", color: "#fbbf24" }}>
                Delay Tournament
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Broadcast Modal */}
      {broadcastOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center" style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }} onClick={() => setBroadcastOpen(false)}>
          <div
            className="w-full max-w-md rounded-t-3xl p-6 flex flex-col gap-4 animate-in slide-in-from-bottom duration-300"
            style={{ background: "var(--th-card3)", border: "1px solid var(--th-border)", maxHeight: "90dvh", overflowY: "auto" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="w-12 h-1 rounded-full mx-auto" style={{ background: "var(--th-border)" }} />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(129,140,248,0.15)" }}>
                <Megaphone size={18} style={{ color: "#818cf8" }} />
              </div>
              <div className="flex-1">
                <div className="font-display font-black text-xl text-foreground">Broadcast Alert</div>
                <div className="text-xs mt-0.5" style={{ color: "var(--th-muted)" }}>Send a notification to all players for this tournament</div>
              </div>
              <button onClick={() => setBroadcastOpen(false)} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white/10 transition-smooth">
                <XCircle size={16} className="text-muted-foreground" />
              </button>
            </div>

            {/* Type selector */}
            <div className="grid grid-cols-2 gap-2">
              {([
                ["roomIdReleased",      "Room ID Released",   Radio,              "#22c55e", "rgba(34,197,94,0.12)"],
                ["tournamentDelayed",   "Match Delayed",      CalendarClock,      "#fbbf24", "rgba(251,191,36,0.12)"],
                ["tournamentCancelled", "Match Cancelled",    Ban,                "#ff4500", "rgba(255,69,0,0.12)"],
                ["matchCompleted",      "Match Completed",    Trophy,             "#818cf8", "rgba(129,140,248,0.12)"],
                ["custom",             "Custom Message",     MessageSquarePlus,  "#ff6b35", "rgba(255,107,53,0.12)"],
              ] as const).map(([type, label, Icon, color, bg]) => (
                <button
                  key={type}
                  onClick={() => setBroadcastType(type)}
                  className="flex items-center gap-2 p-3 rounded-xl text-xs font-bold transition-smooth active:scale-95 text-left"
                  style={broadcastType === type
                    ? { background: bg, color, border: `1px solid ${color}55` }
                    : { background: "var(--th-input)", color: "var(--th-dim)", border: "1px solid var(--th-border2)" }}
                >
                  <Icon size={14} /> {label}
                </button>
              ))}
            </div>

            {/* Dynamic fields */}
            <div className="flex flex-col gap-3">
              {broadcastType === "roomIdReleased" && (
                <>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground mb-1 block">Room ID *</label>
                    <input value={bcRoomId} onChange={e => setBcRoomId(e.target.value)} placeholder="e.g. 12345678"
                      className="w-full h-11 rounded-xl px-4 text-sm font-mono"
                      style={{ background: "var(--th-card2)", border: "1px solid var(--th-border2)", color: "var(--th-text)" }} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground mb-1 block">Room Password</label>
                    <input value={bcRoomPass} onChange={e => setBcRoomPass(e.target.value)} placeholder="e.g. abc123"
                      className="w-full h-11 rounded-xl px-4 text-sm font-mono"
                      style={{ background: "var(--th-card2)", border: "1px solid var(--th-border2)", color: "var(--th-text)" }} />
                  </div>
                  <p className="text-xs" style={{ color: "var(--th-dim)" }}>These will appear in the player's Alerts and Room tab.</p>
                </>
              )}

              {broadcastType === "tournamentDelayed" && (
                <>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground mb-1 block">New Date & Time *</label>
                    <input type="datetime-local" value={bcDelayTime} onChange={e => setBcDelayTime(e.target.value)}
                      className="w-full h-11 rounded-xl px-4 text-sm"
                      style={{ background: "var(--th-card2)", border: "1px solid var(--th-border2)", color: "var(--th-text)" }} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground mb-1 block">Reason (optional)</label>
                    <input value={bcReason} onChange={e => setBcReason(e.target.value)} placeholder="e.g. Technical issue, low registrations..."
                      className="w-full h-11 rounded-xl px-4 text-sm"
                      style={{ background: "var(--th-card2)", border: "1px solid var(--th-border2)", color: "var(--th-text)" }} />
                  </div>
                </>
              )}

              {broadcastType === "tournamentCancelled" && (
                <div>
                  <label className="text-xs font-bold text-muted-foreground mb-1 block">Reason (optional)</label>
                  <textarea value={bcReason} onChange={e => setBcReason(e.target.value)}
                    placeholder="e.g. Not enough players, organizer unavailable..."
                    rows={3} className="w-full rounded-xl px-4 py-3 text-sm resize-none"
                    style={{ background: "var(--th-card2)", border: "1px solid var(--th-border2)", color: "var(--th-text)" }} />
                </div>
              )}

              {broadcastType === "matchCompleted" && (
                <div>
                  <label className="text-xs font-bold text-muted-foreground mb-1 block">Additional Message (optional)</label>
                  <textarea value={bcMessage} onChange={e => setBcMessage(e.target.value)}
                    placeholder="e.g. Congratulations to all participants! Results are up."
                    rows={3} className="w-full rounded-xl px-4 py-3 text-sm resize-none"
                    style={{ background: "var(--th-card2)", border: "1px solid var(--th-border2)", color: "var(--th-text)" }} />
                </div>
              )}

              {broadcastType === "custom" && (
                <>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground mb-1 block">Alert Title *</label>
                    <input value={bcTitle} onChange={e => setBcTitle(e.target.value)} placeholder="e.g. Server maintenance"
                      maxLength={60} className="w-full h-11 rounded-xl px-4 text-sm"
                      style={{ background: "var(--th-card2)", border: "1px solid var(--th-border2)", color: "var(--th-text)" }} />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground mb-1 block">Message *</label>
                    <textarea value={bcMessage} onChange={e => setBcMessage(e.target.value)}
                      placeholder="Write your announcement here..."
                      rows={3} className="w-full rounded-xl px-4 py-3 text-sm resize-none"
                      style={{ background: "var(--th-card2)", border: "1px solid var(--th-border2)", color: "var(--th-text)" }} />
                  </div>
                </>
              )}
            </div>

            {broadcastError && (
              <div className="rounded-xl px-3 py-2 text-xs font-semibold" style={{ background: "rgba(255,69,0,0.1)", color: "#ff8066", border: "1px solid rgba(255,69,0,0.25)" }}>
                {broadcastError}
              </div>
            )}
            {bcSent ? (
              <div className="flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm" style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)" }}>
                <CheckCircle size={16} /> Alert sent to players!
              </div>
            ) : (
              <button
                onClick={sendBroadcast}
                disabled={broadcastSending}
                className="w-full h-12 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-smooth active:scale-95"
                style={{ background: "linear-gradient(135deg, #818cf8, #6366f1)", color: "#fff", opacity: broadcastSending ? 0.6 : 1 }}
              >
                <Megaphone size={16} /> {broadcastSending ? "Sending…" : "Send Broadcast"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Delete modal */}
      {deleteOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)" }}>
          <div className="w-full max-w-sm rounded-2xl p-6 flex flex-col gap-4" style={{ background: "var(--th-card)" }}>
            <div className="font-display font-bold text-xl text-foreground">Delete Tournament</div>
            <p className="text-sm" style={{ color: "var(--th-muted)" }}>
              Permanently delete this tournament? This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteOpen(false)} className="flex-1 py-3 rounded-xl font-semibold text-sm" style={{ background: "var(--th-border)", color: "var(--th-muted)" }}>
                Keep Tournament
              </button>
              <button
                onClick={() => deleteTournament.mutate({ id })}
                disabled={deleteTournament.isPending}
                className="flex-1 py-3 rounded-xl font-bold text-sm"
                style={{ background: "rgba(255,69,0,0.15)", color: "#ff4500", opacity: deleteTournament.isPending ? 0.55 : 1 }}
              >
                {deleteTournament.isPending ? "Deleting…" : "Delete Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Screenshot Preview Modal */}
      {previewImg && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.9)", backdropFilter: "blur(8px)" }} onClick={() => setPreviewImg(null)}>
          <div className="relative flex flex-col items-center gap-3">
            <img src={previewImg} alt="Payment screenshot" className="max-w-full max-h-[70vh] rounded-2xl border border-white/10" />
            <button onClick={() => setPreviewImg(null)} className="px-4 py-2 rounded-xl font-bold text-xs" style={{ background: "rgba(255,255,255,0.1)", color: "#fff" }}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
