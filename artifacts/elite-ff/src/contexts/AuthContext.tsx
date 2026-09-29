import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import {
  consumeOAuthCallback,
  getGoogleOAuthUrl,
  getToken,
  hydrateCurrentSessionUser,
  loadSession,
  refreshCurrentSession,
  signInWithPassword,
  signUpWithPassword,
  signOut,
  subscribeToAuthChanges,
  type SupabaseSession,
  type SupabaseUser,
} from "@/lib/auth";

export interface User {
  id: number;
  username: string;
  role: "host" | "player";
  isHost: boolean;
  email?: string | null;
  profileImageUrl?: string | null;
  points?: number;
  rank?: string;
  prestigeStars?: number;
  totalEarnings?: number;
  weeklyFairPlay?: number;
  toxicReportCount?: number;
  pointShifts?: string | null;
}

interface AuthContextType {
  user: User | null;
  authReady: boolean;
  accounts: { username: string; role: "host" | "player" }[];
  login: () => void;
  logout: () => void;
  addAccount: () => void;
  switchAccount: (_username: string) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, username: string) => Promise<boolean>;
  signInWithGoogle: () => void;
  authError: string | null;
  clearAuthError: () => void;
}

function authPath(path: "sign-in" | "sign-up") {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${basePath}/${path}`;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  authReady: false,
  accounts: [],
  login: () => {},
  logout: () => {},
  addAccount: () => {},
  switchAccount: () => {},
  signIn: async () => {},
  signUp: async () => false,
  signInWithGoogle: () => {},
  authError: null,
  clearAuthError: () => {},
});

const HOST_EMAILS = ["venomx2424@gmail.com", "knightxvenom@gmail.com"];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SupabaseSession | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [dbUser, setDbUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    setAuthTokenGetter(getToken);
    let mounted = true;
    const unsubscribe = subscribeToAuthChanges(nextSession => {
      if (mounted) setSession(nextSession);
    });
    const refreshTimer = window.setInterval(() => {
      void refreshCurrentSession().then(nextSession => {
        if (mounted && nextSession) setSession(nextSession);
      }).catch(() => {
        if (mounted) setSession(null);
      });
    }, 60_000);

    void (async () => {
      const callbackSession = consumeOAuthCallback();
      const currentSession = callbackSession ?? await loadSession();
      const hydratedUser = currentSession ? await hydrateCurrentSessionUser() : null;
      if (mounted) {
        setSession(hydratedUser && currentSession ? { ...currentSession, user: hydratedUser } : currentSession);
        setAuthReady(true);
      }
    })();
    return () => {
      mounted = false;
      window.clearInterval(refreshTimer);
      unsubscribe();
      setAuthTokenGetter(null);
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setDbUser(null);
      window.dispatchEvent(new CustomEvent("eliteff_user_changed", { detail: { username: null } }));
      return;
    }

    const authUser = session.user;
    const email = authUser.email ?? null;
    void (async () => {
      const response = await fetch(`${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/auth/me`, {
        credentials: "include",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = response.ok ? await response.json() : null;
      const isHost = data?.role === "host" || (email ? HOST_EMAILS.includes(email.trim().toLowerCase()) : false);
      const user = toAppUser(data, authUser, isHost);
      setDbUser(user);
      window.dispatchEvent(new CustomEvent("eliteff_user_changed", { detail: { username: user.username } }));
    })().catch(() => {
      const isHost = email ? HOST_EMAILS.includes(email.trim().toLowerCase()) : false;
      const user = toAppUser(null, authUser, isHost);
      setDbUser(user);
      window.dispatchEvent(new CustomEvent("eliteff_user_changed", { detail: { username: user.username } }));
    });
  }, [session]);

  function login() {
    window.location.assign(authPath("sign-in"));
  }

  function logout() {
    void signOut().finally(() => {
      setSession(null);
      setAuthError(null);
    });
  }

  return (
    <AuthContext.Provider value={{
      user: dbUser,
      authReady,
      accounts: dbUser ? [{ username: dbUser.username, role: dbUser.role }] : [],
      login,
      logout,
      addAccount: login,
      switchAccount: () => {},
      signIn: async (email, password) => {
        setAuthError(null);
        try {
          const nextSession = await signInWithPassword(email, password);
          setSession(nextSession);
        } catch (error) {
          setAuthError(error instanceof Error ? error.message : "Unable to sign in.");
          throw error;
        }
      },
      signUp: async (email, password, username) => {
        setAuthError(null);
        try {
          const result = await signUpWithPassword(email, password, username);
          if ("access_token" in result) setSession(result);
          return "session" in result ? result.session === null : false;
        } catch (error) {
          setAuthError(error instanceof Error ? error.message : "Unable to create your account.");
          throw error;
        }
      },
      signInWithGoogle: () => {
        const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
        const oauthUrl = getGoogleOAuthUrl(basePath);
        if (oauthUrl) window.location.assign(oauthUrl);
      },
      authError,
      clearAuthError: () => setAuthError(null),
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }

function toAppUser(data: any, authUser: SupabaseUser, isHost: boolean): User {
  const metadata = authUser.user_metadata ?? {};
  const email = data?.email ?? authUser.email ?? null;
  return {
    id: data?.id ?? 0,
    username: data?.username ?? metadata.full_name ?? metadata.username ?? email?.split("@")[0] ?? "Player",
    role: isHost ? "host" : "player",
    isHost,
    email,
    profileImageUrl: data?.profilePic ?? metadata.avatar_url ?? null,
    points: data?.points,
    rank: data?.rank,
    prestigeStars: data?.prestigeStars,
    totalEarnings: data?.totalEarnings,
    weeklyFairPlay: data?.weeklyFairPlay,
    toxicReportCount: data?.toxicReportCount,
    pointShifts: data?.pointShifts ?? null,
  };
}
