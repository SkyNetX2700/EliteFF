import { Bell, Trash2, CheckCheck, Trophy, Star, Frown, X, Clock, Key, ShieldCheck, AlertCircle, Copy } from "lucide-react";
import { useAppContext, Alert } from "@/contexts/AppContext";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

const ALERT_CONFIG: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  verified: { icon: ShieldCheck, color: "#22c55e", bg: "rgba(34,197,94,0.12)", label: "Verified!" },
  congratulations: { icon: Trophy, color: "#fbbf24", bg: "rgba(251,191,36,0.12)", label: "You Won!" },
  betterLuckNext: { icon: Frown, color: "var(--th-muted)", bg: "rgba(255,255,255,0.06)", label: "Better Luck Next Time" },
  declined: { icon: X, color: "#ff4500", bg: "rgba(255,69,0,0.12)", label: "Registration Declined" },
  tournamentCancelled: { icon: AlertCircle, color: "#ff4500", bg: "rgba(255,69,0,0.12)", label: "Tournament Cancelled" },
  tournamentDelayed: { icon: Clock, color: "#fbbf24", bg: "rgba(251,191,36,0.12)", label: "Tournament Delayed" },
  roomIdReleased: { icon: Key, color: "#818cf8", bg: "rgba(129,140,248,0.12)", label: "Room ID/Password Uploaded" },
  verificationPending: { icon: Clock, color: "#ff6b35", bg: "rgba(255,107,53,0.12)", label: "Verification Pending" },
  matchCompleted: { icon: Star, color: "#22c55e", bg: "rgba(34,197,94,0.12)", label: "Match Completed" },
  registrationSubmitted: { icon: Bell, color: "#ff6b35", bg: "rgba(255,107,53,0.12)", label: "Player registration submitted" },
  paymentUpdated: { icon: Bell, color: "#ff6b35", bg: "rgba(255,107,53,0.12)", label: "Payment Details Updated" },
};

function AlertCard({ alert, onDelete, onRead, onNavigate }: { alert: Alert; onDelete: () => void; onRead: () => void; onNavigate?: () => void }) {
  const cfg = ALERT_CONFIG[alert.type] ?? ALERT_CONFIG.verified;
  const Icon = cfg.icon;

  function handleClick() {
    onRead();
    if (alert.tournamentId && onNavigate) onNavigate();
  }

  return (
    <div
      className="relative rounded-2xl overflow-hidden transition-all duration-200"
      style={{
        background: alert.read ? "var(--th-card)" : "var(--th-input)",
        border: `1px solid ${alert.read ? "var(--th-border)" : "rgba(255,107,53,0.2)"}`,
        cursor: alert.tournamentId ? "pointer" : "default",
      }}
      onClick={handleClick}
    >
      {!alert.read && (
        <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl" style={{ background: "linear-gradient(135deg, #ff6b35, #ff4500)" }} />
      )}
      <div className="p-4 pl-5 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: cfg.bg }}>
            <Icon size={18} style={{ color: cfg.color }} />
          </div>
          <div className="flex-1 min-w-0 pr-8">
            <div className="font-display font-bold text-sm text-foreground leading-snug">{cfg.label}</div>
            <p className="text-xs mt-1 leading-relaxed line-clamp-3" style={{ color: "var(--th-muted)" }}>
              {alert.message}
            </p>
            {/* Room ID / Password — tap to copy */}
            {alert.extra?.roomId && (
              <div className="mt-2 flex flex-col gap-1.5">
                <button
                  onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(alert.extra!.roomId).catch(() => {}); }}
                  className="flex items-center justify-between px-3 py-2 rounded-xl active:scale-95 transition-smooth w-full"
                  style={{ background: "rgba(129,140,248,0.12)", border: "1px solid rgba(129,140,248,0.25)" }}
                >
                  <div className="flex items-center gap-2">
                    <Key size={12} style={{ color: "#818cf8" }} />
                    <span className="text-xs font-bold" style={{ color: "var(--th-muted)" }}>Room ID</span>
                    <span className="text-xs font-black font-mono" style={{ color: "#818cf8" }}>{alert.extra.roomId}</span>
                  </div>
                  <Copy size={11} style={{ color: "#818cf8" }} />
                </button>
                {alert.extra.roomPassword && (
                  <button
                    onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(alert.extra!.roomPassword).catch(() => {}); }}
                    className="flex items-center justify-between px-3 py-2 rounded-xl active:scale-95 transition-smooth w-full"
                    style={{ background: "rgba(129,140,248,0.08)", border: "1px solid rgba(129,140,248,0.18)" }}
                  >
                    <div className="flex items-center gap-2">
                      <Key size={12} style={{ color: "#818cf8", opacity: 0.7 }} />
                      <span className="text-xs font-bold" style={{ color: "var(--th-muted)" }}>Password</span>
                      <span className="text-xs font-black font-mono" style={{ color: "#a5b4fc" }}>{alert.extra.roomPassword}</span>
                    </div>
                    <Copy size={11} style={{ color: "#818cf8", opacity: 0.7 }} />
                  </button>
                )}
              </div>
            )}
            {alert.extra?.newTime && (
              <div className="mt-2 px-2.5 py-1.5 rounded-lg text-xs flex items-start gap-1.5" style={{ background: "rgba(251,191,36,0.1)", color: "#fbbf24" }}>
                <Clock size={12} className="flex-shrink-0 mt-0.5" />
                <span>New Time: {alert.extra.newTime}</span>
              </div>
            )}
            {alert.extra?.reason && (
              <div className="mt-2 px-2.5 py-1.5 rounded-lg text-xs" style={{ background: "rgba(255,69,0,0.1)", color: "#ff4500" }}>
                Reason: {alert.extra.reason}
              </div>
            )}
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-xs" style={{ color: "var(--th-dimmer)" }}>{timeAgo(alert.timestamp)}</span>
              {alert.tournamentId && (
                <span className="text-xs font-bold" style={{ color: "#ff6b35" }}>Tap to view →</span>
              )}
            </div>
          </div>
        </div>
        <button
          className="absolute top-3 right-3 w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-90"
          onClick={e => { e.stopPropagation(); onDelete(); }}
          style={{ background: "rgba(255,255,255,0.05)" }}
        >
          <Trash2 size={14} className="text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}

