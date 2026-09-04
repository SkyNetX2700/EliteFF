import { FormEvent, useState } from "react";
import { ArrowLeft, Loader2, LockKeyhole, Mail, ShieldCheck, UserRound } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { isSupabaseConfigured } from "@/lib/auth";

interface Props {
  kind: "sign-in" | "sign-up";
  basePath: string;
}

export default function AuthPage({ basePath }: Props) {
  const [, navigate] = useLocation();
  const { authReady, signIn, signUp, signInWithGoogle, authError, clearAuthError } = useAuth();
  const [mode, setMode] = useState<"sign-in" | "sign-up">(window.location.pathname.includes("sign-up") ? "sign-up" : "sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [redirecting, setRedirecting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function continueWithGoogle() {
    clearAuthError();
    setRedirecting(true);
    signInWithGoogle();
  }

  function switchMode(nextMode: "sign-in" | "sign-up") {
    clearAuthError();
    setSuccessMessage(null);
    setMode(nextMode);
    window.history.replaceState({}, "", `${basePath}/${nextMode}`);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearAuthError();
    setSuccessMessage(null);

    if (mode === "sign-up" && username.trim().length < 3) {
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "sign-up") {
        const needsEmailConfirmation = await signUp(email.trim(), password, username.trim());
        if (needsEmailConfirmation) {
          setSuccessMessage("Account created. Check your email to confirm your account, then sign in.");
          setPassword("");
        } else {
          window.location.assign(basePath || "/");
        }
      } else {
        await signIn(email.trim(), password);
        window.location.assign(basePath || "/");
      }
    } catch {
      // AuthContext exposes the provider's error message in authError.
    } finally {
      setSubmitting(false);
    }
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
        <button type="button" onClick={() => navigate(basePath || "/")} className="flex items-center gap-2 text-sm mb-5" style={{ color: "var(--th-muted)" }}>
          <ArrowLeft size={16} /> Back to Elite FF
        </button>
        <div className="rounded-3xl p-6" style={{ background: "var(--th-card)", border: "1px solid var(--th-border)", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: "rgba(255,107,53,0.14)", color: "#ff6b35" }}>
              <ShieldCheck size={23} />
            </div>
            <div>
              <div className="font-display font-black text-2xl text-foreground">Welcome to Elite FF</div>
              <div className="text-xs mt-1" style={{ color: "var(--th-muted)" }}>
                {mode === "sign-in" ? "Sign in to continue to your tournaments" : "Create your player account"}
              </div>
            </div>
          </div>

          <p className="text-sm leading-6 mb-5" style={{ color: "var(--th-muted)" }}>
            Join tournaments, track results, and manage your player profile from one secure account.
          </p>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === "sign-up" && (
              <label className="block">
                <span className="sr-only">Username</span>
                <div className="relative">
                  <UserRound size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--th-muted)" }} />
                  <input
                    required
                    minLength={3}
                    value={username}
                    onChange={event => setUsername(event.target.value)}
                    placeholder="Username"
                    autoComplete="username"
                    className="w-full h-12 rounded-xl pl-10 pr-3 text-sm outline-none"
                    style={{ background: "var(--th-bg)", border: "1px solid var(--th-border)", color: "var(--th-text)" }}
                  />
                </div>
              </label>
            )}
            <label className="block">
              <span className="sr-only">Email address</span>
              <div className="relative">
                <Mail size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--th-muted)" }} />
                <input
                  required
                  type="email"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  placeholder="Email address"
                  autoComplete="email"
                  className="w-full h-12 rounded-xl pl-10 pr-3 text-sm outline-none"
                  style={{ background: "var(--th-bg)", border: "1px solid var(--th-border)", color: "var(--th-text)" }}
                />
              </div>
            </label>
            <label className="block">
              <span className="sr-only">Password</span>
              <div className="relative">
                <LockKeyhole size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--th-muted)" }} />
                <input
                  required
                  minLength={6}
                  type="password"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  placeholder="Password"
                  autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                  className="w-full h-12 rounded-xl pl-10 pr-3 text-sm outline-none"
                  style={{ background: "var(--th-bg)", border: "1px solid var(--th-border)", color: "var(--th-text)" }}
                />
              </div>
            </label>
            {authError && (
              <div role="alert" className="rounded-xl px-3 py-2.5 text-xs font-semibold" style={{ color: "#fecaca", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(248,113,113,0.25)" }}>
                {authError}
              </div>
            )}
            {successMessage && (
              <div role="status" className="rounded-xl px-3 py-2.5 text-xs font-semibold" style={{ color: "#bbf7d0", background: "rgba(34,197,94,0.12)", border: "1px solid rgba(74,222,128,0.25)" }}>
                {successMessage}
              </div>
            )}
            <button
              type="submit"
              disabled={!authReady || submitting}
              className="w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ background: "var(--gradient-primary)", color: "#0a0e27" }}
            >
              {submitting && <Loader2 size={17} className="animate-spin" />}
              {submitting ? "Please wait..." : mode === "sign-in" ? "Sign in" : "Create account"}
            </button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="h-px flex-1" style={{ background: "var(--th-border)" }} />
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--th-dim)" }}>or</span>
            <div className="h-px flex-1" style={{ background: "var(--th-border)" }} />
          </div>

          <button
            type="button"
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
            Google sign-in is available when enabled in your Supabase project.
          </p>
          <p className="text-center text-xs mt-5" style={{ color: "var(--th-muted)" }}>
            {mode === "sign-in" ? "New to Elite FF?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => switchMode(mode === "sign-in" ? "sign-up" : "sign-in")}
              className="font-bold underline underline-offset-2"
              style={{ color: "#ff6b35" }}
            >
              {mode === "sign-in" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}