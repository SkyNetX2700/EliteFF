import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import {
  ArrowLeft, Search, CheckCircle, XCircle, Clock,
  Users, CreditCard, Phone, Hash, ZoomIn, X,
  CheckCheck, ChevronDown, ChevronUp, AlertCircle,
} from "lucide-react";
import {
  useGetTournament,
  useGetRegistrations,
  useVerifyRegistration,
  useDeclineRegistration,
} from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAppContext } from "@/contexts/AppContext";
import { useQueryClient } from "@tanstack/react-query";

type FilterTab = "pending" | "approved" | "declined" | "all";

const inpStyle = {
  background: "var(--th-card2)",
  border: "1px solid var(--th-border2)",
  color: "var(--th-text)",
} as const;

function isVerified(status: string) { return status === "verified" || status === "approved"; }

function statusBadge(status: string) {
  if (isVerified(status)) return { bg: "rgba(34,197,94,0.12)", color: "#22c55e", icon: <CheckCircle size={11} />, label: "Approved" };
  if (status === "declined") return { bg: "rgba(255,69,0,0.12)", color: "#ff4500", icon: <XCircle size={11} />, label: "Declined" };
  return { bg: "rgba(251,191,36,0.12)", color: "#fbbf24", icon: <Clock size={11} />, label: "Pending" };
}

