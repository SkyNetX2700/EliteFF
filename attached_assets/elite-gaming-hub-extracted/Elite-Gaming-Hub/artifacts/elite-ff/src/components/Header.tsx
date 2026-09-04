import { useState } from "react";
import { useLocation } from "wouter";
import { Bell, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAppContext } from "@/contexts/AppContext";
import LoginSheet from "./LoginSheet";

export default function Header() {
  const { user, logout } = useAuth();
  const { unreadCount, appName, logoUrl } = useAppContext();
  const [, navigate] = useLocation();
  const [authOpen, setAuthOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const initials = user
    ? user.username.slice(0, 2).toUpperCase()
    : null;

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 max-w-md mx-auto"
        style={{
          background: "var(--th-card)",
          borderBottom: "1px solid var(--th-border)",
          boxShadow: "0 2px 20px rgba(0,0,0,0.25)",
        }}
      >
        {/* Logo + Name */}
        <button
          className="flex items-center gap-2.5 transition-smooth active:scale-95"
          onClick={() => navigate("/")}
        >
          <div className="w-8 h-8 rounded-xl overflow-hidden flex-shrink-0">
            <img
              src={logoUrl}
              alt="Elite FF Logo"
              className="w-full h-full object-cover"
              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </div>
          <span
            className="font-display font-black text-lg leading-none tracking-tight"
            style={{ color: "var(--th-text)" }}
          >
            <span style={{ color: "#ff6b35" }}>{appName.split(" ")[0]}</span>
            {appName.includes(" ") ? (
              <span className="ml-1">{appName.split(" ").slice(1).join(" ")}</span>
            ) : null}
          </span>
        </button>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* Bell */}
          <button
            className="w-9 h-9 rounded-xl flex items-center justify-center relative transition-smooth active:scale-90"
            style={{ color: "var(--th-text)" }}
            onClick={() => navigate("/alerts")}
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-xs font-black text-white"
                style={{ background: "#ff4500", fontSize: "10px" }}
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {/* Profile / Login */}
          {user ? (
            <button
              onClick={() => setProfileOpen(v => !v)}
              className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm transition-smooth active:scale-90 overflow-hidden"
              style={
                user.profileImageUrl
                  ? {}
                  : { background: "linear-gradient(135deg, #ff6b35 0%, #ff4500 100%)", color: "#fff" }
              }
            >
              {user.profileImageUrl ? (
                <img src={user.profileImageUrl} alt={user.username} className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </button>
          ) : (
            <button
              onClick={() => setAuthOpen(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold transition-smooth active:scale-95"
              style={{ background: "linear-gradient(135deg, #ff6b35 0%, #ff4500 100%)", color: "#fff" }}
            >
              Login
            </button>
          )}
        </div>
      </header>

      {/* Profile dropdown */}
      {profileOpen && user && (
        <div
          className="fixed top-14 right-4 z-50 rounded-2xl p-3 min-w-[200px] shadow-2xl"
          style={{ background: "var(--th-card)", border: "1px solid var(--th-border)" }}
        >
          <div className="px-1 pb-2 mb-2" style={{ borderBottom: "1px solid var(--th-border)" }}>
            <div className="text-xs font-bold truncate max-w-[180px]" style={{ color: "var(--th-text)" }}>
              {user.username}
            </div>
            {user.email && (
              <div className="text-xs truncate max-w-[180px]" style={{ color: "var(--th-muted)" }}>
                {user.email}
              </div>
            )}
            <div className="text-xs mt-0.5 font-semibold" style={{ color: "#ff6b35" }}>
              {user.isHost ? "Host" : "Player"}
            </div>
          </div>

          <button
            onClick={() => { logout(); setProfileOpen(false); }}
            className="w-full flex items-center gap-3 p-2 rounded-xl text-sm transition-smooth"
            style={{ color: "var(--th-muted)" }}
          >
            <LogOut size={14} className="ml-1.5" />
            <span>Log out</span>
          </button>
        </div>
      )}

      {profileOpen && <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />}

      <LoginSheet open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  );
}
