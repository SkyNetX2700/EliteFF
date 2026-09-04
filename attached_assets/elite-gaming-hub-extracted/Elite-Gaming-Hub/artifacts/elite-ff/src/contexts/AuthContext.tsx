import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface User {
  id: number;
  username: string;
  role: "host" | "player";
  isHost: boolean;
  email?: string | null;
  profileImageUrl?: string | null;
}

interface AuthContextType {
  user: User | null;
  accounts: { username: string; role: "host" | "player" }[];
  login: () => void;
  logout: () => void;
  addAccount: () => void;
  switchAccount: (_username: string) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  accounts: [],
  login: () => {},
  logout: () => {},
  addAccount: () => {},
  switchAccount: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    fetch("/api/auth/user", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then((data: any) => {
        if (data?.user) {
          setUser({
            id: data.user.dbId,
            username: data.user.username,
            role: data.user.isHost ? "host" : "player",
            isHost: Boolean(data.user.isHost),
            email: data.user.email ?? null,
            profileImageUrl: data.user.profileImageUrl ?? null,
          });
        } else {
          setUser(null);
        }
      })
      .catch(() => setUser(null));
  }, []);

  function login() {
    window.location.href = `/api/login?returnTo=${encodeURIComponent("/")}`;
  }

  function logout() {
    window.location.href = "/api/logout";
  }

  return (
    <AuthContext.Provider value={{
      user,
      accounts: user ? [{ username: user.username, role: user.role }] : [],
      login,
      logout,
      addAccount: login,
      switchAccount: () => {},
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() { return useContext(AuthContext); }
