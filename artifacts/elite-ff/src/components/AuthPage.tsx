import { useState } from "react";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { isSupabaseConfigured } from "@/lib/auth";

interface Props {
  kind: "sign-in" | "sign-up";
  basePath: string;
}

export default function AuthPage({ basePath }: Props) {
  const [, navigate] = useLocation();
  const { authReady, signInWithGoogle, authError } = useAuth();
  const [redirecting, setRedirecting] = useState(false);

  function continueWithGoogle() {
    setRedirecting(true);
    signInWithGoogle();
  }

  if (!isSupabaseConfigured()) {
    return (
      <div className="min-h-dvh flex items-center justify-center px-4" style={{ background: "var(--th-bg)" }}>
        <div className="w-full max-w-md rounded-3xl p-6 text-center" style={{ background: "var(--th-card)", border: "1px solid var(--th-border)" }}>
          <div className="font-display font-black text-2xl mb-2" style={{ color: "var(--th-text)" }}>Login setup needed</div>
          <p className="text-sm mb-5" style={{ color: "var(--th-muted)" }}>Google Authentication is not configured for this app yet.</p>
          <button onClick={() => navigate(basePath || "/")} className="inline-flex rounded-xl px-4 py-2.5 text-sm font-bold" style={{ background: "var(--gradient-primary)", color: "#0a0e27" }}>
            Back to Elite FF
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-4 py-8" style={{ background: "var(--th-bg)" }}>
      <div className="w-full max-w-md">
        <button onClick={() => navigate(basePath || "/")} className="flex items-center gap-2 text-sm mb-5" style={{ color: "var(--th-muted)" }}>
          <ArrowLeft size={16} /> Back to Elite FF
        </button>
        <div className="rounded-3xl p-6" style={{ background: "var(--th-card)", border: "1px solid var(--th-border)", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: "rgba(255,107,53,0.14)", color: "#ff6b35" }}>
              <ShieldCheck size={23} />
            </div>
            <div>
              <div className="font-display font-black text-2xl text-foreground">Welcome to Elite FF</div>
              <div className="text-xs mt-1" style={{ color: "var(--th-muted)" }}>Sign in securely with your Google account</div>
            </div>
          </div>

          <p className="text-sm leading-6 mb-5" style={{ color: "var(--th-muted)" }}>
            Use your Google account to join tournaments, track results, and manage your player profile.
          </p>
          {authError && <p className="text-xs font-semibold mb-4" style={{ color: "#ff6b35" }}>{authError}</p>}
          <button
            onClick={continueWithGoogle}
            disabled={!authReady || redirecting}
            className="w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-3 disabled:opacity-60"
            style={{ background: "var(--gradient-primary)", color: "#0a0e27" }}
          >
            {redirecting ? <Loader2 size={17} className="animate-spin" /> : (
              <span className="w-7 h-7 rounded-full bg-white flex items-center justify-center">
                <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M21.35 12.27c0-.79-.07-1.55-.2-2.27H12v4.3h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.42Z" />
                  <path fill="#34A853" d="M12 21.5c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.7-1.72-5.47-4.03H3.28v2.53A9.74 9.74 0 0 0 12 21.5Z" />
                  <path fill="#FBBC05" d="M6.53 13.58A5.85 5.85 0 0 1 6.23 12c0-.55.1-1.09.3-1.58V7.89H3.28A9.5 9.5 0 0 0 2.25 12c0 1.48.35 2.88 1.03 4.11l3.25-2.53Z" />
                  <path fill="#EA4335" d="M12 6.39c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.83 3.49 14.63 2.5 12 2.5a9.74 9.74 0 0 0-8.72 5.39l3.25 2.53C7.3 8.11 9.46 6.39 12 6.39Z" />
                </svg>
              </span>
            )}
            {redirecting ? "Opening Google..." : "Continue with Google"}
          </button>
          <p className="text-[11px] text-center mt-4" style={{ color: "var(--th-dim)" }}>
            You will be redirected to Google to continue.
          </p>
        </div>
      </div>
    </div>
  );
}