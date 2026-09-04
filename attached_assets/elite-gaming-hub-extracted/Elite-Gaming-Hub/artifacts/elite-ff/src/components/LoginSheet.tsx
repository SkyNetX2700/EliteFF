import { useState } from "react";
import { X, Mail, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  open: boolean;
  onClose: () => void;
}

function GoogleG() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" height="22" viewBox="0 0 24 24" width="22" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      <path d="M1 1h22v22H1z" fill="none"/>
    </svg>
  );
}

export default function LoginSheet({ open, onClose }: Props) {
  const { login } = useAuth();
  const [mode, setMode] = useState<"main" | "email">("main");
  const [email, setEmail] = useState("");

  if (!open) return null;

  function handleClose() {
    setMode("main");
    setEmail("");
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
      onClick={handleClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl p-6 flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-200"
        style={{ background: "var(--th-card3)", border: "1px solid var(--th-border)", boxShadow: "0 24px 80px rgba(0,0,0,0.5)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          {mode === "email" ? (
            <button
              onClick={() => setMode("main")}
              className="flex items-center gap-1.5 text-sm font-semibold transition-smooth"
              style={{ color: "var(--th-muted)" }}
            >
              <ArrowLeft size={15} /> Back
            </button>
          ) : (
            <div className="text-2xl">🏆</div>
          )}
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-smooth hover:bg-white/10"
          >
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>

        {mode === "main" ? (
          <>
            <div className="text-center">
              <h2 className="font-display font-black text-2xl text-foreground mb-1">Welcome to Elite FF</h2>
              <p className="text-sm" style={{ color: "var(--th-muted)" }}>
                Sign in to join tournaments and track your results
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {/* Google button */}
              <button
                onClick={login}
                className="w-full rounded-xl bg-white text-[#3c4043] font-semibold text-[15px] flex items-center gap-3 px-4 py-3 transition-smooth active:scale-[0.98] hover:shadow-md"
                style={{ border: "1px solid #dadce0", boxShadow: "0 1px 3px rgba(60,64,67,0.08)" }}
              >
                <GoogleG />
                <span className="flex-1 text-left">Sign in with Google</span>
              </button>

              {/* Email button */}
              <button
                onClick={() => setMode("email")}
                className="w-full rounded-xl bg-white text-[#3c4043] font-semibold text-[15px] flex items-center gap-3 px-4 py-3 transition-smooth active:scale-[0.98] hover:shadow-md"
                style={{ border: "1px solid #dadce0", boxShadow: "0 1px 3px rgba(60,64,67,0.08)" }}
              >
                <Mail size={20} className="text-[#5f6368]" />
                <span className="flex-1 text-left">Sign up with Email</span>
              </button>
            </div>

            <p className="text-center text-xs" style={{ color: "var(--th-dimmer)" }}>
              Your account works across all devices automatically.
            </p>
          </>
        ) : (
          <>
            <div className="text-center">
              <h2 className="font-display font-black text-xl text-foreground mb-1">Sign up with Email</h2>
              <p className="text-sm" style={{ color: "var(--th-muted)" }}>
                Enter your email to create or sign in to your account
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold" style={{ color: "var(--th-muted)" }}>Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoFocus
                  className="w-full rounded-xl px-4 py-3 text-sm font-medium outline-none transition-smooth"
                  style={{
                    background: "var(--th-input)",
                    border: "1px solid var(--th-border)",
                    color: "var(--th-text)",
                  }}
                  onKeyDown={e => { if (e.key === "Enter") login(); }}
                />
              </div>

              <button
                onClick={login}
                className="w-full rounded-xl py-3 text-sm font-black transition-smooth active:scale-[0.98]"
                style={{ background: "linear-gradient(135deg, #ff6b35 0%, #ff4500 100%)", color: "#fff" }}
              >
                Continue with Email
              </button>

              <div className="flex items-center gap-3 my-1">
                <div className="flex-1 h-px" style={{ background: "var(--th-border)" }} />
                <span className="text-xs font-semibold" style={{ color: "var(--th-dim)" }}>or</span>
                <div className="flex-1 h-px" style={{ background: "var(--th-border)" }} />
              </div>

              <button
                onClick={login}
                className="w-full rounded-xl bg-white text-[#3c4043] font-semibold text-[15px] flex items-center gap-3 px-4 py-3 transition-smooth active:scale-[0.98]"
                style={{ border: "1px solid #dadce0", boxShadow: "0 1px 3px rgba(60,64,67,0.08)" }}
              >
                <GoogleG />
                <span className="flex-1 text-left">Continue with Google instead</span>
              </button>
            </div>

            <p className="text-center text-xs" style={{ color: "var(--th-dimmer)" }}>
              By continuing, you agree to our Terms & Privacy Policy.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
