import { useState } from "react";
import {
  Bell, Trash2, CheckCheck, Trophy, Star, Frown, X, Clock,
  Key, ShieldCheck, AlertCircle, Copy, RefreshCw
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { useGetNotifications, useMarkNotificationRead, useDeleteNotification } from "@workspace/api-client-react";

function timeAgo(ts: string | number) {
  const d = typeof ts === "string" ? new Date(ts).getTime() : ts;
  const diff = Date.now() - d;
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
  general: { icon: Bell, color: "#ff6b35", bg: "rgba(255,107,53,0.12)", label: "Notification" },
  verification_success: { icon: ShieldCheck, color: "#22c55e", bg: "rgba(34,197,94,0.12)", label: "Verified!" },
  cancelled: { icon: AlertCircle, color: "#ff4500", bg: "rgba(255,69,0,0.12)", label: "Registration Declined" },
};

function AlertCard({ alert, onDelete, onRead, onNavigate }: {
  alert: any; onDelete: () => void; onRead: () => void; onNavigate?: () => void;
}) {
  const cfg = ALERT_CONFIG[alert.type] ?? ALERT_CONFIG.general;
  const Icon = cfg.icon;
  const isRead = alert.isRead ?? alert.read ?? true;

  function handleClick() {
    if (!isRead) onRead();
    if (alert.tournamentId && onNavigate) onNavigate();
  }

  return (
    <div
      className="relative rounded-2xl overflow-hidden transition-all duration-200"
      style={{
        background: isRead ? "var(--th-card)" : "var(--th-input)",
        border: `1px solid ${isRead ? "var(--th-border)" : "rgba(255,107,53,0.2)"}`,
        cursor: alert.tournamentId ? "pointer" : "default",
      }}
      onClick={handleClick}
    >
      {!isRead && (
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
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-xs" style={{ color: "var(--th-dimmer)" }}>{timeAgo(alert.createdAt)}</span>
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
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [refreshKey, setRefreshKey] = useState(0);

  const { data: notifications = [], isLoading } = useGetNotifications(
    { query: { enabled: !!user, queryKey: ["getNotifications", refreshKey] } as any },
  );

  const markRead = useMarkNotificationRead();
  const deleteNotif = useDeleteNotification();

  const unreadCount = notifications.filter((n: any) => !n.isRead).length;

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
        <div className="flex items-center gap-2">
          {notifications.length > 0 && (
            <button
              onClick={() => setRefreshKey(k => k + 1)}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-smooth hover:bg-white/10 active:scale-90"
            >
              <RefreshCw size={16} className="text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : notifications.length === 0 ? (
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
          {notifications.map((alert: any) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onDelete={() => deleteNotif.mutate({ id: alert.id })}
              onRead={() => markRead.mutate({ id: alert.id })}
              onNavigate={alert.tournamentId ? () => navigate(`/tournaments/${alert.tournamentId}`) : undefined}
            />
          ))}
          <p className="center text-xs pt-2" style={{ color: "var(--th-dimmer)" }}>
            {notifications.length} notification{notifications.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}
    </div>
  );
}