export default function Alerts() {
  const { alerts, markAlertRead, markAllRead, deleteAlert } = useAppContext();
  const { user } = useAuth();
  const [, navigate] = useLocation();

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-5 text-center px-6" data-testid="alerts.page">
        <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: "var(--th-card2)" }}>
          <Bell size={36} style={{ color: "var(--th-dimmer)" }} />
        </div>
        <div>
          <div className="font-display font-black text-2xl text-foreground leading-tight">Your Notifications</div>
          <p className="text-sm mt-2 max-w-xs" style={{ color: "var(--th-muted)" }}>
            Log in to see your notifications
          </p>
          <p className="text-xs mt-1" style={{ color: "var(--th-dim)" }}>
            You'll be notified about verifications, room IDs, tournament updates, and match results.
          </p>
        </div>
        <button
          onClick={() => navigate("/settings")}
          className="px-6 py-2.5 rounded-xl text-sm font-bold transition-smooth active:scale-95"
          style={{ background: "linear-gradient(135deg, #ff6b35, #ff4500)", color: "#0a0e27" }}
        >
          Go to Login
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 flex flex-col gap-3" data-testid="alerts.page">
      <div className="flex items-center justify-between px-1">
        <div className="font-display font-black text-2xl text-foreground leading-tight">Notifications</div>
        {alerts.length > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl transition-all duration-200 active:scale-95"
            style={{ background: "rgba(255,107,53,0.12)", color: "#ff6b35" }}
            data-testid="alerts.mark_all_read.button"
          >
            <CheckCheck size={14} /> Mark all read
          </button>
        )}
      </div>

      {alerts.length === 0 ? (
        <div className="rounded-2xl p-14 flex flex-col items-center gap-4 text-center" style={{ background: "var(--th-card)" }} data-testid="alerts.empty_state">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl" style={{ background: "var(--th-card2)" }}>
            🔔
          </div>
          <div>
            <div className="font-display font-bold text-foreground text-base">All caught up</div>
            <p className="text-xs mt-1" style={{ color: "var(--th-muted)" }}>No notifications yet</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {alerts.map(alert => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onDelete={() => deleteAlert(alert.id)}
              onRead={() => markAlertRead(alert.id)}
              onNavigate={alert.tournamentId ? () => navigate(`/tournaments/${alert.tournamentId}`) : undefined}
            />
          ))}
          <p className="text-center text-xs pt-2" style={{ color: "var(--th-dimmer)" }}>
            {alerts.length} notification{alerts.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}
    </div>
  );
}