export default function PaymentVerification() {
  const [, params] = useRoute("/tournaments/:id/payments");
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { addAlert } = useAppContext();
  const qc = useQueryClient();
  const id = parseInt(params?.id || "0");

  const [filterTab, setFilterTab] = useState<FilterTab>("pending");
  const [search, setSearch] = useState("");
  const [imgModal, setImgModal] = useState<string | null>(null);
  const [declineTarget, setDeclineTarget] = useState<number | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [approvingAll, setApprovingAll] = useState(false);

  const { data: tournament } = useGetTournament(id, { query: { queryKey: ["getTournament", id] } as any });
  const { data: registrations = [], isLoading, refetch } = useGetRegistrations(
    { tournamentId: id },
    { query: { enabled: true, queryKey: ["getRegistrations", id] } as any },
  );

  const verifyReg = useVerifyRegistration({
    mutation: {
      onSuccess: (_, vars) => {
        qc.invalidateQueries({ queryKey: ["getRegistrations", id] });
        addAlert({ type: "verified", title: "Approved!", message: `Registration #${vars.id} has been approved.` });
        setApprovingAll(false);
      },
    },
  });

  const declineReg = useDeclineRegistration({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["getRegistrations", id] });
        setDeclineTarget(null);
        setDeclineReason("");
      },
    },
  });

  if (!user?.isHost) {
    return (
      <div className="flex items-center justify-center py-20 px-6 text-center">
        <p className="text-muted-foreground">Host access required</p>
      </div>
    );
  }

  const allRegs = registrations as any[];

  const counts = {
    pending: allRegs.filter(r => r.status === "pending").length,
    approved: allRegs.filter(r => isVerified(r.status)).length,
    declined: allRegs.filter(r => r.status === "declined").length,
    all: allRegs.length,
  };

  const filtered = allRegs
    .filter(r => filterTab === "all" || (filterTab === "approved" ? isVerified(r.status) : r.status === filterTab))
    .filter(r => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (r.squadName || r.playerName || "").toLowerCase().includes(q)
        || (r.playerNames || "").toLowerCase().includes(q)
        || (r.utrNumber || "").toLowerCase().includes(q);
    });

  const pendingRegs = allRegs.filter(r => r.status === "pending");

  async function approveAll() {
    setApprovingAll(true);
    for (const reg of pendingRegs) {
      await new Promise<void>(resolve => {
        verifyReg.mutate({ id: reg.id, data: {} }, { onSettled: () => resolve() });
      });
    }
    qc.invalidateQueries({ queryKey: ["getRegistrations", id] });
    setApprovingAll(false);
  }

  function handleDecline() {
    if (declineTarget === null) return;
    declineReg.mutate({ id: declineTarget, data: { reason: declineReason || "Not approved" } as any });
  }

  const TABS: { id: FilterTab; label: string; count: number }[] = [
    { id: "pending", label: "Pending", count: counts.pending },
    { id: "approved", label: "Approved", count: counts.approved },
    { id: "declined", label: "Declined", count: counts.declined },
    { id: "all", label: "All", count: counts.all },
  ];

  return (
    <div className="flex flex-col gap-4 pb-10">
      {/* Header */}
      <div className="px-4 pt-4 flex flex-col gap-3">
        <button onClick={() => navigate(`/tournaments/${id}`)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-smooth">
          <ArrowLeft size={16} /> Back to Tournament
        </button>

        <div className="flex items-center justify-between">
          <div className="font-display font-black text-2xl text-foreground">Verify Payments</div>
          <button onClick={() => refetch()} className="text-xs font-bold px-3 py-1.5 rounded-xl transition-smooth" style={{ background: "var(--th-border)", color: "var(--th-muted)" }}>
            Refresh
          </button>
        </div>

        {/* Tournament name */}
        {tournament && (
          <div className="rounded-2xl px-4 py-3 flex items-center gap-3" style={{ background: "var(--th-card)", border: "1px solid var(--th-border)" }}>
            <CreditCard size={15} style={{ color: "#ff6b35" }} />
            <div className="flex-1 min-w-0">
              <div className="font-display font-bold text-foreground text-sm truncate">{tournament.name}</div>
              <div className="text-xs mt-0.5" style={{ color: "var(--th-dim)" }}>
                {counts.pending} pending · {counts.approved} approved · {counts.all} total
              </div>
            </div>
          </div>
        )}

        {/* Bulk approve */}
        {counts.pending > 1 && filterTab === "pending" && (
          <button
            onClick={approveAll}
            disabled={approvingAll}
            className="w-full h-10 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-smooth active:scale-95 disabled:opacity-50"
            style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" }}
          >
            {approvingAll
              ? <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
              : <CheckCheck size={16} />}
            {approvingAll ? "Approving…" : `Approve All ${counts.pending} Pending`}
          </button>
        )}

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by squad name or UTR…"
            className="w-full h-10 rounded-xl pl-9 pr-4 text-sm"
            style={inpStyle}
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X size={13} className="text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setFilterTab(t.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold flex-shrink-0 transition-smooth"
              style={filterTab === t.id
                ? { background: "linear-gradient(135deg, #ff6b35, #ff4500)", color: "#0a0e27" }
                : { background: "var(--th-card2)", color: "var(--th-muted)", border: "1px solid var(--th-border2)" }}
            >
              {t.label}
              {t.count > 0 && (
                <span
                  className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black"
                  style={filterTab === t.id
                    ? { background: "rgba(0,0,0,0.25)" }
                    : t.id === "pending" && t.count > 0
                    ? { background: "rgba(251,191,36,0.2)", color: "#fbbf24" }
                    : { background: "var(--th-border2)" }}
                >
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Cards */}
      <div className="px-4 flex flex-col gap-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl p-4 animate-pulse" style={{ background: "var(--th-card)", height: 110 }} />
          ))
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl p-10 flex flex-col items-center gap-3 text-center" style={{ background: "var(--th-card)", border: "1px solid var(--th-border)" }}>
            <AlertCircle size={28} style={{ color: "var(--th-dimmer)" }} />
            <div>
              <div className="font-display font-bold text-foreground mb-1">No registrations found</div>
              <p className="text-sm" style={{ color: "var(--th-muted)" }}>
                {search ? `No results for "${search}"` : `No ${filterTab === "all" ? "" : filterTab} registrations yet.`}
              </p>
            </div>
          </div>
        ) : (
          filtered.map((reg: any) => {
            const badge = statusBadge(reg.status);
            const isExpanded = expandedId === reg.id;
            const screenshot = reg.paymentScreenshotUrl || reg.paymentScreenshot;
            const squadName = reg.squadName || reg.playerName || "Unknown";
            const mobile = reg.mobile || (reg.playerNames || "").split("|")[1]?.trim() || "";

            return (
              <div
                key={reg.id}
                className="rounded-2xl overflow-hidden transition-all duration-200"
                style={{
                  background: "var(--th-card)",
                  border: isVerified(reg.status)
                    ? "1px solid rgba(34,197,94,0.2)"
                    : reg.status === "declined"
                    ? "1px solid rgba(255,69,0,0.2)"
                    : "1px solid var(--th-border)",
                }}
              >
                {/* Main row */}
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Screenshot thumbnail */}
                    {screenshot ? (
                      <button
                        onClick={() => setImgModal(screenshot)}
                        className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 relative group"
                        title="View payment screenshot"
                      >
                        <img src={screenshot} alt="Payment" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "rgba(0,0,0,0.5)" }}>
                          <ZoomIn size={16} style={{ color: "#fff" }} />
                        </div>
                      </button>
                    ) : (
                      <div className="w-14 h-14 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ background: "var(--th-card2)" }}>
                        <CreditCard size={20} style={{ color: "var(--th-dimmer)" }} />
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="font-display font-bold text-foreground text-sm truncate flex-1">{squadName}</div>
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold flex-shrink-0"
                          style={{ background: badge.bg, color: badge.color }}>
                          {badge.icon}
                          <span>{badge.label}</span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-0.5">
                        {mobile && (
                          <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--th-muted)" }}>
                            <Phone size={10} /> {mobile}
                          </div>
                        )}
                        {reg.utrNumber && reg.utrNumber !== "-" && (
                          <div className="flex items-center gap-1.5 text-xs font-mono" style={{ color: "var(--th-muted)" }}>
                            <Hash size={10} /> UTR: {reg.utrNumber}
                          </div>
                        )}
                        {reg.playerNames && (
                          <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--th-dim)" }}>
                            <Users size={10} /> {reg.playerNames}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Expand toggle */}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : reg.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-smooth flex-shrink-0 mt-0.5"
                    >
                      {isExpanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                    </button>
                  </div>

                  {/* Action buttons — pending only */}
                  {reg.status === "pending" && (
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => verifyReg.mutate({ id: reg.id, data: {} })}
                        disabled={verifyReg.isPending}
                        className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl text-xs font-black transition-smooth active:scale-95 disabled:opacity-50"
                        style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)" }}
                      >
                        <CheckCircle size={13} /> Approve
                      </button>
                      <button
                        onClick={() => { setDeclineTarget(reg.id); setDeclineReason(""); }}
                        className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl text-xs font-black transition-smooth active:scale-95"
                        style={{ background: "rgba(255,69,0,0.12)", color: "#ff4500", border: "1px solid rgba(255,69,0,0.3)" }}
                      >
                        <XCircle size={13} /> Decline
                      </button>
                    </div>
                  )}
                </div>

                {/* Expanded: full screenshot */}
                {isExpanded && screenshot && (
                  <div className="px-4 pb-4">
                    <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "var(--th-dim)" }}>Payment Screenshot</div>
                    <button onClick={() => setImgModal(screenshot)} className="w-full block">
                      <img
                        src={screenshot}
                        alt="Full payment screenshot"
                        className="w-full rounded-xl object-contain max-h-64"
                        style={{ background: "var(--th-card3)" }}
                      />
                      <div className="flex items-center justify-center gap-1 mt-1.5 text-xs font-bold" style={{ color: "#ff6b35" }}>
                        <ZoomIn size={12} /> Tap to view full screen
                      </div>
                    </button>
                  </div>
                )}

                {isExpanded && !screenshot && (
                  <div className="px-4 pb-4">
                    <div className="rounded-xl p-4 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed var(--th-border2)" }}>
                      <p className="text-xs" style={{ color: "var(--th-dim)" }}>No payment screenshot uploaded</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Full-screen image modal */}
      {imgModal && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.94)" }}
          onClick={() => setImgModal(null)}
        >
          <button
            onClick={() => setImgModal(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center z-10"
            style={{ background: "rgba(255,255,255,0.12)" }}
          >
            <X size={18} style={{ color: "#fff" }} />
          </button>
          <img
            src={imgModal}
            alt="Payment screenshot"
            className="max-w-full max-h-full rounded-2xl object-contain"
            onClick={e => e.stopPropagation()}
          />
          <p className="absolute bottom-6 text-xs font-semibold" style={{ color: "rgba(255,255,255,0.4)" }}>
            Tap outside to close
          </p>
        </div>
      )}

      {/* Decline bottom sheet */}
      {declineTarget !== null && (
        <div
          className="fixed inset-0 z-[150] flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
          onClick={() => setDeclineTarget(null)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl p-6 flex flex-col gap-4 animate-in slide-in-from-bottom duration-250"
            style={{ background: "var(--th-card3)", border: "1px solid var(--th-border)" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="font-display font-bold text-xl text-foreground">Decline Registration</div>
              <button onClick={() => setDeclineTarget(null)} className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white/10 transition-smooth">
                <X size={16} className="text-muted-foreground" />
              </button>
            </div>

            <p className="text-sm" style={{ color: "var(--th-muted)" }}>
              Provide a reason so the player knows why they were declined. This is optional but recommended.
            </p>

            <div>
              <label className="text-xs font-bold text-muted-foreground mb-1.5 block">Reason (optional)</label>
              <textarea
                value={declineReason}
                onChange={e => setDeclineReason(e.target.value)}
                placeholder="e.g. Payment not received, Invalid UTR, Screenshot unclear…"
                rows={3}
                className="w-full rounded-xl px-3 py-2.5 text-sm resize-none"
                style={inpStyle}
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setDeclineTarget(null)}
                className="flex-1 h-11 rounded-xl text-sm font-bold transition-smooth"
                style={{ background: "var(--th-border)", color: "var(--th-muted)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleDecline}
                disabled={declineReg.isPending}
                className="flex-1 h-11 rounded-xl text-sm font-black flex items-center justify-center gap-2 transition-smooth active:scale-95 disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #ff4500, #cc3300)", color: "#fff" }}
              >
                {declineReg.isPending
                  ? <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  : <XCircle size={15} />}
                {declineReg.isPending ? "Declining…" : "Decline"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
