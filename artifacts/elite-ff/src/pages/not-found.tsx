import { useLocation } from "wouter";
import { Trophy } from "lucide-react";

export default function NotFound() {
  const [, navigate] = useLocation();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5 px-6 text-center">
      <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ background: "var(--th-card2)" }}>
        <Trophy size={36} style={{ color: "var(--th-dimmer)" }} />
      </div>
      <div>
        <div className="font-display font-black text-3xl text-foreground">404</div>
        <p className="text-sm mt-2" style={{ color: "var(--th-muted)" }}>This page doesn't exist</p>
      </div>
      <button
        onClick={() => navigate("/")}
        className="px-6 py-3 rounded-xl font-bold text-sm transition-smooth active:scale-95"
        style={{ background: "linear-gradient(135deg, #ff6b35, #ff4500)", color: "#0a0e27" }}
      >
        Go Home
      </button>
    </div>
  );
}
