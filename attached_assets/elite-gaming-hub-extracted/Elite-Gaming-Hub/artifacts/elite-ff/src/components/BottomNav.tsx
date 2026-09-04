import { useLocation } from "wouter";
import { House, Trophy, ChartNoAxesColumn, Settings, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import CreateTournamentModal from "./CreateTournamentModal";

const NAV_ITEMS = [
  { label: "Home", icon: House, path: "/" },
  { label: "Tournaments", icon: Trophy, path: "/tournaments" },
  { label: "Results", icon: ChartNoAxesColumn, path: "/results" },
  { label: "Settings", icon: Settings, path: "/settings" },
];

export default function BottomNav() {
  const [location, navigate] = useLocation();
  const { user } = useAuth();
  const isHost = user?.role === "host";
  const [createOpen, setCreateOpen] = useState(false);

  const leftItems = NAV_ITEMS.slice(0, 2);
  const rightItems = NAV_ITEMS.slice(2);

  function NavBtn({ item }: { item: typeof NAV_ITEMS[0] }) {
    const active = location === item.path || (item.path !== "/" && location.startsWith(item.path));
    return (
      <button
        onClick={() => navigate(item.path)}
        className="flex flex-col items-center justify-center gap-1 flex-1 py-2 transition-smooth active:scale-90"
      >
        <item.icon
          size={20}
          style={{ color: active ? "#ff6b35" : "var(--th-muted)", strokeWidth: active ? 2.5 : 1.75 }}
        />
        <span
          className="text-xs font-bold"
          style={{ color: active ? "#ff6b35" : "var(--th-muted)", fontSize: "10px" }}
        >
          {item.label}
        </span>
      </button>
    );
  }

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex items-stretch max-w-md mx-auto"
        style={{
          background: "var(--th-card)",
          borderTop: "1px solid var(--th-border)",
          boxShadow: "0 -4px 20px rgba(0,0,0,0.2)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {isHost ? (
          <>
            <div className="flex flex-1">
              {leftItems.map(item => <NavBtn key={item.path} item={item} />)}
            </div>
            {/* Center FAB */}
            <div className="flex items-center justify-center px-2 py-1">
              <button
                onClick={() => setCreateOpen(true)}
                className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-smooth active:scale-90 hover:scale-105"
                style={{ background: "linear-gradient(135deg, #ff6b35 0%, #ff4500 100%)" }}
              >
                <Plus size={22} className="text-white" strokeWidth={2.5} />
              </button>
            </div>
            <div className="flex flex-1">
              {rightItems.map(item => <NavBtn key={item.path} item={item} />)}
            </div>
          </>
        ) : (
          NAV_ITEMS.map(item => <NavBtn key={item.path} item={item} />)
        )}
      </nav>

      <CreateTournamentModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}
